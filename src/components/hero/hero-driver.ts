import { addTicker } from '@/lib/ticker';
import { Governor, type Tier } from '@/lib/3d/quality';

const SCALE_STEPS = [1, 0.82, 0.66];
import { HERO_LENGTH_FACTOR, TIMELINE, clamp, damp, early, heroState, late, resetHeroState } from './hero-state';

type Advance = (timeSeconds: number) => void;

/**
 * The hero's single heartbeat. Each frame, in this order and in ONE place:
 *   1. read scroll → progress (cached geometry, no layout reads)
 *   2. smooth + velocity
 *   3. write the DOM overlay
 *   4. advance the WebGL scene (React Three Fiber runs in frameloop="never"; we call advance())
 *   5. feed the frame time to the quality governor
 * Before this, three separate rAF loops (Lenis, the DOM overlay, R3F) raced each other and double-smoothed the scroll.
 */
export class HeroDriver {
  private off: (() => void) | null = null;
  private advance: Advance | null = null;
  private dom: ((p: number, dt: number) => void) | null = null;
  private el: HTMLElement | null = null;
  private probe: HTMLElement | null = null;
  private top = 0;
  private range = 1;
  private visible = true;
  private cleanup: (() => void)[] = [];
  private gov: Governor;
  private tierCbs = new Set<(t: Tier) => void>();
  private frameMs = 16.7;

  constructor(startTier: Tier) {
    this.gov = new Governor(startTier, Math.min(3, startTier + 1) as Tier, SCALE_STEPS);
    heroState.tier = startTier;
  }

  mount(el: HTMLElement, probe: HTMLElement) {
    this.el = el;
    this.probe = probe;
    resetHeroState();
    this.measure();

    let queued = 0;
    const remeasure = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => this.measure());
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    window.addEventListener('mk:hero-ready', remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(el);
    ro.observe(document.body);

    const onPointer = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      heroState.pointerSpeed = Math.min(1, heroState.pointerSpeed + Math.hypot(x - heroState.pointerX, y - heroState.pointerY) * 3);
      heroState.pointerX = x;
      heroState.pointerY = y;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '150px 0px' });
    io.observe(el);

    this.off = addTicker(this.tick, 10);
    this.cleanup = [
      this.setupSnap(),
      () => window.removeEventListener('resize', remeasure),
      () => window.removeEventListener('load', remeasure),
      () => window.removeEventListener('mk:hero-ready', remeasure),
      () => window.removeEventListener('pointermove', onPointer),
      () => ro.disconnect(),
      () => io.disconnect(),
      () => cancelAnimationFrame(queued),
    ];
  }

  unmount() {
    this.off?.();
    this.off = null;
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.advance = null;
    this.dom = null;
  }

  /** Geometry is cached; the tick never touches layout. `svh` probe keeps the range stable when mobile URL bars move. */
  measure() {
    if (!this.el || !this.probe) return;
    const vh = this.probe.offsetHeight || window.innerHeight;
    this.top = this.el.getBoundingClientRect().top + window.scrollY;
    this.range = Math.max(1, this.el.offsetHeight - vh);
  }


  /**
   * Chapter snapping. When the visitor stops scrolling, the page settles on a chapter instead of hanging half-way
   * through a dissolve. Direction aware: a small nudge past ~12% of the gap moves on to the NEXT stop (never skips
   * ahead), a smaller nudge returns to where they were. Works for wheel/trackpad (Lenis) and touch (native smooth scroll).
   */
  private setupSnap(): () => void {
    if (heroState.reduced) return () => {};
    const stops = [0, ...TIMELINE.centers, late(0.975)];
    const last = stops[stops.length - 1];
    const THRESH = 0.12;
    let timer = 0;
    let busyTimer = 0;
    let busy = false;
    let touching = false;
    let settled = -1;

    const rawNow = () => (window.scrollY - this.top) / this.range;
    const done = (target: number) => { busy = false; settled = target; window.clearTimeout(busyTimer); };
    const cancel = () => {
      if (!busy) return;
      busy = false;
      window.clearTimeout(busyTimer);
      window.__lenis?.scrollTo(window.scrollY, { immediate: true });
    };

    const settle = () => {
      if (busy || touching || !this.visible) return;
      const p = rawNow();
      if (p <= 0.0005) { settled = 0; return; }
      if (p >= last + 0.004) { settled = last; return; } // past the hero: normal page scrolling
      let a = stops[0], b = last;
      for (let i = 0; i < stops.length - 1; i++) if (p >= stops[i] && p < stops[i + 1]) { a = stops[i]; b = stops[i + 1]; }
      const f = (p - a) / (b - a);
      let target: number;
      if (settled < 0 || Math.abs(p - settled) < 0.0015) target = f < 0.5 ? a : b;
      else if (p > settled) target = f > THRESH ? b : a;
      else target = f < 1 - THRESH ? a : b;
      if (Math.abs(target - p) < 0.0015) { settled = target; return; }

      busy = true;
      const y = this.top + target * this.range;
      const dur = clamp(0.7 + Math.abs(target - p) * 3.2 * HERO_LENGTH_FACTOR, 0.7, 1.5);
      busyTimer = window.setTimeout(() => done(target), dur * 1000 + 400);
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: dur, onComplete: () => done(target) });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    };

    const schedule = () => {
      window.clearTimeout(timer);
      if (busy || touching) return;
      timer = window.setTimeout(settle, 140);
    };
    const onScroll = () => schedule();
    const onUser = () => { cancel(); window.clearTimeout(timer); };
    const onTouchStart = () => { touching = true; onUser(); };
    const onTouchEnd = () => { touching = false; window.clearTimeout(timer); timer = window.setTimeout(settle, 180); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('keydown', onUser);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(busyTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('keydown', onUser);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }

  setDom(fn: ((p: number, dt: number) => void) | null) { this.dom = fn; }
  attachScene(advance: Advance) { this.advance = advance; }
  detachScene() { this.advance = null; }
  get hasScene() { return this.advance !== null; }
  onTier(cb: (t: Tier) => void) { this.tierCbs.add(cb); return () => { this.tierCbs.delete(cb); }; }
  forceTier(t: Tier) { this.gov = new Governor(t, t, SCALE_STEPS); heroState.tier = t; heroState.dprScale = 1; this.tierCbs.forEach((c) => c(t)); }
  get fps() { return 1000 / this.frameMs; }

  /** Scene finished compiling and rendered its warm-up frames: start the intro (skip it if the page was restored mid-scroll). */
  markReady() {
    heroState.introT0 = heroState.time - (heroState.raw > early(0.03) || heroState.reduced ? 10 : 0);
  }

  private tick = (_t: number, dt: number) => {
    if (!this.visible) return;
    heroState.time += dt;
    const raw = clamp((window.scrollY - this.top) / this.range);
    heroState.raw = raw;
    const prev = heroState.smooth;
    // Lenis already provides inertia on wheel devices; adding another smoother on top made the hero feel laggy.
    // Native touch scrolling has its own momentum, so only a light de-stepping filter is applied there.
    heroState.smooth = window.__lenis || heroState.reduced ? raw : damp(prev, raw, 16, dt);
    heroState.vel = damp(heroState.vel, clamp(((heroState.smooth - prev) / Math.max(dt, 1e-3)) * HERO_LENGTH_FACTOR, -2, 2), 8, dt);
    heroState.speed = clamp(Math.abs(heroState.vel) / 0.3);
    heroState.pointerSpeed = damp(heroState.pointerSpeed, 0, 5, dt);
    if (heroState.introT0 >= 0) heroState.intro = clamp((heroState.time - heroState.introT0) / 3.4);
    else if (raw > early(0.05)) heroState.intro = 1;

    this.dom?.(heroState.smooth, dt);
    if (this.advance) {
      this.advance(heroState.time);
      this.frameMs += (dt * 1000 - this.frameMs) * 0.1;
      if (heroState.introT0 >= 0) {
        const t = this.gov.update(dt);
        heroState.dprScale = this.gov.scale;
        if (t !== null) {
          heroState.tier = t;
          this.tierCbs.forEach((c) => c(t));
        }
      }
    }
  };
}
