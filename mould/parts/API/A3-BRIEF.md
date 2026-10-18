PART A3 of the Workshop OS API (a garage system; Next 15 route handlers in plain JavaScript ES modules). Security fix for audit finding E02.

THE FAULT. A customer signed in to the garage app may PATCH their own job. Today the route lets the customer send the whole `approvals` array and the `approved` money total, and stores whatever arrives:

```js
if (g.s.kind === 'customer') {
  if (g.table !== 'jobs' || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
  const allowed = ['approvals', 'approved', 'rating']; if (Object.keys(body).some(k => !allowed.includes(k))) return deny('Not yours', 403);
}
const row = await store.update(g.slug, g.table, g.id, body);
```

So a customer can lower the amount of extra work, invent an approval, rewrite one already answered, or set the job's approved total. The fix: the customer sends only an ANSWER and the server builds the change from the stored job.

WHAT YOU READ (every type, field by field).
- An approval (the garage asks the customer to agree to extra work):
  `{ id: string, title: string, detail?: string, amount?: number, status: 'pending' | 'approved' | 'declined', askedAt: string (ISO time), answeredAt?: string (ISO time) }`
- A job (the stored row, read with the money fields still on it):
  `{ id: string, customerId: string, customerName: string, customerPhone: string, approvals: Approval[] (may be missing on old rows; treat missing as []), estimate?: number, approved?: number, paid?: number, status: 'open' | 'ready' | 'delivered', deliveredAt?: string, rating?: number, notes?: string, ...other fields }`
- s, the session: `{ slug: string, kind: 'staff' | 'customer', name: string, phone?: string, role?: string, branch?: string, exp: number }`. For a customer, s.phone is their phone like '0711111111'.
- body: whatever JSON object the customer sent (already parsed; it is an object, never null).
- nowIso: the server time as an ISO string, passed in by the route (do not call Date yourself).

WRITE ONE FILE: apps/api/lib/answer.js, holding exactly one export and no imports:

`export function customerAnswer(job, body, s, nowIso)` returns one of:
- `{ status: <http code>, error: '<short message in British English>' }` when refused, or
- `{ patch: <object> }` when there is a change to store (the route will call store.update(slug, 'jobs', job.id, patch)), or
- `{ patch: null }` when the request is valid but changes nothing (the same answer sent again).

Rules, in this order:
1. Ownership: if s is not a customer seat, or s.phone is not a non empty string, or job.customerPhone !== s.phone, return { status: 403, error: 'Not yours' }.
2. The body must have EXACTLY one of these two shapes, with no other keys at all (check Object.keys(body)):
   A. exactly the keys `approvalId` and `status` (an answer), or
   B. exactly the key `rating` (a rating).
   Anything else (an empty body, `approvals`, `approved`, `amount`, `answeredAt`, `estimate`, `paid`, a mix of A and B, any extra key) returns { status: 403, error: 'Not yours' }.
3. Shape A, an answer:
   - approvalId must be a non empty string and status must be exactly 'approved' or 'declined'; otherwise { status: 400, error: ... }.
   - Find the approval with that id in the job's own approvals (Array.isArray(job.approvals) ? job.approvals : []). None found: { status: 404, error: 'No such approval' }.
   - If it is 'pending': return { patch: { approvals: <a NEW array, same order, every other approval copied unchanged, and this one copied with status set to the answer and answeredAt set to nowIso> } }. Copy every other field of the answered approval unchanged (title, amount, askedAt, detail).
   - If it is already answered with the SAME status the customer sent: return { patch: null } (idempotent, nothing changes, answeredAt is kept).
   - If it is already answered with a DIFFERENT status: { status: 409, error: 'Already answered' }.
   - Never put `approved`, `estimate`, `paid` or any number from the body into the patch. The patch has the single key `approvals`.
4. Shape B, a rating:
   - rating must be an integer number from 1 to 5 inclusive (Number.isInteger, typeof 'number'; the string '5' is refused): otherwise { status: 400, error: ... }.
   - job.status must be 'delivered', otherwise { status: 409, error: 'Rate the job once it is delivered' }.
   - If job.rating is undefined or null: return { patch: { rating } }.
   - If job.rating === rating: return { patch: null }.
   - Otherwise (a different rating already given): { status: 409, error: 'Already rated' }.
5. Never mutate job, job.approvals, any approval or body.

TRAPS.
- Do not trust any field of the body except approvalId, status and rating; never spread the body into the patch.
- An approval id that exists on ANOTHER customer's job is simply not found on this job: 404.
- Keep the function synchronous and pure.

Return ONE ```js code block holding the whole file: a two line comment at the top in British English saying what it does, then the function.
