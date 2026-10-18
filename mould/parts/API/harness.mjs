// Shared harness for the API security checks (A1 to A5). Runs the route handlers in plain node with the memory store.
// Synthetic data only: no network, no database, no casts on disk. Written by Claude, 17 Oct 2026.
import { fileURLToPath, pathToFileURL } from 'node:url'; import { dirname, join } from 'node:path';
process.env.DATA_MODE = 'memory';
if (!('WOS_SECRET' in process.env)) process.env.WOS_SECRET = 'synthetic-check-secret-not-real-0000';
export const API = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'api');
export const imp = (p, q = '') => import(pathToFileURL(join(API, p)).href + q);
export const SLUG = 'tst';
let n = 0, bad = 0; const rows = [];
export const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
export async function safe(name, fn){ try { await fn(); } catch (e) { t(name + ' did not crash', false, String(e && e.message || e).slice(0, 160)); } }
export function done(part){ console.log(rows.join('\n')); console.log(`${part}: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}`); process.exit(bad ? 1 : 0); }
export function req(method, url, token, body, extra = {}){
  const h = { 'content-type': 'application/json', ...extra }; if (token) h.authorization = 'Bearer ' + token;
  return new Request('http://check.local' + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
export const P = o => ({ params: Promise.resolve(o) });
/* B3 (17 Oct 2026): every job write carries the version it read (x-wos-version). A check that does not send one gets the
   stored job's current version added here, so the older checks still mean "a fresh save". x-check-raw: 1 turns this off. */
async function versioned(r, params){
  if (!params || params.table !== 'jobs' || !params.id || !['PATCH', 'POST'].includes(r.method) || r.headers.has('x-wos-version')) return r;
  if (r.headers.has('x-check-raw')) return r;
  const { store } = await imp('lib/store.js'); const cur = await store.get(params.slug, 'jobs', params.id); if (!cur) return r;
  const h = new Headers(r.headers); h.set('x-wos-version', cur.updatedAt); return new Request(r.url, { method: r.method, headers: h, body: await r.text() });
}
export async function call(fn, r, params){ r = await versioned(r, params); const res = await fn(r, P(params)); let j = null; try { j = await res.clone().json(); } catch {} return { status: res.status, json: j, res }; }
/* the seats every check uses */
export const A_PHONE = '0711111111', B_PHONE = '0722222222';
export const seats = {
  custA: { kind: 'customer', name: 'Cust A', phone: A_PHONE },
  custB: { kind: 'customer', name: 'Cust B', phone: B_PHONE },
  staff: { kind: 'staff', name: 'Staffer', role: 'staff', branch: 'one' },
  owner: { kind: 'staff', name: 'Owner', role: 'owner', branch: 'one' }
};
