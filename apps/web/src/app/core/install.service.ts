import { Injectable, signal } from '@angular/core';

/* Putting the app on the home screen. Android fires beforeinstallprompt and we keep it
   for a button; iPhone never does, so the button becomes a two-line instruction. Once
   the app runs standalone the whole thing disappears. */
@Injectable({ providedIn: 'root' })
export class InstallService {
  readonly canPrompt = signal(false);
  readonly standalone = signal(matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  readonly ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  private deferred: any = null;
  constructor(){
    addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); this.deferred = e; this.canPrompt.set(true); });
    addEventListener('appinstalled', () => { this.deferred = null; this.canPrompt.set(false); this.standalone.set(true); });
  }
  async prompt(){ if (!this.deferred) return false; this.deferred.prompt(); const r = await this.deferred.userChoice.catch(() => null); this.deferred = null; this.canPrompt.set(false); return r?.outcome === 'accepted'; }
}
