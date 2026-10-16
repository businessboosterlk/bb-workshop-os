import { Component, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { IconComponent } from './icon.component';
import { Tile } from '../core/spaces';
import { CastService } from '../core/cast.service';
import { bodyType, BodyType } from '../core/vehicles';

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
          <div class="veh sedan"><div class="car ghost"><i class="in"></i></div></div>
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
          <div class="veh {{ body }}" [attr.data-body]="body">
            <i class="w fl"></i><i class="w fr"></i><i class="w rl"></i><i class="w rr"></i>
            <div class="car {{ tile.state === 'busy' ? 'solid' : 'blocked' }}"><i class="cab"></i><i class="hl t"></i><i class="hl b"></i></div>
            <i class="mr t"></i><i class="mr b"></i>
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
    /* THE CAR, from above, nose to the right. Four silhouettes cut with clip-path from one ink body: hatchback, sedan, SUV and
       van, each with its own glasshouse. Wheels and mirrors sit outside the clipped body so they are never cut off. */
    .veh{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transition:transform 200ms var(--ease)}
    @media (hover:hover){button.tile:hover .veh{transform:translate(-50%,-50%) translateX(3px)}}
    .veh.hatch{width:62%;height:30px}.veh.sedan{width:76%;height:30px}.veh.suv{width:74%;height:34px}.veh.van{width:78%;height:36px}
    .car{position:absolute;inset:0;background:var(--ink)}
    .veh.sedan .car{clip-path:polygon(2% 22%,6% 8%,14% 2%,60% 0,80% 3%,94% 11%,100% 32%,100% 68%,94% 89%,80% 97%,60% 100%,14% 98%,6% 92%,2% 78%)}
    .veh.hatch .car{clip-path:polygon(0 18%,4% 4%,14% 0,58% 0,82% 3%,95% 14%,100% 34%,100% 66%,95% 86%,82% 97%,58% 100%,14% 100%,4% 96%,0 82%)}
    .veh.suv .car{clip-path:polygon(0 14%,4% 3%,12% 0,86% 0,96% 5%,100% 18%,100% 82%,96% 95%,86% 100%,12% 100%,4% 97%,0 86%)}
    .veh.van .car{clip-path:polygon(0 10%,3% 2%,10% 0,90% 0,98% 4%,100% 14%,100% 86%,98% 96%,90% 100%,10% 100%,3% 98%,0 90%)}
    .cab{position:absolute;top:5px;bottom:5px;background:var(--surface);opacity:.3;clip-path:polygon(0 6%,88% 0,100% 50%,88% 100%,0 94%)}
    .veh.sedan .cab{left:30%;width:36%}.veh.hatch .cab{left:22%;width:50%}.veh.suv .cab{left:24%;width:48%}.veh.van .cab{left:10%;width:66%}
    .hl{position:absolute;right:3px;width:3px;height:5px;border-radius:1.5px;background:var(--surface);opacity:.85}.hl.t{top:7px}.hl.b{bottom:7px}
    .veh.van .hl{right:2px;height:7px}
    .w{position:absolute;width:11px;height:6px;border-radius:2px;background:var(--ink)}
    .w.fl,.w.fr{left:70%}.w.rl,.w.rr{left:12%}.w.fl,.w.rl{top:-2px}.w.fr,.w.rr{bottom:-2px}
    .veh.van .w.fl,.veh.van .w.fr{left:74%}.veh.van .w.rl,.veh.van .w.rr{left:10%}
    .mr{position:absolute;left:66%;width:4px;height:4px;border-radius:1px;background:var(--ink)}.mr.t{top:-3px}.mr.b{bottom:-3px}
    .veh.van .mr{left:74%}.veh.hatch .mr{left:70%}
    .car.blocked,.veh:has(.car.blocked) .w,.veh:has(.car.blocked) .mr{background:var(--red)}
    /* a free bay: the same silhouette as an outline, cut twice (the inner cut is the page colour) */
    .car.ghost{background:var(--line-2)}.car.ghost .in{position:absolute;inset:1.5px;background:var(--bg);clip-path:inherit}
    .tile.free .veh{top:11px;transform:translateX(-50%)}
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

  get body(): BodyType { return bodyType(this.tile.job?.make, this.tile.job?.model); }

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
