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
{{file:apps/api/lib/store.js}}
```

CURRENT FILE apps/api/lib/commands.js:
```js
{{file:apps/api/lib/commands.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/route.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/route.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js}}
```

CURRENT WEB CODE, apps/web/src/app/core/data.service.ts. The Adapter interface (lines 17 to 22):
```ts
{{lines:apps/web/src/app/core/data.service.ts:17:22}}
```
The ApiAdapter class (lines 40 to 67):
```ts
{{lines:apps/web/src/app/core/data.service.ts:40:67}}
```
In class DataService, the private method patchJob:
```ts
{{lines:apps/web/src/app/core/data.service.ts:340:343}}
```
In completePhase (api branch) the command line is:
```ts
{{lines:apps/web/src/app/core/data.service.ts:173:173}}
```
In answerApproval (api branch) the update line is:
```ts
{{lines:apps/web/src/app/core/data.service.ts:200:200}}
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
