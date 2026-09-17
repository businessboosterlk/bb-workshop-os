import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService, niceWhen } from '../../core/data.service';
import { SessionService } from '../../core/session.service';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { PERIODS, Period, inPeriod } from '../../core/sales';
import { IconComponent } from '../../ui/icon.component';

/* Who did what and when, across every car. If it is not here it did not happen. */
@Component({
  selector: 'bb-ws-activity',
  standalone: true,
  imports: [RouterLink, IconComponent, FilterBarComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Activity</h2><p>{{ list().length }} entries</p></div>
      <div class="ph-right"><div class="chips">@for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}</button> }</div></div></div>
    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Plate, name or what happened" [count]="list().length" noun="entry" nouns="entries" store="activity"/>
    <div class="card list">
      @for (a of list(); track a.id) {
        <a class="li link" [routerLink]="link(a)">
          <span class="ic"><bb-icon [name]="icon(a.type)"/></span>
          <span class="tx"><strong>@if (plate(a.jobId)) { {{ plate(a.jobId) }} · }{{ a.summary }}</strong><span>{{ a.by }} · {{ when(a.createdAt) }}</span></span>
          <bb-icon name="chev" class="go"/>
        </a>
      } @empty { <div class="empty"><strong>Nothing yet</strong></div> }
    </div>`
})
export class WorkshopActivityComponent {
  data = inject(DataService); session = inject(SessionService); filter = signal<'all' | 'phase' | 'approval' | 'enquiry' | 'followup' | 'delivered'>('all');
  filters = [{ k: 'all', label: 'Everything' }, { k: 'phase', label: 'Phases' }, { k: 'enquiry', label: 'Enquiries' }, { k: 'followup', label: 'Follow-ups' }, { k: 'approval', label: 'Approvals' }, { k: 'delivered', label: 'Delivered' }] as const;
  fstate = signal<Record<string, string>>({}); fq = signal('');
  fdefs = computed<FilterDef[]>(() => [
    { key: 'by', label: 'Who', all: 'Everyone', options: [...new Set(this.data.activities().map(a => a.by).filter(Boolean))].sort().map(n => ({ value: n, label: n })) },
    { key: 'period', label: 'When', all: 'Any time', options: PERIODS.filter(p => p.value !== 'all') } ]);
  list = computed(() => { const x = this.fstate(), q = this.fq().trim().toLowerCase();
    return this.data.activities().filter(a => (this.filter() === 'all' || a.type === this.filter()) && (!x['by'] || a.by === x['by']) && inPeriod(a.createdAt, (x['period'] || 'all') as Period)
      && (!q || [a.summary, this.plate(a.jobId)].join(' ').toLowerCase().includes(q))).slice(0, 300); });
  plate(id: string){ return id ? this.data.job(id)?.plate || '' : ''; }
  link(a: any){ return a.jobId ? ['/workshop/job', a.jobId] : a.quoteId && this.session.owner() ? ['/workshop/quote', a.quoteId] : ['/workshop/enquiries']; }
  icon(t: string){ return ({ phase: 'check', note: 'note', promise: 'clock', approval: 'alert', pickup: 'truck', delivered: 'tick', new: 'car', enquiry: 'inbox', quote: 'quote', followup: 'phone' } as any)[t] || 'note'; }
  when(iso?: string){ return niceWhen(iso); }
}
