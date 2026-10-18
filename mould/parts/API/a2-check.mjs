// A2 (audit E03): every write response goes through the same per role projection as GET.
// A staff seat or a customer never receives estimate, approved or paid; an owner does.
// Written by Claude BEFORE the crew ran.   node --no-warnings mould/parts/API/a2-check.mjs
import { imp, SLUG, t, safe, done, req, call, seats } from './harness.mjs';
const { store } = await imp('lib/store.js');
const { issue } = await imp('lib/auth.js');
const col = await imp('app/api/[slug]/[table]/route.js');
const item = await imp('app/api/[slug]/[table]/[id]/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const MONEY = ['estimate', 'approved', 'paid'];
const noMoney = j => !!j && typeof j === 'object' && MONEY.every(k => !(k in j));
const keys = j => j && typeof j === 'object' ? Object.keys(j).filter(k => MONEY.includes(k)).join(',') || 'none' : String(j);

await store.create(SLUG, 'customers', { id: 'cA', name: 'Cust A', phone: seats.custA.phone });
await store.create(SLUG, 'jobs', { id: 'jD', customerId: 'cA', customerPhone: seats.custA.phone, approvals: [], estimate: 5000, approved: 4000, paid: 1000, status: 'delivered' });
await store.create(SLUG, 'enquiries', { id: 'e1', name: 'Lead', status: 'new' });
const PATCH = (who, table, id, body) => call(item.PATCH, req('PATCH', `/api/${SLUG}/${table}/${id}`, tk[who], body), { slug: SLUG, table, id });
const POST = (who, table, body) => call(col.POST, req('POST', `/api/${SLUG}/${table}`, tk[who], body), { slug: SLUG, table });

await safe('PATCH', async () => {
  const a = await PATCH('staff', 'jobs', 'jD', { notes: 'staff note' });
  t('staff PATCH on a job answers 200', a.status === 200, String(a.status));
  t('staff PATCH response carries no money fields', noMoney(a.json), keys(a.json));
  t('staff PATCH response still carries the change', a.json?.notes === 'staff note');
  const b = await PATCH('staff', 'jobs', 'jD', { estimate: 1, approved: 1, paid: 1 });
  t('staff PATCH sending money gets no money back', noMoney(b.json), keys(b.json));
  const stored = await store.get(SLUG, 'jobs', 'jD');
  t('staff PATCH did not change the stored money', stored.estimate === 5000 && stored.approved === 4000 && stored.paid === 1000);
  const o = await PATCH('owner', 'jobs', 'jD', { notes: 'owner note' });
  t('owner PATCH response carries the money', o.json?.estimate === 5000 && o.json?.approved === 4000 && o.json?.paid === 1000, keys(o.json));
  const c = await PATCH('custA', 'jobs', 'jD', { rating: 5 });
  t('customer rating on their delivered job answers 200', c.status === 200, String(c.status));
  /* payments part A (18 Oct 2026): a customer now sees the approved total, never the estimate or the old paid figure */
  t('customer PATCH response carries no estimate or paid, and the approved total', !!c.json && !('estimate' in c.json) && !('paid' in c.json) && c.json.approved === 4000, keys(c.json));
  const e = await PATCH('staff', 'enquiries', 'e1', { status: 'contacted' });
  t('staff PATCH on an enquiry returns the row', e.status === 200 && e.json?.status === 'contacted');
  t('staff PATCH on a quote is still refused', (await PATCH('staff', 'quotes', 'nope', {})).status !== 200);
});
await safe('POST', async () => {
  const s = await POST('staff', 'jobs', { id: 'jS', customerPhone: seats.custA.phone, approvals: [], estimate: 99, status: 'open' });
  t('staff POST of a job answers 201', s.status === 201, String(s.status));
  t('staff POST response carries no money fields', noMoney(s.json), keys(s.json));
  t('staff POST response carries an id', typeof s.json?.id === 'string' && s.json.id.length > 0);
  const o = await POST('owner', 'jobs', { id: 'jO', customerPhone: seats.custA.phone, approvals: [], estimate: 77, status: 'open' });
  t('owner POST response carries the money', o.json?.estimate === 77, keys(o.json));
  const p = await POST('staff', 'photos', { jobId: 'jD', phaseKey: 'in', dataUrl: 'data:x' });
  t('staff POST of a photo returns it with its job', p.status === 201 && p.json?.jobId === 'jD');
  t('customer POST is still refused', (await POST('custA', 'photos', { jobId: 'jD' })).status === 403);
});
await safe('GET unchanged', async () => {
  const g = await call(item.GET, req('GET', `/api/${SLUG}/jobs/jD`, tk.staff), { slug: SLUG, table: 'jobs', id: 'jD' });
  t('staff GET of the job still carries no money', g.status === 200 && noMoney(g.json));
});
done('A2');
