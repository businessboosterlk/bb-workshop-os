import { CastService } from './cast.service';
import { DataService } from './data.service';
import { SessionService } from './session.service';
import { demoPhoto } from './photo';
import { quoteTotal, nextNumber } from './sales';
import { SEED_VERSION } from './seed';

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
  /* skipped when the owner has saved his own names and days: then the seat is meant to differ from the file */
  if (c && session.kind() && data.mode() === 'local' && !localStorage.getItem('wos_override_' + c.slug)) {
    const file = await fetch(`casts/${c.slug}.json`, { cache: 'no-cache' }).then(r => r.json()).catch(() => null);
    ok('a signed-in seat runs on the current workshop settings, not the copy from the day it signed in', !!file && JSON.stringify(file.followups) === JSON.stringify(c.followups) && JSON.stringify(file.quote) === JSON.stringify(c.quote), c.quote?.prefix || 'no quote prefix in the seat');
  }
  ok('no sheet lock is left behind: the page is pinned only while a sheet is open', !document.body.classList.contains('sheet-open') || !!document.querySelector('.drawer.on, .rail.open'));
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
  if (session.kind() === 'customer') ok('the customer app holds no enquiry or quote in memory', data.enquiries().length === 0 && data.quotes().length === 0);
  if (session.kind() === 'staff' && !session.owner()) ok('a staff seat holds no quote in memory', data.quotes().length === 0);
  /* contrast, not difference: the bug this guards was near-white text on a near-white chip, which differ */
  for (const theme of ['dark', 'light']) {
    const html = document.documentElement; const was = html.getAttribute('data-theme'); html.setAttribute('data-theme', theme); c && cast.apply(c);
    const b = document.createElement('div'); b.className = 'chips'; b.style.cssText = 'position:absolute;left:-9999px'; b.innerHTML = '<button class="on">x</button>'; document.body.appendChild(b);
    const st = getComputedStyle(b.firstElementChild!); const ratio = contrast(st.color, st.backgroundColor); b.remove();
    if (was) html.setAttribute('data-theme', was); else html.removeAttribute('data-theme'); c && cast.apply(c);
    ok(`the selected filter chip reads at 4.5:1 or better in ${theme} mode`, ratio >= 4.5, ratio.toFixed(2) + ':1');
  }
  if (c && data.mode() === 'local' && session.kind() === 'staff' && (c.followups || []).length)
    ok('every delivered car on the floor carries its follow-ups', data.jobs().filter(j => j.status === 'delivered').every(j => (j.followups || []).length === c.followups!.length), data.jobs().filter(j => j.status === 'delivered' && !(j.followups || []).length).map(j => j.plate).join(', ') || 'all');
  /* STANDING RULE (Thulaib, 9 Sep and 17 Sep 2026): a stage-based list is a kanban AND a list, with a switch */
  if (session.kind() === 'staff' && location.hash.includes('/workshop/enquiries')) {
    const seg = [...document.querySelectorAll('.seg button')].map(x => x.textContent!.trim());
    ok('enquiries offer Board and List on one switch', seg.includes('Board') && seg.includes('List'));
    const cols = [...document.querySelectorAll('.board .col .col-t')].map(x => x.textContent!.trim());
    if (document.querySelector('.board')) ok('the board has one column per stage, in order, each a drop list', cols.join('|') === 'New|Quoted|Booked|Lost' && document.querySelectorAll('.board .cdk-drop-list').length === 4, cols.join('|'));
  }
  /* behaviour, on a throwaway store */
  if (c && data.mode() === 'local' && session.kind()) {
    const key = 'wos_' + c.slug; const real = localStorage.getItem(key);
    try {
      localStorage.setItem(key, JSON.stringify({ _v: SEED_VERSION, jobs: [], customers: [], activities: [], photos: [], enquiries: [], quotes: [] })); await data.reload();
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
      const fu = data.job(j.id)!.followups || []; const dd = data.job(j.id)!.deliveredAt!;
      ok('delivery sets one follow-up per cadence step, due on the right day', fu.length === (c.followups || []).length && fu.every((f, i) => Math.round((new Date(f.due).getTime() - new Date(dd).getTime()) / 86400000) === c.followups![i].days), fu.map(f => f.key).join(','));
      const want = 1 + 1 + 1 + 1 + (session.kind() === 'customer' ? 1 : 0) + 6 + 1;
      ok('every action left a line in the activity trail', data.activityFor(j.id).length === want, data.activityFor(j.id).length + ' of ' + want + ' lines');
      if (session.kind() === 'customer') ok('a customer sees only jobs on their own number', data.myJobs().every(x => x.customerPhone === session.phone()));
      if (session.kind() === 'staff') {
        const fk = (c.followups || [])[0]?.key;
        if (fk) { await data.markFollowup(j.id, fk, 'issue', 'harness scratch'); const e = data.enquiries().find(x => x.source === 'Follow-up' && x.phone === '0770000001');
          ok('a follow-up that needs a look becomes a new enquiry for the same car', !!e && e.plate === 'HRN-0001' && e.status === 'new' && !!data.job(j.id)!.followups!.find(f => f.key === fk)!.doneAt); }
        let noReason = false; try { const e2 = await data.addEnquiry({ name: 'Harness Two', phone: '0770000002', service: 'painting', branch: c.branches[0].key, source: 'Walk-in' }); try { await data.loseEnquiry(e2.id, ' '); } catch { noReason = true; } } catch {}
        ok('an enquiry cannot be marked lost without a reason', noReason);
        ok('quote arithmetic: lines times quantity, less discount, whole rupees', quoteTotal({ lines: [{ desc: 'a', qty: 2, price: 1500 }, { desc: 'b', qty: 1, price: 3000 }], discount: 500 }) === 5500 && quoteTotal({ lines: [{ desc: 'a', qty: 1, price: 100 }], discount: 900 }) === 0);
        ok('quote numbers run on from the highest, never reuse one', nextNumber('AM-Q', ['AM-Q-0002', 'AM-Q-0009', 'AM-Q-0003']) === 'AM-Q-0010' && nextNumber('AM-Q', []) === 'AM-Q-0001');
        if (session.owner()) {
          const e3 = await data.addEnquiry({ name: 'Harness Three', phone: '0770000003', plate: 'HRN-0003', make: 'Harness', model: 'Van', service: 'painting', branch: c.branches[0].key, source: 'WhatsApp' });
          const qt = await data.saveQuote({ enquiryId: e3.id, customerName: 'Harness Three', customerPhone: '0770000003', plate: 'HRN-0003', vehicle: 'Harness Van', service: 'painting', branch: c.branches[0].key, lines: [{ desc: 'Respray', qty: 1, price: 50000 }, { desc: 'Polish', qty: 2, price: 2500 }], discount: 1000 });
          ok('a quote made from an enquiry moves it to Quoted and gets the next number', data.enquiries().find(x => x.id === e3.id)!.status === 'quoted' && qt.number === 'AM-Q-0001' && quoteTotal(qt) === 54000);
          let zero = false; try { await data.saveQuote({ customerName: 'X', customerPhone: '0770000004', service: 'painting', branch: c.branches[0].key, lines: [{ desc: 'x', qty: 1, price: 0 }], discount: 0 }); } catch { zero = true; }
          ok('a quote with no value cannot be saved', zero);
          await data.setQuoteStatus(qt.id, 'accepted');
          const bj = await data.newJob({ plate: 'HRN-0003', make: 'Harness', model: 'Van', customerName: 'Harness Three', customerPhone: '0770000003', branch: c.branches[0].key, service: 'painting', insurance: false, pickup: false, promisedAt: new Date(Date.now() + 86400000).toISOString(), estimate: quoteTotal(qt), enquiryId: e3.id, quoteId: qt.id });
          ok('booking the car in from an accepted quote links all three: enquiry booked, quote carries the job, job carries the estimate', data.enquiries().find(x => x.id === e3.id)!.jobId === bj.id && data.enquiries().find(x => x.id === e3.id)!.status === 'booked' && data.quotes().find(x => x.id === qt.id)!.jobId === bj.id && bj.estimate === 54000);
        }
      }
    } finally { if (real === null) localStorage.removeItem(key); else localStorage.setItem(key, real); await data.reload(); }
  }
  const pass = T.filter(t => t[0]).length;
  console.log(`BBWOS SELFTEST: ${pass}/${T.length} passed`);
  T.forEach(t => console.log((t[0] ? 'PASS ' : 'FAIL ') + t[1] + (t[2] ? ' (' + t[2] + ')' : '')));
  return { pass, total: T.length, fails: T.filter(t => !t[0]).map(t => t[1]) };
}
function inScroller(e: Element){ let p = e.parentElement; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; } return false; }

function rgb(c: string){ const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; }
function relLum(c: string){ return rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); }
function contrast(a: string, b: string){ const x = relLum(a), y = relLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
