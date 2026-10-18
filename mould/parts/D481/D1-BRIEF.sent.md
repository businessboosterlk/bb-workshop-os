PART D1. Workshop OS (a garage system in Sri Lanka), Angular 19, standalone components, signals. Two small faults, six parts.

FAULT 1, THE SEAT LABEL. A seat's role is one of three (from core/models.ts, exactly):
```
export type Role = 'owner' | 'desk' | 'staff';
```
`session.role()` returns `Role | ''`. The words for each role are: owner "Owner", desk "Front desk", staff "Staff". Today the rail's seat line turns every role that is not owner into "Staff", so the front desk seat (Sachini) reads "Staff". The login screen's demo seat line marks only the owner with "(owner)"; it must also mark a desk seat with "(front desk)". A plain staff seat stays unmarked.

FAULT 2, THE STARS. The customer rates a delivered car with five star buttons. A chosen star gets the class `on` and the brand colour, but the icon is drawn as an outline with fill none, so a car rated 5 shows five empty looking stars. Wanted: a chosen star is FILLED (its fill is the current colour and it keeps its stroke, so filled and outline stars are the same size); an unchosen star stays a light outline exactly as now. The single star beside a rating in the history list is filled too. The star button is 44px square and its icon sits 1.5px high in it, because the inline icon sits on a text baseline; centre the button's content with `display:grid;place-items:center`.

Icons are drawn only by the one icon component below, from generated shapes. Never type an svg, a path or a polygon anywhere.

THE ICON COMPONENT, whole file as it is now (apps/web/src/app/ui/icon.component.ts):
```ts
import { Component, Input, HostBinding, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LINE, BRAND } from './icons.generated';
import { OFFSETS, AIR } from './icon-offsets.generated';

/* THE ONE PLACE A DRAWING IS ASSEMBLED. Every shape is read from icons.generated.ts, which
   scripts/build-icons.mjs writes from Lucide (line) and Simple Icons (brand marks). Nothing is
   typed by hand, and ~/bb-systems/qa/hand-svg.mjs fails the build on any other svg in the source. */
@Component({
  selector: 'bb-icon',
  standalone: true,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [innerHTML]="svg" [attr.fill]="brand ? 'currentColor' : 'none'" [attr.stroke]="brand ? 'none' : 'currentColor'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg>`,
  styles: [`:host{display:inline-flex;flex-shrink:0;line-height:0} svg{width:var(--ico,16px);height:var(--ico,16px)}`]
})
export class IconComponent {
  private san = inject(DomSanitizer);
  private static cache = new Map<string, SafeHtml>();
  @Input() name = 'home';
  /* the air this drawing carries at its side, for the rule that pulls a leading icon in */
  @HostBinding('style.--air') get air(){ return AIR[this.name] ?? 3; }
  get brand(){ return !!BRAND[this.name]; }
  get svg(): SafeHtml {
    const k = this.name, C = IconComponent.cache;
    if (!C.has(k)) { const o = OFFSETS[k]; const body = BRAND[k] || LINE[k] || LINE['home']; C.set(k, this.san.bypassSecurityTrustHtml(o ? `<g transform="translate(${o[0]} ${o[1]})">${body}</g>` : body)); }
    return C.get(k)!;
  }
}
```

PART 1. Return the whole icon component file with exactly two changes: a new input `@Input() filled = false;` on the line after `@Input() name = 'home';`, with a short comment above it in the file's style saying a filled line drawing keeps its stroke; and the svg's fill attribute becomes `[attr.fill]="brand || filled ? 'currentColor' : 'none'"`. The stroke attribute stays exactly `[attr.stroke]="brand ? 'none' : 'currentColor'"`. Every other character stays. Header line exactly:
`// FILE: apps/web/src/app/ui/icon.component.ts`

PART 2. The rail's seat line (apps/web/src/app/pages/workshop/shell.component.ts), as it is now:
```
        <span class="who"><strong>{{ session.name() }}</strong><em>{{ session.role() === 'owner' ? 'Owner' : 'Staff' }}@if (session.branch()) { · {{ cast.branch(session.branch())?.name }} }</em></span>
```
Write that same line with the role words: owner gives Owner, desk gives Front desk, anything else gives Staff, as one template expression inside the `<em>`. Everything else on the line stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/workshop/shell.component.ts | start=        <span class="who"><strong>{{ session.name() }}</strong> | until=        <button class="x" type="button" (click)="theme.toggle()"`

PART 3. The login's demo seat line (apps/web/src/app/pages/workshop/login.component.ts), as it is now:
```
        @if (!cast.apiMode()) { <div class="demo">Demo seats: @for (u of cast.cast()?.users || []; track u.name; let last = $last) {<b>{{ u.name }}</b> {{ u.pin }}@if (u.role === 'owner') { (owner)}@if (!last) { · }}</div> }
```
Write that same line with `@if (u.role === 'desk') { (front desk)}` placed right after the owner's `@if (u.role === 'owner') { (owner)}`. Everything else stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/workshop/login.component.ts | start=        @if (!cast.apiMode()) { <div class="demo">Demo seats: | until=      </div>`

PART 4. The customer's star buttons (apps/web/src/app/pages/customer/job.component.ts), as it is now:
```
          <div class="stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="(j.rating || 0) >= s" (click)="rateIt(j.id, s)" [attr.aria-label]="s + ' stars'"><bb-icon name="star"/></button> }</div>
```
Write that same line with the icon as `<bb-icon name="star" [filled]="(j.rating || 0) >= s"/>`. The button keeps `[class.on]` and every other attribute. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=          <div class="stars">@for | until=          @if (j.rating) { <span class="ty">`

PART 5. The same file's star style line, as it is now:
```
    .stars{display:flex;gap:4px}.stars button{width:44px;height:44px;border:0;background:none;color:var(--line-2);--ico:28px;transition:color 150ms var(--ease),transform 150ms var(--ease)}
```
Write that same line with `display:grid;place-items:center;` added at the start of the `.stars button{` rule. Every other rule and character stays, no character between one closing brace and the next selector. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .stars{display:flex;gap:4px} | until=    .stars button.on{color:var(--brand)}`

PART 6. The history row's rating (apps/web/src/app/pages/customer/history.component.ts), as it is now:
```
            @if (j.rating) { <span class="rt"><bb-icon name="star"/>{{ j.rating }}</span> }
```
Write that same line with the icon as `<bb-icon name="star" [filled]="true"/>`. Everything else stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/history.component.ts | start=            @if (j.rating) { <span class="rt"> | until=            <bb-icon name="chev" class="go"/>`

RULES. British English. No em or en dash. No comma before and, or, but or nor. No new colour, no hex, no rgb. Keep each line's leading spaces exactly.

Return ONE ```ts code block holding the six parts in order, each opened by its header line exactly (they are merge markers). No explanation before or after the code block.
