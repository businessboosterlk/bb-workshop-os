import { Injectable, signal, computed, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { Job, Customer, Activity, Photo, Table, Phase, Approval, Vehicle } from './models';
import { seed, phasesFor } from './seed';

/* The data layer. One interface, two adapters, chosen by the cast:
     local  keeps everything in this browser (the demo)
     api    talks to the Node backend in apps/api, which owns the database
   Every method returns a promise so the pages never know which one they got.
   THE RULES LIVE HERE, not in the pages: a phase cannot close without a photo, an
   overrun is computed from the phase's own standard hours, a customer only ever gets
   the jobs on their own number, and staff never receive the money fields. */
interface Adapter {
  list<T>(t: Table): Promise<T[]>;
  create<T>(t: Table, row: Partial<T>): Promise<T>;
  update<T>(t: Table, id: string, patch: Partial<T>): Promise<T | null>;
  remove(t: Table, id: string): Promise<void>;
}
const now = () => new Date().toISOString();
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const H = 3600000;

class LocalAdapter implements Adapter {
  constructor(private key: string) {}
  private read(): Record<string, any[]> { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } }
  private write(d: Record<string, any[]>) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch {} }
  isEmpty(){ return !Object.keys(this.read()).length; }
  fill(d: Record<string, any[]>){ this.write(d); }
  async list<T>(t: Table) { return (this.read()[t] || []) as T[]; }
  async create<T>(t: Table, row: Partial<T>) { const d = this.read(); const r = { ...row, id: (row as any).id || uid(), createdAt: now(), updatedAt: now() } as T; d[t] = [r, ...(d[t] || [])]; this.write(d); return r; }
  async update<T>(t: Table, id: string, patch: Partial<T>) { const d = this.read(); const rows = d[t] || []; const i = rows.findIndex(r => r.id === id); if (i < 0) return null; rows[i] = { ...rows[i], ...patch, id, updatedAt: now() }; d[t] = rows; this.write(d); return rows[i] as T; }
  async remove(t: Table, id: string) { const d = this.read(); d[t] = (d[t] || []).filter(r => r.id !== id); this.write(d); }
}
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

@Injectable({ providedIn: 'root' })
export class DataService {
  private castSvc = inject(CastService); private session = inject(SessionService);
  private adapter!: Adapter;
  readonly pending = signal(0);
  readonly authLost = signal(false);
  readonly ready = signal(false);
  readonly mode = signal<'local' | 'api'>('local');
  readonly jobs = signal<Job[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly photos = signal<Photo[]>([]);
  readonly toastMsg = signal<{ text: string; href?: string; label?: string } | null>(null);
  private toastT: any;

  /* the customer's window: only jobs on the signed-in number, newest first */
  readonly myJobs = computed(() => { const p = this.session.phone(); return p ? this.jobs().filter(j => j.customerPhone === p).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []; });
  readonly myOpen = computed(() => this.myJobs().filter(j => j.status !== 'delivered'));
  readonly myPast = computed(() => this.myJobs().filter(j => j.status === 'delivered'));
  readonly open = computed(() => this.jobs().filter(j => j.status !== 'delivered'));
  readonly readyJobs = computed(() => this.open().filter(j => j.status === 'ready'));
  readonly overdue = computed(() => this.open().filter(j => this.overrun(j) || (j.status === 'open' && new Date(j.promisedAt).getTime() < Date.now())));
  readonly awaiting = computed(() => this.open().filter(j => j.approvals.some(a => a.status === 'pending')));
  readonly deliveredThisMonth = computed(() => { const m = now().slice(0, 7); return this.jobs().filter(j => j.status === 'delivered' && (j.deliveredAt || '').slice(0, 7) === m); });

  async init() {
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    this.mode.set(api ? 'api' : 'local');
    if (api) {
      const a = new ApiAdapter(api, c.slug, () => this.session.token());
      a.onAuthLost = () => this.authLost.set(true); a.onOffline = n => this.pending.set(n); this.adapter = a;
      addEventListener('online', () => a.flush().then(() => this.reload()));
    } else {
      const a = new LocalAdapter('wos_' + c.slug);
      if (a.isEmpty()) { const s = seed(c); a.fill({ jobs: s.jobs, customers: s.customers, activities: s.activities, photos: [] }); }
      this.adapter = a;
    }
    try { await this.reload(); } catch {}
    this.ready.set(true);
  }
  async reload() {
    const [j, c, a, p] = await Promise.all([this.adapter.list<Job>('jobs'), this.adapter.list<Customer>('customers'), this.adapter.list<Activity>('activities'), this.adapter.list<Photo>('photos')]);
    this.jobs.set(j); this.customers.set(c); this.activities.set(a); this.photos.set(p);
  }
  job(id: string) { return this.jobs().find(j => j.id === id) || null; }
  /* a customer may open only their own car; staff any car */
  canSee(j: Job | null) { if (!j) return false; return this.session.kind() === 'staff' || j.customerPhone === this.session.phone(); }
  phaseNow(j: Job): Phase | null { return j.phases.find(p => p.status === 'now') || null; }
  doneCount(j: Job) { return j.phases.filter(p => p.status === 'done').length; }
  progress(j: Job) { return j.status === 'delivered' ? 1 : this.doneCount(j) / j.phases.length; }
  /* an overrun is the current phase running past its own standard hours */
  overrun(j: Job): number { const p = this.phaseNow(j); if (!p || !p.startedAt || !p.hours || j.status !== 'open') return 0; const over = (Date.now() - new Date(p.startedAt).getTime()) / H - p.hours; return over > 0 ? Math.round(over) : 0; }
  photoFor(id?: string) { return id ? this.photos().find(p => p.id === id) || null : null; }
  photosOf(jobId: string) { return this.photos().filter(p => p.jobId === jobId); }
  activityFor(jobId: string) { return this.activities().filter(a => a.jobId === jobId); }

  /* new car in */
  async newJob(input: { plate: string; make: string; model: string; colour?: string; customerName: string; customerPhone: string; branch: string; service: string; insurance: boolean; insurer?: string; pickup: boolean; address?: string; promisedAt: string; estimate?: number; notes?: string }) {
    const cast = this.castSvc.cast()!; const by = this.session.name();
    let cust = this.customers().find(c => c.phone === input.customerPhone);
    const veh: Vehicle = { plate: input.plate.toUpperCase().trim(), make: input.make.trim(), model: input.model.trim(), colour: input.colour?.trim() };
    if (!cust) { cust = await this.adapter.create<Customer>('customers', { name: input.customerName.trim(), phone: input.customerPhone, vehicles: [veh] }); this.customers.update(x => [cust!, ...x]); }
    else if (!cust.vehicles.some(v => v.plate === veh.plate)) { const r = await this.adapter.update<Customer>('customers', cust.id, { vehicles: [...cust.vehicles, veh] }); if (r) { cust = r; this.customers.update(x => x.map(c => c.id === r.id ? r : c)); } }
    const phases = phasesFor(cast, input.service, input.insurance);
    if (!phases.length) throw new Error('unknown service');
    phases[0] = { ...phases[0], status: 'now', startedAt: now() };
    const j = await this.adapter.create<Job>('jobs', { ...veh, customerId: cust.id, customerName: cust.name, customerPhone: cust.phone, branch: input.branch, service: input.service, insurance: input.insurance, insurer: input.insurer,
      phases, promisedAt: input.promisedAt, promiseHistory: [], pickup: input.pickup ? { wanted: true, address: input.address, status: 'booked' } : { wanted: false, status: 'none' }, approvals: [],
      estimate: input.estimate || 0, approved: 0, paid: 0, status: 'open', notes: input.notes });
    this.jobs.update(x => [j, ...x]);
    await this.log(j.id, 'new', `Car received: ${j.plate}, ${j.make} ${j.model}`);
    return j;
  }
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
  async setPromise(jobId: string, promisedAt: string, reason: string) {
    const j = this.job(jobId); if (!j) return null;
    if (!reason.trim()) throw new Error('A moved date needs a reason the customer will read');
    const r = await this.patchJob(jobId, { promisedAt, promiseHistory: [...j.promiseHistory, { at: now(), was: j.promisedAt, now: promisedAt, reason: reason.trim(), by: this.session.name() }] });
    await this.log(jobId, 'promise', `Promised date moved: ${reason.trim()}`); return r;
  }
  async askApproval(jobId: string, title: string, detail: string, amount?: number) {
    const j = this.job(jobId); if (!j) return null;
    const a: Approval = { id: uid(), title: title.trim(), detail: detail.trim(), amount, status: 'pending', askedAt: now() };
    const r = await this.patchJob(jobId, { approvals: [...j.approvals, a] });
    await this.log(jobId, 'approval', `Asked the customer: ${a.title}`); return r;
  }
  /* the customer answers from their phone; the answer is logged with the time, and approved money is added to the job */
  async answerApproval(jobId: string, approvalId: string, yes: boolean) {
    const j = this.job(jobId); if (!j || !this.canSee(j)) return null;
    const a = j.approvals.find(x => x.id === approvalId); if (!a || a.status !== 'pending') return null;
    const approvals = j.approvals.map(x => x.id === approvalId ? { ...x, status: yes ? 'approved' as const : 'declined' as const, answeredAt: now() } : x);
    const r = await this.patchJob(jobId, { approvals, approved: yes && a.amount ? (j.approved || 0) + a.amount : j.approved });
    await this.log(jobId, 'approval', `${yes ? 'Approved' : 'Declined'}: ${a.title}`, 'Customer'); return r;
  }
  async setPickup(jobId: string, pickup: Job['pickup']) { const r = await this.patchJob(jobId, { pickup }); await this.log(jobId, 'pickup', `Pickup and drop: ${pickup.status}${pickup.eta ? ', ' + pickup.eta : ''}`); return r; }
  async deliver(jobId: string) {
    const j = this.job(jobId); if (!j || j.status !== 'ready') throw new Error('Only a ready car can be delivered');
    const r = await this.patchJob(jobId, { status: 'delivered', deliveredAt: now(), handoverBy: this.session.name(), pickup: j.pickup.wanted ? { ...j.pickup, status: 'returned' } : j.pickup });
    await this.log(jobId, 'delivered', `Delivered to ${j.customerName}`); return r;
  }
  async rate(jobId: string, rating: number) { const j = this.job(jobId); if (!j || !this.canSee(j)) return null; return this.patchJob(jobId, { rating }); }
  async setMoney(jobId: string, patch: { estimate?: number; approved?: number; paid?: number }) { if (!this.session.owner()) throw new Error('Owner only'); return this.patchJob(jobId, patch); }
  async addNote(jobId: string, text: string) { await this.log(jobId, 'note', text.trim()); }
  private async patchJob(id: string, patch: Partial<Job>) {
    const r = (await this.adapter.update<Job>('jobs', id, patch)) || (() => { const cur = this.jobs().find(x => x.id === id); return cur ? { ...cur, ...patch, updatedAt: now() } : null; })();
    if (r) this.jobs.update(x => x.map(j => j.id === id ? r : j)); return r;
  }
  private async log(jobId: string, type: Activity['type'], summary: string, by?: string) {
    const r = await this.adapter.create<Activity>('activities', { jobId, type, summary, by: by || this.session.name() || 'Customer' });
    this.activities.update(x => [r, ...x]); return r;
  }
  toast(text: string, href?: string, label?: string) { this.toastMsg.set({ text, href, label }); clearTimeout(this.toastT); this.toastT = setTimeout(() => this.toastMsg.set(null), 3200); }
  /* the harness needs a way to wipe THIS workshop's demo rows and nothing else */
  async wipe() { for (const t of ['jobs', 'customers', 'activities', 'photos'] as Table[]) for (const r of await this.adapter.list<any>(t)) await this.adapter.remove(t, r.id); await this.reload(); }
  async reseed() { const c = this.castSvc.cast(); if (!c || this.mode() !== 'local') return; localStorage.removeItem('wos_' + c.slug); await this.init(); }
}
export function niceDate(iso?: string) {
  if (!iso) return ''; const d = new Date(iso); if (isNaN(+d)) return '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${M[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
export function niceWhen(iso?: string) {
  if (!iso) return ''; const d = new Date(iso); const days = Math.round((startOfDay(Date.now()) - startOfDay(+d)) / 86400000);
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today ${t}`; if (days === 1) return `Yesterday ${t}`; if (days === -1) return `Tomorrow`; return niceDate(iso);
}
function startOfDay(ms: number){ const d = new Date(ms); d.setHours(0, 0, 0, 0); return +d; }
export function hoursLeft(iso: string) { return Math.round((new Date(iso).getTime() - Date.now()) / H); }
export function waLink(phone?: string, text = '') { let d = String(phone || '').replace(/\D/g, ''); if (!d) return ''; if (d.length === 9 && d[0] !== '0') d = '94' + d; else if (d[0] === '0') d = '94' + d.slice(1); return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; }
