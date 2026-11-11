/* =========================================================================
   NATURE — what makes the world worth sitting with for hours:
   · the real moon (today's phase, lit from the side the sun is on)
   · weather that follows Bengaluru's seasons: pre-monsoon storms in May,
     monsoon showers June–October, misty winter mornings
   · birds on the wing (egrets at dawn and dusk, parakeets, crows, black kites
     circling on the midday thermals)
   · fireflies on warm nights, which slowly fall into step and flash together
   ========================================================================= */

/* ---------- the moon ---------- */
const MOON = { age: 0, e: Math.PI, illum: 1, name: 'Full moon', at: -1e9, tex: null, cnv: null };
const MOON_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent', 'New moon'];
function moonPhase(d = new Date()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  let age = ((d.getTime() - ref) / 864e5) % syn; if (age < 0) age += syn;
  const e = age / syn * TAU;
  return { age, e, illum: (1 - Math.cos(e)) / 2, name: MOON_NAMES[Math.round(age / syn * 8)] };
}
// the disc with today's terminator; the lit limb is +x (the sprite is turned toward the sun each frame)
function drawMoonPhase(c, e) {
  const S = c.width, x = c.getContext('2d'), m = S / 2, R = m * .94;
  x.clearRect(0, 0, S, S); x.drawImage(texMoon(), 0, 0, S, S);
  const img = x.getImageData(0, 0, S, S), d = img.data, se = Math.abs(Math.sin(e)), ce = Math.cos(e);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const px = (i + .5 - m) / R, py = (j + .5 - m) / R, r2 = px * px + py * py; if (r2 > 1) continue;
    const pz = Math.sqrt(1 - r2), lit = px * se - pz * ce, k = smooth(-.05, .07, lit), shade = .045 + .955 * k, o = (j * S + i) * 4;
    d[o] *= shade; d[o + 1] *= shade; d[o + 2] *= shade * (1 + (1 - k) * .25);      // earthshine is a touch bluer
  }
  x.putImageData(img, 0, 0);
}
function moonRefresh(SK, force) {
  const now = Date.now(); if (!force && now - MOON.at < 20 * 60e3) return;
  Object.assign(MOON, moonPhase(new Date(now))); MOON.at = now;
  if (!MOON.cnv) { MOON.cnv = cnv(256, 256)[0]; MOON.tex = toTex(MOON.cnv); SK.moon.material.map = MOON.tex; SK.moon.material.needsUpdate = true; }
  drawMoonPhase(MOON.cnv, MOON.e); MOON.tex.needsUpdate = true;
}
const _mp = V3(), _mq = V3();
function moonOrient(SK, cam) {
  _mp.copy(SK.moon.position).project(cam); _mq.copy(SK.moon.position).addScaledVector(S.sunDir, 60).project(cam);
  SK.moon.material.rotation = Math.atan2(_mq.y - _mp.y, (_mq.x - _mp.x) * cam.aspect);
}

/* ---------- weather: a plan for each real day, from Bengaluru's climate normals ---------- */
// rainy days per month (climate normals), how often those are thunderstorms, how often a winter morning is misty
const BLR = {
  rainDays: [.3, .4, 1, 3, 7, 6, 7, 10, 10, 8, 4, 1.2],
  storm: [0, .1, .6, .8, .8, .35, .25, .3, .55, .6, .45, .2],
  mist: [.55, .4, .12, .04, .04, .08, .1, .1, .1, .15, .3, .5],
  cloud: [.05, .05, .1, .25, .45, .7, .8, .75, .6, .5, .35, .15],
  flies: [.3, .3, .45, .6, .8, 1, 1, 1, 1, .9, .6, .35],     // fireflies are a monsoon thing
};
const WX = { mode: 'live', rain: 0, mist: 0, cloud: 0, storm: 0, flash: 0, plan: null, planKey: '', nextBolt: 0, label: '' };
function wxPlan(d) {
  const m = d.getMonth(), key = d.getFullYear() + '-' + m + '-' + d.getDate();
  if (WX.planKey === key) return WX.plan;
  const r = rng((d.getFullYear() * 400 + m * 32 + d.getDate()) * 7919), P = { rain: [], mist: 0, cloud: BLR.cloud[m] * (.6 + .8 * r()) };
  // rain spells today: storms build in the afternoon; monsoon showers come any time, most often evening and night
  if (r() < BLR.rainDays[m] / 30) {
    const storm = r() < BLR.storm[m], n = storm ? 1 : 1 + (r() < .45 ? 1 : 0);
    for (let i = 0; i < n; i++) { const s = storm ? 14.5 + r() * 5 : [16 + r() * 6, r() * 6, 9 + r() * 6][(r() * 3) | 0]; P.rain.push({ s, d: storm ? .8 + r() * 1.4 : 1 + r() * 2.5, k: storm ? .75 + r() * .25 : .35 + r() * .45, storm }); }
  }
  if (r() < BLR.mist[m]) P.mist = .55 + r() * .45;
  WX.plan = P; WX.planKey = key; return P;
}
// targets for the scene hour
function wxTarget(h, out) {
  out.rain = 0; out.mist = 0; out.cloud = 0; out.storm = 0;
  if (WX.mode === 'clear') return out;
  if (WX.mode === 'rain') { out.rain = .7; out.cloud = .95; out.storm = .5; return out; }
  if (WX.mode === 'mist') { out.mist = .9; out.cloud = .3; return out; }
  const P = wxPlan(new Date());
  out.cloud = P.cloud;
  for (const sp of P.rain) {
    const dt = hdiff(h, sp.s), f = smooth(-.35, 0, dt) * (1 - smooth(sp.d, sp.d + .5, dt));
    out.rain = Math.max(out.rain, f * sp.k); out.cloud = Math.max(out.cloud, smooth(-1.2, -.2, dt) * (1 - smooth(sp.d, sp.d + 1.2, dt)) * .95); if (sp.storm) out.storm = Math.max(out.storm, f);
  }
  // mist gathers before dawn and burns off by mid-morning
  out.mist = P.mist * smooth(2.5, 4.5, h) * (1 - smooth(8, 9.8, h));
  return out;
}
const _wt = { rain: 0, mist: 0, cloud: 0, storm: 0 };
function updateWeather(dt, h) {
  wxTarget(h, _wt);
  const k = 1 - Math.exp(-dt / (S.travel ? 1.5 : 6));
  WX.rain = lerp(WX.rain, _wt.rain, k); WX.mist = lerp(WX.mist, _wt.mist, k); WX.cloud = lerp(WX.cloud, _wt.cloud, k); WX.storm = lerp(WX.storm, _wt.storm, k);
  // lightning in storms: a double flash, thunder follows at the speed of sound
  WX.flash *= Math.exp(-dt * 9);
  if (WX.storm > .3 && S.rt > WX.nextBolt) {
    const dist = 1.2 + Math.random() * 6;                     // km
    WX.flash = Math.max(WX.flash, (1.3 - dist / 7) * WX.storm); WX.flash2 = S.rt + .09 + Math.random() * .12;
    WX.nextBolt = S.rt + 7 + Math.random() * 22 / WX.storm;
    if (typeof ambThunder === 'function') ambThunder(dist / .343, 1 - dist / 8);
  }
  if (WX.flash2 && S.rt > WX.flash2) { WX.flash = Math.max(WX.flash, .6 * WX.storm); WX.flash2 = 0; }
  WX.label = WX.rain > .55 ? (WX.storm > .5 ? 'Thunderstorm' : 'Rain') : WX.rain > .12 ? 'Light rain' : WX.mist > .35 ? 'Mist' : WX.cloud > .7 ? 'Overcast' : '';
}
// weather reshapes the chapter's look (after blendLook, before the sky)
function applyWeather(L) {
  const r = WX.rain, c = Math.max(WX.cloud, r * .9), m = WX.mist;
  L.cloudAmt = lerp(L.cloudAmt, Math.max(L.cloudAmt, .95), c * .85);
  L.sunI *= 1 - .6 * c * c; L.scat *= 1 - .7 * c; L.shaft *= 1 - .75 * c;
  L.fogD *= 1 + 1.3 * r + 1.8 * m; L.fogH = lerp(L.fogH, Math.max(L.fogH, 14), m * .7); L.fogS = lerp(L.fogS, 2, m * .6);
  L.mist = Math.max(L.mist, m * .95, r * .35);
  L.sat *= 1 - .16 * r - .1 * m; L.con *= 1 - .06 * m;
  L.dust *= 1 - r; L.petals *= 1 - .85 * r; L.stars *= 1 - c;
  L.expo *= 1 + WX.flash * .9;
}
// rain: streaks falling through a box that travels with the camera
function buildRain(scene, Q) {
  const N = Q.shadows ? 5200 : 2400, seed = new Float32Array(N * 2 * 4), end = new Float32Array(N * 2), pos = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) { const a = [Math.random(), Math.random(), Math.random(), Math.random()]; for (let e = 0; e < 2; e++) { seed.set(a, (i * 2 + e) * 4); end[i * 2 + e] = e; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const U = { uCam: { value: V3() }, uTime: { value: 0 }, uA: { value: 0 }, uBox: { value: V3(56, 34, 56) }, uVel: { value: V3(1.6, -11, .8) }, uCol: { value: col('#b8c0c8') } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute vec4 aSeed; attribute float aEnd; uniform vec3 uCam, uBox, uVel; uniform float uTime, uA; varying float vA;
      void main(){ vec3 o = uCam - uBox * 0.5; vec3 v = uVel * (0.85 + 0.3 * aSeed.w);
        vec3 p = o + mod(aSeed.xyz * uBox + v * uTime - o, uBox) - v * aEnd * 0.06;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
        vA = uA * (0.35 + 0.65 * aSeed.w) * smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(12.0, 30.0, d)) * mix(1.0, 0.35, aEnd);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ if (vA < 0.004) discard; gl_FragColor = vec4(uCol, vA); }',
  });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false; lines.visible = false; lines.renderOrder = 5; scene.add(lines);
  return { lines, U };
}

/* ---------- birds ---------- */
function birdGeometry() {
  const P = [0, 0, .5, -.07, 0, .1, .07, 0, .1, 0, 0, -.35, -.07, 0, .1, .07, 0, .1,                 // body
    0, 0, .2, -1, 0, -.02, 0, 0, -.16, 0, 0, .2, 1, 0, -.02, 0, 0, -.16,                                 // wings
    0, 0, -.28, -.18, 0, -.55, .18, 0, -.55];                                                           // tail
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
const BIRD = { KITE: 0, EGRET: 1, PARAKEET: 2, CROW: 3 };
function buildBirds(scene) {
  const flocks = [];
  // black kites circling on thermals over the city and the clearing
  for (let i = 0; i < 6; i++) flocks.push({ kind: BIRD.KITE, n: 1, c: V3(-40 + Math.random() * 120, 70 + Math.random() * 50, -20 + Math.random() * 150), r: 22 + Math.random() * 30, w: (.12 + Math.random() * .1) * (Math.random() < .5 ? 1 : -1), ph: Math.random() * TAU, on: [8.5, 17] });
  // egrets in a V going to roost at dusk, leaving at dawn; parakeets and crows in loose groups
  for (let i = 0; i < 3; i++) flocks.push({ kind: BIRD.EGRET, n: 9 + i * 3, lane: i, on: i === 0 ? [5.6, 7.6] : [16.9, 18.9], period: 70 + i * 17, off: i * 23 });
  for (let i = 0; i < 2; i++) flocks.push({ kind: BIRD.PARAKEET, n: 22, lane: 3 + i, on: i ? [15.5, 18.5] : [6, 9.5], period: 48 + i * 11, off: i * 31 });
  for (let i = 0; i < 2; i++) flocks.push({ kind: BIRD.CROW, n: 5, lane: 5 + i, on: [6.2, 18.8], period: 36 + i * 9, off: i * 13 });
  const N = flocks.reduce((s, f) => s + f.n, 0);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const U = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aFlap; uniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n float fs = sin(uTime * aFlap.y + aFlap.x); float ax = abs(transformed.x); transformed.y += fs * aFlap.z * ax * (0.6 + 0.4 * ax); transformed.x *= 1.0 - 0.12 * abs(fs) * aFlap.z;');
  };
  mat.customProgramCacheKey = () => 'bird';
  const g = birdGeometry(), flap = new Float32Array(N * 3), im = new THREE.InstancedMesh(g, mat, N);
  const cols = [col('#2a2622'), col('#f4f0e8'), col('#5f9a3e'), col('#1c1c1e')], scale = [2.6, 1.9, .9, 1.3], flapK = [[1.6, .25], [4.2, .9], [11, .9], [6.5, .8]];
  let j = 0; for (const f of flocks) { f.i0 = j; for (let k = 0; k < f.n; k++, j++) { im.setColorAt(j, cols[f.kind]); flap[j * 3] = Math.random() * TAU; flap[j * 3 + 1] = flapK[f.kind][0] * (.9 + Math.random() * .2); flap[j * 3 + 2] = flapK[f.kind][1]; } }
  g.setAttribute('aFlap', new THREE.InstancedBufferAttribute(flap, 3));
  im.frustumCulled = false; im.castShadow = false; scene.add(im);
  return { im, flocks, U, scale, N };
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bp = V3(), _bs = V3(), _bd = V3(), _be = new THREE.Euler(0, 0, 0, 'YXZ');
// flight lanes: straight passes across the sky around the scene
const LANES = [[V3(-260, 70, -120), V3(240, 95, 160)], [V3(230, 60, -160), V3(-250, 80, 120)], [V3(-200, 85, 190), V3(210, 70, -150)], [V3(-150, 40, 40), V3(180, 55, 170)], [V3(160, 45, -60), V3(-170, 50, 120)], [V3(-90, 30, -40), V3(120, 36, 140)], [V3(80, 28, 190), V3(-60, 34, -60)]];
function updateBirds(B, h, rt, dt) {
  B.U.uTime.value = rt;
  const wet = 1 - WX.rain * .9, im = B.im;
  let vis = 0;
  for (const f of B.flocks) {
    const act = smooth(f.on[0], f.on[0] + .4, h) * (1 - smooth(f.on[1] - .4, f.on[1], h)) * wet;
    if (f.kind === BIRD.KITE) {
      for (let k = 0; k < f.n; k++) {
        const j = f.i0 + k, a = f.ph + rt * f.w;
        _bp.set(f.c.x + Math.cos(a) * f.r, f.c.y + Math.sin(rt * .05 + f.ph) * 6, f.c.z + Math.sin(a) * f.r);
        const s = act > .02 ? B.scale[0] : 0, sg = Math.sign(f.w);
        _be.set(0, Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg), -.35 * sg); _bq.setFromEuler(_be);
        _bs.setScalar(s); _bm.compose(_bp, _bq, _bs); im.setMatrixAt(j, _bm); vis += s > 0;
      }
      continue;
    }
    const L = LANES[f.lane % LANES.length], tt = ((rt + f.off) / f.period) % 1.6, u = tt;   // gaps between passes
    const on = act > .02 && u < 1;
    _bd.copy(L[1]).sub(L[0]); const yaw = Math.atan2(_bd.x, _bd.z);
    for (let k = 0; k < f.n; k++) {
      const j = f.i0 + k;
      if (!on) { _bs.setScalar(0); _bm.compose(_bp, _bq, _bs); im.setMatrixAt(j, _bm); continue; }
      _bp.copy(L[0]).lerp(L[1], u);
      if (f.kind === BIRD.EGRET) { const side = k % 2 ? 1 : -1, row = (k + 1) >> 1; _bp.x += Math.cos(yaw) * side * row * 2.6 - Math.sin(yaw) * row * 2.2; _bp.z += -Math.sin(yaw) * side * row * 2.6 - Math.cos(yaw) * row * 2.2; _bp.y += Math.sin(rt * 1.3 + k) * .4; }
      else { const q = k * 2.399 + rt * (f.kind === BIRD.PARAKEET ? .9 : .4), rr = (f.kind === BIRD.PARAKEET ? 5 : 7) * Math.sqrt((k + .5) / f.n); _bp.x += Math.cos(q) * rr + Math.sin(rt * .7 + k) * 1.5; _bp.y += Math.sin(q * 1.3 + rt) * rr * .4; _bp.z += Math.sin(q) * rr; }
      _be.set(0, yaw, Math.sin(rt * .8 + k) * .12); _bq.setFromEuler(_be);
      _bs.setScalar(B.scale[f.kind] * clamp(act * 3, 0, 1)); _bm.compose(_bp, _bq, _bs); im.setMatrixAt(j, _bm); vis++;
    }
  }
  im.instanceMatrix.needsUpdate = true; im.visible = vis > 0;
}

/* ---------- fireflies: coupled oscillators that drift into synchrony over a long night ---------- */
function buildFireflies(scene, Q) {
  const N = Q.shadows ? 420 : 180, pos = new Float32Array(N * 3), rnd = new Float32Array(N * 3), ph = new Float32Array(N), om = new Float32Array(N);
  const r = rng(314);
  for (let i = 0; i < N; i++) {
    let x, z, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      const pick = r();
      if (pick < .55) { const a = r() * TAU, d = 36 + r() * 70; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      else if (pick < .8) { const a = r() * TAU, d = 8 + r() * 30; x = GEO.R.x + Math.cos(a) * d; z = GEO.R.z + Math.sin(a) * d; }
      else { x = GEO.GATE.x - 30 + r() * 50; z = -30 + r() * 60; }
      ok = z < 60 && Math.hypot(x, z) > 34;
    }
    pos.set([x, groundY(x, z) + .5 + r() * 2.4, z], i * 3); rnd.set([r(), r(), r()], i * 3);
    ph[i] = r() * TAU; om[i] = TAU / (2.2 + r() * .9);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
  const aPh = new THREE.BufferAttribute(ph, 1); aPh.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aPh', aPh);
  const U = { uTime: { value: 0 }, uOn: { value: 0 }, uSize: { value: 600 }, uCol: { value: col('#d6ff78') } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec3 aRnd; attribute float aPh; uniform float uTime, uOn, uSize; varying float vF;
      void main(){ vec3 p = position + vec3(sin(uTime * .31 + aRnd.x * 40.0) * 1.4, sin(uTime * .53 + aRnd.y * 20.0) * .45, cos(uTime * .27 + aRnd.z * 40.0) * 1.4);
        float q = mod(aPh + 3.14159, 6.28318) - 3.14159; float fl = exp(-q * q / .16);
        vF = uOn * (fl + .025); vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * .22 * (.55 + .7 * fl) / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vF; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); float a = (exp(-d * 5.0) + exp(-d * 60.0) * 1.5) * vF; if (a < .003) discard; gl_FragColor = vec4(uCol * a, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, U, ph, om, aPh, N, K: 0, night: 0 };
}
function updateFireflies(F, h, rt, dt) {
  const m = new Date().getMonth(), season = BLR.flies[m];
  const dark = smooth(18.6, 19.6, h) + (1 - smooth(3.8, 5.0, h)); const on = clamp(dark, 0, 1) * season * (1 - WX.rain * .85) * (1 - WX.mist * .5);
  F.U.uOn.value = on; F.U.uTime.value = rt; F.pts.visible = on > .01;
  if (!F.pts.visible) { F.night = 0; F.K = 0; return; }
  // coupling grows through the night: scattered flashing becomes a shared pulse after several minutes
  F.night += dt; F.K = Math.min(1.1, F.night / 420);
  let cx = 0, cy = 0; const N = F.N, ph = F.ph;
  for (let i = 0; i < N; i++) { cx += Math.cos(ph[i]); cy += Math.sin(ph[i]); }
  const R = Math.hypot(cx, cy) / N, psi = Math.atan2(cy, cx), d = Math.min(dt, .1);
  for (let i = 0; i < N; i++) { ph[i] += (F.om[i] + F.K * R * Math.sin(psi - ph[i]) * 1.6) * d; if (ph[i] > TAU) ph[i] -= TAU; }
  F.aPh.needsUpdate = true; F.sync = R;
}

function buildNature(scene, Q, SK) {
  moonRefresh(SK, true);
  return { rain: buildRain(scene, Q), birds: buildBirds(scene), flies: buildFireflies(scene, Q) };
}
function updateNature(NA, SK, cam, dt, rt, h, look) {
  moonRefresh(SK, false); moonOrient(SK, cam);
  const R = NA.rain; R.lines.visible = WX.rain > .01; if (R.lines.visible) { R.U.uCam.value.copy(cam.position); R.U.uTime.value = rt; R.U.uA.value = WX.rain * .55; R.U.uCol.value.copy(SK.fog.color).lerp(WHITE, .45).multiplyScalar(.9 + WX.flash * 2); }
  updateBirds(NA.birds, h, rt, dt);
  updateFireflies(NA.flies, h, rt, dt);
}
