/* CORS per request (audit E10). The answer names the requesting origin only when it is
   in WOS_ORIGINS exactly (lib/cors.js), and always says Vary: Origin so a cache never
   hands one origin's answer to another. A preflight is answered here with 204. */
import { NextResponse } from 'next/server.js'; /* the .js names the same file the bundler picks for 'next/server' and lets plain node load it for the check */
import { allowedOrigins, corsHeaders } from './lib/cors.js';
export function middleware(req){
  const h = corsHeaders(req.headers.get('origin'), allowedOrigins());
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: h });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}
export const config = { matcher: '/api/:path*' };
