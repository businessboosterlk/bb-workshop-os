import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';

/* Owner only. The operator-control line: the owner changes what the phases are CALLED
   and how long they USUALLY take, per service, and the branch lines the customer
   messages. He cannot remove the photo rule, the audit trail or a role. Those are
   structure and they belong to Business Booster. */
@Component({
  selector: 'bb-ws-settings',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Settings</h2><p>Names and usual hours are yours to change. The photo rule, the audit trail and the roles are not settings.</p></div>
      <div class="ph-right"><button class="btn" type="button" (click)="save()" [disabled]="!dirty()"><bb-icon name="check"/>Save</button></div></div>
    <div class="grid">
      @for (s of services; track s.key) {
        <div class="card svc"><div class="sec-head"><h3>{{ s.label }}</h3><span>{{ s.phases.length }} phases</span></div>
          @for (p of s.phases; track p.key) {
            <div class="pr"><input [(ngModel)]="p.label" (ngModelChange)="dirty.set(true)" [attr.aria-label]="'Phase name'" [disabled]="p.key === 'ready'"><input class="h" type="number" inputmode="numeric" min="0" [(ngModel)]="p.hours" (ngModelChange)="dirty.set(true)" aria-label="Usual hours" [disabled]="p.key === 'ready'"><span>h</span></div>
          }
        </div>
      }
      <div class="card svc"><div class="sec-head"><h3>Follow-ups</h3><span>days after the car goes home</span></div>
        @for (f of followups; track f.key) { <div class="pr"><input [(ngModel)]="f.label" (ngModelChange)="dirty.set(true)" aria-label="Follow-up name"><input class="h" type="number" inputmode="numeric" min="1" [(ngModel)]="f.days" (ngModelChange)="dirty.set(true)" aria-label="Days"><span>days</span></div> }
        <p class="t-small" style="margin-top:8px">New deliveries use these. Each check comes after the one before it.</p>
      </div>
      <div class="card svc"><div class="sec-head"><h3>Branches</h3><span>WhatsApp lines the customer reaches</span></div>
        @for (b of branches; track b.key) { <div class="pr"><strong class="bn">{{ b.name }}</strong><input [(ngModel)]="b.wa" (ngModelChange)="dirty.set(true)" placeholder="947XXXXXXXX" aria-label="WhatsApp number"><input class="h" type="number" inputmode="numeric" min="1" [(ngModel)]="b.bays" (ngModelChange)="dirty.set(true)" aria-label="Bays"><span>bays</span></div> }
      </div>
      @if (data.mode() === 'local') {
        <div class="card svc"><div class="sec-head"><h3>Demo data</h3></div><p class="t-small">This browser holds a demo floor. Reset puts the seven demo cars back.</p><button class="btn ghost sm" type="button" (click)="reset()" style="margin-top:10px">Reset the demo floor</button></div>
      }
    </div>`,
  styles: [`.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}.svc{padding:16px}
    .pr{display:flex;align-items:center;gap:8px;margin-top:8px}.pr input{flex:1;min-width:0;min-height:38px;padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);font-size:13.5px}
    .pr input:focus{outline:none;border-color:var(--brand)}.pr input:disabled{opacity:.55}.pr .h{flex:0 0 64px;text-align:right}.pr span{font-size:12px;color:var(--muted);width:30px}.bn{flex:0 0 110px;font-size:13px}`]
})
export class WorkshopSettingsComponent {
  cast = inject(CastService); data = inject(DataService);
  services = structuredClone(this.cast.cast()?.services || []); branches = structuredClone(this.cast.cast()?.branches || []); followups = structuredClone(this.cast.cast()?.followups || []);
  dirty = signal(false);
  save(){ const c = this.cast.cast(); if (!c) return;
    const days = this.followups.map(f => Math.round(+f.days)); if (days.some(d => !(d >= 1)) || days.some((d, i) => i > 0 && d <= days[i - 1])) { this.data.toast('Follow-up days must rise, for example 3, 30, 90'); return; }
    const next = { ...c, services: structuredClone(this.services), branches: structuredClone(this.branches), followups: this.followups.map(f => ({ ...f, days: Math.round(+f.days) })) }; this.cast.use(next);
    try { localStorage.setItem('wos_override_' + c.slug, JSON.stringify({ services: next.services, branches: next.branches, followups: next.followups })); const raw = localStorage.getItem('wos_session'); if (raw) { const s = JSON.parse(raw); s.cast = next; localStorage.setItem('wos_session', JSON.stringify(s)); } } catch {}
    this.dirty.set(false); this.data.toast('Saved. New cars use the new names and hours.'); }
  async reset(){ await this.data.reseed(); this.data.toast('Demo floor reset'); }
}
