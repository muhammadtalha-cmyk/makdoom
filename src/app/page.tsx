import { getProducts } from '@/lib/catalog';
import { getSiteSettings } from '@/lib/site-settings';
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
  const [all, site] = await Promise.all([getProducts(), getSiteSettings()]);
  // If the live database was seeded before a hero fragrance existed (e.g. Mira), fall back to the bundled entry so the hero never disappears.
  const hero = CHAPTER_SLUGS.map((s) => all.find((p) => p.slug === s) ?? PRODUCTS.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const couple = all.find((p) => p.is_bundle);
  return (
    <>
      {hero.length === CHAPTER_SLUGS.length ? <HeroSection products={hero} /> : null}
      <Promises />
      <Collection products={all.filter((p) => !p.is_bundle)} />
      {couple && <CoupleFeature product={couple} image={site.images.couple} />}
      <Mood products={all} images={{ cyrus: site.images.mood_cyrus, zest: site.images.mood_zest, nova: site.images.mood_nova, flova: site.images.mood_flova, mira: site.images.mood_mira }} />
      <HowItWorks />
      <Faq />
    </>
  );
}
