import { formatPKR, waLink } from './format';
import { SITE } from './config';
import type { OrderSummary } from './types';

export function orderWhatsAppText(o: OrderSummary): string {
  const lines = o.lines.map((l) => `• ${l.name} × ${l.quantity} — ${formatPKR(l.line_total)}`).join('\n');
  return [
    'Assalam o Alaikum Makhdoom Fragrances! 👋',
    'I just placed an order on your website and would like to confirm it.',
    '',
    `*Order:* ${o.orderNumber}`,
    `*Name:* ${o.customer.name}`,
    `*Phone:* ${o.customer.phone}`,
    `*City:* ${o.customer.city}`,
    `*Address:* ${o.customer.address}`,
    o.customer.notes ? `*Notes:* ${o.customer.notes}` : '',
    '',
    '*Items*',
    lines,
    '',
    `Subtotal: ${formatPKR(o.subtotal)}`,
    `Delivery: ${o.shipping === 0 ? 'Free' : formatPKR(o.shipping)}`,
    `*Total (Cash on Delivery): ${formatPKR(o.total)}*`,
    '',
    'Please confirm my order. JazakAllah!',
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');
}

export const orderWhatsAppUrl = (o: OrderSummary) => waLink(SITE.whatsapp, orderWhatsAppText(o));
export const supportWhatsAppUrl = (text = 'Assalam o Alaikum! I have a question about Makhdoom Fragrances.') =>
  waLink(SITE.whatsapp, text);
