import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { adminStatus, isProd, sessionSecret } from './env';
import { signSession, verifySession, type Session } from './admin-token';
import { HttpError } from './security';

/** `__Host-` prefix (production): the browser only accepts the cookie if it is Secure, Path=/ and has no Domain. */
export const ADMIN_COOKIE = isProd() ? '__Host-mk_admin' : 'mk_admin';
export const SESSION_TTL_S = 8 * 3600;
const epoch = () => process.env.ADMIN_SESSION_EPOCH || '1'; // bump the env var to sign every admin out at once

export const adminEnabled = () => adminStatus().enabled;

/** Compares SHA-256 digests, so the comparison time depends neither on the length nor the content of the password. */
export function checkPassword(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD ?? '';
  if (!real) return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}

export const createSession = () => signSession(sessionSecret(), epoch(), SESSION_TTL_S);

export async function currentSession(): Promise<Session | null> {
  if (!adminEnabled()) return null;
  const jar = await cookies();
  return verifySession(sessionSecret(), jar.get(ADMIN_COOKIE)?.value, epoch());
}
export const isAdmin = async () => (await currentSession()) !== null;

export async function requireAdmin(): Promise<Session> {
  const s = await currentSession();
  if (!s) throw new HttpError(401, 'Please sign in again.');
  return s;
}

export const cookieOptions = (maxAge: number) => ({ httpOnly: true, sameSite: 'strict' as const, secure: isProd(), path: '/', maxAge });
