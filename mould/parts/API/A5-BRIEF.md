PART A5 of the Workshop OS API (a garage system; Next 15 route handlers in plain JavaScript ES modules, Node 22). Security fix for audit finding E10.

THE FAULT. CORS is set as a static header in next.config.mjs, so every answer carries the FIRST origin of the list whoever asked, with no Vary header (a shared cache can then hand one origin's answer to another). Here is the current code, exactly:

```js
const ORIGINS = (process.env.WOS_ORIGINS || 'http://localhost:8771,https://businessboosterlk.github.io').split(',');
// ... headers: [
//   { key: 'Access-Control-Allow-Origin', value: ORIGINS[0] },
//   { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
//   { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-BB-Admin' } ]
```

The fix moves CORS into a Next middleware that answers per request. YOU WRITE ONE FILE: apps/api/lib/cors.js, pure functions only, no imports. The middleware (written by Claude, for your information) does:

```js
const h = corsHeaders(req.headers.get('origin'), allowedOrigins());
// OPTIONS: return a 204 with headers h; any other method: pass through and set every header in h on the response
```

Export exactly these two functions:

1. `export function allowedOrigins(raw = process.env.WOS_ORIGINS)`
   - raw is a comma separated string of origins, or undefined.
   - If raw is not a string or is empty after trimming, use the default 'http://localhost:8771,https://businessboosterlk.github.io'.
   - Split on commas, trim each entry, drop empty entries, return the array (order kept). Read process.env only through the default parameter, so it is read on every call.

2. `export function corsHeaders(origin, list)`
   - origin is the request's Origin header: a string, or null or undefined when absent.
   - list is the array from allowedOrigins().
   - ALWAYS include `'Vary': 'Origin'`.
   - ONLY when origin is a non empty string AND list.includes(origin) (exact, case sensitive, no trimming of the origin, no prefix or suffix match, no wildcard: a '*' in the list matches nothing but the literal string '*', and the literal origin '*' is never echoed) add:
     `'Access-Control-Allow-Origin': origin`,
     `'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'`,
     `'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BB-Admin'`,
     `'Access-Control-Max-Age': '600'`.
   - Otherwise return only the Vary header. Never echo an unlisted origin, never send '*', never send Access-Control-Allow-Credentials (the app sends a Bearer token, not cookies).
   - Return a new plain object of string values.

TRAPS.
- 'https://a.example.evil.example' must not match 'https://a.example'; use exact equality through includes, never startsWith, endsWith or a regular expression.
- The browser sends the string 'null' as the origin for sandboxed pages; it is unlisted unless the list literally holds 'null' (it never should).

Return ONE ```js code block holding the complete file, with a two line comment at the top in British English.
