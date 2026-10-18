// B4 (audit E06): sign in and the text code find the customer by an exact phone lookup (one record), never by listing
// every customer. List reads take a limit and an offset, a stable order, at most 500 rows a page. A customer's own rows
// and the one car per space rule still work past 500 rows. Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API2/b4-check.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { imp, t, safe, done, req, call, SLUG, seats, A_PHONE } from '../API/harness.mjs';
import { loadData, makeService, fakeFetch } from './webharness.mjs';
const ROOT = mkdtempSync(join(tmpdir(), 'wos-b4-')); mkdirSync(join(ROOT, 'casts')); mkdirSync(join(ROOT, 'apps', 'api'), { recursive: true });
writeFileSync(join(ROOT, 'casts', SLUG + '.json'), JSON.stringify({ slug: SLUG, name: 'Check Garage', users: [{ name: 'Owner', pin: '1234', role: 'owner', branch: 'one' }] }));
process.chdir(join(ROOT, 'apps', 'api'));
const S = await imp('lib/store.js'); const { store } = S; const { issue } = await imp('lib/auth.js'); const { issueCode } = await imp('lib/clients.js');
const list = await imp('app/api/[slug]/[table]/route.js'), item = await imp('app/api/[slug]/[table]/[id]/route.js');
const tk = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, issue(SLUG, s)]));
const phoneOf = i => '077' + String(i).padStart(7, '0');
for (let i = 1; i <= 1500; i++) await store.create(SLUG, 'customers', { name: 'Customer ' + i, phone: phoneOf(i), vehicles: [] });
/* a spy on store.list: which kinds were listed in full */
const listed = []; const realList = store.list.bind(store); store.list = async (...a) => { listed.push(a[1]); return realList(...a); };
const GET = (q, who = 'owner', table = 'customers') => call(list.GET, req('GET', `/api/${SLUG}/${table}${q}`, tk[who]), { slug: SLUG, table });
await safe('pages', async () => {
  const pages = []; for (const off of [0, 500, 1000, 1500]) pages.push(await GET(`?limit=500&offset=${off}`));
  t('every page answers 200', pages.every(p => p.status === 200));
  t('pages of 500, 500, 500 then 0', pages.map(p => p.json.length).join() === '500,500,500,0', pages.map(p => p.json.length).join());
  const ids = pages.flatMap(p => p.json.map(r => r.id));
  t('the three pages hold 1,500 different rows (no duplicates)', new Set(ids).size === 1500 && ids.length === 1500, new Set(ids).size + ' of ' + ids.length);
  const phones = new Set(pages.flatMap(p => p.json.map(r => r.phone)));
  t('no gaps: every one of the 1,500 customers is on a page', [...Array(1500).keys()].every(i => phones.has(phoneOf(i + 1))));
  const again = await GET('?limit=500&offset=500');
  t('the same page twice gives the same rows in the same order', JSON.stringify(again.json.map(r => r.id)) === JSON.stringify(pages[1].json.map(r => r.id)));
  const big = await GET('?limit=5000'); t('a limit over 500 is cut to 500', big.json.length === 500, String(big.json.length));
  const none = await GET(''); t('no limit gives one page of 500', none.json.length === 500, String(none.json.length));
  const ten = await GET('?limit=10&offset=3'); t('limit 10 offset 3 gives rows 4 to 13 of the order', JSON.stringify(ten.json.map(r => r.id)) === JSON.stringify(pages[0].json.slice(3, 13).map(r => r.id)));
  const junk = await GET('?limit=abc&offset=-7'); t('a junk limit and a negative offset fall back to 500 from 0', junk.json.length === 500 && junk.json[0].id === pages[0].json[0].id, String(junk.json.length));
  const p = await S.store.list(SLUG, 'customers', { limit: 3, offset: 0 });
  t('store.list takes { limit, offset }', Array.isArray(p) && p.length === 3, String(p && p.length));
});
await safe('exact phone lookup', async () => {
  t('store.findBy exists', typeof store.findBy === 'function');
  const one = await store.findBy(SLUG, 'customers', 'phone', phoneOf(1400), { limit: 1 });
  t('findBy finds customer 1,400 by phone, one record', one.length === 1 && one[0].name === 'Customer 1400', JSON.stringify(one));
  t('findBy finds nothing for an unknown phone', (await store.findBy(SLUG, 'customers', 'phone', '0700000000')).length === 0);
  const login = (await imp('app/api/login/route.js')).POST;
  const code = issueCode(SLUG, phoneOf(1400)); listed.length = 0;
  const r = await login(new Request('http://check.local/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: SLUG, kind: 'customer', phone: phoneOf(1400), code }) }));
  const j = await r.json();
  t('customer 1,400 signs in with their name', r.status === 200 && j.name === 'Customer 1400', r.status + ' ' + JSON.stringify(j).slice(0, 120));
  t('sign in did not list the customers', !listed.includes('customers'), listed.join());
  const otp = (await imp('app/api/otp/route.js')).POST; const was = process.env.NODE_ENV; process.env.NODE_ENV = 'development'; listed.length = 0;
  const o = await otp(new Request('http://check.local/api/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: SLUG, phone: phoneOf(1400) }) }));
  process.env.NODE_ENV = was;
  t('the text code route answers ok for customer 1,400', o.status === 200);
  t('the text code route did not list the customers', !listed.includes('customers'), listed.join());
});
await safe('a customer past 500 rows', async () => {
  await store.create(SLUG, 'jobs', { id: 'mine1', plate: 'MY-1', customerPhone: A_PHONE, branch: 'one', status: 'open', phases: [], approvals: [] });
  await store.create(SLUG, 'photos', { id: 'myph', jobId: 'mine1', phaseKey: 'body', dataUrl: 'data:image/png;base64,AA', by: 'S' });
  for (let i = 0; i < 520; i++) { await store.create(SLUG, 'jobs', { id: 'o' + i, plate: 'OT-' + i, customerPhone: '0799999999', branch: 'one', status: 'open', phases: [], approvals: [] });
    await store.create(SLUG, 'photos', { id: 'op' + i, jobId: 'o' + i, phaseKey: 'body', dataUrl: 'data:image/png;base64,AA', by: 'S' }); }
  listed.length = 0;
  const jobs = await GET('', 'custA', 'jobs'); const ph = await GET('', 'custA', 'photos'); const me = await GET('', 'custA', 'customers');
  t('a customer whose job is older than 500 others still gets it', jobs.status === 200 && jobs.json.length === 1 && jobs.json[0].id === 'mine1', JSON.stringify(jobs.json && jobs.json.map(x => x.id)));
  t('and still gets its photo', ph.json.length === 1 && ph.json[0].id === 'myph', String(ph.json && ph.json.length));
  t('customer reads did not list jobs or photos in full', !listed.includes('jobs') && !listed.includes('photos'), listed.join());
  await store.update(SLUG, 'jobs', 'o0', { spaceKey: 'bayZ' });
  for (let i = 0; i < 510; i++) await store.update(SLUG, 'jobs', 'o' + (i + 1), { notes: 'touch' });
  const r = await call(item.PATCH, req('PATCH', `/api/${SLUG}/jobs/o515`, tk.staff, { spaceKey: 'bayZ' }), { slug: SLUG, table: 'jobs', id: 'o515' });
  t('one car per space still holds when the holder is older than 500 other jobs', r.status === 409, String(r.status));
});
await safe('the web app reads every page', async () => {
  const m = await loadData(); const N = 1200;
  const rows = [...Array(N).keys()].map(i => ({ id: 'w' + i, plate: 'W' + i, customerPhone: '07', branch: 'one', status: 'open', phases: [], approvals: [], promiseHistory: [], createdAt: 'x', updatedAt: 'x' }));
  const calls = fakeFetch(async (u) => { const q = new URL(u); if (!/\/jobs$/.test(q.pathname)) return { status: 200, body: [] };
    const lim = Math.min(500, +q.searchParams.get('limit') || 500), off = +q.searchParams.get('offset') || 0; return { status: 200, body: rows.slice(off, off + lim) }; });
  const d = makeService(m, { kind: 'staff', name: 'Owner', owner: true }); await d.init();
  t('the web app loads all 1,200 jobs, page by page', d.jobs().length === N && new Set(d.jobs().map(j => j.id)).size === N, String(d.jobs().length));
  const jc = calls.filter(c => /\/jobs\?/.test(c.url)).map(c => new URL(c.url).searchParams.get('offset'));
  t('it asked for offsets 0, 500 and 1000', jc.join() === '0,500,1000', jc.join());
});
done('B4');
