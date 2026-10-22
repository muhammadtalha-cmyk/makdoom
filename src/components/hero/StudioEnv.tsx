'use client';
import * as THREE from 'three';
import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * A photographer's studio baked into an environment map once, synchronously, at mount.
 * (The previous drei <Environment frames={1}> captured on the first rendered frame, which raced with the frame loop
 * and sometimes produced dull glass: the "shade changes between reloads" bug.)
 * Softboxes are HDR emissive planes, so glass edges pick up crisp, bright highlights.
 */
export default function StudioEnv({ intensity = 0.95 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const env = new THREE.Scene();
    const disposables: { dispose(): void }[] = [];
    const add = (geo: THREE.BufferGeometry, color: string, power: number, pos: [number, number, number], side: THREE.Side = THREE.DoubleSide) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side, toneMapped: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
      disposables.push(geo, mat);
      return m;
    };
    add(new THREE.SphereGeometry(40, 24, 16), '#070605', 1, [0, 0, 0], THREE.BackSide); // dark dome
    add(new THREE.PlaneGeometry(1.6, 9), '#fff3dc', 5.5, [-5, 2.5, 3]);
    add(new THREE.PlaneGeometry(1.1, 9), '#ffe0ac', 4.5, [5, 2, 3]);
    add(new THREE.PlaneGeometry(9, 6), '#ffffff', 3, [0, 7, 1]);
    add(new THREE.RingGeometry(3.4, 7, 64), '#ffd9a0', 5, [0, 1, -7]);
    add(new THREE.PlaneGeometry(12, 2.2), '#ffffff', 1.6, [0, 0.5, 9]);

    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(env, 0.02);
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      disposables.forEach((d) => d.dispose());
    };
  }, [gl, scene, intensity]);
  return null;
}
