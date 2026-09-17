import { Component, Input, Output, EventEmitter, HostListener, OnDestroy } from '@angular/core';
import { IconComponent } from './icon.component';

/* The one overlay. It locks the page behind it the iOS way (pin the body at its
   scroll position, restore on close), pushes a history entry so the phone back
   button closes it, and closes on Escape. Hidden in place, never parked off screen. */
@Component({
  selector: 'bb-drawer',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="scrim" [class.on]="open" (click)="close()"></div>
    <aside class="drawer" [class.on]="open" role="dialog" [attr.aria-hidden]="!open" [attr.inert]="open ? null : ''">
      <div class="d-head">
        <h3>{{ title }}</h3>
        @if (editable) { <button class="btn ghost sm d-edit" type="button" (click)="edit.emit()"><bb-icon name="edit"/>Edit</button> }
        <button class="x" type="button" (click)="close()" aria-label="Close"><bb-icon name="x"/></button>
      </div>
      <div class="d-body"><ng-content/></div>
      <div class="d-foot" [hidden]="!foot"><ng-content select="[foot]"/></div>
    </aside>`
})
export class DrawerComponent implements OnDestroy {
  @Input() title = '';
  @Input() foot = true;
  @Input() set open(v: boolean) { if (v !== this._open) { this._open = v; v ? this.lock() : this.unlock(); } }
  get open() { return this._open; }
  @Output() closed = new EventEmitter<void>();
  /* every sheet that shows a record the app created offers Edit in its head (17 Sep 2026) */
  @Input() editable = false;
  @Output() edit = new EventEmitter<void>();
  private _open = false;
  private pushed = false;

  /* ONE PAGE LOCK AND ONE HISTORY ENTRY SHARED BY ALL SHEETS (17 Sep 2026). A sheet opened from
     inside another sheet (Edit, Mark as lost) used to close itself on arrival: the first sheet's
     history.back() fired a popstate that every sheet heard. Now:
       - the page is pinned while ANY sheet is open, and released when the last one closes;
       - a sheet closing while another opens in the same moment hands its history entry over
         instead of stepping back, so the phone's back button still closes the sheet on screen;
       - a popstate that a sheet caused itself is ignored by every sheet. */
  private static openCount = 0;
  private static lockedY = 0;
  private static handoff = false;
  private static ignorePopUntil = 0;

  close() { if (!this._open) return; this._open = false; this.unlock(); this.closed.emit(); }
  @HostListener('document:keydown.escape') onEsc() { this.close(); }
  @HostListener('window:popstate') onPop() {
    if (performance.now() < DrawerComponent.ignorePopUntil) return;
    if (this._open) { this.pushed = false; this.close(); }
  }
  private lock() {
    const D = DrawerComponent;
    if (D.openCount === 0) { D.lockedY = window.scrollY; document.body.style.top = `-${D.lockedY}px`; document.body.classList.add('sheet-open'); }
    D.openCount++;
    if (typeof history === 'undefined') return;
    history.scrollRestoration = 'manual';
    if (D.handoff) { D.handoff = false; this.pushed = true; }   /* take over the entry of the sheet that just closed */
    else { history.pushState({ drawer: 1 }, ''); this.pushed = true; }
  }
  private unlock() {
    const D = DrawerComponent;
    D.openCount = Math.max(0, D.openCount - 1);
    if (D.openCount === 0) { document.body.classList.remove('sheet-open'); document.body.style.top = ''; window.scrollTo(0, D.lockedY); }
    if (!this.pushed) return;
    this.pushed = false;
    /* wait one tick: if another sheet opens now, it takes this entry and nothing steps back */
    D.handoff = true;
    setTimeout(() => { if (!D.handoff) return; D.handoff = false; D.ignorePopUntil = performance.now() + 500; history.back(); }, 0);
  }
  /* a sheet whose screen is left while it is open (a button inside it navigates) hands the page back.
     No history step here: the router has already moved on. */
  ngOnDestroy() {
    if (!this._open) return; this._open = false; this.pushed = false;
    const D = DrawerComponent; D.openCount = Math.max(0, D.openCount - 1);
    if (D.openCount === 0) { document.body.classList.remove('sheet-open'); document.body.style.top = ''; }
  }
}
