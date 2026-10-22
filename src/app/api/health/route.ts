import { readiness } from '@/lib/env';
import { getAdminClient } from '@/lib/supabase';
import { json } from '@/lib/security';

export const dynamic = 'force-dynamic';

/** Liveness: GET /api/health. Deep check (DB + config) needs the x-health-token header equal to HEALTH_TOKEN. */
export async function GET(req: Request) {
  const token = process.env.HEALTH_TOKEN;
  if (!token || req.headers.get('x-health-token') !== token) return json({ ok: true });
  const r = readiness();
  let db: 'ok' | 'error' | 'not-configured' = 'not-configured';
  const client = getAdminClient();
  if (client) {
    const { error } = await client.from('products').select('id', { head: true, count: 'exact' }).limit(1);
    db = error ? 'error' : 'ok';
  }
  return json({ ok: db !== 'error', database: db, email: r.email, admin: r.admin.enabled, rateLimiter: r.rateLimiter }, db === 'error' ? 503 : 200);
}
