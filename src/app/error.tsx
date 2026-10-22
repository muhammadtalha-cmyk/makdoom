'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app error]', error.digest ?? '', error.message); }, [error]);
  return (
    <section className="container-x grid min-h-[80svh] place-items-center pt-32 text-center">
      <div>
        <h1 className="font-display text-5xl">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-md text-smoke">The page could not load. Your bag is safe. Try again, or order directly on WhatsApp.</p>
        {error.digest && <p className="mt-2 text-xs text-smoke/70">Reference: {error.digest}</p>}
        <button type="button" onClick={reset} className="btn btn-gold mt-8">Try again</button>
      </div>
    </section>
  );
}
