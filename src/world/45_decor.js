/* =========================================================================
   DECOR — marigold garlands, mango-leaf torans and festival string lights:
   swags along the lamp-lit steps, a toran across the portal, a canopy of
   bulbs over the dance floor, zigzags over the city road, radials from the
   great wheel's pillar, and coloured strings between the ridge stones
   ========================================================================= */
const BULB_COL = ['#ffd08a', '#f0a050', '#c88a9c', '#9ab4c8', '#b0a2c4'].map(col);   // warm lamps; the ridge's are dusty rose, moon blue, faded violet
function buildDecor(scene, Q, ST, TE) {
  const r = rng(808), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = V3(), s3 = V3(1, 1, 1), Y = V3(0, 1, 0);
  const areas = {};
  const area = (name) => areas[name] || (areas[name] = { balls: [], bulbs: [], leaves: [] });
  // A → B, sagging `sag` metres at the middle (a parabola is close enough to a catenary at these spans)
  const at = (A, B, sag, s) => [lerp(A[0], B[0], s), lerp(A[1], B[1], s) - 4 * sag * s * (1 - s), lerp(A[2], B[2], s)];
  const garland = (name, A, B, sag, o = {}) => {
    const G = area(name), L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    if (!o.lightsOnly) {
      const n = Math.max(2, Math.round(L / .12)), band = o.band || 6, pal = o.pal || [0, 1];
      for (let k = 0; k <= n; k++) { const p = at(A, B, sag, k / n); G.balls.push(p[0], p[1], p[2], pal[Math.floor(k / band) % pal.length]); }
    }
    if (o.bulbs) {
      const m = Math.max(1, Math.round(L / o.bulbs));
      for (let k = 0; k <= m; k++) { const p = at(A, B, sag, k / m), c = Array.isArray(o.bulbCol) ? o.bulbCol[k % o.bulbCol.length] : (o.bulbCol || 0); G.bulbs.push(p[0], p[1] - .06, p[2], c, k); }
    }
    if (o.fringe) {   // strands hanging from the swag, each ending in a mango leaf
      const m = Math.round(L / o.fringe);
      for (let k = 1; k < m; k++) {
        const p = at(A, B, sag, k / m), len = .6 + r() * .7, nb = Math.round(len / .12);
        for (let j = 1; j <= nb; j++) G.balls.push(p[0], p[1] - j * .12, p[2], j === nb ? 4 : (k % 2 ? 1 : 0));
        G.leaves.push(p[0], p[1] - len - .16, p[2], r() * TAU);
      }
    }
    if (o.toran) {    // a row of mango leaves just under the rope
      const m = Math.round(L / o.toran);
      for (let k = 0; k <= m; k++) { const p = at(A, B, sag, k / m); G.leaves.push(p[0], p[1] - .2, p[2], Math.atan2(B[0] - A[0], B[2] - A[2]) + Math.PI / 2 + (r() - .5) * .5); }
    }
  };

  /* ---------- the lamp-lit steps: posts on both walls, swags between them, three crossings ---------- */
  const rampY = (x) => lerp(FORE_H, HP, clamp((x - STAIR.x0) / (STAIR.x1 - STAIR.x0), 0, 1));
  const posts = [];
  const NPOST = 7, wz = STAIR.half + .35;
  for (let k = 0; k < NPOST; k++) {
    const x = STAIR.x0 + .6 + k * (STAIR.x1 - STAIR.x0 - 1.2) / (NPOST - 1), top = rampY(x) + 1.0 + 2.6;
    for (const sz of [-wz, wz]) posts.push([x, rampY(x) + 1.0, sz, 2.6]);
    if (k) for (const sz of [-wz, wz]) { const xp = STAIR.x0 + .6 + (k - 1) * (STAIR.x1 - STAIR.x0 - 1.2) / (NPOST - 1); garland('steps', [xp, rampY(xp) + 3.6, sz], [x, top, sz], .55, { bulbs: .55, pal: [0, 1], band: 5 }); }
    if (k % 2 === 1) garland('steps', [x, top, -wz], [x, top, wz], 1.0, { bulbs: .6, pal: [1, 0, 3], band: 4 });
  }
  // forecourt entrance: two taller posts and a deep swag with a fringe
  for (const sz of [-wz, wz]) posts.push([STAIR.x0 - 4, FORE_H, sz, 5.2]);
  garland('steps', [STAIR.x0 - 4, FORE_H + 5.2, -wz], [STAIR.x0 - 4, FORE_H + 5.2, wz], 1.4, { bulbs: .5, fringe: .9, pal: [0, 1, 3], band: 4 });

  /* ---------- the portal: a toran across both faces of the wheel, tower to tower ---------- */
  for (const dx of [-2.4, 2.4]) {
    const A = [GEO.GATE.x + dx, HP + 14.6, -9.8], B = [GEO.GATE.x + dx, HP + 14.6, 9.8];
    garland('gate', A, B, 3.2, { bulbs: .5, bulbCol: 1, fringe: 1.1, toran: .32, pal: [0, 1, 0, 3], band: 5 });
    garland('gate', [A[0], A[1] - 2.2, A[2] + .4], [B[0], B[1] - 2.2, B[2] - .4], 1.2, { pal: [1, 0], band: 6 });
  }

  /* ---------- the dance floor: swags between the banner poles, strings of bulbs in toward the booth ---------- */
  const outer = [], inner = [];
  for (let i = 0; i < 10; i++) { const a = (i + .5) / 10 * TAU, x = Math.cos(a) * 31.5, z = Math.sin(a) * 31.5, f = Math.atan2(x, z); outer.push([x - Math.cos(f) * .85, HP + 7.55, z + Math.sin(f) * .85]); }
  for (let i = 0; i < 4; i++) { const a = (i + .5) / 4 * TAU, x = Math.cos(a) * 2.9, z = Math.sin(a) * 2.9, f = Math.atan2(x, z); inner.push([x - Math.cos(f) * .55, HP + 3.95, z + Math.sin(f) * .55]); }
  for (let i = 0; i < 10; i++) {
    garland('floor', outer[i], outer[(i + 1) % 10], 1.8, { bulbs: .6, pal: [0, 1], band: 6 });
    const o = outer[i]; let best = inner[0], bd = 1e9; for (const p of inner) { const d = Math.hypot(p[0] - o[0], p[2] - o[2]); if (d < bd) { bd = d; best = p; } }
    garland('floor', best, o, 1.1, { lightsOnly: true, bulbs: .75, bulbCol: [0, 1] });
  }

  /* ---------- the city: zigzags over the road between lamp posts, radials from the great wheel's pillar ---------- */
  const P = GEO.P, xs = [];
  for (let x = -104; x <= 104; x += 16) { if (Math.abs(x - P.x) < 36) continue; xs.push(x); }
  for (const x of xs) {
    garland('city', [x, 7.5, P.z - 6.2], [x + 8, 7.5, P.z + 6.2], .9, { bulbs: .55, pal: [0, 1, 2], band: 5, bulbCol: [0, 1] });
    if (xs.includes(x + 16)) garland('city', [x + 8, 7.5, P.z + 6.2], [x + 16, 7.5, P.z - 6.2], .9, { bulbs: .55, pal: [1, 0, 2], band: 5, bulbCol: [1, 0] });
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + .2;
    garland('plaza', [P.x + Math.cos(a) * .9, 9.75, P.z + Math.sin(a) * .9], [P.x + Math.cos(a) * 34.8, 7.5, P.z + Math.sin(a) * 34.8], 2.2, { lightsOnly: true, bulbs: .7, bulbCol: [0, 0, 1] });
  }
  for (const [h, rr] of [[3.1, .72], [5.4, .7], [7.6, .68]]) for (let k = 0; k < 8; k++) {     // loops draped round the pillar
    const a0 = k / 8 * TAU, a1 = (k + 1) / 8 * TAU;
    garland('plaza', [P.x + Math.cos(a0) * rr, h, P.z + Math.sin(a0) * rr], [P.x + Math.cos(a1) * rr, h, P.z + Math.sin(a1) * rr], .18, { pal: [0, 1], band: 3 });
  }

  /* ---------- the sun temple: lamps along the chariot platform ---------- */
  if (TE) for (const [A, B] of TE.lights) garland('temple', A, B, .3, { lightsOnly: true, bulbs: .7, bulbCol: [1, 0] });

  /* ---------- the ridge: coloured bulbs from stone to stone ---------- */
  const tops = ST.ridge.stoneTops;
  for (let i = 0; i < tops.length; i++) garland('ridge', tops[i], tops[(i + 1) % tops.length], .9, { lightsOnly: true, bulbs: .45, bulbCol: [2, 3, 4] });

  /* ---------- the ridge: fluorescent mandala backdrops that glow under the midnight UV ---------- */
  const uvU = { value: 0 };
  const mandala = () => {
    const [c, x] = cnv(512, 384); x.fillStyle = '#e4d6bb'; x.fillRect(0, 0, 512, 384); speckle(x, 512, 384, 3000, .08);
    const F = ['#8e2c1f', '#2f3f5c', '#b8862e', '#5a3a28', '#56704a'], cx = 256, cy = 192, rr = rng(5 + Math.floor(r() * 99));
    x.lineWidth = 3;
    for (let ring = 0; ring < 6; ring++) {
      const R0 = 16 + ring * 27, n = [8, 12, 16, 20, 24, 32][ring], colr = F[(ring + Math.floor(rr() * 5)) % 5];
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU; x.save(); x.translate(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); x.rotate(a);
        x.strokeStyle = colr; x.beginPath(); x.ellipse(10, 0, 13, 5.5, 0, 0, TAU); x.stroke();
        if (ring % 2) { x.fillStyle = F[(ring + 2) % 5]; x.beginPath(); x.arc(24, 0, 2.4, 0, TAU); x.fill(); }
        x.restore();
      }
      x.strokeStyle = F[(ring + 3) % 5]; x.globalAlpha = .7; x.beginPath(); x.arc(cx, cy, R0 + 13, 0, TAU); x.stroke(); x.globalAlpha = 1;
    }
    for (let k = 0; k < 2; k++) { x.strokeStyle = F[k]; x.beginPath(); for (let j = 0; j < 4; j++) { const a = (j / 3) * TAU + k * Math.PI + Math.PI / 2; x[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); } x.stroke(); }
    x.fillStyle = F[2]; x.beginPath(); x.arc(cx, cy, 5, 0, TAU); x.fill();
    for (let k = 0; k < 40; k++) { x.fillStyle = F[k % 5]; x.beginPath(); x.moveTo(k * 12.8, 384); x.lineTo(k * 12.8 + 6.4, 370); x.lineTo(k * 12.8 + 12.8, 384); x.fill(); x.beginPath(); x.moveTo(k * 12.8, 0); x.lineTo(k * 12.8 + 6.4, 14); x.lineTo(k * 12.8 + 12.8, 0); x.fill(); }
    return c;
  };
  const tapTex = [toTex(mandala()), toTex(mandala())];
  const tapMats = tapTex.map(t => { const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: .9, side: THREE.DoubleSide });
    m.emissiveMap = null; m.emissive.set('#000000');
    return m; });
  const tapG = new THREE.PlaneGeometry(4.2, 3.15, 1, 6);
  const tapPoles = [];
  [1.35, 1.95, 2.55, 3.15, 3.75, 4.35].forEach((a, k) => {
    const x = GEO.R.x + Math.cos(a) * 19.2, z = GEO.R.z + Math.sin(a) * 19.2, gy = groundY(x, z), face = Math.atan2(GEO.R.x - x, GEO.R.z - z);
    const m = new THREE.Mesh(tapG, tapMats[k % 2]); m.position.set(x, gy + 1.75, z); m.rotation.y = face; m.castShadow = true; scene.add(m);
    for (const sd of [-1, 1]) tapPoles.push([x + Math.cos(face) * 2.2 * sd, gy, z - Math.sin(face) * 2.2 * sd]);
  });
  const tpIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.05, .06, 3.6, 6).translate(0, 1.8, 0), ST.M.pole, tapPoles.length);
  tapPoles.forEach(([x, y, z], k) => { p3.set(x, y, z); q.identity(); s3.set(1, 1, 1); m4.compose(p3, q, s3); tpIM.setMatrixAt(k, m4); }); scene.add(tpIM);

  /* ---------- meshes ---------- */
  const ballG = new THREE.OctahedronGeometry(.068, 0);                 // 8 faces: a flower head is a few pixels at most distances
  { const p = ballG.attributes.position, n = ballG.attributes.normal; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); } }
  const ballMat = new THREE.MeshStandardMaterial({ roughness: .75, metalness: 0 });
  const FLOWER = ['#e8792a', '#f2b12a', '#b8322a', '#f3ede2', '#2f6b2a'].map(col);
  const leafG = new THREE.BufferGeometry();
  leafG.setAttribute('position', new THREE.Float32BufferAttribute([0, .16, 0, .045, 0, 0, 0, -.18, 0, -.045, 0, 0], 3));
  leafG.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); leafG.setIndex([0, 1, 2, 0, 2, 3]);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: .7, side: THREE.DoubleSide });
  const bulbU = { uTime: { value: 0 }, uLit: { value: 0 }, uSize: { value: 600 } };
  const bulbMat = new THREE.ShaderMaterial({
    uniforms: bulbU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute float aK; uniform float uTime, uLit, uSize; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float tw = .8 + .2 * sin(uTime * 2.2 - aK * .45);
        vC = aCol * tw * uLit; gl_PointSize = uSize * .09 / max(-mv.z, 1.0) + 1.5; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p);
        float a = (smoothstep(.35, 0.0, d) * 1.6 + exp(-d * 4.0) * .5) * (1.0 - smoothstep(.55, 1.0, d)); if (a * max(vC.r, max(vC.g, vC.b)) < .004) discard;
        gl_FragColor = vec4(vC * a, 1.0); }`,
  });
  const c = new THREE.Color();
  let nBalls = 0, nBulbs = 0;
  for (const name in areas) {
    const G = areas[name], nb = G.balls.length / 4;
    if (nb) {
      const im = new THREE.InstancedMesh(ballG, ballMat, nb);
      for (let k = 0; k < nb; k++) {
        const o = k * 4; p3.set(G.balls[o], G.balls[o + 1], G.balls[o + 2]); q.setFromAxisAngle(Y, r() * TAU); const sc = .85 + r() * .3; s3.set(sc, sc * .9, sc);
        m4.compose(p3, q, s3); im.setMatrixAt(k, m4); c.copy(FLOWER[G.balls[o + 3]]).multiplyScalar(.88 + r() * .2); im.setColorAt(k, c);
      }
      im.computeBoundingSphere(); scene.add(im); nBalls += nb;
    }
    const nl = G.leaves.length / 4;
    if (nl) {
      const im = new THREE.InstancedMesh(leafG, leafMat, nl);
      for (let k = 0; k < nl; k++) { const o = k * 4; p3.set(G.leaves[o], G.leaves[o + 1], G.leaves[o + 2]); q.setFromAxisAngle(Y, G.leaves[o + 3]); s3.set(1, 1, 1); m4.compose(p3, q, s3); im.setMatrixAt(k, m4); }
      im.computeBoundingSphere(); scene.add(im);
    }
    const nu = G.bulbs.length / 5;
    if (nu) {
      const pos = new Float32Array(nu * 3), cc = new Float32Array(nu * 3), kk = new Float32Array(nu);
      for (let k = 0; k < nu; k++) { const o = k * 5, bc = BULB_COL[G.bulbs[o + 3]]; pos.set([G.bulbs[o], G.bulbs[o + 1], G.bulbs[o + 2]], k * 3); cc.set([bc.r * 1.35, bc.g * 1.35, bc.b * 1.35], k * 3); kk[k] = G.bulbs[o + 4]; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
      g.computeBoundingSphere(); const pts = new THREE.Points(g, bulbMat); pts.renderOrder = 3; scene.add(pts); nBulbs += nu;
    }
  }
  // posts on the stair walls
  const postIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.05, .065, 1, 6).translate(0, .5, 0), ST.M.pole, posts.length);
  posts.forEach(([x, y, z, h], k) => { p3.set(x, y, z); q.identity(); s3.set(1, h, 1); m4.compose(p3, q, s3); postIM.setMatrixAt(k, m4); });
  postIM.castShadow = true; scene.add(postIM);
  return { bulbU, uvU, counts: { balls: nBalls, bulbs: nBulbs } };
}
