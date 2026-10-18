```ts
// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=    .money{padding:16px} | until=    .tl,.act,.ba{padding:16px}
    .money{padding:16px}.m4{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}.m4.one{grid-template-columns:minmax(0,1fr)}
    .fig em{display:block;font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}.fig strong{display:block;font-size:15px;margin-top:3px}.m4.one .fig strong{font-size:20px}
    .pays{margin-top:12px;border-top:1px solid var(--line)}.pay{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
    .pt{flex:1;min-width:0}.pt strong{display:block;font-size:13px;font-weight:700}.pt span{display:block;font-size:12px;color:var(--muted);margin-top:2px}.pa{font-weight:700;font-size:14px;white-space:nowrap}
    .pay.gone .pa,.pay.gone .no{text-decoration:line-through;color:var(--muted)}.tag{font-size:11px;font-weight:700;color:var(--ink-2);background:var(--surface-2);padding:2px 8px;border-radius:999px}
    .pay-add{width:100%;margin-top:12px;min-height:44px}
    .due{margin-top:10px;font-size:12.5px;font-weight:600;color:var(--amber)}.msg{font-size:13px;font-weight:600;color:var(--ink);line-height:1.4}.fix-q{font-size:14px;line-height:1.5}
// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  sheet = signal<Sheet>(''); busy = signal(false); | until=  on(k: FeatureKey)
  sheet = signal<Sheet>(''); busy = signal(false);
  photo = signal(''); note = ''; newDate = ''; reason = ''; askTitle = ''; askDetail = ''; askAmount: number | null = null; noteText = '';
  pk: any = { wanted: false, status: 'none' }; m: any = {}; ex: any = {}; err = signal('');
  pay: { amount: number | null; method: PayMethod; at: string; note: string } = { amount: null, method: 'cash', at: '', note: '' };
  today = localDay(); fixing = signal<PaymentLine | null>(null); payToast = signal<{ text: string; undo: string } | null>(null); private payT: ReturnType<typeof setTimeout> | undefined;
  readonly methods: { k: PayMethod; label: string }[] = [{ k: 'cash', label: 'Cash' }, { k: 'card', label: 'Card' }, { k: 'bank', label: 'Bank transfer' }, { k: 'cheque', label: 'Cheque' }];
```