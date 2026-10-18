PART S1 of the Workshop OS publish split. This part is a BASH script, not JavaScript. It must run under macOS's own /bin/bash 3.2 with `set -euo pipefail` on.

THE JOB. The script below publishes the app to GitHub Pages. GitHub Pages is now the site of Auto Museum, a paying client, and its code lives on the git branch `auto-museum`. The garage product moves forward on `main` and must never reach GitHub Pages. Today the script has no branch guard: run from `main` it would put the product over the client's live site. Add a guard right after the remote check.

CURRENT FILE scripts/deploy-pages.sh (whole):
```bash
#!/usr/bin/env bash
# PUBLISH THE WORKSHOP OS DEMO, GATED. Stamps the build, runs every check, publishes the files that
# were tested to the gh-pages branch of bb-workshop-os and reads the live files back.
# Never rewrites history: the branch is updated from a fresh shallow clone each time.
# Until 29 Sep 2026 this file was the Hub's script, copied and never changed: it built for
# /bb-client-os/ and pushed to the HUB's repository. Running it would have put the Workshop OS
# over the Hub's live demo. It names its own repository now and refuses any other.
#   bash scripts/deploy-pages.sh           stamp, full gate, publish, verify
#   bash scripts/deploy-pages.sh --tested  publish the build the gate has just passed (no new stamp)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"
REPO="businessboosterlk/bb-workshop-os"
git remote get-url origin | grep -q "$REPO" || { echo "NOT PUBLISHED: this folder's remote is not $REPO"; exit 1; }
if [ "${1:-}" != "--tested" ]; then
  node scripts/sync-casts.mjs
  node scripts/stamp.mjs
  bash scripts/gate.sh || { echo "NOT PUBLISHED: the gate is red"; exit 1; }
fi
node scripts/stamp.mjs --check
grep -q "\"build\":\"$(sed -n "s/.*BUILD = '\(.*\)'.*/\1/p" apps/web/src/app/core/build.ts)\"" apps/web/dist/web/browser/version.json || { echo "NOT PUBLISHED: the build on disk does not carry the current stamp"; exit 1; }
grep -q 'Workshop OS' apps/web/dist/web/browser/index.html || { echo "NOT PUBLISHED: the build on disk is not the Workshop OS"; exit 1; }
D="$(mktemp -d)"
git clone -q --branch gh-pages --depth 1 "git@github.com:$REPO.git" "$D"
find "$D" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -r {} +
cp -R apps/web/dist/web/browser/. "$D/"
cp "$D/index.html" "$D/404.html"
touch "$D/.nojekyll"
( cd "$D" && git add -A && git commit -q -m "Workshop OS build $(cat "$ROOT/apps/web/public/version.json")" && git push -q origin gh-pages )
echo "pushed. Reading the live files back:"
node scripts/verify-live.mjs
echo "published: https://businessboosterlk.github.io/bb-workshop-os/"
```

WHAT TO WRITE. Return ONE fenced code block (the system asks for ```js; use that fence, the content is bash). Its first line is this header, exactly:
`// BLOCK: scripts/deploy-pages.sh | start=git remote get-url origin | until=if [ "${1:-}" != "--tested" ]; then`
After the header: the existing remote check line copied exactly as it is today, then the new guard lines. Nothing else. The block replaces the file from the remote check line up to, not including, the `if [ "${1:-}" != "--tested" ]; then` line, so every other line of the file stays as it is.

RULES (numbered, every one is checked by a machine):
1. Line 1 of the block after the header is exactly: `git remote get-url origin | grep -q "$REPO" || { echo "NOT PUBLISHED: this folder's remote is not $REPO"; exit 1; }`
2. Read the branch into a variable with exactly `BRANCH="$(git rev-parse --abbrev-ref HEAD)"`.
3. If `$BRANCH` is not exactly `auto-museum`, print exactly `NOT PUBLISHED: GitHub Pages is Auto Museum's site and publishes only from the auto-museum branch (this is <branch>)` where `<branch>` is the value of `$BRANCH`, then `exit 1`. The message holds an apostrophe (Auto Museum's), so it must sit inside double quotes.
4. Then, if `git diff --quiet HEAD` fails (any tracked file, staged or not, differs from the last commit), print exactly `NOT PUBLISHED: tracked files differ from the last commit; commit or restore them first` and `exit 1`. Write it as `git diff --quiet HEAD || { echo "..."; exit 1; }` so `set -e` does not stop the script silently. Untracked files must NOT block (do not use git status).
5. Then, if the environment variable `WOS_GUARD_ONLY` equals `1`, print exactly `guard passed: auto-museum` and `exit 0`. Read it as `${WOS_GUARD_ONLY:-}` because `set -u` is on.
6. The order is: rule 1, rule 2, rule 3, rule 4, rule 5. Nothing may run before rule 3 except rules 1 and 2. No other step (sync-casts, stamp, gate, clone) may run when a guard refuses or when rule 5 exits.
7. Plain bash 3.2: no `[[ =~ ]]` needed, no arrays, no `local` outside functions, no new functions. At most 10 lines in the block in total. No comments are required; if you add one, start it with `#`.
8. Do not change, move or repeat any other line of the file. Do not write the rest of the file.
