// B3 (audit E04, E08): every job write carries the version it read (x-wos-version: the updatedAt it read). A staff save
// with no version is refused 428; a save on an older version is refused 409 with a message, also when two arrive at once.
// A space (bay) another OPEN job of the same branch holds is refused on the server. Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API2/b3-check.mjs
import { imp, t, safe, done, req, call, SLUG, seats, A_PHONE } from '../API/harness.mjs';
import { loadData, makeService, fakeFetch, bridge } from './webharness.mjs';
const S = await imp('lib/store.js'); const { store } = S; const { issue } = await imp('lib/auth.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js'), list = await imp('app/api/[slug]/[table]/route.js');
const cmd = await imp('app/api/[slug]/[table]/[id]/close-phase/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const T0 = '2026-10-01T08:00:00.000Z';
const job = (id, over = {}) => store.create(SLUG, 'jobs', { id, plate: 'CAC-' + id, customerPhone: A_PHONE, branch: 'one', status: 'open', approvals: [], promiseHistory: [], pickup: { wanted: false, status: 'none' },
  phases: [{ key: 'body', label: 'Body', hours: 4, status: 'now', startedAt: T0 }, { key: 'ready', label: 'Ready', hours: 1, status: 'next' }], ...over });
const get = id => store.get(SLUG, 'jobs', id);
const raw = (id, body, version, who = 'staff') => call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/${id}`, tk[who], body, version === undefined ? { 'x-check-raw': '1' } : { 'x-wos-version': version }), { slug: SLUG, table: 'jobs', id });
const fresh = async (id, body, who = 'staff') => raw(id, body, (await get(id)).updatedAt, who);
await safe('the version check', async () => {
  await job('v1'); const v0 = (await get('v1')).updatedAt;
  let r = await raw('v1', { notes: 'no version' }); t('a staff save with no version is refused 428 with a message', r.status === 428 && typeof r.json?.error === 'string' && (await get('v1')).notes === undefined, r.status + ' ' + JSON.stringify(r.json));
  r = await raw('v1', { notes: 'first' }, v0); t('a save on the current version answers 200', r.status === 200, String(r.status));
  const v1 = (await get('v1')).updatedAt; t('the version moved on (strictly later)', v1 > v0, v0 + ' ' + v1);
  r = await raw('v1', { notes: 'second from the old version' }, v0);
  t('a second save from the same old version is refused 409 with a message', r.status === 409 && typeof r.json?.error === 'string', r.status + ' ' + JSON.stringify(r.json));
  t('the refused save changed nothing', (await get('v1')).notes === 'first' && (await get('v1')).updatedAt === v1);
  await job('v2'); const w0 = (await get('v2')).updatedAt;
  const both = await Promise.all([raw('v2', { notes: 'tablet A' }, w0), raw('v2', { notes: 'tablet B' }, w0)]);
  t('two saves at once from one version: exactly one 200 and one 409', both.map(x => x.status).sort().join() === '200,409', both.map(x => x.status).join());
  t('the stored note is the winner', (await get('v2')).notes === (both[0].status === 200 ? 'tablet A' : 'tablet B'));
  const u = await store.update(SLUG, 'jobs', 'v2', { notes: 'stale' }, w0);
  t('store.update with an old expected version returns CONFLICT', S.CONFLICT !== undefined && u === S.CONFLICT, String(u && u.notes));
  await job('v3', { approvals: [{ id: 'a1', title: 'Wiper', amount: 100, status: 'pending', askedAt: T0 }, { id: 'a2', title: 'Bulb', amount: 50, status: 'pending', askedAt: T0 }] });
  const c0 = (await get('v3')).updatedAt;
  r = await raw('v3', { approvalId: 'a1', status: 'approved' }, undefined, 'custA'); t('a customer answer with no version still works (200)', r.status === 200, String(r.status));
  r = await raw('v3', { approvalId: 'a2', status: 'approved' }, c0, 'custA'); t('a customer answer on an old version is refused 409', r.status === 409 && (await get('v3')).approvals[1].status === 'pending', String(r.status));
});
await safe('close-phase carries the version', async () => {
  await job('c1'); await store.create(SLUG, 'photos', { id: 'pc1', jobId: 'c1', phaseKey: 'body', dataUrl: 'data:image/png;base64,AA', by: 'Staffer' });
  const v0 = (await get('c1')).updatedAt; await fresh('c1', { notes: 'moved on' });
  const C = (h) => call(cmd.POST, req('POST', `/api/${SLUG}/jobs/c1/close-phase`, tk.staff, { phaseKey: 'body', photoId: 'pc1' }, h), { slug: SLUG, table: 'jobs', id: 'c1' });
  let r = await C({ 'x-check-raw': '1' }); t('close-phase with no version is refused 428', r.status === 428, String(r.status));
  r = await C({ 'x-wos-version': v0 }); t('close-phase on an old version is refused 409', r.status === 409 && (await get('c1')).phases[0].status === 'now', String(r.status));
  r = await C({ 'x-wos-version': (await get('c1')).updatedAt }); t('close-phase on the current version answers 200', r.status === 200, String(r.status));
});
await safe('one car per space', async () => {
  await job('k1', { spaceKey: 'bay1' }); await job('k2'); await job('k3', { branch: 'two' }); await job('k4', { status: 'ready', spaceKey: 'bay2' });
  let r = await fresh('k2', { spaceKey: 'bay1' }); t('a space another open job of the branch holds is refused 409 with a message', r.status === 409 && typeof r.json?.error === 'string' && (await get('k2')).spaceKey === undefined, r.status + ' ' + JSON.stringify(r.json));
  r = await fresh('k3', { spaceKey: 'bay1' }); t('the same space key in another branch is allowed', r.status === 200 && (await get('k3')).spaceKey === 'bay1', String(r.status));
  r = await fresh('k2', { spaceKey: 'bay2' }); t('a space held only by a ready job is free', r.status === 200 && (await get('k2')).spaceKey === 'bay2', String(r.status));
  r = await fresh('k1', { spaceKey: 'bay1', notes: 'same place' }); t('a job keeping its own space is allowed', r.status === 200);
  r = await fresh('k1', { spaceKey: null }); t('leaving a space is allowed', r.status === 200 && !(await get('k1')).spaceKey, String(r.status));
  await fresh('k1', { spaceKey: 'bay1' });
  r = await fresh('k1', { branch: 'two' }); t('moving a job to a branch where its space is held is refused 409', r.status === 409 && (await get('k1')).branch === 'one', String(r.status));
  await job('k5'); await job('k6');
  const both = await Promise.all([fresh('k5', { spaceKey: 'bay9' }), fresh('k6', { spaceKey: 'bay9' })]);
  t('two jobs into one space at once: exactly one 200 and one 409', both.map(x => x.status).sort().join() === '200,409', both.map(x => x.status).join());
  const holders = (await store.list(SLUG, 'jobs')).filter(j => j.spaceKey === 'bay9');
  t('only one job holds that space', holders.length === 1, String(holders.length));
  r = await call(list.POST, req('POST', `/api/${SLUG}/jobs`, tk.staff, { plate: 'NEW-1', branch: 'one', status: 'open', spaceKey: 'bay1', phases: [], approvals: [] }), { slug: SLUG, table: 'jobs' });
  t('a new job into a held space is refused 409', r.status === 409, String(r.status));
});
await safe('the web app sends the version it read', async () => {
  const m = await loadData(); await job('w1'); await job('w2', { approvals: [{ id: 'q1', title: 'Mat', amount: 10, status: 'pending', askedAt: T0 }] });
  const statuses = []; const send = bridge({ list, item, command: { 'close-phase': cmd } });
  const calls = fakeFetch(async (u, i) => { const a = await send(u, i); statuses.push([i.method || 'GET', u, a.status]); return a; });
  const hv = c => { const h = c.headers || {}; return h['x-wos-version'] || h['X-Wos-Version'] || (h.get && h.get('x-wos-version')); };
  const A = makeService(m, { kind: 'staff', name: 'Staffer', token: tk.staff }); await A.init();
  const B = makeService(m, { kind: 'staff', name: 'Staffer', token: tk.staff }); await B.init();
  const vRead = A.job('w1').updatedAt; let n = calls.length;
  await A.setPromise('w1', '2026-10-20T10:00:00.000Z', 'Parts late');
  const pa = calls.slice(n).find(c => c.method === 'PATCH');
  t('a job save sends x-wos-version with the version it read', pa && hv(pa) === vRead, JSON.stringify(pa && pa.headers));
  t('that save answered 200', statuses.some(s => s[0] === 'PATCH' && /w1$/.test(s[1]) && s[2] === 200));
  n = statuses.length; let threw = false; try { await B.setPromise('w1', '2026-10-21T10:00:00.000Z', 'Second tablet'); } catch { threw = true; }
  const sb = statuses.slice(n).find(s => s[0] === 'PATCH');
  t('a second tablet saving from the old version gets 409 from the server', sb && sb[2] === 409, JSON.stringify(sb));
  t('the first save stands', (await get('w1')).promiseHistory?.[0]?.reason === 'Parts late');
  const C = makeService(m, { kind: 'customer', name: 'Cust A', phone: A_PHONE, token: tk.custA }); await C.init();
  n = calls.length; await C.answerApproval('w2', 'q1', true); const pc = calls.slice(n).find(c => c.method === 'PATCH');
  t('the customer answer sends the version too', pc && hv(pc) === C.job('w2')?.updatedAt || (pc && hv(pc) && (await get('w2')).approvals[0].status === 'approved'), JSON.stringify(pc && pc.headers));
  n = calls.length; await A.reload(); await A.completePhase('w1', 'data:image/png;base64,CC'); const cp = calls.slice(n).find(c => /close-phase$/.test(c.url));
  t('close-phase sends the version', cp && !!hv(cp) && (await get('w1')).phases[0].status === 'done', JSON.stringify(cp && cp.headers));
});
done('B3');
