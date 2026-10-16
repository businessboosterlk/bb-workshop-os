#!/usr/bin/env node
/* EVERY CAR ON THE FLOOR COMES FROM A LICENSED SET. NOBODY DRAWS ONE BY HAND (16 Oct 2026, after two hand-built cars
   were rejected on sight). The shapes are Kenney's Racing Pack (CC0 1.0, kenney.nl, fetched from opengameart.org), the
   five black cars pulled out of its flat vector export by their bounding boxes (vendor/vehicles/PROVENANCE.md). This turns
   each one nose-right, swaps its paint for the app's tokens and writes apps/web/src/app/ui/vehicles.generated.ts, which
   the vehicle component only reads. Every car shares ONE box, so every car on the floor is the same size.
     node scripts/build-vehicles.mjs           write
     node scripts/build-vehicles.mjs --check   exit 1 when the file differs from what the sources produce */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const SRC = ROOT + 'vendor/vehicles/kenney/cars/';
const FILE = ROOT + 'apps/web/src/app/ui/vehicles.generated.ts';
/* the body type the app asks for -> the extracted object (chosen by eye on a rendered sheet, 16 Oct 2026) */
const MAP = { hatch: 'obj-17', sedan: 'obj-22', suv: 'obj-16', van: 'obj-08', pickup: 'obj-08' };   /* obj-05, a sports coupe, is not used; the set has no van, so a van takes the pickup's shape (PROVENANCE.md) */
/* Kenney's paint -> the app's tokens: the body is the current colour, the roof and bonnet a shade of it, the glass the page */
const PAINT = { '#3a3535': 'currentColor', '#4f4c4c': 'currentColor', '#3c3939': 'currentColor', '#5d5b5b': 'var(--vehicle-roof)', '#706e6e': 'var(--vehicle-roof)', '#ffffff': 'var(--vehicle-glass)', '#eeeeee': 'var(--vehicle-glass-2)' };
const BOX = { w: 65, h: 36 };   /* one box for every car, nose to the right: 65 long, 36 wide, Kenney's own proportion */
const out = {}; const missing = Object.values(PAINT).length ? [] : [];
for (const [body, obj] of Object.entries(MAP)) {
  const svg = readFileSync(SRC + obj + '.svg', 'utf8');
  const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number);
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace('</svg>', '').trim();
  inner = inner.replace(/fill="(#[0-9a-f]{6})"/g, (m, hex) => { if (!PAINT[hex]) { missing.push(body + ' ' + hex); return m; } return `fill="${PAINT[hex]}"`; });
  /* turn nose-right (Kenney's cars point up) and centre the car in the shared box at the shared scale */
  const scale = Math.min(BOX.w / h, BOX.h / w); const W = h * scale, H = w * scale; const dx = (BOX.w - W) / 2, dy = (BOX.h - H) / 2;
  out[body] = `<g transform="translate(${(dx + W).toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)}) rotate(90) translate(${(-x).toFixed(2)} ${(-y).toFixed(2)})">${inner.replace(/\n/g, '')}</g>`;
}
if (missing.length) { console.error('FAIL  a paint with no token: ' + missing.join(', ')); process.exit(1); }
const text = `/* WRITTEN BY scripts/build-vehicles.mjs. NEVER EDIT BY HAND.
   Kenney Racing Pack (CC0 1.0), vendor/vehicles/PROVENANCE.md. One box for every car: ${BOX.w} by ${BOX.h}, nose to the right. */
export const VEHICLE_BOX = { w: ${BOX.w}, h: ${BOX.h} };
export type VehicleBody = ${Object.keys(MAP).map(k => `'${k}'`).join(' | ')};
export const VEHICLES: Record<VehicleBody, string> = {
${Object.entries(out).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}
};
`;
if (process.argv.includes('--check')) { const same = existsSync(FILE) && readFileSync(FILE, 'utf8') === text; console.log(same ? `PASS  the vehicles match the licensed set: ${Object.keys(out).length} bodies` : 'FAIL  vehicles.generated.ts differs from what the set produces: run scripts/build-vehicles.mjs'); process.exit(same ? 0 : 1); }
writeFileSync(FILE, text); console.log(`wrote ${Object.keys(out).length} vehicles to vehicles.generated.ts`);
