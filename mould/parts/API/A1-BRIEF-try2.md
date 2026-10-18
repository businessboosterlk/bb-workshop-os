PART A1 of the Workshop OS API (a garage system; Next 15 route handlers in plain JavaScript ES modules). Security fix for audit finding E01.

THE FAULT. In apps/api/lib/store.js the function scope() decides which rows a signed in seat may receive. For any kind other than 'jobs' and a customer seat it returns EVERY row that has a jobId, whoever owns that job, and also every row with no jobId. So customer A can read customer B's car photos and activity notes. Here is the current function, exactly:

```js
/* the money fields leave the server only for an owner; a customer gets only their own cars */
export function scope(rows, kind, s){
  let out = rows;
  /* the sales line never reaches a customer; quotes carry prices, so they reach only the owner */
  if (kind === 'enquiries' && s.kind !== 'staff') return [];
  if (kind === 'quotes' && s.role !== 'owner') return [];
  if (kind === 'jobs' && s.kind === 'customer') out = out.filter(r => r.customerPhone === s.phone);
  if (kind === 'jobs' && s.role !== 'owner') out = out.map(({ estimate, approved, paid, ...r }) => r);
  if (kind !== 'jobs' && s.kind === 'customer') { const mine = new Set(); return out.filter(r => r.jobId ? true : kind === 'customers' ? r.phone === s.phone : true); }
  return out;
}
```

WHAT YOU READ (every type the code touches, field by field).
- kind is one of: 'jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes'.
- s is the session, a plain object: { slug: string, kind: 'staff' | 'customer', name: string, phone?: string (customers only, like '0711111111'), role?: 'owner' | 'staff' | other string (staff only), branch?: string, exp: number }.
- A jobs row: { id: string, customerId: string, customerName: string, customerPhone: string, approvals: Array, estimate?: number, approved?: number, paid?: number, status: 'open' | 'ready' | 'delivered', rating?: number, ...other fields }.
- A customers row: { id: string, name: string, phone: string, ...other fields }.
- A photos row: { id: string, jobId: string (may be missing on old rows), phaseKey: string, dataUrl: string, by: string, createdAt: string, updatedAt: string }.
- An activities row: { id: string, jobId: string (may be missing), enquiryId?: string, quoteId?: string, type: string, summary: string, by: string, createdAt: string, updatedAt: string }.
- The same file exports `store` with this async interface (do NOT redefine it, it is already in the file above your code): `await store.list(slug, kind)` returns an array of rows of that kind for that workshop slug; `await store.get(slug, kind, id)` returns one row or null.

WRITE EXACTLY TWO EXPORTED FUNCTIONS, nothing else (no imports, no store, no other code). They replace the old scope() in the same file.

1. `export async function customerJobIds(slug, s)`
   - If s is missing or s.kind !== 'customer', return null.
   - Otherwise read `await store.list(slug, 'jobs')` and return a new Set of the id of every job whose customerPhone === s.phone (strict equality). If s.phone is missing or empty return an empty Set (never match a job with an empty phone).

2. `export function scope(rows, kind, s, jobIds)` (jobIds is the Set from customerJobIds, or null or undefined)
   Keep these rules exactly as they are now:
   - kind 'enquiries' and s.kind !== 'staff': return [].
   - kind 'quotes' and s.role !== 'owner': return [].
   - kind 'jobs' and s.kind === 'customer': keep only rows where r.customerPhone === s.phone, and s.phone must be a non empty string (an empty phone matches nothing).
   - kind 'jobs' and s.role !== 'owner': remove the fields estimate, approved and paid from every row (return new objects, never mutate the input rows).
   New rules for a customer seat and any kind other than 'jobs':
   - kind 'customers': keep only the row where r.phone === s.phone (non empty phone only).
   - every other kind ('photos', 'activities', anything else): keep a row ONLY when r.jobId is a non empty string AND jobIds is a Set AND jobIds.has(r.jobId). A row with no jobId is refused. If jobIds is null, undefined or not a Set, return [] (fail closed: a caller that forgot to pass the ids leaks nothing).
   - For a staff seat (s.kind === 'staff') jobIds is ignored and non job rows pass through unchanged, as now.
   Never mutate the input array or its rows. Return an array.

TRAPS.
- The old code built `mine` and never used it; that was the leak. Do not filter by "has a jobId", filter by "has a jobId that is in jobIds".
- Do not treat a customer as staff when s.role happens to be missing; decide by s.kind.
- Do not call store inside scope(); scope stays synchronous.

Return ONE ```js code block holding only the two functions, each with a one line comment above it in British English.

TRY 1 FAILED ONE CHECK. Your first answer returned early from the customer jobs branch (`return rows.filter(...)`), so a customer's own job still carried estimate, approved and paid. The two jobs rules apply IN ORDER to the same list: first filter to the customer's jobs, then strip the money fields for every seat whose role is not 'owner' (a customer has no role, so a customer is always stripped). Do not return between the two jobs rules.
