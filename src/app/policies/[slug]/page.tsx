import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { POLICIES } from '@/lib/policies';

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES.find((x) => x.slug === slug);
  return p ? { title: p.title, alternates: { canonical: `/policies/${p.slug}` } } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES.find((x) => x.slug === slug);
  if (!policy) notFound();
  return (
    <article className="container-x max-w-3xl pb-24 pt-36 sm:pt-40">
      <h1 className="font-display text-5xl font-medium leading-none md:text-7xl">{policy.title}</h1>
      <p className="mt-3 text-sm text-smoke">Last updated {policy.updated}</p>
      <div className="mt-10 space-y-9">
        {policy.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-3xl">{s.h}</h2>
            {s.p.map((t) => <p key={t} className="mt-3 leading-relaxed text-ivory/80">{t}</p>)}
          </section>
        ))}
      </div>
    </article>
  );
}
