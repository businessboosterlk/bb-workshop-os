/* A session is a signed token: slug, seat label, expiry. Signed with WOS_SECRET on the
   server, checked on every request, never stored. Ten days, then the door again. */
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64 = s => Buffer.from(s).toString('base64url');

function secret() {
  const s = process.env.WOS_SECRET;
  if (typeof s === 'string' && s.length > 0) return s;
  if (process.env.NODE_ENV === 'development') return 'dev-only-secret';
  return null;
}

const sign = body => createHmac('sha256', secret()).update(body).digest('base64url');

export const TOKEN_DAYS = 10;

export function issue(slug, seat) { /* seat = { kind, name, phone?, role?, branch? } */
  const key = secret();
  if (!key) throw new Error('WOS_SECRET is not set');
  const body = b64(JSON.stringify({ slug, ...seat, exp: Date.now() + TOKEN_DAYS * 86400000 }));
  return body + '.' + sign(body);
}

export function verify(token) {
  const key = secret();
  if (!key || !token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)); const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}

export function session(req, slug) {
  const h = req.headers.get('authorization') || '';
  const p = verify(h.replace(/^Bearer\s+/i, ''));
  return p && p.slug === slug ? p : null;
}

export function isAdmin(req) {
  const k = process.env.BB_ADMIN_SECRET; const got = req.headers.get('x-bb-admin') || '';
  return !!k && got.length === k.length && timingSafeEqual(Buffer.from(got), Buffer.from(k));
}

export const deny = (msg = 'Sign in first', status = 401) => Response.json({ error: msg }, { status });

/* Sign in attempt limit, process local (a Map in this module; it resets when the
   process restarts and is not shared between instances). */
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60000;
const attempts = new Map();

export function loginLocked(key, now = Date.now()) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > now) return true;
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    attempts.delete(key);
    return false;
  }
  if (entry.first + LOCK_MS <= now) {
    attempts.delete(key);
    return false;
  }
  return false;
}

export function loginFailed(key, now = Date.now()) {
  let entry = attempts.get(key);
  if (!entry) {
    entry = { count: 0, first: now, lockedUntil: null };
    attempts.set(key, entry);
  } else if (!entry.lockedUntil && entry.first + LOCK_MS <= now) {
    entry.count = 0;
    entry.first = now;
  }
  entry.count += 1;
  if (entry.count >= MAX_TRIES) {
    entry.lockedUntil = now + LOCK_MS;
  }
}

export function loginSucceeded(key) {
  attempts.delete(key);
}
