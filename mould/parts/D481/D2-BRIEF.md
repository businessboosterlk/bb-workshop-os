PART D2. Workshop OS (a garage system in Sri Lanka), Angular 19 component apps/web/src/app/pages/workshop/shell.component.ts, the side menu (rail) of the staff app.

Your last answer was merged and passed every check. Looking at the screen showed one more fault in the same line: the seat block at the foot of the rail has about 75px for the words under the person's name. "Front desk · Wellawatte" does not fit, so it wraps onto three lines with the dot alone in the middle ("Front desk", "·", "Wellawatte").

THE FIX. The role and the branch become two lines, each its own `<em>` element (the rail's CSS already makes every `.r-foot em` a block line in the same small faint type). The first `<em>` holds the role words exactly as now (Owner, Front desk or Staff). When the seat has a branch, a second `<em>` follows it holding only the branch name, `{{ cast.branch(session.branch())?.name }}`. No dot, no separator, no new CSS, no new class.

The line as it is now:
```
{{lines:apps/web/src/app/pages/workshop/shell.component.ts:48:48}}
```

Return ONE ```ts code block holding one part, opened by this header line exactly (it is a merge marker):
`// BLOCK: apps/web/src/app/pages/workshop/shell.component.ts | start=        <span class="who"><strong>{{ session.name() }}</strong> | until=        <button class="x" type="button" (click)="theme.toggle()"`
Write that same line with only the change above. It stays ONE line with the same leading spaces; `<span class="who">` and `<strong>` stay exactly as they are. British English, no em or en dash. No explanation before or after the code block.
