```js
// BLOCK: apps/api/lib/store.js | start=const now = () => new Date().toISOString(); | until=const uid = () =>
const now = () => new Date().toISOString();
export const CONFLICT = Symbol('conflict');

// BLOCK: apps/api/lib/store.js | start=  async update(slug, kind, id, patch){ const b = bucket | until=  async remove(slug, kind, id){ return bucket
  async update(slug, kind, id, patch, expect){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; let u = now(); if (cur.updatedAt && u <= cur.updatedAt) u = new Date(Date.parse(cur.updatedAt) + 1).toISOString(); const row = { ...cur, ...patch, id, updatedAt: u }; b.set(id, row); return row; },

// BLOCK: apps/api/lib/store.js | start=  async update(slug, kind, id, patch){ const cur = await this.get | until=  async remove(slug, kind, id){ const { error }
  async update(slug, kind, id, patch, expect){ const cur = await this.get(slug, kind, id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    let query = (await supa()).from('wos_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id); if (expect !== undefined) query = query.eq('updated_at', expect); const { data: row, error } = await query.select().maybeSingle(); if (error) throw error; if (!row) return CONFLICT; return flat(row); },

// FILE: apps/api/lib/commands.js
export function closePhase(job, photo, body, s, nowIso) {
  if (!s || s.kind !== 'staff') return { status: 403, error: 'Staff only' };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, error: 'Body must be an object' };
  if (typeof body.phaseKey !== 'string' || body.phaseKey.length === 0) return { status: 400, error: 'phaseKey is required' };
  if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) return { status: 400, error: 'note must be a string of at most 2000 characters' };
  if (job.status !== 'open') return { status: 409, error: 'Only a car still being worked on can close a phase' };
  const i = job.phases.findIndex(p => p.status === 'now');
  if (i < 0) return { status: 409, error: 'No phase is running on this job' };
  if (job.phases[i].key !== body.phaseKey) return { status: 409, error: 'Only the phase running now can be closed' };
  if (!photo) return { status: 400, error: 'A phase closes only with a photo' };
  if (photo.jobId !== job.id) return { status: 400, error: 'That photo belongs to another job' };
  if (photo.phaseKey !== body.phaseKey) return { status: 400, error: 'That photo is for another phase' };
  if (job.phases.some(p => p.photoId === photo.id)) return { status: 409, error: 'That photo already closed a phase' };
  const note = body.note;
  const phases = job.phases.map((p, k) => k === i ? { ...p, status: 'done', doneAt: nowIso, photoId: photo.id, by: s.name, ...(note !== undefined ? { note } : {}) } : k === i + 1 ? { ...p, status: 'now', startedAt: nowIso } : p);
  const last = i === job.phases.length - 1;
  const patch = { phases, status: last ? 'ready' : job.status };
  if (last && job.pickup && job.pickup.wanted && job.pickup.status === 'collected') patch.pickup = { ...job.pickup, status: 'booked' };
  const label = job.phases[i].label;
  const activity = { jobId: job.id, type: 'phase', summary: label + ' done' + (note ? ': ' + note : ''), by: s.name };
  return { patch, activity };
}

export function versionCheck(cur, header, s) {
  if (!header || header === '') {
    if (s.kind === 'staff') return { status: 428, error: 'This save did not say which version of the job it read. Reload the job and try again.' };
    return null;
  }
  if (header !== cur.updatedAt) return { status: 409, error: 'Someone else changed this job since you opened it. Reload it and try again.' };
  return null;
}

export function spaceClash(jobs, jobId, branch, spaceKey) {
  if (!spaceKey || typeof spaceKey !== 'string' || spaceKey === '') return false;
  return jobs.some(j => j.id !== jobId && j.status === 'open' && j.branch === branch && j.spaceKey === spaceKey);
}

const tails = new Map();
export function withLock(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.finally(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}

// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js
import { store, validKind, scope, customerJobIds, project, CONFLICT } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
import { customerAnswer } from '../../../../../lib/answer.js';
import { versionCheck, spaceClash, withLock } from '../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table, id } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, id, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const r = await store.get(g.slug, g.table, g.id); if (!r) return deny('Not found', 404); const [out] = scope([r], g.table, g.s, await customerJobIds(g.slug, g.s)); return out ? Response.json(out) : deny('Not found', 404); }
/* a customer may send exactly one thing on their own job: the answer to one pending approval ({ approvalId, status })
   or a rating ({ rating }) once it is delivered. The server builds the change from the stored job (lib/answer.js) and
   takes no number from the customer. The same answer twice is a no-op. */
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body must be an object' }, { status: 400 });
  if (g.table === 'jobs') {
    return withLock(g.slug + ':jobs', async () => {
      const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
      const v = versionCheck(cur, req.headers.get('x-wos-version'), g.s); if (v) return Response.json({ error: v.error }, { status: v.status });
      if (g.s.kind === 'customer') {
        if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
        const a = customerAnswer(cur, body, g.s, new Date().toISOString());
        if (a.error) return Response.json({ error: a.error }, { status: a.status });
        const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch, cur.updatedAt) : cur;
        if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
        if (a.patch && row !== CONFLICT) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
        if (a.activity && row !== CONFLICT) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
        const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
      } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
      else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
      if (g.table === 'jobs') {
        if ('phases' in body) return Response.json({ error: 'A phase closes only through close-phase, with its photo' }, { status: 403 });
        if ('status' in body && !(body.status === 'delivered' && cur.status === 'ready')) return Response.json({ error: 'The job status moves only through its phases and the handover' }, { status: 403 });
        const branch = 'branch' in body ? body.branch : cur.branch; const space = 'spaceKey' in body ? body.spaceKey : cur.spaceKey;
        if (('spaceKey' in body || 'branch' in body) && spaceClash(await store.list(g.slug, 'jobs'), g.id, branch, space)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
      }
      const row = await store.update(g.slug, g.table, g.id, body, cur.updatedAt);
      if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
      await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
      /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
      const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
    });
  }
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const a = customerAnswer(cur, body, g.s, new Date().toISOString());
    if (a.error) return Response.json({ error: a.error }, { status: a.status });
    const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch) : cur;
    if (a.patch) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
    if (a.activity) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
  else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  if (g.table === 'jobs') {
    if ('phases' in body) return Response.json({ error: 'A phase closes only through close-phase, with its photo' }, { status: 403 });
    if ('status' in body && !(body.status === 'delivered' && cur.status === 'ready')) return Response.json({ error: 'The job status moves only through its phases and the handover' }, { status: 403 });
  }
  const row = await store.update(g.slug, g.table, g.id, body);
  await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
  /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; if (g.s.role !== 'owner') return deny('Owner only', 403); await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.s.name, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

// FILE: apps/api/app/api/[slug]/[table]/route.js
import { store, validKind, scope, customerJobIds, project } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
import { spaceClash, withLock } from '../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; return Response.json(scope(await store.list(g.slug, g.table), g.table, g.s, await customerJobIds(g.slug, g.s))); }
/* a customer seat never creates rows; every write is a staff action or, for an approval answer, a PATCH on their own job */
export async function POST(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  if (g.s.kind !== 'staff') return deny('Staff only', 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  if (g.table === 'quotes' && g.s.role !== 'owner') return deny('Owner only', 403);
  if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  if (g.table === 'jobs') {
    return withLock(g.slug + ':jobs', async () => {
      if (spaceClash(await store.list(g.slug, 'jobs'), body.id, body.branch, body.spaceKey)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
      const row = await store.create(g.slug, g.table, { ...body, by: g.s.name });
      await store.audit(g.slug, g.s.name, 'create', g.table, row.id);
      const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });
    });
  }
  const row = await store.create(g.slug, g.table, { ...body, by: g.s.name });
  await store.audit(g.slug, g.s.name, 'create', g.table, row.id);
  /* the answer goes through the same projection as a read: a staff seat never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

// FILE: apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js
import { store, validKind, project, CONFLICT } from '../../../../../../lib/store.js';
import { session, deny } from '../../../../../../lib/auth.js';
import { closePhase, versionCheck, withLock } from '../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const body = await req.json().catch(() => null);
  return withLock(slug + ':jobs', async () => {
    const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
    const v = versionCheck(cur, req.headers.get('x-wos-version'), s); if (v) return Response.json({ error: v.error }, { status: v.status });
    const photo = body && typeof body === 'object' && typeof body.photoId === 'string' ? await store.get(slug, 'photos', body.photoId) : null;
    const r = closePhase(cur, photo, body, s, new Date().toISOString());
    if (r.error) return Response.json({ error: r.error }, { status: r.status });
    const row = await store.update(slug, 'jobs', id, r.patch, cur.updatedAt);
    if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
    await store.create(slug, 'activities', r.activity);
    await store.audit(slug, s.name, 'close-phase', 'jobs', id);
    return Response.json((await project(slug, 'jobs', s, row)) || { id });
  });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

// BLOCK: apps/web/src/app/core/data.service.ts | start=  update<T>(t: Table, id: string, patch: Partial<T>): Promise<T | null>; | until=  remove(t: Table, id: string): Promise<void>;
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string): Promise<T | null>;

// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })
/* every call carries the seat's token; a write that cannot reach the server waits in
   an outbox in this browser and replays on the next success. 401 means the seat is gone. */
class ApiAdapter implements Adapter {
  onAuthLost?: () => void; onOffline?: (n: number) => void;
  constructor(private base: string, private slug: string, private token: () => string) {}
  private outKey(){ return 'wos_outbox_' + this.slug; }
  private outbox(): any[] { try { return JSON.parse(localStorage.getItem(this.outKey()) || '[]'); } catch { return []; } }
  private setOutbox(q: any[]){ try { localStorage.setItem(this.outKey(), JSON.stringify(q)); } catch {} this.onOffline?.(q.length); }
  private async go<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}/api/${this.slug}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token(), ...(init?.headers || {}) } });
    if (res.status === 401) { this.onAuthLost?.(); throw new Error('401'); }
    if (res.status === 204) return null as T;
    if (!res.ok) throw new Error(`${res.status} on ${path}`);
    return res.json();
  }
  async flush(){ const q = this.outbox(); if (!q.length) return; const left: any[] = [];
    for (const w of q) { try { await this.go(w.path, { method: w.method, body: w.body, headers: w.version ? { 'x-wos-version': w.version } : undefined }); } catch (e: any) { if (e.message === '401') return; left.push(w); } }
    this.setOutbox(left); }
  private async write<T>(path: string, method: string, body?: any, fallback?: T, version?: string): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined, headers: version ? { 'x-wos-version': version } : undefined }); this.flush(); return r; }
    catch (e: any) { if (e.message === '401') throw e; this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined, version }]); return fallback as T; }
  }
  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null, version); }
  command<T>(t: Table, id: string, name: string, body: any, version?: string) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null, version); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}

// BLOCK: apps/web/src/app/core/data.service.ts | start=  private async patchJob(id: string, patch: Partial<Job>) { | until=  private async log(
  private async patchJob(id: string, patch: Partial<Job>) {
    const was = this.jobs().find(x => x.id === id);
    const r = (await this.adapter.update<Job>('jobs', id, patch, was?.updatedAt)) || (() => { const cur = this.jobs().find(x => x.id === id); return cur ? { ...cur, ...patch, updatedAt: now() } : null; })();
    if (r) this.jobs.update(x => x.map(j => j.id === id ? r : j)); return r;
  }

// BLOCK: apps/web/src/app/core/data.service.ts | start=const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase' | until=const next = r || { ...j, ...patch, updatedAt: now() };
      const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase', note ? { phaseKey: j.phases[i].key, photoId: photo.id, note } : { phaseKey: j.phases[i].key, photoId: photo.id }, j.updatedAt);

// BLOCK: apps/web/src/app/core/data.service.ts | start=const r = await this.adapter.update<Job>('jobs', jobId, { approvalId | until=const next = r ? r : { ...j, approvals
      const r = await this.adapter.update<Job>('jobs', jobId, { approvalId, status: yes ? 'approved' : 'declined' } as any, j.updatedAt);
```