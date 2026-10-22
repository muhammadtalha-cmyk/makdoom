import { adminMessagePatch } from '@/lib/validation';
import { adminRoute } from '@/lib/admin-route';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json, readJson } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const GET = adminRoute('messages.list', false, async () => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const { data, error } = await db.from('messages').select('id, name, email, phone, message, handled, created_at').order('created_at', { ascending: false }).limit(200);
  if (error) throw new HttpError(500, 'Could not load messages.');
  return json({ messages: data ?? [] });
});

export const PATCH = adminRoute('messages.update', true, async (req) => {
  const p = adminMessagePatch.safeParse(await readJson(req, 1024));
  if (!p.success) throw new HttpError(422, 'Invalid request.');
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  const { error } = await db.from('messages').update({ handled: p.data.handled }).eq('id', p.data.id);
  if (error) throw new HttpError(500, 'Could not update.');
  return json({ ok: true });
});
