PART PA2 of the Workshop OS (a garage system in Sri Lanka). Server: Next 15, plain JavaScript ES modules (no TypeScript on the server).

THE JOB. The web app has a pure payments engine in TypeScript (below, already checked: 64 of 64 rule checks pass and it compiles under tsc --strict). The server needs THE SAME ENGINE, with the same exports and exactly the same behaviour for every input, as plain JavaScript in a new file apps/api/lib/payments.js. A check runs more than 60 cases on both files and fails on any difference, including the exact words of every reason and which keys a line has.

THE WEB ENGINE apps/web/src/app/core/payments.ts:
```ts
{{file:apps/web/src/app/core/payments.ts}}
```

HOW TO TRANSLATE.
- Keep every function, every rule, every order of checks and every reason word for word. Same exports: `PAY_METHODS`, `paidOf`, `balanceOf`, `lines`, `nextNo`, `record`, `reverse`. Same module level helpers (not exported).
- The types become JSDoc at the top of the file, one `@typedef` each, written exactly in this shape:
  `/** @typedef {'cash' | 'card' | 'bank' | 'cheque'} PayMethod */`
  `/** @typedef {{ id: string, no: string, at: string, recordedAt: string, amount: number, method: PayMethod, by: string, note?: string, reverses?: string, op?: string }} Payment */`
  and the same for PaymentLine, PayJob, RecordInput, RecordCtx, ReverseCtx and PayResult. Put `@param` and `@returns` JSDoc on each exported function.
- `PAY_METHODS` is `export const PAY_METHODS = ['cash', 'card', 'bank', 'cheque'];`. Where the TypeScript casts (`as readonly unknown[]`, `as PayMethod`), just drop the cast.
- No imports, no dependencies, no TypeScript syntax anywhere (no `: type`, no `interface`, no `as`, no `!`).

WHAT TO WRITE. Return ONE ```js code block. Its first line is exactly:
`// FILE: apps/api/lib/payments.js`
then one comment line saying it is the server copy of apps/web/src/app/core/payments.ts and that both must keep the same rules, then the JSDoc types and the code.
