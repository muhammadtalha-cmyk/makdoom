'use client';
import * as THREE from 'three';
import { useContext, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as SH from '@/lib/3d/shaders';
import { patchMercury } from '@/lib/3d/materials';
import { BOTTLE, FLOOR_Y, PODIUM_TOP } from '@/lib/3d/constants';
import { choreoNow, lineupTarget } from '@/lib/3d/choreo';
import { CHAPTER_N, clamp, heroState } from './hero-state';
import { ThemeContext } from './themes';
import { makeBokehTexture, makeCitrusTexture, type CitrusKind } from './textures';

const pxScale = (gl: THREE.WebGLRenderer, cam: THREE.Camera) => gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad((cam as THREE.PerspectiveCamera).fov) / 2));
const rnd = THREE.MathUtils.randFloat;
const CHROME = new THREE.Color('#e9e2d4');

/* ─────────── gold dust: GPU-driven, pushed aside by the visitor's cursor, streaks when you scroll fast ─────────── */
export function Dust({ count }: { count: number }) {
  const theme = useContext(ThemeContext);
  const { gl, camera } = useThree();
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count), speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rnd(-7.5, 7.5); pos[i * 3 + 1] = rnd(-3, 5); pos[i * 3 + 2] = rnd(-6, 3);
      seed[i] = Math.random(); size[i] = rnd(0.6, 2.3); speed[i] = rnd(0.04, 0.16);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: SH.DUST_VS, fragmentShader: SH.DUST_FS,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uColor: { value: new THREE.Color() }, uPointer: { value: new THREE.Vector2() }, uPointerAmt: { value: 0 }, uSpeed: { value: 0 } },
    });
    return { geo: g, mat: m };
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((s) => {
    const u = mat.uniforms;
    u.uTime.value = heroState.reduced ? 0 : s.clock.elapsedTime;
    u.uScale.value = pxScale(gl, camera);
    u.uColor.value.copy(theme.dust);
    u.uPointer.value.set(heroState.pwx, heroState.pwy);
    u.uPointerAmt.value = heroState.reduced ? 0 : 1;
    u.uSpeed.value = heroState.speed;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/* ─────────── bokeh ─────────── */
export function Bokeh({ count }: { count: number }) {
  const theme = useContext(ThemeContext);
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => makeBokehTexture(), []);
  const data = useMemo(() => Array.from({ length: count }, () => ({ x: rnd(-17, 17), y: rnd(-2.5, 6.5), z: rnd(-24, -10), s: rnd(0.35, 1.85), ph: rnd(0, 6.28) })), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = heroState.reduced ? 0 : s.clock.elapsedTime;
    data.forEach((d, i) => {
      dummy.position.set(d.x + Math.sin(t * 0.1 + d.ph) * 0.4, d.y + Math.cos(t * 0.08 + d.ph) * 0.3, d.z);
      const sc = d.s * (1 + 0.08 * Math.sin(t * 0.7 + d.ph));
      dummy.scale.set(sc, sc, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    mat.current?.color.copy(theme.bokeh).multiplyScalar(1.4);
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <circleGeometry args={[1, 40]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

/* ─────────── GPU dissolve / morph particles (see MORPH_VS) ─────────── */
function sampleBottle(o: Float32Array, i: number) {
  const { w, h, d, capH, collarH, capR } = BOTTLE;
  const aBody = [w * h, w * h, d * h, d * h, w * d, w * d]; // front, back, sides, top, bottom
  const aCap = 2 * Math.PI * capR * capH;
  const total = aBody.reduce((a, b) => a + b, 0) + aCap;
  let r = Math.random() * total;
  let x = 0, y = 0, z = 0;
  const face = aBody.findIndex((a) => (r -= a) < 0);
  if (face >= 0) {
    const u = Math.random() - 0.5, v = Math.random();
    if (face < 2) { x = u * w; y = v * h; z = (face ? -1 : 1) * d / 2; }
    else if (face < 4) { z = u * d; y = v * h; x = (face === 2 ? -1 : 1) * w / 2; }
    else { x = u * w; z = (Math.random() - 0.5) * d; y = face === 4 ? h : 0; }
  } else {
    const a = Math.random() * Math.PI * 2;
    x = Math.cos(a) * capR; z = Math.sin(a) * capR; y = h + collarH + Math.random() * capH;
  }
  o[i * 3] = x; o[i * 3 + 1] = y; o[i * 3 + 2] = z;
}

export function Morph({ count, portrait, scale }: { count: number; portrait: boolean; scale: number }) {
  const theme = useContext(ThemeContext);
  const { gl, camera, size } = useThree();
  const aspect = size.width / size.height;
  const tmp = useMemo(() => [0, 0, 0, 1], []);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const local = new Float32Array(count * 3), rand = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      sampleBottle(local, i);
      rand[i * 4] = Math.random(); rand[i * 4 + 1] = Math.random(); rand[i * 4 + 2] = i % CHAPTER_N; rand[i * 4 + 3] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aLocal', new THREE.BufferAttribute(local, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    const v4 = () => Array.from({ length: CHAPTER_N }, () => new THREE.Vector4());
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: SH.MORPH_VS, fragmentShader: SH.MORPH_FS,
      uniforms: { uT: { value: 0 }, uMode: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 }, uSpeed: { value: 0 }, uFrom: { value: v4() }, uTo: { value: v4() }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() } },
    });
    return { geo: g, mat: m };
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const ref = useRef<THREE.Points>(null);
  useFrame((s) => {
    const p = ref.current;
    const m = choreoNow.morph;
    if (!p) return;
    p.visible = m.active;
    if (!m.active) return;
    const u = mat.uniforms;
    u.uT.value = m.t; u.uMode.value = m.mode; u.uTime.value = s.clock.elapsedTime; u.uScale.value = pxScale(gl, camera); u.uSpeed.value = heroState.speed * 0.5;
    u.uColA.value.copy(theme.dust); u.uColB.value.copy(theme.ring);
    for (let j = 0; j < CHAPTER_N; j++) {
      u.uFrom.value[j].set(0, PODIUM_TOP, 0, scale);
      if (m.lineup) { lineupTarget(j, portrait, tmp, aspect); u.uTo.value[j].set(tmp[0], tmp[1], tmp[2], tmp[3]); }
      else u.uTo.value[j].set(0, PODIUM_TOP, 0, scale);
    }
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={9} visible={false} />;
}

/* ─────────── volumetric light shafts ─────────── */
export function Shafts({ count }: { count: number }) {
  const theme = useContext(ThemeContext);
  const defs = useMemo(() => [{ x: -3.6, rz: 0.3, k: 0.1 }, { x: 3.8, rz: -0.32, k: 0.08 }, { x: 0.2, rz: 0.04, k: 0.06 }].slice(0, count), [count]);
  const mats = useMemo(() => defs.map((d) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: SH.SHAFT_VS, fragmentShader: SH.SHAFT_FS, uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: d.k }, uTime: { value: 0 } } })), [defs]);
  const geo = useMemo(() => new THREE.ConeGeometry(2.4, 13, 32, 1, true), []);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);
  useFrame((s) => {
    const k = (1 - choreoNow.inside) * (1 - choreoNow.lineup * 0.4);
    mats.forEach((m, i) => {
      m.uniforms.uTime.value = s.clock.elapsedTime;
      m.uniforms.uColor.value.copy(theme.light);
      m.uniforms.uIntensity.value = defs[i].k * k * (1 + heroState.speed * 0.6);
    });
  });
  return (
    <group>
      {defs.map((d, i) => (
        <mesh key={i} geometry={geo} material={mats[i]} position={[d.x, FLOOR_Y + 5.5, -2.4]} rotation-z={d.rz} renderOrder={3} frustumCulled={false} />
      ))}
    </group>
  );
}

/* ─────────── drifting mist layers (swirl away from the cursor) ─────────── */
export function Mist({ count }: { count: number }) {
  const theme = useContext(ThemeContext);
  const shared = useMemo(() => ({ uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } }), []);
  const mats = useMemo(() => Array.from({ length: count }, (_, i) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: SH.MIST_VS, fragmentShader: SH.MIST_FS, uniforms: { ...shared, uOpacity: { value: 0.3 }, uSeed: { value: i * 0.37 } } })), [count, shared]);
  const geo = useMemo(() => new THREE.PlaneGeometry(18, 5), []);
  useEffect(() => () => { geo.dispose(); mats.forEach((m) => m.dispose()); }, [geo, mats]);
  useFrame((s) => {
    shared.uTime.value = heroState.reduced ? 0 : s.clock.elapsedTime;
    shared.uColor.value.copy(theme.ring).multiplyScalar(0.28);
    shared.uPointer.value.set(heroState.pwx, heroState.pwy);
    const o = 0.3 * (1 - choreoNow.inside);
    mats.forEach((m) => (m.uniforms.uOpacity.value = o));
  });
  return (
    <group>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} position={[0, FLOOR_Y + 0.9 + (i % 3) * 0.55, -10 + i * (11 / Math.max(1, count))]} renderOrder={2} frustumCulled={false} />
      ))}
    </group>
  );
}

/* ─────────── anamorphic flare: a horizontal streak that wakes up as you scroll ─────────── */
export function Flares() {
  const theme = useContext(ThemeContext);
  const mat = useMemo(() => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, vertexShader: SH.FLARE_VS, fragmentShader: SH.FLARE_FS, uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0 } } }), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(11, 0.7), []);
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    mat.uniforms.uColor.value.copy(theme.light).multiplyScalar(1.6);
    mat.uniforms.uIntensity.value = (0.1 + heroState.speed * 0.9 + Math.abs(heroState.pointerX) * 0.15 + 0.05 * Math.sin(t * 0.8)) * (1 - choreoNow.inside) * (1 - choreoNow.lineup);
    if (ref.current) ref.current.position.set(heroState.pointerX * 0.8, PODIUM_TOP + 1.15 + heroState.pointerY * 0.15, 0.9);
  });
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={30} frustumCulled={false} />;
}

/* ─────────── liquid-metal orb that swells and melts during every hand-over ─────────── */
export function Mercury() {
  const theme = useContext(ThemeContext);
  const ref = useRef<THREE.Mesh>(null);
  const u = useMemo(() => ({ uMTime: { value: 0 }, uMAmp: { value: 0.3 }, uMFreq: { value: 1.5 } }), []);
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color: '#d9d2c4', metalness: 1, roughness: 0.05, envMapIntensity: 1.7 });
    patchMercury(m, u);
    return m;
  }, [u]);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 32), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const ch = choreoNow;
    u.uMTime.value = heroState.reduced ? 0 : t;
    u.uMAmp.value = 0.22 + ch.mercury * 0.35 + heroState.speed * 0.2;
    mat.color.copy(theme.ring).lerp(CHROME, 0.75);
    const m = ref.current;
    if (!m) return;
    m.visible = ch.inside < 0.5;
    m.scale.setScalar((0.5 + ch.mercury * 0.95) * (1 - ch.lineup * 0.55));
    m.position.set(heroState.pointerX * 0.25, 0.55 + Math.sin(t * 0.5) * 0.06, -3.2);
    m.rotation.y = t * 0.1;
  });
  return <mesh ref={ref} geometry={geo} material={mat} />;
}

/* ─────────── citrus (Zest) + petals (Flova) ─────────── */
const KINDS: CitrusKind[] = ['lemon', 'lime', 'orange', 'lemon', 'lime', 'orange', 'lemon', 'orange', 'lime'];
export function Citrus({ weightRef }: { weightRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const { items, mats, geo } = useMemo(() => {
    const tx = { lemon: makeCitrusTexture('lemon'), lime: makeCitrusTexture('lime'), orange: makeCitrusTexture('orange') };
    const rind: Record<CitrusKind, string> = { lemon: '#e8b81f', lime: '#4a8226', orange: '#e0700c' };
    const mats = KINDS.map((k) => [
      new THREE.MeshStandardMaterial({ color: rind[k], roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ map: tx[k], roughness: 0.28, emissive: '#ffffff', emissiveMap: tx[k], emissiveIntensity: 0.12 }),
      new THREE.MeshStandardMaterial({ map: tx[k], roughness: 0.28 }),
    ]);
    const items = KINDS.map((_, i) => ({ r: 2.5 + (i % 4) * 0.55 + Math.random() * 0.5, a0: (i / KINDS.length) * Math.PI * 2, sp: (0.12 + Math.random() * 0.16) * (i % 2 ? 1 : -1), y: -0.4 + ((i * 0.37) % 1) * 2.8, s: 0.32 + Math.random() * 0.2, rx: Math.random() * 6, ry: Math.random() * 6, sx: 0.25 + Math.random() * 0.4 }));
    return { items, mats, geo: new THREE.CylinderGeometry(1, 1, 0.14, 48) };
  }, []);
  useEffect(() => () => { geo.dispose(); mats.flat().forEach((m) => m.dispose()); }, [geo, mats]);
  useFrame((s) => {
    const g = group.current;
    if (!g) return;
    const w = weightRef.current;
    g.visible = w > 0.01;
    if (!g.visible) return;
    const t = heroState.reduced ? 0 : s.clock.elapsedTime;
    g.children.forEach((c, i) => {
      const it = items[i];
      const a = it.a0 + t * it.sp;
      c.position.set(Math.cos(a) * it.r * 1.15, it.y + Math.sin(t * 0.6 + i) * 0.18, Math.sin(a) * it.r * 0.42 - 1.1);
      c.rotation.set(it.rx + t * it.sx, it.ry + t * it.sx * 0.7, 0.3);
      c.scale.setScalar(it.s * w * w);
    });
  });
  return (
    <group ref={group}>
      {items.map((_, i) => <mesh key={i} material={mats[i]} geometry={geo} />)}
    </group>
  );
}

const PETAL_COLORS = ['#f2c3c9', '#f7dfd6', '#e8a1ad', '#fbe9e3', '#efb4bf'];
export function Petals({ count, weightRef }: { count: number; weightRef: MutableRefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => { const g = new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48); g.scale(1, 1.4, 0.55); return g; }, []);
  const seeds = useMemo(() => Array.from({ length: count }, () => ({ x: rnd(-5.5, 5.5), z: rnd(-2.5, 1.5), y0: rnd(0, 8), v: rnd(0.22, 0.52), sw: rnd(0.3, 0.9), ph: rnd(0, 6.28), r: new THREE.Vector3(rnd(0.4, 2.4), rnd(0.4, 2.4), rnd(0.4, 2.4)), s: rnd(0.6, 1.5) })), [count]);
  const colored = useRef(false);
  useEffect(() => { colored.current = false; return () => geo.dispose(); }, [geo, count]);
  useFrame((st) => {
    const m = ref.current;
    if (!m) return;
    const w = weightRef.current;
    m.visible = w > 0.01;
    if (!m.visible) return;
    if (!colored.current) {
      const c = new THREE.Color();
      seeds.forEach((_, i) => m.setColorAt(i, c.set(PETAL_COLORS[i % PETAL_COLORS.length])));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      colored.current = true;
    }
    const t = heroState.reduced ? 0 : st.clock.elapsedTime;
    seeds.forEach((p, i) => {
      dummy.position.set(p.x + Math.sin(t * p.sw + p.ph) * 0.5, 5.2 - ((p.y0 + t * p.v) % 8), p.z);
      dummy.rotation.set(t * p.r.x + p.ph, t * p.r.y, t * p.r.z);
      dummy.scale.setScalar(p.s * w * w);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false}>
      <meshPhysicalMaterial side={THREE.DoubleSide} roughness={0.45} sheen={1} sheenColor="#ffd9e0" sheenRoughness={0.4} emissive="#ffb6c4" emissiveIntensity={0.1} />
    </instancedMesh>
  );
}

/* ─────────── perfume mist burst ─────────── */
export function Spray({ count, getOrigin }: { count: number; getOrigin: () => THREE.Vector3 | null }) {
  const theme = useContext(ThemeContext);
  const { gl, camera } = useThree();
  const sim = useMemo(() => ({ last: 0, age: new Float32Array(count).fill(99), life: new Float32Array(count), vel: new Float32Array(count * 3), s0: new Float32Array(count) }), [count]);
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: SH.SPRAY_VS, fragmentShader: SH.SPRAY_FS, uniforms: { uScale: { value: 1 }, uColor: { value: new THREE.Color('#fff') } } });
    return { geo: g, mat: m };
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const size = geo.attributes.aSize as THREE.BufferAttribute;
    const alpha = geo.attributes.aAlpha as THREE.BufferAttribute;
    if (heroState.spray !== sim.last) {
      sim.last = heroState.spray;
      const o = getOrigin();
      if (o) {
        for (let i = 0; i < count; i++) {
          sim.age[i] = -Math.random() * 0.3; sim.life[i] = 1.2 + Math.random() * 1.2;
          const dx = -0.95 + (Math.random() - 0.5) * 0.7, dy = 0.2 + (Math.random() - 0.5) * 0.5, dz = 0.45 + (Math.random() - 0.5) * 0.6;
          const l = Math.hypot(dx, dy, dz), sp = 1.4 + Math.random() * 2.6;
          sim.vel[i * 3] = (dx / l) * sp; sim.vel[i * 3 + 1] = (dy / l) * sp; sim.vel[i * 3 + 2] = (dz / l) * sp;
          sim.s0[i] = 0.16 + Math.random() * 0.2;
          pos.setXYZ(i, o.x, o.y, o.z);
        }
      }
    }
    for (let i = 0; i < count; i++) {
      sim.age[i] += dt;
      const a = sim.age[i];
      if (a < 0 || a > sim.life[i]) { alpha.setX(i, 0); continue; }
      const t = a / sim.life[i];
      const drag = Math.exp(-1.9 * dt);
      sim.vel[i * 3] *= drag; sim.vel[i * 3 + 1] = sim.vel[i * 3 + 1] * drag + 0.12 * dt; sim.vel[i * 3 + 2] *= drag;
      pos.setXYZ(i, pos.getX(i) + sim.vel[i * 3] * dt, pos.getY(i) + sim.vel[i * 3 + 1] * dt, pos.getZ(i) + sim.vel[i * 3 + 2] * dt);
      size.setX(i, sim.s0[i] + t * 1.2);
      alpha.setX(i, Math.pow(1 - t, 1.7) * clamp(a * 7) * 0.17);
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
    mat.uniforms.uScale.value = pxScale(gl, camera);
    (mat.uniforms.uColor.value as THREE.Color).set('#ffffff').lerp(theme.light, 0.35);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />;
}
