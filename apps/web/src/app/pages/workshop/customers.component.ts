import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService, normalise } from '../../core/session.service';
import { DataService, waLink, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { Job, FollowUp, FollowUpOutcome, Customer } from '../../core/models';

/* Customers, with the after-care on top. Every customer opens a sheet with their cars, jobs and
   check-ins, and every customer can be added and edited here: the customer is the one source of their
   name and phone, and an edit reaches every car and job they have (the phone is their login). */
@Component({
  selector: 'bb-ws-customers',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, DrawerComponent, FilterBarComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Customers</h2><p>{{ data.customers().length }} on file · {{ data.followupsDue().length }} {{ data.followupsDue().length === 1 ? 'follow-up' : 'follow-ups' }} due</p></div>
      <div class="ph-right"><button class="btn sm" type="button" (click)="openNew()"><bb-icon name="plus"/>Add customer</button></div></div>
    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Name, phone or plate" [count]="list().length" noun="customer" nouns="customers" store="customers"/>

    <div class="sec-head"><h3>Follow-ups</h3><span>after the car goes home</span></div>
    <div class="chips bar">
      <button type="button" [class.on]="tab() === 'due'" (click)="tab.set('due')">Due now<b>{{ fu('due').length }}</b></button>
      <button type="button" [class.on]="tab() === 'soon'" (click)="tab.set('soon')">Coming up<b>{{ fu('soon').length }}</b></button>
      <button type="button" [class.on]="tab() === 'done'" (click)="tab.set('done')">Done<b>{{ fu('done').length }}</b></button>
    </div>
    <div class="card list fu">
      @for (x of rows(); track x.job.id + x.f.key) {
        <div class="li">
          <span class="ic" [class.late]="late(x.f)"><bb-icon [name]="x.f.doneAt ? (x.f.outcome === 'issue' ? 'alert' : 'tick') : 'clock'"/></span>
          <span class="tx">
            <strong>{{ x.job.customerName }} · {{ x.f.label }}</strong>
            <span>{{ x.job.plate }} {{ x.job.make }} {{ x.job.model }} · {{ cast.service(x.job.service)?.label }} · home {{ date(x.job.deliveredAt) }}</span>
            @if (x.f.doneAt) { <span class="out" [class]="'out ' + x.f.outcome">{{ outcome(x.f.outcome) }}, {{ date(x.f.doneAt) }} by {{ x.f.by }}@if (x.f.note) { : {{ x.f.note }} }</span> }
            @else { <span class="due" [class.late]="late(x.f)">{{ late(x.f) ? 'Was due ' + date(x.f.due) : 'Due ' + date(x.f.due) }}</span> }
          </span>
          @if (!x.f.doneAt) {
            <span class="fa">
              <a class="btn wa-ghost sm icon" [href]="waFollow(x.job)" target="_blank" rel="noreferrer" aria-label="WhatsApp the customer"><bb-icon name="wa"/></a>
              <button class="btn ghost sm" type="button" (click)="open(x.job, x.f)">Log it</button>
            </span>
          }
        </div>
      } @empty { <div class="empty"><strong>{{ tab() === 'due' ? 'Nobody to call today' : 'Nothing here' }}</strong>{{ tab() === 'due' ? 'Every delivered car sets its own check-ins.' : '' }}</div> }
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Everyone</h3><span>{{ list().length }}</span></div>
      <div class="card list">
        @for (c of list(); track c.id) {
          <button type="button" class="li link row" (click)="sel.set(c)">
            <span class="avatar">{{ c.name.slice(0, 1) }}</span>
            <span class="tx"><strong>{{ c.name }}</strong><span>{{ c.phone }} · {{ plates(c) || 'No car yet' }}</span></span>
            @if (openOf(c).length) { <span class="pill brand">{{ openOf(c).length }} in</span> }
            <span class="n">{{ jobsOf(c).length }} {{ jobsOf(c).length === 1 ? 'job' : 'jobs' }}</span>
            <bb-icon name="chev" class="go"/>
          </button>
        } @empty { <div class="empty"><strong>No customer matches</strong>Clear the filters or add a customer.</div> }
      </div>
    </div>

    <bb-drawer [title]="sel()?.name || ''" [open]="!!sel()" (closed)="sel.set(null)" [editable]="true" (edit)="openEdit(sel()!)">
      @if (sel(); as c) {
        <div class="rows">
          <div class="row"><span class="k">Phone</span><span class="v">{{ c.phone }}<em>their login to the app</em></span></div>
          <div class="row"><span class="k">Customer since</span><span class="v">{{ date(c.createdAt) }}</span></div>
        </div>
        <h4 class="h4">Cars</h4>
        <div class="card list">
          @for (v of c.vehicles; track v.plate) { <div class="li"><span class="ic"><bb-icon name="car"/></span><span class="tx"><strong>{{ v.plate }}</strong><span>{{ v.make }} {{ v.model }}@if (v.colour) { · {{ v.colour }} }</span></span></div> }
          @empty { <div class="empty">No car on file yet.</div> }
        </div>
        <h4 class="h4">Jobs</h4>
        <div class="card list">
          @for (j of jobsOf(c); track j.id) {
            <a class="li link" [routerLink]="['/workshop/job', j.id]" (click)="sel.set(null)">
              <span class="ic"><bb-icon [name]="j.status === 'delivered' ? 'tick' : 'wrench'"/></span>
              <span class="tx"><strong>{{ j.plate }} · {{ cast.service(j.service)?.label }}</strong><span>{{ j.status === 'delivered' ? 'Delivered ' + date(j.deliveredAt) : j.status === 'ready' ? 'Ready for pickup' : 'On the floor, promised ' + date(j.promisedAt) }}</span></span>
              <bb-icon name="chev" class="go"/>
            </a>
          } @empty { <div class="empty">No jobs yet.</div> }
        </div>
      }
      <div foot>
        @if (sel(); as c) {
          <a class="btn" [routerLink]="['/workshop/new']" [queryParams]="{ customer: c.id }" (click)="sel.set(null)"><bb-icon name="plus"/>Car in for {{ c.name.split(' ')[0] }}</a>
          <div class="pair"><a class="btn wa-ghost" [href]="waHello(c)" target="_blank" rel="noreferrer"><bb-icon name="wa"/>WhatsApp</a><a class="btn ghost" [href]="'tel:' + c.phone"><bb-icon name="phone"/>Call</a></div>
        }
      </div>
    </bb-drawer>

    <bb-drawer [title]="ed.id ? 'Edit customer' : 'Add customer'" [open]="editing()" (closed)="editing.set(false)">
      <div class="form-grid">
        <div class="field span"><label for="cn">Name</label><input id="cn" [(ngModel)]="ed.name" placeholder="Dilshan Perera" autocomplete="off"></div>
        <div class="field span"><label for="cp">Phone</label><input id="cp" type="tel" inputmode="tel" [(ngModel)]="ed.phone" placeholder="07X XXX XXXX"><span class="hint">This is their login to the app. Changing it moves every car and job with it.</span></div>
      </div>
      <div class="sec-head cars-h"><h3>Cars</h3><button class="btn ghost sm" type="button" (click)="ed.vehicles.push({ plate: '', make: '', model: '', colour: '', was: '' })"><bb-icon name="plus"/>Add a car</button></div>
      @for (v of ed.vehicles; track $index; let i = $index) {
        <div class="veh card">
          <div class="form-grid">
            <div class="field"><label [attr.for]="'vp' + i">Plate</label><input [id]="'vp' + i" [(ngModel)]="v.plate" autocapitalize="characters" placeholder="CAB-4471"></div>
            <div class="field"><label [attr.for]="'vc' + i">Colour</label><input [id]="'vc' + i" [(ngModel)]="v.colour" placeholder="Pearl white"></div>
            <div class="field"><label [attr.for]="'vm' + i">Make</label><input [id]="'vm' + i" [(ngModel)]="v.make" placeholder="Toyota"></div>
            <div class="field"><label [attr.for]="'vo' + i">Model</label><input [id]="'vo' + i" [(ngModel)]="v.model" placeholder="Aqua"></div>
          </div>
          <button class="btn quiet warn sm rm" type="button" (click)="ed.vehicles.splice(i, 1)"><bb-icon name="trash"/>Remove this car</button>
        </div>
      } @empty { <p class="t-small">No car yet. Add one now, or it is added at Car in.</p> }
      @if (err()) { <p class="err">{{ err() }}</p> }
      <div foot><button class="btn" type="button" [disabled]="busy()" (click)="saveCustomer()"><bb-icon name="check"/>{{ ed.id ? 'Save changes' : 'Add customer' }}</button><button class="btn quiet" type="button" (click)="editing.set(false)">Cancel</button></div>
    </bb-drawer>

    <bb-drawer [title]="(active()?.f?.label || '') + ', ' + (active()?.job?.customerName || '')" [open]="!!active()" (closed)="active.set(null)">
      <p class="t-small">What did they say? Needs a look turns into a new enquiry so the car comes back in.</p>
      <div class="opts">
        <button type="button" class="opt" [class.on]="pick === 'good'" (click)="pick = 'good'"><bb-icon name="tick"/><span><strong>All good</strong><em>Happy with the car</em></span></button>
        <button type="button" class="opt" [class.on]="pick === 'issue'" (click)="pick = 'issue'"><bb-icon name="alert"/><span><strong>Needs a look</strong><em>Makes an enquiry to book it back in</em></span></button>
        <button type="button" class="opt" [class.on]="pick === 'noreply'" (click)="pick = 'noreply'"><bb-icon name="clock"/><span><strong>No reply</strong><em>Closes this check-in</em></span></button>
      </div>
      <div class="field" style="margin-top:12px"><label for="fn">Note</label><input id="fn" [(ngModel)]="note" placeholder="Paint still perfect, will send a friend"></div>
      <div foot><button class="btn" type="button" [disabled]="!pick" (click)="save()"><bb-icon name="check"/>Save</button><button class="btn quiet" type="button" (click)="active.set(null)">Cancel</button></div>
    </bb-drawer>`,
  styles: [`
    .bar{margin:0 0 10px}.bar b{margin-left:6px;font-weight:700;opacity:.7}
    .fu .ic.late{background:var(--amber-soft);color:var(--amber)}
    .fu .tx .due{color:var(--muted)}.fu .tx .due.late{color:var(--amber);font-weight:600}
    .fu .tx .out{white-space:normal}.fu .tx .out.good{color:var(--green)}.fu .tx .out.issue{color:var(--amber);font-weight:600}
    .fa{display:flex;gap:6px;flex-shrink:0}
    .row{width:100%;border:0;background:none;text-align:left;font:inherit;color:inherit}
    .n{font-size:12px;color:var(--muted);white-space:nowrap}.go{color:var(--faint)}
    .rows .row{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}.rows .row:first-child{border-top:0}
    .rows .k{width:112px;flex-shrink:0;color:var(--muted);font-size:12.5px;font-weight:600}.rows .v{flex:1;min-width:0}.rows .v em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
    .h4{font-size:12px;font-weight:600;color:var(--muted);margin:18px 0 8px}
    .cars-h{margin-top:18px}
    .veh{padding:14px;margin-top:10px}.rm{margin-top:10px}
    .err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}
    .opts{display:grid;gap:8px;margin-top:12px}
    .opt{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line-2);border-radius:12px;background:var(--surface);text-align:left;--ico:20px;transition:border-color 150ms var(--ease),background 150ms var(--ease)}
    .opt strong{display:block;font-size:14px}.opt em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
    .opt.on{border-color:var(--brand);background:var(--brand-soft)}.opt.on bb-icon{color:var(--brand-dark)}
    @media (max-width:640px){.fu .li{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:start}.fu .tx>span{white-space:normal}.fa{grid-column:2;justify-content:flex-start;margin-top:4px}}`]
})
export class WorkshopCustomersComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  tab = signal<'due' | 'soon' | 'done'>('due'); active = signal<{ job: Job; f: FollowUp } | null>(null); pick: FollowUpOutcome | '' = ''; note = '';
  sel = signal<Customer | null>(null); editing = signal(false); busy = signal(false); err = signal('');
  ed: { id?: string; name: string; phone: string; vehicles: any[] } = { name: '', phone: '', vehicles: [] };
  fstate = signal<Record<string, string>>({}); fq = signal('');
  fdefs = computed<FilterDef[]>(() => [
    { key: 'branch', label: 'Branch', all: 'Both branches', options: (this.cast.cast()?.branches || []).map(b => ({ value: b.key, label: b.name })) },
    { key: 'show', label: 'Show', all: 'Everyone', options: [{ value: 'in', label: 'Has a car in now' }, { value: 'due', label: 'Follow-up due' }, { value: 'none', label: 'No job yet' }] } ]);
  constructor(){ this.route.queryParamMap.subscribe(p => { const t = p.get('t'); if (t === 'due' || t === 'soon' || t === 'done') this.tab.set(t); const o = p.get('open'); if (o) { const c = this.data.customers().find(x => x.id === o); if (c) this.sel.set(c); } if (p.get('add')) this.openNew(); }); }
  private match = (c: Customer) => { const f = this.fstate(), q = this.fq().trim().toLowerCase(); const jobs = this.jobsOf(c);
    return (!q || [c.name, c.phone, ...c.vehicles.map(v => v.plate)].join(' ').toLowerCase().includes(q))
      && (!f['branch'] || jobs.some(j => j.branch === f['branch']))
      && (!f['show'] || (f['show'] === 'in' ? jobs.some(j => j.status !== 'delivered') : f['show'] === 'none' ? !jobs.length : this.data.followupsDue().some(x => x.job.customerId === c.id))); };
  list = computed(() => this.data.customers().filter(this.match).sort((a, b) => a.name.localeCompare(b.name)));
  fu(t: 'due' | 'soon' | 'done'){ const src = t === 'due' ? this.data.followupsDue() : t === 'soon' ? this.data.followupsSoon() : this.data.followupsDone(); const ok = new Set(this.list().map(c => c.id)); return src.filter(x => ok.has(x.job.customerId)); }
  rows = computed(() => { const r = this.fu(this.tab()); return this.tab() === 'due' ? r : r.slice(0, 30); });
  plates(c: Customer){ return c.vehicles.map(v => v.plate).join(', '); }
  jobsOf(c: Customer){ return this.data.jobs().filter(j => j.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  openOf(c: Customer){ return this.jobsOf(c).filter(j => j.status !== 'delivered'); }
  late(f: FollowUp){ return !f.doneAt && new Date(f.due).getTime() < new Date().setHours(0, 0, 0, 0); }
  date(iso?: string){ return niceDate(iso); }
  outcome(o?: string){ return ({ good: 'All good', issue: 'Needs a look', noreply: 'No reply' } as any)[o || ''] || ''; }
  waFollow(j: Job){ const days = Math.max(1, Math.round((Date.now() - new Date(j.deliveredAt || j.updatedAt).getTime()) / 86400000));
    return waLink(j.customerPhone, `Hello ${j.customerName.split(' ')[0]}, this is ${this.session.name()} from ${this.cast.cast()?.name}. It has been ${days} days since your ${j.make} ${j.model} went home after the ${(this.cast.service(j.service)?.label || 'work').toLowerCase()}. Is everything still good with the car?`); }
  waHello(c: Customer){ return waLink(c.phone, `Hello ${c.name.split(' ')[0]}, this is ${this.session.name()} from ${this.cast.cast()?.name}. `); }
  open(j: Job, f: FollowUp){ this.pick = ''; this.note = ''; this.active.set({ job: j, f }); }
  async save(){ const a = this.active(); if (!a || !this.pick) return; await this.data.markFollowup(a.job.id, a.f.key, this.pick, this.note); this.active.set(null);
    this.data.toast(this.pick === 'issue' ? 'Saved. A new enquiry is waiting in Enquiries.' : 'Follow-up saved', this.pick === 'issue' ? '/workshop/enquiries' : undefined, 'Open'); }
  openNew(){ this.ed = { name: '', phone: '', vehicles: [] }; this.err.set(''); this.sel.set(null); this.editing.set(true); }
  openEdit(c: Customer){ this.ed = { id: c.id, name: c.name, phone: c.phone, vehicles: c.vehicles.map(v => ({ ...v, colour: v.colour || '', was: v.plate })) }; this.err.set(''); this.sel.set(null); this.editing.set(true); }
  async saveCustomer(){ if (this.busy()) return; this.err.set(''); const phone = normalise(this.ed.phone);
    if (!phone) { this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX. It is their login.'); return; }
    this.busy.set(true);
    try { const r = await this.data.saveCustomer({ ...this.ed, phone }); this.editing.set(false); this.data.toast(this.ed.id ? 'Changes saved' : 'Customer added'); this.sel.set(r); }
    catch (e: any) { this.err.set(e.message); } finally { this.busy.set(false); } }
}
