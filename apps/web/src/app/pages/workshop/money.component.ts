import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';

/* Owner only. What is approved on the floor, what is still to collect, what was
   delivered this month. Each figure is a sum of the job cards, nothing else. */
@Component({
  selector: 'bb-ws-money',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="ph"><div><h2 class="t-h1">Money</h2><p>Sums of the job cards. Edit a figure on the car itself.</p></div></div>
    <div class="kpi">
      <div class="card"><div class="k-label">Approved on the floor</div><div class="k-val">{{ cast.money(approvedOpen()) || '0' }}</div><div class="k-sub">{{ data.open().length }} open cars</div></div>
      <div class="card"><div class="k-label">Still to collect</div><div class="k-val" [class.warn]="due() > 0">{{ cast.money(due()) || '0' }}</div><div class="k-sub">approved minus paid, open and delivered</div></div>
      <div class="card"><div class="k-label">Delivered this month</div><div class="k-val up">{{ cast.money(deliveredValue()) || '0' }}</div><div class="k-sub">{{ data.deliveredThisMonth().length }} cars</div></div>
      <div class="card"><div class="k-label">Waiting on customer</div><div class="k-val">{{ cast.money(pendingValue()) || '0' }}</div><div class="k-sub">extra work not yet approved</div></div>
    </div>
    <div class="sec"><div class="sec-head"><h3>Every open car</h3></div>
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Customer</th><th class="num">Estimate</th><th class="num">Approved</th><th class="num">Paid</th><th class="num">To collect</th></tr></thead>
        <tbody>@for (j of rows(); track j.id) { <tr [routerLink]="['/workshop/job', j.id]"><td><strong>{{ j.plate }}</strong><br><span class="t-small">{{ cast.service(j.service)?.label }}</span></td><td>{{ j.customerName }}</td><td class="num">{{ cast.money(j.estimate) }}</td><td class="num">{{ cast.money(j.approved) }}</td><td class="num">{{ cast.money(j.paid) }}</td><td class="num" [class.warn]="(j.approved || 0) > (j.paid || 0)">{{ cast.money((j.approved || 0) - (j.paid || 0)) }}</td></tr> }</tbody></table></div></div>`,
  styles: [`.k-val.warn,.warn{color:var(--amber)}`]
})
export class WorkshopMoneyComponent {
  cast = inject(CastService); data = inject(DataService);
  rows = computed(() => [...this.data.open()].sort((a, b) => ((b.approved || 0) - (b.paid || 0)) - ((a.approved || 0) - (a.paid || 0))));
  approvedOpen = computed(() => this.data.open().reduce((a, j) => a + (j.approved || 0), 0));
  due = computed(() => this.data.jobs().reduce((a, j) => a + Math.max(0, (j.approved || 0) - (j.paid || 0)), 0));
  deliveredValue = computed(() => this.data.deliveredThisMonth().reduce((a, j) => a + (j.approved || 0), 0));
  pendingValue = computed(() => this.data.open().reduce((a, j) => a + j.approvals.filter(x => x.status === 'pending').reduce((s, x) => s + (x.amount || 0), 0), 0));
  date(iso?: string){ return niceDate(iso); }
}
