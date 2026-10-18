```ts
// FILE: apps/web/src/app/core/payments.ts
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