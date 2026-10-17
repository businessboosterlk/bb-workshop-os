# API server rules batch B1 to B5, 17 Oct 2026

Thulaib's order for this batch: all code is written by the DeepInfra crew. Claude wrote each check first and proved it failed on the code before the part, wrote the brief (every type and every function the part reads pasted in), ran the crew (DeepSeek V4 Flash, moulds `b1-dsflash` to `b5-dsflash`), judged the answer with the check and merged it. Branch `server-rules-2026-10-17` on top of batch 1 (`api-security-2026-10-17`), one commit per part, not pushed.

Run every check of both batches: `node mould/parts/API2/run-all.mjs` (plain node, memory store, synthetic data, no network, no database). The web checks bundle data.service.ts with esbuild and a stand in for @angular/core (webharness.mjs, angular-stub.mjs); a fake fetch answers from the real route handlers in the same process.

| Part | Audit | Check before the part | Final check | Crew tries | Crew cost (USAGE lines) |
|---|---|---|---|---|---|
| B1 approved total on the server, customer answer shape | owed from batch 1 | 11/30 | 30/30 PASS | 1 | $0.000577 |
| B2 close phase as a server command | E04 | 4/13 (route missing) | 44/44 PASS | 1 | $0.000785 |
| B3 version check, one car per space | E04, E08 | 7/23 | 28/28 PASS | 1 | $0.001479 |
| B4 phone lookup, paged lists | E06 | 6/18 | 23/23 PASS | 2 | $0.000694 + $0.000703 |
| B5 outbox | E05 | 6/27 | 30/30 PASS | 2 | $0.000362 + $0.000419 |

Crew total: $0.005019 for seven runs. Batch 1 checks after this batch: A1 28/28, A2 17/17, A3 59/59, A4 43/43, A5 29/29. `npm run build` of apps/api compiles every route including the new close-phase route. `ng build --configuration production` of apps/web builds (the size budget warnings were there before).

**Hand-written product code: none.** Every line in apps/ came from a crew answer merged by `apply.py`.

## Per part

**B1.** The crew changed lib/answer.js so a yes adds the stored approval amount (only a finite number above 0) to `approved`, a no adds nothing and a repeat stays a no-op. The item PATCH now writes the activity line for the customer, who may not create rows. In data.service.ts `answerApproval` sends exactly `{ approvalId, status }` in api mode and never merges the answer's status onto the job; the demo (local mode) is unchanged. The customer page (job.component.ts) needed no change: it already calls `answerApproval` and `rate`, and `rate` already sends `{ rating }`. Claude changed one assertion in the batch 1 A3 check: it expected the old rule (approved stays 900) and now expects 900 plus the stored 3000.

**B2.** The crew wrote lib/commands.js `closePhase()` and the route `POST /api/<slug>/jobs/<id>/close-phase` (file apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js; a route file outside the listed paths, needed because the order asked for a POST route). Staff only, only the 'now' phase, only with a stored photo of the same job and phase key. A photo can close one phase only. The check compares the command against today's browser engine for a first and a last phase. The generic PATCH refuses `phases` and `status` from staff and owner, with one exception kept so delivery still works: `status: 'delivered'` on a ready job. The web app closes a phase through the command in api mode. Claude corrected one merge marker in the saved answer (candidates/b2-try1.md): the marker Claude wrote in the brief also matched the Adapter interface line, which was Claude's fault, not the crew's.

**B3.** Every job write sends `x-wos-version` (the updatedAt it read). A staff save without it is refused 428, an older version 409, also when two saves arrive at once. A customer answer may leave it out. Job writes in one workshop run one at a time (`withLock`) and the store's update refuses a write when the stored version has moved (memory: in the same tick; Supabase: `eq('updated_at', expect)`). The memory store's updatedAt is now strictly increasing. A space another open job of the same branch holds is refused on PATCH and POST. Claude changed the batch 1 harness so a check that sends no version gets the stored one added (`x-check-raw` turns that off).

**B4.** `store.list(slug, kind, { limit, offset })` (at most 500, updatedAt then id for a stable order) and `store.findBy(slug, kind, field, value)`. Sign in and the text code find the customer by phone; customer reads use exact lookups and never list a table; the space check looks up the space key. The web app reads every page. Try 1 opened the route part with a wrong header, so that part was thrown away (18/23); try 2 named the fault and passed. It left a stray markdown backtick on one merge marker, which `apply.py` now strips.

**B5.** The outbox flushes one at a time, queues only a network failure or a 5xx. It throws a 400, 403, 404, 409 or 428 to the person with the server's own words. The key is `wos_outbox_<slug>_<seat>`, every write carries `x-wos-op` (the same op on replay), a replay the server refuses leaves the outbox with a toast. A 401 keeps the queue. Try 1 passed the first 27 checks but Claude then added one: a write queued while a flush ran was wiped when the flush saved its old copy (29/30). Try 2 named that and passed.

## Still open

- E09 calendar: not touched.
- The screens: a refused save now THROWS from the data methods (B3, B5). Pages that call them without a catch will show nothing; each screen needs to show the message. Not reviewed in this batch.
- Two edits to the same job while offline: the second replays on an old version and is refused 409 (the person sees a toast). A merge rule is Thulaib's call.
- The server reads `x-wos-op` nowhere yet: a POST whose reply was lost can still be applied twice on replay.
- close-phase writes the job and its activity in one request but as two writes, not one database transaction. Supabase needs a Postgres function for a true single save.
- The lock lives in one process. With more than one API instance the version check still holds (Supabase compares updated_at) but one car per space needs a unique index on (client, branch, spaceKey) for open jobs.
- The space lookup reads the 500 newest jobs holding that key. If delivered jobs keep their spaceKey, clear it on delivery or rely on the index above.
- `findBy` on Supabase filters `data->>field`. It was not run against a database (none allowed); it needs expression indexes on phone, customerPhone, jobId and spaceKey.
- A queued photo then close-phase replays with the browser's photo id; Supabase gives the photo a new id, so that replay is refused.
- A staff POST may still create a job with any phases and status.
- An activity the server writes for a customer answer appears in the customer's page only after the next reload.

## Files

Checks: b1-check.mjs to b5-check.mjs, run-all.mjs (both batches), webharness.mjs, angular-stub.mjs; ../API/harness.mjs gained the version helper. Briefs: B1-BRIEF.md to B5-BRIEF.md (B4 and B5 also keep their try 1 brief), each with the expanded `.sent.md` the crew read and its `items-*.jsonl`. Crew answers: candidates/. Tools: brief.py expands a brief and writes the item line, apply.py merges a crew answer by its `// FILE:` and `// BLOCK:` headers.
