import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { SessionService } from '../../core/session.service';
import { DataService, niceDate } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';
import { Job } from '../../core/models';

/* The floor: what the owner looks at with the morning coffee. Cars in, ready, over
   time, waiting on a customer, the bays per branch, then every open car with the
   overruns first. A staff seat opens on its own branch. */
@Component({
  selector: 'bb-floor',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="ph">
      <div><h2 class="t-h1">The floor</h2><p>{{ today }}</p></div>
      <div class="ph-right">
        <div class="seg" role="tablist">
          <button type="button" [class.on]="branch() === ''" (click)="branch.set('')">Both</button>
          @for (b of cast.cast()?.branches; track b.key) { <button type="button" [class.on]="branch() === b.key" (click)="branch.set(b.key)">{{ b.name }}</button> }
        </div>
      </div>
    </div>
    <div class="kpi">
      <div class="card"><div class="k-label">Cars in</div><div class="k-val">{{ open().length }}</div><div class="k-sub">on the floor now</div></div>
      <div class="card"><div class="k-label">Ready</div><div class="k-val" [class.up]="ready().length">{{ ready().length }}</div><div class="k-sub">waiting for pickup</div></div>
      <div class="card"><div class="k-label">Over time</div><div class="k-val" [class.warn]="over().length">{{ over().length }}</div><div class="k-sub">past the phase's usual hours</div></div>
      <div class="card"><div class="k-label">Waiting on customer</div><div class="k-val">{{ waiting().length }}</div><div class="k-sub">approvals unanswered</div></div>
    </div>
    <div class="bays">
      @for (b of branches(); track b.key) {
        <div class="card bay">
          <div class="bay-h"><strong>{{ b.name }}</strong><span>{{ inBranch(b.key).length }} of {{ b.bays }} bays</span></div>
          <div class="slots">@for (s of slots(b.bays); track s) { <i [class.full]="s < inBranch(b.key).length" [class.hot]="s < overIn(b.key).length"></i> }</div>
        </div>
      }
    </div>
    <div class="sec">
      <div class="sec-head"><h3>Every car</h3><span>overruns first</span></div>
      @if (list().length) {
        <div class="cars">
          @for (j of list(); track j.id) {
            <a class="card jc" [routerLink]="['/workshop/job', j.id]" [class.hot]="data.overrun(j) > 0" [class.ready]="j.status === 'ready'">
              <div class="l">
                <span class="plate">{{ j.plate }}</span>
                <strong>{{ j.make }} {{ j.model }}</strong>
                <span class="sub">{{ j.customerName }} · {{ cast.branch(j.branch)?.name }} · {{ cast.service(j.service)?.label }}</span>
              </div>
              <div class="r">
                @if (j.status === 'ready') { <span class="pill won"><i class="dot"></i>Ready</span> }
                @else if (data.overrun(j) > 0) { <span class="pill quoted"><i class="dot"></i>{{ data.phaseNow(j)?.label }} · {{ data.overrun(j) }} h over</span> }
                @else { <span class="pill brand"><i class="dot"></i>{{ data.phaseNow(j)?.label }}</span> }
                <span class="prom"><bb-icon name="clock"/>{{ date(j.promisedAt) }}</span>
                @if (pending(j)) { <span class="ask"><bb-icon name="alert"/>Waiting on customer</span> }
                <span class="prog"><i [style.width.%]="data.progress(j) * 100"></i></span>
              </div>
            </a>
          }
        </div>
      } @else { <div class="card empty"><strong>No cars on this floor</strong>Tap Car in when the next one arrives.</div> }
    </div>`,
  styles: [`
    .k-val.warn{color:var(--amber)}
    .bays{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
    @media (max-width:640px){.bays{grid-template-columns:1fr}}
    .bay{padding:14px 16px}.bay-h{display:flex;justify-content:space-between;align-items:baseline}.bay-h strong{font-size:14px}.bay-h span{font-size:12px;color:var(--muted)}
    .slots{display:flex;gap:6px;margin-top:10px}.slots i{flex:1;height:10px;border-radius:4px;background:var(--line);transition:background 300ms var(--ease)}
    .slots i.full{background:var(--brand)}.slots i.hot{background:var(--amber)}
    .cars{display:grid;gap:10px}
    .jc{display:flex;gap:14px;align-items:center;padding:14px 16px;transition:border-color 150ms var(--ease),transform 150ms var(--ease)}
    .jc:hover{border-color:var(--brand)}.jc:active{transform:scale(.995)}
    .jc.hot{border-left:3px solid var(--amber)}.jc.ready{border-left:3px solid var(--green)}
    .l{flex:1;min-width:0;display:grid;gap:3px}
    .plate{display:inline-block;width:max-content;font-size:14px;font-weight:800;letter-spacing:.05em;padding:2px 8px;border-radius:6px;background:var(--ink);color:var(--bg);font-variant-numeric:tabular-nums}
    .l strong{font-size:14.5px;font-weight:600}.l .sub{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .r{display:grid;gap:6px;justify-items:end;flex-shrink:0;min-width:150px}
    .prom{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);--ico:13px}
    .ask{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--brand-dark);--ico:13px}
    .prog{width:110px;height:4px;border-radius:2px;background:var(--line);overflow:hidden}.prog i{display:block;height:100%;background:var(--brand);transition:width 600ms cubic-bezier(.45,0,.25,1)}
    .jc.ready .prog i{background:var(--green)}
    @media (max-width:640px){.jc{flex-direction:column;align-items:stretch}.r{justify-items:start;min-width:0}}`]
})
export class FloorComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService);
  branch = signal(this.session.branch() || '');
  today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  branches = computed(() => (this.cast.cast()?.branches || []).filter(b => !this.branch() || b.key === this.branch()));
  open = computed(() => this.data.open().filter(j => !this.branch() || j.branch === this.branch()));
  ready = computed(() => this.open().filter(j => j.status === 'ready'));
  over = computed(() => this.open().filter(j => this.data.overrun(j) > 0));
  waiting = computed(() => this.open().filter(j => this.pending(j)));
  list = computed(() => [...this.open()].sort((a, b) => (this.data.overrun(b) - this.data.overrun(a)) || (a.status === 'ready' ? 1 : 0) - (b.status === 'ready' ? 1 : 0) || a.promisedAt.localeCompare(b.promisedAt)));
  inBranch(k: string){ return this.data.open().filter(j => j.branch === k && j.status === 'open'); }
  overIn(k: string){ return this.inBranch(k).filter(j => this.data.overrun(j) > 0); }
  slots(n: number){ return Array.from({ length: n }, (_, i) => i); }
  pending(j: Job){ return j.approvals.some(a => a.status === 'pending'); }
  date(iso: string){ return niceDate(iso); }
}
