import * as THREE from 'three';

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeSoftCircleTexture(size = 128) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c);
}

/** Out-of-focus lens disc: brighter rim, soft centre — what a real lens does to a point light. */
export function makeBokehTexture(size = 128) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.35)');
  gr.addColorStop(0.72, 'rgba(255,255,255,.5)');
  gr.addColorStop(0.9, 'rgba(255,255,255,.95)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c);
}

/** Vertical gradient multiplied onto the perfume liquid: lighter near the surface, deeper at the base. */
export function makeLiquidGradient() {
  const c = canvas(8, 256);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.45, '#efe4cb');
  gr.addColorStop(1, '#8c7650');
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 256);
  return tex(c);
}

export type CitrusKind = 'lemon' | 'lime' | 'orange';
const CITRUS: Record<CitrusKind, { rind: string; pith: string; flesh: string; fleshEdge: string }> = {
  lemon: { rind: '#f1c52c', pith: '#fff6c8', flesh: '#fbe773', fleshEdge: '#f0c93c' },
  lime: { rind: '#4f8a2a', pith: '#f1f7cf', flesh: '#c9e36a', fleshEdge: '#94bf3a' },
  orange: { rind: '#ee7d12', pith: '#ffeccc', flesh: '#ffb23a', fleshEdge: '#f28a14' },
};

/** Cross-section of a citrus fruit, drawn procedurally (rind, pith, wedges, juice highlights). */
export function makeCitrusTexture(kind: CitrusKind) {
  const S = 512;
  const R = S / 2;
  const c = canvas(S);
  const g = c.getContext('2d')!;
  const col = CITRUS[kind];
  const disc = (r: number, fill: string) => {
    g.beginPath();
    g.arc(R, R, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  disc(R - 2, col.rind);
  disc(R - 22, col.pith);
  const n = kind === 'orange' ? 10 : 9;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 + 0.045;
    const a1 = ((k + 1) / n) * Math.PI * 2 - 0.045;
    const gr = g.createRadialGradient(R, R, 20, R, R, R - 36);
    gr.addColorStop(0, col.flesh);
    gr.addColorStop(1, col.fleshEdge);
    g.beginPath();
    g.moveTo(R + Math.cos((a0 + a1) / 2) * 20, R + Math.sin((a0 + a1) / 2) * 20);
    g.arc(R, R, R - 38, a0, a1);
    g.closePath();
    g.fillStyle = gr;
    g.fill();
    // juice vesicles
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    for (let v = 0; v < 7; v++) {
      const aa = a0 + (a1 - a0) * (0.15 + Math.random() * 0.7);
      const r0 = 40 + Math.random() * (R - 120);
      g.beginPath();
      g.moveTo(R + Math.cos(aa) * r0, R + Math.sin(aa) * r0);
      g.lineTo(R + Math.cos(aa) * (r0 + 26 + Math.random() * 30), R + Math.sin(aa) * (r0 + 26 + Math.random() * 30));
      g.stroke();
    }
  }
  disc(16, col.pith);
  // sheen
  const sh = g.createLinearGradient(0, 0, S, S);
  sh.addColorStop(0, 'rgba(255,255,255,.35)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sh;
  g.fillRect(0, 0, S, S);
  return tex(c);
}

const imgCache: Record<string, Promise<HTMLImageElement>> = {};
const loadImg = (src: string) =>
  (imgCache[src] ??= new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  }));

/** Paints the printed front label: Makhdoom gold lock-up on top, the fragrance name in black below (like the real bottles). */
export type LabelStyle = 'block' | 'marker' | 'brush';
/** Mira's real bottle has a black brush-script name in mixed case; Zest a marker, the rest bold block capitals. */
const LABEL_STYLE: Record<string, LabelStyle> = { zest: 'marker', mira: 'brush' };

export async function drawLabel(cv: HTMLCanvasElement, name: string, style: LabelStyle) {
  const script = style !== 'block';
  const g = cv.getContext('2d')!;
  const W = cv.width;
  const H = cv.height;
  const logoP = loadImg('/images/brand/logo-lockup-640.webp').catch(() => null); // fetched in parallel with the font
  try {
    // load only the face this label uses (the old code fetched all three fonts for every label before anything could show)
    const face = style === 'brush' ? '400 160px "Kaushan Script"' : style === 'marker' ? '400 160px "Permanent Marker"' : '900 160px "Montserrat Variable"';
    await Promise.race([document.fonts.load(face), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* fonts are optional: fall back to system faces */
  }
  const logo: HTMLImageElement | null = await logoP;
  g.clearRect(0, 0, W, H);
  if (logo) {
    const lw = 640;
    const lh = (lw * logo.height) / logo.width;
    g.drawImage(logo, (W - lw) / 2, 60, lw, lh);
  }
  const text = style === 'brush' ? name : name.toUpperCase();
  const family = style === 'brush' ? '"Kaushan Script", "Brush Script MT", cursive' : script ? '"Permanent Marker", "Brush Script MT", cursive' : '"Montserrat Variable", Montserrat, "Arial Black", sans-serif';
  const weight = script ? '400' : '900';
  let size = style === 'brush' ? 330 : script ? 240 : 210;
  g.font = `${weight} ${size}px ${family}`;
  const maxW = W * 0.78;
  const w = g.measureText(text).width;
  if (w > maxW) {
    size *= maxW / w;
    g.font = `${weight} ${size}px ${family}`;
  }
  g.fillStyle = '#040404';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.save();
  g.translate(W / 2, H * 0.83);
  if (style === 'marker') g.transform(1, 0, -0.2, 1, 0, 0);
  g.fillText(text, 0, 0);
  g.restore();
}

/** One printed-label texture per fragrance, shared by the hero and the product viewer. `ready` resolves when fonts + logo are painted. */
const labels = new Map<string, { tex: THREE.CanvasTexture; ready: Promise<void> }>();
export function getLabel(slug: string, name: string) {
  let l = labels.get(slug);
  if (!l) {
    const cv = canvas(1024, 1000);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const ready = drawLabel(cv, name, LABEL_STYLE[slug] ?? 'block').then(() => {
      tex.needsUpdate = true;
    });
    l = { tex, ready };
    labels.set(slug, l);
  }
  return l;
}
