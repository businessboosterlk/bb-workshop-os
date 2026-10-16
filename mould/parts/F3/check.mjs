// THE ON-SCREEN CHECK FOR F2 (tile), F3 (floor picture), F4 (dock and Bay blocked) and F5 (journey photos).
// Written by Claude BEFORE the crew ran. Runs on the BUILT app (scripts/serve.mjs), demo garage, owner seat, at 390 and 1440.
// Every number on screen is compared with the spaces engine run in node on the same jobs.
//   node mould/parts/F3/check.mjs [base-url]
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { measure } from '/Users/thulaibhassen/bb-systems/qa/optical.mjs';
import { execFileSync, spawn } from 'node:child_process'; import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const ROOT = process.env.HOME + '/bb-systems/bb-workshop-os', BIN = ROOT + '/apps/web/node_modules/.bin/';
let BASE = process.argv[2], srv;
if (!BASE) { srv = spawn('node', [ROOT + '/scripts/serve.mjs']); BASE = await new Promise(r => srv.stdout.on('data', d => r(String(d).trim().split('\n')[0]))); }
const D = mkdtempSync(join(tmpdir(), 'f3-')); execFileSync(BIN + 'esbuild', [ROOT + '/apps/web/src/app/core/spaces.ts', '--bundle', '--format=esm', '--outfile=' + join(D, 's.mjs'), '--log-level=error']);
const S = await import(join(D, 's.mjs'));
const cast = await (await fetch(BASE + 'casts/demo-garage.json')).json();
const b = await chromium.launch(); const rows = []; let bad = 0, n = 0;
const t = (name, ok, note = '') => { n++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const near = (a, b2) => Math.abs(a - b2) <= 1;
for (const [W, H, scale] of [[390, 844, 3], [1440, 900, 2]]) {
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?c=demo-garage#/workshop/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.clear()); await p.goto(BASE + '?c=demo-garage&fresh=1#/workshop/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  await p.fill('#who', 'Ravi'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await p.waitForTimeout(1600);
  if (!p.url().includes('/workshop/floor')) { await p.evaluate(() => { location.hash = '#/workshop/floor'; }); } await p.waitForTimeout(1400);
  const seg = p.locator('.seg button').first(); if (await seg.count()) { await seg.click(); await p.waitForTimeout(400); }   /* Both branches */
  const jobs = await p.evaluate(() => JSON.parse(localStorage.getItem('wos_demo-garage') || '{}').jobs || []); if (process.env.DEBUG) { console.log(p.url(), jobs.length); await p.screenshot({ path: '/private/tmp/claude-501/-Users-thulaibhassen/21eb9d6d-cfc9-4ac3-9689-17acc41d9614/scratchpad/chk.png' }); }
  const now = Date.now(); const tag = `[${W}]`;
  t(tag + ' the demo floor has cars in spaces', jobs.some(j => j.spaceKey));
  /* F3: one group per branch, counts equal the engine */
  for (const br of cast.branches) {
    const F = S.floor(cast, jobs, br.key, now);
    const g = p.locator(`.fm-group[data-branch="${br.key}"]`);
    t(`${tag} ${br.name}: group drawn`, await g.count() === 1);
    if (!(await g.count())) continue;
    const tiles = await g.locator('bb-space-tile').count(); const busyOnScreen = await g.locator('bb-space-tile.busy, bb-space-tile.blocked').count();
    const cap = g.locator('.cap'); const db = +(await cap.getAttribute('data-busy')), dt = +(await cap.getAttribute('data-total'));
    t(`${tag} ${br.name}: one tile per space`, tiles === F.total, `${tiles} of ${F.total}`);
    t(`${tag} ${br.name}: the capacity line equals the busy tiles`, db === busyOnScreen && db === F.busy && dt === F.total, `line ${db}/${dt}, tiles ${busyOnScreen}, engine ${F.busy}/${F.total}`);
    const txt = (await cap.innerText()).replace(/\s+/g, ' ');
    t(`${tag} ${br.name}: capacity words`, txt.includes(`${F.busy} of ${F.total} busy`) && (F.nextFreeMinutes === 0 ? txt.includes(`${F.total - F.busy} free now`) : F.nextFreeMinutes === null ? /waiting on something/.test(txt) : /next free in about/.test(txt)), txt);
    t(`${tag} ${br.name}: the meter has one segment per space`, await cap.locator('[role=img] > *').count() === F.total);
    const vis = await cap.evaluate(e => { const r = (e.querySelector('.cap-text') || e).getBoundingClientRect(); return { w: r.width, h: r.height, name: (e.querySelector('.cap-name') || {}).innerText || '' }; });
    t(`${tag} ${br.name}: the capacity words can be SEEN (width and height, added after the eye caught them squeezed to 0)`, vis.w > 120 && vis.h > 20, `w ${Math.round(vis.w)} h ${Math.round(vis.h)}`);
    t(`${tag} ${br.name}: the line names the branch, never its key`, vis.name.trim() === br.name, vis.name);
    const sticky = await cap.evaluate(e => getComputedStyle(e).position); t(`${tag} ${br.name}: the capacity line is sticky`, sticky === 'sticky');
    /* F2: a blocked tile says Bay blocked with its timer; a busy tile shows the time left from the engine */
    for (const tile of F.tiles.filter(x => x.state !== 'free')) {
      const el = g.locator(`bb-space-tile[data-space="${tile.space.key}"]`); const s = (await el.innerText()).replace(/\s+/g, ' ');
      /* F2b, the car bays Thulaib asked for on 16 Oct: a solid car, what it is in for, a bar of stages done, time left in working days */
      if (tile.state === 'busy') {
        const svc = cast.services.find(x => x.key === tile.job.service)?.label || '';
        t(`${tag} ${tile.space.label}: a solid car in the bay`, await el.locator('.car.solid').count() === 1);
        t(`${tag} ${tile.space.label}: says what the car is in for`, !!svc && s.includes(svc), svc);
        const done = tile.job.phases.filter(x => x.status === 'done').length, all = tile.job.phases.length;
        const bw = await el.locator('.prog').evaluate(e => { const f = e.querySelector('i'); return f ? f.getBoundingClientRect().width / e.getBoundingClientRect().width : -1; }).catch(() => -1);
        t(`${tag} ${tile.space.label}: the bar equals stages done (${done} of ${all})`, Math.abs(bw - done / all) <= 0.02, bw.toFixed(3));
        const want = tile.minutesLeft >= 480 ? `About ${Math.ceil(tile.minutesLeft / 480)} working day${Math.ceil(tile.minutesLeft / 480) === 1 ? '' : 's'} left` : null;
        if (want) t(`${tag} ${tile.space.label}: time left in working days of 8 h`, s.includes(want), want);
        const lb = await el.locator('.left').evaluate(e => { const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 12; }).catch(() => false);
        t(`${tag} ${tile.space.label}: the time left can be SEEN (box measured)`, lb);
      }
      if (tile.state === 'blocked') { t(`${tag} ${tile.space.label}: Blocked is a labelled badge`, await el.locator('.pill.blocked').count() === 1 && /Blocked/.test(s));
        const carBg = await el.locator('.car').evaluate(e => getComputedStyle(e).backgroundColor); const ink = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
        t(`${tag} ${tile.space.label}: the blocked car keeps its own colour (not painted red)`, !/b4\s*,\s*35\s*,\s*24|248,\s*113/.test(carBg), carBg + ' ink ' + ink); }
      if (tile.state === 'busy') {
        /* the promise and the forecast, side by side, from the engine's own forecast moment */
        const fore = new Date(tile.forecastAt); const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = d => `${d.getDate()} ${M[d.getMonth()]}`; const prom = new Date(tile.job.promisedAt);
        t(`${tag} ${tile.space.label}: shows the promised day`, s.includes('Promised ' + day(prom)), s.slice(0, 120));
        t(`${tag} ${tile.space.label}: shows the forecast day from the calendar`, s.includes('Forecast ' + day(fore)), 'want ' + day(fore));
        const pEnd = new Date(prom); pEnd.setHours(23, 59, 59, 999); const shouldBeLate = fore.getTime() > pEnd.getTime();
        t(`${tag} ${tile.space.label}: late flag ${shouldBeLate ? 'shown' : 'absent'} as the dates say`, (await el.locator('.risk').count() === 1) === shouldBeLate);
      }
      if (tile.state === 'busy') t(`${tag} ${tile.space.label}: busy tile shows plate and time left`, s.includes(tile.job.plate) && (/About .* left|Running over/.test(s)), s.slice(0, 80));
    }
  }
  for (const br of cast.branches) for (const tile of S.floor(cast, jobs, br.key, now).tiles.filter(x => x.state === 'free')) {
    const el = p.locator(`.fm-group[data-branch="${br.key}"] bb-space-tile[data-space="${tile.space.key}"]`);
    t(`${tag} ${br.name} ${tile.space.label}: a hollow car marked Available`, await el.locator('.car.ghost').count() === 1 && /Available/.test(await el.innerText()));
  }
  /* F4: the dock lanes equal the engine; a car in the dock is never a busy tile */
  const DK = S.dock(jobs, '', now);
  for (const lane of DK.lanes) t(`${tag} dock lane ${lane.key}: cars equal the engine`, await p.locator(`.lane[data-lane="${lane.key}"] .dcar`).count() === lane.cars.length);
  t(`${tag} dock queue equals the engine`, await p.locator('.lane[data-lane="queue"] .plate').count() === DK.queue.length);
  const tilePlates = await p.locator('bb-space-tile.busy .plate').allInnerTexts(); const dockPlates = DK.lanes.flatMap(l => l.cars.map(c => c.job.plate));
  t(`${tag} no car in the dock is counted busy`, !dockPlates.some(x => tilePlates.includes(x)));
  t(`${tag} the dock shows all four waiting states`, await p.locator('.lane[data-lane]').count() === 5);
  /* layout: no sideways scroll; the badge icon sits on the centre of its badge */
  /* the Cars in number is split by the same engine (review, 16 Oct): bays plus waiting plus ready equals the number */
  const kpi = (await p.locator('.kpi .card').first().innerText()).replace(/\s+/g, ' '); const km = /(\d+) .*?(\d+) in a bay · (\d+) waiting · (\d+) ready/.exec(kpi);
  const busyAll = cast.branches.reduce((n2, br) => n2 + S.floor(cast, jobs, br.key, now).busy, 0); const dk2 = S.dock(jobs, '', now);
  t(`${tag} Cars in the workshop = in a bay + waiting + ready, from the engine`, !!km && +km[1] === +km[2] + +km[3] + +km[4] && +km[2] === busyAll && +km[3] === dk2.queue.length + dk2.lanes.filter(l => l.key !== 'ready').reduce((n2, l) => n2 + l.cars.length, 0), kpi.slice(0, 90));
  t(`${tag} no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  for (const [i, st] of [[0, 'busy'], [0, 'free']]) {
    const sel = `bb-space-tile.${st} .badge`; if (!(await p.locator(sel).count())) { t(`${tag} ${st} badge exists (class badge)`, false); continue; }
    await p.locator(sel).nth(i).evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(250);   /* scrolled only into view, the badge sat under the floating menu at 390 (16 Oct) */
    const m = await measure(p, sel, { shape: 'rect', inset: 3, index: i }); t(`${tag} ${st} badge icon centred by its ink`, !m.error && Math.abs(m.dx) <= 0.5 && Math.abs(m.dy) <= 0.5, m.error || `dx ${m.dx} dy ${m.dy}`);
  }
  /* click path: Assign on a free tile places the first queued car; the line moves by one */
  if (W === 390 && DK.queue.length) {
    const grp = p.locator(`.fm-group[data-branch="${DK.queue[0].branch}"]`);
    const before = await grp.locator('.cap').getAttribute('data-busy');
    const free = grp.locator('bb-space-tile.free button'); 
    if (await free.count()) { await free.first().click(); await p.waitForTimeout(600);
      t(`${tag} Assign opens the sheet`, await p.locator('.drawer.on').count() === 1);
      await p.goBack(); await p.waitForTimeout(500); t(`${tag} Back closes the sheet and stays on the floor`, await p.locator('.drawer.on').count() === 0 && p.url().includes('/workshop/floor'));
      await free.first().click(); await p.waitForTimeout(600); const pick = p.locator('.drawer.on .pick'); 
      if (await pick.count()) { await pick.first().click(); await p.waitForTimeout(700); }
      const after = await grp.locator('.cap').getAttribute('data-busy');
      t(`${tag} the sheet closes after placing`, await p.locator('.drawer.on').count() === 0);
      t(`${tag} placing a car moves the line by one`, +after === +before + 1, `${before} to ${after}`); }
    else t(`${tag} a free tile with Assign exists in the first branch`, false);
  }
  /* a dock car opens its job card; F5: every closed stage there shows a photo or No photo */
  const dcar = p.locator('.dcar').first();
  if (await dcar.count()) { const clicked = await dcar.click({ timeout: 5000 }).then(() => true, () => false); t(`${tag} a dock car can be tapped (page not locked after the sheet)`, clicked, await p.evaluate(() => getComputedStyle(document.body).position + ' top ' + document.body.style.top)); await p.waitForTimeout(900); t(`${tag} a dock car opens its job card`, p.url().includes('/workshop/job/'));
    const done = await p.locator('li.ph.done:not(.fin)').count(), framed = await p.locator('li.ph.done:not(.fin) .thumb').count();
    t(`${tag} F5: every closed stage shows its photo or No photo`, done > 0 && done === framed, `${framed} of ${done}`);
    await p.goBack(); await p.waitForTimeout(700); t(`${tag} Back from the job card returns to the floor`, p.url().includes('/workshop/floor')); }
  t(`${tag} no page errors`, !errs.length, errs[0]);
  await c.close();
}
await b.close(); if (srv) srv.kill();
console.log(rows.join('\n')); console.log(bad ? `FAIL ${n - bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
