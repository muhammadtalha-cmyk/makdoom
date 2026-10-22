'use client';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { forwardRef, useEffect, useMemo } from 'react';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/kaushan-script/400.css';
import { BOTTLE } from '@/lib/3d/constants';
import { makeLiquidMaterial, patchMaterial, type BottleRig } from '@/lib/3d/materials';
import { TIERS, type Tier } from '@/lib/3d/quality';
import { getLabel, makeSoftCircleTexture } from './textures';
import { THEMES } from './themes';

export { BOTTLE, BOTTLE_TOP } from '@/lib/3d/constants';

const GLASS_Y = BOTTLE.h / 2; // bottle-space origin for noise = glass centre
const at = (y: number, z = 0) => new THREE.Vector3(0, y - GLASS_Y, z);

function capGeometry() {
  const r = BOTTLE.capR;
  const h = BOTTLE.capH;
  const bevel = 0.04;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, h - bevel)];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - bevel + Math.cos(a) * bevel, h - bevel + Math.sin(a) * bevel));
  }
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, 64);
}

interface Props {
  slug: string;
  name: string;
  tier: Tier;
  rig: BottleRig;
  /** floor/podium mirror material (shared). Omit in the product viewer to get a plain dark podium. */
  mirror?: THREE.Material;
  /** disable the dissolve/scratch patches (self-heal after a shader error) */
  safe?: boolean;
}

/**
 * Procedural perfume bottle.
 *  - glass: physically-based, refractive (thickness + dispersion) with micro-scratches, smudges and condensation droplets
 *  - liquid: custom shader (banded light, caustics, bubbles, slosh when you scroll fast)
 *  - every part shares one noise field so the whole bottle dissolves into particles consistently
 */
export const Bottle = forwardRef<THREE.Group, Props>(function Bottle({ slug, name, tier, rig, mirror, safe = false }, ref) {
  const cfg = TIERS[tier];
  const theme = THEMES[slug];
  const patch = !safe && tier > 0;
  const seg = tier >= 3 ? 6 : tier === 2 ? 5 : tier === 1 ? 3 : 2;

  const label = useMemo(() => getLabel(slug, name), [slug, name]);
  const glow = useMemo(() => makeSoftCircleTexture(), []);
  const geo = useMemo(
    () => ({
      glass: new RoundedBoxGeometry(BOTTLE.w, BOTTLE.h, BOTTLE.d, seg, 0.075),
      liquid: new RoundedBoxGeometry(0.8, 0.82, 0.42, seg, 0.05),
      cap: capGeometry(),
      // podium: side wall only; the top is the mirror disc so the bottle's reflection shows in it
      podiumSide: new THREE.CylinderGeometry(1.22, 1.3, 0.14, 96, 1, true),
      podiumTop: new THREE.CircleGeometry(1.22, 96),
    }),
    [seg],
  );
  const mats = useMemo(() => {
    const glass = new THREE.MeshPhysicalMaterial(
      cfg.transmission
        ? { color: '#ffffff', transmission: 1, thickness: 1.1, ior: 1.52, roughness: 0.025, attenuationColor: new THREE.Color('#fff1d6'), attenuationDistance: 5, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.5, ...(cfg.dispersion ? { dispersion: 0.35 } : {}) }
        : { color: '#ffffff', transparent: true, opacity: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, depthWrite: false },
    );
    const labelMat = new THREE.MeshStandardMaterial({ map: label.tex, transparent: true, metalness: 0.2, roughness: 0.4, emissive: '#ffffff', emissiveMap: label.tex, emissiveIntensity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const collar = new THREE.MeshStandardMaterial({ color: '#cdb67f', metalness: 1, roughness: 0.2, envMapIntensity: 1.6 });
    const cap = new THREE.MeshPhysicalMaterial({ color: '#060606', roughness: 0.16, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 });
    const tube = new THREE.MeshStandardMaterial({ color: '#f1ead8', roughness: 0.35 });
    const podium = new THREE.MeshPhysicalMaterial({ color: '#0a0908', roughness: 0.16, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, side: THREE.DoubleSide });
    const liquid = makeLiquidMaterial(rig);
    if (patch) {
      const k = 'mk-'; // tier-independent: the patch code is identical on every tier (only uniform VALUES differ), so a tier change reuses the compiled programs
      patchMaterial(glass, { key: `${k}glass`, dissolve: rig.dissolve, offset: at(GLASS_Y), glass: { cond: cfg.condensation ? rig.cond : { value: 0 }, scratches: cfg.scratches, smudge: 0.06 } });
      patchMaterial(labelMat, { key: `${k}label`, dissolve: rig.dissolve, offset: at(0.6, BOTTLE.d / 2 + 0.003) });
      patchMaterial(collar, { key: `${k}collar`, dissolve: rig.dissolve, offset: at(BOTTLE.h + BOTTLE.collarH / 2) });
      patchMaterial(cap, { key: `${k}cap`, dissolve: rig.dissolve, offset: at(BOTTLE.h + BOTTLE.collarH) });
      patchMaterial(tube, { key: `${k}tube`, dissolve: rig.dissolve, offset: at(0.62, 0.225) });
    }
    return { glass, labelMat, collar, cap, tube, podium, liquid };
  }, [cfg.transmission, cfg.dispersion, cfg.condensation, cfg.scratches, label, patch, rig, tier]);

  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  return (
    <group ref={ref}>
      {/* podium */}
      <mesh position={[0, -0.07, 0]} geometry={geo.podiumSide} material={mats.podium} />
      <mesh position={[0, 0.0005, 0]} rotation-x={-Math.PI / 2} geometry={geo.podiumTop}>
        {mirror ? <primitive object={mirror} attach="material" dispose={null} /> : <meshStandardMaterial color="#060504" roughness={0.12} metalness={0.8} />}
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.22, 0.012, 12, 128]} />
        <meshBasicMaterial color={[2.4, 1.7, 0.7]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial map={glow} color={theme.liquid} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0.62, 0]} geometry={geo.liquid} material={mats.liquid} />
      <mesh position={[0.03, 0.62, 0.225]} material={mats.tube}>
        <cylinderGeometry args={[0.011, 0.011, 0.95, 8]} />
      </mesh>
      <mesh position={[0, BOTTLE.h / 2, 0]} geometry={geo.glass} material={mats.glass} />
      <mesh position={[0, 0.6, BOTTLE.d / 2 + 0.003]} renderOrder={5} material={mats.labelMat}>
        <planeGeometry args={[0.92, 0.9]} />
      </mesh>
      <mesh position={[0, BOTTLE.h + BOTTLE.collarH / 2, 0]} material={mats.collar}>
        <cylinderGeometry args={[0.185, 0.2, BOTTLE.collarH, 48]} />
      </mesh>
      <mesh position={[0, BOTTLE.h + BOTTLE.collarH, 0]} geometry={geo.cap} material={mats.cap} />
    </group>
  );
});
