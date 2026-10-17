// A3 (audit E02): a customer may only answer ONE existing pending approval on their own job, by id, with 'approved' or
// 'declined', or set a rating 1 to 5 on a delivered job. The server finds the approval, sets answeredAt and takes no
// number from the customer. Repeating the same answer is harmless. Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API/a3-check.mjs
import { imp, SLUG, t, safe, done, req, call, seats } from './harness.mjs';
const { store } = await imp('lib/store.js');
const { issue } = await imp('lib/auth.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const T0 = '2026-10-01T09:00:00.000Z';
const ap1 = { id: 'ap1', title: 'Brake pads', amount: 3000, status: 'pending', askedAt: T0 };
const ap2 = { id: 'ap2', title: 'Wiper', amount: 500, status: 'approved', askedAt: T0, answeredAt: T0 };
await store.create(SLUG, 'jobs', { id: 'jA', customerPhone: seats.custA.phone, approvals: [ap1, ap2], estimate: 1000, approved: 900, paid: 0, status: 'open' });
await store.create(SLUG, 'jobs', { id: 'jB', customerPhone: seats.custB.phone, approvals: [{ id: 'bp1', title: 'Tyre', amount: 8000, status: 'pending', askedAt: T0 }], approved: 0, status: 'open' });
await store.create(SLUG, 'jobs', { id: 'jDel', customerPhone: seats.custA.phone, approvals: [], status: 'delivered' });
await store.create(SLUG, 'jobs', { id: 'jDel2', customerPhone: seats.custA.phone, approvals: [], status: 'delivered', rating: 4 });
await store.create(SLUG, 'photos', { id: 'pA', jobId: 'jA', phaseKey: 'in', dataUrl: 'data:x' });
const PATCH = (who, id, body, table = 'jobs') => call(item.PATCH, req('PATCH', `/api/${SLUG}/${table}/${id}`, tk[who], body), { slug: SLUG, table, id });
const get = id => store.get(SLUG, 'jobs', id);
const snap = async id => JSON.stringify(await get(id));
const refused = async (name, who, id, body, table) => {
  const before = await snap(id); const r = await PATCH(who, id, body, table); const after = await snap(id);
  t('refused: ' + name, r.status >= 400 && r.status < 500, String(r.status));
  t('unchanged after: ' + name, before === after);
};

await safe('refusals', async () => {
  await refused('rewrite the approvals array with a lower amount', 'custA', 'jA', { approvals: [{ ...ap1, amount: 1, status: 'approved' }, ap2] });
  await refused('add a new approval to the array', 'custA', 'jA', { approvals: [ap1, ap2, { id: 'ap9', title: 'Free', amount: 0, status: 'approved', askedAt: T0 }] });
  await refused('answer with an amount alongside', 'custA', 'jA', { approvalId: 'ap1', status: 'approved', amount: 1 });
  await refused('answer an approval that does not exist', 'custA', 'jA', { approvalId: 'ap9', status: 'approved' });
  await refused('rewrite an answered approval', 'custA', 'jA', { approvalId: 'ap2', status: 'declined' });
  await refused('answer with a status that is not approved or declined', 'custA', 'jA', { approvalId: 'ap1', status: 'pending' });
  await refused('send the approved total', 'custA', 'jA', { approved: 99999 });
  await refused('send the approved total with a real answer', 'custA', 'jA', { approvalId: 'ap1', status: 'approved', approved: 99999 });
  await refused('send answeredAt', 'custA', 'jA', { approvalId: 'ap1', status: 'approved', answeredAt: '2020-01-01T00:00:00.000Z' });
  await refused('change the job status', 'custA', 'jA', { status: 'delivered' });
  await refused('answer on another customer\'s job', 'custA', 'jB', { approvalId: 'bp1', status: 'approved' });
  await refused('answer another customer\'s approval id on my job', 'custA', 'jA', { approvalId: 'bp1', status: 'approved' });
  await refused('rate a job that is not delivered', 'custA', 'jA', { rating: 5 });
  await refused('rate 6', 'custA', 'jDel', { rating: 6 });
  await refused('rate 0', 'custA', 'jDel', { rating: 0 });
  await refused('rate 3.5', 'custA', 'jDel', { rating: 3.5 });
  await refused('rate as a string', 'custA', 'jDel', { rating: '5' });
  await refused('change a rating already given', 'custA', 'jDel2', { rating: 1 });
  await refused('rate and answer in one go', 'custA', 'jDel', { rating: 5, approvalId: 'x', status: 'approved' });
  await refused('empty body', 'custA', 'jA', {});
  t('refused: customer PATCH on a photo', (await PATCH('custA', 'pA', { jobId: 'jB' }, 'photos')).status === 403);
  t('another customer\'s job still pending', (await get('jB')).approvals[0].status === 'pending');
});
await safe('legitimate answer', async () => {
  const r1 = await PATCH('custA', 'jA', { approvalId: 'ap1', status: 'approved' });
  t('answering ap1 approved answers 200', r1.status === 200, String(r1.status) + ' ' + JSON.stringify(r1.json).slice(0, 120));
  const j1 = await get('jA'); const a1 = j1.approvals.find(a => a.id === 'ap1');
  t('ap1 is now approved', a1?.status === 'approved');
  t('ap1 has a server answeredAt', typeof a1?.answeredAt === 'string' && a1.answeredAt > T0, a1?.answeredAt);
  t('ap1 amount untouched', a1?.amount === 3000 && a1?.title === 'Brake pads' && a1?.askedAt === T0);
  t('ap2 untouched', JSON.stringify(j1.approvals.find(a => a.id === 'ap2')) === JSON.stringify(ap2));
  t('two approvals, no more', j1.approvals.length === 2);
  t('approved total not taken from the customer', j1.approved === 900 && j1.estimate === 1000);
  t('answer response carries no money fields', !!r1.json && !('estimate' in r1.json) && !('approved' in r1.json) && !('paid' in r1.json));
  const before = await snap('jA');
  const r2 = await PATCH('custA', 'jA', { approvalId: 'ap1', status: 'approved' });
  t('the same answer twice answers 200', r2.status === 200, String(r2.status));
  t('the same answer twice changes nothing (answeredAt kept)', JSON.stringify((await get('jA')).approvals) === JSON.stringify(JSON.parse(before).approvals));
  await refused('flip an answer already given', 'custA', 'jA', { approvalId: 'ap1', status: 'declined' });
  const r3 = await PATCH('custA', 'jDel', { rating: 5 });
  t('rating 5 on a delivered job answers 200', r3.status === 200, String(r3.status));
  t('rating stored as 5', (await get('jDel')).rating === 5);
  t('the same rating twice answers 200', (await PATCH('custA', 'jDel', { rating: 5 })).status === 200);
  const r4 = await PATCH('custB', 'jB', { approvalId: 'bp1', status: 'declined' });
  t('customer B declines bp1 on their own job', r4.status === 200 && (await get('jB')).approvals[0].status === 'declined');
});
await safe('staff unchanged', async () => {
  const j = await get('jA');
  const r = await PATCH('staff', 'jA', { approvals: [...j.approvals, { id: 'ap3', title: 'Bulb', amount: 200, status: 'pending', askedAt: T0 }] });
  t('staff may still add an approval', r.status === 200 && (await get('jA')).approvals.length === 3);
});
done('A3');
