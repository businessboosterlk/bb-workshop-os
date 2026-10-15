import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IconComponent } from './icon.component';
import { Dock, LaneKey } from '../core/spaces';
import { Job } from '../core/models';

@Component({
  selector: 'bb-dock',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="dock">
      <div class="head">
        <h2>Holding dock</h2>
        <p>Cars off the floor, waiting on something</p>
      </div>
      <div class="grid">
        <div class="lane card" data-lane="queue">
          <div class="lane-head">
            <span class="lane-label">Waiting for a space</span>
            <span class="pill num">{{ dock.queue.length }}</span>
          </div>
          @for (job of dock.queue; track job.id) {
            <div class="row">
              <span class="plate">{{ job.plate }}</span>
              <span class="car-info">{{ job.make }} {{ job.model }}</span>
              @if (canAssign) {
                <button type="button" class="btn soft sm" (click)="place.emit(job)">
                  <bb-icon name="move" style="--ico:14px" />
                  Place
                </button>
              }
            </div>
          } @empty {
            <div class="empty">No cars</div>
          }
        </div>
        @for (lane of dock.lanes; track lane.key) {
          <div class="lane card" [attr.data-lane]="lane.key">
            <div class="lane-head">
              <span class="lane-label">{{ lane.label }}</span>
              @if (lane.cars.length > 0) {
                @if (lane.key === 'ready') {
                  <span class="pill won num">{{ lane.cars.length }}</span>
                } @else {
                  <span class="pill quoted num">{{ lane.cars.length }}</span>
                }
              } @else {
                <span class="pill num">0</span>
              }
            </div>
            @for (car of lane.cars; track car.job.id) {
              <button
                type="button"
                class="dcar"
                [attr.aria-label]="car.job.plate + ', ' + lane.label + ', ' + formatTime(car.minutes)"
                (click)="open.emit(car.job)"
              >
                <span class="plate">{{ car.job.plate }}</span>
                <span class="car-info">{{ car.job.make }} {{ car.job.model }}</span>
                <span class="time num" [class.time-amber]="lane.key !== 'ready'" [class.time-green]="lane.key === 'ready'">
                  <bb-icon name="clock" style="--ico:14px" />
                  {{ formatTime(car.minutes) }}
                </span>
              </button>
            } @empty {
              <div class="empty">No cars</div>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .dock {
        display: flex;
        flex-direction: column;
      }

      .head {
        margin-bottom: 4px;
      }

      .head h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--ink);
      }

      .head p {
        margin: 2px 0 0;
        font-size: 12.5px;
        color: var(--muted);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
        margin-top: 10px;
      }

      .lane {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 0;
        min-width: 0;
      }

      .lane-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        min-height: 24px;
      }

      .lane-label {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pill {
        flex: none;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        min-height: 44px;
        border-top: 1px solid var(--line);
        min-width: 0;
      }

      .row:first-of-type {
        border-top: none;
      }

      .dcar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        min-height: 44px;
        border: none;
        background: none;
        cursor: pointer;
        width: 100%;
        text-align: left;
        border-top: 1px solid var(--line);
        min-width: 0;
      }

      .dcar:first-of-type {
        border-top: none;
      }

      .plate {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.05em;
        background: var(--ink);
        color: var(--bg);
        border-radius: 6px;
        padding: 2px 7px;
        flex: none;
      }

      .car-info {
        font-size: 12.5px;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        flex: none;
      }

      .time-amber {
        color: var(--amber);
      }

      .time-green {
        color: var(--green);
      }

      .empty {
        font-size: 12.5px;
        color: var(--faint);
        padding: 8px 0;
        border-top: 1px solid var(--line);
      }

      .empty:first-of-type {
        border-top: none;
      }

      .btn {
        flex: none;
      }
    `,
  ],
})
export class DockComponent {
  @Input({ required: true }) dock!: Dock;
  @Input() canAssign = false;
  @Output() open = new EventEmitter<Job>();
  @Output() place = new EventEmitter<Job>();

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} h`;
    }
    return `${hours} h ${mins} min`;
  }
}
