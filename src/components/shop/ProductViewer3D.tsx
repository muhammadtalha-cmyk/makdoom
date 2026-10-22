'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Bottle } from '@/components/hero/Bottle';
import StudioEnv from '@/components/hero/StudioEnv';
import { makeSoftCircleTexture } from '@/components/hero/textures';
import { makeRig } from '@/lib/3d/materials';
import { TIERS, hardFailureRecent, prefersLightweight, probeWebGL, startTier, type Tier } from '@/lib/3d/quality';

function Backdrop({ color }: { color: string }) {
  const tex = useMemo(() => makeSoftCircleTexture(256), []);
  return (
    <>
      <mesh position={[0, 0.8, -3]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={tex} color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.8, -2.6]}>
        <torusGeometry args={[1.9, 0.02, 12, 128]} />
        <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(3)} toneMapped={false} />
      </mesh>
    </>
  );
}

function Rig({ slug, name, tier }: { slug: string; name: string; tier: Tier }) {
  const rig = useMemo(() => { const r = makeRig(slug, 3); r.dissolve.uDissolve.value = 0; r.cond.value = 0.55; return r; }, [slug]);
  useFrame((s) => { rig.liquid.uTime.value = s.clock.elapsedTime; });
  return (
    <group position={[0, -0.95, 0]} scale={1.25}>
      <Bottle slug={slug} name={name} tier={tier} rig={rig} />
    </group>
  );
}

/** Drag-to-rotate glass bottle for the product page. Pauses off-screen, recovers from context loss, and reports failure so the gallery can fall back to photos. */
export default function ProductViewer3D({ slug, name, accent, onFail }: { slug: string; name: string; accent: string; onFail?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const losses = useRef(0);
  const [tier] = useState<Tier>(() => {
    if (typeof window === 'undefined') return 2;
    const cap = probeWebGL();
    return cap.ok ? startTier(cap) : 0;
  });
  const cfg = TIERS[tier];

  useEffect(() => {
    if (hardFailureRecent() || prefersLightweight() || !probeWebGL().ok) onFail?.();
  }, [onFail]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="absolute inset-0">
      <Canvas
        key={epoch}
        frameloop={inView ? 'always' : 'never'}
        dpr={[1, cfg.dprMax]}
        camera={{ fov: 30, position: [0, 1.0, 8.2] }}
        gl={{ antialias: !cfg.composer, powerPreference: 'high-performance', toneMapping: cfg.composer ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping }}
        aria-label={`Interactive 3D ${name} bottle`}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            if (++losses.current > 2) onFail?.();
            else window.setTimeout(() => setEpoch((n) => n + 1), 250);
          });
        }}
      >
        <color attach="background" args={['#050505']} />
        <StudioEnv />
        <spotLight position={[3, 5, 5]} angle={0.55} penumbra={1} intensity={30} color="#ffd9a0" />
        <Backdrop color={accent} />
        <Rig slug={slug} name={name} tier={tier} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.4} minPolarAngle={Math.PI / 2.6} maxPolarAngle={Math.PI / 2} />
        {cfg.composer && (
          <EffectComposer multisampling={Math.min(cfg.msaa, 2)} enableNormalPass={false}>
            <Bloom intensity={0.7} luminanceThreshold={1.1} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
