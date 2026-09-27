/* =========================================================================
   STRUCTURES — ring stage, portal gate (24 carriable panels), steps, arches,
   banners, diyas, stone circle, ruins + synth, the celestial ring
   ========================================================================= */
function annularSector(r0, r1, a0, a1, depth, seg = 12) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
}
function setIM(im, i, p, q, s) { _m4.compose(p, q, s); im.setMatrixAt(i, _m4); }
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V3(), _s = V3(1, 1, 1), _e = new THREE.Euler();

function buildStructures(scene, Q) {
  const out = { updates: [] };
  const relief = toTex(texRelief(), { repeat: true });
  const rtex = (rx, ry) => { const t = relief.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; };
  const M = {
    stone: new THREE.MeshStandardMaterial({ color: '#cbb48d', map: rtex(.32, .6), bumpMap: rtex(.32, .6), bumpScale: 2, roughness: .9 }),
    stoneFine: new THREE.MeshStandardMaterial({ color: '#c9b38e', map: rtex(1, 1), bumpMap: rtex(1, 1), bumpScale: 2, roughness: .9 }),
    plain: new THREE.MeshStandardMaterial({ color: '#a8997f', roughness: .95 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d6a13a', metalness: .85, roughness: .32, emissive: new THREE.Color('#ffb040'), emissiveIntensity: 0 }),
    basalt: new THREE.MeshStandardMaterial({ color: '#6d6a64', map: rtex(.5, .5), bumpMap: rtex(.5, .5), bumpScale: 2, roughness: .95 }),
    clay: new THREE.MeshStandardMaterial({ color: '#6b3a22', roughness: .9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: .85 }),
    pole: new THREE.MeshStandardMaterial({ color: '#2c231c', roughness: .8 }),
  };
  out.M = M;
  // carved stone and metal (sheets fill in from the carving workers)
  const K = buildCarving(PARAM.quality); out.K = K;
  const C = {
    panel: atlasHook(carvedMaterial(K.panels)), band: carvedMaterial(K.band), spoke: carvedMaterial(K.spoke), bronze: carvedMaterial(K.bronze),
    lotus: carvedMaterial(K.lotus), chakra: carvedMaterial(K.chakra), frieze: carvedMaterial(K.frieze), strip: carvedMaterial(K.strip),
    wall: carvedMaterial(K.wall), ashlar: carvedMaterial(K.ashlar), granite: carvedMaterial(K.granite), star: carvedMaterial(K.star),
  };
  C.band2 = carvedMaterial(K.band, { repeat: [2, 1] }); C.band5 = carvedMaterial(K.band, { repeat: [5, 1] });
  out.C = C; out.reflect = [C.bronze];

  /* ---------- clearing floor + rangoli ---------- */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(45.5, 96), new THREE.MeshStandardMaterial({ map: toTex(texFlagstones(Q.tex)), color: '#c4b8a2', roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, HP + .035, 0); floor.receiveShadow = true; scene.add(floor);
  const rangoliMat = new THREE.MeshStandardMaterial({ map: toTex(texRangoli(Q.tex)), transparent: true, opacity: 0, depthWrite: false, roughness: .9, polygonOffset: true, polygonOffsetFactor: -2 });
  const rangoli = new THREE.Mesh(new THREE.CircleGeometry(34, 96), rangoliMat);
  rangoli.rotation.x = -Math.PI / 2; rangoli.position.set(0, HP + .06, 0); rangoli.receiveShadow = true; scene.add(rangoli); out.rangoliMat = rangoliMat;

  /* ---------- ring stage (The Gathering) ---------- */
  const stage = new THREE.Group(); stage.position.set(0, HP, 0); scene.add(stage);
  const wallGeo = [];
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * TAU + (k % 2 === 0 ? .27 : .1), a1 = (k + 1) / 8 * TAU - ((k + 1) % 2 === 0 ? .27 : .1);
    const g = annularBlock(12.1, 13.9, a0, a1, 0, 1.35, 20, { tile: 5.4, capU: 7.2 }); g.rotateX(-Math.PI / 2); wallGeo.push(g);
  }
  const wall = new THREE.Mesh(mergeGrouped(wallGeo), [C.strip, C.frieze, C.ashlar]); wall.castShadow = wall.receiveShadow = true; stage.add(wall);
  const towerG = boxUV(new THREE.BoxGeometry(2.5, 2.5, 2.5), 2.5 / .7 * .7, 2.5, { fitV: true }); towerG.translate(0, 1.25, 0);
  const towers = new THREE.InstancedMesh(towerG, C.wall, 4);
  const capG = new THREE.CylinderGeometry(1.15, 1.25, .38, 28); capG.translate(0, 2.7, 0);
  const caps = new THREE.InstancedMesh(capG, [C.band2, C.chakra, C.ashlar], 4);
  for (let j = 0; j < 4; j++) {
    const a = (j * 2 + 1) / 8 * TAU; _p.set(Math.cos(a) * 13, 0, -Math.sin(a) * 13); _q.setFromAxisAngle(V3(0, 1, 0), a); setIM(towers, j, _p, _q, _s); setIM(caps, j, _p, _q, _s);
  }
  // threshold stones at the four openings
  const sill = new THREE.InstancedMesh(boxUV(new THREE.BoxGeometry(2.2, .12, 5.2), 2.2), C.ashlar, 4);
  for (let j = 0; j < 4; j++) { const a = j / 4 * TAU; _p.set(Math.cos(a) * 13, .06, -Math.sin(a) * 13); _q.setFromAxisAngle(V3(0, 1, 0), a); setIM(sill, j, _p, _q, _s); }
  sill.receiveShadow = true; stage.add(sill);
  towers.castShadow = true; stage.add(towers, caps);
  const stripMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: true });
  { const sg = [];
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * TAU + (k % 2 === 0 ? .27 : .1), a1 = (k + 1) / 8 * TAU - ((k + 1) % 2 === 0 ? .27 : .1);
      for (const r of [12.12, 13.88]) { const g = new THREE.TorusGeometry(r, .06, 6, 28, a1 - a0); g.rotateZ(-a1); sg.push(g); }
    }
    const t = new THREE.Mesh(mergeGeometries(sg), stripMat); t.rotation.x = Math.PI / 2; t.position.y = 1.37; stage.add(t); }
  const floorStrip = new THREE.Mesh(new THREE.TorusGeometry(15.5, .05, 6, 220), stripMat); floorStrip.rotation.x = Math.PI / 2; floorStrip.position.y = .08; stage.add(floorStrip);
  // DJ booth
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, .5, 48), [C.band5, C.lotus, C.ashlar]); plat.position.y = .25; plat.castShadow = plat.receiveShadow = true; stage.add(plat);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, .95, .9), M.wood); table.position.set(0, .5 + .475, .35); table.castShadow = true; stage.add(table);
  const knobMat = new THREE.MeshBasicMaterial({ color: '#ff5a2a' });
  const knobs = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .03, .05), knobMat, 36);
  for (let i = 0; i < 36; i++) { _p.set(-1.1 + (i % 12) * .2, 1.46, .1 + Math.floor(i / 12) * .17); _q.identity(); setIM(knobs, i, _p, _q, _s); }
  stage.add(knobs);
  for (const sx of [-.75, .75]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .05, 24), new THREE.MeshStandardMaterial({ color: '#111', roughness: .4 })); d.position.set(sx, 1.47, .4); stage.add(d); }
  out.stage = { stripMat, knobMat };

  /* ---------- banners (clearing ring + booth) ---------- */
  const bannerTex = toTex(texBanner());
  const bGeos = [], poles = [];
  const addBanner = (x, z, yTop, w, h, face) => {
    const g = new THREE.PlaneGeometry(w, h, 1, 14); g.translate(0, -h / 2, 0);
    const nrm = V3(Math.sin(face), 0, Math.cos(face));
    g.rotateY(face); g.translate(x, yTop, z);
    const ph = new Float32Array(g.attributes.position.count).fill(Math.random() * 10);
    const nr = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < nr.length; i += 3) { nr[i] = nrm.x; nr[i + 1] = 0; nr[i + 2] = nrm.z; }
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aNrm', new THREE.BufferAttribute(nr, 3));
    bGeos.push(g); poles.push([x - Math.cos(face) * (w / 2 + .1), z + Math.sin(face) * (w / 2 + .1), yTop + .4, x, z, face, w, yTop]);
  };
  for (let i = 0; i < 10; i++) { const a = (i + .5) / 10 * TAU, r = 31.5; const x = Math.cos(a) * r, z = Math.sin(a) * r; addBanner(x, z, HP + 7.2, 1.5, 4.8, Math.atan2(x, z)); }
  for (let i = 0; i < 4; i++) { const a = (i + .5) / 4 * TAU, r = 2.9; const x = Math.cos(a) * r, z = Math.sin(a) * r; addBanner(x, z, HP + 3.6, .9, 2.4, Math.atan2(x, z)); }
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, color: '#b3261e', side: THREE.DoubleSide, roughness: .85 });
  const bannerU = { uTime: { value: 0 } };
  bannerMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = bannerU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPhase; attribute vec3 aNrm; uniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hang = 1.0 - uv.y; transformed += aNrm * sin(uTime*1.7 + aPhase + hang*3.5) * hang * 0.35 + vec3(0.0,0.0,0.0);');
  };
  const banners = new THREE.Mesh(mergeGeometries(bGeos), bannerMat); banners.castShadow = true; banners.frustumCulled = false; scene.add(banners);
  const poleIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .09, 1, 8), M.pole, poles.length * 2);
  poles.forEach(([x, z, top, cx, cz, face, w, yTop], i) => {
    const base = groundY(x, z) + (Math.hypot(x, z) < 3.3 ? .5 : 0);
    _p.set(x, (top + base) / 2, z); _q.identity(); _s.set(1, top - base, 1); setIM(poleIM, i * 2, _p, _q, _s);
    _p.set(cx, yTop + .03, cz); _q.setFromEuler(_e.set(0, face, Math.PI / 2)); _s.set(.55, w + .3, .55); setIM(poleIM, i * 2 + 1, _p, _q, _s);
  });
  _s.set(1, 1, 1); scene.add(poleIM);
  out.banners = { bannerMat, bannerU };

  /* ---------- portal gate (Enter the Ring) ---------- */
  const gate = new THREE.Group(); gate.position.set(GEO.GATE.x, WHEEL_Y, GEO.GATE.z); gate.rotation.y = Math.PI / 2; scene.add(gate);
  const NP = 24, rIn = 7.1, rOut = 8.6, rMid = (rIn + rOut) / 2, depth = 1.4, aw = TAU / NP;
  const panelG = annularBlock(rIn, rOut, -aw / 2 + .006, aw / 2 - .006, -depth / 2, depth / 2, 8, { tile: 11.2 }); panelG.translate(-rMid, 0, 0);
  { const cell = new Float32Array(NP * 3), r = rng(24); for (let k = 0; k < NP; k++) { const c = k % 4; cell[k * 3] = (c % 2) * .5; cell[k * 3 + 1] = (c >> 1) * .5; cell[k * 3 + 2] = r() < .5 ? 1 : 0; } panelG.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 3)); }
  const panelIM = new THREE.InstancedMesh(panelG, [C.panel, C.band, C.ashlar], NP); panelIM.castShadow = true; panelIM.frustumCulled = false; scene.add(panelIM);
  gate.updateMatrixWorld(true);
  const slotMat = [];
  for (let k = 0; k < NP; k++) {
    const th = k / NP * TAU;
    const loc = new THREE.Matrix4().makeRotationZ(th).multiply(new THREE.Matrix4().makeTranslation(rMid, 0, 0));
    const w = gate.matrixWorld.clone().multiply(loc); slotMat.push(w); panelIM.setMatrixAt(k, w);
  }
  const innerRing = new THREE.Mesh(torusFriezeUV(new THREE.TorusGeometry(6.95, .3, 12, 160), 4), C.band); gate.add(innerRing);
  // lathe-turned spokes with bronze collars, carved bosses and a lotus hub
  const shaftG = [], collarG = [], bossG = [];
  const uvScale = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, thick = k % 2 === 0, L = 5.3, r = thick ? .44 : .19, circ = TAU * r, nu = thick ? 2 : 1;
    const g = uvScale(new THREE.CylinderGeometry(r * .92, r, L, thick ? 20 : 12, 1, true), nu, L / (circ / nu * 2)); g.translate(0, 1.65 + L / 2, 0); g.rotateZ(a - Math.PI / 2); shaftG.push(g);
    for (const rr of thick ? [2.2, 3.55, 5.25, 6.45] : [2.4, 4.6, 6.5]) { const c = uvScale(new THREE.CylinderGeometry(r * 1.3, r * 1.3, thick ? .2 : .12, thick ? 20 : 12, 1, false), 2, .15); c.translate(0, rr, 0); c.rotateZ(a - Math.PI / 2); collarG.push(c); }
    if (thick) { const c = new THREE.CylinderGeometry(.62, .62, 1.0, 28); c.rotateX(Math.PI / 2); c.translate(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0); bossG.push(c); }
  }
  const hubG = new THREE.CylinderGeometry(1.65, 1.65, 1.7, 48); hubG.rotateX(Math.PI / 2); bossG.push(hubG);
  const axG = uvScale(new THREE.CylinderGeometry(.62, .62, 3.4, 24), 2, 1.2); axG.rotateX(Math.PI / 2); collarG.push(axG);
  const spokes = new THREE.Group(); gate.add(spokes);
  for (const [geo, mat] of [[mergeGeometries(shaftG), C.spoke], [mergeGeometries(collarG), C.bronze], [mergeGrouped(bossG), [C.band, C.chakra, C.chakra]]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; spokes.add(m); }
  { const hubFace = new THREE.Mesh(new THREE.CircleGeometry(1.64, 48), C.lotus); hubFace.position.z = .86; spokes.add(hubFace); const hb = hubFace.clone(); hb.rotation.y = Math.PI; hb.position.z = -.86; spokes.add(hb); }
  // portal light disc
  const portalU = { uTime: { value: 0 }, uI: { value: 1 }, uCol: { value: col('#ff8a2a') } };
  const portalMat = new THREE.ShaderMaterial({
    uniforms: portalU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uTime,uI; uniform vec3 uCol; varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float a=atan(p.y,p.x);
        float core=exp(-r*r*2.2); float rings=0.5+0.5*sin(r*38.0 - uTime*2.4); rings=pow(rings,6.0)*smoothstep(1.0,0.2,r);
        float rays=pow(0.5+0.5*sin(a*24.0+uTime*.3),8.0)*0.25*smoothstep(1.0,0.3,r);
        float edge=smoothstep(1.0,0.9,r);
        float v=(core*1.1 + rings*.6 + rays + 0.18)*edge;
        gl_FragColor=vec4(uCol*v*uI*0.95, 1.0); }`,
  });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(6.9, 96), portalMat); gate.add(portal);
  const gateLight = new THREE.PointLight('#ff8a2a', 0, 60, 1.6); gateLight.position.set(GEO.GATE.x - 3, HP + 4.5, 0); scene.add(gateLight);
  // flanking towers
  const twrG = [];
  const tier = (w, h, y) => { const bays = Math.max(1, Math.round(w / 1.8)), st = Math.max(1, Math.round(h / (w / bays * 1.4))); const g = boxUV(new THREE.BoxGeometry(w, h, w), w * 2 / bays, h / st, { off: [.5, .5] }); g.translate(0, y + h / 2, 0); twrG.push(g); return y + h; };
  let y = 0; y = tier(3.8, 5.5, y); y = tier(3.2, 4.6, y); y = tier(2.6, 3.8, y); y = tier(2.0, 2.4, y);
  const cap = new THREE.ConeGeometry(1.5, 2.4, 4); cap.rotateY(Math.PI / 4); cap.translate(0, y + 1.2, 0); twrG.push(cap);
  const twrMerged = mergeGeometries(twrG);
  for (const sz of [-11, 11]) {
    const t = new THREE.Mesh(twrMerged, C.wall); t.position.set(GEO.GATE.x, groundY(GEO.GATE.x, sz) - .3, sz); t.castShadow = t.receiveShadow = true; scene.add(t);
    const med = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .35, 32), [C.band2, C.chakra, C.chakra]);
    med.rotation.z = Math.PI / 2; med.position.set(GEO.GATE.x - 1.95, t.position.y + 7.4, sz); scene.add(med);
    const med2 = med.clone(); med2.position.x = GEO.GATE.x + 1.95; med2.rotation.z = -Math.PI / 2; scene.add(med2);
  }
  // scaffolding (Return: rebuilding)
  const scafN = 140, scaf = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: .9 }), scafN);
  const scafList = [];
  const bar = (x0, y0, z0, x1, y1, z1, t = .11) => { const a = V3(x0, y0, z0), b = V3(x1, y1, z1), mid = a.clone().add(b).multiplyScalar(.5), d = b.clone().sub(a), L = d.length(); const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()); scafList.push({ mid, q, s: V3(t, L, t) }); };
  const gx = GEO.GATE.x, gy = HP;
  for (const sz of [-8.3, 8.3]) {
    for (const dx of [-1.7, 1.7]) for (const dz of [-1.2, 1.2]) bar(gx + dx, gy, sz + dz, gx + dx, gy + 18, sz + dz);
    for (let h = 2; h <= 18; h += 2) { bar(gx - 1.7, gy + h, sz - 1.2, gx + 1.7, gy + h, sz - 1.2); bar(gx - 1.7, gy + h, sz + 1.2, gx + 1.7, gy + h, sz + 1.2); bar(gx - 1.7, gy + h, sz - 1.2, gx - 1.7, gy + h, sz + 1.2); bar(gx + 1.7, gy + h, sz - 1.2, gx + 1.7, gy + h, sz + 1.2); }
    for (let h = 0; h < 18; h += 4) { bar(gx - 1.7, gy + h, sz - 1.2, gx - 1.7, gy + h + 4, sz + 1.2, .08); bar(gx + 1.7, gy + h + 4, sz - 1.2, gx + 1.7, gy + h, sz + 1.2, .08); }
  }
  bar(gx - 1.7, gy + 18.2, -8.3, gx - 1.7, gy + 18.2, 8.3, .16); bar(gx + 1.7, gy + 18.2, -8.3, gx + 1.7, gy + 18.2, 8.3, .16);
  for (let k = -6; k <= 6; k += 3) bar(gx - 1.7, gy + 18.2, k, gx + 1.7, gy + 18.2, k, .1);
  scaf.count = Math.min(scafN, scafList.length); scaf.castShadow = true; scene.add(scaf);
  out.gate = { panelIM, slotMat, NP, portalU, gateLight, scaf, scafList, group: gate, spokes, innerRing };

  /* ---------- steps + walls ---------- */
  const NS = 24, sd = (STAIR.x1 - STAIR.x0) / NS;
  const rampY = (x) => lerp(FORE_H, HP, clamp((x - STAIR.x0) / (STAIR.x1 - STAIR.x0), 0, 1));
  const stepG = [];
  for (let k = 0; k < NS; k++) {
    const xa = STAIR.x0 + k * sd, xb = xa + sd, top = rampY(xb) + .03, bot = rampY(xa) - 1.2;
    const g = boxUV(new THREE.BoxGeometry(sd, top - bot, STAIR.half * 2), 2.4, 2.4, { off: [k * .37, k * .21] }); g.translate((xa + xb) / 2, (top + bot) / 2, 0); stepG.push(g);
  }
  const stepMat = carvedMaterial(K.ashlar); out.stepMat = stepMat;
  const steps = new THREE.Mesh(mergeGeometries(stepG), stepMat); steps.receiveShadow = true; scene.add(steps);
  const L = Math.hypot(STAIR.x1 - STAIR.x0, HP - FORE_H), ang = Math.atan2(HP - FORE_H, STAIR.x1 - STAIR.x0);
  for (const sz of [-STAIR.half - .35, STAIR.half + .35]) {
    const w = new THREE.Mesh(boxUV(new THREE.BoxGeometry(L, 1.1, .7), 4.4, 1.1, { fitV: true }), [C.ashlar, C.ashlar, C.ashlar, C.ashlar, C.frieze, C.frieze]); w.position.set((STAIR.x0 + STAIR.x1) / 2, (FORE_H + HP) / 2 + .45, sz); w.rotation.z = ang; w.castShadow = w.receiveShadow = true; scene.add(w);
  }

  /* ---------- arches (Diamond Ring) ---------- */
  const arches = new THREE.Group(); arches.position.set(0, HP - 36, 0); arches.visible = false; scene.add(arches);
  // carved white marble with gold inlay (M.marble / M.marbleBlock keep their names: the look and the lights drive them)
  M.marble = carvedMaterial(K.marble, { emissive: new THREE.Color('#ffcf80'), emissiveIntensity: 0 });
  M.marbleBlock = carvedMaterial(K.marbleLotus, { emissive: new THREE.Color('#ffcf80'), emissiveIntensity: 0 });
  const archCore = annularBlock(28.7, 31.3, 0, Math.PI, -1.3, 1.3, 120, { tile: 10.4, capU: 10.4 });
  const archTrim = new THREE.TorusGeometry(31.9, .26, 6, 140, Math.PI);
  const blockG = new THREE.BoxGeometry(3.4, 2.1, 3.3);
  const blocks = new THREE.InstancedMesh(blockG, M.marbleBlock, 3 * 23);
  let bi = 0;
  for (let k = 0; k < 3; k++) {
    const ry = k * Math.PI / 3;
    const c = new THREE.Mesh(archCore, [M.marble, M.marble, M.marbleBlock]); c.rotation.y = ry; c.castShadow = true; arches.add(c);
    const tr = new THREE.Mesh(archTrim, M.gold); tr.rotation.y = ry; arches.add(tr);
    for (let j = 1; j <= 23; j++) {
      const th = j / 24 * Math.PI;
      _p.set(Math.cos(th) * 30, Math.sin(th) * 30, 0).applyAxisAngle(V3(0, 1, 0), ry);
      _q.setFromEuler(_e.set(0, ry, th)); setIM(blocks, bi++, _p, _q, _s);
    }
    for (const sgn of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 4.6), M.marbleBlock); pl.position.set(sgn * 30, 1.6, 0).applyAxisAngle(V3(0, 1, 0), ry); pl.rotation.y = ry; pl.castShadow = true; arches.add(pl); }
  }
  blocks.castShadow = true; arches.add(blocks);
  const crown = new THREE.Mesh(annularBlock(12.05, 14.15, 0, TAU, -1.05, 1.05, 110, { tile: 8.4, capU: 8.4 }), [M.marble, M.marble, M.marble]); crown.rotation.x = Math.PI / 2; crown.position.y = 27; arches.add(crown);
  const crownGold = new THREE.Mesh(new THREE.TorusGeometry(13.1, .32, 6, 110), M.gold); crownGold.rotation.x = Math.PI / 2; crownGold.position.y = 25.9; arches.add(crownGold);
  const rose = []; { const t = new THREE.TorusGeometry(5.2, .55, 10, 60); rose.push(t); for (let k = 0; k < 12; k++) { const g = new THREE.BoxGeometry(4.2, .4, .5); g.translate(2.9, 0, 0); g.rotateZ(k / 12 * TAU); rose.push(g); } const h = new THREE.CylinderGeometry(1.1, 1.1, .9, 24); h.rotateX(Math.PI / 2); rose.push(h); }
  const roseM = new THREE.Mesh(mergeGeometries(rose), M.gold); roseM.rotation.x = Math.PI / 2; roseM.position.y = 30.6; arches.add(roseM);
  out.arches = { group: arches };

  /* ---------- diyas: clay cups + flames ---------- */
  const diyaPts = [];
  for (let k = 0; k < NS; k += 1) { const x = STAIR.x0 + (k + .5) * sd; for (const sz of [-STAIR.half + .35, STAIR.half - .35]) diyaPts.push([x, rampY(x + sd / 2) + .05, sz]); }
  for (let i = 0; i < 32; i++) { const a = (i + .5) / 32 * TAU, q = a / (Math.PI / 2); if (Math.abs(q - Math.round(q)) * (Math.PI / 2) < .33) continue; diyaPts.push([Math.cos(a) * 13, HP + 1.38, -Math.sin(a) * 13]); }
  for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; const x = Math.cos(a) * 37.5, z = Math.sin(a) * 37.5; diyaPts.push([x, groundY(x, z) + .05, z]); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; diyaPts.push([Math.cos(a) * 3.3, HP + .52, Math.sin(a) * 3.3]); }
  for (let i = 0; i < 16; i++) { const z = -14 + i * 28 / 15; for (const x of [-106, -81]) diyaPts.push([x, FORE_H + .05, z]); }
  for (let i = 0; i < 10; i++) { const z = -4.5 + i; diyaPts.push([GEO.GATE.x + 1.6, HP + .05, z]); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; const x = GEO.SYNTH.x + Math.cos(a) * 3.2, z = GEO.SYNTH.z + Math.sin(a) * 3.2; diyaPts.push([x, groundY(x, z) + .05, z]); }
  const cupIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .07, .07, 10), M.clay, diyaPts.length);
  const fPos = new Float32Array(diyaPts.length * 3), fPh = new Float32Array(diyaPts.length);
  diyaPts.forEach(([x, y, z], i) => { _p.set(x, y, z); _q.identity(); _s.set(1, 1, 1); setIM(cupIM, i, _p, _q, _s); fPos.set([x, y + .14, z], i * 3); fPh[i] = Math.random() * 100; });
  scene.add(cupIM);
  const flameU = { uTime: { value: 0 }, uLit: { value: 1 }, uSize: { value: 600 }, uCol: { value: col('#ffae55') } };
  const flameG = new THREE.BufferGeometry(); flameG.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); flameG.setAttribute('aPh', new THREE.BufferAttribute(fPh, 1));
  const flames = new THREE.Points(flameG, new THREE.ShaderMaterial({
    uniforms: flameU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPh; uniform float uTime,uLit,uSize; varying float vF;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); float fl=0.75+0.25*sin(uTime*9.0+aPh)*sin(uTime*5.3+aPh*1.7);
        vF=fl*uLit; gl_PointSize=uSize*0.32*(0.8+0.2*fl)/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vF; void main(){ vec2 q=gl_PointCoord*2.0-1.0, p=q; p.y*=0.8; float d=length(p);
        float core=smoothstep(0.35,0.0,d); float halo=exp(-d*d*4.0)*0.5*(1.0-smoothstep(0.6,0.98,length(q))); float a=(core*2.4+halo)*vF; if(a<0.003) discard;
        gl_FragColor=vec4(uCol*(1.0+core*1.5)*a,1.0); }`,
  }));
  flames.frustumCulled = false; scene.add(flames);
  out.diyas = { flameU, flames, pts: diyaPts };
  out.floorMat = floor.material;

  /* ---------- ridge: stone circle, ruins, synth ---------- */
  const sg = new THREE.BoxGeometry(1, 1, 1, 1, 3, 1); { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i) + .5; p.setX(i, p.getX(i) * (1 - yy * .32)); p.setZ(i, p.getZ(i) * (1 - yy * .2)); } sg.translate(0, .5, 0); sg.computeVertexNormals(); }
  const stones = new THREE.InstancedMesh(sg, [C.granite, C.granite, C.granite, C.granite, C.star, C.granite], 13);
  const R0 = GEO.R, stoneTops = [];
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * TAU + hash(i) * .12, r = 13.6, x = R0.x + Math.cos(a) * r, z = R0.z + Math.sin(a) * r;
    _p.set(x, groundY(x, z) - .4, z); _q.setFromAxisAngle(V3(0, 1, 0), Math.atan2(R0.x - x, R0.z - z) + (hash(i + 3) - .5) * .2);
    _s.set(1.6 + hash(i + 7) * .8, 3.2 + hash(i + 11) * 2.8, .9); setIM(stones, i, _p, _q, _s);
    stoneTops.push([x, _p.y + _s.y * .98, z]);
  }
  stones.castShadow = stones.receiveShadow = true; scene.add(stones);
  const ruinIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), C.granite, 26); const rr = rng(77);
  for (let i = 0; i < 26; i++) {
    const a = rr() * TAU, d = 5 + rr() * 8, x = GEO.R.x - 3 + Math.cos(a) * d, z = GEO.R.z - 2 + Math.sin(a) * d * .8;
    _p.set(x, groundY(x, z) + .2, z); _q.setFromEuler(_e.set((rr() - .5) * .3, rr() * TAU, (rr() - .5) * .3)); _s.set(.8 + rr() * 1.6, .5 + rr() * 1.4, .8 + rr() * 1.2); setIM(ruinIM, i, _p, _q, _s);
  }
  _s.set(1, 1, 1); ruinIM.castShadow = ruinIM.receiveShadow = true; scene.add(ruinIM);
  const ruinWall = new THREE.Mesh(boxUV(new THREE.BoxGeometry(1.1, 3.2, 5.5), 3.2, 3.2), [C.granite, C.star, C.granite, C.granite, C.granite, C.granite]);
  ruinWall.position.set(GEO.R.x - 9, RH + 1.3, GEO.R.z + 1); ruinWall.rotation.y = .5; ruinWall.castShadow = true; scene.add(ruinWall);
  // broken upright wheel
  const bw = new THREE.Group(); bw.position.set(GEO.R.x + 7.5, RH + 3.3, GEO.R.z - 3); bw.rotation.y = -.9; bw.scale.setScalar(.38); scene.add(bw);
  const bwPanels = new THREE.InstancedMesh(panelG, C.granite, NP - 7); let bj = 0;
  for (let k = 0; k < NP; k++) { if ([3, 4, 9, 15, 16, 17, 21].includes(k)) continue; const th = k / NP * TAU; _m4.makeRotationZ(th).multiply(new THREE.Matrix4().makeTranslation(rMid, 0, 0)); bwPanels.setMatrixAt(bj++, _m4); }
  bw.add(bwPanels); { const sp = spokes.clone(); sp.traverse(o => { if (o.isMesh) o.material = C.granite; }); bw.add(sp); }
  // synth table + knobs
  const sy = groundY(GEO.SYNTH.x, GEO.SYNTH.z);
  const stbl = new THREE.Mesh(new THREE.BoxGeometry(1.9, .72, .85), M.wood); stbl.position.set(GEO.SYNTH.x, sy + .36, GEO.SYNTH.z); stbl.castShadow = true; scene.add(stbl);
  const synthBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, .1, .55), new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: .5 })); synthBox.position.set(GEO.SYNTH.x, sy + .77, GEO.SYNTH.z); scene.add(synthBox);
  const synthKnobMat = new THREE.MeshBasicMaterial({ color: '#ffb070' });
  const sk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .025, .04, 8), synthKnobMat, 24);
  for (let i = 0; i < 24; i++) { _p.set(GEO.SYNTH.x - .62 + (i % 12) * .112, sy + .84, GEO.SYNTH.z - .12 + Math.floor(i / 12) * .2); _q.identity(); setIM(sk, i, _p, _q, _s); }
  scene.add(sk);
  out.ridge = { synthKnobMat, stoneTops };

  /* ---------- celestial ring ---------- */
  const cel = new THREE.Group(); scene.add(cel);
  // carved granite: a flat-faced ring with a frieze of star-lotus medallions and seated figures, bosses and bracket blocks
  const celMat = carvedMaterial(K.eclipse, { fog: false, transparent: true, opacity: 1 });
  const celBlockMat = carvedMaterial(K.granite, { fog: false, transparent: true, opacity: 1 });
  const celStar = carvedMaterial(K.star, { fog: false, transparent: true, opacity: 1 });
  const celRing = new THREE.Mesh(annularBlock(97, 113, 0, TAU, -8, 8, 240, { tile: 16, capU: 64 }), [celMat, celBlockMat, celBlockMat]); cel.add(celRing);
  const celLip = new THREE.Mesh(torusFriezeUV(new THREE.TorusGeometry(95.5, 2.6, 10, 220), 60), celBlockMat); cel.add(celLip);
  const cb = new THREE.InstancedMesh(boxUV(new THREE.BoxGeometry(15, 9, 11), 11, 9), [celBlockMat, celBlockMat, celBlockMat, celBlockMat, celStar, celBlockMat], 40);
  const ros = new THREE.InstancedMesh(new THREE.CylinderGeometry(5.2, 5.2, 2, 32), [celBlockMat, celStar, celBlockMat], 20);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; _p.set(Math.cos(a) * 110, Math.sin(a) * 110, 0); _q.setFromAxisAngle(V3(0, 0, 1), a); setIM(cb, i, _p, _q, _s); }
  for (let i = 0; i < 20; i++) { const a = (i + .5) / 20 * TAU; _p.set(Math.cos(a) * 105, Math.sin(a) * 105, 9); _q.setFromAxisAngle(V3(1, 0, 0), Math.PI / 2); setIM(ros, i, _p, _q, _s); }
  cel.add(cb, ros);
  const voidU = { uA: { value: 0 } };
  const voidM = new THREE.Mesh(new THREE.CircleGeometry(96, 96), new THREE.ShaderMaterial({ uniforms: voidU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float r=length(vUv*2.0-1.0); gl_FragColor=vec4(vec3(0.004,0.006,0.012), uA*(0.92+0.08*r)); }' }));
  voidM.position.z = -2; voidM.renderOrder = -1; cel.add(voidM);
  const corU = { uI: { value: 0 }, uCol: { value: col('#a8d0ff') }, uTime: { value: 0 } };
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(380, 380), new THREE.ShaderMaterial({ uniforms: corU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform float uI,uTime; uniform vec3 uCol; varying vec2 vUv;
      float n(float a){return 0.5+0.5*sin(a*13.0+uTime*.2)*sin(a*29.0-uTime*.13);}
      void main(){ vec2 p=(vUv*2.0-1.0)*190.0; float r=length(p); float a=atan(p.y,p.x);
        float g=exp(-pow((r-114.0)/6.0,2.0))*1.4 + exp(-pow((r-116.0)/26.0,2.0))*(0.35+0.35*n(a)) + exp(-pow((r-92.0)/5.0,2.0))*0.5;
        gl_FragColor=vec4(uCol*g*uI,1.0);} ` }));
  corona.position.z = -14; cel.add(corona);
  out.celestial = { group: cel, celMat, celBlockMat, ros, voidU, corU, angR: 0 };
  return out;
}
