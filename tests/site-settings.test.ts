import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSitePatch, normalizeSocialUrl, resolveSettings } from '../src/lib/site-settings';

test('social links: accepts real profile links and common shortcuts', () => {
  assert.equal(normalizeSocialUrl('instagram', 'https://www.instagram.com/makhdoom'), 'https://www.instagram.com/makhdoom');
  assert.equal(normalizeSocialUrl('instagram', 'instagram.com/makhdoom'), 'https://instagram.com/makhdoom');
  assert.equal(normalizeSocialUrl('instagram', '@makhdoom.fragrances'), 'https://www.instagram.com/makhdoom.fragrances');
  assert.equal(normalizeSocialUrl('tiktok', '@makhdoom'), 'https://www.tiktok.com/@makhdoom');
  assert.equal(normalizeSocialUrl('facebook', 'http://m.facebook.com/makhdoom'), 'https://m.facebook.com/makhdoom');
  assert.equal(normalizeSocialUrl('x', 'https://twitter.com/makhdoom'), 'https://twitter.com/makhdoom');
});

test('social links: rejects anything unsafe or on the wrong site', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'https://evil.com/instagram.com', 'https://instagram.com.evil.com/x', 'https://user:pw@instagram.com/x', 'https://instagram.com:8080/x', '', '   ', 'not a link', 'mailto:a@b.com']) {
    assert.equal(normalizeSocialUrl('instagram', bad), null, bad);
  }
  assert.equal(normalizeSocialUrl('facebook', '@name'), null); // facebook needs a full link
  assert.equal(normalizeSocialUrl('tiktok', 'https://www.instagram.com/x'), null); // wrong platform
});

test('settings: defaults when nothing is saved, overrides when valid, junk is ignored', () => {
  const base = resolveSettings({});
  assert.equal(base.images.couple, '/images/story/couple-wide.webp');
  assert.deepEqual(base.customImages, {});
  const s = resolveSettings({ home_images: { couple: '/images/story/zest-leaf-wide.webp', mood_nova: 'https://evil.com/x.png', bogus: 1 }, social_links: { instagram: 'https://www.instagram.com/mk', tiktok: 'javascript:alert(1)' } });
  assert.equal(s.images.couple, '/images/story/zest-leaf-wide.webp');
  assert.equal(s.images.mood_nova, '/images/story/nova-wide.webp'); // foreign picture rejected → bundled one
  assert.deepEqual(s.socials.map((x) => x.key), ['instagram']);
});

test('admin patch: validates pictures and links, allows null to reset, rejects unknown keys and empty requests', () => {
  assert.ok(adminSitePatch.safeParse({ images: { couple: null } }).success);
  assert.ok(adminSitePatch.safeParse({ images: { couple: '/images/story/couple-wide.webp' } }).success);
  assert.ok(adminSitePatch.safeParse({ socials: { facebook: 'https://www.facebook.com/x', tiktok: null } }).success);
  assert.ok(!adminSitePatch.safeParse({ images: { couple: 'https://evil.com/a.png' } }).success);
  assert.ok(!adminSitePatch.safeParse({ images: { hero: '/images/a.webp' } }).success);
  assert.ok(!adminSitePatch.safeParse({ images: {} }).success);
  assert.ok(!adminSitePatch.safeParse({}).success);
});
