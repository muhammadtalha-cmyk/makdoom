import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/config';
import { getProducts } from '@/lib/catalog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const now = new Date();
  const statics = ['', '/shop', '/track', '/contact', '/policies/shipping-and-cod', '/policies/returns', '/policies/privacy', '/policies/terms'];
  return [
    ...statics.map((p) => ({ url: `${SITE.url}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...products.map((p) => ({ url: `${SITE.url}/product/${p.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
