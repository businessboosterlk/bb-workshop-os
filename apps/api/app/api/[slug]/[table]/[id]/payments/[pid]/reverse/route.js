import { randomUUID } from 'node:crypto';
import { store, project, CONFLICT } from '../../../../../../../../lib/store.js';
import { session, deny } from '../../../../../../../../lib/auth.js';
import { reversePayment, versionCheck, withLock } from '../../../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id, pid } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const op = req.headers.get('x-wos-op') || undefined;
  return withLock(slug + ':jobs', async () => {
    const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
    const r = reversePayment(cur, pid, s, new Date().toISOString(), 'pay-' + randomUUID(), op);
    if (r.error) return Response.json({ error: r.error }, { status: r.status });
    if (r.patch === null) return Response.json((await project(slug, 'jobs', s, cur)) || { id });
    const v = versionCheck(cur, req.headers.get('x-wos-version'), s); if (v) return Response.json({ error: v.error }, { status: v.status });
    const row = await store.update(slug, 'jobs', id, r.patch, cur.updatedAt);
    if (row === CONFLICT) return Response.json({ error: 'Someone else changed this job since you opened it. Reload it and try again.' }, { status: 409 });
    await store.create(slug, 'activities', r.activity);
    await store.audit(slug, s.name, 'payment-correct', 'jobs', id);
    return Response.json((await project(slug, 'jobs', s, row)) || { id });
  });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
