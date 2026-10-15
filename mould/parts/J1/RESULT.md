# Part J1 (job card controls: ui/space-card, ui/parts-list), 15 Oct 2026, sitting 2
| Part | Try | Result | Cost |
|---|---|---|---|
| space card | 1 | static 15/15; FAILED the build: HOLD_WORDS and niceWhen used in the template as bare imports; Cast imported unused | $0.00076 |
| space card | 2 | template fixed; Cast still unused (noUnusedLocals): second fail, back to Claude | $0.00078 |
| parts list | 1 | static 15/15; FAILED the compiler 20 times: signals written as this.err('') | $0.00059 |
| parts list | 2 | writes fixed with .set; niceWhen still a bare import in the template: second fail, back to Claude | $0.00060 |
| eye and check | | the check (74) caught Add a part at 36px (Claude's brief asked for the small button). Tightened after Claude read the template: the bay line printed "Bay 3 · Bay 3"; the Hold button skipped openHold, so a cancelled reason carried over. Claude's screenshot at 390: the state square had no colour (data-where never set on it) and a one line option sat 4.5px high. Every one got a check line, proven failing first. | |
Total crew $0.0027, four runs (one more timed out connecting, no charge). Claude's hand fixes: removed one import, added two
class fields, openHold, data-where on the square, justify-content on .opt, min-height 40px on Add a part.
On screen `node mould/parts/J1/check.mjs` 78/78 at 390 and 1440. ui-sheets 191/191 with the four new sheets.
Read: the logic was right both times; every fail was Angular's template scope or the compile flags. Next brief says it up front:
"a template sees only class members; write signals with .set; the check compiles with noUnusedLocals".
