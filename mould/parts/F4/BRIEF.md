Write the COMPLETE contents of one new file: apps/web/src/app/ui/dock.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the holding dock of a garage, shown under the floor picture. Cars waiting on parts, an approval or paint curing
leave their bay and wait here, so a bay is never counted busy by a car that is only waiting. Ready cars wait here for pickup.
Cars that have arrived but have no space yet wait in the queue.
  import { Dock, LaneKey } from '../core/spaces';
  export type LaneKey = 'parts' | 'approval' | 'curing' | 'ready';
  export interface DockCar { job: Job; minutes: number; }
  export interface Lane { key: LaneKey; label: string; cars: DockCar[]; }
  export interface Dock { lanes: Lane[]; queue: Job[]; }
  import { Job } from '../core/models';  Job fields you may read: id, plate, make, model.

THE COMPONENT, EXACTLY:
  selector 'bb-dock', class DockComponent, standalone.
  @Input({ required: true }) dock!: Dock;
  @Input() canAssign = false;
  @Output() open = new EventEmitter<Job>();    // tapping a car in a lane
  @Output() place = new EventEmitter<Job>();   // the Place button on a queued car

THE LAYOUT:
  A <section class="dock"> with a head: "Holding dock" (16px, weight 700) and under it "Cars off the floor, waiting on
  something" (12.5px var(--muted)).
  Then a grid of columns, display:grid, grid-template-columns:repeat(auto-fit,minmax(200px,1fr)), gap 10px, margin-top 10px.
  FIRST column, the queue: <div class="lane" data-lane="queue">, head "Waiting for a space" with a count pill (class "pill",
    the number of queued cars, class num). One row per queued car: plate chip, make and model, and only when canAssign a
    <button type="button" class="btn soft sm"> with <bb-icon name="move"/>Place, emitting place with the job.
  THEN one column per lane in the order given: <div class="lane" [attr.data-lane]="lane.key">, head with the lane label and a
    count pill: the pill is "pill quoted" (amber) for parts, approval and curing when the lane has cars, "pill won" (green) for
    ready when it has cars, plain "pill" when empty. One row per car, the whole row a <button type="button" class="dcar">
    emitting open with the job: plate chip, make and model (ellipsis), and at the right the minutes as time, 12px weight 600,
    class num: var(--amber) for parts, approval and curing, var(--green) for ready, with <bb-icon name="clock"/> before it.
    aria-label "{plate}, {lane label}, {time}".
  An empty column shows "No cars" in 12.5px var(--faint), never hidden, so the four waiting states are always visible.
  Each column is a card (class "card") with padding 12px and its rows separated by a hairline var(--line).
  The plate chip: class "plate": 12px, weight 800, letter-spacing .05em, background var(--ink), colour var(--bg), radius 6px,
  padding 2px 7px, flex none.
  Rows are at least 44px tall. Nothing may cause a horizontal scroll at 390px.
