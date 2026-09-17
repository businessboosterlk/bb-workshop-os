import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { quoteTotal, PERIODS, Period, inPeriod } from '../../core/sales';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';

/* Owner only. Every quote, what it is worth and where it stands. */
@Component({
  selector: 'bb-ws-quotes',
  standalone: true,
  imports: [RouterLink, IconComponent, FilterBarComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Quotes</h2><p>{{ cast.money(openValue()) || 'Nothing' }} waiting on customers · {{ cast.money(wonValue()) || 'nothing' }} accepted this month</p></div>
      <div class="ph-right"><a class="btn sm" routerLink="/workshop/quote/new"><bb-icon name="plus"/>New quote</a></div></div>
    <bb-filter-bar [state]="fstate" [query]="fq" [defs]="fdefs()" placeholder="Quote number, name or plate" [count]="list().length" noun="quote" nouns="quotes" store="quotes"/>
    <div class="chips bar">@for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}</button> }</div>
    <div class="mlist">
      @for (q of list(); track q.id) {
        <a class="card mq" [routerLink]="['/workshop/quote', q.id]">
          <div class="r1"><strong>{{ q.number }}</strong><strong class="amt">{{ cast.money(total(q)) }}</strong></div>
          <span class="sub">{{ q.customerName }} · {{ q.plate }} {{ q.vehicle }}</span>
          <span class="sub">{{ cast.service(q.service)?.label }} · {{ cast.branch(q.branch)?.name }} · {{ date(q.createdAt) }}</span>
          <div class="r2"><span class="pill" [class]="'pill ' + pill(q.status)">{{ word(q.status) }}</span>@if (expired(q)) { <span class="pill quoted">Past its date</span> }</div>
        </a>
      } @empty { <div class="card empty"><strong>No quotes here</strong>Make one from an enquiry, or start a new one.</div> }
    </div>
    <div class="card tbl-wrap desk">
      @if (list().length) {
        <table class="tbl">
          <thead><tr><th>Quote</th><th>Customer</th><th>Work</th><th>Status</th><th class="num">Total</th></tr></thead>
          <tbody>
            @for (q of list(); track q.id) {
              <tr [routerLink]="['/workshop/quote', q.id]">
                <td><div class="who"><strong>{{ q.number }}</strong><span>{{ date(q.createdAt) }}</span></div></td>
                <td><div class="who"><strong>{{ q.customerName }}</strong><span>{{ q.plate }} {{ q.vehicle }}</span></div></td>
                <td>{{ cast.service(q.service)?.label }}<br><span class="t-small">{{ cast.branch(q.branch)?.name }}</span></td>
                <td><span class="pill" [class]="'pill ' + pill(q.status)">{{ word(q.status) }}</span>@if (expired(q)) { <span class="pill quoted">Past its date</span> }</td>
                <td class="num"><strong>{{ cast.money(total(q)) }}</strong></td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="empty"><strong>No quotes here</strong>Make one from an enquiry, or start a new one.</div> }
    </div>`,
  styles: [`.bar{margin-bottom:14px}.mlist{display:none}.tbl .who strong{white-space:nowrap}
    @media (max-width:640px){.desk{display:none}.mlist{display:grid;gap:10px}
      .mq{display:grid;gap:3px;padding:14px 16px}.r1{display:flex;justify-content:space-between;gap:8px}.r1 strong{font-size:15px}.amt{font-variant-numeric:tabular-nums}
      .sub{font-size:12.5px;color:var(--muted)}.r2{display:flex;gap:4px;margin-top:6px}}`]
})
export class WorkshopQuotesComponent {
  cast = inject(CastService); data = inject(DataService);
  filter = signal<'open' | 'accepted' | 'declined' | 'all'>('open');
  filters = [{ k: 'open', label: 'Draft and sent' }, { k: 'accepted', label: 'Accepted' }, { k: 'declined', label: 'Declined' }, { k: 'all', label: 'Everything' }] as const;
  fstate = signal<Record<string, string>>({}); fq = signal('');
  fdefs = computed<FilterDef[]>(() => { const c = this.cast.cast(); return [
    { key: 'branch', label: 'Branch', all: 'Both branches', options: (c?.branches || []).map(b => ({ value: b.key, label: b.name })) },
    { key: 'service', label: 'Service', all: 'All services', options: (c?.services || []).map(x => ({ value: x.key, label: x.label })) },
    { key: 'period', label: 'Made', all: 'Any time', options: PERIODS.filter(p => p.value !== 'all') } ]; });
  list = computed(() => { const f = this.filter(), x = this.fstate(), s = this.fq().trim().toLowerCase(); return this.data.quotes().filter(q => f === 'all' || (f === 'open' ? (q.status === 'draft' || q.status === 'sent') : q.status === f))
    .filter(q => (!x['branch'] || q.branch === x['branch']) && (!x['service'] || q.service === x['service']) && inPeriod(q.createdAt, (x['period'] || 'all') as Period) && (!s || [q.number, q.customerName, q.customerPhone, q.plate, q.vehicle].join(' ').toLowerCase().includes(s))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); });
  openValue = computed(() => this.data.quotesOpen().reduce((a, q) => a + quoteTotal(q), 0));
  wonValue = computed(() => { const m = new Date().toISOString().slice(0, 7); return this.data.quotes().filter(q => q.status === 'accepted' && (q.answeredAt || '').slice(0, 7) === m).reduce((a, q) => a + quoteTotal(q), 0); });
  total(q: any){ return quoteTotal(q); }
  expired(q: any){ return (q.status === 'draft' || q.status === 'sent') && new Date(q.validUntil).getTime() < Date.now(); }
  word(s: string){ return ({ draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' } as any)[s]; }
  pill(s: string){ return ({ draft: '', sent: 'new', accepted: 'won', declined: 'lost' } as any)[s]; }
  date(iso?: string){ return niceDate(iso); }
}
