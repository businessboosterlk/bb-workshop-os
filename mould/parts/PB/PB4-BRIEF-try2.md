PART PB4, TRY 2. Workshop OS (a garage system in Sri Lanka), Angular 19 component apps/web/src/app/pages/customer/job.component.ts, the customer's page for one car.

Your first answer was merged and every part passed its check on a 390px and a 1440px screen. The full gate also walks a 320px phone, and there one fault showed: the Payments card's three figures sit in three fixed columns, and on a 320px phone the figure "LKR 185,000" runs 1px past the edge of its column (the walk reports: customer-job: TEXT PAST THE EDGE OF ITS BOX by 1px: num, phone320 day and night).

THE FIX. The figure grid wraps when a column would be narrower than its figure: `.m3` uses `grid-template-columns:repeat(auto-fit,minmax(100px,1fr))` instead of three fixed columns. At 390px the card still has room for three columns of 100px or more, so it keeps one row there; at 320px the third figure moves to a second row. Nothing else changes.

The line as it is now:
```
{{lines:apps/web/src/app/pages/customer/job.component.ts:130:130}}
```

Return ONE ```ts code block holding one part, opened by this header line exactly (it is a merge marker):
`// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=    .pays{margin-top:14px | until=    @media (prefers-reduced-motion`
Write that same line with only the `.m3` grid columns changed as above. Every other rule and character stays exactly as it is, no character between one closing brace and the next selector. No explanation before or after the code block.
