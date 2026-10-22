/**
 * Signed admin session using WebCrypto only, so the SAME code verifies sessions in the Edge middleware and in Node routes.
 * token = base64url(json{sid,iat,exp,v}) . base64url(HMAC-SHA256("mk-admin-v1." + payload))
 * Verification uses crypto.subtle.verify, which is constant-time.
 */
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

const b64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const importKey = (secret: string, usage: KeyUsage[]) => subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);

export interface Session { sid: string; iat: number; exp: number; v: string }

export async function signSession(secret: string, epoch = '1', ttlSec = 8 * 3600, now = Date.now()): Promise<{ token: string; session: Session }> {
  if (!secret) throw new Error('session secret missing');
  const sid = b64(globalThis.crypto.getRandomValues(new Uint8Array(12)));
  const session: Session = { sid, iat: now, exp: now + ttlSec * 1000, v: epoch };
  const payload = b64(enc.encode(JSON.stringify(session)));
  const sig = new Uint8Array(await subtle.sign('HMAC', await importKey(secret, ['sign']), enc.encode(`mk-admin-v1.${payload}`)));
  return { token: `${payload}.${b64(sig)}`, session };
}

export async function verifySession(secret: string, token: string | undefined | null, epoch = '1', now = Date.now()): Promise<Session | null> {
  if (!secret || !token || token.length > 512) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await subtle.verify('HMAC', await importKey(secret, ['verify']), unb64(sig), enc.encode(`mk-admin-v1.${payload}`));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(payload))) as Session;
    if (typeof s.exp !== 'number' || s.exp < now || s.iat > now + 60_000 || s.v !== epoch) return null;
    return s;
  } catch {
    return null;
  }
}
