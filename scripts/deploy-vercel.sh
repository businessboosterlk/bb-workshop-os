#!/usr/bin/env bash
# PUBLISH THE GARAGE PRODUCT TO THE VERCEL SHOWROOM, GATED. Stamps the build, runs every check, builds the
# app, copies it to the Vercel folder, strips every cast but the demo garage and reads the live build back.
# The showroom publishes only from main. Auto Museum is a paying client whose own site is GitHub Pages
# and publishes from the auto-museum branch with scripts/deploy-pages.sh. It must never reach the showroom.
#   bash scripts/deploy-vercel.sh              stamp, full gate, build, copy, strip, deploy, read the live build back
#   bash scripts/deploy-vercel.sh --no-deploy  everything up to the deploy, then stop
#   WOS_GUARD_ONLY=1 bash scripts/deploy-vercel.sh   run the branch guard only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"
TARGET="${WOS_VERCEL_DIR:-$HOME/bb-systems/workshop-os-demo-vercel}"
LIVE="https://workshop-os-demo.vercel.app/version.json"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then echo "NOT PUBLISHED: the Vercel showroom publishes only from main (this is $BRANCH)"; exit 1; fi
git diff --quiet HEAD || { echo "NOT PUBLISHED: tracked files differ from the last commit; commit or restore them first"; exit 1; }
if [ "${WOS_GUARD_ONLY:-}" = "1" ]; then echo "guard passed: main"; exit 0; fi
node scripts/sync-casts.mjs
node scripts/stamp.mjs
bash scripts/gate.sh || { echo "NOT PUBLISHED: the gate is red"; exit 1; }
( cd apps/web && npx ng build --configuration production --base-href / )
grep -q 'Workshop OS' apps/web/dist/web/browser/index.html || { echo "NOT PUBLISHED: the build on disk is not the Workshop OS"; exit 1; }
BUILD="$(sed -n 's/.*"build":"\([^"]*\)".*/\1/p' apps/web/public/version.json)"
if [ -z "$BUILD" ]; then echo "NOT PUBLISHED: the build stamp is empty"; exit 1; fi
if [ ! -d "$TARGET" ]; then echo "NOT PUBLISHED: no showroom folder at $TARGET"; exit 1; fi
rsync -a --delete --exclude .vercel --exclude vercel.json --exclude config.json --exclude manifest.webmanifest apps/web/dist/web/browser/ "$TARGET/"
node scripts/strip-demo-casts.mjs "$TARGET" || { echo "NOT PUBLISHED: the showroom copy still carries a client cast"; exit 1; }
grep -q demo-garage "$TARGET/config.json" || { echo "NOT PUBLISHED: $TARGET/config.json does not open the demo garage"; exit 1; }
if [ "${1:-}" = "--no-deploy" ]; then echo "not deployed (--no-deploy): $TARGET holds build $BUILD"; exit 0; fi
( cd "$TARGET" && npx --yes vercel@63.1.0 deploy --prod --yes )
LIVEB=""
for i in 1 2 3 4 5; do
  LIVEB="$(curl -fsS "$LIVE?t=$(date +%s)" 2>/dev/null | sed -n 's/.*"build":"\([^"]*\)".*/\1/p' || true)"
  if [ "$LIVEB" = "$BUILD" ]; then break; fi
  sleep 5
done
if [ "$LIVEB" != "$BUILD" ]; then echo "LIVE CHECK FAILED: the showroom serves build $LIVEB, this build is $BUILD"; exit 1; fi
echo "published: https://workshop-os-demo.vercel.app (build $BUILD)"

