import type { Cast, JobWithSpace, Phase, SpaceDef, Tile, TileState, Floor } from './models';

export type { SpaceDef, JobWithSpace, TileState, Tile, Floor };

export function spacesFor(cast: Cast, branchKey: string): SpaceDef[] {
  const branch = cast.branches.find((b) => b.key === branchKey);
  if (!branch) return [];
  if (branch.spaces && branch.spaces.length > 0) return branch.spaces;
  return Array.from({ length: branch.bays }, (_, i) => ({
    key: `b${i + 1}`,
    label: `Bay ${i + 1}`,
    kind: 'bay',
  }));
}

export function floor(cast: Cast, jobs: JobWithSpace[], branchKey: string, now: number): Floor {
  const spaces = spacesFor(cast, branchKey);
  const tiles: Tile[] = spaces.map((space) => {
    const job = jobs.find(
      (j) => j.status === 'open' && j.branch === branchKey && j.spaceKey === space.key,
    );
    if (!job) {
      return {
        branch: branchKey,
        space,
        job: null,
        state: 'free',
        minutesInStage: 0,
        minutesLeft: 0,
      };
    }
    const state: TileState = job.hold ? 'blocked' : 'busy';
    const minutesInStage = currentPhaseMinutes(job, now);
    const minutesLeft = remainingMinutes(job, minutesInStage);
    return { branch: branchKey, space, job, state, minutesInStage, minutesLeft };
  });

  const busy = tiles.filter((t) => t.state === 'busy' || t.state === 'blocked').length;
  const total = tiles.length;
  const busyTiles = tiles.filter((t) => t.state === 'busy');
  const nextFreeMinutes =
    tiles.some((t) => t.state === 'free')
      ? 0
      : busyTiles.length === 0
        ? null
        : Math.min(...busyTiles.map((t) => t.minutesLeft));

  return { branch: branchKey, tiles, busy, total, nextFreeMinutes };
}

export function assign(
  cast: Cast,
  jobs: JobWithSpace[],
  jobId: string,
  spaceKey: string,
): { ok: true; jobs: JobWithSpace[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (job.status !== 'open') return { ok: false, reason: 'not open' };

  const spaces = spacesFor(cast, job.branch);
  if (!spaces.some((s) => s.key === spaceKey)) return { ok: false, reason: 'no such space' };

  const taken = jobs.some(
    (j) =>
      j.id !== jobId &&
      j.status === 'open' &&
      j.branch === job.branch &&
      j.spaceKey === spaceKey,
  );
  if (taken) return { ok: false, reason: 'space taken' };

  const updatedJobs = jobs.map((j) =>
    j.id === jobId ? { ...j, spaceKey } : j,
  );
  return { ok: true, jobs: updatedJobs };
}

export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return jobs;
  return jobs.map((j) => {
    if (j.id !== jobId) return j;
    const { spaceKey: _spaceKey, ...rest } = j;
    return rest;
  });
}

function currentPhaseMinutes(job: JobWithSpace, now: number): number {
  const phase = job.phases.find((p) => p.status === 'now');
  if (!phase || !phase.startedAt) return 0;
  const started = new Date(phase.startedAt).getTime();
  return Math.max(0, Math.round((now - started) / 60000));
}

function remainingMinutes(job: JobWithSpace, minutesInStage: number): number {
  const current = job.phases.find((p) => p.status === 'now');
  const currentLeft = current
    ? Math.max(0, Math.round(current.hours * 60 - minutesInStage))
    : 0;
  const nextHours = job.phases
    .filter((p) => p.status === 'next')
    .reduce((sum, p) => sum + p.hours, 0);
  return Math.round(currentLeft + nextHours * 60);
}
