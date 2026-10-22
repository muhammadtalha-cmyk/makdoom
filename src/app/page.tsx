import { getProducts } from '@/lib/catalog';
import { PRODUCTS } from '@/lib/products-data';
import { CHAPTER_SLUGS } from '@/components/hero/chapters';
import HeroSection from '@/components/hero/HeroSection';
import Promises from '@/components/home/Promises';
import Collection from '@/components/home/Collection';
import CoupleFeature from '@/components/home/CoupleFeature';
import Mood from '@/components/home/Mood';
import HowItWorks from '@/components/home/HowItWorks';
import Faq from '@/components/home/Faq';

export const revalidate = 300; // admin edits purge the cache on demand (revalidateTag), so a longer window is safe

export default async function HomePage() {
  const all = await getProducts();
  // If the live database was seeded before a hero fragrance existed (e.g. Mira), fall back to the bundled entry so the hero never disappears.
  const hero = CHAPTER_SLUGS.map((s) => all.find((p) => p.slug === s) ?? PRODUCTS.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const couple = all.find((p) => p.is_bundle);
  return (
    <>
      {hero.length === CHAPTER_SLUGS.length ? <HeroSection products={hero} /> : null}
      <Promises />
      <Collection products={all.filter((p) => !p.is_bundle)} />
      {couple && <CoupleFeature product={couple} />}
      <Mood products={all} />
      <HowItWorks />
      <Faq />
    </>
  );
}
