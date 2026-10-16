import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { IconComponent } from './icon.component';
import { Tile } from '../core/spaces';
import { CastService } from '../core/cast.service';

@Component({
  selector: 'bb-space-tile',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (tile.state === 'free') {
      <div class="tile free">
        <div class="head">
          <span class="badge">
            <bb-icon [name]="spaceIcon" />
          </span>
          <span class="label">{{ tile.space.label }}</span>
        </div>
        <div class="bay">
          <div class="car ghost">
            <span class="avail">Available</span>
          </div>
        </div>
        <div class="body">
          <p class="free-text">Ready for the next car</p>
          @if (canAssign) {
            <button type="button" class="btn soft sm assign-btn" (click)="assign.emit(tile)">
              <bb-icon name="plus" />Assign a car
            </button>
          }
        </div>
      </div>
    } @else {
      <button
        type="button"
        class="tile {{ tile.state }}"
        [attr.aria-label]="ariaLabel"
        (click)="open.emit(tile)"
      >
        <div class="head">
          <span class="badge">
            <bb-icon [name]="spaceIcon" />
          </span>
          <span class="label">{{ tile.space.label }}</span>
        </div>
        <div class="bay">
          <div class="car {{ tile.state === 'busy' ? 'solid' : 'blocked' }}">
            <i class="w w1"></i>
            <i class="w w2"></i>
            <i class="w w3"></i>
            <i class="w w4"></i>
            <i class="rw"></i>
            <i class="ws"></i>
          </div>
        </div>
        <div class="body">
          @if (tile.state === 'busy') {
            <span class="plate">{{ tile.job?.plate }}</span>
            <p class="car-name">{{ tile.job?.make }} {{ tile.job?.model }}</p>
            <p class="why">
              {{ serviceLabel }}<span> · {{ currentPhaseLabel }}</span>
            </p>
            <div class="prog-row"><div class="prog"><i [style.width.%]="pct"></i></div><span class="stages" [attr.aria-label]="done + ' of ' + total + ' stages done'">{{ done }} of {{ total }}</span></div>
            <p class="left" [class.over]="tile.minutesLeft === 0 && hasNowPhase">{{ leftText }}</p>
          } @else {
            <span class="plate">{{ tile.job?.plate }}</span>
            <p class="car-name">{{ tile.job?.make }} {{ tile.job?.model }}</p>
            <p class="blocked-line">
              <bb-icon name="pause" />Bay blocked · {{ formatTime(tile.heldMinutes) }}
            </p>
            <p class="waiting">{{ holdLabel }}</p>
          }
        </div>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .tile {
        display: grid;
        gap: 10px;
        padding: 12px;
        border-radius: var(--r);
        background: var(--surface);
        border: 1px solid var(--line);
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }

      .tile.free {
        border: 1px dashed var(--line-2);
      }

      button.tile {
        text-align: left;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }

      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .badge {
        width: 28px;
        height: 28px;
        border-radius: var(--r-s);
        background: var(--surface-2);
        display: grid;
        place-items: center;
        line-height: 0;
        --ico: 15px;
        flex-shrink: 0;
      }

      .label {
        font-size: 14px;
        font-weight: 650;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .state {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--muted);
        flex-shrink: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .state.blocked {
        color: var(--red);
      }

      .bay {
        position: relative;
        height: 64px;
        border-top: 2px solid var(--line-2);
        border-bottom: 2px solid var(--line-2);
        border-left: 2px solid var(--line-2);
        border-radius: 4px 0 0 4px;
        min-width: 0;
      }

      .car {
        position: absolute;
        left: 10%;
        right: 12%;
        top: 50%;
        height: 34px;
        transform: translateY(-50%);
        border-radius: 12px 17px 17px 12px;
        box-sizing: border-box;
        transition: transform 200ms var(--ease);
      }

      .car.solid {
        background: var(--ink);
        border: 1.5px solid var(--ink);
      }

      .car.blocked {
        background: var(--red);
        border: 1.5px solid var(--red);
      }

      .car.ghost {
        background: transparent;
        border: 1.5px dashed var(--line-2);
        display: grid;
        place-items: center;
      }

      .avail {
        font-size: 12px;
        font-weight: 650;
        color: var(--muted);
      }

      .w {
        position: absolute;
        width: 12px;
        height: 5px;
        border-radius: 2px;
        background: var(--ink);
      }

      .car.blocked .w {
        background: var(--red);
      }

      .w1 {
        top: -3px;
        left: 16%;
      }

      .w2 {
        top: -3px;
        left: 70%;
      }

      .w3 {
        bottom: -3px;
        left: 16%;
      }

      .w4 {
        bottom: -3px;
        left: 70%;
      }

      .rw {
        position: absolute;
        left: 12%;
        top: 18%;
        width: 9%;
        height: 64%;
        border-radius: 3px;
        background: var(--muted);
      }

      .ws {
        position: absolute;
        left: 60%;
        top: 14%;
        width: 15%;
        height: 72%;
        border-radius: 4px;
        background: var(--muted);
      }

      .car.blocked .rw,
      .car.blocked .ws {
        background: var(--red-soft);
      }

      @media (hover: hover) {
        .car.solid:hover,
        .car.blocked:hover {
          transform: translateY(-50%) translateX(3px);
        }
      }

      .body {
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      .plate {
        display: inline-block;
        font-size: 12.5px;
        font-weight: 800;
        letter-spacing: 0.05em;
        background: var(--ink);
        color: var(--surface);
        border-radius: 6px;
        padding: 2px 7px;
        width: fit-content;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        min-width: 0;
      }

      .car-name {
        font-size: 13.5px;
        font-weight: 600;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .why {
        font-size: 13px;
        font-weight: 600;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .why span {
        color: var(--muted);
        font-weight: 500;
      }

      /* the stage count sits beside its bar, so the bay name and the time left keep the whole width (Claude, 16 Oct) */
      .prog-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .prog-row .prog { flex: 1; }
      .stages { flex: none; font-size: 11.5px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
      .prog {
        height: 6px;
        border-radius: 3px;
        background: var(--line);
        overflow: hidden;
        min-width: 0;
      }

      .prog i {
        display: block;
        height: 100%;
        background: var(--ink);
        transition: width 400ms var(--ease);
      }

      .left {
        font-size: 12.5px;
        font-weight: 650;
        line-height: 1.3;
        margin: 0;
        min-width: 0;   /* may wrap to a second line: "About 18 working days left" must be read whole */
      }

      .left.over {
        color: var(--red);
      }

      .blocked-line {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12.5px;
        color: var(--red);
        font-weight: 700;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .waiting {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }

      .free-text {
        font-size: 12.5px;
        color: var(--muted);
        margin: 0;
        min-width: 0;
      }

      .assign-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        min-height: 40px;
        min-width: 0;
      }
    `,
  ],
})
export class SpaceTileComponent {
  @Input({ required: true }) tile!: Tile;
  @Input() canAssign = false;
  @Output() assign = new EventEmitter<Tile>();
  @Output() open = new EventEmitter<Tile>();

  constructor(private cast: CastService) {}

  @HostBinding('class') get hostClass(): string {
    return `tile ${this.tile.state}`;
  }

  @HostBinding('attr.data-space') get dataSpace(): string {
    return this.tile.space.key;
  }

  get spaceIcon(): string {
    switch (this.tile.space.kind) {
      case 'hoist':
        return 'wrench';
      case 'booth':
        return 'spray';
      case 'detail':
        return 'sparkle';
      case 'wheel':
        return 'wheel';
      default:
        return 'bay';
    }
  }

  get currentPhaseLabel(): string {
    const nowPhase = this.tile.job?.phases.find((p) => p.status === 'now');
    return nowPhase ? nowPhase.label : 'Waiting to start';
  }

  get hasNowPhase(): boolean {
    return this.tile.job?.phases.some((p) => p.status === 'now') ?? false;
  }

  get holdLabel(): string {
    switch (this.tile.job?.hold) {
      case 'parts':
        return 'Waiting for parts';
      case 'approval':
        return 'Waiting for approval';
      case 'curing':
        return 'Curing';
      default:
        return '';
    }
  }

  get ariaLabel(): string {
    const stateWord = this.tile.state === 'busy' ? 'Busy' : 'Blocked';
    return `${this.tile.space.label}, ${this.tile.job?.plate}, ${stateWord}`;
  }

  get serviceLabel(): string {
    return this.tile.job ? this.cast.service(this.tile.job.service)?.label ?? '' : '';
  }

  get done(): number {
    return this.tile.job?.phases.filter((p) => p.status === 'done').length ?? 0;
  }

  get total(): number {
    return this.tile.job?.phases.length ?? 0;
  }

  get pct(): number {
    return this.total ? (this.done / this.total) * 100 : 0;
  }

  get leftText(): string {
    if (this.tile.minutesLeft >= 480) {
      const d = Math.ceil(this.tile.minutesLeft / 480);
      return d === 1 ? 'About 1 working day left' : `About ${d} working days left`;
    }
    if (this.tile.minutesLeft > 0) {
      return `About ${this.formatTime(this.tile.minutesLeft)} left`;
    }
    return 'Running over';
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
  }
}
