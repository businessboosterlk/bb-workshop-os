# THREE AUTOMOTIVE SYSTEMS ON ONE FOUNDATION: THE MOULD (15 Oct 2026)

Thulaib, 15 Oct 2026: a garage, a detailing studio and a car wash as three systems split from one foundation; the floor as
a picture of spaces (busy and free) on every dashboard; the whole journey of a car with photos. Opinions taken from Gemini
and ChatGPT the same day and merged below. NEW RULE: Claude writes this mould; the builders on DeepInfra make each part
through BB Crew; Claude judges every part against its check before it is merged (memory claude-moulds-crew-builds).

## WHERE BOTH AGREED (taken)
| Idea | Gemini | ChatGPT | Already in Workshop OS |
|---|---|---|---|
| One foundation, three configurable segments, not three products | yes | yes | yes: one codebase, one cast per business |
| The floor as a grid of space tiles grouped by zone, never a literal drawing | yes | yes | partly: a bay count bar per branch |
| Busy tile: plate, model, current stage, time in stage against target, who has it | yes | yes | no |
| Free tile: space name, how long free (or the next booking), one Assign button | yes | yes | no |
| Colour only for status | yes | yes | yes |
| The customer sees progress with no app install and no account | yes | yes | half: a web app that asks for a phone and a code |
| One action records stage, time, person and photo; faster than WhatsApp | yes | yes | yes: a phase closes only with a photo |
| Owner-only money | yes | yes | yes |
| Works on weak internet | - | yes | yes: an outbox replays on the next success |
| Sinhala and Tamil | - | yes | Sinhala drafted, not checked |
| Garage: insurance and parts waiting as their own states | yes | yes | as phases only |
| Detailing: inspection before work, before and after photos, aftercare reminders | yes | yes | follow-ups only |
| Car wash: queue, fast check-in, packages and wash passes | yes | yes | no |

## NEW TO US, TAKEN
- **The holding dock (Gemini).** A car waiting for parts, insurance or curing leaves its bay for a strip under the bays
  (Waiting parts, Waiting approval, Curing, Ready). A car paused INSIDE a bay shows a red "Bay blocked" timer. Without it the
  busy count lies or the waiting car vanishes from the picture.
- **Photos optional per segment (Gemini).** A 20 minute wash cannot ask for a photo at every stage: one tap start, one tap
  finish. A setting per cast, not a fork.
- **Plate fast check-in (Gemini).** Type the four numbers of a plate, a returning car fills itself.
- **Before and after export (Gemini).** The studio's photos become a post ready to share. This feeds BB's own content
  service: a cross-sell nobody asked for.
- **Next free space (both).** "Next space free in about 14 minutes", from the hours left on the cars in the bays.

## TAKEN LATER, NOT IN THE FIRST BUILD
- **The capacity promise (ChatGPT):** "if we accept this job now, when can we honestly finish it", counting staff,
  equipment, parts and bookings. The right end state; it needs bookings and staff skills first.
- **Cash against cars (Gemini):** every car on a wash spot matched to a paid ticket, so unrecorded cash shows.
- **Slow-day offer (Gemini):** regulars who have not come for a month get a WhatsApp offer when spaces sit empty.

## CHANGED OR LEFT OUT
- "Pulsing red" for overdue (Gemini): a pulse is a motion tell. Solid red, no animation.
- "A Next.js live link" (Gemini): the front is Angular on this stack; the tracking link is a page of this app.
- What owners "will pay for": both lists are opinions, not evidence. BB has a real garage client (Auto Museum) and a real
  detailing client (Show Car Detailers). Ask each owner which three matter before building their segment.

## THE PARTS, IN BUILD ORDER (each one brief, one check; sample before scale)
FOUNDATION (all three segments get it)
- F1 SPACES: a branch has named spaces (cast `branches[].spaces`: key, label, kind such as hoist, booth, wash spot), a job
  holds `spaceKey`; assign, move, free. Check: data rule tests in ?selftest; a job can sit in one space only.
- F2 SPACE TILE: the busy and free tile from the table above. Check: ui-precision and optical on both states, house style.
- F3 THE FLOOR PICTURE: tiles grouped by branch, a sticky capacity line "3 of 4 busy · next free in about 14 min". Check:
  click path at 390 and 1440; the count equals busy tiles; the next-free minutes come from the remaining phase hours.
- F4 HOLDING DOCK: the strip of waiting states and the "Bay blocked" timer. Check: a waiting car is never counted busy.
- F5 THE JOURNEY: a car's stages as a timeline with the photo of each, for the team and the customer. Check: every closed
  stage shows its photo or "no photo" where the segment allows it.
- F6 THE TRACKING LINK (needs Thulaib's yes, it changes who can see a car): one link per job sent on WhatsApp, opens that
  car only, expires on delivery. Check: a link for job A never shows job B; an expired link shows nothing.
SEGMENTS
- G1 Garage: the parts board (part, supplier, ordered, arrived) beside the dock. Check: a part arriving moves the car
  back to its bay queue.
- D1 Detailing: the inspection before work, marks on a car outline, the customer's sign-off. Check: work cannot start on
  a detailing job without it.
- D2 Detailing: before and after pairs at the same angles, one shareable image. Check: the export carries no customer
  name or plate.
- W1 Car wash: plate check-in by four digits, packages, one tap start and finish, the queue. Check: check-in to queue in
  three taps.
- W2 Car wash: wash passes tied to a plate (washes left, renewal). Check: a wash on a pass never also bills.
DEMOS (for the films): demo-garage exists; demo-detailing and demo-carwash casts, each with sample data shaped to it.

## HOW A PART IS BUILT (the new rule)
1. Claude writes the part brief: the files to read (named, never "the repo"), the exact files to change, the rules that
   apply (no hand-drawn svg, one sheet action bar, Edit on every record, filter bar, kanban plus list), the check.
2. BB Crew runs the brief on a DeepInfra coding model and returns the change as a patch. Receipt per part.
3. Claude applies the patch on a branch, runs the part's check and `scripts/gate.sh`. Pass: merge. Fail: one retry with the
   failure written into the brief. A second fail: Claude builds that part and the brief is improved for next time.
4. Nothing is published until Thulaib has seen the demo and said publish.

## BUILD LOG
- 15 Oct 2026: E1 engine (holds, dock, parts rules, F1 notes), F2, F3, F4, F5 built by the crew on DeepSeek V4 Flash and merged on
  branch three-segments. Results in parts/*/RESULT.md. Crew spend $0.0035 at list price for 7 runs (summed from the receipts). NEXT: G1 parts board page,
  the job card's space, hold and parts controls, T1 tier gating. Handover: ~/Downloads/BB-HANDOVERS/WORKSHOP-OS-G1-TIERS-HANDOVER.md
