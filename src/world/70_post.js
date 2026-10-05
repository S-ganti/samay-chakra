/* =========================================================================
   POST — scene pass (ambient occlusion + light shafts), depth of field,
   long exposure, bloom, AgX tone map + poster grade, SMAA
   ========================================================================= */
const FSQ_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DEPTH_GLSL = `
uniform float uNear, uFar; uniform vec2 uTanHalf;
float linZ(float d){ return (uNear * uFar) / ((uFar - uNear) * d - uFar); }          // view-space z (negative)
vec3 viewPos(vec2 uv, float d){ float z = linZ(d); return vec3((uv * 2.0 - 1.0) * uTanHalf * (-z), z); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;
const camU = () => ({ uNear: { value: .1 }, uFar: { value: 4000 }, uTanHalf: { value: new THREE.Vector2(1, 1) } });
const rtOpts = (extra = {}) => ({ type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, ...extra });
const fsq = (uniforms, fs, defines = {}) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms, defines, vertexShader: FSQ_VS, fragmentShader: fs, depthTest: false, depthWrite: false }));

/* ---------- ambient occlusion (SAO-style, half resolution, depth-aware 4x4 blur + joint bilateral upsample) ---------- */
const AO_FS = `${DEPTH_GLSL}
uniform sampler2D tDepth; uniform vec2 uRes; uniform float uRadius, uIntensity, uBias, uPxScale;
varying vec2 vUv;
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void main(){
  float d = texture2D(tDepth, vUv).r;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
  vec3 p = viewPos(vUv, d);
  vec2 tx = 1.0 / uRes;
  vec3 pr = viewPos(vUv + vec2(tx.x, 0.0), texture2D(tDepth, vUv + vec2(tx.x, 0.0)).r);
  vec3 pl = viewPos(vUv - vec2(tx.x, 0.0), texture2D(tDepth, vUv - vec2(tx.x, 0.0)).r);
  vec3 pu = viewPos(vUv + vec2(0.0, tx.y), texture2D(tDepth, vUv + vec2(0.0, tx.y)).r);
  vec3 pd = viewPos(vUv - vec2(0.0, tx.y), texture2D(tDepth, vUv - vec2(0.0, tx.y)).r);
  vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
  vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
  vec3 n = normalize(cross(dx, dy));
  if (dot(n, p) > 0.0) n = -n;
  float rpx = min(uRadius * uPxScale / -p.z, 42.0);
  if (rpx < 1.5) { gl_FragColor = vec4(1.0, -p.z, 0.0, 1.0); return; }
  ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.0));
  float jit = BAYER[cell.x * 4 + cell.y] / 16.0;
  float ang0 = jit * 6.2831853, r2 = uRadius * uRadius, sum = 0.0;
  for (int i = 0; i < NS; i++) {
    float a = (float(i) + 0.5 + 0.5 * fract(jit * 7.0)) / float(NS);
    float ang = a * 6.2831853 * TURNS + ang0;
    vec2 su = vUv + vec2(cos(ang), sin(ang)) * a * rpx * tx;
    vec3 q = viewPos(su, texture2D(tDepth, su).r);
    vec3 v = q - p; float vv = dot(v, v), vn = dot(v, n);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((vn - uBias * -p.z) / (0.01 + vv), 0.0);
  }
  float ao = max(0.0, 1.0 - sum * uIntensity / (r2 * r2 * r2) * (5.0 / float(NS)));
  gl_FragColor = vec4(ao, -p.z, 0.0, 1.0);
}`;
const AOBLUR_FS = `
uniform sampler2D tAO; uniform vec2 uRes; varying vec2 vUv;
void main(){
  vec2 tx = 1.0 / uRes; vec2 c = texture2D(tAO, vUv).rg;
  if (c.g > 9e3) { gl_FragColor = vec4(1.0, c.g, 0.0, 1.0); return; }
  float s = 0.0, w = 0.0, tol = 0.035 * c.g + 0.08;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    vec2 t = texture2D(tAO, vUv + vec2(float(x), float(y)) * tx).rg;
    float k = max(0.0, 1.0 - abs(t.g - c.g) / tol);
    s += t.r * k; w += k;
  }
  gl_FragColor = vec4(s / max(w, 1e-4), c.g, 0.0, 1.0);
}`;

/* ---------- light shafts: bright pixels near a light, smeared toward it (quarter resolution) ---------- */
const SHMASK_FS = `
uniform sampler2D tScene, tDepth; uniform vec2 uA, uB; uniform float uAsp, uRadA, uRadB, uThrA, uThrB, uOnA, uOnB;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tScene, vUv).rgb; float d = texture2D(tDepth, vUv).r;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sky = step(0.99999, d);
  float ra = length((vUv - uA) * vec2(uAsp, 1.0)), rb = length((vUv - uB) * vec2(uAsp, 1.0));
  vec3 mA = min(c * max(l - uThrA, 0.0) / max(l, 1e-3), vec3(4.0)) * sky * (1.0 - smoothstep(0.0, uRadA, ra)) * uOnA;
  float mB = min(max(l - uThrB, 0.0), 6.0) * (1.0 - smoothstep(0.0, uRadB, rb)) * uOnB;
  gl_FragColor = vec4(mA, mB);
}`;
const SHRAD_FS = `
uniform sampler2D tIn; uniform vec2 uA, uB; uniform float uLen;
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float j = ign(gl_FragCoord.xy);
  vec2 sa = (uA - vUv) * uLen / float(NT), sb = (uB - vUv) * uLen / float(NT);
  vec2 pa = vUv + sa * j, pb = vUv + sb * j;
  vec3 aa = vec3(0.0); float ab = 0.0, ws = 0.0;
  for (int i = 0; i < NT; i++) {
    float w = 1.0 - 0.55 * float(i) / float(NT);
    aa += texture2D(tIn, pa).rgb * w; ab += texture2D(tIn, pb).a * w; ws += w;
    pa += sa; pb += sb;
  }
  gl_FragColor = vec4(aa / ws, ab / ws);
}`;

/* ---------- composite: scene x AO + shafts ---------- */
const COMP_FS = `${DEPTH_GLSL}
uniform sampler2D tScene, tDepth, tAO, tSh; uniform vec2 uHalf; uniform float uAO, uShA, uShB, uUseAO, uUseSh; uniform vec3 uShColB, uAOTint;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(tScene, vUv);
  if (uUseAO > 0.5) {
    float z = -linZ(texture2D(tDepth, vUv).r);
    vec2 hp = vUv * uHalf - 0.5, f = fract(hp), ht = 1.0 / uHalf, b = (floor(hp) + 0.5) * ht;
    vec2 s00 = texture2D(tAO, b).rg, s10 = texture2D(tAO, b + vec2(ht.x, 0.0)).rg, s01 = texture2D(tAO, b + vec2(0.0, ht.y)).rg, s11 = texture2D(tAO, b + ht).rg;
    vec4 wb = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
    float tol = 0.03 * z + 0.05;
    vec4 wd = vec4(abs(s00.g - z), abs(s10.g - z), abs(s01.g - z), abs(s11.g - z));
    vec4 w = wb * (1.0 / (1.0 + wd / tol * (wd / tol))) + 1e-5;
    float ao = dot(vec4(s00.r, s10.r, s01.r, s11.r), w) / dot(w, vec4(1.0));
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    ao = mix(ao, 1.0, smoothstep(1.0, 4.0, l));
    c.rgb *= mix(vec3(1.0), mix(uAOTint, vec3(1.0), ao), uAO);
  }
  if (uUseSh > 0.5) { vec4 sh = texture2D(tSh, vUv); c.rgb += sh.rgb * uShA + uShColB * sh.a * uShB; }
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

class ScenePass extends Pass {
  constructor(scene, camera, Q) {
    super();
    this.scene = scene; this.camera = camera; this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1), magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    this.rt.depthTexture.minFilter = this.rt.depthTexture.magFilter = THREE.NearestFilter;
    this.depth = this.rt.depthTexture;
    const near = rtOpts({ magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
    this.aoRT = new THREE.WebGLRenderTarget(1, 1, near); this.aoRT2 = new THREE.WebGLRenderTarget(1, 1, near);
    this.shM = new THREE.WebGLRenderTarget(1, 1, rtOpts()); this.shA = new THREE.WebGLRenderTarget(1, 1, rtOpts()); this.shB = new THREE.WebGLRenderTarget(1, 1, rtOpts());
    this.aoU = { ...camU(), tDepth: { value: this.depth }, uRes: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 1.3 }, uIntensity: { value: 1 }, uBias: { value: .0025 }, uPxScale: { value: 1 } };
    this.aoSamples = -1; this.setAOSamples(Q.ao || 8);
    this.blurU = { tAO: { value: this.aoRT.texture }, uRes: { value: new THREE.Vector2(1, 1) } };
    this.blurQ = fsq(this.blurU, AOBLUR_FS);
    this.maskU = { tScene: { value: this.rt.texture }, tDepth: { value: this.depth }, uA: { value: new THREE.Vector2(.5, .5) }, uB: { value: new THREE.Vector2(.5, .5) }, uAsp: { value: 1 }, uRadA: { value: .5 }, uRadB: { value: .3 }, uThrA: { value: 1 }, uThrB: { value: .35 }, uOnA: { value: 0 }, uOnB: { value: 0 } };
    this.maskQ = fsq(this.maskU, SHMASK_FS);
    this.radU = { tIn: { value: null }, uA: this.maskU.uA, uB: this.maskU.uB, uLen: { value: 1 } };
    this.radQ = fsq(this.radU, SHRAD_FS, { NT: 24 });
    this.compU = { ...camU(), tScene: { value: this.rt.texture }, tDepth: { value: this.depth }, tAO: { value: this.aoRT2.texture }, tSh: { value: this.shB.texture }, uHalf: { value: new THREE.Vector2(1, 1) },
      uAO: { value: .8 }, uShA: { value: 0 }, uShB: { value: 0 }, uUseAO: { value: 1 }, uUseSh: { value: 0 }, uShColB: { value: col('#ff8a2a') }, uAOTint: { value: col('#000') } };
    this.compQ = fsq(this.compU, COMP_FS);
    this.useAO = true; this.useSh = false;
  }
  setAOSamples(n) {
    if (n === this.aoSamples) return; this.aoSamples = n;
    if (this.aoQ) this.aoQ.material.dispose();
    this.aoQ = fsq(this.aoU, AO_FS, { NS: n, TURNS: (n >= 12 ? 5 : 3).toFixed(1) });
  }
  setSize(w, h) {
    this.rt.setSize(w, h);
    const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2)), qw = Math.max(1, Math.ceil(w / 4)), qh = Math.max(1, Math.ceil(h / 4));
    this.aoRT.setSize(hw, hh); this.aoRT2.setSize(hw, hh); this.shM.setSize(qw, qh); this.shA.setSize(qw, qh); this.shB.setSize(qw, qh);
    this.aoU.uRes.value.set(hw, hh); this.blurU.uRes.value.set(hw, hh); this.compU.uHalf.value.set(hw, hh);
    this.maskU.uAsp.value = w / h; this.W = w; this.H = h;
  }
  syncCamera() {
    const c = this.camera, th = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
    for (const U of [this.aoU, this.compU]) { U.uNear.value = c.near; U.uFar.value = c.far; U.uTanHalf.value.set(th * c.aspect, th); }
    this.aoU.uPxScale.value = this.aoU.uRes.value.y / (2 * th);
  }
  render(renderer, writeBuffer) {
    const useAO = this.useAO && this.compU.uAO.value > .01, useSh = this.useSh;
    if (!useAO && !useSh && !this.needDepth) {
      // nothing needs depth this frame: render straight into the chain and skip the composite copy
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); renderer.render(this.scene, this.camera); return;
    }
    renderer.setRenderTarget(this.rt); renderer.render(this.scene, this.camera);
    this.syncCamera();
    if (useAO) {
      renderer.setRenderTarget(this.aoRT); this.aoQ.render(renderer);
      renderer.setRenderTarget(this.aoRT2); this.blurQ.render(renderer);
    }
    if (useSh) {
      renderer.setRenderTarget(this.shM); this.maskQ.render(renderer);
      this.radU.tIn.value = this.shM.texture; this.radU.uLen.value = 1; renderer.setRenderTarget(this.shA); this.radQ.render(renderer);
      this.radU.tIn.value = this.shA.texture; this.radU.uLen.value = 1 / 24; renderer.setRenderTarget(this.shB); this.radQ.render(renderer);
    }
    this.compU.uUseAO.value = useAO ? 1 : 0; this.compU.uUseSh.value = useSh ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.compQ.render(renderer);
  }
}

/* ---------- depth of field: half-res CoC gather (background can't bleed over sharper foreground) ---------- */
const DOFPRE_FS = `${DEPTH_GLSL}
uniform sampler2D tColor, tDepth; uniform float uFocus, uK, uMaxR; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  float z = -linZ(texture2D(tDepth, vUv).r);
  gl_FragColor = vec4(c, clamp(uK * (1.0 - uFocus / z), -uMaxR, uMaxR));
}`;
const DOFGATHER_FS = `
uniform sampler2D tHalf; uniform vec2 uTex; uniform float uMaxR; varying vec2 vUv;
void main(){
  vec4 c0 = texture2D(tHalf, vUv); float r0 = c0.a;
  vec3 acc = c0.rgb; float wacc = 1.0, nearCov = 0.0;
  for (int i = 0; i < NT; i++) {
    float fi = float(i) + 0.5, rr = sqrt(fi / float(NT)), th = fi * 2.39996323;
    vec2 o = vec2(cos(th), sin(th)) * rr * uMaxR;
    vec4 s = texture2D(tHalf, vUv + o * uTex);
    float sr = s.a > r0 ? min(abs(s.a), abs(r0)) : abs(s.a);
    float w = clamp(sr - rr * uMaxR + 1.0, 0.0, 1.0);
    acc += s.rgb * w; wacc += w;
    if (s.a < r0 - 1.0) nearCov = max(nearCov, w);
  }
  gl_FragColor = vec4(acc / wacc, nearCov);
}`;
const DOFCOMP_FS = `${DEPTH_GLSL}
uniform sampler2D tColor, tDepth, tBlur; uniform float uFocus, uK, uMaxR; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tColor, vUv); float z = -linZ(texture2D(tDepth, vUv).r);
  float coc = abs(clamp(uK * (1.0 - uFocus / z), -uMaxR, uMaxR));
  vec4 b = texture2D(tBlur, vUv);
  float m = max(smoothstep(0.4, 1.6, coc), b.a);
  gl_FragColor = vec4(mix(c.rgb, b.rgb, m), 1.0);
}`;
class DofPass extends Pass {
  constructor(depth) {
    super(); this.needsSwap = true; this.enabled = false;
    this.half = new THREE.WebGLRenderTarget(1, 1, rtOpts()); this.blur = new THREE.WebGLRenderTarget(1, 1, rtOpts());
    const common = () => ({ ...camU(), tDepth: { value: depth }, uFocus: { value: 10 }, uK: { value: 0 }, uMaxR: { value: 8 } });
    this.preU = { ...common(), tColor: { value: null } }; this.preQ = fsq(this.preU, DOFPRE_FS);
    this.gU = { tHalf: { value: this.half.texture }, uTex: { value: new THREE.Vector2(1, 1) }, uMaxR: this.preU.uMaxR }; this.gQ = fsq(this.gU, DOFGATHER_FS, { NT: 28 });
    this.cU = { ...common(), tColor: { value: null }, tBlur: { value: this.blur.texture } }; this.cQ = fsq(this.cU, DOFCOMP_FS);
    this.cU.uFocus = this.preU.uFocus; this.cU.uK = this.preU.uK; this.cU.uMaxR = this.preU.uMaxR;
  }
  setSize(w, h) { const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2)); this.half.setSize(hw, hh); this.blur.setSize(hw, hh); this.gU.uTex.value.set(1 / hw, 1 / hh); }
  set(camera, focus, k) {
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const U of [this.preU, this.cU]) { U.uNear.value = camera.near; U.uFar.value = camera.far; U.uTanHalf.value.set(th * camera.aspect, th); }
    this.preU.uFocus.value = focus; this.preU.uK.value = k;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.preU.tColor.value = readBuffer.texture; renderer.setRenderTarget(this.half); this.preQ.render(renderer);
    renderer.setRenderTarget(this.blur); this.gQ.render(renderer);
    this.cU.tColor.value = readBuffer.texture; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.cQ.render(renderer);
  }
}

/* ---------- output: exposure → AgX (with a punchy look) → sRGB → poster grade ---------- */
const OutputGradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uExpo: { value: 1 }, uTM: { value: 1 }, uAgxPow: { value: 1.2 }, uAgxSat: { value: 1.2 },
    uLift: { value: col('#000') }, uGain: { value: col('#fff') }, uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: .5 }, uGrain: { value: .05 }, uPaper: { value: 0 }, uAmt: { value: 1 }, uAberr: { value: .004 }, uBars: { value: 0 },
    tLutA: { value: null }, tLutB: { value: null }, uLutW: { value: 0 }, uPal: { value: 0 }, uDream: { value: 0 }, uDreamTint: { value: col('#e8dccb') },
  },
  vertexShader: FSQ_VS,
  fragmentShader: `precision highp sampler3D; uniform sampler3D tLutA, tLutB; uniform float uLutW, uPal, uDream; uniform vec3 uDreamTint;
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime,uExpo,uTM,uAgxPow,uAgxSat,uSat,uCon,uVig,uGrain,uPaper,uAmt,uAberr,uBars; uniform vec3 uLift,uGain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    const mat3 SRGB_2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
    const mat3 R2020_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
    const mat3 AGX_IN = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
    const mat3 AGX_OUT = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
    vec3 agxCurve(vec3 x){ vec3 x2 = x*x, x4 = x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
    vec3 agx(vec3 c){
      c = AGX_IN * (SRGB_2020 * c);
      c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
      c = agxCurve(c);
      c = pow(max(c, 0.0), vec3(uAgxPow));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = l + uAgxSat * (c - l);
      c = AGX_OUT * c;
      c = pow(max(c, 0.0), vec3(2.2));
      return clamp(R2020_SRGB * c, 0.0, 1.0);
    }
    vec3 aces(vec3 c){
      const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c = I * (c / 0.6); vec3 a = c * (c + 0.0245786) - 0.000090537, b = c * (0.983729 * c + 0.4329510) + 0.238081;
      return clamp(O * (a / b), 0.0, 1.0);
    }
    vec3 srgb(vec3 c){ return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
    void main(){
      vec2 cc = vUv-0.5; float ab = uAberr*dot(cc,cc)*4.0;
      vec3 hdr = vec3(texture2D(tDiffuse, vUv-cc*ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv+cc*ab).b) * uExpo;
      vec3 c = srgb(mix(aces(hdr), agx(hdr), uTM));
      vec3 g = c*uGain + uLift*(1.0-c);
      float l = dot(g, vec3(0.2126,0.7152,0.0722));
      g = mix(vec3(l), g, uSat);
      g = (g-0.5)*uCon + 0.5;
      if(uPaper>0.001){
        vec2 px = vUv*uRes;
        float f = n2(px/2.5)*0.35 + n2(vUv*vec2(6.0,70.0))*0.25 + n2(vUv*5.0)*0.4 + n2(vUv*23.0)*0.2;
        vec3 paper = vec3(0.97,0.93,0.85)*(0.88+0.14*f);
        float speck = step(0.9965, h(floor(px/2.0)))*0.5;
        g = mix(g, g*paper*1.06 + vec3(0.025,0.018,0.0) - speck*vec3(0.0,0.05,0.15), uPaper);
      }
      c = mix(c, g, uAmt);
      // repaint with the chapter's pigments (value from the render, hue and chroma from the palette)
      if (uPal > 0.001) { vec3 lc = clamp(c, 0.0, 1.0) * 0.96875 + 0.015625; c = mix(c, mix(texture(tLutA, lc).rgb, texture(tLutB, lc).rgb, uLutW), uPal); }
      // dream: shadows lifted into the chapter's own haze colour, contrast softened, highlights bloomed to milk (a pro-mist look)
      if (uDream > 0.001) {
        vec3 t = uDreamTint; float l = dot(c, vec3(0.2126,0.7152,0.0722));
        c += t * (1.0 - c) * (1.0 - c) * 0.24 * uDream;
        c = mix(c, c * (0.86 + 0.14 * t) + 0.07 * t * smoothstep(0.55, 1.0, l), uDream * 0.6);
        c = mix(c, vec3(l) + (c - vec3(l)) * 0.92, uDream * 0.5);
      }
      float asp = uRes.x/uRes.y;
      float v = smoothstep(0.95, 0.25, length(cc*vec2(asp,1.0)/max(asp,1.0)*1.35));
      c *= mix(1.0, v, uVig);
      c += (h(vUv*uRes + fract(uTime*37.0)*113.0)-0.5)*uGrain;
      c *= step(uBars, vUv.y) * step(vUv.y, 1.0-uBars);
      gl_FragColor = vec4(clamp(c,0.0,1.0),1.0);
    }`,
};

/* ---------- upscale: the picture is drawn at a fixed pixel budget and shown at the canvas's own resolution ----------
   A Catmull-Rom resample (5 bilinear taps, so no soft bilinear stretch) followed by contrast-adaptive sharpening, in the
   spirit of FSR's EASU + RCAS. The canvas keeps its native size, so the page is crisp on high-density screens at the cost
   of a fraction of the pixels. Off (and free) whenever the picture is drawn at full size. */
const UPSCALE_FS = `
uniform sampler2D tDiffuse; uniform vec2 uIn, uStep; uniform float uSharp; varying vec2 vUv;
vec3 bil(vec2 p){ return texture2D(tDiffuse, p / uIn).rgb; }
vec3 cubic(vec2 pos){
  vec2 c = floor(pos - 0.5) + 0.5, f = pos - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, p12 = c + w2 / w12, p0 = c - 1.0, p3 = c + 2.0;
  float k0 = w12.x * w0.y, k1 = w0.x * w12.y, k2 = w12.x * w12.y, k3 = w3.x * w12.y, k4 = w12.x * w3.y;
  return (bil(vec2(p12.x, p0.y)) * k0 + bil(vec2(p0.x, p12.y)) * k1 + bil(p12) * k2 + bil(vec2(p3.x, p12.y)) * k3 + bil(vec2(p12.x, p3.y)) * k4) / (k0 + k1 + k2 + k3 + k4);
}
void main(){
  vec2 pos = vUv * uIn;
  vec3 e = max(cubic(pos), 0.0);
  vec3 b = bil(pos + vec2(0.0, -uStep.y)), d = bil(pos + vec2(-uStep.x, 0.0)), f = bil(pos + vec2(uStep.x, 0.0)), h = bil(pos + vec2(0.0, uStep.y));
  // RCAS: how hard each pixel can be sharpened before it rings, from its own neighbourhood
  float mn = min(min(min(b.g, d.g), min(f.g, h.g)), e.g), mx = max(max(max(b.g, d.g), max(f.g, h.g)), e.g);
  float lobe = clamp(max(-mn / (4.0 * mx + 1e-4), (1.0 - mx) / (4.0 * mn - 4.0 - 1e-4)), -0.1875, 0.0) * uSharp;
  vec3 col = (lobe * (b + d + f + h) + e) / (1.0 + 4.0 * lobe);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
class UpscalePass extends Pass {
  constructor() {
    super(); this.needsSwap = false; this.enabled = false;
    this.u = { tDiffuse: { value: null }, uIn: { value: new THREE.Vector2(1, 1) }, uStep: { value: new THREE.Vector2(1, 1) }, uSharp: { value: 1 } };
    this.q = fsq(this.u, UPSCALE_FS); this.out = new THREE.Vector2(1, 1);
  }
  setSize(w, h) { this.u.uIn.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    renderer.getDrawingBufferSize(this.out);
    this.u.tDiffuse.value = readBuffer.texture;
    this.u.uStep.value.set(this.u.uIn.value.x / this.out.x, this.u.uIn.value.y / this.out.y);   // one canvas pixel, in picture pixels
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.q.render(renderer);
  }
}

// FXAA: a single cheap pass (about a tenth of SMAA's cost) for Medium; High keeps SMAA
class FxaaPass extends ShaderPass {
  constructor() { super(FXAAShader); this.enabled = false; }
  setSize(w, h) { this.uniforms.resolution.value.set(1 / w, 1 / h); }
}

function buildPost(renderer, scene, camera, Q) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  const sp = new ScenePass(scene, camera, Q);
  const dof = new DofPass(sp.depth);
  const after = new AfterimagePass(.0);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1, .5, .6);
  const grade = new ShaderPass(OutputGradeShader);
  const smaa = new SMAAPass(256, 256); smaa.enabled = Q.smaa;
  const fxaa = new FxaaPass(); fxaa.enabled = !!Q.fxaa;
  const up = new UpscalePass();
  composer.addPass(sp); composer.addPass(dof); composer.addPass(after); composer.addPass(bloom); composer.addPass(grade); composer.addPass(smaa); composer.addPass(fxaa); composer.addPass(up);
  return { composer, sp, dof, after, bloom, grade, smaa, fxaa, up, dofF: 10, dofK: 0 };
}
const _shv = V3();
// screen position of a world point: returns a visibility weight (0 behind the camera, fading when far off-screen)
function screenOf(cam, p, out) {
  _shv.copy(p).applyMatrix4(cam.matrixWorldInverse);
  if (_shv.z > -.1) { out.set(-9, -9); return 0; }
  _shv.copy(p).project(cam);
  out.set(_shv.x * .5 + .5, _shv.y * .5 + .5);
  return 1 - smooth(0, .7, Math.max(Math.abs(_shv.x), Math.abs(_shv.y)) - 1);
}
const TONE = { agx: 1, pow: 1.22, sat: 1.1, bloom: .55 };   // a gentler look: pigments, not neon
const _shp = V3(), _shc = new THREE.Color();
function updatePost(PP, look, rt, w, h, cam, lightInfo) {
  const g = PP.grade.uniforms;
  g.uLift.value.copy(look.lift).convertLinearToSRGB(); g.uGain.value.copy(look.gain).convertLinearToSRGB(); g.uSat.value = look.sat; g.uCon.value = look.con;
  g.uVig.value = look.vig; g.uGrain.value = look.grain * PARAM.grain; g.uPaper.value = look.paper; g.uAmt.value = PARAM.grade; g.uTime.value = rt;
  g.uRes.value.set(w, h); g.uBars.value = PARAM.lbx ? .1 : 0;
  g.uExpo.value = look.expo; g.uTM.value = TONE.agx; g.uAgxPow.value = TONE.pow; g.uAgxSat.value = TONE.sat;
  PP.bloom.strength = (look.bloom * PARAM.glow * (1 + S.pulse * .25) + S.flash * .45) * TONE.bloom;
  const dr = PARAM.dream; g.uDream.value = dr * PARAM.grade; g.uDreamTint.value.copy(look.dream).convertLinearToSRGB();
  PP.bloom.strength += dr * .22; PP.bloom.radius = lerp(look.bloomR, .9, dr * .8); PP.bloom.threshold = lerp(look.bloomT, .38, dr * .7);
  const a = clamp(look.after * PARAM.exposure, 0, .93);
  PP.after.uniforms.damp.value = a; PP.after.enabled = a > .07;
  // ambient occlusion
  const Q = QUAL[PARAM.quality], sp = PP.sp, C = sp.compU;
  sp.useAO = Q.ao > 0; if (Q.ao > 0) sp.setAOSamples(Q.ao);
  C.uAO.value = look.ao * PARAM.ao; C.uAOTint.value.copy(look.hemiG).multiplyScalar(.35);
  // light shafts: A = the sky light (sun by day; ring corona or moon by night), B = the portal
  const M = sp.maskU; let onA = 0, onB = 0;
  if (Q.shafts && PARAM.shafts > .01) {
    const dayF = smooth(-.12, .06, S.sunDir.y);
    if (dayF > .5) { _shp.copy(cam.position).addScaledVector(S.sunDir, 900); onA = (dayF - .5) * 2 * (1 - smooth(.35, .75, S.sunDir.y)); }
    else if (lightInfo.celVis > .02) { _shp.copy(lightInfo.celPos); onA = (.5 - dayF) * 2 * lightInfo.celVis; }
    else { _shp.copy(cam.position).addScaledVector(S.moonDir, 900); onA = (.5 - dayF) * 2 * smooth(.02, .15, S.moonDir.y) * .6; }
    onA *= screenOf(cam, _shp, M.uA.value);
    onB = lightInfo.portalI > .01 ? screenOf(cam, lightInfo.portalPos, M.uB.value) * clamp(lightInfo.portalI, 0, 1.5) : 0;
    M.uRadA.value = dayF > .5 ? .22 : .4; M.uThrA.value = dayF > .5 ? 1.1 : .25;
    M.uRadB.value = clamp(13 / Math.max(cam.position.distanceTo(lightInfo.portalPos), 1), .1, .7);
    M.uOnA.value = onA > .005 ? 1 : 0; M.uOnB.value = onB > .005 ? 1 : 0;
    C.uShA.value = look.shaft * PARAM.shafts * onA * (dayF > .5 ? .35 : .7); C.uShB.value = look.shaft * PARAM.shafts * onB * 1.6;
    C.uShColB.value.copy(lightInfo.portalCol);
  }
  sp.useSh = onA > .005 || onB > .005;
  // depth of field
  const dk = PARAM.dof && Q.dof ? PP.dofK : 0;
  PP.dof.enabled = dk > .05; sp.needDepth = PP.dof.enabled;
  if (PP.dof.enabled) PP.dof.set(cam, PP.dofF, dk);
}
