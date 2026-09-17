#!/usr/bin/env node
/* Runs ~/bb-systems/qa/polish.mjs on every screen and open sheet, phone and desk. Exits 1 on a miss.
   node scripts/ui-polish.mjs [base-url] */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { polish } from '/Users/thulaibhassen/bb-systems/qa/polish.mjs';
const BASE = process.argv[2] || 'http://localhost:8771/'; const b = await chromium.launch(); let bad = 0, total = 0; const fails = new Map();
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'domcontentloaded' });
async function read(p, where){ for (const r of await polish(p)) { total++; if (!r.ok) { bad++; const k = r.rule + ': ' + r.note; fails.set(k, [...(fails.get(k) || []), where]); } } }
for (const [size, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1440, height: 900 } }]]) {
  let p = await (await b.newContext({ ...opts, colorScheme: 'dark' })).newPage();
  await go(p, '#/workshop/login'); await p.waitForTimeout(1300); await read(p, `${size} team door`);
  await p.fill('#who', 'Miflal'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await p.waitForTimeout(1500);
  for (const h of ['/workshop/floor', '/workshop/cars?f=all', '/workshop/enquiries?view=board', '/workshop/enquiries?view=list', '/workshop/quotes', '/workshop/quote/q2', '/workshop/customers', '/workshop/activity', '/workshop/money', '/workshop/settings', '/workshop/new', '/workshop/job/j1']) { await go(p, '#' + h); await p.waitForTimeout(1000); await read(p, `${size} ${h}`); }
  await go(p, '#/workshop/enquiries?view=board'); await p.waitForTimeout(900); await p.locator('.dc').first().click(); await p.waitForTimeout(600); await read(p, `${size} enquiry sheet`);
  await p.context().close();
  p = await (await b.newContext({ ...opts, colorScheme: 'dark' })).newPage();
  await go(p, '#/'); await p.waitForTimeout(1200); await read(p, `${size} front door`);
  await go(p, '#/car/login'); await p.waitForTimeout(1200); await p.fill('#ph', '0771234567'); await p.click('button[type=submit]'); await p.waitForTimeout(700); await p.fill('#code', '1234'); await p.click('button[type=submit]'); await p.waitForTimeout(1500);
  for (const h of ['/car', '/car/job/j1', '/car/history', '/car/settings']) { await go(p, '#' + h); await p.waitForTimeout(1000); await read(p, `${size} ${h}`); }
  await p.context().close();
}
for (const [k, where] of fails) console.log(`FAIL  ${k}\n      on ${where.length} screens: ${where.slice(0, 4).join(' · ')}`);
console.log(bad ? `RESULT: ${bad} of ${total} polish readings FAIL` : `RESULT: ALL ${total} POLISH READINGS PASS`);
await b.close(); process.exit(bad ? 1 : 0);
