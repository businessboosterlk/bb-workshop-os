export function closePhase(job, photo, body, s, nowIso) {
  if (!s || s.kind !== 'staff') return { status: 403, error: 'Staff only' };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, error: 'Body must be an object' };
  if (typeof body.phaseKey !== 'string' || body.phaseKey.length === 0) return { status: 400, error: 'phaseKey is required' };
  if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) return { status: 400, error: 'note must be a string of at most 2000 characters' };
  if (job.status !== 'open') return { status: 409, error: 'Only a car still being worked on can close a phase' };
  const i = job.phases.findIndex(p => p.status === 'now');
  if (i < 0) return { status: 409, error: 'No phase is running on this job' };
  if (job.phases[i].key !== body.phaseKey) return { status: 409, error: 'Only the phase running now can be closed' };
  if (!photo) return { status: 400, error: 'A phase closes only with a photo' };
  if (photo.jobId !== job.id) return { status: 400, error: 'That photo belongs to another job' };
  if (photo.phaseKey !== body.phaseKey) return { status: 400, error: 'That photo is for another phase' };
  if (job.phases.some(p => p.photoId === photo.id)) return { status: 409, error: 'That photo already closed a phase' };
  const note = body.note;
  const phases = job.phases.map((p, k) => k === i ? { ...p, status: 'done', doneAt: nowIso, photoId: photo.id, by: s.name, ...(note !== undefined ? { note } : {}) } : k === i + 1 ? { ...p, status: 'now', startedAt: nowIso } : p);
  const last = i === job.phases.length - 1;
  const patch = { phases, status: last ? 'ready' : job.status };
  if (last && job.pickup && job.pickup.wanted && job.pickup.status === 'collected') patch.pickup = { ...job.pickup, status: 'booked' };
  const label = job.phases[i].label;
  const activity = { jobId: job.id, type: 'phase', summary: label + ' done' + (note ? ': ' + note : ''), by: s.name };
  return { patch, activity };
}
