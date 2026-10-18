// B1 (owed from batch 1): a customer's yes adds the stored approval amount to the job's approved total once, on the
// server; a no adds nothing; the same answer twice changes nothing; the server writes the activity. The customer page
// sends the one approval answer shape the route accepts. Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API2/b1-check.mjs
import { imp, t, safe, done, req, call, SLUG, seats, A_PHONE } from '../API/harness.mjs';
import { loadData, makeService, fakeFetch, bridge } from './webharness.mjs';
const { store } = await imp('lib/store.js'); const { issue } = await imp('lib/auth.js'); const { customerAnswer } = await imp('lib/answer.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js'), list = await imp('app/api/[slug]/[table]/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const T0 = '2026-10-01T08:00:00.000Z';
const ap = (id, amount, status = 'pending') => ({ id, title: 'Work ' + id, amount, status, askedAt: T0 });
await store.create(SLUG, 'jobs', { id: 'jA', plate: 'CAA-1111', customerPhone: A_PHONE, branch: 'one', status: 'open', phases: [], approved: 1000,
  approvals: [ap('ap1', 5000), ap('ap2', 3000), ap('ap3', undefined), ap('ap4', -50), ap('ap5', 'lots')] });
await store.create(SLUG, 'jobs', { id: 'jN', plate: 'CAA-2222', customerPhone: A_PHONE, branch: 'one', status: 'open', phases: [], approvals: [ap('n1', 700)] });
const answer = (id, body, who = 'custA') => call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/${id}`, tk[who], body), { slug: SLUG, table: 'jobs', id });
const approved = async id => (await store.get(SLUG, 'jobs', id)).approved;
const acts = async () => (await store.list(SLUG, 'activities')).filter(a => a.jobId === 'jA');
await safe('server adds once', async () => {
  const r = await answer('jA', { approvalId: 'ap1', status: 'approved' });
  t('a yes answers 200', r.status === 200, String(r.status));
  t('a yes adds the stored amount to approved (1000 + 5000)', await approved('jA') === 6000, String(await approved('jA')));
  /* payments part A (18 Oct 2026): a customer now sees the approved total the server built */
  t('the customer reply carries the approved total the server built (6000)', r.json && r.json.approved === 6000, JSON.stringify(r.json && Object.keys(r.json)));
  const r2 = await answer('jA', { approvalId: 'ap1', status: 'approved' });
  t('the same yes again answers 200', r2.status === 200, String(r2.status));
  t('the same yes again leaves approved at 6000', await approved('jA') === 6000, String(await approved('jA')));
  const r3 = await answer('jA', { approvalId: 'ap2', status: 'declined' });
  t('a no answers 200', r3.status === 200);
  t('a no adds nothing', await approved('jA') === 6000, String(await approved('jA')));
  await answer('jA', { approvalId: 'ap2', status: 'declined' });
  t('the same no again adds nothing', await approved('jA') === 6000);
  const r4 = await answer('jA', { approvalId: 'ap2', status: 'approved' });
  t('a yes after a no is refused 409 and adds nothing', r4.status === 409 && await approved('jA') === 6000, r4.status + ' ' + await approved('jA'));
  await answer('jA', { approvalId: 'ap3', status: 'approved' });
  t('a yes with no amount adds nothing', await approved('jA') === 6000);
  await answer('jA', { approvalId: 'ap4', status: 'approved' }); await answer('jA', { approvalId: 'ap5', status: 'approved' });
  t('a negative or non number amount adds nothing', await approved('jA') === 6000, String(await approved('jA')));
  const r5 = await answer('jA', { approvalId: 'ap1', status: 'approved', amount: 999999 });
  t('an amount sent by the customer is refused', r5.status === 403 && await approved('jA') === 6000);
  await answer('jN', { approvalId: 'n1', status: 'approved' });
  t('a job with no approved total yet starts from 0', await approved('jN') === 700, String(await approved('jN')));
  const a = await acts();
  t('the server logs one activity per real answer (ap1 yes, ap2 no, ap3, ap4, ap5)', a.length === 5, String(a.length));
  t('the activity reads Approved: <title> by Customer', a.some(x => x.type === 'approval' && x.summary === 'Approved: Work ap1' && x.by === 'Customer'), JSON.stringify(a.map(x => x.summary)));
  t('a no logs Declined: <title>', a.some(x => x.summary === 'Declined: Work ap2'));
  const job = await store.get(SLUG, 'jobs', 'jA');
  t('the approval itself is answered with a time', job.approvals[0].status === 'approved' && !!job.approvals[0].answeredAt);
});
await safe('lib/answer.js shape', async () => {
  const job = { customerPhone: A_PHONE, approved: 10, approvals: [ap('x', 40)] };
  const a = customerAnswer(job, { approvalId: 'x', status: 'approved' }, seats.custA, T0);
  t('customerAnswer puts approved in its patch on a yes', a.patch && a.patch.approved === 50, JSON.stringify(a));
  const d = customerAnswer(job, { approvalId: 'x', status: 'declined' }, seats.custA, T0);
  t('customerAnswer leaves approved out of its patch on a no', d.patch && !('approved' in d.patch), JSON.stringify(d));
  t('customerAnswer does not change the job it was given', job.approved === 10 && job.approvals[0].status === 'pending');
});
await safe('web sends the route shape', async () => {
  const m = await loadData();
  await store.create(SLUG, 'jobs', { id: 'jW', plate: 'CAA-3333', customerPhone: A_PHONE, branch: 'one', status: 'open', phases: [], approved: 0, approvals: [ap('w1', 2500), ap('w2', 100)] });
  const seat = { kind: 'customer', name: 'Cust A', phone: A_PHONE, token: tk.custA };
  const send = bridge({ list, item }); const calls = fakeFetch(send);
  const d = makeService(m, seat); await d.init();
  t('the web service runs in api mode', d.mode() === 'api');
  const before = calls.length; await d.answerApproval('jW', 'w1', true);
  const mine = calls.slice(before); const patch = mine.find(c => c.method === 'PATCH');
  const body = patch ? JSON.parse(patch.body) : null;
  t('the answer is one PATCH to jobs/jW', !!patch && /\/api\/tst\/jobs\/jW$/.test(patch.url), JSON.stringify(mine.map(c => c.method + ' ' + c.url)));
  t('the body is exactly { approvalId, status }', !!body && JSON.stringify(Object.keys(body).sort()) === '["approvalId","status"]', JSON.stringify(body));
  const v = body ? customerAnswer(await store.get(SLUG, 'jobs', 'jW'), body, seat, T0) : { error: 'no body' };
  t('the route validator accepts that body', !v.error && v.patch === null, JSON.stringify(v));
  t('the stored job approved the work and added 2500', (await store.get(SLUG, 'jobs', 'jW')).approved === 2500 && (await store.get(SLUG, 'jobs', 'jW')).approvals[0].status === 'approved');
  t('the customer page never POSTs an activity (a customer may not create rows)', !mine.some(c => c.method === 'POST'), JSON.stringify(mine.map(c => c.method)));
  const local = d.job('jW');
  t('the job in the page shows the approval answered', local && local.approvals[0].status === 'approved', JSON.stringify(local && local.approvals[0]));
  t('the job in the page keeps its own status (the answer status never lands on the job)', local && local.status === 'open', String(local && local.status));
  t('nothing waits in the outbox', !localStorage._keys().some(k => k.startsWith('wos_outbox') && JSON.parse(localStorage.getItem(k)).length), localStorage._keys().join(','));
  await d.answerApproval('jW', 'w2', false); const no = calls.filter(c => c.method === 'PATCH').pop();
  t('a no sends { approvalId, status: declined }', no && JSON.parse(no.body).status === 'declined' && JSON.parse(no.body).approvalId === 'w2');
});
done('B1');
