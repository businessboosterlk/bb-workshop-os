import { Component, Input, inject } from '@angular/core';
import { Phase, Job } from '../core/models';
import { DataService, niceWhen } from '../core/data.service';
import { LangService } from '../core/lang.service';
import { IconComponent } from './icon.component';

/* The timeline every screen shares. Done phases carry a tick and their photo, the
   running phase breathes, the next ones wait in the muted ink. Rows enter with a
   40ms stagger the first time the list is drawn, and never again on the same screen. */
@Component({
  selector: 'bb-phases',
  standalone: true,
  imports: [IconComponent],
  template: `
    <ol class="tl" [class.overrun]="over > 0">
      @for (p of job.phases; track p.key; let i = $index; let last = $last) {
        <li class="ph" [class]="'ph ' + p.status" [style.animation-delay.ms]="i * 40" (click)="p.photoId && open(p)">
          <span class="dot">
            @if (p.status === 'done') { <bb-icon name="check"/> }
            @else if (p.status === 'now') { <i class="pulse"></i> }
          </span>
          @if (!last) { <span class="line"></span> }
          <span class="tx">
            <strong>{{ p.label }}</strong>
            <span>
{{ line(p) }}
            </span>
            @if (p.note && staff) { <em>{{ p.note }}</em> }
          </span>
          @if (p.photoId) {
            <button type="button" class="thumb" [attr.aria-label]="'Photo, ' + p.label" (click)="open(p); $event.stopPropagation()">
              <img [src]="data.photoFor(p.photoId)?.dataUrl" alt="">
            </button>
          }
        </li>
      }
      @if (job.status === 'delivered') {
        <li class="ph done fin"><span class="dot"><bb-icon name="check"/></span><span class="tx"><strong>{{ lang.t('Delivered') }}</strong><span>{{ when(job.deliveredAt) }}</span></span></li>
      }
    </ol>
    @if (view) {
      <div class="lb" (click)="view = null" role="dialog" aria-label="Photo">
        <img [src]="data.photoFor(view.photoId)?.dataUrl" alt="">
        <div class="cap"><strong>{{ view.label }}</strong><span>{{ when(view.doneAt) }}</span></div>
      </div>
    }`,
  styles: [`
    :host{display:block}
    .tl{list-style:none;margin:0;padding:0;display:grid}
    .ph{position:relative;display:flex;align-items:flex-start;gap:14px;padding:0 0 22px 0;animation:rowIn 320ms cubic-bezier(.45,0,.25,1) both}
    .ph:last-child{padding-bottom:0}
    @keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .dot{position:relative;z-index:1;width:28px;height:28px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;border:2px solid var(--line-2);background:var(--surface);color:var(--on-accent);--ico:14px;transition:background 300ms var(--ease),border-color 300ms var(--ease)}
    .done .dot{background:var(--brand);border-color:var(--brand)}
    .done .dot bb-icon{color:var(--on-accent)}
    .now .dot{border-color:var(--brand);background:var(--surface)}
    .pulse{width:10px;height:10px;border-radius:50%;background:var(--brand);animation:breathe 2s ease-in-out infinite}
    .overrun .now .dot{border-color:var(--amber)}.overrun .pulse{background:var(--amber)}
    @keyframes breathe{0%,100%{transform:scale(.8);opacity:.7}50%{transform:scale(1.15);opacity:1}}
    .line{position:absolute;left:13px;top:28px;bottom:0;width:2px;background:var(--line-2)}
    .done .line{background:var(--brand)}
    .tx{flex:1;min-width:0;padding-top:4px}
    .tx strong{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em}
    .next .tx strong{color:var(--muted);font-weight:500}
    .tx span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
    .now .tx span{color:var(--brand-dark);font-weight:600}
    .overrun .now .tx span{color:var(--amber)}
    .tx em{display:block;font-style:normal;font-size:12.5px;color:var(--ink-2);margin-top:4px}
    .thumb{width:52px;height:52px;border-radius:10px;overflow:hidden;border:1px solid var(--line);padding:0;background:var(--surface-2);flex-shrink:0;transition:transform 150ms var(--ease)}
    .thumb:active{transform:scale(.96)}.thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .lb{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:calc(20px + var(--sat)) 16px calc(20px + var(--sab));animation:fadeIn 200ms var(--ease)}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .lb img{max-width:100%;max-height:80dvh;border-radius:12px;object-fit:contain}
    .cap{color:#fff;text-align:center}.cap strong{display:block;font-size:15px}.cap span{font-size:12.5px;color:#a5a7ae}
    @media (prefers-reduced-motion:reduce){.ph{animation:none}.pulse{animation:none}.lb{animation:none}}`]
})
export class PhasesComponent {
  data = inject(DataService); lang = inject(LangService);
  @Input({ required: true }) job!: Job;
  @Input() staff = false;
  view: Phase | null = null;
  get over(){ return this.data.overrun(this.job); }
  when(iso?: string){ return niceWhen(iso); }
  /* one string per row, built here so the template never leaves a space before a comma */
  line(p: Phase){
    if (p.status === 'done') return `${this.lang.t('Done')} ${this.when(p.doneAt)}${p.by && this.staff ? ', ' + p.by : ''}`;
    if (p.status === 'now') return `${this.lang.t('Right now')}${this.over > 0 ? `, ${this.over} h over the usual ${p.hours} h` : p.hours ? `, usually ${p.hours} h` : ''}`;
    return this.lang.t('Next');
  }
  open(p: Phase){ if (p.photoId) this.view = p; }
}
