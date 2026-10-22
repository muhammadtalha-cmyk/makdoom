import { adminOrdersQuery } from '@/lib/validation';
import { adminRoute, safeTerm } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { toCsv } from '@/lib/csv';
import { getAdminClient } from '@/lib/supabase';
import { HttpError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const GET = adminRoute('orders.export', false, async (req) => {
  const q = adminOrdersQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) throw new HttpError(422, 'Bad filter.');
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  let query = db.from('orders').select('order_number, created_at, status, customer_name, phone, email, city, address, notes, subtotal, shipping_fee, total, order_items(product_name, quantity)').order('created_at', { ascending: false }).limit(5000);
  if (q.data.status) query = query.eq('status', q.data.status);
  const term = q.data.q ? safeTerm(q.data.q) : '';
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Export failed.');
  const rows = (data ?? []).map((o) => [
    o.order_number, new Date(o.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }), o.status, o.customer_name, o.phone, o.email ?? '', o.city, o.address, o.notes ?? '',
    (o.order_items as { product_name: string; quantity: number }[]).map((i) => `${i.quantity} × ${i.product_name}`).join('; '), o.subtotal, o.shipping_fee, o.total,
  ]);
  await audit(req, 'orders.export', undefined, { rows: rows.length });
  const csv = toCsv(['Order', 'Placed (PKT)', 'Status', 'Name', 'Phone', 'Email', 'City', 'Address', 'Notes', 'Items', 'Subtotal', 'Delivery', 'Total'], rows);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
});
