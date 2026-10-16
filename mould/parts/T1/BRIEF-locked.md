Write the COMPLETE contents of one new file: apps/web/src/app/ui/locked-card.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: a feature the garage's tier does not include, shown in the one place it would live, as a card: what it does, a
SAMPLE of what it would show (clearly marked Sample, never real data) and one Upgrade button. Tapping Upgrade only reveals a
line saying to ask Business Booster. No price, no tier name, no number of rupees anywhere.

THE TYPES IT READS, FIELD BY FIELD:
  import { FEATURES, FeatureKey, Feature } from '../core/tiers';
    export interface Feature { key: FeatureKey; tier: 1 | 2 | 3; label: string; what: string; sample: string[]; }
    FEATURES: Record<FeatureKey, Feature>    (FeatureKey is a string union; you never list its values)
  import { IconComponent } from './icon.component';
  import { Component, Input, signal } from '@angular/core';

THE COMPONENT, EXACTLY:
  selector 'bb-locked', class LockedCardComponent, standalone, imports IconComponent.
  @Input({ required: true }) feature!: FeatureKey;
  @Input() garage = '';            // the garage's name for the ask line; '' means "this garage"
  asked = signal(false);
  get f(): Feature { return FEATURES[this.feature]; }

THE CARD: <section class="card lk" [attr.data-feature]="feature" [attr.data-tier]="f.tier" aria-label="{label}, not included">
  padding 16px, border 1px dashed var(--line-2) (the global card border is replaced by this dashed one), background var(--surface).
  Head, display flex, gap 12px, align-items center:
    <span class="lk-ico"> 40px by 40px, radius var(--r-s), background var(--surface-2), color var(--muted), display grid,
      place-items center, --ico:20px, flex none, holding <bb-icon name="lock"/>
    a column (flex 1, min-width 0): <strong class="lk-t"> the label (15px, weight 700, ellipsis) and <span class="lk-w"> the word
      "Not in this plan" (12px, weight 600, var(--muted)).
  <p class="lk-what"> the feature's what (13.5px, var(--ink-2), margin 12px 0 0).
  The sample, <div class="lk-sample" aria-hidden="true">, margin-top 12px, padding 10px 12px, radius var(--r-s), background
    var(--surface-2), position relative:
    first a <span class="lk-tag">Sample</span> (11px, weight 700, var(--muted), display block, margin-bottom 6px);
    then one <div class="lk-row"> per sample line (13px, var(--muted), padding 6px 0, a 1px solid var(--line) top border on
    every row but the first, ellipsis on one line). The sample text is shown faded (opacity .75) so it never reads as live data.
  The button: <button type="button" class="btn lk-up" (click)="asked.set(true)" [attr.aria-expanded]="asked()"> icon 'lock'
    "Upgrade"</button>, width 100%, min-height 44px, margin-top 14px.
  Then, only when asked(): <p class="lk-ask" role="status">Ask Business Booster to turn on {label} for {garage or "this garage"}.</p>
    (13px, weight 600, var(--ink), margin-top 10px, text-align center).
