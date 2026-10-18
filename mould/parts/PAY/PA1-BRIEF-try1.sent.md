PART PA1 of the Workshop OS (a garage system in Sri Lanka). Web: Angular 20, strict TypeScript. This part is ONE new pure file with no imports: the payments engine.

THE IDEA. Each payment a customer makes is a LINE on the job. What has been paid and what is still owed are always worked out from the lines, never typed and never stored. The list is append only: a mistake is fixed by a CORRECTION line (a reversal) that points at the payment it undoes, for the same full amount. One correction per payment. A correction cannot itself be corrected. Amounts are whole rupees.

TYPES. Write these exactly as given, at the top of the file, all exported:
```ts
export type PayMethod = 'cash' | 'card' | 'bank' | 'cheque';
/* one payment line. no: the receipt number 'R-YYYYMM-NNN', '' on a correction. at: the day the money moved (YYYY-MM-DD).
   recordedAt: the ISO time it was recorded. amount: whole rupees above 0. by: the seat name. reverses: the id of the payment
   this correction undoes. op: the x-wos-op of the request that wrote it. */
export interface Payment { id: string; no: string; at: string; recordedAt: string; amount: number; method: PayMethod; by: string; note?: string; reverses?: string; op?: string; }
export interface PaymentLine extends Payment { reversedBy?: string; }
/* the only job fields the engine reads. balance is sent by the server to a front desk seat that may not see approved. */
export interface PayJob { approved?: number; balance?: number; payments?: Payment[]; }
export interface RecordInput { amount: unknown; method: unknown; at: unknown; note?: unknown; }
export interface RecordCtx { by: string; now: string; today: string; id: string; no: string; op?: string; }
export interface ReverseCtx { by: string; now: string; today: string; id: string; op?: string; }
export type PayResult = { ok: true; payments: Payment[] } | { ok: false; reason: string };
export const PAY_METHODS: readonly PayMethod[] = ['cash', 'card', 'bank', 'cheque'];
```

FUNCTIONS. Export exactly these six. Every one is pure: it never changes its arguments, never reads the clock, never throws on bad data (a null job, `payments` that is not an array, an amount that is not a number).

Helpers you will need (write them as module level functions, not exported): the list of a job is `Array.isArray(job?.payments) ? job.payments : []`. A line IS A CORRECTION when `typeof line.reverses === 'string' && line.reverses !== ''`. The amount of a line counts as `Number.isFinite(line.amount) ? line.amount : 0` (so NaN or text counts 0, never NaN).

1. `paidOf(job: PayJob | null | undefined): number` = the sum of the amounts of the lines that are not corrections, minus the sum of the amounts of the corrections. A null job or no list gives 0.

2. `balanceOf(job: PayJob | null | undefined): number`:
   - job null or undefined: 0.
   - `Number.isFinite(job.approved)` (a real number, not NaN, not text): `job.approved - paidOf(job)`.
   - else `Number.isFinite(job.balance)`: `job.balance` (the server worked it out for a desk seat).
   - else 0.

3. `lines(job: PayJob | null | undefined): PaymentLine[]`: the lines that are NOT corrections, as new objects (`{ ...line }`), sorted newest `at` first, then newest `recordedAt` first (plain string comparison, both sort newest first), and on a full tie keep the order they had in the list. When a correction points at a line (`correction.reverses === line.id`), that line gets `reversedBy: <the correction's id>`. A line nobody corrected must NOT have a `reversedBy` key at all (do not set it to undefined). Corrections are left out of the result.

4. `nextNo(jobs: ReadonlyArray<PayJob | null | undefined>, at: string): string`: the next receipt number for the month of `at`. `prefix = 'R-' + at.slice(0, 4) + at.slice(5, 7) + '-'` (so '2026-10-18' gives 'R-202610-'). Count every line of every job (skip null jobs and jobs whose payments is not an array) whose `no` is a string, not empty, and starts with `prefix`. Answer `prefix + String(count + 1).padStart(3, '0')`. Read `at` as `String(at ?? '')` so a missing value never throws.

5. `record(job: PayJob | null | undefined, input: RecordInput, ctx: RecordCtx): PayResult`. Rules in THIS order, the first that applies wins:
   a. REPLAY FIRST: when `ctx.op` is a non empty string and some line of the job already has `op === ctx.op`, answer `{ ok: true, payments: <the job's list, unchanged> }`. (A request sent twice records nothing twice, even when it would now be refused.)
   b. `input.amount` not an integer above 0 (`typeof === 'number' && Number.isInteger(x) && x > 0`; text like '1500' is refused): `{ ok: false, reason: 'The amount must be a whole number of rupees above 0' }`.
   c. `input.method` not one of PAY_METHODS: reason `'Choose how they paid'`.
   d. `input.at` not a real date: it must be a string matching `/^\d{4}-\d{2}-\d{2}$/` AND a day that exists (`new Date(at + 'T00:00:00Z')` is valid and its `toISOString().slice(0, 10) === at`, so '2026-02-30' and '2026-13-01' are refused): reason `'Choose the date they paid'`.
   e. `input.at > ctx.today` (string comparison): reason `'The date cannot be in the future'`.
   f. `const owed = balanceOf(job)`; `input.amount > owed`: reason `'That is more than the ' + owed + ' still owed on this car'` (the number in plain digits, no separators, e.g. 'That is more than the 17500 still owed on this car').
   g. Otherwise build the line with keys in this order: `{ id: ctx.id, no: ctx.no, at: input.at, recordedAt: ctx.now, amount: input.amount, method: input.method, by: ctx.by }`. Note: when `input.note` is a string, `note = input.note.trim().slice(0, 200)`; add the `note` key only when that is not empty. Add `op: ctx.op` only when `ctx.op` is a non empty string. Answer `{ ok: true, payments: [...list, line] }` (a NEW array; the job's own array is untouched).

6. `reverse(job: PayJob | null | undefined, paymentId: string, ctx: ReverseCtx): PayResult`. In THIS order:
   a. REPLAY FIRST, exactly as 5a.
   b. `const p` = the line with `id === paymentId`. None: reason `'No such payment'`.
   c. `p` is itself a correction: reason `'A correction cannot itself be corrected'`.
   d. Some line already has `reverses === paymentId`: reason `'This payment is already corrected'`.
   e. Otherwise append `{ id: ctx.id, no: '', at: ctx.today, recordedAt: ctx.now, amount: p.amount, method: p.method, by: ctx.by, reverses: paymentId }` plus `op: ctx.op` only when it is a non empty string. Answer `{ ok: true, payments: [...list, line] }`.

TRAPS.
- Never put a key with the value undefined into a line or a result (`note`, `op`, `reversedBy`): leave the key out.
- The replay check runs before every other rule in both record and reverse.
- `PAY_METHODS.includes(input.method)` does not type check on unknown in strict mode: use `(PAY_METHODS as readonly unknown[]).includes(input.method)` and then narrow with `as PayMethod`.
- The file must compile under `tsc --strict` on its own and must import nothing.
- Exact words for every reason, character for character, as written above.

WHAT TO WRITE. Return ONE ```ts code block. Its first line is exactly:
`// FILE: apps/web/src/app/core/payments.ts`
then one comment line saying what the file is, then the types exactly as given, then the helpers and the six functions.
