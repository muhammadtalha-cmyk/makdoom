import Link from 'next/link';
import type { Product } from '@/lib/types';
import { formatPKR } from '@/lib/format';
import ParallaxImage from '@/components/ui/ParallaxImage';
import AddToCartButton from '@/components/shop/AddToCartButton';

export default function CoupleFeature({ product }: { product: Product }) {
  const save = (product.compare_at_price ?? product.price) - product.price;
  return (
    <section className="section-y !pt-0" aria-labelledby="couple-h">
      <div className="container-x grid items-stretch gap-5 lg:grid-cols-12 lg:gap-6">
        <ParallaxImage src="/images/story/couple-wide.webp" alt="Cyrus and Flova bottles with their black gift boxes and rose petals on dark marble" sizes="(min-width:1024px) 58vw, 100vw" className="aspect-[4/3] lg:col-span-7 lg:aspect-auto lg:min-h-[560px]" position="center 55%" strength={5} />
        <div className="glass-strong flex flex-col justify-center rounded-[28px] p-7 sm:p-10 lg:col-span-5">
          <p className="text-sm font-medium text-gold-200">Cyrus + Flova</p>
          <h2 id="couple-h" className="mt-1 font-display text-5xl font-medium leading-[0.95] sm:text-6xl">The couple deal</h2>
          <p className="mt-4 max-w-sm text-ivory/80">His fragrance, her fragrance, one perfect deal. Two full bottles in their black gift boxes.</p>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="gold-text font-display text-6xl font-semibold">{formatPKR(product.price)}</span>
            {product.compare_at_price && <s className="text-smoke">{formatPKR(product.compare_at_price)}</s>}
          </div>
          <p className="mt-1 text-sm text-gold-100">You save {formatPKR(save)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AddToCartButton product={product} label="Add the deal" />
            <Link href={`/product/${product.slug}`} className="btn btn-glass">Details</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
