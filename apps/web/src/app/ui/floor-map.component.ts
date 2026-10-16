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
            <div class="cap-name">{{ entry.name }}</div>
            <div class="cap-info">
              <span class="num">{{ entry.floor.busy }} of {{ entry.floor.total }} busy</span>
              <span class="dot"> · </span>
              @if (entry.floor.nextFreeMinutes === 0) {
                <span class="free">{{ entry.floor.total - entry.floor.busy }} free now</span>
              } @else if (entry.floor.nextFreeMinutes !== null) {
                <span class="wait">next free in about {{ formatTime(entry.floor.nextFreeMinutes) }}</span>
              } @else {
                <span class="wait">every car in a bay is waiting on something</span>
              }
            </div>
          </div>
          <div
            class="meter"
            role="img"
            [attr.aria-label]="entry.floor.busy + ' of ' + entry.floor.total + ' spaces busy'"
          >
            @for (tile of entry.floor.tiles; track tile.space.key) {
              <span
                class="mseg"
                [class.busy]="tile.state === 'busy'"
                [class.blocked]="tile.state === 'blocked'"
                [class.free]="tile.state === 'free'"
              ></span>
            }
          </div>
        </div>
        <div class="fm-grid">
          @for (tile of entry.floor.tiles; track tile.space.key) {
            <bb-space-tile
              [tile]="tile"
              [canAssign]="canAssign"
              (assign)="assign.emit($event)"
              (open)="open.emit($event)"
            ></bb-space-tile>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .fm-group {
      margin-bottom: 22px;
    }
    .fm-group:last-child {
      margin-bottom: 0;
    }
    .cap {
      flex-direction: column;
      align-items: stretch;
      position: sticky;
      top: var(--sticky-top, 0px);
      z-index: 5;
      background: var(--bg);
      padding: 10px 0;
      display: flex;
      gap: 10px;
    }
    .cap-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }
    .cap-name {
      font-size: 15px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ink);
    }
    .cap-info {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      color: var(--muted);
      font-weight: 600;
    }
    .free {
      color: var(--green);
      font-weight: 600;
    }
    .wait {
      color: var(--muted);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meter {
      display: flex;
      gap: 3px;
      width: 100%;
      margin-top: 6px;
    }
    .mseg {
      height: 6px;
      border-radius: 3px;
      flex: 1;
      background: var(--line);
    }
    .mseg.busy {
      background: var(--brand);
    }
    .mseg.blocked {
      background: var(--red);
    }
    .mseg.free {
      background: var(--line);
    }
    .fm-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      align-items: stretch;   /* every tile the height of the tallest in its row, so the grid never looks ragged */
      gap: 10px;
      margin-top: 4px;
    }
  `,
})
export class FloorMapComponent {
  @Input({ required: true }) floors!: { name: string; floor: Floor }[];
  @Input() canAssign = false;
  @Output() assign = new EventEmitter<Tile>();
  @Output() open = new EventEmitter<Tile>();

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return minutes + ' min';
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) {
      return h + ' h';
    }
    return h + ' h ' + m + ' min';
  }
}
