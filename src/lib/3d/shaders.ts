/* eslint-disable */
/**
 * Every custom GLSL program of the hero. Kept in one file so it can be compile-tested in a real WebGL2 context
 * (tests/shaders.html) without loading the whole app. All materials include tonemapping/colorspace chunks so they
 * are correct both with the post-processing chain and on the plain-renderer "lite" tier.
 */

import { CHAPTER_SLUGS } from '../../components/hero/chapters';
/** Number of bottles in the hero: sizes the GLSL arrays below, so adding a chapter needs no shader edits. */
export const BOTTLE_COUNT = CHAPTER_SLUGS.length;

/** Value noise, fbm and a divergence-free curl field. Shared by every shader that needs organic motion. */
export const NOISE = /* glsl */ `
float mkHash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float mkNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(mkHash(i+vec3(0.0,0.0,0.0)), mkHash(i+vec3(1.0,0.0,0.0)), f.x),
                 mix(mkHash(i+vec3(0.0,1.0,0.0)), mkHash(i+vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(mkHash(i+vec3(0.0,0.0,1.0)), mkHash(i+vec3(1.0,0.0,1.0)), f.x),
                 mix(mkHash(i+vec3(0.0,1.0,1.0)), mkHash(i+vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}
float mkFbm(vec3 p){
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 4; i++){ s += a*mkNoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; }
  return s;
}
vec3 mkVec(vec3 p){ return vec3(mkNoise(p), mkNoise(p+vec3(31.4,17.2,5.9)), mkNoise(p+vec3(11.7,43.1,23.3))) - 0.5; }
vec3 mkCurl(vec3 p){
  float e = 0.1;
  vec3 dx = vec3(e,0.0,0.0); vec3 dy = vec3(0.0,e,0.0); vec3 dz = vec3(0.0,0.0,e);
  vec3 x0 = mkVec(p-dx); vec3 x1 = mkVec(p+dx);
  vec3 y0 = mkVec(p-dy); vec3 y1 = mkVec(p+dy);
  vec3 z0 = mkVec(p-dz); vec3 z1 = mkVec(p+dz);
  return normalize(vec3(y1.z-y0.z-z1.y+z0.y, z1.x-z0.x-x1.z+x0.z, x1.y-x0.y-y1.x+y0.x) + 1e-5);
}
`;

const TAIL = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/* ───────────────────────────── gold dust that reacts to the cursor ───────────────────────────── */
export const DUST_VS = /* glsl */ `
uniform float uTime; uniform float uScale; uniform vec2 uPointer; uniform float uPointerAmt; uniform float uSpeed;
attribute float aSeed; attribute float aSize; attribute float aSpeed;
varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime*aSpeed + 3.0, 8.0) - 3.0;
  p.x += sin(uTime*0.25 + aSeed*6.2831)*0.35;
  p.z += cos(uTime*0.2 + aSeed*12.0)*0.25;
  vec2 d = p.xy - uPointer;
  float r = length(d);
  p.xy += (d/(r+0.001)) * exp(-r*1.1) * 0.9 * uPointerAmt;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = max(1.0, aSize*0.035*uScale/(-mv.z) * (1.0 + uSpeed*1.4));
  vA = 0.3 + 0.7*(0.5+0.5*sin(uTime*(1.0+aSeed*2.0)+aSeed*40.0));
}`;
export const DUST_FS = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main(){
  float d = length(gl_PointCoord-0.5);
  float a = smoothstep(0.5,0.0,d); a *= a;
  gl_FragColor = vec4(uColor*2.2, a*vA);
${TAIL}}`;

/* ───────────────────────────── perfume mist (spray burst) ───────────────────────────── */
export const SPRAY_VS = /* glsl */ `
uniform float uScale; attribute float aSize; attribute float aAlpha; varying float vA;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.0, aSize*uScale/(-mv.z)); vA = aAlpha; }`;
export const SPRAY_FS = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.05,d); gl_FragColor = vec4(uColor, a*a*vA);
${TAIL}}`;

/* ───────────────────────────── GPU dissolve / morph particles ─────────────────────────────
   Each particle owns a point on a bottle's surface (aLocal). uFrom/uTo hold the bottle anchors (xyz + scale),
   so the same cloud can: gather into one bottle (intro), swirl out of one and into the next (chapter hand-over),
   or fly from the centre into the line-up (finale). Everything runs in the vertex shader. */
export const MORPH_VS = /* glsl */ `
attribute vec3 aLocal; attribute vec4 aRand;
uniform float uT; uniform float uMode; uniform float uTime; uniform float uScale; uniform float uSpeed;
uniform vec4 uFrom[${BOTTLE_COUNT}]; uniform vec4 uTo[${BOTTLE_COUNT}]; uniform vec3 uColA; uniform vec3 uColB;
varying vec3 vCol; varying float vA;
${NOISE}
void main(){
  int g = int(aRand.z + 0.5);
  vec4 f = uFrom[g]; vec4 t = uTo[g];
  float e = clamp((uT - aRand.x*0.45)/0.55, 0.0, 1.0);
  float ee = e*e*(3.0-2.0*e);
  vec3 pf = f.xyz + aLocal*f.w;
  vec3 pt = t.xyz + aLocal*t.w;
  vec3 base = mix(pf, pt, ee);
  float sc = mix(sin(3.14159265*e), 1.0-ee, uMode);
  vec3 flow = mkCurl(base*0.7 + vec3(0.0, uTime*0.25, aRand.w*10.0));
  base += flow * sc * (0.9 + aRand.y*1.6);
  base.y += sc * 0.8 * aRand.y;
  vec4 mv = modelViewMatrix*vec4(base,1.0);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = max(1.0, (1.0+aRand.y*2.0)*uScale*0.012/(-mv.z)*(0.35+0.65*sc)*(1.0+uSpeed));
  vA = smoothstep(0.02,0.3,sc) * (0.65+0.35*sin(uTime*3.0+aRand.w*40.0));
  vCol = mix(uColA, uColB, ee);
}`;
export const MORPH_FS = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){
  float d = length(gl_PointCoord-0.5);
  float a = smoothstep(0.5,0.0,d); a *= a;
  gl_FragColor = vec4(vCol*2.4, a*vA);
${TAIL}}`;

/* ───────────────────────────── liquid inside the bottle ───────────────────────────── */
export const LIQUID_VS = /* glsl */ `
uniform float uTime; uniform float uSlosh;
varying vec3 vN; varying vec3 vW; varying vec3 vObj;
void main(){
  vec3 p = position;
  float top = smoothstep(0.25, 0.41, p.y);
  p.y += top * uSlosh * 0.04 * sin(p.x*5.0 + uTime*3.0);
  vObj = position;
  vec4 wp = modelMatrix*vec4(p,1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
export const LIQUID_FS = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uDissolve; uniform vec3 uEdge; uniform float uSeed; uniform float uGlow;
varying vec3 vN; varying vec3 vW; varying vec3 vObj;
${NOISE}
void main(){
  float n = mkFbm(vObj*2.4 + uSeed);
  float thr = uDissolve*1.08 - 0.04;
  if (n < thr) discard;
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  float fres = pow(1.0 - max(dot(N,V),0.0), 2.5);
  float h = clamp((vObj.y + 0.41)/0.82, 0.0, 1.0);
  vec3 col = mix(uColor*vec3(0.55,0.45,0.35), uColor*1.15, h);
  // light bending through the liquid: slow bright bands that drift with the viewing angle
  float band = mkFbm(vec3(vObj.x*3.0 + V.x*1.6, vObj.y*2.0 - uTime*0.15, vObj.z*3.0 + V.z*1.6));
  col *= 0.75 + 0.55*band;
  float caus = pow(max(0.0, sin(vObj.x*9.0 + band*5.0) * sin(vObj.y*7.0 - uTime*0.4 + band*4.0)), 6.0);
  col += uColor*caus*0.7;
  // tiny bubbles rising through the perfume
  vec3 bp = vObj*vec3(14.0,10.0,14.0) - vec3(0.0, uTime*0.6, 0.0);
  float hb = mkHash(floor(bp));
  float bub = step(0.965, hb) * smoothstep(0.22, 0.0, length(fract(bp)-0.5));
  col += vec3(1.0,0.95,0.8)*bub*1.2;
  col += uColor*fres*0.9;
  col *= uGlow;
  col += uEdge * smoothstep(thr+0.09, thr, n) * step(0.001, uDissolve) * 5.0;
  gl_FragColor = vec4(col, 1.0);
${TAIL}}`;

/* ───────────────────────────── wet black marble floor ─────────────────────────────
   No render-to-texture mirror (that was the flaky MeshReflectorMaterial). The bottles are boxes, so their reflection
   is an analytic ray/box test per pixel: sharp near the base, fading with distance, softened by micro-normal jitter. */
export const FLOOR_VS = /* glsl */ `
varying vec3 vW;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;
export const FLOOR_FS = /* glsl */ `
#ifndef TAPS
#define TAPS 2
#endif
uniform vec3 uRing; uniform vec3 uLiquid; uniform vec4 uBox[${BOTTLE_COUNT}]; uniform float uPlaneY; uniform float uTime; uniform float uCaustic;
varying vec3 vW;
${NOISE}
bool mkAabb(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out float tn, out vec3 nrm){
  vec3 inv = 1.0/rd;
  vec3 t0 = (bmin-ro)*inv; vec3 t1 = (bmax-ro)*inv;
  vec3 tmin = min(t0,t1); vec3 tmax = max(t0,t1);
  float a = max(max(tmin.x,tmin.y),tmin.z);
  float b = min(min(tmax.x,tmax.y),tmax.z);
  if (b < max(a,0.0)) return false;
  tn = max(a,0.0);
  nrm = (a == tmin.x) ? vec3(-sign(rd.x),0.0,0.0) : ((a == tmin.y) ? vec3(0.0,-sign(rd.y),0.0) : vec3(0.0,0.0,-sign(rd.z)));
  return true;
}
vec3 mkBoxCol(vec3 hit, vec3 n, vec4 box, int part){
  float s = box.z;
  vec3 l = (hit - vec3(box.x, uPlaneY, box.y))/s;
  if (part == 1) return vec3(0.025) + vec3(0.5,0.45,0.35)*smoothstep(0.17,0.215,abs(l.x))*0.4;
  vec3 col = uLiquid*(0.5 + 0.5*clamp(l.y/1.25,0.0,1.0))*1.1;
  if (n.z > 0.5 && abs(l.x) < 0.42 && l.y > 0.12 && l.y < 1.05) col = mix(col, vec3(0.93,0.86,0.62), 0.5);
  col += vec3(1.0,0.93,0.8)*smoothstep(0.43,0.5,abs(l.x))*0.5;
  return col;
}
vec3 mkEnv(vec3 rd, vec3 P){
  vec3 e = vec3(0.0);
  // the gallery's pillar light-strips mirrored in the floor
  for (int k = 0; k < 2; k++){
    float xs = (k == 0) ? -5.92 : 5.92;
    float t = (xs - P.x)/rd.x;
    if (t > 0.0){
      vec3 h = P + rd*t;
      float idx = floor((-2.36 - h.z)/4.2 + 0.5);
      if (idx >= 0.0 && idx < 9.0 && h.y > -1.0 && h.y < 7.6){
        float dz = h.z - (-2.36 - idx*4.2);
        e += uRing * 1.5 * smoothstep(0.12, 0.0, abs(dz)) * exp(-t*0.06);
      }
    }
  }
  // the light at the far end of the hall
  e += uRing * pow(max(dot(rd, normalize(vec3(0.0,0.1,-1.0))), 0.0), 420.0) * 0.7;
  return e;
}
void main(){
  vec3 P = vW;
  vec3 V = normalize(P - cameraPosition);
  vec2 q = P.xz*0.35;
  float veins = mkFbm(vec3(q*vec2(1.0,2.2) + mkFbm(vec3(q*1.7,1.0))*1.4, 2.0));
  float vein = smoothstep(0.52,0.56,veins)*(1.0-smoothstep(0.56,0.62,veins));
  vec3 col = vec3(0.012,0.011,0.010) + vein*vec3(0.032,0.027,0.019);
  float F = 0.06 + 0.94*pow(1.0 - clamp(-V.y, 0.0, 1.0), 4.0);
  F = clamp(F*0.9 + 0.1, 0.0, 1.0);
  vec3 rd0 = normalize(vec3(V.x, -V.y, V.z));
  vec3 ro = vec3(P.x, uPlaneY, P.z);
  vec3 bottles = vec3(0.0);
  for (int k = 0; k < TAPS; k++){
    vec3 jit = (vec3(mkNoise(P*7.0 + float(k)*13.1), 0.5, mkNoise(P*7.0 + 31.7 + float(k)*7.3)) - 0.5) * 0.05;
    vec3 rd = normalize(rd0 + jit);
    float tBest = 1e9; vec3 cBest = vec3(0.0); float aBest = 0.0;
    for (int b = 0; b < ${BOTTLE_COUNT}; b++){
      vec4 bx = uBox[b];
      if (bx.w < 0.01) continue;
      float s = bx.z;
      vec3 c = vec3(bx.x, uPlaneY, bx.y);
      float tn; vec3 nn;
      if (mkAabb(ro, rd, c + vec3(-0.5*s, 0.0, -0.31*s), c + vec3(0.5*s, 1.25*s, 0.31*s), tn, nn) && tn < tBest){
        tBest = tn; cBest = mkBoxCol(ro + rd*tn, nn, bx, 0); aBest = bx.w;
      }
      if (mkAabb(ro, rd, c + vec3(-0.215*s, 1.25*s, -0.215*s), c + vec3(0.215*s, 1.87*s, 0.215*s), tn, nn) && tn < tBest){
        tBest = tn; cBest = mkBoxCol(ro + rd*tn, nn, bx, 1); aBest = bx.w;
      }
    }
    if (tBest < 1e8) bottles += cBest * aBest * exp(-tBest*0.28);
  }
  bottles /= float(TAPS);
  col += mkEnv(rd0, P) * F * 0.9;
  col += bottles * F * 1.15;
  // pool of light and caustics thrown by the perfume
  for (int b = 0; b < ${BOTTLE_COUNT}; b++){
    vec4 bx = uBox[b];
    if (bx.w < 0.01) continue;
    float d = length(P.xz - bx.xy);
    float pool = exp(-d*d/(1.6*bx.z*bx.z)) * bx.w;
    float ca = pow(max(0.0, 0.5 + 0.5*sin(d*9.0 - uTime*0.8 + mkNoise(vec3(P.xz*2.0, uTime*0.2))*5.0)), 8.0) * exp(-d*0.9) * uCaustic * bx.w;
    col += uLiquid*pool*0.28 + uLiquid*ca*0.5;
  }
  float dist = length(P - cameraPosition);
  col = mix(col, vec3(0.012,0.011,0.010), smoothstep(16.0, 52.0, dist));
  gl_FragColor = vec4(col, 1.0);
${TAIL}}`;

/* ───────────────────────────── volumetric light shafts ───────────────────────────── */
export const SHAFT_VS = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`;
export const SHAFT_FS = /* glsl */ `
uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
${NOISE}
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float core = pow(abs(dot(normalize(vN), V)), 1.6);
  float along = smoothstep(0.0, 1.0, vUv.y) * (1.0 - smoothstep(0.93, 1.0, vUv.y));
  float haze = 0.55 + 0.9*mkFbm(vec3(vW.xz*0.6, vW.y*0.3 - uTime*0.08));
  float a = core*along*haze*uIntensity;
  gl_FragColor = vec4(uColor, a);
${TAIL}}`;

/* ───────────────────────────── drifting mist layers ───────────────────────────── */
export const MIST_VS = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;
export const MIST_FS = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform vec2 uPointer; uniform float uSeed;
varying vec2 vUv; varying vec3 vW;
${NOISE}
void main(){
  vec2 pp = vW.xy - uPointer;
  float push = exp(-dot(pp,pp)*0.35);
  vec2 dir = pp / (length(pp) + 1e-3);
  vec3 q = vec3(vUv*vec2(3.0,1.4) + vec2(uTime*0.02*(1.0+uSeed), 0.0) + dir*push*0.18, uTime*0.03 + uSeed*10.0);
  float n = mkFbm(q*1.6);
  float a = smoothstep(0.38, 0.85, n) * smoothstep(0.0,0.25,vUv.x) * smoothstep(1.0,0.75,vUv.x) * smoothstep(0.0,0.35,vUv.y) * smoothstep(1.0,0.5,vUv.y);
  gl_FragColor = vec4(uColor, a*uOpacity);
${TAIL}}`;

/* ───────────────────────────── anamorphic lens flare streak ───────────────────────────── */
export const FLARE_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const FLARE_FS = /* glsl */ `
uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
void main(){
  vec2 p = vUv*2.0 - 1.0;
  float core = exp(-abs(p.x)*3.2) * exp(-p.y*p.y*260.0);
  float halo = exp(-dot(p*vec2(1.0,6.0), p*vec2(1.0,6.0))*2.2)*0.25;
  float a = (core + halo)*uIntensity;
  gl_FragColor = vec4(uColor, a);
${TAIL}}`;

/* ───────────────────────────── material patches (injected into MeshStandard/Physical) ─────────────────────────────
   Dissolve with a glowing edge for every bottle part, and for the glass: micro-scratches, finger smudges and
   condensation droplets that bend the refracted light. Patching is skipped on the lite tier. */
export const PATCH_VERT_DECL = /* glsl */ `
varying vec3 vMkPos; varying vec3 vMkX; varying vec3 vMkY; varying vec3 vMkZ; uniform vec3 uMkOff;
`;
export const PATCH_VERT_BODY = /* glsl */ `
vMkPos = position + uMkOff;
vMkX = normalize(normalMatrix*vec3(1.0,0.0,0.0));
vMkY = normalize(normalMatrix*vec3(0.0,1.0,0.0));
vMkZ = normalize(normalMatrix*vec3(0.0,0.0,1.0));
`;
export const PATCH_FRAG_DECL = /* glsl */ `
varying vec3 vMkPos; varying vec3 vMkX; varying vec3 vMkY; varying vec3 vMkZ;
uniform float uDissolve; uniform vec3 uEdge; uniform float uSeed; uniform float uCond; uniform float uScratch; uniform float uSmudge;
${NOISE}
float mkScratch(vec3 p){
  float s = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec3 d = normalize(vec3(sin(fi*2.1+1.0), cos(fi*1.7+0.3), sin(fi*3.3+0.7)));
    float t = dot(p, d)*(15.0 + fi*9.0) + mkNoise(p*3.0 + fi*7.0)*2.5;
    float line = 1.0 - smoothstep(0.0, 0.05, abs(fract(t) - 0.5));
    float mask = smoothstep(0.62, 0.82, mkNoise(p*2.2 + fi*11.0));
    s += line*mask;
  }
  return clamp(s, 0.0, 1.0);
}
// condensation: xyz = bump in object space, w = droplet mask
vec4 mkDrops(vec3 p, float amount){
  vec3 a = abs(p / vec3(0.5, 0.625, 0.31));
  vec2 uv; vec3 ax; vec3 ay;
  if (a.z >= a.x && a.z >= a.y){ uv = p.xy; ax = vec3(1.0,0.0,0.0); ay = vec3(0.0,1.0,0.0); }
  else if (a.x >= a.y){ uv = p.zy; ax = vec3(0.0,0.0,1.0); ay = vec3(0.0,1.0,0.0); }
  else { uv = p.xz; ax = vec3(1.0,0.0,0.0); ay = vec3(0.0,0.0,1.0); }
  vec2 g = uv*13.0;
  vec2 id = floor(g); vec2 f = fract(g);
  float h1 = mkHash(vec3(id, 3.0)); float h2 = mkHash(vec3(id, 9.0)); float h3 = mkHash(vec3(id, 17.0));
  vec2 c = vec2(0.25 + 0.5*h1, 0.25 + 0.5*h2);
  float r = 0.1 + 0.2*h3;
  float exists = step(1.0 - amount*0.5, mkHash(vec3(id, 31.0)));
  vec2 dv = f - c;
  float m = smoothstep(r, r*0.25, length(dv)) * exists;
  vec2 b = dv/r * m;
  return vec4(ax*b.x + ay*b.y, m);
}
`;
export const PATCH_FRAG_DISSOLVE = /* glsl */ `
float mkDn = mkFbm(vMkPos*2.4 + uSeed);
float mkThr = uDissolve*1.08 - 0.04;
if (mkDn < mkThr) discard;
`;
export const PATCH_FRAG_EDGE = /* glsl */ `
totalEmissiveRadiance += uEdge * smoothstep(mkThr + 0.09, mkThr, mkDn) * step(0.001, uDissolve) * 5.0;
`;
export const PATCH_FRAG_GLASS_ROUGH = /* glsl */ `
vec4 mkD = mkDrops(vMkPos, uCond);
vec3 mkBv = mkD.x*vMkX + mkD.y*vMkY + mkD.z*vMkZ;
roughnessFactor = clamp(roughnessFactor + mkNoise(vMkPos*6.0)*uSmudge + mkScratch(vMkPos)*uScratch + mkD.w*0.35*uCond, 0.0, 1.0);
`;
export const PATCH_FRAG_GLASS_NORMAL = /* glsl */ `
normal = normalize(normal + mkBv*0.85);
`;
export const PATCH_FRAG_GLASS_CLEARCOAT = /* glsl */ `
clearcoatNormal = normalize(clearcoatNormal + mkBv*0.5);
`;

/* ───────────────────────────── liquid-metal orb: noise-displaced sphere with analytic normals ───────────────────────────── */
export const MERCURY_VERT_DECL = /* glsl */ `
uniform float uMTime; uniform float uMAmp; uniform float uMFreq;
${NOISE}
vec3 mkSp(vec3 n){ float d = mkFbm(n*uMFreq + vec3(0.0, uMTime*0.35, uMTime*0.2)); return n*(1.0 + uMAmp*(d - 0.45)); }
`;
export const MERCURY_BEGIN_NORMAL = /* glsl */ `
vec3 mkN = normalize(position);
vec3 mkT = normalize(cross(mkN, abs(mkN.y) > 0.99 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0)));
vec3 mkB = cross(mkN, mkT);
vec3 mkP0 = mkSp(mkN);
vec3 mkP1 = mkSp(normalize(mkN + mkT*0.02));
vec3 mkP2 = mkSp(normalize(mkN + mkB*0.02));
vec3 objectNormal = normalize(cross(mkP1 - mkP0, mkP2 - mkP0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;
export const MERCURY_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = mkP0;
`;

/* ───────────────────────────── cinematic post pass (postprocessing Effect) ─────────────────────────────
   Velocity-driven RGB split, barrel lens, refraction burst when the camera crosses the glass, the golden "inside the
   perfume" volume (haze, light shafts, rising bubbles), film grain and vignette. One pass, one texture-read trio. */
export const CINEMA_FS = /* glsl */ `
uniform float uTime; uniform float uSpeed; uniform float uFog; uniform float uBurst; uniform float uGrain; uniform float uCA; uniform float uAspect;
uniform vec3 uFogColor; uniform vec3 uFogColor2;
float cmHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float cmNoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(cmHash(i), cmHash(i+vec2(1.0,0.0)), f.x), mix(cmHash(i+vec2(0.0,1.0)), cmHash(i+vec2(1.0,1.0)), f.x), f.y); }
float cmFbm(vec2 p){ float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++){ s += a*cmNoise(p); p = p*2.02 + 7.3; a *= 0.5; } return s; }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 c = uv - 0.5;
  vec2 ca2 = c*vec2(uAspect, 1.0);
  float r2 = dot(ca2, ca2);
  float k = 0.05 + uBurst*0.4 + uSpeed*0.05;
  vec2 duv = clamp(c*(1.0 + k*r2) + 0.5, 0.001, 0.999);
  float ca = (uCA + uSpeed*0.012 + uBurst*0.03) * (0.4 + 3.2*r2);
  vec2 dir = c / (length(c) + 1e-5);
  vec3 col;
  col.r = texture2D(inputBuffer, clamp(duv + dir*ca, 0.001, 0.999)).r;
  col.g = texture2D(inputBuffer, duv).g;
  col.b = texture2D(inputBuffer, clamp(duv - dir*ca, 0.001, 0.999)).b;
  if (uFog > 0.001){
    vec2 p = uv*vec2(uAspect, 1.0)*2.2;
    float n = cmFbm(p + vec2(uTime*0.05, -uTime*0.12));
    float n2 = cmFbm(p*1.7 - n*1.3 + uTime*0.04);
    vec3 liquid = mix(uFogColor*0.55, uFogColor*1.5, n2);
    float shaft = pow(max(0.0, 1.0 - abs(uv.x - 0.5 - (n-0.5)*0.35)*1.8), 3.0) * (0.35 + 0.65*uv.y);
    liquid += uFogColor2*shaft*0.6;
    vec2 bp = uv*vec2(uAspect, 1.0)*vec2(9.0, 6.0); bp.y -= uTime*0.5;
    vec2 id = floor(bp); vec2 fp = fract(bp) - 0.5;
    float h = cmHash(id);
    vec2 off = (vec2(cmHash(id+7.0), cmHash(id+19.0)) - 0.5)*0.5;
    float rad = 0.05 + 0.1*h;
    float d = length(fp - off);
    float bub = (smoothstep(rad, rad*0.85, d) - smoothstep(rad*0.85, rad*0.4, d)*0.6) * step(0.6, h);
    liquid += uFogColor2*max(bub, 0.0)*1.2;
    col = mix(col, liquid, smoothstep(0.0, 1.0, uFog));
  }
  col += (cmHash(uv*vec2(1920.0,1080.0) + fract(uTime)*100.0) - 0.5) * uGrain;
  col *= 1.0 - smoothstep(0.35, 1.05, length(c*vec2(uAspect*0.85, 1.0)))*0.55;
  outputColor = vec4(col, inputColor.a);
}`;
