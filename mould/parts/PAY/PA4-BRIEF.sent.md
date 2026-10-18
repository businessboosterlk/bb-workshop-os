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
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit); },
  async findBy(slug, kind, field, value, opts){ const { limit } = pageOf(opts); return [...bucket(slug, kind).values()].filter(r => r[field] === value).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(0, limit); },
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
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + limit - 1); if (error) throw error; return data.map(flat); },
  async findBy(slug, kind, field, value, opts){ if (!/^[A-Za-z][A-Za-z0-9]*$/.test(field)) throw new Error('bad field'); const { limit } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('data->>' + field, String(value)).order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(limit); if (error) throw error; return data.map(flat); },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('wos_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch, expect){ const cur = await this.get(slug, kind, id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    let query = (await supa()).from('wos_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id); if (expect !== undefined) query = query.eq('updated_at', expect); const { data: row, error } = await query.select().maybeSingle(); if (error) throw error; if (!row) return CONFLICT; return flat(row); },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('wos_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('wos_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
export function pageOf(opts) {
  const rawLimit = opts && opts.limit !== undefined ? opts.limit : 500;
  const nLimit = Math.floor(Number(rawLimit));
  const limit = Number.isInteger(nLimit) && nLimit >= 1 ? Math.min(500, nLimit) : 500;
  const rawOffset = opts && opts.offset !== undefined ? opts.offset : 0;
  const nOffset = Math.floor(Number(rawOffset));
  const offset = Number.isFinite(nOffset) && nOffset >= 0 ? nOffset : 0;
  return { limit, offset };
}
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.findBy(slug, 'jobs', 'customerPhone', s.phone);
  return new Set(jobs.map(j => j.id));
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

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
import { store, validKind, scope, customerJobIds, project, CONFLICT } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
import { customerAnswer } from '../../../../../lib/answer.js';
import { versionCheck, spaceClash, withLock } from '../../../../../lib/commands.js';
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
  if (g.table === 'jobs') {
    return withLock(g.slug + ':jobs', async () => {
      const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
      const v = versionCheck(cur, req.headers.get('x-wos-version'), g.s); if (v) return Response.json({ error: v.error }, { status: v.status });
      if (g.s.kind === 'customer') {
        if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
        const a = customerAnswer(cur, body, g.s, new Date().toISOString());
        if (a.error) return Response.json({ error: a.error }, { status: a.status });
        const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch, cur.updatedAt) : cur;
        if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
        if (a.patch && row !== CONFLICT) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
        if (a.activity && row !== CONFLICT) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
        const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
      } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
      else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
      if (g.table === 'jobs') {
        if ('phases' in body) return Response.json({ error: 'A phase closes only through close-phase, with its photo' }, { status: 403 });
        if ('status' in body && !(body.status === 'delivered' && cur.status === 'ready')) return Response.json({ error: 'The job status moves only through its phases and the handover' }, { status: 403 });
        const branch = 'branch' in body ? body.branch : cur.branch; const space = 'spaceKey' in body ? body.spaceKey : cur.spaceKey;
        if (('spaceKey' in body || 'branch' in body) && (typeof space === 'string' && space ? spaceClash(await store.findBy(g.slug, 'jobs', 'spaceKey', space), g.id, branch, space) : false)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
      }
      const row = await store.update(g.slug, g.table, g.id, body, cur.updatedAt);
      if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
      await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
      /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
      const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
    });
  }
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const a = customerAnswer(cur, body, g.s, new Date().toISOString());
    if (a.error) return Response.json({ error: a.error }, { status: a.status });
    const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch) : cur;
    if (a.patch) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
    if (a.activity) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
  else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  if (g.table === 'jobs') {
    if ('phases' in body) return Response.json({ error: 'A phase closes only through close-phase, with its photo' }, { status: 403 });
    if ('status' in body && !(body.status === 'delivered' && cur.status === 'ready')) return Response.json({ error: 'The job status moves only through its phases and the handover' }, { status: 403 });
  }
  const row = await store.update(g.slug, g.table, g.id, body);
  await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
  /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; if (g.s.role !== 'owner') return deny('Owner only', 403); await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.s.name, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT FILE apps/api/app/api/[slug]/[table]/route.js:
```js
import { store, validKind, scope, customerJobIds, project, pageOf } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
import { spaceClash, withLock } from '../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const q = new URL(req.url).searchParams; const opts = { limit: q.get('limit'), offset: q.get('offset') }; let rows; let ids = null; if (g.s.kind === 'staff') { rows = await store.list(g.slug, g.table, opts); } else { ids = await customerJobIds(g.slug, g.s); if (g.table === 'jobs') { rows = g.s.phone ? await store.findBy(g.slug, 'jobs', 'customerPhone', g.s.phone) : []; } else if (g.table === 'customers') { rows = g.s.phone ? await store.findBy(g.slug, 'customers', 'phone', g.s.phone) : []; } else if (g.table === 'enquiries' || g.table === 'quotes') { rows = []; } else { rows = []; for (const id of ids || []) { rows.push(...await store.findBy(g.slug, g.table, 'jobId', id)); } const { limit, offset } = pageOf(opts); rows = rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit); } } return Response.json(scope(rows, g.table, g.s, ids)); }
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
      if (body.spaceKey ? spaceClash(await store.findBy(g.slug, 'jobs', 'spaceKey', body.spaceKey), body.id, body.branch, body.spaceKey) : false) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });
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
