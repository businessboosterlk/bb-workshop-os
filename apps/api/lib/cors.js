// CORS helper functions for the Workshop OS API.
// Resolves allowed origins and per-request CORS headers without wildcards.
export function allowedOrigins(raw = process.env.WOS_ORIGINS) {
  const DEFAULT = 'http://localhost:8771,https://businessboosterlk.github.io';
  if (typeof raw !== 'string' || raw.trim() === '') {
    raw = DEFAULT;
  }
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export function corsHeaders(origin, list) {
  const headers = { 'Vary': 'Origin' };
  if (typeof origin === 'string' && origin.length > 0 && list.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PATCH,DELETE,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-BB-Admin';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}
