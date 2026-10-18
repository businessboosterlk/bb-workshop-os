PART R5 of the Workshop OS (a garage system). Global stylesheet apps/web/src/styles.css, plain CSS.

THE JOB. The toast is the small dark message that rises from the bottom of the screen (`<div class="toast on">`, one element for the whole app, outside every page). Two faults:
1. It never wraps (`white-space:nowrap`), so a long message runs past both edges of a 390px phone. The message "Someone else changed this car a moment ago. It has been refreshed: make your change again." is the test. Rule: the toast wraps, its width is its text up to a cap of min(560px, 100vw minus 32px), the text is centred, and it is never wider than the screen.
2. On a desk (1020px and wider) it is moved right by half the staff side rail (`left:calc(50% + var(--side-w)/2)`), also on the customer page, which has no rail, so there it sits off centre. Rule: shift only when the staff rail is on screen. The rail is `<aside class="rail">`, present in the page only inside the staff shell, never on the customer pages or the staff sign-in. Select it with `body:has(.rail)`. Without the rail the toast stays centred on the viewport (`left:50%`).

FACTS THE RULE NEEDS.
- The toast is `position:fixed;left:50%` with `transform:translateX(-50%) translateY(8px)`. A fixed box with only `left` set shrinks to at most half the screen, so wrapping needs an explicit `width:max-content` together with the `max-width`. Keep `box-sizing:border-box` so the padding is inside the cap.
- Wrap long words too (`overflow-wrap:anywhere`). Centre the text (`text-align:center`).
- The button inside a toast (`.toast button`) is untouched.

CURRENT LINES 260 to 263 (the `.toast` rule and its `.on` state):
```css
{{lines:apps/web/src/styles.css:260:263}}
```
CURRENT LINE 265 (the desk shift):
```css
{{lines:apps/web/src/styles.css:265:265}}
```

WHAT TO WRITE. Return ONE ```css code block holding two parts, each opened by its header line exactly as shown, in this order. Nothing between parts but the next header.

Part 1 header line: `// BLOCK: apps/web/src/styles.css | start=.toast{position:fixed;left:50% | until=.toast button{margin-left:10px`
Lines 260 to 263 rewritten (the `.toast` rule over three lines like the original, then the `.toast.on` line unchanged). In the `.toast` rule: replace `white-space:nowrap` with `width:max-content;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;text-align:center;overflow-wrap:anywhere`. Every other declaration stays exactly as it is, in the same order.

Part 2 header line: `// BLOCK: apps/web/src/styles.css | start=@media (min-width:1020px){.toast{left: | until=body.sheet-open{position:fixed`
Line 265 on one line: the same media query and the same `left:calc(50% + var(--side-w)/2)`, now on the selector `body:has(.rail) .toast` instead of `.toast`.

TRAPS.
- Do not change any other rule, colour or number. No new rule, no new variable.
- Part 1 must still end with the `.toast.on{...}` line and part 2 is one line.
- No em or en dash, no comma before and, or, but, nor, in anything you write (comments included).
