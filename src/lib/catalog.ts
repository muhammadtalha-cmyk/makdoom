import { unstable_cache } from 'next/cache';
import { PRODUCTS } from './products-data';
import { getAdminClient, getPublicClient } from './supabase';
import { isProd } from './env';
import { log } from './log';
import type { Product } from './types';

export const PRODUCTS_TAG = 'products';

async function fetchFromDb(): Promise<Product[]> {
  const client = getPublicClient() ?? getAdminClient(); // least privilege: public reads use the anon key
  if (!client) throw new Error('database not configured');
  const { data, error } = await client.from('products').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('products table is empty');
  return data as Product[];
}

// Thrown errors are not cached by unstable_cache, so an outage never pins stale fallback data in the cache.
const cached = unstable_cache(fetchFromDb, ['catalog-v2'], { tags: [PRODUCTS_TAG], revalidate: 300 });

/** Catalogue for DISPLAY: cached for 5 minutes and purged instantly when the admin edits a product. */
export async function getProducts(): Promise<Product[]> {
  try {
    return await cached();
  } catch (e) {
    if (getPublicClient() || getAdminClient()) log.warn('catalog: using bundled fallback', { err: e instanceof Error ? e : new Error(String(e)) });
    return PRODUCTS;
  }
}

/**
 * Catalogue for CHECKOUT PRICING: never cached. If a database is configured but cannot be read we refuse to price from the
 * bundled catalogue in production (it could be stale and charge the wrong amount).
 */
export async function getProductsFresh(): Promise<Product[]> {
  const configured = Boolean(getPublicClient() || getAdminClient());
  if (!configured) return PRODUCTS;
  try {
    return await fetchFromDb();
  } catch (e) {
    if (isProd()) throw e;
    return PRODUCTS;
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}
export const singles = (all: Product[]) => all.filter((p) => !p.is_bundle);
