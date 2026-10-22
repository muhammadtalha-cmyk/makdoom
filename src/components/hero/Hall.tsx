'use client';
import * as THREE from 'three';
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { FLOOR_Y } from '@/lib/3d/constants';
import { TIERS, type Tier } from '@/lib/3d/quality';
import { ThemeContext } from './themes';
import { makeSoftCircleTexture } from './textures';
import { choreoNow } from '@/lib/3d/choreo';
import { clamp, easeOutExpo, heroState } from './hero-state';

export { FLOOR_Y };

/**
 * The stage: a dark gallery receding into light, a halo ring behind the bottle and a wet black marble floor
 * (analytic reflections: see FLOOR_FS). Pillars are instanced: two draw calls instead of ~36.
 */
export default function Hall({ tier, floorMaterial }: { tier: Tier; floorMaterial: THREE.Material }) {
  const theme = useContext(ThemeContext);
  const cfg = TIERS[tier];
  const glowTex = useMemo(() => makeSoftCircleTexture(256), []);
  const pillars = useRef<THREE.InstancedMesh>(null);
  const strips = useRef<THREE.InstancedMesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring2Mat = useRef<THREE.MeshBasicMaterial>(null);
  const floorRingMat = useRef<THREE.MeshBasicMaterial>(null);
  const stripMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloGlow = useRef<THREE.MeshBasicMaterial>(null);
  const endGlow = useRef<THREE.MeshBasicMaterial>(null);
  const haloGroup = useRef<THREE.Group>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  const n = cfg.pillars;
  useLayoutEffect(() => {
    const p = pillars.current;
    const s = strips.current;
    if (!p || !s) return;
    const m = new THREE.Matrix4();
    let k = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const z = -3 - i * 4.2;
        p.setMatrixAt(k, m.makeTranslation(side * 6.6, 3.4, z));
        s.setMatrixAt(k, m.makeTranslation(side * 6.6 - side * 0.68, 3.4, z + 0.64));
        k++;
      }
    }
    p.instanceMatrix.needsUpdate = s.instanceMatrix.needsUpdate = true;
  }, [n]);

  useFrame((st) => {
    const t = heroState.reduced ? 0 : st.clock.elapsedTime;
    const lineup = choreoNow.lineup;
    const load = easeOutExpo(clamp(heroState.intro));
    ringMat.current?.color.copy(theme.ring).multiplyScalar(3.4);
    ring2Mat.current?.color.copy(theme.ring).multiplyScalar(1.4);
    floorRingMat.current?.color.copy(theme.ring).multiplyScalar(2.8);
    stripMat.current?.color.copy(theme.ring).multiplyScalar(2.2);
    haloGlow.current?.color.copy(theme.ring).multiplyScalar(0.8);
    endGlow.current?.color.copy(theme.ring).multiplyScalar(1.2);
    if (haloGroup.current) haloGroup.current.scale.setScalar((0.35 + 0.65 * load) * (1 + 0.85 * lineup) * (1 + 0.012 * Math.sin(t * 1.3)));
    if (ring2.current) ring2.current.rotation.z = t * 0.08;
  });

  return (
    <group>
      <instancedMesh ref={pillars} args={[undefined, undefined, n * 2]} frustumCulled={false}>
        <boxGeometry args={[1.3, 9, 1.3]} />
        <meshStandardMaterial color="#0b0908" roughness={0.55} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={strips} args={[undefined, undefined, n * 2]} frustumCulled={false}>
        <boxGeometry args={[0.05, 8.6, 0.05]} />
        <meshBasicMaterial ref={stripMat} color="#ffb347" toneMapped={false} />
      </instancedMesh>

      <group ref={haloGroup} position={[0, 0.55, -3.4]}>
        <mesh>
          <torusGeometry args={[2.25, 0.035, 16, 160]} />
          <meshBasicMaterial ref={ringMat} color="#ffb347" toneMapped={false} />
        </mesh>
        <mesh ref={ring2} position={[0, 0, -0.15]}>
          <torusGeometry args={[2.62, 0.012, 12, 160, Math.PI * 1.55]} />
          <meshBasicMaterial ref={ring2Mat} color="#ffb347" toneMapped={false} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0, -0.2]}>
          <planeGeometry args={[9.5, 9.5]} />
          <meshBasicMaterial ref={haloGlow} map={glowTex} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      </group>

      <mesh position={[0, FLOOR_Y + 0.01, -0.2]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[3.5, 0.028, 10, 160]} />
        <meshBasicMaterial ref={floorRingMat} color="#ffb347" toneMapped={false} />
      </mesh>

      <mesh position={[0, 3, -40]}>
        <planeGeometry args={[46, 46]} />
        <meshBasicMaterial ref={endGlow} map={glowTex} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -14]} material={floorMaterial}>
        <planeGeometry args={[60, 80]} />
      </mesh>
    </group>
  );
}
