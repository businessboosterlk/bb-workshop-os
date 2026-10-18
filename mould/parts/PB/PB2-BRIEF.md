PART PB2 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19 standalone component, TypeScript strict, signals, the new control flow (@if, @for). File: apps/web/src/app/pages/workshop/job.component.ts, the staff job card.

THE JOB. Payments are now lines on a job; paid and balance are worked out from the lines by the engine, never typed. The job card shows money by seat:
- OWNER (`session.owner()`): Estimate, Approved, Paid, Balance, the payment lines, Record payment, and Correct on each live line.
- FRONT DESK (`session.desk()`): Balance, the payment lines and Record payment. Nothing else: no estimate, no approved, no paid figure, no Correct.
- PLAIN STAFF: no money block at all (no money word, no figure, no line).
`session.collects()` is true for the owner and the desk. Also: the Deliver and close sheet shows a refused save in its own message slot inside the sheet, not in a toast.

TYPES AND FUNCTIONS THIS PART READS (already written and checked; import them, never change them).
From apps/web/src/app/core/payments.ts:
- `export type PayMethod = 'cash' | 'card' | 'bank' | 'cheque';`
- `export interface Payment { id: string; no: string; at: string; recordedAt: string; amount: number; method: PayMethod; by: string; note?: string; reverses?: string; op?: string; }` (no: the receipt number 'R-YYYYMM-NNN', '' on a correction; at: the day the money moved, YYYY-MM-DD; by: the seat name)
- `export interface PaymentLine extends Payment { reversedBy?: string; }` (reversedBy set means this payment has been corrected)
- `paidOf(job): number`, `balanceOf(job): number` (approved minus paid, or the server's balance for a desk seat), `lines(job): PaymentLine[]` (the payments without the correction lines, newest first, each corrected one carrying reversedBy). Each takes a Job.
From apps/web/src/app/core/data.service.ts (DataService is injected as `data`):
- `recordPayment(jobId: string, input: { amount: number; method: PayMethod; at: string; note?: string }): Promise<{ job: Job; payment: Payment | null }>` throws an Error whose message is the reason to show (for example 'That is more than the 95000 still owed on this car', 'The date cannot be in the future', 'This seat cannot do that.'). payment is null when the write is waiting for signal.
- `correctPayment(jobId: string, paymentId: string): Promise<Job | null>` throws the same way. Owner only.
- `setMoney(jobId: string, patch: { estimate?: number; approved?: number })`: it no longer takes paid.
- `toast(text: string)` and `toastMsg` (a signal holding the app's one shared toast, set it to null to clear it).
- exported function `localDay(): string`, today on this phone as YYYY-MM-DD.
From the cast service (`cast`): `cast.money(n?: number): string` gives 'LKR 95,000' (empty string for 0 or nothing); `cast.word('currency', 'LKR')`.
From the session (`session`): `owner()`, `desk()`, `collects()`, `name()`.
Global CSS that already exists (use it, never redefine it): `.card`, `.sec-head`, `.btn`, `.btn.ghost`, `.btn.sm`, `.btn.quiet`, `.chips` (a row of pill buttons, `button.on` is the chosen one), `.field`, `.form-grid`, `.span`, `.t-small`, `.num` (tabular figures), `.toast` with `.toast.on` (the fixed dark message at the bottom; a `button` inside it is its action). A sheet is `<bb-drawer title=".." [open]=".." (closed)="closeSheet()">` with body content and one action bar `<div foot>`: the primary `.btn` full width first, the quiet `.btn.quiet` Cancel last.

THE CURRENT FILE:
```ts
{{file:apps/web/src/app/pages/workshop/job.component.ts}}
```

WHAT TO WRITE. Return ONE ```ts code block holding the parts below, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`. Write only the replacement lines, at the file's indentation.

Part 1 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=import { DataService, niceDate, niceWhen, waLink } | until=import { IconComponent }`
Two lines: the data service import with `localDay` added to its list, then `import { balanceOf, paidOf, lines, PaymentLine, PayMethod } from '../../core/payments';`

Part 2 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=type Sheet = | until=@Component({`
The Sheet type with `| 'pay' | 'fix'` added at the end.

Part 3 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=          @if (session.owner()) { | until=        <div class="col">`
Replaces the owner money card AND the `        </div>` line that closes the first column (write that closing line last). The new card, for `session.collects()`:
```
          @if (session.collects()) {
            <div class="card money">
              <div class="sec-head"><h3>Money</h3>@if (session.owner()) { <button class="btn ghost sm" type="button" (click)="openSheet('money')"><bb-icon name="edit"/>Edit</button> }</div>
              <div class="m4" [class.one]="!session.owner()">
                (owner only, in this order: three figures Estimate from j.estimate, Approved from j.approved, Paid from paid(j))
                (everyone with the card: the figure Balance from balance(j))
              </div>
              (when payLines(j) has lines: <div class="pays"> with one <div class="pay" [class.gone]="!!l.reversedBy"> per line, track l.id)
              <button class="btn pay-add" type="button" (click)="openSheet('pay')"><bb-icon name="money"/>Record payment</button>
            </div>
          }
        </div>
```
Each figure is exactly `<div class="fig"><em>LABEL</em><strong class="num">{{ cast.money(VALUE) || 'none' }}</strong></div>`.
Each line holds, in this order: `<span class="pt"><strong class="no">{{ l.no }}</strong><span>{{ date(l.at) }} · {{ methodWord(l.method) }} · {{ l.by }}</span></span>`, then `<span class="pa num">{{ cast.money(l.amount) }}</span>`, then `@if (l.reversedBy) { <span class="tag">Corrected</span> } @else if (session.owner()) { <button class="btn ghost sm pay-fix" type="button" (click)="askFix(l)">Correct</button> }`.

Part 4 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=      <bb-drawer title="Deliver and close" | until=      <bb-drawer title="Edit details"`
Four sheets, each followed by one empty line:
(a) Deliver and close: the same first paragraph as now; the unpaid line becomes `@if (session.collects() && balance(j) > 0) { <p class="due">{{ cast.money(balance(j)) }} is still unpaid on this job.</p> }`; the foot is `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }` then the two buttons exactly as now `</div>`.
(b) Money: first `<p class="t-small">Paid is worked out from the payments on the job card. To change what was paid, record a payment or correct one.</p>`, then the form grid with ONLY the Estimate and Approved fields as now (the Paid so far field is gone), then the foot exactly as now.
(c) Record payment: `<bb-drawer title="Record payment" [open]="sheet() === 'pay'" (closed)="closeSheet()">`, body: `<p class="t-small">The receipt number is given when you save. The customer sees the payment on their phone.</p>` then `<div class="form-grid">` holding: `<div class="field span"><label for="pya">Amount, {{ cast.word('currency', 'LKR') }}</label><input id="pya" type="number" inputmode="numeric" [(ngModel)]="pay.amount"></div>`; `<div class="field span"><label>How they paid</label><div class="chips">@for (mt of methods; track mt.k) { <button type="button" [class.on]="pay.method === mt.k" (click)="pay.method = mt.k">{{ mt.label }}</button> }</div></div>`; `<div class="field"><label for="pyd">Date paid</label><input id="pyd" type="date" [attr.max]="today" [(ngModel)]="pay.at"></div>`; `<div class="field"><label for="pyn">Note (optional)</label><input id="pyn" [(ngModel)]="pay.note" placeholder="Half now, the rest on delivery"></div>`; then `</div>` and the foot `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="savePay()">Record payment</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>`.
(d) Correct a payment: `<bb-drawer title="Correct a payment" [open]="sheet() === 'fix'" (closed)="closeSheet()">`, body `@if (fixing(); as fl) { <p class="fix-q">Correct {{ fl.no }}, {{ cast.money(fl.amount) }}? The payment stays in the history with its correction.</p> }`, foot `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="saveFix()">Correct it</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>`.

Part 5 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    } @else { <div class="empty"><strong>No such car</strong></div> } | until=  styles: [`
Two lines: `    } @else { <div class="empty"><strong>No such car</strong></div> }` (no backtick now) then `    @if (payToast(); as pt) { <div class="toast on" role="status">{{ pt.text }}@if (pt.undo) { <button type="button" (click)="undoPay()">Undo</button> }</div> }` followed by the backtick and comma that closed the template.

Part 6 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    .money{padding:16px} | until=    .tl,.act,.ba{padding:16px}`
Replaces the `.money` line and the `.due` line. CSS rules, a few per line, four space indent:
- `.money{padding:16px}`; `.m4{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}`; `.m4.one{grid-template-columns:minmax(0,1fr)}`
- `.fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}`; `.fig strong{display:block;font-size:15px;margin-top:3px}`; `.m4.one .fig strong{font-size:20px}`
- `.pays{margin-top:12px;border-top:1px solid var(--line)}`; `.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}`
- `.pt{flex:1;min-width:0}`; `.pt strong{display:block;font-size:13px;font-weight:700}`; `.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}`; `.pa{font-weight:700;font-size:14px;white-space:nowrap}`
- `.pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}`; `.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}`
- `.pay-add{width:100%;margin-top:12px;min-height:44px}`
- the `.due` rule exactly as now; `.msg{font-size:13px;font-weight:600;color:var(--ink);line-height:1.4}`; `.fix-q{font-size:14px;line-height:1.5}`

Part 7 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  sheet = signal<Sheet>(''); busy = signal(false); | until=  on(k: FeatureKey)`
The three lines as now, then:
- `pay: { amount: number | null; method: PayMethod; at: string; note: string } = { amount: null, method: 'cash', at: '', note: '' };`
- `today = localDay(); fixing = signal<PaymentLine | null>(null); payToast = signal<{ text: string; undo: string } | null>(null); private payT: ReturnType<typeof setTimeout> | undefined;`
- `readonly methods: { k: PayMethod; label: string }[] = [{ k: 'cash', label: 'Cash' }, { k: 'card', label: 'Card' }, { k: 'bank', label: 'Bank transfer' }, { k: 'cheque', label: 'Cheque' }];`

Part 8 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  openSheet(s: Sheet){ | until=  closeSheet(){`
The openSheet method as now with three changes: its first statement after the job guard is `this.err.set('');` (every sheet opens with an empty message slot; the edit line keeps its own reset too); the money line sets only `{ estimate: j.estimate || 0, approved: j.approved || 0 }`; a new line `if (s === 'pay') { this.today = localDay(); this.pay = { amount: Math.max(0, balanceOf(j)), method: 'cash', at: this.today, note: '' }; }`.

Part 9 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  async deliver(){ | until=  /* the car's own fields on the job;`
Replaces deliver and saveMoney, then adds the new methods. Every saving method keeps the house shape: `if (this.busy()) return;` then `this.busy.set(true);` then `try { ... } catch (e: any) { ... e.message ... } finally { this.busy.set(false); }`.
- `deliver()`: as now, but the catch is `this.err.set(e.message || 'Could not deliver the car');` (the words stay in the sheet, no toast).
- `saveMoney()`: as now with only estimate and approved sent.
- `savePay()`: guard busy, `const j = this.job(); if (!j) return;`, `this.err.set('');`, busy true; in the try: `const r = await this.data.recordPayment(j.id, { amount: Number(this.pay.amount), method: this.pay.method, at: this.pay.at, note: this.pay.note });` then `this.closeSheet();` then if `r.payment` call `this.showPay('Recorded ' + r.payment.no + ', ' + this.cast.money(r.payment.amount) + ' ' + this.methodWord(r.payment.method).toLowerCase(), this.session.owner() ? r.payment.id : '')`, else `this.data.toast('Saved on this phone. It reaches the workshop when there is signal.')`. Catch: `this.err.set(e.message || 'Could not record the payment');`.
- `askFix(l: PaymentLine)`: `this.openSheet('fix'); this.fixing.set(l);`
- `saveFix()`: guard busy, `const l = this.fixing(); if (!l) return;`, `this.err.set('');`, busy true; try: `await this.data.correctPayment(this.id(), l.id); this.closeSheet(); this.data.toast('Corrected ' + l.no + '. It stays in the history.');` catch: `this.err.set(e.message || 'Could not correct the payment');`.
- `undoPay()`: `const t = this.payToast(); if (!t || !t.undo) return; this.payToast.set(null);` then try: `await this.data.correctPayment(this.id(), t.undo); this.data.toast('Undone. The payment stays in the history as corrected.');` catch: `this.data.toast(e.message || 'Could not undo the payment');`.
- `showPay(text: string, undo: string)`: `this.data.toastMsg.set(null); this.payToast.set({ text, undo }); clearTimeout(this.payT); this.payT = setTimeout(() => this.payToast.set(null), 5000);`
- `methodWord(m: string){ return this.methods.find(x => x.k === m)?.label || m; }`
- `paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); } payLines(j: Job){ return lines(j); }`
Then one comment line above savePay: `/* PAYMENTS (18 Oct 2026): the owner and the front desk record a payment; only the owner corrects one, and the owner's toast carries Undo */`

Part 10 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  icon(t: string){ | until=  /* the forecast from the same calendar`
The icon line as now with `payment: 'money'` added to the map.

TRAPS.
- Plain staff must see no money: every new money element sits inside `@if (session.collects())`; the Estimate, Approved and Paid figures and every Correct button sit inside `session.owner()`.
- Never read `j.paid` anywhere. The words in the sheets and toasts exactly as written here.
- No new colour (no hex, no rgb), no new component, no em or en dash, no comma before and, or, but or nor in any word a person reads or any comment. British English.
