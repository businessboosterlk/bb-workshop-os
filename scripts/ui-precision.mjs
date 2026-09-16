#!/usr/bin/env node
/* UI PRECISION: every glyph that is meant to sit in the centre of its shape is measured by its
   INK, in dark and light, on a 390px phone at 3x and a 1440px desk at 2x. Born 17 Sep 2026 when
   Thulaib caught "6 of 10" sitting 6.5px high in the progress ring while every harness was green.

   node scripts/ui-precision.mjs [base-url]     exits 1 on any miss
   The check proves itself first on a fixture: centred must read 0, moved 3px must read 3.
   Also runs icon-centre --check, because an icon drawn off centre is off centre everywhere. */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { report, measure } from '/Users/thulaibhassen/bb-systems/qa/optical.mjs';
const BASE = process.argv[2] || 'http://localhost:8771/';
const TOL = 0.5;   /* shapes and icons; anything with text gets one device pixel more, see optical.mjs */
const b = await chromium.launch(); let bad = 0, total = 0; const out = [];

/* 1. the check, proven both ways */
{ const p = await (await b.newContext({ deviceScaleFactor: 3 })).newPage();
  const fx = (shift) => `<div style="width:120px;height:120px;border-radius:50%;background:#16161a;display:grid;place-items:center;margin:20px"><div style="width:30px;height:30px;background:#c9dd2b;transform:translate(0,${shift}px)"></div></div>`;
  await p.setContent(`<body style="margin:0;background:#fff"><div id="a">${fx(0)}</div><div id="b">${fx(3)}</div></body>`);
  const a = await measure(p, '#a > div', { shape: 'circle', inset: 6 }), m = await measure(p, '#b > div', { shape: 'circle', inset: 6 });
  const ok = Math.abs(a.dy) < .2 && Math.abs(m.dy - 3) < .2;
  out.push(`${ok ? 'PASS' : 'FAIL'}  the check itself: centred reads ${a.dy}, moved 3px reads ${m.dy}`); if (!ok) bad++;
  await p.context().close(); }

const seats = {
  customer: async p => { await p.goto(BASE + '#/car/login'); await p.waitForTimeout(1200); await p.fill('#ph', '0771234567'); await p.click('button[type=submit]'); await p.waitForTimeout(700); await p.fill('#code', '1234'); await p.click('button[type=submit]'); await p.waitForTimeout(1500); },
  owner: async p => { await p.goto(BASE + '#/workshop/login'); await p.waitForTimeout(1200); await p.fill('#who', 'Miflal'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await p.waitForTimeout(1500); }
};
/* what is meant to be centred, screen by screen */
const plan = {
  customer: [
    ['/car', [
      { name: 'ring on the car card', text: true, sel: 'bb-ring .ring', shape: 'circle', inset: 14 },
      { name: 'plate text in its plate', text: true, sel: '.car .plate', inset: 2, baseline: true },
      { name: 'WhatsApp mark in its square', sel: '.br-card .ic', inset: 1 },
      { name: 'language button icon', sel: '.top .x', index: 0, inset: 4 },
      { name: 'theme button icon', sel: '.top .x', index: 1, inset: 4 },
      { name: 'tab bar icon: cars', sel: '.bm-btn', index: 0, inset: 6, desk: false, hide: '.dot' },
      { name: 'tab bar icon: history', sel: '.bm-btn', index: 1, inset: 6, desk: false, hide: '.dot' },
      { name: 'tab bar icon: settings', sel: '.bm-btn', index: 2, inset: 6, desk: false, hide: '.dot' } ]],
    ['/car/job/j1', [
      { name: 'ring on the car screen', text: true, sel: 'bb-ring .ring', shape: 'circle', inset: 18 },
      { name: 'tick in a finished phase dot', sel: '.ph.done .dot', shape: 'circle', inset: 3 },
      { name: 'pulse in the running phase dot', sel: '.ph.now .dot', shape: 'circle', inset: 3 },
      { name: 'Approve label in its button', text: true, sel: '.ask .btn', index: 0, inset: 3, baseline: true },
      { name: 'Decline label in its button', text: true, sel: '.ask .btn', index: 1, inset: 3, baseline: true } ]]
  ],
  owner: [
    ['/workshop/floor', [
      { name: 'rail badge number: Floor', text: true, sel: '.rail .nb', index: 0, inset: 1, phone: false, baseline: true },
      { name: 'rail badge number: Cars', text: true, sel: '.rail .nb', index: 1, inset: 1, phone: false, baseline: true },
      { name: 'rail avatar initial', text: true, sel: '.r-foot .avatar', shape: 'circle', inset: 1, phone: false, baseline: true },
      { name: 'Car in button, icon and word', text: true, sel: '.topbar .btn.sm', inset: 3 },
      { name: 'Both chip label', text: true, sel: '.seg button.on', inset: 3, baseline: true },
      { name: 'plate text on the floor', text: true, sel: '.jc .plate', inset: 2, baseline: true },
      { name: 'tab bar icon: floor', sel: '.bm-btn', index: 0, inset: 6, desk: false, hide: '.dot' } ]],
    ['/workshop/enquiries?view=board', [
      { name: 'board count badge', text: true, sel: '.col-n', index: 0, inset: 1, baseline: true },
      { name: 'Board switch, icon and word', text: true, sel: '.seg button', index: 0, inset: 3 },
      { name: 'List switch, icon and word', text: true, sel: '.seg button', index: 1, inset: 3 } ]],
    ['/workshop/cars?f=all', [
      { name: 'selected filter chip label', text: true, sel: '.chips button.on', inset: 3, baseline: true } ]],
    ['/workshop/job/j3', [
      { name: 'camera in the close-phase square', sel: '.big .bi', inset: 1 },
      { name: 'Move the date, icon and word', text: true, sel: '.acts .btn', index: 0, inset: 3 } ]],
    ['/workshop/activity', [
      { name: 'icon in an activity row square', sel: '.list .li .ic', index: 0, inset: 1 } ]]
  ]
};
for (const [label, vp] of [['phone 390 @3x', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ['desk 1440 @2x', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }]]) {
  for (const theme of ['dark', 'light']) {
    for (const who of Object.keys(plan)) {
      const ctx = await b.newContext({ ...vp, colorScheme: theme }); const p = await ctx.newPage();
      await p.addInitScript(t => { try { localStorage.setItem('wos_theme', t); } catch {} }, theme);
      await seats[who](p);
      for (const [hash, checks] of plan[who]) {
        await p.goto(BASE + '#' + hash); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
        const phone = label.startsWith('phone');
        const run = checks.filter(c => phone ? c.phone !== false : c.desk !== false);
        /* the fixed tab bar and toasts are covered for every reading except the tab bar's own */
        total += run.length;
        const r = await report(p, run.map(c => ({ ...c, cover: c.sel.startsWith('.bm') ? '.toast' : c.sel.startsWith('.top') ? '.bm, .toast' : '.bm, .toast, .top, .topbar' })), TOL); bad += r.bad;
        out.push(`--- ${label} · ${theme} · ${who} · ${hash}`, ...r.rows.map(x => '  ' + x));
      }
      await ctx.close();
    }
  }
}
console.log(out.filter((l, i) => !l.startsWith('  PASS') ).join('\n')); console.log(bad ? `RESULT: ${bad} of ${total} readings off centre` : `RESULT: ALL ${total} READINGS CENTRED (shapes and icons within ${TOL}px, text within ${TOL}px plus one device pixel)`);
await b.close(); process.exit(bad ? 1 : 0);
