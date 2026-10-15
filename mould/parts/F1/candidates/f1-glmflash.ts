import { Cast, Job, Phase } from './models';

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

/** Spaces for a branch: its own list, or generated bays. */
export function spacesFor(cast: Cast, branchKey: string): SpaceDef[] {
  const branch = cast.branches.find((b) => b.key === branchKey);
  if (!branch) return [];
  if (branch.spaces && branch.spaces.length > 0) return branch.spaces;
  const bays: SpaceDef[] = [];
  for (let i = 1; i <= branch.bays; i++) {
    bays.push({ key: `b${i}`, label: `Bay ${i}`, kind: 'bay' });
  }
  return bays;
}

/** Whole minutes since the current phase started, never negative. */
function stageMinutes(job: JobWithSpace, now: number): number {
  const phase = job.phases.find((p) => p.status === 'now');
  if (!phase || !phase.startedAt) return 0;
  const started = Date.parse(phase.startedAt);
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((now - started) / 60000));
}

/** Remaining minutes of the current phase plus all next phases. */
function minutesLeft(job: JobWithSpace, now: number): number {
  const inStage = stageMinutes(job, now);
  const current = job.phases.find((p) => p.status === 'now');
  let left = 0;
  if (current) {
    left = Math.max(0, current.hours * 60 - inStage);
  }
  for (const p of job.phases) {
    if (p.status === 'next') left += p.hours * 60;
  }
  return Math.round(left);
}

/** Build the floor view for one branch. */
export function floor(cast: Cast, jobs: JobWithSpace[], branchKey: string, now: number): Floor {
  const spaces = spacesFor(cast, branchKey);
  const tiles: Tile[] = spaces.map((space) => {
    const job =
      jobs.find(
        (j) =>
          j.status === 'open' && j.branch === branchKey && j.spaceKey === space.key,
      ) ?? null;
    if (!job) {
      return { branch: branchKey, space, job: null, state: 'free' as TileState, minutesInStage: 0, minutesLeft: 0 };
    }
    const state: TileState = job.hold ? 'blocked' : 'busy';
    return {
      branch: branchKey,
      space,
      job,
      state,
      minutesInStage: stageMinutes(job, now),
      minutesLeft: minutesLeft(job, now),
    };
  });
  const busy = tiles.filter((t) => t.state !== 'free').length;
  const freeTile = tiles.some((t) => t.state === 'free');
  let nextFreeMinutes: number | null = null;
  if (freeTile) {
    nextFreeMinutes = 0;
  } else {
    const busyTiles = tiles.filter((t) => t.state === 'busy');
    if (busyTiles.length > 0) {
      nextFreeMinutes = Math.min(...busyTiles.map((t) => t.minutesLeft));
    }
  }
  return { branch: branchKey, tiles, busy, total: tiles.length, nextFreeMinutes };
}

/** Assign a job to a space, validating everything. */
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
    (j) => j.id !== jobId && j.status === 'open' && j.branch === job.branch && j.spaceKey === spaceKey,
  );
  if (taken) return { ok: false, reason: 'space taken' };
  return {
    ok: true,
    jobs: jobs.map((j) => (j.id === jobId ? { ...j, spaceKey } : j)),
  };
}

/** Release a job's space. Unknown id: unchanged copy. */
export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return [...jobs];
  return jobs.map((j) => {
    if (j.id !== jobId) return j;
    const { spaceKey, ...rest } = j;
    void spaceKey;
    return { ...rest };
  });
}
