/* =========================================================================
   TREES — painterly canopies: a dark inner core plus camera-facing leaf
   cards with spherical normals (soft, fluffy shading), light glowing through
   the leaves when the sun is behind them, wind, and a dissolve for any
   branch that comes too close to the lens
   ========================================================================= */
// one leaf: an ovate blade with a drip tip, a darker midrib and a lighter upper face (values only; the colour comes from the tree)
function drawLeaf(g, L, w, v) {
  g.beginPath(); g.moveTo(-L, 0);
  g.bezierCurveTo(-L * .55, -w * 1.15, L * .45, -w * 1.05, L, 0);
  g.bezierCurveTo(L * .45, w * 1.05, -L * .55, w * 1.15, -L, 0);
  const gr = g.createLinearGradient(0, -w, 0, w); gr.addColorStop(0, `rgb(${v + 22},${v + 22},${v + 22})`); gr.addColorStop(1, `rgb(${v - 18},${v - 18},${v - 18})`);
  g.fillStyle = gr; g.fill();
  g.strokeStyle = `rgba(0,0,0,.28)`; g.lineWidth = Math.max(.6, w * .14); g.beginPath(); g.moveTo(-L * .95, 0); g.lineTo(L * .9, 0); g.stroke();
}
function leafTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rng(311);
  g.clearRect(0, 0, S, S);
  // a spray of leaves, dense in the middle and ragged at the rim, each at its own angle and in its own light
  for (let k = 0; k < 175; k++) {
    const a = r() * TAU, d = Math.pow(r(), .62) * S * .42, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * .92;
    const L = 10 + r() * 8, w = 4 + r() * 3, v = Math.round(150 + r() * 80);
    g.save(); g.translate(x, y); g.rotate(a + (r() - .5) * 1.6); drawLeaf(g, L, w, v); g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 2; t.needsUpdate = true;
  return t;
}
// uCard: share of the camera-facing cards kept, and how wide the silhouette band is (set per render quality)
// the inside of a crown: leaves packed edge to edge, light and dark, no gaps (tiles)
function leafMassTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rng(97);
  g.fillStyle = 'rgb(120,120,120)'; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgb(70,70,70)'; g.fillRect(0, 0, S, S);       // dark gaps between the leaves: the depth inside a crown
  for (let k = 0; k < 950; k++) {
    const x = r() * S, y = r() * S, L = 7 + r() * 7, w = 3 + r() * 2.8, v = Math.round(60 + r() * 175), a = r() * TAU;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.save(); g.translate(x + ox, y + oy); g.rotate(a); drawLeaf(g, L, w, v); g.restore(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2; t.needsUpdate = true;
  return t;
}
// bark: vertical fissures and plates (values around 0.8, so the trunk keeps its tint)
function barkTexture() {
  const W_ = 128, H_ = 256, cv = document.createElement('canvas'); cv.width = W_; cv.height = H_;
  const g = cv.getContext('2d'), r = rng(523);
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(0, 0, W_, H_);
  for (let k = 0; k < 46; k++) {                       // fissures: dark, wandering, wrapping round the trunk
    let x = r() * W_; const w = 1 + r() * 3.2, v = Math.round(70 + r() * 60);
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, -4);
    for (let y = 0; y <= H_ + 8; y += 8) { x += (r() - .5) * 4.5; g.lineTo(x, y); }
    g.stroke(); g.save(); g.translate(W_, 0); g.stroke(); g.translate(-2 * W_, 0); g.stroke(); g.restore();
  }
  for (let k = 0; k < 700; k++) { const v = Math.round(160 + r() * 90); g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(r() * W_, r() * H_, 1 + r() * 3, 2 + r() * 7); }   // plates and lichen flecks
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
const TREE_U = { uTime: { value: 0 }, uFade: { value: new THREE.Vector2(2.5, 7.5) }, uTransl: { value: .55 }, uCard: { value: new THREE.Vector3(.3, .45, .8) }, uCardFar: { value: new THREE.Vector2(70, 110) } };
// kept share of camera-facing cards, silhouette band, card size, and the distance over which cards melt into the core
const TREE_CARDS = { low: [.1, .3, .65, 40, 70], med: [.25, .42, .78, 65, 105], high: [.5, .55, 1, 120, 180] };
function treeQuality(q) { const v = TREE_CARDS[q]; TREE_U.uCard.value.set(v[0], v[1], v[2]); TREE_U.uCardFar.value.set(v[3], v[4]); }
const TREE_GLSL_V = `
uniform float uTime; uniform vec2 uFade, uCardFar; uniform vec3 uCard; varying float vCamD;
#ifdef TREE_BLOOM
attribute vec4 aBloom; varying vec4 vBloom; varying float vBH;
#endif`;
const TREE_WIND = `
#ifdef USE_INSTANCING
 float wph = instanceMatrix[3].x * .13 + instanceMatrix[3].z * .07;
#else
 float wph = 0.0;
#endif
 float wsw = max(position.y - 2.5, 0.0) * .03;
 transformed.x += sin(uTime * .9 + wph) * wsw; transformed.z += cos(uTime * .7 + wph * 1.3) * wsw * .7;`;
const TREE_GLSL_F = `
uniform vec2 uFade; uniform float uTransl; varying float vCamD;
#ifdef TREE_BLOOM
varying vec4 vBloom; varying float vBH;
#endif
float treeBayer(vec2 p){ ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y * 4;
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.); return (m[i] + .5) / 16.; }`;
// near the lens a tree dissolves in an ordered dither instead of filling the frame
const TREE_FADE = `
 if (vCamD < uFade.y && smoothstep(uFade.x, uFade.y, vCamD) < treeBayer(gl_FragCoord.xy)) discard;`;
// sunlight coming through the leaves toward the camera
const TREE_TRANSL = `
#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
 { float tb = pow(saturate(dot(-geometryViewDir, directionalLights[0].direction)), 3.0);
   reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * tb * uTransl; }
#endif`;
function treeHook(sh, o) {
  sh.uniforms.uTime = TREE_U.uTime; sh.uniforms.uFade = TREE_U.uFade; sh.uniforms.uTransl = TREE_U.uTransl; sh.uniforms.uCard = TREE_U.uCard; sh.uniforms.uCardFar = TREE_U.uCardFar;
  let v = sh.vertexShader.replace('#include <common>', '#include <common>\n' + TREE_GLSL_V + (o.cards ? '\nattribute vec3 aCorner; attribute vec3 aSN;' : ''));
  if (o.cards) v = v.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aSN;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif');
  if (o.wind) v = v.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + TREE_WIND);
  if (o.cards) v = v.replace('#include <project_vertex>', `
    vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition; float cS = length(instanceMatrix[0].xyz);
#else
    float cS = 1.0;
#endif
    mvPosition = modelViewMatrix * mvPosition;
    float cRu = sin(uTime * 2.3 + position.x * 3.1 + position.z * 1.7) * .05;
    // fill budget: cards squarely in front of the core add little (the core is there) and cards behind it are hidden,
    // so keep the rim that makes the fluffy silhouette plus a third of the rest for texture
    vec3 cVN = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * aSN);
    float cKeep = fract(sin(dot(position.xz, vec2(12.99, 78.23))) * 43758.5) < uCard.x ? 1.0 : 1.0 - smoothstep(uCard.y, uCard.y + .25, abs(cVN.z));
    if (cVN.z < -.45) cKeep = 0.0;
    float cFar = smoothstep(uCardFar.x, uCardFar.y, -mvPosition.z);    // far trees keep only a sparse rim of cards
    if (fract(sin(dot(position.zx, vec2(39.3, 11.7))) * 24634.6) < cFar * .7) cKeep = 0.0;
    mvPosition.xy += (aCorner.xy + vec2(cRu, cRu * .6)) * aCorner.z * cS * cKeep * uCard.z;
    gl_Position = projectionMatrix * mvPosition;`);
  v = v.replace('#include <fog_vertex>', '#include <fog_vertex>\n vCamD = length(mvPosition.xyz);' + (o.bloom ? '\n vBloom = aBloom; vBH = fract(sin(dot(position.xz + position.y, vec2(17.13, 61.7))) * 9137.5);' : ''));
  if (o.bloom) v = '#define TREE_BLOOM\n' + v;
  sh.vertexShader = v;
  if (o.depth) { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCamD;'); return; }
  let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + TREE_GLSL_F)
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + TREE_FADE);
  if (o.transl) f = f.replace('#include <lights_fragment_end>', TREE_TRANSL);
  if (o.bloom) {
    // in bloom, a share of the leaf cards become flower clusters (the crown keeps green between them); the core only takes a tint
    f = '#define TREE_BLOOM\n' + f.replace('#include <color_fragment>', `#include <color_fragment>
      { float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
        float on = ${o.cards ? 'step(vBH, vBloom.a * .7)' : 'vBloom.a * .4'};
        diffuseColor.rgb = mix(diffuseColor.rgb, vBloom.rgb * (.45 + 1.6 * lum), on); }`);
  }
  sh.fragmentShader = f;
}
function treeMaterials() {
  const leaf = leafTexture();
  const mk = (M, params, o, key) => { const m = new M(params); m.onBeforeCompile = (sh) => treeHook(sh, o); m.customProgramCacheKey = () => key; return m; };
  const barkMap = barkTexture(); barkMap.repeat.set(2, 3);
  const bark = mk(THREE.MeshStandardMaterial, { vertexColors: true, roughness: .95, map: barkMap }, { wind: true }, 'tree-bark');
  const mass = leafMassTexture(); mass.repeat.set(3, 2);
  const core = mk(THREE.MeshLambertMaterial, { vertexColors: true, map: mass }, { wind: true, transl: true, bloom: true }, 'tree-core');
  const cards = mk(THREE.MeshLambertMaterial, { vertexColors: true, map: leaf, alphaTest: .5, side: THREE.DoubleSide }, { wind: true, transl: true, cards: true, bloom: true }, 'tree-cards');
  const cone = mk(THREE.MeshStandardMaterial, { vertexColors: true, roughness: .95, flatShading: true }, { wind: true, transl: true }, 'tree-cone');
  const cardsDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leaf, alphaTest: .5, side: THREE.DoubleSide });
  cardsDepth.onBeforeCompile = (sh) => treeHook(sh, { wind: true, cards: true, depth: true }); cardsDepth.customProgramCacheKey = () => 'tree-cards-depth';
  return { leaf, bark, core, cards, cone, cardsDepth };
}

/* ---------- geometry kits (tree-local metres, ground at y = 0) ---------- */
function paint(g, c, jit = 0, r, keepUV = false) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = col(c);
  for (let i = 0; i < n; i++) { const k = jit ? 1 + (r() - .5) * jit : 1; a[i * 3] = cc.r * k; a[i * 3 + 1] = cc.g * k; a[i * 3 + 2] = cc.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv && !keepUV) g.deleteAttribute('uv'); return g;
}
const bk = (g, c) => paint(g, c, 0, null, true);     // bark: keeps its uvs for the bark texture
const branch = (x0, y0, z0, x1, y1, z1, r0, r1) => {
  const a = V3(x0, y0, z0), b = V3(x1, y1, z1), L = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, L, 5, 1, true).translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  return g.applyQuaternion(q).translate(x0, y0, z0);
};
// blobs: [cx, cy, cz, rx, ry, rz, cardsScale]
function canopy(blobs, green, r, cardN, cardSize) {
  const P = [], C = [], N = [], K = [], U = [], I = [], cores = [];
  const base = col(green), c = new THREE.Color(), top = col('#d6cf8e'), shade = col('#241f16');
  for (const [cx, cy, cz, rx, ry, rz] of blobs) {
    // opaque inner core (catches the eye between the cards and keeps far trees solid)
    // lumpy, a little smaller than the crown and only a shade darker, so it reads as depth between the leaves
    const cg = new THREE.IcosahedronGeometry(1, 0), ph0 = r() * 10;
    { const p = cg.attributes.position, nn = cg.attributes.normal;     // smooth (spherical) normals on a lumpy 20-face core
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = .88 + .24 * vnoise(x * 1.7 + ph0, z * 1.7 + y * 1.3 + ph0); p.setXYZ(i, x * k, y * k, z * k); nn.setXYZ(i, x, y, z); } }
    cg.scale(rx * .76, ry * .76, rz * .76).translate(cx, cy, cz);
    { const p = cg.attributes.position, a = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const ny = (p.getY(i) - cy) / (ry * .76); c.copy(base).lerp(shade, .22 - ny * .15).multiplyScalar(1.35); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      cg.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    cores.push(cg);
    // leaf cards over the surface, a few inside
    const n = Math.max(4, Math.round(cardN * (rx * rz + rx * ry + ry * rz) / 3 / 5.5));
    for (let k = 0; k < n; k++) {
      const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u);
      let dx = s * Math.cos(ph), dy = u * .9 + .1, dz = s * Math.sin(ph); const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      const depth = k % 7 === 0 ? .45 + r() * .3 : .78 + r() * .22;
      const px = cx + dx * rx * depth, py = cy + dy * ry * depth, pz = cz + dz * rz * depth;
      // ellipsoid normal, nudged up so crowns read lighter than bellies
      let nx = dx / rx, ny = dy / ry + .25 / Math.max(ry, .5), nz = dz / rz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const sz = cardSize * Math.cbrt(rx * ry * rz) / 2.3 * (.8 + r() * .4), rot = r() * TAU, cr = Math.cos(rot), sr = Math.sin(rot);
      c.copy(base).lerp(top, clamp(dy * .5 + .15, 0, .45) * (.6 + r() * .4)).lerp(shade, clamp(-dy * .45 + .1, 0, .5) + (1 - depth) * .6).multiplyScalar(.9 + r() * .2);
      const b = P.length / 3;
      for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        P.push(px, py, pz); N.push(nx, ny, nz); C.push(c.r, c.g, c.b);
        K.push(qx * cr - qy * sr, qx * sr + qy * cr, sz); U.push((qx + 1) / 2, (qy + 1) / 2);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const cards = new THREE.BufferGeometry();
  cards.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cards.setAttribute('aSN', new THREE.Float32BufferAttribute(N, 3));
  cards.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); cards.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  cards.setAttribute('aCorner', new THREE.Float32BufferAttribute(K, 3)); cards.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); cards.setIndex(I);
  // bounds big enough for the billboard corners
  cards.computeBoundingSphere(); cards.boundingSphere.radius += cardSize * 1.5;
  return { core: mergeGeometries(cores), cards };
}
// a conifer tier that isn't a perfect cone: ragged rim, drooping tips, a little lean
function tier(rad, h, y, r, c) {
  const g = new THREE.ConeGeometry(rad, h, 10, 1).translate(0, y, 0), p = g.attributes.position, ph = r() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z);
    if (rr < 1e-4) continue;
    const a = Math.atan2(z, x), k = 1 + .1 * Math.sin(a * 3 + ph) + .07 * Math.sin(a * 7 + ph * 2.3) + .05 * Math.sin(a * 5 + yy * 1.7);   // periodic: no crack at the seam
    p.setXYZ(i, x * k, yy - .28 * (rr / rad) * (rr / rad) * h * .35, z * k);
  }
  g.computeVertexNormals();
  return paint(g.toNonIndexed(), c, .18, r);
}
function treeKit() {
  const r = rng(4242), bark = '#4a3828';
  const K = {};
  // broadleaf (neem / mango): a trunk that forks into three limbs under a lumpy crown
  K.broad = {
    trunk: mergeGeometries([bk(new THREE.CylinderGeometry(.2, .42, 4.6, 8, 1, true).translate(0, 2.3, 0), bark), bk(branch(0, 4.2, 0, 1.5, 5.4, .5, .16, .07), bark), bk(branch(0, 4.3, 0, -1.3, 5.7, -.7, .15, .07), bark), bk(branch(0, 4.4, 0, .3, 7.4, -.3, .15, .06), bark)]),
    ...canopy([[0, 6.6, 0, 2.6, 2.3, 2.6], [1.7, 5.6, .6, 2.1, 1.8, 2.1], [-1.5, 5.9, -.8, 2.0, 1.8, 2.0], [.3, 8.2, -.4, 1.7, 1.5, 1.7]], '#56643a', r, 10, 1.75),
  };
  // rain tree: a wide umbrella over the city streets
  K.rain = {
    trunk: mergeGeometries([bk(new THREE.CylinderGeometry(.35, .62, 5, 9, 1, true).translate(0, 2.5, 0), '#5a4636'), bk(branch(0, 4.4, 0, 3.4, 6.6, 1, .24, .1), '#5a4636'), bk(branch(0, 4.4, 0, -3.2, 6.8, -.8, .24, .1), '#5a4636'), bk(branch(0, 4.6, 0, .4, 6.9, -3.2, .22, .1), '#5a4636')]),
    ...canopy([[0, 7, 0, 6.2, 2.1, 6.2], [2.4, 8.4, 1, 3.4, 1.6, 3.4], [-2.6, 7.9, -1.4, 3.2, 1.4, 3.0]], '#5f6c3c', r, 7, 2.4),
  };
  K.bush = { trunk: null, ...canopy([[0, .62, 0, 1.3, .9, 1.3]], '#4a5530', r, 8, 1.1) };
  // conifers: ragged, drooping tiers, darker at the skirt than the crown
  K.conifer = {
    trunk: bk(new THREE.CylinderGeometry(.18, .3, 3, 6).translate(0, 1.5, 0), '#3e2e20'),
    cones: mergeGeometries([tier(2.5, 3.2, 3.4, r, '#26342a'), tier(2.1, 3.0, 5.1, r, '#2c3a2e'), tier(1.6, 2.8, 6.8, r, '#334232'), tier(1.05, 2.4, 8.5, r, '#3b4b37')]),
  };
  return K;
}
