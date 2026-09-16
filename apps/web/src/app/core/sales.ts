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
