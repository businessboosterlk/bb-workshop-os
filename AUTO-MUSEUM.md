# Auto Museum: a client copy, frozen

Auto Museum is one paying client (from January 2027). Its system is a copy cast from the garage
product. The product moves forward on `main`. Auto Museum changes only on purpose, after Thulaib says yes.

## What it runs today

- Live address: https://businessboosterlk.github.io/bb-workshop-os/ (opens on Auto Museum)
- Commit: `8d78c83` (build stamp 2026-10-17 19:28), the same build the product demo ran on 17 Oct
- Tag: `auto-museum-2026-10-17`
- Cast: `casts/auto-museum.json`. It has NO tier. It stays that way until decision 437 (Auto Museum's tier) is answered.
  With no tier the screens show every built feature and no locked cards.

## Where its code lives

- Branch `auto-museum`. Its GitHub Pages site publishes ONLY from this branch (`scripts/deploy-pages.sh` refuses on any other).
- The product (`main`) publishes ONLY to the Vercel showroom, https://workshop-os-demo.vercel.app (Blue Bay Motors, invented).
- One codebase, two branches. A second repo would drift: every fix would have to be made twice.

## How to update Auto Museum on purpose

1. Thulaib says yes in a chat to the exact change (which product work goes to Auto Museum).
2. Merge from `main` into `auto-museum` (or cherry-pick the named commits). Never edit the live `gh-pages` branch by hand.
3. Check out `auto-museum`. Run the gate: `bash scripts/gate.sh` (every line green) and the floor check
   `node mould/parts/F3/check.mjs`.
4. Look at Auto Museum's screens at 390 and 1440 wide.
5. Publish: `bash scripts/deploy-pages.sh` (stamps, runs the full gate again, refuses on any red line, reads the live files back).
6. Tag the commit `auto-museum-YYYY-MM-DD` and write the date and what changed below.

## Rules for this copy

- Its cast keeps no tier until decision 437.
- Money screens (finance, insights) for Auto Museum wait on decision 448.
- Nothing in the product demo names Auto Museum. Nothing for Auto Museum is built on `main` first without a plan.

## Change log

- 2026-10-17: frozen at `8d78c83`, tag `auto-museum-2026-10-17`.
