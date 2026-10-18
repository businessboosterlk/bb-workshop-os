// Run every API security check in its own node process (each has its own memory store) and print the last line of each.
//   node mould/parts/API/run-all.mjs [a1 a2 ...]
import { spawnSync } from 'node:child_process'; import { existsSync } from 'node:fs'; import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const parts = process.argv.slice(2).length ? process.argv.slice(2) : ['a1', 'a2', 'a3', 'a4', 'a5'];
let bad = 0;
for (const p of parts) {
  const f = join(HERE, p + '-check.mjs'); if (!existsSync(f)) { console.log(p.toUpperCase() + ': no check yet'); continue; }
  const r = spawnSync(process.execPath, ['--no-warnings', f], { encoding: 'utf8', env: { ...process.env, WOS_SECRET: undefined, NODE_ENV: undefined } });
  const lines = (r.stdout || '').trim().split('\n'); if (r.status !== 0) bad++;
  for (const l of lines) if (l.startsWith('FAIL')) console.log('  ' + l);
  console.log(lines[lines.length - 1] || (p + ': no output ' + (r.stderr || '').slice(0, 300)));
}
process.exit(bad ? 1 : 0);
