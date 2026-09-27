/* =========================================================================
   CITY — the great wheel plaza, roundabout, concrete blocks, autos, chai
   ========================================================================= */
function facadeMaterial(base) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: .92 });
  const U = { uNight: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vec4 wpp = vec4(transformed,1.0);\n #ifdef USE_INSTANCING\n wpp = instanceMatrix*wpp;\n #endif\n wpp = modelMatrix*wpp; vWP = wpp.xyz; vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform float uNight;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float side = step(abs(vWN.y), 0.5);
        float u = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
        vec2 cell = vec2(floor(u/2.9), floor((vWP.y-0.4)/3.2));
        vec2 f = vec2(fract(u/2.9), fract((vWP.y-0.4)/3.2));
        float win = side * step(0.22,f.x)*step(f.x,0.78)*step(0.28,f.y)*step(f.y,0.78) * step(1.0, vWP.y);
        float shutter = hh(cell + floor(vWP.xz*0.01));
        vec3 wcol = mix(vec3(0.10,0.11,0.12), vec3(0.32,0.46,0.42), step(0.72, shutter));
        diffuseColor.rgb = mix(diffuseColor.rgb, wcol, win*0.92);
        float band = side * step(0.9, fract((vWP.y-0.4)/3.2)) ;
        diffuseColor.rgb *= 1.0 - band*0.25;
        float stain = hh(floor(vWP.xz*0.3)+floor(vWP.y*0.5));
        diffuseColor.rgb *= 0.9 + 0.1*stain;
        vLitWin = win * step(0.55, hh(cell*1.7 + 3.1)) * uNight;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0,0.72,0.38) * vLitWin * 1.6;')
      .replace('void main() {', 'float vLitWin = 0.0;\nvoid main() {');
  };
  return { m, U };
}

function buildCity(scene, Q) {
  const out = {};
  const P = GEO.P, Y = .02;
  const asphalt = new THREE.MeshStandardMaterial({ color: '#3d3c3a', roughness: .95 });
  const paving = new THREE.MeshStandardMaterial({ color: '#b5ad9f', roughness: .95 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#a8a296', roughness: .95 });
  const flat = (geo, mat, x, z, y = Y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };

  // great wheel (Zero Shadow) + walkway + ring road
  // the great wheel, carved (the sheet is cut by the carving workers)
  const wheelMat = CARVE.by.konark ? carvedMaterial(CARVE.by.konark) : new THREE.MeshStandardMaterial({ map: toTex(texKonark(Q.tex * 2)), roughness: .9 });
  out.wheelMat = wheelMat;
  flat(new THREE.CircleGeometry(17, 160), wheelMat, P.x, P.z, .08);
  const rim = new THREE.Mesh(torusFriezeUV(new THREE.TorusGeometry(17, .32, 10, 220), 10), CARVE.by.band ? carvedMaterial(CARVE.by.band) : new THREE.MeshStandardMaterial({ color: '#cdb892', roughness: .9 })); rim.rotation.x = Math.PI / 2; rim.position.set(P.x, .12, P.z); scene.add(rim);
  flat(new THREE.RingGeometry(17, 25, 160, 1), paving, P.x, P.z, .05);
  flat(new THREE.RingGeometry(25, 33, 160, 1), asphalt, P.x, P.z, .03);
  // roads
  const roadW = 11;
  flat(new THREE.PlaneGeometry(80, roadW), asphalt, -69, P.z, Y);
  flat(new THREE.PlaneGeometry(80, roadW), asphalt, 77, P.z, Y);
  flat(new THREE.PlaneGeometry(9, 12), asphalt, P.x, P.z - 38.5, Y);
  flat(new THREE.PlaneGeometry(9, 40), asphalt, P.x, P.z + 52, Y);
  // lane dashes
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, .16), new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: .9 }), 40);
  for (let i = 0; i < 40; i++) { const x = i < 20 ? -106 + i * 4 : 40 + (i - 20) * 3.6; _p.set(x, Y + .01, P.z); _q.setFromAxisAngle(V3(1, 0, 0), -Math.PI / 2); setIM(dash, i, _p, _q, _s); }
  scene.add(dash);
  // pavements / kerbs
  const kerbs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concrete, 8);
  [[-69, P.z - 7.5, 80, 4], [-69, P.z + 7.5, 80, 4], [77, P.z - 7.5, 80, 4], [77, P.z + 7.5, 80, 4]].forEach(([x, z, w, d], i) => { _p.set(x, .09, z); _q.identity(); _s.set(w, .18, d); setIM(kerbs, i, _p, _q, _s); });
  kerbs.count = 4; kerbs.receiveShadow = true; scene.add(kerbs); _s.set(1, 1, 1);

  // pillar with the ring on top (poster 6 roundabout)
  const pil = [];
  const cyl = (r0, r1, h, y) => { const g = new THREE.CylinderGeometry(r0, r1, h, 28); g.translate(0, y + h / 2, 0); pil.push(g); return y + h; };
  let yy = .1; yy = cyl(3.2, 3.4, .5, yy); yy = cyl(2.4, 2.6, .5, yy); yy = cyl(1.3, 1.5, .8, yy); yy = cyl(.55, .62, 6.8, yy); yy = cyl(.9, .7, .6, yy);
  const ringTop = new THREE.TorusGeometry(1.55, .2, 10, 48); ringTop.translate(0, yy + 1.6, 0); pil.push(ringTop);
  const pillar = new THREE.Mesh(mergeGeometries(pil), CARVE.by.spoke ? carvedMaterial(CARVE.by.spoke) : new THREE.MeshStandardMaterial({ color: '#b9ae98', roughness: .85 })); pillar.position.set(P.x, 0, P.z); pillar.castShadow = true; scene.add(pillar);
  const redDots = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .22, .06, 16), new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: .7 }), 8);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; _p.set(P.x + Math.cos(a) * 3.3, .38, P.z + Math.sin(a) * 3.3); _q.setFromAxisAngle(V3(Math.cos(a), 0, Math.sin(a)).cross(V3(0, 1, 0)).normalize(), -Math.PI / 2); setIM(redDots, i, _p, _q, _s); }
  scene.add(redDots);

  // buildings
  const fac = facadeMaterial('#c9c2b4'); out.facade = fac.U;
  const lots = []; const r = rng(2026);
  const addRow = (z0, z1, face) => {
    let x = -112;
    while (x < 112) {
      const w = 9 + r() * 6, d = z1 - z0 - r() * 5, floors = 2 + Math.floor(r() * 5);
      const cx = x + w / 2;
      const lz = face > 0 ? z1 - d / 2 : z0 + d / 2;
      // leave a lane where the hill path leaves the city
      const clear = distToRoute(cx, lz, ROUTES.hill) > Math.hypot(w, d) / 2 + 5;
      if (Math.abs(cx - P.x) > 42 + w / 2 && clear) lots.push({ x: cx, z: lz, w: w - 1.2, d, h: floors * 3.2 + .4, floors, face });
      x += w;
    }
  };
  addRow(92, 113, 1); addRow(131, 150, -1); addRow(151, 170, 1);
  // a few that frame the plaza corners
  lots.push({ x: -44, z: 96, w: 12, d: 10, h: 16.4, floors: 5, face: 1, sign: true }, { x: 50, z: 150, w: 13, d: 12, h: 13.2, floors: 4, face: -1 });
  const bIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), fac.m, lots.length);
  const balc = [], tanks = [];
  const tint = new THREE.Color();
  lots.forEach((L, i) => {
    _p.set(L.x, L.h / 2, L.z); _q.identity(); _s.set(L.w, L.h, L.d); setIM(bIM, i, _p, _q, _s);
    // mostly limewashed beige, one in three painted the way Bengaluru paints its houses
    const hue = r(); tint.setHSL(.08 + hue * .05, .12 + r() * .12, .62 + r() * .18);
    if (r() < .34) tint.set(['#9fb3a6', '#d4ada6', '#d9c38e', '#b5ba92', '#aab6c2', '#d2ae8c', '#b9adc0', '#e6dcc8'][Math.floor(r() * 8)]).multiplyScalar(.92 + r() * .12);   // faded limewash
    bIM.setColorAt(i, tint);
    for (let f = 1; f < L.floors; f++) balc.push([L.x, f * 3.2 + .4, L.z + L.face * (L.d / 2 + .55), L.w * .8]);
    if (r() < .8) tanks.push([L.x + (r() - .5) * L.w * .5, L.h, L.z + (r() - .5) * L.d * .5]);
  });
  _s.set(1, 1, 1); bIM.castShadow = bIM.receiveShadow = true; scene.add(bIM);
  const balIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concrete, balc.length * 2);
  balc.forEach(([x, y, z, w], i) => { _q.identity(); _p.set(x, y, z); _s.set(w, .16, 1.1); setIM(balIM, i * 2, _p, _q, _s); _p.set(x, y + .55, z + Math.sign(z - 122) * .5); _s.set(w, .9, .07); setIM(balIM, i * 2 + 1, _p, _q, _s); });
  _s.set(1, 1, 1); balIM.castShadow = true; scene.add(balIM);
  const tankIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.75, .75, 1.5, 14), new THREE.MeshStandardMaterial({ color: '#1d1d1c', roughness: .6 }), tanks.length);
  tanks.forEach(([x, y, z], i) => { _p.set(x, y + .75, z); _q.identity(); setIM(tankIM, i, _p, _q, _s); }); scene.add(tankIM);
  // shopfronts on the road: rolling shutters (some up, the shop dark inside) under painted signboards that glow at night
  // hand-painted boards, sun-faded
  const SIGNS = [['ಶ್ರೀ ಗಣೇಶ ಸ್ಟೋರ್ಸ್', '#cfae55', '#6e2a1e'], ['MEDICALS', '#4f6f58', '#ece2cf'], ['ಹೋಟೆಲ್', '#8e3a2c', '#efe2c6'], ['TAILORS', '#44607e', '#ece2cf'],
    ['ಬೇಕರಿ', '#ece2cf', '#8e3a2c'], ['MOBILES', '#c87a3e', '#2a2420'], ['ಕಾಫಿ ಬಾರ್', '#2a2420', '#cfae55'], ['CHAAT CORNER', '#cfae55', '#44607e']];
  const paintSign = ([text, bg, fg]) => {
    const [c, x] = cnv(512, 112); x.fillStyle = bg; x.fillRect(0, 0, 512, 112); speckle(x, 512, 112, 900, .1);
    x.strokeStyle = fg; x.globalAlpha = .5; x.lineWidth = 3; x.strokeRect(8, 8, 496, 96); x.globalAlpha = 1;
    const kn = /[\u0C80-\u0CFF]/.test(text); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = kn ? '600 58px "Noto Sans Kannada", sans-serif' : '700 62px "Big Shoulders Stencil Display", "Jost", sans-serif';
    let w = x.measureText(text).width; if (w > 470) { x.save(); x.translate(256, 60); x.scale(470 / w, 1); x.fillText(text, 0, 0); x.restore(); } else x.fillText(text, 256, 60);
    return c;
  };
  const signTexs = SIGNS.map(sg => toTex(paintSign(sg), { aniso: 4 }));
  const signMats = signTexs.map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffd9a8'), emissiveIntensity: 0, roughness: .8 }));
  const shops = [], signsAt = SIGNS.map(() => []);
  const SHUT = ['#4a6a8e', '#5a7f62', '#8e3a2c', '#7a766e', '#c49a44', '#6a8a90'];
  lots.forEach((L) => {
    const onRoad = (L.face > 0 && L.z < P.z) || (L.face < 0 && L.z > P.z);
    if (!onRoad) return;
    const front = L.z + L.face * (L.d / 2), n = Math.max(1, Math.round(L.w / 4.2)), ws = L.w / n;
    for (let k = 0; k < n; k++) {
      const x = L.x - L.w / 2 + ws * (k + .5), open = r() < .6;
      shops.push([x, front + L.face * .05, ws - .35, open ? '#17130f' : SHUT[Math.floor(r() * SHUT.length)], open ? 2.3 : 2.5]);
      if (r() < .85) signsAt[Math.floor(r() * SIGNS.length)].push([x, front + L.face * .09, ws - .25, L.face]);
    }
  });
  const shopIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .75, metalness: .2 }), Math.max(1, shops.length));
  shops.forEach(([x, z, w, c, h], i) => { _p.set(x, h / 2 + .05, z); _q.identity(); _s.set(w, h, .1); setIM(shopIM, i, _p, _q, _s); shopIM.setColorAt(i, tint.set(c)); });
  _s.set(1, 1, 1); shopIM.receiveShadow = true; scene.add(shopIM);
  signsAt.forEach((list, j) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), signMats[j], list.length);
    list.forEach(([x, z, w, face], i) => { _p.set(x, 3.05, z); _q.setFromAxisAngle(V3(0, 1, 0), face > 0 ? 0 : Math.PI); _s.set(w, Math.min(.9, w * .22), 1); setIM(im, i, _p, _q, _s); });
    _s.set(1, 1, 1); scene.add(im);
  });
  out.shopSigns = signMats;
  // Bengaluru sign
  const signL = lots.find(l => l.sign);
  const signTex = toTex(texSign('ಬೆಂಗಳೂರು'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ map: signTex, roughness: .9 }));
  sign.position.set(signL.x, signL.h - 1.8, signL.z + signL.d / 2 + .05); scene.add(sign); out.sign = sign;

  // the Dispersal wall + red ring on the pavement
  const wallTex = toTex(texDispersalWall());
  // repaint the lettering once the web fonts have arrived (canvas text can't wait for them)
  const repaint = () => { wallTex.image = texDispersalWall(); wallTex.needsUpdate = true; signTex.image = texSign('ಬೆಂಗಳೂರು'); signTex.needsUpdate = true; signTexs.forEach((t, j) => { t.image = paintSign(SIGNS[j]); t.needsUpdate = true; }); };
  try { document.fonts.ready.then(() => setTimeout(repaint, 60)); document.fonts.addEventListener('loadingdone', repaint); } catch (e) { }
  const wmat = [concrete, concrete, concrete, concrete, new THREE.MeshStandardMaterial({ map: wallTex, roughness: .95 }), concrete];
  const dw = new THREE.Mesh(new THREE.BoxGeometry(8, 8, .9), wmat); dw.position.set(20, 4, 104.5); dw.rotation.y = .72; dw.castShadow = dw.receiveShadow = true; scene.add(dw);
  out.wallMat = wmat[4];
  const redRing = flat(new THREE.RingGeometry(1.15, 1.42, 64), new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: .8 }), 24.5, 107.6, .03);
  flat(new THREE.CircleGeometry(.2, 24), redRing.material, 24.5, 107.6, .031);

  // chai stall + tables + glass
  const C = GEO.CHAI;
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 1.7), new THREE.MeshStandardMaterial({ color: '#2f5d4a', roughness: .8 })); kiosk.position.set(C.x + 4, 1.15, C.z - 3); kiosk.castShadow = true; scene.add(kiosk);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, .1, 2.6), new THREE.MeshStandardMaterial({ color: '#c6412e', roughness: .8 })); awn.position.set(C.x + 4, 2.5, C.z - 2.6); awn.rotation.x = .12; scene.add(awn);
  const tableG = mergeGeometries([new THREE.CylinderGeometry(.42, .42, .04, 24).translate(0, .88, 0), new THREE.CylinderGeometry(.04, .04, .88, 8).translate(0, .44, 0), new THREE.CylinderGeometry(.25, .25, .03, 16).translate(0, .015, 0)]);
  const tableIM = new THREE.InstancedMesh(tableG, new THREE.MeshStandardMaterial({ color: '#2b2b2b', metalness: .15, roughness: .6 }), 4);
  [[-.66, 1.28], [2.2, 1.1], [-2.4, -.6], [1, -2.2]].forEach(([dx, dz], i) => { _p.set(C.x + dx, 0, C.z + dz); _q.identity(); setIM(tableIM, i, _p, _q, _s); });
  scene.add(tableIM);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.045, .036, .11, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#dfe8e8', transparent: true, opacity: .35, roughness: .05, side: THREE.DoubleSide }));
  glass.position.set(C.x - .62, .96, C.z + 1.24); scene.add(glass);
  const tea = new THREE.Mesh(new THREE.CylinderGeometry(.041, .035, .085, 18), new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: .3 })); tea.position.set(C.x - .62, .945, C.z + 1.24); scene.add(tea);

  // bollards with red dots
  const bolG = mergeGeometries([new THREE.CylinderGeometry(.17, .19, .95, 12).translate(0, .475, 0), new THREE.SphereGeometry(.17, 12, 6, 0, TAU, 0, Math.PI / 2).translate(0, .95, 0)]);
  const bolIM = new THREE.InstancedMesh(bolG, new THREE.MeshStandardMaterial({ color: '#a39d91', roughness: .9 }), 28);
  const dotIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .06, .02, 12), new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: .7 }), 28);
  for (let i = 0; i < 28; i++) {
    let x, z; if (i < 14) { const a = -2.2 + i * .12; x = P.x + Math.cos(a) * 34.5; z = P.z + Math.sin(a) * 34.5; } else { x = -30 + (i - 14) * 5; z = P.z - 5.2; if (i >= 21) { x = 40 + (i - 21) * 5; } }
    _p.set(x, .02, z); _q.identity(); setIM(bolIM, i, _p, _q, _s);
    _p.set(x, .66, z + .18); _q.setFromAxisAngle(V3(1, 0, 0), Math.PI / 2); setIM(dotIM, i, _p, _q, _s);
  }
  bolIM.castShadow = true; scene.add(bolIM, dotIM);

  // street lamps
  const lampPts = [];
  for (let x = -104; x <= 104; x += 16) { if (Math.abs(x - P.x) < 36) continue; lampPts.push([x, P.z - 6.2, 1], [x + 8, P.z + 6.2, -1]); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; lampPts.push([P.x + Math.cos(a) * 34.8, P.z + Math.sin(a) * 34.8, 0]); }
  const lampG = mergeGeometries([new THREE.CylinderGeometry(.09, .12, 7.5, 8).translate(0, 3.75, 0), new THREE.BoxGeometry(.1, .1, 1.6).translate(0, 7.45, .75)]);
  const lampIM = new THREE.InstancedMesh(lampG, new THREE.MeshStandardMaterial({ color: '#4a4a48', roughness: .7 }), lampPts.length);
  const headMat = new THREE.MeshBasicMaterial({ color: '#ffb36a' });
  const headIM = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .12, .6), headMat, lampPts.length);
  const glowPos = [];
  lampPts.forEach(([x, z, s], i) => {
    const yaw = s === 0 ? Math.atan2(P.x - x, P.z - z) : (s > 0 ? 0 : Math.PI);
    _p.set(x, 0, z); _q.setFromAxisAngle(V3(0, 1, 0), yaw); setIM(lampIM, i, _p, _q, _s);
    const hx = x + Math.sin(yaw) * 1.5, hz = z + Math.cos(yaw) * 1.5; _p.set(hx, 7.35, hz); setIM(headIM, i, _p, _q, _s); glowPos.push(hx, 7.2, hz);
  });
  scene.add(lampIM, headIM);
  const lgG = new THREE.BufferGeometry(); lgG.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
  const lampGlowU = { uI: { value: 0 }, uSize: { value: 600 } };
  const lampGlow = new THREE.Points(lgG, new THREE.ShaderMaterial({ uniforms: lampGlowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uSize; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*3.0/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uI; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float d=dot(p,p); float a=exp(-d*5.0)*uI; if(a<0.004) discard; gl_FragColor=vec4(vec3(1.0,0.66,0.34)*a,1.0);}' }));
  lampGlow.frustumCulled = false; scene.add(lampGlow);
  out.lamps = { headMat, lampGlowU, pts: glowPos };
  out.groundMats = [asphalt, paving, concrete, out.wheelMat];

  // autos (green body, yellow top)
  const autoParts = [];
  const vc = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = col(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  // a Bengaluru auto: a rounded green tub tapering to the single front wheel, a yellow cowl, a black canvas hood on two pillars
  const ni = (g) => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
  const side = new THREE.Shape();      // side profile in (z, y): tail at z = -1.25, nose at z = 1.3
  side.moveTo(-1.25, .38); side.lineTo(-1.25, 1.02); side.quadraticCurveTo(-1.2, 1.12, -1.05, 1.12); side.lineTo(.5, 1.05);
  side.quadraticCurveTo(1.0, 1.02, 1.28, .78); side.quadraticCurveTo(1.36, .55, 1.2, .42); side.lineTo(-1.25, .38);
  const tub = new THREE.ExtrudeGeometry(side, { depth: 1.22, bevelEnabled: true, bevelThickness: .07, bevelSize: .06, bevelSegments: 3, curveSegments: 10 });
  tub.rotateY(-Math.PI / 2); tub.translate(.61, 0, 0);
  { const P_ = tub.attributes.position; for (let i = 0; i < P_.count; i++) { const z = P_.getZ(i), k = lerp(1, .5, smooth(.1, 1.3, z)); P_.setX(i, P_.getX(i) * k); } tub.computeVertexNormals(); }
  const cy = tub.attributes.position.count, tc = new Float32Array(cy * 3), cG = col('#23643f'), cY = col('#e6b420');
  for (let i = 0; i < cy; i++) { const y = tub.attributes.position.getY(i), z = tub.attributes.position.getZ(i), c = (y > .86 || z > .75) ? cY : cG; tc[i * 3] = c.r; tc[i * 3 + 1] = c.g; tc[i * 3 + 2] = c.b; }
  tub.setAttribute('color', new THREE.BufferAttribute(tc, 3)); autoParts.push(ni(tub));
  const hoodS = new THREE.Shape();     // the hood: a thin arched shell from the windscreen over the roof and down the back
  const arc = [[.62, 1.12], [.62, 1.78], [.4, 1.98], [-.3, 2.02], [-1.0, 1.95], [-1.28, 1.7], [-1.3, 1.1]];
  hoodS.moveTo(arc[0][0], arc[0][1]); for (let i = 1; i < arc.length; i++) hoodS.lineTo(arc[i][0], arc[i][1]);
  for (let i = arc.length - 1; i >= 0; i--) hoodS.lineTo(arc[i][0] + (i === 0 ? 0 : i === arc.length - 1 ? .05 : .0), arc[i][1] - .05);
  const hood = new THREE.ExtrudeGeometry(hoodS, { depth: 1.34, bevelEnabled: false, curveSegments: 4 }); hood.rotateY(-Math.PI / 2); hood.translate(.67, 0, 0);
  autoParts.push(ni(vc(hood, '#171614')));
  autoParts.push(ni(vc(new THREE.BoxGeometry(1.3, .05, 1.8).translate(0, 1.99, -.3), '#1b1a18')));
  for (const x of [-.6, .6]) autoParts.push(ni(vc(new THREE.CylinderGeometry(.03, .03, .9, 6).translate(x * .82, 1.53, .6), '#2a2a28')));
  autoParts.push(ni(vc(new THREE.BoxGeometry(1.0, .6, .03).translate(0, 1.5, .64), '#3b4450')));          // windscreen
  autoParts.push(ni(vc(new THREE.BoxGeometry(1.2, .45, .9).translate(0, 1.3, -.75), '#221c16')));          // rear bench
  autoParts.push(ni(vc(new THREE.CylinderGeometry(.09, .09, .06, 12).rotateX(Math.PI / 2).translate(0, .95, 1.36), '#f4efe0')));   // headlamp
  autoParts.push(ni(vc(new THREE.TorusGeometry(.32, .06, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(0, .3, 1.05), '#e6b420')));  // front mudguard
  for (const [x, z] of [[0, 1.05], [-.62, -.78], [.62, -.78]]) {
    autoParts.push(ni(vc(new THREE.TorusGeometry(.2, .075, 8, 16).rotateY(Math.PI / 2).translate(x, .27, z), '#111111')));
    autoParts.push(ni(vc(new THREE.CylinderGeometry(.12, .12, .1, 10).rotateZ(Math.PI / 2).translate(x, .27, z), '#8a8a86')));
  }
  const autoG = mergeGeometries(autoParts);
  const NA = 9, autoIM = new THREE.InstancedMesh(autoG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }), NA);
  autoIM.castShadow = true; autoIM.frustumCulled = false; scene.add(autoIM);
  // loop route
  const loop = [];
  for (let x = -106; x <= -29; x += 7) loop.push([x, P.z + 3]);
  for (let a = Math.PI; a >= 0; a -= .12) loop.push([P.x + Math.cos(a) * 29, P.z + Math.sin(a) * 29]);
  for (let x = 33; x <= 106; x += 7) loop.push([x, P.z + 3]);
  for (let x = 106; x >= 33; x -= 7) loop.push([x, P.z - 3]);
  for (let a = 0; a >= -Math.PI; a -= .12) loop.push([P.x + Math.cos(a) * 29, P.z + Math.sin(a) * 29]);
  for (let x = -29; x >= -106; x -= 7) loop.push([x, P.z - 3]);
  loop.push(loop[0]);
  const autoRoute = new Route(loop);
  const parked = { x: 27.5, z: 109.5, yaw: 2.2 };
  out.autos = { autoIM, autoRoute, NA, parked };
  out.lots = lots;
  return out;
}

/* =========================================================================
   FOREST — instanced painterly broadleaf, rain trees, bushes and conifers,
   kept out of every director shot's lens and line of sight
   ========================================================================= */
// every director shot's lens and first ~30 m of its line of sight, rasterised to a 2 m grid that holds the lowest and
// highest point (above the ground) at which any of them passes
function shotClearance() {
  const S = 2, N = 240, off = 240, low = new Float32Array(N * N).fill(1e9), high = new Float32Array(N * N).fill(-1e9);
  const mark = (x, z, y) => {
    const i = Math.floor((x + off) / S), j = Math.floor((z + off) / S);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const k = jj * N + ii; if (y < low[k]) low[k] = y; if (y > high[k]) high[k] = y;
    }
  };
  for (const list of SHOTS) for (const fn of list) {
    if (!fn) continue;
    for (let rt = 0; rt < 420; rt += 1.5) {
      const sh = fn(rt), [px, py, pz] = sh.p, [lx, ly, lz] = sh.l, dx = lx - px, dy = ly - py, dz = lz - pz, L = Math.hypot(dx, dy, dz) || 1, reach = Math.min(32, L * .8);
      for (let d = 0; d <= reach; d += 1.5) { const x = px + dx / L * d, y = py + dy / L * d, z = pz + dz / L * d; mark(x, z, y - groundY(x, z)); }
    }
  }
  const cells = (x, z, R, fn) => {
    const i0 = Math.max(0, Math.floor((x - R + off) / S)), i1 = Math.min(N - 1, Math.floor((x + R + off) / S)), j0 = Math.max(0, Math.floor((z - R + off) / S)), j1 = Math.min(N - 1, Math.floor((z + R + off) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (fn(j * N + i)) return true;
    return false;
  };
  // a tree is in the way if the lens or the sight line passes through its crown, or under the crown within reach of its trunk
  return (x, z, R, bottom, top, trunkR) =>
    cells(x, z, R + .5, (k) => high[k] >= bottom && low[k] <= top) || (trunkR > 0 && cells(x, z, trunkR + .8, (k) => low[k] < bottom));
}
function buildForest(scene, Q) {
  const out = {}, M = treeMaterials(), K = treeKit();
  const inLens = shotClearance();
  const excl = (x, z) => {
    const dC = Math.hypot(x, z), dR = Math.hypot(x - GEO.R.x, z - GEO.R.z);
    if (dC < 41) return true;
    if (dR < 21) return true;
    if (x > GEO.R.x + 10 && dR < 110 && Math.abs(z - GEO.R.z) < 50) return true;   // open eastern view from the ridge
    if (Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 36) return true;                   // the sun temple's precinct
    if (x < -40 && x > -112 && Math.abs(z) < 19) return true;          // steps, forecourt, gate
    if (z > 84 && Math.abs(x - GEO.P.x) < 116 && z < 182) return true;  // city
    if (Math.min(distToRoute(x, z, ROUTES.hill), distToRoute(x, z, ROUTES.ridge), distToRoute(x, z, ROUTES.road)) < 4.2) return true;
    return false;
  };
  const r = rng(99), dens = Q.trees;
  // size is drawn with the position so the lens check knows how big the tree will be: [crown reach, crown bottom, top, trunk] per unit scale
  const DIM = { broad: [3.9, 3.8, 9.9, .4], conifer: [2.4, 2.0, 9.6, .3], rain: [6.6, 4.9, 10, .6], bush: [1.3, 0, 1.5, 0] };
  const place = (n, kind, sMin, sMax, fn, planted) => {
    const pts = []; let tries = 0;
    while (pts.length < n && tries < n * 30) {
      tries++; const p = fn(); if (!p || (!planted && excl(p[0], p[1]))) continue;
      const s = sMin + r() * (sMax - sMin), sy = s * (.85 + r() * .35);
      const D_ = DIM[kind]; if (inLens(p[0], p[1], D_[0] * s, D_[1] * sy, D_[2] * sy + .5, D_[3] * s)) continue;
      pts.push([p[0], p[1], s, sy]);
    }
    return pts;
  };
  const bPts = place(Math.floor(1100 * dens), 'broad', 1.0, 2.1, () => { const a = r() * TAU, d = 42 + Math.pow(r(), .8) * 175; return [Math.cos(a) * d, Math.sin(a) * d * .95 - 10]; });
  const cPts = place(Math.floor(520 * dens), 'conifer', .9, 1.9, () => { if (r() < .55) { const a = r() * TAU, d = 21 + r() * 60; return [GEO.R.x + Math.cos(a) * d, GEO.R.z + Math.sin(a) * d]; } const a = r() * TAU, d = 170 + r() * 60; return [Math.cos(a) * d, Math.sin(a) * d]; });
  const rCand = [];
  for (let x = -100; x <= 100; x += 17) { if (Math.abs(x - GEO.P.x) < 40) continue; rCand.push([x + r() * 3, GEO.P.z - 8.6], [x + 8 + r() * 3, GEO.P.z + 8.6]); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3; rCand.push([GEO.P.x + Math.cos(a) * 38, GEO.P.z + Math.sin(a) * 38]); }
  let rk = 0; const rPts = place(rCand.length, 'rain', .9, 1.3, () => rk < rCand.length ? rCand[rk++] : null, true);   // street trees: planted, not wild
  const kPts = place(Math.floor(420 * dens), 'bush', .6, 1.4, () => { const a = r() * TAU, d = 38 + r() * 30; return [Math.cos(a) * d, Math.sin(a) * d]; });
  const c = new THREE.Color(), cb = new THREE.Color(), WHITE_ = col('#ffffff');
  const mk = (pts, parts, tintA, tintB, cast) => {
    const ims = parts.filter(p => p[0]).map(([geo, mat, depth, order, isBark]) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length)); im.count = pts.length;
      if (depth) im.customDepthMaterial = depth; im.castShadow = cast; im.receiveShadow = order === 0; im.renderOrder = order; im.userData.bark = isBark; scene.add(im); return im;   // leaf cards skip shadow lookups (fill budget)
    });
    pts.forEach(([x, z, s, sy], i) => {
      _p.set(x, groundY(x, z) - .2, z); _q.setFromAxisAngle(V3(0, 1, 0), r() * TAU); _s.set(s, sy, s);
      c.set(tintA).lerp(col(tintB), r()); cb.copy(WHITE_).multiplyScalar(.85 + r() * .3);
      for (const im of ims) { setIM(im, i, _p, _q, _s); im.setColorAt(i, im.userData.bark ? cb : c); }
    });
    _s.set(1, 1, 1);
    return ims;
  };
  out.broadIM = mk(bPts, [[K.broad.trunk, M.bark, null, 0, true], [K.broad.core, M.core, null, 0], [K.broad.cards, M.cards, M.cardsDepth, 1]], '#ffffff', '#d8cba0', Q.treeShadows);
  out.coniferIM = mk(cPts, [[K.conifer.trunk, M.bark, null, 0, true], [K.conifer.cones, M.cone, null, 0]], '#ffffff', '#c4c0a8', Q.treeShadows);
  mk(rPts, [[K.rain.trunk, M.bark, null, 0, true], [K.rain.core, M.core, null, 0], [K.rain.cards, M.cards, M.cardsDepth, 1]], '#ffffff', '#e0d6a8', true);
  mk(kPts, [[K.bush.core, M.core, null, 0], [K.bush.cards, M.cards, null, 1]], '#ffffff', '#c0b890', false);
  out.windU = TREE_U; out.mats = M;
  out.pts = { broad: bPts, conifer: cPts };
  out.counts = { broad: bPts.length, conifer: cPts.length, rain: rPts.length, bush: kPts.length };
  return out;
}
