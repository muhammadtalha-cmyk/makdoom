import { adminRoute } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { toCsv } from '@/lib/csv';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const GET = adminRoute('subscribers', false, async (req) => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const csv = new URL(req.url).searchParams.get('format') === 'csv';
  const { data, count, error } = await db.from('subscribers').select('email, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(csv ? 20000 : 200);
  if (error) throw new HttpError(500, 'Could not load subscribers.');
  if (!csv) return json({ subscribers: data ?? [], total: count ?? 0 });
  await audit(req, 'subscribers.export', undefined, { rows: data?.length ?? 0 });
  return new Response(toCsv(['Email', 'Subscribed'], (data ?? []).map((s) => [s.email, s.created_at])), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="subscribers.csv"', 'Cache-Control': 'no-store' } });
});
