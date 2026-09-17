import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, niceDate, niceWhen, waLink } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { PhasesComponent } from '../../ui/phases.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { shrink, demoPhoto } from '../../core/photo';
import { normalise } from '../../core/session.service';

/* The job card, the screen staff live on. One big button: close the phase that is
   running, which needs a photo. Then the smaller things: move the date with a reason,
   ask the customer, the pickup, deliver. Money is on this screen only for the owner. */
type Sheet = '' | 'phase' | 'date' | 'ask' | 'pickup' | 'deliver' | 'money' | 'note' | 'edit';
@Component({
  selector: 'bb-ws-job',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, PhasesComponent, DrawerComponent],
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
          <div class="card cust">
            <div class="row"><span class="k">Customer</span><span class="v">{{ j.customerName }} · {{ j.customerPhone }}</span></div>
            <div class="row"><span class="k">Promised</span><span class="v">{{ date(j.promisedAt) }}@if (j.promiseHistory.length) { <i class="moved">moved {{ j.promiseHistory.length }}x</i> }</span></div>
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
        <div class="form-grid"><div class="field span"><label for="nd">New date</label><input id="nd" type="date" [(ngModel)]="newDate"></div>
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
    .big:hover{filter:brightness(1.05)}.big:active{transform:scale(.99)}
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
    .moved{font-style:normal;font-size:10.5px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:1px 7px;border-radius:999px;margin-left:6px}
    .ap{padding:14px 16px}.ap.pend{border-color:var(--brand)}.ap-h{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.ap-h strong{font-size:14px}
    .ap p{font-size:13px;color:var(--ink-2);margin-top:6px}.amt{display:block;margin-top:6px;font-weight:700;font-variant-numeric:tabular-nums}
    .money{padding:16px}.m3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.m3 em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}.m3 strong{display:block;font-size:15px;margin-top:3px;font-variant-numeric:tabular-nums}
    .due{margin-top:10px;font-size:12.5px;font-weight:600;color:var(--amber)}
    .tl,.act{padding:16px}
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
  async moveDate(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPromise(this.id(), new Date(this.newDate + 'T17:00:00').toISOString(), this.reason); this.closeSheet(); this.data.toast('Date moved. The customer sees why.'); } finally { this.busy.set(false); } }
  async ask(){ if (this.busy()) return; this.busy.set(true); try { await this.data.askApproval(this.id(), this.askTitle, this.askDetail, this.askAmount ? Number(this.askAmount) : undefined); this.closeSheet(); this.data.toast('Sent to the customer'); } finally { this.busy.set(false); } }
  async savePickup(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPickup(this.id(), this.pk.wanted ? { ...this.pk } : { wanted: false, status: 'none' }); this.closeSheet(); this.data.toast('Pickup saved'); } finally { this.busy.set(false); } }
  async deliver(){ if (this.busy()) return; this.busy.set(true); try { await this.data.deliver(this.id()); this.closeSheet(); this.data.toast('Delivered. The car moves to history.'); } catch (e: any) { this.data.toast(e.message); } finally { this.busy.set(false); } }
  async saveMoney(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setMoney(this.id(), { estimate: +this.m.estimate || 0, approved: +this.m.approved || 0, paid: +this.m.paid || 0 }); this.closeSheet(); } finally { this.busy.set(false); } }
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
  async saveNote(){ if (this.busy()) return; this.busy.set(true); try { await this.data.addNote(this.id(), this.noteText); this.closeSheet(); } finally { this.busy.set(false); } }
  wa(j: any){ return waLink(j.customerPhone, `Hello ${j.customerName.split(' ')[0]}, this is ${this.session.name()} at ${this.cast.cast()?.name} about ${j.plate}. `); }
  icon(t: string){ return ({ phase: 'check', note: 'note', promise: 'clock', approval: 'alert', pickup: 'truck', delivered: 'tick', new: 'car', enquiry: 'inbox', quote: 'quote', followup: 'phone' } as any)[t] || 'note'; }
  date(iso?: string){ return niceDate(iso); } when(iso?: string){ return niceWhen(iso); }
}
