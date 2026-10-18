# Refused saves R1 to R4, 18 Oct 2026

The order: every Workshop OS screen that saves catches a refused save and shows the person why, in plain words. All product code was written by the DeepInfra crew (DeepSeek V4 Flash, moulds `r1-dsflash` to `r3-dsflash`, copies of `f5-dsflash` with the system line changed to allow several BLOCK parts). Claude wrote the check first and proved it failed on `f142e06` (38 of 53, log in `before-f142e06.log`), wrote each brief with the exact current lines pasted in, ran the crew, judged the answer with the check and merged it with `apply.py`. One commit per part on branch `worktree-agent-a7d771f72fec752ce`, not pushed.

Run the check: `node mould/parts/R/check.mjs` (add `--no-screens` to skip the browser). Static and busy rules read the source with a small tokenizer and brace matching; R1 bundles data.service.ts with the API2 web harness and a fake fetch; the screen run builds the app in development mode into a temp folder, serves it, signs in a demo seat and replaces one DataService method through `ng.getComponent` (a hook in the check only, nothing in product code).

| Part | Check before the part | Final check | Crew tries | Crew cost (USAGE lines) |
|---|---|---|---|---|
| R1 data.service.ts: 409 and 428 reload, plain words for 409, 428, 403 | R1 rows 16 of 24 (no words, no reload) | 24 of 24 PASS | 1 | $0.00061 |
| R2 workshop job card and customer job page | 7 offenders (5 saves without a catch, the stars called `data.rate(` from the template, the approval answer bare); the rating screen rows FAIL | 0 offenders, screens 18 of 18 | 1 | $0.00037 |
| R3 enquiries, quote, new car in, customers | 8 offenders (new car in already passed) | 0 offenders | 1 | $0.00029 |
| R4 parts board, parts list, space card, floor | 0 offenders, busy 0 offenders | 0 offenders | 0 (nothing to change; recorded as an empty commit) | $0 |

Whole check: 38 of 53 on `f142e06`, 53 of 53 after R3 (`after.log`). Crew total: $0.00127 for three runs.

| After the parts | Result |
|---|---|
| Full gate `bash scripts/gate.sh` | ALL 18 GREEN (self test 768, sheets 215, polish 266, precision 94, walk 180 surfaces 0 faults, house style 8 of 8) |
| `node mould/parts/F3/check.mjs` | 190/190 |
| `node mould/parts/API2/run-all.mjs` | 331 of 331 (A1 28, A2 17, A3 59, A4 43, A5 29, B1 30, B2 44, B3 28, B4 23, B5 30) |

**Hand-written lines in apps/: none.** Every changed line there came from a crew answer merged by `apply.py`.

## Per part

**R1.** `ApiAdapter.go()` marks whether the server sent words (`e.words`). `write()` on a 409 or 428 calls `onStale` (wired in init to `reload(false)`) inside its own try, then gives a 409, 428 or 403 with no server words the plain words. `list(t, flush = true)` and `reload(flush = true)`: the refresh after a refusal does NOT replay the outbox. That departure from a bare `await this.reload()` is on purpose: a replay inside the refresh hit the same refusal and dropped the waiting writes, which B5 forbids (the check proves the outbox is untouched). Offline replays still toast through onRejected. Local mode unchanged (no fetch, its own rule words).

**R2.** moveDate, ask, savePickup, saveMoney and saveNote gained a catch that toasts the words; deliver keeps its catch with a fallback. saveEdit keeps its sheet's `err` slot. The customer page: `answer` in a try, the stars call a new `rateIt` method.

**R3.** drop (Quoted, Booked), reopen and lose on enquiries; sent, accept and decline on the quote; the follow-up save on customers. A refused save no longer closes a sheet or navigates.

## Still open (outside this job's route)

- **On a 390 phone the toast cuts long words.** `.toast` in `apps/web/src/styles.css` is `white-space:nowrap`; the 409 words span -125 to 515 px of a 390 px screen (`evidence/R/deliver-390.png`, INFO line in the check). The words reach the screen but are not readable whole. Fix: let the toast wrap with a max width. styles.css was not on this job's change list.
- On the customer page at 1440 the toast sits right of centre (`left: calc(50% + var(--side-w)/2)` assumes the workshop side rail). Pre-existing.
- The branch is not pushed and main does not have it.

## Files

Check: check.mjs, before-f142e06.log, after.log. Briefs: R1-BRIEF.md to R3-BRIEF.md, each with the expanded `.sent.md` and its `items-*.jsonl`. Crew answers: candidates/. Tools: brief.py and apply.py (copied from SPLIT). Moulds: bb-crew/crew/moulds/r1-dsflash.json to r4-dsflash.json (r4 unused). Screenshots (not committed, evidence/ is ignored): evidence/R/deliver-390.png, deliver-1440.png, rate-390.png, rate-1440.png.
