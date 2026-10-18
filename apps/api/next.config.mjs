/** BB Client OS API. Next.js is used for its API routes only: the pages layer is the
 *  Angular app in apps/web, per ~/bb-systems/STACK-STANDARD.md. CORS is answered per
 *  request by middleware.js from the WOS_ORIGINS allowlist (exact match, Vary: Origin);
 *  a static header here would name one origin for every caller, so there is none. */
const nextConfig = {};
export default nextConfig;
