#!/usr/bin/env node
/* UI SHEETS. Born 17 Sep 2026 when Thulaib opened an enquiry and saw four buttons wrap with "Lost"
   orphaned on its own line: "does this look premium to you". Opens every sheet in the workshop
   system and the customer app, on a 390px phone and a 1440px desk, and fails:
     THE ACTION BAR   a row that is neither one full-width button nor equal-width buttons sharing it,
                      a button whose label wraps or is cut, a bar button under 44px tall
     THE LISTS        a list screen without its filter bar, a filter sheet on the phone that does not open
     EDIT             a record sheet without Edit (enquiry, customer) and a job card without Edit details
   node scripts/ui-sheets.mjs [base-url] */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
const BASE = process.argv[2] || 'http://localhost:8771/';
const b = await chromium.launch(); const rows = []; let bad = 0, total = 0;
const pass = (name, ok, note = '') => { total++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
async function login(p, who, pin){ await p.goto(BASE + '#/workshop/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); await p.fill('#who', who); await p.fill('#pin', pin); await p.click('button[type=submit]'); await p.waitForTimeout(1500); }
/* the rule, measured on the open sheet */
async function bar(p, label){
  await p.waitForTimeout(450);
  const r = await p.evaluate(() => {
    const foot = document.querySelector('.drawer.on .d-foot [foot]'); if (!foot) return { err: 'no action bar' };
    const W = foot.getBoundingClientRect().width; const out = [];
    for (const row of [...foot.children]) {
      if (getComputedStyle(row).display === 'none') continue;
      const btns = row.classList.contains('pair') ? [...row.children] : row.matches('.btn') ? [row] : [];
      if (!btns.length) { out.push('a row that is not a button or a pair'); continue; }
      const ws = btns.map(x => x.getBoundingClientRect().width); const hs = btns.map(x => x.getBoundingClientRect().height);
      const sum = ws.reduce((a, w) => a + w, 0) + (btns.length - 1) * parseFloat(getComputedStyle(row).columnGap || '0');
      if (Math.abs(sum - W) > 1.5) out.push(`row not full width: ${Math.round(sum)} of ${Math.round(W)}`);
      if (Math.max(...ws) - Math.min(...ws) > 1.5) out.push(`unequal widths ${ws.map(Math.round).join('/')}`);
      for (const x of btns) {
        const h = x.getBoundingClientRect().height, lh = parseFloat(getComputedStyle(x).lineHeight) || 20;
        if (h < 43.5) out.push(`"${x.textContent.trim()}" only ${Math.round(h)}px tall`);
        if (x.scrollWidth > x.clientWidth + 1) out.push(`"${x.textContent.trim()}" label cut`);
        const txt = [...x.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()); for (const t of txt) { const g = document.createRange(); g.selectNodeContents(t); if (g.getClientRects().length > 1) out.push(`"${x.textContent.trim()}" label wraps`); }
      }
      if (Math.max(...hs) - Math.min(...hs) > 1) out.push('unequal heights in a row');
    }
    return { out, n: foot.querySelectorAll('.btn').length };
  });
  pass(`${label}: action bar`, !r.err && r.out.length === 0, r.err || (r.out.join('; ') || r.n + ' buttons'));
}
/* tap the way a thumb does: bring the target to the middle of the screen first, clear of fixed bars */
async function tap(loc){ const el = loc.first(); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await el.page().waitForTimeout(150); await el.click(); }
async function closeSheet(p){ await p.keyboard.press('Escape'); await p.waitForTimeout(350); }
const sizes = [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]];
for (const [size, opts] of sizes) {
  for (const [who, pin, role] of [['Miflal', '1111', 'owner'], ['Nuwan', '2222', 'staff']]) {
    const ctx = await b.newContext({ ...opts, colorScheme: 'dark' }); const p = await ctx.newPage(); await login(p, who, pin);
    const L = `${size} ${role}`;
    /* lists carry a filter bar; on the phone the Filters sheet opens and has its own bar */
    for (const [h, name] of [['/workshop/cars?f=all', 'Cars'], ['/workshop/enquiries?view=board', 'Enquiries board'], ['/workshop/enquiries?view=list', 'Enquiries list'], ['/workshop/customers', 'Customers'], ['/workshop/activity', 'Activity'], ...(role === 'owner' ? [['/workshop/quotes', 'Quotes'], ['/workshop/money', 'Money']] : [])]) {
      await p.goto(BASE + '#' + h, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1100);
      pass(`${L} ${name}: filter bar present`, await p.locator('bb-filter-bar').count() === 1);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); pass(`${L} ${name}: page never scrolls sideways`, over <= 0, over > 0 ? over + 'px' : '');
      if (size === 'phone') { await tap(p.locator('bb-filter-bar .fb-open')); await bar(p, `${L} ${name} filters sheet`); await closeSheet(p); }
      else pass(`${L} ${name}: filters visible on desk`, await p.locator('bb-filter-bar .fsel select').first().isVisible());
    }
    /* enquiry sheets: open, quoted, lost; edit; new; lost reason */
    await p.goto(BASE + '#/workshop/enquiries?view=board', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1100);
    for (const [col, name] of [['New', 'Kavinda Rathnayake'], ['Quoted', 'Shalini Perera'], ['Booked', 'Nadeesha Fernando'], ['Lost', 'Tharindu Senanayake']]) {
      const card = p.locator('.col', { hasText: col }).locator('.dc', { hasText: name }); if (!(await card.count())) { pass(`${L} enquiry card ${name} found`, false); continue; }
      await tap(card); await bar(p, `${L} enquiry sheet (${col})`);
      if (col !== 'Booked') pass(`${L} enquiry sheet (${col}): Edit in its head`, await p.locator('.drawer.on .d-edit').count() === 1);
      if (col === 'New') { await p.click('.drawer.on .d-edit'); await bar(p, `${L} edit enquiry`); await closeSheet(p);
        await tap(card); await p.waitForTimeout(300); await p.click('.drawer.on button:has-text("Mark as lost")'); await bar(p, `${L} mark as lost`); }
      await closeSheet(p);
    }
    await tap(p.locator('button:has-text("New enquiry")')); await bar(p, `${L} new enquiry`); await closeSheet(p);
    /* customers: sheet with edit, edit form, add form, follow-up log */
    await p.goto(BASE + '#/workshop/customers', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1100);
    await tap(p.locator('.li.row', { hasText: 'Dilshan Perera' })); await bar(p, `${L} customer sheet`);
    pass(`${L} customer sheet: Edit in its head`, await p.locator('.drawer.on .d-edit').count() === 1);
    await p.click('.drawer.on .d-edit'); await bar(p, `${L} edit customer`); await closeSheet(p);
    await tap(p.locator('button:has-text("Add customer")')); await bar(p, `${L} add customer`); await closeSheet(p);
    await tap(p.locator('.fu button:has-text("Log it")')); await bar(p, `${L} log a follow-up`); await closeSheet(p);
    /* the job card: every sheet */
    await p.goto(BASE + '#/workshop/job/j1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    pass(`${L} job card: Edit details`, await p.locator('.acts button:has-text("Edit details")').count() === 1);
    const grid = await p.evaluate(() => { const bs = [...document.querySelectorAll('.acts > .btn')].map(x => x.getBoundingClientRect()); const ws = bs.map(r => r.width); return { n: bs.length, spread: Math.max(...ws) - Math.min(...ws), rows: new Set(bs.map(r => Math.round(r.top))).size }; });
    const side = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cut: [...document.querySelectorAll('.acts > .btn')].filter(x => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().right > innerWidth).map(x => x.textContent.trim()) }));
    pass(`${L} job card: nothing runs off the screen and no action label is cut`, side.over <= 0 && side.cut.length === 0, side.over > 0 ? `page scrolls sideways by ${side.over}px` : side.cut.join(', '));
    pass(`${L} job card actions: an even grid`, grid.spread <= 1.5 && grid.n % (size === 'phone' ? 2 : 1) === 0, `${grid.n} buttons, ${grid.rows} rows, width spread ${grid.spread.toFixed(1)}px`);
    for (const [btn, name] of [['.big', 'close a phase'], ['.acts button:has-text("Move the date")', 'move the date'], ['.acts button:has-text("Ask the customer")', 'ask the customer'], ['.acts button:has-text("Pickup and drop")', 'pickup and drop'], ['.acts button:has-text("Add a note")', 'add a note'], ['.acts button:has-text("Edit details")', 'edit details']]) {
      await tap(p.locator(btn)); await bar(p, `${L} job sheet: ${name}`); await closeSheet(p);
    }
    if (role === 'owner') { await tap(p.locator('.money button:has-text("Edit")')); await bar(p, `${L} job sheet: money`); await closeSheet(p);
      await p.goto(BASE + '#/workshop/job/j6', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); await tap(p.locator('.big')); await bar(p, `${L} job sheet: deliver`); await closeSheet(p); }
    await ctx.close();
  }
}
console.log(rows.filter(r => r.startsWith('FAIL')).join('\n'));
console.log(bad ? `RESULT: ${bad} of ${total} FAIL` : `RESULT: ALL ${total} PASS`);
await b.close(); process.exit(bad ? 1 : 0);
