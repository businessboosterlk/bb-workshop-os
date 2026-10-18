PART PB1 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19, TypeScript strict, signals.

THE JOB. Payments are now lines on a job. Paid and balance are worked out from the lines by an engine that is already written and checked (apps/web/src/app/core/payments.ts, pasted below); nobody types a paid figure any more. This part changes the core of the web app:
1. A new seat role `desk` (front desk). Owner and desk record payments; only the owner corrects one.
2. The data service gains `recordPayment` and `correctPayment`, in local mode (the demo, everything in this browser) through the engine, in api mode through the server's two new routes.
3. `newJob` no longer sends `paid` and `setMoney` no longer takes or sends `paid` (the server now refuses `paid` from every seat).
4. The demo seed loses every typed `paid` figure; the same money becomes payment lines.
5. The demo garage cast gains a desk seat.

THE ENGINE apps/web/src/app/core/payments.ts (already written, import from it, never change it):
```ts
{{file:apps/web/src/app/core/payments.ts}}
```

WHAT TO WRITE. Return ONE ```ts code block holding the parts below, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`. Write only the replacement lines for each part.

== Part 1 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=export type Role = 'owner' | 'staff'; | until=export type PhaseStatus`
Now that line is:
```ts
{{lines:apps/web/src/app/core/models.ts:4:4}}
```
Write two lines: `import { Payment } from './payments';` then `export type Role = 'owner' | 'desk' | 'staff';`

== Part 2 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=  estimate?: number; approved?: number; paid?: number; | until=  status: JobStatus; deliveredAt?`
Now that line is:
```ts
{{lines:apps/web/src/app/core/models.ts:33:33}}
```
Write two lines, indented two spaces like the rest of the interface:
- `estimate?: number; approved?: number; paid?: number;` followed by the comment `/* owner only. paid is an old typed figure: never written now, paid is worked out from payments */`
- `payments?: Payment[]; balance?: number;` followed by the comment `/* the payment lines; balance is sent by the server to a front desk seat that may not see approved */`

== Part 3 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=export interface Activity { | until=export interface Photo {`
Now that line is:
```ts
{{lines:apps/web/src/app/core/models.ts:41:41}}
```
Write the same one line with `| 'payment'` added at the end of the type union (after `'quote'`). Nothing else changes.

== Part 4 header line: `// BLOCK: apps/web/src/app/core/session.service.ts | start=  readonly owner = computed( | until=  readonly signedIn`
Now that line is:
```ts
{{lines:apps/web/src/app/core/session.service.ts:24:24}}
```
Write three lines: that owner line exactly as it is, then
`  readonly desk = computed(() => this.role() === 'desk');`
`  readonly collects = computed(() => this.role() === 'owner' || this.role() === 'desk');   /* records payments: the owner and the front desk */`

== Part 5 header line: `// BLOCK: casts/demo-garage.json | start=  "users": [ | until=  "customerCode": "1234",`
Now those lines are:
```json
{{lines:casts/demo-garage.json:321:339}}
```
Write the same users array (same JSON layout, two space indents) with a fourth seat added after Dinesh: name `Sachini`, role `desk`, branch `bora`, pin `4444`. The array still ends with the line `  ],`. Valid JSON: a comma after Dinesh's closing brace.

== Part 6 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=import { seed, phasesFor, followupsFor, SEED_VERSION } from './seed'; | until=import { quoteTotal, nextNumber } from './sales';`
Write two lines: the seed import line exactly as it is, then `import { record, reverse, nextNo, Payment, PayMethod } from './payments';`

== Part 7 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=      estimate: input.estimate || 0, approved: 0, paid: 0, | until=    this.jobs.update(x => [j, ...x]);`
Now that line is:
```ts
{{lines:apps/web/src/app/core/data.service.ts:199:199}}
```
Write the same one line with `paid: 0, ` removed. Nothing else changes.

== Part 8 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  async setMoney(jobId | until=  async addNote(jobId`
Now that line is:
```ts
{{lines:apps/web/src/app/core/data.service.ts:265:265}}
```
Write three methods of the DataService class, two space indent:

(a) `async setMoney(jobId: string, patch: { estimate?: number; approved?: number })`: owner only exactly as now (`if (!this.session.owner()) throw new Error('Owner only');`), then build a new object holding only the keys `estimate` and `approved` that are present in `patch` (`if (patch.estimate !== undefined) clean.estimate = patch.estimate;` and the same for approved) and `return this.patchJob(jobId, clean);`. A caller that still passes paid must not have it sent: never spread `patch`.

(b) `async recordPayment(jobId: string, input: { amount: number; method: PayMethod; at: string; note?: string }): Promise<{ job: Job; payment: Payment | null }>`
- First line: `if (!this.session.collects()) throw new Error('This seat cannot do that.');`
- `const j = this.job(jobId); if (!j) throw new Error('No such job');`
- API mode (`this.mode() === 'api'`): `const body = { amount: input.amount, method: input.method, at: input.at, note: (input.note || '').trim() };` then `const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'payments', body, j.updatedAt);`. If `r` is null (the write is waiting in the outbox) return `{ job: j, payment: null }`. Otherwise put `r` in place of the job in `this.jobs` (`this.jobs.update(x => x.map(y => y.id === jobId ? r : y))`), find the new line as the first line of `r.payments || []` whose id is not among the ids of `j.payments || []` and that has no `reverses`, and if one is found add a local activity exactly the way completePhase does in api mode: `this.activities.update(x => [{ id: uid(), jobId, type: 'payment', summary: 'Payment recorded (' + p.no + ')', by: this.session.name(), createdAt: now(), updatedAt: now() } as Activity, ...x]);`. Return `{ job: r, payment: <that line or null> }`.
- Local mode: `const res = record(j, input, { by: this.session.name(), now: now(), today: localDay(), id: uid(), no: nextNo(this.jobs(), String(input.at)) });` then `if (!res.ok) throw new Error(res.reason);`. The new line is the last element of `res.payments`. `const r = await this.patchJob(jobId, { payments: res.payments });` then `await this.log(jobId, 'payment', 'Payment recorded (' + line.no + ')');` and return `{ job: r || j, payment: line }`.

(c) `async correctPayment(jobId: string, paymentId: string): Promise<Job | null>`
- First line: `if (!this.session.owner()) throw new Error('This seat cannot do that.');`
- `const j = this.job(jobId); if (!j) throw new Error('No such job');`
- API mode: `const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'payments/' + paymentId + '/reverse', {}, j.updatedAt);` If `r` is null return `j`. Otherwise put `r` in place of the job in `this.jobs`, add a local activity the same way with summary `'Payment corrected'`, return `r`.
- Local mode: `const res = reverse(j, paymentId, { by: this.session.name(), now: now(), today: localDay(), id: uid() });` then `if (!res.ok) throw new Error(res.reason);` then `const r = await this.patchJob(jobId, { payments: res.payments });` then `await this.log(jobId, 'payment', 'Payment corrected');` and return `r`.

Then one comment line above (b): `/* PAYMENTS (18 Oct 2026). Each payment is a line on the job; paid and balance are worked out by core/payments.ts, never typed. A correction is a reversal, owner only. */`

== Part 9 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=export function daysSince(iso?: string) | until=export function endOfToday()`
Now that line is:
```ts
{{lines:apps/web/src/app/core/data.service.ts:436:436}}
```
Write that line exactly as it is, then a new exported function on one line: `export function localDay(ms = Date.now()) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }` preceded by the comment line `/* today on this phone's calendar, YYYY-MM-DD: the day a payment is dated by default and the latest it may carry */`

== Part 10 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=import { addWorkingMinutes } from './calendar'; | until=/* The demo floor.`
Write two lines: that import exactly as it is, then `import { nextNo } from './payments';`

== Part 11 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=export const SEED_VERSION = 6; | until=export function seed(cast: Cast)`
Write two lines: `/* 7: payments are lines on the job, 18 Oct 2026: every typed paid figure became one cash payment line */` then `export const SEED_VERSION = 7;`

== Part 12 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=  const jobs: Job[] = [ | until=  /* the promise of every open car is what a workshop`
Now those lines are:
```ts
{{lines:apps/web/src/app/core/seed.ts:66:93}}
```
Write the same lines with ONLY these changes: remove every `paid: <number>` entry (with its comma and space) from every job's extra object, so `estimate: 185000, approved: 185000, paid: 0,` becomes `estimate: 185000, approved: 185000,` and `approved: 18000, paid: 18000 }` becomes `approved: 18000 }`. Every other character stays exactly as it is, comments included. Then, after the closing `];` of the array, add these lines:
```
  /* the money already taken on the floor, as payment lines: cash, dated a day after the car came in, numbered by the engine */
  const PAID: Record<string, number> = { j2: 18000, j3: 50000, j5: 30000, j6: 45000, j8: 88000, j9: 26000, j10: 22000, j13: 60000 };
  const DESK = cast.users.find(u => u.role === 'desk')?.name || OWNER;
```
followed by a `for (const j of jobs)` loop: when `PAID[j.id]` is set, `const when = new Date(new Date(j.createdAt).getTime() + 24 * H).toISOString();` `const at = when.slice(0, 10);` and `j.payments = [{ id: 'pay-' + j.id, no: nextNo(jobs, at), at, recordedAt: when, amount: PAID[j.id], method: 'cash', by: DESK }];`. The loop sets each job's lines before the next job is numbered, so the numbers never repeat.

TRAPS.
- The refusal words exactly: 'This seat cannot do that.' (with the full stop). The engine's reasons are thrown word for word, never rewritten.
- `nextNo` takes the list of jobs and the payment's date; in local mode pass `this.jobs()` and `String(input.at)`.
- The api path for a correction is written exactly `'payments/' + paymentId + '/reverse'`.
- Never add `paid` anywhere. Never use `any` in new code except the existing `as ApiAdapter` cast. No em or en dash, no comma before and, or, but or nor in any comment or string. British English.
