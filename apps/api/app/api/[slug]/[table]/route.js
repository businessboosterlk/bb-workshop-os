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
