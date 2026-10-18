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
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "auto-museum" ]; then echo "NOT PUBLISHED: GitHub Pages is Auto Museum's site and publishes only from the auto-museum branch (this is $BRANCH)"; exit 1; fi
git diff --quiet HEAD || { echo "NOT PUBLISHED: tracked files differ from the last commit; commit or restore them first"; exit 1; }
if [ "${WOS_GUARD_ONLY:-}" = "1" ]; then echo "guard passed: auto-museum"; exit 0; fi
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
