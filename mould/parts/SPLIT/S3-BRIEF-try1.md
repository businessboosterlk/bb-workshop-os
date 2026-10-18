PART S3 of the Workshop OS publish split. This part is BASH, not JavaScript. It must run under macOS's own /bin/bash 3.2 with `set -euo pipefail` on (only the gate file runs with `set -uo pipefail`).

THE JOB. The garage product lives on git branch `main` and is shown to prospects on a Vercel showroom, https://workshop-os-demo.vercel.app, from a local folder that holds Vercel's own settings. Today that publish is done by hand. Write `scripts/deploy-vercel.sh` that does it, refuses any branch but `main`, and never lets the showroom carry the Auto Museum cast (Auto Museum is a paying client whose own site is GitHub Pages, published from branch `auto-museum` by `scripts/deploy-pages.sh`). Then add one line to the gate that proves the two scripts stay split.

THE STYLE REFERENCE: scripts/deploy-pages.sh (whole, the Pages script; copy its header style and its guard lines):
```bash
{{file:scripts/deploy-pages.sh}}
```

The cast cleaner you call, scripts/strip-demo-casts.mjs, takes one argument, the site folder; it keeps only the demo garage cast in `<dir>/casts` and exits 1 when anything about Auto Museum is left.

CURRENT LINES 16 to 21 of scripts/gate.sh (the gate's style; `run "<name>" <command>` runs a check and reads the line starting PASS or FAIL):
```bash
{{lines:scripts/gate.sh:16:21}}
```

WHAT TO WRITE. Return ONE fenced code block (the system asks for ```js; use that fence, the content is bash). It holds three parts, each opened by its header line exactly as written here, in this order, with nothing between parts but the next header:

Part 1 header: `// FILE: scripts/deploy-vercel.sh`
The whole new script. RULES:
1. Line 1 `#!/usr/bin/env bash`. Then a comment header in the style of deploy-pages.sh: a first line in capitals `# PUBLISH THE GARAGE PRODUCT TO THE VERCEL SHOWROOM, GATED.`, two or three lines saying what it does (main only, Auto Museum never on the showroom, Auto Museum publishes with deploy-pages.sh from its own branch), then the usage lines:
   `#   bash scripts/deploy-vercel.sh              stamp, full gate, build, copy, strip, deploy, read the live build back`
   `#   bash scripts/deploy-vercel.sh --no-deploy  everything up to the deploy, then stop`
   `#   WOS_GUARD_ONLY=1 bash scripts/deploy-vercel.sh   run the branch guard only`
   Comment lines only use `#`. The word gh-pages must not appear anywhere in the file, comments included.
2. Then exactly: `set -euo pipefail`
3. Then exactly: `ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"`
4. Then `TARGET="${WOS_VERCEL_DIR:-$HOME/bb-systems/workshop-os-demo-vercel}"` and `LIVE="https://workshop-os-demo.vercel.app/version.json"`.
5. Branch guard: `BRANCH="$(git rev-parse --abbrev-ref HEAD)"`, then `if [ "$BRANCH" != "main" ]; then echo "NOT PUBLISHED: the Vercel showroom publishes only from main (this is $BRANCH)"; exit 1; fi` (write the test exactly with `!= "main"`).
6. Clean tree guard: `git diff --quiet HEAD || { echo "NOT PUBLISHED: tracked files differ from the last commit; commit or restore them first"; exit 1; }` (untracked files must not block).
7. `if [ "${WOS_GUARD_ONLY:-}" = "1" ]; then echo "guard passed: main"; exit 0; fi`. Rules 5, 6 and 7 come before every other command except rules 2 to 4.
8. Then, in this order: `node scripts/sync-casts.mjs`, `node scripts/stamp.mjs`, `bash scripts/gate.sh || { echo "NOT PUBLISHED: the gate is red"; exit 1; }`.
9. Build: `( cd apps/web && npx ng build --configuration production --base-href / )`. Then refuse (`NOT PUBLISHED: ...`, exit 1) if `apps/web/dist/web/browser/index.html` does not contain `Workshop OS`.
10. Read this build's stamp: `BUILD="$(sed -n 's/.*"build":"\([^"]*\)".*/\1/p' apps/web/public/version.json)"`; refuse if it is empty.
11. Refuse with `NOT PUBLISHED: no showroom folder at $TARGET` when `$TARGET` is not a folder.
12. Copy: `rsync -a --delete --exclude .vercel --exclude vercel.json --exclude config.json --exclude manifest.webmanifest apps/web/dist/web/browser/ "$TARGET/"` (the trailing slashes matter; the four excluded names are the showroom's own files and must survive).
13. Then `node scripts/strip-demo-casts.mjs "$TARGET"` (its own exit 1 stops the script through set -e; also write `|| { echo "NOT PUBLISHED: the showroom copy still carries a client cast"; exit 1; }`).
14. Refuse with `NOT PUBLISHED: $TARGET/config.json does not open the demo garage` unless `grep -q demo-garage "$TARGET/config.json"` succeeds (a missing file must refuse too).
15. If the first argument is `--no-deploy`: print `not deployed (--no-deploy): $TARGET holds build $BUILD` and exit 0. Read it as `${1:-}` because `set -u` is on.
16. Deploy: `( cd "$TARGET" && npx --yes vercel@63.1.0 deploy --prod --yes )`. Exactly that pinned version; never call a bare `vercel`.
17. Live check: up to 5 tries; each try reads `LIVEB="$(curl -fsS "$LIVE?t=$(date +%s)" 2>/dev/null | sed -n 's/.*"build":"\([^"]*\)".*/\1/p' || true)"`; stop when `$LIVEB` equals `$BUILD`; `sleep 5` between tries. If it never matches print `LIVE CHECK FAILED: the showroom serves build $LIVEB, this build is $BUILD` and exit 1. On a match print `published: https://workshop-os-demo.vercel.app (build $BUILD)`.
18. Plain bash 3.2: no `[[ =~ ]]`, no associative arrays, no `mapfile`, no functions needed. Never call git push, git clone or deploy-pages.sh.

Part 2 header: `// BLOCK: scripts/gate.sh | start=deploytarget(){ | until=echo "THE WORKSHOP OS GATE`
This replaces the gate from the `deploytarget(){` line up to, not including, the `echo "THE WORKSHOP OS GATE` line. Write exactly three lines:
- line 1: the current `deploytarget(){ ... }` line copied exactly, unchanged;
- line 2: the new function, ON ONE LINE, named `publishsplit` and starting `publishsplit(){ `, in the same style as deploytarget. It PASSes only when ALL of these hold:
  a. the non comment lines of scripts/deploy-pages.sh (`grep -v '^ *#'`) contain `git rev-parse --abbrev-ref HEAD` and `"auto-museum"` (with the double quotes) and do not contain `vercel`;
  b. the file scripts/deploy-vercel.sh exists, and its non comment lines contain `git rev-parse --abbrev-ref HEAD` and `"main"` (with the double quotes) and `strip-demo-casts.mjs` and do not contain `gh-pages`.
  Use `grep -qF` for the fixed strings. On PASS print `PASS  GitHub Pages publishes only from auto-museum, the Vercel showroom only from main`. Otherwise print `FAIL  the publish split is broken: a branch guard or the cast strip is missing` and `return 1`. Declare its variables with `local`. When deploy-vercel.sh is missing it must FAIL, never error out silently.
- line 3: an empty line.

Part 3 header: `// BLOCK: scripts/gate.sh | start=run "publish target" | until=run "icons from the sets"`
Write exactly two lines: the current `run "publish target"         deploytarget` line copied exactly, then `run "publish split"          publishsplit`.

TRAPS.
- The gate runs with `set -uo pipefail` and no `-e`: inside publishsplit check each grep result yourself; `echo "$x" | grep -q` under pipefail is fine because grep's own exit is what matters.
- Do not change any other line of gate.sh.
- In deploy-vercel.sh, `$(...)` that may fail under set -e must end in `|| true` where the rules say so.
