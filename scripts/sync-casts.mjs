#!/usr/bin/env node
/* Builds the static site's cast folder from scratch: only local casts. The folder is
   wiped first, so a cast moved to the server can never linger on the public site. */
import { readdir, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
const src = path.resolve('casts'), dst = path.resolve('apps/web/public/casts');
await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });
const index = [];
for (const f of (await readdir(src)).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(await readFile(path.join(src, f), 'utf8'));
  if (c.data?.mode !== 'local') continue;
  await copyFile(path.join(src, f), path.join(dst, f));
  index.push({ slug: c.slug, aliases: [c.slug, ...(c.aliases || [])] });
}
await writeFile(path.join(dst, 'index.json'), JSON.stringify(index));
console.log(`public casts rebuilt: ${index.map(i => i.slug).join(', ') || 'none'}`);
