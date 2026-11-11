/* =========================================================================
   JOURNEY — the world as a desert, after thatgamecompany's game, in Mark Maggiori's colours.

   Restraint makes that picture, so this style takes away more than it adds. While it is on:
   - the ground is one sea of dunes to the horizon, sandstone buttes standing in it, and one great mountain far off carrying a
     column of light (the destination, seen from everywhere); the old ground is kept only where the ruins stand;
   - the sand is shaded as the game's GDC 2013 talk describes: a smooth surface with a bump for wind ripples and grain, a rim
     shimmer on the dune edge, an ocean-style specular, and glitter from single grains. It reads no textures;
   - everything that is the festival and not the ruin is out of view: forest, grass, city, bunting, lamps, birds, fireflies. What
     stays is each chapter's signature stone: the portal wheel and its shikharas, the stage ring, the stone circle, the arches,
     the plaza wheel, the temple; they get the texture budget the rest gave up;
   - every chapter is a short colour script (cobalt sky, layered cumulus lit gold and pink with violet bases, red-orange earth,
     blue-violet shade), not a render of that hour.
   Layers and flags take things in and out: the other styles come back untouched.
   ========================================================================= */
const JD = { wind: [.84, .54], M: { x: 720, z: -560, h: 340, r: 430 }, R: 1600, layer: 4, mesh: null, beam: null, built: false, nChildren: -1, dirty: true };
const JKEEP_SCAN = new Set(['heritage']);
const JHIDE_SYS = new Set(['forest', 'city', 'grass', 'decor']);
const jt = (o, v) => { o.userData.j = v; return o; };   // 'hide': out of view in Journey; 'keep': never hidden; 'only': shown only in Journey

/* ---------- the ground ---------- */
function duneRaw(x, z) {
  const a = x * JD.wind[0] + z * JD.wind[1], b = -x * JD.wind[1] + z * JD.wind[0];
  const warp = (fbm(x * .0045 + 11, z * .0045 - 5, 3) - .5) * 190;
  const L = 112 + 38 * (fbm(b * .004 + 3, 7.5, 2) - .5);
  const ph = (a + warp + 40 * Math.sin(b * .011)) / L, f = ph - Math.floor(ph);
  const prof = f < .74 ? Math.pow(f / .74, 1.35) : Math.pow(1 - (f - .74) / .26, 2.1);      // a gentle windward back, a steep lee face
  const amp = 6.2 * (.5 + fbm(b * .0055 + 9, a * .002 - 2, 2));
  const f2 = (x * .31 - z * .95 + (fbm(x * .01 + 1, z * .01, 2) - .5) * 60) / 47, g = f2 - Math.floor(f2);
  const prof2 = g < .7 ? Math.pow(g / .7, 1.3) : Math.pow(1 - (g - .7) / .3, 2);
  return 2.5 + amp * prof + 1.7 * prof2 * fbm(x * .006 - 4, z * .006 + 8, 2) + 2.2 * fbm(x * .02 + 2, z * .02 - 9, 3);
}
// the great mountain: a massif of ridged noise (never a cone), and a low range all round beyond the dunes
function mountainRaw(x, z) {
  const M = JD.M, d = Math.hypot(x - M.x, z - M.z);
  let big = 0;
  if (d < M.r * 1.3) {
    const env = Math.pow(Math.max(0, 1 - d / M.r * .96), 1.05);
    const wx = x + (fbm(x * .004 + 2, z * .004 - 9, 3) - .5) * 160, wz = z + (fbm(x * .004 - 6, z * .004 + 4, 3) - .5) * 160;
    const rid = 1 - Math.abs(2 * fbm(wx * .0075 + 4, wz * .0075 - 3, 5) - 1), rid2 = 1 - Math.abs(2 * fbm(wx * .019 + 9, wz * .019 - 7, 4) - 1);
    const sh = Math.max(0, 1 - Math.hypot(x - (M.x - 170), z - (M.z + 120)) / 250);
    big = M.h * env * (.18 + .95 * rid * rid + .18 * rid2 * rid) + M.h * .45 * Math.pow(sh, 1.4) * (.5 + .6 * rid);
  }
  const r = Math.hypot(x, z), ring = smooth(420, 700, r) * (1 - .55 * smooth(1150, 1500, r)) * (40 + 80 * fbm(Math.atan2(z, x) * 3 + 5, r * .003, 4));
  return big + ring + (fbm(x * .01 + 4, z * .01 - 3, 4) - .5) * (big * .06 + ring * .3);
}
function mountainSummit() {
  let bx = JD.M.x, bz = JD.M.z, bh = -1;
  for (let k = 0; k < 2; k++) { const st = k ? 8 : 40, R = k ? 50 : 200, cx = bx, cz = bz;
    for (let i = -R; i <= R; i += st) for (let j = -R; j <= R; j += st) { const h = mountainRaw(cx + i, cz + j); if (h > bh) { bh = h; bx = cx + i; bz = cz + j; } } }
  return { x: bx, z: bz };
}
// where the old, flat ground is kept: clearing, ridge circle, forecourt and stairs, plaza wheel, temple hill
function journeyMask(x, z) {
  let m = 0;
  const dC = Math.hypot(x, z); if (dC < 112) m = 1 - smooth(48, 112, dC);
  const dR = Math.hypot(x - GEO.R.x, z - GEO.R.z); if (dR < 72) m = Math.max(m, 1 - smooth(22, 72, dR));
  const dP = Math.hypot(x - GEO.P.x, z - GEO.P.z); if (dP < 104) m = Math.max(m, 1 - smooth(50, 104, dP));
  const dT = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); if (dT < 96) m = Math.max(m, 1 - smooth(44, 96, dT));
  if (x < -20 && x > -150 && z > -46 && z < 46) m = Math.max(m, (1 - smooth(18, 46, Math.abs(z))) * smooth(-150, -112, x) * (1 - smooth(-48, -20, x)));
  return m;
}
function journeyGround(x, z) { const m = journeyMask(x, z), h = duneRaw(x, z) + mountainRaw(x, z); return m > 0 ? lerp(h, terrainRaw(x, z), m) : h; }
// buttes (x, z, radius, height): a height field can't hold a cliff, so each is its own mesh
const JBUTTE = [[-300, -170, 46, 150], [-380, 120, 38, 112], [262, 330, 54, 176], [430, 70, 40, 124], [-150, -430, 62, 196], [120, -385, 36, 118], [-530, -30, 58, 160], [340, -325, 44, 138], [-250, 360, 40, 120]];
function buildButte(R, H, seed) {
  const S = 48, K = 40, pos = new Float32Array(((K + 1) * (S + 1) + 1) * 3), idx = [];
  const ledges = [.34 + .04 * Math.sin(seed), .58 + .05 * Math.cos(seed * 1.7), .8 + .03 * Math.sin(seed * 2.3)];
  for (let k = 0; k <= K; k++) {
    const v = k / K; let f = (1 + .95 * Math.pow(1 - smooth(0, .24, v), 2.2)) * (1 - .1 * v);       // a talus flare, then a near-vertical wall
    for (const L of ledges) f += .07 * smooth(L - .012, L, v) * (1 - smooth(L, L + .1, v));
    for (let i = 0; i <= S; i++) {
      const a = (i % S) / S * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const n = fbm(ca * 1.7 + seed * 3.1, sa * 1.7 + v * 2.2 + seed, 3), flute = .05 * Math.sin(a * 11 + seed * 5) * smooth(.2, .6, v) + .04 * Math.sin(a * 23 + seed + v * 9);
      const r = R * f * (.74 + .55 * n + flute), o = (k * (S + 1) + i) * 3;
      pos[o] = ca * r; pos[o + 1] = v * H; pos[o + 2] = sa * r;
    }
  }
  const c = (K + 1) * (S + 1); pos[c * 3 + 1] = H * 1.006;
  for (let k = 0; k < K; k++) for (let i = 0; i < S; i++) { const a = k * (S + 1) + i, b = a + 1, d = a + S + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  for (let i = 0; i < S; i++) idx.push(K * (S + 1) + i, K * (S + 1) + i + 1, c);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nr = g.attributes.normal;       // weld the seam's normals
  for (let k = 0; k <= K; k++) { const a = k * (S + 1), b = a + S, x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }
  return g;
}

/* ---------- the look: eight colour scripts over the festival's ---------- */
const JOVR = [
  { skyZen: '#1b2a78', skyHor: '#ff8a4a', skyGlow: '#ffc060', cloud: '#ffbe78', cloudB: '#5a3a8e', mid: '#a04a98', cloudAmt: .72, fog: '#a8586c', fogD: .0013, sun: '#ff9444', sunI: 2.4, hemiS: '#6a4ac8', hemiG: '#a04a2c', hemiI: .95,
    lift: '#0a0612', gain: '#ffd6b0', sat: 1.3, con: 1.18, vig: .45, stars: .3, dust: .5, mist: .08, fogY: -10, fogH: 30, fogS: 8, scat: .55, shade: '#4a2a96', hilite: '#ff9638', sand: '#c4571c', beam: '#ffd9a0', beamI: .6, glit: 1 },
  { skyZen: '#0a1240', skyHor: '#5a2a6a', skyGlow: '#8a4a9a', cloud: '#8a76d8', cloudB: '#1a1a58', mid: '#2a1a6a', cloudAmt: .38, fog: '#2a2058', fogD: .0014, sun: '#a090e8', sunI: 2.6, hemiS: '#6a72e0', hemiG: '#33205a', hemiI: 2.0,
    lift: '#060510', gain: '#d8d0ff', sat: 1.25, con: 1.15, vig: .5, stars: .9, dust: .25, mist: .04, fogY: -10, fogH: 20, fogS: 6, scat: .4, shade: '#2a2a88', hilite: '#c8a8ff', sand: '#8a6ad8', beam: '#c8b0ff', beamI: .9, glit: 1.3 },
  { skyZen: '#03071c', skyHor: '#16325e', skyGlow: '#4a70b8', cloud: '#7a98d0', cloudB: '#0c1844', mid: '#0a1a40', cloudAmt: .3, fog: '#10244a', fogD: .001, sun: '#b0cdff', sunI: 2.0, hemiS: '#4a70d0', hemiG: '#0c1430', hemiI: 1.5,
    lift: '#02030a', gain: '#dce8ff', sat: 1.15, con: 1.2, vig: .55, stars: .9, dust: 0, mist: .1, fogY: -10, fogH: 20, fogS: 6, scat: .4, shade: '#1e3a8c', hilite: '#eaf2ff', sand: '#6a8ae0', beam: '#a8c8ff', beamI: .8, glit: 1.9 },
  { skyZen: '#142c60', skyHor: '#f08a78', skyGlow: '#ffb8a0', cloud: '#ffb4a4', cloudB: '#34468a', mid: '#7a5aa0', cloudAmt: .55, fog: '#5a5a96', fogD: .0012, sun: '#ffa890', sunI: 1.8, hemiS: '#6a7ad0', hemiG: '#3a2448', hemiI: 1.4,
    lift: '#06101e', gain: '#ffd8d0', sat: 1.25, con: 1.15, vig: .45, stars: .55, trail: .3, milky: .4, dust: 0, mist: .3, fogY: 5, fogH: 20, fogS: 6, scat: .45, shade: '#2e3a96', hilite: '#ffb0a0', sand: '#b86a8a', beam: '#ffe0d0', beamI: .8, glit: 1.3 },
  { skyZen: '#2862c8', skyHor: '#ffc070', skyGlow: '#fff0c0', cloud: '#ffd6a0', cloudB: '#6a5a9e', mid: '#f0a0a4', cloudAmt: .7, fog: '#d89c82', fogD: .0012, sun: '#ffe6c0', sunI: 2.6, hemiS: '#7aa0e8', hemiG: '#b0703a', hemiI: 1.0,
    lift: '#0c0608', gain: '#fff0dc', sat: 1.35, con: 1.2, vig: .3, dust: .35, mist: .06, fogY: 4, fogH: 30, fogS: 10, scat: .25, shade: '#4a3ea8', hilite: '#ffb050', sand: '#e6782a', beam: '#fff0c0', beamI: .5, glit: 1.2 },
  { skyZen: '#1c5ec8', skyHor: '#d0e4f4', skyGlow: '#fff6dc', cloud: '#fff8ea', cloudB: '#7c84bc', mid: '#68a8e8', cloudAmt: .72, fog: '#9cb6d6', fogD: .0011, sun: '#fff0d8', sunI: 2.6, hemiS: '#7aa2ea', hemiG: '#b8703a', hemiI: 1.0,
    lift: '#0a0806', gain: '#fff8ee', sat: 1.32, con: 1.18, vig: .28, dust: .45, mist: 0, fogY: -10, fogH: 30, fogS: 12, scat: .12, shade: '#4a56b0', hilite: '#ffbe60', sand: '#e0722a', beam: '#fff2d0', beamI: .35, glit: 1 },
  { skyZen: '#1860c8', skyHor: '#cce2f2', skyGlow: '#fffaf0', cloud: '#ffffff', cloudB: '#8088c0', mid: '#68a8e8', cloudAmt: .78, fog: '#a0b8d8', fogD: .001, sun: '#fff6e4', sunI: 2.7, hemiS: '#80a8ee', hemiG: '#c07838', hemiI: 1.1,
    lift: '#0a0a0e', gain: '#fff6e8', sat: 1.3, con: 1.14, vig: .22, paper: 0, dust: .3, mist: 0, fogY: -10, fogH: 30, fogS: 12, scat: .1, shade: '#4a5ab4', hilite: '#ffc060', sand: '#e48430', beam: '#fffbe8', beamI: .3, glit: .9 },
  { skyZen: '#26388c', skyHor: '#ff9a50', skyGlow: '#ffd080', cloud: '#ffc674', cloudB: '#563a7e', mid: '#a05a9c', cloudAmt: .75, fog: '#c47c88', fogD: .0014, sun: '#ffa044', sunI: 2.6, hemiS: '#6a6ccc', hemiG: '#6a3a1e', hemiI: .85,
    lift: '#0c0608', gain: '#ffdcb0', sat: 1.35, con: 1.2, vig: .38, dust: .6, mist: .1, fogY: -10, fogH: 30, fogS: 8, scat: .55, shade: '#4a3a9a', hilite: '#ffa040', sand: '#cc6428', beam: '#ffdca0', beamI: .5, glit: 1.1 },
];
// shared by every chapter: no festival fire, petals, streaks, afterimage or film grain; a poster sky, not the physical one
const JCOMMON = { grain: 0, fire: 0, petals: 0, after: 0, streakG: 0, streakE: 0, practicalI: 0, phys: 0, mie: .85, envI: .5, banner: '#c0392b' };
const JLOOKC = LOOKS.map((L, i) => { const M = Object.assign({}, L, JCOMMON, JOVR[i]), o = {}; for (const k of LOOK_KEYS) o[k] = typeof M[k] === 'string' ? col(M[k]) : M[k]; return o; });
const JX = JOVR.map(L => ({ sand: col(L.sand), beam: col(L.beam), mid: col(L.mid), cloudB: col(L.cloudB), beamI: L.beamI, glit: L.glit }));
const JXB = { sand: new THREE.Color(), beam: new THREE.Color(), mid: new THREE.Color(), cloudB: new THREE.Color(), beamI: 0, glit: 1 };
const JSKY = { uJ: { value: 0 }, uMid: { value: new THREE.Color('#888888') }, uCloudB: { value: new THREE.Color('#6a6aa0') } };
function journeyBlend(w) {
  for (const k of ['sand', 'beam', 'mid', 'cloudB']) JXB[k].setRGB(0, 0, 0); JXB.beamI = 0; JXB.glit = 0;
  for (let i = 0; i < 8; i++) if (w[i] > 0) { const x = JX[i], k = w[i]; for (const c of ['sand', 'beam', 'mid', 'cloudB']) JXB[c].add(_tmpC.copy(x[c]).multiplyScalar(k)); JXB.beamI += x.beamI * k; JXB.glit += x.glit * k; }
  return JXB;
}

/* ---------- the sand and the rock ---------- */
const JU = { uTime: { value: 0 }, uSand: { value: new THREE.Color('#d9a45c') }, uRock: { value: new THREE.Color('#8a6a52') }, uRim: { value: .5 }, uSpec: { value: .5 }, uGlit: { value: 1 }, uPx: { value: .002 }, uWind: { value: new THREE.Vector2(JD.wind[0], JD.wind[1]) } };
function sandMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, JU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP, vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uTime, uRim, uSpec, uGlit, uPx; uniform vec3 uSand, uRock; uniform vec2 uWind; varying vec3 vWP, vWN;
      float sH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sH(i), sH(i + vec2(1.0, 0.0)), f.x), mix(sH(i + vec2(0.0, 1.0)), sH(i + vec2(1.0, 1.0)), f.x), f.y); }
      vec3 sH3(vec2 p){ return vec3(sH(p), sH(p + 17.3), sH(p + 41.7)); }
      float sHf(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float sN3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(sHf(i), sHf(i + vec3(1,0,0)), f.x), mix(sHf(i + vec3(0,1,0)), sHf(i + vec3(1,1,0)), f.x), f.y), mix(mix(sHf(i + vec3(0,0,1)), sHf(i + vec3(1,0,1)), f.x), mix(sHf(i + vec3(0,1,1)), sHf(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float rockM = max(1.0 - smoothstep(.5, .86, vWN.y), smoothstep(30.0, 170.0, vWP.y) * .85);
      { vec2 p = vWP.xz; vec3 sand = uSand * (0.88 + 0.24 * (sN(p * .006) * .6 + sN(p * .031 + 7.0) * .4));
        vec3 rock = sand;
        if (rockM > .01) {   // sandstone: beds that follow the height, each a slightly different red, and dark streaks of desert varnish
          float sb = vWP.y * 1.15 + 2.4 * sN3(vWP * .07), strata = .78 + .3 * sH(vec2(floor(sb), 3.1)) + .12 * sin(sb * 6.2832);
          float varnish = smoothstep(.55, .85, sN3(vec3(vWP.x * .55, vWP.y * .05, vWP.z * .55))) * .38;
          rock = uRock * strata * (1.0 - varnish) * (0.85 + 0.3 * sN3(vWP * .22)); }
        diffuseColor.rgb = mix(sand, rock, rockM); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 nGeo = normal;
      { vec2 p = vWP.xz; float dist = length(vViewPosition);
        float ph = (dot(p, uWind) + 3.2 * sN(p * .08) + 1.4 * sN(p * .35)) * 7.0;                       // wind ripples, faded before they can alias
        float rg = cos(ph) * .42 * (1.0 - smoothstep(18.0, 110.0, dist)) * (1.0 - rockM);
        vec3 gr = (sH3(floor(p * 38.0)) - .5) * (1.0 - smoothstep(4.0, 28.0, dist)) * .3;                 // the grain, close up
        vec3 dW = vec3(-uWind.x * rg - gr.x, 0.0, -uWind.y * rg - gr.z);
        if (rockM > .02 && dist < 220.0) { vec3 rp = vWP * .5; float r0 = sN3(rp);                        // rock: a rough bedded surface
          dW -= vec3(sN3(rp + vec3(.25, 0.0, 0.0)) - r0, (sN3(rp + vec3(0.0, .25, 0.0)) - r0) * .5, sN3(rp + vec3(0.0, 0.0, .25)) - r0) * 3.6 * rockM * (1.0 - smoothstep(20.0, 220.0, dist)); }
        normal = normalize(normal + (viewMatrix * vec4(dW, 0.0)).xyz); }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
      { vec3 L = directionalLights[0].direction, sc = directionalLights[0].color, V = normalize(vViewPosition); float dist = length(vViewPosition), shK = 1.0;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        { DirectionalLightShadow dls = directionalLightShadows[ 0 ]; shK = getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] ); }
        #endif
        float rim = pow(1.0 - saturate(dot(nGeo, V)), 3.0) * saturate(dot(nGeo, L) + .25);                 // holds the dunes apart in the distance
        float sp = pow(saturate(dot(normal, normalize(L + V))), 140.0) * saturate(dot(nGeo, L) * 4.0);
        float cell = max(.04, dist * uPx * 1.5); vec3 r3 = sH3(floor(vWP.xz / cell));                      // glitter: a grain is never under ~1.5 px, so it holds still
        vec3 gN = normalize((viewMatrix * vec4(normalize(vec3(r3.x - .5, .55 + r3.y * .6, r3.z - .5)), 0.0)).xyz);
        float spark = smoothstep(.9962, 1.0, dot(reflect(-L, gN), V)) * (.55 + .45 * sin(uTime * 3.0 + r3.x * 60.0)) * (1.0 - smoothstep(70.0, 260.0, dist));
        reflectedLight.directSpecular += sc * (rim * uRim + sp * uSpec + spark * uGlit * 6.0) * shK * (.1 + .9 * (1.0 - rockM)); }
      #endif`);
  };
  m.customProgramCacheKey = () => 'journey-sand';
  m.userData.hf = 1; chainHook(m, 'hf', (sh) => Object.assign(sh.uniforms, HFOG));
  return m;
}
function buildDunes(scene) {
  const S = 256, J = 150, rr = (j) => j <= 40 ? j * 4 : 160 * Math.pow(JD.R / 160, (j - 40) / (J - 40));
  const pos = new Float32Array((J + 1) * (S + 1) * 3), nor = new Float32Array((J + 1) * (S + 1) * 3), idx = new Uint32Array(J * S * 6);
  for (let j = 0; j <= J; j++) { const r = rr(j), e = .6 + r * .004;
    for (let i = 0; i <= S; i++) {
      const a = i / S * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r, o = (j * (S + 1) + i) * 3;
      pos[o] = x; pos[o + 1] = journeyGround(x, z); pos[o + 2] = z;
      const dx = journeyGround(x + e, z) - journeyGround(x - e, z), dz = journeyGround(x, z + e) - journeyGround(x, z - e), l = Math.hypot(dx, 2 * e, dz);   // normals from the height field: no seam
      nor[o] = -dx / l; nor[o + 1] = 2 * e / l; nor[o + 2] = -dz / l;
    } }
  let k = 0;
  for (let j = 0; j < J; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), JD.R * 1.2);
  const mat = sandMaterial(), mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.sys = 'terrain'; mesh.userData.j = 'only'; scene.add(mesh); JD.mesh = mesh;
  JBUTTE.forEach(([bx, bz, R, H], i) => { const b = new THREE.Mesh(buildButte(R, H, i * 1.37 + 2.1), mat); b.position.set(bx, journeyGround(bx, bz) - 3, bz); b.castShadow = b.receiveShadow = true; b.userData.sys = 'terrain'; b.userData.j = 'only'; scene.add(b); });
  // the column of light on the summit
  const sm = mountainSummit(), H = 2400, bg = new THREE.CylinderGeometry(3.2, 12, H, 28, 1, true); bg.translate(0, H / 2, 0);
  const beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#fff0c0') }, uI: { value: .5 }, uH: { value: H } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN, vW; varying float vY; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uI, uH; varying vec3 vN, vW; varying float vY; void main(){ float f = pow(clamp(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 0.0, 1.0), 2.6); gl_FragColor = vec4(uCol * f * pow(1.0 - clamp(vY / uH, 0.0, 1.0), 1.4) * uI, 1.0); }' }));
  beam.position.set(sm.x, journeyGround(sm.x, sm.z) - 4, sm.z); beam.frustumCulled = false; beam.renderOrder = 6; beam.userData.j = 'only'; scene.add(beam); JD.beam = beam;
  JD.built = true; JD.dirty = true;
}

/* ---------- taking the festival out of the picture, and putting it back ---------- */
function journeyHidden(o, on) {
  const j = o.userData.j;
  if (j === 'only') return !on;
  if (!on || j === 'keep') return false;
  if (j === 'hide') return true;
  const s = o.userData.sys;
  return JHIDE_SYS.has(s) || (s === 'scans' && !JKEEP_SCAN.has(o.userData.scanId));
}
// hidden objects move to a layer the camera doesn't draw (the shadow pass and the lights obey it too); scans are switched off in the cull system
function journeyApply(scene) {
  const on = JRN.on, mask = 1 << JD.layer, shadowOnly = 1 << CULL.layer;
  const walk = (o, ph) => { if (o.layers.mask === shadowOnly) return; const h = ph || journeyHidden(o, on); o.layers.mask = h ? mask : 1; for (const c of o.children) walk(c, h); };
  for (const c of scene.children) walk(c, false);
  for (const it of CULL.items) it.off = on && !JKEEP_SCAN.has(it.levels[0].userData.scanId);
  CULL.dirty = true; JD.nChildren = scene.children.length; JD.dirty = false;
}
function updateJourney(look, w, cam, rt, vhPx) {
  const X = journeyBlend(w), U = JU;
  U.uTime.value = rt; U.uSand.value.copy(X.sand).multiplyScalar(clamp(1.45 / Math.max(look.sunI, .1), .3, 1));   // the sand's brightness is set against the sun's, so noon doesn't burn to cream
  U.uRim.value = .5 + .5 * Math.min(1, look.sunI / 3); U.uSpec.value = .35 + .25 * Math.min(1, look.sunI / 3); U.uGlit.value = X.glit;
  U.uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / Math.max(vhPx, 240);
  U.uRock.value.copy(X.sand).multiplyScalar(.62).lerp(look.hemiS, .22);
  JSKY.uMid.value.copy(X.mid); JSKY.uCloudB.value.copy(X.cloudB);
  if (JD.beam) { const m = JD.beam.material.uniforms; m.uCol.value.copy(X.beam); m.uI.value = X.beamI * (.8 + .4 * (1 - smooth(-.1, .15, S.sunDir.y))); }
}

/* ---------- the pass: ground and stone read through the chapter's colours; the sky is its own painting and is left alone ---------- */
const JOURNEY_FS = `${STYLE_HEAD}
uniform vec3 uShade, uWarm;
void main(){
  vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb; float l = dot(c, LW);
  vec3 shadeC = uShade / max(dot(uShade, LW), .05), lightC = uWarm / max(dot(uWarm, LW), .05), chroma = min(c / max(l, .03), vec3(3.0));
  float sky = step(9e4, lz(vUv));
  vec3 o = l * mix(chroma, mix(shadeC, lightC, smoothstep(.06, .62, l)), .3 * (1.0 - sky));   // shade goes blue-violet, light goes gold
  o += uWarm * smoothstep(.72, 1.0, l) * .05;
  o = mix(o, o * o * (3.0 - 2.0 * o), .3);                                                     // deep darks, clean lights
  float ol = dot(o, LW); o = mix(vec3(ol), o, mix(1.1, 1.18, 1.0 - sky));
  vec2 q = vUv - .5; o *= 1.0 - .24 * dot(q, q) * 2.0;
  gl_FragColor = vec4(mix(c, clamp(o, 0.0, 1.0), uAmt), src.a);
}`;
