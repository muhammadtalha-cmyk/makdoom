'use client';
import { useEffect, useRef } from 'react';
import { addTicker } from '@/lib/ticker';

/** Fine-pointer cursor ring + magnetic buttons. Does nothing on touch devices. Label comes from data-cursor="…". */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = root.current;
    if (!el) return;
    let tx = 0, ty = 0, x = 0, y = 0;
    let mag: HTMLElement | null = null;

    const reset = (m: HTMLElement | null) => { if (m) { m.style.setProperty('--mx', '0px'); m.style.setProperty('--my', '0px'); } };
    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      el.dataset.on = 'true';
      const t = e.target as HTMLElement | null;
      const hot = t?.closest('a,button,[data-cursor],input,select,textarea,summary') as HTMLElement | null;
      const text = t?.closest('[data-cursor]')?.getAttribute('data-cursor') ?? '';
      el.dataset.hot = hot ? 'true' : 'false';
      el.dataset.label = text ? 'true' : 'false';
      if (label.current) label.current.textContent = text;
      const b = t?.closest('.btn') as HTMLElement | null;
      if (b !== mag) { reset(mag); mag = b; }
      if (b) {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', `${((e.clientX - (r.left + r.width / 2)) * 0.18).toFixed(1)}px`);
        b.style.setProperty('--my', `${((e.clientY - (r.top + r.height / 2)) * 0.28).toFixed(1)}px`);
      }
    };
    const leave = () => { el.dataset.on = 'false'; reset(mag); mag = null; };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    const off = addTicker((_t, dt) => {
      const k = 1 - Math.exp(-18 * dt);
      x += (tx - x) * k; y += (ty - y) * k;
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }, 20);
    return () => { off(); window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); };
  }, []);

  return (
    <div ref={root} className="cursor" aria-hidden data-on="false">
      <div className="cursor-ring"><span ref={label} /></div>
    </div>
  );
}
