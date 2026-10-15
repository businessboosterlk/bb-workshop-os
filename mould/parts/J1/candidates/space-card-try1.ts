import { Component, Input, inject, signal } from '@angular/core';
import { Job, Hold, SpaceDef, Cast } from '../core/models';
import { spacesFor } from '../core/spaces';
import { CastService } from '../core/cast.service';
import { DataService, HOLD_WORDS, niceWhen } from '../core/data.service';
import { DrawerComponent } from './drawer.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'bb-space-card',
  standalone: true,
  imports: [IconComponent, DrawerComponent],
  template: `
    <div class="card sc" [attr.data-where]="where()">
      <div class="sc-row">
        <div class="sc-ico">
          <bb-icon [name]="where() === 'bay' ? 'bay' : where() === 'blocked' ? 'pause' : where() === 'dock' ? 'pause' : 'clock'"/>
        </div>
        <div class="sc-col">
          <span class="sc-k">Where the car is</span>
          <strong class="sc-where">
            @switch (where()) {
              @case ('bay') { {{ job.spaceKey ? data.spaceLabel(job) : '' }} }
              @case ('blocked') { {{ job.spaceKey ? data.spaceLabel(job) : '' }} · Bay blocked }
              @case ('dock') { In the holding dock }
              @case ('queue') { Waiting for a space }
            }
          </strong>
          <span class="sc-sub">
            @switch (where()) {
              @case ('bay') { {{ branchName() }} }
              @case ('blocked') { {{ HOLD_WORDS[job.hold!] }} since {{ niceWhen(job.heldAt) }} }
              @case ('dock') { {{ HOLD_WORDS[job.hold!] }} since {{ niceWhen(job.heldAt) }} }
              @case ('queue') { Place it when a space in {{ branchName() }} is free }
            }
          </span>
        </div>
      </div>
      @if (job.status === 'open') {
        <div class="sc-acts">
          @if (!job.hold) {
            <button type="button" class="btn ghost sc-move" [class.wide]="!canHold" (click)="sheet.set('move')">
              <bb-icon name="move"/>{{ job.spaceKey ? 'Move' : 'Place in a space' }}
            </button>
            @if (canHold) {
              <button type="button" class="btn ghost sc-hold" (click)="openHold()">
                <bb-icon name="pause"/>Hold the car
              </button>
            }
          } @else {
            @if (canHold) {
              <button type="button" class="btn sc-release wide" (click)="release()">
                <bb-icon name="tick"/>Release, no longer waiting
              </button>
            }
          }
        </div>
      }
    </div>

    <bb-drawer [title]="(job.spaceKey ? 'Move ' : 'Place ') + job.plate" [open]="sheet() === 'move'" (closed)="sheet.set('')">
      <p class="d-lead" style="margin-top:0">Free spaces in {{ branchName() }}</p>
      @for (s of freeSpaces(); track s.key) {
        <button type="button" class="pick" [attr.data-space]="s.key" [disabled]="busy()" (click)="place(s)">
          <span class="pk-t"><strong>{{ s.label }}</strong><em>Free now</em></span>
          <bb-icon name="chev"/>
        </button>
      } @empty {
        <div class="empty">
          <strong>Every space is taken</strong>
          <span>The floor shows when the next one frees up.</span>
        </div>
      }
      <div foot>
        @if (job.spaceKey) {
          <button type="button" class="btn ghost sc-out" (click)="takeOut()">Take it out of {{ data.spaceLabel(job) }}</button>
        }
        <button type="button" class="btn quiet" (click)="sheet.set('')">Cancel</button>
      </div>
    </bb-drawer>

    <bb-drawer [title]="'Hold ' + job.plate" [open]="sheet() === 'hold'" (closed)="sheet.set('')">
      <p class="d-lead" style="margin-top:0">What is it waiting for?</p>
      @for (h of holdOptions; track h.key) {
        <button type="button" class="opt" [attr.data-reason]="h.key" [attr.aria-pressed]="reason() === h.key" [class.on]="reason() === h.key" (click)="reason.set(h.key)">
          <strong>{{ h.label }}</strong>
        </button>
      }
      @if (job.spaceKey) {
        <p class="d-lead">Where does it wait?</p>
        <button type="button" class="opt" [attr.data-leave]="'0'" [class.on]="!leave()" (click)="leave.set(false)">
          <strong>Stay in {{ data.spaceLabel(job) }}</strong>
          <em>The bay shows as blocked</em>
        </button>
        <button type="button" class="opt" [attr.data-leave]="'1'" [class.on]="leave()" (click)="leave.set(true)">
          <strong>Go to the holding dock</strong>
          <em>The bay is free for the next car</em>
        </button>
      }
      <div foot>
        <button type="button" class="btn sc-go" [disabled]="!reason() || busy()" (click)="doHold()">Hold the car</button>
        <button type="button" class="btn quiet" (click)="sheet.set('')">Cancel</button>
      </div>
    </bb-drawer>
  `,
  styles: `
    .sc { padding: 14px 16px; }
    .sc-row { display: flex; gap: 12px; align-items: center; }
    .sc-ico { width: 40px; height: 40px; border-radius: var(--r-s); display: grid; place-items: center; --ico: 20px; flex: none; }
    .sc[data-where="bay"] .sc-ico { background: var(--brand-soft); color: var(--brand-dark); }
    .sc[data-where="blocked"] .sc-ico { background: var(--red-soft); color: var(--red); }
    .sc[data-where="dock"] .sc-ico { background: var(--amber-soft); color: var(--amber); }
    .sc[data-where="queue"] .sc-ico { background: var(--amber-soft); color: var(--amber); }
    .sc-col { flex: 1; min-width: 0; }
    .sc-k { display: block; font-size: 12px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-where { display: block; font-size: 16px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-sub { display: block; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
    .sc-acts button { width: 100%; min-height: 44px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sc-acts .wide { grid-column: 1 / -1; }
    .d-lead { font-size: 12.5px; color: var(--muted); margin: 14px 0 8px; }
    .pick { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); text-align: left; --ico: 16px; color: var(--ink); }
    .pick .pk-t { flex: 1; min-width: 0; }
    .pick strong { display: block; font-size: 14px; }
    .pick em { display: block; font-style: normal; font-size: 12px; color: var(--muted); }
    .opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 48px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); color: var(--ink); text-align: left; }
    .opt strong { font-size: 14px; }
    .opt em { font-style: normal; font-size: 12px; color: var(--muted); }
    .opt.on { border-color: var(--brand); background: var(--brand-soft); }
    .empty { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px dashed var(--line); border-radius: var(--r); }
    .empty strong { font-size: 14px; color: var(--ink); }
    .empty span { font-size: 12px; color: var(--muted); }
  `
})
export class SpaceCardComponent {
  @Input({ required: true }) job!: Job;
  @Input() canHold = true;

  data = inject(DataService);
  cast = inject(CastService);

  sheet = signal<'' | 'move' | 'hold'>('');
  busy = signal(false);
  reason = signal<Hold | ''>('');
  leave = signal(true);

  holdOptions: { key: Hold; label: string }[] = [
    { key: 'parts', label: 'Parts' },
    { key: 'approval', label: "The customer's approval" },
    { key: 'curing', label: 'Paint curing' }
  ];

  where(): 'bay' | 'blocked' | 'dock' | 'queue' {
    if (this.job.spaceKey && !this.job.hold) return 'bay';
    if (this.job.spaceKey && this.job.hold) return 'blocked';
    if (!this.job.spaceKey && this.job.hold) return 'dock';
    return 'queue';
  }

  branchName(): string {
    const c = this.cast.cast();
    if (!c) return '';
    const b = this.cast.branch(this.job.branch);
    return b ? b.name : '';
  }

  freeSpaces(): SpaceDef[] {
    const c = this.cast.cast();
    if (!c) return [];
    const all = spacesFor(c, this.job.branch);
    return all.filter(s =>
      s.key !== this.job.spaceKey &&
      !this.data.jobs().some(o =>
        o.id !== this.job.id &&
        o.status === 'open' &&
        o.branch === this.job.branch &&
        o.spaceKey === s.key
      )
    );
  }

  openHold(): void {
    this.reason.set('');
    this.leave.set(true);
    this.sheet.set('hold');
  }

  async place(s: SpaceDef): Promise<void> {
    this.busy.set(true);
    try {
      await this.data.placeCar(this.job.id, s.key);
      this.data.toast(`${this.job.plate} is in ${s.label}`);
      this.sheet.set('');
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async takeOut(): Promise<void> {
    this.busy.set(true);
    try {
      await this.data.freeSpace(this.job.id);
      this.data.toast(`${this.job.plate} is waiting for a space`);
      this.sheet.set('');
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async doHold(): Promise<void> {
    const r = this.reason();
    if (!r) return;
    const hadSpace = !!this.job.spaceKey;
    const leaveBay = hadSpace ? this.leave() : true;
    this.busy.set(true);
    try {
      await this.data.holdCar(this.job.id, r, leaveBay);
      this.data.toast(hadSpace && leaveBay ? `${this.job.plate} moved to the holding dock` : `${this.job.plate} is on hold`);
      this.sheet.set('');
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async release(): Promise<void> {
    const hadSpace = !!this.job.spaceKey;
    this.busy.set(true);
    try {
      await this.data.releaseCar(this.job.id);
      this.data.toast(hadSpace ? `${this.job.plate} is back at work` : `${this.job.plate} is waiting for a space`);
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
