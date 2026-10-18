# Publish split S1 to S3, 18 Oct 2026

Thulaib's order: GitHub Pages is Auto Museum's site (a paying client) and publishes only from a new `auto-museum` branch; the garage product (`main`) publishes only to the Vercel showroom. All code is written by the DeepInfra crew. Claude wrote the check first and proved it failed on `8d78c83`, wrote each brief (the exact file text it changes pasted in, numbered rules), ran the crew (DeepSeek V4 Flash, moulds `s1-dsflash` to `s3-dsflash`), judged the answer with the check and merged it with `apply.py`. One commit per part on branch `worktree-agent-a0dc7758df32badb2`, not pushed.

Run the check: `node mould/parts/SPLIT/check.mjs` (plain node). It clones this worktree into a temp folder, copies the candidate scripts in, makes the branches there and runs the scripts with HOME set to a temp folder and shims first on PATH: git refuses clone, push, fetch and pull; ssh and a bare vercel refuse; npx only fakes `ng build` (a fake dist) and `vercel@63.1.0 deploy` (a log line); curl answers from the fake target; `scripts/gate.sh` is a stub. The origin is a path that does not exist. Nothing can push, publish or deploy.

| Part | Check before the part (on 8d78c83) | Final check | Crew tries | Crew cost (USAGE lines) |
|---|---|---|---|---|
| S1 deploy-pages.sh branch guard | 4/17 | 17/17 PASS | 1 | $0.00013 |
| S2 strip-demo-casts.mjs | 1/12 | 12/12 PASS | 1 | $0.00019 |
| S3 deploy-vercel.sh and the gate line `publish split` | 5/32 | 32/32 PASS | 2 | $0.00044 + $0.00044 |

Whole check: 10 of 61 on `8d78c83`, 61 of 61 after S3. Crew total: $0.00120 for four runs.

| Branch | Full gate | F3 floor check | Guard |
|---|---|---|---|
| worktree branch (8d78c83 plus S1 to S3 plus the mould) | ALL 18 GREEN | 190/190 | not run here (the branch is not auto-museum or main) |
| `auto-museum` (8d78c83 plus S1 to S3 cherry-picked, head ac66341) | ALL 18 GREEN | 190/190 | `WOS_GUARD_ONLY=1 bash scripts/deploy-pages.sh` printed `guard passed: auto-museum`; `WOS_GUARD_ONLY=1 bash scripts/deploy-vercel.sh` refused (this is auto-museum) |

`git diff --stat 8d78c83 auto-museum`: AUTO-MUSEUM.md, scripts/deploy-pages.sh, scripts/deploy-vercel.sh, scripts/gate.sh, scripts/strip-demo-casts.mjs. No cast and no screen file changed on `auto-museum`.

**Hand-written lines in scripts/ or apps/: none.** Every line there came from a crew answer merged by `apply.py`. The file mode of deploy-vercel.sh was set to executable to match deploy-pages.sh (no line changed).

## Per part

**S1.** Four lines right after the remote check: the branch from `git rev-parse --abbrev-ref HEAD` must be exactly `auto-museum`, `git diff --quiet HEAD` must hold (untracked files do not block, a staged change does), then `WOS_GUARD_ONLY=1` prints `guard passed: auto-museum` and exits 0. A refusal runs no other step: the check proves no stamp, no gate and no clone ran. Nothing else in the file changed.

**S2.** Keeps the cast files named in `DEMO_CASTS = ['demo-garage']`, deletes every other cast file, rewrites index.json with the kept entries in their old order and exits 1 when the index ends empty or any file left says Auto Museum (any case, with or without the space). One small departure from the brief that the check allows: it imports from `node:fs/promises` and a default `node:path` instead of named imports from `node:fs`. Still no dependencies.

**S3.** deploy-vercel.sh: the main guard, the clean tree guard and `WOS_GUARD_ONLY` first, then sync-casts, stamp, the full gate (refuses on red), `ng build --configuration production --base-href /`, rsync with `--delete` into the showroom folder keeping `.vercel`, `vercel.json`, `config.json` and `manifest.webmanifest`, `strip-demo-casts.mjs`, a refusal when config.json does not open the demo garage, then `npx --yes vercel@63.1.0 deploy --prod --yes` (skipped with `--no-deploy`) and up to five reads of the live version.json (`LIVE CHECK FAILED` when the build differs). The gate gained `publishsplit` and `run "publish split"`: PASS only when deploy-pages.sh carries the auto-museum guard and names no vercel while deploy-vercel.sh exists with the main guard, calls strip-demo-casts.mjs and names no gh-pages. The check proves it FAILs on the old deploy-pages.sh, on a missing deploy-vercel.sh, without the strip call and without the main guard. Try 1 failed one point (the empty line after the new gate function was missing) and its header comment had a comma before "and". Try 2 named both. The empty line was in BOTH answers: Claude's merge tool threw it away twice (the part split started on the empty line before a header, then `rstrip` ate a block's own empty last line). Both fixed in this folder's apply.py; try 2 was re-applied with `--from` and passed.

## Still open

- The work sits on the worktree branch and on the local `auto-museum` branch. Neither is pushed and `main` does not have it yet, so deploy-vercel.sh cannot publish until these commits reach `main`. The tag `auto-museum-2026-10-17` is local too.
- After a real publish the stamp leaves build.ts and version.json changed; both scripts then refuse until the stamp is committed. That is on purpose (only a committed build publishes) but it is a new step.
- deploy-vercel.sh was never run for real (no deploy was allowed); the full flow was proved only against the fake target.
- deploy-vercel.sh ends with one extra empty line. Harmless.
- S3-BRIEF.md rule 2b has one comma before "and" (Claude's slip). Left as sent so the brief matches its `.sent.md` receipt.

## Files

Check: check.mjs. Briefs: S1-BRIEF.md, S2-BRIEF.md, S3-BRIEF.md (S3 keeps its try 1 brief), each with the expanded `.sent.md` the crew read and its `items-*.jsonl`. Crew answers: candidates/. Tools: brief.py (copied from API2), apply.py (copied from API2, two fixes above). Moulds: bb-crew/crew/moulds/s1-dsflash.json to s3-dsflash.json (copies of a1-dsflash, the job and version lines changed).
