import * as THREE from 'three';
import * as SH from './shaders';
import { THEMES } from '@/components/hero/themes';

export interface DissolveUniforms {
  uDissolve: THREE.IUniform<number>;
  uEdge: THREE.IUniform<THREE.Color>;
  uSeed: THREE.IUniform<number>;
}
export const makeDissolve = (seed: number): DissolveUniforms => ({
  uDissolve: { value: 1 },
  uEdge: { value: new THREE.Color('#ffc562') },
  uSeed: { value: seed },
});

/** Per-bottle uniform bag. The scene writes into it every frame; materials only ever read from it. */
export interface BottleRig {
  dissolve: DissolveUniforms;
  cond: THREE.IUniform<number>; // condensation amount on the glass
  liquid: { uColor: THREE.IUniform<THREE.Color>; uTime: THREE.IUniform<number>; uSlosh: THREE.IUniform<number>; uGlow: THREE.IUniform<number> };
}
export function makeRig(slug: string, seed: number): BottleRig {
  const t = THEMES[slug];
  return {
    dissolve: makeDissolve(seed),
    cond: { value: 0.9 },
    liquid: { uColor: { value: new THREE.Color(t.liquid) }, uTime: { value: 0 }, uSlosh: { value: 0 }, uGlow: { value: 1 } },
  };
}

type Shader = { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string };
type Edit = [anchor: string, add: string];

/** Applies every edit or none. A partially patched program (declarations without uses) would fail to compile. */
function patchAll(sh: Shader, vert: Edit[], frag: Edit[]): boolean {
  if (!vert.every(([a]) => sh.vertexShader.includes(a)) || !frag.every(([a]) => sh.fragmentShader.includes(a))) return false;
  for (const [a, add] of vert) sh.vertexShader = sh.vertexShader.replace(a, `${a}\n${add}`);
  for (const [a, add] of frag) sh.fragmentShader = sh.fragmentShader.replace(a, `${a}\n${add}`);
  return true;
}

export interface PatchOptions {
  key: string;
  dissolve: DissolveUniforms;
  offset: THREE.Vector3; // mesh position relative to the glass centre, so every part dissolves with the same noise field
  glass?: { cond: THREE.IUniform<number>; scratches: boolean; smudge: number };
}

/** Dissolve-with-glowing-edge for any standard/physical material, plus scratches/smudges/condensation for the glass. */
export function patchMaterial(mat: THREE.MeshStandardMaterial, o: PatchOptions) {
  mat.onBeforeCompile = (sh: Shader) => {
    const g = o.glass;
    Object.assign(sh.uniforms, {
      uDissolve: o.dissolve.uDissolve, uEdge: o.dissolve.uEdge, uSeed: o.dissolve.uSeed,
      uMkOff: { value: o.offset },
      uCond: g ? g.cond : { value: 0 },
      uScratch: { value: g?.scratches ? 0.5 : 0 },
      uSmudge: { value: g ? g.smudge : 0 },
    });
    const frag: Edit[] = [
      ['#include <common>', SH.PATCH_FRAG_DECL],
      ['#include <clipping_planes_fragment>', SH.PATCH_FRAG_DISSOLVE],
      ['#include <emissivemap_fragment>', SH.PATCH_FRAG_EDGE],
    ];
    if (g) frag.push(
      ['#include <roughnessmap_fragment>', SH.PATCH_FRAG_GLASS_ROUGH],
      ['#include <normal_fragment_maps>', SH.PATCH_FRAG_GLASS_NORMAL],
      ['#include <clearcoat_normal_fragment_maps>', `#ifdef USE_CLEARCOAT\n${SH.PATCH_FRAG_GLASS_CLEARCOAT}\n#endif`],
    );
    const ok = patchAll(sh, [['#include <common>', SH.PATCH_VERT_DECL], ['#include <begin_vertex>', SH.PATCH_VERT_BODY]], frag);
    if (!ok) console.warn('[hero] shader anchors not found; running unpatched', o.key);
  };
  mat.customProgramCacheKey = () => o.key;
}

/** Liquid-metal displacement for a chrome sphere. Falls back to a plain chrome sphere if anchors are missing. */
export function patchMercury(mat: THREE.MeshStandardMaterial, uniforms: { uMTime: THREE.IUniform<number>; uMAmp: THREE.IUniform<number>; uMFreq: THREE.IUniform<number> }) {
  mat.onBeforeCompile = (sh: Shader) => {
    Object.assign(sh.uniforms, uniforms);
    const needs = ['#include <common>', '#include <beginnormal_vertex>', '#include <begin_vertex>'];
    if (!needs.every((n) => sh.vertexShader.includes(n))) return;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SH.MERCURY_VERT_DECL}`)
      .replace('#include <beginnormal_vertex>', SH.MERCURY_BEGIN_NORMAL)
      .replace('#include <begin_vertex>', SH.MERCURY_BEGIN_VERTEX);
  };
  mat.customProgramCacheKey = () => 'mk-mercury';
}

export function makeLiquidMaterial(rig: BottleRig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SH.LIQUID_VS,
    fragmentShader: SH.LIQUID_FS,
    uniforms: { ...rig.liquid, uDissolve: rig.dissolve.uDissolve, uEdge: rig.dissolve.uEdge, uSeed: rig.dissolve.uSeed },
  });
}

export interface FloorUniforms {
  uRing: THREE.IUniform<THREE.Color>;
  uLiquid: THREE.IUniform<THREE.Color>;
  uBox: THREE.IUniform<THREE.Vector4[]>;
  uPlaneY: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uCaustic: THREE.IUniform<number>;
}
export function makeFloorMaterial(taps: number, planeY: number): { material: THREE.ShaderMaterial; uniforms: FloorUniforms } {
  const uniforms: FloorUniforms = {
    uRing: { value: new THREE.Color('#ffb347') },
    uLiquid: { value: new THREE.Color('#c99a3d') },
    uBox: { value: Array.from({ length: SH.BOTTLE_COUNT }, () => new THREE.Vector4(0, 0, 1, 0)) },
    uPlaneY: { value: planeY },
    uTime: { value: 0 },
    uCaustic: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: SH.FLOOR_VS, fragmentShader: SH.FLOOR_FS, uniforms: uniforms as unknown as Record<string, THREE.IUniform>, defines: { TAPS: taps } });
  return { material, uniforms };
}
