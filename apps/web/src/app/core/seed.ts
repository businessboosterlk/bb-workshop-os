import { Cast, Job, Customer, Phase, Activity, Enquiry, Quote, FollowUp } from './models';

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
/* follow-ups hang off the delivery date, from the cast's own cadence */
export function followupsFor(cast: Cast, deliveredAt: string): FollowUp[] {
  const t = new Date(deliveredAt).getTime();
  return (cast.followups || []).map(f => ({ key: f.key, label: f.label, due: new Date(t + f.days * 24 * H).toISOString() }));
}
/* 3: the v2 floor could be seeded from a seat's stale settings and carry no follow-ups */
export const SEED_VERSION = 3;
export function seed(cast: Cast): { jobs: Job[]; customers: Customer[]; activities: Activity[]; enquiries: Enquiry[]; quotes: Quote[] } {
  const now = iso(0);
  const cust = (id: string, name: string, phone: string, vehicles: Customer['vehicles']): Customer => ({ id, name, phone, vehicles, createdAt: iso(90 * 24 * H), updatedAt: now });
  const customers: Customer[] = [
    cust('c1', 'Dilshan Perera', '0771234567', [{ plate: 'CAB-4471', make: 'Toyota', model: 'Aqua', colour: 'Pearl white' }, { plate: 'KY-2210', make: 'Suzuki', model: 'Wagon R', colour: 'Silver' }]),
    cust('c2', 'Nadeesha Fernando', '0712345678', [{ plate: 'CAY-8823', make: 'Honda', model: 'Vezel', colour: 'Black' }]),
    cust('c3', 'Ruwan Jayasinghe', '0765554433', [{ plate: 'WP KL-3390', make: 'Nissan', model: 'Leaf', colour: 'Red' }]),
    cust('c4', 'Fathima Rizwan', '0778899001', [{ plate: 'CAT-1019', make: 'Toyota', model: 'Premio', colour: 'Dark grey' }]),
    cust('c5', 'Chamara Silva', '0723344556', [{ plate: 'BJK-6708', make: 'Kia', model: 'Sorento', colour: 'White' }]),
    cust('c6', 'Ishara Wickramasinghe', '0759988776', [{ plate: 'CBA-2261', make: 'Honda', model: 'Fit', colour: 'Blue' }]),
    cust('c7', 'Sanjeewa Bandara', '0717788990', [{ plate: 'CAD-5532', make: 'Honda', model: 'Civic', colour: 'Silver' }]),
    cust('c8', 'Amaya Gunawardena', '0764433221', [{ plate: 'KX-9087', make: 'Toyota', model: 'Vitz', colour: 'White' }]),
    cust('c9', 'Rizan Hameed', '0725566443', [{ plate: 'CAA-7710', make: 'Mitsubishi', model: 'Outlander', colour: 'Grey' }])
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
    job('j7', customers[5], 0, 'dehi', 'cutpolish', false, 0, 3, 3, 10, { estimate: 15000, approved: 0, paid: 0 }),
    /* delivered cars, so the follow-up list has something due, something coming and something done */
    job('j8', customers[6], 0, 'bora', 'painting', false, 7, 36 * 24, 31 * 24, -31 * 24, { status: 'delivered', deliveredAt: iso(31 * 24 * H), handoverBy: 'Nuwan', rating: 5, estimate: 88000, approved: 88000, paid: 88000 }),
    job('j9', customers[7], 0, 'dehi', 'alloy', false, 7, 7 * 24, 4 * 24, -4 * 24, { status: 'delivered', deliveredAt: iso(4 * 24 * H), handoverBy: 'Kasun', estimate: 26000, approved: 26000, paid: 26000 }),
    job('j10', customers[8], 0, 'bora', 'cutpolish', false, 7, 93 * 24, 92 * 24, -92 * 24, { status: 'delivered', deliveredAt: iso(92 * 24 * H), handoverBy: 'Nuwan', rating: 4, estimate: 22000, approved: 22000, paid: 22000 })
  ];
  for (const j of jobs) if (j.status === 'delivered' && j.deliveredAt) {
    j.followups = followupsFor(cast, j.deliveredAt).map(f => new Date(f.due).getTime() < Date.now() - 2 * 24 * H && (f.key === 'd3' || (j.id === 'j10' && f.key === 'd30'))
      ? { ...f, doneAt: new Date(new Date(f.due).getTime() + 3 * H).toISOString(), outcome: 'good' as const, by: j.handoverBy, note: 'All good, happy with the finish' } : f);
  }
  /* one 30-day check already done on the Civic, so Done has a real row */
  const civic = jobs.find(j => j.id === 'j8')!; civic.followups = civic.followups!.map(f => f.key === 'd30' ? { ...f, doneAt: iso(12 * H), outcome: 'good' as const, by: 'Miflal', note: 'Paint still perfect, will send a friend' } : f);
  jobs.find(j => j.id === 'j3')!.enquiryId = 'e5'; jobs.find(j => j.id === 'j3')!.quoteId = 'q1';
  const enq = (id: string, name: string, phone: string, car: [string, string, string], service: string, branch: string, source: string, note: string, status: Enquiry['status'], agoH: number, extra: Partial<Enquiry> = {}): Enquiry =>
    ({ id, name, phone, plate: car[0], make: car[1], model: car[2], service, branch, source, note, status, by: 'Nuwan', createdAt: iso(agoH * H), updatedAt: iso(agoH * H), ...extra });
  const enquiries: Enquiry[] = [
    enq('e1', 'Kavinda Rathnayake', '0714455667', ['CAF-2290', 'Toyota', 'Axio'], 'accident', 'bora', 'WhatsApp', 'Rear bumper and boot lid after a knock in traffic. Asking if insurance will cover it.', 'new', 2),
    enq('e3', 'Mohamed Arshad', '0775566778', ['KW-4412', 'Nissan', 'X-Trail'], 'cutpolish', 'bora', 'Walk-in', 'Selling the car next month and wants it looking its best.', 'new', 26),
    enq('e2', 'Shalini Perera', '0768899112', ['CAE-6671', 'Suzuki', 'Swift'], 'painting', 'dehi', 'Instagram', 'Full respray, keeping the same red. Saw the Vezel video.', 'quoted', 50, { quoteId: 'q2' }),
    enq('e5', 'Nadeesha Fernando', '0712345678', ['CAY-8823', 'Honda', 'Vezel'], 'painting', 'bora', 'Instagram', 'Faded roof and bonnet, wants a full respray in black.', 'booked', 7 * 24, { quoteId: 'q1', jobId: 'j3' }),
    enq('e4', 'Tharindu Senanayake', '0712233445', ['CAB-9031', 'Honda', 'Grace'], 'alloy', 'dehi', 'Google', 'Four alloys scuffed on the kerb.', 'lost', 9 * 24, { quoteId: 'q3', lostReason: 'Declined the quote' })
  ];
  const q = (id: string, number: string, e: Enquiry, lines: Quote['lines'], discount: number, status: Quote['status'], agoH: number, extra: Partial<Quote> = {}): Quote =>
    ({ id, number, enquiryId: e.id, customerName: e.name, customerPhone: e.phone, plate: e.plate, vehicle: `${e.make} ${e.model}`, branch: e.branch, service: e.service, lines, discount,
       validUntil: iso((agoH - 14 * 24) * H), status, by: 'Miflal', createdAt: iso(agoH * H), updatedAt: iso(agoH * H), ...extra });
  const quotes: Quote[] = [
    q('q1', 'AM-Q-0001', enquiries[3], [{ desc: 'Panel preparation, roof and bonnet', qty: 1, price: 45000 }, { desc: 'Full respray, Honda Vezel, black', qty: 1, price: 95000 }, { desc: 'Clear coat and polish', qty: 1, price: 10000 }], 5000, 'accepted', 7 * 24 - 2, { sentAt: iso((7 * 24 - 3) * H), answeredAt: iso((6 * 24 + 20) * H), jobId: 'j3' }),
    q('q2', 'AM-Q-0002', enquiries[2], [{ desc: 'Full respray, Suzuki Swift, red', qty: 1, price: 85000 }, { desc: 'Panel preparation', qty: 1, price: 20000 }, { desc: 'Cut and polish after paint', qty: 1, price: 8000 }], 0, 'sent', 30, { sentAt: iso(29 * H) }),
    q('q3', 'AM-Q-0003', enquiries[4], [{ desc: 'Alloy wheel repair and paint', qty: 4, price: 6500 }], 0, 'declined', 9 * 24 - 3, { sentAt: iso((9 * 24 - 4) * H), answeredAt: iso(8 * 24 * H) })
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
  for (const e of enquiries) activities.push({ id: 'act' + (k++), jobId: e.jobId || '', enquiryId: e.id, type: 'enquiry', summary: `Enquiry from ${e.name}, ${e.source}`, by: e.by || 'Nuwan', createdAt: e.createdAt, updatedAt: e.createdAt });
  for (const x of quotes) activities.push({ id: 'act' + (k++), jobId: x.jobId || '', quoteId: x.id, type: 'quote', summary: `Quote ${x.number} ${x.status} for ${x.customerName}`, by: 'Miflal', createdAt: x.updatedAt, updatedAt: x.updatedAt });
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { jobs, customers, activities, enquiries, quotes };
}
