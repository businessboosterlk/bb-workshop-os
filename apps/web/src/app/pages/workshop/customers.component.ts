import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink } from '../../core/data.service';
import { IconComponent } from '../../ui/icon.component';

/* Every customer and every car they ever brought. Tap a customer to see their cars. */
@Component({
  selector: 'bb-ws-customers',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <div class="ph"><div><h2 class="t-h1">Customers</h2><p>{{ list().length }} on file</p></div></div>
    <div class="toolbar"><div class="search grow"><bb-icon name="search"/><input type="search" [(ngModel)]="q" placeholder="Name, phone or plate" aria-label="Search" enterkeyhint="search"></div></div>
    <div class="card list">
      @for (c of list(); track c.id) {
        <a class="li link" [routerLink]="['/workshop/cars']" [queryParams]="{ f: 'all', q: c.phone }">
          <span class="avatar">{{ c.name.slice(0, 1) }}</span>
          <span class="tx"><strong>{{ c.name }}</strong><span>{{ c.phone }} · {{ plates(c) }}</span></span>
          <span class="n">{{ jobsOf(c).length }} {{ jobsOf(c).length === 1 ? 'job' : 'jobs' }}</span>
          <a class="btn wa sm icon" [href]="wa(c)" target="_blank" rel="noreferrer" (click)="$event.stopPropagation()" aria-label="WhatsApp"><bb-icon name="wa"/></a>
        </a>
      } @empty { <div class="empty"><strong>No customers yet</strong>The first Car in creates one.</div> }
    </div>`,
  styles: [`.n{font-size:12px;color:var(--muted);white-space:nowrap}`]
})
export class WorkshopCustomersComponent {
  cast = inject(CastService); data = inject(DataService); q = '';
  list = computed(() => { const q = this.q.trim().toLowerCase(); return this.data.customers().filter(c => !q || [c.name, c.phone, ...c.vehicles.map(v => v.plate)].join(' ').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)); });
  plates(c: any){ return c.vehicles.map((v: any) => v.plate).join(', '); }
  jobsOf(c: any){ return this.data.jobs().filter(j => j.customerId === c.id); }
  wa(c: any){ return waLink(c.phone, `Hello ${c.name.split(' ')[0]}, this is ${this.cast.cast()?.name}. `); }
}
