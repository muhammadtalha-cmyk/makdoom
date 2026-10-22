import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="container-x grid min-h-[80svh] place-items-center pt-32 text-center">
      <div>
        <p className="gold-text font-display text-8xl">404</p>
        <h1 className="mt-4 font-display text-4xl">This page has evaporated</h1>
        <p className="mx-auto mt-3 max-w-md text-smoke">The link may be old or mistyped. Let us take you back to the fragrances.</p>
        <Link href="/shop" className="btn btn-gold mt-8">Shop fragrances</Link>
      </div>
    </section>
  );
}
