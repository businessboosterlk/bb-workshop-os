import { Cast, Job, Customer, Phase, Activity, Enquiry, Quote, FollowUp, Photo } from './models';
import { demoPhoto } from './photo';
import { spacesFor, minutesLeft } from './spaces';
import { addWorkingMinutes } from './calendar';
import { nextNo } from './payments';

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
/* 4: the floor picture, 15 Oct 2026: cars in named spaces, a blocked bay, the holding dock, parts on order */
/* 5: demo photos on two jobs, 16 Oct 2026, so the before and after slider has something to show */
/* 6: promises from the working calendar, 16 Oct 2026 */
/* 7: payments are lines on the job, 18 Oct 2026: every typed paid figure became one cash payment line */
export const SEED_VERSION = 7;
export function seed(cast: Cast): { jobs: Job[]; customers: Customer[]; activities: Activity[]; enquiries: Enquiry[]; quotes: Quote[]; photos: Photo[] } {
  /* every name and number on the demo floor comes from the cast, so a second workshop never shows the first one's people */
  const staff = cast.users.filter(u => u.role === 'staff').map(u => u.name);
  const OWNER = cast.users.find(u => u.role === 'owner')?.name || 'Owner', STAFF1 = staff[0] || OWNER, STAFF2 = staff[1] || STAFF1;
  const QP = cast.quote?.prefix || 'Q';
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
    cust('c9', 'Rizan Hameed', '0725566443', [{ plate: 'CAA-7710', make: 'Mitsubishi', model: 'Outlander', colour: 'Grey' }]),
    cust('c10', 'Kasun Dissanayake', '0718877665', [{ plate: 'CAH-3348', make: 'Toyota', model: 'Corolla', colour: 'White' }]),
    cust('c11', 'Hiruni Weerasinghe', '0762211009', [{ plate: 'CBE-5519', make: 'Suzuki', model: 'Alto', colour: 'Red' }]),
    cust('c12', 'Prasad Kumara', '0773322114', [{ plate: 'PH-4402', make: 'Toyota', model: 'Hilux', colour: 'Black' }]),
    cust('c13', 'Dinithi Herath', '0705544332', [{ plate: 'CAK-9921', make: 'Honda', model: 'Insight', colour: 'Silver' }])
  ];
  const job = (id: string, c: Customer, v: number, branch: string, service: string, insurance: boolean, step: number, startedAgoH: number, nowAgoH: number, promisedInH: number, extra: Partial<Job> = {}): Job => {
    const veh = c.vehicles[v];
    const ph = advance(phasesFor(cast, service, insurance), step, startedAgoH, nowAgoH, STAFF1, () => undefined);
    const status: Job['status'] = extra.status || (ph[ph.length - 1]?.status === 'now' ? 'ready' : 'open');
    return { id, plate: veh.plate, make: veh.make, model: veh.model, colour: veh.colour, customerId: c.id, customerName: c.name, customerPhone: c.phone,
      branch, service, insurance, phases: ph, promisedAt: iso(-promisedInH * H), promiseHistory: [], pickup: { wanted: false, status: 'none' }, approvals: [],
      status, createdAt: iso(startedAgoH * H), updatedAt: now, ...extra };
  };
  const jobs: Job[] = [
    /* the demo customer's Aqua: accident repair through insurance, mid paint, one approval waiting */
    job('j1', customers[0], 0, 'bora', 'accident', true, 6, 9 * 24, 20, 3 * 24, { insurer: 'Ceylinco', estimate: 185000, approved: 185000,
      approvals: [{ id: 'a1', title: 'Replace the front left headlamp', detail: 'The lamp housing is cracked inside. A new unit fits the colour match better than a repair.', amount: 24500, status: 'pending', askedAt: iso(5 * H) }],
      promiseHistory: [{ at: iso(2 * 24 * H), was: iso(-1 * 24 * H), now: iso(-3 * 24 * H), reason: 'The insurer took two extra days to approve the estimate', by: OWNER }],
      pickup: { wanted: true, address: 'Nugegoda', status: 'collected', driver: 'Sampath' } }),
    /* the demo customer's Wagon R: cut and polish delivered last month */
    job('j2', customers[0], 1, 'dehi', 'cutpolish', false, 7, 40 * 24, 38 * 24, -38 * 24, { status: 'delivered', deliveredAt: iso(38 * 24 * H), handoverBy: STAFF2, rating: 5, estimate: 18000, approved: 18000 }),
    /* Vezel: painting, overrun on paint preparation */
    job('j3', customers[1], 0, 'bora', 'painting', false, 2, 6 * 24, 70, -1 * 24, { estimate: 145000, approved: 145000 }),
    /* Leaf: alloy wheels, on time */
    job('j4', customers[2], 0, 'dehi', 'alloy', false, 3, 3 * 24, 6, 2 * 24, { estimate: 32000, approved: 32000 }),
    /* Premio: accident, no insurance, waiting on parts */
    job('j5', customers[3], 0, 'dehi', 'accident', false, 2, 4 * 24, 30, 6 * 24, { estimate: 96000, approved: 96000, pickup: { wanted: true, address: 'Mount Lavinia', status: 'collected', driver: 'Sampath' } }),
    /* Sorento: paint correction, ready for pickup */
    job('j6', customers[4], 0, 'bora', 'correction', false, 6, 5 * 24, 2, 0, { estimate: 45000, approved: 45000, pickup: { wanted: true, address: 'Kohuwala', status: 'booked', driver: 'Sampath', eta: 'Today 4 pm' } }),
    /* Fit: received this morning */
    job('j7', customers[5], 0, 'dehi', 'cutpolish', false, 0, 3, 3, 10, { estimate: 15000, approved: 0 }),
    /* delivered cars, so the follow-up list has something due, something coming and something done */
    job('j8', customers[6], 0, 'bora', 'painting', false, 7, 36 * 24, 31 * 24, -31 * 24, { status: 'delivered', deliveredAt: iso(31 * 24 * H), handoverBy: STAFF1, rating: 5, estimate: 88000, approved: 88000 }),
    job('j9', customers[7], 0, 'dehi', 'alloy', false, 7, 7 * 24, 4 * 24, -4 * 24, { status: 'delivered', deliveredAt: iso(4 * 24 * H), handoverBy: STAFF2, estimate: 26000, approved: 26000 }),
    job('j10', customers[8], 0, 'bora', 'cutpolish', false, 7, 93 * 24, 92 * 24, -92 * 24, { status: 'delivered', deliveredAt: iso(92 * 24 * H), handoverBy: STAFF1, rating: 4, estimate: 22000, approved: 22000 }),
    /* the floor picture: more cars so both branches read as a working day */
    job('j11', customers[9], 0, 'bora', 'cutpolish', false, 3, 8, 1.5, 6, { estimate: 16000, approved: 16000 }),
    job('j12', customers[10], 0, 'bora', 'correction', false, 2, 26, 22, 20, { estimate: 38000, approved: 38000 }),
    job('j13', customers[11], 0, 'dehi', 'painting', false, 3, 5 * 24, 30, 2 * 24, { estimate: 120000, approved: 120000 }),
    job('j14', customers[12], 0, 'bora', 'accident', false, 3, 3 * 24, 4, 4 * 24, { estimate: 74000, approved: 74000 })
  ];
  /* the money already taken on the floor, as payment lines: cash, dated a day after the car came in, numbered by the engine */
  const PAID: Record<string, number> = { j2: 18000, j3: 50000, j5: 30000, j6: 45000, j8: 88000, j9: 26000, j10: 22000, j13: 60000 };
  const DESK = cast.users.find(u => u.role === 'desk')?.name || OWNER;
  for (const j of jobs) {
    if (PAID[j.id] !== undefined) {
      const when = new Date(new Date(j.createdAt).getTime() + 24 * H).toISOString();
      const at = when.slice(0, 10);
      j.payments = [{ id: 'pay-' + j.id, no: nextNo(jobs, at), at, recordedAt: when, amount: PAID[j.id], method: 'cash', by: DESK }];
    }
  }
  /* the promise of every open car is what a workshop would really have said: the remaining stages at their usual hours on the
     working calendar, plus one working day of air. The Vezel (j3) keeps a promise already past, on purpose, so the floor shows one. */
  for (const j of jobs) if (j.status === 'open' && j.id !== 'j3') j.promisedAt = addWorkingMinutes(addWorkingMinutes(Date.now(), minutesLeft(j, Date.now())), 480).toISOString();
  /* where each open car stands, by the branch's own spaces (index into spacesFor), so any cast seeds a sensible floor */
  const sp = (j: Job, i: number) => spacesFor(cast, j.branch)[i]?.key;
  const at = (id: string, i: number, extra: Partial<Job> = {}) => { const j = jobs.find(x => x.id === id); if (j) Object.assign(j, { spaceKey: sp(j, i), ...extra }); };
  at('j1', 4);                                                                     /* the Aqua in the paint booth */
  at('j3', 2);                                                                     /* the Vezel in Bay 3, over time */
  at('j11', 5);                                                                    /* the Corolla in the detail bay */
  at('j12', 0, { hold: 'approval', heldAt: iso(50 * 60000) });                       /* the Alto blocking Hoist 1 for 50 min */
  at('j14', 1, { parts: [{ id: 'p3', name: 'Front bumper bracket', supplier: 'Lanka Auto Parts', status: 'arrived', orderedAt: iso(2 * 24 * H), arrivedAt: iso(5 * H) }] });
  at('j4', 5);                                                                     /* the Leaf on the wheel bench */
  at('j13', 4);                                                                    /* the Hilux in the paint booth */
  /* waiting off the floor: the Premio for parts, nothing in a bay */
  const premio = jobs.find(j => j.id === 'j5'); if (premio) Object.assign(premio, { hold: 'parts', heldAt: iso(26 * H), parts: [
    { id: 'p1', name: 'Left front door shell', supplier: 'Toyota Lanka', status: 'ordered', orderedAt: iso(26 * H) },
    { id: 'p2', name: 'Door mirror, left', supplier: 'Lanka Auto Parts', status: 'arrived', orderedAt: iso(26 * H), arrivedAt: iso(3 * H) }] });
  for (const j of jobs) if (j.status === 'delivered' && j.deliveredAt) {
    j.followups = followupsFor(cast, j.deliveredAt).map(f => new Date(f.due).getTime() < Date.now() - 2 * 24 * H && (f.key === 'd3' || (j.id === 'j10' && f.key === 'd30'))
      ? { ...f, doneAt: new Date(new Date(f.due).getTime() + 3 * H).toISOString(), outcome: 'good' as const, by: j.handoverBy, note: 'All good, happy with the finish' } : f);
  }
  /* one 30-day check already done on the Civic, so Done has a real row */
  const civic = jobs.find(j => j.id === 'j8')!; civic.followups = civic.followups!.map(f => f.key === 'd30' ? { ...f, doneAt: iso(12 * H), outcome: 'good' as const, by: OWNER, note: 'Paint still perfect, will send a friend' } : f);
  jobs.find(j => j.id === 'j3')!.enquiryId = 'e5'; jobs.find(j => j.id === 'j3')!.quoteId = 'q1';
  const enq = (id: string, name: string, phone: string, car: [string, string, string], service: string, branch: string, source: string, note: string, status: Enquiry['status'], agoH: number, extra: Partial<Enquiry> = {}): Enquiry =>
    ({ id, name, phone, plate: car[0], make: car[1], model: car[2], service, branch, source, note, status, by: STAFF1, createdAt: iso(agoH * H), updatedAt: iso(agoH * H), ...extra });
  const enquiries: Enquiry[] = [
    enq('e1', 'Kavinda Rathnayake', '0714455667', ['CAF-2290', 'Toyota', 'Axio'], 'accident', 'bora', 'WhatsApp', 'Rear bumper and boot lid after a knock in traffic. Asking if insurance will cover it.', 'new', 2),
    enq('e3', 'Mohamed Arshad', '0775566778', ['KW-4412', 'Nissan', 'X-Trail'], 'cutpolish', 'bora', 'Walk-in', 'Selling the car next month and wants it looking its best.', 'new', 26),
    enq('e2', 'Shalini Perera', '0768899112', ['CAE-6671', 'Suzuki', 'Swift'], 'painting', 'dehi', 'Instagram', 'Full respray, keeping the same red. Saw the Vezel video.', 'quoted', 50, { quoteId: 'q2' }),
    enq('e5', 'Nadeesha Fernando', '0712345678', ['CAY-8823', 'Honda', 'Vezel'], 'painting', 'bora', 'Instagram', 'Faded roof and bonnet, wants a full respray in black.', 'booked', 7 * 24, { quoteId: 'q1', jobId: 'j3' }),
    enq('e4', 'Tharindu Senanayake', '0712233445', ['CAB-9031', 'Honda', 'Grace'], 'alloy', 'dehi', 'Google', 'Four alloys scuffed on the kerb.', 'lost', 9 * 24, { quoteId: 'q3', lostReason: 'Declined the quote' })
  ];
  const q = (id: string, number: string, e: Enquiry, lines: Quote['lines'], discount: number, status: Quote['status'], agoH: number, extra: Partial<Quote> = {}): Quote =>
    ({ id, number, enquiryId: e.id, customerName: e.name, customerPhone: e.phone, plate: e.plate, vehicle: `${e.make} ${e.model}`, branch: e.branch, service: e.service, lines, discount,
       validUntil: iso((agoH - 14 * 24) * H), status, by: OWNER, createdAt: iso(agoH * H), updatedAt: iso(agoH * H), ...extra });
  const quotes: Quote[] = [
    q('q1', `${QP}-0001`, enquiries[3], [{ desc: 'Panel preparation, roof and bonnet', qty: 1, price: 45000 }, { desc: 'Full respray, Honda Vezel, black', qty: 1, price: 95000 }, { desc: 'Clear coat and polish', qty: 1, price: 10000 }], 5000, 'accepted', 7 * 24 - 2, { sentAt: iso((7 * 24 - 3) * H), answeredAt: iso((6 * 24 + 20) * H), jobId: 'j3' }),
    q('q2', `${QP}-0002`, enquiries[2], [{ desc: 'Full respray, Suzuki Swift, red', qty: 1, price: 85000 }, { desc: 'Panel preparation', qty: 1, price: 20000 }, { desc: 'Cut and polish after paint', qty: 1, price: 8000 }], 0, 'sent', 30, { sentAt: iso(29 * H) }),
    q('q3', `${QP}-0003`, enquiries[4], [{ desc: 'Alloy wheel repair and paint', qty: 4, price: 6500 }], 0, 'declined', 9 * 24 - 3, { sentAt: iso((9 * 24 - 4) * H), answeredAt: iso(8 * 24 * H) })
  ];
  const activities: Activity[] = [];
  let k = 0;
  for (const j of jobs) {
    activities.push({ id: 'act' + (k++), jobId: j.id, type: 'new', summary: `Car received: ${j.plate}, ${j.make} ${j.model}`, by: STAFF1, createdAt: j.createdAt, updatedAt: j.createdAt });
    for (const p of j.phases) if (p.status === 'done' && p.doneAt) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'phase', summary: `${p.label} done`, by: p.by || STAFF1, createdAt: p.doneAt, updatedAt: p.doneAt });
    for (const h of j.promiseHistory) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'promise', summary: `Promised date moved: ${h.reason}`, by: h.by, createdAt: h.at, updatedAt: h.at });
    for (const a of j.approvals) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'approval', summary: `Asked the customer: ${a.title}`, by: STAFF1, createdAt: a.askedAt, updatedAt: a.askedAt });
    if (j.status === 'delivered' && j.deliveredAt) activities.push({ id: 'act' + (k++), jobId: j.id, type: 'delivered', summary: `Delivered to ${j.customerName}`, by: j.handoverBy || STAFF2, createdAt: j.deliveredAt, updatedAt: j.deliveredAt });
  }
  for (const e of enquiries) activities.push({ id: 'act' + (k++), jobId: e.jobId || '', enquiryId: e.id, type: 'enquiry', summary: `Enquiry from ${e.name}, ${e.source}`, by: e.by || STAFF1, createdAt: e.createdAt, updatedAt: e.createdAt });
  for (const x of quotes) activities.push({ id: 'act' + (k++), jobId: x.jobId || '', quoteId: x.id, type: 'quote', summary: `Quote ${x.number} ${x.status} for ${x.customerName}`, by: OWNER, createdAt: x.updatedAt, updatedAt: x.updatedAt });
  activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  /* demo photos for every closed stage of the Aqua and the Sorento: the job card's before and after needs two or more */
  const photos: Photo[] = []; const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  for (const id of ['j1', 'j6']) { const j = jobs.find(x => x.id === id); if (!j) continue;
    j.phases.forEach((p, i) => { if (p.status !== 'done') return; const pid = `ph-${id}-${i}`; p.photoId = pid;
      photos.push({ id: pid, jobId: id, phaseKey: p.key, dataUrl: demoPhoto(j.plate, p.label, dark), by: p.by || STAFF1, createdAt: p.doneAt || j.createdAt, updatedAt: p.doneAt || j.createdAt }); }); }
  return { jobs, customers, activities, enquiries, quotes, photos };
}
