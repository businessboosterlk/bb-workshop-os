```ts
// BLOCK: apps/web/src/app/core/data.service.ts | start=interface Adapter { | until=const now = () =>
interface Adapter {
  list<T>(t: Table, flush?: boolean): Promise<T[]>;
  create<T>(t: Table, row: Partial<T>): Promise<T>;
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string): Promise<T | null>;
  remove(t: Table, id: string): Promise<void>;
}
// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })
/* every call carries the seat's token; a write that cannot reach the server waits in
   an outbox in this browser and replays on the next success. 401 means the seat is gone. */
const REFUSED: Record<number, string> = { 409: 'Someone else changed this car a moment ago. It has been refreshed: make your change again.', 428: 'This screen was out of date. It has been refreshed: make your change again.', 403: 'This seat cannot do that.' };
class ApiAdapter implements Adapter {
  onAuthLost?: () => void; onOffline?: (n: number) => void; onRejected?: (message: string) => void; onStale?: () => Promise<void>;
  private flushing: Promise<void> | null = null;
  constructor(private base: string, private slug: string, private token: () => string, private seat: () => string) {}
  private outKey(){ return 'wos_outbox_' + this.slug + '_' + encodeURIComponent(this.seat()); }
  private outbox(): any[] { try { return JSON.parse(localStorage.getItem(this.outKey()) || '[]'); } catch { return []; } }
  private setOutbox(q: any[]){ try { localStorage.setItem(this.outKey(), JSON.stringify(q)); } catch {} this.onOffline?.(q.length); }
  private async go<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}/api/${this.slug}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token(), ...(init?.headers || {}) } });
    if (res.status === 401) { this.onAuthLost?.(); const e: any = new Error('401'); e.status = 401; throw e; }
    if (res.status === 204) return null as T;
    if (!res.ok) {
      let msg = `${res.status} on ${path}`;
      let words = false;
      try { const b = await res.json(); if (b && b.error) { msg = b.error; words = true; } } catch {}
      const e: any = new Error(msg); e.status = res.status; e.words = words; throw e;
    }
    return res.json();
  }
  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => { this.flushing = null; });
    return this.flushing;
  }
  private async doFlush(): Promise<void> {
    const key = 'wos_outbox_' + this.slug + '_' + encodeURIComponent(this.seat());
    let q: any[] = [];
    try { q = JSON.parse(localStorage.getItem(key) || '[]'); } catch { q = []; }
    if (!q.length) return;
    const startOps = new Set(q.map((w: any) => w.op));
    const left: any[] = [];
    for (const w of q) {
      try {
        await this.go(w.path, { method: w.method, body: w.body, headers: { ...(w.version ? { 'x-wos-version': w.version } : {}), 'x-wos-op': w.op } });
      } catch (e: any) {
        if (e.status === 401) { left.push(w); break; }
        if (e.status && e.status >= 400 && e.status < 500) { this.onRejected?.(e.message); continue; }
        left.push(w); break;
      }
    }
    let fresh: any[] = [];
    try { fresh = JSON.parse(localStorage.getItem(key) || '[]'); } catch { fresh = []; }
    const merged = [...left];
    for (const item of fresh) {
      if (!startOps.has(item.op)) merged.push(item);
    }
    try { localStorage.setItem(key, JSON.stringify(merged)); } catch {}
    this.onOffline?.(merged.length);
  }
  private async write<T>(path: string, method: string, body?: any, fallback?: T, version?: string): Promise<T> {
    const op = uid();
    const key = 'wos_outbox_' + this.slug + '_' + encodeURIComponent(this.seat());
    try {
      const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined, headers: { ...(version ? { 'x-wos-version': version } : {}), 'x-wos-op': op } });
      this.flush();
      return r;
    } catch (e: any) {
      if (e.status === 409 || e.status === 428) { try { await this.onStale?.(); } catch {} }
      if (!e.words && REFUSED[e.status]) e.message = REFUSED[e.status];
      if (e.status === 401 || (e.status && e.status < 500)) throw e;
      let q: any[] = [];
      try { q = JSON.parse(localStorage.getItem(key) || '[]'); } catch { q = []; }
      q.push({ op, path, method, body: body ? JSON.stringify(body) : undefined, version });
      try { localStorage.setItem(key, JSON.stringify(q)); } catch {}
      this.onOffline?.(q.length);
      return fallback as T;
    }
  }
  async list<T>(t: Table, flush = true) { if (flush) await this.flush(); const all: T[] = []; for (let off = 0; off < 200000; off += 500) { const page = await this.go<T[]>(`${t}?limit=500&offset=${off}`); all.push(...page); if (page.length < 500) break; } return all; }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null, version); }
  command<T>(t: Table, id: string, name: string, body: any, version?: string) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null, version); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
// BLOCK: apps/web/src/app/core/data.service.ts | start=  async init() { | until=  job(id: string) {
  async init() {
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    this.mode.set(api ? 'api' : 'local');
    if (api) {
      const a = new ApiAdapter(api, c.slug, () => this.session.token(), () => (this.session.kind() === 'customer' ? 'customer:' + this.session.phone() : 'staff:' + this.session.name()));
      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); a.onRejected = msg => this.toast('A change made offline was refused: ' + msg); a.onStale = () => this.reload(false); this.adapter = a;
      addEventListener('online', () => a.flush().then(() => this.reload()));
    } else {
      const a = new LocalAdapter('wos_' + c.slug);
      /* the demo floor is reseeded when the seed changes shape, so an old browser never shows half a system */
      /* and when the demo floor is over 12 hours old, so its times always read as today (found 15 Oct 2026: a month old floor said 716 h over) */
      if (a.isEmpty() || a.version() !== SEED_VERSION || Date.now() - a.seededAt() > 12 * 3600000) { const s = seed(c); a.fill({ _v: SEED_VERSION as any, _at: Date.now() as any, jobs: s.jobs, customers: s.customers, activities: s.activities, photos: s.photos || [], enquiries: s.enquiries, quotes: s.quotes }); }
      this.adapter = a;
    }
    try { await this.reload(); } catch {}
    this.ready.set(true);
  }
  async reload(flush = true) {
    const [j, c, a, p, e, q] = await Promise.all([this.adapter.list<Job>('jobs', flush), this.adapter.list<Customer>('customers', flush), this.adapter.list<Activity>('activities', flush), this.adapter.list<Photo>('photos', flush),
      this.session.kind() === 'staff' ? this.adapter.list<Enquiry>('enquiries', flush) : Promise.resolve([]), this.session.owner() ? this.adapter.list<Quote>('quotes', flush) : Promise.resolve([])]);
    this.jobs.set(j); this.customers.set(c); this.activities.set(a); this.photos.set(p); this.enquiries.set(e); this.quotes.set(q);
  }
```