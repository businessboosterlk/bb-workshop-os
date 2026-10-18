// R: every Workshop OS screen that saves catches a refused save and shows the person why. Written by Claude BEFORE the
// crew ran (18 Oct 2026); it must FAIL on f142e06.   node mould/parts/R/check.mjs [--no-screens] [--only static,busy,r1,words,screens]
//   STATIC   every data.<write>( call in pages/ and ui/ sits inside a try whose catch shows <err>.message through toast( or
//            .set(; none is called from a template. Brace matching over a small tokenizer, not a regex guess.
//   BUSY     a method that saves and sets a busy flag true resets it inside a finally.
//   R1       data.service.ts bundled with the API2 web harness, api mode, a fake fetch: 409 and 428 with no words get rule 3's
//            words, keep .status and reload the lists (GETs counted) without draining the outbox; 403 gets its words; a 400
//            or 404 with words keeps them; local mode unchanged.
//   WORDS    lines added since f142e06 in the files this job may change: no em or en dash, no comma before and/or/but/nor,
//            no new colour, no new component.
//   SCREENS  a development build served on this Mac, a seat signed in, one save forced to throw by replacing the method on
//            the injected DataService through ng.getComponent (a check-only hook, nothing in product code): the job card
//            Deliver tap and the customer page rating show the words in the toast and the button works again. Screenshots
//            at 390 and 1440 wide to evidence/R/.
import { readFileSync, readdirSync, statSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
const APP = join(ROOT, 'apps', 'web', 'src', 'app');
const args = process.argv.slice(2); const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const want = k => (onlyArg ? onlyArg.includes(k) : true) && !(k === 'screens' && args.includes('--no-screens'));
let n = 0, bad = 0; const rows = [];
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
async function safe(name, fn){ try { await fn(); } catch (e) { t(name + ' did not crash', false, String(e && e.stack || e).slice(0, 300)); } }

export const WRITES = ['newJob', 'completePhase', 'setPromise', 'askApproval', 'answerApproval', 'setPickup', 'deliver', 'rate', 'setMoney', 'addNote', 'markFollowup',
  'saveCustomer', 'editJob', 'editEnquiry', 'addEnquiry', 'updateEnquiry', 'loseEnquiry', 'saveQuote', 'setQuoteStatus', 'placeCar', 'freeSpace', 'holdCar', 'releaseCar',
  'addPart', 'editPart', 'partArrived', 'partFitted'];
export const W409 = 'Someone else changed this car a moment ago. It has been refreshed: make your change again.';
export const W428 = 'This screen was out of date. It has been refreshed: make your change again.';
export const W403 = 'This seat cannot do that.';
const CHANGEABLE = ['ui/parts-list.component.ts', 'ui/space-card.component.ts', 'pages/workshop/parts.component.ts', 'pages/workshop/enquiries.component.ts', 'pages/workshop/quote.component.ts',
  'pages/workshop/new.component.ts', 'pages/workshop/floor.component.ts', 'pages/workshop/job.component.ts', 'pages/workshop/customers.component.ts', 'pages/customer/job.component.ts', 'core/data.service.ts'];

/* ---------- a small TypeScript tokenizer: what each character is, and every brace block with the code before it ---------- */
export function scan(src){
  const kind = new Array(src.length).fill('c'); const blocks = []; const stack = []; // stack items: { open, tpl } (tpl: a ${ inside a template)
  let i = 0, lastSig = ''; const tplDepth = [];
  const regexOk = () => !lastSig || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || /\b(return|typeof|case|in|of|delete|void)$/.test(lastSig);
  function template(){ // at the char after the opening backtick, or after a closing } of ${}
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\') { kind[i] = kind[i + 1] = 't'; i += 2; continue; }
      if (ch === '`') { kind[i] = 't'; i++; return 'end'; }
      if (ch === '$' && src[i + 1] === '{') { kind[i] = kind[i + 1] = 't'; stack.push({ open: i + 1, tpl: true, head: '' }); i += 2; return 'expr'; }
      kind[i] = 't'; i++;
    }
    return 'end';
  }
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '/' && nx === '/') { while (i < src.length && src[i] !== '\n') kind[i++] = 'm'; continue; }
    if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; for (; i < end; i++) kind[i] = 'm'; continue; }
    if (ch === '"' || ch === "'") { kind[i++] = 's'; while (i < src.length && src[i] !== ch) { if (src[i] === '\\') kind[i++] = 's'; kind[i++] = 's'; } kind[i++] = 's'; lastSig = 'x'; continue; }
    if (ch === '`') { kind[i++] = 't'; template(); lastSig = 'x'; continue; }
    if (ch === '/' && regexOk()) { kind[i++] = 's'; let cls = false; while (i < src.length && (src[i] !== '/' || cls) && src[i] !== '\n') { if (src[i] === '\\') kind[i++] = 's'; else { if (src[i] === '[') cls = true; if (src[i] === ']') cls = false; } kind[i++] = 's'; } kind[i++] = 's'; while (/[a-z]/.test(src[i] || '')) i++; lastSig = 'x'; continue; }
    if (ch === '{') { stack.push({ open: i, tpl: false, head: codeBefore(i) }); }
    if (ch === '}') { const b = stack.pop(); if (b) { if (b.tpl) { kind[i] = 't'; i++; template(); lastSig = 'x'; continue; } blocks.push({ open: b.open, close: i, head: b.head }); } }
    if (!/\s/.test(ch)) lastSig = (lastSig + ch).slice(-12);
    i++;
  }
  function codeBefore(at){ let s = ''; for (let k = at - 1; k >= 0 && s.length < 160; k--) { if (kind[k] === 'c') s = src[k] + s; else if (kind[k] === 'm') continue; else s = 'S' + s; } return s.replace(/\s+/g, ' ').trim(); }
  return { kind, blocks };
}
const lineOf = (src, at) => src.slice(0, at).split('\n').length;
const enclosing = (blocks, at) => blocks.filter(b => b.open < at && at < b.close).sort((a, b) => (a.close - a.open) - (b.close - b.open));
/* the argument text of a call whose ( is at p */
function argsAt(src, p){ let d = 0; for (let k = p; k < src.length; k++) { if (src[k] === '(') d++; else if (src[k] === ')') { d--; if (!d) return src.slice(p + 1, k); } } return ''; }
/* does this try (block b) have a catch that shows the error's message? returns 'shows' | 'swallows' | 'none' */
function catchOf(src, sc, b){
  const rest = src.slice(b.close + 1); const m = rest.match(/^\s*catch\s*(\(\s*([A-Za-z_$][\w$]*)[^)]*\))?\s*\{/);
  if (!m) return { kind: 'none' };
  const open = b.close + 1 + m[0].length - 1; const cb = sc.blocks.find(x => x.open === open); if (!cb) return { kind: 'swallows' };
  const param = m[2]; const body = src.slice(cb.open, cb.close + 1);
  if (!param) return { kind: 'swallows', why: 'catch has no error name' };
  const re = /(toast|\.set)\s*\(/g; let mm;
  while ((mm = re.exec(body))) { const a = argsAt(body, mm.index + mm[0].length - 1); if (new RegExp('\\b' + param.replace('$', '\\$') + '\\.message\\b').test(a)) return { kind: 'shows' }; }
  return { kind: 'swallows', why: 'catch never shows ' + param + '.message' };
}
function files(dir){ const out = []; for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) out.push(...files(p)); else if (f.endsWith('.ts')) out.push(p); } return out; }
const writeRe = new RegExp('\\bdata\\.(' + WRITES.join('|') + ')\\s*\\(', 'g');
export function staticOffenders(src, rel){
  const sc = scan(src); const out = [];
  let m; writeRe.lastIndex = 0;
  while ((m = writeRe.exec(src))) {
    const at = m.index; const k = sc.kind[at]; const where = `${rel}:${lineOf(src, at)} data.${m[1]}(`;
    if (k === 'm' || k === 's') continue;
    if (k === 't') { out.push(where + ' is called straight from a template'); continue; }
    let verdict = 'no try';
    for (const b of enclosing(sc.blocks, at)) {
      if (!/\btry$/.test(b.head)) continue;
      const c = catchOf(src, sc, b); if (c.kind === 'none') continue; // try/finally: look further out
      verdict = c.kind === 'shows' ? 'ok' : (c.why || 'catch does not show the error'); break;
    }
    if (verdict !== 'ok') out.push(where + ' ' + (verdict === 'no try' ? 'is not inside a try whose catch shows the error' : verdict));
  }
  return out;
}
export function busyOffenders(src, rel){
  const sc = scan(src); const out = []; const seen = new Set();
  /* a method body: the code before { ends with a parameter list (and a return type); the word before that list is not a control word */
  const isMethod = b => { const h = b.head.replace(/:\s*[\w<>\[\]|. ]+$/, ''); if (!h.endsWith(')')) return false; let d = 0, k = h.length - 1;
    for (; k >= 0; k--) { if (h[k] === ')') d++; else if (h[k] === '(') { d--; if (!d) break; } }
    const word = (h.slice(0, k).match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1] || ''; return !!word && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(word); };
  let m; writeRe.lastIndex = 0;
  while ((m = writeRe.exec(src))) {
    if (sc.kind[m.index] !== 'c') continue;
    const meth = enclosing(sc.blocks, m.index).find(isMethod); if (!meth || seen.has(meth.open)) continue; seen.add(meth.open);
    const body = src.slice(meth.open, meth.close + 1); const re = /\b([A-Za-z_$][\w$]*)\.set\(\s*true\s*\)/g; let s;
    while ((s = re.exec(body))) {
      if (!/busy|saving/i.test(s[1]) || sc.kind[meth.open + s.index] !== 'c') continue;
      const at = meth.open + s.index; const name = s[1];
      const fin = sc.blocks.filter(b => b.open > at && b.close <= meth.close && /\bfinally$/.test(b.head)).some(b => new RegExp('\\b' + name + '\\.set\\(\\s*false\\s*\\)').test(src.slice(b.open, b.close)));
      if (!fin) out.push(`${rel}:${lineOf(src, at)} ${name}.set(true) is never reset in a finally`);
    }
  }
  return out;
}

/* ---------- STATIC and BUSY ---------- */
const targets = [...files(join(APP, 'pages')), ...files(join(APP, 'ui'))];
if (want('static')) await safe('static', async () => {
  // the tokenizer itself, on the shapes it must tell apart
  const probe = `class X { tpl = \`<b (click)="data.rate(1)">\${ 'x' }</b>\`; async a(){ try { await this.data.deliver('1'); } catch (e: any) { this.data.toast(e.message || 'x'); } }
    async b(){ try { await this.data.deliver('1'); } catch { } } async c(){ await this.data.rate('1', 2); } async d(){ try { try { await this.data.addNote('1', 'x'); } finally { this.busy.set(false); } } catch (er) { this.err.set(er instanceof Error ? er.message : String(er)); } }
    // data.rate( in a comment\n  s = 'data.rate(' ; r = /data.rate\\(/; }`;
  const po = staticOffenders(probe, 'probe');
  t('the tokenizer finds a template call', po.some(x => /probe:1 data\.rate\(.*template/.test(x)), po.join(' | '));
  t('the tokenizer passes a try whose catch toasts e.message', !po.some(x => /deliver/.test(x) && /probe:1/.test(x)), po.join(' | '));
  t('the tokenizer fails a catch that swallows', po.some(x => /probe:2 data\.deliver.*no error name/.test(x)), po.join(' | '));
  t('the tokenizer fails a bare call', po.some(x => /probe:2 data\.rate.*not inside a try/.test(x)), po.join(' | '));
  t('the tokenizer looks past a try/finally to the catch outside', !po.some(x => /addNote/.test(x)), po.join(' | '));
  t('the tokenizer ignores comments, strings and regex', po.length === 3, po.length + ': ' + po.join(' | '));
  const all = [];
  for (const f of targets) { const rel = relative(APP, f); const src = readFileSync(f, 'utf8'); all.push(...staticOffenders(src, rel)); }
  const calls = targets.reduce((a, f) => a + (readFileSync(f, 'utf8').match(writeRe) || []).length, 0);
  t(`every write call in pages/ and ui/ (${calls} found) sits in a try whose catch shows the error, none from a template`, all.length === 0, all.length + ' offenders');
  for (const o of all) rows.push('      ' + o);
});
if (want('busy')) await safe('busy', async () => {
  const probe = `class X { async a(){ this.busy.set(true); try { await this.data.deliver('1'); } catch (e: any) { this.data.toast(e.message); } finally { this.busy.set(false); } }
    async b(){ this.busy.set(true); try { await this.data.deliver('1'); this.busy.set(false); } catch (e: any) { this.data.toast(e.message); } } }`;
  const po = busyOffenders(probe, 'probe');
  t('the busy reader passes a finally and fails a reset that a throw skips', po.length === 1 && /probe:2/.test(po[0]), po.join(' | '));
  const all = []; for (const f of targets) all.push(...busyOffenders(readFileSync(f, 'utf8'), relative(APP, f)));
  t('every saving method that sets busy true resets it in a finally', all.length === 0, all.length + ' offenders');
  for (const o of all) rows.push('      ' + o);
});

/* ---------- R1: the data service on a refused write ---------- */
if (want('r1')) await safe('R1', async () => {
  const { loadData, makeService, fakeFetch } = await import('../API2/webharness.mjs');
  const T0 = '2026-10-01T08:00:00.000Z';
  const job = (id, extra = {}) => ({ id, plate: 'P' + id, make: 'M', model: 'X', customerId: 'c1', customerName: 'Ama Perera', customerPhone: '0711111111', branch: 'one', service: 'paint', status: 'open', phases: [{ key: 'a', label: 'A', status: 'now', hours: 2 }], approvals: [], promiseHistory: [], pickup: { wanted: false, status: 'none' }, promisedAt: T0, createdAt: T0, updatedAt: T0, ...extra });
  let net = { status: 200, body: null, down: false };
  const calls = fakeFetch(async (u, init) => {
    const m = init.method || 'GET';
    if (m === 'GET') return { status: 200, body: /\/jobs\?/.test(u) ? [job('j1', { status: 'ready' }), job('j2')] : [] };
    if (net.down) return 'network';
    if (net.status !== 200) return { status: net.status, body: net.body || {} };
    return { status: 200, body: /activities/.test(u) ? { id: 'a' + Math.random(), jobId: 'j1', type: 'note', summary: 's', by: 'Ama', createdAt: T0, updatedAt: T0 } : job(String(u).split('/').pop(), { updatedAt: new Date().toISOString() }) };
  });
  const m = await loadData(); const seat = { kind: 'staff', name: 'Ama', token: 'tok-ama', owner: true };
  const d = makeService(m, seat); await d.init();
  const outbox = () => localStorage._keys().filter(k => k.startsWith('wos_outbox')).flatMap(k => JSON.parse(localStorage.getItem(k) || '[]'));
  const tryWrite = async (fn) => { let err = null; const n0 = calls.length; try { await fn(); } catch (e) { err = e; } const after = calls.slice(n0); const w = after.findIndex(c => c.method !== 'GET'); const gets = w < 0 ? 0 : after.slice(w + 1).filter(c => c.method === 'GET').length; return { err, gets }; };
  // one write waits in the outbox first, so a refresh that drained it would show
  net = { status: 200, down: true }; await d.setPromise('j2', '2026-10-30T10:00:00.000Z', 'Parts late'); const q0 = outbox().length; net.down = false;
  t('a network failure still waits in the outbox (the setup)', q0 >= 1, String(q0));
  for (const [s, words] of [[409, W409], [428, W428]]) {
    net = { status: s, body: {} };
    const r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'Customer asked'));
    t(`a ${s} with no words throws`, !!r.err, String(r.err));
    t(`a ${s} with no words says: ${words.slice(0, 40)}...`, r.err && r.err.message === words, r.err && r.err.message);
    t(`a ${s} keeps .status ${s}`, r.err && r.err.status === s, String(r.err && r.err.status));
    t(`a ${s} reloads the lists before it throws (GETs after the write)`, r.gets >= 2, r.gets + ' GETs');
    t(`the ${s} refresh does not replay or drop the outbox`, outbox().length === q0, outbox().length + ' of ' + q0);
    // a deliver (another job write) refused the same way
    const r2 = await tryWrite(() => d.deliver('j1'));
    t(`a ${s} on Deliver gets the same words`, r2.err && r2.err.message === words && r2.err.status === s, r2.err && r2.err.message);
  }
  net = { status: 409, body: { error: 'The space was taken a moment ago' } };
  let r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'x'));
  t('a 409 with the server\'s words keeps them', r.err && r.err.message === 'The space was taken a moment ago' && r.err.status === 409, r.err && r.err.message);
  t('a 409 with words also reloads', r.gets >= 2, r.gets + ' GETs');
  net = { status: 403, body: {} }; r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'x'));
  t('a 403 with no words says: ' + W403, r.err && r.err.message === W403 && r.err.status === 403, r.err && r.err.message);
  net = { status: 403, body: { error: 'Owner only' } }; r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'x'));
  t('a 403 with words keeps them', r.err && r.err.message === 'Owner only', r.err && r.err.message);
  for (const s of [400, 404]) {
    net = { status: s, body: { error: 'Server words ' + s } }; r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'x'));
    t(`a ${s} keeps the server's words`, r.err && r.err.message === 'Server words ' + s && r.err.status === s, r.err && r.err.message);
  }
  net = { status: 200 }; r = await tryWrite(() => d.setPromise('j1', '2026-10-29T10:00:00.000Z', 'fine'));
  t('a write that goes through still throws nothing', !r.err, String(r.err));
  // LOCAL MODE: the demo, everything in this browser, no fetch at all
  const cast = JSON.parse(readFileSync(join(ROOT, 'apps', 'web', 'public', 'casts', 'demo-garage.json'), 'utf8'));
  /* the demo seed draws its photos on a canvas: a stand in that draws nothing */
  const pen = new Proxy({}, { get: () => () => {}, set: () => true });
  globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => pen, toDataURL: () => 'data:image/jpeg;base64,AA' }), documentElement: { getAttribute: () => null } };
  globalThis.__wosInject = cls => cls.name === 'CastService' ? { cast: () => cast, config: () => ({ api: '' }), branch: () => null }
    : { name: () => 'Ama', kind: () => 'staff', phone: () => '', token: () => '', owner: () => true, branch: () => '' };
  const L = new m.DataService(); const n0 = calls.length; await L.init();
  t('local mode loads the demo floor', L.mode() === 'local' && L.jobs().length > 3, L.mode() + ' ' + L.jobs().length);
  const open = L.jobs().find(j => j.status === 'open'); let le = null; try { await L.deliver(open.id); } catch (e) { le = e; }
  t('local mode keeps its own words for a rule (Only a ready car can be delivered)', le && le.message === 'Only a ready car can be delivered' && le.status === undefined, le && le.message);
  const ok = await L.setPromise(open.id, '2026-10-29T10:00:00.000Z', 'Parts late');
  t('local mode saves as before', ok && ok.promiseHistory.length === open.promiseHistory.length + 1, String(ok && ok.promiseHistory.length));
  t('local mode never calls fetch', calls.length === n0, (calls.length - n0) + ' calls');
});

/* ---------- WORDS: what the parts added ---------- */
if (want('words')) await safe('words', async () => {
  const bad = [];
  for (const rel of CHANGEABLE) {
    let old = ''; try { old = execFileSync('git', ['show', 'f142e06:apps/web/src/app/' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch {}
    const was = new Set(old.split('\n').map(l => l.trim())); const now = readFileSync(join(APP, rel), 'utf8').split('\n');
    now.forEach((l, k) => { if (was.has(l.trim())) return; const where = `${rel}:${k + 1}`;
      const strs = (l.match(/'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"/g) || []).join(' ');
      if (/[–—]/.test(l)) bad.push(where + ' an em or en dash');
      if (/,\s+(and|or|but|nor)\b/i.test(strs)) bad.push(where + ' a comma before and/or/but/nor in words');
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l)) bad.push(where + ' a new colour');
      if (/@Component\s*\(/.test(l)) bad.push(where + ' a new component');
      if (/\b(color|behavior|center|honor|favor|organize|realize|canceled)\b/i.test(strs) && !/\bcenter\b/.test(l.replace(/['"`][^'"`]*['"`]/g, ''))) bad.push(where + ' a US spelling in words');
    });
  }
  t('the lines added since f142e06 keep the house style (no dash, no serial comma, no new colour or component, British English)', bad.length === 0, bad.length + ' found');
  for (const o of bad) rows.push('      ' + o);
});

/* ---------- SCREENS ---------- */
if (want('screens')) await safe('screens', async () => {
  const OUT = mkdtempSync(join(tmpdir(), 'wos-r-')); const WEB = join(ROOT, 'apps', 'web');
  const env = { ...process.env, PATH: process.env.HOME + '/.local/node/bin:' + process.env.PATH, NG_CLI_ANALYTICS: 'false' };
  const b = spawnSync('npx', ['ng', 'build', '--configuration', 'development', '--output-path', OUT], { cwd: WEB, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  t('a development build of the app compiles', b.status === 0 && existsSync(join(OUT, 'browser', 'index.html')), (b.stderr || b.stdout || '').split('\n').filter(x => /rror/.test(x)).slice(0, 3).join(' | '));
  if (b.status !== 0) return;
  const { serve, chromium, context, staff, customer } = await import('../../../scripts/lib/world.mjs');
  const { srv, base } = serve(join(OUT, 'browser'));
  const EV = join(ROOT, 'evidence', 'R'); mkdirSync(EV, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [w, desk] of [[390, false], [1440, true]]) {
      // the job card: Deliver and close, the save refused with a 409
      let c = await context(browser, { width: w, desk }); let p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      await staff(p, base);
      const id = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { if (!/^wos_/.test(k) || /outbox|theme|session/.test(k)) continue; try { const d = JSON.parse(localStorage.getItem(k)); const j = (d.jobs || []).find(x => x.status === 'ready'); if (j) return j.id; } catch {} } return ''; });
      t(`${w}: the demo floor has a ready car`, !!id, id);
      await p.goto(base + '#/workshop/job/' + id); await p.waitForSelector('bb-ws-job .big.ok'); await p.waitForTimeout(500);
      await p.click('bb-ws-job .big.ok'); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(450);
      const hooked = await p.evaluate(w409 => { const ng = window.ng; if (!ng) return 'no ng'; const cmp = ng.getComponent(document.querySelector('bb-ws-job')); if (!cmp || !cmp.data) return 'no component';
        cmp.data.deliver = async () => { const e = new Error(w409); e.status = 409; throw e; }; return 'ok'; }, W409);
      t(`${w}: the check replaced deliver on the injected DataService`, hooked === 'ok', hooked);
      const btn = p.locator('.drawer.on button:has-text("Delivered")'); await btn.click(); await p.waitForTimeout(350);
      const toast = await p.locator('.toast').first().textContent({ timeout: 2000 }).catch(() => '');
      /* PB, 18 Oct 2026 (Thulaib): a refused Deliver shows in the sheet's own message slot, not a toast (the toast straddled the sheet edge at 1440) */
      const inSheet = await p.evaluate(() => (document.querySelector('.drawer.on [foot] .msg')?.textContent || '').trim());
      t(`${w}: the Deliver tap shows the refusal in the sheet's message slot`, inSheet === W409, inSheet.slice(0, 90) || (toast || '').trim().slice(0, 90));
      await p.screenshot({ path: join(EV, `deliver-${w}.png`) });
      /* INFO, not counted: the toast is white-space:nowrap in styles.css, which this job may not change; a long refusal is cut on a phone */
      const fit = await p.evaluate(() => { const el = document.querySelector('.toast'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; });
      if (fit) rows.push(`INFO  ${w}: the toast spans ${fit.left} to ${fit.right} of a ${fit.vw}px screen${fit.left < 0 || fit.right > fit.vw ? ': the words are CUT (styles.css .toast nowrap, outside this job)' : ': it fits'}`);
      t(`${w}: the Delivered button works again after the refusal`, await btn.isEnabled(), '');
      t(`${w}: no uncaught error on the job card`, errs.length === 0, errs.join(' | ').slice(0, 160));
      await c.close();
      // the customer page: a star tap refused with a 403
      c = await context(browser, { width: w, desk }); p = await c.newPage(); const errs2 = []; p.on('pageerror', e => errs2.push(String(e.message)));
      await customer(p, base);
      const cid = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { if (!/^wos_/.test(k) || /outbox|theme|session/.test(k)) continue; try { const d = JSON.parse(localStorage.getItem(k)); const j = (d.jobs || []).find(x => x.status === 'delivered' && x.customerPhone === '0771234567'); if (j) return j.id; } catch {} } return ''; });
      await p.goto(base + '#/car/job/' + cid); await p.waitForSelector('bb-car-job .stars button'); await p.waitForTimeout(900);
      const hooked2 = await p.evaluate(w403 => { const ng = window.ng; if (!ng) return 'no ng'; const cmp = ng.getComponent(document.querySelector('bb-car-job')); if (!cmp || !cmp.data) return 'no component';
        cmp.data.rate = async () => { const e = new Error(w403); e.status = 403; throw e; }; return 'ok'; }, W403);
      t(`${w}: the check replaced rate on the injected DataService`, hooked2 === 'ok', hooked2);
      const star = p.locator('bb-car-job .stars button').nth(3); await star.scrollIntoViewIfNeeded(); await star.click(); await p.waitForTimeout(350);
      const toast2 = await p.locator('.toast').first().textContent({ timeout: 2000 }).catch(() => '');
      t(`${w}: the rating tap shows the refusal in the toast`, (toast2 || '').trim().startsWith(W403), (toast2 || '').trim().slice(0, 90));
      await p.screenshot({ path: join(EV, `rate-${w}.png`) });
      await p.evaluate(() => { const ng = window.ng; ng.getComponent(document.querySelector('bb-root') || document.body)?.data?.toastMsg?.set(null); });
      await p.waitForTimeout(150); await star.click(); await p.waitForTimeout(350);
      const again = await p.locator('.toast').first().textContent({ timeout: 2000 }).catch(() => '');
      t(`${w}: the stars work again (a second tap shows the words again)`, await star.isEnabled() && (again || '').trim().startsWith(W403), (again || '').trim().slice(0, 60));
      t(`${w}: no uncaught error on the customer page`, errs2.length === 0, errs2.join(' | ').slice(0, 160));
      await c.close();
    }
  } finally { await browser.close(); srv.close(); }
});

console.log(rows.join('\n')); console.log(`R: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}`); process.exit(bad ? 1 : 0);
