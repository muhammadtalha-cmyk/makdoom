'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import { addTicker } from '@/lib/ticker';

declare global {
  interface Window { __lenis?: Lenis }
}

/**
 * Inertial scrolling for wheel/trackpad devices only. Touch screens keep their native momentum scrolling
 * (emulating it in JS is the classic cause of janky, laggy phones). Lenis is driven by the shared ticker so it
 * always runs BEFORE the hero reads the scroll position in the same frame.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (reduce || touch) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, autoRaf: false, anchors: true });
    window.__lenis = lenis;
    lenis.start();
    document.documentElement.classList.remove('lenis-stopped');
    const off = addTicker((t) => lenis.raf(t * 1000), -10);
    return () => {
      off();
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);
  return null;
}
