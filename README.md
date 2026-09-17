# BB Workshop OS

A customer app and a workshop system on one backend. The customer hands over a car and from
that moment can open the app and see exactly where it is: which phase is done, which is running
now, the promised date and a photo from the bay. Staff close phases from their phones. A
phase closes only with a photo. The owner sees the whole floor and the money. Staff never see money.

Live at https://businessboosterlk.github.io/bb-workshop-os/ (GitHub Pages, gh-pages branch; repo businessboosterlk/bb-workshop-os).
Customer door https://businessboosterlk.github.io/bb-workshop-os/#/car/login, team door https://businessboosterlk.github.io/bb-workshop-os/#/workshop/login.

First workshop: Auto Museum (Boralasgamuwa and Dehiwala). Built 16 September 2026 on the BB
stack standard: Node and Next.js on the server, Angular on the front, Supabase behind, one cast
per workshop from `casts/<slug>.json`. Multi-tenant from the first line so the second workshop is a
cast, not a build.

```
casts/<slug>.json        the workshop: brand, branches, services and their phase templates, seats
apps/web                 Angular 19: the customer app (/car) and the workshop system (/workshop)
apps/api                 Next.js 15 API: /api/otp, /api/login, /api/<slug>/<table> CRUD, memory or Supabase store
scripts/check-casts.mjs  refuses a cast that carries a customer, a job, a photo, a key or a stray phone number
scripts/sync-casts.mjs   copies local casts into the static build
```

## Run it

```bash
npm install            # on a fresh machine (this folder symlinks the Hub's node_modules on Thulaib's Mac)
npm run casts
npm run dev:web        # Angular on http://localhost:8771  (demo seats below)
npm run dev:api        # Next API on http://localhost:8770/api/health
npm run check          # stack standard + cast guard
```

Add `?selftest` before the hash on any screen to run the harness in the browser. It prints one
line per check: the nine phone faults, the shell anatomy, the copy rules and the data rules, proven
on a throwaway store. Owner seat 49 of 49 (50 on the board), staff seat 47 of 47 (48 on the board), customer seat 45 of 45 at 390px on 17 September 2026.

**Demo seats.** Customer: phone `0771234567`, code `1234` (two cars on file). Team: `Miflal` 1111
(owner), `Nuwan` 2222 (Boralasgamuwa), `Kasun` 3333 (Dehiwala).

## The rules and where they live

All in `apps/web/src/app/core/data.service.ts`, never in a page:

- A phase cannot close without a photo. The photo is shrunk to 1200px and stored with who and when.
- Closing the last phase makes the car Ready, not Delivered. Deliver is its own tap and stamps the handover.
- An overrun is computed from the running phase's own usual hours. Nobody flags it by hand.
- A promised date cannot move without a reason. The customer reads the reason word for word.
- Extra work goes to the customer as an approval card. Their answer is logged with the time.
- A customer sees only cars on their own phone number. The API enforces the same (`lib/store.js` scope).
- Money fields leave the server only for an owner seat.

Four roles, never three: BB, OWNER (money), STAFF (the day, no money), CUSTOMER.

## The sales line (added 16 Sep 2026 evening)

- **Enquiries.** Every call, WhatsApp and walk-in is a card on a kanban board with a list switch:
  New, Quoted, Booked or Lost. Drag between stages; a drop keeps the rules (Lost asks why, Quoted opens
  the quote, Booked opens Car in). Anyone on the team logs one. No prices on this screen.
- **Quotes.** Owner only, because they carry prices. Numbered AM-Q-0001 upward, never reused. Line
  items as quantity times price, less a discount, whole rupees, all in `core/sales.ts`. The paper
  beside the editor prints to one A4 page. Send on WhatsApp writes the lines and total into the
  message. Accepted opens Car in already filled. Saving links enquiry, quote and job.
- **Follow-ups.** Delivery sets check-ins from the cast cadence (3, 30 and 90 days for Auto Museum,
  owner-editable, days must rise). Customers shows Due now, Coming up and Done. Closing one needs an
  answer. Needs a look becomes a new enquiry so the car comes back in.
- **Fresh settings on every open.** A signed-in seat refetches its cast, so a change to phases,
  follow-ups or quote numbering reaches phones that signed in earlier.

## Pixel precision (17 Sep 2026)

```bash
node scripts/ui-precision.mjs [base-url]   # 94 ink readings, dark and light, 390@3x and 1440@2x
node scripts/icon-centre.mjs --check        # every icon drawn on the centre of its 24 unit frame
node scripts/ui-sheets.mjs [base-url]       # every sheet's action bar, Edit, filter bars, and Back after leaving from a sheet (175 checks)
node scripts/ui-polish.mjs [base-url]       # antialiasing, balanced headings, nested radii, 40px icon controls, tabular figures (228 readings)
```

The measuring code is `~/bb-systems/qa/optical.mjs`, one copy for every BB build. Standard: shapes
and icons within 0.5px, text within 0.5px plus one device pixel. The ring measures its own ink at
runtime from real baselines and rendered glyphs. Plates, badges and leading icons carry the optical
corrections written in `apps/web/src/styles.css`.

## Operator control

The owner changes what phases are called and how long they usually take, per service, plus the
branch WhatsApp lines. Those are content. The photo rule, the audit trail and the roles are
structure and are not settings. (Settings screen, owner only.)

## Data modes

`data.mode` in the cast decides where rows live:

- `local`  this browser only. The demo. Seeds seven cars on first open.
- `api`    the Next API, `DATA_MODE=memory` (per process) or `DATA_MODE=supabase` (service role key
           server side, tables in `apps/api/sql/schema.sql`, NOT applied by code: a schema change
           needs Thulaib's yes). Photos then go to Storage as 1200px JPEGs, never into a row.

## Not wired yet, on purpose

- One-time codes are logged server side. Sending them by SMS or WhatsApp needs the workshop's own
  sender account, which costs them per message. Nothing is chosen until the client chooses.
- Google review links per branch are not in the cast because BB does not have them.
- The Sinhala strings in `lang.service.ts` are a first draft for Miflal to check.
- The live link is the DEMO (local mode, seeded cars, demo seats). It went live on Thulaib's word on
  16 Sep 2026. It is not yet the client's system: no real customer is on it until the price is agreed
  in writing and the API is switched on.

## Casting the second workshop

1. Copy `casts/auto-museum.json` to `casts/<slug>.json`. Change the brand hex, the logo, the
   branches, the services and their phases, the seats.
2. `node scripts/check-casts.mjs` must print ALL GREEN.
3. `npm run build -- --base-href /bb-workshop-os/`, copy `apps/web/dist/web/browser` onto the gh-pages branch (add `.nojekyll`) and push. The link is `?c=<slug>`.

The master is never edited per workshop.
