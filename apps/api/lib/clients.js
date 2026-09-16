/* Which workshops this API serves, and how a seat proves itself.
     memory:   the casts folder on disk (dev and demo)
     supabase: the wos_clients table, one row per workshop, its config a JSON document
   A PIN and a customer code are compared in constant time. One-time codes for
   customers live in memory for ten minutes; a live workshop sends them by SMS or
   WhatsApp through the sender in .env, which is the client's own account. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual, randomInt } from 'node:crypto';
import { mode, supa } from './store.js';
const eq = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && timingSafeEqual(x, y); };
const DIR = path.resolve(process.cwd(), '..', '..', 'casts');
async function fromDisk(){
  const out = [];
  for (const d of [DIR, path.join(DIR, 'private')]) for (const f of await readdir(d).catch(() => [])) if (f.endsWith('.json')) { try { out.push(JSON.parse(await readFile(path.join(d, f), 'utf8'))); } catch {} }
  return out;
}
export async function allClients(){
  if (mode !== 'supabase') return fromDisk();
  const { data, error } = await (await supa()).from('wos_clients').select('slug,config'); if (error) throw error;
  return data.map(r => ({ ...r.config, slug: r.slug }));
}
export async function findClient(slug){ return (await allClients()).find(c => c.slug === slug) || null; }
/* the public half of a cast: never the pins, never the codes */
export function publicCast(c){ const { users, customerCode, seats, ...rest } = c; return { ...rest, users: (users || []).map(u => ({ name: u.name, role: u.role, branch: u.branch })), data: { mode: 'api' } }; }
export function verifyStaff(c, name, pin){ const u = (c.users || []).find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase()); return u && eq(u.pin, pin) ? u : null; }
/* one-time codes */
const codes = new Map();
export function issueCode(slug, phone){ const code = String(randomInt(1000, 9999)); codes.set(slug + ':' + phone, { code, exp: Date.now() + 10 * 60000 }); return code; }
export function verifyCode(slug, phone, code){ const k = slug + ':' + phone; const c = codes.get(k); if (!c || c.exp < Date.now()) return false; const okk = eq(c.code, code) || (process.env.WOS_DEMO_CODE && eq(process.env.WOS_DEMO_CODE, code)); if (okk) codes.delete(k); return okk; }
