import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, waLink, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { Job, FollowUp, FollowUpOutcome } from '../../core/models';

/* Customers, with the after-care on top. Every delivered car sets its own check-ins from
   the cast's cadence. Due ones sit first with a WhatsApp already written, and closing one
   needs an answer: all good, needs a look (which becomes an enquiry) or no reply. */
@Component({
  selector: 'bb-ws-customers',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, DrawerComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Customers</h2><p>{{ data.customers().length }} on file · {{ data.followupsDue().length }} {{ data.followupsDue().length === 1 ? 'follow-up' : 'follow-ups' }} due</p></div></div>

    <div class="sec-head"><h3>Follow-ups</h3><span>after the car goes home</span></div>
    <div class="chips bar">
      <button type="button" [class.on]="tab() === 'due'" (click)="tab.set('due')">Due now<b>{{ data.followupsDue().length }}</b></button>
      <button type="button" [class.on]="tab() === 'soon'" (click)="tab.set('soon')">Coming up<b>{{ data.followupsSoon().length }}</b></button>
      <button type="button" [class.on]="tab() === 'done'" (click)="tab.set('done')">Done<b>{{ data.followupsDone().length }}</b></button>
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
              <a class="btn wa sm icon" [href]="wa(x.job, x.f)" target="_blank" rel="noreferrer" aria-label="WhatsApp the customer"><bb-icon name="wa"/></a>
              <button class="btn ghost sm" type="button" (click)="open(x.job, x.f)">Log it</button>
            </span>
          }
        </div>
      } @empty { <div class="empty"><strong>{{ tab() === 'due' ? 'Nobody to call today' : 'Nothing here' }}</strong>{{ tab() === 'due' ? 'Every delivered car sets its own check-ins.' : '' }}</div> }
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Everyone</h3><span>{{ list().length }}</span></div>
      <div class="toolbar"><div class="search grow"><bb-icon name="search"/><input type="search" [(ngModel)]="q" placeholder="Name, phone or plate" aria-label="Search" enterkeyhint="search"></div></div>
      <div class="card list">
        @for (c of list(); track c.id) {
          <a class="li link" [routerLink]="['/workshop/cars']" [queryParams]="{ f: 'all', q: c.phone }">
            <span class="avatar">{{ c.name.slice(0, 1) }}</span>
            <span class="tx"><strong>{{ c.name }}</strong><span>{{ c.phone }} · {{ plates(c) }}</span></span>
            <span class="n">{{ jobsOf(c).length }} {{ jobsOf(c).length === 1 ? 'job' : 'jobs' }}</span>
          </a>
        } @empty { <div class="empty"><strong>No customers yet</strong>The first Car in creates one.</div> }
      </div>
    </div>

    <bb-drawer [title]="(active()?.f?.label || '') + ', ' + (active()?.job?.customerName || '')" [open]="!!active()" (closed)="active.set(null)">
      <p class="t-small">What did they say? Needs a look turns into a new enquiry so the car comes back in.</p>
      <div class="opts">
        <button type="button" class="opt" [class.on]="pick === 'good'" (click)="pick = 'good'"><bb-icon name="tick"/><span><strong>All good</strong><em>Happy with the car</em></span></button>
        <button type="button" class="opt" [class.on]="pick === 'issue'" (click)="pick = 'issue'"><bb-icon name="alert"/><span><strong>Needs a look</strong><em>Makes an enquiry to book it back in</em></span></button>
        <button type="button" class="opt" [class.on]="pick === 'noreply'" (click)="pick = 'noreply'"><bb-icon name="clock"/><span><strong>No reply</strong><em>Closes this check-in</em></span></button>
      </div>
      <div class="field" style="margin-top:12px"><label for="fn">Note</label><input id="fn" [(ngModel)]="note" placeholder="Paint still perfect, will send a friend"></div>
      <div foot><button class="btn" type="button" [disabled]="!pick" (click)="save()"><bb-icon name="check"/>Save</button><button class="btn ghost" type="button" (click)="active.set(null)">Cancel</button></div>
    </bb-drawer>`,
  styles: [`
    .bar{margin:0 0 10px}.bar b{margin-left:6px;font-weight:700;opacity:.7}
    .fu .ic.late{background:var(--amber-soft);color:var(--amber)}
    .fu .tx .due{color:var(--muted)}.fu .tx .due.late{color:var(--amber);font-weight:600}
    .fu .tx .out{white-space:normal}.fu .tx .out.good{color:var(--green)}.fu .tx .out.issue{color:var(--amber);font-weight:600}
    .fa{display:flex;gap:6px;flex-shrink:0}
    .n{font-size:12px;color:var(--muted);white-space:nowrap}
    .opts{display:grid;gap:8px;margin-top:12px}
    .opt{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line-2);border-radius:12px;background:var(--surface);text-align:left;--ico:20px;transition:border-color 150ms var(--ease),background 150ms var(--ease)}
    .opt strong{display:block;font-size:14px}.opt em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
    .opt.on{border-color:var(--brand);background:var(--brand-soft)}.opt.on bb-icon{color:var(--brand-dark)}
    /* phone: icon and words on one track, the two buttons under the words, nothing past the card edge */
    @media (max-width:640px){.fu .li{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:start}.fu .tx>span{white-space:normal}.fa{grid-column:2;justify-content:flex-start;margin-top:4px}}`]
})
export class WorkshopCustomersComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute);
  q = ''; tab = signal<'due' | 'soon' | 'done'>('due'); active = signal<{ job: Job; f: FollowUp } | null>(null); pick: FollowUpOutcome | '' = ''; note = '';
  constructor(){ this.route.queryParamMap.subscribe(p => { const t = p.get('t'); if (t === 'due' || t === 'soon' || t === 'done') this.tab.set(t); }); }
  rows = computed(() => this.tab() === 'due' ? this.data.followupsDue() : this.tab() === 'soon' ? this.data.followupsSoon().slice(0, 30) : this.data.followupsDone().slice(0, 30));
  list = computed(() => { const q = this.q.trim().toLowerCase(); return this.data.customers().filter(c => !q || [c.name, c.phone, ...c.vehicles.map(v => v.plate)].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)); });
  plates(c: any){ return c.vehicles.map((v: any) => v.plate).join(', '); }
  jobsOf(c: any){ return this.data.jobs().filter(j => j.customerId === c.id); }
  late(f: FollowUp){ return !f.doneAt && new Date(f.due).getTime() < new Date().setHours(0, 0, 0, 0); }
  date(iso?: string){ return niceDate(iso); }
  outcome(o?: string){ return ({ good: 'All good', issue: 'Needs a look', noreply: 'No reply' } as any)[o || ''] || ''; }
  wa(j: Job, f: FollowUp){ const days = Math.max(1, Math.round((Date.now() - new Date(j.deliveredAt || j.updatedAt).getTime()) / 86400000));
    return waLink(j.customerPhone, `Hello ${j.customerName.split(' ')[0]}, this is ${this.session.name()} from ${this.cast.cast()?.name}. It has been ${days} days since your ${j.make} ${j.model} went home after the ${(this.cast.service(j.service)?.label || 'work').toLowerCase()}. Is everything still good with the car?`); }
  open(j: Job, f: FollowUp){ this.pick = ''; this.note = ''; this.active.set({ job: j, f }); }
  async save(){ const a = this.active(); if (!a || !this.pick) return; await this.data.markFollowup(a.job.id, a.f.key, this.pick, this.note); this.active.set(null);
    this.data.toast(this.pick === 'issue' ? 'Saved. A new enquiry is waiting in Enquiries.' : 'Follow-up saved', this.pick === 'issue' ? '/workshop/enquiries' : undefined, 'Open'); }
}
