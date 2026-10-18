```ts
// FILE: apps/web/src/app/ui/icon.component.ts
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
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [innerHTML]="svg" [attr.fill]="brand || filled ? 'currentColor' : 'none'" [attr.stroke]="brand ? 'none' : 'currentColor'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg>`,
  styles: [`:host{display:inline-flex;flex-shrink:0;line-height:0} svg{width:var(--ico,16px);height:var(--ico,16px)}`]
})
export class IconComponent {
  private san = inject(DomSanitizer);
  private static cache = new Map<string, SafeHtml>();
  @Input() name = 'home';
  /* a filled line drawing keeps its stroke */
  @Input() filled = false;
  /* the air this drawing carries at its side, for the rule that pulls a leading icon in */
  @HostBinding('style.--air') get air(){ return AIR[this.name] ?? 3; }
  get brand(){ return !!BRAND[this.name]; }
  get svg(): SafeHtml {
    const k = this.name, C = IconComponent.cache;
    if (!C.has(k)) { const o = OFFSETS[k]; const body = BRAND[k] || LINE[k] || LINE['home']; C.set(k, this.san.bypassSecurityTrustHtml(o ? `<g transform="translate(${o[0]} ${o[1]})">${body}</g>` : body)); }
    return C.get(k)!;
  }
}
// BLOCK: apps/web/src/app/pages/workshop/shell.component.ts | start=        <span class="who"><strong>{{ session.name() }}</strong> | until=        <button class="x" type="button" (click)="theme.toggle()"
        <span class="who"><strong>{{ session.name() }}</strong><em>{{ session.role() === 'owner' ? 'Owner' : session.role() === 'desk' ? 'Front desk' : 'Staff' }}@if (session.branch()) { · {{ cast.branch(session.branch())?.name }} }</em></span>
// BLOCK: apps/web/src/app/pages/workshop/login.component.ts | start=        @if (!cast.apiMode()) { <div class="demo">Demo seats: | until=      </div>
        @if (!cast.apiMode()) { <div class="demo">Demo seats: @for (u of cast.cast()?.users || []; track u.name; let last = $last) {<b>{{ u.name }}</b> {{ u.pin }}@if (u.role === 'owner') { (owner)}@if (u.role === 'desk') { (front desk)}@if (!last) { · }}</div> }
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=          <div class="stars">@for | until=          @if (j.rating) { <span class="ty">
          <div class="stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="(j.rating || 0) >= s" (click)="rateIt(j.id, s)" [attr.aria-label]="s + ' stars'"><bb-icon name="star" [filled]="(j.rating || 0) >= s"/></button> }</div>
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .stars{display:flex;gap:4px} | until=    .stars button.on{color:var(--brand)}
    .stars{display:flex;gap:4px}.stars button{display:grid;place-items:center;width:44px;height:44px;border:0;background:none;color:var(--line-2);--ico:28px;transition:color 150ms var(--ease),transform 150ms var(--ease)}
// BLOCK: apps/web/src/app/pages/customer/history.component.ts | start=            @if (j.rating) { <span class="rt"> | until=            <bb-icon name="chev" class="go"/>
            @if (j.rating) { <span class="rt"><bb-icon name="star" [filled]="true"/>{{ j.rating }}</span> }
```