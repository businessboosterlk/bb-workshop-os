import { allClients, issueCode } from '../../../lib/clients.js';
import { store } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
/* step one of the customer door. The code goes to the phone, never into the reply and
   never into a log. Only a number the workshop has on file gets one, and the reply is
   the same either way, so the door does not confirm who is a customer.
   No text sender is wired yet (no account exists), so outside explicit development the
   route refuses plainly with 503 for every number instead of pretending to send. In
   development a code is issued and kept in memory; sign in with WOS_DEMO_CODE. */
export async function POST(req){
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Text codes are not switched on for this workshop yet. Ask the workshop to sign you in.' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const clients = await allClients(); const c = clients.find(x => x.slug === (b.slug || clients[0]?.slug));
  const phone = String(b.phone || '');
  if (c && /^07\d{8}$/.test(phone)) {
    const known = (await store.list(c.slug, 'customers')).some(x => x.phone === phone);
    if (known) issueCode(c.slug, phone);
  }
  return Response.json({ ok: true });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
