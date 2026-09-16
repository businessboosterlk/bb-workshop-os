import { Component, Input, OnChanges, signal, inject, ElementRef } from '@angular/core';

/* The progress ring: the one cinematic object on the customer's screen. The stroke draws
   from empty to the job's real fraction over 900ms on the reference curve when the screen
   opens, and from the old value to the new when a phase closes.

   CENTRING, measured not assumed (17 Sep 2026). The first version set the number and the
   label on SVG baselines and they sat 6.5px high in a 118px ring. Now only the circles are
   SVG, rotated inside their own group. The count is HTML in a flex column on the ring's
   centre, sized in proportion to the ring, and ~/bb-systems/qa/optical.mjs measures the INK
   of "6 of 10" against the circle's centre at every size the app uses. The build of the
   check lives in scripts/ui-precision.mjs and it must stay within 0.5px. */
@Component({
  selector: 'bb-ring',
  standalone: true,
  template: `
    <div class="ring" [style.width.px]="size" [style.height.px]="size" role="img" [attr.aria-label]="done + ' of ' + total + ' phases done'">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <g transform="rotate(-90 60 60)">
          <circle class="track" cx="60" cy="60" r="52"/>
          <circle class="bar" cx="60" cy="60" r="52" [style.stroke-dashoffset]="offset()" [class.full]="done >= total"/>
        </g>
      </svg>
      <div class="c" aria-hidden="true" [style.transform]="'translateY(' + shift() + 'px)'">
        <span class="n" [style.font-size.px]="nPx()">{{ done }}<i class="bl"></i></span>
        <span class="l" [style.font-size.px]="lPx()" [style.margin-top.px]="gapPx()">of {{ total }}<i class="bl"></i></span>
      </div>
    </div>`,
  styles: [`
    :host{display:inline-block;line-height:0;flex-shrink:0}
    .ring{position:relative}
    svg{position:absolute;inset:0;width:100%;height:100%;display:block}
    .track{fill:none;stroke:var(--line-2);stroke-width:8}
    .bar{fill:none;stroke:var(--brand);stroke-width:8;stroke-linecap:round;stroke-dasharray:326.7;transition:stroke-dashoffset 900ms cubic-bezier(.45,0,.25,1)}
    .bar.full{stroke:var(--green)}
    /* the count block sits on the centre; the label's line box is trimmed so the ink of the
       pair, not the boxes, is what the centre holds */
    .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font);color:var(--ink);pointer-events:none}
    .n{display:block;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
    .l{display:block;line-height:1;font-weight:600;color:var(--muted)}
    .bl{display:inline-block;width:0;height:0;vertical-align:baseline}
    @media (prefers-reduced-motion:reduce){.bar{transition:none}}`]
})
export class RingComponent implements OnChanges {
  @Input() done = 0; @Input() total = 1; @Input() size = 120;
  offset = signal(326.7);
  shift = signal(0);
  private first = true;
  /* whole pixels only, so nothing lands on a half pixel and blurs */
  nPx(){ return Math.round(this.size * .28); } lPx(){ return Math.max(12, Math.round(this.size * .105)); } gapPx(){ return Math.round(this.size * .04); }
  /* measured again once any entrance animation around the ring has settled, because a card that scales in skews the first reading */
  constructor(){ document.fonts?.ready.then(() => { this.measure(); setTimeout(() => this.measure(), 900); }); addEventListener('resize', () => this.measure()); }
  /* A flex column centres the two LINE BOXES. The eye reads the INK: the top of the digit
     and the foot of "of 10". Font metrics from a canvas come back rounded to whole pixels
     and missed by up to a pixel (17 Sep sweep), so nothing here is predicted. Each line
     carries a zero-size probe sitting on its baseline, which gives the browser's own
     baseline; the glyphs are drawn once on a canvas at 4x and scanned for their real ink.
     The block then moves by the difference, to a quarter pixel. */
  private host = inject(ElementRef<HTMLElement>);
  private measure(){
    requestAnimationFrame(() => {
      try {
        const root = this.host.nativeElement; const c = root.querySelector('.c') as HTMLElement | null; if (!c) return;
        const nEl = c.querySelector('.n') as HTMLElement, lEl = c.querySelector('.l') as HTMLElement;
        const nB = (c.querySelector('.n .bl') as HTMLElement).getBoundingClientRect().bottom, lB = (c.querySelector('.l .bl') as HTMLElement).getBoundingClientRect().bottom;
        const ringR = (root.querySelector('.ring') as HTMLElement).getBoundingClientRect();
        const ink = (el: HTMLElement, text: string) => {
          const cs = getComputedStyle(el), k = 4, px = parseFloat(cs.fontSize);
          const cv = document.createElement('canvas'); cv.width = Math.ceil(px * 3 * k); cv.height = Math.ceil(px * 2 * k);
          const x = cv.getContext('2d')!; x.scale(k, k); x.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`; x.textBaseline = 'alphabetic'; x.fillStyle = '#000';
          const base = px * 1.4; x.fillText(text, 2, base);
          const d = x.getImageData(0, 0, cv.width, cv.height).data; let top = -1, bot = -1;
          for (let y = 0; y < cv.height; y++) { let any = false; for (let i = y * cv.width * 4 + 3, e = i + cv.width * 4; i < e; i += 4) if (d[i] > 40) { any = true; break; } if (any) { if (top < 0) top = y; bot = y; } }
          return top < 0 ? null : { up: base - top / k, down: (bot + 1) / k - base };
        };
        const a = ink(nEl, nEl.firstChild?.textContent?.trim() || String(this.done)), b = ink(lEl, lEl.firstChild?.textContent?.trim() || `of ${this.total}`); if (!a || !b) return;
        const current = this.shift();
        const inkTop = nB - a.up - current, inkBottom = lB + b.down - current;
        /* snap to the screen's own pixel grid: a third of a pixel on a 3x phone, half on a 2x laptop */
        const dpr = Math.max(1, devicePixelRatio || 1);
        this.shift.set(Math.round(((ringR.top + ringR.height / 2) - (inkTop + inkBottom) / 2) * dpr) / dpr);
      } catch { /* no canvas: the flex centre stands */ }
    });
  }
  ngOnChanges(){
    this.measure(); const f = this.total ? Math.min(1, this.done / this.total) : 0; const target = 326.7 * (1 - f);
    if (this.first) { this.first = false; this.offset.set(326.7); requestAnimationFrame(() => requestAnimationFrame(() => this.offset.set(target))); }
    else this.offset.set(target); }
}
