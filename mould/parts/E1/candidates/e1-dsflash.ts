import type { Cast, Job, PhaseStatus, SpaceDef, Hold, PartStatus, PartLine, Branch, Phase } from './models';

export type JobWithSpace = Job;

export type TileState = 'busy' | 'blocked' | 'free';

export interface Tile {
  branch: string;
  space: SpaceDef;
  job: Job | null;
  state: TileState;
  minutesInStage: number;
  minutesLeft: number;
  heldMinutes: number;
}

export interface Floor {
  branch: string;
  tiles: Tile[];
  busy: number;
  total: number;
  nextFreeMinutes: number | null;
}

export type LaneKey = Hold | 'ready';

export interface DockCar {
  job: Job;
  minutes: number;
}

export interface Lane {
  key: LaneKey;
  label: string;
  cars: DockCar[];
}

export interface Dock {
  lanes: Lane[];
  queue: Job[];
}

export type Result = { ok: true; jobs: Job[] } | { ok: false; reason: string };

export interface PartRow {
  job: Job;
  part: PartLine;
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

export function minutesLeft(job: Job, now: number): number {
  const currentPhase = job.phases.find((p) => p.status === 'now');
  const inStage = currentPhase?.startedAt
    ? Math.max(0, Math.round((now - new Date(currentPhase.startedAt).getTime()) / 60000))
    : 0;
  const currentMinutes = currentPhase
    ? Math.max(0, Math.round(currentPhase.hours * 60 - inStage))
    : 0;
  const nextMinutes = job.phases
    .filter((p) => p.status === 'next')
    .reduce((sum, p) => sum + p.hours * 60, 0);
  return Math.round(currentMinutes + nextMinutes);
}

export function floor(cast: Cast, jobs: Job[], branchKey: string, now: number): Floor {
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
        heldMinutes: 0,
      };
    }
    const currentPhase = job.phases.find((p) => p.status === 'now');
    const minutesInStage = currentPhase?.startedAt
      ? Math.max(0, Math.round((now - new Date(currentPhase.startedAt).getTime()) / 60000))
      : 0;
    const heldMinutes = job.hold && job.heldAt
      ? Math.max(0, Math.round((now - new Date(job.heldAt).getTime()) / 60000))
      : 0;
    return {
      branch: branchKey,
      space,
      job,
      state: job.hold ? 'blocked' : 'busy',
      minutesInStage,
      minutesLeft: minutesLeft(job, now),
      heldMinutes,
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
  jobs: Job[],
  jobId: string,
  spaceKey: string
): { ok: true; jobs: Job[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (job.status !== 'open') return { ok: false, reason: 'not open' };
  const spaces = spacesFor(cast, job.branch);
  if (!spaces.some((s) => s.key === spaceKey)) return { ok: false, reason: 'no such space' };
  const taken = jobs.some(
    (j) => j.id !== jobId && j.status === 'open' && j.branch === job.branch && j.spaceKey === spaceKey
  );
  if (taken) return { ok: false, reason: 'space taken' };
  const newJob: Job = { ...job, spaceKey };
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function free(jobs: Job[], jobId: string): Job[] {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return jobs;
  const newJob: Job = { ...job };
  delete newJob.spaceKey;
  return jobs.map((j) => (j.id === jobId ? newJob : j));
}

export function hold(jobs: Job[], jobId: string, reason: Hold, leaveBay: boolean, nowIso: string): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (job.status !== 'open') return { ok: false, reason: 'not open' };
  const newJob: Job = { ...job, hold: reason, heldAt: nowIso };
  let newJobs = jobs.map((j) => (j.id === jobId ? newJob : j));
  if (leaveBay) {
    newJobs = free(newJobs, jobId);
  }
  return { ok: true, jobs: newJobs };
}

export function release(jobs: Job[], jobId: string): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  const newJob: Job = { ...job };
  delete newJob.hold;
  delete newJob.heldAt;
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function dock(jobs: Job[], branchKey: string, now: number): Dock {
  const filtered = branchKey === '' ? jobs : jobs.filter((j) => j.branch === branchKey);
  const lanes: Lane[] = [
    { key: 'parts', label: 'Waiting parts', cars: [] },
    { key: 'approval', label: 'Waiting approval', cars: [] },
    { key: 'curing', label: 'Curing', cars: [] },
    { key: 'ready', label: 'Ready', cars: [] },
  ];
  for (const job of filtered) {
    if (job.status === 'open' && job.hold && !job.spaceKey) {
      const lane = lanes.find((l) => l.key === job.hold);
      if (lane) {
        const minutes = job.heldAt
          ? Math.max(0, Math.round((now - new Date(job.heldAt).getTime()) / 60000))
          : 0;
        lane.cars.push({ job, minutes });
      }
    } else if (job.status === 'ready') {
      const currentPhase = job.phases.find((p) => p.status === 'now');
      const minutes = currentPhase?.startedAt
        ? Math.max(0, Math.round((now - new Date(currentPhase.startedAt).getTime()) / 60000))
        : 0;
      const lane = lanes.find((l) => l.key === 'ready');
      if (lane) {
        lane.cars.push({ job, minutes });
      }
    }
  }
  for (const lane of lanes) {
    lane.cars.sort((a, b) => b.minutes - a.minutes);
  }
  const queue = filtered
    .filter((j) => j.status === 'open' && !j.spaceKey && !j.hold)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { lanes, queue };
}

export function addPart(jobs: Job[], jobId: string, part: { id: string; name: string; supplier?: string }, nowIso: string): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  if (job.status !== 'open') return { ok: false, reason: 'not open' };
  const name = part.name.trim();
  if (!name) return { ok: false, reason: 'name needed' };
  const supplier = part.supplier?.trim();
  const newPart: PartLine = {
    id: part.id,
    name,
    ...(supplier ? { supplier } : {}),
    status: 'ordered',
    orderedAt: nowIso,
  };
  const newParts = [...(job.parts ?? []), newPart];
  const newJob: Job = { ...job, parts: newParts };
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function editPart(jobs: Job[], jobId: string, partId: string, patch: { name: string; supplier?: string }): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  const part = job.parts?.find((p) => p.id === partId);
  if (!part) return { ok: false, reason: 'no such part' };
  const name = patch.name.trim();
  if (!name) return { ok: false, reason: 'name needed' };
  const supplier = patch.supplier?.trim();
  const newPart: PartLine = {
    ...part,
    name,
    ...(supplier ? { supplier } : {}),
  };
  const newParts = job.parts?.map((p) => (p.id === partId ? newPart : p)) ?? [];
  const newJob: Job = { ...job, parts: newParts };
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function partArrived(jobs: Job[], jobId: string, partId: string, nowIso: string): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  const part = job.parts?.find((p) => p.id === partId);
  if (!part) return { ok: false, reason: 'no such part' };
  if (part.status !== 'ordered') return { ok: false, reason: 'not ordered' };
  const newPart: PartLine = { ...part, status: 'arrived', arrivedAt: nowIso };
  const newParts = job.parts?.map((p) => (p.id === partId ? newPart : p)) ?? [];
  const newJob: Job = { ...job, parts: newParts };
  let newJobs = jobs.map((j) => (j.id === jobId ? newJob : j));
  if (job.hold === 'parts' && !newParts.some((p) => p.status === 'ordered')) {
    const released = release(newJobs, jobId);
    if (released.ok) {
      newJobs = released.jobs;
    }
  }
  return { ok: true, jobs: newJobs };
}

export function partFitted(jobs: Job[], jobId: string, partId: string, nowIso: string): Result {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, reason: 'no such job' };
  const part = job.parts?.find((p) => p.id === partId);
  if (!part) return { ok: false, reason: 'no such part' };
  if (part.status !== 'arrived') return { ok: false, reason: 'not arrived' };
  const newPart: PartLine = { ...part, status: 'fitted', fittedAt: nowIso };
  const newParts = job.parts?.map((p) => (p.id === partId ? newPart : p)) ?? [];
  const newJob: Job = { ...job, parts: newParts };
  return { ok: true, jobs: jobs.map((j) => (j.id === jobId ? newJob : j)) };
}

export function partsBoard(jobs: Job[], branchKey: string): Record<PartStatus, PartRow[]> {
  const result: Record<PartStatus, PartRow[]> = { ordered: [], arrived: [], fitted: [] };
  const filtered = branchKey === '' ? jobs : jobs.filter((j) => j.branch === branchKey);
  for (const job of filtered) {
    if (job.status === 'delivered') continue;
    for (const part of job.parts ?? []) {
      result[part.status].push({ job, part });
    }
  }
  result.ordered.sort((a, b) => (a.part.orderedAt ?? '').localeCompare(b.part.orderedAt ?? ''));
  result.arrived.sort((a, b) => (a.part.arrivedAt ?? '').localeCompare(b.part.arrivedAt ?? ''));
  result.fitted.sort((a, b) => (a.part.fittedAt ?? '').localeCompare(b.part.fittedAt ?? ''));
  return result;
}
