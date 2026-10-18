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
{{lines:apps/web/src/app/core/data.service.ts:17:22}}
```

CURRENT LINES 40 to 112 (the ApiAdapter class with its comment):
```ts
{{lines:apps/web/src/app/core/data.service.ts:40:112}}
```

CURRENT LINES 148 to 170 (init and reload inside class DataService, indented two spaces):
```ts
{{lines:apps/web/src/app/core/data.service.ts:148:170}}
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
