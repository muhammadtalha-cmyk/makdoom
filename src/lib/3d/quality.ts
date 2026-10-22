/**
 * Performance budgets. The hero starts on the tier we guess from the device, and the governor in the driver moves
 * it up or down at runtime from measured frame times. Every effect below has an explicit cost; nothing is "free".
 */
export type Tier = 0 | 1 | 2 | 3;

export interface TierConfig {
  label: string;
  dprMax: number; // device-pixel-ratio cap
  composer: boolean; // post-processing chain at all
  msaa: number; // multisampling on the composer target
  bloom: boolean;
  cinema: boolean; // custom RGB-split / lens / fog / grain pass
  transmission: boolean; // real refractive glass (expensive) vs. fake glass
  dispersion: boolean;
  scratches: boolean;
  condensation: boolean;
  floorTaps: number; // reflection rays per floor pixel
  shafts: number; // volumetric light beams
  mist: number; // fog layers
  mercury: boolean; // liquid-metal orb
  morph: number; // GPU dissolve particles
  dust: number;
  bokeh: number;
  petals: number;
  spray: number;
  flares: boolean;
  pillars: number;
}

export const TIERS: Record<Tier, TierConfig> = {
  3: { label: 'ultra', dprMax: 2, composer: true, msaa: 4, bloom: true, cinema: true, transmission: true, dispersion: true, scratches: true, condensation: true, floorTaps: 3, shafts: 3, mist: 7, mercury: true, morph: 9000, dust: 260, bokeh: 46, petals: 70, spray: 180, flares: true, pillars: 9 },
  2: { label: 'high', dprMax: 1.6, composer: true, msaa: 2, bloom: true, cinema: true, transmission: true, dispersion: true, scratches: true, condensation: true, floorTaps: 2, shafts: 2, mist: 4, mercury: true, morph: 5500, dust: 160, bokeh: 30, petals: 50, spray: 120, flares: true, pillars: 7 },
  1: { label: 'medium', dprMax: 1.35, composer: true, msaa: 0, bloom: true, cinema: true, transmission: true, dispersion: false, scratches: true, condensation: false, floorTaps: 1, shafts: 1, mist: 2, mercury: false, morph: 2800, dust: 90, bokeh: 16, petals: 30, spray: 80, flares: false, pillars: 5 },
  0: { label: 'lite', dprMax: 1, composer: false, msaa: 0, bloom: false, cinema: false, transmission: false, dispersion: false, scratches: false, condensation: false, floorTaps: 1, shafts: 0, mist: 0, mercury: false, morph: 0, dust: 40, bokeh: 8, petals: 18, spray: 50, flares: false, pillars: 4 },
};

export const clampTier = (n: number): Tier => Math.max(0, Math.min(3, Math.round(n))) as Tier;

export interface Capability {
  ok: boolean; // WebGL2 usable at all
  software: boolean; // only a software rasteriser is available
  gpu: string;
}

/**
 * Checks WebGL2 support WITHOUT leaking a context (the old probe kept its context alive, which on phones
 * exhausted the browser's context budget and caused "the 3D sometimes doesn't load").
 */
export function probeWebGL(): Capability {
  try {
    const canvas = document.createElement('canvas');
    let software = false;
    let gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
    if (!gl) {
      gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      software = true;
    }
    if (!gl) return { ok: false, software: false, gpu: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) software = true;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // release immediately
    return { ok: true, software, gpu };
  } catch {
    return { ok: false, software: false, gpu: '' };
  }
}

/** First guess from the device. The runtime governor corrects it. Deliberately conservative: a tier that is too low
 *  looks slightly softer, a tier that is too high stutters and recompiles, which is far worse. */
export function startTier(cap: Capability): Tier {
  if (cap.software) return 0;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth < 820;
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const gpu = cap.gpu;
  const integrated = /intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega \d|microsoft basic|mali|adreno|powervr|videocore|apple gpu/i.test(gpu);
  const discrete = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|arc a\d|apple m\d/i.test(gpu);
  let t = 2;
  if (coarse || small) t = 1;
  else if (discrete && window.devicePixelRatio <= 2.4) t = 3;
  else if (integrated) t = 1;
  if (mem <= 2 || cores <= 2) t -= 2;
  else if (mem <= 4 || cores <= 4) t -= 1;
  if (/mali-4|mali-t|adreno \(tm\) [23]\d\d|powervr/i.test(gpu)) t -= 1;
  // very large drawing buffers (4K / retina desktops) cost 4x the fill of 1080p: never start on ultra there
  if (window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio, 2) ** 2 > 5_000_000) t = Math.min(t, 2);
  return clampTier(t);
}

/** True when the visitor asked for (or is on) a connection where a ~300 KB WebGL bundle should not be fetched. */
export function prefersLightweight(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return Boolean(c.saveData) || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

/**
 * "The 3D broke on this device" memory. Only HARD failures are remembered (repeated context loss, shader errors in safe
 * mode), and only for 30 minutes. A slow load is never remembered: that used to switch the animation off for the whole
 * tab session, which looked like the animation randomly skipping on reload.
 */
const NO3D_KEY = 'mk:no3d';
const NO3D_TTL = 30 * 60 * 1000;
export function rememberHardFailure() {
  try { localStorage.setItem(NO3D_KEY, String(Date.now())); } catch { /* private mode */ }
}
export function hardFailureRecent(): boolean {
  try {
    sessionStorage.removeItem(NO3D_KEY); // old builds stored a sticky flag here
    const t = Number(localStorage.getItem(NO3D_KEY));
    if (!t) return false;
    if (Date.now() - t < NO3D_TTL) return true;
    localStorage.removeItem(NO3D_KEY);
  } catch { /* ignore */ }
  return false;
}

/**
 * Frame-time governor. Pure so it can be unit-tested.
 * Changing the quality TIER rebuilds materials and post effects (a visible hitch), so when `scaleSteps` is given the
 * governor first lowers the render RESOLUTION, which is free, and only changes tier once the lowest resolution is not enough.
 */
export class Governor {
  private ema = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private cooldown = 0;
  private downgrades = 0;
  private scaleIdx = 0;
  constructor(public tier: Tier, private maxTier: Tier = 3, private scaleSteps: number[] = [1]) {}

  /** current resolution multiplier (1 = the tier's full DPR) */
  get scale() { return this.scaleSteps[this.scaleIdx]; }

  /** dt in seconds; returns the new tier if it changed (read `scale` for resolution changes). */
  update(dt: number): Tier | null {
    const ms = dt * 1000;
    this.ema += (Math.min(ms, 100) - this.ema) * 0.08;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.ema > 26) { this.slowFor += dt; this.fastFor = 0; }
    else if (this.ema < 17.5) { this.fastFor += dt; this.slowFor = 0; }
    else { this.slowFor = Math.max(0, this.slowFor - dt); this.fastFor = Math.max(0, this.fastFor - dt); }

    if (this.slowFor > 1.4 && this.cooldown === 0) {
      if (this.scaleIdx < this.scaleSteps.length - 1) { this.scaleIdx++; this.reset(); return null; }
      if (this.tier > 0) {
        this.tier = (this.tier - 1) as Tier;
        this.downgrades++;
        this.scaleIdx = 0; // a cheaper tier starts again at full resolution
        return this.reset();
      }
    }
    // only climb back if we have not been burned twice; never above what the device can sustain
    if (this.fastFor > 6 && this.cooldown === 0) {
      if (this.scaleIdx > 0 && this.downgrades < 2) { this.scaleIdx--; this.reset(); return null; }
      if (this.scaleIdx === 0 && this.tier < this.maxTier && this.downgrades < 2) {
        this.tier = (this.tier + 1) as Tier;
        return this.reset();
      }
    }
    return null;
  }
  get frameMs() { return this.ema; }
  private reset(): Tier {
    this.slowFor = this.fastFor = 0;
    this.ema = 16.7;
    this.cooldown = 4;
    return this.tier;
  }
}
