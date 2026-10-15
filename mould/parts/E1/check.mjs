// THE CHECK FOR PART E1 (the engine for F4 and G1, F1's two notes folded in), written by Claude BEFORE any builder ran.
// node check.mjs <candidate spaces.ts>   -> typecheck (strict, noUnusedLocals) + F1's 26 assertions + the new ones
import { execFileSync } from 'node:child_process'; import { mkdtempSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const BIN = process.env.HOME + '/bb-systems/bb-workshop-os/apps/web/node_modules/.bin/';
const src = process.argv[2]; const D = mkdtempSync(join(tmpdir(), 'e1-'));
writeFileSync(join(D, 'models.ts'), `export type PhaseStatus = 'done' | 'now' | 'next'; export type JobStatus = 'open' | 'ready' | 'delivered';
export interface SpaceDef { key: string; label: string; kind?: string; }
export type Hold = 'parts' | 'approval' | 'curing'; export type PartStatus = 'ordered' | 'arrived' | 'fitted';
export interface PartLine { id: string; name: string; supplier?: string; status: PartStatus; orderedAt?: string; arrivedAt?: string; fittedAt?: string; }
export interface Branch { key: string; name: string; address: string; wa?: string; bays: number; spaces?: SpaceDef[]; }
export interface Phase { key: string; label: string; hours: number; status: PhaseStatus; startedAt?: string; doneAt?: string; }
export interface Job { id: string; plate: string; branch: string; phases: Phase[]; status: JobStatus; customerName?: string; createdAt: string; spaceKey?: string; hold?: Hold; heldAt?: string; parts?: PartLine[]; }
export interface Cast { branches: Branch[]; name?: string; }`);
copyFileSync(src, join(D, 'spaces.ts'));
const code = readFileSync(src, 'utf8'); const faults = [];
if (/—|–/.test(code)) faults.push('an em or en dash in the file');
if (/Date\.now\(\)|Math\.random/.test(code)) faults.push('Date.now or Math.random used: the functions must be pure');
if (/:\s*any\b|as any\b|<any>/.test(code)) faults.push('`any` used');
if (/import[^;]+from\s+['"](?!\.\/models['"])/.test(code)) faults.push('an import other than ./models');
try { execFileSync(BIN + 'tsc', ['--noEmit', '--strict', '--noUnusedLocals', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', join(D, 'spaces.ts')], { stdio: 'pipe' }); }
catch (e) { faults.push('typecheck: ' + String(e.stdout || e.stderr).split('\n').slice(0, 3).join(' | ')); }
execFileSync(BIN + 'esbuild', [join(D, 'spaces.ts'), '--format=esm', '--outfile=' + join(D, 'spaces.mjs'), '--log-level=error']);
const S = await import(join(D, 'spaces.mjs'));
const NOW = Date.UTC(2026, 9, 15, 10, 0, 0), iso = mAgo => new Date(NOW - mAgo * 60000).toISOString();
const cast = { branches: [{ key: 'w', name: 'Wellawatte', address: '', bays: 3 }, { key: 'r', name: 'Ratmalana', address: '', bays: 2, spaces: [{ key: 'h1', label: 'Hoist 1', kind: 'hoist' }, { key: 'pb', label: 'Paint booth', kind: 'booth' }] }] };
const job = (id, o = {}) => ({ id, plate: 'P' + id, branch: 'w', status: 'open', createdAt: iso(1000 - Number(id.replace(/\D/g, '') || 0)), phases: [{ key: 'a', label: 'A', hours: 1, status: 'done' }, { key: 'b', label: 'B', hours: 2, status: 'now', startedAt: iso(30) }, { key: 'c', label: 'C', hours: 1, status: 'next' }], ...o });
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
const allHeld = [job('7', { spaceKey: 'b1', hold: 'curing' }), job('8', { spaceKey: 'b2', hold: 'curing' }), job('9', { spaceKey: 'b3', hold: 'curing' })];
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
/* ---- E1: the F1 notes ---- */
const noNow = job('11', { spaceKey: 'b1', phases: [{ key: 'a', label: 'A', hours: 1, status: 'done' }, { key: 'b', label: 'B', hours: 2, status: 'next' }, { key: 'c', label: 'C', hours: 1, status: 'next' }] });
t('minutesLeft counts later stages when no stage is running', safe(() => S.minutesLeft(noNow, NOW)) === 180 && safe(() => S.floor(cast, [noNow], 'w', NOW)).tiles?.[0]?.minutesLeft === 180);
t('minutesLeft exported and equal to the tile', safe(() => S.minutesLeft(jobs[0], NOW)) === 150);
t('no unused import (typecheck ran with noUnusedLocals)', !/import\s*(type\s*)?\{[^}]*PhaseStatus/.test(code) || /PhaseStatus[^;]*[:|<]/.test(code.replace(/import[^;]+;/g, '')));
/* ---- E1: holds and the blocked timer ---- */
const heldIn = job('12', { spaceKey: 'b1', hold: 'parts', heldAt: iso(45) });
const FB = safe(() => S.floor(cast, [heldIn], 'w', NOW)) || {};
t('blocked tile carries heldMinutes from heldAt', FB.tiles?.[0]?.state === 'blocked' && FB.tiles[0].heldMinutes === 45);
t('busy and free tiles have heldMinutes 0', F.tiles?.[0]?.heldMinutes === 0 && F.tiles?.[2]?.heldMinutes === 0);
const H1 = safe(() => S.hold(jobs, '1', 'parts', false, iso(0)));
t('hold in the bay keeps the space and stamps heldAt', H1.ok === true && H1.jobs[0].hold === 'parts' && H1.jobs[0].spaceKey === 'b1' && H1.jobs[0].heldAt === iso(0) && H1.jobs[1] === jobs[1] && JSON.stringify(jobs) === frozen);
const H2 = safe(() => S.hold(jobs, '1', 'approval', true, iso(0)));
t('hold leaving the bay frees the space', H2.ok === true && !('spaceKey' in H2.jobs[0]) && H2.jobs[0].hold === 'approval');
t('hold leaving the bay calls free()', /free\s*\(/.test(code.slice(code.indexOf('function hold'), code.indexOf('function hold') + 900)));
t('hold refuses an unknown job and a job not open', safe(() => S.hold(jobs, 'zz', 'parts', false, iso(0))).reason === 'no such job' && safe(() => S.hold(jobs, '4', 'parts', false, iso(0))).reason === 'not open');
const R1 = safe(() => S.release(jobs, '2'));
t('release removes hold and heldAt, keeps the space', R1.ok === true && !('hold' in R1.jobs[1]) && !('heldAt' in R1.jobs[1]) && R1.jobs[1].spaceKey === 'b2' && R1.jobs[0] === jobs[0]);
t('release an unknown job', safe(() => S.release(jobs, 'zz')).reason === 'no such job');
/* ---- E1: the dock ---- */
const dj = [job('20', { hold: 'parts', heldAt: iso(10) }), job('21', { hold: 'parts', heldAt: iso(90) }), job('22', { hold: 'curing', heldAt: iso(5) }), job('23', { spaceKey: 'b1', hold: 'parts', heldAt: iso(30) }),
  job('24', { status: 'ready', phases: [{ key: 'r', label: 'Ready', hours: 0, status: 'now', startedAt: iso(120) }] }), job('25'), job('26'), job('27', { branch: 'r', hold: 'parts', heldAt: iso(1) })];
const DK = safe(() => S.dock(dj, 'w', NOW)) || {};
t('dock lanes in order, all present', DK.lanes?.map(l => l.key).join() === 'parts,approval,curing,ready' && DK.lanes?.map(l => l.label).join() === 'Waiting parts,Waiting approval,Curing,Ready');
t('dock lane holds held cars with no space, largest wait first', DK.lanes?.[0]?.cars?.map(c => c.job.id).join() === '21,20' && DK.lanes[0].cars[0].minutes === 90);
t('a held car still in its bay is not in the dock', !DK.lanes?.some(l => l.cars.some(c => c.job.id === '23')));
t('ready lane uses the running phase start', DK.lanes?.[3]?.cars?.[0]?.job?.id === '24' && DK.lanes[3].cars[0].minutes === 120);
t('queue = open, no space, no hold, oldest first', DK.queue?.map(j => j.id).join() === '25,26');
t('dock with branch "" spans every branch', safe(() => S.dock(dj, '', NOW)).lanes?.[0]?.cars?.length === 3);
t('a car in the dock is never counted busy', safe(() => S.floor(cast, dj, 'w', NOW)).busy === 1);
/* ---- E1: parts ---- */
const P1 = safe(() => S.addPart(jobs, '1', { id: 'p1', name: '  Headlamp ', supplier: ' Kapruka Parts ' }, iso(60)));
const pj = P1.ok ? P1.jobs[0] : {};
t('addPart orders a trimmed part', P1.ok === true && pj.parts?.length === 1 && pj.parts[0].name === 'Headlamp' && pj.parts[0].supplier === 'Kapruka Parts' && pj.parts[0].status === 'ordered' && pj.parts[0].orderedAt === iso(60) && JSON.stringify(jobs) === frozen);
t('addPart drops an empty supplier key', (() => { const r = safe(() => S.addPart(jobs, '1', { id: 'p2', name: 'Bolt', supplier: '  ' }, iso(0))); return r.ok === true && !('supplier' in r.jobs[0].parts[0]); })());
t('addPart refuses empty name, unknown job, not open', safe(() => S.addPart(jobs, '1', { id: 'p', name: ' ' }, iso(0))).reason === 'name needed' && safe(() => S.addPart(jobs, 'zz', { id: 'p', name: 'x' }, iso(0))).reason === 'no such job' && safe(() => S.addPart(jobs, '4', { id: 'p', name: 'x' }, iso(0))).reason === 'not open');
const E = P1.ok ? safe(() => S.editPart(P1.jobs, '1', 'p1', { name: 'Headlamp, left', supplier: '' })) : {};
t('editPart renames, removes empty supplier, keeps status', E.ok === true && E.jobs[0].parts[0].name === 'Headlamp, left' && !('supplier' in E.jobs[0].parts[0]) && E.jobs[0].parts[0].status === 'ordered' && E.jobs[0].parts !== P1.jobs[0].parts);
t('editPart refusals', P1.ok && safe(() => S.editPart(P1.jobs, '1', 'nope', { name: 'x' })).reason === 'no such part' && safe(() => S.editPart(P1.jobs, '1', 'p1', { name: '' })).reason === 'name needed');
/* the G1 rule: a part arriving moves the car back to its bay queue */
const waiting = [job('30', { hold: 'parts', heldAt: iso(200), parts: [{ id: 'a', name: 'Door', status: 'ordered', orderedAt: iso(300) }, { id: 'b', name: 'Clip', status: 'ordered', orderedAt: iso(250) }] })];
const A1 = safe(() => S.partArrived(waiting, '30', 'a', iso(5)));
t('one part of two arrived: the car still waits', A1.ok === true && A1.jobs[0].hold === 'parts' && A1.jobs[0].parts[0].status === 'arrived' && A1.jobs[0].parts[0].arrivedAt === iso(5));
const A2 = A1.ok ? safe(() => S.partArrived(A1.jobs, '30', 'b', iso(0))) : {};
t('THE G1 RULE: the last part arriving moves the car back to the bay queue', A2.ok === true && !('hold' in A2.jobs[0]) && !('heldAt' in A2.jobs[0]) && safe(() => S.dock(A2.jobs, 'w', NOW)).queue?.[0]?.id === '30');
t('partArrived refuses a part not ordered', A2.ok && safe(() => S.partArrived(A2.jobs, '30', 'a', iso(0))).reason === 'not ordered');
t('a part arriving does not release a different hold', (() => { const r = safe(() => S.partArrived([{ ...waiting[0], hold: 'approval' }], '30', 'a', iso(0))); const r2 = r.ok ? safe(() => S.partArrived(r.jobs, '30', 'b', iso(0))) : {}; return r2.ok === true && r2.jobs[0].hold === 'approval'; })());
const Fi = A2.ok ? safe(() => S.partFitted(A2.jobs, '30', 'a', iso(0))) : {};
t('partFitted from arrived only', Fi.ok === true && Fi.jobs[0].parts[0].status === 'fitted' && Fi.jobs[0].parts[0].fittedAt === iso(0) && safe(() => S.partFitted(waiting, '30', 'a', iso(0))).reason === 'not arrived');
const PB = Fi.ok ? safe(() => S.partsBoard([...Fi.jobs, { ...job('31', { branch: 'r' }), parts: [{ id: 'z', name: 'Mirror', status: 'ordered', orderedAt: iso(9) }] }, { ...job('32', { status: 'delivered' }), parts: [{ id: 'y', name: 'Old', status: 'fitted', fittedAt: iso(9) }] }], 'w')) : {};
t('partsBoard columns by status, branch filtered, delivered left out', PB.fitted?.length === 1 && PB.arrived?.length === 1 && PB.ordered?.length === 0 && PB.fitted[0].part.id === 'a' && PB.fitted[0].job.id === '30');
t('partsBoard "" spans branches', Fi.ok && safe(() => S.partsBoard([{ ...job('31', { branch: 'r' }), parts: [{ id: 'z', name: 'Mirror', status: 'ordered', orderedAt: iso(9) }] }, ...Fi.jobs], '')).ordered?.length === 1);
console.log(faults.length ? 'FAIL ' + ok + '/' + n + '\n  ' + faults.join('\n  ') : 'PASS ' + ok + '/' + n);
process.exit(faults.length ? 1 : 0);
