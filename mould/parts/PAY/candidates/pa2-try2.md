```js
// FILE: apps/api/lib/payments.js
// Server copy of apps/web/src/app/core/payments.ts: both must keep the same rules.

/** @typedef {'cash' | 'card' | 'bank' | 'cheque'} PayMethod */
/** @typedef {{ id: string, no: string, at: string, recordedAt: string, amount: number, method: PayMethod, by: string, note?: string, reverses?: string, op?: string }} Payment */
/** @typedef {{ id: string, no: string, at: string, recordedAt: string, amount: number, method: PayMethod, by: string, note?: string, reverses?: string, op?: string, reversedBy?: string }} PaymentLine */
/** @typedef {{ approved?: number, balance?: number, payments?: Payment[] }} PayJob */
/** @typedef {{ amount: unknown, method: unknown, at: unknown, note?: unknown }} RecordInput */
/** @typedef {{ by: string, now: string, today: string, id: string, no: string, op?: string }} RecordCtx */
/** @typedef {{ by: string, now: string, today: string, id: string, op?: string }} ReverseCtx */
/** @typedef {{ ok: true, payments: Payment[] } | { ok: false, reason: string }} PayResult */

export const PAY_METHODS = ['cash', 'card', 'bank', 'cheque'];

function listOf(job) {
  return Array.isArray(job?.payments) ? job.payments : [];
}

function isCorrection(line) {
  return typeof line.reverses === 'string' && line.reverses !== '';
}

function amountOf(line) {
  return Number.isFinite(line.amount) ? line.amount : 0;
}

function isReplay(job, op) {
  if (typeof op !== 'string' || op === '') return false;
  return listOf(job).some(line => line.op === op);
}

/** @param {PayJob | null | undefined} job @returns {number} */
export function paidOf(job) {
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

/** @param {PayJob | null | undefined} job @returns {number} */
export function balanceOf(job) {
  if (job === null || job === undefined) return 0;
  if (typeof job.approved === 'number' && Number.isFinite(job.approved)) {
    return job.approved - paidOf(job);
  }
  if (typeof job.balance === 'number' && Number.isFinite(job.balance)) {
    return job.balance;
  }
  return 0;
}

/** @param {PayJob | null | undefined} job @returns {PaymentLine[]} */
export function lines(job) {
  const raw = listOf(job);
  const corrections = raw.filter(isCorrection);
  const result = [];
  for (const line of raw) {
    if (isCorrection(line)) continue;
    const copy = { ...line };
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

/** @param {ReadonlyArray<PayJob | null | undefined>} jobs @param {string} at @returns {string} */
export function nextNo(jobs, at) {
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

/** @param {PayJob | null | undefined} job @param {RecordInput} input @param {RecordCtx} ctx @returns {PayResult} */
export function record(job, input, ctx) {
  if (isReplay(job, ctx.op)) {
    return { ok: true, payments: listOf(job) };
  }
  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, reason: 'The amount must be a whole number of rupees above 0' };
  }
  if (!PAY_METHODS.includes(input.method)) {
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
  const line = {
    id: ctx.id,
    no: ctx.no,
    at: atStr,
    recordedAt: ctx.now,
    amount: input.amount,
    method: input.method,
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

/** @param {PayJob | null | undefined} job @param {string} paymentId @param {ReverseCtx} ctx @returns {PayResult} */
export function reverse(job, paymentId, ctx) {
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
  const line = {
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