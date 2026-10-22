'use client';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Bottle } from './Bottle';
import Hall from './Hall';
import StudioEnv from './StudioEnv';
import { Bokeh, Citrus, Dust, Flares, Mist, Morph, Petals, Shafts, Spray } from './Props';
import { CinemaEffect, type CinemaEffectImpl } from './CinemaEffect';
import { LiveTheme, ThemeContext, blendTheme } from './themes';
import { getLabel } from './textures';
import { CHAPTER_N, clamp, damp, early, heroState, smoothstep } from './hero-state';
import { CHAPTER_SLUGS } from './chapters';
import { choreograph, lineupTarget } from '@/lib/3d/choreo';
import { PODIUM_TOP } from '@/lib/3d/constants';
import { makeFloorMaterial, makeRig } from '@/lib/3d/materials';
import { TIERS, type Tier } from '@/lib/3d/quality';
import type { HeroDriver } from './hero-driver';

export interface SceneProduct { slug: string; name: string }

const mark = (n: string) => { try { performance.mark(n); } catch { /* ignore */ } }; // visible in DevTools → Performance → Timings
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const lineup = [0, 0, 0, 1];
const IDX_CITRUS = CHAPTER_SLUGS.indexOf('zest');
const IDX_PETALS = CHAPTER_SLUGS.indexOf('flova');

function World({ products, tier, safe, onReady, onCompiled }: { products: SceneProduct[]; tier: Tier; safe: boolean; onReady: () => void; onCompiled: () => void }) {
  const { size, camera, gl, scene } = useThree();
  const cfg = TIERS[tier];
  const portrait = size.width / size.height < 0.9;
  const theme = useMemo(() => new LiveTheme(), []);
  const rigs = useMemo(() => products.map((p, j) => makeRig(p.slug, 1 + j * 13.7)), [products]);
  const floor = useMemo(() => makeFloorMaterial(cfg.floorTaps, PODIUM_TOP), [cfg.floorTaps]);
  const bottles = useRef<(THREE.Group | null)[]>([]);
  const key = useRef<THREE.SpotLight>(null);
  const rim = useRef<THREE.PointLight>(null);
  const back = useRef<THREE.PointLight>(null);
  const bloom = useRef<{ intensity: number } | null>(null);
  const cinema = useRef<CinemaEffectImpl>(null);
  const citrusW = useRef(0);
  const petalW = useRef(0);
  const ptr = useRef({ x: 0, y: 0 });
  const slosh = useRef(0);
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const warm = useRef(-1);
  const chapterRef = useRef(0);
  const patches = !safe && tier > 0;

  useEffect(() => () => { floor.material.dispose(); }, [floor]);

  // tier → renderer settings (post chain off = the renderer tone-maps itself)
  useEffect(() => {
    gl.toneMapping = cfg.composer ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    (gl as unknown as { transmissionResolutionScale: number }).transmissionResolutionScale = tier >= 3 ? 0.75 : 0.5;
  }, [gl, cfg.composer, tier]);

  // REAL ready signal, in this order (no frame is rendered before step 3, so nothing blocks the page while shaders build):
  //   1. the FIRST bottle's label is painted (the others paint in the background; they are off-screen at the start)
  //   2. every program the whole scroll can ever need is compiled, including effects that are hidden right now
  //      (particle morph, citrus, petals, flare). Compiling those on first use is what used to freeze the page mid-scroll.
  //   3. the driver starts rendering; after a few warm-up frames the poster fades out
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // one-time setup (guards against re-runs from prop identity changes)
    started.current = true;
    let dead = false;
    mark('mk-scene-mounted');
    (async () => {
      try {
        const first = products[0] ? getLabel(products[0].slug, products[0].name).ready : Promise.resolve();
        await Promise.race([first, wait(3500)]);
        mark('mk-label-ready');
        bottles.current.forEach((g) => g && (g.visible = true)); // so their programs are included
        const hidden: THREE.Object3D[] = [];
        scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        try {
          await Promise.race([gl.compileAsync(scene, camera), wait(9000)]);
        } finally {
          hidden.forEach((o) => { o.visible = false; });
        }
      } catch (e) {
        console.warn('[hero] precompile skipped', e);
      }
      if (dead) return;
      mark('mk-compiled');
      warm.current = 4;
      onCompiled();
    })();
    return () => { dead = true; started.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, products]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const time = state.clock.elapsedTime;
    // resolution governor: the cheapest quality knob (no shader work). Quantised so it never thrashes.
    const wantDpr = Math.max(0.7, Math.round(Math.min(window.devicePixelRatio || 1, cfg.dprMax) * heroState.dprScale * 20) / 20);
    if (Math.abs(state.gl.getPixelRatio() - wantDpr) > 0.04) state.setDpr(wantDpr);
    const reduced = heroState.reduced;
    // The load intro can only ever be "in progress" near the top of the page. Once the visitor has scrolled on, it counts as
    // finished, so a late or missed intro timer can never leave the first bottle (Cyrus) dissolved/invisible.
    const introT = Math.max(heroState.intro, smoothstep(early(0.04), early(0.1), heroState.smooth));
    const ch = choreograph(heroState.smooth, introT, portrait, reduced);
    heroState.inside = ch.inside;
    heroState.burst = ch.burst;
    chapterRef.current = ch.chapter;

    ptr.current.x = damp(ptr.current.x, heroState.pointerX, 3, dt);
    ptr.current.y = damp(ptr.current.y, heroState.pointerY, 3, dt);
    slosh.current = damp(slosh.current, heroState.speed, 5, dt);

    blendTheme(theme, ch.idx, ch.lineup);
    citrusW.current = clamp(1 - Math.abs(ch.idx - IDX_CITRUS)) * (1 - ch.lineup) * (1 - ch.inside);
    petalW.current = clamp(1 - Math.abs(ch.idx - IDX_PETALS)) * (1 - ch.lineup * 0.85) * (1 - ch.inside);

    // ── camera ──
    const cam = camera as THREE.PerspectiveCamera;
    const par = 1 - ch.inside;
    cam.position.set(ptr.current.x * 0.55 * par, ch.cam.y + ptr.current.y * 0.28 * par + (reduced ? 0 : Math.sin(time * 0.4) * 0.03), ch.cam.z);
    cam.lookAt(0, ch.cam.lookY, 0);
    if (Math.abs(cam.fov - ch.cam.fov) > 0.01) { cam.fov = ch.cam.fov; cam.updateProjectionMatrix(); }
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * Math.max(2, ch.cam.z);
    heroState.pwx = ptr.current.x * halfH * (size.width / size.height);
    heroState.pwy = ptr.current.y * halfH + ch.cam.lookY;

    // ── bottles ──
    const base = ch.scale;
    const box = floor.uniforms.uBox.value;
    products.forEach((_, j) => {
      const g = bottles.current[j];
      const rig = rigs[j];
      if (!g) return;
      const d = ch.dissolve[j];
      rig.dissolve.uDissolve.value = patches ? d : 0;
      rig.dissolve.uEdge.value.copy(theme.ring);
      rig.cond.value = ch.condensation;
      rig.liquid.uTime.value = time;
      rig.liquid.uSlosh.value = slosh.current;
      rig.liquid.uGlow.value = 1 + ch.burst * 0.8;

      let x = 0, y = PODIUM_TOP, z = 0, s = base, ry: number;
      if (ch.lineup > 0.5) {
        lineupTarget(j, portrait, lineup, size.width / size.height);
        [x, y, z, s] = lineup as [number, number, number, number];
        ry = (j - (CHAPTER_N - 1) / 2) * -0.14 + (reduced ? 0 : Math.sin(time * 0.5 + j) * 0.08);
      } else {
        const dc = clamp(j - ch.idx, -1.5, 1.5);
        const sway = reduced || Math.abs(j - ch.idx) > 0.35 ? 0 : Math.sin(time * 0.6 + j) * 0.16;
        const introSpin = j === 0 && !reduced ? Math.pow(1 - introT, 2) * 2.6 : 0;
        ry = -dc * Math.PI * 0.95 + sway + ptr.current.x * 0.4 * par + introSpin;
      }
      const visible = patches ? d < 0.999 : d < 0.5;
      g.visible = visible;
      g.position.set(x, y, z);
      g.rotation.set(0, ry, 0);
      g.scale.setScalar(s);
      box[j].set(x, z, s, visible ? 1 - d : 0);
    });

    // ── floor, lights ──
    const fu = floor.uniforms;
    fu.uRing.value.copy(theme.ring);
    fu.uLiquid.value.copy(theme.liquid);
    fu.uTime.value = time;
    if (key.current) key.current.color.copy(theme.light);
    if (rim.current) rim.current.color.copy(theme.ring);
    if (back.current) back.current.color.copy(theme.ring);

    // ── post ──
    const c = cinema.current;
    if (c) {
      c.set('uTime', time); c.set('uSpeed', heroState.speed); c.set('uFog', ch.inside); c.set('uBurst', ch.burst);
      c.set('uAspect', size.width / size.height); c.set('uGrain', 0.03 + ch.inside * 0.02);
      c.color('uFogColor', theme.liquid); c.color('uFogColor2', theme.light);
    }
    if (bloom.current) bloom.current.intensity = 0.85 + ch.lineup * 0.25 + ch.inside * 0.5 + ch.burst * 1.2;

    if (warm.current > 0 && --warm.current === 0) { mark('mk-hero-ready'); onReady(); }
  }, -1);

  const getOrigin = useCallback(() => {
    const g = bottles.current[chapterRef.current];
    return g ? g.localToWorld(tmpV.set(-0.12, 1.72, 0.14)).clone() : null;
  }, [tmpV]);

  return (
    <ThemeContext.Provider value={theme}>
      <color attach="background" args={['#030303']} />
      <fog attach="fog" args={['#040404', 16, 46]} />
      <StudioEnv />
      <ambientLight intensity={0.05} />
      <spotLight ref={key} position={[3.5, 6, 6]} angle={0.55} penumbra={1} intensity={90} distance={30} color="#ffd9a0" />
      <pointLight ref={rim} position={[-4.5, 2, -3.5]} intensity={55} distance={22} color="#ffb347" />
      <pointLight ref={back} position={[0, 1.2, -3]} intensity={38} distance={16} color="#ffb347" />

      <Hall tier={tier} floorMaterial={floor.material} />
      <Bokeh count={cfg.bokeh} />
      {!heroState.reduced && <Dust count={cfg.dust} />}
      {!heroState.reduced && cfg.mist > 0 && <Mist count={cfg.mist} />}
      {cfg.shafts > 0 && <Shafts count={cfg.shafts} />}

      {products.map((pr, j) => (
        <Bottle key={`${pr.slug}-${tier}-${safe}`} ref={(el) => { bottles.current[j] = el; }} slug={pr.slug} name={pr.name} tier={tier} rig={rigs[j]} mirror={floor.material} safe={safe} />
      ))}

      <Citrus weightRef={citrusW} />
      <Petals count={cfg.petals} weightRef={petalW} />
      {!heroState.reduced && cfg.morph > 0 && !safe && <Morph count={cfg.morph} portrait={portrait} scale={portrait ? 0.82 : 1.12} />}
      {cfg.flares && !safe && <Flares />}
      {!heroState.reduced && <Spray count={cfg.spray} getOrigin={getOrigin} />}

      {cfg.composer && (
        <EffectComposer key={`fx-${tier}-${safe}`} multisampling={cfg.msaa} enableNormalPass={false}>
          <Bloom ref={bloom as never} intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.25} mipmapBlur radius={0.72} />
          {cfg.cinema && !safe ? <CinemaEffect ref={cinema} /> : <></>}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </ThemeContext.Provider>
  );
}

interface Props {
  products: SceneProduct[];
  driver: HeroDriver;
  startTier: Tier;
  onReady: () => void;
  onReset: () => void; // scene is being rebuilt: show the poster again
  onFail: (reason: string) => void; // give up on 3D: show the static hero
}

export default function HeroScene({ products, driver, startTier, onReady, onReset, onFail }: Props) {
  const [tier, setTier] = useState<Tier>(startTier);
  const [safe, setSafe] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const losses = useRef(0);
  const faults = useRef(0);
  const adv = useRef<((t: number) => void) | null>(null);
  const cfg = TIERS[tier];

  useEffect(() => driver.onTier(setTier), [driver]);
  useEffect(() => () => driver.detachScene(), [driver]);

  const rebuild = useCallback((why: string) => {
    driver.detachScene();
    onReset();
    if (why === 'lost' && ++losses.current > 2) return onFail('context lost repeatedly');
    if (why === 'shader') {
      if (++faults.current > 1) return onFail('shader error in safe mode');
      setSafe(true); // first fault: rebuild without the custom material patches / post effects
      driver.forceTier(0);
    }
    setEpoch((e) => e + 1);
  }, [driver, onFail, onReset]);

  return (
    <Canvas
      key={epoch}
      frameloop="never"
      dpr={[1, cfg.dprMax]}
      camera={{ fov: 28, position: [0, 0.5, 16], near: 0.1, far: 90 }}
      gl={{ antialias: startTier === 0, powerPreference: 'high-performance', alpha: false, stencil: false }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
      onCreated={({ gl, advance }) => {
        const el = gl.domElement;
        el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); window.setTimeout(() => rebuild('lost'), 250); });
        let reported = false;
        gl.debug.onShaderError = () => { if (!reported) { reported = true; rebuild('shader'); } };
        adv.current = advance; // attached to the driver only after the shaders are compiled (see World)
      }}
    >
      <World products={products} tier={safe ? 0 : tier} safe={safe} onReady={onReady} onCompiled={() => { if (adv.current) driver.attachScene(adv.current); }} />
    </Canvas>
  );
}
