PART B2 of the Workshop OS (a garage system). Server: Next 15 route handlers in plain JavaScript ES modules. Web: Angular 20 TypeScript. Audit finding E04.

THE FAULT. A job moves through PHASES (body, paint, ready...). The rule of the garage is that a phase closes only with a photo. Today that rule lives only in the browser: the web app builds the new phases array and the new status and PATCHes them, and the server stores whatever a staff seat sends. So any staff seat can mark phases done without a photo, skip phases or set the job ready. The fix: closing a phase becomes a SERVER COMMAND, and the generic PATCH refuses `phases` and `status`.

TYPES (field by field).
- Phase: `{ key: string, label: string, hours: number, status: 'done' | 'now' | 'next', startedAt?: string, doneAt?: string, photoId?: string, by?: string, note?: string }`
- Pickup: `{ wanted: boolean, address?: string, status: 'booked' | 'collected' | 'returned' | 'none', driver?: string, eta?: string }`
- Job (the fields that matter): `{ id: string, status: 'open' | 'ready' | 'delivered', phases: Phase[], pickup: Pickup, customerPhone: string, branch: string, estimate?: number, approved?: number, paid?: number, updatedAt: string }`
- Photo row: `{ id: string, jobId: string, phaseKey: string, dataUrl: string, by: string, createdAt: string, updatedAt: string }`
- Session seat `s`: `{ kind: 'customer' | 'staff', name: string, phone?: string, role?: 'owner' | 'staff', branch?: string }`
- Store (all async): `store.get(slug, kind, id)` returns the row or null; `store.update(slug, kind, id, patch)` merges and returns the row; `store.create(slug, kind, data)` returns the new row; `store.audit(slug, seatName, action, kind, id)`.
- From apps/api/lib/store.js: `validKind(kind)` true for 'jobs', 'customers', 'activities', 'photos', 'enquiries', 'quotes'; `project(slug, kind, s, row)` async, returns the row as that seat may see it (it strips the money fields for staff) or null.
- From apps/api/lib/auth.js: `session(req, slug)` returns the seat or null; `deny(msg = 'Sign in first', status = 401)` returns a JSON Response `{ error: msg }`.

THE ENGINE TODAY (apps/web/src/app/core/data.service.ts, inside class DataService). The server command must produce EXACTLY the same phases, status and pickup as this:
```ts
  /* THE RULE: the phase closes only with a photo. The next phase starts the moment this one ends. */
  async completePhase(jobId: string, photoDataUrl: string, note?: string) {
    const j = this.job(jobId); if (!j) throw new Error('no job');
    const i = j.phases.findIndex(p => p.status === 'now'); if (i < 0) throw new Error('nothing running');
    if (!photoDataUrl || !photoDataUrl.startsWith('data:image/')) throw new Error('A phase closes only with a photo');
    const by = this.session.name();
    const photo = await this.adapter.create<Photo>('photos', { jobId, phaseKey: j.phases[i].key, dataUrl: photoDataUrl, by });
    this.photos.update(x => [photo, ...x]);
    const phases = j.phases.map((p, k) => k === i ? { ...p, status: 'done' as const, doneAt: now(), photoId: photo.id, by, note } : k === i + 1 ? { ...p, status: 'now' as const, startedAt: now() } : p);
    const last = i === j.phases.length - 1;
    const patch: Partial<Job> = { phases, status: last ? 'ready' : j.status };
    /* the last phase is Ready: closing it means the car is ready, the timeline shows it, and the pickup booking wakes up */
    if (last && j.pickup.wanted && j.pickup.status === 'collected') patch.pickup = { ...j.pickup, status: 'booked' };
    const r = await this.patchJob(jobId, patch);
    await this.log(jobId, 'phase', `${j.phases[i].label} done${note ? ': ' + note : ''}`);
    return r;
  }
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
import { store, validKind, scope, customerJobIds, project } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
import { customerAnswer } from '../../../../../lib/answer.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table, id } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, id, s };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const r = await store.get(g.slug, g.table, g.id); if (!r) return deny('Not found', 404); const [out] = scope([r], g.table, g.s, await customerJobIds(g.slug, g.s)); return out ? Response.json(out) : deny('Not found', 404); }
/* a customer may send exactly one thing on their own job: the answer to one pending approval ({ approvalId, status })
   or a rating ({ rating }) once it is delivered. The server builds the change from the stored job (lib/answer.js) and
   takes no number from the customer. The same answer twice is a no-op. */
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const a = customerAnswer(cur, body, g.s, new Date().toISOString());
    if (a.error) return Response.json({ error: a.error }, { status: a.status });
    const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch) : cur;
    if (a.patch) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
    if (a.activity) await store.create(g.slug, 'activities', { jobId: g.id, type: a.activity.type, summary: a.activity.summary, by: 'Customer' });
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if (g.table === 'quotes' && g.s.role !== 'owner') { return deny('Owner only', 403); }
  else if (g.table === 'jobs' && g.s.role !== 'owner') { delete body.estimate; delete body.approved; delete body.paid; }
  const row = await store.update(g.slug, g.table, g.id, body);
  await store.audit(g.slug, g.s.name || g.s.phone, 'update', g.table, g.id);
  /* the answer goes through the same projection as a read: a staff seat or a customer never gets the money back */
  const out = await project(g.slug, g.table, g.s, row); return Response.json(out || { id: g.id });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; if (g.s.role !== 'owner') return deny('Owner only', 403); await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.s.name, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
```

CURRENT LINES of class ApiAdapter in data.service.ts (the web adapter that talks to the server; `write` sends the request, queues it in the outbox when it cannot reach the server and then returns `fallback`):
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
    for (const w of q) { try { await this.go(w.path, { method: w.method, body: w.body }); } catch (e: any) { if (e.message === '401') return; left.push(w); } }
    this.setOutbox(left); }
  private async write<T>(path: string, method: string, body?: any, fallback?: T): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined }); this.flush(); return r; }
    catch (e: any) { if (e.message === '401') throw e; this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined }]); return fallback as T; }
  }
  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}
```
Other facts about DataService: `this.mode()` is 'local' (the demo, everything in the browser) or 'api'. `this.adapter` is typed `Adapter` (list, create, update, remove only). `this.jobs` and `this.activities` are signals (`this.jobs()` reads, `this.jobs.update(fn)` replaces). `this.session.name()` is the seat's name. `uid()` and `now()` are module level helpers already in the file. Activity type: `{ id, jobId, type: 'phase' | ..., summary, by, createdAt, updatedAt }`.

WHAT TO WRITE. Return ONE ```js code block holding five parts, each opened by its header line exactly as shown, in this order.

Part 1 header line: `// FILE: apps/api/lib/commands.js`
A new file exporting `closePhase(job, photo, body, s, nowIso)`. Pure: it never changes `job`, `photo` or `body`, it never reads the clock (use `nowIso`). It returns either `{ status, error }` (a refusal with a plain English message) or `{ patch, activity }`. Rules in this order:
1. `s` missing or `s.kind !== 'staff'`: `{ status: 403, error: 'Staff only' }`.
2. `body` not a plain object (null, array, string): 400. `body.phaseKey` not a non empty string: 400. `body.note` present and not a string, or longer than 2000 characters: 400.
3. `job.status !== 'open'`: 409 'Only a car still being worked on can close a phase'.
4. `i` = index of the phase with status 'now'. None: 409 'No phase is running on this job'. `job.phases[i].key !== body.phaseKey`: 409 'Only the phase running now can be closed'.
5. `photo` null or undefined: 400 'A phase closes only with a photo'. `photo.jobId !== job.id`: 400 'That photo belongs to another job'. `photo.phaseKey !== body.phaseKey`: 400 'That photo is for another phase'. Some phase already has `photoId === photo.id`: 409 'That photo already closed a phase'.
6. Otherwise build, exactly as the engine does: phases = `job.phases.map((p, k) => k === i ? { ...p, status: 'done', doneAt: nowIso, photoId: photo.id, by: s.name, note } : k === i + 1 ? { ...p, status: 'now', startedAt: nowIso } : p)` where `note` is `body.note` (leave the key out when there is no note). `last = i === job.phases.length - 1`. patch = `{ phases, status: last ? 'ready' : job.status }`. When `last && job.pickup && job.pickup.wanted && job.pickup.status === 'collected'`, also `patch.pickup = { ...job.pickup, status: 'booked' }`.
7. activity = `{ jobId: job.id, type: 'phase', summary: label + ' done' + (note ? ': ' + note : ''), by: s.name }` with `label = job.phases[i].label`.

Part 2 header line: `// FILE: apps/api/app/api/[slug]/[table]/[id]/close-phase/route.js`
A new route file. Imports from '../../../../../../lib/store.js' (`store, validKind, project`), '../../../../../../lib/auth.js' (`session, deny`) and '../../../../../../lib/commands.js' (`closePhase`). `export const dynamic = 'force-dynamic';`. `export async function POST(req, { params })`: `const { slug, table, id } = await params;` table not 'jobs': 404 `{ error: 'Unknown command' }`. No session: `deny()`. Body: `await req.json().catch(() => null)`. `cur = await store.get(slug, 'jobs', id)`; none: `deny('Not found', 404)`. `photo = body && typeof body === 'object' && typeof body.photoId === 'string' ? await store.get(slug, 'photos', body.photoId) : null`. `r = closePhase(cur, photo, body, s, new Date().toISOString())`; a refusal answers `Response.json({ error: r.error }, { status: r.status })`. Otherwise `row = await store.update(slug, 'jobs', id, r.patch)`, then `await store.create(slug, 'activities', r.activity)`, then `await store.audit(slug, s.name, 'close-phase', 'jobs', id)`, then answer `Response.json((await project(slug, 'jobs', s, row)) || { id })` with status 200. Also `export async function OPTIONS(){ return new Response(null, { status: 204 }); }`.

Part 3 header line: `// FILE: apps/api/app/api/[slug]/[table]/[id]/route.js`
The whole file, unchanged except in PATCH for a staff seat on the jobs table (owner included), BEFORE the money fields are stripped and before any write:
- `'phases' in body`: answer 403 `{ error: 'A phase closes only through close-phase, with its photo' }`.
- `'status' in body`: allowed ONLY when `body.status === 'delivered' && cur.status === 'ready'` (the handover). Anything else answers 403 `{ error: 'The job status moves only through its phases and the handover' }`.
Keep the customer branch, the quotes rule, the money strip, the audit, the projection and every other handler exactly as they are.

Part 4 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=  update<T>(t: Table, id: string, patch | until=  async remove(t: Table, id: string)`
TypeScript, two lines inside class ApiAdapter: the `update` line exactly as it is now, then a new method `command<T>(t: Table, id: string, name: string, body: any) { return this.write<T | null>(\`${t}/${id}/${name}\`, 'POST', body, null); }`.

Part 5 header line: `// BLOCK: apps/web/src/app/core/data.service.ts | start=/* THE RULE: the phase closes only with a photo | until=async setPromise(`
TypeScript: the comment line and the whole new `completePhase(jobId: string, photoDataUrl: string, note?: string)` method, indented two spaces. Keep the first three guard lines and the photo create exactly as now. Then:
- When `this.mode() === 'api'`: `const r = await (this.adapter as ApiAdapter).command<Job>('jobs', jobId, 'close-phase', note ? { phaseKey: j.phases[i].key, photoId: photo.id, note } : { phaseKey: j.phases[i].key, photoId: photo.id });`. Compute the same `phases` and `patch` the engine computes (as a fallback for the page while the command waits in the outbox). `const next = r || { ...j, ...patch, updatedAt: now() };` replace the job in `this.jobs`. Add to the page's own list (do NOT POST it, the server wrote it): `this.activities.update(x => [{ id: uid(), jobId, type: 'phase', summary: \`${j.phases[i].label} done${note ? ': ' + note : ''}\`, by, createdAt: now(), updatedAt: now() } as Activity, ...x]);` and return `next`. Never call `this.patchJob` or `this.log` in this branch.
- Otherwise (local demo) keep the original code exactly: patchJob, log, return r.

TRAPS.
- The command must refuse a second close of the same phase: after the first close that phase is no longer 'now', rule 4 refuses it.
- `by` always comes from the session, never from the body. Ignore any other body keys.
- Do not take `status` from the body in the command; the status comes only from rule 6.
- The new route sits one folder deeper than [id]/route.js, so its imports climb six folders: '../../../../../../lib/...'.
- Header lines first in each part exactly as written.
