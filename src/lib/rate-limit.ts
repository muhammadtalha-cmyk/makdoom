import { limiterKind } from './env';
import { log } from './log';
import { getAdminClient } from './supabase';
import { HttpError } from './security';

/**
 * Two layers:
 *  1. an in-process sliding window (instant, protects each instance from bursts), bounded in size and flood-resistant, and
 *  2. a DURABLE shared counter (Upstash Redis if configured, otherwise Supabase via the rl_hit() SQL function)
 *     so the limit holds across serverless instances. The old in-memory-only limiter was reset on every cold start
 *     and never shared between instances, i.e. it did not really limit anything on Vercel.
 * If the durable store is unreachable we fail OPEN for the public forms (an outage must not block orders) and rely on layer 1.
 */
const MAX_KEYS = 20_000;
const buckets = new Map<string, number[]>();

function memoryHit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let hits = buckets.get(key);
  if (!hits && buckets.size >= MAX_KEYS) {
    // full: drop entries whose window has passed. If it is STILL full we stop tracking brand-new keys instead of forgetting
    // existing ones, so a flood of distinct keys can never reset the counter of a caller that is already limited.
    for (const [k, v] of buckets) if (now - v[v.length - 1] >= windowMs * 4) buckets.delete(k);
    if (buckets.size >= MAX_KEYS) return { ok: true, retryAfter: 0 };
  }
  hits = (hits ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) { buckets.set(key, hits); return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) }; }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfter: 0 };
}

async function upstashHit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', `rl:${key}`], ['EXPIRE', `rl:${key}`, windowSec, 'NX'], ['TTL', `rl:${key}`]]),
    signal: AbortSignal.timeout(900),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const out = (await res.json()) as { result: number }[];
  const count = out[0].result;
  return { ok: count <= limit, retryAfter: Math.max(1, out[2]?.result ?? windowSec) };
}

async function supabaseHit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const db = getAdminClient();
  if (!db) throw new Error('no db');
  const { data, error } = await db.rpc('rl_hit', { p_key: key, p_limit: limit, p_window_s: windowSec });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: Boolean(row?.allowed), retryAfter: Math.max(1, Number(row?.retry_after ?? windowSec)) };
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const local = memoryHit(key, limit, windowSec * 1000);
  if (!local.ok) return local;
  const kind = limiterKind();
  if (kind === 'memory') return local;
  try {
    return kind === 'upstash' ? await upstashHit(key, limit, windowSec) : await supabaseHit(key, limit, windowSec);
  } catch (e) {
    log.warn('rate limiter store unavailable, using in-process limit only', { kind, err: e instanceof Error ? e : new Error(String(e)) });
    return local;
  }
}

/** Throws a 429 with Retry-After semantics when the caller is over the limit. */
export async function enforce(key: string, limit: number, windowSec: number, message = 'Too many attempts. Please wait a few minutes and try again.') {
  const r = await rateLimit(key, limit, windowSec);
  if (!r.ok) throw new HttpError(429, message, { retryAfter: r.retryAfter });
}
