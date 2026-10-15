# Part E1 (the engine for F4 holding dock and G1 parts board, F1's two notes folded in): 15 Oct 2026
Brief and check written by Claude before any run. The check proven on the old F1 file: 28 of 56 (every F1 behaviour still
passes, every new rule fails), so it can tell a missing rule from a present one.
| Try | Model | Check | Tokens in / out | Cost | Seconds |
|---|---|---|---|---|---|
| 1 | DeepSeek V4 Flash 0731 | FAIL 54/56: three unused type imports (strict noUnusedLocals); editPart kept the old supplier when it was cleared | 3250 / 3245 | $0.00078 | 32 |
| 2 | same, both faults written into the brief | PASS 56/56 | 3367 / 3313 | $0.00080 | 36 |
MERGED: try 2 unchanged as apps/web/src/app/core/spaces.ts. Claude's read: hold() leaves the bay through free(), as the camera
rule needs; three non-null assertions on job.parts sit after a guard that found the part, so they cannot miss.
Lesson for the next brief: "import only what you use" was in two rules and still missed; the compiler flag in the check is
what caught it. A spread that should REMOVE a key is a trap worth naming in the brief up front.
