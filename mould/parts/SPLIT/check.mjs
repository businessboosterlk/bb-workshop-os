#!/usr/bin/env node
// THE PUBLISH SPLIT CHECK, 18 Oct 2026. Written by Claude before any crew run.
// GitHub Pages is Auto Museum's site and must publish only from the auto-museum branch; the garage product (main) must
// publish only to the Vercel showroom. This check proves both scripts guard their branch, that the Vercel copy carries no
// Auto Museum cast, and that the gate has a line for it.
//   node mould/parts/SPLIT/check.mjs            (SPLIT_SCRATCH=<dir> to choose where the temp clone goes)
// SAFETY. Nothing here can push, publish or deploy: every script runs inside a temp clone whose origin is a path that does
// not exist, with HOME set to a temp folder (no ssh keys, no real node bin), and with shims first on PATH: git refuses
// clone, push, fetch and pull; ssh and vercel refuse; npx only fakes the two calls the scripts make (ng build writes a fake
// dist, vercel writes a line to the log); curl answers from the fake target; scripts/gate.sh is answered by a stub.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BASE = process.env.SPLIT_SCRATCH || os.tmpdir();
fs.mkdirSync(BASE, { recursive: true });
const T = fs.mkdtempSync(path.join(BASE, 'split-check-'));
const counts = {}; let pass = 0, fail = 0;
const ok = (part, name, cond, extra = '') => {
  counts[part] = counts[part] || { p: 0, n: 0 }; counts[part].n++;
  if (cond) { counts[part].p++; pass++; console.log(`PASS  ${part} ${name}`); }
  else { fail++; console.log(`FAIL  ${part} ${name}${extra ? '\n        ' + String(extra).replace(/\n/g, '\n        ').slice(0, 900) : ''}`); }
};
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const G = (cwd, ...a) => sh('/usr/bin/git', ['-c', 'user.name=split-check', '-c', 'user.email=check@localhost', ...a], cwd);
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

// ---------- the fake world ----------
const FH = path.join(T, 'home'), BIN = path.join(FH, '.local', 'node', 'bin'), LOG = path.join(T, 'calls.log');
fs.mkdirSync(BIN, { recursive: true });
fs.symlinkSync(process.execPath, path.join(BIN, 'node'));
const shim = (name, body) => { fs.writeFileSync(path.join(BIN, name), '#!/bin/sh\n' + body + '\n'); fs.chmodSync(path.join(BIN, name), 0o755); };
shim('git', `for a in "$@"; do case "$a" in clone|push|fetch|pull|ls-remote) echo "git $* @ $(pwd)" >> "$SPLIT_LOG"; echo "SHIM REFUSED: git $a"; exit 97;; esac; done
exec /usr/bin/git "$@"`);
shim('ssh', 'echo "ssh $*" >> "$SPLIT_LOG"; echo "SHIM REFUSED: ssh"; exit 97');
shim('vercel', 'echo "vercel $* @ $(pwd)" >> "$SPLIT_LOG"; echo "SHIM REFUSED: vercel"; exit 97');
shim('npm', 'echo "npm $* @ $(pwd)" >> "$SPLIT_LOG"; echo "SHIM REFUSED: npm"; exit 98');
shim('sleep', 'exit 0');
shim('npx', `echo "npx $* @ $(pwd)" >> "$SPLIT_LOG"
case "$*" in
  *"ng build"*) mkdir -p dist/web/browser && cp -R public/. dist/web/browser/ && printf '<!doctype html><title>Workshop OS</title>' > dist/web/browser/index.html && echo "fake build written"; exit 0;;
  *vercel@*deploy*) echo "fake deploy, nothing sent"; exit 0;;
esac
echo "SHIM REFUSED: npx $*"; exit 98`);
shim('curl', `echo "curl $* @ $(pwd)" >> "$SPLIT_LOG"
if [ "$CURL_MODE" = wrong ]; then printf '{"build":"1999-01-01 00:00"}'; else cat "$WOS_VERCEL_DIR/version.json"; fi`);
shim('bash', `case "$1" in scripts/gate.sh|./scripts/gate.sh) echo "gate stub: \${GATE_STUB:-red}" >> "$SPLIT_LOG"; echo "gate stub: \${GATE_STUB:-red}"; [ "$GATE_STUB" = green ] && exit 0 || exit 1;; esac
exec /bin/bash "$@"`);
const ENV = { HOME: FH, PATH: `${BIN}:/usr/bin:/bin:/usr/sbin:/sbin`, SPLIT_LOG: LOG, LANG: 'en_GB.UTF-8' };
const calls = () => read(LOG) || '';
const run = (cwd, script, args = [], env = {}) => {
  fs.writeFileSync(LOG, '');
  const r = spawnSync('/bin/bash', [script, ...args], { cwd, env: { ...ENV, ...env }, encoding: 'utf8', timeout: 180000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), log: calls() };
};

// ---------- the temp clone with the candidate scripts ----------
const C = path.join(T, 'clone');
sh('/usr/bin/git', ['clone', '-q', '--no-hardlinks', ROOT, C]);
G(C, 'checkout', '-q', '-B', 'main', 'HEAD');
G(C, 'remote', 'set-url', 'origin', '/nonexistent/businessboosterlk/bb-workshop-os.git');
const CAND = ['scripts/deploy-pages.sh', 'scripts/deploy-vercel.sh', 'scripts/strip-demo-casts.mjs', 'scripts/gate.sh'];
for (const f of CAND) { const s = path.join(ROOT, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(C, f)); }
G(C, 'add', '-A'); if (G(C, 'status', '--porcelain').trim()) G(C, 'commit', '-q', '-m', 'candidate scripts');
const RESET = () => { G(C, 'reset', '-q', '--hard'); G(C, 'clean', '-fdxq'); };
const on = b => { RESET(); G(C, 'checkout', '-q', '-B', b); };
const clean = () => G(C, 'status', '--porcelain', '--untracked-files=no').trim() === '';
const ORIG = n => G(ROOT, 'show', `8d78c83:scripts/${n}`);

// ================= S1 deploy-pages.sh guard =================
const PG = 'scripts/deploy-pages.sh';
const pagesMsg = b => `NOT PUBLISHED: GitHub Pages is Auto Museum's site and publishes only from the auto-museum branch (this is ${b})`;
for (const b of ['main', 'three-segments']) {
  on(b); const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', `refuses on ${b}: exit 1`, r.code === 1, r.out);
  ok('S1', `refuses on ${b}: the exact message`, r.out.includes(pagesMsg(b)), r.out);
  ok('S1', `refuses on ${b}: no other step ran (tree clean, no gate, no clone)`, clean() && !/gate stub|git clone|npx/.test(r.log), r.log);
}
on('auto-museum');
{ const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', 'passes on auto-museum: exit 0', r.code === 0, r.out);
  ok('S1', 'passes on auto-museum: prints "guard passed: auto-museum"', r.out.includes('guard passed: auto-museum'), r.out);
  ok('S1', 'passes on auto-museum: nothing after the guard ran (no stamp, gate or clone)', clean() && !/gate stub|git clone|npx|curl/.test(r.log) && !/stamped|public casts rebuilt/.test(r.out), r.out + r.log); }
{ fs.writeFileSync(path.join(C, 'notes-untracked.txt'), 'x');
  const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', 'an untracked file alone does not block the guard', r.code === 0 && r.out.includes('guard passed: auto-museum'), r.out); }
{ on('auto-museum'); fs.appendFileSync(path.join(C, 'README.md'), '\nchanged\n');
  const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', 'refuses on auto-museum with a modified tracked file: exit 1', r.code === 1, r.out);
  ok('S1', 'that refusal names the tracked files', /NOT PUBLISHED: tracked files differ from the last commit/.test(r.out), r.out);
  ok('S1', 'that refusal runs no other step', !/gate stub|git clone|npx/.test(r.log) && !/stamped/.test(r.out), r.out); }
{ on('auto-museum'); fs.appendFileSync(path.join(C, 'README.md'), '\nstaged\n'); G(C, 'add', 'README.md');
  const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', 'refuses on auto-museum with a staged change', r.code === 1 && /tracked files differ/.test(r.out), r.out); }
{ on('auto-museum'); G(C, 'remote', 'set-url', 'origin', '/nonexistent/someone/else.git');
  const r = run(C, PG, [], { WOS_GUARD_ONLY: '1' });
  ok('S1', 'the remote check still runs first', r.code === 1 && r.out.includes('NOT PUBLISHED: this folder\'s remote is not'), r.out);
  G(C, 'remote', 'set-url', 'origin', '/nonexistent/businessboosterlk/bb-workshop-os.git'); }
{ const now = (read(path.join(ROOT, PG)) || '').split('\n'), was = ORIG('deploy-pages.sh').split('\n');
  const r0 = was.findIndex(l => l.includes('git remote get-url origin'));
  const head = now.slice(0, r0 + 1).join('\n') === was.slice(0, r0 + 1).join('\n');
  const tailN = was.length - r0 - 1, tail = now.slice(now.length - tailN).join('\n') === was.slice(r0 + 1).join('\n');
  const added = now.slice(r0 + 1, now.length - tailN);
  ok('S1', 'nothing else in deploy-pages.sh changed: only new lines, right after the remote check', head && tail && added.length > 0 && added.length <= 12, `head ${head} tail ${tail} added ${added.length}`);
  ok('S1', 'the guard reads the branch with git rev-parse --abbrev-ref HEAD and checks with git diff --quiet HEAD', added.join('\n').includes('git rev-parse --abbrev-ref HEAD') && added.join('\n').includes('git diff --quiet HEAD'), added.join('\n')); }

// ================= S2 strip-demo-casts.mjs =================
const STRIP = path.join(C, 'scripts', 'strip-demo-casts.mjs');
const SRC = path.join(ROOT, 'apps', 'web', 'public', 'casts');
const AM = /auto ?museum/i;
const copyCasts = name => { const d = path.join(T, name); fs.mkdirSync(path.join(d, 'casts'), { recursive: true }); for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(d, 'casts', f)); return d; };
const nodeRun = (script, args) => { const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 30000, env: ENV }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const stripSrc = read(STRIP) || '';
ok('S2', 'the file exists and the list is the first statement form: const DEMO_CASTS = [\'demo-garage\'];', stripSrc.includes("const DEMO_CASTS = ['demo-garage'];"));
ok('S2', 'no dependencies: imports only node: modules', stripSrc.length > 0 && [...stripSrc.matchAll(/from\s+['"]([^'"]+)['"]/g)].every(m => m[1].startsWith('node:')) && !/require\(/.test(stripSrc));
{ const d = copyCasts('strip-a'); fs.writeFileSync(path.join(d, 'casts', 'old-client.json'), JSON.stringify({ slug: 'old-client', name: 'Old' })); fs.writeFileSync(path.join(d, 'casts', 'readme.txt'), 'casts folder');
  const r = nodeRun(STRIP, [d]); const left = fs.existsSync(path.join(d, 'casts')) ? fs.readdirSync(path.join(d, 'casts')).sort() : [];
  ok('S2', 'strips a copy of the real casts: exit 0', r.code === 0, r.out);
  ok('S2', 'leaves only demo-garage.json and index.json (and the non json file)', JSON.stringify(left) === JSON.stringify(['demo-garage.json', 'index.json', 'readme.txt']), left.join(', '));
  let idx = null; try { idx = JSON.parse(read(path.join(d, 'casts', 'index.json'))); } catch {}
  const origIdx = JSON.parse(read(path.join(SRC, 'index.json'))).find(e => e.slug === 'demo-garage');
  ok('S2', 'index.json has one entry, demo-garage, with its aliases as before', Array.isArray(idx) && idx.length === 1 && JSON.stringify(idx[0]) === JSON.stringify(origIdx), JSON.stringify(idx));
  ok('S2', 'demo-garage.json is untouched byte for byte', read(path.join(d, 'casts', 'demo-garage.json')) === read(path.join(SRC, 'demo-garage.json')));
  ok('S2', 'no remaining file says Auto Museum', left.every(f => !AM.test(read(path.join(d, 'casts', f)) || ''))); }
{ const d = copyCasts('strip-b'); const alt = path.join(T, 'strip-nothing.mjs'); fs.writeFileSync(alt, stripSrc.replace("const DEMO_CASTS = ['demo-garage'];", "const DEMO_CASTS = ['no-such-cast'];"));
  const r = nodeRun(alt, [d]); ok('S2', 'exits 1 with a message when DEMO_CASTS matches nothing', stripSrc && r.code === 1 && r.out.trim().length > 0, r.out); }
{ const d = copyCasts('strip-c'); const f = path.join(d, 'casts', 'demo-garage.json'); const j = JSON.parse(read(f)); j.note = 'Once shown to AutoMuseum'; fs.writeFileSync(f, JSON.stringify(j));
  const r = nodeRun(STRIP, [d]); ok('S2', 'exits 1 when a kept file still says AutoMuseum (any case, with or without the space)', stripSrc && r.code === 1 && r.out.trim().length > 0, r.out); }
{ const d = copyCasts('strip-d'); const f = path.join(d, 'casts', 'index.json'); fs.writeFileSync(f, JSON.stringify([{ slug: 'demo-garage', aliases: ['demo-garage', 'auto museum'] }]));
  const r = nodeRun(STRIP, [d]); ok('S2', 'exits 1 when the rewritten index still carries an Auto Museum alias', stripSrc && r.code === 1, r.out); }
{ const r = nodeRun(STRIP, []); ok('S2', 'exits 1 with a usage line when no folder is given', stripSrc && r.code === 1 && r.out.trim().length > 0, r.out);
  const r2 = nodeRun(STRIP, [path.join(T, 'no-such-dir')]); ok('S2', 'exits 1 when the folder has no casts folder', stripSrc && r2.code === 1, r2.out); }

// ================= S3 deploy-vercel.sh =================
const VG = 'scripts/deploy-vercel.sh';
const vSrc = read(path.join(ROOT, VG)) || '';
const vercelMsg = b => `NOT PUBLISHED: the Vercel showroom publishes only from main (this is ${b})`;
ok('S3', 'deploy-vercel.sh exists with set -euo pipefail and the PATH line', vSrc.includes('set -euo pipefail') && vSrc.includes('export PATH="$HOME/.local/node/bin:$PATH"'));
ok('S3', 'pins vercel@63.1.0 and builds with --base-href /', vSrc.includes('vercel@63.1.0') && vSrc.includes('--base-href /'));
ok('S3', 'never names gh-pages outside comments', vSrc.length > 0 && !vSrc.split('\n').filter(l => !l.trim().startsWith('#')).join('\n').includes('gh-pages'));
for (const b of ['auto-museum', 'three-segments']) {
  on(b); const r = run(C, VG, [], { WOS_GUARD_ONLY: '1' });
  ok('S3', `refuses on ${b}: exit 1 with the exact message`, r.code === 1 && r.out.includes(vercelMsg(b)), r.out);
  ok('S3', `refuses on ${b}: no other step ran`, clean() && !/gate stub|npx|curl/.test(r.log), r.log);
}
on('main');
{ const r = run(C, VG, [], { WOS_GUARD_ONLY: '1' });
  ok('S3', 'passes on main: exit 0 and prints "guard passed: main"', r.code === 0 && r.out.includes('guard passed: main'), r.out);
  ok('S3', 'passes on main: nothing after the guard ran', clean() && !/gate stub|npx|curl/.test(r.log) && !/stamped/.test(r.out), r.out + r.log); }
{ on('main'); fs.appendFileSync(path.join(C, 'README.md'), '\nchanged\n');
  const r = run(C, VG, [], { WOS_GUARD_ONLY: '1' });
  ok('S3', 'refuses on main with a modified tracked file, naming it', r.code === 1 && /NOT PUBLISHED: tracked files differ from the last commit/.test(r.out) && !/npx|gate stub/.test(r.log), r.out); }
// the whole flow against a fake target folder
const V = path.join(T, 'vercel-target');
const makeTarget = (cfg = '{"cast":"demo-garage"}') => {
  fs.rmSync(V, { recursive: true, force: true }); fs.mkdirSync(path.join(V, '.vercel'), { recursive: true }); fs.mkdirSync(path.join(V, 'casts'));
  fs.writeFileSync(path.join(V, '.vercel', 'project.json'), '{"projectId":"keep"}'); fs.writeFileSync(path.join(V, 'vercel.json'), '{"keep":true}');
  fs.writeFileSync(path.join(V, 'config.json'), cfg); fs.writeFileSync(path.join(V, 'manifest.webmanifest'), 'KEEP MANIFEST');
  fs.writeFileSync(path.join(V, 'stale-from-last-build.txt'), 'old'); fs.writeFileSync(path.join(V, 'casts', 'auto-museum.json'), '{"slug":"auto-museum"}');
};
const lines = log => log.split('\n').filter(Boolean);
const at = (log, re) => lines(log).findIndex(l => re.test(l));
{ on('main'); makeTarget(); const r = run(C, VG, [], { WOS_VERCEL_DIR: V, GATE_STUB: 'green' });
  ok('S3', 'full run on main with a green gate: exit 0', r.code === 0, r.out);
  ok('S3', 'stamps first (a new build in public/version.json)', !(read(path.join(C, 'apps/web/public/version.json')) || '').includes('2026-10-17 19:28'), r.out);
  const iG = at(r.log, /^gate stub: green/), iB = at(r.log, /^npx ng build --configuration production --base-href \/ @ .*\/apps\/web$/), iD = at(r.log, /^npx --yes vercel@63\.1\.0 deploy --prod --yes @ /), iC = at(r.log, /^curl .*https:\/\/workshop-os-demo\.vercel\.app\/version\.json/);
  ok('S3', 'runs the gate, then ng build --configuration production --base-href / inside apps/web', iG >= 0 && iB > iG, r.log);
  ok('S3', 'deploys with npx --yes vercel@63.1.0 deploy --prod --yes inside the target folder', iD > iB && lines(r.log)[iD].endsWith('@ ' + fs.realpathSync(V)) || (iD > iB && lines(r.log)[iD].endsWith('@ ' + V)), r.log);
  ok('S3', 'reads https://workshop-os-demo.vercel.app/version.json after the deploy', iC > iD, r.log);
  ok('S3', 'the build reached the target (index.html, version.json with the new stamp)', fs.existsSync(path.join(V, 'index.html')) && read(path.join(V, 'version.json')) === read(path.join(C, 'apps/web/public/version.json')));
  ok('S3', 'rsync --delete removed the stale file', !fs.existsSync(path.join(V, 'stale-from-last-build.txt')));
  ok('S3', 'kept .vercel, vercel.json, config.json and manifest.webmanifest as they were', read(path.join(V, '.vercel/project.json')) === '{"projectId":"keep"}' && read(path.join(V, 'vercel.json')) === '{"keep":true}' && read(path.join(V, 'config.json')) === '{"cast":"demo-garage"}' && read(path.join(V, 'manifest.webmanifest')) === 'KEEP MANIFEST');
  const left = fs.existsSync(path.join(V, 'casts')) ? fs.readdirSync(path.join(V, 'casts')).sort() : [];
  ok('S3', 'the target casts hold only demo-garage.json and index.json, no Auto Museum words', JSON.stringify(left) === '["demo-garage.json","index.json"]' && left.every(f => !AM.test(read(path.join(V, 'casts', f)))), left.join(', '));
  ok('S3', 'no real network or push was attempted', !/^(git|ssh|vercel|npm) /m.test(r.log), r.log); }
{ on('main'); makeTarget(); const r = run(C, VG, ['--no-deploy'], { WOS_VERCEL_DIR: V, GATE_STUB: 'green' });
  ok('S3', '--no-deploy builds the target and stops: exit 0, no vercel call, no live read', r.code === 0 && fs.existsSync(path.join(V, 'index.html')) && !/vercel@/.test(r.log) && !/^curl /m.test(r.log), r.out + r.log);
  ok('S3', '--no-deploy says it did not deploy', /not deployed/i.test(r.out), r.out); }
{ on('main'); makeTarget(); const r = run(C, VG, [], { WOS_VERCEL_DIR: V, GATE_STUB: 'red' });
  ok('S3', 'a red gate refuses: exit 1, "NOT PUBLISHED: the gate is red", no build, no deploy', r.code === 1 && r.out.includes('NOT PUBLISHED: the gate is red') && !/ng build|vercel@/.test(r.log), r.out); }
{ on('main'); makeTarget('{"cast":"auto-museum"}'); const r = run(C, VG, [], { WOS_VERCEL_DIR: V, GATE_STUB: 'green' });
  ok('S3', 'a target config.json without demo-garage refuses before any deploy', r.code === 1 && /NOT PUBLISHED/.test(r.out) && !/vercel@/.test(r.log), r.out + r.log); }
{ on('main'); makeTarget(); const r = run(C, VG, [], { WOS_VERCEL_DIR: V, GATE_STUB: 'green', CURL_MODE: 'wrong' });
  ok('S3', 'a live build that differs refuses: exit 1, "LIVE CHECK FAILED"', r.code === 1 && r.out.includes('LIVE CHECK FAILED'), r.out); }
// the gate line
{ const now = (read(path.join(ROOT, 'scripts/gate.sh')) || '').split('\n'), was = ORIG('gate.sh').split('\n');
  const fnI = now.findIndex(l => /^publishsplit\(\)\{/.test(l)), runI = now.findIndex(l => /^run "publish split"\s+publishsplit\s*$/.test(l));
  ok('S3', 'gate.sh gained exactly a one line publishsplit function and a run "publish split" line, nothing else changed', fnI >= 0 && runI >= 0 && JSON.stringify(now.filter((_, i) => i !== fnI && i !== runI)) === JSON.stringify(was), `fn ${fnI} run ${runI}`);
  ok('S3', 'the function sits right after deploytarget and the run line right after "publish target"', fnI > 0 && /^deploytarget\(\)/.test(now[fnI - 1]) && runI > 0 && /^run "publish target"/.test(now[runI - 1]));
  const fn = fnI >= 0 ? now[fnI] : 'publishsplit(){ return 9; }';
  const gateFn = dir => { const r = spawnSync('/bin/bash', ['-c', `${fn}\npublishsplit`], { cwd: dir, encoding: 'utf8', env: ENV }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
  const mk = (name, pages, vercel) => { const d = path.join(T, name); fs.mkdirSync(path.join(d, 'scripts'), { recursive: true }); fs.writeFileSync(path.join(d, 'scripts/deploy-pages.sh'), pages); if (vercel != null) fs.writeFileSync(path.join(d, 'scripts/deploy-vercel.sh'), vercel); return d; };
  const goodP = read(path.join(ROOT, PG)) || '', goodV = vSrc;
  let r = gateFn(mk('gate-good', goodP, goodV));
  ok('S3', 'publish split: PASS on the candidate scripts', r.code === 0 && /^PASS  /m.test(r.out), r.out);
  r = gateFn(mk('gate-old-pages', ORIG('deploy-pages.sh'), goodV));
  ok('S3', 'publish split: FAIL when deploy-pages.sh has no auto-museum guard', r.code !== 0 && /^FAIL  /m.test(r.out), r.out);
  r = gateFn(mk('gate-no-vercel', goodP, null));
  ok('S3', 'publish split: FAIL when deploy-vercel.sh is missing', r.code !== 0 && /^FAIL  /m.test(r.out), r.out);
  r = gateFn(mk('gate-no-strip', goodP, goodV.split('\n').filter(l => !l.includes('strip-demo-casts.mjs')).join('\n')));
  ok('S3', 'publish split: FAIL when deploy-vercel.sh does not call strip-demo-casts.mjs', r.code !== 0 && /^FAIL  /m.test(r.out), r.out);
  r = gateFn(mk('gate-no-main', goodP, goodV.split('\n').filter(l => !/"main"|main\)/.test(l) || l.trim().startsWith('#')).join('\n')));
  ok('S3', 'publish split: FAIL when deploy-vercel.sh has no main guard', r.code !== 0 && /^FAIL  /m.test(r.out), r.out); }

RESET();
const parts = Object.entries(counts).map(([k, v]) => `${k} ${v.p}/${v.n}`).join(', ');
console.log(`\nRESULT: ${pass} of ${pass + fail} PASS (${parts})${fail ? '' : ' ALL GREEN'}`);
if (!process.env.SPLIT_KEEP) fs.rmSync(T, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
