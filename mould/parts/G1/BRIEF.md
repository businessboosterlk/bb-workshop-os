Write the COMPLETE contents of one new file: apps/web/src/app/pages/workshop/parts.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the parts board of a garage. Every part on every car still in the workshop, in three stages, Ordered, Arrived and
Fitted, shown two ways with one switch that is remembered: a BOARD (kanban, drag a card to the next stage, touch included) and
a LIST. A filter bar on top. Every part opens a sheet with Edit. Parts are ADDED on a car's job card, never here.
THE PATTERN TO COPY is the enquiries board of the same app, pasted in full at the end. Copy its structure, its board and list
markup, its classes and its CSS for the board, columns, cards, list table and phone list, its view switch and its use of the
filter bar. Translate every word to parts. Drop everything about quotes, sources, WhatsApp, lost reasons and adding.

EVERY TYPE IT READS, FIELD BY FIELD:
  import { Job, PartLine, PartStatus } from '../../core/models';
    export type PartStatus = 'ordered' | 'arrived' | 'fitted';
    export interface PartLine { id: string; name: string; supplier?: string; status: PartStatus; orderedAt?: string; arrivedAt?: string; fittedAt?: string; }
    Job is large; the ONLY fields you may read are: id: string; plate: string; make: string; model: string; branch: string;
      status: 'open' | 'ready' | 'delivered'; hold?: 'parts' | 'approval' | 'curing'; spaceKey?: string; parts?: PartLine[]
  import { partsBoard, PartRow } from '../../core/spaces';
    export interface PartRow { job: Job; part: PartLine; }
    partsBoard(jobs: Job[], branchKey: string): Record<PartStatus, PartRow[]>   ('' means every branch; delivered cars are left out)
  import { DataService, niceWhen } from '../../core/data.service';
    data.jobs(): Job[]   (a signal: call it)
    data.editPart(jobId: string, partId: string, name: string, supplier: string): Promise<unknown>   (an EMPTY supplier string removes it)
    data.partArrived(jobId: string, partId: string): Promise<unknown>    (only an ordered part; the last one in releases a car held for parts)
    data.partFitted(jobId: string, partId: string): Promise<unknown>     (only an arrived part)
    data.job(id: string): Job | undefined
    data.toast(text: string): void
    niceWhen(iso?: string): string
    Every promise rejects with an Error whose message is written for a person: catch as unknown, toast (e instanceof Error ? e.message : String(e)).
  import { CastService } from '../../core/cast.service';
    cast.cast(): { branches: { key: string; name: string }[] } | null   (a signal: call it);  cast.branch(key: string): { name: string } | undefined
  import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
    export interface FilterDef { key: string; label: string; all: string; options: { value: string; label: string }[]; }
    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Search parts" label="Search by part, plate or supplier"
      [count]="filtered().length" noun="part" nouns="parts" store="parts"/>
    fstate = signal<Record<string, string>>({}); fq = signal('');   (the bar writes these signals itself)
  import { DrawerComponent } from '../../ui/drawer.component';
    <bb-drawer [title]="text" [open]="boolean" (closed)="..." [editable]="boolean" (edit)="...">body<div foot>buttons</div></bb-drawer>
    editable true shows an Edit button in the sheet's head that emits (edit).
  import { RouterLink, Router } from '@angular/router';  import { FormsModule } from '@angular/forms';
  import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
  import { IconComponent } from '../../ui/icon.component';
  A TEMPLATE SEES ONLY CLASS MEMBERS: give niceWhen a class field (readonly niceWhen = niceWhen;) before using it in the template.

THE ACTION BAR RULE inside every <div foot> (a check measures it): direct children are only (a) one button of class "btn" or
"btn ghost" that fills the width, the primary first, (b) a <div class="pair"> holding exactly two buttons, (c) a last button
of class "btn quiet". Never two loose buttons side by side.

THE COMPONENT, EXACTLY:
  selector 'bb-ws-parts', class WorkshopPartsComponent, standalone, imports RouterLink, FormsModule, DragDropModule,
  IconComponent, DrawerComponent, FilterBarComponent.
  const VIEW_KEY = 'wos_parts_view'; view = signal<'board' | 'list'>('board'), read from localStorage in the constructor
  (inside try), setView(v) sets it and writes it (inside try).
  stage = signal<'all' | PartStatus>('all')   (the list's chips)
  fdefs = computed<FilterDef[]>: [{ key: 'branch', label: 'Branch', all: 'Every branch', options: branches as { value: key, label: name } },
    { key: 'supplier', label: 'Supplier', all: 'Any supplier', options: every distinct non-empty supplier on the board, sorted, value = label = the name }]
  rows = computed: const b = partsBoard(this.data.jobs(), this.fstate()['branch'] || ''); return [...b.ordered, ...b.arrived, ...b.fitted]
  filtered = computed: rows filtered by fstate()['supplier'] (exact) and by fq() lower case inside part name, part supplier,
    job plate, job make and job model joined. READ fstate() and fq() INSIDE the computed so typing re-filters.
  columns = computed: for key of ['ordered','arrived','fitted']: { key, label: 'Ordered' | 'Arrived' | 'Fitted', items: filtered rows with that status }
  list = computed: filtered rows where stage() is 'all' or the part status equals stage().
  count(s): filtered rows with that status.
  sel = signal<PartRow | null>(null); editing = signal<PartRow | null>(null); busy = signal(false); err = signal('');
  name = ''; supplier = '';
  A PartRow in sel or editing is a SNAPSHOT. After any change, find the fresh row again with
    fresh(r: PartRow): PartRow | null = the row in rows() whose part.id equals r.part.id (null if gone),
  and set sel to it, so the open sheet shows the new stage.

THE HEADER (like the enquiries .ph): <h2 class="t-h1">Parts</h2> and a <p>: "{count ordered} on order · {count arrived} arrived · {count fitted} fitted".
  On the right the same .seg switch with two buttons: icon 'board' "Board" and icon 'list' "List".
THE BOARD (view board): <p class="t-small hint">Drag a card to the next stage. Tap a card to open it.</p> then <div class="board" cdkDropListGroup>,
  one <section class="col" [attr.data-stage]="col.key"> per column, header with a dot and the label and <span class="col-n">{count}</span>,
  a cdkDropList body with [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)", one <article class="dc pc" [attr.data-part]="r.part.id"
  cdkDrag [cdkDragData]="r" [cdkDragStartDelay]="{ touch: 220, mouse: 0 }" (click)="open(r)" tabindex="0" (keydown.enter)="open(r)"> per row:
    <strong> part name, <span class="dc-sub"> "{plate} · {make} {model}", <span class="dc-meta"> supplier then " · " then the when
    text (ordered "Ordered {niceWhen(orderedAt)}", arrived "Arrived {niceWhen(arrivedAt)}", fitted "Fitted {niceWhen(fittedAt)}"),
    and on an ordered card held for parts (job.hold === 'parts') a <span class="dc-warn">The car is waiting for this</span>.
  Empty column text: ordered "Parts ordered on a job card land here", arrived "Drop here when a part comes in", fitted "Drop here once it is on the car".
  Dots: ordered var(--amber), arrived var(--blue), fitted var(--green). Card rails the same colours.
THE LIST (view list): the chips bar like the enquiries list (.chips bar) with All, Ordered, Arrived, Fitted and the count in <b>.
  Desk: <div class="card tbl-wrap desk"><table class="tbl"> columns Part, Car, Supplier, Stage, When; one <tr class="prow"
  [attr.data-part]="r.part.id" (click)="open(r)"> per row; the stage as a pill: ordered "pill quoted", arrived "pill new",
  fitted "pill won". Phone: <div class="mlist"> one <button type="button" class="card mq prow" [attr.data-part]="r.part.id"
  (click)="open(r)"> per row with the name and pill on line one, plate and car on line two, supplier and when on line three.
  Empty: <div class="empty"><strong>Nothing here</strong>Parts are added on a car's job card.</div>
DROP: drop(ev: CdkDragDrop<PartStatus>): r = ev.item.data, to = ev.container.data. Same stage: nothing.
  ordered to arrived: arrived(r). arrived to fitted: fitted(r). Anything else: toast "A part moves Ordered, then Arrived, then Fitted".
THE PART SHEET: <bb-drawer [title]="sel()?.part?.name || ''" [open]="!!sel()" (closed)="sel.set(null)" [editable]="!!sel()" (edit)="openEdit(sel()!)">
  body rows like the enquiries .row (k and v): Stage (the pill), Car "{plate} · {make} {model}", Branch (branch name), Supplier
  (or "Not set"), Ordered / Arrived / Fitted each with niceWhen when the date exists.
  foot: ordered: <button type="button" class="btn pb-arrived" [disabled]="busy()" (click)="arrived(sel()!)"> icon 'check' "It arrived";
        arrived: <button type="button" class="btn pb-fitted" ...> icon 'wrench' "Fitted";
        always then <button type="button" class="btn ghost pb-open" (click)="openCar(sel()!)"> icon 'car' "Open the car";
        last <button type="button" class="btn quiet" (click)="sel.set(null)">Close</button>.
  openCar(r): sel.set(null); router.navigate(['/workshop/job', r.job.id], { replaceUrl: true })   (leaving from inside a sheet replaces its history entry)
THE EDIT SHEET: <bb-drawer title="Edit part" [open]="!!editing()" (closed)="editing.set(null)">
  <div class="form-grid"><div class="field span"><label for="pb-name">Part</label><input id="pb-name" [(ngModel)]="name"></div>
  <div class="field span"><label for="pb-sup">Supplier (optional)</label><input id="pb-sup" [(ngModel)]="supplier"></div></div>
  @if (err()) { <p class="err">{{ err() }}</p> }
  foot: <button type="button" class="btn pb-save" [disabled]="busy()" (click)="save()"> icon 'check' "Save changes"; <button type="button" class="btn quiet" (click)="editing.set(null)">Cancel</button>
  openEdit(r): name r.part.name, supplier r.part.supplier ?? '', err '', sel.set(null), editing.set(r)   (close the part sheet first, then open this one)
  save(): empty name: err "Add the part name", return. busy; await data.editPart(r.job.id, r.part.id, name, supplier); toast "Part saved";
    editing.set(null). On error err.set(message). finally busy false.
  arrived(r): read r.job.hold and r.job.id BEFORE the await; busy; await data.partArrived(...); after = data.job(id);
    toast (wasHeld parts && after && !after.hold) ? "Last part in. {plate} is waiting for a space" (or "is back at work" when after.spaceKey) : "{name} arrived";
    if sel() is open set it to fresh(r). On error toast. finally busy false.
  fitted(r): busy; await data.partFitted(...); toast "{name} fitted"; if sel() is open set it to fresh(r).

THE PATTERN FILE, apps/web/src/app/pages/workshop/enquiries.component.ts, in full:
{{ENQ}}
