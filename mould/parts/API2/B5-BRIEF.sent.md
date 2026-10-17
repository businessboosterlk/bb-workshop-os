PART B5 of the Workshop OS (a garage system). Web app: Angular 20 TypeScript, file apps/web/src/app/core/data.service.ts. Audit finding E05.

THE FAULT. The web app keeps an OUTBOX in localStorage: a write that cannot reach the server waits there and replays later. Four faults:
1. Two flushes can run at once (a list read and a write both call flush), so one queued write is sent twice.
2. EVERY failure is queued, including a 400, 403, 404, 409 or 428. Those can never succeed; they replay forever and the person is never told their change was refused.
3. The outbox key is only the workshop (`wos_outbox_<slug>`). When a second person signs in on the same tablet, the first person's waiting writes replay under the second person's token.
4. A queued write has no operation id, so the server cannot tell a replay from a new write.

CURRENT CODE (lines 40 to 67, the ApiAdapter class):
```ts
/* every call carries the seat's token; a write that cannot reach the server waits in
   an outbox in this browser and replays on the next success. 401 means the seat is gone. */
class ApiAdapter implements Adapter {
  onAuthLost?: () => void; onOffline?: (n: number) => void;
  constructor(private base: string, private slug: string, private token: () => string) {}
  private outKey(){ return 'wos_outbox_' + this.slug; }
  private outbox(): any[] { try { return JSON.parse(localStorage.getItem(this.outKey()) || '[]'); } catch { return []; } }
  private setOutbox(q: any[]){ try { localStorage.setItem(this.outKey(), JSON.stringify(q)); } catch {} this.onOffline?.(q.length); }
  private async go<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}/api/${this.slug}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token(), ...(init?.headers || {}) } });
    if (res.status === 401) { this.onAuthLost?.(); throw new Error('401'); }
    if (res.status === 204) return null as T;
    if (!res.ok) throw new Error(`${res.status} on ${path}`);
    return res.json();
  }
  async flush(){ const q = this.outbox(); if (!q.length) return; const left: any[] = [];
    for (const w of q) { try { await this.go(w.path, { method: w.method, body: w.body, headers: w.version ? { 'x-wos-version': w.version } : undefined }); } catch (e: any) { if (e.message === '401') return; left.push(w); } }
    this.setOutbox(left); }
  private async write<T>(path: string, method: string, body?: any, fallback?: T, version?: string): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined, headers: version ? { 'x-wos-version': version } : undefined }); this.flush(); return r; }
    catch (e: any) { if (e.message === '401') throw e; this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined, version }]); return fallback as T; }
  }
  async list<T>(t: Table) { await this.flush(); const all: T[] = []; for (let off = 0; off < 200000; off += 500) { const page = await this.go<T[]>(`${t}?limit=500&offset=${off}`); all.push(...page); if (page.length < 500) break; } return all; }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>, version?: string) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null, version); }
  command<T>(t: Table, id: string, name: string, body: any, version?: string) { return this.write<T | null>(`${t}/${id}/${name}`, 'POST', body, null, version); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
```
Helpers in the same file (module level): `uid()` returns a short unique id string like 'rlx3k9a2bq'; `now()` returns an ISO time. `Table` is a string union of the table names.

CURRENT LINES 108 and 109, inside `DataService.init()` (`api` is the server base URL, `c.slug` the workshop):
```ts
      const a = new ApiAdapter(api, c.slug, () => this.session.token());
      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); this.adapter = a;
```
DataService facts: `this.session.token()`, `this.session.kind()` ('staff' or 'customer'), `this.session.name()` and `this.session.phone()` read the signed in seat at the moment they are called (the seat can change while the app runs). `this.pending` and `this.authLost` are signals (`.set(x)`). `this.toast(text)` shows a short message to the person.

WHAT TO WRITE. Return ONE ```js code block holding two parts, each opened by its header line exactly as shown.

Part 1 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=/* every call carries the seat's token | until=@Injectable({ providedIn: 'root' })`
A short comment and the whole new ApiAdapter class (it `implements Adapter`, keeps the method names and signatures `list`, `create`, `update(t, id, patch, version?)`, `command(t, id, name, body, version?)`, `remove`, `flush`). Rules:
- Constructor: `constructor(private base: string, private slug: string, private token: () => string, private seat: () => string) {}`.
- Callbacks: `onAuthLost?: () => void; onOffline?: (n: number) => void; onRejected?: (message: string) => void;`
- Outbox key: `'wos_outbox_' + this.slug + '_' + encodeURIComponent(this.seat())`, read fresh on every call (the seat can change). Reading, writing and the `onOffline(q.length)` count all use the current seat's key only.
- `go<T>(path, init)`: same fetch as today. 401: call onAuthLost and throw an Error with message '401' and `status = 401`. 204: return null. Any other non ok answer: read the JSON body's `error` text if there is one and throw an Error whose message is that text (or `${res.status} on ${path}` when there is none) with a `status` property set to the HTTP status. A fetch that throws (no network) lets that error through (it has no status).
- Every write gets an operation id `op = uid()` and sends it as the header `'x-wos-op': op`, next to `'x-wos-version'` when a version is given. A queued item is `{ op, path, method, body, version }` and a replay sends the SAME op and version.
- `write`: on success call `this.flush()` (do not await it) and return the reply. On an error: when it is the 401, or when it has a status below 500, throw it to the caller (NOT queued). Only an error with no status (the network) or a status of 500 or more is queued, then return `fallback`.
- `flush()` is single flight: keep `private flushing: Promise<void> | null = null`; when a flush is running, return that same promise; otherwise start one, store it, and clear it in a finally. Inside: replay the current seat's queue in order. A replay that succeeds is removed. A replay that answers 401 stops the flush and keeps every write that has not succeeded. A replay that answers with a status from 400 to 499 is removed (it can never succeed) and `onRejected(message)` is called with the error message. A replay that fails on the network or with 500 or more stops the flush and keeps itself and every later write (order matters). At the end save what is left with the count.
- `list`: same as today (await flush, then page by page).
- `create`, `update`, `command`, `remove`: same as today, through `write`.

Part 2 header: `// BLOCK: apps/web/src/app/core/data.service.ts | start=      const a = new ApiAdapter(api, c.slug | until=      addEventListener('online'`
Two lines, six spaces each:
`      const a = new ApiAdapter(api, c.slug, () => this.session.token(), () => (this.session.kind() === 'customer' ? 'customer:' + this.session.phone() : 'staff:' + this.session.name()));`
`      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); a.onRejected = msg => this.toast('A change made offline was refused: ' + msg); this.adapter = a;`

YOUR FIRST TRY FAILED ON THIS (29 of 30 checks passed). Your flush read the queue once at the start and at the end wrote back only what was left of THAT copy (`this.setOutbox(left)`). A write that failed on the network WHILE the flush was running was appended to the outbox and then wiped out when the flush saved `left`: a change the person made offline was lost. Fix: capture the seat key once when the flush starts and use it for the whole flush; at the end read the queue again from that key and keep (a) the items of the copy you started with that were not removed, plus (b) every item that was appended after the flush started (match by `op`: anything in the fresh queue whose op was not in your starting copy). Save that under the same key. The same holds for the key a write queues under: read the seat once per write.

TRAPS.
- A flush called while another runs must not start a second loop over the same queue.
- Save the outbox under the seat key that was current when the write was queued; never move one seat's queue to another seat.
- A 409 on replay is removed, a 503 on replay is kept.
- Do not change anything outside the two parts.
