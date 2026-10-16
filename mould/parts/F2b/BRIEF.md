Write the COMPLETE new contents of the existing file apps/web/src/app/ui/space-tile.component.ts, given at the end. Output ONLY one
```ts code block. Keep its selector, inputs, outputs, host bindings and every helper it has (formatTime, spaceIcon, holdLabel,
currentPhaseLabel, hasNowPhase, ariaLabel). REDRAW the template and the styles as below.

{{COMMON}}

WHAT THE OWNER ASKED FOR (16 Oct 2026, in his words): "the bay areas represent as like cars. If there is nobody there it will show
like a car but saying available, just a hollow thing. Where there is a vehicle it will show vehicle in, why the vehicle is in for
and a bar how many more days is pending to finish this job. Unique, cool, something people have not seen."
The demo is BLACK AND WHITE: use --ink, --surface, --surface-2, --line, --line-2, --muted for everything; --red only for blocked.

EVERY TYPE IT READS, FIELD BY FIELD:
  import { Tile } from '../core/spaces';
    export interface Tile { branch: string; space: { key: string; label: string; kind?: string }; job: Job | null;
      state: 'busy' | 'blocked' | 'free'; minutesInStage: number; minutesLeft: number; heldMinutes: number; }
  Job fields you may read: plate: string; make: string; model: string; service: string (a key);
    hold?: 'parts' | 'approval' | 'curing'; phases: { key: string; label: string; hours: number; status: 'done' | 'now' | 'next' }[]
  NEW: inject CastService (import { CastService } from '../core/cast.service') as cast; cast.service(key: string) returns
    { key: string; label: string } | undefined. serviceLabel getter = cast.service(job.service)?.label ?? ''.
  NEW getters: done = phases with status 'done' (count); total = phases.length; pct = total ? done / total * 100 : 0.
  NEW leftText getter: minutesLeft >= 480 -> "About {d} working day left" when d === 1 else "About {d} working days left" with
    d = Math.ceil(minutesLeft / 480) (a working day is 8 h). Otherwise minutesLeft > 0 -> "About {formatTime(minutesLeft)} left".
    Otherwise "Running over". Keep the .left element's class over when running over.

THE TILE (all three states share the frame): the host keeps classes busy, blocked or free and data-space. Inside, one element
with class "tile {state}" (a <div> when free, a <button type="button"> that emits open when busy or blocked, as today), padding
12px, display grid, gap 10px, card look (var(--surface), 1px solid var(--line), radius var(--r)); free uses a 1px dashed var(--line-2) border.
1. HEAD, display flex, align-items center, gap 8px: <span class="badge"> 28px square, radius var(--r-s), background var(--surface-2),
   display grid, place-items center, --ico:15px, holding <bb-icon [name]="spaceIcon"/>; then <span class="label"> the space label
   (14px, weight 650, flex 1, min-width 0, ellipsis); then <span class="state"> 11.5px weight 600 var(--muted): "Available", "Car in"
   or "Bay blocked" (blocked in var(--red)).
2. THE BAY, <div class="bay">, position relative, height 64px, painted lines seen from above: border-top, border-bottom and
   border-left 2px solid var(--line-2), NO right border (the open end), border-radius 4px 0 0 4px.
   Inside it THE CAR, seen from above, nose to the right, a <div class="car {solid|ghost|blocked}"> absolutely placed: left 10%,
   right 12%, top 50%, height 34px, transform translateY(-50%), border-radius 12px 17px 17px 12px, box-sizing border-box.
   It holds four <i class="w"></i> wheels (width 12px, height 5px, radius 2px, absolute; two at top -3px and two at bottom -3px,
   left 16% and left 70%), a rear window <i class="rw"></i> (absolute, left 12%, top 18%, width 9%, height 64%, radius 3px) and a
   windscreen <i class="ws"></i> (absolute, left 60%, top 14%, width 15%, height 72%, radius 4px).
     solid (busy): body var(--ink), wheels var(--ink), both windows var(--muted).
     ghost (free): background transparent, border 1.5px dashed var(--line-2), NO wheels and NO windows shown (do not render them);
       inside it, centred both ways, <span class="avail">Available</span> 12px weight 650 var(--muted).
     blocked: body var(--red), wheels var(--red), windows var(--red-soft).
   One gentle touch only: on hover (inside @media (hover:hover)) a busy or blocked car moves 3px to the right
   (transition transform 200ms var(--ease)). No other motion, no animation loop.
3. BELOW THE BAY:
   busy: <span class="plate"> the plate (keep the existing plate style) then <p class="car-name"> make and model (ellipsis);
     <p class="why"> 13px weight 600: "{serviceLabel}" then <span> " · {currentPhaseLabel}" in var(--muted) weight 500 (ellipsis);
     <div class="prog"> height 6px, radius 3px, background var(--line), overflow hidden, holding ONE <i> with display block, height
       100%, background var(--ink), [style.width.%]="pct", transition width 400ms var(--ease);
     a row (display flex, justify-content space-between, gap 8px): <p class="left"> 12.5px weight 650 = leftText, and
       <span class="stages"> 12px var(--muted) "{done} of {total} stages".
   blocked: plate, car-name, then the existing <p class="blocked-line"> (pause icon, "Bay blocked · {formatTime(heldMinutes)}")
     in var(--red) and <p class="waiting"> holdLabel.
   free: <p class="free-text">Ready for the next car</p> and, when canAssign, the existing Assign button (class "btn soft sm
     assign-btn", icon plus, "Assign a car"), full width, min-height 40px.
Every single-line text: white-space nowrap, overflow hidden, text-overflow ellipsis. Nothing may make a 390px screen scroll sideways.
Keep aria-label on the button. No svg, no image, no gradient, no box-shadow.

THE EXISTING FILE, apps/web/src/app/ui/space-tile.component.ts:
{{FILE}}
