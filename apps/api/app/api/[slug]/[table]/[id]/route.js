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
