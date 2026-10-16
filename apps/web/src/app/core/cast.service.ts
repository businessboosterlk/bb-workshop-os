import { Injectable, signal, computed } from '@angular/core';
import { Cast, Branch, ServiceDef } from './models';

/* The cast is the only thing that differs between workshops: brand, branches, services
   and their phase templates. Every colour on the page derives from the ONE brand hex. */
export interface Config { api: string; cast?: string; }   /* cast: the workshop a public demo address opens on when the link names none (16 Oct 2026) */
@Injectable({ providedIn: 'root' })
export class CastService {
  readonly cast = signal<Cast | null>(null);
  readonly config = signal<Config>({ api: '' });
  readonly slug = computed(() => this.cast()?.slug || '');
  readonly apiMode = computed(() => !!this.config().api);

  async loadConfig(){
    try { const r = await fetch('config.json', { cache: 'no-cache' }); if (r.ok) this.config.set({ api: '', ...(await r.json()) }); } catch {}
    /* A LINK NEVER CHOOSES THE SERVER. The address may name another API only on a developer's own
       machine. Anywhere else a link could have pointed the door at a stranger's server, and the door
       sends a customer's phone number and code, or a staff name and PIN (found in the Hub, 28 Sep 2026). */
    const q = new URLSearchParams(location.search).get('api');
    if (q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(q) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) this.config.set({ ...this.config(), api: q.replace(/\/$/, '') });
  }
  async loadStatic(slug?: string): Promise<Cast | null> {
    const s = slug || new URLSearchParams(location.search).get('c') || localStorage.getItem('wos_slug') || this.config().cast || 'auto-museum';
    if (!/^[a-z0-9-]{2,40}$/.test(s)) return null;
    try {
      const res = await fetch(`casts/${s}.json`, { cache: 'no-cache' });
      if (!res.ok) return null;
      const cast = await res.json() as Cast; this.use(cast); try { localStorage.setItem('wos_slug', s); } catch {} return cast;
    } catch { return null; }
  }
  use(cast: Cast){ this.apply(cast); this.cast.set(cast); }
  clear(){ this.cast.set(null); }
  /* the query string tiers.ts reads: only the demo tier kept by main.ts (the router has dropped the real one by now) */
  tierQuery(): string { try { const t = sessionStorage.getItem('wos_demo_tier'); return t ? 'tier=' + t : ''; } catch { return ''; } }
  branch(key: string): Branch | undefined { return this.cast()?.branches.find(b => b.key === key); }
  service(key: string): ServiceDef | undefined { return this.cast()?.services.find(s => s.key === key); }
  word(k: string, fallback: string) { return this.cast()?.words[k] || fallback; }
  money(n?: number) { const cur = this.word('currency', 'LKR'); return n ? `${cur}\u00a0${Math.round(n).toLocaleString('en-GB')}` : ''; }

  apply(cast: Cast) {
    const root = document.documentElement.style;
    const b = hex(cast.brand.hex) || hex('#C9DD2B')!;
    const set = (k: string, v: string) => root.setProperty(k, v);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    /* an ink brand (black and white, 16 Oct 2026) turns near white at night, or every button would vanish into the page */
    const raw = b; const ink = dark && lum(raw) < .05 ? [242, 242, 243] as RGB : raw;
    set('--brand', toHex(ink));
    set('--brand-dark', toHex(dark ? mix(ink, [255, 255, 255], .12) : mix(ink, [0, 0, 0], .28)));
    set('--brand-deep', toHex(mix(ink, [0, 0, 0], .5)));
    set('--brand-soft', toHex(mix(ink, dark ? [22, 23, 26] : [255, 255, 255], dark ? .8 : .84)));
    set('--brand-lite', toHex(mix(ink, [255, 255, 255], .35)));
    set('--on-accent', lum(ink) > .45 ? '#141417' : '#ffffff');
    set('--sidebar', cast.brand.ink || '#141417');
    /* black and white: the status hues become ink and greys; red is kept for a blocked bay (decision 439 open) */
    for (const [k, day, night] of [['--green', '#141417', '#f2f2f3'], ['--amber', '#55565c', '#c4c5ca'], ['--blue', '#141417', '#f2f2f3'],
      ['--green-soft', '#e7e7ea', 'rgba(255,255,255,.12)'], ['--amber-soft', '#efeff1', 'rgba(255,255,255,.08)'], ['--blue-soft', '#e7e7ea', 'rgba(255,255,255,.12)']] as const)
      cast.brand.mono ? set(k, dark ? night : day) : root.removeProperty(k);
    document.title = `${cast.name}`;
    const m = document.getElementById('manifest') as HTMLLinkElement | null;
    if (m) {
      const man = { name: cast.name, short_name: cast.short || cast.name, start_url: `./?src=app`, display: 'standalone', background_color: '#0b0b0c', theme_color: '#0b0b0c',
        icons: [{ src: new URL('icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' }, { src: new URL('icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }, { src: new URL('icon-maskable-512.png', location.href).href, sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
      m.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(man));
    }
  }
  /* the customer's WhatsApp button reaches the branch that holds the car, never anyone else */
  branchWa(key: string, text: string): string {
    const b = this.branch(key); if (!b?.wa) return '';
    return `https://wa.me/${b.wa}?text=${encodeURIComponent(text)}`;
  }
}
type RGB = [number, number, number];
function hex(h: string): RGB | null { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(c: RGB) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function mix(a: RGB, b: RGB, t: number): RGB { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function lum(c: RGB) { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
