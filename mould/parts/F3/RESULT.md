# Part F3 (floor picture with the capacity line), 15 Oct 2026
| Try | Result | Cost |
|---|---|---|
| 1 | static 15/15, FAILED the compile: invented tile.id and tile.status (Claude's brief named Tile without its fields) | $0.0003 |
| 2 | Tile shape and the compiler errors written in: compiles, static 15/15, on screen 74/74 | $0.0003 |
| eye | Claude's screenshot: the words were squeezed to 0 width (row, not the column asked), the branch showed its key, the meter class "seg" clashed with a global class | |
Second fault, so by the rule Claude fixed it by hand: column, entry.name, class mseg. The check gained two assertions that
would have caught it (the words can be SEEN, the line names the branch). Now 82/82.
Lessons: paste every type a part reads, never name a type without its fields; a check that reads innerText cannot see a
squeezed line, measure the box.
