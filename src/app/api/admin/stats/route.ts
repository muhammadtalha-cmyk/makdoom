import { adminRoute } from '@/lib/admin-route';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json } from '@/lib/security';

export const dynamic = 'force-dynamic';
const STATUSES = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'] as const;

export const GET = adminRoute('stats', false, async () => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [counts, recent, unhandled, subs] = await Promise.all([
    Promise.all(STATUSES.map((s) => db.from('orders').select('id', { count: 'exact', head: true }).eq('status', s))),
    db.from('orders').select('total, status, created_at').gte('created_at', since).neq('status', 'cancelled').limit(5000),
    db.from('messages').select('id', { count: 'exact', head: true }).eq('handled', false),
    db.from('subscribers').select('id', { count: 'exact', head: true }),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i].count ?? 0]));
  const rows = recent.data ?? [];
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const sum = (from: number) => rows.filter((r) => new Date(r.created_at).getTime() >= from).reduce((a, r) => a + r.total, 0);
  return json({
    byStatus,
    revenue: { today: sum(startOfToday.getTime()), week: sum(Date.now() - 7 * 86400_000), month: sum(0) },
    ordersLast30: rows.length,
    unhandledMessages: unhandled.count ?? 0,
    subscribers: subs.count ?? 0,
  });
});
