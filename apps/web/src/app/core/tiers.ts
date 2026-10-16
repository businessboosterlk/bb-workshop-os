import type { Cast } from './models';

export type Tier = 1 | 2 | 3;

export type FeatureKey = 'floor' | 'stages' | 'tracking' | 'enquiries' | 'money' | 'branch'
  | 'dock' | 'parts' | 'approvals' | 'followups' | 'reports' | 'branches' | 'linkViews'
  | 'voiceQuote' | 'photoGate' | 'snapCheckIn' | 'exceptions' | 'moneyTunnel' | 'insurancePack' | 'camera';

export interface Feature {
  key: FeatureKey;
  tier: Tier;
  label: string;
  what: string;
  sample: string[];
}

export const FEATURES: Record<FeatureKey, Feature> = {
  floor: {
    key: 'floor',
    tier: 1,
    label: 'The floor picture',
    what: 'Every bay busy or free at a glance.',
    sample: ['Hoist 1 · busy · about 2 h left', 'Bay 4 · free now']
  },
  stages: {
    key: 'stages',
    tier: 1,
    label: 'Stages with photos',
    what: 'A car moves stage by stage and every stage closes with a photo.',
    sample: ['Panel beating · done with a photo', 'Paint · now']
  },
  tracking: {
    key: 'tracking',
    tier: 1,
    label: 'Customer tracking',
    what: 'The customer sees where their car is without phoning.',
    sample: ['Your car is in Paint', 'Ready around Friday']
  },
  enquiries: {
    key: 'enquiries',
    tier: 1,
    label: 'Enquiries and quotes',
    what: 'Every call and message logged, quoted and booked in.',
    sample: ['New · Toyota Axio · rear bumper', 'Quoted · Honda Vezel']
  },
  money: {
    key: 'money',
    tier: 1,
    label: 'Owner money view',
    what: 'What each job is worth and what is still to collect.',
    sample: ['Approved and paid on every job', 'Still to collect, by car']
  },
  branch: {
    key: 'branch',
    tier: 1,
    label: 'One branch',
    what: 'The floor of one garage.',
    sample: ['Wellawatte · six spaces']
  },
  dock: {
    key: 'dock',
    tier: 2,
    label: 'Holding dock',
    what: 'A car waiting for parts, approval or curing leaves its bay, so the floor shows the space as free.',
    sample: ['CAT-1019 · waiting for parts · 26 h', 'CBA-4410 · waiting for approval · 3 h', 'Hoist 1 · bay blocked · 50 min']
  },
  parts: {
    key: 'parts',
    tier: 2,
    label: 'Parts board',
    what: 'Every part ordered, arrived and fitted across every car, on a board and a list.',
    sample: ['Left front door shell · ordered', 'Door mirror, left · arrived', 'Front bumper bracket · fitted']
  },
  approvals: {
    key: 'approvals',
    tier: 2,
    label: 'Approvals by link',
    what: 'Extra work found mid job goes to the customer, who approves it from their phone.',
    sample: ['Replace the front left headlamp · waiting']
  },
  followups: {
    key: 'followups',
    tier: 2,
    label: 'Follow-ups',
    what: 'Reminders to check in with a customer 3, 30 and 90 days after delivery.',
    sample: ['Civic · 30 day check · due today']
  },
  reports: {
    key: 'reports',
    tier: 2,
    label: 'Reports',
    what: 'This month against last month: cars in, cars out, days per job.',
    sample: ['Cars out this month · up on last month']
  },
  branches: {
    key: 'branches',
    tier: 2,
    label: 'Several branches',
    what: 'Every branch of the garage on one floor.',
    sample: ['Wellawatte and Ratmalana side by side']
  },
  linkViews: {
    key: 'linkViews',
    tier: 2,
    label: 'Who opened the link',
    what: 'See when a customer opened their tracking or quote link and how often.',
    sample: ['Quote opened 3 times · last Today 10:12']
  },
  voiceQuote: {
    key: 'voiceQuote',
    tier: 3,
    label: 'Voice to quote',
    what: 'Speak the job in Sinhala, Tamil or English and get a quote to check.',
    sample: ['Rear bumper respray and two clips · draft quote ready']
  },
  photoGate: {
    key: 'photoGate',
    tier: 3,
    label: 'Photo check',
    what: 'A blurry, reused or wrong photo is refused before a stage can close.',
    sample: ['Photo refused: the same picture as yesterday']
  },
  snapCheckIn: {
    key: 'snapCheckIn',
    tier: 3,
    label: 'One snap check-in',
    what: 'A photo of the number plate fills in the car.',
    sample: ['CAT-1019 · Toyota Premio · filled from the photo']
  },
  exceptions: {
    key: 'exceptions',
    tier: 3,
    label: 'Owner exception feed',
    what: 'The jobs that need you today: stalled stages, extra work nobody approved and money not collected.',
    sample: [
      'CAY-8823 has sat in Paint preparation 9 h past its usual time',
      'A headlamp was fitted before the customer approved it',
      'Two delivered cars still have money to collect'
    ]
  },
  moneyTunnel: {
    key: 'moneyTunnel',
    tier: 3,
    label: 'Money tunnel',
    what: 'Every car matched to its job, its approval and its payment.',
    sample: ['Every car this week matched · one gap found']
  },
  insurancePack: {
    key: 'insurancePack',
    tier: 3,
    label: 'Insurance pack',
    what: 'The photos, stages and approvals of a claim in one file for the insurer.',
    sample: ['Claim pack for CAT-1019 · 14 photos']
  },
  camera: {
    key: 'camera',
    tier: 3,
    label: 'Camera check-in',
    what: 'A camera at the gate checks a car in and moves it on the floor by itself.',
    sample: ['Gate camera · CAT-1019 in at 08:12']
  }
};

export function tierOf(cast: Cast | null, search: string): Tier | undefined {
  if (cast === null) {
    return undefined;
  }

  if (cast.data.mode === 'local') {
    const params = new URLSearchParams(search);
    const tierParam = params.get('tier');
    if (tierParam === '1' || tierParam === '2' || tierParam === '3') {
      return Number(tierParam) as Tier;
    }
  }

  return cast.tier;
}

export function unlocked(cast: Cast | null, key: FeatureKey, search: string): boolean {
  const t = tierOf(cast, search);
  if (t === undefined) {
    return true;
  }
  return FEATURES[key].tier <= t;
}

export function lockedAbove(cast: Cast | null, search: string): FeatureKey[] {
  const keys = Object.keys(FEATURES) as FeatureKey[];
  return keys.filter((key) => !unlocked(cast, key, search));
}
