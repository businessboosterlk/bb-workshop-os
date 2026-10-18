// R5: the refused-save toast fits every screen, and the customer rating shows only what was saved. Written by Claude BEFORE the
// crew ran (18 Oct 2026); it must FAIL on cfee0b4.   node mould/parts/R5/check.mjs
//   TOAST 390   the toast's box sits inside 16px to 374px and its words are fully visible (scrollWidth <= clientWidth), on the
//               staff job card (Deliver refused with a 409) and on the customer page (a star refused with a 403)
//   TOAST 1440  customer page: the toast centre is within 2px of the centre of the screen (there is no rail);
//               staff screen: within 2px of the centre of the main content beside the rail
//   RATING      after a refused rating no star is filled and no Thank you shows (the page shows the saved rating only)
//   WORDS       lines added since cfee0b4 in the files this job may change: no em or en dash, no comma before and/or/but/nor
// The refusal is forced as R's check does: the method on the injected DataService is replaced through ng.getComponent (a hook in the
// check only, nothing in product code). Screenshots go to evidence/R5/{deliver,rate}-{390,1440}.png.
import { mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
let n = 0, bad = 0; const rows = [];
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
async function safe(name, fn){ try { await fn(); } catch (e) { t(name + ' did not crash', false, String(e && e.stack || e).slice(0, 300)); } }
const W409 = 'Someone else changed this car a moment ago. It has been refreshed: make your change again.';
const W403 = 'This seat cannot do that.';

/* ---------- WORDS ---------- */
await safe('words', async () => {
  const d = spawnSync('git', ['diff', 'cfee0b4', '--unified=0', '--', 'apps/web/src/styles.css', 'apps/web/src/app/pages/customer/job.component.ts'], { cwd: ROOT, encoding: 'utf8' }).stdout;
  const added = d.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1));
  const offenders = added.filter(l => /[—–]/.test(l) || /,\s*(and|or|but|nor)\b/i.test(l));
  t('lines added since cfee0b4 have no em or en dash and no comma before and/or/but/nor', offenders.length === 0, offenders.slice(0, 2).join(' | ').slice(0, 160));
});

/* ---------- SCREENS ---------- */
await safe('screens', async () => {
  const OUT = mkdtempSync(join(tmpdir(), 'wos-r5-')); const WEB = join(ROOT, 'apps', 'web');
  const env = { ...process.env, PATH: process.env.HOME + '/.local/node/bin:' + process.env.PATH, NG_CLI_ANALYTICS: 'false' };
  const b = spawnSync('npx', ['ng', 'build', '--configuration', 'development', '--output-path', OUT], { cwd: WEB, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  t('a development build of the app compiles', b.status === 0 && existsSync(join(OUT, 'browser', 'index.html')), (b.stderr || b.stdout || '').split('\n').filter(x => /rror/.test(x)).slice(0, 3).join(' | '));
  if (b.status !== 0) return;
  const { serve, chromium, context, staff, customer } = await import('../../../scripts/lib/world.mjs');
  const { srv, base } = serve(join(OUT, 'browser'));
  const EV = join(ROOT, 'evidence', 'R5'); mkdirSync(EV, { recursive: true });
  const browser = await chromium.launch();
  const toastBox = p => p.evaluate(() => { const el = document.querySelector('.toast'); if (!el) return null; const r = el.getBoundingClientRect(); const m = document.querySelector('bb-ws-shell .main'); const mr = m ? m.getBoundingClientRect() : null;
    const rg = document.createRange(); rg.selectNodeContents(el.firstChild || el); const tr = rg.getBoundingClientRect();
    return { tl: tr.left, tr: tr.right, left: r.left, right: r.right, cx: (r.left + r.right) / 2, sw: el.scrollWidth, cw: el.clientWidth, vw: document.documentElement.clientWidth, mainCx: mr ? (mr.left + mr.right) / 2 : null }; });
  try {
    for (const [w, desk] of [[390, false], [1440, true]]) {
      // the staff job card: Deliver and close, refused with a 409
      let c = await context(browser, { width: w, desk }); let p = await c.newPage();
      await staff(p, base);
      const id = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { if (!/^wos_/.test(k) || /outbox|theme|session/.test(k)) continue; try { const d = JSON.parse(localStorage.getItem(k)); const j = (d.jobs || []).find(x => x.status === 'ready'); if (j) return j.id; } catch {} } return ''; });
      /* PB, 18 Oct 2026: a refused Deliver now shows inside its sheet (Thulaib's decision), so the staff toast is measured on Move the date, which still toasts */
      await p.goto(base + '#/workshop/job/' + id); await p.waitForSelector('bb-ws-job .big.ok'); await p.waitForTimeout(500);
      await p.click('bb-ws-job .acts button:has-text("Move the date")'); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(450); await p.fill('.drawer.on #rs', 'Parts late');
      await p.evaluate(w409 => { const cmp = window.ng.getComponent(document.querySelector('bb-ws-job')); cmp.data.setPromise = async () => { const e = new Error(w409); e.status = 409; throw e; }; }, W409);
      await p.locator('.drawer.on [foot] button:has-text("Move the date")').click(); await p.waitForTimeout(450);
      let k = await toastBox(p); t(`${w}: staff screen: the toast is on screen`, !!k);
      await p.screenshot({ path: join(EV, `deliver-${w}.png`) });
      if (k && w === 390) {
        t(`${w}: staff screen: the toast box sits inside 16px to 374px`, k.left >= 16 - 0.5 && k.right <= 374 + 0.5, `${Math.round(k.left)} to ${Math.round(k.right)}`);
        t(`${w}: staff screen: the toast words are fully visible`, k.sw <= k.cw && k.tl >= 0 && k.tr <= k.vw, `scrollWidth ${k.sw}, clientWidth ${k.cw}, text ${Math.round(k.tl)} to ${Math.round(k.tr)}`);
      }
      if (k && w === 1440) t(`${w}: staff screen: the toast is centred in the main content beside the rail`, Math.abs(k.cx - k.mainCx) <= 2, `toast ${Math.round(k.cx)}, main ${Math.round(k.mainCx)}`);
      await c.close();
      // the customer page: a star refused with a 403
      c = await context(browser, { width: w, desk }); p = await c.newPage();
      await customer(p, base);
      // make sure the car has no saved rating, so "no star, no Thank you" is a strict test
      const cid = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { if (!/^wos_/.test(k) || /outbox|theme|session/.test(k)) continue; try { const d = JSON.parse(localStorage.getItem(k)); const j = (d.jobs || []).find(x => x.status === 'delivered' && x.customerPhone === '0771234567'); if (j) { delete j.rating; localStorage.setItem(k, JSON.stringify(d)); return j.id; } } catch {} } return ''; });
      t(`${w}: the demo has a delivered car for the customer`, !!cid, cid);
      await p.reload(); await p.waitForTimeout(600);
      await p.goto(base + '#/car/job/' + cid); await p.waitForSelector('bb-car-job .stars button'); await p.waitForTimeout(900);
      await p.evaluate(w403 => { const cmp = window.ng.getComponent(document.querySelector('bb-car-job')); cmp.data.rate = async () => { const e = new Error(w403); e.status = 403; throw e; }; }, W403);
      const star = p.locator('bb-car-job .stars button').nth(3); await star.scrollIntoViewIfNeeded(); await star.click(); await p.waitForTimeout(450);
      k = await toastBox(p); t(`${w}: customer page: the toast is on screen`, !!k);
      await p.screenshot({ path: join(EV, `rate-${w}.png`) });
      if (k && w === 390) {
        t(`${w}: customer page: the toast box sits inside 16px to 374px`, k.left >= 16 - 0.5 && k.right <= 374 + 0.5, `${Math.round(k.left)} to ${Math.round(k.right)}`);
        t(`${w}: customer page: the toast words are fully visible`, k.sw <= k.cw && k.tl >= 0 && k.tr <= k.vw, `scrollWidth ${k.sw}, clientWidth ${k.cw}, text ${Math.round(k.tl)} to ${Math.round(k.tr)}`);
      }
      if (k && w === 1440) t(`${w}: customer page: the toast is centred on the screen`, Math.abs(k.cx - k.vw / 2) <= 2, `toast ${Math.round(k.cx)}, screen ${Math.round(k.vw / 2)}`);
      const on = await p.locator('bb-car-job .stars button.on').count(); const ty = await p.locator('bb-car-job .ty').count();
      t(`${w}: after the refused rating no star is filled`, on === 0, `${on} filled`);
      t(`${w}: after the refused rating no Thank you shows`, ty === 0, `${ty} shown`);
      await c.close();
    }
  } finally { await browser.close(); srv.close(); }
});

console.log(rows.join('\n')); console.log(`R5: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}`); process.exit(bad ? 1 : 0);
