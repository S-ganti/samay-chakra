/* =========================================================================
   FUSION — the world drawn in the Fusion Series' poster styles: each chapter
   pairs an Indian folk tradition with a modern movement (Gond × Art Deco,
   Warli × Op Art …). Ink outlines from depth and value breaks, the value
   flattened into bands of that poster's pigments, and the poster's own
   texture laid into the shade. One full-screen pass on Medium and High.
   ========================================================================= */
// ramp: six pigments from shade to light (the design language's named pigments where the poster uses them).
// gain: value lift before banding (night renders are dim; the posters use the full range). ink: outline colour, inkW: outline width in px at 1080p, pat: texture, patC: texture colour, keep: how much of the
// render's own hue survives the repaint, bands: value steps
const FUSION = [
  { name: 'Gond × Art Deco', ramp: ['#0b0806', '#0c1e1b', '#0f5e57', '#6a3a1e', '#ff4a1c', '#d9b45a'], ink: '#d9b45a', inkW: 1.2, pat: 0, patC: '#d9b45a', keep: .18, bands: 5, gain: 1.25 },
  { name: 'Warli × Op Art', ramp: ['#2a0e06', '#5a1f10', '#8a3a22', '#b0503a', '#ff2e88', '#f3ebda'], ink: '#f3ebda', inkW: 1.1, pat: 1, patC: '#f3ebda', keep: .1, bands: 4, gain: 1.7 },
  { name: 'Thangka × Suprematism', ramp: ['#1a140c', '#5a4e38', '#8a7a5a', '#d7261e', '#f2a23a', '#efe6d2'], ink: '#0b0806', inkW: 1.4, pat: 2, patC: '#d7261e', keep: .12, bands: 3, gain: 2.6 },
  { name: 'Madhubani × Star Atlas', ramp: ['#060b2c', '#0a1140', '#14306a', '#19c2a0', '#d9b45a', '#f0e6c4'], ink: '#19c2a0', inkW: 1.1, pat: 3, patC: '#19c2a0', keep: .14, bands: 5, gain: 1.0 },
  { name: 'Kalighat × Pop Art', ramp: ['#0b0806', '#1b2a8a', '#19b8e0', '#ff2e88', '#ffe600', '#fffbef'], ink: '#0b0806', inkW: 2.2, pat: 4, patC: '#0e8fc0', keep: .22, bands: 4, gain: 1.0 },
  { name: 'Truck Art × Swiss Style', ramp: ['#0b0806', '#2b3bff', '#0b9a4a', '#ff2e88', '#ffc21a', '#f3ebda'], ink: '#0b0806', inkW: 1.6, pat: 5, patC: '#0b0806', keep: .3, bands: 5, gain: 1.0 },
  { name: 'Pattachitra × Memphis', ramp: ['#0b0806', '#1f2bd6', '#c8261a', '#e8a317', '#fbf6ea', '#fbf6ea'], ink: '#0b0806', inkW: 1.8, pat: 6, patC: '#1f2bd6', keep: .22, bands: 5, gain: 1.0 },
  { name: 'Kolam × Generative Code', ramp: ['#12051a', '#1e0a24', '#5a1450', '#ff2e88', '#ff4a1c', '#ffc21a'], ink: '#ffc21a', inkW: 1.0, pat: 7, patC: '#19c2a0', keep: .12, bands: 5, gain: 1.1 },
];
const FUSION_C = FUSION.map(f => ({ ...f, rampC: f.ramp.map(h => col(h).convertLinearToSRGB()), inkC: col(f.ink).convertLinearToSRGB(), patCC: col(f.patC).convertLinearToSRGB() }));

const FUSION_FS = `${DEPTH_GLSL}
uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes, uCenter; uniform float uScale, uTime, uW, uAmt;
uniform vec3 uRamp[12], uInk[2], uPatC[2]; uniform float uInkW[2], uPat[2], uKeep[2], uBands[2], uGainF[2];
varying vec2 vUv;
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float lz(vec2 uv){ float d = texture2D(tDepth, uv).r; return d >= 0.99999 ? 1e5 : -linZ(d); }
// value ramp: six pigments, the value cut into flat bands
vec3 ramp(int k, float t, float bands){
  float s = min(floor(t * bands), bands - 1.0) / max(bands - 1.0, 1.0);
  float u = s * 5.0; int i = int(min(floor(u), 4.0));
  return mix(uRamp[k * 6 + i], uRamp[k * 6 + i + 1], u - float(i));
}
// each poster's texture, in screen pixels scaled to a 1080-line frame; returns coverage 0..1 for this pixel
float pattern(int id, vec2 p, float t, vec2 cen){
  if (id == 0) {                                     // Gond: rows of short parallel dashes
    vec2 q = p / vec2(9.0, 7.0); float row = floor(q.y);
    return step(0.42, fract(q.x + row * 0.5)) * step(abs(fract(q.y) - 0.5), 0.13) * step(0.18, t) * step(t, 0.6);
  }
  if (id == 1) {                                     // Op Art: concentric rings around the ring stage, tighter in the dark
    float r = length(p - cen); return step(0.5 + 0.35 * t, fract(r / 9.0)) * step(t, 0.7) * (1.0 - smoothstep(230.0, 280.0, r));
  }
  if (id == 2) return 0.0;                           // Suprematism: pure flat planes
  if (id == 3) {                                     // Madhubani: fine cross-hatching (kachni), denser in shade
    float a = abs(fract((p.x + p.y) / 6.0) - 0.5), b = abs(fract((p.x - p.y) / 6.0) - 0.5);
    return max(step(a, 0.08) * step(t, 0.5), step(b, 0.08) * step(t, 0.28));
  }
  if (id == 4) {                                     // Pop Art: Ben-Day halftone, dots grow in the shade
    vec2 g = fract(p / 9.0) - 0.5; return step(length(g), 0.5 * sqrt(clamp(1.0 - t * 1.25, 0.0, 1.0)));
  }
  if (id == 5) {                                     // Swiss: pinstripes in the shade, a grid in the deepest band
    float v = step(abs(fract(p.x / 8.0) - 0.5), 0.09), hz = step(abs(fract(p.y / 48.0) - 0.5), 0.015);
    return max(v * step(t, 0.42), hz * step(t, 0.22));
  }
  if (id == 6) {                                     // Memphis: confetti, a few scattered dashes per cell
    vec2 c = floor(p / 22.0), f = fract(p / 22.0) - 0.5; float h = hsh(c);
    float an = h * 6.2831; vec2 d = vec2(cos(an), sin(an)); float along = dot(f, d), across = dot(f, vec2(-d.y, d.x));
    return step(0.62, h) * step(abs(along), 0.22) * step(abs(across), 0.05) * step(t, 0.75);
  }
  // Kolam: the pulli grid of dots the lines loop around
  vec2 g = fract(p / 14.0) - 0.5; return step(length(g), 0.12) * step(t, 0.65);
}
vec3 fuse(int k, vec3 c, float lraw, vec2 px, float edge, vec2 cen){
  float l = smoothstep(0.02, 0.92, clamp(lraw * uGainF[k], 0.0, 1.0));
  vec3 o = ramp(k, l, uBands[k]);
  o += (c - dot(c, LW)) * uKeep[k] * 2.0;            // a little of the render's own hue so things stay legible
  float pt = pattern(int(uPat[k] + 0.5), px, l, cen);
  o = mix(o, uPatC[k], pt * 0.55);
  return mix(o, uInk[k], edge);
}
void main(){
  vec4 src = texture2D(tDiffuse, vUv);
  vec3 c = src.rgb;
  vec2 px = vUv * uRes / uScale;
  // ink: breaks in depth (silhouettes, steps) and in value (painted edges), one sample ring at the line width
  float iw = mix(uInkW[0], uInkW[1], uW) * uScale;
  vec2 o = iw / uRes;
  float z = lz(vUv), zl = lz(vUv - vec2(o.x, 0.0)), zr = lz(vUv + vec2(o.x, 0.0)), zd = lz(vUv - vec2(0.0, o.y)), zu = lz(vUv + vec2(0.0, o.y));
  float lz0 = log(z);
  float dz = max(max(abs(log(zl) - lz0), abs(log(zr) - lz0)), max(abs(log(zd) - lz0), abs(log(zu) - lz0)));
  float crease = abs(log(zl) + log(zr) - 2.0 * lz0) + abs(log(zd) + log(zu) - 2.0 * lz0);
  float ll = dot(texture2D(tDiffuse, vUv - vec2(o.x, 0.0)).rgb, LW), lr = dot(texture2D(tDiffuse, vUv + vec2(o.x, 0.0)).rgb, LW);
  float ld = dot(texture2D(tDiffuse, vUv - vec2(0.0, o.y)).rgb, LW), lu = dot(texture2D(tDiffuse, vUv + vec2(0.0, o.y)).rgb, LW);
  float dl = abs(lr - ll) + abs(lu - ld);
  float l = (dot(c, LW) * 2.0 + ll + lr + ld + lu) / 6.0;
  float far = smoothstep(60.0, 320.0, z);            // distant detail turns to noise: let the far field go line-free
  // silhouettes carry the line; value breaks only where they are strong (a painted edge), so leaf and grass grain stay unlined
  float edge = max(smoothstep(0.08, 0.2, dz), smoothstep(0.03, 0.08, crease) * 0.55);
  edge = max(edge, smoothstep(0.32, 0.6, dl) * 0.5) * (1.0 - far * 0.9);
  vec3 a = fuse(0, c, l, px, edge, uCenter), b = uW > 0.001 ? fuse(1, c, l, px, edge, uCenter) : a;
  vec3 f = mix(a, b, uW);
  // printed paper: a faint tooth so the flat bands read as ink on stock, not as a screen
  f *= 0.97 + 0.05 * hsh(floor(px * 0.75));
  gl_FragColor = vec4(mix(c, f, uAmt), src.a);
}`;

class FusionPass extends Pass {
  constructor(depth) {
    super(); this.needsSwap = true; this.enabled = false;
    const U = this.u = {
      ...camU(), tDiffuse: { value: null }, tDepth: { value: depth }, uRes: { value: new THREE.Vector2(1, 1) }, uCenter: { value: new THREE.Vector2() },
      uScale: { value: 1 }, uTime: { value: 0 }, uW: { value: 0 }, uAmt: { value: 1 },
      uRamp: { value: Array.from({ length: 12 }, () => new THREE.Color()) }, uInk: { value: [new THREE.Color(), new THREE.Color()] }, uPatC: { value: [new THREE.Color(), new THREE.Color()] },
      uInkW: { value: [1, 1] }, uPat: { value: [0, 0] }, uKeep: { value: [0, 0] }, uBands: { value: [4, 4] }, uGainF: { value: [1, 1] },
    };
    this.q = fsq(U, FUSION_FS);
  }
  setSize(w, h) { this.u.uRes.value.set(w, h); this.u.uScale.value = Math.max(h / 1080, .5); }
  render(renderer, writeBuffer, readBuffer) {
    this.u.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.q.render(renderer);
  }
}

const _fuP = V3(), _fuV = new THREE.Vector2();
// the two chapters in play and their blend, the camera, and where the ring stage sits on screen (the op-art centre)
function updateFusion(PP, w, cam, rt) {
  const F = PP.fusion, on = PARAM.style === 'fusion' && QUAL[PARAM.quality].fusion && !SAFE.post;
  F.enabled = on; if (!on) return false;
  let a = -1, b = -1; for (let i = 0; i < 8; i++) if (w[i] > 0) { if (a < 0) a = i; else b = i; }
  if (b < 0) b = a;
  const U = F.u, wb = a === b ? 0 : w[b] / (w[a] + w[b]);
  [a, b].forEach((k, j) => {
    const f = FUSION_C[k];
    for (let i = 0; i < 6; i++) U.uRamp.value[j * 6 + i].copy(f.rampC[i]);
    U.uInk.value[j].copy(f.inkC); U.uPatC.value[j].copy(f.patCC);
    U.uInkW.value[j] = f.inkW; U.uPat.value[j] = f.pat; U.uKeep.value[j] = f.keep; U.uBands.value[j] = f.bands; U.uGainF.value[j] = f.gain;
  });
  U.uW.value = wb; U.uTime.value = rt; U.uAmt.value = PARAM.grade > 0 ? 1 : 0;
  const th = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  U.uNear.value = cam.near; U.uFar.value = cam.far; U.uTanHalf.value.set(th * cam.aspect, th);
  // op-art rings centre on the ring stage when it is in view, else on the frame
  _fuP.set(0, HP, 0); const vis = screenOf(cam, _fuP, _fuV);
  U.uCenter.value.set(lerp(.5, _fuV.x, vis > .5 ? 1 : 0), lerp(.5, _fuV.y, vis > .5 ? 1 : 0)).multiply(U.uRes.value).divideScalar(U.uScale.value);
  return true;
}
