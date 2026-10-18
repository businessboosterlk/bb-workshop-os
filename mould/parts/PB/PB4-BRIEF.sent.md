PART PB4 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19 standalone component, TypeScript strict, signals, the new control flow (@if, @for). File: apps/web/src/app/pages/customer/job.component.ts, the page a customer opens on their phone for one car.

THE JOB. Payments are now lines on a job. The customer sees a Payments card: the approved total, what is paid, the balance, then each payment line with its receipt number. A customer NEVER sees the estimate (the first quote): the page must not read `estimate` anywhere. No card when nothing is approved and nothing is paid.

TYPES AND FUNCTIONS THIS PART READS (already written and checked; import them, never change them). From apps/web/src/app/core/payments.ts:
- `export interface Payment { id: string; no: string; at: string; recordedAt: string; amount: number; method: 'cash' | 'card' | 'bank' | 'cheque'; by: string; note?: string; reverses?: string; op?: string; }` (no: the receipt number 'R-YYYYMM-NNN'; at: the day the money moved, YYYY-MM-DD)
- `export interface PaymentLine extends Payment { reversedBy?: string; }` (reversedBy set means this payment has been corrected)
- `paidOf(job): number`, `balanceOf(job): number` (approved minus paid), `lines(job): PaymentLine[]` (the payments without the correction lines, newest first, each corrected one carrying reversedBy). Each takes a Job.
The Job fields the card reads: `approved?: number` (the total the customer approved) and `payments?: Payment[]`.
From the cast service (`cast`): `cast.money(n?: number): string` gives 'LKR 95,000' and an EMPTY string for 0; `cast.word('currency', 'LKR')`.
The page's own helpers: `lang.t(text)` (the Sinhala switch, returns the English when there is no translation) and `date(iso: string)` (a short date).
Global CSS that exists: `.card`, `.sec-head` (a heading row holding an h3), `.num` (tabular figures).

THE CURRENT FILE:
```ts
import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate, niceWhen } from '../../core/data.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';
import { RingComponent } from '../../ui/ring.component';
import { PhasesComponent } from '../../ui/phases.component';
import { CompareComponent } from '../../ui/compare.component';
import { Approval, Job } from '../../core/models';

/* One car. The cinematic moment of the app: the plate rises, the ring draws, and the
   timeline staggers in below it. Then the three things a customer can do: answer a
   question from the workshop, see the pickup, message the branch that has the car. */
@Component({
  selector: 'bb-car-job',
  standalone: true,
  imports: [RouterLink, IconComponent, RingComponent, PhasesComponent, CompareComponent],
  template: `
    @if (job(); as j) {
      <a class="back" routerLink="/car"><bb-icon name="back"/>{{ lang.t('Your cars') }}</a>
      <section class="hero">
        <div class="id"><span class="plate">{{ j.plate }}</span><h1>{{ j.make }} {{ j.model }}</h1><span class="br">{{ j.colour }}@if (j.colour) { · }{{ cast.service(j.service)?.label }}</span></div>
        <bb-ring [done]="data.doneCount(j)" [total]="j.phases.length" [size]="118"/>
      </section>
      <section class="now card" [class.ready]="j.status === 'ready'" [class.fin]="j.status === 'delivered'" [class.amber]="data.overrun(j) > 0">
        @if (j.status === 'delivered') { <bb-icon name="check"/><div><em>{{ lang.t('Delivered') }}</em><strong>{{ when(j.deliveredAt) }}</strong></div> }
        @else if (j.status === 'ready') { <bb-icon name="tick"/><div><em>{{ lang.t('Ready for pickup') }}</em><strong>{{ cast.branch(j.branch)?.name }}</strong></div> }
        @else { <bb-icon name="wrench"/><div><em>{{ lang.t('Right now') }}</em><strong>{{ data.phaseNow(j)?.label }}</strong></div> }
        @if (j.status !== 'delivered') { <div class="pr"><em>{{ lang.t('Promised') }}</em><strong>{{ date(j.promisedAt) }}</strong></div> }
      </section>
      @for (h of j.promiseHistory; track h.at) {
        <p class="moved"><bb-icon name="clock"/><span>{{ lang.t('Date moved') }} {{ date(h.was) }} {{ lang.t('to') }} {{ date(h.now) }}, {{ lang.t('because') }} {{ h.reason.toLowerCase() }}.</span></p>
      }
      @for (a of pending(); track a.id) {
        <section class="card ask">
          <div class="ask-h"><bb-icon name="alert"/><strong>{{ lang.t('Needs your approval') }}</strong></div>
          <h3>{{ a.title }}</h3>
          @if (a.detail) { <p>{{ a.detail }}</p> }
          @if (a.amount) { <div class="amt">{{ cast.money(a.amount) }}</div> }
          <div class="btns">
            <button class="btn" type="button" (click)="answer(a, true)">{{ lang.t('Approve') }}</button>
            <button class="btn ghost" type="button" (click)="answer(a, false)">{{ lang.t('Decline') }}</button>
          </div>
        </section>
      }
      @if (j.pickup.wanted) {
        <section class="card pk">
          <bb-icon name="truck"/>
          <div><strong>{{ lang.t('Pickup and drop') }}</strong><span>{{ j.pickup.address }} · {{ pickupWord(j.pickup.status) }}@if (j.pickup.eta) { · {{ j.pickup.eta }} }</span></div>
        </section>
      }
      @if (j.insurance) { <p class="ins"><bb-icon name="shield"/>{{ lang.t('Insurance claim') }}@if (j.insurer) { · {{ j.insurer }} }</p> }
      <section class="tl card">
        <div class="sec-head"><h3>{{ data.doneCount(j) }} {{ lang.t('of') }} {{ j.phases.length }} {{ lang.t('phases') }}</h3><span>{{ cast.branch(j.branch)?.name }}</span></div>
        <bb-phases [job]="j"/>
      </section>
      @if (pair(j); as pr) {
        <section class="card ba">
          <div class="sec-head"><h3>{{ lang.t('Before and after') }}</h3><span>{{ lang.t('Drag the handle') }}</span></div>
          <bb-compare [before]="pr.before.dataUrl" [after]="pr.after.dataUrl" [beforeLabel]="pr.beforeLabel" [afterLabel]="pr.afterLabel"/>
        </section>
      }
      @if (j.status === 'delivered') {
        <section class="card rate">
          <strong>{{ lang.t('Rate the work') }}</strong>
          <div class="stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="(j.rating || 0) >= s" (click)="rateIt(j.id, s)" [attr.aria-label]="s + ' stars'"><bb-icon name="star"/></button> }</div>
          @if (j.rating) { <span class="ty">{{ lang.t('Thank you') }}.</span> }
        </section>
      }
      <a class="btn wa full" [href]="cast.branchWa(j.branch, 'Hello, about my car ' + j.plate + ': ')" target="_blank" rel="noreferrer"><bb-icon name="wa"/>{{ lang.t('Message the workshop') }} · {{ cast.branch(j.branch)?.name }}</a>
    } @else {
      <div class="empty"><strong>Not your car</strong>This car is not on your number.</div>
    }`,
  styles: [`
    :host{display:block}
    .back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;font-weight:600;min-height:36px;--ico:16px;margin-left:-4px}
    .hero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 14px;animation:heroIn 700ms cubic-bezier(.45,0,.25,1) both}
    @keyframes heroIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    .plate{display:inline-block;font-size:26px;font-weight:800;letter-spacing:.05em;text-indent:.05em;padding:calc(5px + .05em) 12px calc(5px - .05em);border-radius:9px;background:var(--ink);color:var(--bg)}
    h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-top:10px}
    .br{display:block;font-size:12.5px;color:var(--muted);margin-top:3px}
    .now{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--brand-soft);border-color:transparent;--ico:22px;animation:heroIn 700ms 80ms cubic-bezier(.45,0,.25,1) both}
    .now bb-icon{color:var(--brand-dark);flex-shrink:0}
    .now em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}
    .now strong{display:block;font-size:16px;font-weight:700;letter-spacing:-.01em}
    .now .pr{margin-left:auto;text-align:right;flex-shrink:0}
    .now.ready{background:var(--green-soft)}.now.ready bb-icon{color:var(--green)}
    .now.fin{background:var(--surface-2)}.now.fin bb-icon{color:var(--green)}
    .now.amber{background:var(--amber-soft)}.now.amber bb-icon{color:var(--amber)}
    .moved{display:flex;gap:8px;align-items:flex-start;margin:10px 2px 0;font-size:12.5px;color:var(--muted);--ico:15px;line-height:1.45}.moved bb-icon{color:var(--amber);margin-top:2px;flex-shrink:0}
    .ask{margin-top:14px;padding:18px;border-color:var(--brand);animation:askIn 380ms 200ms cubic-bezier(.45,0,.25,1) both}
    @keyframes askIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
    .ask-h{display:flex;align-items:center;gap:8px;color:var(--brand-dark);font-size:12px;font-weight:700;--ico:16px}
    .ask h3{font-size:17px;font-weight:700;margin-top:10px;letter-spacing:-.01em}
    .ask p{font-size:13.5px;color:var(--ink-2);margin-top:6px;line-height:1.5}
    .amt{font-size:22px;font-weight:700;margin-top:10px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .btns{display:flex;gap:8px;margin-top:14px}.btns .btn{flex:1;min-height:46px}
    .pk{display:flex;align-items:center;gap:12px;padding:14px 16px;margin-top:14px;--ico:22px}.pk bb-icon{color:var(--brand-dark)}
    .pk strong{display:block;font-size:14px}.pk span{display:block;font-size:12.5px;color:var(--muted)}
    .ins{display:flex;align-items:center;gap:8px;margin:12px 2px 0;font-size:12.5px;color:var(--muted);--ico:15px}
    .tl{margin-top:14px;padding:18px}
    .ba{padding:16px;margin-top:14px}.ba bb-compare{margin-top:12px}
    .rate{margin-top:14px;padding:16px;display:grid;justify-items:center;gap:8px}
    .stars{display:flex;gap:4px}.stars button{width:44px;height:44px;border:0;background:none;color:var(--line-2);--ico:28px;transition:color 150ms var(--ease),transform 150ms var(--ease)}
    .stars button.on{color:var(--brand)}.stars button:active{transform:scale(.9)}.ty{font-size:12.5px;color:var(--muted)}
    .full{width:100%;min-height:50px;margin-top:14px;border-radius:14px}
    @media (prefers-reduced-motion:reduce){.hero,.now,.ask{animation:none}}`]
})
export class CustomerJobComponent {
  cast = inject(CastService); data = inject(DataService); lang = inject(LangService); private route = inject(ActivatedRoute);
  id = signal(this.route.snapshot.paramMap.get('id') || '');
  job = computed(() => { const j = this.data.job(this.id()); return this.data.canSee(j) ? j : null; });
  pending = computed(() => (this.job()?.approvals || []).filter(a => a.status === 'pending'));
  constructor(){ this.route.paramMap.subscribe(p => this.id.set(p.get('id') || '')); }
  date(iso: string){ return niceDate(iso); } when(iso?: string){ return niceWhen(iso); }
  pickupWord(s: string){ return s === 'booked' ? this.lang.t('Booked') : s === 'collected' ? this.lang.t('Collected') : s === 'returned' ? this.lang.t('Returned') : ''; }
  async answer(a: Approval, yes: boolean){ try { await this.data.answerApproval(this.id(), a.id, yes); this.data.toast(yes ? this.lang.t('Approve') + ': ' + a.title : this.lang.t('Decline') + ': ' + a.title); } catch (e: any) { this.data.toast(e.message || 'Could not send your answer'); } }
  async rateIt(jobId: string, stars: number){ try { await this.data.rate(jobId, stars); } catch (e: any) { this.data.toast(e.message || 'Could not save your rating'); } }
  pair(j: Job){ const ph = [...this.data.photosOf(j.id)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); if (ph.length < 2) return null;
    const label = (k: string) => j.phases.find(p => p.key === k)?.label || 'Photo';
    return { before: ph[0], after: ph[ph.length - 1], beforeLabel: label(ph[0].phaseKey), afterLabel: label(ph[ph.length - 1].phaseKey) }; }
}
```

WHAT TO WRITE. Return ONE ```ts code block holding the four parts below, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`.

Part 1 header: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=import { Approval, Job } from '../../core/models'; | until=/* One car.`
Three lines: that import exactly as it is, then `import { balanceOf, paidOf, lines, PaymentLine } from '../../core/payments';`, then one empty line.

Part 2 header: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=      <a class="btn wa full" | until=    } @else {`
The Payments card, then the WhatsApp line exactly as it is now. The card:
```
      @if (showPays(j)) {
        <section class="card pays">
          <div class="sec-head"><h3>{{ lang.t('Payments') }}</h3></div>
          <div class="m3">
            (three figures in this order)
          </div>
          (when payLines(j) has lines: <div class="pl"> with one <div class="pay" [class.gone]="!!l.reversedBy"> per line, track l.id)
        </section>
      }
```
Each figure is exactly `<div class="fig"><em>{{ lang.t('LABEL') }}</em><strong class="num">VALUE</strong></div>`: label `Total approved` with value `{{ amount(j.approved || 0) }}`; label `Paid` with value `{{ amount(paid(j)) }}`; label `Balance` with value `{{ balance(j) > 0 ? amount(balance(j)) : lang.t('Paid in full') }}`.
Each line holds, in this order: `<span class="pt"><strong class="no">{{ l.no }}</strong><span>{{ date(l.at) }} · {{ methodWord(l.method) }}</span></span>`, then `<span class="pa num">{{ cast.money(l.amount) }}</span>`, then `@if (l.reversedBy) { <span class="tag">{{ lang.t('Corrected') }}</span> }`.

Part 3 header: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .full{width:100% | until=    @media (prefers-reduced-motion`
The `.full` line exactly as it is now, then these rules, a few per line, four space indent, written back to back with NO character between one closing brace and the next selector:
`.pays{margin-top:14px;padding:16px}` `.m3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}` `.fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}` `.fig strong{display:block;font-size:15px;font-weight:700;margin-top:3px}` `.pl{margin-top:12px;border-top:1px solid var(--line)}` `.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}` `.pt{flex:1;min-width:0}` `.pt strong{display:block;font-size:13px;font-weight:700}` `.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}` `.pa{font-weight:700;font-size:14px;white-space:nowrap}` `.pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}` `.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}`

Part 4 header: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=  constructor(){ this.route.paramMap | until=  date(iso: string)`
The constructor line exactly as it is, then these methods of the class:
- `paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); } payLines(j: Job): PaymentLine[] { return lines(j); }`
- `showPays(j: Job){ return (j.approved || 0) > 0 || this.payLines(j).length > 0; }` with the comment above it `/* the Payments card (18 Oct 2026): the approved total, paid, the balance and each line. No card when nothing is approved and nothing paid */`
- `amount(n: number){ return this.cast.money(n) || this.cast.word('currency', 'LKR') + ' 0'; }`
- `methodWord(m: string){ return ({ cash: 'Cash', card: 'Card', bank: 'Bank transfer', cheque: 'Cheque' } as Record<string, string>)[m] || m; }`

TRAPS.
- The word estimate must not appear anywhere in the new lines, not even in a comment. Never show `by` (the seat name) to the customer.
- No new colour (no hex, no rgb), no new component, no em or en dash, no comma before and, or, but or nor in any word. British English.
