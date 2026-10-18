```ts
// BLOCK: apps/web/src/app/core/models.ts | start=export type Role = 'owner' | 'staff'; | until=export type PhaseStatus
import { Payment } from './payments';
export type Role = 'owner' | 'desk' | 'staff';

// BLOCK: apps/web/src/app/core/models.ts | start=  estimate?: number; approved?: number; paid?: number; | until=  status: JobStatus; deliveredAt?
  estimate?: number; approved?: number; paid?: number;   /* owner only. paid is an old typed figure: never written now, paid is worked out from payments */
  payments?: Payment[]; balance?: number;   /* the payment lines; balance is sent by the server to a front desk seat that may not see approved */

// BLOCK: apps/web/src/app/core/models.ts | start=export interface Activity { | until=export interface Photo {
export interface Activity { id: string; jobId: string; enquiryId?: string; quoteId?: string; type: 'phase' | 'note' | 'promise' | 'approval' | 'pickup' | 'delivered' | 'new' | 'followup' | 'enquiry' | 'quote' | 'payment'; summary: string; by: string; createdAt: string; updatedAt: string; }

// BLOCK: apps/web/src/app/core/session.service.ts | start=  readonly owner = computed( | until=  readonly signedIn
  readonly owner = computed(() => this.role() === 'owner');
  readonly desk = computed(() => this.role() === 'desk');
  readonly collects = computed(() => this.role() === 'owner' || this.role() === 'desk');   /* records payments: the owner and the front desk */

// BLOCK: casts/demo-garage.json | start=  "users": [ | until=  "customerCode": "1234",
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
    },
    {
      "name": "Sachini",
      "role": "desk",
      "branch": "bora",
      "pin": "4444"
    }
  ],

// BLOCK: apps/web/src/app/core/data.service.ts | start=import { seed, phasesFor, followupsFor, SEED_VERSION } from './seed'; | until=import { quoteTotal, nextNumber } from './sales';
import { seed, phasesFor, followupsFor, SEED_VERSION } from './seed';
import { record, reverse, nextNo, Payment, PayMethod } from './payments';

// BLOCK: apps/web/src/app/core/data.service.ts | start=      estimate: input.estimate || 0, approved: 0, paid: 0, | until=    this.jobs.update(x => [j, ...x]);
      estimate: input.estimate || 0, approved: 0, status: 'open', notes: input.notes, enquiryId: input.enquiryId, quoteId: input.quoteId });

// BLOCK: apps/web/src/app/core/data.service.ts | start=  async setMoney(jobId | until=  async addNote(jobId
  async setMoney(jobId: string, patch: { estimate?: number; approved?: number }) {
    if (!this.session.owner()) throw new Error('Owner only');
    const clean: { estimate?: number; approved?: number } = {};
    if (patch.estimate !== undefined) clean.estimate = patch.estimate;
    if (patch.approved !== undefined) clean.approved = patch.approved;
    return this.patchJob(jobId, clean);
  }

  /* PAYMENTS (18 Oct 2026). Each payment is a line on the job; paid and balance are worked out by core/payments.ts, never typed. A correction is a reversal, owner only. */
  async recordPayment(jobId: string, input: { amount: number; method: PayMethod; at: string; note?: string }): Promise<{ job: Job; payment: Payment | null }> {
    if (!this.session.collects()) throw new Error('This seat cannot do that.');
    const j = this.job(jobId); if (!j) throw new Error('No such job');
    if (this.mode() === 'api') {
      const body = { amount: input.amount, method: input.method, at: input.at, note: (input.note || '').trim() };
      const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'payments', body, j.updatedAt);
      if (r === null) return { job: j, payment: null };
      this.jobs.update(x => x.map(y => y.id === jobId ? r : y));
      const oldIds = new Set((j.payments || []).map(p => p.id));
      const p = (r.payments || []).find(line => !oldIds.has(line.id) && !line.reverses) || null;
      if (p) {
        this.activities.update(x => [{ id: uid(), jobId, type: 'payment', summary: 'Payment recorded (' + p.no + ')', by: this.session.name(), createdAt: now(), updatedAt: now() } as Activity, ...x]);
      }
      return { job: r, payment: p };
    }
    const res = record(j, input, { by: this.session.name(), now: now(), today: localDay(), id: uid(), no: nextNo(this.jobs(), String(input.at)) });
    if (!res.ok) throw new Error(res.reason);
    const line = res.payments[res.payments.length - 1];
    const r = await this.patchJob(jobId, { payments: res.payments });
    await this.log(jobId, 'payment', 'Payment recorded (' + line.no + ')');
    return { job: r || j, payment: line };
  }

  async correctPayment(jobId: string, paymentId: string): Promise<Job | null> {
    if (!this.session.owner()) throw new Error('This seat cannot do that.');
    const j = this.job(jobId); if (!j) throw new Error('No such job');
    if (this.mode() === 'api') {
      const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'payments/' + paymentId + '/reverse', {}, j.updatedAt);
      if (r === null) return j;
      this.jobs.update(x => x.map(y => y.id === jobId ? r : y));
      this.activities.update(x => [{ id: uid(), jobId, type: 'payment', summary: 'Payment corrected', by: this.session.name(), createdAt: now(), updatedAt: now() } as Activity, ...x]);
      return r;
    }
    const res = reverse(j, paymentId, { by: this.session.name(), now: now(), today: localDay(), id: uid() });
    if (!res.ok) throw new Error(res.reason);
    const r = await this.patchJob(jobId, { payments: res.payments });
    await this.log(jobId, 'payment', 'Payment corrected');
    return r;
  }

// BLOCK: apps/web/src/app/core/data.service.ts | start=export function daysSince(iso?: string) | until=export function endOfToday()
export function daysSince(iso?: string) { if (!iso) return 0; return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }
/* today on this phone's calendar, YYYY-MM-DD: the day a payment is dated by default and the latest it may carry */
export function localDay(ms = Date.now()) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// BLOCK: apps/web/src/app/core/seed.ts | start=import { addWorkingMinutes } from './calendar'; | until=/* The demo floor.
import { addWorkingMinutes } from './calendar';
import { nextNo } from './payments';

// BLOCK: apps/web/src/app/core/seed.ts | start=export const SEED_VERSION = 6; | until=export function seed(cast: Cast)
/* 7: payments are lines on the job, 18 Oct 2026: every typed paid figure became one cash payment line */
export const SEED_VERSION = 7;

// BLOCK: apps/web/src/app/core/seed.ts | start=  const jobs: Job[] = [ | until=  /* the promise of every open car is what a workshop
  const jobs: Job[] = [
    /* the demo customer's Aqua: accident repair through insurance, mid paint, one approval waiting */
    job('j1', customers[0], 0, 'bora', 'accident', true, 6, 9 * 24, 20, 3 * 24, { insurer: 'Ceylinco', estimate: 185000, approved: 185000,
      approvals: [{ id: 'a1', title: 'Replace the front left headlamp', detail: 'The lamp housing is cracked inside. A new unit fits the colour match better than a repair.', amount: 24500, status: 'pending', askedAt: iso(5 * H) }],
      promiseHistory: [{ at: iso(2 * 24 * H), was: iso(-1 * 24 * H), now: iso(-3 * 24 * H), reason: 'The insurer took two extra days to approve the estimate', by: OWNER }],
      pickup: { wanted: true, address: 'Nugegoda', status: 'collected', driver: 'Sampath' } }),
    /* the demo customer's Wagon R: cut and polish delivered last month */
    job('j2', customers[0], 1, 'dehi', 'cutpolish', false, 7, 40 * 24, 38 * 24, -38 * 24, { status: 'delivered', deliveredAt: iso(38 * 24 * H), handoverBy: STAFF2, rating: 5, estimate: 18000, approved: 18000 }),
    /* Vezel: painting, overrun on paint preparation */
    job('j3', customers[1], 0, 'bora', 'painting', false, 2, 6 * 24, 70, -1 * 24, { estimate: 145000, approved: 145000 }),
    /* Leaf: alloy wheels, on time */
    job('j4', customers[2], 0, 'dehi', 'alloy', false, 3, 3 * 24, 6, 2 * 24, { estimate: 32000, approved: 32000 }),
    /* Premio: accident, no insurance, waiting on parts */
    job('j5', customers[3], 0, 'dehi', 'accident', false, 2, 4 * 24, 30, 6 * 24, { estimate: 96000, approved: 96000, pickup: { wanted: true, address: 'Mount Lavinia', status: 'collected', driver: 'Sampath' } }),
    /* Sorento: paint correction, ready for pickup */
    job('j6', customers[4], 0, 'bora', 'correction', false, 6, 5 * 24, 2, 0, { estimate: 45000, approved: 45000, pickup: { wanted: true, address: 'Kohuwala', status: 'booked', driver: 'Sampath', eta: 'Today 4 pm' } }),
    /* Fit: received this morning */
    job('j7', customers[5], 0, 'dehi', 'cutpolish', false, 0, 3, 3, 10, { estimate: 15000, approved: 0 }),
    /* delivered cars, so the follow-up list has something due, something coming and something done */
    job('j8', customers[6], 0, 'bora', 'painting', false, 7, 36 * 24, 31 * 24, -31 * 24, { status: 'delivered', deliveredAt: iso(31 * 24 * H), handoverBy: STAFF1, rating: 5, estimate: 88000, approved: 88000 }),
    job('j9', customers[7], 0, 'dehi', 'alloy', false, 7, 7 * 24, 4 * 24, -4 * 24, { status: 'delivered', deliveredAt: iso(4 * 24 * H), handoverBy: STAFF2, estimate: 26000, approved: 26000 }),
    job('j10', customers[8], 0, 'bora', 'cutpolish', false, 7, 93 * 24, 92 * 24, -92 * 24, { status: 'delivered', deliveredAt: iso(92 * 24 * H), handoverBy: STAFF1, rating: 4, estimate: 22000, approved: 22000 }),
    /* the floor picture: more cars so both branches read as a working day */
    job('j11', customers[9], 0, 'bora', 'cutpolish', false, 3, 8, 1.5, 6, { estimate: 16000, approved: 16000 }),
    job('j12', customers[10], 0, 'bora', 'correction', false, 2, 26, 22, 20, { estimate: 38000, approved: 38000 }),
    job('j13', customers[11], 0, 'dehi', 'painting', false, 3, 5 * 24, 30, 2 * 24, { estimate: 120000, approved: 120000 }),
    job('j14', customers[12], 0, 'bora', 'accident', false, 3, 3 * 24, 4, 4 * 24, { estimate: 74000, approved: 74000 })
  ];
  /* the money already taken on the floor, as payment lines: cash, dated a day after the car came in, numbered by the engine */
  const PAID: Record<string, number> = { j2: 18000, j3: 50000, j5: 30000, j6: 45000, j8: 88000, j9: 26000, j10: 22000, j13: 60000 };
  const DESK = cast.users.find(u => u.role === 'desk')?.name || OWNER;
  for (const j of jobs) {
    if (PAID[j.id] !== undefined) {
      const when = new Date(new Date(j.createdAt).getTime() + 24 * H).toISOString();
      const at = when.slice(0, 10);
      j.payments = [{ id: 'pay-' + j.id, no: nextNo(jobs, at), at, recordedAt: when, amount: PAID[j.id], method: 'cash', by: DESK }];
    }
  }
```