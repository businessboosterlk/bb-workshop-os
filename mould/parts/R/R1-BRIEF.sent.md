PART R1 of the Workshop OS (a garage system). Web: Angular 19 TypeScript. File: apps/web/src/app/core/data.service.ts.

THE JOB. When the server refuses a save, the person must read why in plain words. Today a refused write throws an Error whose message is the server's own words (`body.error`) or, when the server sent none, the bare text `"<status> on <path>"`, and whose `.status` is the HTTP code. Two things are missing:
1. On a 409 (someone else changed the record) or a 428 (the screen sent no version) the screen still shows the old data. The data service must reload every list BEFORE the error reaches the screen, so the person's next try starts from fresh data.
2. When the server sent no words, a 409, 428 or 403 must carry these exact words instead of "<status> on <path>":
   - 409: `Someone else changed this car a moment ago. It has been refreshed: make your change again.`
   - 428: `This screen was out of date. It has been refreshed: make your change again.`
   - 403: `This seat cannot do that.`
   A 400 or 404 keeps whatever it has today. Server words, when sent, are always kept for every status.

FACTS ABOUT THE FILE.
- `ApiAdapter.go()` makes every request. `ApiAdapter.write()` wraps every create, update, command and remove: a network failure or 5xx waits in an outbox and returns the fallback, a 401 or any other 4xx is rethrown.
- `doFlush()` replays the outbox with `go()` directly, NOT with `write()`. Replays must behave exactly as today (they already toast through onRejected).
- `ApiAdapter.list()` calls `await this.flush()` first, which replays the outbox. A refresh after a 409 must NOT replay the outbox (the replay would hit the same refusal and drop the waiting writes), so `list` needs a way to skip the flush.
- `DataService.reload()` loads the six lists through `this.adapter.list`. `DataService.init()` builds the ApiAdapter in api mode and wires its callbacks there.
- `LocalAdapter` (the demo, mode 'local') must behave exactly as today. It ignores any extra argument to list.

CURRENT LINES 17 to 22 (the Adapter interface):
```ts
interface Adapter {
  list<T>(t: Table): Promise<T[]>;
  create<T>(t: Table, row: Partial<T>): Promise<T>;
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string): Promise<T | null>;
  remove(t: Table, id: string): Promise<void>;
}
```

CURRENT LINES 40 to 112 (the ApiAdapter class with its comment):
```ts
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
      if (e.status === 401 || (e.status && e.status < 500)) throw e;
      let q: any[] = [];
      try { q = JSON.parse(localStorage.getItem(key) || '[]'); } catch { q = []; }
      q.push({ op, path, method, body: body ? JSON.stringify(body) : undefined, version });
      try { localStorage.setItem(key, JSON.stringify(q)); } catch {}
      this.onOffline?.(q.length);
      return fallback as T;
    }
  }
  async list<T>(t: Table) { await this.flush(); const all: T[] = []; for (let off = 0; off < 200000; off += 500) { const page = await this.go<T[]>(`${t}?limit=500&offset=${off}`); all.push(...page); if (page.length < 500) break; } return all; }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null, version); }
  command<T>(t: Table, id: string, name: string, body: any, version?: string) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null, version); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
```

CURRENT LINES 148 to 170 (init and reload inside class DataService, indented two spaces):
```ts
  async init() {
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    this.mode.set(api ? 'api' : 'local');
    if (api) {
      const a = new ApiAdapter(api, c.slug, () => this.session.token(), () => (this.session.kind() === 'customer' ? 'customer:' + this.session.phone() : 'staff:' + this.session.name()));
      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); a.onRejected = msg => this.toast('A change made offline was refused: ' + msg); this.adapter = a;
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
  async reload() {
    const [j, c, a, p, e, q] = await Promise.all([this.adapter.list<Job>('jobs'), this.adapter.list<Customer>('customers'), this.adapter.list<Activity>('activities'), this.adapter.list<Photo>('photos'),
      this.session.kind() === 'staff' ? this.adapter.list<Enquiry>('enquiries') : Promise.resolve([]), this.session.owner() ? this.adapter.list<Quote>('quotes') : Promise.resolve([])]);
    this.jobs.set(j); this.customers.set(c); this.activities.set(a); this.photos.set(p); this.enquiries.set(e); this.quotes.set(q);
  }
```

WHAT TO WRITE. Return ONE ```ts code block holding three parts, each opened by its header line exactly as shown, in this order. Nothing between parts but the next header.

Part 1 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=interface Adapter { | until=const now = () =>`
The Adapter interface, unchanged except: `list<T>(t: Table, flush?: boolean): Promise<T[]>;`

Part 2 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })`
Starts with the comment line (keep both comment lines), then a module level constant, then the whole ApiAdapter class. Rules:
- Before the class: `const REFUSED: Record<number, string> = { 409: '<409 words>', 428: '<428 words>', 403: '<403 words>' };` with the exact words above. The words hold no quote marks, so single quotes are fine.
- Add a callback beside the other three: `onStale?: () => Promise<void>;`
- In `go()`, inside `if (!res.ok)`: keep `msg` exactly as today, and remember whether the server sent words: `let words = false;` and in the json try `if (b && b.error) { msg = b.error; words = true; }`. Then `const e: any = new Error(msg); e.status = res.status; e.words = words; throw e;`. The 401 line and everything else in go() stay as they are.
- In `write()`, inside the catch, BEFORE the existing line `if (e.status === 401 || (e.status && e.status < 500)) throw e;` add exactly these two lines:
  `if (e.status === 409 || e.status === 428) { try { await this.onStale?.(); } catch {} }`
  `if (!e.words && REFUSED[e.status]) e.message = REFUSED[e.status];`
  The rest of write() stays exactly as it is (the outbox for network failures and 5xx).
- `list` becomes `async list<T>(t: Table, flush = true) { if (flush) await this.flush(); ...the same paging loop as today... }`.
- `flush`, `doFlush`, `outKey`, `outbox`, `setOutbox`, `create`, `update`, `command`, `remove` stay exactly as they are. doFlush must not use REFUSED.

Part 3 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  async init() { | until=  job(id: string) {`
init and reload, indented two spaces, unchanged except:
- In init's api branch, on the same line where `a.onAuthLost`, `a.onOffline` and `a.onRejected` are set, also set `a.onStale = () => this.reload(false);` (a refresh that does not replay the outbox).
- `async reload(flush = true)`: pass `flush` as the second argument to each of the four `this.adapter.list<...>(...)` calls and to the two conditional ones (enquiries, quotes). Everything else in reload stays as it is.

TRAPS.
- Never change the message of a refusal the server sent words for.
- A 409 with words still reloads.
- The reload after a refusal sits in its own try and a reload failure is swallowed, so the person always gets the refusal itself.
- The outbox, the operation ids (x-wos-op), the version header (x-wos-version) and the 401 path do not change.
- No em or en dash anywhere. TypeScript strict: `e` in a catch is `any` as the file already writes it.
