import { adminRoute } from '@/lib/admin-route';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const GET = adminRoute('audit', false, async () => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const { data, error } = await db.from('audit_log').select('id, at, action, target, meta').order('at', { ascending: false }).limit(100);
  if (error) throw new HttpError(500, 'Could not load activity.');
  return json({ events: data ?? [] });
});
