PART B1 of the Workshop OS (a garage system). Server: Next 15 route handlers in plain JavaScript ES modules. Web: Angular 20 TypeScript.

THE JOB. When a garage needs extra work on a car it adds an APPROVAL to the job and the customer answers yes or no from their phone. Batch 1 made the customer send only the answer and made the server build the change from the stored job. Two things are still missing:
1. On a yes the server must ADD the approval's stored amount to the job's `approved` money total, once only. The amount always comes from the stored approval, never from anything the customer sends. A no adds nothing. Sending the same answer again changes nothing.
2. A customer seat may not create rows (POST is staff only), so the activity line "Approved: <title>" or "Declined: <title>" must be written by the server in the same request.
3. The customer page in the web app still sends the OLD shape (the whole approvals array and the approved total) and the server refuses it with 403. It must send the new shape `{ approvalId, status }`.

TYPES (field by field).
- Approval: `{ id: string, title: string, detail?: string, amount?: number, status: 'pending' | 'approved' | 'declined', askedAt: string, answeredAt?: string }`
- Job (the fields that matter here): `{ id, customerPhone: string, status: 'open' | 'ready' | 'delivered', approvals: Approval[], approved?: number, rating?: number, updatedAt: string }`
- Session seat `s`: `{ kind: 'customer' | 'staff', name: string, phone?: string, role?: 'owner' | 'staff', branch?: string }`
- Activity row: `{ jobId: string, type: 'approval', summary: string, by: string }` (the store adds id, createdAt and updatedAt)
- `store.create(slug, kind, data)` returns the new row. `store.update(slug, kind, id, patch)` merges patch into the stored row and returns it. `store.audit(slug, seat, action, kind, id)` logs. All async.

CURRENT FILE apps/api/lib/answer.js:
```js
{{file:apps/api/lib/answer.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/route.js}}
```

CURRENT METHOD in apps/web/src/app/core/data.service.ts (inside class DataService):
```ts
{{lines:apps/web/src/app/core/data.service.ts:187:194}}
```
Facts about that class you need:
- `this.mode()` returns 'local' (the demo, everything in this browser) or 'api' (the real server).
- `this.adapter.update<Job>('jobs', id, patch)` sends `PATCH /api/<slug>/jobs/<id>` with `patch` as the JSON body and returns the server's reply row, or `null` when the write could not reach the server and was queued.
- `this.jobs` is a signal: `this.jobs()` reads the array, `this.jobs.update(x => x.map(...))` replaces it.
- `this.patchJob(id, patch)` (private) calls adapter.update and, when it returns null, merges the patch into the local job. NEVER use patchJob for the api answer: it would merge `status: 'approved'` onto the JOB's own status.
- `this.log(jobId, type, summary, by)` (private) POSTs an activity. A customer may not POST, so in api mode do NOT call log.
- `now()` returns an ISO time string; it is a module level function already in the file.

WHAT TO WRITE. Return ONE ```js code block that holds three parts, each opened by its header line exactly as shown, in this order:

Part 1 header line: `// FILE: apps/api/lib/answer.js`
The whole new apps/api/lib/answer.js. Keep every rule it has today (who may answer, the exact body keys, 400, 404, 409, the rating rules, never mutate the job or body). Change only this:
- On a pending approval answered 'approved', the patch is `{ approvals: newApprovals, approved: base + add }` where `base` is `job.approved` when it is a finite number, else 0, and `add` is the stored `existing.amount` when it is a finite number greater than 0 (`typeof === 'number' && Number.isFinite(x) && x > 0`), else 0.
- On a pending approval answered 'declined', the patch is `{ approvals: newApprovals }` with NO `approved` key.
- Both of those results also carry `activity: { type: 'approval', summary: 'Approved: ' + existing.title }` (or `'Declined: ' + existing.title`). So they return `{ patch, activity }`.
- The repeat answer still returns `{ patch: null }` with no activity. The rating results stay exactly as today (no activity).

Part 2 header line: `// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js`
The whole route file, unchanged except inside the customer branch of PATCH: after `store.update` writes `a.patch`, when `a.activity` is set, create the activity with `await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' })`. Keep the imports, the audit call, the projection of the reply and every other handler exactly as they are.

Part 3 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=/* the customer answers from their phone | until=async setPickup(`
TypeScript: the comment line and the whole new `answerApproval` method, indented two spaces like the original. Rules:
- Keep the first two guard lines as they are (no job, cannot see it, no such approval, not pending: return null).
- When `this.mode() === 'api'`: call `this.adapter.update<Job>('jobs', jobId, { approvalId, status: yes ? 'approved' : 'declined' } as any)`. The body must be exactly those two keys, nothing else. If the reply `r` is a row, use it as the new job. If it is null, use `{ ...j, approvals: j.approvals.map(x => x.id === approvalId ? { ...x, status: yes ? 'approved' as const : 'declined' as const, answeredAt: now() } : x) }`. Replace the job in `this.jobs` with it (`this.jobs.update(x => x.map(y => y.id === jobId ? next : y))`) and return it. Do not call log and do not call patchJob in this branch.
- Otherwise (local demo) keep the original body exactly: the approvals map, `this.patchJob(...)` with the approved total, then `this.log(...)` with 'Customer', return r.

TRAPS.
- `'amount' in body` from the customer is already refused by the key check; never read any number from `body`.
- A missing, negative, zero, NaN or string amount adds 0.
- A job with no `approved` yet starts from 0, not NaN.
- Do not change the answer for a repeat or the 409 for a changed answer.
- The header lines must be the first line of each part exactly as written, with nothing between parts but the next header.
