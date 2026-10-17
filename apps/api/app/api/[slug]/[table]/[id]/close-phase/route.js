import { store, validKind, project } from '../../../../../../lib/store.js';
import { session, deny } from '../../../../../../lib/auth.js';
import { closePhase } from '../../../../../../lib/commands.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const { slug, table, id } = await params;
  if (table !== 'jobs') return Response.json({ error: 'Unknown command' }, { status: 404 });
  const s = session(req, slug); if (!s) return deny();
  const body = await req.json().catch(() => null);
  const cur = await store.get(slug, 'jobs', id); if (!cur) return deny('Not found', 404);
  const photo = body && typeof body === 'object' && typeof body.photoId === 'string' ? await store.get(slug, 'photos', body.photoId) : null;
  const r = closePhase(cur, photo, body, s, new Date().toISOString());
  if (r.error) return Response.json({ error: r.error }, { status: r.status });
  const row = await store.update(slug, 'jobs', id, r.patch);
  await store.create(slug, 'activities', r.activity);
  await store.audit(slug, s.name, 'close-phase', 'jobs', id);
  return Response.json((await project(slug, 'jobs', s, row)) || { id });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
