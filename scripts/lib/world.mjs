/* What every Workshop OS runner shares: a server for the built app, answered at the root AND under
   the folder it is published in, and the two doors WALKED with the demo seats the doors print. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.HOME + '/bb-systems/batch/node_modules/playwright');
export const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const DIST = path.join(ROOT, 'apps/web/dist/web/browser');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
export function serve(dir = DIST, over = {}) {
  const srv = http.createServer((q, r) => {
    q.url = q.url.replace(/^\/bb-workshop-os(?=\/|$)/, '') || '/';
    const name = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    if (over[name] !== undefined) { r.writeHead(200, { 'Content-Type': TYPES[path.extname(name)] || 'text/plain', 'Cache-Control': 'no-store' }); return r.end(typeof over[name] === 'function' ? over[name]() : over[name]); }
    let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(fs.readFileSync(f));
  }).listen(0);
  return { srv, base: 'http://127.0.0.1:' + srv.address().port + '/bb-workshop-os/' };
}
export const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
export async function context(browser, { width = 390, height = 844, desk = false, dark = false } = {}) {
  const c = await browser.newContext(desk ? { viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' }
    : { viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: PHONE_UA, colorScheme: dark ? 'dark' : 'light' });
  await c.addInitScript(d => { try { if (!localStorage.getItem('wos_theme')) localStorage.setItem('wos_theme', d ? 'dark' : 'light'); } catch (e) {} }, dark);
  await c.route('**/fonts.g*/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  return c;
}
export async function staff(p, base, who = 'Miflal', pin = '1111') { await p.goto(base + '#/workshop/login'); await p.waitForSelector('#who'); await p.fill('#who', who); await p.fill('#pin', pin); await p.click('button[type=submit]'); await p.waitForFunction(() => /#\/workshop(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 }); await p.waitForSelector('.topbar'); }
export async function customer(p, base) { await p.goto(base + '#/car/login'); await p.waitForSelector('#ph'); await p.fill('#ph', '0771234567'); await p.click('button[type=submit]'); await p.waitForSelector('#code'); await p.fill('#code', '1234'); await p.click('button[type=submit]'); await p.waitForFunction(() => /#\/car(\/|$)/.test(location.hash) && !/login/.test(location.hash), null, { timeout: 15000 }); }
