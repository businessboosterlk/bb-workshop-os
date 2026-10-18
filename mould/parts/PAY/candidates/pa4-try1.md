```js
// BLOCK: apps/api/lib/store.js | start=const KINDS = new Set( | until=export const mode =
import { balanceOf } from './payments.js';
const KINDS = new Set(['jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes']);
// BLOCK: apps/api/lib/store.js | start=export function scope(rows, kind, s, jobIds) { | until=// Project a stored row through
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

// BLOCK: apps/api/app/api/[slug]/[table]/[id]/route.js | start=export async function PATCH(req, { params }){ | until=  if (g.table === 'jobs') {
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body must be an object' }, { status: 400 });
  if (g.table === 'jobs' && ('payments' in body || 'paid' in body || 'balance' in body)) return Response.json({ error: 'Payments are recorded through Record payment' }, { status: 400 });
// BLOCK: apps/api/app/api/[slug]/[table]/route.js | start=  if (g.table === 'quotes' && g.s.role !== 'owner') return deny('Owner only', 403); | until=  if (g.table === 'jobs') {
  if (g.table === 'quotes' && g.s.role !== 'owner') return deny('Owner only', 403);
  if (g.table === 'jobs' && ('payments' in body || 'paid' in body || 'balance' in body)) return Response.json({ error: 'Payments are recorded through Record payment' }, { status: 400 });
  if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
```