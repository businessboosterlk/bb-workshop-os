import { Component, Input, signal } from '@angular/core';
import { FEATURES, FeatureKey } from '../core/tiers';
import { IconComponent } from './icon.component';

@Component({
  selector: 'bb-locked',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="card lk" [attr.data-feature]="feature" [attr.data-tier]="f.tier" [attr.aria-label]="f.label + ', not included'">
      <div class="lk-head">
        <span class="lk-ico"><bb-icon name="lock" /></span>
        <div class="lk-titles">
          <strong class="lk-t">{{ f.label }}</strong>
          <span class="lk-w">Not in this plan</span>
        </div>
      </div>
      <p class="lk-what">{{ f.what }}</p>
      <div class="lk-sample" aria-hidden="true">
        <span class="lk-tag">Sample</span>
        @for (line of f.sample; track line; let i = $index) {
          <div class="lk-row" [class.lk-first]="i === 0">{{ line }}</div>
        }
      </div>
      <button type="button" class="btn lk-up" (click)="asked.set(true)" [attr.aria-expanded]="asked()">
        <bb-icon name="lock" /> Upgrade
      </button>
      @if (asked()) {
        <p class="lk-ask" role="status">Ask Business Booster to turn on {{ f.label }} for {{ garage || 'this garage' }}.</p>
      }
    </section>
  `,
  styles: [
    `
      .lk {
        padding: 16px;
        border: 1px dashed var(--line-2);
        background: var(--surface);
      }
      .lk-head {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .lk-ico {
        width: 40px;
        height: 40px;
        border-radius: var(--r-s);
        background: var(--surface-2);
        color: var(--muted);
        display: grid;
        place-items: center;
        --ico: 20px;
        flex: none;
      }
      .lk-titles {
        flex: 1;
        min-width: 0;
      }
      .lk-t {
        display: block;
        font-size: 15px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lk-w {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
        margin-top: 2px;
      }
      .lk-what {
        font-size: 13.5px;
        color: var(--ink-2);
        margin: 12px 0 0;
      }
      .lk-sample {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: var(--r-s);
        background: var(--surface-2);
        position: relative;
        opacity: 0.75;
      }
      .lk-tag {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .lk-row {
        font-size: 13px;
        color: var(--muted);
        padding: 6px 0;
        border-top: 1px solid var(--line);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lk-first {
        border-top: none;
        padding-top: 0;
      }
      .lk-up {
        width: 100%;
        min-height: 44px;
        margin-top: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        --ico: 16px;
      }
      .lk-ask {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        margin-top: 10px;
        text-align: center;
      }
    `,
  ],
})
export class LockedCardComponent {
  @Input({ required: true }) feature!: FeatureKey;
  @Input() garage = '';
  asked = signal(false);

  get f() {
    return FEATURES[this.feature];
  }
}
