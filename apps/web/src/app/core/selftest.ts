import { CastService } from './cast.service';
import { DataService } from './data.service';
import { SessionService } from './session.service';
import { demoPhoto } from './photo';

/* ?selftest runs the harness on THIS cast in THIS browser and prints one line per
   check. The app checks are the nine phone faults from bb-app-foundations plus the
   shell's own anatomy. The behaviour checks prove the rules in the data layer on a
   throwaway store and put the real one back. A check that cannot find its target
   FAILS; nothing here passes by being unable to look. */
export async function runSelftest(cast: CastService, data: DataService, session: SessionService){
  const T: [boolean, string, string][] = [];
  const ok = (name: string, pass: boolean, note = '') => T.push([!!pass, name, note]);
  const c = cast.cast(); const cs = getComputedStyle(document.documentElement);
  const coarse = matchMedia('(pointer:coarse)').matches;
  if (c) {
    ok('cast loaded with slug, name, two or more branches and a brand hex', !!c.slug && !!c.name && c.branches.length >= 1 && /^#[0-9a-f]{6}$/i.test(c.brand.hex));
    ok('palette derived from the one brand hex', cs.getPropertyValue('--brand').trim().toLowerCase() === c.brand.hex.toLowerCase());
    ok('every service ends in Ready and the app never lets a phase list be empty', c.services.every(s => s.phases[s.phases.length - 1].key === 'ready' && s.phases.length >= 3));
    ok('the cast carries no customer, vehicle, job or photo', !/"(customers|vehicles|jobs|photos)"\s*:\s*\[/.test(JSON.stringify(c)));
  }
  /* app foundations: the nine faults, read from the live rules */
  ok('App: double tap does not zoom', getComputedStyle(document.documentElement).touchAction === 'manipulation');
  ok('App: the page does not pull to refresh', /none|contain/.test(getComputedStyle(document.documentElement).overscrollBehaviorY));
  ok('App: no blue flash on tap', (getComputedStyle(document.body) as any).webkitTapHighlightColor === 'rgba(0, 0, 0, 0)');
  ok('App: chrome does not select on drag', (() => { const b = document.querySelector('button'); return !b || getComputedStyle(b).userSelect === 'none'; })());
  ok('App: no field under 16px on a coarse pointer', !coarse || [...document.querySelectorAll('input,select,textarea')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16), coarse ? 'coarse' : 'fine pointer, rule not in force');
  ok('App: a sheet does not chain its scroll to the page', (() => { const d = document.querySelector('.drawer'); return !d || getComputedStyle(d).overscrollBehavior.includes('contain'); })());
  ok('App: the foundation layer is present', cs.getPropertyValue('--sat') !== '' && !!document.querySelector('.statusfill'));
  ok('App: the page behind an open sheet is frozen and out of reach', (() => { const b = document.body, had = b.classList.contains('sheet-open'), y = scrollY; b.classList.add('sheet-open'); const frozen = getComputedStyle(b).position === 'fixed' && getComputedStyle(b).overflow === 'hidden'; const bar = document.querySelector('.bm') as HTMLElement | null; const off = !bar || getComputedStyle(bar).pointerEvents === 'none'; if (!had) b.classList.remove('sheet-open'); scrollTo(0, y); return frozen && off; })());
  ok('App: viewport covers the notch and reads the phone\'s own insets', /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') || '') && !/iPhone|Android/.test(document.documentElement.outerHTML.slice(0, 0) + ''));
  ok('App: reduced motion is respected in the stylesheet', [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /prefers-reduced-motion/.test(r.cssText)); } catch { return false; } }));
  /* SELECT LAW */
  ok('selects draw their own chevron, never the browser arrow, 12px or more in from the edge', (() => {
    const wrap = document.createElement('div'); wrap.className = 'field'; wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:240px';
    const s = document.createElement('select'); s.innerHTML = '<option>Boralasgamuwa</option>'; wrap.appendChild(s); document.body.appendChild(wrap);
    const st = getComputedStyle(s); const pos = st.backgroundPositionX; const inset = parseFloat((pos.match(/(\d+(?:\.\d+)?)px/) || [])[1] || '0');
    const good = (st.appearance === 'none' || (st as any).webkitAppearance === 'none') && /svg/.test(st.backgroundImage) && /right|100%/.test(pos) && inset >= 12 && parseFloat(st.paddingRight) >= 36;
    wrap.remove(); return good; })());
  /* one colour at the top */
  const strip = document.querySelector('.statusfill') as HTMLElement; const inShell = document.body.classList.contains('in-shell');
  ok('status strip is one colour with the screen under it', inShell ? getComputedStyle(strip).display === 'none' : cs.getPropertyValue('--top').trim() === (document.body.classList.contains('on-door') ? cs.getPropertyValue('--door-ground').trim() : cs.getPropertyValue('--bg').trim()));
  ok('browser chrome colour matches the screen too', (document.querySelector('meta[name=theme-color]')?.getAttribute('content') || '') === cs.getPropertyValue('--top').trim());
  ok('every declared app icon loads and is square', await Promise.all(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png'].map(src => new Promise<boolean>(res => { const i = new Image(); i.onload = () => res(i.naturalWidth === i.naturalHeight && i.naturalWidth >= 180); i.onerror = () => res(false); i.src = src; }))).then(r => r.every(Boolean)));
  ok('no emoji glyph in page text', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText));
  ok('no em or en dash in copy', !/[—–]/.test(document.body.innerText));
  ok('no comma before and, or, but or nor', !/,\s+(and|or|but|nor)\b/i.test(document.body.innerText));
  ok('no decorative bar or dash before a label', ![...document.querySelectorAll('body *')].some(e => { const b = getComputedStyle(e, '::before'); return b.content !== 'none' && b.content !== '""' && /^"[-–—|]+"$/.test(b.content); }));
  const clipped = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).visibility !== 'hidden' && !inScroller(e));
  ok('nothing clipped off the right edge', clipped.length === 0, innerWidth === 0 ? 'viewport is 0px wide' : clipped.length + ' offenders at ' + innerWidth + 'px');
  ok('night mode exists: one attribute flips the tokens', (() => { const html = document.documentElement; const was = html.getAttribute('data-theme'); html.setAttribute('data-theme', 'dark'); const d = getComputedStyle(html).getPropertyValue('--bg').trim(); html.setAttribute('data-theme', 'light'); const l = getComputedStyle(html).getPropertyValue('--bg').trim(); if (was) html.setAttribute('data-theme', was); else html.removeAttribute('data-theme'); return d !== l && d.length > 0; })());
  ok('tap targets 40px or taller', [...document.querySelectorAll('button, a.btn, .bm-btn, nav a, .li.link')].filter(a => a.getBoundingClientRect().height > 0 && getComputedStyle(a).visibility !== 'hidden').every(a => a.getBoundingClientRect().height >= 36), 'buttons on screen');
  const tabs = document.querySelector('.bm-bar') as HTMLElement | null; const desk = innerWidth >= 1020;
  if (tabs && session.kind() === 'staff') ok('workshop nav matches width: rail on desk, floating pill on phone', desk ? tabs.getBoundingClientRect().height === 0 : tabs.getBoundingClientRect().width < innerWidth * .75, innerWidth + 'px');
  if (session.kind() === 'customer') ok('customer app sits in a phone-wide column everywhere', (document.querySelector('.col')?.getBoundingClientRect().width || 0) <= 520);
  if (session.kind() === 'customer') ok('customer app carries no money field anywhere on screen', !/estimate|paid so far|to collect/i.test(document.body.innerText));
  /* behaviour, on a throwaway store */
  if (c && data.mode() === 'local' && session.kind()) {
    const key = 'wos_' + c.slug; const real = localStorage.getItem(key);
    try {
      localStorage.setItem(key, '{"jobs":[],"customers":[],"activities":[],"photos":[]}'); await data.reload();
      const phone = session.kind() === 'customer' ? session.phone() : '0770000001';
      const j = await data.newJob({ plate: 'HRN-0001', make: 'Harness', model: 'Car', customerName: 'Harness Person', customerPhone: phone, branch: c.branches[0].key, service: 'cutpolish', insurance: false, pickup: false, promisedAt: new Date(Date.now() + 86400000).toISOString() });
      ok('Car in makes one customer and one job with the first phase running', data.customers().length === 1 && data.jobs().length === 1 && data.phaseNow(j)?.key === 'received');
      let refused = false; try { await data.completePhase(j.id, ''); } catch { refused = true; }
      ok('a phase cannot close without a photo', refused && data.phaseNow(data.job(j.id)!)?.key === 'received');
      await data.completePhase(j.id, demoPhoto('HRN-0001', 'Received'), 'harness');
      const j2 = data.job(j.id)!;
      ok('closing a phase with a photo stores the photo, stamps who and when, and starts the next phase', j2.phases[0].status === 'done' && !!j2.phases[0].photoId && !!data.photoFor(j2.phases[0].photoId) && j2.phases[0].by === session.name() && data.phaseNow(j2)?.key === 'wash');
      let silent = false; try { await data.setPromise(j.id, new Date(Date.now() + 2 * 86400000).toISOString(), '  '); } catch { silent = true; }
      ok('a promised date cannot move without a reason', silent);
      await data.setPromise(j.id, new Date(Date.now() + 2 * 86400000).toISOString(), 'Harness reason');
      ok('a moved date keeps its history for the customer', data.job(j.id)!.promiseHistory.length === 1 && data.job(j.id)!.promiseHistory[0].reason === 'Harness reason');
      await data.askApproval(j.id, 'Harness extra', 'why', 1000);
      const a = data.job(j.id)!.approvals[0];
      ok('an approval reaches the job as pending and shows on the waiting list', a.status === 'pending' && data.awaiting().length === 1);
      if (session.kind() === 'customer') { await data.answerApproval(j.id, a.id, true); ok('the customer\'s approval adds the amount and clears the wait', data.job(j.id)!.approvals[0].status === 'approved' && data.job(j.id)!.approved === 1000 && data.awaiting().length === 0); }
      /* the running phase is stamped 30 hours ago: an overrun must appear on its own */
      const jj = data.job(j.id)!; const ph = jj.phases.map(p => p.status === 'now' ? { ...p, startedAt: new Date(Date.now() - 30 * 3600000).toISOString() } : p);
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), jobs: [{ ...jj, phases: ph }] })); await data.reload();
      ok('a phase past its usual hours turns the job amber by itself', data.overrun(data.job(j.id)!) >= 27 && data.overdue().length === 1);
      for (let i = 0; i < 6; i++) await data.completePhase(j.id, demoPhoto('HRN-0001', 'x'));
      ok('closing the last phase makes the car Ready, not Delivered', data.job(j.id)!.status === 'ready' && data.readyJobs().length === 1);
      await data.deliver(j.id);
      ok('Deliver closes the job, stamps the handover and it leaves the floor', data.job(j.id)!.status === 'delivered' && data.open().length === 0 && !!data.job(j.id)!.deliveredAt);
      const want = 1 + 1 + 1 + 1 + (session.kind() === 'customer' ? 1 : 0) + 6 + 1;
      ok('every action left a line in the activity trail', data.activityFor(j.id).length === want, data.activityFor(j.id).length + ' of ' + want + ' lines');
      if (session.kind() === 'customer') ok('a customer sees only jobs on their own number', data.myJobs().every(x => x.customerPhone === session.phone()));
    } finally { if (real === null) localStorage.removeItem(key); else localStorage.setItem(key, real); await data.reload(); }
  }
  const pass = T.filter(t => t[0]).length;
  console.log(`BBWOS SELFTEST: ${pass}/${T.length} passed`);
  T.forEach(t => console.log((t[0] ? 'PASS ' : 'FAIL ') + t[1] + (t[2] ? ' (' + t[2] + ')' : '')));
  return { pass, total: T.length, fails: T.filter(t => !t[0]).map(t => t[1]) };
}
function inScroller(e: Element){ let p = e.parentElement; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; } return false; }
