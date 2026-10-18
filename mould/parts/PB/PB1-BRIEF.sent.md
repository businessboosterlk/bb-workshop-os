PART PB1 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19, TypeScript strict, signals.

THE JOB. Payments are now lines on a job. Paid and balance are worked out from the lines by an engine that is already written and checked (apps/web/src/app/core/payments.ts, pasted below); nobody types a paid figure any more. This part changes the core of the web app:
1. A new seat role `desk` (front desk). Owner and desk record payments; only the owner corrects one.
2. The data service gains `recordPayment` and `correctPayment`, in local mode (the demo, everything in this browser) through the engine, in api mode through the server's two new routes.
3. `newJob` no longer sends `paid` and `setMoney` no longer takes or sends `paid` (the server now refuses `paid` from every seat).
4. The demo seed loses every typed `paid` figure; the same money becomes payment lines.
5. The demo garage cast gains a desk seat.

THE ENGINE apps/web/src/app/core/payments.ts (already written, import from it, never change it):
```ts
// Payments engine for the Workshop OS: pure functions that compute paid, balance, lines, next receipt number, record a payment, and reverse a payment.

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

function listOf(job: PayJob | null | undefined): Payment[] {
  return Array.isArray(job?.payments) ? job.payments : [];
}

function isCorrection(line: Payment): boolean {
  return typeof line.reverses === 'string' && line.reverses !== '';
}

function amountOf(line: Payment): number {
  return Number.isFinite(line.amount) ? line.amount : 0;
}

function isReplay(job: PayJob | null | undefined, op: string | undefined): boolean {
  if (typeof op !== 'string' || op === '') return false;
  return listOf(job).some(line => line.op === op);
}

export function paidOf(job: PayJob | null | undefined): number {
  const lines = listOf(job);
  let total = 0;
  for (const line of lines) {
    if (isCorrection(line)) {
      total -= amountOf(line);
    } else {
      total += amountOf(line);
    }
  }
  return total;
}

export function balanceOf(job: PayJob | null | undefined): number {
  if (job === null || job === undefined) return 0;
  if (typeof job.approved === 'number' && Number.isFinite(job.approved)) {
    return job.approved - paidOf(job);
  }
  if (typeof job.balance === 'number' && Number.isFinite(job.balance)) {
    return job.balance;
  }
  return 0;
}

export function lines(job: PayJob | null | undefined): PaymentLine[] {
  const raw = listOf(job);
  const corrections = raw.filter(isCorrection);
  const result: PaymentLine[] = [];
  for (const line of raw) {
    if (isCorrection(line)) continue;
    const copy: PaymentLine = { ...line };
    const correction = corrections.find(c => c.reverses === line.id);
    if (correction) {
      copy.reversedBy = correction.id;
    }
    result.push(copy);
  }
  result.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? 1 : -1;
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    return 0;
  });
  return result;
}

export function nextNo(jobs: ReadonlyArray<PayJob | null | undefined>, at: string): string {
  const atStr = String(at ?? '');
  const prefix = 'R-' + atStr.slice(0, 4) + atStr.slice(5, 7) + '-';
  let count = 0;
  for (const job of jobs) {
    if (job === null || job === undefined) continue;
    if (!Array.isArray(job.payments)) continue;
    for (const line of job.payments) {
      if (typeof line.no === 'string' && line.no !== '' && line.no.startsWith(prefix)) {
        count++;
      }
    }
  }
  return prefix + String(count + 1).padStart(3, '0');
}

export function record(job: PayJob | null | undefined, input: RecordInput, ctx: RecordCtx): PayResult {
  if (isReplay(job, ctx.op)) {
    return { ok: true, payments: listOf(job) };
  }
  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, reason: 'The amount must be a whole number of rupees above 0' };
  }
  if (!(PAY_METHODS as readonly unknown[]).includes(input.method)) {
    return { ok: false, reason: 'Choose how they paid' };
  }
  const atStr = String(input.at ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(atStr)) {
    return { ok: false, reason: 'Choose the date they paid' };
  }
  const date = new Date(atStr + 'T00:00:00Z');
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== atStr) {
    return { ok: false, reason: 'Choose the date they paid' };
  }
  if (atStr > ctx.today) {
    return { ok: false, reason: 'The date cannot be in the future' };
  }
  const owed = balanceOf(job);
  if (input.amount > owed) {
    return { ok: false, reason: 'That is more than the ' + owed + ' still owed on this car' };
  }
  const line: Payment = {
    id: ctx.id,
    no: ctx.no,
    at: atStr,
    recordedAt: ctx.now,
    amount: input.amount,
    method: input.method as PayMethod,
    by: ctx.by,
  };
  if (typeof input.note === 'string') {
    const note = input.note.trim().slice(0, 200);
    if (note !== '') {
      line.note = note;
    }
  }
  if (typeof ctx.op === 'string' && ctx.op !== '') {
    line.op = ctx.op;
  }
  return { ok: true, payments: [...listOf(job), line] };
}

export function reverse(job: PayJob | null | undefined, paymentId: string, ctx: ReverseCtx): PayResult {
  if (isReplay(job, ctx.op)) {
    return { ok: true, payments: listOf(job) };
  }
  const list = listOf(job);
  const p = list.find(line => line.id === paymentId);
  if (!p) {
    return { ok: false, reason: 'No such payment' };
  }
  if (isCorrection(p)) {
    return { ok: false, reason: 'A correction cannot itself be corrected' };
  }
  if (list.some(line => line.reverses === paymentId)) {
    return { ok: false, reason: 'This payment is already corrected' };
  }
  const line: Payment = {
    id: ctx.id,
    no: '',
    at: ctx.today,
    recordedAt: ctx.now,
    amount: p.amount,
    method: p.method,
    by: ctx.by,
    reverses: paymentId,
  };
  if (typeof ctx.op === 'string' && ctx.op !== '') {
    line.op = ctx.op;
  }
  return { ok: true, payments: [...list, line] };
}
```

WHAT TO WRITE. Return ONE ```ts code block holding the parts below, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`. Write only the replacement lines for each part.

== Part 1 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=export type Role = 'owner' | 'staff'; | until=export type PhaseStatus`
Now that line is:
```ts
export type Role = 'owner' | 'staff';
```
Write two lines: `import { Payment } from './payments';` then `export type Role = 'owner' | 'desk' | 'staff';`

== Part 2 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=  estimate?: number; approved?: number; paid?: number; | until=  status: JobStatus; deliveredAt?`
Now that line is:
```ts
  estimate?: number; approved?: number; paid?: number;   /* owner only: the API strips these for a staff seat */
```
Write two lines, indented two spaces like the rest of the interface:
- `estimate?: number; approved?: number; paid?: number;` followed by the comment `/* owner only. paid is an old typed figure: never written now, paid is worked out from payments */`
- `payments?: Payment[]; balance?: number;` followed by the comment `/* the payment lines; balance is sent by the server to a front desk seat that may not see approved */`

== Part 3 header line: `// BLOCK: apps/web/src/app/core/models.ts | start=export interface Activity { | until=export interface Photo {`
Now that line is:
```ts
export interface Activity { id: string; jobId: string; enquiryId?: string; quoteId?: string; type: 'phase' | 'note' | 'promise' | 'approval' | 'pickup' | 'delivered' | 'new' | 'followup' | 'enquiry' | 'quote'; summary: string; by: string; createdAt: string; updatedAt: string; }
```
Write the same one line with `| 'payment'` added at the end of the type union (after `'quote'`). Nothing else changes.

== Part 4 header line: `// BLOCK: apps/web/src/app/core/session.service.ts | start=  readonly owner = computed( | until=  readonly signedIn`
Now that line is:
```ts
  readonly owner = computed(() => this.role() === 'owner');
```
Write three lines: that owner line exactly as it is, then
`  readonly desk = computed(() => this.role() === 'desk');`
`  readonly collects = computed(() => this.role() === 'owner' || this.role() === 'desk');   /* records payments: the owner and the front desk */`

== Part 5 header line: `// BLOCK: casts/demo-garage.json | start=  "users": [ | until=  "customerCode": "1234",`
Now those lines are:
```json
  "users": [
    {
      "name": "Ravi",
      "role": "owner",
      "pin": "1111"
    },
    {
      "name": "Chamara",
      "role": "staff",
      "branch": "bora",
      "pin": "2222"
    },
    {
      "name": "Dinesh",
      "role": "staff",
      "branch": "dehi",
      "pin": "3333"
    }
  ],
```
Write the same users array (same JSON layout, two space indents) with a fourth seat added after Dinesh: name `Sachini`, role `desk`, branch `bora`, pin `4444`. The array still ends with the line `  ],`. Valid JSON: a comma after Dinesh's closing brace.

== Part 6 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=import { seed, phasesFor, followupsFor, SEED_VERSION } from './seed'; | until=import { quoteTotal, nextNumber } from './sales';`
Write two lines: the seed import line exactly as it is, then `import { record, reverse, nextNo, Payment, PayMethod } from './payments';`

== Part 7 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=      estimate: input.estimate || 0, approved: 0, paid: 0, | until=    this.jobs.update(x => [j, ...x]);`
Now that line is:
```ts
      estimate: input.estimate || 0, approved: 0, paid: 0, status: 'open', notes: input.notes, enquiryId: input.enquiryId, quoteId: input.quoteId });
```
Write the same one line with `paid: 0, ` removed. Nothing else changes.

== Part 8 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  async setMoney(jobId | until=  async addNote(jobId`
Now that line is:
```ts
  async setMoney(jobId: string, patch: { estimate?: number; approved?: number; paid?: number }) { if (!this.session.owner()) throw new Error('Owner only'); return this.patchJob(jobId, patch); }
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
export function daysSince(iso?: string) { if (!iso) return 0; return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }
```
Write that line exactly as it is, then a new exported function on one line: `export function localDay(ms = Date.now()) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }` preceded by the comment line `/* today on this phone's calendar, YYYY-MM-DD: the day a payment is dated by default and the latest it may carry */`

== Part 10 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=import { addWorkingMinutes } from './calendar'; | until=/* The demo floor.`
Write two lines: that import exactly as it is, then `import { nextNo } from './payments';`

== Part 11 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=export const SEED_VERSION = 6; | until=export function seed(cast: Cast)`
Write two lines: `/* 7: payments are lines on the job, 18 Oct 2026: every typed paid figure became one cash payment line */` then `export const SEED_VERSION = 7;`

== Part 12 header line: `// BLOCK: apps/web/src/app/core/seed.ts | start=  const jobs: Job[] = [ | until=  /* the promise of every open car is what a workshop`
Now those lines are:
```ts
  const jobs: Job[] = [
    /* the demo customer's Aqua: accident repair through insurance, mid paint, one approval waiting */
    job('j1', customers[0], 0, 'bora', 'accident', true, 6, 9 * 24, 20, 3 * 24, { insurer: 'Ceylinco', estimate: 185000, approved: 185000, paid: 0,
      approvals: [{ id: 'a1', title: 'Replace the front left headlamp', detail: 'The lamp housing is cracked inside. A new unit fits the colour match better than a repair.', amount: 24500, status: 'pending', askedAt: iso(5 * H) }],
      promiseHistory: [{ at: iso(2 * 24 * H), was: iso(-1 * 24 * H), now: iso(-3 * 24 * H), reason: 'The insurer took two extra days to approve the estimate', by: OWNER }],
      pickup: { wanted: true, address: 'Nugegoda', status: 'collected', driver: 'Sampath' } }),
    /* the demo customer's Wagon R: cut and polish delivered last month */
    job('j2', customers[0], 1, 'dehi', 'cutpolish', false, 7, 40 * 24, 38 * 24, -38 * 24, { status: 'delivered', deliveredAt: iso(38 * 24 * H), handoverBy: STAFF2, rating: 5, estimate: 18000, approved: 18000, paid: 18000 }),
    /* Vezel: painting, overrun on paint preparation */
    job('j3', customers[1], 0, 'bora', 'painting', false, 2, 6 * 24, 70, -1 * 24, { estimate: 145000, approved: 145000, paid: 50000 }),
    /* Leaf: alloy wheels, on time */
    job('j4', customers[2], 0, 'dehi', 'alloy', false, 3, 3 * 24, 6, 2 * 24, { estimate: 32000, approved: 32000, paid: 0 }),
    /* Premio: accident, no insurance, waiting on parts */
    job('j5', customers[3], 0, 'dehi', 'accident', false, 2, 4 * 24, 30, 6 * 24, { estimate: 96000, approved: 96000, paid: 30000, pickup: { wanted: true, address: 'Mount Lavinia', status: 'collected', driver: 'Sampath' } }),
    /* Sorento: paint correction, ready for pickup */
    job('j6', customers[4], 0, 'bora', 'correction', false, 6, 5 * 24, 2, 0, { estimate: 45000, approved: 45000, paid: 45000, pickup: { wanted: true, address: 'Kohuwala', status: 'booked', driver: 'Sampath', eta: 'Today 4 pm' } }),
    /* Fit: received this morning */
    job('j7', customers[5], 0, 'dehi', 'cutpolish', false, 0, 3, 3, 10, { estimate: 15000, approved: 0, paid: 0 }),
    /* delivered cars, so the follow-up list has something due, something coming and something done */
    job('j8', customers[6], 0, 'bora', 'painting', false, 7, 36 * 24, 31 * 24, -31 * 24, { status: 'delivered', deliveredAt: iso(31 * 24 * H), handoverBy: STAFF1, rating: 5, estimate: 88000, approved: 88000, paid: 88000 }),
    job('j9', customers[7], 0, 'dehi', 'alloy', false, 7, 7 * 24, 4 * 24, -4 * 24, { status: 'delivered', deliveredAt: iso(4 * 24 * H), handoverBy: STAFF2, estimate: 26000, approved: 26000, paid: 26000 }),
    job('j10', customers[8], 0, 'bora', 'cutpolish', false, 7, 93 * 24, 92 * 24, -92 * 24, { status: 'delivered', deliveredAt: iso(92 * 24 * H), handoverBy: STAFF1, rating: 4, estimate: 22000, approved: 22000, paid: 22000 }),
    /* the floor picture: more cars so both branches read as a working day */
    job('j11', customers[9], 0, 'bora', 'cutpolish', false, 3, 8, 1.5, 6, { estimate: 16000, approved: 16000, paid: 0 }),
    job('j12', customers[10], 0, 'bora', 'correction', false, 2, 26, 22, 20, { estimate: 38000, approved: 38000, paid: 0 }),
    job('j13', customers[11], 0, 'dehi', 'painting', false, 3, 5 * 24, 30, 2 * 24, { estimate: 120000, approved: 120000, paid: 60000 }),
    job('j14', customers[12], 0, 'bora', 'accident', false, 3, 3 * 24, 4, 4 * 24, { estimate: 74000, approved: 74000, paid: 0 })
  ];
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
