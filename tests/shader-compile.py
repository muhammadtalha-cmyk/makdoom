"""Compiles every custom GLSL program of the hero in a real WebGL2 context (headless Chromium, software GL),
using the same prelude three.js prepends to ShaderMaterial / onBeforeCompile code.  Run: python3 tests/shader-compile.py"""
import json, sys, re
from playwright.sync_api import sync_playwright

S = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sh/shaders.json'))
strip = lambda src: re.sub(r'^\s*#include <[^>]+>\s*$', '', src, flags=re.M)

VS_PRE = """#version 300 es
#define attribute in
#define varying out
precision highp float; precision highp int; precision highp sampler2D;
uniform mat4 modelMatrix; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat3 normalMatrix; uniform vec3 cameraPosition;
in vec3 position; in vec3 normal; in vec2 uv;
"""
FS_PRE = """#version 300 es
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
precision highp float; precision highp int; precision highp sampler2D;
uniform mat4 viewMatrix; uniform vec3 cameraPosition;
"""
P = {}
P['dust'] = (S['DUST_VS'], S['DUST_FS'])
P['spray'] = (S['SPRAY_VS'], S['SPRAY_FS'])
P['morph'] = (S['MORPH_VS'], S['MORPH_FS'])
P['liquid'] = (S['LIQUID_VS'], S['LIQUID_FS'])
P['floor(TAPS=3)'] = (S['FLOOR_VS'], '#define TAPS 3\n' + S['FLOOR_FS'])
P['floor(TAPS=1)'] = (S['FLOOR_VS'], '#define TAPS 1\n' + S['FLOOR_FS'])
P['shaft'] = (S['SHAFT_VS'], S['SHAFT_FS'])
P['mist'] = (S['MIST_VS'], S['MIST_FS'])
P['flare'] = (S['FLARE_VS'], S['FLARE_FS'])
# material patches, assembled the way onBeforeCompile does
P['patch:glass+dissolve'] = (
    S['PATCH_VERT_DECL'] + 'void main(){\n' + S['PATCH_VERT_BODY'] + 'gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    S['PATCH_FRAG_DECL'] + 'void main(){ float roughnessFactor = 0.1; vec3 totalEmissiveRadiance = vec3(0.0); vec3 normal = vec3(0.0,0.0,1.0); vec3 clearcoatNormal = normal;\n'
    + S['PATCH_FRAG_DISSOLVE'] + S['PATCH_FRAG_GLASS_ROUGH'] + S['PATCH_FRAG_GLASS_NORMAL'] + S['PATCH_FRAG_GLASS_CLEARCOAT'] + S['PATCH_FRAG_EDGE']
    + 'pc_fragColor = vec4(normal*0.5+0.5, roughnessFactor) + vec4(totalEmissiveRadiance,0.0);}')
P['patch:dissolve-only'] = (
    S['PATCH_VERT_DECL'] + 'void main(){\n' + S['PATCH_VERT_BODY'] + 'gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    S['PATCH_FRAG_DECL'] + 'void main(){ vec3 totalEmissiveRadiance = vec3(0.0);\n' + S['PATCH_FRAG_DISSOLVE'] + S['PATCH_FRAG_EDGE'] + 'pc_fragColor = vec4(totalEmissiveRadiance,1.0);}')
P['mercury'] = (
    S['MERCURY_VERT_DECL'] + 'void main(){\n' + S['MERCURY_BEGIN_NORMAL'] + S['MERCURY_BEGIN_VERTEX'] + 'gl_Position = projectionMatrix*modelViewMatrix*vec4(transformed + objectNormal*0.001,1.0);}',
    'void main(){ pc_fragColor = vec4(1.0); }')
P['cinema(postprocessing)'] = (
    'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    'uniform sampler2D inputBuffer; in vec2 vUv;\n' + S['CINEMA_FS'] + '\nvoid main(){ vec4 o; mainImage(vec4(1.0), vUv, o); pc_fragColor = o; }')

HTML = "<canvas id=c width=64 height=64></canvas>"
JS = """
([progs, VS_PRE, FS_PRE]) => {
  const gl = document.getElementById('c').getContext('webgl2');
  if (!gl) return {fatal: 'no webgl2'};
  const res = {};
  for (const [name, [vs, fs]] of Object.entries(progs)) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return [s, gl.getShaderInfoLog(s), gl.getShaderParameter(s, gl.COMPILE_STATUS)]; };
    const [v, vl, vok] = mk(gl.VERTEX_SHADER, VS_PRE + vs);
    const [f, fl, fok] = mk(gl.FRAGMENT_SHADER, FS_PRE + fs);
    let link = null;
    if (vok && fok) { const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); link = gl.getProgramParameter(p, gl.LINK_STATUS) ? 'ok' : gl.getProgramInfoLog(p); }
    res[name] = {vs: vok ? 'ok' : vl, fs: fok ? 'ok' : fl, link};
  }
  return res;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'])
    pg = b.new_page(); pg.set_content(HTML)
    out = pg.evaluate(JS, [{k: [strip(v[0]), strip(v[1])] for k, v in P.items()}, VS_PRE, FS_PRE])
    b.close()
if 'fatal' in out: print('FATAL', out); sys.exit(2)
bad = 0
for k, v in out.items():
    ok = v['vs'] == 'ok' and v['fs'] == 'ok' and v['link'] == 'ok'
    print(('PASS ' if ok else 'FAIL ') + k)
    if not ok:
        bad += 1; print('   ', v)
print('\n%d/%d shader programs compile+link' % (len(out) - bad, len(out)))
sys.exit(1 if bad else 0)
