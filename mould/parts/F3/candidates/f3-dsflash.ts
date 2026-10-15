import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SpaceTileComponent } from './space-tile.component';
import { Floor, Tile } from '../core/spaces';

@Component({
  selector: 'bb-floor-map',
  standalone: true,
  imports: [SpaceTileComponent],
  template: `
    @for (entry of floors; track entry.floor.branch) {
      <section class="fm-group" [attr.data-branch]="entry.floor.branch">
        <div class="cap" [attr.data-busy]="entry.floor.busy" [attr.data-total]="entry.floor.total">
          <div class="cap-text">
            <div class="cap-row">
              <span class="branch">{{ entry.floor.branch }}</span>
              <span class="num busy-count">{{ entry.floor.busy }} of {{ entry.floor.total }} busy</span>
              <span class="dot"> · </span>
              @if (entry.floor.nextFreeMinutes === 0) {
                <span class="free">{{ entry.floor.total - entry.floor.busy }} free now</span>
              } @else if (entry.floor.nextFreeMinutes !== null) {
                <span class="wait">next free in about {{ formatTime(entry.floor.nextFreeMinutes) }}</span>
              } @else {
                <span class="wait">every car in a bay is waiting on something</span>
              }
            </div>
            <div
              class="meter"
              role="img"
              [attr.aria-label]="entry.floor.busy + ' of ' + entry.floor.total + ' spaces busy'"
            >
              @for (tile of entry.floor.tiles; track tile.id) {
                <div
                  class="seg"
                  [class.busy]="tile.status === 'busy'"
                  [class.blocked]="tile.status === 'blocked'"
                  [class.free]="tile.status === 'free'"
                ></div>
              }
            </div>
          </div>
        </div>
        <div class="fm-grid">
          @for (tile of entry.floor.tiles; track tile.id) {
            <bb-space-tile
              [tile]="tile"
              [canAssign]="canAssign"
              (assign)="onAssign($event)"
              (open)="onOpen($event)"
            />
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .fm-group {
        margin-bottom: 22px;
      }

      .fm-group:last-child {
        margin-bottom: 0;
      }

      .cap {
        position: sticky;
        top: var(--sticky-top, 0px);
        z-index: 5;
        background: var(--bg);
        padding: 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .cap-text {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }

      .cap-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .branch {
        font-size: 15px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        flex-shrink: 1;
      }

      .busy-count {
        font-size: 13px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .dot {
        font-size: 13px;
        color: var(--muted);
        flex-shrink: 0;
      }

      .free {
        font-size: 13px;
        color: var(--green);
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 1;
        min-width: 0;
      }

      .wait {
        font-size: 13px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 1;
        min-width: 0;
      }

      .meter {
        display: flex;
        gap: 3px;
        width: 100%;
      }

      .seg {
        height: 6px;
        border-radius: 3px;
        flex: 1;
        min-width: 0;
      }

      .seg.busy {
        background: var(--brand);
      }

      .seg.blocked {
        background: var(--red);
      }

      .seg.free {
        background: var(--line);
      }

      .fm-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 10px;
        margin-top: 4px;
      }
    `,
  ],
})
export class FloorMapComponent {
  @Input({ required: true }) floors!: { name: string; floor: Floor }[];
  @Input() canAssign = false;
  @Output() assign = new EventEmitter<Tile>();
  @Output() open = new EventEmitter<Tile>();

  onAssign(tile: Tile): void {
    this.assign.emit(tile);
  }

  onOpen(tile: Tile): void {
    this.open.emit(tile);
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return minutes + ' min';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return hours + ' h';
    }
    return hours + ' h ' + mins + ' min';
  }
}
