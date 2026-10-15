import type { Cast, Job, PhaseStatus } from './models';

export interface SpaceDef {
  key: string;
  label: string;
  kind?: string;
}

export type JobWithSpace = Job & { spaceKey?: string; hold?: string };

export type TileState = 'busy' | 'blocked' | 'free';

export interface Tile {
  branch: string;
  space: SpaceDef;
  job: JobWithSpace | null;
  state: TileState;
  minutesInStage: number;
  minutesLeft: number;
}

export interface Floor {
  branch: string;
  tiles: Tile[];
  busy: number;
  total: number;
  nextFreeMinutes: number | null;
}

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
      (j) => j.status === 'open' && j.branch === branchKey && j.spaceKey === space.key
    ) ?? null;
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
    const currentPhase = job.phases.find((p) => p.status === 'now');
    const minutesInStage = currentPhase?.startedAt
      ? Math.max(0, Math.round((now - new Date(currentPhase.startedAt).getTime()) / 60000))
      : 0;
    const minutesLeft = currentPhase
      ? Math.max(0, Math.round(currentPhase.hours * 60 - minutesInStage)) +
        job.phases
          .filter((p) => p.status === 'next')
          .reduce((sum, p) => sum + p.hours * 60, 0)
      : 0;
    return {
      branch: branchKey,
      space,
      job,
      state: job.hold ? 'blocked' : 'busy',
      minutesInStage,
      minutesLeft: Math.round(minutesLeft),
    };
  });
  const busy = tiles.filter((t) => t.state === 'busy' || t.state === 'blocked').length;
  const total = tiles.length;
  const freeTile = tiles.find((t) => t.state === 'free');
  const nextFreeMinutes = freeTile
    ? 0
    : tiles
        .filter((t) => t.state === 'busy')
        .reduce((min, t) => (min === null || t.minutesLeft < min ? t.minutesLeft : min), null as number | null);
  return { branch: branchKey, tiles, busy, total, nextFreeMinutes };
}

export function assign(
  cast: Cast,
  jobs: JobWithSpace[],
  jobId: string,
  spaceKey: string
): { ok: true; jobs: JobWithSpace[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (job.status !== 'open') return { ok: false, reason: 'not open' };
  const spaces = spacesFor(cast, job.branch);
  if (!spaces.some((s) => s.key === spaceKey)) return { ok: false, reason: 'no such space' };
  const taken = jobs.some(
    (j) => j.id !== jobId && j.status === 'open' && j.branch === job.branch && j.spaceKey === spaceKey
  );
  if (taken) return { ok: false, reason: 'space taken' };
  const newJob: JobWithSpace = { ...job, spaceKey };
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return jobs;
  const newJob: JobWithSpace = { ...job };
  delete newJob.spaceKey;
  return jobs.map((j) => (j.id === jobId ? newJob : j));
}
