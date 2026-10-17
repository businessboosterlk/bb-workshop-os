// Loads apps/web/src/app/core/data.service.ts in plain node for the B checks: esbuild bundles it with @angular/core
// replaced by angular-stub.mjs, into a temp folder. A memory localStorage and a fake fetch stand in for the browser.
// Synthetic data only, no network. Written by Claude, 17 Oct 2026.
import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { dirname, join } from 'node:path';
import { mkdtempSync, existsSync } from 'node:fs'; import { tmpdir } from 'node:os';
const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB = join(HERE, '..', '..', '..', 'apps', 'web');
const MAIN_WEB = '/Users/thulaibhassen/bb-systems/bb-workshop-os/apps/web';
const req = createRequire(join(existsSync(join(WEB, 'node_modules', 'esbuild')) ? WEB : MAIN_WEB, 'package.json'));
const esbuild = req('esbuild');
const mem = new Map();
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear(), _keys: () => [...mem.keys()] };
export async function loadData(){
  const out = join(mkdtempSync(join(tmpdir(), 'wos-web-')), 'data.mjs');
  await esbuild.build({ entryPoints: [join(WEB, 'src', 'app', 'core', 'data.service.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
    plugins: [{ name: 'ng', setup(b){ b.onResolve({ filter: /^@angular\/core$/ }, () => ({ path: join(HERE, 'angular-stub.mjs') })); } }] });
  return import(pathToFileURL(out).href);
}
/* a fake fetch: answer(url, init) returns { status, body } or 'network' to act as a network failure */
export function fakeFetch(answer){
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const a = await answer(String(url), init); if (a === 'network') throw new TypeError('Failed to fetch');
    return new Response(a.status === 204 ? null : JSON.stringify(a.body ?? {}), { status: a.status, headers: { 'content-type': 'application/json' } }); };
  return calls;
}
/* a DataService with stubbed services: seat = { kind, name, phone, owner } (change it any time, the getters read it live) */
export function makeService(m, seat, castOver = {}){
  const cast = { slug: 'tst', branches: [{ key: 'one', name: 'One', address: '', bays: 2 }], services: [], users: [], words: {}, data: { mode: 'api' }, ...castOver };
  globalThis.__wosInject = cls => cls.name === 'CastService'
    ? { cast: () => cast, config: () => ({ api: 'http://api.check' }), branch: () => null }
    : { name: () => seat.name, kind: () => seat.kind, phone: () => seat.phone || '', token: () => seat.token || 'tok-' + seat.name, owner: () => !!seat.owner };
  return new m.DataService();
}
/* a fetch that answers from the real API route handlers in this process: /api/<slug>/<table>[/<id>[/<command>]][?query] */
export function bridge(routes){
  return async (url, init = {}) => {
    const u = new URL(url); const seg = u.pathname.split('/').filter(Boolean).slice(1); const [slug, table, id, cmd] = seg;
    const mod = cmd ? routes.command?.[cmd] : id ? routes.item : routes.list; if (!mod) return { status: 404, body: { error: 'no route' } };
    const fn = mod[init.method || 'GET']; if (!fn) return { status: 405, body: {} };
    const res = await fn(new Request('http://check.local' + u.pathname + u.search, { method: init.method || 'GET', headers: init.headers, body: init.body }), { params: Promise.resolve({ slug, table, id }) });
    let body = null; try { body = await res.json(); } catch {} return { status: res.status, body };
  };
}
