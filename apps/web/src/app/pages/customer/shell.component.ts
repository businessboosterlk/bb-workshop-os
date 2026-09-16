import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService } from '../../core/data.service';
import { ThemeService } from '../../core/theme.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';
import { BottomMenuComponent, MenuTab } from '../../shell/bottom-menu.component';

/* The customer app's frame. Phone first: a slim top bar with the workshop's mark and
   a floating pill of three tabs. On a desk it sits in a phone-wide column on the dark
   ground, because this surface is a phone app and should look like one everywhere. */
export function setTop(color: string){ document.documentElement.style.setProperty('--top', color); document.querySelector('meta[name=theme-color]')?.setAttribute('content', color); }
export function pageColour(){ return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0b0c'; }
@Component({
  selector: 'bb-car-shell',
  standalone: true,
  imports: [RouterOutlet, IconComponent, BottomMenuComponent],
  template: `
    <div class="col">
      <header class="top">
        @if (cast.cast()?.brand?.logo) { <img class="mk" [src]="cast.cast()!.brand.logo" alt="" width="750" height="555"> }
        <strong>{{ cast.cast()?.name }}</strong>
        <span class="sp"></span>
        <button class="x" type="button" (click)="lang.set(lang.lang() === 'en' ? 'si' : 'en')" [attr.aria-label]="lang.t('Language')"><bb-icon name="globe"/></button>
        <button class="x" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? lang.t('Day mode') : lang.t('Night mode')"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
      </header>
      <main class="page" [class.enter]="entering()"><router-outlet/></main>
      <bb-bottom-menu class="tabs" [items]="tabs()" [active]="activeUrl()"/>
    </div>`,
  styles: [`
    :host{display:block;min-height:100dvh}
    .col{max-width:520px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;background:var(--bg)}
    @media (min-width:760px){:host{background:#0b0b0c}.col{border-left:1px solid var(--line);border-right:1px solid var(--line)}}
    .top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;height:calc(var(--top-h) + var(--sat));padding:var(--sat) 14px 0 16px;background:var(--glass);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line)}
    .mk{width:38px;height:auto;border-radius:8px}
    .top strong{font-size:15px;font-weight:700;letter-spacing:-.01em}
    .sp{flex:1}
    .x{width:40px;height:40px;font-size:12.5px;font-weight:700;color:var(--muted);--ico:18px}
    .page{flex:1;padding:18px 16px calc(96px + var(--sab))}
    .page.enter{animation:pageIn 260ms var(--ease) backwards}
    @keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.page.enter{animation:none}}`]
})
export class CustomerShellComponent implements OnInit, OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService); lang = inject(LangService); private router = inject(Router);
  activeUrl = signal(''); entering = signal(false); private sub: any;
  tabs = computed<MenuTab[]>(() => [
    { path: '/car', label: this.lang.t('Your cars'), icon: 'car', badge: () => this.data.myOpen().filter(j => j.approvals.some(a => a.status === 'pending')).length },
    { path: '/car/history', label: this.lang.t('History'), icon: 'history' },
    { path: '/car/settings', label: this.lang.t('Settings'), icon: 'settings' }
  ]);
  ngOnInit(){
    document.body.classList.add('in-shell'); this.theme.apply(); setTop(pageColour());
    this.read();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => { const was = this.activeUrl(); this.read(); if (was && was !== this.activeUrl()) { this.entering.set(false); requestAnimationFrame(() => this.entering.set(true)); } });
  }
  ngOnDestroy(){ document.body.classList.remove('in-shell'); this.sub?.unsubscribe(); }
  private read(){ const u = this.router.url.split('?')[0]; this.activeUrl.set(u.startsWith('/car/job') ? '/car' : u); }
}
