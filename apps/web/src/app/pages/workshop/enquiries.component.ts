import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CastService } from '../../core/cast.service';
import { SessionService, normalise } from '../../core/session.service';
import { DataService, niceWhen, waLink, daysSince } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { PERIODS, Period, inPeriod, quoteTotal } from '../../core/sales';
import { Enquiry, EnquiryStatus } from '../../core/models';

/* The sales line, two views of the same enquiries, one switch, remembered: the BOARD (the
   kanban, drag a card between stages, touch included) and the LIST. Taken from the Hub's
   pipeline (bb-client-os pages/sales/pipeline.component.ts), which Thulaib asked for on
   9 Sep 2026: "kanban AND a list with a switch". A drop never skips a rule: Lost asks why,
   Quoted opens the quote, Booked opens Car in already filled. Nothing here carries a price. */
const VIEW_KEY = 'wos_enq_view';
@Component({
  selector: 'bb-ws-enquiries',
  standalone: true,
  imports: [RouterLink, FormsModule, DragDropModule, IconComponent, DrawerComponent, FilterBarComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Enquiries</h2><p>{{ data.newEnquiries().length }} new · {{ count('quoted') }} quoted · {{ bookedMonth() }} booked this month</p></div>
      <div class="ph-right">
        <div class="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" [class.on]="view() === 'board'" [attr.aria-selected]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/>Board</button>
          <button type="button" role="tab" [class.on]="view() === 'list'" [attr.aria-selected]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/>List</button>
        </div>
        <button class="btn sm" type="button" (click)="openAdd()"><bb-icon name="plus"/>New enquiry</button>
      </div></div>

    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Name, phone or plate" [count]="filtered().length" noun="enquiry" nouns="enquiries" store="enquiries"/>
    @if (view() === 'board') {
      <p class="t-small hint">Drag a card to move it. Tap a card to open it.</p>
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.key) {
          <section class="col" [class.done]="col.key === 'booked' || col.key === 'lost'" [attr.aria-label]="col.label">
            <header class="col-h"><span class="col-t"><i class="dot" [class]="'dot ' + col.key"></i>{{ col.label }}</span><span class="col-n">{{ col.items.length }}</span></header>
            <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
              @for (e of col.items; track e.id) {
                <article class="dc" cdkDrag [cdkDragData]="e" [cdkDragStartDelay]="{ touch: 220, mouse: 0 }" (click)="sel.set(e)" tabindex="0" (keydown.enter)="sel.set(e)">
                  <i class="dc-rail" [class]="'dc-rail ' + e.status"></i>
                  <strong>{{ e.name }}</strong>
                  <span class="dc-sub">{{ e.make ? e.make + ' ' + e.model : e.phone }}@if (e.plate) { · {{ e.plate }} }</span>
                  <span class="dc-svc"><bb-icon name="wrench"/>{{ cast.service(e.service)?.label }}</span>
                  <span class="dc-meta">{{ e.source }} · {{ ago(e) }}</span>
                  @if (e.status === 'new' && daysSince(e.createdAt) >= 2) { <span class="dc-warn" [class.red]="daysSince(e.createdAt) >= 4">{{ daysSince(e.createdAt) }} days without a reply</span> }
                  @if (e.status === 'lost' && e.lostReason) { <span class="dc-why">{{ e.lostReason }}</span> }
                  <div class="dc-ph" *cdkDragPlaceholder></div>
                </article>
              } @empty { <div class="col-empty">{{ emptyWord(col.key) }}</div> }
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="chips bar">
        @for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}<b>{{ f.k === 'open' ? data.openEnquiries().length : f.k === 'all' ? data.enquiries().length : count(f.k) }}</b></button> }
      </div>
      <div class="card tbl-wrap desk">
        <table class="tbl">
          <thead><tr><th>Customer</th><th>Car</th><th>Work</th><th>Came from</th><th>Stage</th><th></th></tr></thead>
          <tbody>
            @for (e of list(); track e.id) {
              <tr (click)="sel.set(e)">
                <td><div class="who"><strong>{{ e.name }}</strong><span>{{ e.phone }}</span></div></td>
                <td><div class="who"><strong class="nw">{{ e.plate || '' }}</strong><span>{{ e.make }} {{ e.model }}</span></div></td>
                <td>{{ cast.service(e.service)?.label }}<br><span class="t-small">{{ cast.branch(e.branch)?.name }}</span></td>
                <td class="t-small">{{ e.source }}<br>{{ ago(e) }}</td>
                <td><span class="pill" [class]="'pill ' + pill(e.status)">{{ word(e.status) }}</span></td>
                <td class="acts" (click)="$event.stopPropagation()"><a class="btn wa sm icon" [href]="wa(e)" target="_blank" rel="noreferrer" aria-label="WhatsApp"><bb-icon name="wa"/></a></td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty"><strong>Nothing here</strong>Log the next call or WhatsApp as a new enquiry.</div></td></tr> }
          </tbody>
        </table>
      </div>
      <div class="mlist">
        @for (e of list(); track e.id) {
          <button type="button" class="card mq" (click)="sel.set(e)">
            <span class="r1"><strong>{{ e.name }}</strong><span class="pill" [class]="'pill ' + pill(e.status)">{{ word(e.status) }}</span></span>
            <span class="sub">{{ e.phone }}@if (e.plate) { · {{ e.plate }} }@if (e.make) { · {{ e.make }} {{ e.model }} }</span>
            <span class="sub">{{ cast.service(e.service)?.label }} · {{ e.source }} · {{ ago(e) }}</span>
          </button>
        } @empty { <div class="card empty"><strong>Nothing here</strong>Log the next call or WhatsApp as a new enquiry.</div> }
      </div>
    }

    <bb-drawer [title]="sel()?.name || ''" [open]="!!sel()" (closed)="sel.set(null)" [editable]="!!sel() && sel()!.status !== 'booked'" (edit)="openEdit(sel()!)">
      @if (sel(); as e) {
        <div class="det">
          <div class="sum"><span class="pill" [class]="'pill ' + pill(e.status)">{{ word(e.status) }}</span><span class="t-small">{{ ago(e) }} via {{ e.source }}</span></div>
          <div class="row"><span class="k">Phone</span><span class="v">{{ e.phone }}</span></div>
          @if (e.plate || e.make) { <div class="row"><span class="k">Car</span><span class="v">{{ e.plate }} {{ e.make }} {{ e.model }}</span></div> }
          <div class="row"><span class="k">Work</span><span class="v">{{ cast.service(e.service)?.label }} at {{ cast.branch(e.branch)?.name }}</span></div>
          <div class="row"><span class="k">Came from</span><span class="v">{{ e.source }} · {{ ago(e) }}@if (e.by) { · logged by {{ e.by }} }</span></div>
          @if (e.note) { <div class="row"><span class="k">They asked</span><span class="v">{{ e.note }}</span></div> }
          @if (e.lostReason) { <div class="row"><span class="k">Lost</span><span class="v why">{{ e.lostReason }}</span></div> }
        </div>
        @if (session.owner() && quoteOf(e); as qt) {
          <a class="card qc" [routerLink]="['/workshop/quote', qt.id]" (click)="sel.set(null)">
            <span class="qi"><bb-icon name="quote"/></span>
            <span class="qt"><span class="q1"><strong>{{ qt.number }}</strong><strong class="qa">{{ cast.money(total(qt)) }}</strong></span><span class="q2">{{ qword(qt.status) }}</span></span>
            <bb-icon name="chev" class="go"/>
          </a>
        }
        <div class="hist">
          <h4>History</h4>
          @for (a of historyOf(e); track a.id) { <div class="h"><i></i><span><strong>{{ a.summary }}</strong><em>{{ a.by }} · {{ when(a.createdAt) }}</em></span></div> }
          @empty { <p class="t-small">Nothing logged yet.</p> }
        </div>
      }
      <div foot>
        @if (sel(); as e) {
          @if (e.status === 'new' || e.status === 'quoted') {
            <button class="btn" type="button" (click)="toBook(e)"><bb-icon name="car"/>Book the car in</button>
            <div class="pair">
              <a class="btn wa-ghost" [href]="wa(e)" target="_blank" rel="noreferrer"><bb-icon name="wa"/>WhatsApp</a>
              @if (session.owner()) { <button class="btn ghost" type="button" (click)="toQuote(e)"><bb-icon name="quote"/>{{ e.quoteId ? 'Open quote' : 'Make a quote' }}</button> }
            </div>
            <button class="btn quiet warn" type="button" (click)="openLost(e)">Mark as lost</button>
          } @else if (e.status === 'lost') {
            <button class="btn" type="button" (click)="reopen(e)">Reopen enquiry</button>
            <div class="pair"><a class="btn wa-ghost" [href]="wa(e)" target="_blank" rel="noreferrer"><bb-icon name="wa"/>WhatsApp</a></div>
          } @else {
            @if (e.jobId) { <a class="btn" [routerLink]="['/workshop/job', e.jobId]" (click)="sel.set(null)"><bb-icon name="car"/>Open the car</a> }
            <div class="pair"><a class="btn wa-ghost" [href]="wa(e)" target="_blank" rel="noreferrer"><bb-icon name="wa"/>WhatsApp</a></div>
          }
        }
      </div>
    </bb-drawer>

    <bb-drawer [title]="editingId() ? 'Edit enquiry' : 'New enquiry'" [open]="adding()" (closed)="adding.set(false)">
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
      <div foot><button class="btn" type="button" (click)="save()"><bb-icon name="check"/>{{ editingId() ? 'Save changes' : 'Save enquiry' }}</button><button class="btn quiet" type="button" (click)="adding.set(false)">Cancel</button></div>
    </bb-drawer>

    <bb-drawer title="Mark as lost" [open]="!!losing()" (closed)="losing.set(null)">
      <p class="t-small">One line on why. Over a month the reasons show the owner what to fix.</p>
      <div class="chips pick">@for (r of reasons; track r) { <button type="button" [class.on]="reason === r" (click)="reason = r">{{ r }}</button> }</div>
      <div class="field" style="margin-top:12px"><label for="lr">Or in your words</label><input id="lr" [(ngModel)]="reason" placeholder="Went with a place closer to home"></div>
      <div foot><button class="btn" type="button" [disabled]="!reason.trim()" (click)="lose()">Mark as lost</button><button class="btn quiet" type="button" (click)="losing.set(null)">Cancel</button></div>
    </bb-drawer>`,
  styles: [`
    .hint{margin:-8px 0 10px}
    .board{display:flex;gap:12px;overflow-x:auto;padding:2px 0 16px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;min-height:62vh;overscroll-behavior-x:contain}
    .col{flex:1 0 250px;max-width:340px;display:flex;flex-direction:column;scroll-snap-align:start}
    .col-h{display:flex;align-items:center;justify-content:space-between;padding:6px 6px 10px}
    .col-t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--muted)}.dot.new{background:var(--brand)}.dot.quoted{background:var(--amber)}.dot.booked{background:var(--green)}.dot.lost{background:var(--faint)}
    .col-n{min-width:26px;height:22px;display:inline-grid;place-items:center;padding:2px 8px 0;font-size:11.5px;line-height:1;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:999px;font-variant-numeric:tabular-nums}
    .col-b{flex:1;display:flex;flex-direction:column;gap:8px;min-height:140px;padding:4px;border-radius:14px;background:var(--surface-2);transition:background var(--dur) var(--ease)}
    .col-b.cdk-drop-list-dragging{background:var(--brand-soft);outline:2px dashed var(--brand);outline-offset:-2px}
    .col.done .dc{opacity:.86}
    .dc{position:relative;display:grid;gap:3px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 12px 12px 16px;cursor:grab;transition:border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease);touch-action:pan-y}
    .dc:hover{border-color:var(--line-2)}.dc:active{cursor:grabbing}.dc:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
    .dc-rail{position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--line-2)}
    .dc-rail.new{background:var(--brand)}.dc-rail.quoted{background:var(--amber)}.dc-rail.booked{background:var(--green)}
    .dc strong{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .dc-sub,.dc-meta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dc-svc{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;margin-top:4px;--ico:13px}.dc-svc bb-icon{color:var(--brand-dark)}
    .dc-warn{justify-self:start;margin-top:6px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--amber-soft);color:var(--amber)}.dc-warn.red{background:var(--red-soft);color:var(--red)}
    .dc-why{font-size:12px;color:var(--amber);font-weight:600;margin-top:4px}
    .cdk-drag-preview{box-shadow:var(--sh-lg);border-radius:12px;transform-origin:center;rotate:1.5deg}
    .cdk-drag-placeholder{opacity:0}.dc-ph{min-height:84px;border:2px dashed var(--line-2);border-radius:12px}
    .cdk-drag-animating{transition:transform 220ms cubic-bezier(.45,0,.25,1)}
    .col-b.cdk-drop-list-dragging .dc:not(.cdk-drag-placeholder){transition:transform 220ms cubic-bezier(.45,0,.25,1)}
    .col-empty{padding:26px 10px;text-align:center;font-size:12.5px;color:var(--faint);border:1px dashed var(--line-2);border-radius:12px}
    .bar{margin-bottom:14px}.bar b{margin-left:6px;font-weight:700;opacity:.7}
    .nw{white-space:nowrap}.acts{text-align:right}
    .mlist{display:none}
    .det{display:grid;gap:0}
    .sum{display:flex;align-items:center;gap:10px;padding-bottom:12px}
    .qc{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:14px;transition:border-color var(--dur) var(--ease)}.qc:hover{border-color:var(--brand)}
    .qi{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-dark);--ico:18px;flex-shrink:0}
    .qt{flex:1;min-width:0}.q1{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.q1 strong{font-size:14px}.q2{display:block;font-size:12px;color:var(--muted);margin-top:2px}.qa{font-variant-numeric:tabular-nums;white-space:nowrap}.qc .go{color:var(--faint);--ico:16px}
    .hist{margin-top:18px}.hist h4{font-size:12px;font-weight:600;color:var(--muted);margin:0 0 8px}
    .h{position:relative;display:flex;gap:12px;padding:0 0 12px 0}.h i{width:8px;height:8px;border-radius:50%;background:var(--line-2);margin-top:6px;flex-shrink:0}
    .h strong{display:block;font-size:13px;font-weight:500}.h em{display:block;font-style:normal;font-size:12px;color:var(--muted);margin-top:1px}
    .row{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}.row .k{width:92px;flex-shrink:0;color:var(--muted);font-size:12.5px;font-weight:600}.row .v{flex:1;min-width:0}.why{color:var(--amber);font-weight:600}
    .pick{margin-top:12px}.err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}
    @media (max-width:760px){.col{flex:0 0 84vw;max-width:none}.board{scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 16px;scroll-padding:0 16px}}
    @media (max-width:640px){.desk{display:none}.mlist{display:grid;gap:10px}
      .mq{display:grid;gap:3px;padding:14px 16px;text-align:left;font:inherit;color:inherit}.r1{display:flex;justify-content:space-between;align-items:center;gap:8px}.r1 strong{font-size:15px}.sub{font-size:12.5px;color:var(--muted)}}
    @media (prefers-reduced-motion:reduce){.cdk-drag-animating,.col-b.cdk-drop-list-dragging .dc{transition:none}}`]
})
export class WorkshopEnquiriesComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  daysSince = daysSince;
  view = signal<'board' | 'list'>('board');
  filter = signal<'open' | 'new' | 'quoted' | 'booked' | 'lost' | 'all'>('open');
  filters = [{ k: 'open', label: 'Open' }, { k: 'new', label: 'New' }, { k: 'quoted', label: 'Quoted' }, { k: 'booked', label: 'Booked' }, { k: 'lost', label: 'Lost' }, { k: 'all', label: 'Everything' }] as const;
  reasons = ['Price', 'Went elsewhere', 'No reply', 'Only asking', 'Insurance did not approve'];
  adding = signal(false); losing = signal<Enquiry | null>(null); sel = signal<Enquiry | null>(null); err = signal(''); reason = ''; editingId = signal('');
  f: any = {};
  constructor(){
    try { const v = localStorage.getItem(VIEW_KEY); if (v === 'board' || v === 'list') this.view.set(v); } catch {}
    this.route.queryParamMap.subscribe(p => {
      if (p.get('add')) this.openAdd();
      const f = p.get('f'); if (f && ['open', 'new', 'quoted', 'booked', 'lost', 'all'].includes(f)) { this.filter.set(f as any); this.setView('list'); }
      const v = p.get('view'); if (v === 'board' || v === 'list') this.setView(v);
    });
  }
  setView(v: 'board' | 'list'){ this.view.set(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} }
  /* filters apply to the board and the list alike */
  fstate = signal<Record<string, string>>({}); fq = signal('');
  fdefs = computed<FilterDef[]>(() => { const c = this.cast.cast();
    return [ { key: 'branch', label: 'Branch', all: 'Both branches', options: (c?.branches || []).map(b => ({ value: b.key, label: b.name })) },
      { key: 'service', label: 'Service', all: 'All services', options: (c?.services || []).map(x => ({ value: x.key, label: x.label })) },
      { key: 'source', label: 'Came from', all: 'Any source', options: (c?.sources || []).map(x => ({ value: x, label: x })) },
      { key: 'period', label: 'When', all: 'Any time', options: PERIODS.filter(p => p.value !== 'all') } ]; });
  filtered = computed(() => { const f = this.fstate(), q = this.fq().trim().toLowerCase();
    return this.data.enquiries().filter(e => (!f['branch'] || e.branch === f['branch']) && (!f['service'] || e.service === f['service']) && (!f['source'] || e.source === f['source'])
      && inPeriod(e.createdAt, (f['period'] || 'all') as Period) && (!q || [e.name, e.phone, e.plate, e.make, e.model].join(' ').toLowerCase().includes(q))); });
  columns = computed(() => (['new', 'quoted', 'booked', 'lost'] as EnquiryStatus[]).map(key => ({ key, label: this.word(key), items: this.filtered().filter(e => e.status === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })));
  list = computed(() => { const f = this.filter(); return this.filtered().filter(e => f === 'all' || (f === 'open' ? (e.status === 'new' || e.status === 'quoted') : e.status === f)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); });
  bookedMonth = computed(() => { const m = new Date().toISOString().slice(0, 7); return this.data.enquiries().filter(e => e.status === 'booked' && e.updatedAt.slice(0, 7) === m).length; });
  count(s: string){ return this.data.enquiries().filter(e => e.status === s).length; }
  word(s: string){ return ({ new: 'New', quoted: 'Quoted', booked: 'Booked', lost: 'Lost' } as any)[s]; }
  pill(s: string){ return ({ new: 'new', quoted: 'quoted', booked: 'won', lost: 'lost' } as any)[s]; }
  emptyWord(k: string){ return ({ new: 'New enquiries land here', quoted: 'Drop here to make a quote', booked: 'Drop here to book the car in', lost: 'Nothing lost' } as any)[k]; }
  ago(e: Enquiry){ return niceWhen(e.createdAt); }
  wa(e: Enquiry){ return waLink(e.phone, `Hello ${e.name.split(' ')[0]}, this is ${this.session.name()} from ${this.cast.cast()?.name}. `); }

  /* a drop is a request to move; the rules decide what actually happens */
  async drop(ev: CdkDragDrop<EnquiryStatus>){
    const e: Enquiry = ev.item.data; const to = ev.container.data; if (!e || e.status === to) return;
    if (to === 'lost') { this.openLost(e); return; }
    if (to === 'quoted') { if (e.quoteId) { await this.data.updateEnquiry(e.id, { status: 'quoted', lostReason: undefined }); this.data.toast('Moved to Quoted'); } else this.toQuote(e); return; }
    if (to === 'booked') { if (e.jobId) { await this.data.updateEnquiry(e.id, { status: 'booked' }); this.data.toast('Moved to Booked'); } else this.toBook(e); return; }
    if (to === 'new') { await this.reopen(e); }
  }
  toQuote(e: Enquiry){
    if (!this.session.owner()) { this.data.toast('Quotes are made by the owner. Ask Miflal to quote this one.'); return; }
    this.sel.set(null); if (e.quoteId) this.router.navigate(['/workshop/quote', e.quoteId]); else this.router.navigate(['/workshop/quote', 'new'], { queryParams: { enquiry: e.id } });
  }
  toBook(e: Enquiry){ this.sel.set(null); this.router.navigate(['/workshop/new'], { queryParams: { enquiry: e.id } }); }
  async reopen(e: Enquiry){ await this.data.updateEnquiry(e.id, { status: e.quoteId && e.status !== 'lost' ? 'quoted' : 'new', lostReason: undefined }); this.sel.set(null); this.data.toast('Back to New'); }
  openAdd(){ this.editingId.set(''); const c = this.cast.cast(); this.f = { name: '', phone: '', source: c?.sources?.[0] || 'WhatsApp', service: c?.services[0]?.key, branch: this.session.branch() || c?.branches[0]?.key, plate: '', make: '', model: '', note: '' }; this.err.set(''); this.adding.set(true); }
  openEdit(e: Enquiry){ this.f = { name: e.name, phone: e.phone, source: e.source, service: e.service, branch: e.branch, plate: e.plate || '', make: e.make || '', model: e.model || '', note: e.note || '' }; this.editingId.set(e.id); this.err.set(''); this.sel.set(null); this.adding.set(true); }
  async save(){ this.err.set(''); const phone = normalise(this.f.phone); if (!this.f.name.trim()) return this.err.set('Add their name.'); if (!phone) return this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX.');
    try {
      if (this.editingId()) { const r = await this.data.editEnquiry(this.editingId(), { ...this.f, phone }); this.adding.set(false); this.data.toast('Changes saved'); if (r) this.sel.set(r); }
      else { await this.data.addEnquiry({ ...this.f, phone, plate: (this.f.plate || '').toUpperCase().trim() }); this.adding.set(false); this.data.toast('Enquiry saved'); }
    } catch (e: any) { this.err.set(e.message); } }
  quoteOf(e: Enquiry){ return e.quoteId ? this.data.quotes().find(q => q.id === e.quoteId) || null : null; }
  total(q: any){ return quoteTotal(q); }
  qword(s: string){ return ({ draft: 'Draft', sent: 'Sent, waiting for an answer', accepted: 'Accepted', declined: 'Declined' } as any)[s]; }
  historyOf(e: Enquiry){ return this.data.activities().filter(a => a.enquiryId === e.id || (!!e.jobId && a.jobId === e.jobId && a.type === 'new') || (!!e.quoteId && a.quoteId === e.quoteId)).slice(0, 12); }
  when(iso: string){ return niceWhen(iso); }
  openLost(e: Enquiry){ this.sel.set(null); this.reason = ''; this.losing.set(e); }
  async lose(){ const e = this.losing(); if (!e) return; await this.data.loseEnquiry(e.id, this.reason); this.losing.set(null); this.data.toast('Marked lost'); }
}
