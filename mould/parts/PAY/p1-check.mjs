// P1 (payments part A, rules 1 to 6): the pure payments engine, written twice with the same rules: the web copy
// apps/web/src/app/core/payments.ts (bundled here with esbuild) and the server copy apps/api/lib/payments.js. Every case
// runs on BOTH and must give the expected answer on both, so the two can never drift. The web copy must also pass
// tsc --strict. Synthetic data only. Written by Claude BEFORE the crew ran, 18 Oct 2026.
//   node --no-warnings mould/parts/PAY/p1-check.mjs
import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { dirname, join } from 'node:path';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { spawnSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
const WEB = join(ROOT, 'apps', 'web'), MAIN_WEB = '/Users/thulaibhassen/bb-systems/bb-workshop-os/apps/web';
/* PAY_TS and PAY_JS point the check at other copies (Claude proves the check itself against a scratch reference first) */
const TS = process.env.PAY_TS || join(WEB, 'src', 'app', 'core', 'payments.ts'), JS = process.env.PAY_JS || join(ROOT, 'apps', 'api', 'lib', 'payments.js');
let n = 0, bad = 0; const rows = [];
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
const short = v => { const s = canon(v); return s === undefined ? 'undefined' : s.slice(0, 220); };

const engines = [];
const base = existsSync(join(WEB, 'node_modules', 'esbuild')) ? WEB : MAIN_WEB;
try {
  const esbuild = createRequire(join(base, 'package.json'))('esbuild');
  const out = join(mkdtempSync(join(tmpdir(), 'wos-pay-')), 'payments.mjs');
  await esbuild.build({ entryPoints: [TS], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
  engines.push(['web', await import(pathToFileURL(out).href)]);
} catch (e) { t('the web engine payments.ts loads', false, String(e && e.message || e).slice(0, 160)); }
try { engines.push(['server', await import(pathToFileURL(JS).href)]); } catch (e) { t('the server engine payments.js loads', false, String(e && e.message || e).slice(0, 160)); }

const NAMES = ['PAY_METHODS', 'paidOf', 'balanceOf', 'lines', 'nextNo', 'record', 'reverse'];
for (const [name, m] of engines) t(`${name}: exports ${NAMES.join(', ')}`, NAMES.every(k => k in m) && (typeof m.PAY_METHODS === 'object') && NAMES.slice(1).every(k => typeof m[k] === 'function'), Object.keys(m).join(','));

/* each case: a name, a function of the engine, the expected answer (or a test function). Run on both engines. */
const cases = [];
const eq = (name, fn, want) => cases.push({ name, fn, test: got => canon(got) === canon(want), want });
const ok = (name, fn, test) => cases.push({ name, fn, test });

const P1 = { id: 'p1', no: 'R-202610-001', at: '2026-10-05', recordedAt: '2026-10-05T09:00:00.000Z', amount: 3000, method: 'cash', by: 'Desk' };
const P2 = { id: 'p2', no: 'R-202610-002', at: '2026-10-07', recordedAt: '2026-10-07T09:00:00.000Z', amount: 2000, method: 'card', by: 'Desk' };
const P3 = { id: 'p3', no: 'R-202610-003', at: '2026-10-07', recordedAt: '2026-10-07T15:30:00.000Z', amount: 500, method: 'bank', by: 'Owner', note: 'Second visit' };
const R1 = { id: 'r1', no: '', at: '2026-10-08', recordedAt: '2026-10-08T10:00:00.000Z', amount: 3000, method: 'cash', by: 'Owner', reverses: 'p1', op: 'op-r1' };
const J1 = () => ({ approved: 10000, payments: [{ ...P1 }, { ...P2 }] });
const J2 = () => ({ approved: 10000, payments: [{ ...P1 }, { ...P2 }, { ...R1 }] });
const CTX = { by: 'Desk', now: '2026-10-18T05:00:00.000Z', today: '2026-10-18', id: 'p9', no: 'R-202610-003' };
const RCTX = { by: 'Owner', now: '2026-10-18T06:00:00.000Z', today: '2026-10-18', id: 'r9' };
const IN = { amount: 1500, method: 'bank', at: '2026-10-18' };
const reason = r => r && r.ok === false ? r.reason : 'not refused: ' + short(r);

/* rule 1: paid */
eq('paidOf an empty job is 0', m => m.paidOf({}), 0);
eq('paidOf null is 0 (no crash)', m => m.paidOf(null), 0);
eq('paidOf two payments is 5000', m => m.paidOf(J1()), 5000);
eq('paidOf after a reversal of 3000 is 2000', m => m.paidOf(J2()), 2000);
eq('paidOf payments that are not a list is 0', m => m.paidOf({ payments: 'x' }), 0);
eq('paidOf counts a line with a broken amount as 0, never NaN', m => m.paidOf({ payments: [{ ...P1, amount: 'abc' }, P2, { ...P3, amount: NaN }] }), 2000);
/* rule 2: balance */
eq('balanceOf two payments on 10000 approved is 5000', m => m.balanceOf(J1()), 5000);
eq('balanceOf after a reversal is 8000', m => m.balanceOf(J2()), 8000);
eq('balanceOf with no approved uses the balance the server sent (desk)', m => m.balanceOf({ balance: 4200, payments: [P1] }), 4200);
eq('balanceOf with neither approved nor balance is 0', m => m.balanceOf({ payments: [P1] }), 0);
eq('balanceOf with approved NaN falls to the balance', m => m.balanceOf({ approved: NaN, balance: 300 }), 300);
eq('balanceOf with approved NaN and no balance is 0', m => m.balanceOf({ approved: NaN }), 0);
eq('balanceOf with approved as text is 0', m => m.balanceOf({ approved: '5000' }), 0);
eq('balanceOf: approved wins over a sent balance', m => m.balanceOf({ approved: 10000, balance: 1, payments: [] }), 10000);
eq('balanceOf null is 0', m => m.balanceOf(null), 0);
/* rule 3: lines */
eq('lines: newest first, the reversed one carries reversedBy, the reversal is left out', m => m.lines(J2()), [P2, { ...P1, reversedBy: 'r1' }]);
ok('lines: a payment never reversed has no reversedBy key', m => m.lines(J2()), got => Array.isArray(got) && got[0] && !('reversedBy' in got[0]));
eq('lines: same day, the later recordedAt comes first', m => m.lines({ payments: [P1, P2, P3] }), [P3, P2, P1]);
eq('lines of a job with no payments is an empty list', m => m.lines({}), []);
ok('lines does not change the job it was given', m => { const j = J2(); m.lines(j); return j; }, got => canon(got) === canon(J2()));
/* rule 4: receipt numbers */
eq('nextNo with no jobs is R-202610-001', m => m.nextNo([], '2026-10-18'), 'R-202610-001');
const other = { payments: [{ ...P1, id: 'q1', no: 'R-202610-003' }, { ...P1, id: 'q2', no: 'R-202609-001', at: '2026-09-20' }, { ...R1, id: 'q3' }] };
eq('nextNo counts across two jobs (2 + 1 in October, the reversal not counted)', m => m.nextNo([J2(), other], '2026-10-18'), 'R-202610-004');
eq('nextNo for September counts only September', m => m.nextNo([J2(), other], '2026-09-30'), 'R-202609-002');
eq('nextNo for a new month starts at 001', m => m.nextNo([J2(), other], '2026-11-01'), 'R-202611-001');
eq('nextNo skips jobs with no list and null entries', m => m.nextNo([null, { payments: 'x' }, {}, J1()], '2026-10-02'), 'R-202610-003');
/* rule 5: record */
eq('record: a good payment is appended with every field', m => m.record(J1(), { ...IN, note: '  Paid at the counter  ' }, { ...CTX, op: 'op-1' }),
  { ok: true, payments: [P1, P2, { id: 'p9', no: 'R-202610-003', at: '2026-10-18', recordedAt: '2026-10-18T05:00:00.000Z', amount: 1500, method: 'bank', by: 'Desk', note: 'Paid at the counter', op: 'op-1' }] });
ok('record does not change the job it was given', m => { const j = J1(); m.record(j, IN, CTX); return j; }, got => canon(got) === canon(J1()));
ok('record with no op and no note leaves both keys out', m => m.record(J1(), IN, CTX), got => got && got.ok === true && got.payments.length === 3 && !('op' in got.payments[2]) && !('note' in got.payments[2]));
const AMT = 'The amount must be a whole number of rupees above 0';
eq('record amount 0 is refused', m => reason(m.record(J1(), { ...IN, amount: 0 }, CTX)), AMT);
eq('record amount 1.5 is refused', m => reason(m.record(J1(), { ...IN, amount: 1.5 }, CTX)), AMT);
eq('record amount as text is refused', m => reason(m.record(J1(), { ...IN, amount: '1500' }, CTX)), AMT);
eq('record a negative amount is refused', m => reason(m.record(J1(), { ...IN, amount: -5 }, CTX)), AMT);
eq('record amount NaN is refused', m => reason(m.record(J1(), { ...IN, amount: NaN }, CTX)), AMT);
eq('record an amount and a method both wrong: the amount reason comes first', m => reason(m.record(J1(), { ...IN, amount: 0, method: 'gold' }, CTX)), AMT);
eq('record an unknown method is refused', m => reason(m.record(J1(), { ...IN, method: 'crypto' }, CTX)), 'Choose how they paid');
eq('record a date that does not exist is refused', m => reason(m.record(J1(), { ...IN, at: '2026-02-30' }, CTX)), 'Choose the date they paid');
eq('record a date in another shape is refused', m => reason(m.record(J1(), { ...IN, at: '18/10/2026' }, CTX)), 'Choose the date they paid');
eq('record with no date is refused', m => reason(m.record(J1(), { amount: 100, method: 'cash' }, CTX)), 'Choose the date they paid');
eq('record a date after today is refused', m => reason(m.record(J1(), { ...IN, at: '2026-10-19' }, CTX)), 'The date cannot be in the future');
eq('record more than still owed is refused with the amount in plain digits', m => reason(m.record({ approved: 17500, payments: [] }, { ...IN, amount: 17501 }, CTX)), 'That is more than the 17500 still owed on this car');
eq('record more than the 5000 still owed is refused', m => reason(m.record(J1(), { ...IN, amount: 5001 }, CTX)), 'That is more than the 5000 still owed on this car');
ok('record exactly the balance is allowed', m => m.record(J1(), { ...IN, amount: 5000 }, CTX), got => got && got.ok === true && got.payments.length === 3);
ok('record after a reversal: the full 8000 is allowed', m => m.record(J2(), { ...IN, amount: 8000 }, CTX), got => got && got.ok === true && got.payments.length === 4);
eq('record after a reversal: 8001 is refused', m => reason(m.record(J2(), { ...IN, amount: 8001 }, CTX)), 'That is more than the 8000 still owed on this car');
eq('record on a desk view job uses the balance sent', m => reason(m.record({ balance: 2000, payments: [] }, { ...IN, amount: 2001 }, CTX)), 'That is more than the 2000 still owed on this car');
eq('record on a job with no approved total is refused against 0', m => reason(m.record({ payments: [] }, { ...IN, amount: 1 }, CTX)), 'That is more than the 0 still owed on this car');
ok('record a dated payment from earlier in the month is allowed', m => m.record(J1(), { ...IN, at: '2026-10-01' }, CTX), got => got && got.ok === true && got.payments[2].at === '2026-10-01');
ok('record cuts a note to 200 characters', m => m.record(J1(), { ...IN, note: 'n'.repeat(250) }, CTX), got => got && got.ok === true && got.payments[2].note === 'n'.repeat(200));
ok('record leaves out a note of spaces', m => m.record(J1(), { ...IN, note: '    ' }, CTX), got => got && got.ok === true && !('note' in got.payments[2]));
ok('record leaves out a note that is not text', m => m.record(J1(), { ...IN, note: 123 }, CTX), got => got && got.ok === true && !('note' in got.payments[2]));
const withOp = () => ({ approved: 10000, payments: [P1, P2, { ...P3, op: 'op-7' }] });
eq('record replay: the same op records nothing twice, even when it would now be over the balance', m => m.record(withOp(), { ...IN, amount: 9000 }, { ...CTX, op: 'op-7' }), { ok: true, payments: withOp().payments });
ok('record with another op still records', m => m.record(withOp(), IN, { ...CTX, op: 'op-8' }), got => got && got.ok === true && got.payments.length === 4 && got.payments[3].op === 'op-8');
/* rule 6: reverse */
eq('reverse: appends the correction pointing at the payment, full amount, its method, today', m => m.reverse(J1(), 'p1', { ...RCTX, op: 'op-r' }),
  { ok: true, payments: [P1, P2, { id: 'r9', no: '', at: '2026-10-18', recordedAt: '2026-10-18T06:00:00.000Z', amount: 3000, method: 'cash', by: 'Owner', reverses: 'p1', op: 'op-r' }] });
ok('reverse with no op leaves the op key out', m => m.reverse(J1(), 'p2', RCTX), got => got && got.ok === true && !('op' in got.payments[2]) && got.payments[2].method === 'card');
ok('reverse does not change the job it was given', m => { const j = J1(); m.reverse(j, 'p1', RCTX); return j; }, got => canon(got) === canon(J1()));
eq('reverse a payment that does not exist', m => reason(m.reverse(J1(), 'nope', RCTX)), 'No such payment');
eq('reverse a reversal is refused', m => reason(m.reverse(J2(), 'r1', RCTX)), 'A correction cannot itself be corrected');
eq('reverse the same payment a second time is refused', m => reason(m.reverse(J2(), 'p1', RCTX)), 'This payment is already corrected');
eq('reverse replay: the same op records nothing twice', m => m.reverse(J2(), 'p2', { ...RCTX, op: 'op-r1' }), { ok: true, payments: J2().payments });
ok('paid and balance after a reverse result', m => { const r = m.reverse(J1(), 'p2', RCTX); return [m.paidOf({ approved: 10000, payments: r.payments }), m.balanceOf({ approved: 10000, payments: r.payments })]; }, got => canon(got) === canon([3000, 7000]));
eq('reverse on a job with no payments', m => reason(m.reverse({}, 'p1', RCTX)), 'No such payment');

for (const c of cases) {
  const got = engines.map(([name, m]) => { try { return [name, c.fn(m)]; } catch (e) { return [name, { threw: String(e && e.message || e).slice(0, 120) }]; } });
  for (const [name, g] of got) t(`${name}: ${c.name}`, c.test(g), c.test(g) ? '' : 'got ' + short(g) + (c.want !== undefined ? ' want ' + short(c.want) : ''));
  if (got.length === 2) t(`same on both: ${c.name}`, canon(got[0][1]) === canon(got[1][1]), canon(got[0][1]) === canon(got[1][1]) ? '' : short(got[0][1]) + ' vs ' + short(got[1][1]));
}
if (engines.length < 2) t('both engines ran every case', false, engines.map(e => e[0]).join(',') || 'none');

/* the web copy is strict TypeScript; the server copy carries the same types as JSDoc */
if (existsSync(TS)) {
  const tsc = join(base, 'node_modules', '.bin', 'tsc');
  const r = spawnSync(tsc, ['--noEmit', '--strict', '--target', 'es2022', '--module', 'es2022', '--moduleResolution', 'bundler', TS], { encoding: 'utf8' });
  t('payments.ts passes tsc --strict', r.status === 0, (r.stdout || r.stderr || '').trim().slice(0, 200));
  const src = readFileSync(TS, 'utf8');
  t("payments.ts declares PayMethod as 'cash' | 'card' | 'bank' | 'cheque'", /type\s+PayMethod\s*=\s*'cash'\s*\|\s*'card'\s*\|\s*'bank'\s*\|\s*'cheque'/.test(src));
  t('payments.ts declares interface Payment', /interface\s+Payment\b/.test(src));
  t('payments.ts imports nothing (pure)', !/^\s*import\s/m.test(src));
} else t('payments.ts exists', false);
if (existsSync(JS)) {
  const src = readFileSync(JS, 'utf8');
  t('payments.js carries the types as JSDoc (@typedef PayMethod and Payment)', /@typedef\s+\{.*?\}\s+PayMethod\b/s.test(src) && /@typedef\s+\{.*?\}\s+Payment\b/s.test(src));
  t('payments.js imports nothing (pure)', !/^\s*import\s/m.test(src));
} else t('payments.js exists', false);
/* house style reaches comments too: no em or en dash in either copy (added 18 Oct after PA2 try 1 wrote one) */
for (const f of [TS, JS]) if (existsSync(f)) t(`${f.split('/').pop()} carries no em or en dash`, !/[\u2013\u2014]/.test(readFileSync(f, 'utf8')));

console.log(rows.join('\n')); console.log(`P1: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}`); process.exit(bad ? 1 : 0);
