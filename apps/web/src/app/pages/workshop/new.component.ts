import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { quoteTotal } from '../../core/sales';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService } from '../../core/data.service';
import { normalise } from '../../core/session.service';
import { IconComponent } from '../../ui/icon.component';

/* Car in. The plate first because it is the key to everything, then who, what and
   where. The promised date starts as the sum of the service's usual hours, rounded up
   to the next working day, and the person at the desk moves it if they know better. */
@Component({
  selector: 'bb-ws-new',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <a class="back" routerLink="/workshop/floor"><bb-icon name="back"/>The floor</a>
    <div class="ph"><div><h2 class="t-h1">Car in</h2><p>{{ from() ? 'Booking in from ' + from() + '. ' : '' }}Takes a minute. The customer gets their login the moment you save.</p></div></div>
    <form class="card wrap" (submit)="save($event)">
      <div class="form-grid">
        <div class="field"><label for="pl">Number plate</label><input id="pl" [(ngModel)]="f.plate" name="plate" placeholder="CAB-4471" autocapitalize="characters" required (blur)="lookup()"></div>
        <div class="field"><label for="ph">Customer's phone</label><input id="ph" type="tel" inputmode="tel" [(ngModel)]="f.phone" name="phone" placeholder="07X XXX XXXX" required (blur)="lookup()"></div>
        <div class="field"><label for="nm">Customer's name</label><input id="nm" [(ngModel)]="f.name" name="name" placeholder="Dilshan Perera" required></div>
        <div class="field"><label for="mk">Make</label><input id="mk" [(ngModel)]="f.make" name="make" placeholder="Toyota" required></div>
        <div class="field"><label for="md">Model</label><input id="md" [(ngModel)]="f.model" name="model" placeholder="Aqua" required></div>
        <div class="field"><label for="cl">Colour</label><input id="cl" [(ngModel)]="f.colour" name="colour" placeholder="Pearl white"></div>
        <div class="field"><label for="br">Branch</label><select id="br" [(ngModel)]="f.branch" name="branch">@for (b of cast.cast()?.branches; track b.key) { <option [value]="b.key">{{ b.name }}</option> }</select></div>
        <div class="field"><label for="sv">Service</label><select id="sv" [(ngModel)]="f.service" name="service" (ngModelChange)="defaultDate()">@for (s of cast.cast()?.services; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select></div>
        @if (cast.service(f.service)?.insurance) {
          <div class="field"><label for="in">Insurance claim</label><select id="in" [(ngModel)]="f.insurance" name="insurance" (ngModelChange)="defaultDate()"><option [ngValue]="false">No</option><option [ngValue]="true">Yes</option></select></div>
          @if (f.insurance) { <div class="field"><label for="ir">Insurer</label><input id="ir" [(ngModel)]="f.insurer" name="insurer" placeholder="Ceylinco"></div> }
        }
        <div class="field"><label for="pk">Pickup and drop</label><select id="pk" [(ngModel)]="f.pickup" name="pickup"><option [ngValue]="false">Customer brings it</option><option [ngValue]="true">We collect and return</option></select></div>
        @if (f.pickup) { <div class="field"><label for="ad">Address</label><input id="ad" [(ngModel)]="f.address" name="address" placeholder="Nugegoda"></div> }
        <div class="field"><label for="dt">Promised date</label><input id="dt" type="date" [(ngModel)]="f.date" name="date" required><span class="hint">Usually {{ hours() }} h of work for this service</span></div>
        @if (session.owner()) { <div class="field"><label for="es">Estimate, {{ cast.word('currency', 'LKR') }}</label><input id="es" type="number" inputmode="numeric" [(ngModel)]="f.estimate" name="estimate" placeholder="0"></div> }
        <div class="field span"><label for="no">Notes</label><textarea id="no" [(ngModel)]="f.notes" name="notes" placeholder="Scratch on the rear bumper was there before, customer knows"></textarea></div>
      </div>
      @if (err()) { <p class="err">{{ err() }}</p> }
      <div class="foot"><button class="btn" type="submit" [disabled]="busy()"><bb-icon name="check"/>Save and start</button><a class="btn quiet" routerLink="/workshop/floor">Cancel</a></div>
    </form>`,
  styles: [`.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;font-weight:600;min-height:36px;--ico:16px;margin-left:-4px}
    .wrap{padding:20px;max-width:760px}.foot{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}.err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}`]
})
export class WorkshopNewComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private router = inject(Router);
  f: any = { plate: '', phone: '', name: '', make: '', model: '', colour: '', branch: this.session.branch() || this.cast.cast()?.branches[0]?.key || '', service: this.cast.cast()?.services[0]?.key || '', insurance: false, insurer: '', pickup: false, address: '', date: '', estimate: null, notes: '' };
  busy = signal(false); err = signal(''); private route = inject(ActivatedRoute); from = signal('');
  constructor(){
    this.defaultDate();
    /* booked from an enquiry or an accepted quote: everything already known is filled in */
    const qp = this.route.snapshot.queryParamMap; const qt = this.data.quotes().find(x => x.id === qp.get('quote'));
    const e = this.data.enquiries().find(x => x.id === (qp.get('enquiry') || qt?.enquiryId));
    if (e) Object.assign(this.f, { plate: e.plate || '', phone: e.phone, name: e.name, make: e.make || '', model: e.model || '', branch: e.branch, service: e.service, enquiryId: e.id, notes: e.note || '' });
    if (qt) { const [mk, ...md] = (qt.vehicle || '').split(' '); Object.assign(this.f, { plate: this.f.plate || qt.plate || '', phone: this.f.phone || qt.customerPhone, name: this.f.name || qt.customerName, make: this.f.make || mk || '', model: this.f.model || md.join(' '), branch: qt.branch, service: qt.service, quoteId: qt.id, estimate: quoteTotal(qt) }); }
    /* booked from a customer's sheet: their name, phone and, if they have exactly one car, that car */
    const cu = this.data.customers().find(x => x.id === qp.get('customer'));
    if (cu) { const v = cu.vehicles.length === 1 ? cu.vehicles[0] : null; Object.assign(this.f, { name: cu.name, phone: cu.phone, plate: v?.plate || '', make: v?.make || '', model: v?.model || '', colour: v?.colour || '' }); this.from.set('the customer file for ' + cu.name); }
    if (e || qt) { this.defaultDate(); this.from.set(qt ? 'Quote ' + qt.number + ' for ' + qt.customerName : 'Enquiry from ' + e!.name); }
  }
  hours(){ const s = this.cast.service(this.f.service); return s ? s.phases.filter(p => !p.insuranceOnly || this.f.insurance).reduce((a, p) => a + p.hours, 0) : 0; }
  defaultDate(){ const h = this.hours(); const d = new Date(Date.now() + Math.max(1, Math.ceil(h / 8)) * 86400000); if (d.getDay() === 0) d.setDate(d.getDate() + 1); this.f.date = d.toISOString().slice(0, 10); }
  /* a known phone fills the name; a known plate fills the car */
  lookup(){ const p = normalise(this.f.phone); const c = p ? this.data.customers().find(x => x.phone === p) : null; if (c) { this.f.name = this.f.name || c.name; const v = c.vehicles.find(x => x.plate === this.f.plate.toUpperCase().trim()) || (c.vehicles.length === 1 && !this.f.plate ? c.vehicles[0] : null); if (v) { this.f.plate = v.plate; this.f.make = this.f.make || v.make; this.f.model = this.f.model || v.model; this.f.colour = this.f.colour || v.colour || ''; } } }
  async save(e: Event){ e.preventDefault(); if (this.busy()) return; this.err.set('');
    const phone = normalise(this.f.phone); if (!phone) { this.err.set('The phone number needs to be a Sri Lankan mobile, 07X XXX XXXX. It is the customer\'s login.'); return; }
    if (!this.f.plate.trim() || !this.f.name.trim() || !this.f.make.trim() || !this.f.model.trim() || !this.f.date) { this.err.set('Plate, name, make, model and the promised date are needed.'); return; }
    this.busy.set(true);
    try { const j = await this.data.newJob({ plate: this.f.plate, make: this.f.make, model: this.f.model, colour: this.f.colour, customerName: this.f.name, customerPhone: phone, branch: this.f.branch, service: this.f.service, insurance: !!this.f.insurance && !!this.cast.service(this.f.service)?.insurance, insurer: this.f.insurer, pickup: !!this.f.pickup, address: this.f.address, promisedAt: new Date(this.f.date + 'T17:00:00').toISOString(), estimate: this.f.estimate ? +this.f.estimate : 0, notes: this.f.notes, enquiryId: this.f.enquiryId, quoteId: this.f.quoteId });
      this.data.toast(j.plate + ' is on the floor'); this.router.navigate(['/workshop/job', j.id]); }
    catch (er: any) { this.err.set(er.message || 'Could not save'); } finally { this.busy.set(false); } }
}
