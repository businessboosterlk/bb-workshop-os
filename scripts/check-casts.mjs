#!/usr/bin/env node
/* Refuses any cast that carries what a cast must never carry. The repo is public,
 * so a cast is a public file: brand, branches, services, phase templates and words.
 * A cast that carries a customer, a vehicle, a job, a key or a secret fails the build.
 * The only phone numbers allowed are the branches' own public lines. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), 'casts');
const PRIVATE = path.join(DIR, 'private');
const FORBIDDEN_KEYS = ['customers', 'vehicles', 'jobs', 'photos', 'activities', 'approvals', 'enquiries', 'quotes', 'contacts', 'pinHash', 'serviceRole', 'service_role', 'anonKey', 'apiKey', 'secret', 'token'];
const REQUIRED = ['slug', 'name', 'brand', 'branches', 'services', 'users', 'words', 'aliases', 'data'];
let bad = 0, n = 0;

function walk(o, trail, hits){
  if(Array.isArray(o)){ o.forEach((v, i) => walk(v, trail + '[' + i + ']', hits)); return; }
  if(o && typeof o === 'object'){
    for(const k of Object.keys(o)){
      if(FORBIDDEN_KEYS.includes(k) && (typeof o[k] === 'object' || /key|secret|token|role/i.test(k))) hits.push(trail + '.' + k);
      walk(o[k], trail + '.' + k, hits);
    }
  }
}
const files = [
  ...(await readdir(DIR)).filter(f => f.endsWith('.json')).map(f => ({ f, dir: DIR, priv: false })),
  ...(await readdir(PRIVATE).catch(() => [])).filter(f => f.endsWith('.json')).map(f => ({ f, dir: PRIVATE, priv: true }))
];
for(const { f, dir, priv } of files){
  n++;
  const cast = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
  const problems = [];
  for(const k of REQUIRED) if(!(k in cast)) problems.push('missing ' + k);
  if(cast.slug !== f.replace('.json', '')) problems.push('slug does not match file name');
  if(!/^#[0-9a-f]{6}$/i.test(cast.brand?.hex || '')) problems.push('brand.hex is not a six digit hex');
  if(!Array.isArray(cast.branches) || cast.branches.length < 1) problems.push('at least one branch');
  for(const b of cast.branches || []){
    if(!b.key || !b.name) problems.push('a branch needs a key and a name');
    if(b.wa && !/^94\d{9}$/.test(b.wa)) problems.push('branch ' + b.key + ' wa is not a 94 number');
  }
  /* every service needs an ordered list of phases ending in ready; the app appends delivered itself */
  for(const s of cast.services || []){
    if(!s.key || !s.label || !Array.isArray(s.phases) || s.phases.length < 3) problems.push('service ' + (s.key || '?') + ' needs a key, a label and at least three phases');
    else if(s.phases[s.phases.length - 1].key !== 'ready') problems.push('service ' + s.key + ' must end in the ready phase');
    for(const p of s.phases || []) if(typeof p.hours !== 'number' || p.hours < 0) problems.push('phase ' + s.key + '/' + p.key + ' needs hours');
  }
  if(!(cast.users || []).some(u => u.role === 'owner')) problems.push('one user must be the owner');
  const fd = (cast.followups || []).map(f => f.days);
  if(fd.some((d, i) => !(d >= 1) || (i > 0 && d <= fd[i - 1]))) problems.push('follow-up days must be 1 or more and rise: ' + fd.join(', '));
  if(cast.quote && (!/^[A-Z]{1,4}(-[A-Z]{1,3})?$/.test(cast.quote.prefix || '') || !(cast.quote.validDays >= 1))) problems.push('quote needs a short capital prefix and validDays of 1 or more');
  if(!['local','api'].includes(cast.data?.mode)) problems.push('data.mode must be local or api');
  if(cast.data?.mode === 'api' && ((cast.users || []).some(u => u.pin) || cast.customerCode)) problems.push('an api cast must not carry pins or a customer code: seats and codes live on the server');
  const hits = []; walk(cast, 'cast', hits);
  if(hits.length) problems.push('forbidden keys: ' + hits.join(', '));
  /* a phone number anywhere outside the branches' own lines is a leak */
  const text = JSON.stringify({ ...cast, branches: (cast.branches || []).map(b => ({ ...b, wa: '' })) });
  const phones = (text.match(/\b0?7\d[\d\s-]{7,}\b/g) || []).filter(p => p.replace(/\D/g, '').length >= 9);
  if(phones.length) problems.push('phone numbers in cast: ' + phones.join(', '));
  if(cast.data?.mode === 'api' && !priv) problems.push('a server client in the public casts folder: move it to casts/private (gitignored)');
  const label = (priv ? 'private/' : '') + f;
  if(problems.length){ bad++; console.log('FAIL ' + label + '\n  ' + problems.join('\n  ')); }
  else console.log('ok   ' + label);
}
console.log(bad ? `RESULT: ${bad} of ${n} casts FAIL` : `RESULT: ALL GREEN (${n} casts)`);
process.exit(bad ? 1 : 0);
