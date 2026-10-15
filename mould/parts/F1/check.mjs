// THE CHECK FOR PART F1, written by Claude BEFORE any builder ran (the key before the run).
// node check.mjs <candidate spaces.ts>   -> typecheck (strict) + 26 behaviour assertions; prints PASS n/26 or the failures
import { execFileSync } from 'node:child_process'; import { mkdtempSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const BIN = process.env.HOME + '/bb-systems/bb-workshop-os/apps/web/node_modules/.bin/';
const src = process.argv[2]; const D = mkdtempSync(join(tmpdir(), 'f1-'));
writeFileSync(join(D, 'models.ts'), `export type PhaseStatus = 'done' | 'now' | 'next'; export type JobStatus = 'open' | 'ready' | 'delivered';
import type { SpaceDef } from './spaces';
export interface Branch { key: string; name: string; address: string; wa?: string; bays: number; spaces?: SpaceDef[]; }
export interface Phase { key: string; label: string; hours: number; status: PhaseStatus; startedAt?: string; doneAt?: string; }
export interface Job { id: string; plate: string; branch: string; phases: Phase[]; status: JobStatus; customerName?: string; }
export interface Cast { branches: Branch[]; name?: string; }`);
copyFileSync(src, join(D, 'spaces.ts'));
const code = readFileSync(src, 'utf8'); const faults = [];
if (/—|–/.test(code)) faults.push('an em or en dash in the file');
if (/Date\.now\(\)|Math\.random/.test(code)) faults.push('Date.now or Math.random used: the functions must be pure');
if (/:\s*any\b|as any\b|<any>/.test(code)) faults.push('`any` used');
if (/import[^;]+from\s+['"](?!\.\/models['"])/.test(code)) faults.push('an import other than ./models');
try { execFileSync(BIN + 'tsc', ['--noEmit', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', join(D, 'spaces.ts')], { stdio: 'pipe' }); }
catch (e) { faults.push('typecheck: ' + String(e.stdout || e.stderr).split('\n').slice(0, 3).join(' | ')); }
execFileSync(BIN + 'esbuild', [join(D, 'spaces.ts'), '--format=esm', '--outfile=' + join(D, 'spaces.mjs'), '--log-level=error']);
const S = await import(join(D, 'spaces.mjs'));
const NOW = Date.UTC(2026, 9, 15, 10, 0, 0), iso = mAgo => new Date(NOW - mAgo * 60000).toISOString();
const cast = { branches: [{ key: 'w', name: 'Wellawatte', address: '', bays: 3 }, { key: 'r', name: 'Ratmalana', address: '', bays: 2, spaces: [{ key: 'h1', label: 'Hoist 1', kind: 'hoist' }, { key: 'pb', label: 'Paint booth', kind: 'booth' }] }] };
const job = (id, o = {}) => ({ id, plate: 'P' + id, branch: 'w', status: 'open', phases: [{ key: 'a', label: 'A', hours: 1, status: 'done' }, { key: 'b', label: 'B', hours: 2, status: 'now', startedAt: iso(30) }, { key: 'c', label: 'C', hours: 1, status: 'next' }], ...o });
const jobs = [job('1', { spaceKey: 'b1' }), job('2', { spaceKey: 'b2', hold: 'parts' }), job('3'), job('4', { spaceKey: 'b3', status: 'ready' }), job('5', { branch: 'r', spaceKey: 'pb' })];
const frozen = JSON.stringify(jobs); let n = 0, ok = 0; const t = (name, cond) => { n++; if (cond) ok++; else faults.push('FAILED: ' + name); };
const safe = f => { try { return f(); } catch (e) { return { __err: e.message }; } };
const sp = safe(() => S.spacesFor(cast, 'w')); t('spacesFor makes Bay 1..3 from bays', Array.isArray(sp) && sp.length === 3 && sp[0].key === 'b1' && sp[2].label === 'Bay 3' && sp[1].kind === 'bay');
const sr = safe(() => S.spacesFor(cast, 'r')); t('spacesFor uses the branch list when present', Array.isArray(sr) && sr.map(s => s.key).join() === 'h1,pb');
t('spacesFor unknown branch is empty', JSON.stringify(safe(() => S.spacesFor(cast, 'x'))) === '[]');
const F = safe(() => S.floor(cast, jobs, 'w', NOW)) || {};
t('floor has one tile per space in order', F.tiles?.length === 3 && F.tiles.map(x => x.space.key).join() === 'b1,b2,b3');
t('busy tile', F.tiles?.[0]?.state === 'busy' && F.tiles[0].job?.id === '1');
t('a job on hold is blocked', F.tiles?.[1]?.state === 'blocked');
t('a ready job occupies nothing', F.tiles?.[2]?.state === 'free' && F.tiles[2].job === null);
t('free tile minutes are 0', F.tiles?.[2]?.minutesInStage === 0 && F.tiles?.[2]?.minutesLeft === 0);
t('minutesInStage from startedAt', F.tiles?.[0]?.minutesInStage === 30);
t('minutesLeft = rest of phase + next phases', F.tiles?.[0]?.minutesLeft === 90 + 60);
t('busy counts busy and blocked', F.busy === 2 && F.total === 3);
t('nextFreeMinutes is 0 while a space is free', F.nextFreeMinutes === 0);
const full = [...jobs.slice(0, 3), job('6', { spaceKey: 'b3' })];
const F2 = safe(() => S.floor(cast, full, 'w', NOW)) || {};
t('nextFreeMinutes = smallest minutesLeft of BUSY tiles when full', F2.busy === 3 && F2.nextFreeMinutes === 150);
const allHeld = [job('7', { spaceKey: 'b1', hold: 'x' }), job('8', { spaceKey: 'b2', hold: 'x' }), job('9', { spaceKey: 'b3', hold: 'x' })];
t('nextFreeMinutes is null when every tile is blocked', safe(() => S.floor(cast, allHeld, 'w', NOW)).nextFreeMinutes === null);
const over = [job('10', { spaceKey: 'b1', phases: [{ key: 'b', label: 'B', hours: 0.25, status: 'now', startedAt: iso(40) }] })];
t('minutesLeft never negative in an overrun', safe(() => S.floor(cast, over, 'w', NOW)).tiles?.[0]?.minutesLeft === 0);
t('a job in another branch stays out', safe(() => S.floor(cast, jobs, 'r', NOW)).tiles?.[1]?.job?.id === '5');
const A = safe(() => S.assign(cast, jobs, '3', 'b3'));
t('assign to a free space works', A.ok === true && A.jobs.find(j => j.id === '3').spaceKey === 'b3');
t('assign keeps every other job the same object', A.ok === true && A.jobs[0] === jobs[0] && A.jobs[4] === jobs[4]);
t('assign returns a new array and does not mutate', A.ok === true && A.jobs !== jobs && JSON.stringify(jobs) === frozen);
t('assign to a taken space is refused', safe(() => S.assign(cast, jobs, '3', 'b1')).reason === 'space taken');
t('assign to a space of another branch is refused', safe(() => S.assign(cast, jobs, '3', 'pb')).reason === 'no such space');
t('assign an unknown job', safe(() => S.assign(cast, jobs, 'zz', 'b3')).reason === 'no such job');
t('assign a job that is not open', safe(() => S.assign(cast, jobs, '4', 'b3')).reason === 'not open');
t('assign a job to the space it already holds is ok', safe(() => S.assign(cast, jobs, '1', 'b1')).ok === true);
const Fr = safe(() => S.free(jobs, '1'));
t('free removes spaceKey on a new object', Array.isArray(Fr) && !('spaceKey' in Fr[0]) && Fr[0] !== jobs[0] && Fr[1] === jobs[1] && JSON.stringify(jobs) === frozen);
t('free an unknown id leaves the jobs as they were', JSON.stringify(safe(() => S.free(jobs, 'zz'))) === frozen);
console.log(faults.length ? 'FAIL ' + ok + '/' + n + '\n  ' + faults.join('\n  ') : 'PASS ' + ok + '/' + n);
process.exit(faults.length ? 1 : 0);
