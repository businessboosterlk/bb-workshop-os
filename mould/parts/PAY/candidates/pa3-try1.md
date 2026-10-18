```js
// FILE: apps/api/lib/commands.js
import { record, reverse, nextNo } from './payments.js';

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

export function colomboDay(nowIso) {
  return new Date(Date.parse(nowIso) + 330 * 60000).toISOString().slice(0, 10);
}

export function recordPayment(job, jobs, body, s, nowIso, id, op) {
  if (!s || s.kind !== 'staff') return { status: 403, error: 'Staff only' };
  if (s.role !== 'owner' && s.role !== 'desk') return { status: 403, error: 'This seat cannot do that.' };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { status: 400, error: 'Body must be an object' };
  const today = colomboDay(nowIso);
  const no = nextNo(jobs, typeof body.at === 'string' ? body.at : '');
  const r = record(job, { amount: body.amount, method: body.method, at: body.at, note: body.note }, { by: s.name, now: nowIso, today, id, no, op });
  if (!r.ok) return { status: 400, error: r.reason };
  if (r.payments.length === (Array.isArray(job.payments) ? job.payments.length : 0)) return { patch: null };
  return { patch: { payments: r.payments }, activity: { jobId: job.id, type: 'payment', summary: 'Payment recorded (' + no + ')', by: s.name } };
}

export function reversePayment(job, paymentId, s, nowIso, id, op) {
  if (!s || s.kind !== 'staff') return { status: 403, error: 'Staff only' };
  if (s.role !== 'owner') return { status: 403, error: 'This seat cannot do that.' };
  const r = reverse(job, String(paymentId), { by: s.name, now: nowIso, today: colomboDay(nowIso), id, op });
  if (!r.ok) return { status: r.reason === 'No such payment' ? 404 : 409, error: r.reason };
  if (r.payments.length === (Array.isArray(job.payments) ? job.payments.length : 0)) return { patch: null };
  return { patch: { payments: r.payments }, activity: { jobId: job.id, type: 'payment', summary: 'Payment corrected', by: s.name } };
}
// FILE: apps/api/app/api/[slug]/[table]/[id]/payments/route.js
import { randomUUID } from 'node:crypto';
import { store, project, CONFLICT } from '../../../../../../lib/store.js';
import { session, deny } from '../../../../../../lib/auth.js';
import { recordPayment, versionCheck, withLock } from '../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const body = await req.json().catch(() => null);
  const op = req.headers.get('x-wos-op') || undefined;
  return withLock(slug + ':jobs', async () => {
    const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
    const jobs = [];
    for (let offset = 0; ; offset += 500) {
      const page = await store.list(slug, 'jobs', { limit: 500, offset });
      jobs.push(...page);
      if (page.length < 500) break;
    }
    const r = recordPayment(cur, jobs, body, s, new Date().toISOString(), 'pay-' + randomUUID(), op);
    if (r.error) return Response.json({ error: r.error }, { status: r.status });
    if (r.patch === null) return Response.json((await project(slug, 'jobs', s, cur)) || { id });
    const v = versionCheck(cur, req.headers.get('x-wos-version'), s); if (v) return Response.json({ error: v.error }, { status: v.status });
    const row = await store.update(slug, 'jobs', id, r.patch, cur.updatedAt);
    if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
    await store.create(slug, 'activities', r.activity);
    await store.audit(slug, s.name, 'payment', 'jobs', id);
    return Response.json((await project(slug, 'jobs', s, row)) || { id });
  });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
// FILE: apps/api/app/api/[slug]/[table]/[id]/payments/[pid]/reverse/route.js
import { randomUUID } from 'node:crypto';
import { store, project, CONFLICT } from '../../../../../../../../lib/store.js';
import { session, deny } from '../../../../../../../../lib/auth.js';
import { reversePayment, versionCheck, withLock } from '../../../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id, pid } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const op = req.headers.get('x-wos-op') || undefined;
  return withLock(slug + ':jobs', async () => {
    const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
    const r = reversePayment(cur, pid, s, new Date().toISOString(), 'pay-' + randomUUID(), op);
    if (r.error) return Response.json({ error: r.error }, { status: r.status });
    if (r.patch === null) return Response.json((await project(slug, 'jobs', s, cur)) || { id });
    const v = versionCheck(cur, req.headers.get('x-wos-version'), s); if (v) return Response.json({ error: v.error }, { status: v.status });
    const row = await store.update(slug, 'jobs', id, r.patch, cur.updatedAt);
    if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
    await store.create(slug, 'activities', r.activity);
    await store.audit(slug, s.name, 'payment-correct', 'jobs', id);
    return Response.json((await project(slug, 'jobs', s, row)) || { id });
  });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```