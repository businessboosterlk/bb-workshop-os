```ts
// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=import { DataService, niceDate, niceWhen, waLink } | until=import { IconComponent }
import { DataService, niceDate, niceWhen, waLink, localDay } from '../../core/data.service';
import { balanceOf, paidOf, lines, PaymentLine, PayMethod } from '../../core/payments';

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=type Sheet = | until=@Component({
type Sheet = '' | 'phase' | 'date' | 'ask' | 'pickup' | 'deliver' | 'money' | 'note' | 'edit' | 'pay' | 'fix';

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=          @if (session.owner()) { | until=        <div class="col">
          @if (session.collects()) {
            <div class="card money">
              <div class="sec-head"><h3>Money</h3>@if (session.owner()) { <button class="btn ghost sm" type="button" (click)="openSheet('money')"><bb-icon name="edit"/>Edit</button> }</div>
              <div class="m4" [class.one]="!session.owner()">
                @if (session.owner()) {
                  <div class="fig"><em>Estimate</em><strong class="num">{{ cast.money(j.estimate) || 'none' }}</strong></div>
                  <div class="fig"><em>Approved</em><strong class="num">{{ cast.money(j.approved) || 'none' }}</strong></div>
                  <div class="fig"><em>Paid</em><strong class="num">{{ cast.money(paid(j)) || 'none' }}</strong></div>
                }
                <div class="fig"><em>Balance</em><strong class="num">{{ cast.money(balance(j)) || 'none' }}</strong></div>
              </div>
              @if (payLines(j).length) {
                <div class="pays">
                  @for (l of payLines(j); track l.id) {
                    <div class="pay" [class.gone]="!!l.reversedBy">
                      <span class="pt"><strong class="no">{{ l.no }}</strong><span>{{ date(l.at) }} · {{ methodWord(l.method) }} · {{ l.by }}</span></span>
                      <span class="pa num">{{ cast.money(l.amount) }}</span>
                      @if (l.reversedBy) { <span class="tag">Corrected</span> } @else if (session.owner()) { <button class="btn ghost sm pay-fix" type="button" (click)="askFix(l)">Correct</button> }
                    </div>
                  }
                </div>
              }
              <button class="btn pay-add" type="button" (click)="openSheet('pay')"><bb-icon name="money"/>Record payment</button>
            </div>
          }
        </div>

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=      <bb-drawer title="Deliver and close" | until=      <bb-drawer title="Edit details"
      <bb-drawer title="Deliver and close" [open]="sheet() === 'deliver'" (closed)="closeSheet()">
        <p class="t-small">The customer's app shows Delivered, asks them to rate the work and keeps the job in their history. {{ session.name() }} is recorded as the person who handed over.</p>
        @if (session.collects() && balance(j) > 0) { <p class="due">{{ cast.money(balance(j)) }} is still unpaid on this job.</p> }
        <div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="deliver()"><bb-icon name="check"/>Delivered</button><button class="btn quiet" type="button" (click)="closeSheet()">Not yet</button></div>
      </bb-drawer>

      <bb-drawer title="Money" [open]="sheet() === 'money'" (closed)="closeSheet()">
        <p class="t-small">Paid is worked out from the payments on the job card. To change what was paid, record a payment or correct one.</p>
        <div class="form-grid"><div class="field"><label for="me">Estimate</label><input id="me" type="number" inputmode="numeric" [(ngModel)]="m.estimate"></div>
          <div class="field"><label for="ma">Approved</label><input id="ma" type="number" inputmode="numeric" [(ngModel)]="m.approved"></div></div>
        <div foot><button class="btn" type="button" [disabled]="busy()" (click)="saveMoney()">Save</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Record payment" [open]="sheet() === 'pay'" (closed)="closeSheet()">
        <p class="t-small">The receipt number is given when you save. The customer sees the payment on their phone.</p>
        <div class="form-grid">
          <div class="field span"><label for="pya">Amount, {{ cast.word('currency', 'LKR') }}</label><input id="pya" type="number" inputmode="numeric" [(ngModel)]="pay.amount"></div>
          <div class="field span"><label>How they paid</label><div class="chips">@for (mt of methods; track mt.k) { <button type="button" [class.on]="pay.method === mt.k" (click)="pay.method = mt.k">{{ mt.label }}</button> }</div></div>
          <div class="field"><label for="pyd">Date paid</label><input id="pyd" type="date" [attr.max]="today" [(ngModel)]="pay.at"></div>
          <div class="field"><label for="pyn">Note (optional)</label><input id="pyn" [(ngModel)]="pay.note" placeholder="Half now, the rest on delivery"></div>
        </div>
        <div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="savePay()">Record payment</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Correct a payment" [open]="sheet() === 'fix'" (closed)="closeSheet()">
        @if (fixing(); as fl) { <p class="fix-q">Correct {{ fl.no }}, {{ cast.money(fl.amount) }}? The payment stays in the history with its correction.</p> }
        <div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="saveFix()">Correct it</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    } @else { <div class="empty"><strong>No such car</strong></div> } | until=  styles: [`
    } @else { <div class="empty"><strong>No such car</strong></div> }
    @if (payToast(); as pt) { <div class="toast on" role="status">{{ pt.text }}@if (pt.undo) { <button type="button" (click)="undoPay()">Undo</button> }</div> }`,

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    .money{padding:16px} | until=    .tl,.act,.ba{padding:16px}
    .money{padding:16px}; .m4{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}; .m4.one{grid-template-columns:minmax(0,1fr)}
    .fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}; .fig strong{display:block;font-size:15px;margin-top:3px}; .m4.one .fig strong{font-size:20px}
    .pays{margin-top:12px;border-top:1px solid var(--line)}; .pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
    .pt{flex:1;min-width:0}; .pt strong{display:block;font-size:13px;font-weight:700}; .pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}; .pa{font-weight:700;font-size:14px;white-space:nowrap}
    .pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}; .tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}
    .pay-add{width:100%;margin-top:12px;min-height:44px}
    .due{margin-top:10px;font-size:12.5px;font-weight:600;color:var(--amber)}; .msg{font-size:13px;font-weight:600;color:var(--ink);line-height:1.4}; .fix-q{font-size:14px;line-height:1.5}

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  sheet = signal<Sheet>(''); busy = signal(false); | until=  on(k: FeatureKey)
  sheet = signal<Sheet>(''); busy = signal(false);
  pay: { amount: number | null; method: PayMethod; at: string; note: string } = { amount: null, method: 'cash', at: '', note: '' };
  today = localDay(); fixing = signal<PaymentLine | null>(null); payToast = signal<{ text: string; undo: string } | null>(null); private payT: ReturnType<typeof setTimeout> | undefined;
  readonly methods: { k: PayMethod; label: string }[] = [{ k: 'cash', label: 'Cash' }, { k: 'card', label: 'Card' }, { k: 'bank', label: 'Bank transfer' }, { k: 'cheque', label: 'Cheque' }];

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  openSheet(s: Sheet){ | until=  closeSheet(){
  openSheet(s: Sheet){ const j = this.job(); if (!j) return;
    this.err.set('');
    if (s === 'pickup') this.pk = { ...j.pickup, status: j.pickup.status === 'none' ? 'booked' : j.pickup.status };
    if (s === 'money') this.m = { estimate: j.estimate || 0, approved: j.approved || 0 };
    if (s === 'date') this.newDate = j.promisedAt.slice(0, 10);
    if (s === 'edit') { this.err.set(''); this.ex = { plate: j.plate, make: j.make, model: j.model, colour: j.colour || '', branch: j.branch, insurer: j.insurer || '', notes: j.notes || '', name: j.customerName, phone: j.customerPhone }; }
    if (s === 'pay') { this.today = localDay(); this.pay = { amount: Math.max(0, balanceOf(j)), method: 'cash', at: this.today, note: '' }; }
    this.sheet.set(s); }

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  async deliver(){ | until=  /* the car's own fields on the job;
  async deliver(){ if (this.busy()) return; this.busy.set(true); try { await this.data.deliver(this.id()); this.closeSheet(); this.data.toast('Delivered. The car moves to history.'); } catch (e: any) { this.err.set(e.message || 'Could not deliver the car'); } finally { this.busy.set(false); } }
  async saveMoney(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setMoney(this.id(), { estimate: +this.m.estimate || 0, approved: +this.m.approved || 0 }); this.closeSheet(); } catch (e: any) { this.data.toast(e.message || 'Could not save the money'); } finally { this.busy.set(false); } }
  /* PAYMENTS (18 Oct 2026): the owner and the front desk record a payment; only the owner corrects one, and the owner's toast carries Undo */
  async savePay(){ if (this.busy()) return; const j = this.job(); if (!j) return; this.err.set(''); this.busy.set(true);
    try { const r = await this.data.recordPayment(j.id, { amount: Number(this.pay.amount), method: this.pay.method, at: this.pay.at, note: this.pay.note }); this.closeSheet(); if (r.payment) this.showPay('Recorded ' + r.payment.no + ', ' + this.cast.money(r.payment.amount) + ' ' + this.methodWord(r.payment.method).toLowerCase(), this.session.owner() ? r.payment.id : ''); else this.data.toast('Saved on this phone. It reaches the workshop when there is signal.'); }
    catch (e: any) { this.err.set(e.message || 'Could not record the payment'); } finally { this.busy.set(false); } }
  askFix(l: PaymentLine){ this.openSheet('fix'); this.fixing.set(l); }
  async saveFix(){ if (this.busy()) return; const l = this.fixing(); if (!l) return; this.err.set(''); this.busy.set(true);
    try { await this.data.correctPayment(this.id(), l.id); this.closeSheet(); this.data.toast('Corrected ' + l.no + '. It stays in the history.'); }
    catch (e: any) { this.err.set(e.message || 'Could not correct the payment'); } finally { this.busy.set(false); } }
  async undoPay(){ const t = this.payToast(); if (!t || !t.undo) return; this.payToast.set(null);
    try { await this.data.correctPayment(this.id(), t.undo); this.data.toast('Undone. The payment stays in the history as corrected.'); }
    catch (e: any) { this.data.toast(e.message || 'Could not undo the payment'); } }
  showPay(text: string, undo: string){ this.data.toastMsg.set(null); this.payToast.set({ text, undo }); clearTimeout(this.payT); this.payT = setTimeout(() => this.payToast.set(null), 5000); }
  methodWord(m: string){ return this.methods.find(x => x.k === m)?.label || m; }
  paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); } payLines(j: Job){ return lines(j); }

// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  icon(t: string){ | until=  /* the forecast from the same calendar
  icon(t: string){ return ({ phase: 'check', note: 'note', promise: 'clock', approval: 'alert', pickup: 'truck', delivered: 'tick', new: 'car', enquiry: 'inbox', quote: 'quote', followup: 'phone', payment: 'money' } as any)[t] || 'note'; }
```