import { Component, inject, signal, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService } from '../../core/data.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';

/* The customer's door. A phone number, then a code. No password exists anywhere.
   Step two slides in from the right; the code field is numeric so the phone offers
   the number pad and, on iOS, the code from the message itself. */
const GROUND = '#0b0b0c';
@Component({
  selector: 'bb-car-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="door">
      <a class="back" routerLink="/" aria-label="Back"><bb-icon name="back"/></a>
      <div class="card" [class.two]="step() === 2">
        @if (cast.cast()?.brand?.logo) { <img class="mark" [src]="cast.cast()!.brand.logo" alt="" width="750" height="555"> }
        @if (step() === 1) {
          <div class="pane">
            <h1>{{ lang.t('Sign in') }}</h1>
            <p>{{ lang.t('Your phone is your login. No password to remember.') }}</p>
            <form (submit)="send($event)" autocomplete="off">
              <label class="fl" for="ph">{{ lang.t('Phone number') }}</label>
              <input id="ph" class="big" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="send" [(ngModel)]="phone" name="phone" placeholder="07X XXX XXXX" [attr.aria-invalid]="!!session.error()">
              <button class="enter" type="submit" [disabled]="busy()">{{ busy() ? '…' : lang.t('Send code') }}</button>
              <div class="err" [class.on]="!!session.error()" aria-live="polite">{{ session.error() }}</div>
            </form>
          </div>
        } @else {
          <div class="pane in">
            <h1>{{ lang.t('Code') }}</h1>
            <p>{{ lang.t('We sent a code to your phone') }} · {{ session.sentTo() }}</p>
            <form (submit)="go($event)" autocomplete="off">
              <input #code id="code" class="big code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" enterkeyhint="go" [(ngModel)]="pin" name="code" placeholder="••••" [attr.aria-invalid]="!!session.error()" aria-label="Code">
              <button class="enter" type="submit" [disabled]="busy()">{{ busy() ? '…' : lang.t('Enter') }}</button>
              <div class="err" [class.on]="!!session.error()" aria-live="polite">{{ session.error() }}</div>
              <button class="link" type="button" (click)="step.set(1); pin = ''">Wrong number</button>
            </form>
            @if (!cast.apiMode()) { <div class="demo">Demo: the code is <b>{{ cast.cast()?.customerCode }}</b>. A live workshop sends it by SMS or WhatsApp.</div> }
          </div>
        }
      </div>
      @if (!cast.apiMode() && step() === 1) { <div class="demo">Demo: try <b>0771234567</b>, a customer with two cars on file.</div> }
      <div class="lang"><button type="button" (click)="lang.set('en')" [class.on]="lang.lang() === 'en'">English</button><button type="button" (click)="lang.set('si')" [class.on]="lang.lang() === 'si'">සිංහල</button></div>
    </div>`,
  styles: [`
    :host{display:block}
    .door{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#0b0b0c;color:#f2f2f4;
      padding:calc(24px + var(--sat)) 20px calc(24px + var(--sab));overflow-y:auto}
    .back{position:fixed;top:calc(12px + var(--sat));left:12px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:#9a9ca4;--ico:20px}
    .card{width:100%;max-width:420px;background:#141416;border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:34px 28px 26px;text-align:center;overflow:hidden;animation:up 600ms cubic-bezier(.45,0,.25,1) both}
    .mark{width:170px;max-width:60%;height:auto;border-radius:14px;display:block;margin:0 auto 22px}
    h1{font-size:24px;font-weight:700;letter-spacing:-.02em}
    p{color:#9a9ca4;font-size:13.5px;margin:8px 0 22px;line-height:1.5}
    form{display:grid;gap:12px;text-align:left}
    .fl{font-size:12px;font-weight:600;color:#c9cbd2}
    .big{width:100%;min-height:58px;padding:14px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#1b1b1f;color:#f4f4f6;font-size:22px;font-weight:600;letter-spacing:.04em;font-variant-numeric:tabular-nums;transition:border-color 160ms var(--ease)}
    .big::placeholder{color:#55575f;font-weight:500;letter-spacing:.06em}
    .big:focus{outline:none;border-color:var(--brand)}
    .big[aria-invalid="true"]{border-color:rgba(248,113,113,.6)}
    .code{text-align:center;font-size:30px;letter-spacing:.4em;text-indent:.4em}
    .enter{width:100%;min-height:56px;border:0;border-radius:14px;background:var(--brand);color:var(--on-accent);font-weight:700;font-size:15px;letter-spacing:.02em;transition:transform 160ms var(--ease),filter 160ms var(--ease)}
    .enter:hover{filter:brightness(1.06)}.enter:active{transform:scale(.985)}.enter:disabled{opacity:.6}
    .err{min-height:18px;font-size:12.5px;font-weight:600;color:#f87171;opacity:0;transition:opacity 160ms var(--ease)}.err.on{opacity:1}
    .link{background:none;border:0;color:#9a9ca4;font-size:13px;text-decoration:underline;text-underline-offset:3px;justify-self:center;min-height:36px}
    .pane.in{animation:slide 320ms cubic-bezier(.45,0,.25,1) both}
    @keyframes slide{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
    @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .demo{font-size:12.5px;color:#7c7f88;max-width:420px;text-align:center;line-height:1.5}.demo b{color:#c9cbd2;font-weight:600}
    .lang{display:flex;gap:4px;background:#141416;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:3px}
    .lang button{min-height:34px;padding:0 14px;border:0;border-radius:999px;background:none;color:#9a9ca4;font-size:13px;font-weight:600}
    .lang button.on{background:#26262b;color:#fff}
    @media (prefers-reduced-motion:reduce){.card,.pane.in{animation:none}}`]
})
export class CustomerLoginComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); lang = inject(LangService); private router = inject(Router);
  @ViewChild('code') codeEl?: ElementRef<HTMLInputElement>;
  phone = ''; pin = ''; busy = signal(false); step = signal<1 | 2>(1);
  constructor(){
    document.body.classList.add('on-door');
    document.documentElement.style.setProperty('--top', GROUND); document.documentElement.style.setProperty('--door-ground', GROUND);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', GROUND);
    if (!this.cast.cast()) this.cast.loadStatic();
    if (this.session.kind() === 'customer') this.router.navigate(['/car']);
  }
  ngOnDestroy(){ document.body.classList.remove('on-door'); }
  async send(e: Event){ e.preventDefault(); if (this.busy()) return; this.busy.set(true);
    try { if (await this.session.sendCode(this.phone)) { this.step.set(2); setTimeout(() => this.codeEl?.nativeElement.focus(), 350); } } finally { this.busy.set(false); } }
  async go(e: Event){ e.preventDefault(); if (this.busy()) return; this.busy.set(true);
    try { if (await this.session.loginCustomer(this.pin.trim())) { await this.data.init(); this.router.navigate(['/car']); } } finally { this.busy.set(false); } }
}
