import { Component, inject, signal, computed, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService } from '../../core/data.service';
import { ThemeService } from '../../core/theme.service';
import { IconComponent } from '../../ui/icon.component';
import { BottomMenuComponent, MenuTab, MenuAction } from '../../shell/bottom-menu.component';
import { setTop, pageColour } from '../customer/shell.component';

interface NavItem { path: string; label: string; icon: string; owner?: boolean; badge?: () => number; }
/* The workshop's frame, the Hub shell with one group. Desktop: the 232px rail on the
   brand ink. Phone: a glass topbar and the floating pill. Owner-only screens simply do
   not exist for a staff seat: not hidden, absent. */
@Component({
  selector: 'bb-ws-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, BottomMenuComponent],
  template: `
    <div class="scrim" [class.on]="railOpen()" (click)="setRail(false)"></div>
    <aside class="rail" [class.open]="railOpen()" aria-label="Navigation">
      <div class="r-head">
        @if (cast.cast()?.brand?.logo) { <img class="r-mark" [src]="cast.cast()!.brand.logo" alt="" width="750" height="555"> }
        <span class="r-eyebrow">Workshop OS</span>
        <div class="r-clock" aria-label="Time and date"><strong>{{ time() }}</strong><span>{{ date() }}</span></div>
      </div>
      <nav><div>
        @for (it of items(); track it.path) {
          <a [routerLink]="'/workshop/' + it.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: it.path === 'floor' }" (click)="setRail(false)">
            <bb-icon [name]="it.icon"/>{{ it.label }}
            @if (it.badge && it.badge() > 0) { <span class="nb">{{ it.badge() }}</span> }
          </a>
        }
      </div></nav>
      <div class="r-foot">
        <span class="avatar">{{ session.initial() }}</span>
        <span class="who"><strong>{{ session.name() }}</strong><em>{{ session.role() === 'owner' ? 'Owner' : 'Staff' }}@if (session.branch()) { · {{ cast.branch(session.branch())?.name }} }</em></span>
        <button class="x" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
        <button class="x" type="button" (click)="out()" aria-label="Sign out"><bb-icon name="out"/></button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="x hamb" type="button" (click)="setRail(true)" aria-label="Menu"><bb-icon name="menu"/></button>
        <div class="tt"><strong>{{ title() }}</strong><span>{{ cast.cast()?.name }} · {{ session.name() }}</span>
          @if (data.pending() > 0) { <em class="off">{{ data.pending() }} waiting to sync</em> }</div>
        <div class="tr">
          <button class="x theme" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
          <a class="btn sm" routerLink="/workshop/new"><bb-icon name="plus"/><span class="lbl">Car in</span></a>
        </div>
      </header>
      <main class="page" [class.enter]="entering()"><router-outlet/></main>
      <bb-bottom-menu class="tabs" [items]="tabs()" [active]="activeUrl()"/>
    </div>`,
  styles: [`
    :host{display:block}
    .rail{position:fixed;top:0;left:0;bottom:0;width:var(--side-w);background:var(--sidebar);color:var(--sidebar-txt);z-index:85;display:flex;flex-direction:column;padding:calc(18px + var(--sat)) 12px calc(14px + var(--sab));overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--sidebar-line)}
    .r-head{display:flex;flex-direction:column;align-items:center;text-align:center;padding:6px 4px 14px;margin-bottom:10px;border-bottom:1px solid var(--sidebar-line)}
    .r-mark{width:150px;max-width:82%;height:auto;display:block;border-radius:12px}
    .r-eyebrow{margin-top:12px;font-size:10.5px;font-weight:700;letter-spacing:.34em;text-indent:.34em;text-transform:uppercase;color:var(--sidebar-faint)}
    .r-clock{display:flex;flex-direction:column;align-items:center;gap:3px;margin:18px 0 6px}
    .r-clock strong{font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1;color:#fff;font-variant-numeric:tabular-nums}
    .r-clock span{font-size:12.5px;font-weight:500;color:var(--sidebar-txt)}
    nav>div{display:flex;flex-direction:column;gap:2px}
    nav a{position:relative;display:flex;align-items:center;gap:11px;min-height:40px;padding:0 10px;border-radius:9px;font-size:13.5px;font-weight:500;color:var(--sidebar-txt);transition:background var(--dur) var(--ease),color var(--dur) var(--ease)}
    nav a:hover{background:rgba(255,255,255,.06);color:#fff}
    nav a.on{background:rgba(255,255,255,.08);color:#fff;font-weight:600}
    nav a.on::before{content:"";position:absolute;left:-12px;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--brand)}
    nav a bb-icon{--ico:17px;opacity:.85}nav a.on bb-icon{opacity:1;color:var(--brand)}
    .nb{margin-left:auto;font-size:11px;font-weight:700;background:var(--brand);color:var(--on-accent);padding:calc(1px + .05em) 7px calc(1px - .05em);border-radius:999px}
    .r-foot{margin-top:auto;display:flex;align-items:center;gap:10px;padding:14px 4px 0;border-top:1px solid var(--sidebar-line)}
    .r-foot .avatar{background:var(--brand);color:var(--on-accent)}
    .r-foot .who{flex:1;min-width:0}.r-foot strong{display:block;color:#fff;font-size:13px}.r-foot em{display:block;font-style:normal;font-size:11px;color:var(--sidebar-faint)}
    .r-foot .x{color:var(--sidebar-faint)}.r-foot .x:hover{background:rgba(255,255,255,.08);color:#fff}
    .main{margin-left:var(--side-w);min-height:100dvh;display:flex;flex-direction:column}
    .topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;height:calc(var(--top-h) + var(--sat));padding:var(--sat) 24px 0;background:var(--glass);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line)}
    .hamb{display:none}
    .tt{flex:1;min-width:0}.tt strong{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt span{display:block;font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt .off{display:inline-block;font-style:normal;font-size:10.5px;font-weight:600;color:var(--amber);background:var(--amber-soft);padding:1px 7px;border-radius:999px;margin-top:2px}
    .tr{display:flex;gap:6px;align-items:center}.theme{color:var(--muted)}
    .page{flex:1}
    .page.enter{animation:pageIn 260ms var(--ease) backwards}
    @keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .tabs{display:none}
    @media (max-width:1019px){
      .rail{transform:translateX(-24px);opacity:0;visibility:hidden;transition:transform 240ms var(--ease),opacity 240ms var(--ease),visibility 0s 240ms;box-shadow:var(--sh-lg)}
      .rail.open{transform:none;opacity:1;visibility:visible;transition:transform 240ms var(--ease),opacity 240ms var(--ease)}
      .main{margin-left:0}.hamb{display:grid}
      .topbar{padding:var(--sat) 12px 0 8px}
      .page{padding:16px 16px calc(84px + var(--sab))}
      .btn.sm .lbl{display:none}.tr .btn.sm{width:38px;padding:0;border-radius:10px}.tr .btn.sm > bb-icon{margin-left:0}
      .tabs{display:block}
    }
    @media (prefers-reduced-motion:reduce){.page.enter{animation:none}}`]
})
export class WorkshopShellComponent implements OnInit, OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService);
  private route = inject(ActivatedRoute); private router = inject(Router);
  railOpen = signal(false); private railLockY = 0;
  title = signal(''); time = signal(''); date = signal(''); activeUrl = signal(''); entering = signal(false);
  private timer: any; private sub: any;
  private all: NavItem[] = [
    { path: 'floor', label: 'Floor', icon: 'bay', badge: () => this.data.overdue().length },
    { path: 'cars', label: 'Cars', icon: 'car', badge: () => this.data.awaiting().length },
    { path: 'enquiries', label: 'Enquiries', icon: 'inbox', badge: () => this.data.newEnquiries().length },
    { path: 'quotes', label: 'Quotes', icon: 'quote', owner: true, badge: () => this.data.quotes().filter(q => q.status === 'sent').length },
    { path: 'customers', label: 'Customers', icon: 'users', badge: () => this.data.followupsDue().length },
    { path: 'activity', label: 'Activity', icon: 'activity' },
    { path: 'money', label: 'Money', icon: 'money', owner: true },
    { path: 'settings', label: 'Settings', icon: 'settings', owner: true }
  ];
  items = computed(() => this.all.filter(i => !i.owner || this.session.owner()));
  tabs = computed<MenuTab[]>(() => {
    const menus: Record<string, MenuAction[]> = {
      floor: [ { label: 'Car in', icon: 'plus', link: '/workshop/new' }, { label: 'Ready for pickup', icon: 'tick', link: '/workshop/cars', params: { f: 'ready' } }, { label: 'Sign out', icon: 'out', run: () => this.out() } ],
      cars: [ { label: 'Car in', icon: 'plus', link: '/workshop/new' }, { label: 'Waiting on customer', icon: 'alert', link: '/workshop/cars', params: { f: 'waiting' } }, { label: 'Delivered', icon: 'check', link: '/workshop/cars', params: { f: 'delivered' } } ],
      customers: [ { label: 'Follow-ups due', icon: 'clock', link: '/workshop/customers', params: { t: 'due' } }, { label: 'Coming up', icon: 'history', link: '/workshop/customers', params: { t: 'soon' } } ],
      enquiries: [ { label: 'New enquiry', icon: 'plus', link: '/workshop/enquiries', params: { add: 1 } }, { label: 'Board', icon: 'board', link: '/workshop/enquiries', params: { view: 'board' } }, { label: 'List', icon: 'list', link: '/workshop/enquiries', params: { view: 'list' } } ],
      quotes: [ { label: 'New quote', icon: 'plus', link: '/workshop/quote/new' }, { label: 'Money', icon: 'money', link: '/workshop/money' }, { label: 'Settings', icon: 'settings', link: '/workshop/settings' } ],
      activity: [], money: [], settings: []
    };
    const want = this.session.owner() ? ['floor', 'cars', 'enquiries', 'quotes', 'customers'] : ['floor', 'cars', 'enquiries', 'customers', 'activity'];
    return want.map(p => this.items().find(i => i.path === p)!).filter(Boolean).map(it => ({ ...it, path: '/workshop/' + it.path, menu: menus[it.path] || [] }));
  });
  setRail(open: boolean){
    if (open === this.railOpen()) return; this.railOpen.set(open); if (innerWidth >= 1020) return;
    const b = document.body;
    if (open) { this.railLockY = scrollY; b.style.top = `-${this.railLockY}px`; b.classList.add('sheet-open', 'rail-lock'); }
    else if (b.classList.contains('rail-lock')) { b.classList.remove('sheet-open', 'rail-lock'); b.style.top = ''; scrollTo(0, this.railLockY); }
  }
  ngOnInit(){
    document.body.classList.add('in-shell'); this.theme.apply(); setTop(pageColour()); this.readTitle();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => { const was = this.activeUrl(); this.readTitle(); if (was && was !== this.activeUrl()) { this.entering.set(false); requestAnimationFrame(() => this.entering.set(true)); } });
    this.tick(); this.timer = setInterval(() => this.tick(), 15000);
  }
  ngOnDestroy(){ this.setRail(false); document.body.classList.remove('in-shell'); clearInterval(this.timer); this.sub?.unsubscribe(); }
  private readTitle(){ let r = this.route; while (r.firstChild) r = r.firstChild; this.title.set(r.snapshot.data['title'] || ''); const u = this.router.url.split('?')[0]; this.activeUrl.set(u.startsWith('/workshop/job') ? '/workshop/cars' : u.startsWith('/workshop/quote/') ? '/workshop/quotes' : u); }
  private tick(){ const d = new Date(); this.time.set(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); this.date.set(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })); }
  out(){ this.session.logout(); this.router.navigate(['/']); }
  @HostListener('document:keydown.escape') esc(){ this.setRail(false); }
}
