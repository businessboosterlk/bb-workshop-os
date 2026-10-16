import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CastService } from '../../core/cast.service';
import { DataService, niceWhen } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { LockedCardComponent } from '../../ui/locked-card.component';
import { unlocked, FeatureKey } from '../../core/tiers';
import { DrawerComponent } from '../../ui/drawer.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { PartStatus } from '../../core/models';
import { partsBoard, PartRow } from '../../core/spaces';

const VIEW_KEY = 'wos_parts_view';

@Component({
  selector: 'bb-ws-parts',
  standalone: true,
  imports: [RouterLink, FormsModule, DragDropModule, IconComponent, DrawerComponent, FilterBarComponent, LockedCardComponent],
  template: `
    @if (!on('parts')) {
      <div class="ph"><div><h2 class="t-h1">Parts</h2><p>Every part ordered, arrived and fitted</p></div></div>
      <bb-locked feature="parts" [garage]="cast.cast()?.name || ''"/>
    } @else {
    <div class="ph">
      <div>
        <h2 class="t-h1">Parts</h2>
        <p>{{ count('ordered') }} on order · {{ count('arrived') }} arrived · {{ count('fitted') }} fitted</p>
      </div>
      <div class="ph-right">
        <div class="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" [class.on]="view() === 'board'" [attr.aria-selected]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/>Board</button>
          <button type="button" role="tab" [class.on]="view() === 'list'" [attr.aria-selected]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/>List</button>
        </div>
      </div>
    </div>

    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Search parts" label="Search by part, plate or supplier" [count]="filtered().length" noun="part" nouns="parts" store="parts"/>

    @if (view() === 'board') {
      <p class="t-small hint">Drag a card to the next stage. Tap a card to open it.</p>
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.key) {
          <section class="col" [attr.data-stage]="col.key" [attr.aria-label]="col.label">
            <header class="col-h">
              <span class="col-t"><i class="dot" [class]="'dot ' + col.key"></i>{{ col.label }}</span>
              <span class="col-n">{{ col.items.length }}</span>
            </header>
            <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
              @for (r of col.items; track r.part.id) {
                <article class="dc pc" [attr.data-part]="r.part.id" cdkDrag [cdkDragData]="r" [cdkDragStartDelay]="{ touch: 220, mouse: 0 }" (click)="open(r)" tabindex="0" (keydown.enter)="open(r)">
                  <i class="dc-rail" [class]="'dc-rail ' + r.part.status"></i>
                  <strong>{{ r.part.name }}</strong>
                  <span class="dc-sub">{{ r.job.plate }} · {{ r.job.make }} {{ r.job.model }}</span>
                  <span class="dc-meta">{{ r.part.supplier || 'No supplier' }} · {{ whenText(r) }}</span>
                  @if (r.part.status === 'ordered' && r.job.hold === 'parts') { <span class="dc-warn">The car is waiting for this</span> }
                  <div class="dc-ph" *cdkDragPlaceholder></div>
                </article>
              } @empty { <div class="col-empty">{{ emptyWord(col.key) }}</div> }
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="chips bar">
        @for (f of stageFilters; track f.k) {
          <button type="button" [class.on]="stage() === f.k" (click)="stage.set(f.k)">{{ f.label }}<b>{{ f.k === 'all' ? filtered().length : count(f.k) }}</b></button>
        }
      </div>
      <div class="card tbl-wrap desk">
        <table class="tbl">
          <thead><tr><th>Part</th><th>Car</th><th>Supplier</th><th>Stage</th><th>When</th></tr></thead>
          <tbody>
            @for (r of list(); track r.part.id) {
              <tr class="prow" [attr.data-part]="r.part.id" (click)="open(r)">
                <td><strong>{{ r.part.name }}</strong></td>
                <td>{{ r.job.plate }} · {{ r.job.make }} {{ r.job.model }}</td>
                <td>{{ r.part.supplier || 'Not set' }}</td>
                <td><span class="pill" [class]="'pill ' + pill(r.part.status)">{{ word(r.part.status) }}</span></td>
                <td class="t-small">{{ whenText(r) }}</td>
              </tr>
            } @empty { <tr><td colspan="5"><div class="empty"><strong>Nothing here</strong>Parts are added on a car's job card.</div></td></tr> }
          </tbody>
        </table>
      </div>
      <div class="mlist">
        @for (r of list(); track r.part.id) {
          <button type="button" class="card mq prow" [attr.data-part]="r.part.id" (click)="open(r)">
            <span class="r1"><strong>{{ r.part.name }}</strong><span class="pill" [class]="'pill ' + pill(r.part.status)">{{ word(r.part.status) }}</span></span>
            <span class="sub">{{ r.job.plate }} · {{ r.job.make }} {{ r.job.model }}</span>
            <span class="sub">{{ r.part.supplier || 'No supplier' }} · {{ whenText(r) }}</span>
          </button>
        } @empty { <div class="card empty"><strong>Nothing here</strong>Parts are added on a car's job card.</div> }
      </div>
    }

    <bb-drawer [title]="sel()?.part?.name || ''" [open]="!!sel()" (closed)="sel.set(null)" [editable]="!!sel()" (edit)="openEdit(sel()!)">
      @if (sel(); as r) {
        <div class="det">
          <div class="row"><span class="k">Stage</span><span class="v"><span class="pill" [class]="'pill ' + pill(r.part.status)">{{ word(r.part.status) }}</span></span></div>
          <div class="row"><span class="k">Car</span><span class="v">{{ r.job.plate }} · {{ r.job.make }} {{ r.job.model }}</span></div>
          <div class="row"><span class="k">Branch</span><span class="v">{{ branchName(r.job.branch) }}</span></div>
          <div class="row"><span class="k">Supplier</span><span class="v">{{ r.part.supplier || 'Not set' }}</span></div>
          @if (r.part.orderedAt) { <div class="row"><span class="k">Ordered</span><span class="v">{{ niceWhen(r.part.orderedAt) }}</span></div> }
          @if (r.part.arrivedAt) { <div class="row"><span class="k">Arrived</span><span class="v">{{ niceWhen(r.part.arrivedAt) }}</span></div> }
          @if (r.part.fittedAt) { <div class="row"><span class="k">Fitted</span><span class="v">{{ niceWhen(r.part.fittedAt) }}</span></div> }
        </div>
      }
      <div foot>
        @if (sel(); as r) {
          @if (r.part.status === 'ordered') {
            <button type="button" class="btn pb-arrived" [disabled]="busy()" (click)="arrived(r)"><bb-icon name="check"/>It arrived</button>
          } @else if (r.part.status === 'arrived') {
            <button type="button" class="btn pb-fitted" [disabled]="busy()" (click)="fitted(r)"><bb-icon name="wrench"/>Fitted</button>
          }
          <button type="button" class="btn ghost pb-open" (click)="openCar(r)"><bb-icon name="car"/>Open the car</button>
          <button type="button" class="btn quiet" (click)="sel.set(null)">Close</button>
        }
      </div>
    </bb-drawer>

    <bb-drawer title="Edit part" [open]="!!editing()" (closed)="editing.set(null)">
      <div class="form-grid">
        <div class="field span"><label for="pb-name">Part</label><input id="pb-name" [(ngModel)]="name"></div>
        <div class="field span"><label for="pb-sup">Supplier (optional)</label><input id="pb-sup" [(ngModel)]="supplier"></div>
      </div>
      @if (err()) { <p class="err">{{ err() }}</p> }
      <div foot>
        <button type="button" class="btn pb-save" [disabled]="busy()" (click)="save()"><bb-icon name="check"/>Save changes</button>
        <button type="button" class="btn quiet" (click)="editing.set(null)">Cancel</button>
      </div>
    </bb-drawer>
    }`,
  styles: [`
    .hint{margin:-8px 0 10px}
    .board{display:flex;gap:12px;overflow-x:auto;padding:2px 0 16px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;min-height:62vh;overscroll-behavior-x:contain}
    .col{flex:1 0 250px;max-width:340px;display:flex;flex-direction:column;scroll-snap-align:start}
    .col-h{display:flex;align-items:center;justify-content:space-between;padding:6px 6px 10px}
    .col-t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--muted)}.dot.ordered{background:var(--amber)}.dot.arrived{background:var(--blue)}.dot.fitted{background:var(--green)}
    .col-n{min-width:26px;height:22px;display:inline-grid;place-items:center;padding:2px 8px 0;font-size:11.5px;line-height:1;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:999px;font-variant-numeric:tabular-nums}
    .col-b{flex:1;display:flex;flex-direction:column;gap:8px;min-height:140px;padding:4px;border-radius:14px;background:var(--surface-2);transition:background var(--dur) var(--ease)}
    .col-b.cdk-drop-list-dragging{background:var(--brand-soft);outline:2px dashed var(--brand);outline-offset:-2px}
    .dc{position:relative;display:grid;gap:3px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 12px 12px 16px;cursor:grab;transition:border-color var(--dur) var(--ease);touch-action:pan-y}
    @media (hover:hover){.dc:hover{border-color:var(--line-2)}}.dc:active{cursor:grabbing}.dc:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
    .dc-rail{position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--line-2)}
    .dc-rail.ordered{background:var(--amber)}.dc-rail.arrived{background:var(--blue)}.dc-rail.fitted{background:var(--green)}
    .dc strong{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .dc-sub,.dc-meta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dc-warn{justify-self:start;margin-top:6px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--amber-soft);color:var(--amber)}
    .cdk-drag-preview{border-color:var(--brand);border-radius:12px;transform-origin:center;rotate:1.5deg}
    .cdk-drag-placeholder{opacity:0}.dc-ph{min-height:84px;border:2px dashed var(--line-2);border-radius:12px}
    .cdk-drag-animating{transition:transform 220ms cubic-bezier(.45,0,.25,1)}
    .col-b.cdk-drop-list-dragging .dc:not(.cdk-drag-placeholder){transition:transform 220ms cubic-bezier(.45,0,.25,1)}
    .col-empty{padding:26px 10px;text-align:center;font-size:12.5px;color:var(--faint);border:1px dashed var(--line-2);border-radius:12px}
    .bar{margin-bottom:14px}.bar b{margin-left:6px;font-weight:700;opacity:.7}
    .mlist{display:none}
    .det{display:grid;gap:0}
    .row{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}.row .k{width:92px;flex-shrink:0;color:var(--muted);font-size:12.5px;font-weight:600}.row .v{flex:1;min-width:0}
    .err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}
    @media (max-width:760px){.col{flex:0 0 84vw;max-width:none}.board{scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 16px;scroll-padding:0 16px}}
    @media (max-width:640px){.desk{display:none}.mlist{display:grid;gap:10px}
      .mq{display:grid;gap:3px;padding:14px 16px;text-align:left;font:inherit;color:inherit}.r1{display:flex;justify-content:space-between;align-items:center;gap:8px}.r1 strong{font-size:15px}.sub{font-size:12.5px;color:var(--muted)}}
    @media (prefers-reduced-motion:reduce){.cdk-drag-animating,.col-b.cdk-drop-list-dragging .dc{transition:none}}`]
})
export class WorkshopPartsComponent {
  on(k: FeatureKey){ return unlocked(this.cast.cast(), k, this.cast.tierQuery()); }
  cast = inject(CastService);
  data = inject(DataService);
  private router = inject(Router);
  readonly niceWhen = niceWhen;

  view = signal<'board' | 'list'>('board');
  stage = signal<'all' | PartStatus>('all');
  stageFilters = [
    { k: 'all' as const, label: 'All' },
    { k: 'ordered' as const, label: 'Ordered' },
    { k: 'arrived' as const, label: 'Arrived' },
    { k: 'fitted' as const, label: 'Fitted' }
  ];

  fstate = signal<Record<string, string>>({});
  fq = signal('');
  sel = signal<PartRow | null>(null);
  editing = signal<PartRow | null>(null);
  busy = signal(false);
  err = signal('');
  name = '';
  supplier = '';

  constructor() {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'board' || v === 'list') this.view.set(v);
    } catch {}
  }

  setView(v: 'board' | 'list') {
    this.view.set(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  fdefs = computed<FilterDef[]>(() => {
    const c = this.cast.cast();
    const suppliers = [...new Set(this.rows().map(r => r.part.supplier).filter((s): s is string => !!s))].sort();
    return [
      { key: 'branch', label: 'Branch', all: 'Every branch', options: (c?.branches || []).map(b => ({ value: b.key, label: b.name })) },
      { key: 'supplier', label: 'Supplier', all: 'Any supplier', options: suppliers.map(s => ({ value: s, label: s })) }
    ];
  });

  rows = computed(() => {
    const b = partsBoard(this.data.jobs(), this.fstate()['branch'] || '');
    return [...b.ordered, ...b.arrived, ...b.fitted];
  });

  filtered = computed(() => {
    const f = this.fstate(), q = this.fq().trim().toLowerCase();
    return this.rows().filter(r =>
      (!f['supplier'] || r.part.supplier === f['supplier']) &&
      (!q || [r.part.name, r.part.supplier || '', r.job.plate, r.job.make, r.job.model].join(' ').toLowerCase().includes(q))
    );
  });

  columns = computed(() => (['ordered', 'arrived', 'fitted'] as PartStatus[]).map(key => ({
    key,
    label: this.word(key),
    items: this.filtered().filter(r => r.part.status === key)
  })));

  list = computed(() => this.filtered().filter(r => this.stage() === 'all' || r.part.status === this.stage()));

  count(s: PartStatus) {
    return this.rows().filter(r => r.part.status === s).length;
  }

  word(s: string) {
    return ({ ordered: 'Ordered', arrived: 'Arrived', fitted: 'Fitted' } as Record<string, string>)[s];
  }

  pill(s: string) {
    return ({ ordered: 'quoted', arrived: 'new', fitted: 'won' } as Record<string, string>)[s];
  }

  emptyWord(k: string) {
    return ({
      ordered: 'Parts ordered on a job card land here',
      arrived: 'Drop here when a part comes in',
      fitted: 'Drop here once it is on the car'
    } as Record<string, string>)[k];
  }

  whenText(r: PartRow) {
    if (r.part.status === 'ordered') return 'Ordered ' + this.niceWhen(r.part.orderedAt);
    if (r.part.status === 'arrived') return 'Arrived ' + this.niceWhen(r.part.arrivedAt);
    return 'Fitted ' + this.niceWhen(r.part.fittedAt);
  }

  branchName(key: string) {
    return this.cast.branch(key)?.name || key;
  }

  open(r: PartRow) {
    this.sel.set(r);
  }

  fresh(r: PartRow): PartRow | null {
    return this.rows().find(x => x.part.id === r.part.id) || null;
  }

  async drop(ev: CdkDragDrop<PartStatus>) {
    const r: PartRow = ev.item.data;
    const to = ev.container.data;
    if (!r || r.part.status === to) return;
    if (r.part.status === 'ordered' && to === 'arrived') { await this.arrived(r); return; }
    if (r.part.status === 'arrived' && to === 'fitted') { await this.fitted(r); return; }
    this.data.toast('A part moves Ordered, then Arrived, then Fitted');
  }

  openCar(r: PartRow) {
    this.sel.set(null);
    this.router.navigate(['/workshop/job', r.job.id], { replaceUrl: true });
  }

  openEdit(r: PartRow) {
    this.name = r.part.name;
    this.supplier = r.part.supplier ?? '';
    this.err.set('');
    this.sel.set(null);
    this.editing.set(r);
  }

  async save() {
    const r = this.editing();
    if (!r) return;
    if (!this.name.trim()) { this.err.set('Add the part name'); return; }
    this.busy.set(true);
    try {
      await this.data.editPart(r.job.id, r.part.id, this.name.trim(), this.supplier.trim());
      this.data.toast('Part saved');
      this.editing.set(null);
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async arrived(r: PartRow) {
    const wasHeld = r.job.hold === 'parts';
    const jobId = r.job.id;
    this.busy.set(true);
    try {
      await this.data.partArrived(jobId, r.part.id);
      const after = this.data.job(jobId);
      if (wasHeld && after && !after.hold) {
        this.data.toast(after.spaceKey ? `Last part in. ${after.plate} is back at work` : `Last part in. ${after.plate} is waiting for a space`);
      } else {
        this.data.toast(`${r.part.name} arrived`);
      }
      if (this.sel()) this.sel.set(this.fresh(r));
    } catch (e: unknown) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async fitted(r: PartRow) {
    this.busy.set(true);
    try {
      await this.data.partFitted(r.job.id, r.part.id);
      this.data.toast(`${r.part.name} fitted`);
      if (this.sel()) this.sel.set(this.fresh(r));
    } catch (e: unknown) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
