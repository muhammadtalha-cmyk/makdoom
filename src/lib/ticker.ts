/**
 * One requestAnimationFrame loop for the whole site.
 * Lenis, the hero driver and any other per-frame work register here, so the order of work inside a frame is
 * deterministic (smooth-scroll first, then hero state → DOM → WebGL). Three independent rAF loops were the
 * main reason the old hero stuttered and drifted out of sync.
 */
type Tick = (time: number, dt: number) => void;
interface Entry { cb: Tick; priority: number }

const entries: Entry[] = [];
let raf = 0;
let last = 0;

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  const t = now / 1000;
  const dt = last ? Math.min(t - last, 0.05) : 1 / 60;
  last = t;
  // copy: callbacks may unsubscribe while we iterate
  const snapshot = entries.slice();
  for (const e of snapshot) {
    try {
      e.cb(t, dt);
    } catch (err) {
      console.error('[ticker] callback failed', err);
    }
  }
}

/** Lower priority runs first. Returns an unsubscribe function. */
export function addTicker(cb: Tick, priority = 0): () => void {
  const entry = { cb, priority };
  entries.push(entry);
  entries.sort((a, b) => a.priority - b.priority);
  if (!raf && typeof window !== 'undefined') {
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  return () => {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
    if (entries.length === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
