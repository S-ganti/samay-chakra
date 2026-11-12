/* =========================================================================
   PAINTED LAYER — detailed 2D elements set into the 3D world in layers, the way a ragamala miniature is built:
   trees drawn leaf by leaf, a festival crowd in silhouette, lanterns by night and kites by day.
   Everything here is a camera-facing card tinted by the hour's palette and faded by the same haze as the
   rest of the world, so the drawings sit in the scene instead of on top of it. Cheap to draw: a few thousand quads.
   ========================================================================= */
const PAINT = { light: new THREE.Color(1, 1, 1), shade: new THREE.Color(), lit: new THREE.Color(), lamp: new THREE.Color(), groups: [] };

/* ---------- trees: four kinds, painted in values (dark to light) and coloured by the hour ---------- */
function paintTreeAtlas() {
  const W = 384, H = 512, c = document.createElement('canvas'); c.width = W * 4; c.height = H;
  const x = c.getContext('2d'), g = (v) => { v = Math.round(clamp(v, 0, 255)); return `rgb(${v},${v},${v})`; };
  const crown = (r, ox, cx, cy, rx, ry, n, r0, r1) => {
    const cl = []; for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()); cl.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r0 + r() * (r1 - r0)]); }
    cl.sort((a, b) => b[1] - a[1]);                                  // lower clusters first, so the lit tops overlap them
    for (const [px, py, pr] of cl) {
      const lightK = clamp(.5 - (py - cy) / (ry * 2) - (px - cx) / (rx * 4), 0, 1), base = 70 + 130 * lightK;
      x.fillStyle = g(base); x.beginPath(); x.arc(ox + px, py, pr, 0, TAU); x.fill();
      // leaves: small dabs, darker under each cluster and lighter on its crown, breaking the rim into a leafy edge
      for (let k = 0; k < 46; k++) {
        const a = r() * TAU, d = pr * (.35 + r() * .78), lx = px + Math.cos(a) * d, ly = py + Math.sin(a) * d;
        x.fillStyle = g(base + (Math.sin(a) < 0 ? 34 : -30) * (.5 + r() * .5));
        x.save(); x.translate(ox + lx, ly); x.rotate(a + 1.2); x.beginPath(); x.ellipse(0, 0, 3.2 + r() * 3.4, 1.4 + r() * 1.6, 0, 0, TAU); x.fill(); x.restore();
      }
    }
  };
  const trunk = (ox, bx, by, tx, ty, w0, w1, v = 62) => {
    x.fillStyle = g(v); x.beginPath(); x.moveTo(ox + bx - w0, by); x.quadraticCurveTo(ox + (bx + tx) / 2 - w0 * .4, (by + ty) / 2, ox + tx - w1, ty);
    x.lineTo(ox + tx + w1, ty); x.quadraticCurveTo(ox + (bx + tx) / 2 + w0 * .5, (by + ty) / 2, ox + bx + w0, by); x.closePath(); x.fill();
  };
  // 0 — mango: a full round crown
  { const r = rng(11), ox = 0; trunk(ox, 192, H - 2, 188, 250, 20, 9); trunk(ox, 190, 330, 130, 230, 7, 4); trunk(ox, 192, 320, 250, 225, 7, 4); crown(r, ox, 192, 180, 138, 128, 34, 34, 58); }
  // 1 — banyan: a wide low canopy on several stems with hanging roots
  { const r = rng(23), ox = W; trunk(ox, 192, H - 2, 190, 280, 26, 12); trunk(ox, 110, H - 2, 120, 290, 8, 5); trunk(ox, 280, H - 2, 268, 285, 9, 5);
    x.strokeStyle = g(58); x.lineWidth = 2.5; for (let i = 0; i < 9; i++) { const px = 60 + r() * 264; x.beginPath(); x.moveTo(ox + px, 250); x.lineTo(ox + px + (r() - .5) * 8, 330 + r() * 150); x.stroke(); }
    crown(r, ox, 192, 205, 172, 96, 38, 30, 52); }
  // 2 — ashoka: the tall narrow tree of the miniatures
  { const r = rng(37), ox = W * 2; trunk(ox, 192, H - 2, 192, 380, 9, 6); crown(r, ox, 192, 236, 50, 196, 30, 22, 36); }
  // 3 — palm: a leaning ringed stem and a fan of fronds
  { const r = rng(41), ox = W * 3, tx = 214, ty = 150; trunk(ox, 176, H - 2, tx, ty, 9, 6, 78);
    x.strokeStyle = g(46); x.lineWidth = 1.5; for (let k = 1; k < 26; k++) { const f = k / 26, px = lerp(176, tx, f * f * .4 + f * .6), py = lerp(H - 2, ty, f); x.beginPath(); x.moveTo(ox + px - 9, py); x.lineTo(ox + px + 9, py - 2); x.stroke(); }
    for (let i = 0; i < 13; i++) {
      const a = -Math.PI * (.04 + .92 * i / 12), L = 120 + r() * 46, ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * .7 + 46 * Math.abs(Math.cos(a)), mx = tx + Math.cos(a) * L * .55, my = ty + Math.sin(a) * L * .78 - 14;
      const v = 96 + 110 * clamp(-Math.sin(a) * .8 - Math.cos(a) * .25, 0, 1);
      x.strokeStyle = g(v); x.lineWidth = 3; x.beginPath(); x.moveTo(ox + tx, ty); x.quadraticCurveTo(ox + mx, my, ox + ex, ey); x.stroke();
      x.lineWidth = 2;
      for (let k = 2; k < 22; k++) { const f = k / 22, qx = (1 - f) * (1 - f) * tx + 2 * (1 - f) * f * mx + f * f * ex, qy = (1 - f) * (1 - f) * ty + 2 * (1 - f) * f * my + f * f * ey, ll = 22 * (1 - Math.abs(f - .45) * 1.3);
        x.strokeStyle = g(v + (k % 2 ? 16 : -18)); x.beginPath(); x.moveTo(ox + qx, qy); x.lineTo(ox + qx - Math.sin(a) * ll * .25 + 4, qy + ll); x.stroke(); }
    }
    x.fillStyle = g(60); x.beginPath(); x.arc(ox + tx, ty + 4, 9, 0, TAU); x.fill(); }
  const t = toTex(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t;
}

/* ---------- figures: eight poses in silhouette. Red channel = cloth value, blue = a carried lamp ---------- */
function paintFigureAtlas() {
  const W = 128, H = 256, N = 8, c = document.createElement('canvas'); c.width = W * N * 2; c.height = H * 2;   // drawn at twice the size, for the close shots
  const x = c.getContext('2d'); x.scale(2, 2); const R = (v) => `rgb(${v},0,0)`;
  const head = (ox, hx, hy, r = 12) => { x.fillStyle = R(140); x.beginPath(); x.arc(ox + hx, hy, r, 0, TAU); x.fill(); x.fillStyle = R(70); x.beginPath(); x.arc(ox + hx, hy - 3, r * .98, Math.PI, TAU); x.fill(); };
  const limb = (ox, pts, w, v) => { x.strokeStyle = R(v); x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); pts.forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](ox + px, py)); x.stroke(); };
  const poly = (ox, pts, v) => { x.fillStyle = R(v); x.beginPath(); pts.forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](ox + px, py)); x.closePath(); x.fill(); };
  const lamp = (ox, lx, ly) => { x.fillStyle = 'rgb(255,0,255)'; x.beginPath(); x.arc(ox + lx, ly, 5, 0, TAU); x.fill(); };
  const drape = (ox, cx, top, bot, wTop, wBot, v, lean = 0) => {
    poly(ox, [[cx - wTop, top], [cx + wTop, top], [cx + wBot + lean, bot], [cx - wBot + lean, bot]], v);
    x.strokeStyle = R(v - 46); x.lineWidth = 2; for (let k = 1; k < 5; k++) { const f = k / 5; x.beginPath(); x.moveTo(ox + cx - wTop + 2 * wTop * f, top + 6); x.lineTo(ox + cx - wBot + 2 * wBot * f + lean, bot); x.stroke(); }
    x.fillStyle = R(Math.min(255, v + 40)); x.fillRect(ox + cx - wBot + lean, bot - 7, wBot * 2, 5);          // a border at the hem
  };
  // 0 woman standing in a sari
  { const o = 0; head(o, 64, 36); poly(o, [[50, 52], [78, 52], [82, 122], [46, 122]], 200); drape(o, 64, 118, 250, 19, 30, 220); limb(o, [[52, 58], [44, 96], [50, 128]], 8, 140); limb(o, [[78, 56], [50, 92], [46, 150]], 9, 236); }
  // 1 dancer, both arms raised
  { const o = W; head(o, 64, 44); poly(o, [[50, 60], [78, 60], [80, 126], [48, 126]], 210); drape(o, 64, 122, 250, 18, 40, 228, 4); limb(o, [[52, 64], [32, 34], [26, 6]], 8, 140); limb(o, [[76, 64], [96, 34], [102, 6]], 8, 140); }
  // 2 dancer, one arm up, weight on one hip
  { const o = W * 2; head(o, 58, 42); poly(o, [[46, 58], [72, 58], [80, 126], [50, 126]], 190); drape(o, 66, 122, 250, 17, 36, 214, -8); limb(o, [[48, 62], [30, 36], [36, 8]], 8, 140); limb(o, [[72, 62], [96, 86], [108, 70]], 8, 140); }
  // 3 man in kurta and dhoti
  { const o = W * 3; head(o, 64, 34); poly(o, [[46, 50], [82, 50], [84, 150], [44, 150]], 226); poly(o, [[46, 148], [63, 148], [60, 250], [44, 250]], 200); poly(o, [[66, 148], [84, 148], [86, 250], [70, 250]], 200); limb(o, [[48, 56], [38, 100], [42, 136]], 8, 150); limb(o, [[80, 56], [90, 100], [86, 136]], 8, 150); }
  // 4 lamp bearer
  { const o = W * 4; head(o, 60, 36); poly(o, [[46, 52], [74, 52], [78, 122], [42, 122]], 196); drape(o, 60, 118, 250, 19, 28, 216); limb(o, [[72, 58], [92, 86], [104, 84]], 8, 140); limb(o, [[48, 58], [70, 92], [100, 90]], 8, 140); lamp(o, 108, 80); }
  // 5 seated, wrapped in a shawl
  { const o = W * 5; head(o, 64, 150); poly(o, [[44, 166], [84, 166], [106, 250], [22, 250]], 206); x.strokeStyle = R(150); x.lineWidth = 2; x.beginPath(); x.moveTo(o + 50, 170); x.lineTo(o + 36, 248); x.moveTo(o + 78, 170); x.lineTo(o + 92, 248); x.stroke(); lamp(o, 64, 244); }
  // 6 two together
  { const o = W * 6; head(o, 44, 52, 11); poly(o, [[32, 66], [56, 66], [58, 130], [30, 130]], 186); drape(o, 44, 126, 250, 16, 25, 206); head(o, 86, 40, 11); poly(o, [[72, 54], [100, 54], [102, 150], [70, 150]], 224); poly(o, [[72, 148], [102, 148], [100, 250], [74, 250]], 198); limb(o, [[72, 62], [60, 96], [56, 100]], 7, 150); }
  // 7 drummer
  { const o = W * 7; head(o, 62, 34); poly(o, [[44, 50], [80, 50], [82, 140], [42, 140]], 214); poly(o, [[44, 138], [62, 138], [58, 250], [42, 250]], 196); poly(o, [[66, 138], [82, 138], [86, 250], [70, 250]], 196);
    x.fillStyle = R(110); x.beginPath(); x.ellipse(o + 66, 118, 34, 17, -.12, 0, TAU); x.fill(); x.fillStyle = R(236); x.beginPath(); x.ellipse(o + 98, 114, 6, 16, -.12, 0, TAU); x.fill();
    limb(o, [[46, 56], [30, 92], [40, 112]], 8, 150); limb(o, [[80, 56], [100, 84], [98, 104]], 8, 150); }
  const t = toTex(c); t.colorSpace = THREE.NoColorSpace; return t;
}

/* ---------- a camera-facing card material: frame picked per instance, coloured by two palette colours ---------- */
function cardMaterial(tex, frames, { crowd = false } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', alphaTest: .5, side: THREE.DoubleSide });
  const U = { tCard: { value: tex }, uFr: { value: frames }, uShade: { value: PAINT.shade }, uLit: { value: PAINT.lit }, uLight: { value: PAINT.light }, uLamp: { value: PAINT.lamp },
    uTime: { value: 0 }, uBeat: { value: 0 }, uGrow: { value: 1 } };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aF; attribute float aPh; uniform float uFr, uTime, uBeat, uGrow; varying vec2 vUvC; varying float vPh;')
      .replace('#include <project_vertex>', `
        vec4 ctrW = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec3 toC = cameraPosition - ctrW.xyz; vec3 tc = normalize(vec3(toC.x + 1e-4, 0., toC.z));
        vec3 rgt = vec3(tc.z, 0., -tc.x);
        float bob = ${crowd ? '1.0 + 0.035 * sin(uBeat * 6.2831853 + aPh * 6.2831853)' : '1.0'};
        float sway = ${crowd ? '0.05 * sin(uBeat * 3.1415927 + aPh * 9.0) * position.y' : '0.012 * sin(uTime * 0.7 + aPh * 6.2831853) * position.y * position.y'};
        vec3 wp = ctrW.xyz + rgt * ((position.x + sway) * sx) + vec3(0., position.y * sy * bob * uGrow, 0.);
        vUvC = vec2((uv.x + aF) / uFr, uv.y); vPh = aPh;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tCard; uniform vec3 uShade, uLit, uLight, uLamp; varying vec2 vUvC; varying float vPh;')
      .replace('#include <map_fragment>', crowd
        ? 'vec4 cT = texture2D(tCard, vUvC); diffuseColor *= vec4(mix(uShade, uLit, cT.r) * uLight, max(cT.r, cT.b) > 0.2 ? 1.0 : 0.0);'
        : 'vec4 cT = texture2D(tCard, vUvC); diffuseColor *= vec4(mix(uShade, uLit, smoothstep(0.2, 0.85, cT.r)) * uLight, cT.a);')
      .replace('#include <color_fragment>', crowd ? '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uLamp, step(0.5, cT.b));' : '#include <color_fragment>');
  };
  if (m.fog) { m.userData.hf = 1; chainHook(m, 'hf', (sh) => Object.assign(sh.uniforms, HFOG)); }
  return m;
}
function cardMesh(scene, mat, pts, frameOf) {
  // pts: [x, y, z, width, height, tint]
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), n = Math.max(1, pts.length);
  const aF = new Float32Array(n), aPh = new Float32Array(n), r = rng(pts.length * 7 + 3), cc = new THREE.Color();
  const im = new THREE.InstancedMesh(geo, mat, n); im.count = pts.length;
  pts.forEach(([x, y, z, w, h, tint], i) => {
    aF[i] = frameOf(i, r); aPh[i] = r();
    _p.set(x, y, z); _q.identity(); _s.set(w, h, 1); setIM(im, i, _p, _q, _s);
    im.setColorAt(i, tint || cc.setRGB(.88 + r() * .24, .88 + r() * .24, .88 + r() * .24));
  });
  _s.set(1, 1, 1);
  geo.setAttribute('aF', new THREE.InstancedBufferAttribute(aF, 1)); geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(aPh, 1));
  im.frustumCulled = false; scene.add(im); return im;
}

function buildPainted(scene, Q, FO) {
  const out = { crowds: [] }, r = rng(5150);
  // the crowd keeps clear of where a camera actually stands (not of its whole line of sight, or the orbiting shots would empty the floor)
  const camCells = new Set();
  for (const list of SHOTS) for (const fn of list) { if (!fn) continue;
    for (let rt = 0; rt < 420; rt += 1.2) { const sh = fn(rt); if (!sh) continue; const [px, py, pz] = sh.p; if (py - groundY(px, pz) > 4) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) camCells.add((Math.floor(px / 1.6) + dx) + ',' + (Math.floor(pz / 1.6) + dz)); } }
  const inLens = (x, z) => camCells.has(Math.floor(x / 1.6) + ',' + Math.floor(z / 1.6));
  /* trees: every tree the forest placed (already kept out of the director's lenses) becomes a painted card */
  const treeMat = cardMaterial(paintTreeAtlas(), 4);
  const T = [];
  for (const [x, z, s, sy] of (FO && FO.pts ? FO.pts.broad : [])) { const h = 9.9 * sy * (.9 + r() * .35); T.push([x, groundY(x, z) - .3, z, h * .75, h, null, r() < .5 ? 0 : r() < .6 ? 1 : 3]); }
  for (const [x, z, s, sy] of (FO && FO.pts ? FO.pts.conifer : [])) { const h = 9.6 * sy * (1 + r() * .4); T.push([x, groundY(x, z) - .3, z, h * .75, h, null, r() < .7 ? 2 : 3]); }
  out.trees = cardMesh(scene, treeMat, T, (i) => T[i][6]); out.treeMat = treeMat;

  /* the festival crowd, in four gatherings that come and go with the hours */
  const figTex = paintFigureAtlas();
  const CLOTH = ['#f2e6d0', '#e8b35a', '#d8563a', '#c23a5e', '#7a4a8a', '#3f7a86', '#e9d7a8', '#b9482c', '#f0c2a0', '#5b6fa8'].map(col);
  const mkCrowd = (name, n, spot, poses) => {
    const P = [];
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const s = spot(); if (!s) continue; const [x, z, y] = s;
      if (inLens(x, z, .7, 0, 2.1, 0)) continue;                    // nobody stands in front of a lens
      const h = 1.62 + r() * .3; P.push([x, (y === undefined ? groundY(x, z) : y) - .04, z, h * .5, h, CLOTH[Math.floor(r() * CLOTH.length)].clone().multiplyScalar(.85 + r() * .3)]); i++;
    }
    const mat = cardMaterial(figTex, 8, { crowd: true }), im = cardMesh(scene, mat, P, (i, rr) => poses[Math.floor(rr() * poses.length)]);
    out.crowds.push({ name, im, mat, w: 0 });
  };
  const ringSpot = (cx, cz, r0, r1, y) => () => { const a = r() * TAU, d = Math.sqrt(lerp(r0 * r0, r1 * r1, r())); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d, y]; };
  // the procession: up the lamp-lit steps and across the forecourt
  mkCrowd('steps', 150, () => { const x = -112 + r() * 60, z = (r() - .5) * (x > STAIR.x0 ? 9.6 : 26); return [x, z, stepY(x, z)]; }, [0, 3, 4, 4, 6, 0, 3]);
  // the dance floor round the ring stage
  mkCrowd('floor', 520, () => { const s = ringSpot(0, 0, 16.5, 33)(); return s[0] < -33 && Math.abs(s[1]) < 8 ? null : [s[0], s[1], undefined]; }, [1, 2, 1, 2, 7, 0, 3, 6]);
  // the ridge: dancers at midnight, then watchers and sleepers under the stars
  mkCrowd('ridge', 90, ringSpot(GEO.R.x, GEO.R.z, 3.5, 12.5), [1, 2, 5, 5, 0, 4]);
  // the plaza: the city come out to walk round the great wheel
  mkCrowd('plaza', 520, ringSpot(GEO.P.x, GEO.P.z, 18.5, 30), [0, 3, 6, 0, 3, 4, 7]);

  /* lanterns by night, kites by day: small things at the scale of the sky */
  const mkPoints = (n, kite) => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = kite ? 30 + r() * 150 : 10 + Math.sqrt(r()) * 150; pos.set([Math.cos(a) * d + (kite ? GEO.P.x * .5 : 0), 0, Math.sin(a) * d + (kite ? GEO.P.z * .5 : 0)], i * 3); seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(seed, 1));
    const U = { uTime: { value: 0 }, uI: { value: 0 }, uPx: { value: 700 }, uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() } };
    const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: kite ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `attribute float aS; uniform float uTime, uPx; varying float vS; varying float vA;
        void main(){ vS = aS; vec3 p = position;
          ${kite ? 'p.y = 46.0 + aS * 70.0 + 5.0 * sin(uTime * .31 + aS * 40.0); p.x += 7.0 * sin(uTime * .17 + aS * 23.0); p.z += 6.0 * cos(uTime * .13 + aS * 31.0); vA = 1.0;'
                 : 'float rise = fract(aS * 7.3 + uTime * (.004 + .004 * aS)); p.y = 12.0 + rise * 150.0; p.x += 6.0 * sin(uTime * .09 + aS * 50.0) + rise * 24.0; vA = smoothstep(0.0, .08, rise) * (1.0 - smoothstep(.75, 1.0, rise));'}
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uPx * ${kite ? '2.6' : '1.5'} / max(-mv.z, 1.0) + ${kite ? '2.0' : '1.5'}; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uI, uTime; uniform vec3 uCol, uCol2; varying float vS; varying float vA;
        void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0;
          ${kite ? 'float d = abs(p.x) * 1.25 + abs(p.y); if (d > .92 || uI < .02) discard; vec3 c = mix(uCol, uCol2, step(.5, fract(vS * 5.0))) * (p.x * p.y > 0.0 ? 1.0 : .82); gl_FragColor = vec4(c, uI);'
                 : 'float body = smoothstep(.62, .5, max(abs(p.x) * 1.5, abs(p.y + .1))); float glow = exp(-dot(p, p) * 2.6) * .55; float a = (body * (1.0 + .6 * (0.5 - p.y)) + glow) * (.8 + .2 * sin(uTime * 3.0 + vS * 60.0)) * vA * uI; if (a < .004) discard; gl_FragColor = vec4(mix(uCol, uCol2, .35 + .4 * body) * a, 1.0);'} }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts); return { pts, U };
  };
  out.lanterns = mkPoints(90, false); out.kites = mkPoints(22, true);
  return out;
}
const _pa1 = new THREE.Color();
function updatePainted(PA, SK, look, w, rt, px) {
  // the cards take the hour: shade and light from the palette's near-range and stone-in-light, lifted by the sky's fill
  PAINT.shade.copy(look.near).multiplyScalar(.55); PAINT.lit.copy(look.near).lerp(look.hilite, .45);
  PAINT.light.copy(SK.hemi.color).multiplyScalar(SK.hemi.intensity * .5 + .4).add(_pa1.copy(SK.key.color).multiplyScalar(SK.key.intensity * .16 * Math.max(S.keyDir.y, .15)));
  const mx = Math.max(PAINT.light.r, PAINT.light.g, PAINT.light.b); if (mx > 1.3) PAINT.light.multiplyScalar(1.3 / mx);
  PAINT.lamp.copy(look.accent).lerp(look.hilite, .4).multiplyScalar(2.2);
  PA.treeMat.userData.U.uTime.value = rt;
  const W8 = { steps: w[0] + w[7] + w[1] * .3, floor: w[1] + w[4] + w[0] * .5 + w[2] * .25, ridge: w[2] + w[3] * .6, plaza: w[5] + w[6] + w[7] * .25 };
  for (const C of PA.crowds) {
    const k = smooth(.06, .5, W8[C.name]); C.im.visible = k > .01;
    const U = C.mat.userData.U; U.uGrow.value = k; U.uBeat.value = S.beatPos; U.uTime.value = rt;
  }
  const night = w[0] * .6 + w[1] + w[2] * .7 + w[3] * .35, day = w[5] + w[6] + w[7] * .7 + w[4] * .5;
  const L = PA.lanterns.U; L.uTime.value = rt; L.uI.value = night; L.uPx.value = px; L.uCol.value.copy(look.accent); L.uCol2.value.copy(look.hilite); PA.lanterns.pts.visible = night > .02;
  const K = PA.kites.U; K.uTime.value = rt; K.uI.value = clamp(day, 0, 1); K.uPx.value = px; K.uCol.value.copy(look.accent); K.uCol2.value.copy(look.hilite); PA.kites.pts.visible = day > .02;
}
