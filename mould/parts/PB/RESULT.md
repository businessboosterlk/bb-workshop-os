# Payments on the job, part B (the web app: data service, front desk seat, seed, screens), 18 Oct 2026

Thulaib's decisions of 18 Oct, product only (the auto-museum branch is not touched): each payment is a line on the job; paid and balance are worked out, never typed. A correction is a reversal, owner only. A new seat role `desk` (front desk): owner and desk record payments. Desk sees the balance and the lines only; plain staff see no money; the customer sees approved total, paid, balance and each line with its receipt number, never the estimate.

All product code was written by the DeepInfra crew (DeepSeek V4 Flash, moulds `pb1-dsflash` to `pb4-dsflash` in bb-crew). Claude wrote the check first and proved it failed on 7e93aa0, wrote each brief with every type and function the part reads pasted in, ran the crew, judged and merged with `mould/parts/PB/apply.py` (R's merge tool, plus one rule: the empty line the crew leaves between parts is dropped). One commit per part on top of 7e93aa0, not pushed.

Run the check: `node mould/parts/PB/check.mjs` (static, the data service in local and api mode through the API2 web harness, then Playwright on a development build: the DEMO GARAGE cast, Blue Bay Motors asserted by the page title, local mode, 390 and 1440). Seats: Ravi owner 1111, Sachini desk 4444, Chamara staff 2222, customer 0771234567 code 1234.

| Part | What | Check before the part | Final check | Crew tries | Crew cost (USAGE lines) |
|---|---|---|---|---|---|
| PB1 core | models, session (desk, collects), recordPayment and correctPayment, newJob and setMoney send no paid, seed v7 (paid figures become cash lines), Sachini in the demo garage cast | PB 9/65 on 7e93aa0 (screens stop: no desk seat) | static, local, api 48/55 (the rest is the pages) | 1 | $0.001024 |
| PB2 staff job card | money by seat, the lines, Record payment and Correct sheets, the owner's Undo, Deliver refused in its sheet | 48/55 | PB 95/103 (the customer page still missing) | 2 | $0.001443 + $0.000219 |
| PB3 Money screen | paid and still to collect from paidOf and balanceOf | 95/103 | judged with PB4 in one run | 1 | $0.000401 |
| PB4 customer page | the Payments card | 95/103 | PB 154/154 PASS | 2 | $0.000505 + $0.000109 |

Crew total: $0.003701 for six runs. One more PB2 try 2 run stopped on a Node error before any answer (no usage line, nothing charged); its empty run file stays in crew/out/pb2-dsflash.

After the parts: `bash scripts/gate.sh` ALL 18 GREEN (self test 768 lines, sheets 215, polish 266, precision 94, the walk 180 surfaces with 0 faults, house style 8 of 8). F3 190/190, R 53/53, R5 18/18, PAY P1 193/193, P2 88/88, API2 run-all 331 of 331 (A1 28, A2 17, A3 59, A4 43, A5 29, B1 30, B2 44, B3 28, B4 23, B5 30). Ten screenshots in evidence/PB/ (job-owner, job-desk, job-staff, record-sheet, customer at 390 and 1440); Claude looked at four of them (owner 390, record sheet 390, desk 1440, customer 390).

**Hand-written product code: none.** Every line in apps/ and casts/ came from a crew answer merged by apply.py. apps/web/public/casts/demo-garage.json is the copy made by scripts/sync-casts.mjs.

## Per part

**PB1.** Twelve BLOCK parts in one answer, all right first time. The seed numbers its lines with the engine's nextNo job by job, so the eight receipts never repeat; each is dated a day after the car came in, by the desk seat when the cast has one, else the owner. The PB1 commit alone does not compile: the job card still passed paid to setMoney (an excess property). PB2 fixes it; the type change was the point.

**PB2.** Try 1 got eight of ten parts right. It joined the new CSS rules with a semicolon and a space (my brief listed them that way), which makes a browser drop every rule after the first. It also kept one of the three field lines it was told to keep, so the file did not compile. Try 2 quoted both faults and asked for those two parts only; both came back right.

**PB3.** Whole file, right first time: Paid and To collect columns, the sort and Still to collect all from the engine.

**PB4.** Try 1 passed the PB check at 390 and 1440. The gate's walk then found the figure LKR 185,000 1px past its column on a 320px phone. Try 2 changed the one grid rule to wrap (auto-fit, 100px columns): three across at 390, two at 320. The gate is green after it.

## Older assertions changed (two checks, all forced by Thulaib's Deliver decision)

- **R/check.mjs** 'the Deliver tap shows the refusal in the toast' now reads the sheet's message slot (`.drawer.on [foot] .msg`). The count stays 53.
- **R5/check.mjs** measured the staff toast on a refused Deliver, which is no longer a toast. It now forces the same 409 on Move the date (that save still toasts) and measures that. The count stays 18.

## Bugs in the PB check that Claude fixed before judging (none changed what a pass means)

- The method body reader stopped at a return type's brace (`Promise<{ ... }>`); it now takes the brace after the parameters and any return type.
- The customer estimate test matched the seed's promise reason ("the insurer took two extra days to approve the estimate"), which is the insurer's paper, not money. It now fails on the Estimate label or the planted estimate figure only.
- A sign-in that fails is now a counted FAIL instead of a crash.

## Choices Claude made where the order was silent

- **The payment toast lives on the job card**, not in the app's shared toast: Undo needs a button that runs a correction and app.component.ts is outside this job. It uses the same `.toast` styles, clears the shared toast when it shows and goes after 5 seconds.
- The method word in the toast is lower case ('cash', 'card', 'bank transfer', 'cheque'); the lines and chips use the capitals.
- The message slot is the first row of the sheet's action bar, ink not red (mono garage: red stays for a blocked bay). The sheets check never sees it because it only shows after a refusal.
- The desk also sees the 'still unpaid' line on Deliver and close (it is the balance).
- A payment recorded with no signal waits in the outbox; the card says 'Saved on this phone. It reaches the workshop when there is signal.' and shows no number until the server answers.
- scripts/check-casts.mjs checks no role list, so it needed no change.
- selftest.ts needed no change: no line read paid; its customer rule looks for 'paid so far' and 'to collect', which the customer card never says.

## Still open (for Thulaib)

- The staff rail and the sign-in's demo seats line call Sachini 'Staff' and show no '(desk)'; shell.component.ts and login.component.ts were outside this job.
- The gate walk does not open the Record payment or Correct sheets (scripts/ was outside this job); the PB check photographs the Record sheet and measures its action bar.
- The full gate now takes about ten minutes, most of it the walk.
