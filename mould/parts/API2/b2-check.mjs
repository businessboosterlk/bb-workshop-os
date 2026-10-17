// B2 (audit E04): closing a phase is a server command. Staff only; only the job's 'now' phase; only with a stored photo
// of the same job and the same phase key. It marks the phase done (doneAt, by from the session), starts the next or
// makes the job ready, and writes the activity in the same request. The generic PATCH refuses phases and status from
// staff (the ready to delivered handover stays). Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API2/b2-check.mjs
import { imp, t, safe, done, req, call, SLUG, seats, A_PHONE } from '../API/harness.mjs';
import { loadData, makeService, fakeFetch, bridge } from './webharness.mjs';
const { store } = await imp('lib/store.js'); const { issue } = await imp('lib/auth.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js'), list = await imp('app/api/[slug]/[table]/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const T0 = '2026-10-01T08:00:00.000Z';
const ph = (key, status, extra = {}) => ({ key, label: key[0].toUpperCase() + key.slice(1), hours: 4, status, ...extra });
const mkJob = (id, over = {}) => store.create(SLUG, 'jobs', { id, plate: 'CAB-' + id, customerPhone: A_PHONE, branch: 'one', status: 'open', estimate: 9000, approved: 0, paid: 0, approvals: [],
  pickup: { wanted: true, status: 'collected' }, phases: [ph('body', 'now', { startedAt: T0 }), ph('paint', 'next'), ph('ready', 'next')], ...over });
const photo = (id, jobId, phaseKey) => store.create(SLUG, 'photos', { id, jobId, phaseKey, dataUrl: 'data:image/png;base64,AAAA', by: 'Staffer' });
await mkJob('j1'); await mkJob('j2');
await photo('p1', 'j1', 'body'); await photo('p2', 'j2', 'body'); await photo('p3', 'j1', 'paint'); await photo('pr', 'j1', 'ready');
let cmd = null;
await safe('the close-phase route exists', async () => { cmd = await imp('app/api/[slug]/[table]/[id]/close-phase/route.js'); t('close-phase route loads with a POST', typeof cmd.POST === 'function'); });
const close = (id, body, who = 'staff') => call(cmd.POST, req('POST', `/api/${SLUG}/jobs/${id}/close-phase`, tk[who], body), { slug: SLUG, table: 'jobs', id });
const get = id => store.get(SLUG, 'jobs', id);
const actsOf = async id => (await store.list(SLUG, 'activities')).filter(a => a.jobId === id && a.type === 'phase');
const same = async (id, before) => JSON.stringify((await get(id)).phases) === before;
if (cmd) await safe('refusals', async () => {
  const before = JSON.stringify((await get('j1')).phases);
  let r = await close('j1', { phaseKey: 'body', photoId: 'p1' }, 'custA'); t('a customer is refused 403', r.status === 403, String(r.status));
  r = await call(cmd.POST, req('POST', `/api/${SLUG}/jobs/j1/close-phase`, null, { phaseKey: 'body', photoId: 'p1' }), { slug: SLUG, table: 'jobs', id: 'j1' }); t('no session is refused 401', r.status === 401);
  r = await close('j1', { phaseKey: 'body' }); t('no photo is refused 400 with a message', r.status === 400 && typeof r.json?.error === 'string' && await same('j1', before), r.status + ' ' + JSON.stringify(r.json));
  r = await close('j1', { phaseKey: 'body', photoId: 'nope' }); t('a photo that does not exist is refused 400', r.status === 400 && await same('j1', before), String(r.status));
  r = await close('j1', { phaseKey: 'body', photoId: 'p2' }); t("another job's photo is refused 400", r.status === 400 && await same('j1', before), String(r.status));
  r = await close('j1', { phaseKey: 'body', photoId: 'p3' }); t("a photo of another phase is refused 400", r.status === 400 && await same('j1', before), String(r.status));
  r = await close('j1', { phaseKey: 'paint', photoId: 'p3' }); t('a later phase is refused 409', r.status === 409 && await same('j1', before), String(r.status));
  r = await close('j1', { phaseKey: 'body', photoId: 'p1', note: 'x'.repeat(2001) }); t('a note over 2000 characters is refused 400', r.status === 400 && await same('j1', before), String(r.status));
  r = await close('j1', 'not an object'); t('a body that is not an object is refused 400', r.status === 400);
  r = await call(cmd.POST, req('POST', `/api/${SLUG}/photos/p1/close-phase`, tk.staff, { phaseKey: 'body', photoId: 'p1' }), { slug: SLUG, table: 'photos', id: 'p1' }); t('only jobs have a close-phase command (404)', r.status === 404, String(r.status));
  r = await close('nojob', { phaseKey: 'body', photoId: 'p1' }); t('a missing job is 404', r.status === 404);
  t('no refusal wrote an activity', (await actsOf('j1')).length === 0);
});
if (cmd) await safe('a valid close', async () => {
  const r = await close('j1', { phaseKey: 'body', photoId: 'p1', note: 'Dent pulled' });
  const j = await get('j1'), [a, b, c] = j.phases;
  t('a valid close answers 200', r.status === 200, r.status + ' ' + JSON.stringify(r.json));
  t('the phase is done with doneAt, the photo and by from the session', a.status === 'done' && typeof a.doneAt === 'string' && a.photoId === 'p1' && a.by === 'Staffer' && a.note === 'Dent pulled', JSON.stringify(a));
  t('the next phase is now with startedAt', b.status === 'now' && typeof b.startedAt === 'string', JSON.stringify(b));
  t('the third phase is untouched', c.status === 'next' && !c.startedAt);
  t('the job is still open', j.status === 'open');
  const acts = await actsOf('j1');
  t('one activity "Body done: Dent pulled" by Staffer', acts.length === 1 && acts[0].summary === 'Body done: Dent pulled' && acts[0].by === 'Staffer', JSON.stringify(acts));
  t('the staff reply carries no money fields', r.json && !('estimate' in r.json) && !('approved' in r.json) && !('paid' in r.json));
  t('the stored money is untouched', j.estimate === 9000);
  const before = JSON.stringify(j.phases);
  const r2 = await close('j1', { phaseKey: 'body', photoId: 'p1', note: 'Dent pulled' });
  t('closing the same phase twice is refused', r2.status >= 400 && r2.status < 500 && await same('j1', before), String(r2.status));
  t('the refused second close wrote no activity', (await actsOf('j1')).length === 1);
  await close('j1', { phaseKey: 'paint', photoId: 'p3' });
  const r3 = await close('j1', { phaseKey: 'ready', photoId: 'pr' });
  const k = await get('j1');
  t('closing the last phase makes the job ready', r3.status === 200 && k.status === 'ready' && k.phases.every(p => p.status === 'done'), r3.status + ' ' + k.status);
  t('the pickup that was collected is booked again for the return', k.pickup.status === 'booked', JSON.stringify(k.pickup));
  const r4 = await close('j1', { phaseKey: 'ready', photoId: 'pr' }); t('a ready job closes nothing more (409)', r4.status === 409, String(r4.status));
  t('three closes, three activities', (await actsOf('j1')).length === 3);
});
await safe('the generic PATCH', async () => {
  const P = (id, body, who = 'staff') => call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/${id}`, tk[who], body), { slug: SLUG, table: 'jobs', id });
  const before = JSON.stringify((await get('j2')).phases);
  let r = await P('j2', { phases: [] }); t('a staff PATCH of phases is refused 403', r.status === 403 && await same('j2', before), String(r.status));
  r = await P('j2', { phases: [], notes: 'x' }, 'owner'); t('an owner PATCH of phases is refused 403', r.status === 403 && (await get('j2')).notes === undefined, String(r.status));
  r = await P('j2', { status: 'ready' }); t('a staff PATCH of status is refused 403', r.status === 403 && (await get('j2')).status === 'open', String(r.status));
  r = await P('j2', { status: 'delivered' }); t('delivering an open job is refused 403', r.status === 403 && (await get('j2')).status === 'open', String(r.status));
  r = await P('j2', { notes: 'Customer waiting' }); t('a staff PATCH of notes still works', r.status === 200 && (await get('j2')).notes === 'Customer waiting', String(r.status));
  await mkJob('j3', { status: 'ready', phases: [ph('body', 'done')] });
  r = await P('j3', { status: 'delivered', deliveredAt: T0, handoverBy: 'Staffer' }); t('the handover of a ready job still works (200)', r.status === 200 && (await get('j3')).status === 'delivered', r.status + ' ' + JSON.stringify(r.json));
});
await safe('the same rules as the frontend engine', async () => {
  const m = await loadData();
  const { closePhase } = await imp('lib/commands.js');
  for (const [name, idx, note] of [['the first phase', 0, undefined], ['the last phase', 2, 'All shiny']]) {
    const phases = [ph('body', idx > 0 ? 'done' : 'now', { startedAt: T0 }), ph('paint', idx > 1 ? 'done' : 'next'), ph('ready', idx === 2 ? 'now' : 'next')];
    const job = { id: 'jE', status: 'open', customerPhone: A_PHONE, branch: 'one', pickup: { wanted: true, status: 'collected' }, approvals: [], phases };
    /* the engine: today's completePhase in local mode, with a fake adapter catching what it saves */
    const d = makeService(m, { kind: 'staff', name: 'Staffer' }); const saved = [];
    d.adapter = { create: async (tb, row) => ({ ...row, id: tb === 'photos' ? 'pE' : 'aE', createdAt: T0, updatedAt: T0 }), update: async (tb, id, patch) => { saved.push(patch); return { ...job, ...patch }; }, list: async () => [], remove: async () => {} };
    d.jobs.set([job]); await d.completePhase('jE', 'data:image/png;base64,AAAA', note);
    const pE = { id: 'pE', jobId: 'jE', phaseKey: phases[idx].key };
    const r = closePhase(job, pE, { phaseKey: phases[idx].key, photoId: 'pE', ...(note ? { note } : {}) }, seats.staff, '2026-10-02T09:00:00.000Z');
    const sortK = v => Array.isArray(v) ? v.map(sortK) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortK(v[k])])) : v;
    const norm = o => sortK(JSON.parse(JSON.stringify(o, (k, v) => (k === 'doneAt' || k === 'startedAt') && v !== T0 ? 'NOW' : v)));
    t(name + ': the engine saved one patch', saved.length === 1);
    t(name + ': the server command makes the same phases, status and pickup as the engine', !!r.patch && JSON.stringify(norm(r.patch)) === JSON.stringify(norm(saved[0])), JSON.stringify(norm(r.patch)) + ' vs ' + JSON.stringify(norm(saved[0])));
    t(name + ': the command does not change the job it was given', JSON.stringify(job.phases) === JSON.stringify(phases));
  }
});
await safe('the web app closes through the command in api mode', async () => {
  const m = await loadData(); await mkJob('jW');
  const seat = { kind: 'staff', name: 'Staffer', token: tk.staff };
  const calls = fakeFetch(bridge({ list, item, command: cmd ? { 'close-phase': cmd } : {} }));
  const d = makeService(m, seat); await d.init(); const n0 = calls.length;
  await d.completePhase('jW', 'data:image/png;base64,BBBB', 'Primer on');
  const mine = calls.slice(n0);
  t('the web app sends no PATCH with phases', !mine.some(c => c.method === 'PATCH' && /phases/.test(c.body || '')), JSON.stringify(mine.map(c => c.method + ' ' + c.url)));
  t('the web app POSTs the photo then close-phase', mine.some(c => c.method === 'POST' && /\/photos$/.test(c.url)) && mine.some(c => c.method === 'POST' && /\/jobs\/jW\/close-phase$/.test(c.url)));
  const j = await get('jW');
  t('the stored job moved on', j.phases[0].status === 'done' && j.phases[1].status === 'now' && j.phases[0].note === 'Primer on', JSON.stringify(j.phases[0]));
  t('the activity was written once, by the server', (await actsOf('jW')).length === 1 && !mine.some(c => c.method === 'POST' && /\/activities$/.test(c.url)));
  t('the page shows the job moved on', d.job('jW')?.phases[1].status === 'now');
});
done('B2');
