```ts
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=import { Approval, Job } from '../../core/models'; | until=/* One car.
import { Approval, Job } from '../../core/models';
import { balanceOf, paidOf, lines, PaymentLine } from '../../core/payments';

// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=      <a class="btn wa full" | until=    } @else {
      @if (showPays(j)) {
        <section class="card pays">
          <div class="sec-head"><h3>{{ lang.t('Payments') }}</h3></div>
          <div class="m3">
            <div class="fig"><em>{{ lang.t('Total approved') }}</em><strong class="num">{{ amount(j.approved || 0) }}</strong></div>
            <div class="fig"><em>{{ lang.t('Paid') }}</em><strong class="num">{{ amount(paid(j)) }}</strong></div>
            <div class="fig"><em>{{ lang.t('Balance') }}</em><strong class="num">{{ balance(j) > 0 ? amount(balance(j)) : lang.t('Paid in full') }}</strong></div>
          </div>
          @if (payLines(j).length > 0) {
            <div class="pl">
              @for (l of payLines(j); track l.id) {
                <div class="pay" [class.gone]="!!l.reversedBy">
                  <span class="pt"><strong class="no">{{ l.no }}</strong><span>{{ date(l.at) }} · {{ methodWord(l.method) }}</span></span>
                  <span class="pa num">{{ cast.money(l.amount) }}</span>
                  @if (l.reversedBy) { <span class="tag">{{ lang.t('Corrected') }}</span> }
                </div>
              }
            </div>
          }
        </section>
      }
      <a class="btn wa full" [href]="cast.branchWa(j.branch, 'Hello, about my car ' + j.plate + ': ')" target="_blank" rel="noreferrer"><bb-icon name="wa"/>{{ lang.t('Message the workshop') }} · {{ cast.branch(j.branch)?.name }}</a>
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .full{width:100% | until=    @media (prefers-reduced-motion
    .full{width:100%;min-height:50px;margin-top:14px;border-radius:14px}
    .pays{margin-top:14px;padding:16px}.m3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}.fig strong{display:block;font-size:15px;font-weight:700;margin-top:3px}.pl{margin-top:12px;border-top:1px solid var(--line)}.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.pt{flex:1;min-width:0}.pt strong{display:block;font-size:13px;font-weight:700}.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}.pa{font-weight:700;font-size:14px;white-space:nowrap}.pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=  constructor(){ this.route.paramMap | until=  date(iso: string)
  constructor(){ this.route.paramMap.subscribe(p => this.id.set(p.get('id') || '')); }
  paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); } payLines(j: Job): PaymentLine[] { return lines(j); }
  /* the Payments card (18 Oct 2026): the approved total, paid, the balance and each line. No card when nothing is approved and nothing paid */
  showPays(j: Job){ return (j.approved || 0) > 0 || this.payLines(j).length > 0; }
  amount(n: number){ return this.cast.money(n) || this.cast.word('currency', 'LKR') + ' 0'; }
  methodWord(m: string){ return ({ cash: 'Cash', card: 'Card', bank: 'Bank transfer', cheque: 'Cheque' } as Record<string, string>)[m] || m; }
```