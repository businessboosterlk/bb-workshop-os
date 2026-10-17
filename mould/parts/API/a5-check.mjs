// A5 (audit E10): CORS answers with the requesting origin only when it is in the WOS_ORIGINS allowlist (exact match),
// always adds Vary: Origin, and never echoes an unlisted origin. The static header in next.config.mjs (always the first
// origin, whoever asked) is gone. Written by Claude BEFORE the crew ran.   node --no-warnings mould/parts/API/a5-check.mjs
import { imp, t, safe, done } from './harness.mjs';
const A = 'https://a.example', B = 'http://localhost:8771';
process.env.WOS_ORIGINS = ` ${A} ,, ${B} `;
const vary = h => String(h.Vary || h.vary || '').split(',').map(s => s.trim().toLowerCase()).includes('origin');
await safe('lib/cors.js', async () => {
  const { allowedOrigins, corsHeaders } = await imp('lib/cors.js');
  const list = allowedOrigins();
  t('the allowlist is read from WOS_ORIGINS, trimmed, empties dropped', JSON.stringify(list) === JSON.stringify([A, B]), JSON.stringify(list));
  t('an explicit list string is parsed the same way', JSON.stringify(allowedOrigins('x://one, x://two')) === JSON.stringify(['x://one', 'x://two']));
  const ha = corsHeaders(A, list), hb = corsHeaders(B, list);
  t('listed origin A is echoed', ha['Access-Control-Allow-Origin'] === A, JSON.stringify(ha));
  t('listed origin B is echoed', hb['Access-Control-Allow-Origin'] === B);
  t('a listed answer names the methods', /PATCH/.test(ha['Access-Control-Allow-Methods'] || '') && /DELETE/.test(ha['Access-Control-Allow-Methods'] || ''));
  t('a listed answer allows Authorization and Content-Type', /authorization/i.test(ha['Access-Control-Allow-Headers'] || '') && /content-type/i.test(ha['Access-Control-Allow-Headers'] || ''));
  t('a listed answer carries Vary: Origin', vary(ha));
  for (const [name, o] of [['an unlisted origin', 'https://evil.example'], ['a prefix trick', A + '.evil.example'], ['a different case', 'https://A.example'], ['a trailing slash', A + '/'], ['the null origin', 'null'], ['no origin', undefined], ['an empty origin', '']]) {
    const h = corsHeaders(o, list);
    t(name + ' gets no allow origin header', !('Access-Control-Allow-Origin' in h) && !Object.values(h).includes(o || '\u0000'), JSON.stringify(h));
    t(name + ' still gets Vary: Origin', vary(h));
  }
  t('a star is never sent', !Object.values(corsHeaders(A, ['*'])).includes('*') && !('Access-Control-Allow-Origin' in corsHeaders(A, ['*'])));
});
await safe('middleware.js', async () => {
  const { middleware, config } = await imp('middleware.js');
  t('the middleware runs on the API paths', JSON.stringify(config?.matcher || '').includes('/api/'));
  const get = middleware(new Request('http://check.local/api/tst/jobs', { headers: { origin: A } }));
  t('a GET from a listed origin is echoed', get.headers.get('access-control-allow-origin') === A, String(get.headers.get('access-control-allow-origin')));
  t('a GET carries Vary: Origin', /origin/i.test(get.headers.get('vary') || ''));
  const pre = middleware(new Request('http://check.local/api/tst/jobs', { method: 'OPTIONS', headers: { origin: B } }));
  t('a preflight from a listed origin answers 204 with the origin', pre.status === 204 && pre.headers.get('access-control-allow-origin') === B, pre.status + ' ' + pre.headers.get('access-control-allow-origin'));
  const evil = middleware(new Request('http://check.local/api/tst/jobs', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
  t('a preflight from an unlisted origin gets no allow origin', evil.headers.get('access-control-allow-origin') === null);
  const evilGet = middleware(new Request('http://check.local/api/tst/jobs', { headers: { origin: 'https://evil.example' } }));
  t('a GET from an unlisted origin gets no allow origin', evilGet.headers.get('access-control-allow-origin') === null);
});
await safe('next.config.mjs', async () => {
  const cfg = (await imp('next.config.mjs')).default;
  const rules = typeof cfg.headers === 'function' ? await cfg.headers() : [];
  const flat = rules.flatMap(r => r.headers || []);
  t('next.config.mjs sends no static Access-Control-Allow-Origin', !flat.some(h => /access-control-allow-origin/i.test(h.key)), JSON.stringify(flat).slice(0, 120));
});
done('A5');
