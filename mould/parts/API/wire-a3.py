# Claude's wiring for A3: the item PATCH calls customerAnswer() for a customer seat. Run once from the worktree root.
p = 'apps/api/app/api/[slug]/[table]/[id]/route.js'; s = open(p).read()
s = s.replace("import { session, deny } from '../../../../../lib/auth.js';", "import { session, deny } from '../../../../../lib/auth.js';\nimport { customerAnswer } from '../../../../../lib/answer.js';")
old = """/* a customer may patch exactly one thing on their own job: the answer to an approval, or a rating */
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const allowed = ['approvals', 'approved', 'rating']; if (Object.keys(body).some(k => !allowed.includes(k))) return deny('Not yours', 403);
  } else if"""
new = """/* a customer may send exactly one thing on their own job: the answer to one pending approval ({ approvalId, status })
   or a rating ({ rating }) once it is delivered. The server builds the change from the stored job (lib/answer.js) and
   takes no number from the customer. The same answer twice is a no-op. */
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null); if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const cur = await store.get(g.slug, g.table, g.id); if (!cur) return deny('Not found', 404);
  if (g.s.kind === 'customer') {
    if (g.table !== 'jobs' || !g.s.phone || cur.customerPhone !== g.s.phone) return deny('Not yours', 403);
    const a = customerAnswer(cur, body, g.s, new Date().toISOString());
    if (a.error) return Response.json({ error: a.error }, { status: a.status });
    const row = a.patch ? await store.update(g.slug, 'jobs', g.id, a.patch) : cur;
    if (a.patch) await store.audit(g.slug, g.s.phone, 'answer', 'jobs', g.id);
    const out = await project(g.slug, 'jobs', g.s, row); return Response.json(out || { id: g.id });
  } else if"""
assert old in s; s = s.replace(old, new); open(p, 'w').write(s); print('wired', p)
