import test from 'node:test';
import assert from 'node:assert/strict';
import { choreograph, lineupTarget } from '../src/lib/3d/choreo';
import { Governor } from '../src/lib/3d/quality';
import { TIMELINE, late } from '../src/components/hero/hero-state';
import { CHAPTER_SLUGS } from '../src/components/hero/chapters';

const copy = <T,>(a: T[]) => [...a];

test('choreography is continuous: no pops in camera, fov, fog or dissolve across the whole scroll (phone + desktop)', () => {
  for (const portrait of [false, true]) {
    let prev: ReturnType<typeof snap> | null = null;
    const snap = (c: ReturnType<typeof choreograph>) => ({ z: c.cam.z, y: c.cam.y, fov: c.cam.fov, look: c.cam.lookY, fog: c.inside, dis: copy(c.dissolve) });
    for (let k = 0; k <= 4000; k++) {
      const c = choreograph(k / 4000, 1, portrait, false);
      c.dissolve.forEach((d) => assert.ok(d >= -1e-9 && d <= 1 + 1e-9));
      const s = snap(c);
      if (prev) {
        assert.ok(Math.abs(s.z - prev.z) < 0.3, `z jump at ${k / 4000}`);
        assert.ok(Math.abs(s.fov - prev.fov) < 1.2, 'fov jump');
        assert.ok(Math.abs(s.fog - prev.fog) < 0.25, `fog jump at ${k / 4000}`);
        s.dis.forEach((d, i) => assert.ok(Math.abs(d - prev!.dis[i]) < 0.25, `dissolve jump bottle ${i} at ${k / 4000}`));
      }
      prev = s;
    }
  }
});

test('the line-up layout swap happens while every bottle is dissolved and the fog is full', () => {
  for (let p = late(0.834); p <= late(0.844); p += 0.0002 / 1.16) {
    const c = choreograph(p, 1, false, false);
    assert.ok(Math.min(...c.dissolve) > 0.999, `bottle visible at p=${p}`);
    assert.ok(c.inside > 0.9, `fog too thin at p=${p}`);
  }
});

test('exactly one bottle is solid at each chapter centre; none while intro has not started', () => {
  TIMELINE.centers.forEach((p, i) => {
    const c = choreograph(p, 1, false, false);
    c.dissolve.forEach((d, j) => (j === i ? assert.ok(d < 0.01) : assert.ok(d > 0.99)));
    assert.equal(c.morph.active, false);
  });
  assert.deepEqual(copy(choreograph(0, 0, false, false).dissolve).map(Math.round), CHAPTER_SLUGS.map(() => 1));
});

test('reduced motion: no particle morph', () => assert.equal(choreograph(0.3, 0.5, false, true).morph.active, false));

test('governor drops under sustained slow frames, recovers once, and does not oscillate', () => {
  let g = new Governor(3), changes: number[] = [];
  for (let i = 0; i < 400; i++) { const r = g.update(1 / 24); if (r !== null) changes.push(r); }
  assert.deepEqual(changes.slice(0, 2), [2, 1]);
  g = new Governor(2); changes = [];
  for (let i = 0; i < 1200; i++) { const r = g.update(1 / 60); if (r !== null) changes.push(r); }
  assert.deepEqual(changes, [3]);
  g = new Governor(3); let flips = 0;
  for (let r = 0; r < 20; r++) { for (let i = 0; i < 200; i++) if (g.update(1 / 20) !== null) flips++; for (let i = 0; i < 900; i++) if (g.update(1 / 60) !== null) flips++; }
  assert.ok(flips <= 6, `oscillated ${flips} times`);
});

test('five chapters, Mira third; every beat keeps the scroll length it had with four', () => {
  assert.deepEqual([...CHAPTER_SLUGS], ['cyrus', 'nova', 'mira', 'zest', 'flova']);
  assert.equal(TIMELINE.centers.length, 5);
  const K = 1.16; // total length vs. the four-chapter hero
  const base = [0.22, 0.38, 0.54, 0.7];
  base.forEach((b, i) => assert.ok(Math.abs(TIMELINE.centers[i] * K - b) < 1e-9));
  assert.ok(Math.abs(TIMELINE.centers[4] * K - 0.86) < 1e-9);
  assert.ok(Math.abs((TIMELINE.diveEnd - TIMELINE.diveStart) * K - 0.065) < 1e-9);
});

test('line-up: five distinct bottles that fit on landscape and portrait screens', () => {
  for (const aspect of [1.33, 1.6, 1.78, 2.2]) {
    const xs = [0, 1, 2, 3, 4].map((j) => lineupTarget(j, false, [0, 0, 0, 1], aspect)[0]);
    xs.forEach((x, i) => i && assert.ok(x - xs[i - 1] > 0.9));
    const half = Math.tan((15 * Math.PI) / 180) * 10.6 * aspect;
    assert.ok(Math.max(...xs.map(Math.abs)) + 0.4 < half, `clipped at aspect ${aspect}`);
  }
  const pts = [0, 1, 2, 3, 4].map((j) => lineupTarget(j, true).slice(0, 3).join());
  assert.equal(new Set(pts).size, 5);
});
