import { revalidatePath, revalidateTag } from 'next/cache';
import { adminRoute } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json, readJson } from '@/lib/security';
import { IMAGE_BUCKET, storagePathOf } from '@/lib/product-images';
import {
  IMAGES_ROW, IMAGE_SLOTS, SETTINGS_TAG, SOCIALS_ROW, SOCIAL_PLATFORMS,
  adminSitePatch, normalizeSocialUrl, resolveSettings, type ImageKey, type SocialKey,
} from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

const need = () => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  return db;
};

/** Friendly message when the owner has not yet run supabase/site-settings.sql. */
const dbFail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === '42P01' || /site_settings/.test(error.message)) {
    throw new HttpError(500, 'Database update needed: run supabase/site-settings.sql once in the Supabase SQL editor, then try again.');
  }
  throw new HttpError(500, fallback);
};

async function readRows() {
  const db = need();
  const { data, error } = await db.from('site_settings').select('key, value').in('key', [IMAGES_ROW, SOCIALS_ROW]);
  if (error) return dbFail(error, 'Could not load the settings.');
  return Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Record<string, unknown>;
}

const asObject = (v: unknown): Record<string, string> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {});

export const GET = adminRoute('site.read', false, async () => {
  const rows = await readRows();
  const settings = resolveSettings(rows);
  const savedSocials = asObject(rows[SOCIALS_ROW]);
  return json({
    images: IMAGE_SLOTS.map((s) => ({
      key: s.key, label: s.label, where: s.where, hint: s.hint, original: s.fallback,
      current: settings.images[s.key], custom: Boolean(settings.customImages[s.key]),
    })),
    socials: SOCIAL_PLATFORMS.map((p) => ({
      key: p.key, label: p.label, example: p.example,
      url: typeof savedSocials[p.key] === 'string' ? normalizeSocialUrl(p.key, savedSocials[p.key]) ?? '' : '',
    })),
  });
});

export const PATCH = adminRoute('site.update', true, async (req) => {
  const parsed = adminSitePatch.safeParse(await readJson(req, 16 * 1024));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Invalid data.');
  const { images, socials } = parsed.data;
  const db = need();
  const rows = await readRows();
  const now = new Date().toISOString();
  const upserts: { key: string; value: Record<string, string>; updated_at: string }[] = [];
  const removedImages: string[] = [];

  if (images) {
    const next = { ...asObject(rows[IMAGES_ROW]) };
    for (const [k, v] of Object.entries(images) as [ImageKey, string | null | undefined][]) {
      if (v === undefined) continue;
      if (next[k] && next[k] !== v) removedImages.push(next[k]);
      if (v) next[k] = v; else delete next[k];
    }
    upserts.push({ key: IMAGES_ROW, value: next, updated_at: now });
  }

  if (socials) {
    const next = { ...asObject(rows[SOCIALS_ROW]) };
    for (const [k, v] of Object.entries(socials) as [SocialKey, string | null | undefined][]) {
      if (v === undefined) continue;
      if (v === null || v === '') { delete next[k]; continue; }
      const url = normalizeSocialUrl(k, v);
      const p = SOCIAL_PLATFORMS.find((x) => x.key === k)!;
      if (!url) throw new HttpError(422, `${p.label}: please paste the full link to your ${p.label} page, for example ${p.example}`);
      next[k] = url;
    }
    upserts.push({ key: SOCIALS_ROW, value: next, updated_at: now });
  }

  const { error } = await db.from('site_settings').upsert(upserts, { onConflict: 'key' });
  if (error) return dbFail(error, 'Could not save your changes. Please try again.');

  revalidateTag(SETTINGS_TAG); // the storefront shows the change immediately instead of after the cache window
  revalidatePath('/', 'layout');
  await audit(req, 'site.update', 'settings', { images: images ? Object.keys(images) : [], socials: socials ? Object.keys(socials) : [] });
  if (removedImages.length) void removeUnusedImages(removedImages);

  const saved = Object.fromEntries(upserts.map((u) => [u.key, u.value]));
  return json({ ok: true, settings: resolveSettings({ ...rows, ...saved }) });
});

/** Best effort: deletes replaced uploads that nothing references any more (home pictures AND catalogue). Never throws. */
async function removeUnusedImages(urls: string[]) {
  try {
    const db = getAdminClient();
    if (!db) return;
    const candidates = [...new Set(urls.filter((u) => storagePathOf(u) !== null))];
    if (candidates.length === 0) return;
    const inUse = new Set<string>();
    const { data: products } = await db.from('products').select('image, hover_image, gallery');
    for (const r of products ?? []) [r.image, r.hover_image, ...(r.gallery ?? [])].forEach((u: string | null) => u && inUse.add(u));
    const { data: settings } = await db.from('site_settings').select('value').in('key', [IMAGES_ROW]);
    for (const r of settings ?? []) Object.values(asObject(r.value)).forEach((u) => inUse.add(u));
    const paths = candidates.filter((u) => !inUse.has(u)).map((u) => storagePathOf(u)!);
    if (paths.length) await db.storage.from(IMAGE_BUCKET).remove(paths);
  } catch { /* cleanup is optional */ }
}
