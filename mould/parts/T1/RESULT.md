# Part T1 (tier gating: core/tiers.ts, ui/locked-card), 16 Oct 2026, sitting 2
| Part | Try | Result | Cost |
|---|---|---|---|
| tiers.ts | 1 | engine check 39/39 first try (20 features at their tiers, no tier keeps everything, ?tier override on a local demo only, api ignores it, bad values ignored, no price, never reads location) | $0.0004 |
| locked card | 1 | static 15/15, compiled first try | $0.0003 |
| wiring (Claude) | | floor: dock or its locked card; the tier 3 exception feed card at tier 2 only. parts page: a locked card in place of the board at tier 1. job card: Hold and the parts list off at tier 1, Move fills the row | |
The check (written first, 64/84 before the wiring) found two faults Claude then fixed:
1. Angular's router drops the query string on its first navigation, so ?tier= never reached a page. main.ts keeps it for the tab
   (sessionStorage wos_demo_tier) before the app starts; a link naming a garage without a tier clears it; cast.tierQuery() feeds tiers.ts.
2. The check's own price rule matched "Cars out" and "hours" (case blind "rs "). Rewritten to a real price and proven both ways.
Not explained: Playwright's "stable" wait hung on the floor's Upgrade button although its box did not move over ten frames and
elementFromPoint finds the button. The check proves the hit point, then presses the mouse there.
On screen `node mould/parts/T1/check.mjs` 126/126: tiers 1, 2, 3, the cast's own tier and Auto Museum with no tier, 390 and 1440.
Branches are NOT held to one at tier 1 (decision 436 open). Auto Museum's cast keeps no tier (437 open).
