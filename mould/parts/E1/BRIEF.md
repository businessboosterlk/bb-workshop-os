Write the COMPLETE contents of one TypeScript file: apps/web/src/app/core/spaces.ts in the BB Workshop OS (an Angular 19
app for garages). It REPLACES the current file, which is given at the end: keep its five exports working exactly as they do
and add the new ones. Output ONLY one ```ts code block. No prose.

THE TYPES IT IMPORTS (from './models', already in the app, never redefine them, import only what you use):
  export type PhaseStatus = 'done' | 'now' | 'next';
  export type JobStatus = 'open' | 'ready' | 'delivered';
  export interface SpaceDef { key: string; label: string; kind?: string; }
  export type Hold = 'parts' | 'approval' | 'curing';
  export type PartStatus = 'ordered' | 'arrived' | 'fitted';
  export interface PartLine { id: string; name: string; supplier?: string; status: PartStatus; orderedAt?: string; arrivedAt?: string; fittedAt?: string; }
  export interface Branch { key: string; name: string; address: string; bays: number; spaces?: SpaceDef[]; }
  export interface Phase { key: string; label: string; hours: number; status: PhaseStatus; startedAt?: string; doneAt?: string; }
  export interface Job { id: string; plate: string; branch: string; phases: Phase[]; status: JobStatus; createdAt: string;
                         spaceKey?: string; hold?: Hold; heldAt?: string; parts?: PartLine[]; }
  export interface Cast { branches: Branch[]; }
  (Job and Cast have more fields; use only these.)

WHAT THE FILE EXPORTS, EXACTLY THESE NAMES:
  export type JobWithSpace = Job;                      // kept so older imports still compile
  export type TileState = 'busy' | 'blocked' | 'free';
  export interface Tile { branch: string; space: SpaceDef; job: Job | null; state: TileState; minutesInStage: number; minutesLeft: number; heldMinutes: number; }
  export interface Floor { branch: string; tiles: Tile[]; busy: number; total: number; nextFreeMinutes: number | null; }
  export type LaneKey = Hold | 'ready';
  export interface DockCar { job: Job; minutes: number; }
  export interface Lane { key: LaneKey; label: string; cars: DockCar[]; }
  export interface Dock { lanes: Lane[]; queue: Job[]; }
  export type Result = { ok: true; jobs: Job[] } | { ok: false; reason: string };
  export interface PartRow { job: Job; part: PartLine; }
  export function spacesFor(cast: Cast, branchKey: string): SpaceDef[]
  export function floor(cast: Cast, jobs: Job[], branchKey: string, now: number): Floor
  export function assign(cast: Cast, jobs: Job[], jobId: string, spaceKey: string): { ok: true; jobs: Job[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' }
  export function free(jobs: Job[], jobId: string): Job[]
  export function minutesLeft(job: Job, now: number): number
  export function hold(jobs: Job[], jobId: string, reason: Hold, leaveBay: boolean, nowIso: string): Result
  export function release(jobs: Job[], jobId: string): Result
  export function dock(jobs: Job[], branchKey: string, now: number): Dock
  export function addPart(jobs: Job[], jobId: string, part: { id: string; name: string; supplier?: string }, nowIso: string): Result
  export function editPart(jobs: Job[], jobId: string, partId: string, patch: { name: string; supplier?: string }): Result
  export function partArrived(jobs: Job[], jobId: string, partId: string, nowIso: string): Result
  export function partFitted(jobs: Job[], jobId: string, partId: string, nowIso: string): Result
  export function partsBoard(jobs: Job[], branchKey: string): Record<PartStatus, PartRow[]>

THE RULES (numbered; the check tests each one):
1. spacesFor, floor, assign and free behave exactly as in the current file, with the changes in rules 2 to 4.
2. minutesLeft(job, now): let p be the job's first phase with status 'now'. inStage = p and p.startedAt ? max(0, round((now -
   time of p.startedAt) / 60000)) : 0. Result = (p ? max(0, p.hours x 60 - inStage) : 0) + 60 x the hours of every phase with
   status 'next', Math.round on the total. NEW: with NO phase 'now' the later 'next' phases still count (the old file said 0).
   floor uses this function for minutesLeft of busy and blocked tiles.
3. Tile.heldMinutes: for a blocked tile, max(0, round((now - time of job.heldAt) / 60000)) when heldAt is set, else 0. For busy
   and free tiles 0.
4. Remove the unused import the old file had. Import nothing you do not use.
5. hold: 'no such job' when no job has that id, 'not open' when its status is not 'open'. Otherwise the job gets hold = reason
   and heldAt = nowIso. When leaveBay is true the job must ALSO leave its space, and that must be done by calling free() on the
   jobs (never by deleting spaceKey yourself), because a camera will later call the same free(). Return ok with the new array.
6. release: 'no such job' when no job has that id. Otherwise a new job object without the properties hold and heldAt (delete
   them; spaceKey is left as it is). ok.
7. dock(jobs, branchKey, now): branchKey '' means every branch, otherwise only jobs with that branch. Lanes ALWAYS in this order,
   each present even when empty: parts 'Waiting parts', approval 'Waiting approval', curing 'Curing', ready 'Ready'.
   A held lane holds the jobs with status 'open', that hold, and NO spaceKey (a held car still in its bay is a blocked tile on
   the floor, not in the dock); minutes = minutes since heldAt as in rule 3. The ready lane holds jobs with status 'ready';
   minutes = minutes since the startedAt of their phase with status 'now' (0 when none). Cars in a lane are sorted by minutes,
   largest first. queue = jobs with status 'open', no spaceKey and no hold, sorted by createdAt, oldest first.
   A car in the dock or the queue is never counted busy on the floor (it has no spaceKey, so floor already ignores it).
8. addPart: 'no such job'; 'not open' when status is not 'open'; 'name needed' when part.name trimmed is empty. Otherwise the job
   gets parts = [...old parts or [], { id, name: trimmed, supplier: trimmed supplier or leave the key out when empty,
   status: 'ordered', orderedAt: nowIso }].
9. editPart: 'no such job'; 'no such part'; 'name needed' for an empty trimmed name. Otherwise that part gets the trimmed name and
   supplier (supplier key removed when empty); its status and dates are unchanged.
10. partArrived: 'no such job'; 'no such part'; 'not ordered' when that part's status is not 'ordered'. Otherwise status
   'arrived' and arrivedAt = nowIso. THEN, if the job's hold is 'parts' and no part of the job is still 'ordered', the hold is
   released exactly as rule 6 (hold and heldAt removed), so a car in the dock goes back to the queue for a bay.
11. partFitted: 'no such job'; 'no such part'; 'not arrived' when that part's status is not 'arrived'. Otherwise 'fitted' and
   fittedAt = nowIso.
12. partsBoard: { ordered: [], arrived: [], fitted: [] } filled with one row per part of every job whose status is not
   'delivered' and whose branch matches (branchKey '' means all). Each column sorted by the part's own date for that column
   (orderedAt, arrivedAt, fittedAt), oldest first.
13. Every function returning jobs returns a NEW array in which only the changed job is a new object; every other job is the
   very same object; a changed parts array is a new array; the input objects and arrays are never mutated.
14. Pure functions: no Date.now(), no new Date() without an argument, no randomness, no imports other than './models', no
   `any`, no non-null assertions on lookups that can miss. TypeScript strict mode must pass with noUnusedLocals.
15. Comments in British English, short. No em dashes or en dashes anywhere in the file.

THE CURRENT FILE (keep its behaviour, apply rules 2 to 4):
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
