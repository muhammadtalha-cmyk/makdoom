import { revalidatePath, revalidateTag } from 'next/cache';
import { adminProductCreate, adminProductDelete, adminProductPatch } from '@/lib/validation';
import { adminRoute } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { PRODUCTS_TAG } from '@/lib/catalog';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json, readJson } from '@/lib/security';
import { IMAGE_BUCKET, storagePathOf } from '@/lib/product-images';
import { CHAPTER_SLUGS } from '@/components/hero/chapters';

export const dynamic = 'force-dynamic';

/** These products drive the 3D hero / the menu link, so they can be edited (price, pictures, text) but not deleted. */
const PROTECTED = new Set<string>([...CHAPTER_SLUGS, 'couple-deal']);

const publish = () => {
  revalidateTag(PRODUCTS_TAG); // storefront shows the change immediately instead of after the cache window
  revalidatePath('/', 'layout');
};

const need = () => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  return db;
};

/** Friendly message when the owner has not yet re-run supabase/schema.sql after this update. */
const dbFail = (error: { message: string; code?: string }, fallback: string): never => {
  if (error.code === '23505') throw new HttpError(409, 'A product with that web address already exists. Choose another one.');
  if (/hover_image/.test(error.message)) throw new HttpError(500, 'Database update needed: run supabase/schema.sql once in the Supabase SQL editor (it adds the hover-picture column), then try again.');
  throw new HttpError(500, fallback);
};

export const GET = adminRoute('products.list', false, async () => {
  const db = need();
  const { data, error } = await db.from('products').select('*').order('sort_order');
  if (error) throw new HttpError(500, 'Could not load products.');
  return json({ products: (data ?? []).map((p) => ({ ...p, protected: PROTECTED.has(p.slug) })) });
});

export const POST = adminRoute('products.create', true, async (req) => {
  const parsed = adminProductCreate.safeParse(await readJson(req, 24 * 1024));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Invalid product data.');
  const input = parsed.data;
  if (input.compare_at_price != null && input.compare_at_price <= input.price) throw new HttpError(422, 'The compare-at price must be higher than the price.');
  const db = need();

  if (input.is_bundle && !(input.bundle_slugs?.length)) throw new HttpError(422, 'Choose which perfumes are inside the deal.');
  if (input.bundle_slugs?.length) {
    const { data: found } = await db.from('products').select('slug').in('slug', input.bundle_slugs);
    if ((found?.length ?? 0) !== new Set(input.bundle_slugs).size) throw new HttpError(422, 'One of the perfumes in the deal no longer exists.');
  }

  let sort = input.sort_order;
  if (sort == null) {
    const { data: last } = await db.from('products').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    sort = (last?.[0]?.sort_order ?? 0) + 1;
  }
  const row = {
    ...input,
    sort_order: sort,
    inspired_by: input.inspired_by ?? null,
    compare_at_price: input.compare_at_price ?? null,
    hover_image: input.hover_image ?? null,
    gallery: input.gallery ?? [],
    scent_family: input.scent_family ?? [],
    bundle_slugs: input.is_bundle ? input.bundle_slugs ?? [] : [],
  };
  const { data, error } = await db.from('products').insert(row).select('id, slug, name').single();
  if (error || !data) return dbFail(error ?? { message: '' }, 'Could not create the product.');
  publish();
  await audit(req, 'product.create', data.slug, { name: data.name, price: input.price });
  return json({ ok: true, product: data }, 201);
});

export const PATCH = adminRoute('products.update', true, async (req) => {
  const parsed = adminProductPatch.safeParse(await readJson(req, 24 * 1024));
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? 'Invalid product data.');
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) throw new HttpError(422, 'Nothing to update.');
  const db = need();

  const { data: before, error: readErr } = await db.from('products').select('slug, price, compare_at_price, image, hover_image, gallery, is_bundle, bundle_slugs').eq('id', id).single();
  if (readErr && readErr.code !== 'PGRST116') return dbFail(readErr, 'Could not load the product.');
  if (!before) throw new HttpError(404, 'Product not found.');

  const price = patch.price ?? before.price;
  const compare = patch.compare_at_price === undefined ? before.compare_at_price : patch.compare_at_price;
  if (compare != null && compare <= price) throw new HttpError(422, 'The compare-at price must be higher than the price.');

  const isBundle = patch.is_bundle ?? before.is_bundle;
  const bundleSlugs = patch.bundle_slugs ?? before.bundle_slugs;
  if (isBundle && bundleSlugs.length === 0) throw new HttpError(422, 'Choose which perfumes are inside the deal.');
  if (patch.bundle_slugs?.length) {
    if (patch.bundle_slugs.includes(before.slug)) throw new HttpError(422, 'A deal cannot contain itself.');
    const { data: found } = await db.from('products').select('slug').in('slug', patch.bundle_slugs);
    if ((found?.length ?? 0) !== new Set(patch.bundle_slugs).size) throw new HttpError(422, 'One of the perfumes in the deal no longer exists.');
  }
  const update = { ...patch, ...(isBundle ? {} : { bundle_slugs: [] as string[] }) };

  const { data, error } = await db.from('products').update(update).eq('id', id).select('id, slug, name, price, in_stock').single();
  if (error || !data) return dbFail(error ?? { message: '' }, 'Product not found.');
  publish();
  await audit(req, 'product.update', data.slug, patch);

  // Tidy the storage bucket: pictures the owner replaced or removed are deleted if no other product still uses them.
  if (patch.image !== undefined || patch.hover_image !== undefined || patch.gallery !== undefined) {
    void removeUnusedImages([before.image, before.hover_image, ...(before.gallery ?? [])]);
  }
  return json({ ok: true, product: data });
});

export const DELETE = adminRoute('products.delete', true, async (req) => {
  const parsed = adminProductDelete.safeParse(await readJson(req, 1024));
  if (!parsed.success) throw new HttpError(422, 'Invalid request.');
  const db = need();
  const { data: p } = await db.from('products').select('slug, name, image, hover_image, gallery').eq('id', parsed.data.id).single();
  if (!p) throw new HttpError(404, 'Product not found.');
  if (PROTECTED.has(p.slug)) throw new HttpError(409, `${p.name} powers the 3D homepage / menu, so it cannot be deleted. You can mark it "Sold out" instead.`);

  // a deal that includes this perfume would show a dangling item
  const { data: used } = await db.from('products').select('name').contains('bundle_slugs', [p.slug]);
  if (used?.length) throw new HttpError(409, `${p.name} is part of "${used[0].name}". Edit or delete that deal first.`);

  const { error } = await db.from('products').delete().eq('id', parsed.data.id);
  if (error) throw new HttpError(500, 'Could not delete the product.');
  publish();
  await audit(req, 'product.delete', p.slug, { name: p.name });
  void removeUnusedImages([p.image, p.hover_image, ...(p.gallery ?? [])]);
  return json({ ok: true });
});

/** Best effort: deletes uploaded files that no product references any more. Never throws. */
async function removeUnusedImages(urls: (string | null | undefined)[]) {
  try {
    const db = getAdminClient();
    if (!db) return;
    const candidates = [...new Set(urls.filter((u): u is string => !!u && storagePathOf(u) !== null))];
    if (candidates.length === 0) return;
    const { data } = await db.from('products').select('image, hover_image, gallery');
    const inUse = new Set<string>();
    for (const r of data ?? []) [r.image, r.hover_image, ...(r.gallery ?? [])].forEach((u) => u && inUse.add(u));
    const paths = candidates.filter((u) => !inUse.has(u)).map((u) => storagePathOf(u)!);
    if (paths.length) await db.storage.from(IMAGE_BUCKET).remove(paths);
  } catch { /* cleanup is optional */ }
}
