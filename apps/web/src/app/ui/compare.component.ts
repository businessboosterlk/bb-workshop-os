import { Component, Input, signal } from '@angular/core';

/* BEFORE AND AFTER (16 Oct 2026). Two photos of the same car, one on top of the other, and a handle the thumb drags to
   reveal the second. The proof a paint shop or a detailer sells on. No library: a range input sits over the picture and
   its value is the width of the after layer. Both pictures are the same size so nothing jumps. */
@Component({
  selector: 'bb-compare',
  standalone: true,
  template: `
    <div class="cmp" [attr.aria-label]="'Before and after, ' + beforeLabel + ' against ' + afterLabel">
      <img class="before" [src]="before" [alt]="beforeLabel">
      <div class="after" [style.width.%]="pos()"><img [src]="after" [alt]="afterLabel"></div>
      <i class="bar" [style.left.%]="pos()"><b></b></i>
      <span class="tag l">{{ afterLabel }}</span><span class="tag r">{{ beforeLabel }}</span>
      <input type="range" min="0" max="100" [value]="pos()" (input)="pos.set(+$any($event.target).value)" aria-label="Drag to compare">
    </div>`,
  styles: [`
    :host{display:block}
    .cmp{position:relative;aspect-ratio:4/3;border-radius:var(--r);overflow:hidden;background:var(--surface-2);user-select:none;-webkit-user-select:none;touch-action:pan-y}
    .cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
    .after{position:absolute;top:0;bottom:0;left:0;overflow:hidden}
    .after img{width:auto;min-width:100%;height:100%;max-width:none}
    .bar{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--bg);pointer-events:none}
    .bar b{position:absolute;top:50%;left:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:var(--bg);border:1px solid var(--line-2);display:block}
    .bar b::before,.bar b::after{content:"";position:absolute;top:50%;width:6px;height:6px;border-top:2px solid var(--ink);border-left:2px solid var(--ink);margin-top:-4px}
    .bar b::before{left:9px;transform:rotate(-45deg)}.bar b::after{right:9px;transform:rotate(135deg)}
    .tag{position:absolute;top:8px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);color:var(--ink);border:1px solid var(--line);pointer-events:none}
    .tag.l{left:8px}.tag.r{right:8px}
    input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;-webkit-appearance:none;appearance:none}`]
})
export class CompareComponent {
  @Input({ required: true }) before = '';
  @Input({ required: true }) after = '';
  @Input() beforeLabel = 'Before';
  @Input() afterLabel = 'After';
  pos = signal(50);
}
