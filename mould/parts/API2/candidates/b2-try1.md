```js
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
// FILE: apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js
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
// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js
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
// BLOCK: apps/web/src/app/core/data.service.ts | start=  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write | until=  async remove(t: Table, id: string) { await this.write
  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null); }
  command<T>(t: Table, id: string, name: string, body: any) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null); }
// BLOCK: apps/web/src/app/core/data.service.ts | start=/* THE RULE: the phase closes only with a photo | until=async setPromise(
  /* THE RULE: the phase closes only with a photo. The next phase starts the moment this one ends. */
  async completePhase(jobId: string, photoDataUrl: string, note?: string) {
    const j = this.job(jobId); if (!j) throw new Error('no job');
    const i = j.phases.findIndex(p => p.status === 'now'); if (i < 0) throw new Error('nothing running');
    if (!photoDataUrl || !photoDataUrl.startsWith('data:image/')) throw new Error('A phase closes only with a photo');
    const by = this.session.name();
    const photo = await this.adapter.create<Photo>('photos', { jobId, phaseKey: j.phases[i].key, dataUrl: photoDataUrl, by });
    this.photos.update(x => [photo, ...x]);
    const phases = j.phases.map((p, k) => k === i ? { ...p, status: 'done' as const, doneAt: now(), photoId: photo.id, by, note } : k === i + 1 ? { ...p, status: 'now' as const, startedAt: now() } : p);
    const last = i === j.phases.length - 1;
    const patch: Partial<Job> = { phases, status: last ? 'ready' : j.status };
    /* the last phase is Ready: closing it means the car is ready, the timeline shows it, and the pickup booking wakes up */
    if (last && j.pickup.wanted && j.pickup.status === 'collected') patch.pickup = { ...j.pickup, status: 'booked' };
    if (this.mode() === 'api') {
      const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase', note ? { phaseKey: j.phases[i].key, photoId: photo.id, note } : { phaseKey: j.phases[i].key, photoId: photo.id });
      const next = r || { ...j, ...patch, updatedAt: now() };
      this.jobs.update(x => x.map(oj => oj.id === jobId ? next : oj));
      this.activities.update(x => [{ id: uid(), jobId, type: 'phase', summary: `${j.phases[i].label} done${note ? ': ' + note : ''}`, by, createdAt: now(), updatedAt: now() } as Activity, ...x]);
      return next;
    }
    const r = await this.patchJob(jobId, patch);
    await this.log(jobId, 'phase', `${j.phases[i].label} done${note ? ': ' + note : ''}`);
    return r;
  }
```