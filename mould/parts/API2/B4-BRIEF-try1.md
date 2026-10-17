PART B4 of the Workshop OS (a garage system). Server: Next 15 route handlers in plain JavaScript ES modules. Web: Angular 20 TypeScript. Audit finding E06.

THE FAULT. Every read lists the WHOLE table: sign in and the text code list every customer to find one phone; the list route returns every row; the customer scope lists every job to find the customer's own. A workshop with years of records will slow to a crawl and send megabytes per request. The fix: exact lookups by one field, and paged list reads (a limit and an offset, a stable order, never more than 500 rows a page).

THE STORE. Rows are flat JSON documents. In memory mode a bucket is a Map of id to row. In supabase mode one table `wos_records` has columns `client` (the workshop slug), `kind`, `id`, `data` (jsonb, the document), `created_at`, `updated_at`; `flat(r)` turns a database row into `{ ...r.data, id, createdAt, updatedAt }`. Row fields used here: every row has `id`, `createdAt`, `updatedAt` (ISO strings); customers have `phone`; jobs have `customerPhone`, `branch`, `status`, `spaceKey`; photos and activities have `jobId`.

CURRENT FILE apps/api/lib/store.js:
```js
{{file:apps/api/lib/store.js}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/route.js}}
```

CURRENT LINE 38 of apps/api/app/api/[slug]/[table]/[id]/route.js (inside the staff branch of PATCH; `branch` and `space` are computed just above it):
```js
{{lines:apps/api/app/api/[slug]/[table]/[id]/route.js:38:38}}
```
From apps/api/lib/commands.js: `spaceClash(jobs, jobId, branch, spaceKey)` is true when `spaceKey` is a non empty string and some job in `jobs` with another id is open in that branch and holds that spaceKey.

CURRENT LINE 21 of apps/api/app/api/login/route.js (`c.slug` is the workshop, `phone` the checked number):
```js
{{lines:apps/api/app/api/login/route.js:21:21}}
```
CURRENT LINE 16 of apps/api/app/api/otp/route.js:
```js
{{lines:apps/api/app/api/otp/route.js:16:16}}
```
CURRENT LINE in class ApiAdapter of apps/web/src/app/core/data.service.ts (`go<T>(path)` fetches `${base}/api/${slug}/${path}` and returns the JSON; `flush()` replays the outbox):
```ts
  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); }
```

WHAT TO WRITE. Return ONE ```js code block holding the parts below, each opened by its header line exactly as shown, in this order.

Part 1 header: `// BLOCK: apps/api/lib/store.js | start=export function validKind(k) | until=// Return the set of job ids`
The validKind line unchanged, then a new exported function `pageOf(opts)`: returns `{ limit, offset }` where `limit` is `Math.floor(Number(opts.limit))` when that is an integer of at least 1, else 500, and never more than 500 (`Math.min(500, ...)`); `offset` is `Math.floor(Number(opts.offset))` when that is a finite number of at least 0, else 0. `opts` may be undefined or null. (A function declaration is hoisted, so the store objects above may call it.)

Part 2 header: `// BLOCK: apps/api/lib/store.js | start=  async list(slug, kind){ return [...bucket | until=  async get(slug, kind, id){ return bucket`
Two methods of the memory store, one per line:
- `async list(slug, kind, opts)`: `const { limit, offset } = pageOf(opts);` all rows of the bucket sorted by `updatedAt` descending, then by `id` ascending on a tie (`(b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))`), then `.slice(offset, offset + limit)`.
- `async findBy(slug, kind, field, value, opts)`: rows whose `row[field] === value`, same order, `.slice(0, limit)` where `limit` comes from `pageOf(opts)`.

Part 3 header: `// BLOCK: apps/api/lib/store.js | start=  async list(slug, kind){ const { data, error } = await (await supa()) | until=  async get(slug, kind, id){ const { data, error } = await (await supa())`
Two methods of the supabase store, one per line:
- `async list(slug, kind, opts)`: same query as today plus `.order('id', { ascending: true })` after the updated_at order and `.range(offset, offset + limit - 1)`.
- `async findBy(slug, kind, field, value, opts)`: refuse a field that does not match `/^[A-Za-z][A-Za-z0-9]*$/` by throwing `new Error('bad field')`; query `wos_records` with `.eq('client', slug).eq('kind', kind).eq('data->>' + field, String(value))`, the same two orders, `.limit(limit)`; throw on error; map with `flat`.

Part 4 header: `// BLOCK: apps/api/lib/store.js | start=// Return the set of job ids belonging to a customer | until=// Scope rows by seat kind`
The comment and `customerJobIds(slug, s)`: same rules as today, but the jobs come from `await store.findBy(slug, 'jobs', 'customerPhone', s.phone)` instead of listing every job. Keep a blank line at the end.

Part 5 header: `// FILE: apps/api/app/api/[slug]/[table]/route.js`
The whole file. Changes:
- GET reads `const q = new URL(req.url).searchParams; const opts = { limit: q.get('limit'), offset: q.get('offset') };`
- Staff seat (`g.s.kind === 'staff'`): `rows = await store.list(g.slug, g.table, opts)`, then `scope(rows, g.table, g.s, null)` as today.
- Customer seat: never list a table in full. `ids = await customerJobIds(g.slug, g.s)`. jobs: `rows = g.s.phone ? await store.findBy(g.slug, 'jobs', 'customerPhone', g.s.phone) : []`. customers: `rows = g.s.phone ? await store.findBy(g.slug, 'customers', 'phone', g.s.phone) : []`. enquiries and quotes: `rows = []`. Any other kind (activities, photos): for each id in `ids` `await store.findBy(g.slug, g.table, 'jobId', id)`, all joined into one array. Then sort the customer's rows by updatedAt descending then id ascending, take `.slice(offset, offset + limit)` with `const { limit, offset } = pageOf(opts)`, and pass them through `scope(rows, g.table, g.s, ids)` as today.
- POST: the space check uses `body.spaceKey ? await store.findBy(g.slug, 'jobs', 'spaceKey', body.spaceKey) : []` in place of `await store.list(g.slug, 'jobs')`. Everything else in POST stays exactly as it is (the lock, the money strip, the projection).
Import `pageOf` from store.js along with what it imports today.

Part 6 header: `// BLOCK: apps/api/app/api/[slug]/[table]/[id]/route.js | start=spaceClash(await store.list(g.slug, 'jobs'), g.id, branch, space) | until=      }`
The same one line (same indentation, eight spaces), with `await store.list(g.slug, 'jobs')` replaced by `(typeof space === 'string' && space ? await store.findBy(g.slug, 'jobs', 'spaceKey', space) : [])`.

Part 7 header: `// BLOCK: apps/api/app/api/login/route.js | start=const cust = (await store.list(c.slug, 'customers')) | until=await store.audit(c.slug, phone, 'login');`
One line, four spaces: `const cust = (await store.findBy(c.slug, 'customers', 'phone', phone, { limit: 1 }))[0];`

Part 8 header: `// BLOCK: apps/api/app/api/otp/route.js | start=const known = (await store.list(c.slug, 'customers')) | until=if (known) issueCode(c.slug, phone);`
One line, four spaces: `const known = (await store.findBy(c.slug, 'customers', 'phone', phone, { limit: 1 })).length > 0;`

Part 9 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); } | until=  create<T>(t: Table, row: Partial<T>) { const local`
TypeScript, one method of ApiAdapter on one line: flush once, then fetch pages `this.go<T[]>(\`${t}?limit=500&offset=${off}\`)` for off = 0, 500, 1000 and so on, appending each page, stopping when a page has fewer than 500 rows or after 400 pages; return all rows.

TRAPS.
- Equal updatedAt values happen (rows created in the same millisecond): the id tie break is what makes the pages stable.
- `limit=abc`, `limit=0`, `limit=-1` and no limit all mean 500; `offset=-7` means 0; `limit=5000` means 500.
- findBy compares with `===`, so a phone stored as a string is found by the same string.
- A customer seat must never call `store.list`.
- Keep the import path depths exactly as the current files have them.
