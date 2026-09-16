import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../ui/icon.component';

/* The garage record: every job this number ever had here, newest first. */
@Component({
  selector: 'bb-car-history',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <h1 class="t-h1">{{ lang.t('History') }}</h1>
    <p class="t-small sub">{{ lang.t('Your previous jobs') }}</p>
    @if (data.myPast().length) {
      <div class="card list">
        @for (j of data.myPast(); track j.id) {
          <a class="li link" [routerLink]="['/car/job', j.id]">
            <span class="ic"><bb-icon name="car"/></span>
            <span class="tx"><strong>{{ j.plate }} · {{ cast.service(j.service)?.label }}</strong><span>{{ j.make }} {{ j.model }} · {{ cast.branch(j.branch)?.name }} · {{ date(j.deliveredAt) }}</span></span>
            @if (j.rating) { <span class="rt"><bb-icon name="star"/>{{ j.rating }}</span> }
            <bb-icon name="chev" class="go"/>
          </a>
        }
      </div>
    } @else { <div class="card empty"><strong>{{ lang.t('No cars yet') }}</strong>Your finished jobs will be kept here.</div> }`,
  styles: [`.sub{margin:4px 0 16px}.rt{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:var(--brand-dark);--ico:14px}`]
})
export class CustomerHistoryComponent { cast = inject(CastService); data = inject(DataService); lang = inject(LangService); date(iso?: string){ return niceDate(iso); } }
