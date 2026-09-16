/* One shape per record. Every record carries the workshop slug on the server side;
   a browser never sees another workshop's rows, and a customer never sees another
   customer's car. */
export type Role = 'owner' | 'staff';
export type PhaseStatus = 'done' | 'now' | 'next';
export type JobStatus = 'open' | 'ready' | 'delivered';

export interface PhaseDef { key: string; label: string; hours: number; insuranceOnly?: boolean; }
export interface ServiceDef { key: string; label: string; insurance?: boolean; phases: PhaseDef[]; }
export interface Branch { key: string; name: string; address: string; wa?: string; bays: number; }
export interface Seat { name: string; role: Role; branch?: string; pin?: string; }

export interface Phase { key: string; label: string; hours: number; status: PhaseStatus; startedAt?: string; doneAt?: string; photoId?: string; by?: string; note?: string; }
export interface PromiseChange { at: string; was: string; now: string; reason: string; by: string; }
export interface Approval { id: string; title: string; detail?: string; amount?: number; status: 'pending' | 'approved' | 'declined'; askedAt: string; answeredAt?: string; }
export interface Pickup { wanted: boolean; address?: string; status: 'booked' | 'collected' | 'returned' | 'none'; driver?: string; eta?: string; }
export interface Job {
  id: string; plate: string; make: string; model: string; colour?: string;
  customerId: string; customerName: string; customerPhone: string;
  branch: string; service: string; insurance: boolean; insurer?: string;
  phases: Phase[]; promisedAt: string; promiseHistory: PromiseChange[];
  pickup: Pickup; approvals: Approval[];
  estimate?: number; approved?: number; paid?: number;   /* owner only: the API strips these for a staff seat */
  status: JobStatus; deliveredAt?: string; handoverBy?: string; rating?: number; notes?: string;
  createdAt: string; updatedAt: string;
}
export interface Vehicle { plate: string; make: string; model: string; colour?: string; }
export interface Customer { id: string; name: string; phone: string; vehicles: Vehicle[]; createdAt: string; updatedAt: string; }
export interface Activity { id: string; jobId: string; type: 'phase' | 'note' | 'promise' | 'approval' | 'pickup' | 'delivered' | 'new'; summary: string; by: string; createdAt: string; updatedAt: string; }
export interface Photo { id: string; jobId: string; phaseKey: string; dataUrl: string; by: string; createdAt: string; updatedAt: string; }
export type Table = 'jobs' | 'customers' | 'activities' | 'photos';

export interface Cast {
  slug: string; aliases?: string[]; name: string; short?: string; tagline?: string;
  brand: { hex: string; ink?: string; logo?: string };
  pickup?: string;
  branches: Branch[];
  services: ServiceDef[];
  users: Seat[];
  customerCode?: string;           /* demo only: the one-time code every demo customer gets */
  words: Record<string, string>;
  data: { mode: 'local' | 'api' };
}
