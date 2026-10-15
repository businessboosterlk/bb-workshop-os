Write the COMPLETE contents of one new file: apps/web/src/app/ui/floor-map.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the floor picture of a garage. Every space of each branch shown as a tile, grouped by branch, each group under a
sticky capacity line. It uses the tile component that already exists:
  import { SpaceTileComponent } from './space-tile.component';   selector 'bb-space-tile', inputs tile (required) and
  canAssign, outputs assign (emits the Tile) and open (emits the Tile).
  import { Floor, Tile } from '../core/spaces';
  export interface Floor { branch: string; tiles: Tile[]; busy: number; total: number; nextFreeMinutes: number | null; }
  (busy already counts busy plus blocked tiles; nextFreeMinutes is 0 when a tile is free, the smallest minutes left of a
  busy tile when none is free, null when every occupied tile is blocked.)

THE COMPONENT, EXACTLY:
  selector 'bb-floor-map', class FloorMapComponent, standalone, imports SpaceTileComponent.
  @Input({ required: true }) floors!: { name: string; floor: Floor }[];   // one entry per branch shown, in order
  @Input() canAssign = false;
  @Output() assign = new EventEmitter<Tile>();   // re-emit the tile's assign
  @Output() open = new EventEmitter<Tile>();     // re-emit the tile's open

THE LAYOUT:
  For each entry, a <section class="fm-group" [attr.data-branch]="entry.floor.branch">:
  1. The capacity line, a <div class="cap"> with attributes data-busy and data-total set to the floor's busy and total. It is
     position:sticky with top:var(--sticky-top,0px), z-index 5, background var(--bg), padding 10px 0, display flex,
     align-items center, gap 10px. Inside: the branch name (15px, weight 700, ellipsis) and then a text
     "{busy} of {total} busy" (13px, weight 600, class num) followed by " · " and the wait text, 13px var(--muted):
       nextFreeMinutes 0     -> "{total - busy} free now" (green, var(--green), weight 600)
       nextFreeMinutes > 0   -> "next free in about {time}"
       nextFreeMinutes null  -> "every car in a bay is waiting on something"
     Under the text, filling the width, a meter: a row of total small segments (height 6px, radius 3px, gap 3px, each flex 1):
     a segment is var(--brand) for each busy tile, var(--red) for each blocked tile, var(--line) for each free tile, in the
     order of the tiles. The meter has role="img" and aria-label "{busy} of {total} spaces busy".
     Put the text and the meter in a column so the line reads: name, text, then the meter below them.
  2. The tiles: <div class="fm-grid"> with display:grid, grid-template-columns:repeat(auto-fill,minmax(160px,1fr)), gap 10px,
     margin-top 4px, one <bb-space-tile> per tile in order, passing tile and canAssign and re-emitting assign and open.
  Groups are separated by 22px. Nothing may cause a horizontal scroll at a 390px wide screen.
  Time in words as the common rules say ("14 min", "2 h 30 min", "3 h").
