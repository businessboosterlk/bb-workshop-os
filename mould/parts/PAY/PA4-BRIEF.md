PART PA4 of the Workshop OS (a garage system in Sri Lanka). Server: Next 15 route handlers in plain JavaScript ES modules.

THE JOB. Payments are now lines on a job (`job.payments`, an append only list) recorded only through the new payment commands. This part does two things:
A. WHO SEES WHAT MONEY. Every read and every write answer of a job goes through `scope()` in apps/api/lib/store.js. Change the job rules per seat.
B. The generic job writes (PATCH /api/<slug>/jobs/<id> and POST /api/<slug>/jobs) REFUSE the money line fields from every seat.

TYPES (field by field).
- Session seat `s`: `{ kind: 'customer' | 'staff', name: string, phone?: string, role?: 'owner' | 'desk' | 'staff', branch?: string }`. A customer seat has no role. 'desk' is the front desk (a staff seat).
- Job money fields: `estimate?: number` (the first quote), `approved?: number` (the total the customer approved), `paid?: number` (an old typed figure, kept but no longer used), `payments?: Payment[]` (the lines), `balance?: number` (NEVER stored: worked out by the server for a desk seat only).
- From apps/api/lib/payments.js (already written and checked): `balanceOf(job)` returns `job.approved - paid so far` when approved is a finite number, otherwise `job.balance` when that is a finite number, otherwise 0. Import it with `import { balanceOf } from './payments.js';`.

A. THE NEW JOB RULES IN scope(rows, kind, s, jobIds), for kind 'jobs' only:
- owner (`s.role === 'owner'`): unchanged, every field as stored (no balance key is added).
- customer (`s.kind === 'customer'`): keep the existing filter to their own phone exactly as now, then drop `estimate` and `paid` only. They KEEP `approved` and `payments`.
- desk (`s.kind === 'staff' && s.role === 'desk'`): drop `estimate`, `approved`, `paid` and any stored `balance`, keep `payments`, and ADD `balance: balanceOf(job)` worked out from the FULL stored job (before approved is dropped).
- any other seat (plain staff): drop `estimate`, `approved`, `paid`, `payments` and `balance`.
Every other rule of scope (enquiries, quotes, the customer filters for other kinds) stays exactly as it is.

B. THE REFUSAL. In the PATCH of apps/api/app/api/[slug]/[table]/[id]/route.js and the POST of apps/api/app/api/[slug]/[table]/route.js: when the table is 'jobs' and the body has ANY of the keys `payments`, `paid` or `balance` (use `k in body`), answer at once, before anything else is read or written:
`Response.json({ error: 'Payments are recorded through Record payment' }, { status: 400 })`.
This applies to every seat, the owner and a customer included, so in PATCH it goes right after the line that reads and checks the body, before the jobs lock and before the customer branch. In POST it goes right after the quotes rule, before the line that strips estimate, approved and paid for a non owner (that strip line stays as it is).

CURRENT FILE apps/api/lib/store.js:
```js
{{file:apps/api/lib/store.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/route.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/route.js}}
```

WHAT TO WRITE. Return ONE ```js code block holding four parts, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`.

Part 1 header line: `// BLOCK: apps/api/lib/store.js | start=const KINDS = new Set( | until=export const mode =`
Two lines: `import { balanceOf } from './payments.js';` then the `const KINDS = ...` line exactly as it is now.

Part 2 header line: `// BLOCK: apps/api/lib/store.js | start=export function scope(rows, kind, s, jobIds) { | until=// Project a stored row through`
The whole new `scope` function (its comment line above it is not part of the block, do not repeat it), then one empty line. Keep its first lines (enquiries, quotes, `let out = rows;`, the customer job filter by phone) and everything after the money rules exactly as now; replace only the old line `if (kind === 'jobs' && s.role !== 'owner') { out = out.map(({ estimate, approved, paid, ...r }) => r); }` with the rules of A.

Part 3 header line: `// BLOCK: apps/api/app/api/[slug]/[table]/[id]/route.js | start=export async function PATCH(req, { params }){ | until=  if (g.table === 'jobs') {`
The three lines exactly as now (the `export async function PATCH(req, { params }){` line, the `const g = await gate(...)` line and the line that reads and checks the body), then the new refusal line of B, indented two spaces.

Part 4 header line: `// BLOCK: apps/api/app/api/[slug]/[table]/route.js | start=  if (g.table === 'quotes' && g.s.role !== 'owner') return deny('Owner only', 403); | until=  if (g.table === 'jobs') {`
Three lines, each indented two spaces: the quotes line exactly as now, then the new refusal line of B, then the strip line exactly as now (`if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }`).

TRAPS.
- Work out the desk balance from the stored job BEFORE removing approved: `const { estimate, approved, paid, balance, ...r } = j; return { ...r, balance: balanceOf(j) };`.
- A customer keeps `approved` now (the old rule dropped it): only estimate and paid are dropped for a customer.
- The owner gets no balance key.
- Never write a balance into the store: it exists only in what scope returns.
- The refusal words exactly: 'Payments are recorded through Record payment'. Status 400.
- Plain JavaScript, no em or en dash anywhere.
