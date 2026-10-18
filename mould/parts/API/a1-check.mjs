// A1 (audit E01): a customer sees a photo or an activity ONLY when its jobId is one of their own jobs.
// Rows with no jobId are refused for a customer (their own customer row by phone is the one exception).
// Staff and owner are unchanged. Written by Claude BEFORE the crew ran.   node --no-warnings mould/parts/API/a1-check.mjs
import { imp, SLUG, t, safe, done, req, call, seats } from './harness.mjs';
const { store, scope } = await imp('lib/store.js');
const { issue } = await imp('lib/auth.js');
const list = (await imp('app/api/[slug]/[table]/route.js')).GET;
const item = (await imp('app/api/[slug]/[table]/[id]/route.js')).GET;
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));

await store.create(SLUG, 'customers', { id: 'cA', name: 'Cust A', phone: seats.custA.phone });
await store.create(SLUG, 'customers', { id: 'cB', name: 'Cust B', phone: seats.custB.phone });
await store.create(SLUG, 'jobs', { id: 'jA', customerId: 'cA', customerPhone: seats.custA.phone, approvals: [], estimate: 1000, approved: 900, paid: 0, status: 'open' });
await store.create(SLUG, 'jobs', { id: 'jB', customerId: 'cB', customerPhone: seats.custB.phone, approvals: [], estimate: 2000, approved: 0, paid: 0, status: 'open' });
for (const [id, jobId] of [['pA', 'jA'], ['pB', 'jB'], ['pX', undefined], ['pGhost', 'jNoSuchJob']]) await store.create(SLUG, 'photos', { id, jobId, phaseKey: 'in', dataUrl: 'data:x', by: 'Staffer' });
for (const [id, jobId] of [['aA', 'jA'], ['aB', 'jB'], ['aX', undefined]]) await store.create(SLUG, 'activities', { id, jobId, type: 'note', summary: 's', by: 'Staffer' });

const ids = j => Array.isArray(j) ? j.map(r => r.id).sort().join(',') : 'not a list';
const L = (who, table) => call(list, req('GET', `/api/${SLUG}/${table}`, tk[who]), { slug: SLUG, table });
const G = (who, table, id) => call(item, req('GET', `/api/${SLUG}/${table}/${id}`, tk[who]), { slug: SLUG, table, id });

await safe('lists', async () => {
  t('customer A lists photos: only pA', ids((await L('custA', 'photos')).json) === 'pA', ids((await L('custA', 'photos')).json));
  t('customer B lists photos: only pB', ids((await L('custB', 'photos')).json) === 'pB', ids((await L('custB', 'photos')).json));
  t('customer A lists activities: only aA', ids((await L('custA', 'activities')).json) === 'aA', ids((await L('custA', 'activities')).json));
  t('customer B lists activities: only aB', ids((await L('custB', 'activities')).json) === 'aB', ids((await L('custB', 'activities')).json));
  t('customer A lists customers: only their own row', ids((await L('custA', 'customers')).json) === 'cA', ids((await L('custA', 'customers')).json));
  t('customer A lists jobs: only jA', ids((await L('custA', 'jobs')).json) === 'jA', ids((await L('custA', 'jobs')).json));
  const aj = (await L('custA', 'jobs')).json?.[0] || {};
  t('customer A job carries no money fields', !('estimate' in aj) && !('approved' in aj) && !('paid' in aj));
  t('staff lists all four photos', ids((await L('staff', 'photos')).json) === 'pA,pB,pGhost,pX', ids((await L('staff', 'photos')).json));
  t('owner lists all three activities', ids((await L('owner', 'activities')).json) === 'aA,aB,aX', ids((await L('owner', 'activities')).json));
  t('staff lists both customers', ids((await L('staff', 'customers')).json) === 'cA,cB');
  const oj = (await L('owner', 'jobs')).json || [];
  t('owner still sees money on jobs', oj.length === 2 && oj.every(j => 'estimate' in j));
  const sj = (await L('staff', 'jobs')).json || [];
  t('staff still sees no money on jobs', sj.length === 2 && sj.every(j => !('estimate' in j) && !('approved' in j) && !('paid' in j)));
});
await safe('direct ids', async () => {
  t('customer A gets pA by id', (await G('custA', 'photos', 'pA')).status === 200);
  t('customer A refused pB by id', (await G('custA', 'photos', 'pB')).status === 404, String((await G('custA', 'photos', 'pB')).status));
  t('customer A refused orphan photo pX by id', (await G('custA', 'photos', 'pX')).status === 404, String((await G('custA', 'photos', 'pX')).status));
  t('customer A refused photo on a job that does not exist', (await G('custA', 'photos', 'pGhost')).status === 404);
  t('customer A gets aA by id', (await G('custA', 'activities', 'aA')).status === 200);
  t('customer A refused aB by id', (await G('custA', 'activities', 'aB')).status === 404, String((await G('custA', 'activities', 'aB')).status));
  t('customer A refused orphan activity aX by id', (await G('custA', 'activities', 'aX')).status === 404, String((await G('custA', 'activities', 'aX')).status));
  t('customer A refused customer row cB by id', (await G('custA', 'customers', 'cB')).status === 404);
  t('customer A refused job jB by id', (await G('custA', 'jobs', 'jB')).status === 404);
  t('staff gets pB by id', (await G('staff', 'photos', 'pB')).status === 200);
  t('owner gets orphan aX by id', (await G('owner', 'activities', 'aX')).status === 200);
});
await safe('scope fails closed', async () => {
  const rows = await store.list(SLUG, 'photos');
  t('scope for a customer with no job ids given returns nothing', scope(rows, 'photos', seats.custA).length === 0, String(scope(rows, 'photos', seats.custA).length));
  t('scope for a customer with an empty set returns nothing', scope(rows, 'photos', seats.custA, new Set()).length === 0);
  t('scope for a customer with set {jA} returns pA only', ids(scope(rows, 'photos', seats.custA, new Set(['jA']))) === 'pA');
  t('scope for staff ignores the job ids', scope(rows, 'photos', seats.staff).length === 4);
});
await safe('no session', async () => { t('no token is refused', (await call(list, req('GET', `/api/${SLUG}/photos`), { slug: SLUG, table: 'photos' })).status === 401); });
done('A1');
