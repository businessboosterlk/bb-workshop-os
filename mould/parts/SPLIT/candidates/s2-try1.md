```js
// FILE: scripts/strip-demo-casts.mjs
#!/usr/bin/env node
/* Removes all casts except the demo ones from <dir>/casts. Run with: node scripts/strip-demo-casts.mjs <dir> */
import { readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const DEMO_CASTS = ['demo-garage'];

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/strip-demo-casts.mjs <dir>');
  process.exit(1);
}

const castsDir = path.join(dir, 'casts');
try {
  const st = await stat(castsDir);
  if (!st.isDirectory()) throw new Error();
} catch {
  console.error(`strip-demo-casts: no casts folder in ${dir}`);
  process.exit(1);
}

let files;
try {
  files = await readdir(castsDir);
} catch {
  console.error(`strip-demo-casts: no casts folder in ${dir}`);
  process.exit(1);
}

const keptSlugs = [];
for (const f of files) {
  if (f === 'index.json' || !f.endsWith('.json')) continue;
  const slug = f.slice(0, -5);
  if (DEMO_CASTS.includes(slug)) {
    keptSlugs.push(slug);
  } else {
    await rm(path.join(castsDir, f), { force: true });
  }
}

let oldIndex = [];
try {
  const raw = await readFile(path.join(castsDir, 'index.json'), 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) oldIndex = parsed;
} catch {
  oldIndex = [];
}

const kept = oldIndex.filter(entry => keptSlugs.includes(entry.slug));
await writeFile(path.join(castsDir, 'index.json'), JSON.stringify(kept));

if (kept.length === 0) {
  console.error('strip-demo-casts: no demo casts kept');
  process.exit(1);
}

const allFiles = await readdir(castsDir);
for (const f of allFiles) {
  const full = path.join(castsDir, f);
  const st = await stat(full);
  if (st.isDirectory()) continue;
  const content = await readFile(full, 'utf8');
  if (/auto ?museum/i.test(content)) {
    console.error(`strip-demo-casts: forbidden cast name in ${f}`);
    process.exit(1);
  }
}

const removed = files.filter(f => f.endsWith('.json') && f !== 'index.json' && !keptSlugs.includes(f.slice(0, -5))).length;
console.log(`demo casts only: ${kept.map(e => e.slug).join(', ')} (removed ${removed})`);
```