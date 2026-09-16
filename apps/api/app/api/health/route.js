import { mode } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET(){ return Response.json({ ok: true, service: 'workshop-os-api', data: mode, secret: !!process.env.WOS_SECRET, at: new Date().toISOString() }); }
