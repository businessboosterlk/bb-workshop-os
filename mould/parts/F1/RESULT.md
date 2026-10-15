# Part F1 (spaces engine): crew bake-off, 15 Oct 2026
Brief and check written by Claude before any run; the check proven on Claude's reference (26 of 26) and a broken copy (24 of 26).
| Model | Check | Tokens in / out | Cost | Seconds |
|---|---|---|---|---|
| DeepSeek V4 Flash 0731 | PASS 26/26, strict typecheck clean | 1149 / 1099 | $0.00027 | 44 |
| gpt-oss 120b | PASS 26/26 | 1191 / 2591 | $0.00049 | 81 |
| GLM 5.3 Flash | PASS 26/26 | 1142 / 1244 | $0.00079 | 68 |
| Qwen3 Coder 480B Turbo | behaviour 26/26, FAILED strict typecheck (a comparison that can never be true) | 1146 / 1312 | $0.00166 | 11 |
| DeepSeek V4 Pro 0813 | behaviour 26/26, FAILED typecheck (imported its own types from ./models, against the brief) | 1149 / 1076 | $0.00429 | 18 |
Total DeepInfra $0.0075 (from the receipts at list price), 222 s of model time.
MERGED: DeepSeek V4 Flash's file, unchanged, as apps/web/src/app/core/spaces.ts on branch three-segments.
Claude's read of it: clean and short. Two small notes: an unused import (PhaseStatus), and with no stage running it
reports 0 minutes left even when later stages remain (the brief did not say; the check did not test it). Both go into
the next brief, not into a silent fix.
