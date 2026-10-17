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
// Answers a customer's approval or rating request for their own job, building the patch from stored data only.
// Returns a patch object, null for no change, or an error response; never mutates the job or body.
export function customerAnswer(job, body, s, nowIso) {
  if (s.kind !== 'customer' || typeof s.phone !== 'string' || s.phone.length === 0 || job.customerPhone !== s.phone) {
    return { status: 403, error: 'Not yours' };
  }
  const keys = Object.keys(body);
  const isAnswer = keys.length === 2 && keys.includes('approvalId') && keys.includes('status');
  const isRating = keys.length === 1 && keys.includes('rating');
  if (!isAnswer && !isRating) {
    return { status: 403, error: 'Not yours' };
  }
  if (isAnswer) {
    const { approvalId, status } = body;
    if (typeof approvalId !== 'string' || approvalId.length === 0 || (status !== 'approved' && status !== 'declined')) {
      return { status: 400, error: 'Invalid answer' };
    }
    const approvals = Array.isArray(job.approvals) ? job.approvals : [];
    const idx = approvals.findIndex(a => a.id === approvalId);
    if (idx === -1) {
      return { status: 404, error: 'No such approval' };
    }
    const existing = approvals[idx];
    if (existing.status === 'pending') {
      const newApprovals = approvals.map((a, i) => {
        if (i !== idx) return a;
        return { ...a, status, answeredAt: nowIso };
      });
      return { patch: { approvals: newApprovals } };
    }
    if (existing.status === status) {
      return { patch: null };
    }
    return { status: 409, error: 'Already answered' };
  }
  const { rating } = body;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 400, error: 'Invalid rating' };
  }
  if (job.status !== 'delivered') {
    return { status: 409, error: 'Rate the job once it is delivered' };
  }
  if (job.rating === undefined || job.rating === null) {
    return { patch: { rating } };
  }
  if (job.rating === rating) {
    return { patch: null };
  }
  return { status: 409, error: 'Already rated' };
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
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
  else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  const row = await store.update(g.slug, g.table, g.id, body);
  await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
  /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; if (g.s.role !== 'owner') return deny('Owner only', 403); await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.s.name, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT METHOD in apps/web/src/app/core/data.service.ts (inside class DataService):
```ts
  /* the customer answers from their phone; the answer is logged with the time, and approved money is added to the job */
  async answerApproval(jobId: string, approvalId: string, yes: boolean) {
    const j = this.job(jobId); if (!j || !this.canSee(j)) return null;
    const a = j.approvals.find(x => x.id === approvalId); if (!a || a.status !== 'pending') return null;
    const approvals = j.approvals.map(x => x.id === approvalId ? { ...x, status: yes ? 'approved' as const : 'declined' as const, answeredAt: now() } : x);
    const r = await this.patchJob(jobId, { approvals, approved: yes && a.amount ? (j.approved || 0) + a.amount : j.approved });
    await this.log(jobId, 'approval', `${yes ? 'Approved' : 'Declined'}: ${a.title}`, 'Customer'); return r;
  }
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
