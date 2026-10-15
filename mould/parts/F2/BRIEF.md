Write the COMPLETE contents of one new file: apps/web/src/app/ui/space-tile.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: one tile on the floor picture of a garage. A tile is one space (a hoist, a bay, a paint booth) in one of three
states: busy (a car is being worked on), blocked (a car is in it but paused, waiting on something), free.

IMPORTS: import { Tile } from '../core/spaces'; the IconComponent from './icon.component'.
  export interface SpaceDef { key: string; label: string; kind?: string; }
  export interface Tile { branch: string; space: SpaceDef; job: Job | null; state: 'busy' | 'blocked' | 'free'; minutesInStage: number; minutesLeft: number; heldMinutes: number; }
  Job fields you may read: id, plate, make, model, hold ('parts' | 'approval' | 'curing' or undefined),
  phases: { key: string; label: string; hours: number; status: 'done' | 'now' | 'next' }[].

THE COMPONENT, EXACTLY:
  selector 'bb-space-tile', class SpaceTileComponent, standalone.
  @Input({ required: true }) tile!: Tile;
  @Input() canAssign = false;            // a staff seat may place a car in a free space
  @Output() assign = new EventEmitter<Tile>();   // the Assign button on a free tile
  @Output() open = new EventEmitter<Tile>();     // tapping a busy or blocked tile
  The host element carries the classes 'tile' and the state ('busy', 'blocked' or 'free') through @HostBinding('class'),
  and the attribute data-space with the space key through @HostBinding('attr.data-space').

THE LAYOUT (one card, the whole tile is one button for busy and blocked, a div with an Assign button when free):
  Row 1, the head: a 32px square badge, a <span class="badge"> (radius 8px, display grid, place-items centre) holding the space icon centred (--ico:16px), then the space label
    (13px, weight 600, ellipsis), then at the right a small state word: "Busy", "Blocked" or "Free" (11px, weight 700,
    uppercase is NOT allowed, coloured by state). The badge background is the state's soft colour and the icon its strong
    colour: busy --brand-soft and --brand-dark, blocked --red-soft and --red, free --green-soft and --green.
    The space icon by space.kind: 'hoist' wrench, 'booth' spray, 'detail' sparkle, 'wheel' wheel, anything else bay.
  BUSY body: the plate in a chip (class "plate": 12.5px, weight 800, letter-spacing .05em, background var(--ink), colour
    var(--bg), radius 6px, padding 2px 7px), then make and model (13.5px weight 600, ellipsis), then the stage line:
    the label of the phase with status 'now' (or "Waiting to start" when none) and " · " and "{time in stage} in stage",
    12px var(--muted), ellipsis. Last line: "About {minutesLeft as time} left" in 12px var(--brand-dark) weight 600, or
    "Running over" in var(--amber) when minutesLeft is 0 and a phase is 'now'.
  BLOCKED body: plate chip, make and model, then a line with <bb-icon name="pause"/> and "Bay blocked · {heldMinutes as time}"
    in var(--red), weight 700, 12.5px; then "Waiting for parts", "Waiting for approval" or "Curing" (from job.hold) in 12px
    var(--muted). The card border is 1px solid var(--red). Solid, no animation.
  FREE body: "Free" is already in the head; the body says "Ready for the next car" in 12.5px var(--muted) and, only when
    canAssign, a full-width button: <button type="button" class="btn soft sm">, <bb-icon name="plus"/>Assign a car, emitting
    assign. The free card border is a 1px dashed var(--line-2).
  The tile has padding 12px, gap 8px between rows, min-height 132px, the whole card fills its grid cell (display:grid).
  Busy and blocked: the card is a <button type="button"> with text-align:left, width 100%, emitting open on click, with an
  aria-label "{space label}, {plate}, {state word}". Hover (only inside @media (hover:hover)) changes the border colour to
  var(--brand); :active scales to .99. Free: a <div>.
  Every number shown carries class "num".
