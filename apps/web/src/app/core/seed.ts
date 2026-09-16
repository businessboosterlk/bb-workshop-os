import { Cast, Job, Customer, Phase, Activity } from './models';

/* The demo floor. Real-sounding Colombo names and plates, LKR values, both branches
   carrying cars, one job overrun, one waiting on the customer, one delivered. Seeded
   once into an empty local store and never into a server. The demo customer number is
   0771234567 and it holds two cars, so the app has a garage record to show. */
const H = 3600000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
export function phasesFor(cast: Cast, service: string, insurance: boolean): Phase[] {
  const s = cast.services.find(x => x.key === service); if (!s) return [];
  const list = s.phases.filter(p => !p.insuranceOnly || insurance).map(p => ({ key: p.key, label: p.label, hours: p.hours, status: 'next' as const }));
  return list;
}
/* walk a fresh phase list forward n steps, stamping times as a real job would have */
function advance(ph: Phase[], n: number, startedAgoH: number, nowAgoH: number, by: string, photo: (i: number) => string | undefined): Phase[] {
  let t = startedAgoH * H;
  return ph.map((p, i) => {
    if (i < n) { const started = iso(t); t -= p.hours * H * 0.9; return { ...p, status: 'done', startedAt: started, doneAt: iso(Math.max(t, nowAgoH * H)), by, photoId: photo(i) }; }
    if (i === n) return { ...p, status: 'now', startedAt: iso(nowAgoH * H) };
    return p;
  });
}
export function seed(cast: Cast): { jobs: Job[]; customers: Customer[]; activities: Activity[] } {
  const now = iso(0);
  const cust = (id: string, name: string, phone: string, vehicles: Customer['vehicles']): Customer => ({ id, name, phone, vehicles, createdAt: iso(90 * 24 * H), updatedAt: now });
  const customers: Customer[] = [
    cust('c1', 'Dilshan Perera', '0771234567', [{ plate: 'CAB-4471', make: 'Toyota', model: 'Aqua', colour: 'Pearl white' }, { plate: 'KY-2210', make: 'Suzuki', model: 'Wagon R', colour: 'Silver' }]),
    cust('c2', 'Nadeesha Fernando', '0712345678', [{ plate: 'CAY-8823', make: 'Honda', model: 'Vezel', colour: 'Black' }]),
    cust('c3', 'Ruwan Jayasinghe', '0765554433', [{ plate: 'WP KL-3390', make: 'Nissan', model: 'Leaf', colour: 'Red' }]),
    cust('c4', 'Fathima Rizwan', '0778899001', [{ plate: 'CAT-1019', make: 'Toyota', model: 'Premio', colour: 'Dark grey' }]),
    cust('c5', 'Chamara Silva', '0723344556', [{ plate: 'BJK-6708', make: 'Kia', model: 'Sorento', colour: 'White' }]),
    cust('c6', 'Ishara Wickramasinghe', '0759988776', [{ plate: 'CBA-2261', make: 'Honda', model: 'Fit', colour: 'Blue' }])
  ];
  const job = (id: string, c: Customer, v: number, branch: string, service: string, insurance: boolean, step: number, startedAgoH: number, nowAgoH: number, promisedInH: number, extra: Partial<Job> = {}): Job => {
    const veh = c.vehicles[v];
    const ph = advance(phasesFor(cast, service, insurance), step, startedAgoH, nowAgoH, 'Nuwan', () => undefined);
    const status: Job['status'] = extra.status || (ph[ph.length - 1]?.status === 'now' ? 'ready' : 'open');
    return { id, plate: veh.plate, make: veh.make, model: veh.model, colour: veh.colour, customerId: c.id, customerName: c.name, customerPhone: c.phone,
      branch, service, insurance, phases: ph, promisedAt: iso(-promisedInH * H), promiseHistory: [], pickup: { wanted: false, status: 'none' }, approvals: [],
      status, createdAt: iso(startedAgoH * H), updatedAt: now, ...extra };
  };
  const jobs: Job[] = [
    /* the demo customer's Aqua: accident repair through insurance, mid paint, one approval waiting */
    job('j1', customers[0], 0, 'bora', 'accident', true, 6, 9 * 24, 20, 3 * 24, { insurer: 'Ceylinco', estimate: 185000, approved: 185000, paid: 0,
      approvals: [{ id: 'a1', title: 'Replace the front left headlamp', detail: 'The lamp housing is cracked inside. A new unit fits the colour match better than a repair.', amount: 24500, status: 'pending', askedAt: iso(5 * H) }],
      promiseHistory: [{ at: iso(2 * 24 * H), was: iso(-1 * 24 * H), now: iso(-3 * 24 * H), reason: 'The insurer took two extra days to approve the estimate', by: 'Miflal' }],
      pickup: { wanted: true, address: 'Nugegoda', status: 'collected', driver: 'Sampath' } }),
    /* the demo customer's Wagon R: cut and polish delivered last month */
    job('j2', customers[0], 1, 'dehi', 'cutpolish', false, 7, 40 * 24, 38 * 24, -38 * 24, { status: 'delivered', deliveredAt: iso(38 * 24 * H), handoverBy: 'Kasun', rating: 5, estimate: 18000, approved: 18000, paid: 18000 }),
    /* Vezel: painting, overrun on paint preparation */
    job('j3', customers[1], 0, 'bora', 'painting', false, 2, 6 * 24, 70, -1 * 24, { estimate: 145000, approved: 145000, paid: 50000 }),
    /* Leaf: alloy wheels, on time */
    job('j4', customers[2], 0, 'dehi', 'alloy', false, 3, 3 * 24, 6, 2 * 24, { estimate: 32000, approved: 32000, paid: 0 }),
    /* Premio: accident, no insurance, waiting on parts */
    job('j5', customers[3], 0, 'dehi', 'accident', false, 2, 4 * 24, 30, 6 * 24, { estimate: 96000, approved: 96000, paid: 30000, pickup: { wanted: true, address: 'Mount Lavinia', status: 'collected', driver: 'Sampath' } }),
    /* Sorento: paint correction, ready for pickup */
    job('j6', customers[4], 0, 'bora', 'correction', false, 6, 5 * 24, 2, 0, { estimate: 45000, approved: 45000, paid: 45000, pickup: { wanted: true, address: 'Kohuwala', status: 'booked', driver: 'Sampath', eta: 'Today 4 pm' } }),
    /* Fit: received this morning */
    job('j7', customers[5], 0, 'dehi', 'cutpolish', false, 0, 3, 3, 10, { estimate: 15000, approved: 0, paid: 0 })
  ];
  const activities: Activity[] = [];
  let k = 0;
  for (const j of jobs) {
    activities.push({ id: 'act' + (k++), jobId: j.id, type: 'new', summary: `Car received: ${j.plate}, ${j.make} ${j.model}`, by: 'Nuwan', createdAt: j.createdAt, updatedAt: j.createdAt });
    for (const p of j.phases) if (p.status === 'done' && p.doneAt) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'phase', summary: `${p.label} done`, by: p.by || 'Nuwan', createdAt: p.doneAt, updatedAt: p.doneAt });
    for (const h of j.promiseHistory) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'promise', summary: `Promised date moved: ${h.reason}`, by: h.by, createdAt: h.at, updatedAt: h.at });
    for (const a of j.approvals) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'approval', summary: `Asked the customer: ${a.title}`, by: 'Nuwan', createdAt: a.askedAt, updatedAt: a.askedAt });
    if (j.status === 'delivered' && j.deliveredAt) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'delivered', summary: `Delivered to ${j.customerName}`, by: j.handoverBy || 'Kasun', createdAt: j.deliveredAt, updatedAt: j.deliveredAt });
  }
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { jobs, customers, activities };
}
