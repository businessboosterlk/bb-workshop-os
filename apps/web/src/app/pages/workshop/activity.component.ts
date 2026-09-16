import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService, niceWhen } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';

/* Who did what and when, across every car. If it is not here it did not happen. */
@Component({
  selector: 'bb-ws-activity',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Activity</h2><p>{{ list().length }} entries</p></div>
      <div class="ph-right"><div class="chips">@for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}</button> }</div></div></div>
    <div class="card list">
      @for (a of list(); track a.id) {
        <a class="li link" [routerLink]="['/workshop/job', a.jobId]">
          <span class="ic"><bb-icon [name]="icon(a.type)"/></span>
          <span class="tx"><strong>{{ plate(a.jobId) }} · {{ a.summary }}</strong><span>{{ a.by }} · {{ when(a.createdAt) }}</span></span>
          <bb-icon name="chev" class="go"/>
        </a>
      } @empty { <div class="empty"><strong>Nothing yet</strong></div> }
    </div>`
})
export class WorkshopActivityComponent {
  data = inject(DataService); filter = signal<'all' | 'phase' | 'approval' | 'promise' | 'delivered'>('all');
  filters = [{ k: 'all', label: 'Everything' }, { k: 'phase', label: 'Phases' }, { k: 'approval', label: 'Approvals' }, { k: 'promise', label: 'Dates moved' }, { k: 'delivered', label: 'Delivered' }] as const;
  list = computed(() => this.data.activities().filter(a => this.filter() === 'all' || a.type === this.filter()).slice(0, 200));
  plate(id: string){ return this.data.job(id)?.plate || ''; }
  icon(t: string){ return ({ phase: 'check', note: 'note', promise: 'clock', approval: 'alert', pickup: 'truck', delivered: 'tick', new: 'car' } as any)[t] || 'note'; }
  when(iso?: string){ return niceWhen(iso); }
}
