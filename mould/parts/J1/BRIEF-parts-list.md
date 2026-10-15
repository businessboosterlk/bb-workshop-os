Write the COMPLETE contents of one new file: apps/web/src/app/ui/parts-list.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: on a car's job card, the parts this job is waiting for or has used, with Add, Edit, Arrived and Fitted. It calls
the data service; the rules (a part arrives only when ordered, the last part arriving releases a car held for parts) live
there, never in this component.

EVERY TYPE IT READS, FIELD BY FIELD:
  import { Job, PartLine } from '../core/models';
    export type PartStatus = 'ordered' | 'arrived' | 'fitted';
    export interface PartLine { id: string; name: string; supplier?: string; status: PartStatus; orderedAt?: string; arrivedAt?: string; fittedAt?: string; }
    Job is large; the ONLY fields you may read are:
      id: string; plate: string; status: 'open' | 'ready' | 'delivered'; spaceKey?: string;
      hold?: 'parts' | 'approval' | 'curing'; parts?: PartLine[]   (parts may be missing: treat it as [])
  import { DataService, niceWhen } from '../core/data.service';
    data.addPart(jobId: string, name: string, supplier: string): Promise<unknown>
    data.editPart(jobId: string, partId: string, name: string, supplier: string): Promise<unknown>
        an EMPTY supplier string removes the supplier. Always pass a string, never undefined.
    data.partArrived(jobId: string, partId: string): Promise<unknown>
    data.partFitted(jobId: string, partId: string): Promise<unknown>
    data.job(id: string): Job | undefined     (the fresh copy, read after a change)
    data.toast(text: string): void
    niceWhen(iso?: string): string            (for example "Today 09:40")
    Every promise rejects with an Error whose message is already written for a person. Catch it as unknown and use
    (e instanceof Error ? e.message : String(e)).
  import { FormsModule } from '@angular/forms';  for [(ngModel)] on the two inputs
  import { DrawerComponent } from './drawer.component';   the one sheet:
    <bb-drawer [title]="text" [open]="boolean" (closed)="...">body ... <div foot>buttons</div></bb-drawer>
  import { IconComponent } from './icon.component';
  Global classes for the form: form-grid (the grid), field (label above input), span (full width field).

THE ACTION BAR RULE inside every <div foot> (a check measures it): its direct children are only
  (a) one button of class "btn" that fills the width, the primary first,
  (b) a <div class="pair"> holding exactly two buttons,
  (c) a last button of class "btn quiet" for Cancel.

THE COMPONENT, EXACTLY:
  selector 'bb-parts-list', class PartsListComponent, standalone, imports FormsModule, IconComponent, DrawerComponent.
  @Input({ required: true }) job!: Job;
  data = inject(DataService);
  sheet = signal<'' | 'add' | 'edit'>(''); editing = signal<PartLine | null>(null); busy = signal(false); err = signal('');
  name = ''; supplier = '';     (plain fields bound with [(ngModel)]; never read them inside a computed)
  parts(): PartLine[] returns this.job.parts ?? [].

THE CARD: <div class="card pl">, padding 14px 16px.
  Head, <div class="pl-h"> display flex, align-items center, justify-content space-between, gap 10px:
    left: <h3>Parts</h3> (14px, weight 700) and under it <span class="pl-n"> 12px var(--muted):
       some ordered: "{k} still to arrive" · none ordered but some parts: "All in" · no parts: "None yet"
    right, only when job.status === 'open': <button type="button" class="btn ghost sm pl-add" (click)="openAdd()"> icon 'plus' "Add a part"
  The list, <ul class="pl-list"> (no bullets, no padding, margin-top 8px), one <li class="pl-row" [attr.data-part]="p.id"
  [attr.data-status]="p.status"> per part, padding 12px 0, a 1px solid var(--line) top border on every row but the first:
    line 1, display flex, gap 10px, align-items center: <strong class="pl-name"> (flex 1, min-width 0, 14px, weight 600,
      ellipsis) then the status pill: ordered <span class="pill quoted">Ordered</span>, arrived <span class="pill new">Arrived</span>,
      fitted <span class="pill won">Fitted</span>.
    line 2, <span class="pl-sub"> 12.5px var(--muted), ellipsis: "{supplier} · " when there is a supplier, then
      ordered "Ordered {niceWhen(orderedAt)}", arrived "Arrived {niceWhen(arrivedAt)}", fitted "Fitted {niceWhen(fittedAt)}".
    line 3, <div class="pl-acts"> display grid, grid-template-columns repeat(2,minmax(0,1fr)), gap 8px, margin-top 10px. Every
      button type="button", class "btn ghost", width 100%, min-height 44px, min-width 0, label on one line (nowrap, ellipsis),
      [disabled]="busy()":
        ordered: <button class="btn ghost pl-arrived"> icon 'check' "It arrived"  and  <button class="btn ghost pl-edit"> icon 'edit' "Edit"
        arrived: <button class="btn ghost pl-fitted"> icon 'wrench' "Fitted"  and  the same Edit button
        fitted:  only the Edit button, spanning both columns (grid-column 1 / -1)
  No parts: <p class="pl-empty">No parts on this job. Add one when you order it.</p> 13px var(--muted), margin-top 8px.

THE ADD AND EDIT SHEET, one drawer:
  <bb-drawer [title]="sheet() === 'edit' ? 'Edit part' : 'Add a part'" [open]="sheet() !== ''" (closed)="close()">
    <div class="form-grid">
      <div class="field span"><label for="pl-name">Part</label><input id="pl-name" [(ngModel)]="name" placeholder="Left front door shell"></div>
      <div class="field span"><label for="pl-sup">Supplier (optional)</label><input id="pl-sup" [(ngModel)]="supplier" placeholder="Lanka Auto Parts"></div>
    </div>
    @if (err()) { <p class="err">{{ err() }}</p> }   (.err 13px, var(--red), weight 600, margin-top 12px)
    <div foot><button type="button" class="btn pl-save" [disabled]="busy()" (click)="save()"> icon 'check' then
      "Save changes" when editing, "Add the part" when adding</button>
      <button type="button" class="btn quiet" (click)="close()">Cancel</button></div>
  </bb-drawer>
  openAdd(): name '', supplier '', err '', editing null, sheet 'add'.
  openEdit(p): name p.name, supplier p.supplier ?? '', err '', editing p, sheet 'edit'.
  close(): sheet '', editing null, err ''.
  save(): if (!this.name.trim()) { err 'Add the part name'; return; } busy true; err '';
    editing set: await data.editPart(job.id, editing.id, name, supplier); toast 'Part saved'
    otherwise:   await data.addPart(job.id, name, supplier); toast 'Part ordered: ' + name.trim()
    then close(). On error: err.set(message). Finally busy false.
  arrived(p): const wasHeld = this.job.hold === 'parts'; const id = this.job.id, plate = this.job.plate;   (read BEFORE the await)
    busy; await data.partArrived(id, p.id); const after = data.job(id);
    if (wasHeld && after && !after.hold) toast(after.spaceKey ? 'Last part in. ' + plate + ' is back at work' : 'Last part in. ' + plate + ' is waiting for a space');
    else toast(p.name + ' arrived'). On error toast the message. Finally busy false.
  fitted(p): busy; await data.partFitted(job.id, p.id); toast(p.name + ' fitted'). On error toast. Finally busy false.
