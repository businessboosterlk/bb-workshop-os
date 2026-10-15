Write the COMPLETE contents of one new TypeScript file: apps/web/src/app/core/spaces.ts in the BB Workshop OS
(an Angular 19 app for garages, detailing studios and car washes). Output ONLY one ```ts code block. No prose.

THE TYPES IT IMPORTS (from './models', already in the app, do not redefine them):
  export type PhaseStatus = 'done' | 'now' | 'next';
  export type JobStatus = 'open' | 'ready' | 'delivered';
  export interface Branch { key: string; name: string; address: string; wa?: string; bays: number; spaces?: SpaceDef[]; }
  export interface Phase { key: string; label: string; hours: number; status: PhaseStatus; startedAt?: string; doneAt?: string; }
  export interface Job { id: string; plate: string; branch: string; phases: Phase[]; status: JobStatus; }
  export interface Cast { branches: Branch[]; }
  (Job and Cast have more fields; use only these. Branch.spaces is new and optional; SpaceDef is defined in YOUR file.)

WHAT THE FILE EXPORTS, EXACTLY THESE NAMES:
  export interface SpaceDef { key: string; label: string; kind?: string; }
  export type JobWithSpace = Job & { spaceKey?: string; hold?: string };
  export type TileState = 'busy' | 'blocked' | 'free';
  export interface Tile { branch: string; space: SpaceDef; job: JobWithSpace | null; state: TileState; minutesInStage: number; minutesLeft: number; }
  export interface Floor { branch: string; tiles: Tile[]; busy: number; total: number; nextFreeMinutes: number | null; }
  export function spacesFor(cast: Cast, branchKey: string): SpaceDef[]
  export function floor(cast: Cast, jobs: JobWithSpace[], branchKey: string, now: number): Floor
  export function assign(cast: Cast, jobs: JobWithSpace[], jobId: string, spaceKey: string): { ok: true; jobs: JobWithSpace[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' }
  export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[]

THE RULES:
1. spacesFor: the branch's own `spaces` when it has a non-empty list; otherwise `bays` spaces made as
   { key: 'b1', label: 'Bay 1', kind: 'bay' }, { key: 'b2', label: 'Bay 2', kind: 'bay' } and so on. Unknown branch: [].
2. floor: one tile per space of that branch, in the order of spacesFor. A space is occupied by the job whose status is
   'open', whose branch is branchKey and whose spaceKey equals the space key. Jobs that are ready, delivered, in another
   branch or without a spaceKey occupy nothing. An occupied space is 'blocked' when the job has a non-empty `hold`,
   otherwise 'busy'. An empty space is 'free' with job null and both minute fields 0.
3. minutesInStage: whole minutes from the startedAt of the job's first phase with status 'now' to `now`
   (Math.round, never negative); 0 when there is no such phase or it has no startedAt.
4. minutesLeft: the rest of the current phase, max(0, hours x 60 minus minutesInStage), plus 60 x the hours of every phase
   with status 'next'; Math.round. Same calculation for busy and blocked.
5. busy = the number of busy plus blocked tiles. total = the number of tiles.
6. nextFreeMinutes: 0 when any tile is free; otherwise the smallest minutesLeft among BUSY tiles (blocked ones are waiting
   on something and do not count); null when there are no busy tiles left to wait for.
7. assign: 'no such job' when no job has that id; 'not open' when its status is not 'open'; 'no such space' when the key
   is not one of the job's own branch spaces; 'space taken' when a DIFFERENT open job in that branch already holds it.
   Otherwise return a NEW array where only that job is a new object with spaceKey set; every other job is the same
   object as before. Assigning a job to the space it already holds is ok.
8. free: a NEW array where that job is a new object without spaceKey (delete the property); an unknown id returns an
   array equal to the input.
9. Pure functions: no Date.now(), no randomness, no mutation of the input objects or arrays, no imports other than
   './models', no `any`. TypeScript strict mode must pass.
10. Comments in British English, short. No em dashes anywhere.
