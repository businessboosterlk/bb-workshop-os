#!/usr/bin/env node
/* Runs the Workshop OS's own ?selftest on the doors and inside both shells, on a phone and on a desk,
   at the address it is published under. node scripts/selftest-run.mjs    exits 1 on any failed line */
import { chromium, serve, context, staff, customer } from './lib/world.mjs';
const { srv, base } = serve(); const b = await chromium.launch(); let bad = 0, total = 0;
for (const [tag, opt] of [['phone', {}], ['desk', { desk: true, width: 1440 }]]) {
  for (const [who, enter, screens] of [['nobody', null, [['welcome', ''], ['staff door', '#/workshop/login'], ['customer door', '#/car/login']]], ['owner', staff, [['floor', '#/workshop'], ['enquiries', '#/workshop/enquiries'], ['quotes', '#/workshop/quotes']]], ['customer', customer, [['cars', '#/car']]]]) {
    const c = await context(b, opt); const p = await c.newPage(); const lines = [];
    p.on('console', m => { const t = m.text(); if (/^FAIL/.test(t)) lines.push(t); });
    if (enter) await enter(p, base);
    for (const [name, hash] of screens) { lines.length = 0; await p.goto('about:blank'); await p.goto(base + '?selftest' + hash); await p.waitForFunction(() => window.__bbwos, null, { timeout: 90000 }); const r = await p.evaluate(() => window.__bbwos); total += r.total; bad += r.total - r.pass; console.log(`--- ${tag} · ${who} · ${name}: ${r.pass}/${r.total}`); lines.forEach(l => console.log('  ' + l.slice(0, 260))); }
    await c.close();
  }
}
await b.close(); srv.close();
console.log(bad ? `RESULT: ${bad} of ${total} self test lines failed` : `RESULT: ALL ${total} SELF TEST LINES PASS`); process.exit(bad ? 1 : 0);
