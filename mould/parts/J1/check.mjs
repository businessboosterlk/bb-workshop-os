// THE ON-SCREEN CHECK FOR J1, the job card controls (ui/space-card and ui/parts-list on pages/workshop/job).
// Written by Claude BEFORE the crew ran. Runs on the BUILT app (scripts/serve.mjs), demo garage, owner seat, at 390 and 1440.
// Every state is read twice: on screen and in the stored jobs, and the floor's capacity line is compared with the engine.
//   node mould/parts/J1/check.mjs [base-url]
// The seed (v4) it relies on: j3 Vezel in Bay 3 (Wellawatte), Bay 4 free; j14 in Hoist 2 with part p3 arrived; j12 blocking
// Hoist 1 for approval; j5 Premio in the dock for parts, p1 ordered and p2 arrived.
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const ROOT = process.env.HOME + '/bb-systems/bb-workshop-os';
let BASE = process.argv[2], srv;
if (!BASE) { srv = spawn('node', [ROOT + '/scripts/serve.mjs']); BASE = await new Promise(r => srv.stdout.on('data', d => r(String(d).trim().split('\n')[0]))); }
const b = await chromium.launch(); const rows = []; let bad = 0, n = 0;
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
/* the sheet action bar, the same measure as scripts/ui-sheets.mjs */
async function bar(p) {
  await wait(450);
  return p.evaluate(() => {
    const foot = document.querySelector('.drawer.on .d-foot [foot]'); if (!foot) return 'no action bar';
    const W = foot.getBoundingClientRect().width; const out = [];
    for (const row of [...foot.children]) {
      if (getComputedStyle(row).display === 'none') continue;
      const btns = row.classList.contains('pair') ? [...row.children] : row.matches('.btn') ? [row] : [];
      if (!btns.length) { out.push('a row that is not a button or a pair'); continue; }
      const ws = btns.map(x => x.getBoundingClientRect().width);
      const sum = ws.reduce((a, w) => a + w, 0) + (btns.length - 1) * parseFloat(getComputedStyle(row).columnGap || '0');
      if (Math.abs(sum - W) > 1.5) out.push(`row not full width: ${Math.round(sum)} of ${Math.round(W)}`);
      for (const x of btns) { if (x.getBoundingClientRect().height < 43.5) out.push(`"${x.textContent.trim()}" under 44px`); if (x.scrollWidth > x.clientWidth + 1) out.push(`"${x.textContent.trim()}" label cut`); }
    }
    return out.join('; ');
  });
}
for (const [W, H, scale] of [[390, 844, 3], [1440, 900, 2]]) {
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const tag = `[${W}]`;
  await p.goto(BASE + '?c=demo-garage&fresh=1#/workshop/login', { waitUntil: 'domcontentloaded' }); await wait(1200);
  await p.fill('#who', 'Ravi'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await wait(1600);
  const jobs = () => p.evaluate(() => JSON.parse(localStorage.getItem('wos_demo-garage') || '{}').jobs || []);
  const job = async id => (await jobs()).find(j => j.id === id);
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await wait(900); };
  const where = () => p.locator('bb-space-card .sc').getAttribute('data-where').catch(() => null);
  const busyOf = async br => +(await p.locator(`.fm-group[data-branch="${br}"] .cap`).getAttribute('data-busy'));
  const tap = async sel => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await el.click(); await wait(500); };
  await go('#/workshop/floor'); const seg = p.locator('.seg button').first(); if (await seg.count()) { await seg.click(); await wait(300); }

  /* 1. MOVE: j3 from Bay 3 to the one free space in its branch */
  await go('#/workshop/job/j3');
  t(`${tag} the job card shows the space card`, await p.locator('bb-space-card .sc').count() === 1);
  t(`${tag} j3 reads as in a bay`, await where() === 'bay', await where());
  const box = await p.locator('bb-space-card .sc-where').evaluate(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, s: e.textContent.trim() }; }).catch(() => ({ w: 0, h: 0, s: '' }));
  t(`${tag} the place line can be SEEN (box measured) and reads exactly the space`, box.w > 40 && box.h > 14 && box.s.replace(/\s+/g, ' ') === 'Bay 3', `w ${Math.round(box.w)} h ${Math.round(box.h)} "${box.s}"`);
  const ico = await p.locator('bb-space-card .sc-ico').evaluate(e => getComputedStyle(e).backgroundColor).catch(() => '');
  t(`${tag} the state square carries its colour (added after the eye caught it bare)`, !!ico && ico !== 'rgba(0, 0, 0, 0)' && ico !== 'transparent', ico);
  const opt = await (async () => { await p.locator('.sc-hold').first().click().catch(() => {}); await wait(450); const r = await p.locator('.drawer.on .opt[data-reason="parts"]').evaluate(e => { const a = e.getBoundingClientRect(), b = e.querySelector('strong').getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2); }).catch(() => 99); await p.keyboard.press('Escape'); await wait(400); return r; })();
  t(`${tag} a one line option sits in the middle of its box`, opt <= 1.5, `off by ${opt.toFixed(1)}px`);
  if (await p.locator('.sc-move').count()) {
    await tap('.sc-move'); t(`${tag} Move opens a sheet`, await p.locator('.drawer.on').count() === 1);
    const barMove = await bar(p); t(`${tag} Move sheet: one action bar`, barMove === '', barMove);
    await p.goBack(); await wait(600); t(`${tag} Back once closes the Move sheet and stays on the job`, await p.locator('.drawer.on').count() === 0 && p.url().includes('/workshop/job/j3'));
    await tap('.sc-move'); const pick = p.locator('.drawer.on .pick[data-space]');
    const key = await pick.first().getAttribute('data-space').catch(() => '');
    if (key) { await pick.first().click(); await wait(800); }
    t(`${tag} Move puts the car in the space picked`, !!key && (await job('j3')).spaceKey === key, `${key} / ${(await job('j3')).spaceKey}`);
    t(`${tag} the sheet closes after the move`, await p.locator('.drawer.on').count() === 0);
  } else t(`${tag} Move button (class sc-move) exists`, false);

  /* 2. HOLD TO THE DOCK: j14 leaves Hoist 2, the capacity line drops by one */
  await go('#/workshop/floor'); const before = await busyOf('bora');
  await go('#/workshop/job/j14');
  if (await p.locator('.sc-hold').count()) {
    await tap('.sc-hold'); await tap('.drawer.on .opt[data-reason="curing"]'); await p.keyboard.press('Escape'); await wait(400);   /* a reason picked then cancelled must not carry over */
    await tap('.sc-hold'); const barHold = await bar(p); t(`${tag} Hold sheet: one action bar`, barHold === '', barHold);
    t(`${tag} Hold the car waits for a reason, every time the sheet opens`, await p.locator('.drawer.on .sc-go').isDisabled());
    await tap('.drawer.on .opt[data-reason="parts"]'); await tap('.drawer.on .opt[data-leave="1"]'); await tap('.drawer.on .sc-go'); await wait(400);
    const j14 = await job('j14');
    t(`${tag} hold to the dock stores the hold and frees the space`, j14.hold === 'parts' && !j14.spaceKey, JSON.stringify({ hold: j14.hold, space: j14.spaceKey }));
    t(`${tag} the card now reads In the holding dock`, await where() === 'dock' && /holding dock/.test(await p.locator('.sc-where').innerText()));
    await go('#/workshop/floor'); const after = await busyOf('bora');
    t(`${tag} the capacity line dropped by one`, after === before - 1, `${before} to ${after}`);
    t(`${tag} the car is in the dock's parts lane`, await p.locator('.lane[data-lane="parts"] .dcar', { hasText: j14.plate }).count() === 1);
  } else t(`${tag} Hold button (class sc-hold) exists`, false);

  /* 3. PARTS on j14: add, edit (the supplier must really go), arrive the last one, fit one */
  await go('#/workshop/job/j14');
  t(`${tag} the job card shows the parts list`, await p.locator('bb-parts-list .pl').count() === 1);
  if (await p.locator('.pl-add').count()) {
    await tap('.pl-add'); const barAdd = await bar(p); t(`${tag} Add part sheet: one action bar`, barAdd === '', barAdd);
    await tap('.drawer.on .pl-save'); t(`${tag} an empty name is refused in words`, /part name/i.test(await p.locator('.drawer.on .err').innerText().catch(() => '')));
    await p.fill('#pl-name', 'Radiator hose'); await p.fill('#pl-sup', 'Kandy Motors'); await tap('.drawer.on .pl-save'); await wait(300);
    let parts = (await job('j14')).parts || []; const added = parts.find(x => x.name === 'Radiator hose');
    t(`${tag} Add stores an ordered part with its supplier`, !!added && added.status === 'ordered' && added.supplier === 'Kandy Motors');
    t(`${tag} the new row shows Ordered`, !!added && await p.locator(`.pl-row[data-part="${added.id}"][data-status="ordered"]`).count() === 1);
    if (added) {
      await tap(`.pl-row[data-part="${added.id}"] .pl-edit`); const barEd = await bar(p); t(`${tag} Edit part sheet: one action bar`, barEd === '', barEd);
      t(`${tag} Edit opens filled in`, await p.inputValue('#pl-name') === 'Radiator hose' && await p.inputValue('#pl-sup') === 'Kandy Motors');
      await p.fill('#pl-name', 'Radiator hose, top'); await p.fill('#pl-sup', ''); await tap('.drawer.on .pl-save'); await wait(300);
      parts = (await job('j14')).parts || []; const ed = parts.find(x => x.id === added.id);
      t(`${tag} Edit renames and REMOVES the cleared supplier`, ed?.name === 'Radiator hose, top' && !('supplier' in ed), JSON.stringify(ed));
      t(`${tag} the row line shows no old supplier`, !/Kandy/.test(await p.locator(`.pl-row[data-part="${added.id}"]`).innerText()));
      await tap(`.pl-row[data-part="${added.id}"] .pl-arrived`); await wait(300);
      const j = await job('j14');
      t(`${tag} the last part arriving releases the car to Waiting for a space`, j.parts.find(x => x.id === added.id)?.status === 'arrived' && !j.hold && !j.spaceKey, JSON.stringify({ hold: j.hold, space: j.spaceKey }));
      t(`${tag} the space card says Waiting for a space`, await where() === 'queue' && /Waiting for a space/.test(await p.locator('.sc-where').innerText()));
    }
    await tap('.pl-row[data-part="p3"] .pl-fitted'); await wait(300);
    t(`${tag} Fitted moves an arrived part to fitted`, (await job('j14')).parts.find(x => x.id === 'p3')?.status === 'fitted');
    t(`${tag} a fitted part keeps only Edit`, await p.locator('.pl-row[data-part="p3"] .pl-arrived, .pl-row[data-part="p3"] .pl-fitted').count() === 0 && await p.locator('.pl-row[data-part="p3"] .pl-edit').count() === 1);
  } else t(`${tag} Add a part button (class pl-add) exists`, false);

  /* 4. the Premio: its one ordered part arrives, it leaves the dock for the queue */
  await go('#/workshop/job/j5');
  t(`${tag} the Premio reads as in the dock`, await where() === 'dock', await where());
  if (await p.locator('.pl-row[data-part="p1"] .pl-arrived').count()) {
    await tap('.pl-row[data-part="p1"] .pl-arrived'); await wait(300); const j5 = await job('j5');
    t(`${tag} the Premio's last part releases it`, !j5.hold && !j5.spaceKey && await where() === 'queue');
  } else t(`${tag} the Premio's ordered part has It arrived`, false);

  /* 5. RELEASE: j12 blocks Hoist 1; Release keeps it in the bay and unblocks it. Back twice leaves the job card. */
  await go('#/workshop/job/j12');
  t(`${tag} j12 reads as blocked`, await where() === 'blocked' && /Bay blocked/.test(await p.locator('.sc-where').innerText().catch(() => '')));
  t(`${tag} a held car offers Release and not Hold`, await p.locator('.sc-release').count() === 1 && await p.locator('.sc-hold').count() === 0);
  if (await p.locator('.sc-release').count()) { await tap('.sc-release'); await wait(300); const j12 = await job('j12');
    t(`${tag} Release clears the hold and keeps the space`, !j12.hold && !j12.heldAt && !!j12.spaceKey && await where() === 'bay'); }
  if (await p.locator('.sc-hold').count()) { await tap('.sc-hold'); await p.goBack(); await wait(600);
    t(`${tag} Back once closes the Hold sheet`, await p.locator('.drawer.on').count() === 0 && p.url().includes('/workshop/job/j12'));
    await p.goBack(); await wait(800); t(`${tag} Back twice leaves the job card`, !p.url().includes('/workshop/job/j12'), p.url().split('#')[1]); }

  /* 6. layout */
  await go('#/workshop/job/j14');
  t(`${tag} no horizontal scroll on the job card`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const cut = await p.evaluate(() => [...document.querySelectorAll('bb-space-card .btn, bb-parts-list .btn')].filter(x => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().height < 39.5).map(x => x.textContent.trim()));
  t(`${tag} no control label cut and every control at least 40px`, cut.length === 0, cut.join(', '));
  t(`${tag} no page errors`, !errs.length, errs[0]);
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}/j1-${W}.png`, fullPage: true });
  await c.close();
}
await b.close(); if (srv) srv.kill();
console.log(rows.join('\n')); console.log(bad ? `FAIL ${n - bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
