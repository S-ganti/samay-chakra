/* =========================================================================
   SCANS — photogrammetry from Poly Haven (CC0): granite boulders and cliffs,
   mossy rock beds, stumps and fallen trunks, jacaranda, searsia and island
   trees. They turn the hills into Deccan granite (tors like Savandurga on
   the skyline, outcrops on the slopes) and dress the paths each chapter's
   camera walks. Every asset is instanced; scattered pieces use a ~2.5k
   triangle LOD, the ones near the poster shots the full scan.
   Files: public/scans/*.glb (and lod/), optimised with glTF-Transform
   (simplify, WebP textures, meshopt). If they fail to load, the world
   simply stays as it was.
   ========================================================================= */
const SCAN = { base: 'scans/', ready: false, failed: false, tris: 0, groups: [], loaded: 0, total: 0 };
const SCAN_Q = {
  low: { tors: 14, sky: 6, cliffs: 26, floor: 60, hero: 0, circle: 6, jac: 0, trees: 0 },
  med: { tors: 22, sky: 10, cliffs: 46, floor: 150, hero: 24, circle: 10, jac: 4, trees: 8 },
  high: { tors: 30, sky: 14, cliffs: 64, floor: 240, hero: 60, circle: 14, jac: 8, trees: 18 },
};
// one asset: its meshes with the node transforms baked in, sitting on y = 0 and centred in x/z
function scanParts(gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const parts = [], box = new THREE.Box3();
  // meshopt/quantized scans store positions as normalised int16 with the scale in the node: expand to float before baking the transform
  const deq = (g) => { for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k]; if (!a || (a.array instanceof Float32Array && !a.normalized)) continue; const n = a.count, d = a.itemSize, f = new Float32Array(n * d); for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) f[i * d + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, d)); } return g; };
  root.traverse(o => { if (!o.isMesh) return; const g = deq(o.geometry.clone()); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); box.union(g.boundingBox); parts.push([g, o.material]); });
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  for (const [g] of parts) { g.translate(-cx, -box.min.y, -cz); g.computeBoundingSphere(); }
  return { parts, size: box.getSize(V3()) };
}
// jacaranda: the scan is in green leaf; Bengaluru knows it in its March bloom, so the leaves are repainted lilac
function jacarandaBloom(m) {
  if (!m.map || !(m.alphaTest > 0 || m.transparent)) return;
  chainHook(m, 'bloom', (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float lum = dot(diffuseColor.rgb, vec3(.3, .55, .15)); vec3 lilac = vec3(.74, .62, .82) * (.5 + 1.5 * lum);
        diffuseColor.rgb = mix(diffuseColor.rgb, lilac, .6); }`);
  });
}
function scanMaterial(m, id) {
  m.envMapIntensity = .8;
  if (m.alphaTest > 0 || m.transparent) { m.side = THREE.DoubleSide; m.transparent = false; m.alphaTest = Math.max(m.alphaTest, .45); }
  if (id === 'jacaranda_tree') jacarandaBloom(m);
  return m;
}
// place instances: pts = [x, y, z, scale, yaw, sy, tilt]
function scanInstances(scene, asset, id, pts, { cast = false, receive = true, tint } = {}) {
  if (!pts.length) return [];
  const out = [], q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (const [g, m] of asset.parts) {
    const im = new THREE.InstancedMesh(g, scanMaterial(m, id), pts.length);
    pts.forEach(([x, y, z, s, yaw, sy = s, tilt = 0], i) => {
      e.set(tilt * Math.cos(yaw * 3.1), yaw, tilt * Math.sin(yaw * 2.3)); q.setFromEuler(e);
      _p.set(x, y, z); _s.set(s, sy, s); setIM(im, i, _p, q, _s);
      if (tint) { c.set(tint[0]).lerp(col(tint[1]), hash(i * 7.3 + x)); im.setColorAt(i, c); }
    });
    _s.set(1, 1, 1);
    im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false;   // instances span the map; per-object culling would test one sphere
    im.computeBoundingSphere(); im.frustumCulled = true;
    im.userData.sys = 'scans'; scene.add(im); out.push(im); cullAdopt(im);
    SCAN.tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * pts.length;
  }
  SCAN.groups.push(...out);
  return out;
}
// where nothing may stand: the clearing, the ridge top, steps and gate, the city, the paths, the temple precinct, the open eastern view
function scanExcl(x, z, pad = 0) {
  const dC = Math.hypot(x, z), dR = Math.hypot(x - GEO.R.x, z - GEO.R.z);
  if (dC < 44 + pad || dR < 20 + pad) return true;
  if (x > GEO.R.x + 10 && dR < 110 && Math.abs(z - GEO.R.z) < 50) return true;
  if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 40 + pad) return true;
  if (x < -38 && x > -114 && Math.abs(z) < 16 + pad) return true;
  if (z > 80 && Math.abs(x - GEO.P.x) < 120 && z < 186) return true;
  if (Math.min(distToRoute(x, z, ROUTES.hill), distToRoute(x, z, ROUTES.ridge), distToRoute(x, z, ROUTES.road)) < 4.5 + pad) return true;
  return false;
}
const _nrm = V3();
// a point along a route with its unit direction (nx, nz)
function routeAt(R, u) {
  const d = clamp(u, 0, 1) * R.len; let i = 1; while (i < R.cum.length - 1 && R.cum[i] < d) i++;
  const f = (d - R.cum[i - 1]) / Math.max(1e-6, R.cum[i] - R.cum[i - 1]), dx = R.x[i] - R.x[i - 1], dz = R.z[i] - R.z[i - 1], L = Math.hypot(dx, dz) || 1;
  return { x: lerp(R.x[i - 1], R.x[i], f), z: lerp(R.z[i - 1], R.z[i], f), nx: dx / L, nz: dz / L };
}
function slopeAt(x, z) { const e = 1.5; _nrm.set(groundY(x - e, z) - groundY(x + e, z), 2 * e, groundY(x, z - e) - groundY(x, z + e)).normalize(); return _nrm; }

async function loadScans(scene, Q, renderer, FO, ST) {
  const N = SCAN_Q[PARAM.quality] || SCAN_Q.med;
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const want = { lod: ['namaqualand_boulder_02', 'namaqualand_boulder_03', 'namaqualand_boulder_06', 'namaqualand_boulders_01', 'namaqualand_boulder_05', 'namaqualand_cliff_01', 'namaqualand_cliff_02', 'mountainside', 'rock_face_01', 'rock_face_02', 'rock_moss_set_01', 'rock_moss_set_02', 'tree_stump_01', 'dead_tree_trunk_02'],
    full: N.hero ? ['namaqualand_boulder_03', 'namaqualand_boulder_06', 'namaqualand_cliff_01', 'rock_face_01', 'tree_stump_01', 'dead_tree_trunk_02', 'stone_fire_pit'] : [] };   // the moss beds (60k triangles each) stay at their LOD
  want.full.push('jacaranda_tree', 'island_tree_02'); if (N.trees) want.full.push('searsia_lucida');   // the two trees also become the forest's impostors
  SCAN.total = want.lod.length + want.full.length;
  const A = { lod: {}, full: {} };
  const get = async (kind, id) => { try { const a = scanParts(await L.loadAsync(SCAN.base + (kind === 'lod' ? 'lod/' : '') + id + '.glb')); await capParts(a.parts, texEdge('scan')); A[kind][id] = a; } catch (e) { diagNote && diagNote('scan', `${id} failed: ${e.message || e}`); } SCAN.loaded++; };
  await Promise.all([simplifierReady(), ...want.lod.map(id => get('lod', id)), ...want.full.map(id => get('full', id))]);
  if (!Object.keys(A.lod).length) { SCAN.failed = true; return SCAN; }
  const r = rng(4242), inLens = shotClearance();
  const GRANITE = ['#d8cabb', '#b9a898'], MOSSY = ['#ffffff', '#d8d0bc'];
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const add = (kind, id, pts, o) => { const a = A[kind][id] || A.lod[id]; if (a && pts.length) scanInstances(scene, a, id, pts, o); };

  // 1 — tors: granite domes with boulders perched on them, on the far hills and the skyline
  const domes = ['namaqualand_boulder_03', 'namaqualand_boulder_02', 'namaqualand_boulder_06'];
  const T = {}; domes.forEach(d => T[d] = []);
  const tor = (x, z, big) => {
    const y = groundY(x, z), s = big * (.8 + r() * .5), d = pick(domes);
    T[d].push([x, y - s * .35, z, s, r() * TAU, s * (.55 + r() * .3), .08]);
    const k = 1 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) { const a = r() * TAU, o = s * (.2 + r() * .5), ss = s * (.25 + r() * .3), dd = pick(domes); T[dd].push([x + Math.cos(a) * o, y + s * (.45 + r() * .35), z + Math.sin(a) * o, ss, r() * TAU, ss * (.8 + r() * .4), .25]); }
  };
  for (let i = 0, tries = 0; i < N.tors && tries < 600; tries++) {
    const a = r() * TAU, d = 128 + r() * 100, x = Math.cos(a) * d, z = Math.sin(a) * d * .95 + 10;
    if (scanExcl(x, z, 8) || Math.abs(x) > 232 || Math.abs(z) > 232) continue; tor(x, z, 7 + r() * 9); i++;
  }
  for (let i = 0; i < N.sky; i++) {    // silhouettes on the mountain ring: the monoliths the Deccan is known for
    const a = (i / N.sky) * TAU + r() * .4, d = 270 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.cos(a) > .62) continue;       // keep the eastern sunrise horizon clear
    const s = 22 + r() * 22, y = terrainRaw(x, z) + 8 + 60 * Math.pow(fbm(Math.cos(a) * 2.2 + 11, Math.sin(a) * 2.2 + d * .004, 5), 2.2) * .5;
    T[pick(domes)].push([x, y - s * .3, z, s, r() * TAU, s * (.7 + r() * .4), .05]);
  }
  for (const d of domes) add('lod', d, T[d], { tint: GRANITE });

  // 2 — outcrops on the slopes around the plateau and the ridge, faces turned downhill
  const cliffs = ['namaqualand_cliff_01', 'namaqualand_cliff_02', 'mountainside', 'rock_face_01', 'rock_face_02'], C = {}; cliffs.forEach(c => C[c] = []);
  for (let i = 0, tries = 0; i < N.cliffs && tries < 4000; tries++) {
    const aroundRidge = r() < .45, a = r() * TAU, d = aroundRidge ? 21 + r() * 45 : 46 + r() * 70;
    const x = (aroundRidge ? GEO.R.x : 0) + Math.cos(a) * d, z = (aroundRidge ? GEO.R.z : 0) + Math.sin(a) * d;
    if (scanExcl(x, z, 1)) continue;
    const n = slopeAt(x, z); if (n.y > .93) continue;
    const id = pick(cliffs), sz = A.lod[id] ? A.lod[id].size : V3(8, 5, 5), s = (4 + r() * 5) / Math.max(sz.x, sz.z);
    if (inLens(x, z, sz.x * s * .5, 0, sz.y * s, 0)) continue;
    C[id].push([x, groundY(x, z) - sz.y * s * .25, z, s, Math.atan2(n.x, n.z) + (r() - .5) * .6, s * (.9 + r() * .4), .1]); i++;
  }
  for (const c of cliffs) add('lod', c, C[c], { tint: GRANITE, cast: PARAM.quality !== 'low' });

  // 3 — the forest floor: moss beds, loose boulders, stumps and fallen trunks
  const floor = ['rock_moss_set_01', 'rock_moss_set_02', 'namaqualand_boulders_01', 'namaqualand_boulder_05', 'tree_stump_01', 'dead_tree_trunk_02'], F = {}; floor.forEach(f => F[f] = []);
  for (let i = 0, tries = 0; i < N.floor && tries < 5000; tries++) {
    const a = r() * TAU, d = 44 + Math.pow(r(), .7) * 150, x = Math.cos(a) * d, z = Math.sin(a) * d * .95 - 10;
    if (scanExcl(x, z)) continue;
    const id = pick(floor), s = id === 'namaqualand_boulders_01' ? 2.5 + r() * 3 : id === 'namaqualand_boulder_05' ? 1.5 + r() * 2 : .8 + r() * .6;
    if (inLens(x, z, 2 * s, 0, 1.5 * s, 0)) continue;
    F[id].push([x, groundY(x, z) - .1 * s, z, s, r() * TAU, s, .06]); i++;
  }
  for (const f of floor) add('lod', f, F[f], { tint: MOSSY });

  // 4 — hero pieces along the paths the poster shots look down: the steps (Enter), the hill road (Return), the ridge path
  if (N.hero) {
    const hero = ['rock_moss_set_01', 'rock_moss_set_02', 'namaqualand_boulder_03', 'namaqualand_boulder_06', 'tree_stump_01', 'dead_tree_trunk_02', 'namaqualand_cliff_01', 'rock_face_01'], H = {}; hero.forEach(h => H[h] = []);
    const routes = [ROUTES.hill, ROUTES.stairsUp, ROUTES.ridge];
    for (let i = 0, tries = 0; i < N.hero && tries < 3000; tries++) {
      const R0 = routes[Math.floor(r() * routes.length)], u = r(), p = routeAt(R0, u); if (!p) break;
      const side = r() < .5 ? -1 : 1, off = 5.5 + r() * 7, x = p.x + p.nz * off * side, z = p.z - p.nx * off * side;
      if (scanExcl(x, z, -1.5) && !(x < -38 && x > -114 && Math.abs(z) > 7)) continue;
      const id = pick(hero), sz = A.full[id] ? A.full[id].size : V3(3, 2, 3), s = id.startsWith('namaqualand_boulder') ? 1.2 + r() * 1.4 : id === 'namaqualand_cliff_01' || id === 'rock_face_01' ? (3 + r() * 3) / Math.max(sz.x, sz.z) : 1 + r() * .5;
      if (inLens(x, z, Math.max(sz.x, sz.z) * s * .5, 0, sz.y * s, 0)) continue;
      H[id].push([x, groundY(x, z) - .08 * sz.y * s, z, s, r() * TAU, s, .05]); i++;
    }
    for (const h of hero) add('full', h, H[h], { tint: MOSSY, cast: true });
  }

  // 5 — the stone circle on the ridge: granite boulders around the ring (Eclipse, Brahma Muhurta)
  const circ = { namaqualand_boulder_03: [], namaqualand_boulder_06: [] };
  for (let i = 0; i < N.circle; i++) {
    const a = i / N.circle * TAU + r() * .3, d = 23 + r() * 6, x = GEO.R.x + Math.cos(a) * d, z = GEO.R.z + Math.sin(a) * d;
    if (x > GEO.R.x + 14) continue;            // the eastern side stays open for the sunrise
    const s = 1.6 + r() * 1.6; circ[i % 2 ? 'namaqualand_boulder_06' : 'namaqualand_boulder_03'].push([x, groundY(x, z) - .3 * s, z, s, r() * TAU, s * (.8 + r() * .5), .1]);
  }
  for (const id in circ) add(N.hero ? 'full' : 'lod', id, circ[id], { tint: GRANITE, cast: true });

  // 6 — fire pits at the edge of the clearing (The Gathering)
  if (A.full.stone_fire_pit) { const fp = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .26, x = Math.cos(a) * 39.5, z = Math.sin(a) * 39.5; if (!inLens(x, z, 1, 0, .5, 0)) fp.push([x, groundY(x, z) - .05, z, 1.3, r() * TAU]); } add('full', 'stone_fire_pit', fp, { cast: false }); }

  // 7 — trees: jacarandas in lilac bloom at the forecourt and along the city road; searsia and island trees beside the paths
  const J = [];
  const jSpots = [[-104, -21], [-104, 22], [-66, -19], [-64, 20], [-14, 80], [22, 80], [44, 96], [-26, 96]];
  for (const [x, z] of jSpots.slice(0, N.jac)) J.push([x, groundY(x, z) - .3, z, .62 + r() * .12, r() * TAU]);
  add('full', 'jacaranda_tree', J, { cast: PARAM.quality === 'high' });
  const tS = [], tI = [];
  for (let i = 0, tries = 0; i < N.trees && tries < 2000; tries++) {
    const R0 = r() < .6 ? ROUTES.hill : ROUTES.ridge, p = routeAt(R0, r()); if (!p) break;
    const side = r() < .5 ? -1 : 1, off = 7 + r() * 8, x = p.x + p.nz * off * side, z = p.z - p.nx * off * side;
    if (scanExcl(x, z, -2)) continue;
    const s = 1.8 + r() * 1.2; if (inLens(x, z, 2.5 * s, .3 * s, 3.5 * s, .2 * s)) continue;
    (i % 2 ? tI : tS).push([x, groundY(x, z) - .1, z, s, r() * TAU]); i++;
  }
  if (N.trees) { add('full', 'searsia_lucida', tS, { cast: PARAM.quality === 'high' }); add('full', 'island_tree_02', tI, { cast: PARAM.quality === 'high' }); }

  try { if (ST) await loadHeritage(scene, ST); } catch (e) { diagNote && diagNote('scan', 'heritage failed: ' + (e.message || e)); }
  try { SCAN.imps = renderer ? impostorForest(scene, renderer, FO, A) : 0; } catch (e) { diagNote && diagNote('scan', 'impostors failed: ' + (e.message || e)); }
  for (const im of SCAN.groups) { const m = im.material; if (m.fog && !m.userData.hf) { m.userData.hf = 1; chainHook(m, 'hf', (sh) => Object.assign(sh.uniforms, HFOG)); } }
  scanRelease(A);
  SCAN.ready = true;
  diagNote && diagNote('scan', `${SCAN.groups.length} scan groups, ${(SCAN.tris / 1e6).toFixed(2)} M triangles, ${TEXCAP.n} textures shrunk (${TEXCAP.savedMB.toFixed(0)} MB saved), ${SIMP.levels} LOD levels in ${SIMP.ms_.toFixed(0)} ms`);
  return SCAN;
}
// assets that were only loaded to bake the impostors (or that nothing ended up standing on) give their GPU memory back
function scanRelease(A) {
  const usedM = new Set(SCAN.groups.map(g => g.material)), usedG = new Set(SCAN.groups.map(g => g.geometry)), seen = new Set(); let n = 0;
  for (const kind in A) for (const id in A[kind]) for (const [g, m] of A[kind][id].parts) {
    if (!usedM.has(m)) { for (const k in m) { const v = m[k]; if (v && v.isTexture && !seen.has(v.source)) { seen.add(v.source); v.dispose(); n++; } } m.dispose(); }
    if (!usedG.has(g)) g.dispose();
  }
  SCAN.released = n;
}

/* ---------- impostors: the scanned trees baked from 12 directions into an atlas, so the whole forest can wear them ---------- */
const IMP = { list: [], light: new THREE.Color(1, 1, 1), F: 12 };
function bakeImpostor(renderer, asset, { W = 192, H = 256, lilac = false } = {}) {
  const F = IMP.F, rtg = new THREE.WebGLRenderTarget(W * F, H, { samples: 0 });
  rtg.texture.generateMipmaps = true; rtg.texture.minFilter = THREE.LinearMipmapLinearFilter; rtg.texture.magFilter = THREE.LinearFilter;
  const sc = new THREE.Scene(), grp = new THREE.Group(); sc.add(grp); const sz0 = asset.size;
  for (const [g, m] of asset.parts) {
    // unlit albedo with a soft sky-to-ground gradient and a leaf-facing term (the world's own chunks are patched for its lights, so the bake stays independent of them)
    const leaf = m.alphaTest > 0 || m.transparent;
    const lm = new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), alphaTest: leaf ? .5 : 0, side: THREE.DoubleSide });
    lm.onBeforeCompile = (sh) => {
      sh.uniforms.uHt = { value: sz0.y };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHy; varying vec3 vNw;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHy = position.y; vNw = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHt; varying float vHy; varying vec3 vNw;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float hy = clamp(vHy / uHt, 0., 1.); float nl = abs(dot(normalize(vNw), normalize(vec3(.4, 1., .35)))); diffuseColor.rgb *= (0.55 + 0.6 * hy) * (0.7 + 0.45 * nl) * 1.15;' + (lilac && leaf ? ' float lum = dot(diffuseColor.rgb, vec3(.3,.55,.15)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.74,.62,.82) * (.5 + 1.5 * lum), .6);' : '') + ' }');
    };
    grp.add(new THREE.Mesh(g, lm));
  }
  sc.add(new THREE.HemisphereLight('#f4f0e6', '#4a4030', 1.25)); const d = new THREE.DirectionalLight('#fff4e0', 1.5); d.position.set(.4, 1, .35); sc.add(d);
  const sz = asset.size, half = Math.max(sz.x, sz.z) * .54, hgt = sz.y * 1.03;
  const cam = new THREE.OrthographicCamera(-half, half, hgt, 0, -200, 200);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevAuto = renderer.autoClear, prevSh = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false; renderer.setRenderTarget(rtg); renderer.setClearColor('#4a5a3a', 0); renderer.clear(); renderer.autoClear = false;
  for (let f = 0; f < F; f++) {
    const a = f / F * TAU; cam.position.set(Math.sin(a) * 50, 0, Math.cos(a) * 50); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    rtg.viewport.set(f * W, 0, W, H); rtg.scissor.set(f * W, 0, W, H); rtg.scissorTest = true;
    renderer.setRenderTarget(rtg);            // the target's viewport is applied when it is bound
    renderer.render(sc, cam);
  }
  rtg.scissorTest = false; rtg.viewport.set(0, 0, W * F, H);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.autoClear = prevAuto; renderer.shadowMap.enabled = prevSh;
  sc.traverse(o => { if (o.material) o.material.dispose(); });
  IMP.rts = IMP.rts || []; IMP.rts.push(rtg);
  return { tex: rtg.texture, rt: rtg, w: half * 2, h: hgt };
}
function impostorMaterial(imp) {
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', alphaTest: .5, side: THREE.DoubleSide });
  const U = { tImp: { value: imp.tex }, uImp: { value: new THREE.Vector3(imp.w, imp.h, IMP.F) }, uLight: { value: IMP.light } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uImp; varying vec2 vUvI;')
      .replace('#include <project_vertex>', `
        vec4 ctrW = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec3 toC = cameraPosition - ctrW.xyz; vec3 tc = normalize(vec3(toC.x + 1e-4, 0., toC.z));
        vec3 rgt = vec3(tc.z, 0., -tc.x);
        vec3 wp = ctrW.xyz + rgt * (position.x * uImp.x * sx) + vec3(0., position.y * uImp.y * sy, 0.);
        float ang = atan(tc.x, tc.z) + atan(instanceMatrix[0].z, instanceMatrix[0].x);
        float fr = mod(floor(ang / 6.2831853 * uImp.z + .5) + uImp.z * 4., uImp.z);
        vUvI = vec2((uv.x + fr) / uImp.z, uv.y);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tImp; uniform vec3 uLight; varying vec2 vUvI;')
      .replace('#include <map_fragment>', 'vec4 imT = texture2D(tImp, vUvI); diffuseColor *= vec4(imT.rgb * uLight, imT.a);');
  };
  m.customProgramCacheKey = () => 'imp';
  if (m.fog) { m.userData.hf = 1; chainHook(m, 'hf', (sh) => Object.assign(sh.uniforms, HFOG)); }
  return m;
}
function impostorForest(scene, renderer, FO, A) {
  if (!FO || !FO.pts) return 0;
  const kinds = [];
  if (A.full.island_tree_02) kinds.push({ imp: bakeImpostor(renderer, A.full.island_tree_02), size: A.full.island_tree_02.size, w: .5 });
  if (A.full.jacaranda_tree) { kinds.push({ imp: bakeImpostor(renderer, A.full.jacaranda_tree), size: A.full.jacaranda_tree.size, w: .38 }); kinds.push({ imp: bakeImpostor(renderer, A.full.jacaranda_tree, { lilac: true }), size: A.full.jacaranda_tree.size, w: .12 }); }
  if (!kinds.length) return 0;
  const plane = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  const all = [...FO.pts.broad.map(p => [...p, 9.9]), ...FO.pts.conifer.map(p => [...p, 9.6])];
  const r = rng(77), buckets = kinds.map(() => []);
  for (const p of all) { let u = r(), k = 0; for (; k < kinds.length - 1; k++) { u -= kinds[k].w; if (u < 0) break; } buckets[k].push(p); }
  const c = new THREE.Color(); let n = 0;
  kinds.forEach((K, k) => {
    const pts = buckets[k]; if (!pts.length) return;
    const im = new THREE.InstancedMesh(plane, impostorMaterial(K.imp), pts.length);
    pts.forEach(([x, z, s, sy, top], i) => {
      const H_ = top * sy * (.9 + r() * .3), k2 = H_ / K.imp.h;
      _p.set(x, groundY(x, z) - .25, z); _q.setFromAxisAngle(V3(0, 1, 0), r() * TAU); _s.set(k2, k2, k2); setIM(im, i, _p, _q, _s);
      c.setRGB(.86 + r() * .2, .86 + r() * .2, .8 + r() * .18); im.setColorAt(i, c);
    });
    _s.set(1, 1, 1); im.frustumCulled = false; scene.add(im); IMP.list.push(im); n += pts.length;
    SCAN.tris += 2 * pts.length;
  });
  for (const im of [...(FO.broadIM || []), ...(FO.coniferIM || [])]) im.visible = false;   // the painted trees step aside
  return n;
}
// per frame: impostors carry baked shading, so they only take the scene's light level and colour
function scanFrame(SK, look) {
  if (!IMP.list.length) return;
  const up = Math.max(S.keyDir.y, .1);
  IMP.light.copy(SK.hemi.color).multiplyScalar(SK.hemi.intensity * .55 + look.envI * .9).add(_imc.copy(SK.key.color).multiplyScalar(SK.key.intensity * .22 * up));
  const m = Math.max(IMP.light.r, IMP.light.g, IMP.light.b); if (m > 1.35) IMP.light.multiplyScalar(1.35 / m);
}
const _imc = new THREE.Color();

/* ---------- heritage scans: real Karnataka temple stone as the signature structures ----------
   Photogrammetry by Akhanda Setu (gputhige on Sketchfab), CC BY 4.0: a 12th-century Bhumija shikhara, a 9th-century
   pillar and temple outer wall, a 6th-century carved platform. The scans carry their own photographed colour; they are
   given a lit stone material (the originals are unlit) so they take the world's day and night. */
const HERITAGE = { base: 'scans/heritage/', ready: false, parts: {} };
function heritageMaterial(m) {
  const s = new THREE.MeshStandardMaterial({ map: m.map || null, color: '#ffffff', roughness: .88, metalness: 0, normalMap: m.normalMap || null });
  if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
  if (s.fog) { s.userData.hf = 1; chainHook(s, 'hf', (sh) => Object.assign(sh.uniforms, HFOG)); }
  return s;
}
function heritagePlace(scene, asset, list, { cast = true } = {}) {
  // list: [x, y, z, height (m), yaw]; the scan is scaled uniformly so its height matches
  const out = [];
  for (const [g, m] of asset.parts) {
    const im = new THREE.InstancedMesh(g, heritageMaterial(m), list.length);
    list.forEach(([x, y, z, h, yaw], i) => { const k = h / asset.size.y; _p.set(x, y, z); _q.setFromAxisAngle(V3(0, 1, 0), yaw); _s.set(k, k, k); setIM(im, i, _p, _q, _s); });
    _s.set(1, 1, 1); im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; im.userData.sys = 'scans'; scene.add(im); out.push(im); cullAdopt(im);
    SCAN.tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * list.length;
  }
  return out;
}
async function loadHeritage(scene, ST) {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), A = {};
  await Promise.all(['shikhara', 'pillar', 'wall', 'platform'].map(async (id) => { try { const a = scanParts(await L.loadAsync(HERITAGE.base + id + '.glb')); await capParts(a.parts, texEdge('heritage')); A[id] = a; } catch (e) { diagNote && diagNote('scan', `heritage ${id} failed: ${e.message || e}`); } }));
  HERITAGE.parts = A;
  // Enter / Return: the portal wheel flanked by two real shikharas in place of the painted towers
  if (A.shikhara && ST.gateTowers) {
    for (const t of ST.gateTowers) t.visible = false;
    const gx = GEO.GATE.x, list = [-1, 1].map(sd => { const z = sd * 14.2; return [gx, groundY(gx, z) - .45, z, 16.5, sd > 0 ? Math.PI : 0]; });
    heritagePlace(scene, A.shikhara, list);
  }
  // Eclipse / Brahma Muhurta: the stone circle becomes a ring of carved temple pillars, each as tall as the stone it replaces
  if (A.pillar && ST.ridge && ST.ridge.stones) {
    const st = ST.ridge.stones, m4 = new THREE.Matrix4(), pp = V3(), qq = new THREE.Quaternion(), ss = V3(), list = [];
    for (let i = 0; i < st.count; i++) { st.getMatrixAt(i, m4); m4.decompose(pp, qq, ss); const yaw = new THREE.Euler().setFromQuaternion(qq, 'YXZ').y; list.push([pp.x, pp.y + .1, pp.z, ss.y * 1.05, yaw]); }
    st.visible = false; heritagePlace(scene, A.pillar, list);
  }
  // the ruins on the ridge: sections of a real temple wall standing in the mist, west of the circle (the east stays open for sunrise)
  if (A.wall && ST.ridge && ST.ridge.ruinIM) {
    ST.ridge.ruinIM.visible = false;
    const R = GEO.R, list = [[-26, -8, 6.2, 1.2], [-20, 14, 5.4, 2.1], [-8, 22, 4.6, 2.8], [-24, -22, 5, .4]].map(([dx, dz, h, yaw]) => [R.x + dx, groundY(R.x + dx, R.z + dz) - .4, R.z + dz, h, yaw]);
    heritagePlace(scene, A.wall, list);
  }
  // The Gathering: the ring stage's outer face is lined with the carved platform frieze, chord by chord
  if (A.platform && ST.stageGroup) {
    const h = 1.42, len = A.platform.size.x * h / A.platform.size.y, list = [];
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * TAU + (k % 2 === 0 ? .27 : .1), a1 = (k + 1) / 8 * TAU - ((k + 1) % 2 === 0 ? .27 : .1);
      const n = Math.max(1, Math.round((a1 - a0) * 13.9 / len)), da = (a1 - a0) / n;
      for (let j = 0; j < n; j++) { const a = a0 + (j + .5) * da, r = 13.9 + A.platform.size.z * h / A.platform.size.y * .35; list.push([Math.cos(a) * r, HP - .06, -Math.sin(a) * r, h, a + Math.PI / 2]); }
    }
    heritagePlace(scene, A.platform, list);
  }
  HERITAGE.ready = true;
}
