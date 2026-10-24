import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { SITE } from './config';
import { getAdminClient, getPublicClient } from './supabase';
import { isAllowedImageUrl } from './product-images';
import { log } from './log';

/**
 * Owner-editable site content that is NOT part of the product catalogue:
 *   - the hard-coded pictures on the home page (couple deal + the "Find the scent that fits your day" cards)
 *   - social media links
 * Stored in the `site_settings` table (two rows: `home_images` and `social_links`). Every value is optional: anything
 * the owner has not changed falls back to the bundled picture / the NEXT_PUBLIC_*_URL environment variable.
 */
export const SETTINGS_TAG = 'site-settings';
export const IMAGES_ROW = 'home_images';
export const SOCIALS_ROW = 'social_links';

/* ------------------------------------------------------------------ home pictures */

export const IMAGE_SLOTS = [
  { key: 'couple', label: 'Couple deal picture', where: 'Big picture next to "The couple deal" box', hint: 'Landscape, at least 1600 px wide (for example 1600 × 1200).', fallback: '/images/story/couple-wide.webp' },
  { key: 'mood_cyrus', label: 'Cyrus card: "Office to evening"', where: 'First card under "Find the scent that fits your day"', hint: 'Portrait (taller than wide), at least 1200 × 1600.', fallback: '/images/story/cyrus-wide.webp' },
  { key: 'mood_zest', label: 'Zest card: "Clean and bold"', where: 'Second card in the left column', hint: 'Landscape, at least 1600 × 1200.', fallback: '/images/story/zest-citrus.webp' },
  { key: 'mood_nova', label: 'Nova card: "Everyday energy"', where: 'First card in the right column', hint: 'Landscape, at least 1600 × 1200.', fallback: '/images/story/nova-wide.webp' },
  { key: 'mood_flova', label: 'Flova card: "Soft and floral"', where: 'Second card in the right column', hint: 'Portrait (taller than wide), at least 1200 × 1600.', fallback: '/images/story/flova-roses.webp' },
  { key: 'mood_mira', label: 'Mira card: "Elegance, always"', where: 'Wide card at the bottom', hint: 'Very wide landscape, at least 2000 × 1250.', fallback: '/images/story/mira-wide.webp' },
] as const;
export type ImageKey = (typeof IMAGE_SLOTS)[number]['key'];
export const IMAGE_KEYS = IMAGE_SLOTS.map((s) => s.key) as [ImageKey, ...ImageKey[]];

/* ------------------------------------------------------------------ social links */

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com', 'instagr.am'], example: 'https://www.instagram.com/makhdoomfragrances', handle: (h: string) => `https://www.instagram.com/${h}` },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], example: 'https://www.facebook.com/makhdoomfragrances' },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], example: 'https://www.tiktok.com/@makhdoomfragrances', handle: (h: string) => `https://www.tiktok.com/@${h}` },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], example: 'https://www.youtube.com/@makhdoomfragrances', handle: (h: string) => `https://www.youtube.com/@${h}` },
  { key: 'x', label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'], example: 'https://x.com/makhdoomfragrances', handle: (h: string) => `https://x.com/${h}` },
  { key: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'], example: 'https://www.snapchat.com/add/makhdoomfragrances', handle: (h: string) => `https://www.snapchat.com/add/${h}` },
  { key: 'pinterest', label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], example: 'https://www.pinterest.com/makhdoomfragrances' },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'], example: 'https://www.linkedin.com/company/makhdoomfragrances' },
] as const;
export type SocialKey = (typeof SOCIAL_PLATFORMS)[number]['key'];
export const SOCIAL_KEYS = SOCIAL_PLATFORMS.map((p) => p.key) as [SocialKey, ...SocialKey[]];
type Platform = { key: SocialKey; label: string; hosts: readonly string[]; example: string; handle?: (h: string) => string };

/**
 * Turns whatever the owner typed into a safe https link for that platform, or returns null if it is not acceptable.
 * Accepts "https://…", "www.…", "instagram.com/name" and (for apps that support it) "@name".
 * Only https links on the platform's own domain are accepted, so a typo or a hijacked session can never put a
 * `javascript:` link or a look-alike site into the footer.
 */
export function normalizeSocialUrl(platformKey: SocialKey, input: string): string | null {
  const p = SOCIAL_PLATFORMS.find((x) => x.key === platformKey) as Platform | undefined;
  if (!p) return null;
  let s = input.trim();
  if (!s || s.length > 300) return null;
  if (s.startsWith('@')) {
    const h = s.slice(1);
    if (!p.handle || !/^[A-Za-z0-9._]{1,40}$/.test(h)) return null;
    s = p.handle(h);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null; // javascript:, data:, mailto: ...
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!p.hosts.some((d) => host === d || host.endsWith(`.${d}`))) return null;
  return u.toString();
}

/* ------------------------------------------------------------------ admin input validation */

const imageUrl = z.string().trim().refine(isAllowedImageUrl, 'Please use the picture uploader: only pictures uploaded from the dashboard are allowed.');
const shape = <T extends z.ZodTypeAny>(keys: readonly string[], value: T) => z.object(Object.fromEntries(keys.map((k) => [k, value.nullable().optional()]))).strict();
/** `null` (or an empty text) means "remove my change": the picture goes back to the original / the link is hidden. */
export const adminSitePatch = z
  .object({
    images: shape(IMAGE_SLOTS.map((s) => s.key), imageUrl).optional(),
    socials: shape(SOCIAL_PLATFORMS.map((p) => p.key), z.string().trim().max(300)).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.images && Object.keys(v.images).length) || Boolean(v.socials && Object.keys(v.socials).length), 'Nothing to update.');

/* ------------------------------------------------------------------ resolving what the website shows */

type Raw = Record<string, unknown>;
export interface SiteSettings {
  images: Record<ImageKey, string>;
  /** only the pictures the owner replaced (key → url) */
  customImages: Partial<Record<ImageKey, string>>;
  /** links to show, in display order */
  socials: { key: SocialKey; label: string; url: string }[];
}

const env: Record<string, string | undefined> = { instagram: SITE.socials.instagram, facebook: SITE.socials.facebook, tiktok: SITE.socials.tiktok };

/** Pure: raw database rows → what the website shows. Anything missing or invalid falls back safely. */
export function resolveSettings(rows: Record<string, unknown>): SiteSettings {
  const imgRaw = (rows[IMAGES_ROW] && typeof rows[IMAGES_ROW] === 'object' ? rows[IMAGES_ROW] : {}) as Raw;
  const socRaw = (rows[SOCIALS_ROW] && typeof rows[SOCIALS_ROW] === 'object' ? rows[SOCIALS_ROW] : {}) as Raw;

  const customImages: Partial<Record<ImageKey, string>> = {};
  const images = {} as Record<ImageKey, string>;
  for (const s of IMAGE_SLOTS) {
    const v = imgRaw[s.key];
    if (typeof v === 'string' && isAllowedImageUrl(v)) { customImages[s.key] = v; images[s.key] = v; } else images[s.key] = s.fallback;
  }

  const socials: SiteSettings['socials'] = [];
  for (const p of SOCIAL_PLATFORMS) {
    const fromDb = typeof socRaw[p.key] === 'string' ? normalizeSocialUrl(p.key, socRaw[p.key] as string) : null;
    const envUrl = env[p.key];
    const fromEnv = envUrl && !/your[_-]?(handle|page)/i.test(envUrl) ? normalizeSocialUrl(p.key, envUrl) : null; // ignore the .env.example placeholders
    const url = fromDb ?? fromEnv;
    if (url) socials.push({ key: p.key, label: p.label, url });
  }
  return { images, customImages, socials };
}

async function fetchRows(): Promise<Record<string, unknown>> {
  const client = getPublicClient() ?? getAdminClient();
  if (!client) throw new Error('database not configured');
  const { data, error } = await client.from('site_settings').select('key, value').in('key', [IMAGES_ROW, SOCIALS_ROW]);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
}

// Thrown errors are not cached, so a database outage never pins defaults in the cache.
const cached = unstable_cache(fetchRows, ['site-settings-v1'], { tags: [SETTINGS_TAG], revalidate: 300 });

/** Home pictures + social links for DISPLAY: cached 5 minutes and purged instantly when the owner saves. Never throws. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return resolveSettings(await cached());
  } catch (e) {
    if (getPublicClient() || getAdminClient()) log.warn('site settings: using bundled defaults', { err: e instanceof Error ? e : new Error(String(e)) });
    return resolveSettings({});
  }
}
