```js
// BLOCK: scripts/deploy-pages.sh | start=git remote get-url origin | until=if [ "${1:-}" != "--tested" ]; then
git remote get-url origin | grep -q "$REPO" || { echo "NOT PUBLISHED: this folder's remote is not $REPO"; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "auto-museum" ]; then echo "NOT PUBLISHED: GitHub Pages is Auto Museum's site and publishes only from the auto-museum branch (this is $BRANCH)"; exit 1; fi
git diff --quiet HEAD || { echo "NOT PUBLISHED: tracked files differ from the last commit; commit or restore them first"; exit 1; }
if [ "${WOS_GUARD_ONLY:-}" = "1" ]; then echo "guard passed: auto-museum"; exit 0; fi
```