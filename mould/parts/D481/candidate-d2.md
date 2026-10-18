```ts
// BLOCK: apps/web/src/app/pages/workshop/shell.component.ts | start=        <span class="who"><strong>{{ session.name() }}</strong> | until=        <button class="x" type="button" (click)="theme.toggle()"
        <span class="who"><strong>{{ session.name() }}</strong><em>{{ session.role() === 'owner' ? 'Owner' : session.role() === 'desk' ? 'Front desk' : 'Staff' }}</em>@if (session.branch()) { <em>{{ cast.branch(session.branch())?.name }}</em> }</span>
```