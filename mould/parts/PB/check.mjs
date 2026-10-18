// PB: payments on the job, part B, the web app (data service, front desk seat, seed, screens). Written by Claude BEFORE the
// crew ran (18 Oct 2026); it must FAIL on 7e93aa0.   node mould/parts/PB/check.mjs [--only static,local,api,screens]
//   STATIC   models, session, data service, seed, the demo garage cast (a desk seat, Auto Museum's cast untouched), the four
//            pages read as text; the lines added since 7e93aa0 keep the house style.
//   LOCAL    data.service.ts bundled with the API2 web harness, LOCAL mode on the demo garage cast and its seed: the seed's old
//            paid figures are payment lines now; desk records, staff is refused, desk cannot correct, owner corrects.
//   API      the same file in API mode with a fake fetch: Record payment and Correct are POSTs with the version and an op, and
//            no write sends paid any more.
//   SCREENS  a development build on this Mac, the DEMO GARAGE cast (Blue Bay Motors, asserted by the page title before anything
//            is judged), local mode, at 390 and 1440: the money each seat sees and does not, the desk records a payment, two
//            refusals in the sheet's message slot, the owner's Undo and Correct, the customer page, Deliver refused in its sheet.
//            Screenshots to evidence/PB/<screen>-<width>.png (job-owner, job-desk, job-staff, record-sheet, customer).
import { readFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
const APP = join(ROOT, 'apps', 'web', 'src', 'app'); const BASE_REF = '7e93aa0';
const args = process.argv.slice(2); const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const want = k => onlyArg ? onlyArg.includes(k) : true;
let n = 0, bad = 0; const rows = [];
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
async function safe(name, fn){ try { await fn(); } catch (e) { t(name + ' did not crash', false, String(e && e.stack || e).slice(0, 300)); } }
const read = rel => { try { return readFileSync(join(APP, rel), 'utf8'); } catch { return ''; } };
const at = (ref, path) => { try { return execFileSync('git', ['show', ref + ':' + path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch { return ''; } };
/* the body of a method: from "name(" to its matching closing brace (the brace after the parameters and any return type) */
function body(src, name){ const i = src.search(new RegExp('\\b(async\\s+)?' + name + '\\s*\\(')); if (i < 0) return ''; const mo = /(\)|>)\s*\{/g; mo.lastIndex = i; const mm = mo.exec(src); if (!mm) return ''; const o = mm.index + mm[0].length - 1; let d = 0;
  for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return src.slice(i); }
const W409 = 'Someone else changed this car a moment ago. It has been refreshed: make your change again.';
const W403 = 'This seat cannot do that.';
const OLD_PAID = { j2: 18000, j3: 50000, j5: 30000, j6: 45000, j8: 88000, j9: 26000, j10: 22000, j13: 60000 };
const localDay = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------- STATIC ---------- */
if (want('static')) await safe('static', async () => {
  const models = read('core/models.ts');
  t('models: Role adds desk', /export type Role\s*=[^;]*'desk'/.test(models));
  t('models: Job imports the Payment type from core/payments', /import\s*(type\s*)?\{[^}]*\bPayment\b[^}]*\}\s*from\s*'\.\/payments'/.test(models));
  const jobType = (models.match(/export interface Job \{[\s\S]*?\n\}/) || [''])[0];
  t('models: Job gains payments?: Payment[] and balance?: number', /payments\?\s*:\s*Payment\[\]/.test(jobType) && /balance\?\s*:\s*number/.test(jobType));
  t('models: an activity can be a payment', /type:\s*'phase'[^;]*'payment'/.test(models));
  const sess = read('core/session.service.ts');
  t('session: a desk signal (role desk)', /readonly desk\s*=\s*computed\(\s*\(\)\s*=>\s*this\.role\(\)\s*===\s*'desk'\s*\)/.test(sess));
  t('session: a collects signal (owner or desk)', /readonly collects\s*=\s*computed\(/.test(sess) && /collects[^\n]*'owner'[^\n]*'desk'|collects[^\n]*'desk'[^\n]*'owner'/.test(sess));
  const ds = read('core/data.service.ts');
  t('data: recordPayment and correctPayment exist', /async recordPayment\(\s*jobId/.test(ds) && /async correctPayment\(\s*jobId/.test(ds));
  t('data: recordPayment uses the engine record and nextNo', /\brecord\(/.test(body(ds, 'recordPayment')) && /\bnextNo\(/.test(body(ds, 'recordPayment')));
  t('data: correctPayment uses the engine reverse', /\breverse\(/.test(body(ds, 'correctPayment')));
  t('data: api paths jobs/<id>/payments and payments/<pid>/reverse', /'payments'/.test(body(ds, 'recordPayment')) && /payments\/'\s*\+[^\n]*'\/reverse'|`payments\/\$\{[^}]+\}\/reverse`/.test(body(ds, 'correctPayment')));
  const nj = body(ds, 'newJob');
  t('data: newJob sends no paid (the server refuses it)', !!nj && !/\bpaid\s*:/.test(nj), (nj.match(/[^\n]*\bpaid\s*:[^\n]*/) || [''])[0].trim().slice(0, 90));
  const sm = body(ds, 'setMoney');
  t('data: setMoney no longer takes or sends paid', !!sm && !/\bpaid\b/.test(sm));
  const seed = read('core/seed.ts');
  t('seed: version bumped past 6', +((seed.match(/SEED_VERSION\s*=\s*(\d+)/) || [])[1] || 0) > 6);
  t('seed: no job carries a typed paid figure', !/\bpaid\s*:/.test(seed));
  t('seed: payment lines numbered with nextNo', /\bnextNo\(/.test(seed));
  for (const p of ['casts/demo-garage.json', 'apps/web/public/casts/demo-garage.json']) {
    let c = null; try { c = JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch {}
    const u = c && (c.users || []).find(x => x.name === 'Sachini');
    t(`${p}: a desk seat Sachini, branch bora, PIN 4444`, !!u && u.role === 'desk' && u.branch === 'bora' && u.pin === '4444', JSON.stringify(u || null));
  }
  for (const p of ['casts/auto-museum.json', 'apps/web/public/casts/auto-museum.json']) t(`${p} is not changed`, readFileSync(join(ROOT, p), 'utf8') === at(BASE_REF, p));
  const job = read('pages/workshop/job.component.ts');
  t('job card: the owner money sheet loses Paid so far', !/Paid so far/.test(job) && !/m\.paid/.test(job));
  t('job card: the money sheet says paid is worked out from the payments', /worked out from the payments/.test(job));
  t('job card: Record payment and Correct call the data service', /data\.recordPayment\(/.test(job) && /data\.correctPayment\(/.test(job));
  t('job card: the method chips are Cash, Card, Bank transfer, Cheque', ['Cash', 'Card', 'Bank transfer', 'Cheque'].every(w => job.includes("'" + w + "'")));
  t('job card: no typed paid figure is read', !/\.paid\b/.test(job));
  const money = read('pages/workshop/money.component.ts');
  t('money screen: still to collect uses balanceOf', /balanceOf\(/.test(money) && !/\.paid\b/.test(money));
  const cust = read('pages/customer/job.component.ts');
  t('customer page: a Payments card from the engine', /\blines\(/.test(cust) && /balanceOf\(|paidOf\(/.test(cust));
  t('customer page: the estimate is never read', !/estimate/i.test(cust));
  const bads = [];
  for (const rel of ['core/models.ts', 'core/session.service.ts', 'core/data.service.ts', 'core/seed.ts', 'core/selftest.ts', 'pages/workshop/job.component.ts', 'pages/workshop/money.component.ts', 'pages/customer/job.component.ts']) {
    const was = new Set(at(BASE_REF, 'apps/web/src/app/' + rel).split('\n').map(l => l.trim()));
    read(rel).split('\n').forEach((l, k) => { if (was.has(l.trim())) return; const where = `${rel}:${k + 1}`;
      const strs = (l.match(/'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"/g) || []).join(' ');
      if (/[–—]/.test(l)) bads.push(where + ' an em or en dash');
      if (/,\s+(and|or|but|nor)\b/i.test(strs)) bads.push(where + ' a comma before and/or/but/nor in words');
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l)) bads.push(where + ' a new colour');
      if (/@Component\s*\(/.test(l)) bads.push(where + ' a new component');
      if (/\b(color|behavior|center|honor|favor|organize|realize|canceled)\b/i.test(strs)) bads.push(where + ' a US spelling in words'); });
  }
  t('the lines added since 7e93aa0 keep the house style (no dash, no serial comma, no new colour or component, British English)', bads.length === 0, bads.slice(0, 3).join(' | '));
});

/* ---------- LOCAL: the demo garage, its seed, the rules ---------- */
const castFile = JSON.parse(readFileSync(join(ROOT, 'apps', 'web', 'public', 'casts', 'demo-garage.json'), 'utf8'));
async function service(m, seat, cast, api){
  globalThis.__wosInject = cls => cls.name === 'CastService' ? { cast: () => cast, config: () => ({ api: api || '' }), branch: () => null }
    : { name: () => seat.name, kind: () => seat.kind, phone: () => seat.phone || '', token: () => 'tok-' + seat.name, role: () => seat.role || '', branch: () => '',
        owner: () => seat.role === 'owner', desk: () => seat.role === 'desk', collects: () => seat.role === 'owner' || seat.role === 'desk' };
  const d = new m.DataService(); await d.init(); return d;
}
if (want('local')) await safe('local', async () => {
  const { loadData } = await import('../API2/webharness.mjs');
  const pen = new Proxy({}, { get: () => () => {}, set: () => true });
  globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => pen, toDataURL: () => 'data:image/jpeg;base64,AA' }), documentElement: { getAttribute: () => null } };
  const m = await loadData();
  const seat = { kind: 'staff', name: 'Sachini', role: 'desk' };
  localStorage.clear(); const d = await service(m, seat, castFile);
  const jobs = d.jobs(); t('local: the demo garage floor loads', d.mode() === 'local' && jobs.length > 10, jobs.length + ' jobs');
  const paidOf = j => (j.payments || []).reduce((a, p) => a + (p.reverses ? -p.amount : p.amount), 0);
  const balance = j => (j.approved || 0) - paidOf(j);
  t('local: no seed job carries a typed paid figure', jobs.every(j => !('paid' in j)), jobs.filter(j => 'paid' in j).map(j => j.id).join(','));
  const seedOk = Object.entries(OLD_PAID).map(([id, v]) => { const j = jobs.find(x => x.id === id); return j && paidOf(j) === v && (j.payments || []).length === 1; });
  t('local: every old paid figure is now one payment line of the same money', seedOk.every(Boolean), Object.keys(OLD_PAID).filter((k, i) => !seedOk[i]).join(','));
  const all = jobs.flatMap(j => (j.payments || []).map(p => ({ j, p })));
  t('local: the seed lines are cash, dated a day after the car came in', all.length > 0 && all.every(({ j, p }) => p.method === 'cash' && p.at === new Date(new Date(j.createdAt).getTime() + 86400000).toISOString().slice(0, 10)), all.slice(0, 2).map(({ j, p }) => j.id + ' ' + p.at + ' ' + j.createdAt.slice(0, 10)).join('; '));
  const nos = all.map(x => x.p.no);
  t('local: the seed receipt numbers are R-YYYYMM-NNN and never repeat', nos.length > 0 && nos.every(x => /^R-\d{6}-\d{3}$/.test(x)) && new Set(nos).size === nos.length, nos.slice(0, 3).join(','));
  // the desk records a payment on the Vezel (j3: approved 145000, 50000 paid)
  const j3 = d.job('j3'); const before = balance(j3); const today = localDay();
  const month = 'R-' + today.slice(0, 4) + today.slice(5, 7) + '-'; const expect = month + String(nos.filter(x => x.startsWith(month)).length + 1).padStart(3, '0');
  let r = null, e = null; try { r = await d.recordPayment('j3', { amount: 5000, method: 'card', at: today, note: 'Half now' }); } catch (x) { e = x; }
  t('local: the desk records a payment', !e && !!r, e && e.message);
  const after = d.job('j3'); const line = (after.payments || []).find(p => p.amount === 5000 && p.method === 'card');
  t('local: the balance drops by the amount', balance(after) === before - 5000, before + ' to ' + balance(after));
  t('local: the line carries the next receipt number, the seat and the note', !!line && line.no === expect && line.by === 'Sachini' && line.note === 'Half now', line ? line.no + ' ' + line.by : 'no line');
  t('local: recordPayment answers the job and the line', !!r && r.payment && r.payment.no === expect && r.job && r.job.id === 'j3', JSON.stringify(r && r.payment && r.payment.no));
  t('local: an activity line says Payment recorded with the number', d.activityFor('j3').some(a => a.type === 'payment' && a.summary.includes(expect)), d.activityFor('j3').slice(0, 2).map(a => a.summary).join(' | '));
  for (const [inp, words] of [[{ amount: balance(after) + 1, method: 'cash', at: today }, 'That is more than the ' + balance(after) + ' still owed on this car'], [{ amount: 100, method: 'cash', at: localDay(Date.now() + 2 * 86400000) }, 'The date cannot be in the future']]) {
    let er = null; try { await d.recordPayment('j3', inp); } catch (x) { er = x; }
    t(`local: refused with part A's words: ${words}`, er && er.message === words && balance(d.job('j3')) === balance(after), er && er.message);
  }
  let er = null; try { await d.correctPayment('j3', line && line.id); } catch (x) { er = x; }
  t('local: the desk cannot correct a payment', er && er.message === W403, er && er.message);
  seat.role = 'staff'; seat.name = 'Chamara'; er = null; try { await d.recordPayment('j3', { amount: 100, method: 'cash', at: today }); } catch (x) { er = x; }
  t('local: a plain staff seat cannot record a payment', er && er.message === W403, er && er.message);
  seat.role = 'owner'; seat.name = 'Ravi'; er = null; try { await d.correctPayment('j3', line && line.id); } catch (x) { er = x; }
  t('local: the owner corrects it and the balance returns', !er && balance(d.job('j3')) === before, er ? er.message : String(balance(d.job('j3'))));
  t('local: the correction is a reversal line, the payment stays', (d.job('j3').payments || []).some(p => p.reverses === (line && line.id)) && (d.job('j3').payments || []).some(p => p.id === (line && line.id)));
  er = null; try { await d.correctPayment('j3', line && line.id); } catch (x) { er = x; }
  t('local: a second correction is refused with the engine words', er && er.message === 'This payment is already corrected', er && er.message);
});

/* ---------- API: the requests ---------- */
if (want('api')) await safe('api', async () => {
  const { loadData, fakeFetch } = await import('../API2/webharness.mjs');
  const T0 = '2026-10-01T08:00:00.000Z';
  const job = (id, extra = {}) => ({ id, plate: 'P' + id, make: 'M', model: 'X', customerId: 'c1', customerName: 'Ama Perera', customerPhone: '0711111111', branch: 'one', service: 'paint', status: 'open', phases: [{ key: 'a', label: 'A', status: 'now', hours: 2 }], approvals: [], promiseHistory: [], pickup: { wanted: false, status: 'none' }, promisedAt: T0, createdAt: T0, updatedAt: T0, ...extra });
  const pay = { id: 'p1', no: 'R-202610-001', at: '2026-10-02', recordedAt: T0, amount: 4000, method: 'cash', by: 'Ama' };
  const calls = fakeFetch(async (u, init) => {
    const meth = init.method || 'GET';
    if (meth === 'GET') return { status: 200, body: /\/jobs\?/.test(u) ? [job('j1', { balance: 6000, payments: [pay] })] : /\/customers\?/.test(u) ? [{ id: 'c1', name: 'Ama Perera', phone: '0711111111', vehicles: [], createdAt: T0, updatedAt: T0 }] : [] };
    if (/\/payments\/p1\/reverse$/.test(u)) return { status: 200, body: job('j1', { balance: 10000, payments: [pay, { ...pay, id: 'p9', no: '', reverses: 'p1' }], updatedAt: '2026-10-03T08:00:00.000Z' }) };
    if (/\/payments$/.test(u)) return { status: 200, body: job('j1', { balance: 4000, payments: [pay, { ...pay, id: 'p2', no: 'R-202610-002', amount: 2000, method: 'bank' }], updatedAt: '2026-10-02T09:00:00.000Z' }) };
    if (/activities/.test(u)) return { status: 200, body: { id: 'a' + Math.random(), jobId: 'j1', type: 'note', summary: 's', by: 'Ama', createdAt: T0, updatedAt: T0 } };
    if (/\/customers/.test(u)) return { status: 200, body: { id: 'c2', name: 'New Person', phone: '0712222222', vehicles: [], createdAt: T0, updatedAt: T0 } };
    return { status: 200, body: job(String(u).split('/').pop().split('?')[0] || 'jx', { updatedAt: new Date().toISOString() }) };
  });
  const m = await loadData(); const seat = { kind: 'staff', name: 'Ama', role: 'desk' };
  const cast = { slug: 'tst', branches: [{ key: 'one', name: 'One', address: '', bays: 2 }], services: [{ key: 'paint', label: 'Paint', phases: [{ key: 'a', label: 'A', hours: 2 }, { key: 'ready', label: 'Ready', hours: 0 }] }], users: [], words: {}, data: { mode: 'api' } };
  const d = await service(m, seat, cast, 'http://api.check');
  let n0 = calls.length, e = null, r = null; try { r = await d.recordPayment('j1', { amount: 2000, method: 'bank', at: '2026-10-02', note: 'Transfer' }); } catch (x) { e = x; }
  const post = calls.slice(n0).find(c => c.method === 'POST' && /\/payments$/.test(c.url));
  t('api: Record payment is POST /api/<slug>/jobs/<id>/payments', !e && !!post && post.url === 'http://api.check/api/tst/jobs/j1/payments', e ? e.message : post && post.url);
  t('api: it carries the version header and an op', !!post && post.headers['x-wos-version'] === T0 && !!post.headers['x-wos-op'], post && JSON.stringify(post.headers));
  t('api: its body is amount, method, at and note', !!post && JSON.stringify(Object.keys(JSON.parse(post.body)).sort()) === JSON.stringify(['amount', 'at', 'method', 'note']), post && post.body);
  t('api: the reply replaces the job and the new line comes back', d.job('j1').balance === 4000 && !!r && r.payment && r.payment.no === 'R-202610-002', JSON.stringify(r && r.payment));
  seat.role = 'owner'; n0 = calls.length; e = null; try { await d.correctPayment('j1', 'p1'); } catch (x) { e = x; }
  const rev = calls.slice(n0).find(c => c.method === 'POST' && /reverse$/.test(c.url));
  t('api: Correct is POST /api/<slug>/jobs/<id>/payments/<pid>/reverse with the version and an op', !e && !!rev && rev.url === 'http://api.check/api/tst/jobs/j1/payments/p1/reverse' && rev.headers['x-wos-version'] === '2026-10-02T09:00:00.000Z' && !!rev.headers['x-wos-op'], e ? e.message : rev && rev.url + ' ' + JSON.stringify(rev.headers));
  t('api: the corrected job replaces the old one', d.job('j1').balance === 10000);
  seat.role = 'desk'; e = null; try { await d.correctPayment('j1', 'p2'); } catch (x) { e = x; }
  t('api: the desk is refused a correction before any request', e && e.message === W403, e && e.message);
  seat.role = 'staff'; n0 = calls.length; e = null; try { await d.recordPayment('j1', { amount: 1, method: 'cash', at: '2026-10-02' }); } catch (x) { e = x; }
  t('api: a plain staff seat is refused before any request', e && e.message === W403 && calls.slice(n0).every(c => c.method === 'GET'), e && e.message);
  seat.role = 'owner'; n0 = calls.length;
  await d.newJob({ plate: 'CAB-1', make: 'Toyota', model: 'Aqua', customerName: 'New Person', customerPhone: '0712222222', branch: 'one', service: 'paint', insurance: false, pickup: false, promisedAt: T0, estimate: 5000 }).catch(x => { e = x; });
  const create = calls.slice(n0).find(c => c.method === 'POST' && /\/api\/tst\/jobs$/.test(c.url));
  t('api: a new job is created without paid', !!create && !('paid' in JSON.parse(create.body)), create ? create.body.slice(0, 120) : 'no POST /jobs');
  n0 = calls.length; await d.setMoney('j1', { estimate: 1, approved: 2, paid: 3 }).catch(x => { e = x; });
  const patch = calls.slice(n0).find(c => c.method === 'PATCH');
  t('api: setMoney sends estimate and approved only', !!patch && JSON.stringify(Object.keys(JSON.parse(patch.body)).sort()) === JSON.stringify(['approved', 'estimate']), patch ? patch.body : 'no PATCH');
});

/* ---------- SCREENS ---------- */
if (want('screens')) await safe('screens', async () => {
  const OUT = mkdtempSync(join(tmpdir(), 'wos-pb-')); const WEB = join(ROOT, 'apps', 'web');
  const env = { ...process.env, PATH: process.env.HOME + '/.local/node/bin:' + process.env.PATH, NG_CLI_ANALYTICS: 'false' };
  const b = spawnSync('npx', ['ng', 'build', '--configuration', 'development', '--output-path', OUT], { cwd: WEB, env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 540000 });
  t('a development build of the app compiles', b.status === 0 && existsSync(join(OUT, 'browser', 'index.html')), (b.stderr || b.stdout || '').split('\n').filter(x => /rror/.test(x)).slice(0, 3).join(' | '));
  if (b.status !== 0) return;
  const { serve, chromium, context } = await import('../../../scripts/lib/world.mjs');
  const { srv, base } = serve(join(OUT, 'browser'));
  const EV = join(ROOT, 'evidence', 'PB'); mkdirSync(EV, { recursive: true });
  const KEY = 'wos_demo-garage';
  const browser = await chromium.launch();
  const login = async (p, who, pin) => { await p.goto(base + '?c=demo-garage#/workshop/login'); await p.waitForSelector('#who'); await p.fill('#who', who); await p.fill('#pin', pin); await p.click('button[type=submit]');
    try { await p.waitForFunction(() => /#\/workshop(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 }); await p.waitForSelector('.topbar'); return true; } catch { return false; } };
  const brand = async (p, w, who, signed = true) => { t(`${w} ${who}: the seat signs in`, signed); if (!signed) return false; const title = await p.title(); t(`${w} ${who}: the page is the demo garage (Blue Bay Motors)`, title === 'Blue Bay Motors', title); return title === 'Blue Bay Motors'; };
  const openJob = async (p, id) => { await p.goto(base + '?c=demo-garage#/workshop/job/' + id); await p.waitForSelector('bb-ws-job .head'); await p.waitForTimeout(600); };
  const card = p => p.evaluate(() => (document.querySelector('bb-ws-job')?.innerText || ''));
  const moneyText = p => p.evaluate(() => (document.querySelector('bb-ws-job .money')?.innerText || ''));
  const figs = p => p.evaluate(() => [...document.querySelectorAll('bb-ws-job .money .fig')].map(f => ({ k: (f.querySelector('em')?.textContent || '').trim(), v: (f.querySelector('strong')?.textContent || '').replace(/\s+/g, ' ').trim(), num: !!f.querySelector('.num') })));
  const payRows = p => p.evaluate(sel => [...document.querySelectorAll(sel + ' .pay')].map(r => ({ text: r.innerText.replace(/\s+/g, ' ').trim(), no: (r.querySelector('.no')?.textContent || '').trim(), gone: r.classList.contains('gone'), fix: !!r.querySelector('.pay-fix') })), 'bb-ws-job .money');
  const toastText = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText.replace(/\s+/g, ' ').trim()).join(' || '));
  const slot = p => p.evaluate(() => (document.querySelector('.drawer.on [foot] .msg')?.textContent || '').trim());
  const nextNo = p => p.evaluate(key => { const d = JSON.parse(localStorage.getItem(key) || '{}'); const t0 = new Date(); const day = t0.getFullYear() + '-' + String(t0.getMonth() + 1).padStart(2, '0') + '-' + String(t0.getDate()).padStart(2, '0');
    const pre = 'R-' + day.slice(0, 4) + day.slice(5, 7) + '-'; const c = (d.jobs || []).flatMap(j => j.payments || []).filter(x => x.no && x.no.startsWith(pre)).length; return { no: pre + String(c + 1).padStart(3, '0'), day }; }, KEY);
  const fig = (list, k) => (list.find(f => f.k === k) || {}).v || '';
  try {
    for (const [w, desk] of [[390, false], [1440, true]]) {
      /* ---- the front desk ---- */
      let c = await context(browser, { width: w, desk }); let p = await c.newPage(); let errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      const in_desk = await login(p, 'Sachini', '4444');
      if (await brand(p, w, 'desk', in_desk)) {
        await openJob(p, 'j3');
        const f = await figs(p); const mt = await moneyText(p);
        t(`${w} desk: the money card shows the balance only`, f.length === 1 && f[0].k === 'Balance' && /95,000/.test(f[0].v) && f[0].num, JSON.stringify(f));
        t(`${w} desk: no estimate, approved or paid figure`, !/Estimate|Approved/.test(mt) && !/145,000/.test(await card(p)), mt.slice(0, 120));
        let pr = await payRows(p);
        t(`${w} desk: the payment line shows with its receipt number`, pr.length === 1 && /^R-\d{6}-\d{3}$/.test(pr[0].no) && /50,000/.test(pr[0].text) && /Cash/.test(pr[0].text), JSON.stringify(pr));
        t(`${w} desk: no Correct button for the desk`, pr.every(r => !r.fix) && await p.locator('bb-ws-job .pay-fix').count() === 0);
        t(`${w} desk: Record payment is there`, await p.locator('bb-ws-job .money .pay-add').count() === 1);
        const exp = await nextNo(p);
        await p.locator('bb-ws-job .money .pay-add').click(); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(450);
        const sheet = await p.evaluate(() => { const d = document.querySelector('.drawer.on'); const foot = d.querySelector('[foot]'); const btns = [...foot.querySelectorAll('.btn')];
          return { title: d.querySelector('.d-head h3')?.textContent.trim(), amount: d.querySelector('#pya')?.value, type: d.querySelector('#pya')?.type, date: d.querySelector('#pyd')?.value, max: d.querySelector('#pyd')?.getAttribute('max'), note: !!d.querySelector('#pyn'),
            chips: [...d.querySelectorAll('.chips button')].map(b => b.textContent.trim()), on: [...d.querySelectorAll('.chips button.on')].map(b => b.textContent.trim()),
            first: btns[0]?.textContent.trim(), firstW: btns[0] ? Math.round(btns[0].getBoundingClientRect().width) : 0, footW: Math.round(foot.getBoundingClientRect().width), last: foot.lastElementChild?.textContent.trim(), lastQuiet: !!foot.lastElementChild?.classList.contains('quiet') }; });
        t(`${w} record sheet: titled Record payment`, sheet.title === 'Record payment', sheet.title);
        t(`${w} record sheet: the amount is a number and starts at the balance`, sheet.type === 'number' && sheet.amount === '95000', sheet.type + ' ' + sheet.amount);
        t(`${w} record sheet: four method chips Cash, Card, Bank transfer, Cheque, one chosen`, sheet.chips.join('|') === 'Cash|Card|Bank transfer|Cheque' && sheet.on.length === 1, sheet.chips.join('|') + ' on ' + sheet.on.join('|'));
        t(`${w} record sheet: the date starts today and cannot pass today`, sheet.date === exp.day && sheet.max === exp.day, sheet.date + ' max ' + sheet.max);
        t(`${w} record sheet: an optional note`, sheet.note);
        t(`${w} record sheet: one action bar, Record payment full width first, a quiet Cancel last`, sheet.first === 'Record payment' && Math.abs(sheet.firstW - sheet.footW) <= 1.5 && sheet.last === 'Cancel' && sheet.lastQuiet, JSON.stringify({ f: sheet.first, w: sheet.firstW, of: sheet.footW, l: sheet.last }));
        await p.screenshot({ path: join(EV, `record-sheet-${w}.png`) });
        const save = p.locator('.drawer.on [foot] .btn', { hasText: 'Record payment' });
        await p.fill('#pya', '95001'); await save.click(); await p.waitForTimeout(400);
        t(`${w} record sheet: more than the balance is refused in the sheet's message slot`, await slot(p) === 'That is more than the 95000 still owed on this car' && await p.locator('.drawer.on').count() === 1 && !/still owed/.test(await toastText(p)), (await slot(p)) + ' / toast: ' + (await toastText(p)));
        const tomorrow = await p.evaluate(() => { const d = new Date(Date.now() + 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
        await p.fill('#pya', '5000'); await p.fill('#pyd', tomorrow); await save.click(); await p.waitForTimeout(400);
        t(`${w} record sheet: a future date is refused in the sheet's message slot`, await slot(p) === 'The date cannot be in the future' && await p.locator('.drawer.on').count() === 1, await slot(p));
        await p.fill('#pyd', exp.day); await p.locator('.drawer.on .chips button', { hasText: 'Card' }).click(); await save.click(); await p.waitForTimeout(600);
        t(`${w} desk: the sheet closes after the save`, await p.locator('.drawer.on').count() === 0);
        const tt = await toastText(p);
        t(`${w} desk: the toast says Recorded, the number, the money and the method`, tt.startsWith('Recorded ' + exp.no + ', LKR 5,000 card') || tt.startsWith('Recorded ' + exp.no + ', LKR 5,000 card'), tt);
        t(`${w} desk: the desk toast has no Undo`, !/Undo/.test(tt) && await p.locator('.toast button', { hasText: 'Undo' }).count() === 0, tt);
        const f2 = await figs(p); pr = await payRows(p);
        t(`${w} desk: the balance drops by the amount`, /90,000/.test(fig(f2, 'Balance')), fig(f2, 'Balance'));
        t(`${w} desk: a line with the next receipt number appears`, pr.length === 2 && pr.some(r => r.no === exp.no && /5,000/.test(r.text) && /Card/.test(r.text) && /Sachini/.test(r.text)), JSON.stringify(pr.map(r => r.text)));
        await p.evaluate(() => scrollTo(0, 0)); await p.locator('bb-ws-job .money').scrollIntoViewIfNeeded();
        await p.screenshot({ path: join(EV, `job-desk-${w}.png`) });
      }
      t(`${w} desk: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();

      /* ---- the owner ---- */
      c = await context(browser, { width: w, desk }); p = await c.newPage(); errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      const in_owner = await login(p, 'Ravi', '1111');
      if (await brand(p, w, 'owner', in_owner)) {
        await openJob(p, 'j3');
        const f = await figs(p);
        t(`${w} owner: Estimate, Approved, Paid and Balance, in tabular figures`, f.map(x => x.k).join('|') === 'Estimate|Approved|Paid|Balance' && f.every(x => x.num), f.map(x => x.k).join('|'));
        t(`${w} owner: paid and balance are worked out from the lines`, /50,000/.test(fig(f, 'Paid')) && /95,000/.test(fig(f, 'Balance')) && /145,000/.test(fig(f, 'Approved')), JSON.stringify(f));
        let pr = await payRows(p);
        t(`${w} owner: each live line has Correct`, pr.length === 1 && pr[0].fix && !pr[0].gone, JSON.stringify(pr));
        await p.locator('bb-ws-job .money').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(EV, `job-owner-${w}.png`) });
        await p.locator('bb-ws-job .money button', { hasText: 'Edit' }).click(); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(400);
        const ms = await p.evaluate(() => document.querySelector('.drawer.on')?.innerText || '');
        t(`${w} owner: the money sheet has no Paid so far and says paid is worked out from the payments`, !/Paid so far/.test(ms) && /worked out from the payments/.test(ms) && await p.locator('.drawer.on #mp').count() === 0, ms.replace(/\s+/g, ' ').slice(0, 140));
        await p.keyboard.press('Escape'); await p.waitForTimeout(400);
        const exp = await nextNo(p);
        await p.locator('bb-ws-job .money .pay-add').click(); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(400);
        await p.fill('#pya', '2000'); await p.locator('.drawer.on [foot] .btn', { hasText: 'Record payment' }).click(); await p.waitForTimeout(600);
        const tt = await toastText(p);
        t(`${w} owner: the owner's toast carries Undo`, tt.startsWith('Recorded ' + exp.no) && await p.locator('.toast button', { hasText: 'Undo' }).count() === 1, tt);
        t(`${w} owner: the balance drops by 2,000`, /93,000/.test(fig(await figs(p), 'Balance')), fig(await figs(p), 'Balance'));
        await p.locator('.toast button', { hasText: 'Undo' }).click(); await p.waitForTimeout(700);
        pr = await payRows(p); const undone = pr.find(r => r.no === exp.no);
        t(`${w} owner: Undo corrects that payment and the balance returns`, /95,000/.test(fig(await figs(p), 'Balance')) && !!undone && undone.gone && /Corrected/.test(undone.text) && !undone.fix, JSON.stringify(undone));
        const live = pr.find(r => !r.gone);
        await p.locator('bb-ws-job .money .pay:not(.gone) .pay-fix').first().click(); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(400);
        const q = await p.evaluate(() => (document.querySelector('.drawer.on .d-body')?.innerText || '').replace(/\s+/g, ' ').trim());
        t(`${w} owner: Correct asks first, in the agreed words`, q.includes('Correct ' + (live && live.no) + ', LKR 50,000? The payment stays in the history with its correction.') || q.includes('Correct ' + (live && live.no) + ', LKR 50,000? The payment stays in the history with its correction.'), q.slice(0, 140));
        await p.locator('.drawer.on [foot] .btn').first().click(); await p.waitForTimeout(700);
        pr = await payRows(p);
        t(`${w} owner: the correction leaves the line in the history marked Corrected and the balance back at the approved total`, /145,000/.test(fig(await figs(p), 'Balance')) && pr.length === 2 && pr.every(r => r.gone && /Corrected/.test(r.text)), JSON.stringify(pr.map(r => r.text)));
        // Deliver refused: the words in the sheet's own message slot, not a toast
        await openJob(p, 'j6'); await p.click('bb-ws-job .big.ok'); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(450);
        await p.evaluate(w409 => { const cmp = window.ng.getComponent(document.querySelector('bb-ws-job')); cmp.data.deliver = async () => { const e = new Error(w409); e.status = 409; throw e; }; }, W409);
        await p.locator('.drawer.on button:has-text("Delivered")').click(); await p.waitForTimeout(450);
        const vis = await p.evaluate(w409 => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes(w409) && getComputedStyle(x).display !== 'none'), W409);
        t(`${w} owner: a refused Deliver shows in the sheet's message slot, not a toast`, await slot(p) === W409 && !vis && await p.locator('.drawer.on').count() === 1, (await slot(p)) + (vis ? ' / also a toast' : ''));
      }
      t(`${w} owner: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();

      /* ---- plain staff ---- */
      c = await context(browser, { width: w, desk }); p = await c.newPage(); errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      const in_staff = await login(p, 'Chamara', '2222');
      if (await brand(p, w, 'staff', in_staff)) {
        await openJob(p, 'j3'); const txt = await card(p);
        const hits = ['LKR', '145,000', '145000', '95,000', '95000', '50,000', '50000', 'R-20', 'Balance', 'Paid', 'Estimate', 'Approved', 'Record payment'].filter(x => txt.includes(x));
        t(`${w} staff: no money block`, await p.locator('bb-ws-job .money').count() === 0);
        t(`${w} staff: no currency word or money digits anywhere on the job card`, hits.length === 0, hits.join(', '));
        await p.screenshot({ path: join(EV, `job-staff-${w}.png`) });
      }
      t(`${w} staff: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();

      /* ---- the customer ---- */
      c = await context(browser, { width: w, desk }); p = await c.newPage(); errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      await p.goto(base + '?c=demo-garage#/car/login'); await p.waitForSelector('#ph'); await p.fill('#ph', '0771234567'); await p.click('button[type=submit]'); await p.waitForSelector('#code'); await p.fill('#code', '1234'); await p.click('button[type=submit]');
      await p.waitForFunction(() => /#\/car(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 });
      if (await brand(p, w, 'customer')) {
        /* a strict test: the Aqua's estimate differs from its approved total, and it carries a live line and a corrected one */
        const day = (await nextNo(p)).day; const pre = 'R-' + day.slice(0, 4) + day.slice(5, 7) + '-';
        await p.evaluate(([key, day, pre]) => { const d = JSON.parse(localStorage.getItem(key)); const j = d.jobs.find(x => x.id === 'j1'); j.estimate = 211000; const now = new Date().toISOString();
          j.payments = [{ id: 'tp1', no: pre + '901', at: day, recordedAt: now, amount: 25000, method: 'bank', by: 'Ravi' }, { id: 'tp2', no: pre + '902', at: day, recordedAt: now, amount: 10000, method: 'cheque', by: 'Ravi' }, { id: 'tp3', no: '', at: day, recordedAt: now, amount: 10000, method: 'cheque', by: 'Ravi', reverses: 'tp2' }];
          localStorage.setItem(key, JSON.stringify(d)); }, [KEY, day, pre]);
        await p.reload(); await p.waitForTimeout(600); await p.goto(base + '?c=demo-garage#/car/job/j1'); await p.waitForSelector('bb-car-job .hero'); await p.waitForTimeout(1000);
        const v = await p.evaluate(() => { const c = document.querySelector('bb-car-job .pays'); return { has: !!c, text: (c?.innerText || '').replace(/\s+/g, ' '), body: document.body.innerText,
          figs: [...(c?.querySelectorAll('.fig') || [])].map(f => ({ k: (f.querySelector('em')?.textContent || '').trim(), v: (f.querySelector('strong')?.textContent || '').trim(), num: !!f.querySelector('.num') })),
          rows: [...(c?.querySelectorAll('.pay') || [])].map(r => ({ text: r.innerText.replace(/\s+/g, ' ').trim(), no: (r.querySelector('.no')?.textContent || '').trim(), gone: r.classList.contains('gone') })) }; });
        t(`${w} customer: a Payments card`, v.has);
        t(`${w} customer: Total approved, Paid and Balance worked out from the lines`, v.figs.map(f => f.k).join('|') === 'Total approved|Paid|Balance' && /185,000/.test(v.figs[0]?.v || '') && /25,000/.test(v.figs[1]?.v || '') && /160,000/.test(v.figs[2]?.v || '') && v.figs.every(f => f.num), JSON.stringify(v.figs));
        t(`${w} customer: each line with its date, receipt number, amount and method`, v.rows.length === 2 && v.rows.some(r => r.no === pre + '901' && /25,000/.test(r.text) && /Bank transfer/.test(r.text) && !r.gone) && v.rows.some(r => r.no === pre + '902' && /Cheque/.test(r.text)), JSON.stringify(v.rows.map(r => r.text)));
        t(`${w} customer: a corrected line shows as Corrected`, v.rows.some(r => r.no === pre + '902' && r.gone && /Corrected/.test(r.text)), JSON.stringify(v.rows));
        t(`${w} customer: the estimate is never shown`, !/Estimate|estimate|211,000|211000/.test(v.body));
        await p.locator('bb-car-job .pays').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(EV, `customer-${w}.png`) });
        await p.goto(base + '?c=demo-garage#/car/job/j2'); await p.waitForSelector('bb-car-job .hero'); await p.waitForTimeout(900);
        const v2 = await p.evaluate(() => (document.querySelector('bb-car-job .pays')?.innerText || '').replace(/\s+/g, ' '));
        t(`${w} customer: a car paid in full says Paid in full`, /Paid in full/.test(v2) && /18,000/.test(v2), v2.slice(0, 140));
        await p.evaluate(key => { const d = JSON.parse(localStorage.getItem(key)); const j = d.jobs.find(x => x.id === 'j2'); j.approved = 0; j.payments = []; localStorage.setItem(key, JSON.stringify(d)); }, KEY);
        await p.reload(); await p.waitForTimeout(600); await p.goto(base + '?c=demo-garage#/car/job/j2'); await p.waitForSelector('bb-car-job .hero'); await p.waitForTimeout(900);
        t(`${w} customer: no card when nothing is approved and nothing paid`, await p.locator('bb-car-job .pays').count() === 0);
      }
      t(`${w} customer: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();
    }
  } finally { await browser.close(); srv.close(); }
});

console.log(rows.join('\n')); console.log(`PB: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}`); process.exit(bad ? 1 : 0);
