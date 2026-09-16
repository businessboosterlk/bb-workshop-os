import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { ThemeService } from '../../core/theme.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';
import { InstallService } from '../../core/install.service';

@Component({
  selector: 'bb-car-settings',
  standalone: true,
  imports: [IconComponent],
  template: `
    <h1 class="t-h1">{{ lang.t('Settings') }}</h1>
    <p class="t-small sub">{{ session.phone() }}</p>
    <div class="card list">
      <div class="li"><span class="ic"><bb-icon name="globe"/></span><span class="tx"><strong>{{ lang.t('Language') }}</strong></span>
        <div class="seg"><button type="button" [class.on]="lang.lang() === 'en'" (click)="lang.set('en')">English</button><button type="button" [class.on]="lang.lang() === 'si'" (click)="lang.set('si')">සිංහල</button></div></div>
      <div class="li"><span class="ic"><bb-icon [name]="theme.dark() ? 'moon' : 'sun'"/></span><span class="tx"><strong>{{ theme.dark() ? lang.t('Night mode') : lang.t('Day mode') }}</strong></span>
        <button class="btn ghost sm" type="button" (click)="theme.toggle()">{{ theme.dark() ? lang.t('Day mode') : lang.t('Night mode') }}</button></div>
      @if (!install.standalone()) {
        <div class="li"><span class="ic"><bb-icon name="phone"/></span><span class="tx"><strong>{{ lang.t('Put it on your home screen') }}</strong>
          @if (install.ios) { <span>{{ lang.t('Tap Share, then Add to Home Screen.') }}</span> } @else if (!install.canPrompt()) { <span>{{ lang.t('Open the browser menu and choose Add to Home screen.') }}</span> }</span>
          @if (install.canPrompt()) { <button class="btn sm" type="button" (click)="install.prompt()">{{ lang.t('Install') }}</button> }</div>
      }
      <button class="li link" type="button" (click)="out()"><span class="ic"><bb-icon name="out"/></span><span class="tx"><strong>{{ lang.t('Sign out') }}</strong></span></button>
    </div>
    <p class="foot">{{ cast.cast()?.name }} · Workshop OS by Business Booster</p>`,
  styles: [`.sub{margin:4px 0 16px}.tx span{display:block;font-size:12px;color:var(--muted);margin-top:2px}.li{width:100%;border:0;background:none;text-align:left;font:inherit;color:inherit}.foot{margin-top:18px;font-size:12px;color:var(--muted)}`]
})
export class CustomerSettingsComponent {
  cast = inject(CastService); session = inject(SessionService); theme = inject(ThemeService); lang = inject(LangService); install = inject(InstallService); private router = inject(Router);
  out(){ this.session.logout(); this.router.navigate(['/']); }
}
