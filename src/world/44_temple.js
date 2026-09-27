/* =========================================================================
   SUN TEMPLE — a Kalinga-style deul on the eastern hill: a chariot platform
   ringed with stone wheels, a stepped pidha porch facing the ridge and a
   curvilinear rekha tower with its amalaka and kalasha. At sunrise it stands
   in silhouette against the light, seen from the stone circle
   ========================================================================= */
const TEMPLE = { x: 205, z: -70 };
function buildTemple(scene, Q, ST) {
  const g = new THREE.Group();
  const toRidge = V3(GEO.R.x - TEMPLE.x, 0, GEO.R.z - TEMPLE.z).normalize();
  g.rotation.y = Math.atan2(toRidge.z, -toRidge.x);          // local −x (the porch) faces the ridge
  // stand on the lowest ground under the platform; the plinth runs down into the slope
  let base = 1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) base = Math.min(base, groundY(TEMPLE.x + i * 22, TEMPLE.z + j * 13));
  g.position.set(TEMPLE.x, base, TEMPLE.z); scene.add(g);
  // carved laterite: every course shows a slice of the sculpted wall (niches, dancers, pilasters), in world units
  const stone = carvedMaterial(ST.K.laterite);
  const geos = []; let nb = 0;
  const box = (w, h, d, x, y, z) => { nb++; geos.push(boxUV(new THREE.BoxGeometry(w, h, d), 7, 4.9, { off: [nb * .137, y / 4.9] }).translate(x, y + h / 2, z)); };
  // chariot platform (jagati) with a moulded base and cornice
  const PL = 44, PW = 26, PH = 3.2;
  box(PL + 1.2, 4.6, PW + 1.2, 2, -4, 0); box(PL, PH, PW, 2, 0, 0); box(PL + .7, .45, PW + .7, 2, PH - .3, 0);
  // front steps down toward the ridge
  for (let k = 0; k < 6; k++) box(1.1, PH - k * .53, 9, -20 - .5 - k * 1.1, 0, 0);
  // porch (jagamohana): walls, then three pidha tiers of shrinking slabs, a bell and the amalaka
  const pc = -9; let y = PH;
  box(14, 8.5, 14, pc, y, 0); y += 8.5;
  for (let t = 0; t < 3; t++) {
    for (let k = 0; k < 4; k++) { const w = 15.4 - (t * 4 + k) * .92; box(w, .72, w, pc, y, 0); y += .72; }
    if (t < 2) { const w = 15.4 - (t * 4 + 4) * .92 - 1.1; box(w, 1.05, w, pc, y, 0); y += 1.05; }
  }
  const porchTop = y;
  // main tower (rekha deul): square sanctum then a curvilinear spire of ribbed courses
  const tc = 9; y = PH; const B0 = 14;
  box(B0, 11, B0, tc, y, 0); y += 11;
  const NC = 22, SH = 29;
  for (let k = 0; k < NC; k++) {
    const f = k / NC, w = B0 * (1 - .5 * Math.pow(f, 1.55)), h = SH / NC, band = k % 5 === 4;
    box(w * (band ? 1.03 : 1), h * .92, w * (band ? 1.03 : 1), tc, y, 0);
    if (!band) { const pw = w * .36, pd = .55 * (1 - f * .6); box(pw, h * .92, w + pd * 2, tc, y, 0); box(w + pd * 2, h * .92, pw, tc, y, 0); }   // the raised central ribs (pagas)
    y += h;
  }
  const spireTop = y;
  const merged = mergeGeometries(geos.map(q => q.index ? q.toNonIndexed() : q));
  const mesh = new THREE.Mesh(merged, stone); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
  // amalakas (ribbed discs) and kalashas (pots), lathed
  const ribbed = (r, h, n) => { const gg = new THREE.CylinderGeometry(r, r, h, n * 4, 1); const p = gg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - .12 * Math.pow(Math.abs(Math.cos(a * n / 2)), .6); const yy = p.getY(i) / h; const bulge = 1 - .35 * yy * yy * 4; p.setX(i, x * k * bulge); p.setZ(i, z * k * bulge); }
    gg.computeVertexNormals(); return gg; };
  const lathe = (pts, n = 20) => new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(r, yy)), n);
  const crown = (cx, y0, s) => {
    const parts = [
      lathe([[.01, 0], [1.9 * s, 0], [2.3 * s, .6 * s], [1.7 * s, 1.4 * s], [1.4 * s, 1.6 * s]]).translate(cx, y0, 0),          // neck
      ribbed(3.4 * s, 1.5 * s, 16).translate(cx, y0 + 2.3 * s, 0),                                                             // amalaka
      lathe([[.01, 0], [1.2 * s, 0], [1.25 * s, .5 * s], [.8 * s, 1.1 * s], [.35 * s, 1.35 * s], [.5 * s, 1.6 * s], [.08 * s, 2.4 * s], [.01, 3.4 * s]]).translate(cx, y0 + 3.05 * s, 0),   // kalasha + finial
    ];
    for (const p of parts) { const m = new THREE.Mesh(p, stone); m.castShadow = true; g.add(m); }
    return y0 + 6.5 * s;
  };
  const top = crown(tc, spireTop, 1.05); crown(pc, porchTop, .75);
  // a saffron pennant on the spire
  const flagG = new THREE.BufferGeometry(); flagG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -1.1, 0, -2.6, -.55, 0], 3)); flagG.computeVertexNormals();
  const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: '#e8792a', side: THREE.DoubleSide, roughness: .8 })); flag.position.set(tc, top + .6, 0); g.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.2, 5).translate(0, 1.1, 0), ST.M.pole); pole.position.set(tc, top - 1.5, 0); g.add(pole);
  // twelve wheels down each flank of the platform: the chariot of the sun
  const wheelG = new THREE.CylinderGeometry(1.35, 1.35, .32, 28); wheelG.rotateX(Math.PI / 2);
  const wheels = new THREE.InstancedMesh(wheelG, [ST.C.band2, ST.C.chakra, ST.C.chakra], 24);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < 24; k++) { const side = k < 12 ? 1 : -1, i = k % 12; m4.makeTranslation(2 - PL / 2 + 2.6 + i * (PL - 5.2) / 11, 1.55, side * (PW / 2 + .18)); wheels.setMatrixAt(k, m4); }
  wheels.castShadow = true; g.add(wheels);
  g.updateMatrixWorld(true);
  // anchors (world space) for the festival lights: along the platform's cornice
  const W_ = (x, y_, z) => V3(x, y_, z).applyMatrix4(g.matrixWorld).toArray();
  const lights = [];
  for (const sz of [-1, 1]) lights.push([W_(-20, PH + .2, sz * (PW / 2 + .2)), W_(24, PH + .2, sz * (PW / 2 + .2))]);
  lights.push([W_(-20, PH + .2, -PW / 2), W_(-20, PH + .2, PW / 2)]);
  return { group: g, lights, top: W_(tc, top, 0) };
}
