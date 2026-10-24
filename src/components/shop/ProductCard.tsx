'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import type { Product } from '@/lib/types';
import Price from './Price';
import AddToCartButton from './AddToCartButton';

/** Glass card with a pointer-driven 3D tilt and a moving specular glare. */
export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  // the reveal circle grows from the point where the pointer ENTERED the picture
  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--hx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--hy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  const hover = product.hover_image || product.gallery[0] || null;

  return (
    <article
      ref={ref}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="glass glass-flat group relative flex flex-col overflow-hidden rounded-[28px] p-3 transition-transform duration-300 ease-out will-change-transform [transform:perspective(900px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
    >
      <Link href={`/product/${product.slug}`} className="relative block overflow-hidden rounded-[20px]" aria-label={`${product.name} — view details`}>
        <div className="relative aspect-[4/5]">
          <Image src={product.image} alt={`${product.name} Eau de Parfum bottle`} fill priority={priority} sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw" className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
          {hover && hover !== product.image && (
            <div className="card-reveal pointer-events-none absolute inset-0" aria-hidden>
              <Image src={hover} alt="" fill sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw" className="card-reveal-img object-cover" />
              <div className="card-reveal-shade absolute inset-0" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'radial-gradient(380px circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.22), transparent 55%)' }} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        </div>
        {product.compare_at_price && product.compare_at_price > product.price && (
          <span className="absolute left-3 top-3 rounded-full bg-black/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
            {product.is_bundle ? `Save Rs. ${(product.compare_at_price - product.price).toLocaleString('en-PK')}` : `${Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}% off`}
          </span>
        )}
        {!product.in_stock && <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold">Sold out</span>}
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-5">
        <div>
          <h3 className="font-display text-3xl font-medium leading-none">{product.name}</h3>
          <p className="mt-1.5 text-sm text-smoke">{product.inspired_by ? `Inspired by ${product.inspired_by}` : product.tagline}</p>
        </div>
        <Price price={product.price} compare={product.compare_at_price} />
        <AddToCartButton product={product} className="mt-auto w-full" />
      </div>
    </article>
  );
}
