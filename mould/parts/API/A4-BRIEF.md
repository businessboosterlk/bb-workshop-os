PART A4 of the Workshop OS API (a garage system; Next 15 route handlers in plain JavaScript ES modules, Node 22). Security fix for audit finding E07.

YOU WRITE ONE WHOLE FILE: apps/api/lib/auth.js. Here is the current file, exactly:

```js
/* A session is a signed token: slug, seat label, expiry. Signed with WOS_SECRET on the
   server, checked on every request, never stored. Ten days, then the door again. */
import { createHmac, timingSafeEqual } from 'node:crypto';
const SECRET = process.env.WOS_SECRET || (process.env.DATA_MODE === 'supabase' ? null : 'dev-only-secret');
const b64 = s => Buffer.from(s).toString('base64url');
const sign = body => createHmac('sha256', SECRET).update(body).digest('base64url');

export function issue(slug, seat){ /* seat = { kind, name, phone?, role?, branch? } */
  if (!SECRET) throw new Error('WOS_SECRET is not set');
  const body = b64(JSON.stringify({ slug, ...seat, exp: Date.now() + 30 * 86400000 }));
  return body + '.' + sign(body);
}
export function verify(token){
  if (!SECRET || !token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)); const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
export function session(req, slug){
  const h = req.headers.get('authorization') || '';
  const p = verify(h.replace(/^Bearer\s+/i, ''));
  return p && p.slug === slug ? p : null;
}
export function isAdmin(req){
  const k = process.env.BB_ADMIN_SECRET; const got = req.headers.get('x-bb-admin') || '';
  return !!k && got.length === k.length && timingSafeEqual(Buffer.from(got), Buffer.from(k));
}
export const deny = (msg = 'Sign in first', status = 401) => Response.json({ error: msg }, { status });
```

THE FAULTS.
1. When WOS_SECRET is missing the server signs with a public fallback string unless DATA_MODE is 'supabase'. Any deploy that forgets the secret lets anyone forge an owner token.
2. The comment says ten days; the code says 30 days.
3. There is no limit on wrong sign in tries, so a 4 digit PIN or a 4 digit text code can be guessed.

WHAT TO WRITE. Keep `session`, `isAdmin` and `deny` exactly as they are (same names, same behaviour). Keep the token format exactly (base64url JSON body, a dot, base64url HMAC SHA256 signature) so existing callers keep working. Change:

A. The secret is read LAZILY on every call through a function `secret()` (not a constant at import time), because the environment is set by the host and by tests after import:
   - If process.env.WOS_SECRET is a non empty string, use it.
   - Otherwise, ONLY when process.env.NODE_ENV === 'development' exactly, use the string 'dev-only-secret'.
   - Otherwise return null. DATA_MODE plays no part any more.
   `sign(body)` takes the key from secret(). `issue()` throws new Error('WOS_SECRET is not set') when secret() is null. `verify()` returns null when secret() is null or the token is empty.
B. Token lifetime: export `const TOKEN_DAYS = 10;` and use `Date.now() + TOKEN_DAYS * 86400000`. Keep the top comment saying ten days.
C. Sign in attempt limit, process local (a Map in this module; say so in a comment: it resets when the process restarts and is not shared between instances). Export exactly these three functions:
   - `export function loginLocked(key, now = Date.now())` returns true while that key is locked, else false. When a lock has expired, delete the entry and return false.
   - `export function loginFailed(key, now = Date.now())` records one wrong try for that key. Use constants MAX_TRIES = 5 and LOCK_MS = 15 * 60000. Keep for each key { count, first, lockedUntil }. If the entry's first wrong try is older than LOCK_MS and it is not locked, start the count again from this try. When the count reaches MAX_TRIES set lockedUntil = now + LOCK_MS. So five wrong tries lock the key and the sixth try is refused.
   - `export function loginSucceeded(key)` deletes the entry for that key.
   A key is any string; the route builds it (for example 'slug:staff:name' or 'slug:customer:phone').
D. Keep `timingSafeEqual` for the signature comparison and the length check before it.

TRAPS.
- Do not compute the secret once at module load; a test sets WOS_SECRET and NODE_ENV after importing the file.
- NODE_ENV 'production', 'test', missing or anything other than 'development' means no fallback.
- Do not log anything.
- Never import anything except from 'node:crypto'.

Return ONE ```js code block holding the complete file, with short comments in British English.
