import { after } from 'next/server';
import { contactSchema } from '@/lib/validation';
import { sendContactEmail } from '@/lib/email';
import { getAdminClient } from '@/lib/supabase';
import { enforce } from '@/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, hash, json, readJson, route } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const POST = route('contact', async (req) => {
  assertSameOrigin(req);
  const ip = hash(clientIp(req));
  await enforce(`contact:${ip}`, 5, 3600);
  const parsed = contactSchema.safeParse(await readJson(req, 8 * 1024));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Please check the form.');
  const d = parsed.data;
  if (d.website) return json({ ok: true });
  await enforce(`contact-email:${hash(d.email.toLowerCase())}`, 3, 3600);

  const db = getAdminClient();
  let saved = false;
  if (db) {
    const { error } = await db.from('messages').insert({ name: d.name, email: d.email, phone: d.phone ?? null, message: d.message });
    saved = !error;
  }
  after(async () => { await sendContactEmail({ name: d.name, email: d.email, phone: d.phone, message: d.message }); });
  // if neither storage nor email can work, tell the visitor instead of silently dropping the message
  if (!saved && !process.env.RESEND_API_KEY) throw new HttpError(503, 'Messages are unavailable right now. Please use WhatsApp.');
  return json({ ok: true });
});
