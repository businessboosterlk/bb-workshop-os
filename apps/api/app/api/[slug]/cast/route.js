import { findClient, publicCast } from '../../../../lib/clients.js';
import { session, deny } from '../../../../lib/auth.js';
export const dynamic = 'force-dynamic';
/* the signed-in seat's workshop settings, fresh on every open. Never the pins or codes. */
export async function GET(req, { params }){
  const { slug } = await params; const s = session(req, slug); if (!s) return deny();
  const c = await findClient(slug); if (!c) return deny('Not found', 404);
  return Response.json(publicCast(c));
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
