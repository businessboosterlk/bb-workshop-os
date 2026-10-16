Write the COMPLETE contents of one new file: apps/web/src/app/core/tiers.ts. Output ONLY one ```ts code block.
Plain TypeScript, strict, no `any`, no Angular, no imports except the one type below. No em dash or en dash anywhere, no comma
before "and" or "or" in any string, British English.

WHAT IT IS: the three tiers of a garage system (BB's rule: tier 1 runs the floor, tier 2 runs it better, tier 3 adds AI and
proof). One table of features, each with the tier that unlocks it, the words a locked card shows and a short sample. One
function says whether a feature is on for a workshop. A workshop with NO tier keeps every feature (a client already using a
feature never loses it).

THE TYPE IT READS: import type { Cast } from './models';  the only fields you may read:
  Cast.tier?: 1 | 2 | 3;   Cast.data: { mode: 'local' | 'api' };   ('local' is the demo)

EXPORT EXACTLY:
  export type Tier = 1 | 2 | 3;
  export type FeatureKey = 'floor' | 'stages' | 'tracking' | 'enquiries' | 'money' | 'branch'
    | 'dock' | 'parts' | 'approvals' | 'followups' | 'reports' | 'branches' | 'linkViews'
    | 'voiceQuote' | 'photoGate' | 'snapCheckIn' | 'exceptions' | 'moneyTunnel' | 'insurancePack' | 'camera';
  export interface Feature { key: FeatureKey; tier: Tier; label: string; what: string; sample: string[]; }
  export const FEATURES: Record<FeatureKey, Feature>   with EXACTLY these rows (key, tier, label, what, sample lines):
    floor 1 "The floor picture" "Every bay busy or free at a glance." ["Hoist 1 · busy · about 2 h left", "Bay 4 · free now"]
    stages 1 "Stages with photos" "A car moves stage by stage and every stage closes with a photo." ["Panel beating · done with a photo", "Paint · now"]
    tracking 1 "Customer tracking" "The customer sees where their car is without phoning." ["Your car is in Paint", "Ready around Friday"]
    enquiries 1 "Enquiries and quotes" "Every call and message logged, quoted and booked in." ["New · Toyota Axio · rear bumper", "Quoted · Honda Vezel"]
    money 1 "Owner money view" "What each job is worth and what is still to collect." ["Approved and paid on every job", "Still to collect, by car"]
    branch 1 "One branch" "The floor of one garage." ["Wellawatte · six spaces"]
    dock 2 "Holding dock" "A car waiting for parts, approval or curing leaves its bay, so the floor shows the space as free." ["CAT-1019 · waiting for parts · 26 h", "CBA-4410 · waiting for approval · 3 h", "Hoist 1 · bay blocked · 50 min"]
    parts 2 "Parts board" "Every part ordered, arrived and fitted across every car, on a board and a list." ["Left front door shell · ordered", "Door mirror, left · arrived", "Front bumper bracket · fitted"]
    approvals 2 "Approvals by link" "Extra work found mid job goes to the customer, who approves it from their phone." ["Replace the front left headlamp · waiting"]
    followups 2 "Follow-ups" "Reminders to check in with a customer 3, 30 and 90 days after delivery." ["Civic · 30 day check · due today"]
    reports 2 "Reports" "This month against last month: cars in, cars out, days per job." ["Cars out this month · up on last month"]
    branches 2 "Several branches" "Every branch of the garage on one floor." ["Wellawatte and Ratmalana side by side"]
    linkViews 2 "Who opened the link" "See when a customer opened their tracking or quote link and how often." ["Quote opened 3 times · last Today 10:12"]
    voiceQuote 3 "Voice to quote" "Speak the job in Sinhala, Tamil or English and get a quote to check." ["Rear bumper respray and two clips · draft quote ready"]
    photoGate 3 "Photo check" "A blurry, reused or wrong photo is refused before a stage can close." ["Photo refused: the same picture as yesterday"]
    snapCheckIn 3 "One snap check-in" "A photo of the number plate fills in the car." ["CAT-1019 · Toyota Premio · filled from the photo"]
    exceptions 3 "Owner exception feed" "The jobs that need you today: stalled stages, extra work nobody approved and money not collected." ["CAY-8823 has sat in Paint preparation 9 h past its usual time", "A headlamp was fitted before the customer approved it", "Two delivered cars still have money to collect"]
    moneyTunnel 3 "Money tunnel" "Every car matched to its job, its approval and its payment." ["Every car this week matched · one gap found"]
    insurancePack 3 "Insurance pack" "The photos, stages and approvals of a claim in one file for the insurer." ["Claim pack for CAT-1019 · 14 photos"]
    camera 3 "Camera check-in" "A camera at the gate checks a car in and moves it on the floor by itself." ["Gate camera · CAT-1019 in at 08:12"]
  export function tierOf(cast: Cast | null, search: string): Tier | undefined
    cast null: undefined.
    THE DEMO OVERRIDE: only when cast.data.mode === 'local', read the query string `search` (as in location.search, it may be ''
    or start with '?') with new URLSearchParams; if tier is exactly '1', '2' or '3' return that number. Anything else is ignored.
    Otherwise return cast.tier (which may be undefined). An 'api' workshop NEVER takes the override.
  export function unlocked(cast: Cast | null, key: FeatureKey, search: string): boolean
    const t = tierOf(cast, search); t undefined: true (every feature on). Otherwise FEATURES[key].tier <= t.
  export function lockedAbove(cast: Cast | null, search: string): FeatureKey[]   every key that is NOT unlocked, in table order.
  Never read location or window inside this file: the caller passes location.search.
