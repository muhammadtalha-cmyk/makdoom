import type { Metadata } from 'next';
import { getProducts } from '@/lib/catalog';
import ShopGrid from '@/components/shop/ShopGrid';

export const revalidate = 300; // admin edits purge the cache on demand (revalidateTag), so a longer window is safe
export const metadata: Metadata = { title: 'Shop all fragrances', description: 'Shop Cyrus, Nova, Mira, Zest and Flova Eau de Parfum plus the Cyrus + Flova couple deal. Cash on delivery across Pakistan.', alternates: { canonical: '/shop' } };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const [products, sp] = await Promise.all([getProducts(), searchParams]);
  return (
    <section className="container-x pb-24 pt-36 sm:pt-40">
      <h1 className="font-display text-6xl font-medium leading-[0.95] md:text-8xl">All fragrances</h1>
      <p className="mb-12 mt-4 max-w-xl text-smoke">Premium Eau de Parfum for men and women. Pay in cash when your order arrives.</p>
      <ShopGrid products={products} initialFilter={sp.for ?? 'all'} />
    </section>
  );
}
