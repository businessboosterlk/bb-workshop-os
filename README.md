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
on a throwaway store. Staff seat 36 of 36, customer seat 39 of 39 on 16 September 2026.

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
