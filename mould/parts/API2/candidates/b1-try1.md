```js
// FILE: apps/api/lib/answer.js
// Answers a customer's approval or rating request for their own job, building the patch from stored data only.
// Returns a patch object, null for no change, or an error response; never mutates the job or body.
export function customerAnswer(job, body, s, nowIso) {
  if (s.kind !== 'customer' || typeof s.phone !== 'string' || s.phone.length === 0 || job.customerPhone !== s.phone) {
    return { status: 403, error: 'Not yours' };
  }
  const keys = Object.keys(body);
  const isAnswer = keys.length === 2 && keys.includes('approvalId') && keys.includes('status');
  const isRating = keys.length === 1 && keys.includes('rating');
  if (!isAnswer && !isRating) {
    return { status: 403, error: 'Not yours' };
  }
  if (isAnswer) {
    const { approvalId, status } = body;
    if (typeof approvalId !== 'string' || approvalId.length === 0 || (status !== 'approved' && status !== 'declined')) {
      return { status: 400, error: 'Invalid answer' };
    }
    const approvals = Array.isArray(job.approvals) ? job.approvals : [];
    const idx = approvals.findIndex(a => a.id === approvalId);
    if (idx === -1) {
      return { status: 404, error: 'No such approval' };
    }
    const existing = approvals[idx];
    if (existing.status === 'pending') {
      const newApprovals = approvals.map((a, i) => {
        if (i !== idx) return a;
        return { ...a, status, answeredAt: nowIso };
      });
      if (status === 'approved') {
        const base = typeof job.approved === 'number' && Number.isFinite(job.approved) ? job.approved : 0;
        const add = typeof existing.amount === 'number' && Number.isFinite(existing.amount) && existing.amount > 0 ? existing.amount : 0;
        return { patch: { approvals: newApprovals, approved: base + add }, activity: { type: 'approval', summary: 'Approved: ' + existing.title } };
      }
      return { patch: { approvals: newApprovals }, activity: { type: 'approval', summary: 'Declined: ' + existing.title } };
    }
    if (existing.status === status) {
      return { patch: null };
    }
    return { status: 409, error: 'Already answered' };
  }
  const { rating } = body;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: 400, error: 'Invalid rating' };
  }
  if (job.status !== 'delivered') {
    return { status: 409, error: 'Rate the job once it is delivered' };
  }
  if (job.rating === undefined || job.rating === null) {
    return { patch: { rating } };
  }
  if (job.rating === rating) {
    return { patch: null };
  }
  return { status: 409, error: 'Already rated' };
}

// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js
import { store, validKind, scope, customerJobIds, project } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
import { customerAnswer } from '../../../../../lib/answer.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table, id } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, id, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const r = await store.get(g.slug, g.table, g.id); if (!r) return deny('Not found', 404); const [out] = scope([r], g.table, g.s, await customerJobIds(g.slug, g.s)); return out ? Response.json(out) : deny('Not found', 404); }
/* a customer may send exactly one thing on their own job: the answer to one pending approval ({ approvalId, status })
   or a rating ({ rating }) once it is delivered. The server builds the change from the stored job (lib/answer.js) and
   takes no number from the customer. The same answer twice is a no-op. */
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const a = customerAnswer(cur, body, g.s, new Date().toISOString());
    if (a.error) return Response.json({ error: a.error }, { status: a.status });
    const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch) : cur;
    if (a.patch) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
    if (a.activity) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
  else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  const row = await store.update(g.slug, g.table, g.id, body);
  await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
  /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; if (g.s.role !== 'owner') return deny('Owner only', 403); await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.s.name, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

// BLOCK: apps/web/src/app/core/data.service.ts | start=/* the customer answers from their phone | until=async setPickup(
  /* the customer answers from their phone; the answer is logged with the time, and approved money is added to the job */
  async answerApproval(jobId: string, approvalId: string, yes: boolean) {
    const j = this.job(jobId); if (!j || !this.canSee(j)) return null;
    const a = j.approvals.find(x => x.id === approvalId); if (!a || a.status !== 'pending') return null;
    if (this.mode() === 'api') {
      const r = await this.adapter.update<Job>('jobs', jobId, { approvalId, status: yes ? 'approved' : 'declined' } as any);
      const next = r ? r : { ...j, approvals: j.approvals.map(x => x.id === approvalId ? { ...x, status: yes ? 'approved' as const : 'declined' as const, answeredAt: now() } : x) };
      this.jobs.update(x => x.map(y => y.id === jobId ? next : y));
      return next;
    }
    const approvals = j.approvals.map(x => x.id === approvalId ? { ...x, status: yes ? 'approved' as const : 'declined' as const, answeredAt: now() } : x);
    const r = await this.patchJob(jobId, { approvals, approved: yes && a.amount ? (j.approved || 0) + a.amount : j.approved });
    await this.log(jobId, 'approval', `${yes ? 'Approved' : 'Declined'}: ${a.title}`, 'Customer'); return r;
  }
```