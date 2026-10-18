# R5: the refused-save toast fits every screen, 18 Oct 2026

Three faults Claude saw in screenshots of the R work, fixed from `cfee0b4` (local main, not pushed). The product lines were written by the DeepInfra crew (DeepSeek V4 Flash, mould `r5-dsflash`, a copy of `f5-dsflash` with the system line changed to return CSS parts). Claude wrote the check first, proved it failed, wrote the brief with the exact current lines pasted in, ran the crew, judged the answer with the check and merged it with `apply.py`.

Run the check: `node mould/parts/R5/check.mjs`. It builds the app in development mode, serves it, signs in the demo seats (the same sign-in as R's check: staff Miflal PIN 1111 and customer 0771234567 code 1234 on the demo garage cast), forces a refused save by replacing the method on the injected DataService (a hook in the check only) and measures the toast.

| | Check | Rows that failed |
|---|---|---|
| Before, on `cfee0b4` (`before-cfee0b4.log`) | 15 of 18 | 390 staff toast box -125 to 515 (not inside 16 to 374); its words cut (text -109 to 499); 1440 customer page toast centre 836 against screen centre 720 |
| After (`after.log`) | 18 of 18 | none |

| Fault | Finding | Fix |
|---|---|---|
| 1 The toast did not wrap | Real. `white-space:nowrap`, 639px wide on a 390px screen | `width:max-content`, `max-width:min(560px,calc(100vw - 32px))`, `box-sizing:border-box`, `text-align:center`, `overflow-wrap:anywhere`. At 390 the box now spans 16 to 374 and the words 39 to 351 |
| 2 The toast shifted right for a rail the customer page does not have | Real. 836 against 720 | The desk shift now sits on `body:has(.rail) .toast`. `.rail` exists only inside the staff shell (`body.in-shell` is set by both shells, so it could not tell them apart). Customer page 720 against 720; staff 836 against the main content centre 836 |
| 3 The customer rating after a refused save | NOT real. The page reads `j.rating` from the saved job and `rateIt` sets no local state, so after a refused rating there are 0 filled stars and no Thank you at 390 and at 1440 (the check clears any saved rating first, so the test is strict) | No change to `pages/customer/job.component.ts` |

| After the fix | Result |
|---|---|
| `bash scripts/gate.sh` | ALL 18 GREEN (`gate.log`) |
| `node mould/parts/R/check.mjs` | 53 of 53 |
| `node mould/parts/F3/check.mjs` | 190/190 |

Crew: 1 run, 1 try, $0.00012 (USAGE line: `r5-dsflash run 2026-10-18T13-12-10-153Z: 1 items, 1079 in, 294 out, $0.0001`; the runner flags 1 invalid json because it expects a JSON reply and this answer is CSS; the answer was merged as written). Cap was $0.10.

**Hand-written lines in apps/: none.** Both changed lines in `apps/web/src/styles.css` came from the crew answer (`candidates/r5-try1.md`).

Files: check.mjs, before-cfee0b4.log, after.log, gate.log, R5-BRIEF.md with the expanded R5-BRIEF.sent.md and items-r5.jsonl, candidates/r5-try1.md, r5-dsflash.json (copy of the mould kept in bb-crew/crew/moulds). Screenshots (evidence/ is ignored by git, so not committed): evidence/R5/deliver-390.png, deliver-1440.png, rate-390.png, rate-1440.png.
