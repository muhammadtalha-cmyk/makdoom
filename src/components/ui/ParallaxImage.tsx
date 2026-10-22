'use client';
import Image from 'next/image';
import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Image that drifts slower than the page (CSS scroll-timeline, runs on the compositor: zero JS per frame) and is
 * unveiled with a clip-path the first time it enters view. The old version ran a requestAnimationFrame loop per image.
 */
export default function ParallaxImage({ src, alt, sizes, className = '', strength = 9, priority = false, position = 'center' }: { src: string; alt: string; sizes: string; className?: string; strength?: number; priority?: boolean; position?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.dataset.in = 'true'; return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.in = 'true'; io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} data-in="false" className={`relative overflow-hidden [clip-path:inset(12%_8%_12%_8%_round_28px)] transition-[clip-path] duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] data-[in=true]:[clip-path:inset(0%_0%_0%_0%_round_28px)] ${className}`}>
      <div className="px-img absolute inset-0 will-change-transform" style={{ '--px-s': strength } as CSSProperties}>
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" style={{ objectPosition: position }} />
      </div>
    </div>
  );
}
