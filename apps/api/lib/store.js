/* The Workshop OS data layer. One records table keyed by kind, rows carry a JSON
   document, so the API never disagrees with the app about column names.
     memory:   per process. Dev and demo. Nothing survives a restart, on purpose.
     supabase: SERVICE ROLE key server side only. RLS on with no policies, so the anon
               key in every BB front end reads nothing from these tables.
   Every read and write is scoped by workshop slug. No path reads across workshops. */
import { balanceOf } from './payments.js';
const KINDS = new Set(['jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes']);
export const mode = process.env.DATA_MODE || (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory');
const now = () => new Date().toISOString();
export const CONFLICT = Symbol('conflict');
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mem = new Map();
const bucket = (slug, kind) => { if (!mem.has(slug)) mem.set(slug, new Map()); const t = mem.get(slug); if (!t.has(kind)) t.set(kind, new Map()); return t.get(kind); };
const memory = {
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit); },
  async findBy(slug, kind, field, value, opts){ const { limit } = pageOf(opts); return [...bucket(slug, kind).values()].filter(r => r[field] === value).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id))).slice(0, limit); },
  async get(slug, kind, id){ return bucket(slug, kind).get(id) || null; },
  async create(slug, kind, data){ const row = { ...data, id: data.id || uid(), createdAt: now(), updatedAt: now() }; bucket(slug, kind).set(row.id, row); return row; },
  async update(slug, kind, id, patch, expect){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; let u = now(); if (cur.updatedAt && u <= cur.updatedAt) u = new Date(Date.parse(cur.updatedAt) + 1).toISOString(); const row = { ...cur, ...patch, id, updatedAt: u }; b.set(id, row); return row; },
  async remove(slug, kind, id){ return bucket(slug, kind).delete(id); },
  async audit(){ }
};
let sb = null;
export async function supa(){
  if (sb) return sb;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase mode needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  sb = createClient(url, key, { auth: { persistSession: false } }); return sb;
}
const flat = r => ({ ...r.data, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at });
const supabase = {
  async list(slug, kind, opts){ const { limit, offset } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + limit - 1); if (error) throw error; return data.map(flat); },
  async findBy(slug, kind, field, value, opts){ if (!/^[A-Za-z][A-Za-z0-9]*$/.test(field)) throw new Error('bad field'); const { limit } = pageOf(opts); const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('data->>' + field, String(value)).order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(limit); if (error) throw error; return data.map(flat); },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('wos_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('wos_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch, expect){ const cur = await this.get(slug, kind, id); if (!cur) return null; if (expect !== undefined && cur.updatedAt !== expect) return CONFLICT; const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    let query = (await supa()).from('wos_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id); if (expect !== undefined) query = query.eq('updated_at', expect); const { data: row, error } = await query.select().maybeSingle(); if (error) throw error; if (!row) return CONFLICT; return flat(row); },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('wos_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('wos_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
export function pageOf(opts) {
  const rawLimit = opts && opts.limit !== undefined ? opts.limit : 500;
  const nLimit = Math.floor(Number(rawLimit));
  const limit = Number.isInteger(nLimit) && nLimit >= 1 ? Math.min(500, nLimit) : 500;
  const rawOffset = opts && opts.offset !== undefined ? opts.offset : 0;
  const nOffset = Math.floor(Number(rawOffset));
  const offset = Number.isFinite(nOffset) && nOffset >= 0 ? nOffset : 0;
  return { limit, offset };
}
// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.findBy(slug, 'jobs', 'customerPhone', s.phone);
  return new Set(jobs.map(j => j.id));
}
// Scope rows by seat kind and role, using the customer's job id set for non-job kinds.
export function scope(rows, kind, s, jobIds) {
  if (kind === 'enquiries' && s.kind !== 'staff') return [];
  if (kind === 'quotes' && s.role !== 'owner') return [];
  let out = rows;
  if (kind === 'jobs' && s.kind === 'customer') {
    if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
      out = out.filter(r => r.customerPhone === s.phone);
    } else {
      out = [];
    }
  }
  if (kind === 'jobs' && s.role === 'owner') {
    // unchanged, every field as stored
  } else if (kind === 'jobs' && s.kind === 'customer') {
    out = out.map(({ estimate, paid, ...r }) => r);
  } else if (kind === 'jobs' && s.kind === 'staff' && s.role === 'desk') {
    out = out.map(j => {
      const { estimate, approved, paid, balance, ...r } = j;
      return { ...r, balance: balanceOf(j) };
    });
  } else if (kind === 'jobs') {
    out = out.map(({ estimate, approved, paid, payments, balance, ...r }) => r);
  }
  if (kind !== 'jobs' && s.kind === 'customer') {
    if (kind === 'customers') {
      if (s.phone && typeof s.phone === 'string' && s.phone !== '') {
        return out.filter(r => r.phone === s.phone);
      }
      return [];
    }
    if (!(jobIds instanceof Set)) return [];
    return out.filter(r => typeof r.jobId === 'string' && r.jobId !== '' && jobIds.has(r.jobId));
  }
  return out;
}
// Project a stored row through the same scope rules as reads, returning null when the seat may not see it.
export async function project(slug, kind, s, row) {
  if (row === null || row === undefined || typeof row !== 'object') return null;
  const jobIds = await customerJobIds(slug, s);
  const scoped = scope([row], kind, s, jobIds);
  return scoped.length > 0 ? scoped[0] : null;
}
