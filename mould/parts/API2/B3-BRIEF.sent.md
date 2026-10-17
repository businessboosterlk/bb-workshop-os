PART B3 of the Workshop OS (a garage system). Server: Next 15 route handlers in plain JavaScript ES modules. Web: Angular 20 TypeScript. Audit findings E04 and E08.

THE FAULTS.
1. Two tablets open the same job; both save; the second silently overwrites the first. Fix: every JOB write carries the version it read, in the request header `x-wos-version` (the job's `updatedAt` string as the client last read it). The server refuses a save made on an older version.
2. Two cars can be put into the same bay (space) because only the browser checks. Fix: the server refuses a `spaceKey` that another OPEN job of the same branch already holds.
3. Two requests at once can both pass a check before either writes. Fix: job writes in one workshop run one at a time (an in process lock), and the store's update can refuse a write when the stored version is no longer the expected one.

TYPES (field by field).
- Job (the fields that matter): `{ id: string, branch: string, status: 'open' | 'ready' | 'delivered', spaceKey?: string | null, phases: Phase[], approvals: Approval[], updatedAt: string (ISO time, the version) }`
- Session seat `s`: `{ kind: 'customer' | 'staff', name: string, phone?: string, role?: 'owner' | 'staff', branch?: string }`

CURRENT FILE apps/api/lib/store.js:
```js
/* The Workshop OS data layer. One records table keyed by kind, rows carry a JSON
   document, so the API never disagrees with the app about column names.
     memory:   per process. Dev and demo. Nothing survives a restart, on purpose.
     supabase: SERVICE ROLE key server side only. RLS on with no policies, so the anon
               key in every BB front end reads nothing from these tables.
   Every read and write is scoped by workshop slug. No path reads across workshops. */
const KINDS = new Set(['jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes']);
export const mode = process.env.DATA_MODE || (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory');
const now = () => new Date().toISOString();
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mem = new Map();
const bucket = (slug, kind) => { if (!mem.has(slug)) mem.set(slug, new Map()); const t = mem.get(slug); if (!t.has(kind)) t.set(kind, new Map()); return t.get(kind); };
const memory = {
  async list(slug, kind){ return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
  async get(slug, kind, id){ return bucket(slug, kind).get(id) || null; },
  async create(slug, kind, data){ const row = { ...data, id: data.id || uid(), createdAt: now(), updatedAt: now() }; bucket(slug, kind).set(row.id, row); return row; },
  async update(slug, kind, id, patch){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; const row = { ...cur, ...patch, id, updatedAt: now() }; b.set(id, row); return row; },
  async remove(slug, kind, id){ return bucket(slug, kind).delete(id); },
  async audit(){ }
};
let sb = null;
export async function supa(){
  if (sb) return sb;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase mode needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  sb = createClient(url, key, { auth: { persistSession: false } }); return sb;
}
const flat = r => ({ ...r.data, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at });
const supabase = {
  async list(slug, kind){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }); if (error) throw error; return data.map(flat); },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('wos_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch){ const cur = await this.get(slug, kind, id); if (!cur) return null; const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    const { data: row, error } = await (await supa()).from('wos_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id).select().single(); if (error) throw error; return flat(row); },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('wos_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('wos_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.list(slug, 'jobs');
  return new Set(jobs.filter(j => j.customerPhone === s.phone).map(j => j.id));
}

// Scope rows by seat kind and role, using the customer's job id set for non-job kinds.
export function scope(rows, kind, s, jobIds) {
  if (kind === 'enquiries' && s.kind !== 'staff') return [];
  if (kind === 'quotes' && s.role !== 'owner') return [];
  let out = rows;
  if (kind === 'jobs' && s.kind === 'customer') {
    if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
      out = out.filter(r => r.customerPhone === s.phone);
    } else {
      out = [];
    }
  }
  if (kind === 'jobs' && s.role !== 'owner') {
    out = out.map(({ estimate, approved, paid, ...r }) => r);
  }
  if (kind !== 'jobs' && s.kind === 'customer') {
    if (kind === 'customers') {
      if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
        return out.filter(r => r.phone === s.phone);
      }
      return [];
    }
    if (!(jobIds instanceof Set)) return [];
    return out.filter(r => typeof r.jobId === 'string' && r.jobId !== '' && jobIds.has(r.jobId));
  }
  return out;
}

// Project a stored row through the same scope rules as reads, returning null when the seat may not see it.
export async function project(slug, kind, s, row) {
  if (row === null || row === undefined || typeof row !== 'object') return null;
  const jobIds = await customerJobIds(slug, s);
  const scoped = scope([row], kind, s, jobIds);
  return scoped.length > 0 ? scoped[0] : null;
}
```

CURRENT FILE apps/api/lib/commands.js:
```js
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
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
import { store, validKind, scope, customerJobIds, project } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
import { customerAnswer } from '../../../../../lib/answer.js';
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
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
import { store, validKind, scope, customerJobIds, project } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
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
  const row = await store.create(g.slug, g.table, { ...body, by: g.s.name });
  await store.audit(g.slug, g.s.name, 'create', g.table, row.id);
  /* the answer goes through the same projection as a read: a staff seat never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js:
```js
import { store, validKind, project } from '../../../../../../lib/store.js';
import { session, deny } from '../../../../../../lib/auth.js';
import { closePhase } from '../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const body = await req.json().catch(() => null);
  const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
  const photo = body && typeof body === 'object' && typeof body.photoId === 'string' ? await store.get(slug, 'photos', body.photoId) : null;
  const r = closePhase(cur, photo, body, s, new Date().toISOString());
  if (r.error) return Response.json({ error: r.error }, { status: r.status });
  const row = await store.update(slug, 'jobs', id, r.patch);
  await store.create(slug, 'activities', r.activity);
  await store.audit(slug, s.name, 'close-phase', 'jobs', id);
  return Response.json((await project(slug, 'jobs', s, row)) || { id });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT WEB CODE, apps/web/src/app/core/data.service.ts. The Adapter interface (lines 17 to 22):
```ts
interface Adapter {
  list<T>(t: Table): Promise<T[]>;
  create<T>(t: Table, row: Partial<T>): Promise<T>;
  update<T>(t: Table, id: string, patch: Partial<T>): Promise<T | null>;
  remove(t: Table, id: string): Promise<void>;
}
```
The ApiAdapter class (lines 40 to 67):
```ts
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
    for (const w of q) { try { await this.go(w.path, { method: w.method, body: w.body }); } catch (e: any) { if (e.message === '401') return; left.push(w); } }
    this.setOutbox(left); }
  private async write<T>(path: string, method: string, body?: any, fallback?: T): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined }); this.flush(); return r; }
    catch (e: any) { if (e.message === '401') throw e; this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined }]); return fallback as T; }
  }
  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null); }
  command<T>(t: Table, id: string, name: string, body: any) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
```
In class DataService, the private method patchJob:
```ts
  private async patchJob(id: string, patch: Partial<Job>) {
    const r = (await this.adapter.update<Job>('jobs', id, patch)) || (() => { const cur = this.jobs().find(x => x.id === id); return cur ? { ...cur, ...patch, updatedAt: now() } : null; })();
    if (r) this.jobs.update(x => x.map(j => j.id === id ? r : j)); return r;
  }
```
In completePhase (api branch) the command line is:
```ts
      const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase', note ? { phaseKey: j.phases[i].key, photoId: photo.id, note } : { phaseKey: j.phases[i].key, photoId: photo.id });
```
In answerApproval (api branch) the update line is:
```ts
      const r = await this.adapter.update<Job>('jobs', jobId, { approvalId, status: yes ? 'approved' : 'declined' } as any);
```
In both methods `j` is the job as the page read it (`j.updatedAt` is its version).

WHAT TO WRITE. Return ONE ```js code block holding the parts below, each opened by its header line exactly as shown, in this order.

Part 1 header: `// BLOCK: apps/api/lib/store.js | start=const now = () => new Date().toISOString(); | until=const uid = () =>`
Two lines: the `now` line unchanged, then `export const CONFLICT = Symbol('conflict');`

Part 2 header: `// BLOCK: apps/api/lib/store.js | start=  async update(slug, kind, id, patch){ const b = bucket | until=  async remove(slug, kind, id){ return bucket`
The memory store's update, one method: `async update(slug, kind, id, patch, expect)`. No await anywhere inside it (so the check and the write cannot be split). Missing row: null. When `expect !== undefined && cur.updatedAt !== expect`: return CONFLICT. The new `updatedAt` must be strictly later than `cur.updatedAt`: `let u = now(); if (cur.updatedAt && u <= cur.updatedAt) u = new Date(Date.parse(cur.updatedAt) + 1).toISOString();`. Row is `{ ...cur, ...patch, id, updatedAt: u }`.

Part 3 header: `// BLOCK: apps/api/lib/store.js | start=  async update(slug, kind, id, patch){ const cur = await this.get | until=  async remove(slug, kind, id){ const { error }`
The supabase store's update, same signature with `expect`. Same as today but: when `expect !== undefined` and `cur.updatedAt !== expect` return CONFLICT; when `expect !== undefined` add `.eq('updated_at', expect)` to the update query and use `.maybeSingle()` instead of `.single()`; when that returns no row, return CONFLICT. Keep the two lines it has today as two lines.

Part 4 header: `// FILE: apps/api/lib/commands.js`
The whole file: `closePhase` EXACTLY as it is now, plus three new exports:
- `versionCheck(cur, header, s)`: `header` is the `x-wos-version` value (string or null). Empty or null: return `{ status: 428, error: 'This save did not say which version of the job it read. Reload the job and try again.' }` when `s.kind === 'staff'`, else null (a customer answer may leave it out). Otherwise when `header !== cur.updatedAt` return `{ status: 409, error: 'Someone else changed this job since you opened it. Reload it and try again.' }`. Otherwise null.
- `spaceClash(jobs, jobId, branch, spaceKey)`: true when `spaceKey` is a non empty string and some job `j` has `j.id !== jobId && j.status === 'open' && j.branch === branch && j.spaceKey === spaceKey`. Else false.
- `withLock(key, fn)`: runs async `fn` after every earlier `withLock` call with the same key has finished (resolved OR rejected), and returns fn's promise. Use a module level Map of tails; a failed fn must not block later calls; delete the key when its tail is the last one.

Part 5 header: `// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js`
The whole file. PATCH changes only:
- When `g.table === 'jobs'`, everything after the body is parsed (from `store.get` to the reply) runs inside `withLock(g.slug + ':jobs', async () => { ... })` and PATCH returns that promise. Other tables run as today.
- For jobs, right after `cur` is loaded and found: `const v = versionCheck(cur, req.headers.get('x-wos-version'), g.s); if (v) return Response.json({ error: v.error }, { status: v.status });` This comes BEFORE the customer branch, so it covers customers and staff.
- Every `store.update` of a job passes `cur.updatedAt` as the fifth argument (expect). When it returns CONFLICT answer 409 `{ error: 'Someone else changed this job since you opened it. Reload it and try again.' }` (customer branch and staff branch). Do not log the activity, audit or project when it was CONFLICT.
- Staff on jobs, after the phases and status rules and before the write: `const branch = 'branch' in body ? body.branch : cur.branch; const space = 'spaceKey' in body ? body.spaceKey : cur.spaceKey;` when `('spaceKey' in body || 'branch' in body)` and `spaceClash(await store.list(g.slug, 'jobs'), g.id, branch, space)`: answer 409 `{ error: 'Another car is already in that space' }`.
Import `CONFLICT` from store.js and `versionCheck, spaceClash, withLock` from '../../../../../lib/commands.js'. Everything else stays exactly as it is.

Part 6 header: `// FILE: apps/api/app/api/[slug]/[table]/route.js`
The whole file. POST only: when `g.table === 'jobs'`, the create runs inside `withLock(g.slug + ':jobs', ...)`, and when `spaceClash(await store.list(g.slug, 'jobs'), body.id, body.branch, body.spaceKey)` it answers 409 `{ error: 'Another car is already in that space' }` without creating. Import from '../../../../lib/commands.js'. Everything else unchanged.

Part 7 header: `// FILE: apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js`
The whole file. After the table, session and body checks, everything from `store.get` to the reply runs inside `withLock(slug + ':jobs', async () => { ... })`. After `cur` is found: `versionCheck(cur, req.headers.get('x-wos-version'), s)` and answer its refusal. The `store.update` passes `cur.updatedAt` as expect; on CONFLICT answer 409 with the same message as above and write no activity.

Part 8 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  update<T>(t: Table, id: string, patch: Partial<T>): Promise<T | null>; | until=  remove(t: Table, id: string): Promise<void>;`
One line: `  update<T>(t: Table, id: string, patch: Partial<T>, version?: string): Promise<T | null>;`

Part 9 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })`
The comment and the whole ApiAdapter class, changed only so the version travels: `write<T>(path, method, body?, fallback?, version?: string)` adds the header `'x-wos-version': version` to the request when version is set, and a queued outbox item also stores `version` so `flush` sends the same header on replay. `update<T>(t, id, patch, version?: string)` passes it to write. `command<T>(t, id, name, body, version?: string)` passes it too. Keep everything else exactly as it is (the outbox key, the 401 handling, list, create, remove). End with a blank line.

Part 10 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  private async patchJob(id: string, patch: Partial<Job>) { | until=  private async log(`
The patchJob method: same as today, but it reads `const was = this.jobs().find(x => x.id === id);` first and calls `this.adapter.update<Job>('jobs', id, patch, was?.updatedAt)`.

Part 11 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase' | until=const next = r || { ...j, ...patch, updatedAt: now() };`
The same one line (same indentation, six spaces) with `j.updatedAt` added as the fifth argument of command.

Part 12 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=const r = await this.adapter.update<Job>('jobs', jobId, { approvalId | until=const next = r ? r : { ...j, approvals`
The same one line (six spaces) with `j.updatedAt` added as the fourth argument of update.

TRAPS.
- The memory update must not await between reading `cur` and writing the row.
- The version check comes after the 404 for a missing job and before any other rule.
- A staff save without the header is 428, a customer answer without it is allowed.
- `spaceKey: null` (leaving a space) is never a clash.
- Moving a job to another branch while it keeps its spaceKey must be checked against that branch.
- withLock must release the key when fn throws, and must return fn's own result.
- Keep every import path depth exactly as the current files have them.
