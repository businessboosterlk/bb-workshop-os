import { Quote, QuoteLine } from './models';

/* The quote arithmetic, in one place. Every screen, the printed quote and the WhatsApp
   message call these, so a total can never disagree with itself. Whole rupees only. */
export const lineTotal = (l: QuoteLine) => Math.max(0, Math.round(Number(l.qty) || 0)) * Math.max(0, Math.round(Number(l.price) || 0));
export const subTotal = (q: Pick<Quote, 'lines'>) => (q.lines || []).reduce((a, l) => a + lineTotal(l), 0);
export const quoteTotal = (q: Pick<Quote, 'lines' | 'discount'>) => Math.max(0, subTotal(q) - Math.max(0, Math.round(Number(q.discount) || 0)));
export function nextNumber(prefix: string, existing: string[]): string {
  const n = existing.map(x => parseInt((x.match(/(\d+)$/) || [])[1] || '0', 10)).reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(n + 1).padStart(4, '0')}`;
}

/* PERIODS for every filter bar, one definition so every screen means the same thing by "this month" */
export type Period = 'all' | 'today' | 'week' | 'month' | 'lastmonth' | '30d' | 'year';
export const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Any time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' }, { value: 'lastmonth', label: 'Last month' }, { value: '30d', label: 'Last 30 days' }, { value: 'year', label: 'This year' }
];
export function inPeriod(iso: string | undefined, p: Period): boolean {
  if (p === 'all') return true; if (!iso) return false;
  const t = new Date(iso).getTime(), n = new Date(); const day = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  switch (p) {
    case 'today': return t >= day;
    case 'week': { const dow = (n.getDay() + 6) % 7; return t >= day - dow * 86400000; }
    case 'month': return t >= new Date(n.getFullYear(), n.getMonth(), 1).getTime();
    case 'lastmonth': return t >= new Date(n.getFullYear(), n.getMonth() - 1, 1).getTime() && t < new Date(n.getFullYear(), n.getMonth(), 1).getTime();
    case '30d': return t >= Date.now() - 30 * 86400000;
    case 'year': return t >= new Date(n.getFullYear(), 0, 1).getTime();
  }
}
