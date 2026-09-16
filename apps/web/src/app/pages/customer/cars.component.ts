import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, niceDate } from '../../core/data.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';
import { RingComponent } from '../../ui/ring.component';
import { Job } from '../../core/models';
import { InstallService } from '../../core/install.service';

/* Home: every car the customer has in the workshop now, one card each, the ring
   and the phase running right now. A card with a question on it says so in the
   brand colour. Nothing here is a number the customer cannot act on. */
@Component({
  selector: 'bb-cars',
  standalone: true,
  imports: [RouterLink, IconComponent, RingComponent],
  template: `
    <h1 class="t-h1">{{ lang.t('Your cars') }}</h1>
    <p class="t-small sub">{{ hello() }}</p>
    @if (data.myOpen().length) {
      <div class="cards">
        @for (j of data.myOpen(); track j.id; let i = $index) {
          <a class="car" [routerLink]="['/car/job', j.id]" [style.animation-delay.ms]="i * 70">
            <div class="row">
              <div class="id"><span class="plate">{{ j.plate }}</span><span class="mm">{{ j.make }} {{ j.model }}</span><span class="br">{{ cast.branch(j.branch)?.name }} · {{ cast.service(j.service)?.label }}</span></div>
              <bb-ring [done]="data.doneCount(j)" [total]="j.phases.length" [size]="92"/>
            </div>
            <div class="now" [class.ready]="j.status === 'ready'" [class.amber]="data.overrun(j) > 0">
              @if (j.status === 'ready') { <bb-icon name="tick"/><strong>{{ lang.t('Ready for pickup') }}</strong> }
              @else { <bb-icon name="wrench"/><span><em>{{ lang.t('Right now') }}</em><strong>{{ data.phaseNow(j)?.label }}</strong></span> }
            </div>
            <div class="meta">
              <span><bb-icon name="clock"/>{{ lang.t('Promised') }} {{ date(j.promisedAt) }}@if (j.promiseHistory.length) { <i class="moved">{{ lang.t('Date moved') }}</i> }</span>
              @if (pending(j)) { <span class="ask"><bb-icon name="alert"/>{{ lang.t('Needs your approval') }}</span> }
            </div>
          </a>
        }
      </div>
    } @else {
      <div class="card empty">
        <bb-icon name="car" class="big"/>
        <strong>{{ lang.t('No cars yet') }}</strong>
        <span>When you hand a car to {{ cast.cast()?.name }}, it appears here and you can follow every phase.</span>
        @if (data.myPast().length) { <a class="btn ghost sm" routerLink="/car/history">{{ lang.t('Your previous jobs') }}</a> }
      </div>
    }
    <div class="branches">
      @for (b of cast.cast()?.branches; track b.key) {
        <a class="card br-card" [href]="cast.branchWa(b.key, 'Hello ' + cast.cast()?.name + ' ' + b.name + ', ')" target="_blank" rel="noreferrer">
          <span class="ic"><bb-icon name="wa"/></span>
          <span class="tx"><strong>{{ b.name }}</strong><span>{{ b.address }}</span></span>
        </a>
      }
    </div>
    @if (cast.cast()?.pickup) { <p class="pk"><bb-icon name="truck"/>{{ cast.cast()!.pickup }}</p> }
    @if (!install.standalone()) {
      <a class="card inst" routerLink="/car/settings"><bb-icon name="phone"/><span><strong>{{ lang.t('Put it on your home screen') }}</strong><span>{{ lang.t('Opens like an app, no browser bar.') }}</span></span><bb-icon name="chev" class="go"/></a>
    }`,
  styles: [`
    :host{display:block}
    .sub{margin:4px 0 16px}
    .cards{display:grid;gap:12px}
    .car{display:block;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;animation:carIn 520ms cubic-bezier(.45,0,.25,1) both;transition:transform 160ms var(--ease),border-color 160ms var(--ease)}
    .car:active{transform:scale(.985)}
    @keyframes carIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
    .row{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .id{min-width:0}
    .plate{display:inline-block;font-size:22px;font-weight:800;letter-spacing:.04em;text-indent:.04em;padding:calc(4px + .05em) 10px calc(4px - .05em);border-radius:8px;background:var(--ink);color:var(--bg)}
    .mm{display:block;font-size:15px;font-weight:600;margin-top:8px}
    .br{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
    .now{display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px 14px;border-radius:12px;background:var(--brand-soft);color:var(--ink);--ico:20px}
    .now bb-icon{color:var(--brand-dark)}
    .now em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}
    .now strong{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}
    .now.ready{background:var(--green-soft)}.now.ready bb-icon{color:var(--green)}
    .now.amber{background:var(--amber-soft)}.now.amber bb-icon{color:var(--amber)}
    .meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:12px;font-size:12.5px;color:var(--muted)}
    .meta span{display:inline-flex;align-items:center;gap:6px;--ico:14px}
    .moved{font-style:normal;font-size:10.5px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:1px 7px;border-radius:999px;margin-left:4px}
    .ask{color:var(--brand-dark);font-weight:700}
    .empty{padding:36px 22px;text-align:center;display:grid;justify-items:center;gap:8px;color:var(--muted)}
    .empty .big{--ico:40px;color:var(--brand)}.empty strong{color:var(--ink);font-size:16px}
    .branches{display:grid;gap:10px;margin-top:22px}
    .br-card{display:flex;align-items:center;gap:12px;padding:12px 14px}
    .br-card .ic{width:38px;height:38px;border-radius:10px;background:#008069;color:#fff;display:grid;place-items:center;--ico:18px;flex-shrink:0}
    .br-card .tx{min-width:0}.br-card strong{display:block;font-size:14px}.br-card span{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pk{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12.5px;color:var(--muted);--ico:16px}
    .inst{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:14px;--ico:20px}.inst>bb-icon{color:var(--brand-dark)}.inst>span{flex:1;min-width:0}.inst strong{display:block;font-size:13.5px}.inst span span{display:block;font-size:12px;color:var(--muted)}.inst .go{color:var(--faint);--ico:16px}
    @media (prefers-reduced-motion:reduce){.car{animation:none}}`]
})
export class CarsComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); lang = inject(LangService); install = inject(InstallService);
  hello(){ const n = this.data.myJobs()[0]?.customerName || ''; const h = new Date().getHours(); const g = this.lang.lang() === 'si' ? (h < 12 ? 'සුබ උදෑසනක්' : 'සුබ දවසක්') : (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'); return n ? `${g}, ${n.split(' ')[0]}.` : g + '.'; }
  date(iso: string){ return niceDate(iso); }
  pending(j: Job){ return j.approvals.some(a => a.status === 'pending'); }
}
