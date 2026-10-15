import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { IconComponent } from './icon.component';
import { Tile } from '../core/spaces';

@Component({
  selector: 'bb-space-tile',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (tile.state === 'free') {
      <div class="tile free" [attr.data-space]="tile.space.key">
        <div class="head">
          <span class="badge" [class.free]="tile.state === 'free'">
            <bb-icon [name]="spaceIcon" />
          </span>
          <span class="label">{{ tile.space.label }}</span>
          <span class="state free">Free</span>
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
        [attr.data-space]="tile.space.key"
        [attr.aria-label]="ariaLabel"
        (click)="open.emit(tile)"
      >
        <div class="head">
          <span class="badge" [class.busy]="tile.state === 'busy'" [class.blocked]="tile.state === 'blocked'">
            <bb-icon [name]="spaceIcon" />
          </span>
          <span class="label">{{ tile.space.label }}</span>
          <span class="state {{ tile.state }}">{{ tile.state === 'busy' ? 'Busy' : 'Blocked' }}</span>
        </div>
        <div class="body">
          @if (tile.state === 'busy') {
            <span class="plate">{{ tile.job?.plate }}</span>
            <p class="car">{{ tile.job?.make }} {{ tile.job?.model }}</p>
            <p class="stage">{{ currentPhaseLabel }} · {{ formatTime(tile.minutesInStage) }} in stage</p>
            <p class="left" [class.over]="tile.minutesLeft === 0 && hasNowPhase">
              @if (tile.minutesLeft > 0) {
                About {{ formatTime(tile.minutesLeft) }} left
              } @else {
                Running over
              }
            </p>
          } @else {
            <span class="plate">{{ tile.job?.plate }}</span>
            <p class="car">{{ tile.job?.make }} {{ tile.job?.model }}</p>
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
        display: grid;
      }

      .tile {
        display: grid;
        gap: 8px;
        padding: 12px;
        min-height: 132px;
        border-radius: var(--r);
        background: var(--surface);
        border: 1px solid var(--line);
        width: 100%;
        box-sizing: border-box;
      }

      .tile.free {
        border: 1px dashed var(--line-2);
      }

      .tile.blocked {
        border: 1px solid var(--red);
      }

      button.tile {
        text-align: left;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }

      @media (hover: hover) {
        button.tile:hover {
          border-color: var(--brand);
        }
      }

      button.tile:active {
        transform: scale(0.99);
      }

      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
      }

      .badge {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }

      .badge.busy {
        background: var(--brand-soft);
        color: var(--brand-dark);
      }

      .badge.blocked {
        background: var(--red-soft);
        color: var(--red);
      }

      .badge.free {
        background: var(--green-soft);
        color: var(--green);
      }

      .label {
        font-size: 13px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .state {
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .state.busy {
        color: var(--brand-dark);
      }

      .state.blocked {
        color: var(--red);
      }

      .state.free {
        color: var(--green);
      }

      .body {
        display: grid;
        gap: 4px;
        align-content: start;
      }

      .plate {
        display: inline-block;
        font-size: 12.5px;
        font-weight: 800;
        letter-spacing: 0.05em;
        background: var(--ink);
        color: var(--bg);
        border-radius: 6px;
        padding: 2px 7px;
        width: fit-content;
      }

      .car {
        font-size: 13.5px;
        font-weight: 600;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stage {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .left {
        font-size: 12px;
        color: var(--brand-dark);
        font-weight: 600;
        margin: 0;
      }

      .left.over {
        color: var(--amber);
      }

      .blocked-line {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12.5px;
        color: var(--red);
        font-weight: 700;
        margin: 0;
      }

      .waiting {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
      }

      .free-text {
        font-size: 12.5px;
        color: var(--muted);
        margin: 0;
      }

      .assign-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        min-height: 40px;
      }

      .num {
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class SpaceTileComponent {
  @Input({ required: true }) tile!: Tile;
  @Input() canAssign = false;
  @Output() assign = new EventEmitter<Tile>();
  @Output() open = new EventEmitter<Tile>();

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

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
  }
}
