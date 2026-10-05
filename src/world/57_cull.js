/* =========================================================================
   CULL — per-instance culling and distance LOD for the scanned meshes.
   The scans are instanced (one draw per asset), but three.js can only cull an
   instanced mesh as a whole, so every boulder, cliff and temple piece on the
   map was drawn, and drawn again into the shadow map, whether or not anyone
   could see it: about 6 million triangles a frame. Each frame this keeps only
   the instances that are in the camera's view or inside the shadow box, and
   gives the ones that are far away a simplified copy of the mesh (same vertex
   buffers, shorter index list, so no extra memory and no texture change).
   Shadow casters get a second, shadow-only set of those meshes on their own
   layer: the shadow map can only show so much detail, so each piece's shadow
   copy is chosen by the shadow map's resolution, not by the camera's distance.
   ========================================================================= */
// shDens: square shadow-map texels each triangle of a shadow caster may cover
// errPx / errTexels: how far, in screen pixels (colour pass) or shadow-map texels (shadow pass), a simplified mesh may sit from the real surface.
// The shadow map is soft-filtered and biased by ~1.6 texels, so 3 texels of silhouette error shows nowhere; 6 was also clean in test shots
const CULL = { items: [], on: true, layer: 1, hooked: false, dens: 2.4, shDens: 30, errPx: 1.5, errTexels: 3, minPx: 5, pad: 1.06, tris: 0, shadowTris: 0, seen: 0, drawn: 0, dirty: true };
const _cf = new THREE.Frustum(), _cpv = new THREE.Matrix4();
const SIMP = { ms: null, tried: false, cache: new WeakMap(), ms_: 0, levels: 0 };

// meshoptimizer's simplifier is loaded on demand; without it the scans are still culled, just not simplified
async function simplifierReady() {
  if (SIMP.tried) return SIMP.ms;
  SIMP.tried = true;
  try {
    const m = await import('meshoptimizer/simplifier');
    await m.MeshoptSimplifier.ready;
    if (m.MeshoptSimplifier.supported) SIMP.ms = m.MeshoptSimplifier;
  } catch (e) { try { diagNote('scan', 'simplifier unavailable: ' + (e.message || e)); } catch (x) { } }
  return SIMP.ms;
}
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
// a copy of geometry g with about `ratio` of its triangles; it shares g's vertex attributes (and so their GPU buffers).
// userData.err on the copy is the most the surface moved, in the mesh's own units
function simplifyGeometry(g, ratio, err = .12) {
  const ms = SIMP.ms; if (!ms || !g.index) return null;
  const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, n = pa.count;
  const P = new Float32Array(n * 3), A = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    P[i * 3] = pa.getX(i); P[i * 3 + 1] = pa.getY(i); P[i * 3 + 2] = pa.getZ(i);
    if (na) { A[i * 5] = na.getX(i); A[i * 5 + 1] = na.getY(i); A[i * 5 + 2] = na.getZ(i); }
    if (ua) { A[i * 5 + 3] = ua.getX(i); A[i * 5 + 4] = ua.getY(i); }
  }
  const idx = Uint32Array.from(g.index.array), target = Math.max(240, Math.floor(idx.length * ratio / 3) * 3);
  // the scans are open shells, so borders are free to move, and many are patchworks of small detached pieces: Prune lets those go and
  // Permissive lets edges collapse across texture seams. Normals and UVs are weighted so shading and texture stay put
  let out; try { out = ms.simplifyWithAttributes(idx, P, 3, A, 5, [.5, .5, .5, 1, 1], null, target, err, ['Prune', 'Permissive']); } catch (e) { try { out = ms.simplify(idx, P, 3, target, err, ['Prune']); } catch (e2) { return null; } }
  const ni = out[0]; if (!ni.length || ni.length > idx.length * .8) return null;
  const lg = new THREE.BufferGeometry();
  for (const k in g.attributes) lg.setAttribute(k, g.attributes[k]);
  lg.setIndex(new THREE.BufferAttribute(n < 65535 ? Uint16Array.from(ni) : ni, 1));
  lg.boundingSphere = g.boundingSphere ? g.boundingSphere.clone() : null; lg.boundingBox = g.boundingBox ? g.boundingBox.clone() : null;
  lg.userData.err = out[1] * ms.getScale(P, 3);          // the error comes back as a fraction of the mesh's size
  return lg;
}
// a geometry's simplified levels, each cut from the full mesh (so error never stacks), made once. Down to ~3% of the triangles where the
// surface allows it; a level is kept only if it is clearly cheaper than the one before. Alpha-cut meshes (leaf cards) keep one level
const LOD_FRACS = [.3, .09, .03];
function geometryLods(g, material) {
  if (SIMP.cache.has(g)) return SIMP.cache.get(g);
  const out = [], cutout = material && (material.alphaTest > 0 || material.transparent), t0 = performance.now();
  if (SIMP.ms && !cutout && triCount(g) > 600) {
    let prev = triCount(g);
    for (const f of LOD_FRACS) { const lg = simplifyGeometry(g, f); if (!lg) break; const t = triCount(lg); if (t > prev * .75) continue; out.push(lg); prev = t; }
  }
  SIMP.ms_ += performance.now() - t0; SIMP.levels += out.length;
  SIMP.cache.set(g, out); return out;
}

// take over an InstancedMesh that was filled with every instance: from now on it holds only what is currently needed
function cullAdopt(im, { lod = true } = {}) {
  const N = im.count, g = im.geometry; if (!N) return null;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const bs = g.boundingSphere, m = im.instanceMatrix.array, all = Float32Array.from(m.subarray(0, N * 16));
  const colors = im.instanceColor ? Float32Array.from(im.instanceColor.array.subarray(0, N * 3)) : null;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), rr = new Float32Array(N), sm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 16, sx = Math.hypot(all[o], all[o + 1], all[o + 2]), sy = Math.hypot(all[o + 4], all[o + 5], all[o + 6]), sz = Math.hypot(all[o + 8], all[o + 9], all[o + 10]);
    px[i] = all[o] * bs.center.x + all[o + 4] * bs.center.y + all[o + 8] * bs.center.z + all[o + 12];
    py[i] = all[o + 1] * bs.center.x + all[o + 5] * bs.center.y + all[o + 9] * bs.center.z + all[o + 13];
    pz[i] = all[o + 2] * bs.center.x + all[o + 6] * bs.center.y + all[o + 10] * bs.center.z + all[o + 14];
    sm[i] = Math.max(sx, sy, sz); rr[i] = bs.radius * sm[i] * CULL.pad + .4;
  }
  const levels = [im], tris = [triCount(g)], errs = [0];
  if (lod) for (const lg of geometryLods(g, im.material)) {
    const lm = new THREE.InstancedMesh(lg, im.material, N);
    lm.castShadow = im.castShadow; lm.receiveShadow = im.receiveShadow; lm.frustumCulled = false; lm.visible = false;
    if (colors) lm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    lm.name = (im.name || 'scan') + '-lod' + levels.length; lm.userData.sys = im.userData.sys;
    if (im.parent) im.parent.add(lm);
    levels.push(lm); tris.push(triCount(lg)); errs.push(lg.userData.err || 0);
  }
  // casters: the colour meshes stop casting, and a shadow-only copy of each level (same geometry and material, own layer, own
  // instance list) does it instead. The camera sees that layer only while the shadow map is being drawn (cullHooks)
  const cast = im.castShadow, shLevels = [];
  if (cast) levels.forEach((L, l) => {
    L.castShadow = false;
    const sl = new THREE.InstancedMesh(L.geometry, im.material, N);
    sl.castShadow = true; sl.receiveShadow = false; sl.frustumCulled = false; sl.visible = false; sl.layers.set(CULL.layer);
    sl.name = (im.name || 'scan') + '-sh' + l; sl.userData.sys = im.userData.sys;
    sl.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (im.parent) im.parent.add(sl);
    shLevels.push(sl);
  });
  for (const L of levels) { L.frustumCulled = false; L.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (L.instanceColor) L.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  const it = { N, all, colors, px, py, pz, rr, sm, levels, tris, errs, counts: new Int32Array(levels.length), cast, shLevels, shCounts: new Int32Array(levels.length) };
  CULL.items.push(it); CULL.dirty = true; return it;
}
function cullWrite(it, lvl, k, i) {
  const L = it.levels[lvl], a = L.instanceMatrix.array, o = i * 16, d = k * 16;
  for (let j = 0; j < 16; j++) a[d + j] = it.all[o + j];
  if (it.colors) { const c = L.instanceColor.array; c[k * 3] = it.colors[i * 3]; c[k * 3 + 1] = it.colors[i * 3 + 1]; c[k * 3 + 2] = it.colors[i * 3 + 2]; }
}
function cullWriteSh(it, lvl, k, i) {
  const a = it.shLevels[lvl].instanceMatrix.array, o = i * 16, d = k * 16;
  for (let j = 0; j < 16; j++) a[d + j] = it.all[o + j];
}
function cullPublish(it) {
  for (let l = 0; l < it.levels.length; l++) {
    const L = it.levels[l], c = it.counts[l];
    L.count = c; L.visible = c > 0;
    if (c > 0) {
      const A = L.instanceMatrix; A.clearUpdateRanges(); A.addUpdateRange(0, c * 16); A.needsUpdate = true;
      if (L.instanceColor) { const C = L.instanceColor; C.clearUpdateRanges(); C.addUpdateRange(0, c * 3); C.needsUpdate = true; }
    }
  }
  for (let l = 0; l < it.shLevels.length; l++) {
    const L = it.shLevels[l], c = it.shCounts[l];
    L.count = c; L.visible = c > 0;
    if (c > 0) { const A = L.instanceMatrix; A.clearUpdateRanges(); A.addUpdateRange(0, c * 16); A.needsUpdate = true; }
  }
}
// the shadow-only layer is switched on for the camera only for the shadow pass: three builds the colour pass's list of objects first
// (the layer is off, so the shadow copies are left out), then draws the shadow map (updateMatrices is the last call before it:
// the layer goes on), and calls scene.onAfterRender when the frame is done (the layer goes off again)
function cullHooks(cam, key) {
  if (CULL.hooked || !key.parent) return;
  CULL.hooked = true;
  const sh = key.shadow, upd = sh.updateMatrices.bind(sh);
  sh.updateMatrices = (...a) => { upd(...a); cam.layers.enable(CULL.layer); };
  key.parent.onAfterRender = () => { cam.layers.disable(CULL.layer); };
}
// the coarsest level that has at least `need` triangles and moves the surface by at most the limit (ek scales the error to it)
function pickLevel(lt, errs, nl, s, need, ek) { let l = nl - 1; while (l > 0 && (lt[l] < need || errs[l] * s * ek > 1)) l--; return l; }
// once per frame, after the shadow box has been fitted and before the render. pxH: height of the picture being drawn, in pixels.
// A piece is drawn at the coarsest level that still gives each triangle at least CULL.dens square pixels on screen, so a boulder
// that fills 60 pixels gets a few thousand triangles however many its scan holds; pieces under minPx square pixels are skipped.
function cullFrame(cam, key, pxH = 1080) {
  if (!CULL.items.length) return;
  cullHooks(cam, key);
  if (!CULL.on) {
    if (!CULL.dirty) return; CULL.dirty = false;
    for (const it of CULL.items) {
      it.counts.fill(0); it.shCounts.fill(0);
      for (let i = 0; i < it.N; i++) { cullWrite(it, 0, i, i); if (it.cast) cullWriteSh(it, 0, i, i); }
      it.counts[0] = it.N; if (it.cast) it.shCounts[0] = it.N; cullPublish(it);
    }
    return;
  }
  CULL.dirty = true;
  cam.updateMatrixWorld();
  _cpv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _cf.setFromProjectionMatrix(_cpv);
  const pl = _cf.planes, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
  const shOn = key.castShadow, tg = key.target.position, half = key.shadow.camera.right;
  const kPx = pxH * .5 / Math.tan(cam.fov * Math.PI / 360), needK = Math.PI * kPx * kPx / CULL.dens, minA = CULL.minPx;
  // the shadow copy of a piece needs no more triangles than the shadow map can show: one per shDens texels of its footprint,
  // and may move the surface by at most errTexels texels
  const texel = shOn ? 2 * half / key.shadow.mapSize.x : 1, needShK = Math.PI / (texel * texel * CULL.shDens), ekSh = 1 / (texel * CULL.errTexels);
  const sxx = _sx.x, sxy = _sx.y, sxz = _sx.z, syx = _sy.x, syy = _sy.y, syz = _sy.z;
  let tris = 0, shTris = 0, seen = 0, drawn = 0;
  for (const it of CULL.items) {
    const { px, py, pz, rr, sm, errs, counts, shCounts, tris: lt } = it, nl = it.levels.length, doSh = shOn && it.cast; counts.fill(0); shCounts.fill(0);
    for (let i = 0; i < it.N; i++) {
      const x = px[i], y = py[i], z = pz[i], r = rr[i];
      const dx0 = x - cx, dy0 = y - cy, dz0 = z - cz, d2 = dx0 * dx0 + dy0 * dy0 + dz0 * dz0, rk = r * kPx;
      let inView = rk * rk >= minA * d2 / Math.PI * 1;                       // big enough to show at all
      if (inView) for (let p = 0; p < 6; p++) { const n = pl[p].normal; if (n.x * x + n.y * y + n.z * z + pl[p].constant < -r) { inView = false; break; } }
      let inShadow = false;
      if (doSh) { const dx = x - tg.x, dy = y - tg.y, dz = z - tg.z; inShadow = Math.abs(dx * sxx + dy * sxy + dz * sxz) < half + r && Math.abs(dx * syx + dy * syy + dz * syz) < half + r; }
      seen++;
      if (!inView && !inShadow) continue;
      drawn++;
      if (inView) {   // the colour pass: triangles by screen size, and no level may move the surface by more than errPx pixels
        const l = pickLevel(lt, errs, nl, sm[i], needK * r * r / Math.max(d2, 1), kPx / (Math.max(Math.sqrt(d2) - r, .5) * CULL.errPx));
        cullWrite(it, l, counts[l]++, i); tris += lt[l];
      }
      if (inShadow) { // the shadow pass: by what the shadow map can resolve, whatever the camera sees
        const l = pickLevel(lt, errs, nl, sm[i], needShK * r * r, ekSh);
        cullWriteSh(it, l, shCounts[l]++, i); shTris += lt[l];
      }
    }
    cullPublish(it);
  }
  CULL.tris = tris; CULL.shadowTris = shTris; CULL.seen = seen; CULL.drawn = drawn;
}
