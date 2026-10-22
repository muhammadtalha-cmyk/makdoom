import { adminOrderPatch, adminOrdersQuery } from '@/lib/validation';
import { adminRoute, safeTerm } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json, readJson } from '@/lib/security';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const COLS = 'id, order_number, status, customer_name, phone, email, city, address, notes, subtotal, shipping_fee, total, created_at, owner_notified, order_items(product_name, quantity, unit_price, line_total)';

export const GET = adminRoute('orders.list', false, async (req) => {
  const q = adminOrdersQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) throw new HttpError(422, 'Bad filter.');
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  let query = db.from('orders').select(COLS, { count: 'exact' }).order('created_at', { ascending: false });
  if (q.data.status) query = query.eq('status', q.data.status);
  const term = q.data.q ? safeTerm(q.data.q) : '';
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`);
  const from = (q.data.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new HttpError(500, 'Could not load orders.');
  return json({ orders: data ?? [], total: count ?? 0, page: q.data.page, pageSize: PAGE_SIZE });
});

export const PATCH = adminRoute('orders.update', true, async (req) => {
  const parsed = adminOrderPatch.safeParse(await readJson(req, 1024));
  if (!parsed.success) throw new HttpError(422, 'Invalid request.');
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const { data, error } = await db.from('orders').update({ status: parsed.data.status }).eq('id', parsed.data.id).select('id, order_number, status').single();
  if (error || !data) throw new HttpError(404, 'Order not found.');
  await audit(req, 'order.status', data.order_number, { status: data.status });
  return json({ ok: true, order: data });
});
