// Return the set of job IDs belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.list(slug, 'jobs');
  return new Set(jobs.filter(j => j.customerPhone === s.phone).map(j => j.id));
}

// Scope rows for a session, using the customer's job ID set for non-job kinds.
export function scope(rows, kind, s, jobIds) {
  if (kind === 'enquiries' && s.kind !== 'staff') return [];
  if (kind === 'quotes' && s.role !== 'owner') return [];
  if (kind === 'jobs' && s.kind === 'customer') {
    if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return [];
    return rows.filter(r => r.customerPhone === s.phone);
  }
  if (kind === 'jobs' && s.role !== 'owner') {
    return rows.map(({ estimate, approved, paid, ...r }) => r);
  }
  if (s.kind === 'customer') {
    if (kind === 'customers') {
      if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return [];
      return rows.filter(r => r.phone === s.phone);
    }
    if (!jobIds || !(jobIds instanceof Set)) return [];
    return rows.filter(r => typeof r.jobId === 'string' && r.jobId.trim() !== '' && jobIds.has(r.jobId));
  }
  return rows;
}
