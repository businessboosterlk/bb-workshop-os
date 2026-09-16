import { Component, Input, OnChanges, signal } from '@angular/core';

/* The progress ring: the one cinematic object on the customer's screen. The stroke
   draws from empty to the job's real fraction over 900ms on the reference curve when
   the screen opens, and from the old value to the new when a phase closes. Nothing
   else on the ring moves. The number in the centre is the count, never a percentage. */
@Component({
  selector: 'bb-ring',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 120 120" role="img" [attr.aria-label]="done + ' of ' + total + ' phases done'">
      <circle class="track" cx="60" cy="60" r="52"/>
      <circle class="bar" cx="60" cy="60" r="52" [style.stroke-dashoffset]="offset()" [class.full]="done >= total"/>
      <text x="60" y="56" class="n">{{ done }}</text>
      <text x="60" y="76" class="l">of {{ total }}</text>
    </svg>`,
  styles: [`
    :host{display:inline-block;line-height:0}
    svg{transform:rotate(-90deg)}
    text{transform:rotate(90deg);transform-origin:60px 60px;text-anchor:middle;font-family:var(--font)}
    .n{font-size:34px;font-weight:700;fill:var(--ink);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .l{font-size:11px;font-weight:600;fill:var(--muted)}
    .track{fill:none;stroke:var(--line-2);stroke-width:8}
    .bar{fill:none;stroke:var(--brand);stroke-width:8;stroke-linecap:round;stroke-dasharray:326.7;transition:stroke-dashoffset 900ms cubic-bezier(.45,0,.25,1)}
    .bar.full{stroke:var(--green)}
    @media (prefers-reduced-motion:reduce){.bar{transition:none}}`]
})
export class RingComponent implements OnChanges {
  @Input() done = 0; @Input() total = 1; @Input() size = 120;
  offset = signal(326.7);
  private first = true;
  ngOnChanges(){ const f = this.total ? Math.min(1, this.done / this.total) : 0; const target = 326.7 * (1 - f);
    if (this.first) { this.first = false; this.offset.set(326.7); requestAnimationFrame(() => requestAnimationFrame(() => this.offset.set(target))); }
    else this.offset.set(target); }
}
