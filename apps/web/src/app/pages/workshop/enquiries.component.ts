import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService, normalise } from '../../core/session.service';
import { DataService, niceWhen, waLink } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { Enquiry } from '../../core/models';

/* The front of the sales line. Every call, WhatsApp and walk-in becomes a card that
   moves New, Quoted, Booked or Lost. A quote is one tap for the owner; booking the car
   in opens Car in already filled. Nothing here carries a price. */
@Component({
  selector: 'bb-ws-enquiries',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, DrawerComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Enquiries</h2><p>{{ data.newEnquiries().length }} new · {{ count('quoted') }} quoted · {{ bookedMonth() }} booked this month</p></div>
      <div class="ph-right"><button class="btn sm" type="button" (click)="openAdd()"><bb-icon name="plus"/>New enquiry</button></div></div>
    <div class="chips bar">
      @for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}<b>{{ f.k === 'open' ? data.openEnquiries().length : count(f.k) }}</b></button> }
    </div>
    <div class="grid">
      @for (e of list(); track e.id) {
        <div class="card eq" [class]="'card eq ' + e.status">
          <div class="top">
            <div class="who"><strong>{{ e.name }}</strong><span>{{ e.phone }}@if (e.plate) { · {{ e.plate }} }@if (e.make) { · {{ e.make }} {{ e.model }} }</span></div>
            <span class="pill" [class]="'pill ' + pill(e.status)">{{ word(e.status) }}</span>
          </div>
          <div class="svc"><bb-icon name="wrench"/>{{ cast.service(e.service)?.label }} · {{ cast.branch(e.branch)?.name }}</div>
          @if (e.note) { <p class="note">{{ e.note }}</p> }
          @if (e.status === 'lost' && e.lostReason) { <p class="why">Lost: {{ e.lostReason }}</p> }
          <div class="meta">{{ e.source }} · {{ when(e.createdAt) }}@if (e.by) { · {{ e.by }} }</div>
          <div class="acts">
            <a class="btn wa sm icon" [href]="wa(e)" target="_blank" rel="noreferrer" aria-label="WhatsApp"><bb-icon name="wa"/></a>
            @if (e.status === 'new' || e.status === 'quoted') {
              @if (session.owner()) {
                @if (e.quoteId) { <a class="btn ghost sm" [routerLink]="['/workshop/quote', e.quoteId]"><bb-icon name="quote"/>Quote</a> }
                @else { <a class="btn ghost sm" [routerLink]="['/workshop/quote', 'new']" [queryParams]="{ enquiry: e.id }"><bb-icon name="quote"/>Make a quote</a> }
              }
              <a class="btn sm" [routerLink]="['/workshop/new']" [queryParams]="{ enquiry: e.id }"><bb-icon name="car"/>Book in</a>
              <button class="btn ghost sm" type="button" (click)="openLost(e)">Lost</button>
            }
            @if (e.status === 'booked' && e.jobId) { <a class="btn ghost sm" [routerLink]="['/workshop/job', e.jobId]"><bb-icon name="car"/>Open the car</a> }
          </div>
        </div>
      } @empty { <div class="card empty"><strong>Nothing here</strong>Log the next call or WhatsApp as a new enquiry.</div> }
    </div>

    <bb-drawer title="New enquiry" [open]="adding()" (closed)="adding.set(false)">
      <div class="form-grid">
        <div class="field"><label for="en">Name</label><input id="en" [(ngModel)]="f.name" placeholder="Kavinda Rathnayake"></div>
        <div class="field"><label for="ep">Phone</label><input id="ep" type="tel" inputmode="tel" [(ngModel)]="f.phone" placeholder="07X XXX XXXX"></div>
        <div class="field"><label for="es">Came from</label><select id="es" [(ngModel)]="f.source">@for (s of cast.cast()?.sources; track s) { <option [value]="s">{{ s }}</option> }</select></div>
        <div class="field"><label for="ev">Service</label><select id="ev" [(ngModel)]="f.service">@for (s of cast.cast()?.services; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select></div>
        <div class="field"><label for="eb">Branch</label><select id="eb" [(ngModel)]="f.branch">@for (b of cast.cast()?.branches; track b.key) { <option [value]="b.key">{{ b.name }}</option> }</select></div>
        <div class="field"><label for="epl">Plate (if known)</label><input id="epl" [(ngModel)]="f.plate" autocapitalize="characters" placeholder="CAF-2290"></div>
        <div class="field"><label for="emk">Make</label><input id="emk" [(ngModel)]="f.make" placeholder="Toyota"></div>
        <div class="field"><label for="emd">Model</label><input id="emd" [(ngModel)]="f.model" placeholder="Axio"></div>
        <div class="field span"><label for="eno">What they asked</label><textarea id="eno" [(ngModel)]="f.note" placeholder="Rear bumper after a knock. Asking if insurance covers it."></textarea></div>
      </div>
      @if (err()) { <p class="err">{{ err() }}</p> }
      <div foot><button class="btn" type="button" (click)="save()"><bb-icon name="check"/>Save enquiry</button><button class="btn ghost" type="button" (click)="adding.set(false)">Cancel</button></div>
    </bb-drawer>

    <bb-drawer title="Mark as lost" [open]="!!losing()" (closed)="losing.set(null)">
      <p class="t-small">One line on why. Over a month the reasons show the owner what to fix.</p>
      <div class="chips pick">@for (r of reasons; track r) { <button type="button" [class.on]="reason === r" (click)="reason = r">{{ r }}</button> }</div>
      <div class="field" style="margin-top:12px"><label for="lr">Or in your words</label><input id="lr" [(ngModel)]="reason" placeholder="Went with a place closer to home"></div>
      <div foot><button class="btn" type="button" [disabled]="!reason.trim()" (click)="lose()">Mark lost</button><button class="btn ghost" type="button" (click)="losing.set(null)">Cancel</button></div>
    </bb-drawer>`,
  styles: [`
    .bar{margin-bottom:14px}.bar b{margin-left:6px;font-weight:700;opacity:.7}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
    @media (max-width:640px){.grid{grid-template-columns:1fr}}
    .eq{padding:16px;display:grid;gap:8px;align-content:start}
    .eq.new{border-left:3px solid var(--brand)}.eq.lost{opacity:.72}
    .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .who{min-width:0}.who strong{display:block;font-size:15px}.who span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
    .svc{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;--ico:14px}.svc bb-icon{color:var(--brand-dark)}
    .note{font-size:13px;color:var(--ink-2);line-height:1.45}.why{font-size:12.5px;color:var(--amber);font-weight:600}
    .meta{font-size:12px;color:var(--muted)}
    .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
    .pick{margin-top:12px}.err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}`]
})
export class WorkshopEnquiriesComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute);
  filter = signal<'open' | 'new' | 'quoted' | 'booked' | 'lost'>('open');
  filters = [{ k: 'open', label: 'Open' }, { k: 'new', label: 'New' }, { k: 'quoted', label: 'Quoted' }, { k: 'booked', label: 'Booked' }, { k: 'lost', label: 'Lost' }] as const;
  reasons = ['Price', 'Went elsewhere', 'No reply', 'Only asking', 'Insurance did not approve'];
  adding = signal(false); losing = signal<Enquiry | null>(null); err = signal(''); reason = '';
  f: any = {};
  constructor(){ this.route.queryParamMap.subscribe(p => { if (p.get('add')) this.openAdd(); const f = p.get('f'); if (f && ['open', 'new', 'quoted', 'booked', 'lost'].includes(f)) this.filter.set(f as any); }); }
  list = computed(() => { const f = this.filter(); return this.data.enquiries().filter(e => f === 'open' ? (e.status === 'new' || e.status === 'quoted') : e.status === f).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); });
  bookedMonth = computed(() => { const m = new Date().toISOString().slice(0, 7); return this.data.enquiries().filter(e => e.status === 'booked' && e.updatedAt.slice(0, 7) === m).length; });
  count(s: string){ return this.data.enquiries().filter(e => e.status === s).length; }
  word(s: string){ return ({ new: 'New', quoted: 'Quoted', booked: 'Booked', lost: 'Lost' } as any)[s]; }
  pill(s: string){ return ({ new: 'new', quoted: 'quoted', booked: 'won', lost: 'lost' } as any)[s]; }
  when(iso: string){ return niceWhen(iso); }
  wa(e: Enquiry){ return waLink(e.phone, `Hello ${e.name.split(' ')[0]}, this is ${this.session.name()} from ${this.cast.cast()?.name}. `); }
  openAdd(){ const c = this.cast.cast(); this.f = { name: '', phone: '', source: c?.sources?.[0] || 'WhatsApp', service: c?.services[0]?.key, branch: this.session.branch() || c?.branches[0]?.key, plate: '', make: '', model: '', note: '' }; this.err.set(''); this.adding.set(true); }
  async save(){ this.err.set(''); const phone = normalise(this.f.phone); if (!this.f.name.trim()) return this.err.set('Add their name.'); if (!phone) return this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX.');
    try { await this.data.addEnquiry({ ...this.f, phone, plate: (this.f.plate || '').toUpperCase().trim() }); this.adding.set(false); this.filter.set('open'); this.data.toast('Enquiry saved'); } catch (e: any) { this.err.set(e.message); } }
  openLost(e: Enquiry){ this.reason = ''; this.losing.set(e); }
  async lose(){ const e = this.losing(); if (!e) return; await this.data.loseEnquiry(e.id, this.reason); this.losing.set(null); this.data.toast('Marked lost'); }
}
