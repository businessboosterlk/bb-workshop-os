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
{{file:apps/web/src/app/ui/icon.component.ts}}
```

PART 1. Return the whole icon component file with exactly two changes: a new input `@Input() filled = false;` on the line after `@Input() name = 'home';`, with a short comment above it in the file's style saying a filled line drawing keeps its stroke; and the svg's fill attribute becomes `[attr.fill]="brand || filled ? 'currentColor' : 'none'"`. The stroke attribute stays exactly `[attr.stroke]="brand ? 'none' : 'currentColor'"`. Every other character stays. Header line exactly:
`// FILE: apps/web/src/app/ui/icon.component.ts`

PART 2. The rail's seat line (apps/web/src/app/pages/workshop/shell.component.ts), as it is now:
```
{{lines:apps/web/src/app/pages/workshop/shell.component.ts:48:48}}
```
Write that same line with the role words: owner gives Owner, desk gives Front desk, anything else gives Staff, as one template expression inside the `<em>`. Everything else on the line stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/workshop/shell.component.ts | start=        <span class="who"><strong>{{ session.name() }}</strong> | until=        <button class="x" type="button" (click)="theme.toggle()"`

PART 3. The login's demo seat line (apps/web/src/app/pages/workshop/login.component.ts), as it is now:
```
{{lines:apps/web/src/app/pages/workshop/login.component.ts:27:27}}
```
Write that same line with `@if (u.role === 'desk') { (front desk)}` placed right after the owner's `@if (u.role === 'owner') { (owner)}`. Everything else stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/workshop/login.component.ts | start=        @if (!cast.apiMode()) { <div class="demo">Demo seats: | until=      </div>`

PART 4. The customer's star buttons (apps/web/src/app/pages/customer/job.component.ts), as it is now:
```
{{lines:apps/web/src/app/pages/customer/job.component.ts:68:68}}
```
Write that same line with the icon as `<bb-icon name="star" [filled]="(j.rating || 0) >= s"/>`. The button keeps `[class.on]` and every other attribute. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=          <div class="stars">@for | until=          @if (j.rating) { <span class="ty">`

PART 5. The same file's star style line, as it is now:
```
{{lines:apps/web/src/app/pages/customer/job.component.ts:127:127}}
```
Write that same line with `display:grid;place-items:center;` added at the start of the `.stars button{` rule. Every other rule and character stays, no character between one closing brace and the next selector. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .stars{display:flex;gap:4px} | until=    .stars button.on{color:var(--brand)}`

PART 6. The history row's rating (apps/web/src/app/pages/customer/history.component.ts), as it is now:
```
{{lines:apps/web/src/app/pages/customer/history.component.ts:22:22}}
```
Write that same line with the icon as `<bb-icon name="star" [filled]="true"/>`. Everything else stays. Header line exactly:
`// BLOCK: apps/web/src/app/pages/customer/history.component.ts | start=            @if (j.rating) { <span class="rt"> | until=            <bb-icon name="chev" class="go"/>`

RULES. British English. No em or en dash. No comma before and, or, but or nor. No new colour, no hex, no rgb. Keep each line's leading spaces exactly.

Return ONE ```ts code block holding the six parts in order, each opened by its header line exactly (they are merge markers). No explanation before or after the code block.
