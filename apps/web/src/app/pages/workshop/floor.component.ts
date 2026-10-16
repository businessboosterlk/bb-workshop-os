import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { Job } from '../../core/models';
import { FloorMapComponent } from '../../ui/floor-map.component';
import { DockComponent } from '../../ui/dock.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { LockedCardComponent } from '../../ui/locked-card.component';
import { unlocked, tierOf, FeatureKey } from '../../core/tiers';
import { floor as floorOf, dock as dockOf, spacesFor, Tile } from '../../core/spaces';

/* The floor: what the owner looks at with the morning coffee. Cars in, ready, over
   time, waiting on a customer, the bays per branch, then every open car with the
   overruns first. A staff seat opens on its own branch. */
@Component({
  selector: 'bb-floor',
  standalone: true,
  imports: [RouterLink, IconComponent, FloorMapComponent, DockComponent, DrawerComponent, LockedCardComponent],
  template: `
    <div class="ph">
      <div><h2 class="t-h1">The floor</h2><p>{{ today }}</p></div>
      <div class="ph-right">
        <div class="seg" role="tablist">
          <button type="button" [class.on]="branch() === ''" (click)="branch.set('')"><bb-icon name="bay"/>Both</button>
          @for (b of cast.cast()?.branches; track b.key) { <button type="button" [class.on]="branch() === b.key" (click)="branch.set(b.key)"><bb-icon name="bay"/>{{ b.name }}</button> }
        </div>
      </div>
    </div>
    <div class="kpi">
      <div class="card"><div class="k-label">Cars in</div><div class="k-val">{{ open().length }}</div><div class="k-sub">on the floor now</div></div>
      <div class="card"><div class="k-label">Ready</div><div class="k-val" [class.up]="ready().length">{{ ready().length }}</div><div class="k-sub">waiting for pickup</div></div>
      <div class="card"><div class="k-label">Over time</div><div class="k-val" [class.warn]="over().length">{{ over().length }}</div><div class="k-sub">past the phase's usual hours</div></div>
      <div class="card"><div class="k-label">Waiting on customer</div><div class="k-val">{{ waiting().length }}</div><div class="k-sub">approvals unanswered</div></div>
    </div>
    <!-- THE FLOOR PICTURE (parts F2 and F3) and THE HOLDING DOCK (F4), built by the crew 15 Oct 2026 -->
    <div class="fl"><bb-floor-map [floors]="floors()" [canAssign]="true" (assign)="pickFor($event)" (open)="openJob($event.job)"/></div>
    <!-- T1 tiers (16 Oct 2026): a feature the tier does not include shows as ONE locked card where it would live -->
    @if (on('dock')) { <div class="fl"><bb-dock [dock]="dockNow()" [canAssign]="true" (open)="openJob($event)" (place)="placeFor($event)"/></div> }
    @else { <div class="fl"><bb-locked feature="dock" [garage]="cast.cast()?.name || ''"/></div> }
    @if (tier() === 2) { <div class="fl"><bb-locked feature="exceptions" [garage]="cast.cast()?.name || ''"/></div> }
    <bb-drawer [open]="!!sheet()" [title]="sheetTitle()" (closed)="sheet.set(null)">
      @if (sheet(); as s) {
        @if (s.tile) {
          @if (queueFor(s.tile.branch).length) {
            <p class="d-lead">Cars waiting for a space in {{ cast.branch(s.tile.branch)?.name }}</p>
            @for (j of queueFor(s.tile.branch); track j.id) { <button type="button" class="pick" (click)="place(j, s.tile.space.key)"><span class="plate">{{ j.plate }}</span><span class="pk-t"><strong>{{ j.make }} {{ j.model }}</strong><em>{{ data.phaseNow(j)?.label || 'Waiting to start' }}</em></span><bb-icon name="chev"/></button> }
          } @else { <div class="empty"><strong>No car is waiting for a space</strong>A car joins this list when it arrives through Car in or leaves the holding dock.</div> }
        } @else if (s.job) {
          @if (freeFor(s.job).length) {
            <p class="d-lead">Free spaces in {{ cast.branch(s.job.branch)?.name }}</p>
            @for (sp of freeFor(s.job); track sp.key) { <button type="button" class="pick" (click)="place(s.job, sp.key)"><span class="pk-t"><strong>{{ sp.label }}</strong><em>Free now</em></span><bb-icon name="chev"/></button> }
          } @else { <div class="empty"><strong>Every space is taken</strong>The capacity line shows when the next one frees up.</div> }
        }
      }
      <div foot><button type="button" class="btn ghost" (click)="sheet.set(null)">Cancel</button></div>
    </bb-drawer>
    <div class="sales">
      <a class="card sl" routerLink="/workshop/enquiries"><bb-icon name="inbox"/><span><strong>{{ data.newEnquiries().length }} new {{ data.newEnquiries().length === 1 ? 'enquiry' : 'enquiries' }}</strong><em>{{ data.openEnquiries().length }} open in total</em></span><bb-icon name="chev" class="go"/></a>
      <a class="card sl" routerLink="/workshop/customers" [queryParams]="{ t: 'due' }"><bb-icon name="phone"/><span><strong>{{ data.followupsDue().length }} {{ data.followupsDue().length === 1 ? 'follow-up' : 'follow-ups' }} due</strong><em>customers to check in with</em></span><bb-icon name="chev" class="go"/></a>
      @if (session.owner()) { <a class="card sl" routerLink="/workshop/quotes"><bb-icon name="quote"/><span><strong>{{ sentQuotes() }} {{ sentQuotes() === 1 ? 'quote' : 'quotes' }} waiting</strong><em>sent, not yet answered</em></span><bb-icon name="chev" class="go"/></a> }
    </div>
    <div class="sec">
      <div class="sec-head"><h3>Every car</h3><span>overruns first</span></div>
      @if (list().length) {
        <div class="cars">
          @for (j of list(); track j.id) {
            <a class="card jc" [routerLink]="['/workshop/job', j.id]" [class.hot]="data.overrun(j) > 0" [class.ready]="j.status === 'ready'">
              <div class="l">
                <span class="plate">{{ j.plate }}</span>
                <strong>{{ j.make }} {{ j.model }}</strong>
                <span class="sub">{{ j.customerName }} · {{ cast.branch(j.branch)?.name }} · {{ cast.service(j.service)?.label }}</span>
              </div>
              <div class="r">
                @if (j.status === 'ready') { <span class="pill won"><i class="dot"></i>Ready</span> }
                @else if (data.overrun(j) > 0) { <span class="pill quoted"><i class="dot"></i>{{ data.phaseNow(j)?.label }} · {{ data.overrun(j) }} h over</span> }
                @else { <span class="pill brand"><i class="dot"></i>{{ data.phaseNow(j)?.label }}</span> }
                <span class="prom"><bb-icon name="clock"/>{{ date(j.promisedAt) }}</span>
                @if (pending(j)) { <span class="ask"><bb-icon name="alert"/>Waiting on customer</span> }
                <span class="prog"><i [style.width.%]="data.progress(j) * 100"></i></span>
              </div>
            </a>
          }
        </div>
      } @else { <div class="card empty"><strong>No cars on this floor</strong>Tap Car in when the next one arrives.</div> }
    </div>`,
  styles: [`
    .k-val.warn{color:var(--amber)}
    /* icon and word laid out as a centred row, like .btn: as inline text the icon sat 2px low and the group 1px left (ui-precision, 15 Oct 2026) */
    .seg button{display:inline-flex;align-items:center;justify-content:center;gap:2px}.seg button>bb-icon{margin-left:0}
    .fl{margin-top:16px;--sticky-top:calc(var(--sat) + var(--top-h))}
    .d-lead{font-size:12.5px;color:var(--muted);margin:0 0 8px}
    .pick{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 12px;margin-bottom:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);text-align:left;--ico:16px;color:var(--ink)}
    @media (hover:hover){.pick:hover{border-color:var(--brand)}}.pick .pk-t{flex:1;min-width:0}.pick strong{display:block;font-size:14px}.pick em{display:block;font-style:normal;font-size:12px;color:var(--muted)}.pick bb-icon{color:var(--faint)}
    .bays{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
    @media (max-width:640px){.bays{grid-template-columns:1fr}}
    .bay{padding:14px 16px}.bay-h{display:flex;align-items:center;gap:12px}.bay-h strong{font-size:14px}.bay-h>span:last-child{font-size:12px;color:var(--muted);white-space:nowrap}
    /* each location reads as a garage at a glance (Thulaib, 15 Oct 2026: "show an icon of a garage so they know the two locations") */
    .bay-ic{width:40px;height:40px;border-radius:10px;background:var(--brand-soft);color:var(--brand-dark);display:flex;align-items:center;justify-content:center;flex:none;--ico:22px}
    .bay-n{flex:1;min-width:0}.bay-n em{display:block;font-style:normal;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .slots{display:flex;gap:6px;margin-top:10px}.slots i{flex:1;height:10px;border-radius:4px;background:var(--line);transition:background 300ms var(--ease)}
    .slots i.full{background:var(--brand)}.slots i.hot{background:var(--amber)}
    .sales{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}
    .sl{display:flex;align-items:center;gap:12px;padding:14px 16px;--ico:20px;transition:border-color 150ms var(--ease)}@media (hover:hover){.sl:hover{border-color:var(--brand)}}
    .sl>bb-icon:first-child{color:var(--brand-dark)}.sl>span{flex:1;min-width:0}.sl strong{display:block;font-size:14px}.sl em{display:block;font-style:normal;font-size:12px;color:var(--muted)}.sl .go{color:var(--faint);--ico:16px}
    .cars{display:grid;gap:10px}
    .jc{display:flex;gap:14px;align-items:center;padding:14px 16px;transition:border-color 150ms var(--ease),transform 150ms var(--ease)}
    @media (hover:hover){.jc:hover{border-color:var(--brand)}}.jc:active{transform:scale(.995)}
    .jc.hot{border-left:3px solid var(--amber)}.jc.ready{border-left:3px solid var(--green)}
    .l{flex:1;min-width:0;display:grid;gap:3px}
    .plate{display:inline-block;width:max-content;font-size:14px;font-weight:800;letter-spacing:.05em;text-indent:.05em;padding:calc(2px + .05em) 8px calc(2px - .05em);border-radius:6px;background:var(--ink);color:var(--bg)}
    .l strong{font-size:14.5px;font-weight:600}.l .sub{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .r{display:grid;gap:6px;justify-items:end;flex-shrink:0;min-width:150px}
    .prom{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);--ico:13px}
    .ask{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--brand-dark);--ico:13px}
    .prog{width:110px;height:4px;border-radius:2px;background:var(--line);overflow:hidden}.prog i{display:block;height:100%;background:var(--brand);transition:width 600ms cubic-bezier(.45,0,.25,1)}
    .jc.ready .prog i{background:var(--green)}
    @media (max-width:640px){.jc{flex-direction:column;align-items:stretch}.r{justify-items:start;min-width:0}}`]
})
export class FloorComponent {
  router = inject(Router);
  on(k: FeatureKey){ return unlocked(this.cast.cast(), k, this.cast.tierQuery()); }
  tier(){ return tierOf(this.cast.cast(), this.cast.tierQuery()); }
  /* the picture: one floor per branch shown, the dock across the same branches; time is read when the jobs change */
  floors = computed(() => { const c = this.cast.cast(); const jobs = this.data.jobs(); const t = Date.now(); return c ? this.branches().map(b => ({ name: b.name, floor: floorOf(c, jobs, b.key, t) })) : []; });
  dockNow = computed(() => dockOf(this.data.jobs(), this.branch(), Date.now()));
  sheet = signal<{ tile?: Tile; job?: Job } | null>(null);
  sheetTitle = computed(() => { const s = this.sheet(); return s?.tile ? `Place a car in ${s.tile.space.label}` : s?.job ? `Place ${s.job.plate}` : ''; });
  pickFor(tile: Tile){ this.sheet.set({ tile }); }
  placeFor(job: Job){ this.sheet.set({ job }); }
  queueFor(branch: string){ return dockOf(this.data.jobs(), branch, Date.now()).queue; }
  freeFor(j: Job){ const c = this.cast.cast(); return c ? floorOf(c, this.data.jobs(), j.branch, Date.now()).tiles.filter(t => t.state === 'free').map(t => t.space) : []; }
  async place(j: Job, key: string){ try { await this.data.placeCar(j.id, key); this.data.toast(`${j.plate} is in ${spacesFor(this.cast.cast()!, j.branch).find(s => s.key === key)?.label}`); this.sheet.set(null); } catch (e: unknown) { this.data.toast(e instanceof Error ? e.message : String(e)); } }
  openJob(j: Job | null){ if (j) this.router.navigate(['/workshop/job', j.id]); }
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService);
  branch = signal(this.session.branch() || '');
  today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  branches = computed(() => (this.cast.cast()?.branches || []).filter(b => !this.branch() || b.key === this.branch()));
  open = computed(() => this.data.open().filter(j => !this.branch() || j.branch === this.branch()));
  ready = computed(() => this.open().filter(j => j.status === 'ready'));
  over = computed(() => this.open().filter(j => this.data.overrun(j) > 0));
  waiting = computed(() => this.open().filter(j => this.pending(j)));
  list = computed(() => [...this.open()].sort((a, b) => (this.data.overrun(b) - this.data.overrun(a)) || (a.status === 'ready' ? 1 : 0) - (b.status === 'ready' ? 1 : 0) || a.promisedAt.localeCompare(b.promisedAt)));
  inBranch(k: string){ return this.data.open().filter(j => j.branch === k && j.status === 'open'); }
  overIn(k: string){ return this.inBranch(k).filter(j => this.data.overrun(j) > 0); }
  slots(n: number){ return Array.from({ length: n }, (_, i) => i); }
  pending(j: Job){ return j.approvals.some(a => a.status === 'pending'); }
  date(iso: string){ return niceDate(iso); }
  sentQuotes(){ return this.data.quotes().filter(q => q.status === 'sent').length; }
}
