#!/usr/bin/env node
/* EVERY SCREEN, MEASURED AND PHOTOGRAPHED. Ported from the Hub (28 Sep 2026). Walks the doors, every
   screen of the workshop system as the owner and of the customer app, and every sheet it can open by
   a real tap, at 390, 320 and 1440, in day and in night. The gap audit runs on each and a photograph
   of each goes to evidence/gallery for a person to LOOK at.
   node scripts/ui-walk.mjs [out-folder]      exits 1 on any fault */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, serve, context, staff, customer, ROOT } from './lib/world.mjs';
import { AUDIT } from './lib/audit.mjs';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'evidence/gallery')); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const { srv, base } = serve(); const browser = await chromium.launch();
const faults = []; let surfaces = 0; const errors = []; const words = new Set();
async function walk(tag, width, desk, dark) {
  const c = await context(browser, { width, desk, dark }); const p = await c.newPage();
  p.on('pageerror', e => errors.push(tag + ' ' + String(e))); p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(tag + ' ' + m.text()); });
  const shoot = width !== 320; let n = 0;
  const see = async name => { await p.waitForTimeout(420); surfaces++;
    const hits = await p.evaluate(AUDIT); hits.forEach(x => faults.push(tag + ' ' + name + ': ' + x));
    (await p.evaluate(() => [...document.body.innerText.split('\n'), ...[...document.querySelectorAll('[placeholder]')].map(e => e.getAttribute('placeholder')), ...[...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label'))].map(x => (x || '').replace(/ /g, ' ').trim()).filter(Boolean))).forEach(w => words.add(w));
    if (shoot) await p.screenshot({ path: path.join(OUT, tag + '-' + String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  const tap = s => desk ? p.locator(s).first().click({ timeout: 6000 }) : p.locator(s).first().tap({ timeout: 6000 });
  const step = async (name, fn) => { try { await fn(); } catch (e) { faults.push(tag + ' ' + name + ': COULD NOT WALK: ' + String(e.message).split('\n')[0].slice(0, 140)); await p.screenshot({ path: path.join(OUT, tag + '-STUCK-' + name + '.png') }).catch(() => {}); } for (let i = 0; i < 3; i++) { if (!(await p.locator('.drawer.on').count())) break; await p.keyboard.press('Escape'); await p.waitForTimeout(320); } };
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(350); };
  const sheet = (name, hash, opener) => step(name, async () => { await go(hash); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); await tap(opener); await p.waitForSelector('.drawer.on', { timeout: 5000 }); await see(name); });

  await p.goto(base); await p.waitForSelector('.door .dr'); await see('welcome');
  await go('#/workshop/login'); await p.waitForSelector('#who'); await see('door-staff');
  await p.fill('#who', 'Nobody'); await p.fill('#pin', '0000'); await p.click('button[type=submit]'); await p.waitForTimeout(900); await see('door-staff-refused');
  await go('#/car/login'); await p.waitForSelector('#ph'); await see('door-customer');
  await staff(p, base);
  for (const s of ['floor', 'cars', 'new', 'quotes', 'customers', 'activity', 'money', 'settings']) await step('workshop-' + s, async () => { await go('#/workshop/' + s); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); await see('workshop-' + s); });
  await step('workshop-enquiries-board', async () => { await go('#/workshop/enquiries'); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); await tap('.seg button:nth-child(1)'); await see('workshop-enquiries-board'); });
  await step('workshop-enquiries-list', async () => { await tap('.seg button:nth-child(2)'); await see('workshop-enquiries-list'); await tap('.seg button:nth-child(1)'); });
  await step('workshop-job', async () => { await go('#/workshop/cars'); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); await tap('a.mc:visible, table.tbl tbody tr:visible'); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); await see('workshop-job'); });
  const job = await p.evaluate(() => location.hash.split('?')[0]);
  await sheet('sheet-enquiry-new', '#/workshop/enquiries', '.ph-right .btn:visible');
  await sheet('sheet-enquiry', '#/workshop/enquiries', '.board .cdk-drag:visible, .col-b > *:visible');
  await sheet('sheet-customer-new', '#/workshop/customers', '.ph-right .btn:visible');
  await sheet('sheet-customer', '#/workshop/customers', 'button.li.link.row:visible, table.tbl tbody tr:visible');
  if (/job\//.test(job)) for (const [name, label] of [['sheet-job-date', 'Move the date'], ['sheet-job-note', 'Add a note'], ['sheet-job-edit', 'Edit details'], ['sheet-job-ask', 'Ask the customer'], ['sheet-job-pickup', 'Pickup and drop']])
    await step(name, async () => { await go(job); await p.waitForSelector('main.page .t-h1, main.page h1, main.page h2'); const b = p.locator('main button', { hasText: new RegExp(label, 'i') }).first(); desk ? await b.click({ timeout: 6000 }) : await b.tap({ timeout: 6000 }); await p.waitForSelector('.drawer.on', { timeout: 5000 }); await see(name); });
  if (!desk) {
    await step('sheet-filters', async () => { await go('#/workshop/cars'); await tap('.fb-open'); await p.waitForSelector('.drawer.on'); await see('sheet-filters'); });
    await step('rail', async () => { await go('#/workshop/floor'); await tap('.hamb'); await p.waitForSelector('.rail.open'); await see('rail'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); });
    await step('bottom-menu', async () => { await tap('.bm-btn:nth-child(3)'); await p.waitForSelector('.bm-sub.on'); await see('bottom-menu'); await p.keyboard.press('Escape'); });
  }
  await c.close();
  const c2 = await context(browser, { width, desk, dark }); const q = await c2.newPage(); q.on('pageerror', e => errors.push(tag + ' customer ' + String(e)));
  const see2 = async name => { await q.waitForTimeout(420); surfaces++; (await q.evaluate(AUDIT)).forEach(x => faults.push(tag + ' ' + name + ': ' + x)); (await q.evaluate(() => document.body.innerText.split('\n').map(x => x.replace(/ /g, ' ').trim()).filter(Boolean))).forEach(w => words.add(w)); if (shoot) await q.screenshot({ path: path.join(OUT, tag + '-c' + String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  try { await customer(q, base); await see2('customer-cars');
    for (const s of ['history', 'settings']) { await q.evaluate(x => { location.hash = x; }, '#/car/' + s); await q.waitForTimeout(400); await see2('customer-' + s); }
    await q.evaluate(() => { location.hash = '#/car'; }); await q.waitForTimeout(400); const card = q.locator('main a[href*="/car/job/"], main a.card').first(); if (await card.count()) { desk ? await card.click() : await card.tap(); await q.waitForTimeout(500); await see2('customer-job'); }
  } catch (e) { faults.push(tag + ' customer: COULD NOT WALK: ' + String(e.message).split('\n')[0].slice(0, 140)); }
  await c2.close();
}
for (const dark of [false, true]) { const t = dark ? 'night' : 'day';
  await walk('phone390-' + t, 390, false, dark); await walk('phone320-' + t, 320, false, dark); await walk('desk1440-' + t, 1440, true, dark); }
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, 'words.txt'), [...words].sort().join('\n') + '\n');
const kind = f => f.replace(/^\S+ /, '').replace(/ "[^"]*"/g, '');
const kinds = [...new Set(faults.map(kind))];
console.log('EVERY SCREEN: ' + surfaces + ' surfaces measured at three widths in day and night. ' + faults.length + ' faults of ' + kinds.length + ' kinds.');
kinds.forEach(k => console.log('   ' + k + '   [' + [...new Set(faults.filter(f => kind(f) === k).map(f => f.split(' ')[0]))].join(',') + ']'));
if (errors.length) { console.log('PAGE ERRORS: ' + errors.length); [...new Set(errors)].slice(0, 8).forEach(e => console.log('   ' + e)); }
console.log((faults.length || errors.length ? 'FAIL' : 'PASS') + '  ' + surfaces + ' surfaces, ' + faults.length + ' faults, ' + errors.length + ' page errors. Photographs in ' + OUT);
process.exit(faults.length || errors.length ? 1 : 0);
