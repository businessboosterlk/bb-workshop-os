import { Component, inject, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { IconComponent } from '../ui/icon.component';
import { LangService } from '../core/lang.service';

/* The front door. Black ground, the workshop's own mark, two doors. A customer goes
   left, the team goes right. Nothing else on the screen. */
const GROUND = '#0b0b0c';
@Component({
  selector: 'bb-welcome',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="door">
      <div class="top">
        @if (cast.cast()?.brand?.logo) { <img class="mark" [src]="cast.cast()!.brand.logo" [alt]="cast.cast()!.name" width="750" height="555"> }
        @else { <div class="mark-txt">{{ cast.cast()?.name || 'Workshop' }}</div> }
        <div class="sys">Workshop OS</div>
      </div>
      <div class="doors">
        <a class="dr" routerLink="/car/login">
          <span class="ic"><bb-icon name="car"/></span>
          <span class="tx"><strong>{{ lang.t('Your car') }}</strong><span>See where your car is right now, phase by phase, with photos from the bay.</span></span>
          <bb-icon name="chev" class="go"/>
        </a>
        <a class="dr" routerLink="/workshop/login">
          <span class="ic"><bb-icon name="wrench"/></span>
          <span class="tx"><strong>Workshop team</strong><span>The floor, every car, one tap to close a phase.</span></span>
          <bb-icon name="chev" class="go"/>
        </a>
      </div>
      <p class="foot"><img class="bb" src="assets/bb-logo.png" alt="Business Booster"> Built by Business Booster</p>
      <p class="hint">Add this page to your home screen and it opens like an app.</p>
    </div>`,
  styles: [`
    :host{display:block}
    .door{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;background:#0b0b0c;color:#f2f2f4;
      padding:calc(24px + var(--sat)) 20px calc(24px + var(--sab));overflow-y:auto}
    .top{display:flex;flex-direction:column;align-items:center;animation:up 600ms cubic-bezier(.45,0,.25,1) both}
    .mark{width:220px;max-width:64%;height:auto;border-radius:18px;display:block}
    .mark-txt{font-size:28px;font-weight:800;letter-spacing:-.02em}
    .sys{margin-top:18px;color:rgba(255,255,255,.55);font-size:11px;font-weight:700;letter-spacing:.38em;text-indent:.38em;text-transform:uppercase}
    .doors{width:100%;max-width:440px;display:grid;gap:12px}
    .dr{display:flex;align-items:center;gap:16px;padding:20px 18px;background:#141416;border:1px solid rgba(255,255,255,.08);border-radius:18px;
      transition:border-color 180ms var(--ease),transform 180ms var(--ease),background 180ms var(--ease);animation:up 600ms cubic-bezier(.45,0,.25,1) both}
    .dr:nth-child(2){animation-delay:80ms}
    .dr:hover{border-color:rgba(255,255,255,.22);background:#18181b}.dr:active{transform:scale(.985)}
    .ic{width:50px;height:50px;border-radius:14px;background:var(--brand);color:var(--on-accent);display:grid;place-items:center;--ico:24px;flex-shrink:0}
    .tx{flex:1;min-width:0}.tx strong{display:block;font-size:17px;font-weight:700;letter-spacing:-.01em}
    .tx span{display:block;color:#9a9ca4;font-size:13px;margin-top:3px;line-height:1.4}
    .go{color:#5b5d66}
    .foot{display:flex;align-items:center;gap:8px;color:#63666f;font-size:12px}.foot img{height:14px;opacity:.75}
    .hint{margin-top:-22px;color:#4b4d55;font-size:11.5px;text-align:center}
    @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.top,.dr{animation:none}}`]
})
export class WelcomeComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); lang = inject(LangService); private router = inject(Router);
  constructor(){
    document.body.classList.add('on-door');
    document.documentElement.style.setProperty('--top', GROUND); document.documentElement.style.setProperty('--door-ground', GROUND);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', GROUND);
    if (!this.cast.cast()) this.cast.loadStatic();
    if (this.session.kind() === 'customer') this.router.navigate(['/car']);
    else if (this.session.kind() === 'staff') this.router.navigate(['/workshop']);
  }
  ngOnDestroy(){ document.body.classList.remove('on-door'); }
}
