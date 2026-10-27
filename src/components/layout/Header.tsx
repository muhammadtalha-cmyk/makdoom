'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { NAV_LINKS, SITE } from '@/lib/config';
import { cartCount, useCart } from '@/lib/cart-store';
import { useShipping } from './ShippingContext';

/** Minimal navigation: wordmark, bag, and one Menu button that opens a full-screen index of the site. */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const { bannerText } = useShipping();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const setOpen = useCart((s) => s.setOpen);
  const count = hydrated ? cartCount(items) : 0;
  const firstLink = useRef<HTMLAnchorElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', menu);
    window.__lenis?.[menu ? 'stop' : 'start']();
    if (!menu) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const links = [{ href: '/', label: 'Home' }, ...NAV_LINKS];

  return (
    <header className="fixed inset-x-0 top-0 z-[80]">
      <div className={`overflow-hidden text-center text-[11px] font-medium tracking-wide text-gold-100 transition-all duration-500 ${scrolled || menu ? 'max-h-0 opacity-0' : 'max-h-9 opacity-100'}`}>
        <p className="whitespace-nowrap bg-gradient-to-r from-transparent via-black/70 to-transparent px-4 py-2">
          {bannerText}
        </p>
      </div>

      <div className={`transition-[background-color] duration-500 ${scrolled && !menu ? 'bg-gradient-to-b from-black/80 to-transparent' : ''}`}>
        <div className="container-x flex h-16 items-center justify-between sm:h-[72px]">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Makhdoom Fragrances — home" onClick={() => setMenu(false)}>
            <Image src="/images/brand/logo-mark.png" alt="" width={44} height={38} className="h-8 w-auto sm:h-9" priority />
            <span className="font-display text-lg font-semibold tracking-[0.18em] text-gold-100 sm:text-xl">MAKHDOOM</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link href="/shop" className="hidden rounded-full px-4 py-2 text-sm font-medium text-ivory/80 transition-colors hover:text-white md:block">Shop</Link>
            <button type="button" onClick={() => setOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-full text-ivory transition-colors hover:bg-white/10" aria-label={`Open bag, ${count} item${count === 1 ? '' : 's'}`}>
              <ShoppingBag size={21} strokeWidth={1.6} />
              {count > 0 && <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold-300 px-1 text-[10px] font-bold text-black">{count}</span>}
            </button>
            <button ref={menuBtn} type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="site-menu" className="group flex h-11 items-center gap-3 rounded-full pl-3 pr-2 text-sm font-medium text-ivory">
              <span>{menu ? 'Close' : 'Menu'}</span>
              <span className="relative block h-3 w-6" aria-hidden>
                <span className={`absolute left-0 h-px w-6 bg-current transition-all duration-500 ${menu ? 'top-1.5 rotate-45' : 'top-0 group-hover:w-4'}`} />
                <span className={`absolute left-0 h-px w-6 bg-current transition-all duration-500 ${menu ? 'top-1.5 -rotate-45' : 'top-3'}`} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div id="site-menu" data-open={menu} role="dialog" aria-modal="true" aria-label="Menu" inert={!menu} className={`fixed inset-0 -z-10 flex flex-col justify-between bg-onyx/[0.97] px-[clamp(1.25rem,4vw,3rem)] pb-10 pt-28 transition-[opacity,visibility] duration-500 ${menu ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <ul className="mx-auto w-full max-w-[1280px] space-y-1">
          {links.map((l, i) => (
            <li key={l.href} className="overflow-hidden">
              <Link ref={i === 0 ? firstLink : undefined} href={l.href} onClick={() => setMenu(false)} style={{ '--d': i } as React.CSSProperties} className="menu-link py-1 font-display text-[clamp(3rem,9vw,7.5rem)] font-medium leading-[1.02] text-ivory transition-colors hover:text-gold-200">{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 text-sm text-smoke sm:flex-row sm:justify-between">
          <p>Premium Eau de Parfum for men and women. Nationwide delivery, cash on delivery.</p>
          <a href={`mailto:${SITE.email}`} className="hover:text-gold-200">{SITE.email}</a>
        </div>
      </div>
    </header>
  );
}
