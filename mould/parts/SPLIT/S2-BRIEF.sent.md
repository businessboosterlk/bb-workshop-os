PART S2 of the Workshop OS publish split. Plain Node.js 22, ES module, no dependencies (only `node:` built in modules).

THE JOB. The garage product is shown to prospects on a Vercel showroom. Its copy of the built app carries a folder `casts/` with one JSON file per client set up in the app, plus `casts/index.json`. One of those casts is Auto Museum, a paying client, and the showroom must never carry it. Write a new script `scripts/strip-demo-casts.mjs` that is run on the showroom folder after every copy and keeps only the invented demo cast.

HOW THE CASTS FOLDER IS BUILT TODAY (scripts/sync-casts.mjs, whole file, for the shape of index.json):
```js
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
```

CURRENT casts/index.json (whole):
```json
[{"slug":"auto-museum","aliases":["auto-museum","automuseum","auto museum","automuseum.lk"]},{"slug":"demo-garage","aliases":["demo-garage","demo","demo garage","blue bay"]}]
```

The folder today holds `auto-museum.json`, `demo-garage.json` and `index.json`. Each cast file is named `<slug>.json`.

WHAT TO WRITE. Return ONE ```js code block whose first line is this header, exactly:
`// FILE: scripts/strip-demo-casts.mjs`
After the header: the whole new file.

RULES (numbered, every one is checked by a machine):
1. Line 1 after the header: `#!/usr/bin/env node`. Then a short comment saying what the file does and how to run it: `node scripts/strip-demo-casts.mjs <dir>`.
2. The first statement after the imports is exactly `const DEMO_CASTS = ['demo-garage'];` on one line, written exactly like that (single quotes, no spaces inside the brackets). Every rule below reads this list; never write the slug anywhere else.
3. Imports only from `node:fs` and `node:path` (named imports). No `require`. Synchronous fs calls are fine.
4. Usage: `node scripts/strip-demo-casts.mjs <dir>`. The folder worked on is `<dir>/casts`. If `<dir>` is missing, print `usage: node scripts/strip-demo-casts.mjs <dir>` to stderr and exit 1. If `<dir>/casts` is not a folder, print `strip-demo-casts: no casts folder in <dir>` to stderr and exit 1.
5. In `<dir>/casts`, for every file ending in `.json` other than `index.json`: keep it when its name without `.json` is in DEMO_CASTS, otherwise delete it. Files not ending in `.json` are left alone. Do not touch sub folders.
6. Rewrite `<dir>/casts/index.json` with `JSON.stringify(kept)` (no spaces) where `kept` is the entries of the old index whose `slug` is in DEMO_CASTS AND whose file `<slug>.json` was kept, in the old order, each entry unchanged. If index.json is missing or not a JSON array, treat the old index as empty.
7. Then the safety checks, each prints one line to stderr starting `strip-demo-casts: ` and exits 1:
   a. the rewritten index is empty (DEMO_CASTS matched nothing);
   b. the text of ANY file still in `<dir>/casts` (every file, json or not, including index.json) matches `/auto ?museum/i` (that covers "Auto Museum", "automuseum", "AUTO MUSEUM"); name the file in the message.
8. On success print one line to stdout: `demo casts only: <slugs joined by ", "> (removed <n>)` and exit 0.
9. Never read or write outside `<dir>/casts`. Never change the content of a kept cast file.
10. No em dash or en dash characters anywhere in the file.
