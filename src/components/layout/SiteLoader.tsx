'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

declare global {
  interface Window { __mkHeroReady?: boolean }
}

const MIN_MS = 500; // brief branded intro without blocking the user
const MAX_MS = 1200; // never trap a visitor: page opens promptly on any network

/**
 * Full-screen branded loading page. It is part of the server-rendered HTML (pure CSS animation), so it is on screen
 * before any JavaScript runs. It leaves as soon as the page is usable: the app has hydrated and the fonts are ready.
 * It deliberately does NOT wait for the 3D hero: compiling the WebGL scene can take several seconds on modest devices,
 * and the hero (headline, buttons, poster) is already complete without it. The 3D fades in on its own when it is ready.
 */
export default function SiteLoader() {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mk-loading');

    const unlock = () => {
      root.classList.remove('mk-loading', 'mk-boot', 'lenis-stopped');
      window.__lenis?.start();
    };

    let finished = false;
    let leave = 0;
    let gone = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      const wait = Math.max(0, MIN_MS - performance.now());
      leave = window.setTimeout(() => {
        setPhase('leaving');
        unlock();
        gone = window.setTimeout(() => setPhase('gone'), 600);
      }, wait);
    };

    // ready = hydrated (we are running) + fonts settled. Fonts are raced against a fast fallback so slow fonts never stall the page.
    const fonts = (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
    void Promise.race([fonts, new Promise((r) => window.setTimeout(r, 600))]).then(finish);
    const cap = window.setTimeout(finish, MAX_MS);

    return () => {
      window.clearTimeout(cap);
      window.clearTimeout(leave);
      window.clearTimeout(gone);
      unlock();
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div id="mk-loader" data-phase={phase} role="status" aria-live="polite" aria-label="Loading Makhdoom Fragrances" className="mk-loader">
      <div className="mk-loader-glow" />
      <div className="mk-loader-stage">
        <div className="mk-loader-scene">
          <span className="mk-ring mk-ring-a" />
          <span className="mk-ring mk-ring-b" />
          <span className="mk-ring mk-ring-c" />
          <div className="mk-loader-logo">
            <Image src="/images/brand/logo-mark-256.webp" alt="" width={256} height={224} priority className="h-auto w-[104px] sm:w-[128px]" />
          </div>
          {Array.from({ length: 12 }, (_, i) => <i key={i} className="mk-spark" style={{ '--i': i } as React.CSSProperties} />)}
        </div>
        <p className="mk-loader-word">MAKHDOOM</p>
        <p className="mk-loader-sub">Fragrances</p>
        <div className="mk-loader-bar"><span /></div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
