import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, SESSION_TTL_S, adminEnabled, checkPassword, cookieOptions, createSession } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { adminStatus } from '@/lib/env';
import { enforce } from '@/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, hash, readJson, route } from '@/lib/security';

export const dynamic = 'force-dynamic';
const body = z.object({ password: z.string().min(1).max(200) });

export const POST = route('admin.login', async (req) => {
  assertSameOrigin(req, true);
  if (!adminEnabled()) throw new HttpError(503, adminStatus().problem ?? 'Admin is not configured.');
  const ip = hash(clientIp(req));
  // brute-force protection: per connection AND globally (a distributed guess attempt still hits the global ceiling)
  await enforce(`admin-login:${ip}`, 6, 900, 'Too many attempts. Try again in 15 minutes.');
  await enforce('admin-login:global', 40, 3600, 'Sign-in is temporarily locked. Try again later.');

  const parsed = body.safeParse(await readJson(req, 1024));
  if (!parsed.success) throw new HttpError(422, 'Enter the password.');

  if (!checkPassword(parsed.data.password)) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300)); // slows scripted guessing, hides timing differences
    await audit(req, 'admin.login.failed');
    throw new HttpError(401, 'Wrong password.');
  }
  const { token } = await createSession();
  await audit(req, 'admin.login');
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(ADMIN_COOKIE, token, cookieOptions(SESSION_TTL_S));
  return res;
});
