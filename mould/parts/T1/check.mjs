// THE ON-SCREEN CHECK FOR T1, tier gating. Written by Claude BEFORE the wiring. Built app, at 390 and 1440.
// Demo garage with ?tier=1, 2 and 3 (and with no override: its cast says tier 2); Auto Museum, whose cast has NO tier, must
// lose nothing. At each tier the right cards lock, a locked card is the only thing shown for its feature and pressing it
// changes no data.   node mould/parts/T1/check.mjs [base-url]
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const ROOT = process.env.HOME + '/bb-systems/bb-workshop-os';
let BASE = process.argv[2], srv;
if (!BASE) { srv = spawn('node', [ROOT + '/scripts/serve.mjs']); BASE = await new Promise(r => srv.stdout.on('data', d => r(String(d).trim().split('\n')[0]))); }
const b = await chromium.launch(); const rows = []; let bad = 0, n = 0;
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const runs = [['demo-garage', '1', 'Ravi'], ['demo-garage', '2', 'Ravi'], ['demo-garage', '3', 'Ravi'], ['demo-garage', '', 'Ravi'], ['auto-museum', '', 'Miflal']];
for (const [W, H] of [[390, 844], [1440, 900]]) for (const [slug, tier, who] of runs) {
  const c = await b.newContext({ viewport: { width: W, height: H } }); const p = await c.newPage(); p.setDefaultTimeout(6000);
  const errs = []; p.on('pageerror', e => errs.push(String(e))); const tag = `[${W} ${slug} tier ${tier || 'cast'}]`;
  const eff = slug === 'auto-museum' ? 0 : +(tier || 2);   /* 0 = no tier, every feature on */
  try {
    await p.goto(BASE + `?c=${slug}${tier ? '&tier=' + tier : ''}#/workshop/login`, { waitUntil: 'domcontentloaded' }); await wait(1200);
    await p.fill('#who', who); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await wait(1600);
    const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await wait(1000); };
    const lk = f => p.locator(`.lk[data-feature="${f}"]`).count();
    /* the floor */
    await go('#/workshop/floor');
    const dockLocked = eff === 1;
    t(`${tag} floor: the dock is ${dockLocked ? 'a locked card' : 'live'}`, dockLocked ? (await lk('dock')) === 1 && await p.locator('bb-dock').count() === 0 : (await lk('dock')) === 0 && await p.locator('bb-dock').count() === 1);
    t(`${tag} floor: the tier 3 AI card ${eff === 2 ? 'shows' : 'does not show'}`, (await lk('exceptions')) === (eff === 2 ? 1 : 0));
    t(`${tag} floor: no other locked card`, await p.locator('.lk').count() === (dockLocked ? 1 : 0) + (eff === 2 ? 1 : 0));
    t(`${tag} floor: the floor picture is always there`, await p.locator('bb-floor-map').count() === 1);
    if (await p.locator('.lk').count()) {
      const card = p.locator('.lk').first();
      t(`${tag} a locked card marks its sample`, (await card.locator('.lk-tag').innerText()).trim() === 'Sample');
      const txt = await card.innerText(); t(`${tag} a locked card carries no price`, !/\bLKR\b|\bRs\.?\s?\d|rupee|\$\s?\d/i.test(txt));
      const btns = await card.locator('button, a').count(); t(`${tag} a locked card has one control, Upgrade`, btns === 1 && /Upgrade/.test(await card.locator('button').innerText()));
      const hb = await card.locator('.lk-up').evaluate(e => e.getBoundingClientRect().height); t(`${tag} Upgrade is at least 44px`, hb >= 43.5, Math.round(hb) + 'px');
      const before = await p.evaluate(() => localStorage.getItem('wos_' + (new URLSearchParams(location.search).get('c'))));
      /* a finger's tap: Playwright's "stable" wait hung on the floor page although the box did not move over ten frames, so press
         the measured centre after proving the button is what sits there */
      const hit = await card.locator('.lk-up').evaluate(async e => { e.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 250)); const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; return { x, y, top: document.elementFromPoint(x, y)?.closest('.lk-up') === e }; });
      t(`${tag} Upgrade is what a finger lands on`, hit.top);
      await p.mouse.click(hit.x, hit.y); await wait(400);
      t(`${tag} Upgrade says to ask Business Booster`, /Ask Business Booster/.test(await card.locator('.lk-ask').innerText().catch(() => '')));
      t(`${tag} pressing a locked card changes no data`, before === await p.evaluate(() => localStorage.getItem('wos_' + (new URLSearchParams(location.search).get('c')))));
    }
    t(`${tag} floor: no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    /* the parts board */
    await go('#/workshop/parts');
    if (eff === 1) t(`${tag} parts: a locked card and no board, no list, no part`, (await lk('parts')) === 1 && await p.locator('.board, .prow, .pc, bb-filter-bar').count() === 0);
    else t(`${tag} parts: the board is live`, (await lk('parts')) === 0 && await p.locator('.board, .prow').count() >= 1);
    /* the job card: Hold and the parts list are tier 2 */
    const jid = slug === 'demo-garage' ? 'j3' : 'j3';
    await go('#/workshop/job/' + jid);
    if (eff === 1) {
      t(`${tag} job card: no Hold, no parts list, Move still there`, await p.locator('.sc-hold').count() === 0 && await p.locator('bb-parts-list').count() === 0 && await p.locator('.sc-move').count() === 1);
      const mw = await p.locator('.sc-move').evaluate(e => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width).catch(() => 0);
      t(`${tag} job card: Move fills the row when Hold is gone`, mw > 0.98, mw.toFixed(2));
      await go('#/workshop/job/j12'); t(`${tag} job card: a held car cannot be released at tier 1`, await p.locator('.sc-release').count() === 0);
    } else t(`${tag} job card: Hold and the parts list are there`, await p.locator('.sc-hold').count() === 1 && await p.locator('bb-parts-list').count() === 1);
  } catch (e) { t(`${tag} the walk reached its end`, false, String(e).split('\n')[0].slice(0, 140)); }
  t(`${tag} no page errors`, !errs.length, errs[0]);
  if (process.env.SHOT && slug === 'demo-garage' && tier) { for (const [h, nm] of [['#/workshop/floor', 'floor'], ['#/workshop/parts', 'parts']]) { await p.evaluate(x => { location.hash = x; }, h); await wait(900); const l = p.locator('.lk').first(); if (await l.count()) await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.screenshot({ path: `${process.env.SHOT}/t1-${tier}-${nm}-${W}.png` }); } }
  await c.close();
}
await b.close(); if (srv) srv.kill();
console.log(rows.join('\n')); console.log(bad ? `FAIL ${n - bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
