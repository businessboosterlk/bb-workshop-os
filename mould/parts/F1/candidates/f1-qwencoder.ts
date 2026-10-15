import { Branch, Cast, Job, JobStatus, Phase, PhaseStatus } from './models';

export interface SpaceDef { key: string; label: string; kind?: string; }
export type JobWithSpace = Job & { spaceKey?: string; hold?: string };
export type TileState = 'busy' | 'blocked' | 'free';
export interface Tile { branch: string; space: SpaceDef; job: JobWithSpace | null; state: TileState; minutesInStage: number; minutesLeft: number; }
export interface Floor { branch: string; tiles: Tile[]; busy: number; total: number; nextFreeMinutes: number | null; }

function findJob(jobs: JobWithSpace[], id: string): JobWithSpace | undefined {
  return jobs.find(job => job.id === id);
}

function isOpen(job: JobWithSpace): boolean {
  return job.status === 'open';
}

function isPhaseNow(phase: Phase): boolean {
  return phase.status === 'now';
}

function getMinutesInStage(phases: Phase[], now: number): number {
  const nowPhase = phases.find(isPhaseNow);
  if (!nowPhase || !nowPhase.startedAt) return 0;
  const start = new Date(nowPhase.startedAt).getTime();
  return Math.max(0, Math.round((now - start) / 60000));
}

function getMinutesLeft(phases: Phase[], minutesInStage: number): number {
  const nowPhase = phases.find(isPhaseNow);
  let left = 0;
  if (nowPhase) {
    const nowLeft = Math.max(0, Math.round(nowPhase.hours * 60 - minutesInStage));
    left += nowLeft;
  }
  const nextPhases = phases.filter(p => p.status === 'next');
  const nextHours = nextPhases.reduce((sum, p) => sum + p.hours, 0);
  left += Math.round(nextHours * 60);
  return left;
}

export function spacesFor(cast: Cast, branchKey: string): SpaceDef[] {
  const branch = cast.branches.find(b => b.key === branchKey);
  if (!branch) return [];
  if (branch.spaces && branch.spaces.length > 0) return branch.spaces;
  const spaces: SpaceDef[] = [];
  for (let i = 1; i <= branch.bays; i++) {
    spaces.push({ key: `b${i}`, label: `Bay ${i}`, kind: 'bay' });
  }
  return spaces;
}

export function floor(cast: Cast, jobs: JobWithSpace[], branchKey: string, now: number): Floor {
  const spaces = spacesFor(cast, branchKey);
  const branchJobs = jobs.filter(job => job.branch === branchKey && job.status === 'open');
  let busyCount = 0;
  let nextFreeMinutes: number | null = null;
  const busyMinutes: number[] = [];

  const tiles: Tile[] = spaces.map(space => {
    const occupyingJob = branchJobs.find(job => job.spaceKey === space.key);
    if (occupyingJob) {
      const minutesInStage = getMinutesInStage(occupyingJob.phases, now);
      const minutesLeft = getMinutesLeft(occupyingJob.phases, minutesInStage);
      const state: TileState = occupyingJob.hold ? 'blocked' : 'busy';
      if (state !== 'free') {
        busyCount++;
        if (state === 'busy') busyMinutes.push(minutesLeft);
      }
      return {
        branch: branchKey,
        space,
        job: occupyingJob,
        state,
        minutesInStage,
        minutesLeft
      };
    } else {
      return {
        branch: branchKey,
        space,
        job: null,
        state: 'free',
        minutesInStage: 0,
        minutesLeft: 0
      };
    }
  });

  if (tiles.some(t => t.state === 'free')) {
    nextFreeMinutes = 0;
  } else if (busyMinutes.length > 0) {
    nextFreeMinutes = Math.min(...busyMinutes);
  } else {
    nextFreeMinutes = null;
  }

  return {
    branch: branchKey,
    tiles,
    busy: busyCount,
    total: tiles.length,
    nextFreeMinutes
  };
}

export function assign(
  cast: Cast,
  jobs: JobWithSpace[],
  jobId: string,
  spaceKey: string
): { ok: true; jobs: JobWithSpace[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const job = findJob(jobs, jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (!isOpen(job)) return { ok: false, reason: 'not open' };

  const branch = cast.branches.find(b => b.key === job.branch);
  if (!branch) return { ok: false, reason: 'no such space' };

  const validSpaces = spacesFor(cast, job.branch);
  const isValidSpace = validSpaces.some(s => s.key === spaceKey);
  if (!isValidSpace) return { ok: false, reason: 'no such space' };

  const isTaken = jobs.some(j => j.id !== jobId && j.branch === job.branch && j.spaceKey === spaceKey && j.status === 'open');
  if (isTaken) return { ok: false, reason: 'space taken' };

  const newJobs = jobs.map(j => {
    if (j.id === jobId) {
      return { ...j, spaceKey };
    }
    return j;
  });

  return { ok: true, jobs: newJobs };
}

export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  const job = findJob(jobs, jobId);
  if (!job) return jobs;

  return jobs.map(j => {
    if (j.id === jobId) {
      const { spaceKey, ...rest } = j;
      return rest as JobWithSpace;
    }
    return j;
  });
}
