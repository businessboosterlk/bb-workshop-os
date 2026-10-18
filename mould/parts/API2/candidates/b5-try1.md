```js
// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })
/* every call carries the seat's token; a write that cannot reach the server waits in
   an outbox in this browser and replays on the next success. 401 means the seat is gone. */
class ApiAdapter implements Adapter {
  onAuthLost?: () => void; onOffline?: (n: number) => void; onRejected?: (message: string) => void;
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
      try { const b = await res.json(); if (b && b.error) msg = b.error; } catch {}
      const e: any = new Error(msg); e.status = res.status; throw e;
    }
    return res.json();
  }
  async flush(){ if (this.flushing) return this.flushing; this.flushing = this.doFlush().finally(() => { this.flushing = null; }); return this.flushing; }
  private async doFlush(){ const q = this.outbox(); if (!q.length) return; const left: any[] = [];
    for (const w of q) {
      try { await this.go(w.path, { method: w.method, body: w.body, headers: { ...(w.version ? { 'x-wos-version': w.version } : {}), 'x-wos-op': w.op } }); }
      catch (e: any) {
        if (e.status === 401) { left.push(w); break; }
        if (e.status >= 400 && e.status < 500) { this.onRejected?.(e.message); continue; }
        left.push(w); break;
      }
    }
    this.setOutbox(left); }
  private async write<T>(path: string, method: string, body?: any, fallback?: T, version?: string): Promise<T> {
    const op = uid();
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined, headers: { ...(version ? { 'x-wos-version': version } : {}), 'x-wos-op': op } }); this.flush(); return r; }
    catch (e: any) { if (e.status === 401 || (e.status && e.status < 500)) throw e; this.setOutbox([...this.outbox(), { op, path, method, body: body ? JSON.stringify(body) : undefined, version }]); return fallback as T; }
  }
  async list<T>(t: Table) { await this.flush(); const all: T[] = []; for (let off = 0; off < 200000; off += 500) { const page = await this.go<T[]>(`${t}?limit=500&offset=${off}`); all.push(...page); if (page.length < 500) break; } return all; }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null, version); }
  command<T>(t: Table, id: string, name: string, body: any, version?: string) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null, version); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
// BLOCK: apps/web/src/app/core/data.service.ts | start=      const a = new ApiAdapter(api, c.slug | until=      addEventListener('online'
      const a = new ApiAdapter(api, c.slug, () => this.session.token(), () => (this.session.kind() === 'customer' ? 'customer:' + this.session.phone() : 'staff:' + this.session.name()));
      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); a.onRejected = msg => this.toast('A change made offline was refused: ' + msg); this.adapter = a;
```