'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Product } from '@/lib/types';
import { supportWhatsAppUrl } from '@/lib/whatsapp';
import { formatPKR } from '@/lib/format';
import AddToCartButton from '@/components/shop/AddToCartButton';
import Price from '@/components/shop/Price';
import { SprayIcon, WhatsAppIcon } from '@/components/ui/icons';
import { hardFailureRecent, prefersLightweight, probeWebGL, rememberHardFailure, startTier, type Tier } from '@/lib/3d/quality';
import { CHAPTER_CENTERS, TIMELINE, clamp, early, heroState, smoothstep, stageIndex } from './hero-state';
import { HeroDriver } from './hero-driver';

// The 3D bundle is requested as soon as we know WebGL works (see the detection effect), long before the scene mounts.
const mark = (n: string) => { try { performance.mark(n); } catch { /* ignore */ } };
const loadScene = () => import('./HeroScene').then((m) => { mark('mk-chunk-loaded'); return m; });
const HeroScene = dynamic(loadScene, { ssr: false });

const forWho = (p: Product) => (p.gender === 'women' ? 'For her' : p.gender === 'men' ? 'For him' : 'For everyone');
const setInert = (el: HTMLElement, v: boolean) => {
  const e = el as HTMLElement & { inert: boolean };
  if (e.inert !== v) e.inert = v;
};
/** write only when the value changed: a style write per frame per element adds up on phones */
function put(el: HTMLElement, o: number, ty: number, extra?: Record<string, string>) {
  const ov = o.toFixed(3);
  if (el.dataset.o !== ov || el.dataset.t !== String(Math.round(ty))) {
    el.dataset.o = ov;
    el.dataset.t = String(Math.round(ty));
    el.style.opacity = ov;
    el.style.transform = `translate3d(0,${ty.toFixed(1)}px,0)`;
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    setInert(el, o < 0.5);
  }
  if (extra) for (const k in extra) el.style.setProperty(k, extra[k]);
}

export default function HeroSection({ products }: { products: Product[] }) {
  const wrap = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const introEl = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const finaleEl = useRef<HTMLDivElement>(null);
  const sprayEl = useRef<HTMLButtonElement>(null);
  const panels = useRef<(HTMLElement | null)[]>([]);
  const railFill = useRef<HTMLSpanElement>(null);
  const railBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const perfEl = useRef<HTMLDivElement>(null);
  const driver = useRef<HeroDriver | null>(null);

  const [mode, setMode] = useState<'checking' | 'webgl' | 'static'>('checking');
  const [start, setStart] = useState<Tier>(1);
  const [mountScene, setMountScene] = useState(false);
  const [ready, setReady] = useState(false);

  const giveUp = useCallback((reason: string, remember: boolean) => {
    console.warn('[hero] falling back to the static hero:', reason);
    if (remember) rememberHardFailure(); // only real failures, and only for 30 minutes; a slow load is never remembered
    driver.current?.unmount();
    setMode('static');
  }, []);
  const fail = useCallback((reason: string) => giveUp(reason, true), [giveUp]);
  const onReady = useCallback(() => { driver.current?.markReady(); setReady(true); }, []);
  const onReset = useCallback(() => setReady(false), []);

  // 1. capability + preference detection (probe releases its WebGL context immediately)
  useEffect(() => {
    heroState.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // a reload restarts the film from the top (a restored mid-scroll position used to skip the intro entirely)
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === 'reload' && window.scrollY > 0) window.scrollTo(0, 0);
    } catch { /* ignore */ }
    if (hardFailureRecent() || prefersLightweight()) { setMode('static'); return; }
    const cap = probeWebGL();
    if (!cap.ok) { setMode('static'); return; }
    void loadScene().catch(() => giveUp('3D bundle failed to load', false)); // start downloading now
    const forced = new URLSearchParams(location.search).get('tier'); // ?tier=0..3 forces a quality tier (debugging / QA)
    const t = forced !== null && /^[0-3]$/.test(forced) ? (Number(forced) as Tier) : startTier(cap);
    driver.current = new HeroDriver(t);
    setStart(t);
    setMode('webgl');
  }, []);

  // 2. drive the page: one loop, DOM updated here, WebGL advanced by the same driver
  useEffect(() => {
    const d = driver.current;
    const el = wrap.current;
    const pr = probe.current;
    if (mode !== 'webgl' || !d || !el || !pr) return;
    d.mount(el, pr);

    let activeChapter = -1;
    let sprayTimer = 0;
    const T = TIMELINE;
    d.setDom((p) => {
      const idx = stageIndex(p);
      const io = 1 - smoothstep(early(0.012), early(0.07), p);
      if (introEl.current) put(introEl.current, io, (1 - io) * -34, { '--px': `${(-heroState.pointerX * 10).toFixed(1)}px` });
      if (hintEl.current) hintEl.current.style.opacity = String(1 - smoothstep(0, early(0.03), p));

      const sk = `${clamp(-heroState.vel * 7, -5, 5).toFixed(2)}deg`;
      const px = `${(-heroState.pointerX * 14).toFixed(1)}px`;
      const py = `${(heroState.pointerY * 8).toFixed(1)}px`;
      panels.current.forEach((panel, i) => {
        if (!panel) return;
        let o = clamp(1 - Math.abs(idx - i) * 2.5);
        if (i === 0) o *= smoothstep(early(0.09), early(0.15), p);
        o *= 1 - smoothstep(T.panelFadeOut[0], T.panelFadeOut[1], p);
        put(panel, o, (idx - i) * -38, { '--in': o.toFixed(3), '--sk': sk, '--px': px, '--py': py });
      });

      if (finaleEl.current) {
        const o = smoothstep(T.finaleCopy[0], T.finaleCopy[1], p);
        put(finaleEl.current, o, (1 - o) * 30);
      }
      if (sprayEl.current) {
        const o = smoothstep(early(0.1), early(0.16), p) * (1 - smoothstep(T.panelFadeOut[0], T.panelFadeOut[1], p));
        sprayEl.current.style.opacity = o.toFixed(3);
        sprayEl.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      }
      if (railFill.current) railFill.current.style.transform = `scaleY(${p.toFixed(4)})`;

      const chapter = p > early(0.12) && p < T.panelFadeOut[0] ? Math.round(idx) : -1;
      if (chapter !== activeChapter) {
        activeChapter = chapter;
        railBtns.current.forEach((b, i) => b && b.setAttribute('aria-current', i === chapter ? 'true' : 'false'));
        window.clearTimeout(sprayTimer);
        if (chapter >= 0 && !heroState.reduced) sprayTimer = window.setTimeout(() => heroState.spray++, 650);
      }
    });

    let perfTimer = 0;
    if (new URLSearchParams(location.search).has('perf')) {
      perfTimer = window.setInterval(() => {
        if (perfEl.current) perfEl.current.textContent = `${d.fps.toFixed(0)} fps · tier ${heroState.tier} · p ${heroState.smooth.toFixed(3)} · v ${heroState.vel.toFixed(2)}`;
      }, 400);
    }
    // mount the scene right after the first paint (the headline and buttons are already on screen); the chunk is already downloading
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => { mark('mk-mount-requested'); setMountScene(true); }); });

    return () => {
      window.clearTimeout(sprayTimer);
      window.clearInterval(perfTimer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      d.unmount();
    };
  }, [mode]);

  // tell the site loader the hero is done: either the 3D scene is really rendered, or we fell back to the static hero
  useEffect(() => {
    if (ready || mode === 'static') {
      window.__mkHeroReady = true;
      window.dispatchEvent(new Event('mk:hero-ready'));
    }
  }, [ready, mode]);

  // 3. watchdog: a scene that never becomes ready must not leave visitors on a poster forever. Generous (a slow phone on a
  //    slow network can legitimately need 15 s+), and never remembered: the next visit simply tries again.
  useEffect(() => {
    if (!mountScene || ready) return;
    const id = window.setTimeout(() => giveUp('scene did not become ready in 30s', false), 30000);
    return () => window.clearTimeout(id);
  }, [mountScene, ready, giveUp]);

  const scrollToProgress = (p: number) => {
    const el = wrap.current;
    if (!el) return;
    const vh = probe.current?.offsetHeight ?? window.innerHeight;
    const target = el.getBoundingClientRect().top + window.scrollY + p * (el.offsetHeight - vh);
    if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.8 });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  };

  // stable identity: the scene's one-time setup effect depends on it, and a new array on every render re-ran the whole shader precompile
  const sceneProducts = useMemo(() => products.map((p) => ({ slug: p.slug, name: p.name })), [products]);
  const cheapest = Math.min(...products.map((p) => p.price));

  /* ───────────── no-WebGL / failed 3D: still a beautiful, fully usable hero ───────────── */
  if (mode === 'static') {
    return (
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden pb-16 pt-40">
        <Image src="/images/story/cyrus-wide.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="container-x">
          <h1 className="max-w-3xl font-display text-6xl font-medium leading-[0.95] sm:text-8xl">Long-lasting scent, made to be noticed.</h1>
          <p className="mt-5 max-w-xl text-lg text-ivory/80">Five signature Eau de Parfums from Makhdoom Fragrances. Delivered across Pakistan, paid in cash at your door.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#collection" className="btn btn-gold">Shop the collection</a>
            <a href={supportWhatsAppUrl()} className="btn btn-glass" target="_blank" rel="noopener noreferrer"><WhatsAppIcon width={18} height={18} /> Order on WhatsApp</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={wrap} id="hero" aria-label="Makhdoom Fragrances collection" className="hero-wrap relative">
      <div ref={probe} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-[100svh] w-px" />
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-onyx">
        {mode === 'webgl' && mountScene && (
          <HeroScene products={sceneProducts} driver={driver.current!} startTier={start} onReady={onReady} onReset={onReset} onFail={fail} />
        )}

        {/* poster: shown until the scene has REALLY compiled and rendered (not a timer) */}
        <div className={`pointer-events-none absolute inset-0 z-10 grid place-items-center bg-onyx transition-opacity duration-[1400ms] ease-out ${ready ? 'opacity-0' : 'opacity-100'}`}>
          <div className="hero-poster" />
          <Image src="/images/brand/logo-lockup.png" alt="" width={240} height={170} priority className="relative h-auto w-44 animate-floaty sm:w-48" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[55%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* ───── intro: visible at first paint (no JS needed), never gated on the 3D loading ───── */}
        <div ref={introEl} className="absolute inset-0 z-20 will-change-transform">
          <div className="container-x flex h-full flex-col justify-end pb-24 md:pb-16">
            <h1 className="hero-rise max-w-[13ch] font-display text-[clamp(2.6rem,6.4vw,6.2rem)] font-medium leading-[0.94]">
              Long-lasting scent, made to be noticed.
            </h1>
            <div className="hero-rise mt-5 flex max-w-md flex-col gap-5 [animation-delay:.25s]">
              <p className="hidden text-base text-ivory/80 sm:block md:text-lg">Five signature Eau de Parfums from Makhdoom Fragrances. Delivered across Pakistan. Pay in cash when it arrives.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/shop" className="btn btn-gold">Shop the collection</Link>
                <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-glass"><WhatsAppIcon width={18} height={18} /> Order on WhatsApp</a>
              </div>
            </div>
          </div>
        </div>

        <div ref={hintEl} className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-xs text-ivory/70 md:bottom-6">
          <span>Scroll to meet the fragrances</span>
          <ArrowDown size={16} className="animate-floaty" />
        </div>

        {/* ───── chapters ───── */}
        {products.map((p, i) => (
          <article key={p.slug} ref={(el) => { panels.current[i] = el; }} aria-label={`${p.name}, ${forWho(p)}`} className="pointer-events-none invisible absolute inset-0 z-20 will-change-transform">
            <div className="container-x flex h-full flex-col justify-between pb-5 pt-28 md:flex-row md:items-end md:justify-between md:pb-14 md:pt-0">
              <div className="hero-copy">
                <p className="text-sm font-medium text-gold-200">{forWho(p)}{p.inspired_by ? ` · Inspired by ${p.inspired_by}` : ''}</p>
                <h2 aria-label={p.name} className="hero-name mt-1 font-display text-[clamp(4.2rem,15vw,12.5rem)] font-medium leading-[0.84]">
                  {[...p.name].map((c, k) => (
                    <span key={k} aria-hidden className="hero-letter gold-text" style={{ '--i': k, '--n': p.name.length } as CSSProperties}>{c}</span>
                  ))}
                </h2>
                <p className="mt-3 max-w-xs font-display text-2xl italic text-ivory/85 md:text-3xl">{p.tagline}</p>
              </div>
              {/* solid surface, not backdrop-filter: blurring a live WebGL canvas every frame is what made phones stutter */}
              <div className="surface pointer-events-auto w-full rounded-[28px] p-5 md:w-[340px] md:p-6 lg:w-[390px]">
                <p className="hidden text-sm leading-relaxed text-ivory/80 lg:block">{p.short_description}</p>
                <ul className="mt-0 flex flex-wrap gap-2 lg:mt-4">
                  {p.scent_family.map((n) => (
                    <li key={n} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: `${p.accent}77`, color: p.accent }}>{n}</li>
                  ))}
                </ul>
                <div className="mt-4"><Price price={p.price} compare={p.compare_at_price} /></div>
                <div className="mt-4 flex gap-3">
                  <AddToCartButton product={p} className="flex-1" />
                  <Link href={`/product/${p.slug}`} className="btn btn-glass">Details</Link>
                </div>
              </div>
            </div>
          </article>
        ))}

        {/* ───── finale ───── */}
        <div ref={finaleEl} className="pointer-events-none invisible absolute inset-0 z-20 will-change-transform">
          <div className="container-x flex h-full flex-col items-center justify-end pb-10 text-center md:pb-14">
            <h2 className="font-display text-[clamp(2.4rem,6vw,5rem)] font-medium leading-none">Five scents. One signature.</h2>
            <p className="mt-3 max-w-lg text-ivory/80">From {formatPKR(cheapest)}. Cash on delivery, anywhere in Pakistan.</p>
            <div className="pointer-events-auto mt-6 flex flex-wrap justify-center gap-3">
              <a href="#collection" className="btn btn-gold">Explore the collection</a>
              <Link href="/product/couple-deal" className="btn btn-glass">See the couple deal</Link>
            </div>
          </div>
        </div>

        {/* ───── controls ───── */}
        <button ref={sprayEl} type="button" onClick={() => heroState.spray++} data-cursor="Spray" className="surface invisible absolute right-4 top-[44%] z-30 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium opacity-0 md:bottom-7 md:left-1/2 md:right-auto md:top-auto md:-translate-x-1/2" aria-label="Spray the perfume">
          <SprayIcon width={18} height={18} /> Spray
        </button>

        <nav aria-label="Fragrance chapters" className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 md:right-8 md:block">
          <div className="relative flex flex-col items-end gap-5 py-1">
            <span className="absolute bottom-2 right-[5px] top-2 w-px bg-white/15" aria-hidden />
            <span ref={railFill} className="absolute bottom-2 right-[5px] top-2 w-px origin-top bg-gold-300" style={{ transform: 'scaleY(0)' }} aria-hidden />
            {products.map((p, i) => (
              <button key={p.slug} ref={(el) => { railBtns.current[i] = el; }} type="button" onClick={() => scrollToProgress(CHAPTER_CENTERS[i])} className="group relative flex items-center gap-3 pr-0 text-xs text-ivory/60 transition-colors hover:text-gold-100 aria-[current=true]:text-gold-100" aria-label={`Go to ${p.name}`} aria-current="false">
                <span className="translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-aria-[current=true]:translate-x-0 group-aria-[current=true]:opacity-100">{p.name}</span>
                <span className="relative z-10 h-[11px] w-[11px] rounded-full border border-current bg-onyx transition-all group-aria-[current=true]:scale-125 group-aria-[current=true]:bg-gold-300" />
              </button>
            ))}
          </div>
        </nav>

        <a href="#collection" className="absolute left-4 top-[112px] z-30 hidden items-center gap-1.5 text-xs text-ivory/60 transition-colors hover:text-gold-100 md:flex lg:left-[max(1.25rem,calc((100vw-1280px)/2+3rem))]">
          Skip to the shop <ArrowDown size={13} />
        </a>
        <div ref={perfEl} className="pointer-events-none absolute left-3 top-24 z-40 font-mono text-[11px] text-gold-200/80" />
      </div>

      <ul className="sr-only">
        {products.map((p) => (
          <li key={p.slug}><Link href={`/product/${p.slug}`}>{p.name}: {p.short_description}</Link></li>
        ))}
      </ul>
    </section>
  );
}
