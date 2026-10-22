import { trackSchema } from '@/lib/validation';
import { getAdminClient } from '@/lib/supabase';
import { enforce } from '@/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, hash, json, readJson, route } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const POST = route('track', async (req) => {
  assertSameOrigin(req);
  const ip = hash(clientIp(req));
  await enforce(`track:${ip}`, 15, 600, 'Too many lookups. Please try again shortly.');
  const parsed = trackSchema.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Check the details.');
  // order numbers have ~1e9 combinations and need the phone as well; still cap guessing per order number and per phone
  await enforce(`track-order:${parsed.data.orderNumber}`, 10, 3600);
  await enforce(`track-phone:${hash(parsed.data.phone)}`, 20, 3600);

  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Order tracking is not available right now.');
  const { data: order } = await db.from('orders').select('id, order_number, status, city, subtotal, shipping_fee, total, created_at').eq('order_number', parsed.data.orderNumber).eq('phone', parsed.data.phone).maybeSingle();
  if (!order) throw new HttpError(404, 'No order found with those details. Check the number and phone.');
  const { data: items } = await db.from('order_items').select('product_name, quantity, line_total').eq('order_id', order.id);
  return json({ ok: true, order: { ...order, id: undefined, items: items ?? [] } });
});
