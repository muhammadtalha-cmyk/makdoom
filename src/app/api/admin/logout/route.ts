import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, cookieOptions } from '@/lib/admin-auth';
import { assertSameOrigin, route } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const POST = route('admin.logout', async (req) => {
  assertSameOrigin(req, true);
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(ADMIN_COOKIE, '', cookieOptions(0));
  return res;
});
