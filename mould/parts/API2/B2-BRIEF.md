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
{{lines:apps/web/src/app/core/data.service.ts:158:174}}
```

CURRENT FILE apps/api/app/api/[slug]/[table]/[id]/route.js:
```js
{{file:apps/api/app/api/[slug]/[table]/[id]/route.js}}
```

CURRENT LINES of class ApiAdapter in data.service.ts (the web adapter that talks to the server; `write` sends the request, queues it in the outbox when it cannot reach the server and then returns `fallback`):
```ts
{{lines:apps/web/src/app/core/data.service.ts:40:66}}
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
