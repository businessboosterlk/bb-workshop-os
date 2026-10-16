// THE ON-SCREEN CHECK FOR G1, the parts board (pages/workshop/parts.component.ts at /workshop/parts).
// Written by Claude BEFORE the crew ran. Built app, demo garage, owner seat, at 390 and 1440. Every count on screen is compared
// with partsBoard() run in node on the same stored jobs. Seed v4: j5 p1 ordered and p2 arrived (Ratmalana), j14 p3 arrived (Wellawatte).
//   node mould/parts/G1/check.mjs [base-url]
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { execFileSync, spawn } from 'node:child_process'; import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const ROOT = process.env.HOME + '/bb-systems/bb-workshop-os', BIN = ROOT + '/apps/web/node_modules/.bin/';
let BASE = process.argv[2], srv;
if (!BASE) { srv = spawn('node', [ROOT + '/scripts/serve.mjs']); BASE = await new Promise(r => srv.stdout.on('data', d => r(String(d).trim().split('\n')[0]))); }
const D = mkdtempSync(join(tmpdir(), 'g1-')); execFileSync(BIN + 'esbuild', [ROOT + '/apps/web/src/app/core/spaces.ts', '--bundle', '--format=esm', '--outfile=' + join(D, 's.mjs'), '--log-level=error']);
const S = await import(join(D, 's.mjs'));
const b = await chromium.launch(); const rows = []; let bad = 0, n = 0;
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function bar(p) {
  await wait(450);
  return p.evaluate(() => {
    const foot = document.querySelector('.drawer.on .d-foot [foot]'); if (!foot) return 'no action bar';
    const W = foot.getBoundingClientRect().width; const out = [];
    for (const row of [...foot.children]) {
      if (getComputedStyle(row).display === 'none') continue;
      const btns = row.classList.contains('pair') ? [...row.children] : row.matches('.btn') ? [row] : [];
      if (!btns.length) { out.push('a row that is not a button or a pair'); continue; }
      const ws = btns.map(x => x.getBoundingClientRect().width); const sum = ws.reduce((a, w) => a + w, 0) + (btns.length - 1) * parseFloat(getComputedStyle(row).columnGap || '0');
      if (Math.abs(sum - W) > 1.5) out.push(`row not full width: ${Math.round(sum)} of ${Math.round(W)}`);
      for (const x of btns) { if (x.getBoundingClientRect().height < 43.5) out.push(`"${x.textContent.trim()}" under 44px`); if (x.scrollWidth > x.clientWidth + 1) out.push(`"${x.textContent.trim()}" label cut`); }
    }
    return out.join('; ');
  });
}
for (const [W, H, scale] of [[390, 844, 3], [1440, 900, 2]]) {
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); const tag = `[${W}]`;
  p.setDefaultTimeout(6000);
  try {
  await p.goto(BASE + '?c=demo-garage&fresh=1#/workshop/login', { waitUntil: 'domcontentloaded' }); await wait(1200);
  await p.fill('#who', 'Ravi'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await wait(1600);
  const jobs = () => p.evaluate(() => JSON.parse(localStorage.getItem('wos_demo-garage') || '{}').jobs || []);
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await wait(900); };
  await p.evaluate(() => { try { localStorage.removeItem('wos_parts_view'); localStorage.removeItem('wos_f_parts'); } catch {} });
  await go('#/workshop/floor');
  t(`${tag} the menu has a Parts entry`, await p.locator('a[href*="/workshop/parts"]').count() >= 1);
  await go('#/workshop/parts');
  t(`${tag} /workshop/parts shows the parts page`, await p.locator('bb-ws-parts').count() === 1);
  const counts = async () => Object.fromEntries(await Promise.all(['ordered', 'arrived', 'fitted'].map(async k => [k, { n: +(await p.locator(`.col[data-stage="${k}"] .col-n`).innerText().catch(() => '-1')), cards: await p.locator(`.col[data-stage="${k}"] .pc`).count() }])));
  const engine = async br => { const e = S.partsBoard(await jobs(), br); return { ordered: e.ordered.length, arrived: e.arrived.length, fitted: e.fitted.length }; };
  let E = await engine(''), C = await counts();
  for (const k of ['ordered', 'arrived', 'fitted']) t(`${tag} board ${k}: count and cards equal partsBoard()`, C[k].n === E[k] && C[k].cards === E[k], `badge ${C[k].n}, cards ${C[k].cards}, engine ${E[k]}`);
  const hd = (await p.locator('bb-ws-parts .ph p').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  t(`${tag} the header counts agree with the engine`, hd.includes(`${E.ordered} on order`) && hd.includes(`${E.arrived} arrived`) && hd.includes(`${E.fitted} fitted`), hd);
  const nb = await p.locator('.pc strong').first().evaluate(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }).catch(() => ({ w: 0, h: 0 }));
  t(`${tag} a card's part name can be SEEN (box measured)`, nb.w > 60 && nb.h > 14, `w ${Math.round(nb.w)} h ${Math.round(nb.h)}`);
  t(`${tag} no horizontal page scroll on the board`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* the switch, remembered across a reload */
  await p.locator('.seg button', { hasText: 'List' }).click(); await wait(500);
  const vis = async () => p.locator('.prow:visible').count();
  t(`${tag} the list shows one row per part`, await vis() === E.ordered + E.arrived + E.fitted, `${await vis()}`);
  await p.reload({ waitUntil: 'domcontentloaded' }); await wait(1600);
  t(`${tag} the switch is remembered after a reload`, await p.locator('.prow:visible').count() > 0 && await p.locator('.board').count() === 0);
  await p.locator('.chips button', { hasText: 'Arrived' }).click(); await wait(400);
  t(`${tag} the list's Arrived chip shows only arrived parts`, await vis() === E.arrived);
  await p.locator('.chips button', { hasText: 'All' }).first().click(); await wait(300);
  await p.locator('.seg button', { hasText: 'Board' }).click(); await wait(500);
  /* the branch filter: Ratmalana only */
  if (W < 640) { await p.locator('.fb-open').click(); await wait(500); await p.selectOption('#fb-branch', 'dehi'); await p.locator('.drawer.on .btn').first().click(); await wait(500); }
  else { await p.locator('.fsel select').first().selectOption('dehi'); await wait(500); }
  E = await engine('dehi'); C = await counts();
  t(`${tag} filtered to one branch, the board equals partsBoard(branch)`, ['ordered', 'arrived', 'fitted'].every(k => C[k].n === E[k] && C[k].cards === E[k]), JSON.stringify(C) + ' vs ' + JSON.stringify(E));
  if (W < 640) { await p.locator('.fb-open').click(); await wait(400); await p.locator('.drawer.on .btn.quiet').click(); await wait(300); await p.keyboard.press('Escape'); await wait(400); }
  else { await p.locator('.fsel select').first().selectOption(''); await wait(400); }
  /* the part sheet, Edit from its head (the supplier must really go), It arrived releases the Premio */
  const card = p.locator('.pc[data-part="p1"]');
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded(); await card.click(); await wait(600);
    t(`${tag} tapping a card opens its sheet`, await p.locator('.drawer.on').count() === 1);
    const b1 = await bar(p); t(`${tag} part sheet: one action bar`, b1 === '', b1);
    t(`${tag} the part sheet has Edit in its head`, await p.locator('.drawer.on .d-edit').count() === 1);
    await p.locator('.drawer.on .d-edit').click(); await wait(700);
    t(`${tag} Edit opens filled in, and stays open`, await p.locator('.drawer.on').count() === 1 && await p.inputValue('#pb-name').catch(() => '') === 'Left front door shell');
    const b2 = await bar(p); t(`${tag} edit sheet: one action bar`, b2 === '', b2);
    await p.fill('#pb-sup', ''); await p.locator('.drawer.on .pb-save').click(); await wait(600);
    const p1 = (await jobs()).find(j => j.id === 'j5').parts.find(x => x.id === 'p1');
    t(`${tag} Edit REMOVES a cleared supplier`, !('supplier' in p1), JSON.stringify(p1));
    await card.click(); await wait(600); await p.locator('.drawer.on .pb-arrived').click(); await wait(700);
    const j5 = (await jobs()).find(j => j.id === 'j5');
    t(`${tag} It arrived moves the part and releases the car held for it`, j5.parts.find(x => x.id === 'p1').status === 'arrived' && !j5.hold);
    t(`${tag} the open sheet follows the part to its new stage`, await p.locator('.drawer.on .pb-fitted').count() === 1);
    await p.goBack(); await wait(600);
    t(`${tag} Back once closes the sheet and stays on the board`, await p.locator('.drawer.on').count() === 0 && p.url().includes('/workshop/parts'));
    await p.goBack(); await wait(800);
    t(`${tag} Back twice leaves the board`, !p.url().includes('/workshop/parts'), p.url().split('#')[1]);
    await go('#/workshop/parts');
    t(`${tag} the card sits in Arrived now`, await p.locator('.col[data-stage="arrived"] .pc[data-part="p1"]').count() === 1);
  } else t(`${tag} the ordered card p1 is on the board`, false);
  /* drag at the desk: an arrived card onto Fitted fits it; a drag backwards is refused */
  if (W >= 1440) {
    const from = p.locator('.pc[data-part="p3"]'), to = p.locator('.col[data-stage="fitted"] .col-b, .col[data-stage="fitted"] [cdkdroplist], .col[data-stage="fitted"] .cdk-drop-list').first();
    if (await from.count() && await to.count()) {
      const a = await from.boundingBox(), z = await to.boundingBox();
      await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 5, { steps: 4 });
      await p.mouse.move(z.x + z.width / 2, z.y + 40, { steps: 12 }); await wait(200); await p.mouse.up(); await wait(900);
      t(`${tag} dragging an arrived part onto Fitted fits it`, (await jobs()).find(j => j.id === 'j14').parts.find(x => x.id === 'p3').status === 'fitted');
    } else t(`${tag} drag targets exist`, false);
  }
  } catch (e) { t(`${tag} the walk reached its end`, false, String(e).split('\n')[0].slice(0, 140)); }
  t(`${tag} no page errors`, !errs.length, errs[0]);
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}/g1-${W}.png` });
  await c.close();
}
await b.close(); if (srv) srv.kill();
console.log(rows.join('\n')); console.log(bad ? `FAIL ${n - bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
