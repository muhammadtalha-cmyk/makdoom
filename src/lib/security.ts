import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { log } from './log';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
export const json = (data: unknown, init: number | ResponseInit = 200) => {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, { ...base, headers: { ...NO_STORE, ...(base.headers as Record<string, string> | undefined) } });
};

/**
 * CSRF defence for cookie-authenticated and form endpoints. Browsers always send Sec-Fetch-Site and/or Origin on a POST,
 * so a request that is demonstrably cross-site is rejected. `strict` also rejects requests that carry neither header.
 */
export function assertSameOrigin(req: Request, strict = false) {
  const site = req.headers.get('sec-fetch-site');
  const origin = req.headers.get('origin');
  if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Cross-site request blocked.');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { /* malformed */ }
    if (!ok) throw new HttpError(403, 'Cross-site request blocked.');
  } else if (strict && !site) {
    throw new HttpError(403, 'Missing origin.');
  }
}

/** Reads a JSON body with a hard byte cap (the cap is enforced while streaming, not after buffering). */
export async function readJson(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Request too large.');
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) throw new HttpError(415, 'Send JSON.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'Empty request.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

/**
 * Client IP. TRUSTED_PROXY_HOPS = how many proxies in front of the app append to X-Forwarded-For (Vercel: 1, the default).
 * We take the entry the nearest trusted proxy added, so a client cannot spoof its address by sending its own header.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip');
  if (real) return real.split(',')[0].trim();
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  return parts[Math.max(0, parts.length - hops)] ?? 'unknown';
}
export const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);
export const requestId = (req: Request) => req.headers.get('x-request-id') ?? randomUUID().slice(0, 8);

/** Wraps a route handler: consistent errors, request ids, no stack traces or DB messages leaking to clients. */
export function route(name: string, fn: (req: Request, rid: string) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const rid = requestId(req);
    try {
      const res = await fn(req, rid);
      res.headers.set('x-request-id', rid);
      return res;
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status >= 500) log.error('http error', { route: name, rid, status: e.status, err: e });
        const res = json({ error: e.message, ...(e.extra ?? {}) }, e.status);
        res.headers.set('x-request-id', rid);
        return res;
      }
      log.error('unhandled', { route: name, rid, err: e instanceof Error ? e : new Error(String(e)) });
      const res = json({ error: 'Something went wrong. Please try again.', ref: rid }, 500);
      res.headers.set('x-request-id', rid);
      return res;
    }
  };
}
