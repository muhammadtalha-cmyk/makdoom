import { getProducts } from '@/lib/catalog';

/** Slim public price list so the bag can reconcile stale localStorage prices. CDN-cached for a minute. */
export async function GET() {
  const all = await getProducts();
  return Response.json(
    all.map((p) => ({ slug: p.slug, price: p.price, compare_at_price: p.compare_at_price, in_stock: p.in_stock })),
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
