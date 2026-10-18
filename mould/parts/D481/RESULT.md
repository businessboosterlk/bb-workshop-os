# D481: the front desk label and filled stars (bb_pending 481), 18 Oct 2026

Thulaib's word, 18 Oct: "yes to 481". Product only; Auto Museum is not touched.

Check written by Claude BEFORE the crew ran: `node mould/parts/D481/check.mjs` (static, then Playwright on a development build, the DEMO GARAGE cast with Blue Bay Motors asserted by the page title, 390 and 1440). `--base <url>` points the screens at a live address.

**Before, on 61f7d26: D481 36 of 54, 18 FAIL** (log: before-61f7d26.log). Sachini's rail says "Staff · Wellawatte" at both widths; the login's demo line does not mark the front desk; every star reads fill none (five rated, four rated and the history star); the star sits 1.5px high in its 44px button by ink (the icon is centred in its frame, 67 of 67 by icon-centre; the button sets it on a text baseline).

All product code was written by the DeepInfra crew (DeepSeek V4 Flash, moulds `d481-dsflash` and `d481b-dsflash` in bb-crew), merged with `mould/parts/PB/apply.py`. **Hand-written product code: none.**

| Part | What | Check before | Check after | Crew tries | Crew cost |
|---|---|---|---|---|---|
| D1 | icon `filled` input (fill current colour, stroke kept); rail says Owner, Front desk or Staff; login demo line marks (front desk); customer stars filled when chosen, button content centred (grid); history star filled | 36/54 on 61f7d26 | 54/54 | 1 (a second run by the agent gave identical code; see below) | $0.0003 + $0.0003 |
| D2 | role and branch on two lines in the rail seat block, no dot | 58/66 on fc66f0e | 66/66 | 1 | $0.0001 |

Crew total about $0.0007 for three runs.

**Bugs in the D481 check that Claude fixed before judging (neither changes what a pass means).** The agent ran D1 twice and stopped at 53/54 both times: the house style rule read the icon component's own svg line as an svg typed by hand (the gate's hand-svg check allows exactly that line and still runs inside D481), and read the CSS words `place-items:center` and `transition:color` as US spellings. The rule now skips the icon component's line for the svg test and drops whole CSS declarations before the spelling test; proved both ways (CSS dropped, "center" in words still caught).

**Found by looking, then measured.** D1 was green but Sachini's screenshot showed "Front desk · Wellawatte" wrapped onto three lines with the dot alone in the middle (about 75px for the line). D481 gained two assertions (the branch on its own line with no dot, every line drawn once by Range client rects); on fc66f0e they failed 8 times and also showed Chamara's "Staff · Wellawatte" already wrapped to two lines in the live build. D2 fixed both.

Optical: the filled star in its 44px button measures dx 0, dy -0.5 by ink at 390 and 1440 (was dy -1.5 on 61f7d26); inside the 0.5px bar, on its edge.

Back after opening the menu on a phone (recorded, not judged): the rail keeps no history entry; Back once closes the rail and stays on the floor, Back twice stays on the floor.

All twelve D481 screenshots in evidence/D481/ looked at by Claude.

After D2, on 6b4d85b: PB 154/154, R 53/53, R5 18/18, P1 193/193, P2 88/88, F3 190/190, API2 331/331 (A1 28, A2 17, A3 59, A4 43, A5 29, B1 30, B2 44, B3 28, B4 23, B5 30).
