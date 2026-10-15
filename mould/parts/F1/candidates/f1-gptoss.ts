import { PhaseStatus, JobStatus, Branch, Phase, Job, Cast } from './models';

/**
 * Definition of a space within a branch.
 */
export interface SpaceDef {
  key: string;
  label: string;
  kind?: string;
}

/**
 * Job extended with optional space assignment and hold information.
 */
export type JobWithSpace = Job & { spaceKey?: string; hold?: string };

/**
 * Possible states of a tile.
 */
export type TileState = 'busy' | 'blocked' | 'free';

/**
 * Tile representing a space and its current job.
 */
export interface Tile {
  branch: string;
  space: SpaceDef;
  job: JobWithSpace | null;
  state: TileState;
  minutesInStage: number;
  minutesLeft: number;
}

/**
 * Floor summarising all tiles of a branch.
 */
export interface Floor {
  branch: string;
  tiles: Tile[];
  busy: number;
  total: number;
  nextFreeMinutes: number | null;
}

/**
 * Return the list of spaces for a given branch.
 * Uses the branch's own spaces if defined, otherwise creates bay spaces.
 */
export function spacesFor(cast: Cast, branchKey: string): SpaceDef[] {
  const branch = cast.branches.find(b => b.key === branchKey);
  if (!branch) return [];

  if (branch.spaces && branch.spaces.length > 0) {
    return branch.spaces;
  }

  const bays: SpaceDef[] = [];
  for (let i = 1; i <= branch.bays; i++) {
    bays.push({ key: `b${i}`, label: `Bay ${i}`, kind: 'bay' });
  }
  return bays;
}

/**
 * Build a floor view for a branch at a given moment.
 */
export function floor(
  cast: Cast,
  jobs: JobWithSpace[],
  branchKey: string,
  now: number
): Floor {
  const spaces = spacesFor(cast, branchKey);
  const tiles: Tile[] = spaces.map(space => {
    const job = jobs.find(
      j =>
        j.status === 'open' &&
        j.branch === branchKey &&
        j.spaceKey === space.key
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

    const state: TileState = job.hold && job.hold.length > 0 ? 'blocked' : 'busy';

    // minutesInStage
    const nowPhase = job.phases.find(p => p.status === 'now');
    let minutesInStage = 0;
    if (nowPhase && nowPhase.startedAt) {
      const started = new Date(nowPhase.startedAt).getTime();
      const diff = now - started;
      minutesInStage = Math.max(0, Math.round(diff / 60000));
    }

    // minutesLeft
    let minutesLeft = 0;
    if (nowPhase) {
      const total = nowPhase.hours * 60;
      const remaining = Math.max(0, total - minutesInStage);
      minutesLeft += remaining;
    }
    job.phases
      .filter(p => p.status === 'next')
      .forEach(p => {
        minutesLeft += p.hours * 60;
      });
    minutesLeft = Math.round(minutesLeft);

    return {
      branch: branchKey,
      space,
      job,
      state,
      minutesInStage,
      minutesLeft,
    };
  });

  const busy = tiles.filter(t => t.state === 'busy' || t.state === 'blocked')
    .length;
  const total = tiles.length;

  let nextFreeMinutes: number | null = null;
  const anyFree = tiles.some(t => t.state === 'free');
  if (anyFree) {
    nextFreeMinutes = 0;
  } else {
    const busyTiles = tiles.filter(t => t.state === 'busy');
    if (busyTiles.length > 0) {
      nextFreeMinutes = Math.min(...busyTiles.map(t => t.minutesLeft));
    } else {
      nextFreeMinutes = null;
    }
  }

  return {
    branch: branchKey,
    tiles,
    busy,
    total,
    nextFreeMinutes,
  };
}

/**
 * Assign a job to a space, returning a new job list on success.
 */
export function assign(
  cast: Cast,
  jobs: JobWithSpace[],
  jobId: string,
  spaceKey: string
):
  | { ok: true; jobs: JobWithSpace[] }
  | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const jobIdx = jobs.findIndex(j => j.id === jobId);
  if (jobIdx === -1) {
    return { ok: false, reason: 'no such job' };
  }

  const job = jobs[jobIdx];
  if (job.status !== 'open') {
    return { ok: false, reason: 'not open' };
  }

  const branchSpaces = spacesFor(cast, job.branch);
  const spaceExists = branchSpaces.some(s => s.key === spaceKey);
  if (!spaceExists) {
    return { ok: false, reason: 'no such space' };
  }

  const taken = jobs.some(
    j =>
      j.id !== jobId &&
      j.branch === job.branch &&
      j.status === 'open' &&
      j.spaceKey === spaceKey
  );
  if (taken) {
    return { ok: false, reason: 'space taken' };
  }

  const newJobs = jobs.map(j =>
    j.id === jobId ? { ...j, spaceKey } : j
  );
  return { ok: true, jobs: newJobs };
}

/**
 * Remove a job's space assignment, returning a new job list.
 */
export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  const idx = jobs.findIndex(j => j.id === jobId);
  if (idx === -1) return jobs;

  const job = jobs[idx];
  const { spaceKey, ...rest } = job;
  const newJob = { ...rest };
  const newJobs = jobs.map(j => (j.id === jobId ? newJob : j));
  return newJobs;
}
