import { subscribeSchema } from '@/lib/validation';
import { getAdminClient } from '@/lib/supabase';
import { enforce } from '@/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, hash, json, readJson, route } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const POST = route('subscribe', async (req) => {
  assertSameOrigin(req);
  await enforce(`subscribe:${hash(clientIp(req))}`, 6, 3600);
  const parsed = subscribeSchema.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Enter a valid email.');
  if (parsed.data.website) return json({ ok: true });
  const db = getAdminClient();
  if (db) {
    const { error } = await db.from('subscribers').upsert({ email: parsed.data.email.toLowerCase() }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) throw new HttpError(500, 'Could not subscribe right now. Please try again.');
  }
  return json({ ok: true }); // identical response whether or not the address already existed (no enumeration)
});
