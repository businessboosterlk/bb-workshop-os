import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { PERIODS, Period, inPeriod } from '../../core/sales';

/* Owner only. What is approved on the floor, what is still to collect, what was
   delivered this month. Each figure is a sum of the job cards, nothing else. */
@Component({
  selector: 'bb-ws-money',
  standalone: true,
  imports: [RouterLink, FilterBarComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Money</h2><p>Sums of the job cards. Edit a figure on the car itself.</p></div></div>
    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Plate or customer" [count]="rows().length" noun="car" nouns="cars" store="money"/>
    <div class="kpi">
      <div class="card"><div class="k-label">Approved on the floor</div><div class="k-val">{{ cast.money(approvedOpen()) || '0' }}</div><div class="k-sub">{{ rows().length }} open {{ rows().length === 1 ? 'car' : 'cars' }}</div></div>
      <div class="card"><div class="k-label">Still to collect</div><div class="k-val" [class.warn]="due() > 0">{{ cast.money(due()) || '0' }}</div><div class="k-sub">approved minus paid, open and delivered</div></div>
      <div class="card"><div class="k-label">Delivered, {{ periodLabel() }}</div><div class="k-val up">{{ cast.money(deliveredValue()) || '0' }}</div><div class="k-sub">{{ delivered().length }} {{ delivered().length === 1 ? 'car' : 'cars' }}</div></div>
      <div class="card"><div class="k-label">Waiting on customer</div><div class="k-val">{{ cast.money(pendingValue()) || '0' }}</div><div class="k-sub">extra work not yet approved</div></div>
    </div>
    <div class="sec"><div class="sec-head"><h3>Every open car</h3></div>
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Customer</th><th class="num">Estimate</th><th class="num">Approved</th><th class="num">Paid</th><th class="num">To collect</th></tr></thead>
        <tbody>@for (j of rows(); track j.id) { <tr [routerLink]="['/workshop/job', j.id]"><td><strong class="nw">{{ j.plate }}</strong><br><span class="t-small">{{ cast.service(j.service)?.label }}</span></td><td>{{ j.customerName }}</td><td class="num">{{ cast.money(j.estimate) }}</td><td class="num">{{ cast.money(j.approved) }}</td><td class="num">{{ cast.money(j.paid) }}</td><td class="num" [class.warn]="(j.approved || 0) > (j.paid || 0)">{{ cast.money((j.approved || 0) - (j.paid || 0)) }}</td></tr> }</tbody></table></div></div>`,
  styles: [`.k-val.warn,.warn{color:var(--amber)}.nw{white-space:nowrap}`]
})
export class WorkshopMoneyComponent {
  cast = inject(CastService); data = inject(DataService);
  fstate = signal<Record<string, string>>({ period: 'month' }); fq = signal('');
  fdefs = computed<FilterDef[]>(() => [
    { key: 'branch', label: 'Branch', all: 'Both branches', options: (this.cast.cast()?.branches || []).map(b => ({ value: b.key, label: b.name })) },
    { key: 'period', label: 'Delivered', all: 'Any time', options: PERIODS.filter(p => p.value !== 'all') } ]);
  private inScope = (j: any) => { const x = this.fstate(), q = this.fq().trim().toLowerCase(); return (!x['branch'] || j.branch === x['branch']) && (!q || [j.plate, j.customerName].join(' ').toLowerCase().includes(q)); };
  periodLabel = computed(() => (PERIODS.find(p => p.value === (this.fstate()['period'] || 'all'))?.label || 'Any time').toLowerCase());
  delivered = computed(() => this.data.jobs().filter(j => j.status === 'delivered' && this.inScope(j) && inPeriod(j.deliveredAt, (this.fstate()['period'] || 'all') as Period)));
  rows = computed(() => [...this.data.open().filter(this.inScope)].sort((a, b) => ((b.approved || 0) - (b.paid || 0)) - ((a.approved || 0) - (a.paid || 0))));
  approvedOpen = computed(() => this.data.open().filter(this.inScope).reduce((a, j) => a + (j.approved || 0), 0));
  due = computed(() => this.data.jobs().filter(this.inScope).reduce((a, j) => a + Math.max(0, (j.approved || 0) - (j.paid || 0)), 0));
  deliveredValue = computed(() => this.delivered().reduce((a, j) => a + (j.approved || 0), 0));
  pendingValue = computed(() => this.data.open().filter(this.inScope).reduce((a, j) => a + j.approvals.filter(x => x.status === 'pending').reduce((s, x) => s + (x.amount || 0), 0), 0));
  date(iso?: string){ return niceDate(iso); }
}
