import test from 'node:test';
import assert from 'node:assert/strict';
import { signSession, verifySession } from '../src/lib/admin-token';
import { csvCell, toCsv } from '../src/lib/csv';
import { rateLimit } from '../src/lib/rate-limit';
import { HttpError, assertSameOrigin, clientIp, readJson } from '../src/lib/security';

const SECRET = 'x'.repeat(40);

test('session: round trip, expiry, tamper, wrong secret, epoch revocation', async () => {
  const { token } = await signSession(SECRET, '1', 60, 1_000_000);
  assert.ok(await verifySession(SECRET, token, '1', 1_000_000 + 30_000));
  assert.equal(await verifySession(SECRET, token, '1', 1_000_000 + 61_000), null, 'expired');
  assert.equal(await verifySession('y'.repeat(40), token, '1', 1_000_000), null, 'wrong secret');
  assert.equal(await verifySession(SECRET, token, '2', 1_000_000), null, 'epoch bump signs everyone out');
  const [p, s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sid: 'a', iat: 1, exp: 9e15, v: '1' })).toString('base64url');
  assert.equal(await verifySession(SECRET, `${forged}.${s}`, '1', 1_000_000), null, 'payload swap');
  assert.equal(await verifySession(SECRET, `${p}.${s.slice(0, -2)}AA`, '1', 1_000_000), null, 'signature tamper');
  assert.equal(await verifySession(SECRET, '', '1'), null);
  assert.equal(await verifySession(SECRET, 'a'.repeat(600), '1'), null, 'oversized');
  assert.equal(await verifySession('', token, '1'), null, 'empty secret never validates');
});

test('csv: neutralises spreadsheet formula injection and escapes quotes', () => {
  for (const evil of ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) assert.ok(csvCell(evil).startsWith(`"'`), evil);
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell('safe text'), '"safe text"');
  assert.ok(toCsv(['a'], [['=1']]).startsWith('\uFEFF'), 'BOM for Excel UTF-8');
});

test('rate limiter: enforces the limit, is per key, and never wipes all keys when full', async () => {
  const k = 'k' + Math.random();
  for (let i = 0; i < 3; i++) assert.equal((await rateLimit(k, 3, 60)).ok, true);
  const blocked = await rateLimit(k, 3, 60);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
  assert.equal((await rateLimit(k + 'other', 3, 60)).ok, true, 'other keys unaffected');
  // flood with distinct keys beyond the cap: an attacker must not be able to reset a victim's counter by eviction flooding
  const victim = 'victim' + Math.random();
  for (let i = 0; i < 2; i++) await rateLimit(victim, 2, 60);
  for (let i = 0; i < 21_000; i++) await rateLimit('flood' + i, 5, 60);
  assert.equal((await rateLimit(victim, 2, 60)).ok, false, 'a flood of distinct keys cannot reset an already-limited caller');
});

test('clientIp: cannot be spoofed by a client-supplied X-Forwarded-For prefix', () => {
  const mk = (h: Record<string, string>) => new Request('http://x', { headers: h });
  assert.equal(clientIp(mk({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(mk({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(mk({ 'x-vercel-forwarded-for': '198.51.100.4', 'x-forwarded-for': '6.6.6.6' })), '198.51.100.4');
  assert.equal(clientIp(mk({})), 'unknown');
});

test('same-origin: blocks cross-site, allows same-site, strict mode needs a signal', () => {
  const mk = (h: Record<string, string>) => new Request('http://x', { method: 'POST', headers: { host: 'shop.example', ...h } });
  assert.throws(() => assertSameOrigin(mk({ origin: 'https://evil.example' })), HttpError);
  assert.throws(() => assertSameOrigin(mk({ 'sec-fetch-site': 'cross-site' })), HttpError);
  assert.doesNotThrow(() => assertSameOrigin(mk({ origin: 'https://shop.example' })));
  assert.doesNotThrow(() => assertSameOrigin(mk({ 'sec-fetch-site': 'same-origin' })));
  assert.doesNotThrow(() => assertSameOrigin(mk({})), 'non-browser API client (lenient)');
  assert.throws(() => assertSameOrigin(mk({}), true), HttpError, 'strict: neither header present');
});

test('readJson: enforces the byte cap while streaming and validates type', async () => {
  const post = (body: string, ct = 'application/json', extra: Record<string, string> = {}) => new Request('http://x', { method: 'POST', body, headers: { 'content-type': ct, ...extra } });
  assert.deepEqual(await readJson(post('{"a":1}')), { a: 1 });
  await assert.rejects(readJson(post('{"a":"' + 'x'.repeat(5000) + '"}'), 1000), (e: HttpError) => e.status === 413);
  await assert.rejects(readJson(post('{}', 'text/plain')), (e: HttpError) => e.status === 415);
  await assert.rejects(readJson(post('{nope')), (e: HttpError) => e.status === 400);
});
