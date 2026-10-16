/* THE BODY TYPE OF A CAR, from its make and model (16 Oct 2026). Four shapes that match Sri Lankan traffic: a hatchback
   (Alto, Wagon R, Vitz), a sedan (Axio, Premio, Civic), an SUV or pickup (Vezel, Montero, Hilux) and a van (HiAce, KDH).
   The floor draws each car in its own silhouette. Unknown models are drawn as a sedan, the middle shape. */
export type BodyType = 'hatch' | 'sedan' | 'suv' | 'van';

const HATCH = ['alto', 'wagon r', 'wagonr', 'vitz', 'yaris', 'aqua', 'fit', 'swift', 'march', 'passo', 'vios', 'ist', 'leaf', 'spacia', 'hustler', 'celerio', 'i10', 'picanto', 'mira', 'move', 'tank', 'roomy', 'prius c', 'insight', 'jazz', 'polo', 'mini'];
const SUV = ['vezel', 'hr-v', 'hrv', 'cr-v', 'crv', 'montero', 'pajero', 'raize', 'rocky', 'prado', 'land cruiser', 'fortuner', 'hilux', 'navara', 'd-max', 'dmax', 'ranger', 'triton', 'l200', 'x-trail', 'xtrail', 'rav4', 'rav 4', 'rush', 'terios', 'jimny', 'vitara', 'escudo', 'sorento', 'sportage', 'tucson', 'santa fe', 'kicks', 'juke', 'cx-5', 'cx5', 'forester', 'outback', 'xv', 'eclipse cross', 'outlander', 'tiguan', 'x1', 'x3', 'x5', 'glc', 'gle', 'q3', 'q5', 'defender', 'discovery', 'evoque', 'wr-v', 'wrv', 'chr', 'c-hr', 'harrier', 'kluger', 'bz4x'];
const VAN = ['hiace', 'kdh', 'kdh 201', 'kdh201', 'caravan', 'urvan', 'every', 'hijet', 'carry', 'town ace', 'townace', 'lite ace', 'liteace', 'noah', 'voxy', 'esquire', 'sienta', 'freed', 'stepwgn', 'step wgn', 'serena', 'vanette', 'delica', 'alphard', 'vellfire', 'dolphin', 'coaster', 'rosa', 'bongo', 'porter', 'h100', 'h-1', 'staria', 'vito', 'sprinter', 'transit', 'dyna', 'canter', 'elf', 'lorry', 'truck'];

export function bodyType(make?: string, model?: string): BodyType {
  const s = `${make || ''} ${model || ''}`.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (list: string[]) => list.some(w => s === w || s.includes(' ' + w) || s.startsWith(w + ' ') || s.endsWith(' ' + w) || s.includes(w));
  if (has(VAN)) return 'van';
  if (has(SUV)) return 'suv';
  if (has(HATCH)) return 'hatch';
  return 'sedan';
}

export const BODY_WORDS: Record<BodyType, string> = { hatch: 'Hatchback', sedan: 'Sedan', suv: 'SUV', van: 'Van' };
