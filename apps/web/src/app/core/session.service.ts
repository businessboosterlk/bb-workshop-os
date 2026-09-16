import { Injectable, signal, inject, computed } from '@angular/core';
import { CastService } from './cast.service';
import { Cast, Role } from './models';

/* Who is holding the phone. Two kinds of seat and they never mix:
     customer  a phone number, proven by a one-time code. Sees only cars on that number.
     staff     a named seat with a role. Owner sees money; staff never do.
   In the static demo the code is the cast's demo code and the PINs are in the cast.
   With the API the server issues a signed token and the browser keeps nothing else. */
export type Kind = 'customer' | 'staff';
interface Saved { kind: Kind; token: string; slug: string; name: string; phone?: string; role?: Role; branch?: string; cast: Cast; }
const KEY = 'wos_session';
@Injectable({ providedIn: 'root' })
export class SessionService {
  private castSvc = inject(CastService);
  readonly kind = signal<Kind | ''>('');
  readonly name = signal('');
  readonly phone = signal('');
  readonly role = signal<Role | ''>('');
  readonly branch = signal('');
  readonly token = signal('');
  readonly error = signal('');
  readonly sentTo = signal('');
  readonly owner = computed(() => this.role() === 'owner');
  readonly signedIn = computed(() => !!this.kind());

  restore(): boolean {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return false;
      const s = JSON.parse(raw) as Saved; if (!s.cast || !s.kind) return false;
      this.castSvc.use(s.cast); this.kind.set(s.kind); this.name.set(s.name); this.phone.set(s.phone || ''); this.role.set(s.role || ''); this.branch.set(s.branch || ''); this.token.set(s.token || '');
      return true;
    } catch { return false; }
  }
  /* step one of the customer door: ask for a code. The demo shows it on screen and says so. */
  async sendCode(phone: string): Promise<boolean> {
    this.error.set('');
    const p = normalise(phone); if (!p) { this.error.set('Type the phone number the workshop has for you.'); return false; }
    const api = this.castSvc.config().api;
    if (api) {
      try { const r = await fetch(`${api}/api/otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: p }) });
        if (!r.ok) { this.error.set('That number is not on file at the workshop.'); return false; } }
      catch { this.error.set('Could not reach the workshop. Check the signal and try again.'); return false; }
    } else if (!this.castSvc.cast()) { await this.castSvc.loadStatic(); if (!this.castSvc.cast()) { this.error.set('No workshop found at this address.'); return false; } }
    this.sentTo.set(p); return true;
  }
  async loginCustomer(code: string): Promise<boolean> {
    this.error.set(''); const p = this.sentTo(); if (!p) return false;
    const api = this.castSvc.config().api;
    if (api) {
      try {
        const r = await fetch(`${api}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'customer', phone: p, code }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { this.error.set(j.error || 'That code is not right.'); return false; }
        this.save({ kind: 'customer', token: j.token, slug: j.slug, name: j.name, phone: p, cast: j.cast }); return true;
      } catch { this.error.set('Could not reach the workshop. Check the signal and try again.'); return false; }
    }
    const cast = this.castSvc.cast()!;
    if (!cast.customerCode || code !== cast.customerCode) { this.error.set('That code is not right.'); return false; }
    this.save({ kind: 'customer', token: '', slug: cast.slug, name: '', phone: p, cast }); return true;
  }
  async loginStaff(name: string, pin: string): Promise<boolean> {
    this.error.set('');
    const api = this.castSvc.config().api;
    if (api) {
      try {
        const r = await fetch(`${api}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'staff', name, pin }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { this.error.set(j.error || 'That name and PIN do not match.'); return false; }
        this.save({ kind: 'staff', token: j.token, slug: j.slug, name: j.name, role: j.role, branch: j.branch, cast: j.cast }); return true;
      } catch { this.error.set('Could not reach the workshop. Check the signal and try again.'); return false; }
    }
    if (!this.castSvc.cast()) await this.castSvc.loadStatic();
    const cast = this.castSvc.cast(); if (!cast) { this.error.set('No workshop found at this address.'); return false; }
    const u = cast.users.find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
    if (!u || !u.pin || u.pin !== pin) { this.error.set('That name and PIN do not match.'); return false; }
    this.save({ kind: 'staff', token: '', slug: cast.slug, name: u.name, role: u.role, branch: u.branch, cast }); return true;
  }
  /* on every open: the workshop's settings are fetched fresh, so a seat signed in last week
     still gets this week's phases, follow-ups and quote numbers. The Hub does the same.
     Offline keeps the saved copy. */
  async refreshCast(){
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    try {
      const fresh = api ? await fetch(`${api}/api/${c.slug}/cast`, { headers: { Authorization: 'Bearer ' + this.token() } }).then(r => r.ok ? r.json() : null)
                        : await fetch(`casts/${c.slug}.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null);
      if (!fresh) return;
      const raw = localStorage.getItem(KEY); if (!raw) return;
      const s = JSON.parse(raw) as Saved; this.save({ ...s, cast: fresh });
    } catch { /* offline */ }
  }
  private save(s: Saved){
    this.castSvc.use(s.cast); this.kind.set(s.kind); this.name.set(s.name); this.phone.set(s.phone || ''); this.role.set(s.role || ''); this.branch.set(s.branch || ''); this.token.set(s.token);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }
  logout() { this.kind.set(''); this.name.set(''); this.phone.set(''); this.role.set(''); this.branch.set(''); this.token.set(''); this.sentTo.set(''); try { localStorage.removeItem(KEY); } catch {} }
  initial() { return (this.name() || this.phone() || '?').slice(0, 1).toUpperCase(); }
}
/* a Sri Lankan mobile in any of its usual spellings becomes 07XXXXXXXX; anything else is refused */
export function normalise(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('94')) d = '0' + d.slice(2);
  if (d.length === 9 && d[0] === '7') d = '0' + d;
  return /^07\d{8}$/.test(d) ? d : '';
}
