/* =========================================================================
   STYLES — three more ways to see the world, each one full-screen pass after
   the grade (Medium and High), chosen under Controls → Render style:

   SUMI & SHU (ink and vermilion). Hasegawa Tōhaku's Pine Trees, where forms
     dissolve into mist and empty paper does the work; Sesshū's broken-ink
     landscapes; Ōkami's celestial brush; Kurosawa's single colour (Ran, and
     Ghost of Tsushima's Kurosawa Mode). Sumi wash on rice paper, distance
     turns to mist, a pressure-varied brush outline, and one colour allowed
     to survive: vermilion (shu) for fire, lamps and sindoor. Signed with a
     red hanko seal bearing the ring.

   CHUNGKING NEON. Christopher Doyle and Wong Kar-wai: one colour owning the
     frame against one contrasting colour, step-printed motion smeared into
     streaks (Chungking Express, Fallen Angels); Deakins' sodium and magenta
     in Blade Runner 2049; Akira's red. The chapter's key colour becomes the
     neon, its counter the fluorescent or sodium second colour; film halation
     around lights, anamorphic streaks, 2.39:1 scope bars, heavy grain.

   PAINTED LIGHT. Kazuo Oga's Ghibli backgrounds (wet poster-colour blends,
     shadows that stay coloured), Makoto Shinkai's light as the lead actor
     and pale, rich shade; Monet's and Van Gogh's strokes; Arcane's shaky
     hand-drawn line. Brush strokes that follow the forms, blue-violet shade
     instead of black, warm saturated light, thin wobbling coloured outlines,
     canvas weave.
   ========================================================================= */
const STYLES = {
  sumi: { name: 'Sumi & Shu', blurb: 'ink wash on rice paper, one vermilion' },
  neon: { name: 'Chungking Neon', blurb: 'one colour owns the frame, step-printed' },
  paint: { name: 'Painted Light', blurb: 'brush strokes, coloured shade, light as the actor' },
};
// Chungking Neon: per chapter, the colour that owns the frame and the colour that answers it
const NEON_PAIRS = [
  ['#ff7a2f', '#0d6b66'],   // enter: ember against teal
  ['#e0332a', '#0f6e4a'],   // gathering: In the Mood for Love's red and green
  ['#ff2e88', '#1a5c8a'],   // eclipse: Rani pink against cold cyan
  ['#5a7ae6', '#c8761e'],   // brahma: blue hour against a sodium lamp
  ['#ffc247', '#11706a'],   // diamond: gold against teal
  ['#d8342b', '#2f8a3a'],   // dispersal: Chungking's fluorescent green
  ['#ffd23a', '#2a7a5a'],   // zero shadow: the snack bar's yellow and green
  ['#ff8a3a', '#1d5a78'],   // return: Las Vegas orange against blue
].map(([a, b]) => [col(a).convertLinearToSRGB(), col(b).convertLinearToSRGB()]);

const STYLE_HEAD = `${DEPTH_GLSL}
uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uScale, uTime, uDay, uAmt;
varying vec2 vUv;
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
float lz(vec2 uv){ float d = texture2D(tDepth, uv).r; return d >= 0.99999 ? 1e5 : -linZ(d); }
float lum(vec2 uv){ return dot(texture2D(tDiffuse, uv).rgb, LW); }
// silhouette strength from depth breaks, sampled at width w (px)
float depthEdge(vec2 uv, float w, out float z){
  vec2 o = w / uRes; z = lz(uv); float l0 = log(z);
  float a = log(lz(uv - vec2(o.x, 0.0))), b = log(lz(uv + vec2(o.x, 0.0))), c = log(lz(uv - vec2(0.0, o.y))), d = log(lz(uv + vec2(0.0, o.y)));
  float dz = max(max(abs(a - l0), abs(b - l0)), max(abs(c - l0), abs(d - l0)));
  float cr = abs(a + b - 2.0 * l0) + abs(c + d - 2.0 * l0);
  return max(smoothstep(0.08, 0.2, dz), smoothstep(0.03, 0.08, cr) * 0.5);
}`;

const SUMI_FS = `${STYLE_HEAD}
uniform vec3 uPaper, uInk, uShu;
void main(){
  vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb;
  vec2 px = vUv * uRes / uScale;
  float l = dot(c, LW);
  // night renders are dim: lift them so the wash still has a range (ink paintings of night are still on paper)
  float lg = clamp(l * mix(3.0, 1.15, uDay), 0.0, 1.0);
  // ink density in a few soft washes: the pooled edge of each wash a touch darker, as wet ink dries
  float d = pow(1.0 - lg, 1.4), x = d * 4.0, f = fract(x);
  d = (floor(x) + smoothstep(0.3, 0.7, f)) / 4.0 + 0.05 * smoothstep(0.62, 0.7, f) * (1.0 - smoothstep(0.7, 0.85, f));
  // Tohaku's mist: distance dissolves into the paper, and the ground fog with it
  float z; float edge = depthEdge(vUv, 1.3 * uScale, z);
  // (the sky keeps half its ink: a night sky or the eclipse's void stays a wash, not blank paper)
  float mist = z > 9e4 ? 0.45 : smoothstep(18.0, 240.0, z);
  d *= 1.0 - 0.9 * mist;
  // brush: pressure swells and dries along the stroke (broken ink, hatsuboku)
  float pres = vn(px * 0.045 + 7.0), dry = step(0.28, vn(px * vec2(0.6, 0.09)) * 0.6 + pres * 0.6);
  edge *= (0.55 + 0.7 * pres) * dry * (1.0 - 0.95 * mist);
  vec3 paper = uPaper * mix(0.8, 1.0, uDay) * (0.965 + 0.05 * vn(px * vec2(0.9, 0.08)) + 0.025 * hsh(floor(px)));
  vec3 o = mix(paper, uInk, clamp(d + edge * 0.85, 0.0, 1.0));
  // the one colour: warm, saturated light or pigment becomes vermilion; everything else is ink
  float mx = max(c.r, max(c.g, c.b)), sat = mx - min(c.r, min(c.g, c.b));
  float warm = smoothstep(0.12, 0.3, c.r - max(c.g * 0.92, c.b)) * smoothstep(0.18, 0.4, sat);
  float lamp = smoothstep(0.72, 0.95, l) * step(c.b * 1.1, c.r);
  o = mix(o, uShu * (0.85 + 0.25 * pres), clamp(max(warm, lamp), 0.0, 1.0) * (1.0 - 0.6 * mist));
  // the seal: a vermilion hanko with the ring cut into it, bottom right
  vec2 sp = vUv * uRes - vec2(uRes.x - 70.0 * uScale, 70.0 * uScale); float s = 26.0 * uScale;
  vec2 q = abs(sp) - s; float box = max(q.x, q.y) + (vn(sp * 0.35) - 0.5) * 2.0 * uScale;
  float ring = abs(length(sp) - s * 0.55) - s * 0.12;
  float seal = (1.0 - smoothstep(-0.5, 0.5, box)) * smoothstep(-0.5, 0.5, ring);
  o = mix(o, uShu * (0.9 + 0.15 * hsh(floor(sp * 0.5))), seal * 0.92);
  gl_FragColor = vec4(mix(c, o, uAmt), src.a);
}`;

const NEON_FS = `${STYLE_HEAD}
uniform vec3 uKeyC, uCounter, uHal, uStreak; uniform float uBars;
void main(){
  vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb;
  float l = dot(c, LW);
  // one colour owns the frame: shade drowns in the counter colour, light in the key, the mid keeps a little of itself
  // by day the shade sits higher, and the light keeps more of itself, so the second colour still lives in the shadows
  float t = smoothstep(mix(0.06, 0.22, uDay), mix(0.75, 0.95, uDay), l);
  vec3 tint = mix(uCounter * mix(1.9, 2.0, uDay), uKeyC * mix(1.7, 1.3, uDay), t);
  vec3 o = mix(c * tint, c, 0.22 + 0.3 * uDay * smoothstep(0.55, 1.0, l));
  float ol = dot(o, LW); o = mix(vec3(ol), o, 1.35);                  // saturated, as on reversal stock pushed a stop
  o = smoothstep(vec3(0.035), vec3(0.95), o);                          // crushed blacks, rolled whites
  // film halation: light that bounced off the film base, a red-orange fringe around anything bright
  vec2 r = 6.0 * uScale / uRes; float h = 0.0;
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; h += max(lum(vUv + vec2(cos(a), sin(a)) * r) - 0.78, 0.0); }
  o += uHal * max(h / 6.0 - max(l - 0.78, 0.0) * 0.5, 0.0) * 1.6;
  // anamorphic streak: bright points pulled sideways into a thin blue line
  float s = 0.0;
  for (int i = 0; i < 4; i++) { float d = (14.0 + 34.0 * float(i * i)) * uScale / uRes.x, w = 1.0 - float(i) * 0.22;
    s += (max(lum(vUv + vec2(d, 0.0)) - 0.85, 0.0) + max(lum(vUv - vec2(d, 0.0)) - 0.85, 0.0)) * w; }
  o += uStreak * s * 0.45;
  // grain, heavy and alive
  vec2 px = vUv * uRes;
  o += (hsh(px + fract(uTime * 23.0) * 91.0) - 0.5) * 0.075 * (1.0 - 0.5 * t);
  // scope: 2.39:1 bars on anything squarer
  float bar = step(vUv.y, uBars) + step(1.0 - uBars, vUv.y);
  o = mix(o, vec3(0.0), clamp(bar, 0.0, 1.0));
  gl_FragColor = vec4(mix(c, clamp(o, 0.0, 1.0), uAmt), src.a);
}`;

const PAINT_FS = `${STYLE_HEAD}
uniform vec3 uShade, uWarm;
void main(){
  vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb;
  vec2 px = vUv * uRes / uScale, tx = 1.0 / uRes;
  // stroke direction: along the form (perpendicular to the value gradient); in flat areas each dab takes its own angle
  float g = 2.0 * uScale;
  vec2 gr = vec2(lum(vUv + vec2(g, 0.0) * tx) - lum(vUv - vec2(g, 0.0) * tx), lum(vUv + vec2(0.0, g) * tx) - lum(vUv - vec2(0.0, g) * tx));
  vec2 cell = floor(px / 9.0); float hh = hsh(cell), an = hh * 6.2831;
  vec2 dir = length(gr) > 0.02 ? normalize(vec2(-gr.y, gr.x)) : vec2(cos(an), sin(an));
  float len = (1.4 + 1.2 * hh) * uScale;   // a stroke about 8 to 16 px long at 1080p: longer ones wiped out the carved relief
  vec3 b = vec3(0.0);
  for (int i = -3; i <= 3; i++) b += texture2D(tDiffuse, vUv + dir * float(i) * len * tx).rgb;
  b /= 7.0;
  b = mix(b, c, smoothstep(0.025, 0.12, length(gr)) * 0.6);   // detail stays tighter, as a painter renders the carving and loosens the field
  float l = dot(b, LW);
  // Ghibli light and shade: a soft two-tone split, but the shade stays coloured and pale (blue-violet, lifted), the light warm
  float lit = smoothstep(0.24, 0.42, l);
  vec3 shade = mix(b, b * uShade * 1.6 + uShade * 0.06, 0.65);
  vec3 light = b * uWarm;
  vec3 o = mix(shade, light, mix(lit, l, 0.45));
  float ol = dot(o, LW); o = mix(vec3(ol), o, mix(1.25, 1.5, uDay));   // poster colour: rich by day, softer at night
  // sky: Shinkai's deep, saturated gradient
  float z; float edge = depthEdge(vUv + (vec2(vn(px * 0.07), vn(px * 0.07 + 13.0)) - 0.5) * 2.4 * uScale * tx, 1.1 * uScale, z);
  float sky = step(9e4, z); o = mix(o, mix(vec3(dot(o, LW)), o, 1.25), sky);
  // light is the actor: a soft warm bloom off the brightest strokes
  o += uWarm * smoothstep(0.7, 1.0, l) * 0.12;
  // a thin shaky line in the local colour, darkened, never black; it thins out with distance
  edge *= 1.0 - smoothstep(40.0, 220.0, z);
  o = mix(o, b * 0.42 * mix(vec3(1.0), uShade, 0.5), edge * 0.75);
  // canvas weave under the paint
  o *= 1.0 + 0.022 * sin(px.x * 2.1) * sin(px.y * 2.1) + 0.02 * (hsh(cell + 3.0) - 0.5);
  // a soft shoulder instead of a hard clip: bright stone keeps its carving, as a painter keeps detail in the lights
  vec3 k = max(o - 0.78, 0.0); o = min(o, 0.78) + k / (1.0 + k / 0.2);
  gl_FragColor = vec4(mix(c, clamp(o, 0.0, 1.0), uAmt), src.a);
}`;

class StylePass extends Pass {
  constructor(depth) {
    super(); this.needsSwap = true; this.enabled = false; this.mode = 'sumi';
    const U = this.u = {
      ...camU(), tDiffuse: { value: null }, tDepth: { value: depth }, uRes: { value: new THREE.Vector2(1, 1) }, uScale: { value: 1 }, uTime: { value: 0 }, uDay: { value: 1 }, uAmt: { value: 1 },
      uPaper: { value: col('#ebe3d0').convertLinearToSRGB() }, uInk: { value: col('#16130f').convertLinearToSRGB() }, uShu: { value: col('#c8321e').convertLinearToSRGB() },
      uKeyC: { value: new THREE.Color() }, uCounter: { value: new THREE.Color() }, uHal: { value: col('#ff3a1a').convertLinearToSRGB() }, uStreak: { value: col('#4a9cff').convertLinearToSRGB() }, uBars: { value: 0 },
      uShade: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() },
    };
    this.q = { sumi: fsq(U, SUMI_FS), neon: fsq(U, NEON_FS), paint: fsq(U, PAINT_FS) };
  }
  setSize(w, h) { this.u.uRes.value.set(w, h); this.u.uScale.value = Math.max(h / 1080, .5); }
  render(renderer, writeBuffer, readBuffer) {
    this.u.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.q[this.mode].render(renderer);
  }
}

const _stA = new THREE.Color(), _stB = new THREE.Color();
const PAINT_SHADE_D = col('#7a86d8'), PAINT_SHADE_N = col('#4a4f9a'), PAINT_WARM_D = col('#fff0d8'), PAINT_WARM_N = col('#ffd8b0');
function updateStyles(PP, look, w, cam, rt) {
  const P = PP.styles, on = !!STYLES[PARAM.style] && QUAL[PARAM.quality].fusion && !SAFE.post;
  P.enabled = on; if (!on) return false;
  const U = P.u; P.mode = PARAM.style;
  const day = smooth(-.12, .06, S.sunDir.y);
  U.uDay.value = day; U.uTime.value = rt; U.uAmt.value = PARAM.grade > 0 ? 1 : 0;
  const th = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  U.uNear.value = cam.near; U.uFar.value = cam.far; U.uTanHalf.value.set(th * cam.aspect, th);
  if (P.mode === 'neon') {
    _stA.setRGB(0, 0, 0); _stB.setRGB(0, 0, 0);
    for (let i = 0; i < 8; i++) if (w[i] > 0) { _stA.add(_tmpC.copy(NEON_PAIRS[i][0]).multiplyScalar(w[i])); _stB.add(_tmpC.copy(NEON_PAIRS[i][1]).multiplyScalar(w[i])); }
    U.uKeyC.value.copy(_stA); U.uCounter.value.copy(_stB);
    const asp = U.uRes.value.x / U.uRes.value.y; U.uBars.value = asp < 2.39 ? (1 - asp / 2.39) / 2 : 0;
    // step printing: every moving thing drags its last frames behind it
    PP.after.uniforms.damp.value = Math.max(PP.after.uniforms.damp.value, .62); PP.after.enabled = true;
  } else if (P.mode === 'paint') {
    U.uShade.value.copy(PAINT_SHADE_N).lerp(PAINT_SHADE_D, day).convertLinearToSRGB();
    U.uWarm.value.copy(PAINT_WARM_N).lerp(PAINT_WARM_D, day).convertLinearToSRGB();
  }
  return true;
}
