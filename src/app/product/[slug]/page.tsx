import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, ShieldCheck, Truck } from 'lucide-react';
import { getProduct, getProducts } from '@/lib/catalog';
import { getSiteSettings } from '@/lib/site-settings';
import { PRODUCTS } from '@/lib/products-data';
import { SITE } from '@/lib/config';
import { formatPKR } from '@/lib/format';
import ProductGallery from '@/components/shop/ProductGallery';
import PurchasePanel from '@/components/shop/PurchasePanel';
import Price from '@/components/shop/Price';
import ProductCard from '@/components/shop/ProductCard';

export const revalidate = 300; // admin edits purge the cache on demand (revalidateTag), so a longer window is safe
export const dynamicParams = true;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return {
    title: `${p.name}${p.inspired_by ? ` — inspired by ${p.inspired_by}` : ''}`,
    description: p.description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: `${p.name} · Makhdoom Fragrances`, description: p.short_description, images: [{ url: p.gallery[0] ?? p.image }] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, all, site] = await Promise.all([getProduct(slug), getProducts(), getSiteSettings()]);
  if (!product) notFound();

  const ship = site.shipping;
  const shipText = ship.alwaysFree || ship.fee === 0
    ? 'Free delivery nationwide'
    : ship.freeOver > 0
    ? `Free delivery over ${formatPKR(ship.freeOver)}`
    : `Delivery ${formatPKR(ship.fee)}`;

  const included = product.bundle_slugs.map((s) => all.find((p) => p.slug === s)).filter(Boolean);
  const related = all.filter((p) => p.slug !== product.slug && !p.is_bundle).slice(0, 4);
  const images = [product.image, ...product.gallery];

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: images.map((i) => `${SITE.url}${i}`),
    brand: { '@type': 'Brand', name: SITE.name },
    offers: { '@type': 'Offer', url: `${SITE.url}/product/${product.slug}`, priceCurrency: 'PKR', price: product.price, availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="container-x pb-20 pt-32 sm:pt-40">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-smoke">
          <Link href="/shop" className="hover:text-gold-200">Shop</Link> <span aria-hidden>/</span> <span className="text-ivory">{product.name}</span>
        </nav>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery slug={product.slug} name={product.name} accent={product.accent} images={images} />
          </div>
          <div>
            <p className="text-sm font-medium text-gold-200">{product.inspired_by ? `Eau de Parfum · Inspired by ${product.inspired_by}` : 'Gift set'}</p>
            <h1 className="mt-2 font-display text-6xl font-medium leading-[0.9] md:text-8xl">{product.name}</h1>
            <p className="mt-3 font-display text-3xl italic text-ivory/85">{product.tagline}</p>
            <div className="mt-6"><Price price={product.price} compare={product.compare_at_price} size="lg" /></div>
            <p className="mt-6 max-w-xl leading-relaxed text-ivory/80">{product.description}</p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {product.scent_family.map((n) => <li key={n} className="rounded-full border px-3.5 py-1.5 text-sm" style={{ borderColor: `${product.accent}77`, color: product.accent }}>{n}</li>)}
            </ul>

            {included.length > 0 && (
              <div className="glass mt-6 rounded-2xl p-5">
                <h2 className="font-display text-2xl">In the box</h2>
                <ul className="mt-3 space-y-2 text-sm text-ivory/80">
                  {included.map((p) => <li key={p!.slug}><Link href={`/product/${p!.slug}`} className="hover:text-gold-200">{p!.name}</Link> <span className="text-smoke">· inspired by {p!.inspired_by}</span></li>)}
                </ul>
              </div>
            )}

            <div className="mt-8"><PurchasePanel product={product} /></div>

            <ul className="mt-8 grid gap-4 border-t border-white/10 pt-8 text-sm sm:grid-cols-3">
              <li className="flex gap-3"><Banknote size={22} strokeWidth={1.3} className="shrink-0 text-gold-300" /><span>Cash on delivery</span></li>
              <li className="flex gap-3"><Truck size={22} strokeWidth={1.3} className="shrink-0 text-gold-300" /><span>{shipText}</span></li>
              <li className="flex gap-3"><ShieldCheck size={22} strokeWidth={1.3} className="shrink-0 text-gold-300" /><span>Comes in a black gift box</span></li>
            </ul>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-x pb-24" aria-labelledby="rel-h">
          <h2 id="rel-h" className="mb-8 font-display text-4xl md:text-5xl">You may also like</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{related.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
        </section>
      )}
    </>
  );
}
