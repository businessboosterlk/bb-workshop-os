// Return the set of job ids belonging to a customer, or null for non-customers.
export async function customerJobIds(slug, s) {
  if (!s || s.kind !== 'customer') return null;
  if (!s.phone || typeof s.phone !== 'string' || s.phone.trim() === '') return new Set();
  const jobs = await store.list(slug, 'jobs');
  return new Set(jobs.filter(j => j.customerPhone === s.phone).map(j => j.id));
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
  if (kind === 'jobs' && s.role !== 'owner') {
    out = out.map(({ estimate, approved, paid, ...r }) => r);
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
