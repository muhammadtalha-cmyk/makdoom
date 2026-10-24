import Link from 'next/link';
import type { Product } from '@/lib/types';
import ParallaxImage from '@/components/ui/ParallaxImage';

const moods: Record<string, { title: string; text: string; image: string; ratio: string; pos?: string }> = {
  cyrus: { title: 'Office to evening', text: 'Polished, fresh and confident from the first meeting to the last dinner.', image: '/images/story/cyrus-wide.webp', ratio: 'aspect-[4/5] lg:aspect-[3/4]', pos: '38% 55%' },
  nova: { title: 'Everyday energy', text: 'A vibrant opening and a smooth finish that works on any ordinary day.', image: '/images/story/nova-wide.webp', ratio: 'aspect-[4/5] lg:aspect-[4/3]', pos: '48% 60%' },
  zest: { title: 'Clean and bold', text: 'Bright, clean and energetic for people who like to be noticed.', image: '/images/story/zest-citrus.webp', ratio: 'aspect-[4/5] lg:aspect-[4/3]' },
  mira: { title: 'Elegance, always', text: 'A romantic floral with a warm vanilla finish, made for those who carry elegance with confidence.', image: '/images/story/mira-wide.webp', ratio: 'aspect-[4/5] lg:aspect-[16/10]', pos: '50% 50%' },
  flova: { title: 'Soft and floral', text: 'A fresh floral with a gentle, elegant finish that feels effortless.', image: '/images/story/flova-roses.webp', ratio: 'aspect-[4/5] lg:aspect-[3/4]' },
};

/** `images` lets the owner replace a card picture from the dashboard (keyed by product slug); anything missing keeps the bundled picture. */
export default function Mood({ products, images = {} }: { products: Product[]; images?: Partial<Record<string, string>> }) {
  const list = products.filter((p) => moods[p.slug]);
  const col = (ids: string[]) => list.filter((p) => ids.includes(p.slug));
  const card = (p: Product) => {
    const m = moods[p.slug];
    return (
      <Link key={p.slug} href={`/product/${p.slug}`} className="group relative block">
        <ParallaxImage src={images[p.slug] ?? m.image} alt={`${p.name} perfume — ${m.title}`} sizes="(min-width:1024px) 40vw, 100vw" className={m.ratio} position={m.pos} strength={7} />
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute inset-x-5 bottom-5">
          <h3 className="font-display text-4xl font-medium leading-none">{m.title}</h3>
          <p className="mt-2 max-w-sm text-sm text-ivory/80">{m.text}</p>
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gold-200 transition-transform group-hover:translate-x-1">Meet {p.name}</p>
        </div>
      </Link>
    );
  };
  return (
    <section className="section-y defer !pt-0" aria-labelledby="mood-h">
      <div className="container-x">
        <h2 id="mood-h" className="max-w-2xl font-display text-5xl font-medium leading-[0.95] md:text-7xl">Find the scent that fits your day</h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:gap-6">
          <div className="grid gap-5 lg:gap-6">{col(['cyrus', 'zest']).map(card)}</div>
          <div className="grid gap-5 lg:mt-24 lg:gap-6">{col(['nova', 'flova']).map(card)}</div>
          <div className="lg:col-span-2">{col(['mira']).map(card)}</div>
        </div>
      </div>
    </section>
  );
}
