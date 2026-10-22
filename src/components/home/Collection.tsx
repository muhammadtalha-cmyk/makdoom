import Link from 'next/link';
import type { Product } from '@/lib/types';
import ProductCard from '@/components/shop/ProductCard';

export default function Collection({ products }: { products: Product[] }) {
  return (
    <section id="collection" className="section-y scroll-mt-10">
      <div className="container-x">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="max-w-xl font-display text-5xl font-medium leading-[0.95] md:text-7xl">The Makhdoom collection</h2>
            <p className="mt-4 max-w-lg text-smoke">Three for him, two for her. Each bottle is a fresh, wearable Eau de Parfum inspired by a scent people already love.</p>
          </div>
          <Link href="/shop" className="btn btn-glass self-start md:self-auto">View all</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {products.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      </div>
    </section>
  );
}
