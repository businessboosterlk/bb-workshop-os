PART B4 of the Workshop OS (a garage system). Server: Next 15 route handlers in plain JavaScript ES modules. Web: Angular 20 TypeScript. Audit finding E06.

THE FAULT. Every read lists the WHOLE table: sign in and the text code list every customer to find one phone; the list route returns every row; the customer scope lists every job to find the customer's own. A workshop with years of records will slow to a crawl and send megabytes per request. The fix: exact lookups by one field, and paged list reads (a limit and an offset, a stable order, never more than 500 rows a page).

THE STORE. Rows are flat JSON documents. In memory mode a bucket is a Map of id to row. In supabase mode one table `wos_records` has columns `client` (the workshop slug), `kind`, `id`, `data` (jsonb, the document), `created_at`, `updated_at`; `flat(r)` turns a database row into `{ ...r.data, id, createdAt, updatedAt }`. Row fields used here: every row has `id`, `createdAt`, `updatedAt` (ISO strings); customers have `phone`; jobs have `customerPhone`, `branch`, `status`, `spaceKey`; photos and activities have `jobId`.

CURRENT FILE apps/api/lib/store.js:
```js
/* The Workshop OS data layer. One records table keyed by kind, rows carry a JSON
   document, so the API never disagrees with the app about column names.
     memory:   per process. Dev and demo. Nothing survives a restart, on purpose.
     supabase: SERVICE ROLE key server side only. RLS on with no policies, so the anon
               key in every BB front end reads nothing from these tables.
   Every read and write is scoped by workshop slug. No path reads across workshops. */
const KINDS = new Set(['jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes']);
export const mode = process.env.DATA_MODE || (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory');
const now = () => new Date().toISOString();
export const CONFLICT = Symbol('conflict');
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mem = new Map();
const bucket = (slug, kind) => { if (!mem.has(slug)) mem.set(slug, new Map()); const t = mem.get(slug); if (!t.has(kind)) t.set(kind, new Map()); return t.get(kind); };
const memory = {
  async list(slug, kind){ return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
  async get(slug, kind, id){ return bucket(slug, kind).get(id) || null; },
  async create(slug, kind, data){ const row = { ...data, id: data.id || uid(), createdAt: now(), updatedAt: now() }; bucket(slug, kind).set(row.id, row); return row; },
  async update(slug, kind, id, patch, expect){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; let u = now(); if (cur.updatedAt && u <= cur.updatedAt) u = new Date(Date.parse(cur.updatedAt) + 1).toISOString(); const row = { ...cur, ...patch, id, updatedAt: u }; b.set(id, row); return row; },
  async remove(slug, kind, id){ return bucket(slug, kind).delete(id); },
  async audit(){ }
};
let sb = null;
export async function supa(){
  if (sb) return sb;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase mode needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  sb = createClient(url, key, { auth: { persistSession: false } }); return sb;
}
const flat = r => ({ ...r.data, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at });
const supabase = {
  async list(slug, kind){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }); if (error) throw error; return data.map(flat); },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('wos_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch, expect){ const cur = await this.get(slug, kind, id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    let query = (await supa()).from('wos_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id); if (expect !== undefined) query = query.eq('updated_at', expect); const { data: row, error } = await query.select().maybeSingle(); if (error) throw error; if (!row) return CONFLICT; return flat(row); },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('wos_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('wos_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.list(slug, 'jobs');
  return new Set(jobs.filter(j => j.customerPhone === s.phone).map(j => j.id));
}

// Scope rows by seat kind and role, using the customer's job id set for non-job kinds.
export function scope(rows, kind, s, jobIds) {
  if (kind === 'enquiries' && s.kind !== 'staff') return [];
  if (kind === 'quotes' && s.role !== 'owner') return [];
  let out = rows;
  if (kind === 'jobs' && s.kind === 'customer') {
    if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
      out = out.filter(r => r.customerPhone === s.phone);
    } else {
      out = [];
    }
  }
  if (kind === 'jobs' && s.role !== 'owner') {
    out = out.map(({ estimate, approved, paid, ...r }) => r);
  }
  if (kind !== 'jobs' && s.kind === 'customer') {
    if (kind === 'customers') {
      if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
        return out.filter(r => r.phone === s.phone);
      }
      return [];
    }
    if (!(jobIds instanceof Set)) return [];
    return out.filter(r => typeof r.jobId === 'string' && r.jobId !== '' && jobIds.has(r.jobId));
  }
  return out;
}

// Project a stored row through the same scope rules as reads, returning null when the seat may not see it.
export async function project(slug, kind, s, row) {
  if (row === null || row === undefined || typeof row !== 'object') return null;
  const jobIds = await customerJobIds(slug, s);
  const scoped = scope([row], kind, s, jobIds);
  return scoped.length > 0 ? scoped[0] : null;
}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
import { store, validKind, scope, customerJobIds, project } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
import { spaceClash, withLock } from '../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; return Response.json(scope(await store.list(g.slug, g.table), g.table, g.s, await customerJobIds(g.slug, g.s))); }
/* a customer seat never creates rows; every write is a staff action or, for an approval answer, a PATCH on their own job */
export async function POST(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  if (g.s.kind !== 'staff') return deny('Staff only', 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  if (g.table === 'quotes' && g.s.role !== 'owner') return deny('Owner only', 403);
  if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  if (g.table === 'jobs') {
    return withLock(g.slug + ':jobs', async () => {
      if (spaceClash(await store.list(g.slug, 'jobs'), body.id, body.branch, body.spaceKey)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
      const row = await store.create(g.slug, g.table, { ...body, by: g.s.name });
      await store.audit(g.slug, g.s.name, 'create', g.table, row.id);
      const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });
    });
  }
  const row = await store.create(g.slug, g.table, { ...body, by: g.s.name });
  await store.audit(g.slug, g.s.name, 'create', g.table, row.id);
  /* the answer goes through the same projection as a read: a staff seat never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: row.id }, { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT LINE 38 of apps/api/app/api/[slug]/[table]/[id]/route.js (inside the staff branch of PATCH; `branch` and `space` are computed just above it):
```js
        if (('spaceKey' in body || 'branch' in body) && spaceClash(await store.list(g.slug, 'jobs'), g.id, branch, space)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
```
From apps/api/lib/commands.js: `spaceClash(jobs, jobId, branch, spaceKey)` is true when `spaceKey` is a non empty string and some job in `jobs` with another id is open in that branch and holds that spaceKey.

CURRENT LINE 21 of apps/api/app/api/login/route.js (`c.slug` is the workshop, `phone` the checked number):
```js
    const cust = (await store.list(c.slug, 'customers')).find(x => x.phone === phone);
```
CURRENT LINE 16 of apps/api/app/api/otp/route.js:
```js
    const known = (await store.list(c.slug, 'customers')).some(x => x.phone === phone);
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

YOUR FIRST TRY FAILED ON THIS. In Part 5 you wrote the header line `// BLOCK: apps/api/app/api/[slug]/[table]/route.js`. That header is wrong: it has no start and no until, so the whole new route file was thrown away and the list route still returned all 1,500 rows on every page, and a customer read still listed jobs and photos in full. Part 5 MUST open with exactly `// FILE: apps/api/app/api/[slug]/[table]/route.js` and hold the WHOLE file. Every other part of your first try passed; write them again the same way.

TRAPS.
- Equal updatedAt values happen (rows created in the same millisecond): the id tie break is what makes the pages stable.
- `limit=abc`, `limit=0`, `limit=-1` and no limit all mean 500; `offset=-7` means 0; `limit=5000` means 500.
- findBy compares with `===`, so a phone stored as a string is found by the same string.
- A customer seat must never call `store.list`.
- Keep the import path depths exactly as the current files have them.
