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
{{file:apps/api/lib/payments.js}}
```

CURRENT FILE apps/api/lib/commands.js:
```js
{{file:apps/api/lib/commands.js}}
```

THE MODEL TO FOLLOW, apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js}}
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
