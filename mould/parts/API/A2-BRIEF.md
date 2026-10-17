PART A2 of the Workshop OS API (a garage system; Next 15 route handlers in plain JavaScript ES modules). Security fix for audit finding E03.

THE FAULT. The read routes send every row through scope() so a staff seat never receives the money fields (estimate, approved, paid) and a customer gets only their own rows. The write routes do not: the item PATCH answers `Response.json(row)` with the full updated row straight from the store, and the collection POST answers with the stored row. So a staff seat that PATCHes a job gets the owner's money figures back, and so does a customer.

WHAT YOU READ (pasted from apps/api/lib/store.js, the same file your function goes into; do NOT redefine any of these):

```js
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.list(slug, 'jobs');
  return new Set(jobs.filter(j => j.customerPhone === s.phone).map(j => j.id));
}
// Scope rows by seat kind and role, using the customer's job id set for non-job kinds.
export function scope(rows, kind, s, jobIds) { /* returns a NEW array holding only the rows this seat may see, with the money fields removed from jobs for any seat whose role is not 'owner' */ }
```

- slug: the workshop slug, a string.
- kind: one of 'jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes'.
- s: the session { slug, kind: 'staff' | 'customer', name, phone?, role?, branch?, exp }.
- row: one stored row (a plain object with at least an id string), or null or undefined.

WRITE EXACTLY ONE EXPORTED FUNCTION, nothing else (no imports):

`export async function project(slug, kind, s, row)`
- If row is null, undefined or not an object, return null.
- Otherwise return the first element of `scope([row], kind, s, await customerJobIds(slug, s))`, or null when that array is empty (the seat may not see this row).
- It must never return the input row itself unscoped, and never mutate it.

The routes will call it like this (already written, for your information only):
- collection POST: `const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });`
- item PATCH: `const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id });`

TRAP. customerJobIds is async and must be awaited before it is passed to scope; passing the Promise makes scope refuse every non job row for a customer.

Return ONE ```js code block holding only that function with a one line comment above it in British English.
