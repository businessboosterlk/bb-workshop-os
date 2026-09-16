import { allClients, verifyStaff, verifyCode, publicCast } from '../../../lib/clients.js';
import { issue } from '../../../lib/auth.js';
import { store } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
/* two doors, one route. Same answer and a small delay for every wrong try, so nobody
   can tell a wrong name from a wrong PIN. A customer seat is a phone number that has
   just proven a code; a staff seat is a name and PIN from the workshop's cast. */
export async function POST(req){
  const b = await req.json().catch(() => ({}));
  const clients = await allClients(); const slug = b.slug || clients[0]?.slug; const c = clients.find(x => x.slug === slug);
  const fail = async (m) => { await new Promise(r => setTimeout(r, 600)); return Response.json({ error: m }, { status: 401 }); };
  if (!c) return fail('No workshop at this address.');
  if (b.kind === 'customer') {
    const phone = String(b.phone || '');
    if (!/^07\d{8}$/.test(phone) || !verifyCode(c.slug, phone, String(b.code || ''))) return fail('That code is not right.');
    const cust = (await store.list(c.slug, 'customers')).find(x => x.phone === phone);
    await store.audit(c.slug, phone, 'login');
    return Response.json({ token: issue(c.slug, { kind: 'customer', name: cust?.name || '', phone }), slug: c.slug, name: cust?.name || '', cast: publicCast(c) });
  }
  const u = verifyStaff(c, b.name, b.pin); if (!u) return fail('That name and PIN do not match.');
  await store.audit(c.slug, u.name, 'login');
  return Response.json({ token: issue(c.slug, { kind: 'staff', name: u.name, role: u.role, branch: u.branch }), slug: c.slug, name: u.name, role: u.role, branch: u.branch, cast: publicCast(c) });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
