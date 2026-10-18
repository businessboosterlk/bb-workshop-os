// A4 (audit E07, the P0 half): the signing secret fails closed outside explicit development, the token lives ten days as
// its comment says, sign in has an attempt limit (5 wrong tries then a 15 minute lock) and the OTP route never logs the
// code and refuses plainly in production instead of a fake send. Written by Claude BEFORE the crew ran.
//   node --no-warnings mould/parts/API/a4-check.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { imp, API, SLUG, t, safe, done, req, seats } from './harness.mjs';
delete process.env.WOS_SECRET; delete process.env.NODE_ENV; delete process.env.WOS_DEMO_CODE;
/* a synthetic workshop on disk: clients.js reads ../../casts from the working directory */
const ROOT = mkdtempSync(join(tmpdir(), 'wos-a4-')); mkdirSync(join(ROOT, 'casts')); mkdirSync(join(ROOT, 'apps', 'api'), { recursive: true });
writeFileSync(join(ROOT, 'casts', SLUG + '.json'), JSON.stringify({ slug: SLUG, name: 'Check Garage', users: [{ name: 'Staffer', pin: '1234', role: 'staff', branch: 'one' }, { name: 'Other', pin: '5678', role: 'staff', branch: 'one' }] }));
process.chdir(join(ROOT, 'apps', 'api'));
const auth = await imp('lib/auth.js');
const { store } = await imp('lib/store.js');
const clients = await imp('lib/clients.js');
const login = (await imp('app/api/login/route.js')).POST;
const otp = (await imp('app/api/otp/route.js')).POST;
const src = readFileSync(join(API, 'lib', 'auth.js'), 'utf8');
const days = tok => (JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString()).exp - Date.now()) / 86400000;
const throws = f => { try { f(); return false; } catch { return true; } };

await safe('secret', async () => {
  t('no secret, NODE_ENV unset: issue refuses', throws(() => auth.issue(SLUG, seats.staff)));
  process.env.NODE_ENV = 'production';
  t('no secret, production: issue refuses', throws(() => auth.issue(SLUG, seats.staff)));
  process.env.DATA_MODE = 'memory';
  t('no secret, production, memory mode: issue still refuses', throws(() => auth.issue(SLUG, seats.staff)));
  process.env.NODE_ENV = 'development';
  let devTok = null; try { devTok = auth.issue(SLUG, seats.staff); } catch {}
  t('no secret, explicit development: a dev token is issued', !!devTok);
  t('the dev token verifies in development', !!devTok && !!auth.verify(devTok));
  process.env.NODE_ENV = 'production';
  t('the dev token is refused in production with no secret', !!devTok && auth.verify(devTok) === null);
  process.env.WOS_SECRET = 'synthetic-check-secret-not-real-0000';
  t('the dev token is refused in production with the real secret', !!devTok && auth.verify(devTok) === null);
  let tok = null; try { tok = auth.issue(SLUG, seats.staff); } catch {}
  t('with the secret, production issues a token', !!tok);
  t('that token verifies', !!tok && auth.verify(tok)?.name === 'Staffer');
  t('the token lives ten days', !!tok && Math.abs(days(tok) - 10) < 0.01, tok ? days(tok).toFixed(3) : 'none');
  t('the comment still says ten days', /ten days/i.test(src));
  t('no thirty day lifetime left in the code', !/30\s*\*\s*86400000/.test(src));
  const [b, s] = tok.split('.'); const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url').toString()), role: 'owner' })).toString('base64url') + '.' + s;
  t('a token with a changed body is refused', auth.verify(forged) === null);
  process.env.WOS_SECRET = '';
  t('an empty secret in production refuses to issue', throws(() => auth.issue(SLUG, seats.staff)));
  process.env.WOS_SECRET = 'synthetic-check-secret-not-real-0000';
});
await safe('limiter functions', async () => {
  const k = 'unit:key', t0 = 1_000_000;
  t('a fresh key is not locked', auth.loginLocked(k, t0) === false);
  for (let i = 0; i < 4; i++) auth.loginFailed(k, t0 + i);
  t('four wrong tries do not lock', auth.loginLocked(k, t0 + 5) === false);
  auth.loginFailed(k, t0 + 5);
  t('the fifth wrong try locks the key', auth.loginLocked(k, t0 + 6) === true);
  t('still locked 14 minutes later', auth.loginLocked(k, t0 + 14 * 60000) === true);
  t('unlocked after 15 minutes', auth.loginLocked(k, t0 + 5 + 15 * 60000 + 1) === false);
  const k2 = 'unit:key2';
  for (let i = 0; i < 4; i++) auth.loginFailed(k2, t0);
  auth.loginSucceeded(k2); auth.loginFailed(k2, t0 + 1);
  t('a success clears the count', auth.loginLocked(k2, t0 + 2) === false);
  t('another key is untouched', auth.loginLocked('unit:other', t0 + 6) === false);
});
const L = body => login(req('POST', '/api/login', null, { slug: SLUG, ...body }));
await safe('login route', async () => {
  for (let i = 1; i <= 5; i++) { const r = await L({ name: 'Staffer', pin: '0000' }); t(`staff wrong try ${i} answers 401`, r.status === 401, String(r.status)); }
  const r6 = await L({ name: 'Staffer', pin: '1234' });
  t('staff sixth try is locked even with the right PIN', r6.status === 429, String(r6.status));
  const r7 = await L({ name: ' staffer ', pin: '1234' });
  t('the lock holds for the same name in other case and spacing', r7.status === 429, String(r7.status));
  const ok = await L({ name: 'Other', pin: '5678' });
  t('another staff name still signs in', ok.status === 200 && typeof (await ok.json()).token === 'string', String(ok.status));
  await store.create(SLUG, 'customers', { id: 'cA', name: 'Cust A', phone: seats.custA.phone });
  for (let i = 1; i <= 5; i++) { const r = await L({ kind: 'customer', phone: seats.custA.phone, code: '0000' }); t(`customer wrong code ${i} answers 401`, r.status === 401, String(r.status)); }
  const c6 = await L({ kind: 'customer', phone: seats.custA.phone, code: '0000' });
  t('customer sixth try is locked', c6.status === 429, String(c6.status));
});
/* capture everything the process prints while the OTP route runs */
const seen = []; const orig = {};
for (const m of ['log', 'info', 'warn', 'error', 'debug']) { orig[m] = console[m]; console[m] = (...a) => seen.push(a.map(String).join(' ')); }
const ow = process.stdout.write.bind(process.stdout), ew = process.stderr.write.bind(process.stderr);
process.stdout.write = (c, ...r) => { seen.push(String(c)); return true; }; process.stderr.write = (c, ...r) => { seen.push(String(c)); return true; };
const findCode = phone => { for (let c = 1000; c <= 9999; c++) if (clients.verifyCode(SLUG, phone, String(c))) return String(c); return null; };
const O = phone => otp(req('POST', '/api/otp', null, { slug: SLUG, phone }));
const res = {};
try {
  process.env.NODE_ENV = 'development';
  await store.create(SLUG, 'customers', { id: 'cB', name: 'Cust B', phone: seats.custB.phone });
  res.codes = [];
  for (let i = 0; i < 3; i++) { const r = await O(seats.custB.phone); res.devStatus = r.status; res.codes.push(findCode(seats.custB.phone)); }
  const u = await O('0799999999'); res.devUnknown = u.status;
  process.env.NODE_ENV = 'production';
  const p1 = await O(seats.custB.phone), p2 = await O('0799999999');
  res.prodKnown = p1.status; res.prodUnknown = p2.status; res.prodBody = await p1.text(); res.prodBody2 = await p2.text();
  res.prodCode = findCode(seats.custB.phone);
} catch (e) { res.crash = String(e && e.message || e); }
process.stdout.write = ow; process.stderr.write = ew; for (const m of Object.keys(orig)) console[m] = orig[m];
const out = seen.join('\n');
t('the OTP route ran without crashing', !res.crash, res.crash);
t('development: a known number gets a code issued (found by trying)', (res.codes || []).every(c => !!c), JSON.stringify(res.codes));
t('development: the reply is 200', res.devStatus === 200 && res.devUnknown === 200);
t('no OTP code appears in anything printed', (res.codes || []).filter(Boolean).every(c => !out.includes(c)), out.slice(0, 160));
t('the phone number is not printed either', !out.includes(seats.custB.phone));
t('production: the OTP route refuses plainly (503)', res.prodKnown === 503, String(res.prodKnown));
t('production: the same answer for an unknown number', res.prodKnown === res.prodUnknown && res.prodBody === res.prodBody2);
t('production: no code was issued', res.prodCode === null);
done('A4');
