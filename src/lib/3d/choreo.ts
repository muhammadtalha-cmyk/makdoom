import { CHAPTER_N, clamp, early, easeInOut, easeOutCubic, easeOutExpo, introAmount, lerp, late, smoothstep as s, stageIndex, TIMELINE } from '../../components/hero/hero-state';
import { BOTTLE, PODIUM_TOP } from './constants';

export interface Choreo {
  idx: number; // 0..N-1 float
  chapter: number; // integer bottle on stage
  frac: number; // hand-over progress 0..1
  dive: number;
  emerge: number;
  inside: number; // 0..1 fog: camera is inside the perfume
  lineup: number; // 0 = single bottle on stage, 1 = full line-up
  burst: number; // 0..1 flash while crossing the glass
  cam: { y: number; z: number; lookY: number; fov: number };
  dissolve: number[]; // one per bottle: 0 solid … 1 gone
  morph: { active: boolean; mode: 0 | 1; t: number; lineup: boolean };
  mercury: number; // liquid-metal orb swell 0..1
  condensation: number; // 0..1 fogging on the glass
  scale: number; // bottle scale in chapter shots
  glassZ: number;
}

const out: Choreo = {
  idx: 0, chapter: 0, frac: 0, dive: 0, emerge: 0, inside: 0, lineup: 0, burst: 0,
  cam: { y: 0, z: 0, lookY: 0, fov: 28 },
  dissolve: Array.from({ length: CHAPTER_N }, () => 1),
  morph: { active: false, mode: 0, t: 0, lineup: false },
  mercury: 0, condensation: 0, scale: 1, glassZ: 0,
};

/**
 * Pure function: scroll progress (+ load-intro progress) → everything the scene needs this frame.
 * Mutates and returns a shared object (no per-frame allocations). Continuity is covered by unit tests.
 */
export function choreograph(p: number, introT: number, portrait: boolean, reduced: boolean): Choreo {
  const idx = stageIndex(p);
  const chapter = Math.min(CHAPTER_N - 1, Math.floor(idx));
  const frac = idx - chapter;
  const [e0, e1] = TIMELINE.emerge;
  const dive = s(TIMELINE.diveStart, TIMELINE.diveEnd, p);
  const emerge = s(e0, e1, p);
  const lineup = s(TIMELINE.lineupAt[0], TIMELINE.lineupAt[1], p);

  const scale = portrait ? 0.82 : 1.12;
  const glassZ = (BOTTLE.d / 2 + 0.004) * scale;
  const centerY = PODIUM_TOP + 0.62 * scale;
  const shift = portrait ? -0.95 * (1 - s(early(0.04), early(0.14), p)) : 0;

  // ── camera ──
  const introE = reduced ? 1 : easeOutExpo(clamp(introT));
  const zLoad = lerp(16, 9.6, introE);
  const zChapter = portrait ? 9.2 : 7.7;
  const zFinale = portrait ? 13.5 : 10.6;
  const zBase = lerp(zLoad, zChapter, easeOutCubic(introAmount(p)));
  const dEase = easeInOut(dive);
  const eEase = easeInOut(emerge);
  const z = lerp(lerp(zBase, 0.14, dEase), zFinale, eEase);
  const y = lerp(lerp(0.42 + shift, centerY, dEase), 0.9, eEase);
  const lookY = lerp(lerp(0.1 + shift, centerY, dEase), 0.25, eEase);
  const fov = lerp(lerp(28, 44, dive * dive), 30, eEase);
  out.cam.y = y; out.cam.z = z; out.cam.lookY = lookY; out.cam.fov = fov;

  // fog is tied to the camera's actual position, so it begins exactly when it passes the glass surface
  const inside = s(glassZ + 0.8, 0.2, z);
  const burst = Math.exp(-Math.pow((z - glassZ) / 0.5, 2)) * s(0.02, 0.1, dive) * (1 - s(0, 0.12, emerge));

  // ── bottle dissolve: 0 = solid, 1 = gone ──
  const d = out.dissolve;
  for (let j = 0; j < CHAPTER_N; j++) d[j] = j === chapter ? s(0, 0.55, frac) : j === chapter + 1 ? 1 - s(0.45, 1, frac) : 1;
  const introDiss = reduced ? 0 : 1 - s(0.12, 0.8, introT);
  d[0] = Math.max(d[0], introDiss);
  d[CHAPTER_N - 1] = Math.max(d[CHAPTER_N - 1], s(0.55, 0.95, inside));
  if (lineup > 0.5) for (let j = 0; j < CHAPTER_N; j++) d[j] = 1 - s(late(0.85 + j * 0.012), late(0.915 + j * 0.012), p);

  // ── particle morph ──
  const m = out.morph;
  if (lineup > 0.5) {
    m.active = p < late(0.93); m.mode = 0; m.t = s(late(0.848), late(0.92), p); m.lineup = true;
  } else if (!reduced && introT < 1 && p < early(0.12)) {
    m.active = true; m.mode = 1; m.t = s(0, 0.85, introT); m.lineup = false;
  } else if (!reduced && frac > 0.001 && frac < 0.999) {
    m.active = true; m.mode = 0; m.t = frac; m.lineup = false;
  } else {
    m.active = false; m.mode = 0; m.t = 0; m.lineup = false;
  }

  out.idx = idx; out.chapter = chapter; out.frac = frac; out.dive = dive; out.emerge = emerge;
  out.inside = inside; out.lineup = lineup; out.burst = burst; out.scale = scale; out.glassZ = glassZ;
  out.mercury = clamp(0.3 + 0.7 * (4 * frac * (1 - frac)) + (1 - introT) * 0.6);
  out.condensation = clamp(0.95 - 0.7 * s(early(0.02), early(0.45), p) + 0.5 * s(late(0.8), late(0.9), p));
  return out;
}

/** Shared read-only view of the latest result, for components that render after World has run this frame. */
export const choreoNow: Choreo = out;

/**
 * Where bottle j stands in the line-up: [x, y, z, scale]. All stand on the floor so reflections stay correct.
 * Landscape: one row, spacing shrinks on narrower screens so all five always fit. Portrait: two bottles in front, the rest behind.
 */
export function lineupTarget(j: number, portrait: boolean, o: number[] = [0, 0, 0, 1], aspect = 16 / 9): number[] {
  const n = CHAPTER_N;
  if (portrait) {
    const front = 2, back = n - front;
    const inFront = j < front;
    const k = inFront ? j : j - front;
    const cnt = inFront ? front : back;
    o[0] = (k - (cnt - 1) / 2) * (inFront ? 1.25 : 1.3);
    o[1] = PODIUM_TOP; o[2] = inFront ? 0.9 : -1.9; o[3] = 0.5;
  } else {
    // podiums (radius 1.3 * scale) must not overlap, and the outer ones must stay on screen: scale follows the spacing
    const halfW = Math.tan((15 * Math.PI) / 180) * 10.6 * aspect * 0.92; // visible half-width at the finale camera, with a margin
    const sp = Math.min(2.05, halfW / ((n - 1) / 2 + 0.49));
    o[0] = (j - (n - 1) / 2) * sp; o[1] = PODIUM_TOP; o[2] = 0; o[3] = Math.min(0.8, sp / 2.65);
  }
  return o;
}
