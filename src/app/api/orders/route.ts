import { after } from 'next/server';
import { orderSchema } from '@/lib/validation';
import { OrderError, createOrder } from '@/lib/orders';
import { sendOrderEmails } from '@/lib/email';
import { getAdminClient } from '@/lib/supabase';
import { enforce } from '@/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, hash, json, readJson, route } from '@/lib/security';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export const POST = route('orders', async (req, rid) => {
  assertSameOrigin(req);
  const ip = hash(clientIp(req));
  await enforce(`order-burst:${ip}`, 3, 60);
  await enforce(`order:${ip}`, 8, 3600, 'Too many orders from this connection. Please order on WhatsApp.');

  const parsed = orderSchema.safeParse(await readJson(req, 12 * 1024));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Please check your details.', { field: parsed.error.issues[0]?.path[0] });
  const d = parsed.data;
  if (d.website) return json({ ok: true, order: null }); // honeypot: pretend success, store nothing

  await enforce(`order-phone:${hash(d.phone)}`, 5, 3600, 'We already received several orders for this number. Please wait or order on WhatsApp.');

  try {
    const { order, created, id } = await createOrder({ ...d, idempotencyKey: d.idempotencyKey });
    if (created) {
      // respond to the customer immediately; send emails after the response (Vercel keeps the function alive for `after`)
      after(async () => {
        const sent = await sendOrderEmails(order);
        const db = getAdminClient();
        if (db && id && sent.owner) await db.from('orders').update({ owner_notified: true }).eq('id', id);
      });
      log.info('order created', { rid, orderNumber: order.orderNumber, total: order.total, demo: Boolean(order.demo) });
    }
    return json({ ok: true, order });
  } catch (e) {
    if (e instanceof OrderError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
