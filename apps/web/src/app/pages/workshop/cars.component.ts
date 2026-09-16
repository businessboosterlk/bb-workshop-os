import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';

/* Every car, searchable by plate or name, filtered by where it is in its life. */
@Component({
  selector: 'bb-ws-cars',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Cars</h2><p>{{ list().length }} shown</p></div><div class="ph-right"><a class="btn sm" routerLink="/workshop/new"><bb-icon name="plus"/>Car in</a></div></div>
    <div class="toolbar">
      <div class="search grow"><bb-icon name="search"/><input type="search" [(ngModel)]="q" placeholder="Plate, name or phone" aria-label="Search" enterkeyhint="search"></div>
      <div class="chips">
        @for (f of filters; track f.k) { <button type="button" [class.on]="filter() === f.k" (click)="filter.set(f.k)">{{ f.label }}</button> }
      </div>
    </div>
    <div class="mlist">
      @for (j of list(); track j.id) {
        <a class="card mc" [routerLink]="['/workshop/job', j.id]" [class.hot]="data.overrun(j) > 0">
          <div class="r1"><span class="plate">{{ j.plate }}</span><span class="t-small">{{ j.status === 'delivered' ? date(j.deliveredAt) : date(j.promisedAt) }}</span></div>
          <strong>{{ j.make }} {{ j.model }}</strong>
          <span class="sub">{{ j.customerName }} · {{ cast.branch(j.branch)?.name }} · {{ cast.service(j.service)?.label }}</span>
          <div class="r2">
            @if (j.status === 'delivered') { <span class="pill won">Delivered</span> }
            @else if (j.status === 'ready') { <span class="pill won">Ready</span> }
            @else if (data.overrun(j) > 0) { <span class="pill quoted">{{ data.phaseNow(j)?.label }} · {{ data.overrun(j) }} h over</span> }
            @else { <span class="pill brand">{{ data.phaseNow(j)?.label }}</span> }
            @if (pending(j)) { <span class="pill new">Waiting on customer</span> }
          </div>
        </a>
      } @empty { <div class="card empty"><strong>Nothing here</strong>No car matches.</div> }
    </div>
    <div class="card tbl-wrap desk">
      @if (list().length) {
        <table class="tbl">
          <thead><tr><th>Car</th><th>Customer</th><th>Where</th><th>Phase</th><th>Promised</th></tr></thead>
          <tbody>
            @for (j of list(); track j.id) {
              <tr [routerLink]="['/workshop/job', j.id]">
                <td><div class="who"><strong>{{ j.plate }}</strong><span>{{ j.make }} {{ j.model }}</span></div></td>
                <td><div class="who"><strong>{{ j.customerName }}</strong><span>{{ j.customerPhone }}</span></div></td>
                <td>{{ cast.branch(j.branch)?.name }}<br><span class="t-small">{{ cast.service(j.service)?.label }}</span></td>
                <td>
                  @if (j.status === 'delivered') { <span class="pill won">Delivered</span> }
                  @else if (j.status === 'ready') { <span class="pill won">Ready</span> }
                  @else if (data.overrun(j) > 0) { <span class="pill quoted">{{ data.phaseNow(j)?.label }} · {{ data.overrun(j) }} h over</span> }
                  @else { <span class="pill brand">{{ data.phaseNow(j)?.label }}</span> }
                  @if (pending(j)) { <span class="pill new">Waiting on customer</span> }
                </td>
                <td class="t-small">{{ j.status === 'delivered' ? date(j.deliveredAt) : date(j.promisedAt) }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="empty"><strong>Nothing here</strong>No car matches.</div> }
    </div>`,
  styles: [`.pill+.pill{margin-left:4px}.tbl .who strong{white-space:nowrap}
    .mlist{display:none}
    @media (max-width:640px){
      .desk{display:none}.mlist{display:grid;gap:10px}
      .mc{display:grid;gap:3px;padding:14px 16px}.mc.hot{border-left:3px solid var(--amber)}
      .r1{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
      .plate{font-size:14px;font-weight:800;letter-spacing:.05em;text-indent:.05em;padding:calc(2px + .05em) 8px calc(2px - .05em);border-radius:6px;background:var(--ink);color:var(--bg);white-space:nowrap}
      .mc strong{font-size:14.5px}.mc .sub{font-size:12.5px;color:var(--muted)}
      .r2{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.r2 .pill+.pill{margin-left:0}
    }`]
})
export class WorkshopCarsComponent {
  cast = inject(CastService); data = inject(DataService); private route = inject(ActivatedRoute);
  q = ''; filter = signal<'open' | 'ready' | 'waiting' | 'delivered' | 'all'>('open');
  filters = [{ k: 'open', label: 'On the floor' }, { k: 'ready', label: 'Ready' }, { k: 'waiting', label: 'Waiting on customer' }, { k: 'delivered', label: 'Delivered' }, { k: 'all', label: 'Everything' }] as const;
  constructor(){ this.route.queryParamMap.subscribe(p => { const f = p.get('f'); if (f && ['open', 'ready', 'waiting', 'delivered', 'all'].includes(f)) this.filter.set(f as any); const q = p.get('q'); if (q) this.q = q; }); }
  list = computed(() => { const f = this.filter(); const q = this.q.trim().toLowerCase();
    return this.data.jobs().filter(j => f === 'all' || (f === 'open' && j.status !== 'delivered') || (f === 'ready' && j.status === 'ready') || (f === 'waiting' && this.pending(j)) || (f === 'delivered' && j.status === 'delivered'))
      .filter(j => !q || [j.plate, j.customerName, j.customerPhone, j.make, j.model].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); });
  pending(j: any){ return j.approvals.some((a: any) => a.status === 'pending'); }
  date(iso?: string){ return niceDate(iso); }
}
