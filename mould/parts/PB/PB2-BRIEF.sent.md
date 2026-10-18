PART PB2 of the Workshop OS (a garage system in Sri Lanka). Web app: Angular 19 standalone component, TypeScript strict, signals, the new control flow (@if, @for). File: apps/web/src/app/pages/workshop/job.component.ts, the staff job card.

THE JOB. Payments are now lines on a job; paid and balance are worked out from the lines by the engine, never typed. The job card shows money by seat:
- OWNER (`session.owner()`): Estimate, Approved, Paid, Balance, the payment lines, Record payment, and Correct on each live line.
- FRONT DESK (`session.desk()`): Balance, the payment lines and Record payment. Nothing else: no estimate, no approved, no paid figure, no Correct.
- PLAIN STAFF: no money block at all (no money word, no figure, no line).
`session.collects()` is true for the owner and the desk. Also: the Deliver and close sheet shows a refused save in its own message slot inside the sheet, not in a toast.

TYPES AND FUNCTIONS THIS PART READS (already written and checked; import them, never change them).
From apps/web/src/app/core/payments.ts:
- `export type PayMethod = 'cash' | 'card' | 'bank' | 'cheque';`
- `export interface Payment { id: string; no: string; at: string; recordedAt: string; amount: number; method: PayMethod; by: string; note?: string; reverses?: string; op?: string; }` (no: the receipt number 'R-YYYYMM-NNN', '' on a correction; at: the day the money moved, YYYY-MM-DD; by: the seat name)
- `export interface PaymentLine extends Payment { reversedBy?: string; }` (reversedBy set means this payment has been corrected)
- `paidOf(job): number`, `balanceOf(job): number` (approved minus paid, or the server's balance for a desk seat), `lines(job): PaymentLine[]` (the payments without the correction lines, newest first, each corrected one carrying reversedBy). Each takes a Job.
From apps/web/src/app/core/data.service.ts (DataService is injected as `data`):
- `recordPayment(jobId: string, input: { amount: number; method: PayMethod; at: string; note?: string }): Promise<{ job: Job; payment: Payment | null }>` throws an Error whose message is the reason to show (for example 'That is more than the 95000 still owed on this car', 'The date cannot be in the future', 'This seat cannot do that.'). payment is null when the write is waiting for signal.
- `correctPayment(jobId: string, paymentId: string): Promise<Job | null>` throws the same way. Owner only.
- `setMoney(jobId: string, patch: { estimate?: number; approved?: number })`: it no longer takes paid.
- `toast(text: string)` and `toastMsg` (a signal holding the app's one shared toast, set it to null to clear it).
- exported function `localDay(): string`, today on this phone as YYYY-MM-DD.
From the cast service (`cast`): `cast.money(n?: number): string` gives 'LKR 95,000' (empty string for 0 or nothing); `cast.word('currency', 'LKR')`.
From the session (`session`): `owner()`, `desk()`, `collects()`, `name()`.
Global CSS that already exists (use it, never redefine it): `.card`, `.sec-head`, `.btn`, `.btn.ghost`, `.btn.sm`, `.btn.quiet`, `.chips` (a row of pill buttons, `button.on` is the chosen one), `.field`, `.form-grid`, `.span`, `.t-small`, `.num` (tabular figures), `.toast` with `.toast.on` (the fixed dark message at the bottom; a `button` inside it is its action). A sheet is `<bb-drawer title=".." [open]=".." (closed)="closeSheet()">` with body content and one action bar `<div foot>`: the primary `.btn` full width first, the quiet `.btn.quiet` Cancel last.

THE CURRENT FILE:
```ts
import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, niceDate, niceWhen, waLink } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { PhasesComponent } from '../../ui/phases.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { SpaceCardComponent } from '../../ui/space-card.component';
import { PartsListComponent } from '../../ui/parts-list.component';
import { CompareComponent } from '../../ui/compare.component';
import { unlocked, FeatureKey } from '../../core/tiers';
import { shrink, demoPhoto } from '../../core/photo';
import { normalise } from '../../core/session.service';
import { Job } from '../../core/models';
import { minutesLeft } from '../../core/spaces';
import { addWorkingMinutes, workingDaysLeft } from '../../core/calendar';

/* The job card, the screen staff live on. One big button: close the phase that is
   running, which needs a photo. Then the smaller things: move the date with a reason,
   ask the customer, the pickup, deliver. Money is on this screen only for the owner. */
type Sheet = '' | 'phase' | 'date' | 'ask' | 'pickup' | 'deliver' | 'money' | 'note' | 'edit';
@Component({
  selector: 'bb-ws-job',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, PhasesComponent, DrawerComponent, SpaceCardComponent, PartsListComponent, CompareComponent],
  template: `
    @if (job(); as j) {
      <a class="back" routerLink="/workshop/cars"><bb-icon name="back"/>Cars</a>
      <div class="head">
        <div class="id"><span class="plate">{{ j.plate }}</span><h2>{{ j.make }} {{ j.model }}@if (j.colour) { <em>{{ j.colour }}</em> }</h2>
          <p>{{ cast.service(j.service)?.label }} · {{ cast.branch(j.branch)?.name }}@if (j.insurance) { · Insurance{{ j.insurer ? ', ' + j.insurer : '' }} }</p></div>
        <div class="st">
          @if (j.status === 'delivered') { <span class="pill won"><i class="dot"></i>Delivered {{ when(j.deliveredAt) }}</span> }
          @else if (j.status === 'ready') { <span class="pill won"><i class="dot"></i>Ready for pickup</span> }
          @else if (over() > 0) { <span class="pill quoted"><i class="dot"></i>{{ over() }} h over</span> }
          @else { <span class="pill brand"><i class="dot"></i>On time</span> }
        </div>
      </div>
      <div class="grid">
        <div class="col">
          @if (j.status === 'open') {
            <button class="big" type="button" (click)="openSheet('phase')">
              <span class="bi"><bb-icon name="camera"/></span>
              <span class="bt"><em>Close this phase, with a photo</em><strong>{{ data.phaseNow(j)?.label }}</strong></span>
              <bb-icon name="chev" class="go"/>
            </button>
          } @else if (j.status === 'ready') {
            <button class="big ok" type="button" (click)="openSheet('deliver')">
              <span class="bi"><bb-icon name="check"/></span>
              <span class="bt"><em>The customer has the car</em><strong>Deliver and close</strong></span>
              <bb-icon name="chev" class="go"/>
            </button>
          }
          <!-- an even grid, never a wrapped row: 2 across on a phone, 3 on a desk -->
          <div class="acts" [class.done]="j.status === 'delivered'">
            @if (j.status !== 'delivered') {
              <button class="btn ghost" type="button" (click)="openSheet('date')"><bb-icon name="clock"/>Move the date</button>
              <button class="btn ghost" type="button" (click)="openSheet('ask')"><bb-icon name="alert"/>Ask the customer</button>
              <button class="btn ghost" type="button" (click)="openSheet('pickup')"><bb-icon name="truck"/>Pickup and drop</button>
            }
            <button class="btn ghost" type="button" (click)="openSheet('note')"><bb-icon name="note"/>Add a note</button>
            <button class="btn ghost" type="button" (click)="openSheet('edit')"><bb-icon name="edit"/>Edit details</button>
            <a class="btn wa-ghost" [href]="wa(j)" target="_blank" rel="noreferrer"><bb-icon name="wa"/>WhatsApp {{ j.customerName.split(' ')[0] }}</a>
          </div>
          <!-- J1, the job card controls (15 Oct 2026, built by the crew): where the car is, move, hold, release; its parts -->
          @if (j.status === 'open') { <bb-space-card [job]="j" [canHold]="on('dock')"/> }
          @if (j.status !== 'delivered' && on('parts')) { <bb-parts-list [job]="j"/> }
          <div class="card cust">
            <div class="row"><span class="k">Customer</span><span class="v">{{ j.customerName }} · {{ j.customerPhone }}</span></div>
            <div class="row"><span class="k">Promised</span><span class="v">{{ date(j.promisedAt) }}@if (j.promiseHistory.length) { <i class="moved">moved {{ j.promiseHistory.length }}x</i> }</span></div>
            <!-- the forecast beside the promise (review, 16 Oct): remaining stages at their usual hours on the working calendar -->
            @if (j.status === 'open' && forecast(j); as fc) { <div class="row"><span class="k">Forecast</span><span class="v" [class.late]="fc.late">{{ fc.word }}@if (fc.late) { · past the promise } @else { · {{ fc.days }} working {{ fc.days === 1 ? 'day' : 'days' }} of work left }</span></div> }
            @if (j.pickup.wanted) { <div class="row"><span class="k">Pickup and drop</span><span class="v">{{ j.pickup.address }} · {{ j.pickup.status }}@if (j.pickup.driver) { · {{ j.pickup.driver }} }@if (j.pickup.eta) { · {{ j.pickup.eta }} }</span></div> }
            @if (j.notes) { <div class="row"><span class="k">Notes</span><span class="v">{{ j.notes }}</span></div> }
          </div>
          @for (a of j.approvals; track a.id) {
            <div class="card ap" [class.pend]="a.status === 'pending'">
              <div class="ap-h"><strong>{{ a.title }}</strong>
                @if (a.status === 'pending') { <span class="pill new">Waiting on customer</span> } @else if (a.status === 'approved') { <span class="pill won">Approved {{ when(a.answeredAt) }}</span> } @else { <span class="pill lost">Declined {{ when(a.answeredAt) }}</span> }</div>
              @if (a.detail) { <p>{{ a.detail }}</p> }
              @if (a.amount && session.owner()) { <span class="amt">{{ cast.money(a.amount) }}</span> }
            </div>
          }
          @if (session.owner()) {
            <div class="card money">
              <div class="sec-head"><h3>Money</h3><button class="btn ghost sm" type="button" (click)="openSheet('money')"><bb-icon name="edit"/>Edit</button></div>
              <div class="m3"><div><em>Estimate</em><strong>{{ cast.money(j.estimate) || 'none' }}</strong></div><div><em>Approved</em><strong>{{ cast.money(j.approved) || 'none' }}</strong></div><div><em>Paid</em><strong>{{ cast.money(j.paid) || 'none' }}</strong></div></div>
              @if ((j.approved || 0) > (j.paid || 0)) { <p class="due">{{ cast.money((j.approved || 0) - (j.paid || 0)) }} still to collect</p> }
            </div>
          }
        </div>
        <div class="col">
          <!-- BEFORE AND AFTER (16 Oct 2026): the first photo of the job against the latest, with a handle to drag -->
          @if (pair(j); as pr) {
            <div class="card ba"><div class="sec-head"><h3>Before and after</h3><span>drag the handle</span></div>
              <bb-compare [before]="pr.before.dataUrl" [after]="pr.after.dataUrl" [beforeLabel]="pr.beforeLabel" [afterLabel]="pr.afterLabel"/></div>
          }
          <div class="card tl"><div class="sec-head"><h3>{{ data.doneCount(j) }} of {{ j.phases.length }} phases</h3><span>{{ data.photosOf(j.id).length }} {{ data.photosOf(j.id).length === 1 ? 'photo' : 'photos' }}</span></div><bb-phases [job]="j" [staff]="true"/></div>
          <div class="card act">
            <div class="sec-head"><h3>What happened</h3></div>
            <div class="list">
              @for (a of data.activityFor(j.id); track a.id) { <div class="li"><span class="ic"><bb-icon [name]="icon(a.type)"/></span><span class="tx"><strong>{{ a.summary }}</strong><span>{{ a.by }} · {{ when(a.createdAt) }}</span></span></div> }
            </div>
          </div>
        </div>
      </div>

      <bb-drawer [title]="'Close: ' + (data.phaseNow(j)?.label || '')" [open]="sheet() === 'phase'" (closed)="closeSheet()">
        <p class="t-small">A phase closes only with a photo from the bay. The customer sees it the moment you tap Close.</p>
        <div class="shot" [class.has]="!!photo()">
          @if (photo()) { <img [src]="photo()" alt="The photo about to be saved"> } @else { <bb-icon name="camera"/><span>No photo yet</span> }
        </div>
        <div class="shot-btns">
          <label class="btn"><bb-icon name="camera"/>Take photo<input type="file" accept="image/*" capture="environment" (change)="pick($event)" hidden></label>
          @if (data.mode() === 'local') { <button class="btn ghost" type="button" (click)="photo.set(demo(j.plate, data.phaseNow(j)?.label || ''))">Use a demo photo</button> }
        </div>
        <div class="field" style="margin-top:14px"><label for="pn">Note for the record (optional)</label><input id="pn" [(ngModel)]="note" placeholder="Colour matched at the third mix"></div>
        <div foot><button class="btn" type="button" [disabled]="!photo() || busy()" (click)="closePhase()"><bb-icon name="check"/>Close {{ data.phaseNow(j)?.label }}</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Move the promised date" [open]="sheet() === 'date'" (closed)="closeSheet()">
        <p class="t-small">The customer sees the new date and your reason, word for word. A date never moves silently.</p>
        <div class="form-grid"><div class="field span"><label for="nd">New date</label><input id="nd" type="date" [class.empty]="!newDate" [(ngModel)]="newDate"></div>
          <div class="field span"><label for="rs">Because</label><textarea id="rs" [(ngModel)]="reason" placeholder="The insurer took two extra days to approve the estimate"></textarea></div></div>
        <div foot><button class="btn" type="button" [disabled]="!newDate || !reason.trim() || busy()" (click)="moveDate()">Move the date</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Ask the customer" [open]="sheet() === 'ask'" (closed)="closeSheet()">
        <p class="t-small">Extra work found mid job goes to the customer's phone as a card. Nothing starts until they tap Approve.</p>
        <div class="form-grid"><div class="field span"><label for="at">What needs doing</label><input id="at" [(ngModel)]="askTitle" placeholder="Replace the front left headlamp"></div>
          <div class="field span"><label for="ad">Why, in one or two lines</label><textarea id="ad" [(ngModel)]="askDetail" placeholder="The lamp housing is cracked inside. A new unit fits the colour match better than a repair."></textarea></div>
          <div class="field span"><label for="aa">Cost, {{ cast.word('currency', 'LKR') }} (optional)</label><input id="aa" type="number" inputmode="numeric" [(ngModel)]="askAmount" placeholder="24500"></div></div>
        <div foot><button class="btn" type="button" [disabled]="!askTitle.trim() || busy()" (click)="ask()">Send to the customer</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Pickup and drop" [open]="sheet() === 'pickup'" (closed)="closeSheet()">
        <div class="form-grid">
          <div class="field span"><label for="pw">Does this car use pickup and drop?</label><select id="pw" [(ngModel)]="pk.wanted"><option [ngValue]="true">Yes</option><option [ngValue]="false">No, the customer brings it</option></select></div>
          @if (pk.wanted) {
            <div class="field span"><label for="pa">Address</label><input id="pa" [(ngModel)]="pk.address" placeholder="Nugegoda"></div>
            <div class="field"><label for="ps">Where is it</label><select id="ps" [(ngModel)]="pk.status"><option value="booked">Booked</option><option value="collected">Collected, car is here</option><option value="returned">Returned to the customer</option></select></div>
            <div class="field"><label for="pd">Driver</label><input id="pd" [(ngModel)]="pk.driver" placeholder="Sampath"></div>
            <div class="field span"><label for="pe">When (the customer reads this)</label><input id="pe" [(ngModel)]="pk.eta" placeholder="Today 4 pm"></div>
          }
        </div>
        <div foot><button class="btn" type="button" [disabled]="busy()" (click)="savePickup()">Save</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Deliver and close" [open]="sheet() === 'deliver'" (closed)="closeSheet()">
        <p class="t-small">The customer's app shows Delivered, asks them to rate the work and keeps the job in their history. {{ session.name() }} is recorded as the person who handed over.</p>
        @if (session.owner() && (j.approved || 0) > (j.paid || 0)) { <p class="due">{{ cast.money((j.approved || 0) - (j.paid || 0)) }} is still unpaid on this job.</p> }
        <div foot><button class="btn" type="button" [disabled]="busy()" (click)="deliver()"><bb-icon name="check"/>Delivered</button><button class="btn quiet" type="button" (click)="closeSheet()">Not yet</button></div>
      </bb-drawer>

      <bb-drawer title="Money" [open]="sheet() === 'money'" (closed)="closeSheet()">
        <div class="form-grid"><div class="field"><label for="me">Estimate</label><input id="me" type="number" inputmode="numeric" [(ngModel)]="m.estimate"></div>
          <div class="field"><label for="ma">Approved</label><input id="ma" type="number" inputmode="numeric" [(ngModel)]="m.approved"></div>
          <div class="field"><label for="mp">Paid so far</label><input id="mp" type="number" inputmode="numeric" [(ngModel)]="m.paid"></div></div>
        <div foot><button class="btn" type="button" [disabled]="busy()" (click)="saveMoney()">Save</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Edit details" [open]="sheet() === 'edit'" (closed)="closeSheet()">
        <p class="t-small">Correct the car or the customer. The customer's phone is their login, so a new number moves every car and job they have. The service cannot change once work has started.</p>
        <div class="form-grid">
          <div class="field"><label for="xp">Plate</label><input id="xp" [(ngModel)]="ex.plate" autocapitalize="characters"></div>
          <div class="field"><label for="xc">Colour</label><input id="xc" [(ngModel)]="ex.colour"></div>
          <div class="field"><label for="xm">Make</label><input id="xm" [(ngModel)]="ex.make"></div>
          <div class="field"><label for="xo">Model</label><input id="xo" [(ngModel)]="ex.model"></div>
          <div class="field"><label for="xb">Branch</label><select id="xb" [(ngModel)]="ex.branch">@for (b of cast.cast()?.branches; track b.key) { <option [value]="b.key">{{ b.name }}</option> }</select></div>
          @if (j.insurance) { <div class="field"><label for="xi">Insurer</label><input id="xi" [(ngModel)]="ex.insurer"></div> }
          <div class="field span"><label for="xn">Customer name</label><input id="xn" [(ngModel)]="ex.name"></div>
          <div class="field span"><label for="xph">Customer phone</label><input id="xph" type="tel" inputmode="tel" [(ngModel)]="ex.phone"></div>
          <div class="field span"><label for="xno">Notes</label><textarea id="xno" [(ngModel)]="ex.notes"></textarea></div>
        </div>
        @if (err()) { <p class="err">{{ err() }}</p> }
        <div foot><button class="btn" type="button" [disabled]="busy()" (click)="saveEdit()"><bb-icon name="check"/>Save changes</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>

      <bb-drawer title="Note" [open]="sheet() === 'note'" (closed)="closeSheet()">
        <div class="field"><label for="nt">For the record</label><textarea id="nt" [(ngModel)]="noteText" placeholder="Customer called, will collect Friday"></textarea></div>
        <div foot><button class="btn" type="button" [disabled]="!noteText.trim() || busy()" (click)="saveNote()">Save</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>
      </bb-drawer>
    } @else { <div class="empty"><strong>No such car</strong></div> }`,
  styles: [`
    .back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;font-weight:600;min-height:36px;--ico:16px;margin-left:-4px}
    .head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:6px 0 18px;flex-wrap:wrap}
    .plate{display:inline-block;font-size:20px;font-weight:800;letter-spacing:.05em;text-indent:.05em;padding:calc(4px + .05em) 10px calc(4px - .05em);border-radius:8px;background:var(--ink);color:var(--bg)}
    .head h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-top:8px}.head h2 em{font-style:normal;font-weight:500;color:var(--muted);font-size:15px;margin-left:8px}
    .head p{color:var(--muted);font-size:13px;margin-top:3px}
    .grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:16px}
    /* minmax(0, ...) on every track and min-width 0 on the columns: a column must never grow to the width of its buttons' labels (17 Sep 2026: the action grid ran 622px wide on a 390px phone) */
    @media (max-width:900px){.grid{grid-template-columns:minmax(0,1fr)}}
    .col{display:grid;gap:12px;align-content:start;min-width:0}
    .big{display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;border:0;border-radius:16px;background:var(--brand);color:var(--on-accent);text-align:left;transition:transform 150ms var(--ease),filter 150ms var(--ease)}
    @media (hover:hover){.big:hover{filter:brightness(1.05)}}.big:active{transform:scale(.99)}
    .big.ok{background:var(--green);color:#fff}
    .bi{width:46px;height:46px;border-radius:12px;background:rgba(0,0,0,.14);display:grid;place-items:center;--ico:24px;flex-shrink:0}
    .bt{flex:1;min-width:0}.bt em{display:block;font-style:normal;font-size:12px;font-weight:600;opacity:.8}.bt strong{display:block;font-size:18px;font-weight:700;letter-spacing:-.01em;margin-top:2px}
    .go{opacity:.7;--ico:18px}
    .acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0}.acts .btn{width:100%;min-width:0;min-height:44px;padding:0 10px}
    @media (max-width:420px){.acts .btn{font-size:13px;gap:6px}}
    @media (max-width:1300px){.acts{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .err{margin-top:12px;color:var(--red);font-size:13px;font-weight:600}
    .cust{padding:6px 16px}.row{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13.5px}.row:first-child{border-top:0}
    .row .k{width:110px;flex-shrink:0;color:var(--muted);font-size:12.5px;font-weight:600}.row .v{flex:1;min-width:0}
    .v.late{color:var(--red);font-weight:600}
    .moved{font-style:normal;font-size:10.5px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:1px 7px;border-radius:999px;margin-left:6px}
    .ap{padding:14px 16px}.ap.pend{border-color:var(--brand)}.ap-h{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.ap-h strong{font-size:14px}
    .ap p{font-size:13px;color:var(--ink-2);margin-top:6px}.amt{display:block;margin-top:6px;font-weight:700;font-variant-numeric:tabular-nums}
    .money{padding:16px}.m3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.m3 em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}.m3 strong{display:block;font-size:15px;margin-top:3px;font-variant-numeric:tabular-nums}
    .due{margin-top:10px;font-size:12.5px;font-weight:600;color:var(--amber)}
    .tl,.act,.ba{padding:16px}.ba bb-compare{margin-top:12px}
    .shot{margin-top:12px;aspect-ratio:4/3;border-radius:12px;border:1px dashed var(--line-2);background:var(--surface-2);display:grid;place-items:center;color:var(--muted);--ico:34px;overflow:hidden;text-align:center;gap:6px}
    .shot.has{border-style:solid}.shot img{width:100%;height:100%;object-fit:cover;display:block}.shot span{font-size:12.5px}
    .shot-btns{display:flex;gap:8px;margin-top:10px}.shot-btns .btn{flex:1}`]
})
export class WorkshopJobComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  id = signal(this.route.snapshot.paramMap.get('id') || '');
  job = computed(() => this.data.job(this.id()));
  over = computed(() => { const j = this.job(); return j ? this.data.overrun(j) : 0; });
  sheet = signal<Sheet>(''); busy = signal(false);
  photo = signal(''); note = ''; newDate = ''; reason = ''; askTitle = ''; askDetail = ''; askAmount: number | null = null; noteText = '';
  pk: any = { wanted: false, status: 'none' }; m: any = {}; ex: any = {}; err = signal('');
  on(k: FeatureKey){ return unlocked(this.cast.cast(), k, this.cast.tierQuery()); }
  constructor(){ this.route.paramMap.subscribe(p => this.id.set(p.get('id') || '')); }
  openSheet(s: Sheet){ const j = this.job(); if (!j) return;
    if (s === 'pickup') this.pk = { ...j.pickup, status: j.pickup.status === 'none' ? 'booked' : j.pickup.status };
    if (s === 'money') this.m = { estimate: j.estimate || 0, approved: j.approved || 0, paid: j.paid || 0 };
    if (s === 'date') this.newDate = j.promisedAt.slice(0, 10);
    if (s === 'edit') { this.err.set(''); this.ex = { plate: j.plate, make: j.make, model: j.model, colour: j.colour || '', branch: j.branch, insurer: j.insurer || '', notes: j.notes || '', name: j.customerName, phone: j.customerPhone }; }
    this.sheet.set(s); }
  closeSheet(){ this.sheet.set(''); this.photo.set(''); this.note = ''; this.reason = ''; this.askTitle = ''; this.askDetail = ''; this.askAmount = null; this.noteText = ''; }
  async pick(e: Event){ const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; try { this.photo.set(await shrink(f)); } catch { this.data.toast('That file is not a photo'); } }
  demo(plate: string, phase: string){ return demoPhoto(plate, phase, document.documentElement.getAttribute('data-theme') === 'dark'); }
  async closePhase(){ if (!this.photo() || this.busy()) return; this.busy.set(true);
    try { const j = this.job()!; const label = this.data.phaseNow(j)?.label; await this.data.completePhase(j.id, this.photo(), this.note); this.closeSheet(); this.data.toast(label + ' done. The customer can see it.'); }
    catch (e: any) { this.data.toast(e.message || 'Could not close the phase'); } finally { this.busy.set(false); } }
  async moveDate(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPromise(this.id(), new Date(this.newDate + 'T17:00:00').toISOString(), this.reason); this.closeSheet(); this.data.toast('Date moved. The customer sees why.'); } catch (e: any) { this.data.toast(e.message || 'Could not move the date'); } finally { this.busy.set(false); } }
  async ask(){ if (this.busy()) return; this.busy.set(true); try { await this.data.askApproval(this.id(), this.askTitle, this.askDetail, this.askAmount ? Number(this.askAmount) : undefined); this.closeSheet(); this.data.toast('Sent to the customer'); } catch (e: any) { this.data.toast(e.message || 'Could not send it to the customer'); } finally { this.busy.set(false); } }
  async savePickup(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPickup(this.id(), this.pk.wanted ? { ...this.pk } : { wanted: false, status: 'none' }); this.closeSheet(); this.data.toast('Pickup saved'); } catch (e: any) { this.data.toast(e.message || 'Could not save the pickup'); } finally { this.busy.set(false); } }
  async deliver(){ if (this.busy()) return; this.busy.set(true); try { await this.data.deliver(this.id()); this.closeSheet(); this.data.toast('Delivered. The car moves to history.'); } catch (e: any) { this.data.toast(e.message || 'Could not deliver the car'); } finally { this.busy.set(false); } }
  async saveMoney(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setMoney(this.id(), { estimate: +this.m.estimate || 0, approved: +this.m.approved || 0, paid: +this.m.paid || 0 }); this.closeSheet(); } catch (e: any) { this.data.toast(e.message || 'Could not save the money'); } finally { this.busy.set(false); } }
  /* the car's own fields on the job; the customer's name and phone through the customer, so the login follows */
  async saveEdit(){ if (this.busy()) return; this.err.set(''); const j = this.job(); if (!j) return;
    const phone = normalise(this.ex.phone); if (!phone) { this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX.'); return; }
    this.busy.set(true);
    try {
      const cu = this.data.customers().find(c => c.id === j.customerId);
      if (cu && (cu.name !== this.ex.name.trim() || cu.phone !== phone)) await this.data.saveCustomer({ id: cu.id, name: this.ex.name, phone, vehicles: cu.vehicles.map(v => ({ ...v, was: v.plate })) });
      await this.data.editJob(j.id, { plate: this.ex.plate, make: this.ex.make, model: this.ex.model, colour: this.ex.colour, branch: this.ex.branch, insurer: this.ex.insurer, notes: this.ex.notes });
      this.closeSheet(); this.data.toast('Changes saved');
    } catch (e: any) { this.err.set(e.message); } finally { this.busy.set(false); } }
  async saveNote(){ if (this.busy()) return; this.busy.set(true); try { await this.data.addNote(this.id(), this.noteText); this.closeSheet(); } catch (e: any) { this.data.toast(e.message || 'Could not save the note'); } finally { this.busy.set(false); } }
  wa(j: any){ return waLink(j.customerPhone, `Hello ${j.customerName.split(' ')[0]}, this is ${this.session.name()} at ${this.cast.cast()?.name} about ${j.plate}. `); }
  icon(t: string){ return ({ phase: 'check', note: 'note', promise: 'clock', approval: 'alert', pickup: 'truck', delivered: 'tick', new: 'car', enquiry: 'inbox', quote: 'quote', followup: 'phone' } as any)[t] || 'note'; }
  /* the forecast from the same calendar the floor uses; late when it lands after the promised day */
  forecast(j: Job){ const now = Date.now(); const mins = minutesLeft(j, now); const at = addWorkingMinutes(now, mins); const p = new Date(j.promisedAt); p.setHours(23, 59, 59, 999);
    return { word: niceDate(at.toISOString()), days: workingDaysLeft(mins), late: at.getTime() > p.getTime() }; }
  /* the first and the latest photo of the job, with the stage each was taken at; nothing when there is only one */
  pair(j: Job){ const ph = [...this.data.photosOf(j.id)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); if (ph.length < 2) return null;
    const label = (k: string) => j.phases.find(p => p.key === k)?.label || 'Photo';
    return { before: ph[0], after: ph[ph.length - 1], beforeLabel: label(ph[0].phaseKey), afterLabel: label(ph[ph.length - 1].phaseKey) }; }
  date(iso?: string){ return niceDate(iso); } when(iso?: string){ return niceWhen(iso); }
}
```

WHAT TO WRITE. Return ONE ```ts code block holding the parts below, each opened by its header line exactly as shown (copy each header line character for character, it is a merge marker), in this order. Each part REPLACES the lines of the file from the line holding `start` up to, not including, the next line holding `until`. Write only the replacement lines, at the file's indentation.

Part 1 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=import { DataService, niceDate, niceWhen, waLink } | until=import { IconComponent }`
Two lines: the data service import with `localDay` added to its list, then `import { balanceOf, paidOf, lines, PaymentLine, PayMethod } from '../../core/payments';`

Part 2 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=type Sheet = | until=@Component({`
The Sheet type with `| 'pay' | 'fix'` added at the end.

Part 3 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=          @if (session.owner()) { | until=        <div class="col">`
Replaces the owner money card AND the `        </div>` line that closes the first column (write that closing line last). The new card, for `session.collects()`:
```
          @if (session.collects()) {
            <div class="card money">
              <div class="sec-head"><h3>Money</h3>@if (session.owner()) { <button class="btn ghost sm" type="button" (click)="openSheet('money')"><bb-icon name="edit"/>Edit</button> }</div>
              <div class="m4" [class.one]="!session.owner()">
                (owner only, in this order: three figures Estimate from j.estimate, Approved from j.approved, Paid from paid(j))
                (everyone with the card: the figure Balance from balance(j))
              </div>
              (when payLines(j) has lines: <div class="pays"> with one <div class="pay" [class.gone]="!!l.reversedBy"> per line, track l.id)
              <button class="btn pay-add" type="button" (click)="openSheet('pay')"><bb-icon name="money"/>Record payment</button>
            </div>
          }
        </div>
```
Each figure is exactly `<div class="fig"><em>LABEL</em><strong class="num">{{ cast.money(VALUE) || 'none' }}</strong></div>`.
Each line holds, in this order: `<span class="pt"><strong class="no">{{ l.no }}</strong><span>{{ date(l.at) }} · {{ methodWord(l.method) }} · {{ l.by }}</span></span>`, then `<span class="pa num">{{ cast.money(l.amount) }}</span>`, then `@if (l.reversedBy) { <span class="tag">Corrected</span> } @else if (session.owner()) { <button class="btn ghost sm pay-fix" type="button" (click)="askFix(l)">Correct</button> }`.

Part 4 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=      <bb-drawer title="Deliver and close" | until=      <bb-drawer title="Edit details"`
Four sheets, each followed by one empty line:
(a) Deliver and close: the same first paragraph as now; the unpaid line becomes `@if (session.collects() && balance(j) > 0) { <p class="due">{{ cast.money(balance(j)) }} is still unpaid on this job.</p> }`; the foot is `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }` then the two buttons exactly as now `</div>`.
(b) Money: first `<p class="t-small">Paid is worked out from the payments on the job card. To change what was paid, record a payment or correct one.</p>`, then the form grid with ONLY the Estimate and Approved fields as now (the Paid so far field is gone), then the foot exactly as now.
(c) Record payment: `<bb-drawer title="Record payment" [open]="sheet() === 'pay'" (closed)="closeSheet()">`, body: `<p class="t-small">The receipt number is given when you save. The customer sees the payment on their phone.</p>` then `<div class="form-grid">` holding: `<div class="field span"><label for="pya">Amount, {{ cast.word('currency', 'LKR') }}</label><input id="pya" type="number" inputmode="numeric" [(ngModel)]="pay.amount"></div>`; `<div class="field span"><label>How they paid</label><div class="chips">@for (mt of methods; track mt.k) { <button type="button" [class.on]="pay.method === mt.k" (click)="pay.method = mt.k">{{ mt.label }}</button> }</div></div>`; `<div class="field"><label for="pyd">Date paid</label><input id="pyd" type="date" [attr.max]="today" [(ngModel)]="pay.at"></div>`; `<div class="field"><label for="pyn">Note (optional)</label><input id="pyn" [(ngModel)]="pay.note" placeholder="Half now, the rest on delivery"></div>`; then `</div>` and the foot `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="savePay()">Record payment</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>`.
(d) Correct a payment: `<bb-drawer title="Correct a payment" [open]="sheet() === 'fix'" (closed)="closeSheet()">`, body `@if (fixing(); as fl) { <p class="fix-q">Correct {{ fl.no }}, {{ cast.money(fl.amount) }}? The payment stays in the history with its correction.</p> }`, foot `<div foot>@if (err()) { <p class="msg" role="alert">{{ err() }}</p> }<button class="btn" type="button" [disabled]="busy()" (click)="saveFix()">Correct it</button><button class="btn quiet" type="button" (click)="closeSheet()">Cancel</button></div>`.

Part 5 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    } @else { <div class="empty"><strong>No such car</strong></div> } | until=  styles: [`
Two lines: `    } @else { <div class="empty"><strong>No such car</strong></div> }` (no backtick now) then `    @if (payToast(); as pt) { <div class="toast on" role="status">{{ pt.text }}@if (pt.undo) { <button type="button" (click)="undoPay()">Undo</button> }</div> }` followed by the backtick and comma that closed the template.

Part 6 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    .money{padding:16px} | until=    .tl,.act,.ba{padding:16px}`
Replaces the `.money` line and the `.due` line. CSS rules, a few per line, four space indent:
- `.money{padding:16px}`; `.m4{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}`; `.m4.one{grid-template-columns:minmax(0,1fr)}`
- `.fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}`; `.fig strong{display:block;font-size:15px;margin-top:3px}`; `.m4.one .fig strong{font-size:20px}`
- `.pays{margin-top:12px;border-top:1px solid var(--line)}`; `.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}`
- `.pt{flex:1;min-width:0}`; `.pt strong{display:block;font-size:13px;font-weight:700}`; `.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}`; `.pa{font-weight:700;font-size:14px;white-space:nowrap}`
- `.pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}`; `.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}`
- `.pay-add{width:100%;margin-top:12px;min-height:44px}`
- the `.due` rule exactly as now; `.msg{font-size:13px;font-weight:600;color:var(--ink);line-height:1.4}`; `.fix-q{font-size:14px;line-height:1.5}`

Part 7 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  sheet = signal<Sheet>(''); busy = signal(false); | until=  on(k: FeatureKey)`
The three lines as now, then:
- `pay: { amount: number | null; method: PayMethod; at: string; note: string } = { amount: null, method: 'cash', at: '', note: '' };`
- `today = localDay(); fixing = signal<PaymentLine | null>(null); payToast = signal<{ text: string; undo: string } | null>(null); private payT: ReturnType<typeof setTimeout> | undefined;`
- `readonly methods: { k: PayMethod; label: string }[] = [{ k: 'cash', label: 'Cash' }, { k: 'card', label: 'Card' }, { k: 'bank', label: 'Bank transfer' }, { k: 'cheque', label: 'Cheque' }];`

Part 8 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  openSheet(s: Sheet){ | until=  closeSheet(){`
The openSheet method as now with three changes: its first statement after the job guard is `this.err.set('');` (every sheet opens with an empty message slot; the edit line keeps its own reset too); the money line sets only `{ estimate: j.estimate || 0, approved: j.approved || 0 }`; a new line `if (s === 'pay') { this.today = localDay(); this.pay = { amount: Math.max(0, balanceOf(j)), method: 'cash', at: this.today, note: '' }; }`.

Part 9 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  async deliver(){ | until=  /* the car's own fields on the job;`
Replaces deliver and saveMoney, then adds the new methods. Every saving method keeps the house shape: `if (this.busy()) return;` then `this.busy.set(true);` then `try { ... } catch (e: any) { ... e.message ... } finally { this.busy.set(false); }`.
- `deliver()`: as now, but the catch is `this.err.set(e.message || 'Could not deliver the car');` (the words stay in the sheet, no toast).
- `saveMoney()`: as now with only estimate and approved sent.
- `savePay()`: guard busy, `const j = this.job(); if (!j) return;`, `this.err.set('');`, busy true; in the try: `const r = await this.data.recordPayment(j.id, { amount: Number(this.pay.amount), method: this.pay.method, at: this.pay.at, note: this.pay.note });` then `this.closeSheet();` then if `r.payment` call `this.showPay('Recorded ' + r.payment.no + ', ' + this.cast.money(r.payment.amount) + ' ' + this.methodWord(r.payment.method).toLowerCase(), this.session.owner() ? r.payment.id : '')`, else `this.data.toast('Saved on this phone. It reaches the workshop when there is signal.')`. Catch: `this.err.set(e.message || 'Could not record the payment');`.
- `askFix(l: PaymentLine)`: `this.openSheet('fix'); this.fixing.set(l);`
- `saveFix()`: guard busy, `const l = this.fixing(); if (!l) return;`, `this.err.set('');`, busy true; try: `await this.data.correctPayment(this.id(), l.id); this.closeSheet(); this.data.toast('Corrected ' + l.no + '. It stays in the history.');` catch: `this.err.set(e.message || 'Could not correct the payment');`.
- `undoPay()`: `const t = this.payToast(); if (!t || !t.undo) return; this.payToast.set(null);` then try: `await this.data.correctPayment(this.id(), t.undo); this.data.toast('Undone. The payment stays in the history as corrected.');` catch: `this.data.toast(e.message || 'Could not undo the payment');`.
- `showPay(text: string, undo: string)`: `this.data.toastMsg.set(null); this.payToast.set({ text, undo }); clearTimeout(this.payT); this.payT = setTimeout(() => this.payToast.set(null), 5000);`
- `methodWord(m: string){ return this.methods.find(x => x.k === m)?.label || m; }`
- `paid(j: Job){ return paidOf(j); } balance(j: Job){ return balanceOf(j); } payLines(j: Job){ return lines(j); }`
Then one comment line above savePay: `/* PAYMENTS (18 Oct 2026): the owner and the front desk record a payment; only the owner corrects one, and the owner's toast carries Undo */`

Part 10 header: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  icon(t: string){ | until=  /* the forecast from the same calendar`
The icon line as now with `payment: 'money'` added to the map.

TRAPS.
- Plain staff must see no money: every new money element sits inside `@if (session.collects())`; the Estimate, Approved and Paid figures and every Correct button sit inside `session.owner()`.
- Never read `j.paid` anywhere. The words in the sheets and toasts exactly as written here.
- No new colour (no hex, no rgb), no new component, no em or en dash, no comma before and, or, but or nor in any word a person reads or any comment. British English.
