import * as THREE from 'three';
import { createContext } from 'react';
import { smoothstep } from './hero-state';
import { CHAPTER_SLUGS } from './chapters';

export interface ThemeDef {
  ring: string; // halo / floor ring / pillar light
  light: string; // key light tint
  liquid: string; // perfume colour
  dust: string; // gold dust / sparkle tint
  bokeh: string; // out-of-focus lights
}


export const THEMES: Record<string, ThemeDef> = {
  cyrus: { ring: '#ffb347', light: '#ffd9a0', liquid: '#c99a3d', dust: '#f6d98e', bokeh: '#ffae45' },
  nova: { ring: '#7db4ff', light: '#ffd7a0', liquid: '#a8701c', dust: '#ffe0b0', bokeh: '#ffa84a' },
  zest: { ring: '#cdf53c', light: '#f6ffc4', liquid: '#e2d35a', dust: '#eaff8f', bokeh: '#c4f05a' },
  mira: { ring: '#b58cff', light: '#efe2ff', liquid: '#d9c0f2', dust: '#e4d2ff', bokeh: '#b98cff' },
  flova: { ring: '#ffb0c0', light: '#ffe6e6', liquid: '#ecd9a8', dust: '#ffdce2', bokeh: '#ffc2cf' },
};

const KEYS = ['ring', 'light', 'dust', 'bokeh', 'liquid'] as const;
const tmp = new THREE.Color();
const gold = new THREE.Color('#ffc562');

/** Mutable colours blended from the two neighbouring chapter themes. Updated once per frame. */
export class LiveTheme {
  ring = new THREE.Color();
  light = new THREE.Color();
  dust = new THREE.Color();
  bokeh = new THREE.Color();
  liquid = new THREE.Color();
}

export function blendTheme(out: LiveTheme, idx: number, finale: number) {
  const last = CHAPTER_SLUGS.length - 1;
  const i = Math.max(0, Math.min(last, Math.floor(idx)));
  const j = Math.min(last, i + 1);
  const t = smoothstep(0, 1, idx - i);
  const a = THEMES[CHAPTER_SLUGS[i]];
  const b = THEMES[CHAPTER_SLUGS[j]];
  for (const k of KEYS) {
    out[k].set(a[k]).lerp(tmp.set(b[k]), t);
    out[k].lerp(gold, finale * 0.75);
  }
}

export const ThemeContext = createContext<LiveTheme>(new LiveTheme());
