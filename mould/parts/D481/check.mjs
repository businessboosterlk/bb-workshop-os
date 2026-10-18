// D481: the front desk label and filled stars (bb_pending 481). Written by Claude BEFORE the crew ran (18 Oct 2026); it must
// FAIL on 61f7d26.   node mould/parts/D481/check.mjs [--only static,screens] [--base <url>]
//   STATIC   the lines added since 61f7d26 keep the house style; no svg typed by hand; Auto Museum's cast untouched.
//   SCREENS  a development build on this Mac (or --base <url>, the live showroom), the DEMO GARAGE cast (Blue Bay Motors,
//            asserted by the page title before anything is judged), at 390 and 1440:
//            the rail's seat line says Owner for Ravi, Front desk for Sachini (never Staff), Staff for Chamara; the login's
//            demo seat line marks the owner and the front desk; on the customer page the Wagon R (j2, rated 5) shows five
//            FILLED stars, a tap on the fourth leaves four filled and one light outline (read from the computed fill, never
//            the class); the history row's star is filled; the filled star sits in the middle of its 44px button by ink.
//            Back once and twice after opening the menu on a phone is recorded. Screenshots to evidence/D481/.
import { readFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
const APP = join(ROOT, 'apps', 'web', 'src', 'app'); const BASE_REF = '61f7d26';
const args = process.argv.slice(2); const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const LIVE = args.includes('--base') ? args[args.indexOf('--base') + 1].replace(/\/?$/, '/') : '';
const EV = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(ROOT, 'evidence', 'D481');
const want = k => onlyArg ? onlyArg.includes(k) : !(LIVE && k === 'static');
let n = 0, bad = 0; const rows = [];
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const note = s => rows.push('NOTE  ' + s);
async function safe(name, fn){ try { await fn(); } catch (e) { t(name + ' did not crash', false, String(e && e.stack || e).slice(0, 300)); } }
const read = rel => { try { return readFileSync(join(APP, rel), 'utf8'); } catch { return ''; } };
const at = (ref, path) => { try { return execFileSync('git', ['show', ref + ':' + path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch { return ''; } };

/* ---------- STATIC ---------- */
if (want('static')) await safe('static', async () => {
  const files = ['ui/icon.component.ts', 'pages/workshop/shell.component.ts', 'pages/workshop/login.component.ts', 'pages/customer/job.component.ts', 'pages/customer/history.component.ts'];
  const bads = [];
  for (const rel of files) {
    const was = new Set(at(BASE_REF, 'apps/web/src/app/' + rel).split('\n').map(l => l.trim()));
    read(rel).split('\n').forEach((l, k) => { if (was.has(l.trim())) return; const where = `${rel}:${k + 1}`;
      const strs = (l.match(/'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"/g) || []).join(' ') + ' ' + l.replace(/<[^>]*>|\{\{[^}]*\}\}/g, ' ');
      if (/[–—]/.test(l)) bads.push(where + ' an em or en dash');
      if (/,\s+(and|or|but|nor)\b/i.test(strs)) bads.push(where + ' a comma before and/or/but/nor');
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l)) bads.push(where + ' a new colour');
      /* the icon component holds the one allowed svg; the gate's hand-svg check below owns that rule for every other file */
      if (rel !== 'ui/icon.component.ts' && /<svg|<path|<polygon/.test(l)) bads.push(where + ' svg typed by hand');
      /* CSS is code, not words: whole declarations (place-items:center, transition:color 150ms) and currentColor are dropped */
      const words = strs.replace(/currentColor/g, '').replace(/[a-z-]+\s*:[^;{}]*/gi, '');
      if (/\b(color|behavior|center|honor|favor|organize|realize|canceled)\b/i.test(words)) bads.push(where + ' a US spelling in words'); });
  }
  t('the lines added since 61f7d26 keep the house style (no dash, no serial comma, no new colour, no hand svg, British English)', bads.length === 0, bads.slice(0, 3).join(' | '));
  const hs = spawnSync('node', [join(process.env.HOME, 'bb-systems/qa/hand-svg.mjs'), 'apps/web/src', '--allow', 'app/ui/icon.component.ts=1', '--allow', 'app/ui/ring.component.ts=1', '--allow', 'app/ui/vehicle.component.ts=1'], { cwd: ROOT, encoding: 'utf8' });
  t('no svg typed by hand (the gate\'s hand-svg check)', hs.status === 0, (hs.stdout + hs.stderr).trim().split('\n').slice(-2).join(' | '));
  for (const p of ['casts/auto-museum.json', 'apps/web/public/casts/auto-museum.json']) t(`${p} is not changed`, readFileSync(join(ROOT, p), 'utf8') === at(BASE_REF, p));
  const changed = execFileSync('git', ['diff', '--name-only', BASE_REF, '--', 'apps', 'casts', 'scripts'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const outside = changed.filter(f => !files.some(x => f === 'apps/web/src/app/' + x));
  t('only the icon, the rail, the login seat line and the two customer star pages changed in apps, casts and scripts', outside.length === 0, outside.join(', '));
});

/* ---------- SCREENS ---------- */
if (want('screens')) await safe('screens', async () => {
  const { chromium, context } = await import('../../../scripts/lib/world.mjs');
  const { measure } = await import(join(process.env.HOME, 'bb-systems/qa/optical.mjs'));
  let srv = null, base = LIVE;
  if (!LIVE) {
    const OUT = mkdtempSync(join(tmpdir(), 'wos-d481-')); const WEB = join(ROOT, 'apps', 'web');
    const env = { ...process.env, PATH: process.env.HOME + '/.local/node/bin:' + process.env.PATH, NG_CLI_ANALYTICS: 'false' };
    const b = spawnSync('npx', ['ng', 'build', '--configuration', 'development', '--output-path', OUT], { cwd: WEB, env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 540000 });
    t('a development build of the app compiles', b.status === 0 && existsSync(join(OUT, 'browser', 'index.html')), (b.stderr || b.stdout || '').split('\n').filter(x => /rror/.test(x)).slice(0, 3).join(' | '));
    if (b.status !== 0) return;
    const { serve } = await import('../../../scripts/lib/world.mjs'); const s = serve(join(OUT, 'browser')); srv = s.srv; base = s.base;
  }
  mkdirSync(EV, { recursive: true });
  const browser = await chromium.launch();
  const brand = async (p, w, who, signed = true) => { t(`${w} ${who}: signs in`, signed); if (!signed) return false; const title = await p.title(); t(`${w} ${who}: the page is the demo garage (Blue Bay Motors)`, title === 'Blue Bay Motors', title); return title === 'Blue Bay Motors'; };
  const login = async (p, who, pin) => { await p.goto(base + '?c=demo-garage#/workshop/login'); await p.waitForSelector('#who'); await p.fill('#who', who); await p.fill('#pin', pin); await p.click('button[type=submit]');
    try { await p.waitForFunction(() => /#\/workshop(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 }); await p.waitForSelector('.topbar'); return true; } catch { return false; } };
  /* every star's paint, read from the computed style of its drawing; never the class */
  const stars = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].map(svg => { const cs = getComputedStyle(svg); const vis = svg.getBoundingClientRect();
    return { fill: cs.fill, stroke: cs.stroke, color: cs.color, filled: cs.fill !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.fill), w: Math.round(vis.width) }; }), sel);
  const SEATS = [['Ravi', '1111', 'Owner'], ['Sachini', '4444', 'Front desk'], ['Chamara', '2222', 'Staff']];
  try {
    for (const [w, desk] of [[390, false], [1440, true]]) {
      /* ---- the login's demo seat line ---- */
      let c = await context(browser, { width: w, desk }); let p = await c.newPage(); let errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      await p.goto(base + '?c=demo-garage#/workshop/login'); await p.waitForSelector('#who'); await p.waitForTimeout(500);
      const demo = await p.evaluate(() => (document.querySelector('.demo')?.innerText || '').replace(/\s+/g, ' ').trim());
      if (demo) t(`${w} login: the demo seat line marks Ravi the owner and Sachini the front desk`, /Ravi 1111 \(owner\)/.test(demo) && /Sachini 4444 \(front desk\)/.test(demo), demo);
      else note(`${w} login: no demo seat line (api mode), not judged`);
      await c.close();
      /* ---- the three seats' rail line ---- */
      for (const [who, pin, word] of SEATS) {
        c = await context(browser, { width: w, desk }); p = await c.newPage(); errs = []; p.on('pageerror', e => errs.push(String(e.message)));
        if (await brand(p, w, who, await login(p, who, pin))) {
          if (!desk) { await p.click('.topbar .hamb'); await p.waitForTimeout(450); }
          const r = await p.evaluate(() => { const em = document.querySelector('.rail .r-foot .who em'); const rail = document.querySelector('.rail'); const b = em?.getBoundingClientRect();
            return { text: (em?.textContent || '').replace(/\s+/g, ' ').trim(), seen: !!b && b.width > 0 && getComputedStyle(rail).visibility === 'visible', railText: rail?.innerText || '' }; });
          t(`${w} ${who}: the rail's seat line says ${word}`, r.seen && (r.text === word || r.text.startsWith(word + ' · ')), JSON.stringify(r.text) + (r.seen ? '' : ' not seen'));
          if (who === 'Sachini') t(`${w} Sachini: the word Staff appears nowhere in her rail`, !/\bStaff\b/.test(r.railText), (r.railText.match(/[^\n]*Staff[^\n]*/) || [''])[0]);
          await p.screenshot({ path: join(EV, `rail-${who.toLowerCase()}-${w}.png`) });
          if (!desk && who === 'Sachini') {
            /* Back once and twice after the menu: recorded, never judged here (the rail keeps no history entry of its own) */
            const st = () => p.evaluate(() => ({ hash: location.hash, rail: document.querySelector('.rail')?.classList.contains('open') || false, lock: document.body.classList.contains('rail-lock') }));
            const before = await st(); await p.goBack().catch(() => {}); await p.waitForTimeout(800); const one = await st(); await p.goBack().catch(() => {}); await p.waitForTimeout(800); const two = await st().catch(() => ({ hash: 'left the app' }));
            note(`390 Sachini menu open ${JSON.stringify(before)}; Back once ${JSON.stringify(one)}; Back twice ${JSON.stringify(two)}`);
          }
        }
        t(`${w} ${who}: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();
      }
      /* ---- the customer: the stars ---- */
      c = await context(browser, { width: w, desk }); p = await c.newPage(); errs = []; p.on('pageerror', e => errs.push(String(e.message)));
      await p.goto(base + '?c=demo-garage#/car/login'); await p.waitForSelector('#ph'); await p.fill('#ph', '0771234567'); await p.click('button[type=submit]'); await p.waitForSelector('#code'); await p.fill('#code', '1234'); await p.click('button[type=submit]');
      let inCust = true; try { await p.waitForFunction(() => /#\/car(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 }); } catch { inCust = false; }
      if (await brand(p, w, 'customer', inCust)) {
        await p.goto(base + '?c=demo-garage#/car/job/j2'); await p.waitForSelector('bb-car-job .hero'); await p.waitForTimeout(900);
        const SEL = 'bb-car-job .stars button svg';
        let s = await stars(p, SEL);
        t(`${w} customer: the Wagon R (rated 5) shows five filled stars`, s.length === 5 && s.every(x => x.filled), JSON.stringify(s.map(x => x.fill)));
        t(`${w} customer: a filled star is painted in its own colour (the brand ink)`, s.length === 5 && s.every(x => x.fill === x.color), JSON.stringify(s.map(x => x.fill + '/' + x.color)));
        await p.locator('bb-car-job .rate').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(EV, `stars-5-${w}.png`) });
        const ink = await measure(p, 'bb-car-job .stars button', { shape: 'rect', inset: 2, index: 0 });
        t(`${w} customer: the filled star sits in the middle of its 44px button by ink (within 0.5px)`, !ink.error && Math.abs(ink.dx) <= 0.5 && Math.abs(ink.dy) <= 0.5 && Math.round(ink.w) === 44, ink.error || `dx ${ink.dx} dy ${ink.dy} box ${ink.w}x${ink.h}`);
        await p.locator('bb-car-job .stars button').nth(3).click(); await p.waitForTimeout(700);
        s = await stars(p, SEL);
        t(`${w} customer: after a tap on the fourth star exactly four are filled`, s.length === 5 && s.filter(x => x.filled).length === 4 && s.slice(0, 4).every(x => x.filled), JSON.stringify(s.map(x => x.fill)));
        t(`${w} customer: the fifth is a light outline (no fill, a stroke)`, s.length === 5 && !s[4].filled && s[4].stroke !== 'none' && s[4].stroke === s[4].color && s[4].color !== s[0].color, JSON.stringify(s[4] || null));
        await p.locator('bb-car-job .rate').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(EV, `stars-4-${w}.png`) });
        await p.locator('bb-car-job .stars button').nth(4).click(); await p.waitForTimeout(700);
        s = await stars(p, SEL); t(`${w} customer: a tap on the fifth puts the rating back to five filled`, s.length === 5 && s.every(x => x.filled), JSON.stringify(s.map(x => x.fill)));
        await p.goto(base + '?c=demo-garage#/car/history'); await p.waitForSelector('bb-car-history, .card'); await p.waitForTimeout(800);
        const h = await stars(p, '.rt bb-icon svg');
        t(`${w} customer: the history row's star is filled`, h.length >= 1 && h.every(x => x.filled), JSON.stringify(h.map(x => x.fill)));
        await p.screenshot({ path: join(EV, `history-${w}.png`) });
      }
      t(`${w} customer: no uncaught error`, errs.length === 0, errs.join(' | ').slice(0, 160)); await c.close();
    }
  } finally { await browser.close(); if (srv) srv.close(); }
});

console.log(rows.join('\n')); const fails = rows.filter(r => r.startsWith('FAIL')).length;
console.log(`D481: ${n - bad}/${n} ${bad ? 'FAIL' : 'PASS'}${LIVE ? ' (live ' + LIVE + ')' : ''}`); process.exit(bad ? 1 : 0);
