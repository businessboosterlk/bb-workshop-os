THE APP: BB Workshop OS, Angular 19, standalone components, signals, the new control flow (@if, @for with track, @else).
No NgIf, no NgFor, no CommonModule, no other library. Template and styles inline in the component.

HOUSE RULES FOR EVERY UI PART (the check tests them):
- Icons ONLY as <bb-icon name="..."/> (import { IconComponent } from '<path>/ui/icon.component'). Never type an <svg>.
  Size an icon with the CSS variable --ico (for example --ico:16px), never width or height on bb-icon.
  Icon names available: car camera bay flag shield key truck star photo settings activity wrench history tick pause clock
  alert lock board list plus x chev check search filter edit part nophoto spray sparkle wheel timer move user users.
- Colours ONLY from these CSS variables (they flip for night mode): --bg --surface --surface-2 --line --line-2 --ink --ink-2
  --muted --faint --brand --brand-dark --brand-soft --on-accent --green --green-soft --amber --amber-soft --red --red-soft
  --blue --blue-soft. Radii --r-s (8px) --r (12px). Easing var(--ease). No hex, rgb or named colours in your styles.
- Global classes you may use: card (surface, hairline, radius), btn, btn ghost, btn soft, btn sm, pill, pill won (green),
  pill quoted (amber), pill new (blue), num (tabular figures). Font is inherited, never set font-family.
- Colour only for status: free green, busy brand, blocked red, waiting amber. Solid colours, NO pulsing, NO animation loops,
  no box-shadow on cards, no gradient, no decorative bar or dash before a heading or label.
- Every tap target at least 40px tall. Text never smaller than 11px. Labels never wrap mid-word: use
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap on single-line text that can be long.
- Words in British English, plain and short. NO em dash or en dash anywhere, no comma before "and" or "or".
  Use the middle dot " · " to join short facts on one line.
- Time in words: under 60 minutes "45 min", from 60 "2 h 30 min" (drop " 0 min": "3 h"). Write one helper for it.
- No Date.now(), no new Date() without an argument inside the component: times come in through inputs.
- No `any`. TypeScript strict must pass.
- ANGULAR TRAPS THAT FAILED BUILDS (15 Oct 2026, J1): a template sees ONLY members of the class, so an imported function or
  constant used in the template needs a class field (readonly niceWhen = niceWhen;). A signal is read as x() and written as
  x.set(v), never x(v). The check compiles with noUnusedLocals: import only what the code uses.
