import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { IconComponent } from './icon.component';
import { Tile } from '../core/spaces';
import { CastService } from '../core/cast.service';

@Component({
  selector: 'bb-space-tile',
  standalone: true,
  imports: [IconComponent],
  template: `
    <!-- A parking space seen from above, nose to the right (Thulaib, 16 Oct 2026: "the bay areas represent as like cars").
         Free: a hollow car and the word Available. Busy: a solid car, the plate, what it is in for, the stages done and the
         time left in working days. Blocked: the same car in red. Drawn from boxes, never an svg typed by hand. -->
    @if (tile.state === 'free') {
      <div class="tile free" [attr.data-space]="tile.space.key">
        <div class="head"><span class="badge"><bb-icon [name]="spaceIcon"/></span><span class="label">{{ tile.space.label }}</span></div>
        <div class="bay">
          <div class="car ghost"><i class="cab"></i></div>
          <span class="avail">Available</span>
        </div>
        @if (canAssign) {
          <button type="button" class="btn ghost assign-btn" (click)="assign.emit(tile)"><bb-icon name="plus"/>Assign a car</button>
        }
      </div>
    } @else {
      <button type="button" class="tile {{ tile.state }}" [attr.data-space]="tile.space.key" [attr.aria-label]="ariaLabel" (click)="open.emit(tile)">
        <div class="head"><span class="badge"><bb-icon [name]="spaceIcon"/></span><span class="label">{{ tile.space.label }}</span></div>
        <div class="bay">
          <div class="car {{ tile.state === 'busy' ? 'solid' : 'blocked' }}">
            <i class="w fl"></i><i class="w fr"></i><i class="w rl"></i><i class="w rr"></i>
            <i class="cab"></i><i class="hl t"></i><i class="hl b"></i>
          </div>
        </div>
        <div class="body">
          <span class="plate">{{ tile.job?.plate }}</span>
          <p class="car-name">{{ tile.job?.make }} {{ tile.job?.model }}</p>
          @if (tile.state === 'busy') {
            <p class="why">{{ serviceLabel }}<span> · {{ currentPhaseLabel }}</span></p>
            <div class="prog-row"><div class="prog"><i [style.width.%]="pct"></i></div><span class="stages" [attr.aria-label]="done + ' of ' + total + ' stages done'">{{ done }} of {{ total }}</span></div>
            <p class="left" [class.over]="tile.minutesLeft === 0 && hasNowPhase">{{ leftText }}</p>
          } @else {
            <p class="blocked-line"><bb-icon name="pause"/>Bay blocked · {{ formatTime(tile.heldMinutes) }}</p>
            <p class="waiting">{{ holdLabel }}</p>
          }
        </div>
      </button>
    }
  `,
  styles: [`
    :host{display:block;min-width:0;height:100%}
    .tile{display:grid;grid-template-rows:auto auto 1fr;gap:10px;width:100%;height:100%;min-width:0;box-sizing:border-box;padding:12px;text-align:left;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--r);font:inherit;transition:border-color 150ms var(--ease)}
    .tile.free{border-style:dashed;border-color:var(--line-2);background:transparent}
    button.tile{cursor:pointer}@media (hover:hover){button.tile:hover{border-color:var(--ink)}}button.tile:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
    .head{display:flex;align-items:center;gap:8px;min-width:0}
    .badge{width:28px;height:28px;flex:none;border-radius:var(--r-s);background:var(--surface-2);color:var(--ink);display:grid;place-items:center;line-height:0;--ico:15px}
    .label{flex:1;min-width:0;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* THE BAY: the painted lines of a parking space, closed at the back (left), open at the front (right) */
    .bay{position:relative;height:72px;border-radius:6px 0 0 6px;background:var(--surface-2);border:2px solid var(--line-2);border-right:0;box-sizing:border-box}
    .tile.free .bay{background:transparent;border-style:dashed;border-width:1.5px}
    /* THE CAR, from above: a body with a rounder nose, a cabin set in, four wheels tucked under, two headlights */
    .car{position:absolute;left:12%;right:12%;top:50%;height:30px;transform:translateY(-50%);border-radius:9px 15px 15px 9px;background:var(--ink);transition:transform 200ms var(--ease)}
    @media (hover:hover){button.tile:hover .car{transform:translateY(-50%) translateX(3px)}}
    .cab{position:absolute;left:27%;width:40%;top:4px;bottom:4px;border-radius:5px 8px 8px 5px;background:var(--surface);opacity:.32}
    .cab::after{content:"";position:absolute;right:-1px;top:1px;bottom:1px;width:3px;border-radius:2px;background:var(--surface);opacity:.7}
    .w{position:absolute;width:11px;height:6px;border-radius:2px;background:var(--ink)}
    .w.fl{left:68%;top:-2px}.w.fr{left:68%;bottom:-2px}.w.rl{left:12%;top:-2px}.w.rr{left:12%;bottom:-2px}
    .hl{position:absolute;right:2px;width:3px;height:5px;border-radius:1.5px;background:var(--surface);opacity:.85}.hl.t{top:6px}.hl.b{bottom:6px}
    .car.blocked,.car.blocked .w{background:var(--red)}
    .car.ghost{background:transparent;border:1.5px dashed var(--line-2);box-sizing:border-box;top:11px;transform:none}
    .car.ghost .cab{background:transparent;border:1px dashed var(--line-2);opacity:1}.car.ghost .cab::after{display:none}
    .avail{position:absolute;left:0;right:0;bottom:7px;text-align:center;font-size:11.5px;font-weight:650;color:var(--muted)}
    .assign-btn{align-self:end;width:100%;min-height:40px;min-width:0}
    .body{display:grid;gap:4px;min-width:0;align-content:start}
    .plate{display:inline-block;width:fit-content;max-width:100%;font-size:12.5px;font-weight:800;letter-spacing:.05em;text-indent:.05em;padding:calc(2px + .05em) 7px calc(2px - .05em);border-radius:6px;background:var(--ink);color:var(--bg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .car-name{margin:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .why{margin:2px 0 0;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.why span{font-weight:500;color:var(--muted)}
    .prog-row{display:flex;align-items:center;gap:8px;min-width:0;margin-top:4px}
    .prog{flex:1;height:5px;border-radius:3px;background:var(--line);overflow:hidden}.prog i{display:block;height:100%;background:var(--ink);transition:width 400ms var(--ease)}
    .stages{flex:none;font-size:11.5px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
    .left{margin:2px 0 0;font-size:12.5px;font-weight:650;line-height:1.3;min-width:0}.left.over{color:var(--red)}
    .blocked-line{margin:2px 0 0;display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:650;color:var(--red);--ico:14px;overflow:hidden;white-space:nowrap}
    .waiting{margin:0;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `],
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
