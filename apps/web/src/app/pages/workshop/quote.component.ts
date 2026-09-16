import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService, normalise } from '../../core/session.service';
import { DataService, niceDate, waLink } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { Quote } from '../../core/models';
import { lineTotal, subTotal, quoteTotal } from '../../core/sales';

/* The quote. Left, the editor; right, the paper exactly as the customer receives it.
   Print gives an A4 PDF from the phone or the desk. WhatsApp sends the lines and the
   total as a message. Accepted opens Car in with everything already filled. */
@Component({
  selector: 'bb-ws-quote',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <a class="back no-print" routerLink="/workshop/quotes"><bb-icon name="back"/>Quotes</a>
    <div class="ph no-print"><div><h2 class="t-h1">{{ q.number || 'New quote' }}</h2><p>{{ q.id ? word(q.status!) : 'Not saved yet' }}@if (q.sentAt) { · sent {{ date(q.sentAt) }} }</p></div>
      <div class="ph-right">
        <button class="btn ghost sm" type="button" (click)="print()" [disabled]="!q.id"><bb-icon name="doc"/>Print or PDF</button>
        <button class="btn sm" type="button" (click)="save()"><bb-icon name="check"/>Save</button>
      </div></div>
    <div class="qgrid">
      <div class="card ed no-print">
        <div class="form-grid">
          <div class="field"><label for="qn">Customer</label><input id="qn" [(ngModel)]="q.customerName" placeholder="Shalini Perera"></div>
          <div class="field"><label for="qp">Phone</label><input id="qp" type="tel" inputmode="tel" [(ngModel)]="q.customerPhone" placeholder="07X XXX XXXX"></div>
          <div class="field"><label for="qpl">Plate</label><input id="qpl" [(ngModel)]="q.plate" autocapitalize="characters" placeholder="CAE-6671"></div>
          <div class="field"><label for="qv">Vehicle</label><input id="qv" [(ngModel)]="q.vehicle" placeholder="Suzuki Swift"></div>
          <div class="field"><label for="qs">Service</label><select id="qs" [(ngModel)]="q.service">@for (s of cast.cast()?.services; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select></div>
          <div class="field"><label for="qb">Branch</label><select id="qb" [(ngModel)]="q.branch">@for (b of cast.cast()?.branches; track b.key) { <option [value]="b.key">{{ b.name }}</option> }</select></div>
        </div>
        <div class="sec-head lines-h"><h3>Lines</h3><span>{{ cast.word('currency', 'LKR') }}</span></div>
        @for (l of q.lines; track $index; let i = $index) {
          <div class="ln">
            <input class="d" [(ngModel)]="l.desc" placeholder="Full respray, red" aria-label="What">
            <input class="n" type="number" inputmode="numeric" min="1" [(ngModel)]="l.qty" aria-label="Quantity">
            <input class="p" type="number" inputmode="numeric" min="0" [(ngModel)]="l.price" aria-label="Price each">
            <button class="x" type="button" (click)="q.lines!.splice(i, 1)" aria-label="Remove line"><bb-icon name="x"/></button>
          </div>
        }
        <button class="btn ghost sm addl" type="button" (click)="q.lines!.push({ desc: '', qty: 1, price: 0 })"><bb-icon name="plus"/>Add a line</button>
        <div class="form-grid tail">
          <div class="field"><label for="qd">Discount</label><input id="qd" type="number" inputmode="numeric" min="0" [(ngModel)]="q.discount"></div>
          <div class="field"><label for="qu">Valid until</label><input id="qu" type="date" [(ngModel)]="valid"></div>
          <div class="field span"><label for="qo">Note on the quote (optional)</label><textarea id="qo" [(ngModel)]="q.note" placeholder="Colour matched to the factory code on the door frame."></textarea></div>
        </div>
        @if (err()) { <p class="err">{{ err() }}</p> }
        @if (q.id) {
          <div class="flow">
            @if (q.status === 'draft' || q.status === 'sent') {
              <a class="btn wa" [href]="wa()" target="_blank" rel="noreferrer" (click)="sent()"><bb-icon name="wa"/>Send on WhatsApp</a>
              <button class="btn" type="button" (click)="accept()"><bb-icon name="check"/>Accepted, book the car in</button>
              <button class="btn ghost" type="button" (click)="decline()">Declined</button>
            } @else if (q.status === 'accepted' && q.jobId) { <a class="btn ghost" [routerLink]="['/workshop/job', q.jobId]"><bb-icon name="car"/>Open the car</a> }
            @else if (q.status === 'accepted') { <a class="btn" [routerLink]="['/workshop/new']" [queryParams]="{ quote: q.id }"><bb-icon name="car"/>Book the car in</a> }
          </div>
        }
      </div>

      <div class="paper" id="paper">
        <header class="pp-h">
          <img [src]="cast.cast()?.brand?.logo" alt="" width="750" height="555">
          <div class="pp-co"><strong>{{ cast.cast()?.name }}</strong>
            @for (b of cast.cast()?.branches; track b.key) { <span>{{ b.name }}: {{ b.address }}@if (b.wa) { · {{ phone(b.wa) }} }</span> }</div>
        </header>
        <div class="pp-t"><div><em>Quote</em><strong>{{ q.number || 'Draft' }}</strong></div><div class="r"><em>Date</em><strong>{{ full(q.createdAt || nowIso) }}</strong><em>Valid until</em><strong>{{ full(validIso()) }}</strong></div></div>
        <div class="pp-to"><em>For</em><strong>{{ q.customerName || 'Customer name' }}</strong><span>{{ q.customerPhone }}@if (q.plate) { · {{ q.plate }} }@if (q.vehicle) { · {{ q.vehicle }} }</span><span>{{ cast.service(q.service!)?.label }} at {{ cast.branch(q.branch!)?.name }}</span></div>
        <table class="pp-tb">
          <thead><tr><th>Work</th><th class="n">Qty</th><th class="n">Each</th><th class="n">Amount</th></tr></thead>
          <tbody>@for (l of q.lines; track $index) { @if (l.desc) { <tr><td>{{ l.desc }}</td><td class="n">{{ l.qty }}</td><td class="n">{{ num(l.price) }}</td><td class="n">{{ num(line(l)) }}</td></tr> } }</tbody>
        </table>
        <div class="pp-sum">
          <div><span>Subtotal</span><span>{{ num(sub()) }}</span></div>
          @if (+(q.discount || 0) > 0) { <div><span>Discount</span><span>{{ num(+(q.discount || 0)) }}</span></div> }
          <div class="tot"><span>Total, {{ cast.word('currency', 'LKR') }}</span><span>{{ num(total()) }}</span></div>
        </div>
        @if (q.note) { <p class="pp-note">{{ q.note }}</p> }
        <ul class="pp-terms">@for (t of cast.cast()?.quote?.terms; track t) { <li>{{ t }}</li> }</ul>
        <footer class="pp-f">{{ cast.cast()?.name }} · {{ cast.cast()?.tagline }}</footer>
      </div>
    </div>`,
  styles: [`
    .back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;font-weight:600;min-height:36px;--ico:16px;margin-left:-4px}
    .qgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
    @media (max-width:1100px){.qgrid{grid-template-columns:1fr}}
    .ed{padding:18px}.lines-h{margin-top:18px}
    .ln{display:grid;grid-template-columns:1fr 64px 110px 36px;gap:6px;margin-top:6px;align-items:center}
    .ln input{min-width:0;min-height:40px;padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);font-size:14px}
    .ln input:focus{outline:none;border-color:var(--brand)}.ln .n,.ln .p{text-align:right}
    /* phone: the description gets the whole width, quantity and price sit under it */
    @media (max-width:640px){.ln{grid-template-columns:72px minmax(0,1fr) 36px;padding-bottom:8px;border-bottom:1px solid var(--line)}.ln .d{grid-column:1/-1}}
    .addl{margin-top:10px}.tail{margin-top:16px}
    .err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}
    .flow{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.flow .btn{flex:1 1 auto}`]
})
export class WorkshopQuoteComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  q: Partial<Quote> = {}; valid = ''; err = signal(''); nowIso = new Date().toISOString();
  constructor(){
    this.route.paramMap.subscribe(p => {
      const id = p.get('id'); const found = this.data.quotes().find(x => x.id === id);
      if (found) { this.q = structuredClone(found); }
      else {
        const c = this.cast.cast(); const e = this.data.enquiries().find(x => x.id === this.route.snapshot.queryParamMap.get('enquiry'));
        this.q = { customerName: e?.name || '', customerPhone: e?.phone || '', plate: e?.plate || '', vehicle: e ? `${e.make || ''} ${e.model || ''}`.trim() : '', service: e?.service || c?.services[0]?.key, branch: e?.branch || c?.branches[0]?.key,
          enquiryId: e?.id, lines: [{ desc: e ? `${this.cast.service(e.service)?.label}, ${`${e.make || ''} ${e.model || ''}`.trim()}`.replace(/, $/, '') : '', qty: 1, price: 0 }], discount: 0 };
      }
      this.valid = this.validIso().slice(0, 10);
    });
  }
  validIso(){ return this.valid ? new Date(this.valid + 'T17:00:00').toISOString() : (this.q.validUntil || new Date(Date.now() + (this.cast.cast()?.quote?.validDays || 14) * 86400000).toISOString()); }
  line(l: any){ return lineTotal(l); } sub(){ return subTotal(this.q as Quote); } total(){ return quoteTotal(this.q as Quote); }
  num(n: number){ return Math.round(n || 0).toLocaleString('en-GB'); }
  date(iso?: string){ return niceDate(iso); }
  /* a document the customer keeps carries the year */
  full(iso?: string){ return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  phone(wa: string){ return '0' + wa.slice(2, 4) + ' ' + wa.slice(4, 7) + ' ' + wa.slice(7); }
  word(s: string){ return ({ draft: 'Draft', sent: 'Sent to the customer', accepted: 'Accepted', declined: 'Declined' } as any)[s]; }
  async save(){ this.err.set(''); const phone = normalise(this.q.customerPhone || ''); if (!phone) { this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX.'); return null; }
    try { const r = await this.data.saveQuote({ ...this.q, customerPhone: phone, validUntil: this.validIso() }); this.q = structuredClone(r); this.data.toast('Quote ' + r.number + ' saved');
      if (this.route.snapshot.paramMap.get('id') === 'new') this.router.navigate(['/workshop/quote', r.id], { replaceUrl: true }); return r; }
    catch (e: any) { this.err.set(e.message); return null; } }
  wa(){ const cur = this.cast.word('currency', 'LKR'); const lines = (this.q.lines || []).filter(l => l.desc).map(l => `• ${l.desc}${l.qty > 1 ? ' x' + l.qty : ''}: ${cur} ${this.num(lineTotal(l))}`).join('\n');
    return waLink(this.q.customerPhone, `Hello ${(this.q.customerName || '').split(' ')[0]}, here is your quote ${this.q.number} from ${this.cast.cast()?.name}${this.q.plate ? ' for ' + this.q.plate : ''}.\n\n${lines}${+(this.q.discount || 0) ? `\nDiscount: ${cur} ${this.num(+(this.q.discount || 0))}` : ''}\nTotal: ${cur} ${this.num(this.total())}\n\nValid until ${this.full(this.validIso())}. Reply here to book a day.`); }
  async sent(){ if (this.q.id && this.q.status === 'draft') { const r = await this.data.setQuoteStatus(this.q.id, 'sent'); if (r) this.q = structuredClone(r); } }
  async accept(){ if (!this.q.id) return; const saved = await this.save(); if (!saved) return; await this.data.setQuoteStatus(saved.id, 'accepted'); this.router.navigate(['/workshop/new'], { queryParams: { quote: saved.id } }); }
  async decline(){ if (!this.q.id) return; const r = await this.data.setQuoteStatus(this.q.id, 'declined'); if (r) this.q = structuredClone(r); this.data.toast('Quote declined. The enquiry is marked lost.'); }
  print(){ window.print(); }
}
