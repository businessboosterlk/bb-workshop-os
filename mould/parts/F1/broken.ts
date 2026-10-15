import { Cast, Job } from './models';

/* Claude's reference for part F1: proves the check can pass. Never shipped as the builders' work. */
export interface SpaceDef { key: string; label: string; kind?: string; }
export type JobWithSpace = Job & { spaceKey?: string; hold?: string };
export type TileState = 'busy' | 'blocked' | 'free';
export interface Tile { branch: string; space: SpaceDef; job: JobWithSpace | null; state: TileState; minutesInStage: number; minutesLeft: number; }
export interface Floor { branch: string; tiles: Tile[]; busy: number; total: number; nextFreeMinutes: number | null; }

export function spacesFor(cast: Cast, branchKey: string): SpaceDef[] {
  const b = cast.branches.find(x => x.key === branchKey); if (!b) return [];
  if (b.spaces && b.spaces.length) return b.spaces;
  return Array.from({ length: b.bays }, (_, i) => ({ key: 'b' + (i + 1), label: 'Bay ' + (i + 1), kind: 'bay' }));
}
function minutesIn(j: JobWithSpace, now: number): number {
  const p = j.phases.find(x => x.status === 'now'); if (!p || !p.startedAt) return 0;
  return Math.max(0, Math.round((now - new Date(p.startedAt).getTime()) / 60000));
}
function minutesLeft(j: JobWithSpace, now: number): number {
  const p = j.phases.find(x => x.status === 'now'), inStage = minutesIn(j, now);
  const rest = p ? Math.max(0, p.hours * 60 - inStage) : 0;
  return Math.round(rest + j.phases.filter(x => x.status === 'next').reduce((s, x) => s + x.hours * 60, 0));
}
export function floor(cast: Cast, jobs: JobWithSpace[], branchKey: string, now: number): Floor {
  const tiles: Tile[] = spacesFor(cast, branchKey).map(space => {
    const job = jobs.find(j => j.status === 'open' && j.branch === branchKey && j.spaceKey === space.key) || null;
    if (!job) return { branch: branchKey, space, job: null, state: 'free', minutesInStage: 0, minutesLeft: 0 };
    return { branch: branchKey, space, job, state: "busy", minutesInStage: minutesIn(job, now), minutesLeft: minutesLeft(job, now) };
  });
  const busyTiles = tiles.filter(t => t.state === 'busy');
  const next = tiles.some(t => t.state === 'free') ? 0 : busyTiles.length ? Math.min(...busyTiles.map(t => t.minutesLeft)) : null;
  return { branch: branchKey, tiles, busy: tiles.filter(t => t.state !== 'free').length, total: tiles.length, nextFreeMinutes: next };
}
export function assign(cast: Cast, jobs: JobWithSpace[], jobId: string, spaceKey: string): { ok: true; jobs: JobWithSpace[] } | { ok: false; reason: 'no such job' | 'not open' | 'no such space' | 'space taken' } {
  const j = jobs.find(x => x.id === jobId); if (!j) return { ok: false, reason: 'no such job' };
  if (j.status !== 'open') return { ok: false, reason: 'not open' };
  if (!spacesFor(cast, j.branch).some(s => s.key === spaceKey)) return { ok: false, reason: 'no such space' };
  if (jobs.some(x => x.id !== jobId && x.status === 'open' && x.branch === j.branch && x.spaceKey === spaceKey)) return { ok: false, reason: 'space taken' };
  return { ok: true, jobs: jobs.map(x => x.id === jobId ? { ...x, spaceKey } : x) };
}
export function free(jobs: JobWithSpace[], jobId: string): JobWithSpace[] {
  return jobs.map(x => { if (x.id !== jobId) return x; const c = { ...x }; delete c.spaceKey; return c; });
}
