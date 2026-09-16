import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';

/* The team's door: a name and a PIN. Black and white like every BB door. */
const GROUND = '#0b0b0c';
@Component({
  selector: 'bb-ws-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="door">
      <a class="back" routerLink="/" aria-label="Back"><bb-icon name="back"/></a>
      <div class="card">
        @if (cast.cast()?.brand?.logo) { <img class="mark" [src]="cast.cast()!.brand.logo" alt="" width="750" height="555"> }
        <div class="sys">Workshop team</div>
        <form (submit)="go($event)" autocomplete="off">
          <input id="who" class="big" type="text" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="next" [(ngModel)]="name" name="name" placeholder="YOUR NAME" aria-label="Your name" [attr.aria-invalid]="!!session.error()">
          <input id="pin" class="big" type="password" inputmode="numeric" autocomplete="off" enterkeyhint="go" [(ngModel)]="pin" name="pin" placeholder="PIN" aria-label="PIN" [attr.aria-invalid]="!!session.error()">
          <button class="enter" type="submit" [disabled]="busy()">{{ busy() ? 'Opening' : 'Enter' }}</button>
          <div class="err" [class.on]="!!session.error()" aria-live="polite">{{ session.error() }}</div>
        </form>
        @if (!cast.apiMode()) { <div class="demo">Demo seats: <b>Miflal</b> 1111 (owner) · <b>Nuwan</b> 2222 · <b>Kasun</b> 3333</div> }
      </div>
    </div>`,
  styles: [`
    :host{display:block}
    .door{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#0b0b0c;color:#f2f2f4;padding:calc(24px + var(--sat)) 20px calc(24px + var(--sab));overflow-y:auto}
    .back{position:fixed;top:calc(12px + var(--sat));left:12px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:#9a9ca4;--ico:20px}
    .card{width:100%;max-width:420px;background:#131316;border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:44px 36px 30px;box-shadow:0 28px 80px rgba(0,0,0,.6);text-align:center;animation:up 600ms cubic-bezier(.45,0,.25,1) both}
    .mark{width:190px;max-width:64%;height:auto;border-radius:14px;display:block;margin:0 auto}
    .sys{margin:18px 0 26px;color:rgba(255,255,255,.72);font-size:11.5px;font-weight:700;letter-spacing:.38em;text-indent:.38em;text-transform:uppercase}
    form{display:grid;gap:12px}
    .big{width:100%;min-height:58px;padding:16px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#1b1b1f;color:#f4f4f6;text-align:center;font-size:14px;font-weight:600;letter-spacing:.22em;text-indent:.22em;text-transform:uppercase;transition:border-color 160ms var(--ease)}
    .big::placeholder{color:#63666f;letter-spacing:.24em;font-weight:600}
    .big:focus{outline:none;border-color:rgba(255,255,255,.42)}
    .big[aria-invalid="true"]{border-color:rgba(248,113,113,.5)}
    .enter{width:100%;min-height:58px;margin-top:6px;border:0;border-radius:12px;background:#f4f4f6;color:#0a0a0c;font-weight:800;font-size:14px;letter-spacing:.24em;text-indent:.24em;text-transform:uppercase;transition:transform 160ms var(--ease)}
    .enter:active{transform:scale(.99)}.enter:disabled{opacity:.55}
    .err{min-height:20px;margin-top:8px;font-size:12.5px;font-weight:600;color:#f87171;opacity:0;transition:opacity 160ms var(--ease)}.err.on{opacity:1}
    .demo{margin-top:16px;font-size:12px;color:#63666f;line-height:1.6}.demo b{color:#a2a5ad;font-weight:600}
    @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @media (max-width:480px){.card{padding:36px 22px 24px}}
    @media (prefers-reduced-motion:reduce){.card{animation:none}}`]
})
export class WorkshopLoginComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private router = inject(Router);
  name = ''; pin = ''; busy = signal(false);
  constructor(){
    document.body.classList.add('on-door');
    document.documentElement.style.setProperty('--top', GROUND); document.documentElement.style.setProperty('--door-ground', GROUND);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', GROUND);
    if (!this.cast.cast()) this.cast.loadStatic();
    if (this.session.kind() === 'staff') this.router.navigate(['/workshop']);
  }
  ngOnDestroy(){ document.body.classList.remove('on-door'); }
  async go(e: Event){ e.preventDefault(); if (this.busy()) return; this.busy.set(true);
    try { if (await this.session.loginStaff(this.name, this.pin)) { await this.data.init(); this.router.navigate(['/workshop']); } } finally { this.busy.set(false); } }
}
