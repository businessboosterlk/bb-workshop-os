import { Component, Input, inject, signal } from '@angular/core';
import { Job, Hold, SpaceDef } from '../core/models';
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
        <div class="sc-ico" [attr.data-where]="where()">
          <bb-icon [name]="where() === 'bay' ? 'bay' : where() === 'blocked' ? 'pause' : where() === 'dock' ? 'pause' : 'clock'"/>
        </div>
        <div class="sc-col">
          <span class="sc-k">Where the car is</span>
          <strong class="sc-where">
            @if (where() === 'bay') {
              {{ data.spaceLabel(job) }}
            } @else if (where() === 'blocked') {
              {{ data.spaceLabel(job) }} · Bay blocked
            } @else if (where() === 'dock') {
              In the holding dock
            } @else {
              Waiting for a space
            }
          </strong>
          <span class="sc-sub">
            @if (where() === 'bay') {
              {{ branchName() }}
            } @else if (where() === 'blocked' || where() === 'dock') {
              {{ holdWords[job.hold!] }} since {{ niceWhen(job.heldAt) }}
            } @else {
              Place it when a space in {{ branchName() }} is free
            }
          </span>
        </div>
      </div>
      @if (job.status === 'open') {
        <div class="sc-acts">
          @if (!job.hold) {
            <button type="button" class="btn ghost sc-move" [class.wide]="!canHold" (click)="sheet.set('move')">
              <bb-icon name="move"/>
              <span>{{ job.spaceKey ? 'Move' : 'Place in a space' }}</span>
            </button>
            @if (canHold) {
              <button type="button" class="btn ghost sc-hold" (click)="openHold()">
                <bb-icon name="pause"/>
                <span>Hold the car</span>
              </button>
            }
          } @else {
            @if (canHold) {
              <button type="button" class="btn sc-release wide" (click)="release()">
                <bb-icon name="tick"/>
                <span>Release, no longer waiting</span>
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
        <button type="button" class="opt" [attr.data-leave]="'0'" [attr.aria-pressed]="!leave()" [class.on]="!leave()" (click)="leave.set(false)">
          <strong>Stay in {{ data.spaceLabel(job) }}</strong>
          <em>The bay shows as blocked</em>
        </button>
        <button type="button" class="opt" [attr.data-leave]="'1'" [attr.aria-pressed]="leave()" [class.on]="leave()" (click)="leave.set(true)">
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
  styles: [
    `
      .sc { padding: 14px 16px; }
      .sc-row { display: flex; gap: 12px; align-items: center; }
      .sc-ico { width: 40px; height: 40px; border-radius: var(--r-s); display: grid; place-items: center; --ico: 20px; flex: none; }
      .sc-ico[data-where='bay'] { background: var(--brand-soft); color: var(--brand-dark); }
      .sc-ico[data-where='blocked'] { background: var(--red-soft); color: var(--red); }
      .sc-ico[data-where='dock'] { background: var(--amber-soft); color: var(--amber); }
      .sc-ico[data-where='queue'] { background: var(--amber-soft); color: var(--amber); }
      .sc-col { flex: 1; min-width: 0; }
      .sc-k { display: block; font-size: 12px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-where { display: block; font-size: 16px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-sub { display: block; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
      .sc-acts button { width: 100%; min-height: 44px; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px; --ico: 16px; }
      .sc-acts button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-acts .wide { grid-column: 1 / -1; }
      .d-lead { font-size: 12.5px; color: var(--muted); margin: 14px 0 8px; }
      .pick { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); text-align: left; --ico: 16px; color: var(--ink); }
      .pick .pk-t { flex: 1; min-width: 0; }
      .pick strong { display: block; font-size: 14px; }
      .pick em { display: block; font-style: normal; font-size: 12px; color: var(--muted); }
      .opt { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 2px; width: 100%; min-height: 48px; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); color: var(--ink); text-align: left; }
      .opt strong { font-size: 14px; }
      .opt em { font-style: normal; font-size: 12px; color: var(--muted); }
      .opt.on { border-color: var(--brand); background: var(--brand-soft); }
      .empty { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px dashed var(--line); border-radius: var(--r); }
      .empty strong { font-size: 14px; color: var(--ink); }
      .empty span { font-size: 12px; color: var(--muted); }
    `
  ]
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

  /* the sheet opens clean every time: a reason picked and cancelled never carries over (added by Claude) */
  openHold(): void { this.reason.set(''); this.leave.set(true); this.sheet.set('hold'); }
  readonly holdWords = HOLD_WORDS;
  readonly niceWhen = niceWhen;

  readonly holdOptions: { key: Hold; label: string }[] = [
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
    const b = this.cast.branch(this.job.branch);
    return b ? b.name : this.job.branch;
  }

  freeSpaces(): SpaceDef[] {
    const c = this.cast.cast();
    if (!c) return [];
    return spacesFor(c, this.job.branch).filter(s =>
      s.key !== this.job.spaceKey &&
      !this.data.jobs().some(o =>
        o.id !== this.job.id &&
        o.status === 'open' &&
        o.branch === this.job.branch &&
        o.spaceKey === s.key
      )
    );
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
    const had = !!this.job.spaceKey;
    this.busy.set(true);
    try {
      await this.data.releaseCar(this.job.id);
      this.data.toast(had ? `${this.job.plate} is back at work` : `${this.job.plate} is waiting for a space`);
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
