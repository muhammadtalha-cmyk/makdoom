import type { Tier } from '../../lib/3d/quality';
import { CHAPTER_SLUGS } from './chapters';

/** Mutable state shared by the DOM overlay and the WebGL scene. Never triggers React renders. */
export const heroState = {
  raw: 0, // scroll progress 0..1, straight from the page
  smooth: 0, // progress both DOM and 3D follow
  vel: 0, // smoothed signed velocity, progress units / second
  speed: 0, // |velocity| normalised 0..1 (drives RGB split, skew, liquid slosh)
  spray: 0, // increments to fire a perfume mist burst
  pointerX: 0, // -1..1
  pointerY: 0,
  pointerSpeed: 0, // 0..1
  pwx: 0, // pointer in world space at z=0 (for particles / mist)
  pwy: 0,
  reduced: false, // prefers-reduced-motion
  time: 0, // driver clock in seconds (monotonic; does not jump when the tab was hidden)
  introT0: -1, // driver time when the scene became ready (-1 = not ready yet)
  intro: 0, // 0..1 load reveal, time based
  inside: 0, // 0..1 "camera is inside the perfume" fog amount (post-processing reads this)
  burst: 0, // 0..1 flash while the camera passes through the glass
  tier: 3 as Tier,
  dprScale: 1, // governor's resolution multiplier (cheap quality knob, applied by the scene)
};

export function resetHeroState() {
  heroState.raw = heroState.smooth = heroState.vel = heroState.speed = 0;
  heroState.pointerX = heroState.pointerY = heroState.pointerSpeed = 0;
  heroState.pwx = heroState.pwy = 0;
  heroState.time = 0;
  heroState.introT0 = -1;
  heroState.intro = 0;
  heroState.inside = heroState.burst = 0;
  heroState.dprScale = 1;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/**
 * The hero is one long scroll (progress 0..1). Every value below was tuned for FOUR chapters ("base units"). Each extra
 * chapter inserts one more 0.16 of scroll between the last hand-over and the dive, and the whole thing is renormalised,
 * so the scroll distance of every beat (intro, each hand-over, the dive, the line-up, the finale) is IDENTICAL to before:
 * the page just gets one chapter longer (.hero-wrap height in globals.css grows by the same factor).
 *   early(v): beats before/at the last chapter (intro, chapter centres, hand-overs)
 *   late(v):  beats after it (dive, line-up, finale), pushed back by the extra chapters
 *   0.00 – 0.10  intro: the first bottle condenses out of particles, camera pushes in
 *   chapters     one every 0.16 from 0.22; each hand-over dissolves one bottle into particles
 *   then         dive through the last bottle's glass → haze clears, ALL bottles condense in a line-up → finale copy
 */
const BASE_CHAPTERS = 4;
const SPACING = 0.16;
export const CHAPTER_N = CHAPTER_SLUGS.length;
const SHIFT = SPACING * (CHAPTER_N - BASE_CHAPTERS);
const K = 1 / (1 + SHIFT);
/** base-unit progress → real progress, for beats that happen before the last chapter ends */
export const early = (v: number) => v * K;
/** base-unit progress → real progress, for beats that happen after the last chapter (dive, line-up, finale) */
export const late = (v: number) => (v + SHIFT) * K;
/** how much longer the hero scroll is than the 4-chapter version (the CSS height uses the same number) */
export const HERO_LENGTH_FACTOR = 1 + SHIFT;

export const TIMELINE = {
  introEnd: early(0.1),
  centers: CHAPTER_SLUGS.map((_, i) => early(0.22 + SPACING * i)),
  transitions: CHAPTER_SLUGS.slice(1).map((_, i) => early(0.3 + SPACING * i)),
  width: early(0.1),
  panelFadeOut: [late(0.755), late(0.785)],
  diveStart: late(0.77),
  diveEnd: late(0.835),
  lineupAt: [late(0.836), late(0.842)],
  emerge: [late(0.84), late(0.925)],
  finaleCopy: [late(0.925), late(0.975)],
} as { introEnd: number; centers: number[]; transitions: number[]; width: number; panelFadeOut: number[]; diveStart: number; diveEnd: number; lineupAt: number[]; emerge: number[]; finaleCopy: number[] };

export const CHAPTER_CENTERS = TIMELINE.centers;
/** float 0..N-1: integer part = bottle on stage, fraction = hand-over progress */
export const stageIndex = (p: number) =>
  TIMELINE.transitions.reduce((s, m) => s + smoothstep(m - TIMELINE.width / 2, m + TIMELINE.width / 2, p), 0);
export const introAmount = (p: number) => smoothstep(0, TIMELINE.introEnd, p);

/** 0→1 as the full line-up takes over (used by DOM + scene colour grading) */
export const finaleOf = (p: number) => smoothstep(TIMELINE.lineupAt[0], TIMELINE.lineupAt[1], p);
