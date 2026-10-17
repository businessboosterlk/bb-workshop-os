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
