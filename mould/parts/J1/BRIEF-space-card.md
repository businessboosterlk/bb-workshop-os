Write the COMPLETE contents of one new file: apps/web/src/app/ui/space-card.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: on a car's job card, the card that says where the car is on the garage floor and lets staff move it, hold it
and release it. It calls the data service; the rules live there, never in this component.

EVERY TYPE IT READS, FIELD BY FIELD:
  import { Job, Hold, SpaceDef } from '../core/models';
    export type Hold = 'parts' | 'approval' | 'curing';
    export interface SpaceDef { key: string; label: string; kind?: string; }
    Job is large; the ONLY fields you may read are:
      id: string; plate: string; branch: string; status: 'open' | 'ready' | 'delivered';
      spaceKey?: string; hold?: Hold; heldAt?: string;
  import { spacesFor } from '../core/spaces';
    spacesFor(cast: Cast, branchKey: string): SpaceDef[]     (every space of that branch, in order)
  import { Cast } from '../core/models';   (you only pass it to spacesFor)
  import { CastService } from '../core/cast.service';
    cast.cast(): Cast | null                                  (a signal: call it)
    cast.branch(key: string): { key: string; name: string } | undefined
  import { DataService, HOLD_WORDS, niceWhen } from '../core/data.service';
    data.jobs(): Job[]                                        (a signal: call it)
    data.spaceLabel(j: Job): string                           ('' when the car has no space)
    data.placeCar(jobId: string, spaceKey: string): Promise<unknown>   (also MOVES a car that already has a space)
    data.freeSpace(jobId: string): Promise<unknown>
    data.holdCar(jobId: string, reason: Hold, leaveBay: boolean): Promise<unknown>
    data.releaseCar(jobId: string): Promise<unknown>
    data.toast(text: string): void
    HOLD_WORDS: Record<Hold, string>   = { parts: 'Waiting for parts', approval: 'Waiting for approval', curing: 'Curing' }
    niceWhen(iso?: string): string     (for example "Today 09:40")
    Every promise rejects with an Error whose message is already written for a person. Catch it as unknown and toast
    (e instanceof Error ? e.message : String(e)).
  import { DrawerComponent } from './drawer.component';   the one sheet:
    <bb-drawer [title]="text" [open]="boolean" (closed)="...">body ... <div foot>buttons</div></bb-drawer>
  import { IconComponent } from './icon.component';

THE ACTION BAR RULE inside every <div foot> (a check measures it): its direct children are only
  (a) one button of class "btn" or "btn ghost" that fills the width, the primary first,
  (b) a <div class="pair"> holding exactly two buttons,
  (c) a last button of class "btn quiet" for Cancel.
  Never two loose buttons side by side.

THE COMPONENT, EXACTLY:
  selector 'bb-space-card', class SpaceCardComponent, standalone, imports IconComponent and DrawerComponent.
  @Input({ required: true }) job!: Job;
  @Input() canHold = true;    // false (a lower tier) hides Hold and Release completely; never a disabled button
  data = inject(DataService); cast = inject(CastService);
  sheet = signal<'' | 'move' | 'hold'>(''); busy = signal(false); reason = signal<Hold | ''>(''); leave = signal(true);
  where(): 'bay' | 'blocked' | 'dock' | 'queue'
    'bay' when job.spaceKey and no job.hold; 'blocked' when job.spaceKey and job.hold;
    'dock' when no job.spaceKey and job.hold; 'queue' otherwise.
  freeSpaces(): SpaceDef[] = spacesFor(cast, job.branch) without every space held by ANOTHER open job of the same branch:
    spaces.filter(s => !this.data.jobs().some(o => o.id !== this.job.id && o.status === 'open' && o.branch === this.job.branch && o.spaceKey === s.key))
    and never the car's own current space. Return [] when cast.cast() is null.

THE CARD: <div class="card sc" [attr.data-where]="where()">, padding 14px 16px.
  Row 1, display flex, gap 12px, align-items center:
    an icon square 40px by 40px, radius var(--r-s), display grid, place-items center, --ico:20px, flex none:
      bay: icon 'bay' on var(--brand-soft) in var(--brand-dark); blocked: icon 'pause' on var(--red-soft) in var(--red);
      dock: icon 'pause' on var(--amber-soft) in var(--amber); queue: icon 'clock' on var(--amber-soft) in var(--amber).
    then a column (flex 1, min-width 0) with three single lines (each ellipsis):
      <span class="sc-k">Where the car is</span>  12px, weight 600, var(--muted)
      <strong class="sc-where">  16px, weight 700:
         bay "{space label}" · blocked "{space label} · Bay blocked" · dock "In the holding dock" · queue "Waiting for a space"
      <span class="sc-sub">  13px, var(--muted):
         bay "{branch name}" · blocked and dock "{HOLD_WORDS[hold]} since {niceWhen(heldAt)}"
         queue "Place it when a space in {branch name} is free"
  Row 2, only when job.status === 'open': <div class="sc-acts">, display grid, grid-template-columns repeat(2,minmax(0,1fr)),
  gap 8px, margin-top 12px. Each button type="button", width 100%, min-height 44px, min-width 0:
    no hold: <button class="btn ghost sc-move"> icon 'move' and "Move" when the car has a space, "Place in a space" when not;
             then, only if canHold, <button class="btn ghost sc-hold"> icon 'pause' "Hold the car".
             When canHold is false the Move button spans both columns (class wide: grid-column 1 / -1).
    held:    only if canHold, ONE <button class="btn sc-release wide"> icon 'tick' "Release, no longer waiting".
  Button labels never wrap: white-space nowrap, overflow hidden, text-overflow ellipsis.

THE MOVE SHEET: <bb-drawer [title]="(job.spaceKey ? 'Move ' : 'Place ') + job.plate" [open]="sheet() === 'move'" (closed)="sheet.set('')">
  body: <p class="d-lead">Free spaces in {branch name}</p> then for each free space
    <button type="button" class="pick" [attr.data-space]="s.key" [disabled]="busy()" (click)="place(s)">
      <span class="pk-t"><strong>{label}</strong><em>Free now</em></span><bb-icon name="chev"/></button>
  none free: <div class="empty"><strong>Every space is taken</strong>The floor shows when the next one frees up.</div>
  foot: only when job.spaceKey, <button type="button" class="btn ghost sc-out" (click)="takeOut()">Take it out of {space label}</button>;
        always last <button type="button" class="btn quiet" (click)="sheet.set('')">Cancel</button>.
  place(s): busy; await data.placeCar(job.id, s.key); toast "{plate} is in {s.label}"; sheet ''. On error toast the message.
  takeOut(): busy; await data.freeSpace(job.id); toast "{plate} is waiting for a space"; sheet ''.

THE HOLD SHEET: <bb-drawer [title]="'Hold ' + job.plate" [open]="sheet() === 'hold'" (closed)="sheet.set('')">
  Opening it sets reason '' and leave true.
  body: <p class="d-lead">What is it waiting for?</p> then three <button type="button" class="opt" [attr.data-reason]="key"
    [attr.aria-pressed]="reason() === key" [class.on]="reason() === key" (click)="reason.set(key)"> with <strong>label</strong>:
      'parts' "Parts" · 'approval' "The customer's approval" · 'curing' "Paint curing"
  then, ONLY when job.spaceKey: <p class="d-lead">Where does it wait?</p> and two .opt buttons with [attr.data-leave]="'0'" and "'1'":
      leave false: <strong>Stay in {space label}</strong><em>The bay shows as blocked</em>
      leave true:  <strong>Go to the holding dock</strong><em>The bay is free for the next car</em>
  foot: <button type="button" class="btn sc-go" [disabled]="!reason() || busy()" (click)="doHold()">Hold the car</button>
        <button type="button" class="btn quiet" (click)="sheet.set('')">Cancel</button>
  doHold(): const r = reason(); if (!r) return; const leaveBay = this.job.spaceKey ? this.leave() : true;
    busy; await data.holdCar(job.id, r, leaveBay); toast job.spaceKey && leaveBay ? "{plate} moved to the holding dock" : "{plate} is on hold"; sheet ''.
  release(): busy; const had = !!job.spaceKey; await data.releaseCar(job.id);
    toast had ? "{plate} is back at work" : "{plate} is waiting for a space".
  Read job.spaceKey BEFORE the await in every handler: after the await the input may already hold the changed job.

STYLES (inline, use only the listed variables):
  .d-lead{font-size:12.5px;color:var(--muted);margin:14px 0 8px}  (the first one in a sheet: margin-top 0)
  .pick{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 12px;margin-bottom:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);text-align:left;--ico:16px;color:var(--ink)}
  .pick .pk-t{flex:1;min-width:0}.pick strong{display:block;font-size:14px}.pick em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
  .opt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;min-height:48px;padding:10px 12px;margin-bottom:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--ink);text-align:left}
  .opt strong{font-size:14px}.opt em{font-style:normal;font-size:12px;color:var(--muted)}
  .opt.on{border-color:var(--brand);background:var(--brand-soft)}
