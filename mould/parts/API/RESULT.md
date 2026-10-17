# API security batch A1 to A5, 17 Oct 2026

The outside audit of 17 Oct found the faults; Claude wrote each check first and proved it failed on the old code. Then Claude wrote the brief, the crew (DeepSeek V4 Flash on DeepInfra, moulds `a1-dsflash` to `a5-dsflash`) wrote the code and Claude judged it against the check. Branch `api-security-2026-10-17`, one commit per part, not pushed.

Run every check: `node mould/parts/API/run-all.mjs` (plain node, synthetic data, memory store, no network, no database). `next build` of apps/api compiles with the middleware.

| Part | Audit | Check on old code | Final check | Crew tries | Crew cost (USAGE line) |
|---|---|---|---|---|---|
| A1 customer scope by own job ids | E01 P0 | 16/28 | 28/28 PASS | 2 (plus 1 rerun by mistake) | $0.000152 + $0.000153 + $0.000162 |
| A2 write responses projected | E03 P0 | 14/17 | 17/17 PASS | 1 | $0.000066 |
| A3 customer answers one approval | E02 P0 | 32/59 | 59/59 PASS | 1 | $0.000189 |
| A4 secret, lifetime, try limit, OTP | E07 P0 part | 21/37 (limiter missing) | 43/43 PASS | 1 | $0.000229 |
| A5 CORS allowlist | E10 P1 | 0/3 (files missing) | 29/29 PASS | 1 | $0.000096 |

Crew total: $0.001047 for seven runs.

## Per part

**A1.** The crew wrote `customerJobIds()` and the new `scope()` in lib/store.js. Try 1 scored 27/28: it returned early from the customer jobs branch so a customer's own job kept estimate, approved and paid. The second run was Claude's mistake: the command that wrote the corrected brief was refused, so the old brief ran again and gave the same fault (a wasted $0.000153, kept as candidates/a1-rerun-of-try1.js). Try 2 named the fault and passed 28/28. Claude wired both GET routes to pass the customer's job ids. Rows with no jobId are refused for customers; a customer with no ids passed gets nothing (fails closed).

**A2.** The crew wrote `project()` in lib/store.js first time. Claude wired the POST and the PATCH to answer through it. By hand: the PATCH fallback uses the id from the path, not the row, so a row deleted mid request cannot crash it. The check also caught that the old PATCH leaked the money fields to the CUSTOMER, not only to staff.

**A3.** The crew wrote lib/answer.js (`customerAnswer()`) first time. Claude wired it into the item PATCH. A customer now sends `{ approvalId, status }` or `{ rating }` and nothing else. The server finds the approval on the stored job, refuses one that is answered or missing, sets answeredAt itself and writes only the `approvals` array it built. The same answer twice changes nothing.

**A4.** The crew wrote lib/auth.js first time: the secret is read on every call, there is no fallback unless NODE_ENV is exactly 'development', tokens last ten days (TOKEN_DAYS) and `loginLocked`, `loginFailed` and `loginSucceeded` hold the try limit. By hand Claude wired the limit into the login route (key per workshop and lower case name or phone; the sixth try answers 429), rewrote the OTP route so it never logs the code or the phone and answers 503 for every number outside development. Claude also limited WOS_DEMO_CODE to development in lib/clients.js so it can never act as a back door in production. **The try limit lives in the process only: it resets on a restart and is not shared between instances.**

**A5.** The crew wrote lib/cors.js first time. By hand Claude added apps/api/middleware.js (a static header in next.config.mjs cannot answer per request) and removed the static CORS header from next.config.mjs. Claude's own fault, fixed by hand: the middleware first imported 'next/server', which plain node cannot resolve; it now imports 'next/server.js', the same file the bundler picks.

## What this changes for the app (must be done before go live)

1. **The customer page in apps/web must send the new answer shape** (`{ approvalId, status }` and `{ rating }`). The old shape (the whole approvals array and the approved total) is now refused with 403. apps/web was out of bounds for this batch, so nothing there was changed or read.
2. **The owner's `approved` total no longer moves when a customer approves.** The server takes no number from the customer. Thulaib's call: should the server add the approval's stored amount to `approved` on a yes?
3. **Customers cannot sign in on a production host** until a text sender exists (the OTP route refuses with 503). Thulaib's call on the channel and the account.
4. **Every host needs WOS_SECRET set**, including a demo host on `next start` in memory mode; without it sign in refuses.

## Still open

- Next batch from the audit: E04 server commands, E05 outbox, E06 paging, E08 concurrency (the approval answer is a read then a write, two answers at once can race), E09 calendar.
- The try limit should move to a shared store and its Map needs a size cap (random names grow it).
- A staff POST with a chosen id overwrites an existing row in the memory store (the Supabase store ignores the id). Not in this batch.
- The OTP request itself has no rate limit per phone.
- The default allowlist trusts https://businessboosterlk.github.io, which every BB Pages repo shares.
- apps/api/app/api/[slug]/cast/route.js was outside the route and was not reviewed; it builds.

## Files

Checks: a1-check.mjs to a5-check.mjs, harness.mjs, run-all.mjs. Briefs: A1-BRIEF.md (and A1-BRIEF-try2.md) to A5-BRIEF.md. Crew answers: candidates/. Tools: item.py writes a crew item line, splice.py strips the fence pull.py leaves on a js block (its pattern knows ts only) and splices it in, wire-a3.py is Claude's PATCH wiring for A3.
