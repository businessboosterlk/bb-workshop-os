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
