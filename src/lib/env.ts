import { log } from './log';

export type LimiterKind = 'upstash' | 'supabase' | 'memory';
export const isProd = () => process.env.NODE_ENV === 'production';

export function adminStatus(): { enabled: boolean; problem?: string } {
  const pw = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  if (!pw) return { enabled: false, problem: 'ADMIN_PASSWORD is not set.' };
  if (isProd()) {
    if (pw.length < 8) return { enabled: false, problem: 'ADMIN_PASSWORD must be at least 8 characters in production.' };
    if (secret.length < 32) return { enabled: false, problem: 'ADMIN_SESSION_SECRET must be at least 32 characters (run: openssl rand -hex 32).' };
  }
  return { enabled: true };
}
/** Session signing key. In production a dedicated secret is mandatory (see adminStatus). */
export const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || (isProd() ? '' : 'dev-only-secret-' + (process.env.ADMIN_PASSWORD ?? ''));

export const limiterKind = (): LimiterKind =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? 'upstash' : process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'memory';

export function readiness() {
  return {
    database: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    email: Boolean(process.env.RESEND_API_KEY),
    admin: adminStatus(),
    rateLimiter: limiterKind(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '(not set)',
  };
}

/** Called once at server start (instrumentation.ts). Warns loudly; never crashes the deploy. */
export function reportEnv() {
  const r = readiness();
  const problems: string[] = [];
  if (isProd()) {
    if (!r.database) problems.push('Supabase is not configured: ordering is disabled until NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    if (!r.email) problems.push('RESEND_API_KEY missing: new-order emails will not be sent (orders are still saved and visible in /admin).');
    if (!r.admin.enabled) problems.push(`Admin disabled: ${r.admin.problem}`);
    if (!process.env.NEXT_PUBLIC_SITE_URL || /localhost/.test(process.env.NEXT_PUBLIC_SITE_URL)) problems.push('NEXT_PUBLIC_SITE_URL is not the live URL: canonical links, sitemap and Open Graph will be wrong.');
    if (r.rateLimiter === 'memory') problems.push('Rate limiting is per-instance only (no Supabase/Upstash). Connect Supabase and run supabase/schema.sql.');
  }
  log.info('startup', { database: r.database, email: r.email, admin: r.admin.enabled, rateLimiter: r.rateLimiter });
  for (const p of problems) log.warn('config', { problem: p });
}
