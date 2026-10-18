// P2 (payments part A, rules 7 to 10): the server records and corrects payments through two commands, shows money per
// seat and refuses money fields on the generic job writes. Real route handlers, memory store, synthetic data, no network.
//   owner: records and corrects, sees everything as before (estimate, approved, legacy paid, payments)
//   desk:  records only, sees the payment lines and a balance worked out on the server, never estimate, approved or paid
//   staff: no money at all;  customer: approved total and payment lines, never the estimate or legacy paid
// Written by Claude BEFORE the crew ran, 18 Oct 2026.   node --no-warnings mould/parts/PAY/p2-check.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { imp, t, safe, done, req, call, SLUG, seats, A_PHONE, B_PHONE } from '../API/harness.mjs';
/* a synthetic workshop on disk for sign in: clients.js reads ../../casts from the working directory when it loads */
const TMP = mkdtempSync(join(tmpdir(), 'wos-pay-')); mkdirSync(join(TMP, 'casts')); mkdirSync(join(TMP, 'apps', 'api'), { recursive: true });
writeFileSync(join(TMP, 'casts', SLUG + '.json'), JSON.stringify({ slug: SLUG, name: 'Check Garage', users: [
  { name: 'Owner', pin: '1111', role: 'owner', branch: 'one' }, { name: 'Desk', pin: '2222', role: 'desk', branch: 'one' }, { name: 'Staffer', pin: '3333', role: 'staff', branch: 'one' }] }));
process.chdir(join(TMP, 'apps', 'api'));
const { store } = await imp('lib/store.js'); const { issue } = await imp('lib/auth.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js'), list = await imp('app/api/[slug]/[table]/route.js');
const login = (await imp('app/api/login/route.js')).POST;
const desk = { kind: 'staff', name: 'Desk', role: 'desk', branch: 'one' };
const tk = { ...Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)])), desk: issue(SLUG, desk) };
let pay = null, rev = null, cmds = null;
await safe('the payments route exists', async () => { pay = await imp('app/api/[slug]/[table]/[id]/payments/route.js'); t('payments route loads with a POST', typeof pay.POST === 'function'); });
await safe('the reverse route exists', async () => { rev = await imp('app/api/[slug]/[table]/[id]/payments/[pid]/reverse/route.js'); t('reverse route loads with a POST', typeof rev.POST === 'function'); });
await safe('the commands exist', async () => { cmds = await imp('lib/commands.js'); t('commands.js exports recordPayment and reversePayment', typeof cmds.recordPayment === 'function' && typeof cmds.reversePayment === 'function'); });

/* dates in Colombo (UTC+5:30, no summer time), the way the server must read today */
const colombo = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
const TODAY = colombo(Date.now()), FUTURE = colombo(Date.now() + 2 * 86400000);
const ym = d => d.slice(0, 4) + d.slice(5, 7);
const PREV = (() => { const y = +TODAY.slice(0, 4), m = +TODAY.slice(5, 7); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return `${py}-${String(pm).padStart(2, '0')}-15`; })();
const MSG = 'Payments are recorded through Record payment', SEAT = 'This seat cannot do that.';

const mk = (id, over = {}) => store.create(SLUG, 'jobs', { id, plate: 'PAY-' + id, customerPhone: A_PHONE, branch: 'one', status: 'open', estimate: 12000, approved: 10000, paid: 500, phases: [], approvals: [], ...over });
await mk('jP'); await mk('jQ', { approved: 5000, paid: 0 }); await mk('jB', { customerPhone: B_PHONE }); await mk('jV');
const get = id => store.get(SLUG, 'jobs', id);
const lines = async id => (await get(id)).payments || [];
const P = (id, body, who, extra) => call(pay.POST, req('POST', `/api/${SLUG}/jobs/${id}/payments`, who ? tk[who] : null, body, extra), { slug: SLUG, table: 'jobs', id });
const R = (id, pid, who, extra) => call(rev.POST, req('POST', `/api/${SLUG}/jobs/${id}/payments/${pid}/reverse`, who ? tk[who] : null, {}, extra), { slug: SLUG, table: 'jobs', id, pid });
const payActs = async id => (await store.list(SLUG, 'activities')).filter(a => a.jobId === id && a.type === 'payment');
const has = (o, k) => !!o && typeof o === 'object' && k in o;
const keys = o => o && typeof o === 'object' ? Object.keys(o).filter(k => ['estimate', 'approved', 'paid', 'payments', 'balance'].includes(k)).join(',') || 'none' : String(o);

let ownerPid = null, deskPid = null;
if (pay) await safe('record a payment', async () => {
  let r = await P('jP', { amount: 3000, method: 'cash', at: TODAY, note: '  Cash at the counter ' }, 'owner');
  t('owner records 3000 cash: 200', r.status === 200, r.status + ' ' + JSON.stringify(r.json).slice(0, 160));
  let L = await lines('jP'); const a = L[0] || {}; ownerPid = a.id;
  t('one line stored with the number R-' + ym(TODAY) + '-001', L.length === 1 && a.no === `R-${ym(TODAY)}-001`, JSON.stringify(a));
  t('the line carries amount, method, date, the seat name and a trimmed note', a.amount === 3000 && a.method === 'cash' && a.at === TODAY && a.by === 'Owner' && a.note === 'Cash at the counter' && typeof a.id === 'string' && a.id.length > 0, JSON.stringify(a));
  t('recordedAt is an ISO time and there is no reverses key', typeof a.recordedAt === 'string' && !isNaN(Date.parse(a.recordedAt)) && a.recordedAt.includes('T') && !('reverses' in a));
  t('the owner reply carries the money as before plus the lines', r.json?.estimate === 12000 && r.json?.approved === 10000 && r.json?.paid === 500 && r.json?.payments?.length === 1, keys(r.json));
  t('the stored legacy paid is untouched', (await get('jP')).paid === 500);
  r = await P('jP', { amount: 2000, method: 'card', at: TODAY }, 'desk');
  t('desk records 2000 card: 200', r.status === 200, r.status + ' ' + JSON.stringify(r.json).slice(0, 160));
  L = await lines('jP'); deskPid = L[1]?.id;
  t('the second number is -002 and the line is by Desk', L.length === 2 && L[1].no === `R-${ym(TODAY)}-002` && L[1].by === 'Desk', JSON.stringify(L[1]));
  t('the desk reply has the lines and a balance of 5000, no estimate, approved or paid', r.json?.balance === 5000 && r.json?.payments?.length === 2 && !has(r.json, 'estimate') && !has(r.json, 'approved') && !has(r.json, 'paid'), keys(r.json) + ' balance ' + r.json?.balance);
  r = await P('jQ', { amount: 1000, method: 'bank', at: TODAY }, 'desk');
  t('numbering runs across jobs: jQ gets -003', r.status === 200 && (await lines('jQ'))[0]?.no === `R-${ym(TODAY)}-003`, JSON.stringify(await lines('jQ')));
  r = await P('jQ', { amount: 500, method: 'cheque', at: PREV }, 'owner');
  t('a payment dated last month starts that month at 001', r.status === 200 && (await lines('jQ'))[1]?.no === `R-${ym(PREV)}-001`, JSON.stringify((await lines('jQ'))[1]));
  const acts = await payActs('jP');
  t('each payment wrote one activity line', acts.length === 2, String(acts.length));
  t("the activity reads 'Payment recorded (R-...)' with the seat name", acts.some(x => x.summary === `Payment recorded (R-${ym(TODAY)}-001)` && x.by === 'Owner') && acts.some(x => x.summary === `Payment recorded (R-${ym(TODAY)}-002)` && x.by === 'Desk'), acts.map(x => x.summary + '/' + x.by).join('; '));
  t('no activity line carries an amount', (await store.list(SLUG, 'activities')).filter(x => x.type === 'payment').every(x => !/3000|2000|1000|500/.test(x.summary)));
});
if (pay) await safe('refusals on record', async () => {
  const before = JSON.stringify(await lines('jP')), nActs = (await payActs('jP')).length;
  const same = async () => JSON.stringify(await lines('jP')) === before && (await payActs('jP')).length === nActs;
  let r = await P('jP', { amount: 100, method: 'cash', at: TODAY }, 'staff');
  t("plain staff is refused 403 'This seat cannot do that.'", r.status === 403 && r.json?.error === SEAT && await same(), r.status + ' ' + JSON.stringify(r.json));
  r = await P('jP', { amount: 100, method: 'cash', at: TODAY }, 'custA'); t('a customer is refused 403', r.status === 403 && await same(), String(r.status));
  r = await P('jP', { amount: 100, method: 'cash', at: TODAY }, null); t('no session is refused 401', r.status === 401 && await same(), String(r.status));
  r = await P('jP', { amount: 5001, method: 'cash', at: TODAY }, 'desk');
  t('more than owed is refused 400 with the words', r.status === 400 && r.json?.error === 'That is more than the 5000 still owed on this car' && await same(), r.status + ' ' + JSON.stringify(r.json));
  r = await P('jP', { amount: 0, method: 'cash', at: TODAY }, 'desk');
  t('amount 0 is refused 400 with the words', r.status === 400 && r.json?.error === 'The amount must be a whole number of rupees above 0' && await same(), JSON.stringify(r.json));
  r = await P('jP', { amount: 100, method: 'gold', at: TODAY }, 'owner'); t("an unknown method: 400 'Choose how they paid'", r.status === 400 && r.json?.error === 'Choose how they paid' && await same(), JSON.stringify(r.json));
  r = await P('jP', { amount: 100, method: 'cash', at: '2026-13-01' }, 'owner'); t("a date that does not exist: 400 'Choose the date they paid'", r.status === 400 && r.json?.error === 'Choose the date they paid' && await same(), JSON.stringify(r.json));
  r = await P('jP', { amount: 100, method: 'cash', at: FUTURE }, 'owner'); t("a future date: 400 'The date cannot be in the future'", r.status === 400 && r.json?.error === 'The date cannot be in the future' && await same(), JSON.stringify(r.json));
  r = await P('jP', 'not an object', 'owner'); t('a body that is not an object is refused 400', r.status === 400 && await same(), String(r.status));
  r = await call(pay.POST, req('POST', `/api/${SLUG}/photos/x/payments`, tk.owner, { amount: 1, method: 'cash', at: TODAY }), { slug: SLUG, table: 'photos', id: 'x' }); t('only jobs take payments (404)', r.status === 404, String(r.status));
  r = await P('nojob', { amount: 1, method: 'cash', at: TODAY }, 'owner'); t('a missing job is 404', r.status === 404, String(r.status));
  r = await P('jP', { amount: 100, method: 'cash', at: TODAY }, 'owner', { 'x-check-raw': '1' }); t('a staff save with no version is refused 428', r.status === 428 && await same(), String(r.status));
  const v0 = (await get('jV')).updatedAt; await call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/jV`, tk.owner, { notes: 'moved on' }), { slug: SLUG, table: 'jobs', id: 'jV' });
  r = await P('jV', { amount: 100, method: 'cash', at: TODAY }, 'owner', { 'x-wos-version': v0 }); t('a save on an old version is refused 409', r.status === 409 && (await lines('jV')).length === 0, String(r.status));
});
if (pay) await safe('a replayed op records once', async () => {
  const body = { amount: 250, method: 'cash', at: TODAY };
  const v0 = (await get('jV')).updatedAt;
  let r = await P('jV', body, 'desk', { 'x-wos-op': 'op-check-1' }); t('the first send answers 200', r.status === 200, String(r.status));
  t('the line carries the op', (await lines('jV'))[0]?.op === 'op-check-1', JSON.stringify(await lines('jV')));
  r = await P('jV', body, 'desk', { 'x-wos-op': 'op-check-1' }); t('the same op again answers 200', r.status === 200, String(r.status));
  t('and stores nothing twice', (await lines('jV')).length === 1 && (await payActs('jV')).length === 1, String((await lines('jV')).length));
  r = await P('jV', body, 'desk', { 'x-wos-op': 'op-check-1', 'x-wos-version': v0 }); t('the same op from the outbox with the old version answers 200 and stores nothing', r.status === 200 && (await lines('jV')).length === 1, String(r.status));
  r = await P('jV', body, 'desk', { 'x-wos-op': 'op-check-2' }); t('a new op records a second line', r.status === 200 && (await lines('jV')).length === 2);
});
let revId = null;
if (pay && rev) await safe('correct a payment', async () => {
  const before = JSON.stringify(await lines('jP'));
  let r = await R('jP', ownerPid, 'desk'); t("desk cannot correct: 403 'This seat cannot do that.'", r.status === 403 && r.json?.error === SEAT && JSON.stringify(await lines('jP')) === before, r.status + ' ' + JSON.stringify(r.json));
  r = await R('jP', ownerPid, 'staff'); t('plain staff cannot correct: 403', r.status === 403 && JSON.stringify(await lines('jP')) === before, String(r.status));
  r = await R('jP', ownerPid, 'custA'); t('a customer cannot correct: 403', r.status === 403, String(r.status));
  r = await R('jP', ownerPid, 'owner', { 'x-check-raw': '1' }); t('a correction with no version is refused 428', r.status === 428 && JSON.stringify(await lines('jP')) === before, String(r.status));
  r = await R('jP', ownerPid, 'owner', { 'x-wos-op': 'op-rev-1' }); t('the owner corrects the 3000: 200', r.status === 200, r.status + ' ' + JSON.stringify(r.json).slice(0, 160));
  const L = await lines('jP'); const c = L[2] || {}; revId = c.id;
  t('the correction points at the payment, full amount, its method, no number, today, by Owner', L.length === 3 && c.reverses === ownerPid && c.amount === 3000 && c.method === 'cash' && c.no === '' && c.at === TODAY && c.by === 'Owner' && c.op === 'op-rev-1', JSON.stringify(c));
  t('the original line is kept unchanged (append only)', JSON.stringify(L.slice(0, 2)) === before);
  r = await R('jP', ownerPid, 'owner', { 'x-wos-op': 'op-rev-1' }); t('the same correction op again stores nothing twice', r.status === 200 && (await lines('jP')).length === 3, String(r.status));
  r = await R('jP', ownerPid, 'owner'); t("a second correction: 409 'This payment is already corrected'", r.status === 409 && r.json?.error === 'This payment is already corrected' && (await lines('jP')).length === 3, r.status + ' ' + JSON.stringify(r.json));
  r = await R('jP', revId, 'owner'); t("correcting a correction: 409 'A correction cannot itself be corrected'", r.status === 409 && r.json?.error === 'A correction cannot itself be corrected', r.status + ' ' + JSON.stringify(r.json));
  r = await R('jP', 'nope', 'owner'); t("a payment that does not exist: 404 'No such payment'", r.status === 404 && r.json?.error === 'No such payment', r.status + ' ' + JSON.stringify(r.json));
  const acts = await payActs('jP');
  t("one activity 'Payment corrected' by Owner, no amount", acts.filter(x => x.summary === 'Payment corrected' && x.by === 'Owner').length === 1, acts.map(x => x.summary).join('; '));
  const g = await call(item.GET, req('GET', `/api/${SLUG}/jobs/jP`, tk.desk), { slug: SLUG, table: 'jobs', id: 'jP' });
  t('after the correction the desk sees a balance of 8000', g.json?.balance === 8000, String(g.json?.balance));
  r = await P('jP', { amount: 8000, method: 'bank', at: TODAY }, 'desk'); t('and can now record the full 8000', r.status === 200 && r.json?.balance === 0, r.status + ' ' + r.json?.balance);
});
await safe('what each seat sees', async () => {
  const G = who => call(item.GET, req('GET', `/api/${SLUG}/jobs/jP`, tk[who]), { slug: SLUG, table: 'jobs', id: 'jP' });
  const LS = async who => ((await call(list.GET, req('GET', `/api/${SLUG}/jobs`, tk[who]), { slug: SLUG, table: 'jobs' })).json || []).find(j => j.id === 'jP');
  const stored = await get('jP'); const n = (stored.payments || []).length;
  for (const [how, f] of [['GET one', G], ['the list', LS]]) {
    const o = how === 'GET one' ? (await f('owner')).json : await f('owner');
    t(`owner (${how}): estimate, approved, legacy paid and the lines, no balance key`, o?.estimate === 12000 && o?.approved === 10000 && o?.paid === 500 && (o?.payments || []).length === n && n > 0 && !has(o, 'balance'), keys(o));
    const d = how === 'GET one' ? (await f('desk')).json : await f('desk');
    t(`desk (${how}): lines and the balance only`, !!d && !has(d, 'estimate') && !has(d, 'approved') && !has(d, 'paid') && (d.payments || []).length === n && typeof d.balance === 'number', keys(d));
    const s = how === 'GET one' ? (await f('staff')).json : await f('staff');
    t(`plain staff (${how}): no money at all`, !!s && s.id === 'jP' && ['estimate', 'approved', 'paid', 'payments', 'balance'].every(k => !has(s, k)), keys(s));
    const c = how === 'GET one' ? (await f('custA')).json : await f('custA');
    t(`customer (${how}): approved total and the lines, never the estimate or legacy paid`, !!c && c.approved === 10000 && (c.payments || []).length === n && !has(c, 'estimate') && !has(c, 'paid'), keys(c));
  }
  const dq = (await call(item.GET, req('GET', `/api/${SLUG}/jobs/jQ`, tk.desk), { slug: SLUG, table: 'jobs', id: 'jQ' })).json;
  t('desk balance on jQ is 5000 less 1500 recorded', dq?.balance === 3500, String(dq?.balance));
  const db = (await call(item.GET, req('GET', `/api/${SLUG}/jobs/jB`, tk.desk), { slug: SLUG, table: 'jobs', id: 'jB' })).json;
  t('desk balance on a job with no payments is the approved total', db?.balance === 10000, String(db?.balance));
  t("customer B still cannot open customer A's job", (await call(item.GET, req('GET', `/api/${SLUG}/jobs/jP`, tk.custB), { slug: SLUG, table: 'jobs', id: 'jP' })).status === 404);
  t('the stored job never gains a balance field', !has(await get('jP'), 'balance'));
});
await safe('the generic writes refuse money lines', async () => {
  const before = JSON.stringify(await get('jQ'));
  const PA = (who, body) => call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/jQ`, tk[who], body), { slug: SLUG, table: 'jobs', id: 'jQ' });
  const PO = (who, body) => call(list.POST, req('POST', `/api/${SLUG}/jobs`, tk[who], { plate: 'NEW-' + who, branch: 'one', status: 'open', phases: [], approvals: [], ...body }), { slug: SLUG, table: 'jobs' });
  for (const [who, body] of [['owner', { payments: [] }], ['owner', { paid: 9000 }], ['desk', { balance: 0 }], ['desk', { payments: [{ id: 'x', amount: 1 }] }], ['staff', { paid: 1 }], ['custA', { paid: 1 }]]) {
    const r = await PA(who, body); t(`PATCH from ${who} with ${Object.keys(body)[0]}: 400 '${MSG}'`, r.status === 400 && r.json?.error === MSG, r.status + ' ' + JSON.stringify(r.json));
  }
  t('none of those changed the job', JSON.stringify(await get('jQ')) === before);
  for (const [who, body] of [['owner', { payments: [] }], ['owner', { paid: 0 }], ['staff', { balance: 5 }], ['desk', { payments: [] }]]) {
    const r = await PO(who, body); t(`POST a job from ${who} with ${Object.keys(body)[0]}: 400 '${MSG}'`, r.status === 400 && r.json?.error === MSG, r.status + ' ' + JSON.stringify(r.json));
  }
  t('no job was created by those', !(await store.list(SLUG, 'jobs')).some(j => String(j.plate).startsWith('NEW-')));
  let r = await PA('owner', { notes: 'still fine' }); t('an owner PATCH without money still saves (200)', r.status === 200 && (await get('jQ')).notes === 'still fine', String(r.status));
  r = await PO('desk', {}); t('a desk seat can still book a car in (201) and gets no estimate back', r.status === 201 && !has(r.json, 'estimate'), r.status + ' ' + keys(r.json));
});
await safe('sign in as desk', async () => {
  const L = body => login(req('POST', '/api/login', null, { slug: SLUG, ...body }));
  const res = await L({ name: 'Desk', pin: '2222' }); const j = await res.json().catch(() => null);
  t('a desk user signs in (200) and the answer says desk', res.status === 200 && j?.role === 'desk' && typeof j?.token === 'string', res.status + ' ' + JSON.stringify(j && { role: j.role }));
  const body = j?.token ? JSON.parse(Buffer.from(j.token.split('.')[0], 'base64url').toString()) : {};
  t('the token carries kind staff and role desk', body.kind === 'staff' && body.role === 'desk' && body.name === 'Desk', JSON.stringify({ kind: body.kind, role: body.role }));
  const s = await (await L({ name: 'Staffer', pin: '3333' })).json().catch(() => null);
  t('a plain staff user still signs in with role staff', s?.role === 'staff');
  if (pay && j?.token) {
    const r = await call(pay.POST, req('POST', `/api/${SLUG}/jobs/jB/payments`, j.token, { amount: 100, method: 'cash', at: TODAY }), { slug: SLUG, table: 'jobs', id: 'jB' });
    t('the signed in desk token records a payment', r.status === 200 && r.json?.balance === 9900, r.status + ' ' + JSON.stringify(r.json).slice(0, 120));
  }
});
if (cmds) await safe('the commands read today in Colombo', async () => {
  const job = { id: 'u1', approved: 1000, payments: [] };
  const a = cmds.recordPayment(job, [job], { amount: 100, method: 'cash', at: '2026-10-19' }, desk, '2026-10-18T20:00:00.000Z', 'pu1');
  t('at 01:30 on the 19th in Colombo (20:00 UTC the 18th) the 19th is today', a && a.patch && a.patch.payments?.[0]?.at === '2026-10-19' && a.patch.payments[0].no === 'R-202610-001' && a.patch.payments[0].id === 'pu1', JSON.stringify(a).slice(0, 200));
  const b = cmds.recordPayment(job, [job], { amount: 100, method: 'cash', at: '2026-10-19' }, desk, '2026-10-18T18:00:00.000Z', 'pu2');
  t('at 23:30 on the 18th in Colombo the 19th is the future', b && b.status === 400 && b.error === 'The date cannot be in the future', JSON.stringify(b));
  t('the activity of a record names the number and no amount', a && a.activity && a.activity.summary === 'Payment recorded (R-202610-001)' && a.activity.type === 'payment' && a.activity.jobId === 'u1' && a.activity.by === 'Desk', JSON.stringify(a && a.activity));
  t('recordPayment does not change the job it was given', job.payments.length === 0);
  const c = cmds.reversePayment({ id: 'u1', approved: 1000, payments: a.patch.payments }, 'pu1', seats.owner, '2026-10-18T20:00:00.000Z', 'ru1');
  t('reversePayment dates the correction today in Colombo and says Payment corrected', c && c.patch && c.patch.payments?.[1]?.at === '2026-10-19' && c.patch.payments[1].reverses === 'pu1' && c.activity?.summary === 'Payment corrected', JSON.stringify(c).slice(0, 200));
  t('recordPayment refuses plain staff with the words', cmds.recordPayment(job, [job], { amount: 1, method: 'cash', at: '2026-10-18' }, seats.staff, '2026-10-18T05:00:00.000Z', 'x')?.error === SEAT);
  t('reversePayment refuses desk with the words', cmds.reversePayment(job, 'pu1', desk, '2026-10-18T05:00:00.000Z', 'x')?.error === SEAT);
  const rp = cmds.recordPayment({ id: 'u1', approved: 1000, payments: [{ ...a.patch.payments[0], op: 'o1' }] }, [], { amount: 100, method: 'cash', at: '2026-10-18' }, desk, '2026-10-18T05:00:00.000Z', 'x', 'o1');
  t('a replayed op gives no patch', rp && rp.patch === null && !rp.error, JSON.stringify(rp).slice(0, 160));
});
done('P2');
