/** Where product pictures may live: the bundled /public/images folder, or the public Supabase Storage bucket the admin uploads to. */
export const IMAGE_BUCKET = 'product-images';

const supabaseOrigin = (): string | null => {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return null;
  try { return new URL(u).origin; } catch { return null; }
};

/** Public URL prefix of the bucket, e.g. https://xyz.supabase.co/storage/v1/object/public/product-images/ */
export const bucketPrefix = (): string | null => {
  const o = supabaseOrigin();
  return o ? `${o}/storage/v1/object/public/${IMAGE_BUCKET}/` : null;
};

/** Accepts only pictures we host ourselves, so an admin typo (or a hijacked session) can never point the shop at a random site. */
export function isAllowedImageUrl(url: string): boolean {
  if (url.length > 500) return false;
  if (url.startsWith('/images/')) return !url.includes('..') && !url.includes('//') && /^[\w\-./]+$/.test(url);
  const prefix = bucketPrefix();
  if (!prefix || !url.startsWith(prefix)) return false;
  const name = url.slice(prefix.length);
  return name.length > 0 && !name.includes('..') && /^[\w\-./]+$/.test(name);
}

/** Storage object path for one of OUR bucket URLs (or null for bundled/foreign images), used to clean up deleted pictures. */
export function storagePathOf(url: string | null | undefined): string | null {
  const prefix = bucketPrefix();
  if (!url || !prefix || !url.startsWith(prefix)) return null;
  return url.slice(prefix.length) || null;
}
