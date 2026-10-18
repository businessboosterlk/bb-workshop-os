// B5 (audit E05, web): the outbox in data.service.ts. One flush at a time; only a network failure or a 5xx waits in
// the outbox, a 400, 403, 404, 409 or 428 reaches the person at once; the outbox key names the signed in seat, so one
// person's queue never replays as another; every write carries an operation id (x-wos-op), the same on replay.
// Plain node with a fake fetch, no server. Written by Claude BEFORE the crew ran.   node --no-warnings mould/parts/API2/b5-check.mjs
import { t, safe, done } from '../API/harness.mjs';
import { loadData, makeService, fakeFetch } from './webharness.mjs';
const T0 = '2026-10-01T08:00:00.000Z';
const job = id => ({ id, plate: 'P' + id, customerPhone: '0711111111', branch: 'one', status: 'open', phases: [], approvals: [], promiseHistory: [], pickup: { wanted: false, status: 'none' }, createdAt: T0, updatedAt: T0 });
let net = { down: false, status: 200, gate: null };
const calls = fakeFetch(async (u, init) => {
  const m = init.method || 'GET'; if (m === 'GET') return { status: 200, body: /\/jobs\?/.test(u) || /\/jobs$/.test(u) ? [job('j1'), job('j2')] : [] };
  const snap = { ...net }; if (snap.gate) await snap.gate; const now = snap.gate ? snap : net;
  if (now.down) return 'network';
  if (now.status !== 200) return { status: net.status, body: { error: 'Refused by the server: ' + net.status } };
  return { status: 200, body: { ...job(String(u).split('/').pop()), updatedAt: new Date().toISOString() } };
});
const hdr = (c, k) => { const h = c.headers || {}; return h[k] ?? h[k.toLowerCase()] ?? (h.get && h.get(k)); };
const outKeys = () => localStorage._keys().filter(k => k.startsWith('wos_outbox'));
const all = () => outKeys().flatMap(k => JSON.parse(localStorage.getItem(k) || '[]'));
/* a save is a PATCH plus its activity POST; count the PATCHes */
const queued = () => all().filter(w => w.method === 'PATCH');
const m = await loadData();
const seat = { kind: 'staff', name: 'Ama', token: 'tok-ama' };
const d = makeService(m, seat); await d.init();
const save = (id, why) => d.setPromise(id, '2026-10-30T10:00:00.000Z', why);
await safe('only network failures and 5xx wait', async () => {
  net = { down: true, status: 200 }; await save('j1', 'offline one');
  let q = queued(); t('a network failure waits in the outbox', q.length === 1, String(q.length));
  t('the queued write carries an operation id', q[0] && typeof q[0].op === 'string' && q[0].op.length >= 6, JSON.stringify(q[0]).slice(0, 160));
  t('the outbox key names the workshop and the seat', outKeys().length === 1 && /tst/.test(outKeys()[0]) && /Ama/.test(outKeys()[0]), outKeys().join());
  net = { down: false, status: 503 }; await save('j2', 'server busy');
  t('a 503 waits in the outbox', queued().length === 2, String(queued().length));
  for (const s of [400, 403, 404, 409, 428]) {
    net = { down: false, status: s }; let err = null; try { await save('j1', 'refused ' + s); } catch (e) { err = e; }
    t(`a ${s} is not queued`, queued().length === 2, String(queued().length));
    t(`a ${s} reaches the person at once with the server's words`, !!err && /Refused by the server/.test(String(err.message)), String(err && err.message));
  }
  t('the pending count shows every waiting write', d.pending() === all().length && all().length >= 2, d.pending() + ' ' + all().length);
});
await safe('one flush at a time', async () => {
  const q0 = all(); let open; net = { down: false, status: 200, gate: new Promise(r => { open = r; }) };
  const n = calls.length; const a = d.adapter.flush(), b = d.adapter.flush(); open(); await Promise.all([a, b]); net.gate = null;
  const sent = calls.slice(n).filter(c => c.method !== 'GET');
  t('two flushes at once send each queued write once', sent.length === q0.length && new Set(sent.map(c => hdr(c, 'x-wos-op'))).size === q0.length, sent.length + ' of ' + q0.length);
  t('each replay carries its own operation id', sent.map(c => hdr(c, 'x-wos-op')).sort().join() === q0.map(w => w.op).sort().join(), sent.map(c => hdr(c, 'x-wos-op')).join() + ' vs ' + q0.map(w => w.op).join());
  t('the outbox is empty after the replay', all().length === 0 && d.pending() === 0);
  const n2 = calls.length; net = { down: false, status: 200 }; await save('j1', 'online'); const w = calls.slice(n2).find(c => c.method === 'PATCH');
  t('a write that goes straight through also carries an operation id', w && typeof hdr(w, 'x-wos-op') === 'string' && hdr(w, 'x-wos-op').length >= 6, JSON.stringify(w && w.headers));
});
await safe('a write queued during a flush is kept', async () => {
  net = { down: true, status: 200 }; await save('j1', 'before'); const ops0 = all().map(w => w.op);
  let open; net = { down: false, status: 200, gate: new Promise(r => { open = r; }) };
  const f = d.adapter.flush(); await new Promise(r => setTimeout(r, 5));
  net = { down: true, status: 200 }; await save('j2', 'during the flush'); const mid = all().filter(w => !ops0.includes(w.op)).map(w => w.op);
  open(); await f; net = { down: false, status: 200 };
  t('the write queued while the flush ran was queued', mid.length >= 1, String(mid.length));
  t('it is still in the outbox when the flush ends', mid.every(op => all().some(w => w.op === op)), JSON.stringify(all().map(w => w.op)) + ' wanted ' + mid.join());
  await d.adapter.flush(); t('the next flush sends it and empties the outbox', all().length === 0, String(all().length));
});
await safe('a seat never replays another seat', async () => {
  net = { down: true, status: 200 }; await save('j1', 'Ama offline'); t('Ama has one waiting write', queued().length === 1);
  seat.name = 'Bimal'; seat.token = 'tok-bimal'; net = { down: false, status: 200 };
  const n = calls.length; await d.adapter.flush(); await d.reload();
  const sent = calls.slice(n).filter(c => c.method !== 'GET');
  t("Bimal's flush sends nothing of Ama's", sent.length === 0, JSON.stringify(sent.map(c => c.url + ' ' + hdr(c, 'Authorization'))));
  t("Ama's write still waits for Ama", queued().length === 1);
  seat.name = 'Ama'; seat.token = 'tok-ama'; const n2 = calls.length; await d.adapter.flush();
  const back = calls.slice(n2).filter(c => c.method !== 'GET');
  t('when Ama is back her writes replay, with her token', back.length >= 1 && back.every(c => hdr(c, 'Authorization') === 'Bearer tok-ama') && hdr(back[0], 'Authorization') === 'Bearer tok-ama', JSON.stringify(back.map(c => hdr(c, 'Authorization'))));
});
await safe('replays the server refuses', async () => {
  net = { down: true, status: 200 }; await save('j2', 'will be refused'); t('one write waits', queued().length === 1);
  net = { down: false, status: 409 }; await d.adapter.flush();
  t('a replay the server refuses with 409 leaves the outbox (it can never succeed)', all().length === 0, String(queued().length));
  t('the person is told a waiting change was refused', /refused/i.test(JSON.stringify(d.toastMsg && d.toastMsg())), JSON.stringify(d.toastMsg && d.toastMsg()));
  net = { down: true, status: 200 }; await save('j2', 'auth later'); net = { down: false, status: 401 }; await d.adapter.flush();
  t('a 401 on replay keeps the write for after sign in', queued().length === 1, String(queued().length));
});
done('B5');
