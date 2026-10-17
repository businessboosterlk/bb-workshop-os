// Run every check of batch 1 (A1 to A5) and batch 2 (B1 to B5), each in its own node process, and print the
// failures and the last line of each.   node mould/parts/API2/run-all.mjs [a1 b2 ...]
import { spawnSync } from 'node:child_process'; import { existsSync } from 'node:fs'; import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const all = ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5'];
const parts = process.argv.slice(2).length ? process.argv.slice(2) : all;
let bad = 0;
for (const p of parts) {
  const f = join(HERE, '..', p[0] === 'a' ? 'API' : 'API2', p + '-check.mjs'); if (!existsSync(f)) { console.log(p.toUpperCase() + ': no check yet'); continue; }
  const r = spawnSync(process.execPath, ['--no-warnings', f], { encoding: 'utf8', env: { ...process.env, WOS_SECRET: undefined, NODE_ENV: undefined } });
  const lines = (r.stdout || '').trim().split('\n'); if (r.status !== 0) bad++;
  for (const l of lines) if (l.startsWith('FAIL')) console.log('  ' + l.slice(0, 260));
  console.log(lines[lines.length - 1] || (p + ': no output ' + (r.stderr || '').slice(0, 300)));
}
process.exit(bad ? 1 : 0);
