"""Renders previews of the floor + cinema shaders with a real camera so they can be eyeballed. Output: /tmp/preview-*.png"""
import json, re, sys
from playwright.sync_api import sync_playwright
S = json.load(open('/tmp/sh/shaders.json'))
strip = lambda src: re.sub(r'^\s*#include <[^>]+>\s*$', '', src, flags=re.M)
HTML = """<canvas id=c width=1280 height=720></canvas><script>
function persp(f,a,n,fa){const t=1/Math.tan(f/2);return [t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];} function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function norm(a){const l=Math.hypot(...a);return a.map(x=>x/l);} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1];}
window.run = (cfg) => {
  const gl = document.getElementById('c').getContext('webgl2', {preserveDrawingBuffer:true});
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,cfg.vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,cfg.fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  const eye=cfg.eye, view=lookAt(eye,cfg.target,[0,1,0]), proj=persp(cfg.fov*Math.PI/180,1280/720,0.1,90);
  const model=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const U=(n)=>gl.getUniformLocation(p,n);
  const set=(n,f)=>{const l=U(n); if(l) f(l);};
  set('projectionMatrix',l=>gl.uniformMatrix4fv(l,false,proj)); set('viewMatrix',l=>gl.uniformMatrix4fv(l,false,view)); set('modelMatrix',l=>gl.uniformMatrix4fv(l,false,model));
  set('modelViewMatrix',l=>gl.uniformMatrix4fv(l,false,view)); set('cameraPosition',l=>gl.uniform3fv(l,eye));
  for (const [k,v] of Object.entries(cfg.u)) { if (Array.isArray(v) && Array.isArray(v[0])) set(k,l=>gl.uniform4fv(l,v.flat())); else if (Array.isArray(v)) set(k,l=>v.length==3?gl.uniform3fv(l,v):v.length==2?gl.uniform2fv(l,v):gl.uniform4fv(l,v)); else set(k,l=>gl.uniform1f(l,v)); }
  const verts=new Float32Array(cfg.verts); const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,cfg.stride||3,gl.FLOAT,false,0,0);
  if (cfg.tex) { const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cfg.tex.w,cfg.tex.h,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(cfg.tex.data)); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); set('inputBuffer',l=>gl.uniform1i(l,0)); }
  gl.viewport(0,0,1280,720);gl.clearColor(0.012,0.011,0.01,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,verts.length/(cfg.stride||3));
  return true;
};</script>"""
VS_PRE = "#version 300 es\n#define attribute in\n#define varying out\nprecision highp float;\nuniform mat4 modelMatrix; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform vec3 cameraPosition;\nin vec3 position;\n"
FS_PRE = "#version 300 es\n#define varying in\nlayout(location=0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n#define texture2D texture\nprecision highp float;\nuniform mat4 viewMatrix; uniform vec3 cameraPosition;\n"
# display transform so the linear output is viewable (three does this with its tonemapping/colorspace chunks)
DISPLAY = "\nvec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }\n"
def finish(fs, call="pc_fragColor"):  # append a final display transform just before the end of main
    i = fs.rstrip().rfind('}')
    return DISPLAY + fs[:i] + "  pc_fragColor.rgb = pow(aces(pc_fragColor.rgb*0.9), vec3(1.0/2.2));\n}"
def lin(h): return [((int(h[i:i+2],16)/255) ** 2.2) for i in (1,3,5)]
FY=-1.05; PT=FY+0.14
floor = dict(
  vs=VS_PRE+strip(S['FLOOR_VS']), fs=FS_PRE+'#define TAPS 3\n'+strip(finish(S['FLOOR_FS'])),
  eye=[0,0.42,7.7], target=[0,0.1,0], fov=28,
  u=dict(uRing=lin('#ffb347'), uLiquid=lin('#c99a3d'), uBox=[[0,0,1.12,1],[0,0,1,0],[0,0,1,0],[0,0,1,0]], uPlaneY=PT, uTime=2.0, uCaustic=1.0),
  verts=[-30,FY,26, 30,FY,26, 30,FY,-54, -30,FY,26, 30,FY,-54, -30,FY,-54])
floor4 = json.loads(json.dumps(floor)); floor4['eye']=[0,0.9,10.6]; floor4['target']=[0,0.25,0]; floor4['fov']=30
floor4['u']['uBox']=[[-3.07,0,0.8,1],[-1.02,0,0.8,1],[1.02,0,0.8,1],[3.07,0,0.8,1]]
# cinema: input = soft vertical gradient with a bright bar so the RGB split is visible
W=H=64; data=[]
for y in range(H):
    for x in range(W):
        bar = 255 if 28<=x<36 else int(40+60*y/H); data += [bar, int(bar*0.8), int(bar*0.5), 255]
quad=[-1,-1,0, 1,-1,0, 1,1,0, -1,-1,0, 1,1,0, -1,1,0]
CVS = "#version 300 es\nprecision highp float;\nin vec3 position; out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.0,1.0); }"
def cin(fog, burst, speed):
    return dict(vs=CVS, fs="#version 300 es\nprecision highp float;\nlayout(location=0) out highp vec4 pc_fragColor;\n#define texture2D texture\nuniform sampler2D inputBuffer; in vec2 vUv;\n"+S['CINEMA_FS']+"\nvoid main(){ vec4 o; mainImage(texture(inputBuffer,vUv), vUv, o); pc_fragColor = o; }",
        eye=[0,0,1], target=[0,0,0], fov=45, verts=quad, tex=dict(w=W,h=H,data=data),
        u=dict(uTime=3.0, uSpeed=speed, uFog=fog, uBurst=burst, uGrain=0.03, uCA=0.0015, uAspect=1280/720, uFogColor=lin('#ecd9a8'), uFogColor2=lin('#ffdce2')))
jobs = {'floor-chapter': floor, 'floor-lineup': floor4, 'cinema-clear': cin(0,0,0), 'cinema-fast': cin(0,0.3,1.0), 'cinema-inside': cin(1.0,0.0,0.0), 'cinema-half': cin(0.5,0.6,0.2)}
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-gl=angle'])
    for name, cfg in jobs.items():
        pg = b.new_page(viewport=dict(width=1280,height=720)); pg.set_content(HTML)
        try: pg.evaluate("c=>window.run(c)", cfg); pg.locator('#c').screenshot(path=f'/tmp/preview-{name}.png'); print('rendered', name)
        except Exception as e: print('ERR', name, str(e)[:600])
        pg.close()
    b.close()
