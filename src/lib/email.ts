import { Resend } from 'resend';
import { formatPKR } from './format';
import { SITE } from './config';
import { log } from './log';
import type { OrderSummary } from './types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function client() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const from = () => process.env.RESEND_FROM || 'Makhdoom Fragrances <onboarding@resend.dev>';
const ownerTo = () => process.env.ORDER_NOTIFY_EMAIL || SITE.email;

function orderHtml(o: OrderSummary, audience: 'owner' | 'customer') {
  const rows = o.lines
    .map(
      (l) => `<tr><td style="padding:10px 0;border-bottom:1px solid #2a2620">${esc(l.name)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2a2620;text-align:center">${l.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2a2620;text-align:right">${formatPKR(l.unit_price)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2a2620;text-align:right">${formatPKR(l.line_total)}</td></tr>`,
    )
    .join('');
  const heading = audience === 'owner' ? `New order ${esc(o.orderNumber)}` : `Thank you, ${esc(o.customer.name)}`;
  const intro =
    audience === 'owner'
      ? `<strong>${esc(o.customer.name)}</strong> just placed a cash-on-delivery order on the website.`
      : `We have received your order. We will confirm it on WhatsApp and dispatch it soon. You pay in cash when it arrives.`;
  const info = (k: string, v: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#a9a196;vertical-align:top">${k}</td><td style="padding:4px 0;color:#f5efe2">${v}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#050505;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#f5efe2">
  <div style="max-width:620px;margin:0 auto;background:#0d0c0b;border:1px solid #3a3223;border-radius:14px;padding:32px">
    <div style="letter-spacing:.3em;color:#d4a647;font-size:12px">MAKHDOOM FRAGRANCES</div>
    <h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;margin:12px 0 8px">${heading}</h1>
    <p style="color:#cfc7b8;line-height:1.6;margin:0 0 20px">${intro}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      ${info('Order number', `<strong>${esc(o.orderNumber)}</strong>`)}
      ${info('Placed', esc(new Date(o.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })))}
      ${info('Payment', 'Cash on delivery')}
      ${info('Name', esc(o.customer.name))}
      ${info('Phone', esc(o.customer.phone))}
      ${o.customer.email ? info('Email', esc(o.customer.email)) : ''}
      ${info('City', esc(o.customer.city))}
      ${info('Address', esc(o.customer.address))}
      ${o.customer.notes ? info('Notes', esc(o.customer.notes)) : ''}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="color:#a9a196;text-align:left"><th style="padding-bottom:8px;font-weight:500">Item</th><th style="text-align:center;font-weight:500">Qty</th><th style="text-align:right;font-weight:500">Price</th><th style="text-align:right;font-weight:500">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:14px;font-size:14px">
      <tr><td style="color:#a9a196">Subtotal</td><td style="text-align:right">${formatPKR(o.subtotal)}</td></tr>
      <tr><td style="color:#a9a196">Delivery</td><td style="text-align:right">${o.shipping === 0 ? 'Free' : formatPKR(o.shipping)}</td></tr>
      <tr><td style="padding-top:10px;font-size:16px;color:#e2bc5f"><strong>Total to collect</strong></td><td style="padding-top:10px;text-align:right;font-size:18px;color:#e2bc5f"><strong>${formatPKR(o.total)}</strong></td></tr>
    </table>
    ${audience === 'owner' ? `<p style="margin-top:24px"><a href="https://wa.me/92${o.customer.phone.slice(1)}" style="color:#e2bc5f">Message the customer on WhatsApp</a></p>` : ''}
  </div></body></html>`;
}

export async function sendOrderEmails(o: OrderSummary): Promise<{ owner: boolean; customer: boolean }> {
  const resend = client();
  const result = { owner: false, customer: false };
  if (!resend) {
    log.warn('email: RESEND_API_KEY not set, skipping order emails');
    return result;
  }
  try {
    const { error } = await resend.emails.send({
      from: from(),
      to: [ownerTo()],
      replyTo: o.customer.email ?? undefined,
      subject: `New order ${o.orderNumber} — ${o.customer.name} — ${formatPKR(o.total)}`,
      html: orderHtml(o, 'owner'),
    });
    if (error) log.error('email: owner send failed', { msg: error.message });
    else result.owner = true;
  } catch (e) {
    log.error('email: owner send threw', { err: e instanceof Error ? e : new Error(String(e)) });
  }
  // Customer copy only works after you verify a sending domain in Resend. Opt in with SEND_CUSTOMER_CONFIRMATION=true.
  if (o.customer.email && process.env.SEND_CUSTOMER_CONFIRMATION === 'true') {
    try {
      const { error } = await resend.emails.send({
        from: from(),
        to: [o.customer.email],
        replyTo: ownerTo(),
        subject: `Your Makhdoom Fragrances order ${o.orderNumber}`,
        html: orderHtml(o, 'customer'),
      });
      if (error) log.error('email: customer send failed', { msg: error.message });
      else result.customer = true;
    } catch (e) {
      log.error('email: customer send threw', { err: e instanceof Error ? e : new Error(String(e)) });
    }
  }
  return result;
}

export async function sendContactEmail(p: { name: string; email: string; phone?: string; message: string }) {
  const resend = client();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: from(),
      to: [ownerTo()],
      replyTo: p.email,
      subject: `Website message from ${p.name}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p><strong>${esc(p.name)}</strong> (${esc(p.email)}${p.phone ? ', ' + esc(p.phone) : ''})</p><p>${esc(p.message).replace(/\n/g, '<br>')}</p></div>`,
    });
    return !error;
  } catch {
    return false;
  }
}
