import { allClients, issueCode } from '../../../lib/clients.js';
import { store } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
/* step one of the customer door. The code goes to the phone, never into the reply.
   Only a number the workshop has on file gets one, and the reply is the same either
   way, so the door does not confirm who is a customer. */
export async function POST(req){
  const b = await req.json().catch(() => ({}));
  const clients = await allClients(); const c = clients.find(x => x.slug === (b.slug || clients[0]?.slug));
  const phone = String(b.phone || '');
  if (c && /^07\d{8}$/.test(phone)) {
    const known = (await store.list(c.slug, 'customers')).some(x => x.phone === phone);
    if (known) { const code = issueCode(c.slug, phone); await sendCode(phone, code, c.name); }
  }
  return Response.json({ ok: true });
}
/* the sender is the workshop's own account. Nothing here is wired until the client
   confirms which channel and pays for it; until then the code is logged server side. */
async function sendCode(phone, code, name){ console.log(`[otp] ${name} code for ${phone}: ${code}`); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
