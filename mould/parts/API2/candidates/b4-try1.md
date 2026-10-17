```js
// BLOCK: apps/api/lib/store.js | start=export function validKind(k) | until=// Return the set of job ids
export function validKind(k){ return KINDS.has(k); }
export function pageOf(opts) {
  const rawLimit = opts && opts.limit !== undefined && opts.limit !== null ? Number(opts.limit) : NaN;
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(500, rawLimit) : 500;
  const rawOffset = opts && opts.offset !== undefined && opts.offset !== null ? Number(opts.offset) : NaN;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

// BLOCK: apps/api/lib/store.js | start=  async list(slug, kind){ return [...bucket | until=  async get(slug, kind, id){ return bucket
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit); },
  async findBy(slug, kind, field, value, opts){ const { limit } = pageOf(opts); return [...bucket(slug, kind).values()].filter(r => r[field] === value).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(0, limit); },

// BLOCK: apps/api/lib/store.js | start=  async list(slug, kind){ const { data, error } = await (await supa()) | until=  async get(slug, kind, id){ const { data, error } = await (await supa())
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + limit - 1); if (error) throw error; return data.map(flat); },
  async findBy(slug, kind, field, value, opts){ if (!/^[A-Za-z][A-Za-z0-9]*$/.test(field)) throw new Error('bad field'); const { limit } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('data->>' + field, String(value)).order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(limit); if (error) throw error; return data.map(flat); },

// BLOCK: apps/api/lib/store.js | start=// Return the set of job ids belonging to a customer | until=// Scope rows by seat kind
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.findBy(slug, 'jobs', 'customerPhone', s.phone);
  return new Set(jobs.map(j => j.id));
}

// BLOCK: apps/api/app/api/[slug]/[table]/route.js
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
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const q = new URL(req.url).searchParams; const opts = { limit: q.get('limit'), offset: q.get('offset') }; let rows; let ids = null; if (g.s.kind === 'staff') { rows = await store.list(g.slug, g.table, opts); } else { ids = await customerJobIds(g.slug, g.s); if (g.table === 'jobs') { rows = g.s.phone ? await store.findBy(g.slug, 'jobs', 'customerPhone', g.s.phone) : []; } else if (g.table === 'customers') { rows = g.s.phone ? await store.findBy(g.slug, 'customers', 'phone', g.s.phone) : []; } else if (g.table === 'enquiries' || g.table === 'quotes') { rows = []; } else { rows = []; for (const id of ids) { rows.push(...await store.findBy(g.slug, g.table, 'jobId', id)); } const { limit, offset } = pageOf(opts); rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit); } } return Response.json(scope(rows, g.table, g.s, ids)); }
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

// BLOCK: apps/api/app/api/[slug]/[table]/[id]/route.js | start=spaceClash(await store.list(g.slug, 'jobs'), g.id, branch, space) | until=      }
        if (('spaceKey' in body || 'branch' in body) && (typeof space === 'string' && space ? spaceClash(await store.findBy(g.slug, 'jobs', 'spaceKey', space), g.id, branch, space) : false)) return Response.json({ error: 'Another car is already in that space' }, { status: 409 });

// BLOCK: apps/api/app/api/login/route.js | start=const cust = (await store.list(c.slug, 'customers')) | until=await store.audit(c.slug, phone, 'login');
    const cust = (await store.findBy(c.slug, 'customers', 'phone', phone, { limit: 1 }))[0];

// BLOCK: apps/api/app/api/otp/route.js | start=const known = (await store.list(c.slug, 'customers')) | until=if (known) issueCode(c.slug, phone);
    const known = (await store.findBy(c.slug, 'customers', 'phone', phone, { limit: 1 })).length > 0;

// BLOCK: apps/web/src/app/core/data.service.ts | start=  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); } | until=  create<T>(t: Table, row: Partial<T>) { const local
  async list<T>(t: Table) { await this.flush(); const all: T[] = []; for (let off = 0; off < 400 * 500; off += 500) { const page = await this.go<T[]>(`${t}?limit=500&offset=${off}`); all.push(...page); if (page.length < 500) break; } return all; }
```