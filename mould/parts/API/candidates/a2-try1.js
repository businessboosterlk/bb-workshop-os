// Project a stored row through the same scope rules as reads, returning null when the seat may not see it.
export async function project(slug, kind, s, row) {
  if (row === null || row === undefined || typeof row !== 'object') return null;
  const jobIds = await customerJobIds(slug, s);
  const scoped = scope([row], kind, s, jobIds);
  return scoped.length > 0 ? scoped[0] : null;
}
