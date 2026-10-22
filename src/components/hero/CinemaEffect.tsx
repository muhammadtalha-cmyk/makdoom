'use client';
import * as THREE from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { forwardRef, useMemo } from 'react';
import { CINEMA_FS } from '@/lib/3d/shaders';

/** One post pass: velocity RGB split, barrel lens, glass-crossing refraction burst, "inside the perfume" volume, grain, vignette. */
export class CinemaEffectImpl extends Effect {
  constructor() {
    super('CinemaEffect', CINEMA_FS, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION, // samples the input buffer at offset UVs
      uniforms: new Map<string, THREE.Uniform>([
        ['uTime', new THREE.Uniform(0)],
        ['uSpeed', new THREE.Uniform(0)],
        ['uFog', new THREE.Uniform(0)],
        ['uBurst', new THREE.Uniform(0)],
        ['uGrain', new THREE.Uniform(0.035)],
        ['uCA', new THREE.Uniform(0.0012)],
        ['uAspect', new THREE.Uniform(1.78)],
        ['uFogColor', new THREE.Uniform(new THREE.Color('#ecd9a8'))],
        ['uFogColor2', new THREE.Uniform(new THREE.Color('#ffdce2'))],
      ]),
    });
  }
  set(name: string, v: number) {
    const u = this.uniforms.get(name);
    if (u) u.value = v;
  }
  color(name: 'uFogColor' | 'uFogColor2', c: THREE.Color) {
    (this.uniforms.get(name)!.value as THREE.Color).copy(c);
  }
}

export const CinemaEffect = forwardRef<CinemaEffectImpl>(function CinemaEffect(_props, ref) {
  const effect = useMemo(() => new CinemaEffectImpl(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
