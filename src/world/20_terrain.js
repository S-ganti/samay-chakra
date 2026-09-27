/* =========================================================================
   GEOGRAPHY — one world: forest plateau (the Ring), ridge (stone circle),
   lamp-lit steps + portal gate (west), city with the great wheel (south)
   ========================================================================= */
const HP = 10, RH = 22, FORE_H = 1.6;
const GEO = {
  C: { x: 0, z: 0 },          // clearing / ring stage
  R: { x: 78, z: -62 },       // ridge stone circle
  P: { x: 4, z: 122 },        // city plaza / great wheel
  GATE: { x: -47, z: 0 },     // portal wheel
  FORE: { x: -93, z: 0 },     // forecourt below the steps
  CHAI: { x: 30, z: 104 },    // chai stall
  SYNTH: { x: 80, z: -59 },   // lone synth inside the stone circle
};
const STAIR = { x0: -80, x1: -51, half: 5.5 };

// smooth max
const smax = (a, b, k) => .5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k)) - k * .5;

function terrainRaw(x, z) {
  const dC = Math.hypot(x, z);
  const dR = Math.hypot(x - GEO.R.x, z - GEO.R.z);
  let h = HP * (1 - smooth(44, 100, dC));
  const ridge = RH * (1 - smooth(19, 82, dR));
  h = smax(h, ridge, 3);
  // far highlands / mountains
  const dd = Math.hypot(x * .9, z - 40);
  const east = smooth(.55, .95, x / Math.max(1, Math.hypot(x, z)));
  const far = smooth(150, 250, dd) * (1 - .78 * east);
  h += far * (16 + 58 * fbm(x * .006 + 3, z * .006 + 7, 4));
  // city flats (south)
  const cityM = smooth(82, 96, z) * (1 - smooth(104, 124, Math.abs(x - GEO.P.x))) * (1 - smooth(178, 196, z));
  // forecourt + stairs
  const foreM = (1 - smooth(12, 16, Math.abs(z))) * smooth(-112, -106, x) * (1 - smooth(-82, -78, x));
  const stairM = (1 - smooth(STAIR.half, STAIR.half + 3, Math.abs(z))) * smooth(-84, -80, x) * (1 - smooth(-51, -47, x));
  // undulation away from flat zones
  const flat = Math.max(1 - smooth(40, 50, dC), 1 - smooth(18, 26, dR), cityM, foreM, stairM);
  h += (fbm(x * .028, z * .028, 4) - .5) * 6 * (1 - flat) * (1 - far * .6);
  h = lerp(h, 0, cityM);
  h = lerp(h, FORE_H, foreM);
  const ramp = lerp(FORE_H, HP, clamp((x - STAIR.x0) / (STAIR.x1 - STAIR.x0), 0, 1));
  h = lerp(h, ramp, stairM);
  // ridge top plateau
  h = lerp(h, RH, 1 - smooth(17, 22, dR));
  // clearing floor
  h = lerp(h, HP, 1 - smooth(42, 46, dC));
  return h;
}

// height grid for fast lookups
const TER = { size: 480, seg: 240 };
TER.step = TER.size / TER.seg;
TER.h = new Float32Array((TER.seg + 1) * (TER.seg + 1));
for (let j = 0; j <= TER.seg; j++) for (let i = 0; i <= TER.seg; i++) {
  const x = -TER.size / 2 + i * TER.step, z = -TER.size / 2 + j * TER.step;
  TER.h[j * (TER.seg + 1) + i] = terrainRaw(x, z);
}
function groundY(x, z) {
  const fx = (x + TER.size / 2) / TER.step, fz = (z + TER.size / 2) / TER.step;
  if (fx < 0 || fz < 0 || fx >= TER.seg || fz >= TER.seg) return terrainRaw(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = TER.seg + 1;
  // match PlaneGeometry triangulation (a,b,d / b,c,d)
  const h00 = TER.h[j * n + i], h10 = TER.h[j * n + i + 1], h01 = TER.h[(j + 1) * n + i], h11 = TER.h[(j + 1) * n + i + 1];
  if (u + v < 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

/* ---------- routes ---------- */
class Route {
  constructor(pts) {
    this.x = pts.map(p => p[0]); this.z = pts.map(p => p[1]);
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]));
    this.len = this.cum[this.cum.length - 1];
  }
  reversed() { return new Route(this.x.map((x, i) => [x, this.z[i]]).reverse()); }
}
const ROUTES = {
  hill: new Route([[-20, 118], [-40, 111], [-60, 100], [-78, 84], [-93, 64], [-102, 42], [-104, 22], [-99, 9], [-93, 3]]),
  road: new Route([[0, 42], [1, 58], [3, 74], [4, 90], [4, 97]]),
  ridge: new Route([[24, -14], [38, -27], [52, -40], [63, -51]]),
  stairsUp: new Route([[-84, 0], [-80, 0], [-51, 0], [-47, 0], [-40, 0]]),
};
ROUTES.hillR = ROUTES.hill.reversed();
ROUTES.roadR = ROUTES.road.reversed();
ROUTES.ridgeR = ROUTES.ridge.reversed();
ROUTES.stairsDown = ROUTES.stairsUp.reversed();

// Evaluate a journey: dynamic start (ax,az) → route → dynamic end (bx,bz), progress u in 0..1.
// Writes out.x, out.z, out.dx, out.dz. lat = lateral offset in metres (fades at ends).
function evalJourney(ax, az, route, bx, bz, u, lat, out) {
  const n = route ? route.x.length : 0;
  const d0 = n ? Math.hypot(route.x[0] - ax, route.z[0] - az) : Math.hypot(bx - ax, bz - az);
  const mid = n ? route.len : 0;
  const d1 = n ? Math.hypot(bx - route.x[n - 1], bz - route.z[n - 1]) : 0;
  const total = d0 + mid + d1 || 1e-6;
  let s = clamp(u, 0, 1) * total;
  let x0, z0, x1, z1, f;
  if (!n || s <= d0) { x0 = ax; z0 = az; x1 = n ? route.x[0] : bx; z1 = n ? route.z[0] : bz; f = d0 > 0 ? s / d0 : 1; }
  else if (s <= d0 + mid) {
    const q = s - d0; let k = 1; while (k < n - 1 && route.cum[k] < q) k++;
    const segL = route.cum[k] - route.cum[k - 1] || 1e-6;
    x0 = route.x[k - 1]; z0 = route.z[k - 1]; x1 = route.x[k]; z1 = route.z[k]; f = (q - route.cum[k - 1]) / segL;
  } else { x0 = route.x[n - 1]; z0 = route.z[n - 1]; x1 = bx; z1 = bz; f = d1 > 0 ? (s - d0 - mid) / d1 : 1; }
  let dx = x1 - x0, dz = z1 - z0; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const fade = Math.min(1, s / 6, (total - s) / 6);
  out.x = x0 + (x1 - x0) * f - dz * lat * fade;
  out.z = z0 + (z1 - z0) * f + dx * lat * fade;
  out.dx = dx; out.dz = dz;
  return out;
}

/* ---------- terrain mesh + far mountains ---------- */
function distToRoute(x, z, r) {
  let best = 1e9;
  for (let i = 1; i < r.x.length; i++) {
    const ax = r.x[i - 1], az = r.z[i - 1], bx = r.x[i], bz = r.z[i];
    const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az;
    const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1);
    best = Math.min(best, Math.hypot(wx - vx * t, wz - vz * t));
  }
  return best;
}
/* ---------- scanned ground: four Poly Haven (CC0) surfaces blended per vertex, tiled in world space at two scales so no repeat shows ---------- */
const GROUND = { names: ['forest_leaves_02', 'red_laterite_soil_stones', 'rock_boulder_dry', 'sparse_grass'], U: { uGT: { value: 0 }, tG0: { value: null }, tG1: { value: null }, tG2: { value: null }, tG3: { value: null }, tN0: { value: null }, tN1: { value: null }, tN2: { value: null }, tN3: { value: null } } };
function groundLayers(m) {
  const L = new THREE.TextureLoader(); let n = 0;
  const load = (u, i, kind) => L.load(`scans/tex/${GROUND.names[i]}_${kind}.webp`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (kind === 'Diffuse') t.colorSpace = THREE.SRGBColorSpace; GROUND.U[u].value = t; if (++n === 8) GROUND.U.uGT.value = 1; }, undefined, () => { });
  for (let i = 0; i < 4; i++) { load('tG' + i, i, 'Diffuse'); load('tN' + i, i, 'nor_gl'); }
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); blank.needsUpdate = true;
  for (const k in GROUND.U) if (k !== 'uGT') GROUND.U[k].value = blank;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GROUND.U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aW; attribute float aK; varying vec4 vW; varying float vK; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = aW; vK = aK; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uGT; uniform sampler2D tG0, tG1, tG2, tG3, tN0, tN1, tN2, tN3; varying vec4 vW; varying float vK; varying vec3 vWP;
      vec3 gSamp(sampler2D t, vec2 p) { return mix(texture2D(t, p / 3.2).rgb, texture2D(t, p / 11.0 + .37).rgb, .38); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (uGT > 0.5) {
        vec2 p = vWP.xz;
        vec3 alb = gSamp(tG0, p) * vW.x + gSamp(tG1, p * 1.3) * vW.y + gSamp(tG2, p * .7) * vW.z + gSamp(tG3, p) * vW.w;
        diffuseColor.rgb = mix(alb * 0.95, diffuseColor.rgb, vK);
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (uGT > 0.5) {
        vec2 p = vWP.xz;
        vec3 tn = (texture2D(tN0, p / 3.2).xyz * vW.x + texture2D(tN1, p * 1.3 / 3.2).xyz * vW.y + texture2D(tN2, p * .7 / 3.2).xyz * vW.z + texture2D(tN3, p / 3.2).xyz * vW.w) * 2.0 - 1.0;
        tn.xy *= 1.1 * (1.0 - vK);
        vec3 wn = normalize(vec3(tn.x, tn.z, -tn.y));
        vec3 vn = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        normal = normalize(normal + (vn - (viewMatrix * vec4(0., 1., 0., 0.)).xyz));
      }`);
  };
}
function buildTerrain(scene) {
  const g = new THREE.PlaneGeometry(TER.size, TER.size, TER.seg, TER.seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), lw = new Float32Array(pos.count * 4), keep = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    pos.setY(k, groundY(x, z));
  }
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  // earth pigments: umber-olive forest floor, ochre paths, sandstone and limewash dust (from the posters)
  const cForest = col('#352f1f'), cForest2 = col('#4a4128'), cRock = col('#6a5e4e'), cSoil = col('#8a5e3a'),
    cCity = col('#aea08a'), cStone = col('#8a7c66'), cHigh = col('#454634'), cRidge = col('#55504a'), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), ny = nor.getY(k);
    c.copy(cForest).lerp(cForest2, fbm(x * .05, z * .05, 3));
    c.lerp(cHigh, smooth(30, 70, y));
    c.lerp(cRock, smooth(.9, .72, ny));
    const dR = Math.hypot(x - GEO.R.x, z - GEO.R.z);
    c.lerp(cRidge, 1 - smooth(18, 26, dR));
    const dp = Math.min(distToRoute(x, z, ROUTES.hill), distToRoute(x, z, ROUTES.ridge), distToRoute(x, z, ROUTES.road));
    c.lerp(cSoil, (1 - smooth(1.6, 3.4, dp)) * .85);
    const cityM = smooth(86, 94, z) * (1 - smooth(100, 110, Math.abs(x - GEO.P.x))) * (1 - smooth(172, 180, z));
    c.lerp(cCity, cityM);
    const foreM = (1 - smooth(12, 15, Math.abs(z))) * smooth(-108, -104, x) * (1 - smooth(-80, -77, x));
    c.lerp(cStone, foreM);
    cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
    // scanned ground layers: leaf litter, laterite paths, granite, dry grass; city and forecourt keep their painted colour
    const wRock = Math.max(smooth(.9, .74, ny), smooth(34, 70, y) * .8, (1 - smooth(18, 26, dR)) * .55);
    const wPath = (1 - smooth(1.6, 3.6, dp)) * .95;
    const wGrass = (1 - smooth(44, 60, Math.hypot(x, z))) * smooth(40, 44, Math.hypot(x, z)) * .8 + smooth(.55, .8, fbm(x * .03 + 5, z * .03 - 2, 3)) * .6;
    let wa = 1, wb = wPath, wc = wRock, wd = wGrass * (1 - wRock);
    wa = Math.max(0, 1 - wb - wc - wd * .6);
    const sum = wa + wb + wc + wd + 1e-5;
    lw[k * 4] = wa / sum; lw[k * 4 + 1] = wb / sum; lw[k * 4 + 2] = wc / sum; lw[k * 4 + 3] = wd / sum;
    keep[k] = Math.max(cityM, foreM);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aW', new THREE.BufferAttribute(lw, 4)); g.setAttribute('aK', new THREE.BufferAttribute(keep, 1));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, metalness: 0 });
  groundLayers(m);
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // far mountains: a ring beyond the terrain square
  const rings = 22, segs = 180, r0 = 225, r1 = 640;
  const mg = new THREE.BufferGeometry(), mp = [], mc = [], mi = [];
  const cM1 = col('#3a3a2c'), cM2 = col('#5a5650'), cSnow = col('#9a968e');
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= segs; i++) {
    const a = i / segs * TAU, r = lerp(r0, r1, Math.pow(j / rings, 1.3));
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const peak = fbm(Math.cos(a) * 2.2 + 11, Math.sin(a) * 2.2 + r * .004, 5);
    const envl = smooth(0, .25, j / rings) * (1 - smooth(.85, 1, j / rings) * .4) * (1 - .82 * smooth(.62, .95, Math.cos(a)));
    const y = terrainRaw(x, z) + envl * (20 + 150 * Math.pow(peak, 2.2)) - (j === 0 ? .6 : 0);
    mp.push(x, y, z);
    const cc = cM1.clone().lerp(cM2, smooth(40, 120, y)).lerp(cSnow, smooth(120, 170, y));
    mc.push(cc.r, cc.g, cc.b);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + 1, c2 = a + segs + 1, d = c2 + 1;
    mi.push(a, c2, b, b, c2, d);
  }
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  mg.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3));
  mg.setIndex(mi); mg.computeVertexNormals();
  const mMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  // the far ranges wear an aerial scan of rock and scrub, projected from above at the scale of a hillside
  const aerU = { tAer: { value: null }, uAer: { value: 0 } };
  new THREE.TextureLoader().load('scans/tex/aerial_rocks_02_Diffuse.webp', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; aerU.tAer.value = t; aerU.uAer.value = 1; }, undefined, () => { });
  mMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, aerU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tAer; uniform float uAer; varying vec3 vMP;').replace('#include <color_fragment>', '#include <color_fragment>\nif (uAer > 0.5) { vec3 aer = mix(texture2D(tAer, vMP.xz / 60.0).rgb, texture2D(tAer, vMP.xz / 190.0 + .3).rgb, .5); diffuseColor.rgb *= aer * 2.6; }');
  };
  const mm = new THREE.Mesh(mg, mMat);
  scene.add(mm);
  return { mesh, mountains: mm };
}

/* ---------- walkable paths: a scratch polyline with obstacle-aware connectors ---------- */
const WHEEL_Y = HP + 6.4;                 // portal wheel centre: its lower rim is sunk so people walk through
const LANE_Z = 1.2;                       // the two lanes between the portal's lower spokes
const STAGE_OPEN = [0, Math.PI / 2, Math.PI, -Math.PI / 2];   // world atan2(z,x) of the four stage openings
ROUTES.stairsUpL = new Route([[-84, -LANE_Z], [-80, -LANE_Z], [-51, -LANE_Z], [-47, -LANE_Z], [-43, -LANE_Z], [-40, -LANE_Z]]);
ROUTES.stairsUpR = new Route([[-84, LANE_Z], [-80, LANE_Z], [-51, LANE_Z], [-47, LANE_Z], [-43, LANE_Z], [-40, LANE_Z]]);
const PATH = { x: new Float32Array(96), z: new Float32Array(96), n: 0 };
function pAdd(x, z) { const k = PATH.n; if (k < 96) { if (k && Math.abs(PATH.x[k - 1] - x) + Math.abs(PATH.z[k - 1] - z) < 1e-3) return; PATH.x[k] = x; PATH.z[k] = z; PATH.n = k + 1; } }
const segDist = (cx, cz, x0, z0, x1, z1) => { const vx = x1 - x0, vz = z1 - z0, L = vx * vx + vz * vz || 1e-9; const t = clamp(((cx - x0) * vx + (cz - z0) * vz) / L, 0, 1); return Math.hypot(x0 + vx * t - cx, z0 + vz * t - cz); };
// go around a circular obstacle (both ends outside it) along the shorter arc
function arcAround(cx, cz, R, x0, z0, x1, z1) {
  if (segDist(cx, cz, x0, z0, x1, z1) >= R) return;
  const a0 = Math.atan2(z0 - cz, x0 - cx), a1 = Math.atan2(z1 - cz, x1 - cx);
  let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
  const steps = Math.max(2, Math.ceil(Math.abs(da) / .45));
  for (let k = 0; k <= steps; k++) { const a = a0 + da * k / steps; pAdd(cx + Math.cos(a) * (R + .6), cz + Math.sin(a) * (R + .6)); }
}
// the ring stage wall (r 12.1–13.9) with four openings
function stageAvoid(x0, z0, x1, z1) {
  const r0 = Math.hypot(x0, z0), r1 = Math.hypot(x1, z1);
  if (r0 > 70 && r1 > 70) return;
  const in0 = r0 < 12.9, in1 = r1 < 12.9;
  if (in0 !== in1) {
    const ox = in0 ? x1 : x0, oz = in0 ? z1 : z0;
    const a = Math.round(Math.atan2(oz, ox) / (Math.PI / 2)) * (Math.PI / 2);
    const ix = Math.cos(a) * 10.6, iz = Math.sin(a) * 10.6, ex = Math.cos(a) * 15.4, ez = Math.sin(a) * 15.4;
    if (in0) { pAdd(ix, iz); if (Math.hypot(x1 - ex, z1 - ez) > 1) arcAround(0, 0, 14.6, ex, ez, x1, z1); pAdd(ex, ez); }
    else { arcAround(0, 0, 14.6, x0, z0, ex, ez); pAdd(ex, ez); pAdd(ix, iz); }
  } else if (!in0) arcAround(0, 0, 14.6, x0, z0, x1, z1);
}
// city: buildings stand behind the pavements, so walk to the pavement line, along it, and into the plaza area
const _ca = { x: 0, z: 0 }, _cb = { x: 0, z: 0 };
function cityAcc(x, z, o) {
  const far = Math.abs(x - GEO.P.x) > 38;
  o.x = x; o.z = z;
  if (far && z < 114.5) { o.z = 114.5; return true; }
  if (far && z > 129.5) { o.z = 129.5; return true; }
  return false;
}
function cityAvoid(x0, z0, x1, z1) {
  if (z0 < 86 || z1 < 86) return;
  const A = cityAcc(x0, z0, _ca), B = cityAcc(x1, z1, _cb);
  if (A) pAdd(_ca.x, _ca.z);
  const farA = Math.abs(_ca.x - GEO.P.x) > 38, farB = Math.abs(_cb.x - GEO.P.x) > 38;
  if (farA && !farB) { const cx = GEO.P.x + Math.sign(_ca.x - GEO.P.x) * 37, cz = _ca.z; pAdd(cx, cz); arcAround(GEO.P.x, GEO.P.z, 4.2, cx, cz, _cb.x, _cb.z); }
  else if (!farA && farB) { const cx = GEO.P.x + Math.sign(_cb.x - GEO.P.x) * 37, cz = _cb.z; arcAround(GEO.P.x, GEO.P.z, 4.2, _ca.x, _ca.z, cx, cz); pAdd(cx, cz); }
  else arcAround(GEO.P.x, GEO.P.z, 4.2, _ca.x, _ca.z, _cb.x, _cb.z);
  if (B) pAdd(_cb.x, _cb.z);
}
function pConnect(x0, z0, x1, z1) { stageAvoid(x0, z0, x1, z1); cityAvoid(x0, z0, x1, z1); }
function buildPath(ax, az, route, bx, bz) {
  PATH.n = 0; pAdd(ax, az);
  if (route) {
    const n = route.x.length;
    pConnect(ax, az, route.x[0], route.z[0]);
    for (let k = 0; k < n; k++) pAdd(route.x[k], route.z[k]);
    pConnect(route.x[n - 1], route.z[n - 1], bx, bz);
  } else pConnect(ax, az, bx, bz);
  pAdd(bx, bz);
}
// position along the scratch path at u (0..1); lateral offset fades out at both ends
function evalPath(u, lat, out) {
  const n = PATH.n, X = PATH.x, Z = PATH.z;
  if (n < 2) { out.x = X[0]; out.z = Z[0]; out.dx = 0; out.dz = 1; return out; }
  let total = 0; for (let k = 1; k < n; k++) total += Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]);
  total = total || 1e-6;
  let s = clamp(u, 0, 1) * total, k = 1, acc = 0, L = 0;
  for (; k < n; k++) { L = Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]); if (acc + L >= s || k === n - 1) break; acc += L; }
  const f = L > 0 ? clamp((s - acc) / L, 0, 1) : 1;
  let dx = X[k] - X[k - 1], dz = Z[k] - Z[k - 1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const px = X[k - 1] + (X[k] - X[k - 1]) * f, pz = Z[k - 1] + (Z[k] - Z[k - 1]) * f;
  // narrow places (stage openings, city pavements) squeeze the crowd into single file, continuously
  const narrow = Math.min(1 - .78 * smooth(84, 94, pz), .1 + .9 * smooth(15.5, 23, Math.hypot(px, pz)), .15 + .85 * smooth(4, 12, Math.abs(px - GEO.GATE.x)));
  const fade = Math.min(1, s / 6, (total - s) / 6) * narrow;
  out.x = px - dz * lat * fade;
  out.z = pz + dx * lat * fade;
  out.dx = dx; out.dz = dz; out.len = total;
  return out;
}
