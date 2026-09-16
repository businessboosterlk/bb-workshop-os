/* BB OPTICAL CENTRE CHECK. Born 17 Sep 2026 after Thulaib looked at the Workshop OS
   progress ring and saw "6 of 10" sitting high in its circle. Every harness BB had was
   green, because none of them looked at pixels: a text box can be perfectly centred while
   the ink inside it is not.

   What it measures: screenshot one element at 3x, find the colour that fills the inside of
   the shape, treat every pixel that differs from it as ink, take the ink's bounding box and
   compare its centre with the shape's centre. Result in CSS pixels. Nothing about fonts,
   line-height or DOM boxes is trusted.

   measure(page, selector, { shape: 'circle' | 'rect', inset: px, index: n })
     shape circle  only pixels inside (radius - inset) count, so a ring's own stroke is ignored
     shape rect    only pixels inside the box shrunk by inset count, so borders are ignored
   returns { dx, dy, w, h, inkW, inkH } or { error } */
export async function measure(page, selector, opts = {}) {
  const { shape = 'rect', inset = 2, index = 0, threshold = 70, hide = '', save = '', baseline = false } = opts;
  const el = page.locator(selector).nth(index);
  if (!(await el.count())) return { error: 'not found' };
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox(); if (!box || box.width < 4) return { error: 'not visible' };
  /* hide: decorations that are meant to sit off centre (a notification dot) are hidden for the reading */
  if (hide) await el.evaluate((n, h) => n.querySelectorAll(h).forEach(x => { x.dataset.bbHide = x.style.visibility; x.style.visibility = 'hidden'; }), hide);
  /* the element's own corner radius, so a rounded button's corners are never read as ink */
  const radius = await el.evaluate(n => parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0);
  /* page-wide overlays (a fixed tab bar, a toast) are hidden while this element is read */
  const { cover = '', cap = .727 } = opts;
  /* the font size of the first visible word, so a label's capital band can be placed on its baseline */
  const fontPx = baseline ? await el.evaluate(n => { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: t => t.textContent.trim() && t.parentElement && t.parentElement.getClientRects().length ? 1 : 3 }); const t = w.nextNode(); return t ? parseFloat(getComputedStyle(t.parentElement).fontSize) : 0; }) : 0;
  if (cover) await page.evaluate(c => document.querySelectorAll(c).forEach(x => { x.dataset.bbCover = x.style.visibility; x.style.visibility = 'hidden'; }), cover);
  const png = await el.screenshot({ animations: 'disabled', scale: 'device', ...(save ? { path: save } : {}) });
  if (hide) await el.evaluate((n, h) => n.querySelectorAll(h).forEach(x => { x.style.visibility = x.dataset.bbHide || ''; }), hide);
  if (cover) await page.evaluate(c => document.querySelectorAll(c).forEach(x => { x.style.visibility = x.dataset.bbCover || ''; }), cover);
  return page.evaluate(async ({ b64, shape, inset, threshold, cssW, cssH, radius, baseline, fontPx, cap }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight, k = W / cssW;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, W, H).data;
    /* a 1.5 device pixel guard inside every edge: a box that lands on a fraction of a pixel blends
       one edge row into the page, and that row must never be read as ink (17 Sep 2026, WhatsApp square) */
    const G = 1.5;
    const inside = (x, y) => shape === 'circle'
      ? Math.hypot(x + .5 - W / 2, y + .5 - H / 2) <= Math.min(W, H) / 2 - inset * k - G
      : (() => { const i = inset * k + G, l = i, t = i, R = W - i, B = H - i, r = Math.min(Math.max(0, radius * k - inset * k * .3 - G), (R - l) / 2, (B - t) / 2);
          if (x < l || y < t || x >= R || y >= B) return false;
          const px = x + .5, py = y + .5, cxr = px < l + r ? l + r : px > R - r ? R - r : px, cyr = py < t + r ? t + r : py > B - r ? B - r : py;
          return Math.hypot(px - cxr, py - cyr) <= r + .01; })();
    /* the fill is the commonest colour inside the shape */
    const counts = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!inside(x, y)) continue; const i = (y * W + x) * 4; const key = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3); counts.set(key, (counts.get(key) || 0) + 1); }
    if (!counts.size) return { error: 'nothing to read inside the shape (inset or baseline too tight)' };
    const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(v => +v * 8 + 4);
    /* the threshold follows the contrast inside this shape: grey on white and white on black read alike */
    let maxDiff = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!inside(x, y)) continue; const i = (y * W + x) * 4; const dd = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]); if (dd > maxDiff) maxDiff = dd; }
    const cut = Math.max(threshold * .4, maxDiff * .25);
    let x0 = W, y0 = H, x1 = -1, y1 = -1; const rows = new Array(H).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue; const i = (y * W + x) * 4;
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > cut) { rows[y]++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { error: 'no ink' };
    /* baseline: words are centred on their letters, not on the tails of p, g and y. The baseline
       is the last row that still carries a real share of the ink; the thin rows below it are tails. */
    if (baseline) { const peak = Math.max(...rows); let last = y1; while (last > y0 && rows[last] < peak * .22) last--; y1 = last;
      /* and the top is the capital height above that baseline (Inter .727 em), so an ascender or an i dot does not pull the reading up */
      if (fontPx) y0 = Math.round(y1 + 1 - cap * fontPx * k); }
    const inkCx = (x0 + x1 + 1) / 2, inkCy = (y0 + y1 + 1) / 2;
    const r = v => Math.round(v * 100) / 100;
    return { dx: r((inkCx - W / 2) / k), dy: r((inkCy - H / 2) / k), w: r(cssW), h: r(cssH), inkW: r((x1 - x0 + 1) / k), inkH: r((y1 - y0 + 1) / k) };
  }, { b64: png.toString('base64'), shape, inset, threshold, cssW: box.width, cssH: box.height, radius, baseline, fontPx, cap });
}
/* run a list and print a table; exits non-zero on any miss */
/* THE STANDARD, 17 Sep 2026.
   Shapes and icons: within `tolerance` (0.5 CSS px). The browser can place them anywhere.
   Anything carrying TEXT (c.text): within tolerance plus one device pixel. Text lands on whole CSS
   pixels, so the best placement a word can have is half a pixel from true centre, and this reading
   resolves to one device pixel. Below that no eye can see a difference; above it is a fault. */
export async function report(page, checks, tolerance = 0.5) {
  let bad = 0; const rows = [];
  const dpr = await page.evaluate(() => devicePixelRatio || 1);
  for (const c of checks) {
    const m = await measure(page, c.sel, c);
    const tol = c.text ? Math.round((tolerance + 1 / dpr) * 100) / 100 : tolerance;
    const ok = !m.error && Math.abs(m.dx) <= (c.tolX ?? tol) && Math.abs(m.dy) <= (c.tolY ?? tol);
    if (!ok) bad++;
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(46)} ${m.error ? m.error : `dx ${String(m.dx).padStart(6)}  dy ${String(m.dy).padStart(6)}  within ${tol}px  (box ${m.w}x${m.h}, ink ${m.inkW}x${m.inkH})`}`);
  }
  return { bad, rows };
}
