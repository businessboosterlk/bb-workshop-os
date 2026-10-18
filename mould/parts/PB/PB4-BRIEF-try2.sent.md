PART PB4, TRY 2. Workshop OS (a garage system in Sri Lanka), Angular 19 component apps/web/src/app/pages/customer/job.component.ts, the customer's page for one car.

Your first answer was merged and every part passed its check on a 390px and a 1440px screen. The full gate also walks a 320px phone, and there one fault showed: the Payments card's three figures sit in three fixed columns, and on a 320px phone the figure "LKR 185,000" runs 1px past the edge of its column (the walk reports: customer-job: TEXT PAST THE EDGE OF ITS BOX by 1px: num, phone320 day and night).

THE FIX. The figure grid wraps when a column would be narrower than its figure: `.m3` uses `grid-template-columns:repeat(auto-fit,minmax(100px,1fr))` instead of three fixed columns. At 390px the card still has room for three columns of 100px or more, so it keeps one row there; at 320px the third figure moves to a second row. Nothing else changes.

The line as it is now:
```
    .pays{margin-top:14px;padding:16px}.m3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}.fig strong{display:block;font-size:15px;font-weight:700;margin-top:3px}.pl{margin-top:12px;border-top:1px solid var(--line)}.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.pt{flex:1;min-width:0}.pt strong{display:block;font-size:13px;font-weight:700}.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}.pa{font-weight:700;font-size:14px;white-space:nowrap}.pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}
```

Return ONE ```ts code block holding one part, opened by this header line exactly (it is a merge marker):
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .pays{margin-top:14px | until=    @media (prefers-reduced-motion`
Write that same line with only the `.m3` grid columns changed as above. Every other rule and character stays exactly as it is, no character between one closing brace and the next selector. No explanation before or after the code block.
