#!/usr/bin/env bash
# THE WORKSHOP OS GATE. Every check the Workshop OS has, cheapest first, each with its count.
# Nothing is published unless every line here is green. Shape taken from the Hub's gate, 29 Sep 2026.
#   bash scripts/gate.sh            build, then every check
#   bash scripts/gate.sh --quick    skip the long walk
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"
QUICK="${1:-}"; FAIL=0; N=0
run(){ local name="$1"; shift; N=$((N+1)); local out; out="$("$@" 2>&1)"; local code=$?
  local line; line="$(printf '%s\n' "$out" | grep -E 'RESULT|passed\.|^PASS|^FAIL|EVERY SCREEN|stack standard|ALL GREEN' | tail -1)"
  if [ $code -eq 0 ]; then printf 'PASS  %-28s %s\n' "$name" "${line:0:150}"; else FAIL=$((FAIL+1)); printf 'FAIL  %-28s %s\n' "$name" "${line:0:150}"; printf '%s\n' "$out" | grep -E '^ *FAIL|NOT FOUND|rror|^   ' | head -14 | sed 's/^/        /'; fi; }
insets(){ local t b; t=$(grep -rhoE 'var\(--sat\)' apps/web/src | wc -l | tr -d ' '); b=$(grep -rhoE 'var\(--sab\)' apps/web/src | wc -l | tr -d ' '); [ "$t" -ge 8 ] && [ "$b" -ge 5 ] && echo "PASS  the insets are USED, not only declared: --sat $t times, --sab $b times" || { echo "FAIL  the insets are declared and barely used: --sat $t, --sab $b"; return 1; }; }
firsttry(){ local out code; out="$(node "$HOME/bb-systems/qa/first-try.mjs" "$@")"; code=$?; echo "$out" | grep -E 'FAIL F'; echo "$([ $code -eq 0 ] && echo PASS || echo FAIL)  $(echo "$out" | grep -cE '  PASS') of $# files pass the first try rules, $(echo "$out" | grep -cE 'WARN') to read"; return $code; }
style(){ local out code n; n=$(wc -l < evidence/gallery/words.txt | tr -d ' '); [ "$n" -ge 100 ] || { echo "FAIL  only $n lines of words were read: the walk did not write them"; return 1; }
  out="$(python3 "$HOME/bb-consultancy/house_style.py" evidence/gallery/words.txt)"; code=$?; echo "$out" | grep -F '[FAIL]'; echo "$([ $code -eq 0 ] && echo PASS || echo FAIL)  $n lines a person can read, $(echo "$out" | grep -cF '[OK') of $(echo "$out" | grep -cE '^\[') house style rules hold"; return $code; }
deploytarget(){ local code; code="$(grep -v '^#' scripts/deploy-pages.sh)"; echo "$code" | grep -q 'businessboosterlk/bb-workshop-os' && ! echo "$code" | grep -q 'bb-client-os' && echo "PASS  the publish script names this repository and no other" || { echo "FAIL  the publish script names another repository"; return 1; }; }

echo "THE WORKSHOP OS GATE  $(date '+%Y-%m-%d %H:%M')"
run "build stamp"            node scripts/stamp.mjs --check
run "publish target"         deploytarget
run "icons from the sets"    node scripts/build-icons.mjs --check
run "icons on centre"        node scripts/icon-centre.mjs --check
run "no svg typed by hand"   node "$HOME/bb-systems/qa/hand-svg.mjs" apps/web/src --allow app/ui/icon.component.ts=1 --allow app/ui/ring.component.ts=1
run "stack standard"         python3 "$HOME/bb-systems/stack-standard/check_stack.py" .
run "casts"                  node scripts/check-casts.mjs
run "first try: the page"    firsttry apps/web/src/index.html
run "insets used"            insets
run "build"                  bash -c 'cd apps/web && npx ng build --configuration production 2>&1 | grep -E "rror|✘" && exit 1; echo "PASS  the app builds"'
node scripts/serve.mjs > /tmp/wos-serve.$$ 2>&1 & SRV=$!; for i in 1 2 3 4 5 6 7 8 9 10; do [ -s /tmp/wos-serve.$$ ] && break; sleep 0.5; done; BASE="$(head -1 /tmp/wos-serve.$$)"
run "self test"              node scripts/selftest-run.mjs
run "sheets, edit, filters"  node scripts/ui-sheets.mjs "$BASE"
run "polish"                 node scripts/ui-polish.mjs "$BASE"
run "pixel precision"        node scripts/ui-precision.mjs "$BASE"
if [ "$QUICK" != "--quick" ]; then
  run "every screen measured"  node scripts/ui-walk.mjs
  run "house style, the words" style
fi
kill $SRV 2>/dev/null; rm -f /tmp/wos-serve.$$
echo; [ $FAIL -eq 0 ] && echo "GATE: ALL $N GREEN" || echo "GATE: $FAIL of $N RED"
exit $FAIL
