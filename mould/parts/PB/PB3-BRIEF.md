PART PB3 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19 standalone component, TypeScript strict, signals. File: apps/web/src/app/pages/workshop/money.component.ts, the owner's Money screen.

THE JOB. Payments are now lines on a job; nobody types a paid figure any more (`j.paid` is an old field that new jobs never carry). Paid and the balance are worked out by the engine. Change the Money screen so every paid and still to collect figure comes from the engine. Nothing else changes: same layout, same words, same filters, same order of columns.

FUNCTIONS THIS PART READS (already written and checked; import them, never change them). From apps/web/src/app/core/payments.ts:
- `paidOf(job): number`: the money paid on the job, worked out from its payment lines (a correction takes its payment back out).
- `balanceOf(job): number`: the approved total minus paidOf. Never below 0 in practice; keep the existing Math.max(0, ...) where a sum uses it.
Both take a Job. The type `Job` comes from '../../core/models'.

THE CURRENT FILE:
```ts
{{file:apps/web/src/app/pages/workshop/money.component.ts}}
```

THE CHANGES, all of them:
1. Imports: add `import { balanceOf, paidOf } from '../../core/payments';` and `import { Job } from '../../core/models';` after the existing imports.
2. In the table row: the Paid cell shows `cast.money(paid(j))`; the To collect cell has `[class.warn]="balance(j) > 0"` and shows `cast.money(balance(j))`.
3. `rows`: sort by `balance(b) - balance(a)` (the biggest balance first, as now).
4. `due`: the sum of `Math.max(0, balance(j))` over the same jobs as now.
5. Two small methods on the class, on one line: `paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); }`.
6. Every other line exactly as it is now, character for character, including the comment at the top and the escaped quotes in the template.

WHAT TO WRITE. Return ONE ```ts code block holding the whole new file, opened by this header line exactly (it is a merge marker): `// FILE: apps/web/src/app/pages/workshop/money.component.ts`

TRAPS.
- After the change the file must not read `.paid` anywhere: `j.paid` is gone from every expression.
- No new colour, no em or en dash, no comma before and, or, but or nor in any word. British English.
