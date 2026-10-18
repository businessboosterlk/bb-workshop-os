PART PA3 of the Workshop OS (a garage system in Sri Lanka). Server: Next 15 route handlers in plain JavaScript ES modules, Node 22.

THE JOB. Payments on a job are recorded and corrected through TWO SERVER COMMANDS, in the same shape as the existing close-phase command: a pure function in lib/commands.js that decides, and a route file that reads, locks, checks the version, writes and answers.
- POST /api/<slug>/jobs/<id>/payments                 records one payment (owner or front desk)
- POST /api/<slug>/jobs/<id>/payments/<pid>/reverse   corrects one payment (owner only)
The rules for the payment lines themselves already live in apps/api/lib/payments.js (below). Do not repeat them: call `record`, `reverse` and `nextNo`.

TYPES (field by field).
- Session seat `s`: `{ kind: 'customer' | 'staff', name: string, phone?: string, role?: 'owner' | 'desk' | 'staff', branch?: string }`. 'desk' is the front desk: a staff seat that records payments.
- Job (the fields that matter here): `{ id: string, approved?: number, payments?: Payment[], updatedAt: string, ... }` (Payment is the typedef in payments.js below).
- Activity row: `{ jobId: string, type: 'payment', summary: string, by: string }`.
- Store (all async), from apps/api/lib/store.js: `store.get(slug, kind, id)` returns the row or null. `store.list(slug, kind, { limit, offset })` returns at most `limit` rows (never more than 500) in a stable order; read every page by raising `offset` by 500 until a page holds fewer than 500 rows. `store.update(slug, kind, id, patch, expect)` merges `patch` and returns the new row, or returns the symbol `CONFLICT` when the stored `updatedAt` is no longer `expect`. `store.create(slug, kind, data)` returns the new row. `store.audit(slug, seatName, action, kind, id)`. Also exported from store.js: `CONFLICT`, and `project(slug, kind, s, row)` (async) which returns the row as that seat may see it, or null.
- From apps/api/lib/auth.js: `session(req, slug)` returns the seat or null; `deny(msg = 'Sign in first', status = 401)` returns a JSON Response `{ error: msg }`.

THE ENGINE apps/api/lib/payments.js (already written and checked; read its exports):
```js
// Server copy of apps/web/src/app/core/payments.ts: both must keep the same rules.

/** @typedef {'cash' | 'card' | 'bank' | 'cheque'} PayMethod */
/** @typedef {{ id: string, no: string, at: string, recordedAt: string, amount: number, method: PayMethod, by: string, note?: string, reverses?: string, op?: string }} Payment */
/** @typedef {{ id: string, no: string, at: string, recordedAt: string, amount: number, method: PayMethod, by: string, note?: string, reverses?: string, op?: string, reversedBy?: string }} PaymentLine */
/** @typedef {{ approved?: number, balance?: number, payments?: Payment[] }} PayJob */
/** @typedef {{ amount: unknown, method: unknown, at: unknown, note?: unknown }} RecordInput */
/** @typedef {{ by: string, now: string, today: string, id: string, no: string, op?: string }} RecordCtx */
/** @typedef {{ by: string, now: string, today: string, id: string, op?: string }} ReverseCtx */
/** @typedef {{ ok: true, payments: Payment[] } | { ok: false, reason: string }} PayResult */

export const PAY_METHODS = ['cash', 'card', 'bank', 'cheque'];

function listOf(job) {
  return Array.isArray(job?.payments) ? job.payments : [];
}

function isCorrection(line) {
  return typeof line.reverses === 'string' && line.reverses !== '';
}

function amountOf(line) {
  return Number.isFinite(line.amount) ? line.amount : 0;
}

function isReplay(job, op) {
  if (typeof op !== 'string' || op === '') return false;
  return listOf(job).some(line => line.op === op);
}

/** @param {PayJob | null | undefined} job @returns {number} */
export function paidOf(job) {
  const lines = listOf(job);
  let total = 0;
  for (const line of lines) {
    if (isCorrection(line)) {
      total -= amountOf(line);
    } else {
      total += amountOf(line);
    }
  }
  return total;
}

/** @param {PayJob | null | undefined} job @returns {number} */
export function balanceOf(job) {
  if (job === null || job === undefined) return 0;
  if (typeof job.approved === 'number' && Number.isFinite(job.approved)) {
    return job.approved - paidOf(job);
  }
  if (typeof job.balance === 'number' && Number.isFinite(job.balance)) {
    return job.balance;
  }
  return 0;
}

/** @param {PayJob | null | undefined} job @returns {PaymentLine[]} */
export function lines(job) {
  const raw = listOf(job);
  const corrections = raw.filter(isCorrection);
  const result = [];
  for (const line of raw) {
    if (isCorrection(line)) continue;
    const copy = { ...line };
    const correction = corrections.find(c => c.reverses === line.id);
    if (correction) {
      copy.reversedBy = correction.id;
    }
    result.push(copy);
  }
  result.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? 1 : -1;
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    return 0;
  });
  return result;
}

/** @param {ReadonlyArray<PayJob | null | undefined>} jobs @param {string} at @returns {string} */
export function nextNo(jobs, at) {
  const atStr = String(at ?? '');
  const prefix = 'R-' + atStr.slice(0, 4) + atStr.slice(5, 7) + '-';
  let count = 0;
  for (const job of jobs) {
    if (job === null || job === undefined) continue;
    if (!Array.isArray(job.payments)) continue;
    for (const line of job.payments) {
      if (typeof line.no === 'string' && line.no !== '' && line.no.startsWith(prefix)) {
        count++;
      }
    }
  }
  return prefix + String(count + 1).padStart(3, '0');
}

/** @param {PayJob | null | undefined} job @param {RecordInput} input @param {RecordCtx} ctx @returns {PayResult} */
export function record(job, input, ctx) {
  if (isReplay(job, ctx.op)) {
    return { ok: true, payments: listOf(job) };
  }
  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, reason: 'The amount must be a whole number of rupees above 0' };
  }
  if (!PAY_METHODS.includes(input.method)) {
    return { ok: false, reason: 'Choose how they paid' };
  }
  const atStr = String(input.at ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(atStr)) {
    return { ok: false, reason: 'Choose the date they paid' };
  }
  const date = new Date(atStr + 'T00:00:00Z');
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== atStr) {
    return { ok: false, reason: 'Choose the date they paid' };
  }
  if (atStr > ctx.today) {
    return { ok: false, reason: 'The date cannot be in the future' };
  }
  const owed = balanceOf(job);
  if (input.amount > owed) {
    return { ok: false, reason: 'That is more than the ' + owed + ' still owed on this car' };
  }
  const line = {
    id: ctx.id,
    no: ctx.no,
    at: atStr,
    recordedAt: ctx.now,
    amount: input.amount,
    method: input.method,
    by: ctx.by,
  };
  if (typeof input.note === 'string') {
    const note = input.note.trim().slice(0, 200);
    if (note !== '') {
      line.note = note;
    }
  }
  if (typeof ctx.op === 'string' && ctx.op !== '') {
    line.op = ctx.op;
  }
  return { ok: true, payments: [...listOf(job), line] };
}

/** @param {PayJob | null | undefined} job @param {string} paymentId @param {ReverseCtx} ctx @returns {PayResult} */
export function reverse(job, paymentId, ctx) {
  if (isReplay(job, ctx.op)) {
    return { ok: true, payments: listOf(job) };
  }
  const list = listOf(job);
  const p = list.find(line => line.id === paymentId);
  if (!p) {
    return { ok: false, reason: 'No such payment' };
  }
  if (isCorrection(p)) {
    return { ok: false, reason: 'A correction cannot itself be corrected' };
  }
  if (list.some(line => line.reverses === paymentId)) {
    return { ok: false, reason: 'This payment is already corrected' };
  }
  const line = {
    id: ctx.id,
    no: '',
    at: ctx.today,
    recordedAt: ctx.now,
    amount: p.amount,
    method: p.method,
    by: ctx.by,
    reverses: paymentId,
  };
  if (typeof ctx.op === 'string' && ctx.op !== '') {
    line.op = ctx.op;
  }
  return { ok: true, payments: [...list, line] };
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
```

THE MODEL TO FOLLOW, apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js:
```js
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
```

WHAT TO WRITE. Return ONE ```js code block holding three parts, each opened by its header line exactly as shown, in this order.

Part 1 header line: `// FILE: apps/api/lib/commands.js`
The WHOLE file: first the line `import { record, reverse, nextNo } from './payments.js';`, then every existing function EXACTLY as it is now (closePhase, versionCheck, spaceClash, the `tails` map and withLock, character for character), then three new exports at the end:

`colomboDay(nowIso)`: the calendar day in Sri Lanka (UTC+5:30 all year, no summer time) for an ISO time: `new Date(Date.parse(nowIso) + 330 * 60000).toISOString().slice(0, 10)`. So '2026-10-18T20:00:00.000Z' gives '2026-10-19' and '2026-10-18T18:00:00.000Z' gives '2026-10-18'.

`recordPayment(job, jobs, body, s, nowIso, id, op)`. Pure: never changes its arguments, never reads the clock. `jobs` is every job of the workshop (for the receipt number). `id` is the new line's id. `op` is the request's x-wos-op or undefined. Returns `{ status, error }`, or `{ patch: null }` for a replay, or `{ patch, activity }`. In this order:
1. `!s || s.kind !== 'staff'`: `{ status: 403, error: 'Staff only' }`.
2. `s.role !== 'owner' && s.role !== 'desk'`: `{ status: 403, error: 'This seat cannot do that.' }`.
3. `body` null, not an object, or an array: `{ status: 400, error: 'Body must be an object' }`.
4. `const today = colomboDay(nowIso)`; `const no = nextNo(jobs, typeof body.at === 'string' ? body.at : '')`.
5. `const r = record(job, { amount: body.amount, method: body.method, at: body.at, note: body.note }, { by: s.name, now: nowIso, today, id, no, op })`.
6. `!r.ok`: `{ status: 400, error: r.reason }`.
7. A replay (record gave back the list unchanged): when `r.payments.length === (Array.isArray(job.payments) ? job.payments.length : 0)` return `{ patch: null }`.
8. Otherwise `{ patch: { payments: r.payments }, activity: { jobId: job.id, type: 'payment', summary: 'Payment recorded (' + no + ')', by: s.name } }`. The activity NEVER holds the amount: staff and customers read activity lines.

`reversePayment(job, paymentId, s, nowIso, id, op)`. Pure, same return shapes. In this order:
1. `!s || s.kind !== 'staff'`: `{ status: 403, error: 'Staff only' }`.
2. `s.role !== 'owner'`: `{ status: 403, error: 'This seat cannot do that.' }`.
3. `const r = reverse(job, String(paymentId), { by: s.name, now: nowIso, today: colomboDay(nowIso), id, op })`.
4. `!r.ok`: `{ status: r.reason === 'No such payment' ? 404 : 409, error: r.reason }`.
5. Replay exactly as rule 7 above: `{ patch: null }`.
6. Otherwise `{ patch: { payments: r.payments }, activity: { jobId: job.id, type: 'payment', summary: 'Payment corrected', by: s.name } }`.

Part 2 header line: `// FILE: apps/api/app/api/[slug]/[table]/[id]/payments/route.js`
A new route file, one folder below [id] like close-phase, so its imports climb six folders: `import { randomUUID } from 'node:crypto';` then `store, project, CONFLICT` from '../../../../../../lib/store.js', `session, deny` from '../../../../../../lib/auth.js', `recordPayment, versionCheck, withLock` from '../../../../../../lib/commands.js'. `export const dynamic = 'force-dynamic';`. `export async function POST(req, { params })`:
1. `const { slug, table, id } = await params;` table not 'jobs': `Response.json({ error: 'Unknown command' }, { status: 404 })`.
2. `const s = session(req, slug); if (!s) return deny();`
3. `const body = await req.json().catch(() => null);` `const op = req.headers.get('x-wos-op') || undefined;`
4. Everything below runs inside `return withLock(slug + ':jobs', async () => { ... })`:
   a. `cur = await store.get(slug, 'jobs', id)`; none: `deny('Not found', 404)`.
   b. Read every job of the workshop: `const jobs = []; for (let offset = 0; ; offset += 500) { const page = await store.list(slug, 'jobs', { limit: 500, offset }); jobs.push(...page); if (page.length < 500) break; }`.
   c. `const r = recordPayment(cur, jobs, body, s, new Date().toISOString(), 'pay-' + randomUUID(), op);` a refusal answers `Response.json({ error: r.error }, { status: r.status })`.
   d. A replay (`r.patch === null`) answers the job as it is, BEFORE the version check, with no write, no activity and no audit: `Response.json((await project(slug, 'jobs', s, cur)) || { id })`. (A request the outbox sends again after its reply was lost carries an old version; it must still get a 200, never a 409, because the payment is already there.)
   e. The version rule exactly as close-phase: `const v = versionCheck(cur, req.headers.get('x-wos-version'), s); if (v) return Response.json({ error: v.error }, { status: v.status });`
   f. `const row = await store.update(slug, 'jobs', id, r.patch, cur.updatedAt);` `CONFLICT`: answer 409 `{ error: 'Someone else changed this job since you opened it. Reload it and try again.' }`.
   g. `await store.create(slug, 'activities', r.activity);` `await store.audit(slug, s.name, 'payment', 'jobs', id);`
   h. Answer `Response.json((await project(slug, 'jobs', s, row)) || { id })` (status 200): the saved job as the caller may see it.
Also `export async function OPTIONS(){ return new Response(null, { status: 204 }); }`.

Part 3 header line: `// FILE: apps/api/app/api/[slug]/[table]/[id]/payments/[pid]/reverse/route.js`
A new route file. Its folder is app/api/[slug]/[table]/[id]/payments/[pid]/reverse, so its imports climb EIGHT folders: '../../../../../../../../lib/store.js', '../../../../../../../../lib/auth.js', '../../../../../../../../lib/commands.js'. Imports: `randomUUID` from 'node:crypto'; `store, project, CONFLICT`; `session, deny`; `reversePayment, versionCheck, withLock`. Same as Part 2 step by step, except: `const { slug, table, id, pid } = await params;`, no body is read, step b (reading every job) is left out, step c is `const r = reversePayment(cur, pid, s, new Date().toISOString(), 'pay-' + randomUUID(), op);` and the audit action is 'payment-correct'. Also the same OPTIONS.

TRAPS.
- Keep closePhase, versionCheck, spaceClash and withLock in commands.js character for character; other routes import them.
- `by` always comes from the session (`s.name`), never from the body. Take only amount, method, at and note from the body.
- The activity summary carries the receipt number only, never an amount.
- The refusal check (step c) comes BEFORE the replay answer and the version check, so a plain staff seat is refused 403 whatever version it sends.
- Header lines first in each part exactly as written. Plain JavaScript, no TypeScript, no em or en dash anywhere.
