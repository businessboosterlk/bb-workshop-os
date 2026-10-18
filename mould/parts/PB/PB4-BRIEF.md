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
{{file:apps/web/src/app/pages/customer/job.component.ts}}
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
