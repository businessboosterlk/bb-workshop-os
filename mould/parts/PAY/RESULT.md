# Payments on the job, part A (engine, server commands, money per seat), 18 Oct 2026

Thulaib's decisions of 18 Oct: each payment is a line on the job; paid and balance are worked out from the lines, never typed. Append only: a correction is a reversal that points at the payment it undoes, for the same full amount, one per payment. A reversal cannot be reversed. A new seat role `desk` (front desk). Owner and desk record payments; only the owner corrects one. Desk sees the balance and the lines only. Plain staff see no money; the customer sees the approved total, the lines and the balance, never the estimate.

Prior art taken: Tudant's fees ledger (append only, reversal points at its payment, whole numbers, balance computed and never stored). Not taken: the gym's overwrite of a paid figure.

All product code was written by the DeepInfra crew (DeepSeek V4 Flash, moulds `pa1-dsflash` to `pa4-dsflash` in bb-crew). Claude wrote both checks first and proved they failed on f142e06, wrote each brief with every type and every function the part reads pasted in, ran the crew, judged and merged with `mould/parts/API2/apply.py`. One commit per part on top of f142e06, not pushed.

Run the checks: `node mould/parts/PAY/p1-check.mjs`, `node mould/parts/PAY/p2-check.mjs`, `node mould/parts/API2/run-all.mjs` (plain node, memory store, synthetic data, no network, no database).

| Part | Rules | Check before the part | Final check | Crew tries | Crew cost (USAGE lines) |
|---|---|---|---|---|---|
| PA1 web engine `apps/web/src/app/core/payments.ts` | 1 to 6 | P1 0/5 (no engine) | web half 64/64 plus tsc --strict | 2 | $0.000457 + $0.000581 |
| PA2 server engine `apps/api/lib/payments.js` | 1 to 6 | P1 66/69 | P1 193/193 PASS | 2 | $0.000470 + $0.000583 |
| PA3 commands and routes | 7 | P2 9/33 (routes missing) | P2 64/88 (the rest is PA4) | 1 | $0.000800 |
| PA4 scope, PATCH and POST refusal, login | 8 to 10 | P2 64/88 | P2 88/88 PASS | 1 | $0.000551 |

Crew total: $0.003442 for six runs. One more PA3 attempt never reached DeepInfra (connect timeout after 10 s, no answer, nothing charged); its empty run file stays in crew/out/pa3-dsflash. Server checks after the batch: A1 28/28, A2 17/17, A3 59/59, A4 43/43, A5 29/29, B1 30/30, B2 44/44, B3 28/28, B4 23/23, B5 30/30: 331 of 331. `npm run build` of apps/api compiles every route, including /api/[slug]/[table]/[id]/payments and /api/[slug]/[table]/[id]/payments/[pid]/reverse.

**Hand-written product code: none.** Every line in apps/ came from a crew answer merged by `apply.py`.

**Older assertions changed (four, all forced by rule 9: a customer now keeps the approved total):**
- API/a1-check.mjs 'customer A job carries no money fields' now expects no estimate, no paid and approved 900.
- API/a2-check.mjs 'customer PATCH response carries no money fields' now expects no estimate, no paid and approved 4000.
- API/a3-check.mjs 'answer response carries no money fields' now expects no estimate, no paid and the server built approved 3900.
- API2/b1-check.mjs 'the customer reply still has no approved total' now expects the server built approved 6000.

## Per part

**PA1.** The crew wrote the pure engine from the brief's types and six rules: `paidOf`, `balanceOf`, `lines`, `nextNo`, `record`, `reverse` and `PAY_METHODS`. Try 1 passed every rule case but failed `tsc --strict` (Number.isFinite does not narrow `number | undefined`). Try 2 quoted the two compiler errors and the fix and said keep the rest: it changed only those two tests.

**PA2.** The crew translated the checked PA1 file to plain JavaScript with the types as JSDoc. Try 1 passed all 191 cases but wrote an em dash in its header comment. Claude added a check (no em or en dash in either copy) and try 2 changed that one line. P1 runs every case on both engines and fails on any difference: reasons word for word, op replay, reversal of a reversal, a second reversal, balance after a reversal, numbering across two months and two jobs, NaN guards.

**PA3.** `recordPayment` and `reversePayment` in lib/commands.js in the shape of closePhase, plus `colomboDay` (today in Sri Lanka, UTC+5:30, so a payment at 01:30 Colombo time is not refused as a future date). Routes POST /api/<slug>/jobs/<id>/payments and POST /api/<slug>/jobs/<id>/payments/<pid>/reverse: staff only; record owner or desk, correct owner only, else 403 'This seat cannot do that.'; withLock and the B3 version rule (428 with no version, 409 on an old one). The receipt number counts every job of the workshop read page by page. The activity line says 'Payment recorded (R-YYYYMM-NNN)' or 'Payment corrected', never an amount. The reply is the saved job scoped for the caller. A refused correction answers 404 'No such payment' or 409 for a correction of a correction and a second correction.

**PA4.** scope() for jobs: owner unchanged; desk drops estimate, approved and paid and gets `balance` worked out from the full stored job; plain staff gets none of estimate, approved, paid, payments or balance; customer drops estimate and paid and keeps approved and payments. The generic job PATCH and POST refuse `payments`, `paid` and `balance` from every seat, the owner and a customer included, with 400 'Payments are recorded through Record payment'. Login needed no change: it already signs in a cast user of any role as a staff seat and the token carries the role; P2 proves a `desk` user signs in, gets kind staff and role desk. That token records a payment.

House style: RESULT.md and both checks pass `house_style.py`. The PA1 and PA3 briefs hold four commas before and or or; they are kept exactly as the crew read them (each matches its .sent.md), so the record stays true.

## Choices Claude made where the order was silent

- **A replayed op answers 200 before the version check.** A request the outbox sends again after its reply was lost carries the version it read, which the first send moved on. Checked in the order of B3 it would be refused 409 and the desk would see "Someone else changed this job" for a payment that is already there. The command runs first (so a plain staff seat is still refused 403), then a replay answers the job as it is with no write, then the version rule applies to every real write.
- Refusal codes for a correction: 404 for 'No such payment', 409 for the other two reasons. A customer or no staff seat is refused 403 'Staff only' as close-phase does.
- `today` on the server is the Colombo calendar day, not the UTC one.

## Still open (for part B or Thulaib)

- **The web app's job create sends `paid: 0`** (data.service.ts line 195, `newJob`) and `setMoney` can send `paid`. Against this server both are now refused 400. Part B must drop `paid` from the create body and route money through Record payment before this server meets the app.
- models.ts: `Role` needs 'desk', `Job` needs `payments?` and `balance?`, and Activity's type union needs 'payment' (part B).
- Receipt numbers count lines, so they are unique only while nothing is deleted. Jobs are never deleted by desk or staff; an owner who deletes a job with receipts would let a later number repeat. Supabase needs a unique index on the receipt number if that matters.
- The lock and the receipt count live in one process. With more than one API instance two desks could take the same number; Supabase needs a sequence or a unique index for that.
- The engine skips null jobs and non list payments. A null entry INSIDE a payments list would throw; the server only ever writes whole lines.
- A desk seat can delete nothing and edit no money. It can PATCH every other job field as a staff seat can. Whether desk should be narrower than staff for non money work is Thulaib's call.
