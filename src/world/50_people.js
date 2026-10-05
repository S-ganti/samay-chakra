/* =========================================================================
   POPULATION — every person's day is an analytic function of the clock, so
   any time you jump to is already "lived". Display positions glide toward it.
   ========================================================================= */
const A_STAND = 0, A_WALK = 1, A_DG = 2, A_DE = 3, A_SLEEP = 4, A_DD = 5, A_SIT = 6, A_DJ = 7, A_CIRCLE = 8, A_WATCH = 9, A_CARRY = 10, A_CHAI = 11;
const NMAX = 900, NCARRY = 24, HIST = 72, HIST_DT = 1 / 30;
// palettes (poster-led: whites and creams, saffron, marigold, crimson, with jewel-tone accents)
// outfits as whole combinations, the way people actually dress: [weight, top, bottom, accent, top print, bottom print, print ink, sheen]
// colours may be lists (one is picked); print: 0 plain, 1 stripes, 2 checks, 3 bandhani, 4 block print, 5 ikat, 6 bands, 7 denim,
// 8 heathered, -1 denim if the bottom is denim; ink: 0 the accent, 1 a darker shade, 2 a pale one; sheen: silk and zari
// (top/bottom/accent are, per outfit: saree blouse/body/border, lehenga choli/skirt/dupatta, salwar kameez/salwar/dupatta,
//  kurta/pyjama/trim, dhoti shirt/dhoti or lungi/turban, jeans shirt/trousers/shoes)
const DENIM = ['#2c3e5c', '#1f2a3d', '#3d5578', '#5d7a9c', '#1d1d1f', '#3a3d44'], CHINOS = ['#a8946a', '#5a5a3e', '#23283a', '#7a6a52'];
const SHOES = ['#e8e6e0', '#1a1a1a', '#5a3a26', '#7a7d82', '#c8c0b0'], CHAPPAL = ['#c8a070', '#1a1a1a', '#e8e6e0', '#a0522d', '#d8a838'];
const TEES = ['#1e1e20', '#ecebe6', '#8e8f92', '#1f2a44', '#6b1f2a', '#5b5f3a', '#c99a2e', '#1f4a3a', '#2f5a8a', '#b8b0a0'];
const OUTFITS = [
  [ // SAREE
    [5, ['#1f6a4a', '#7a1f2a', '#d8a838'], ['#a3195b', '#1f6f6a', '#d29a2a', '#6a1a3a', '#c2306a'], ['#d8a838', '#c9a040'], 0, 0, 0, 1],   // Kanjeevaram silk, zari border
    [3, ['#d0a748', '#efe6cf'], ['#efe6cf', '#f2ecdc'], ['#d0a748'], 0, 0, 0, .7],                                                        // Kerala kasavu
    [3, ['#b3261e'], ['#f2efe6', '#efe9dc'], ['#b3261e'], 0, 0, 0, 0],                                                                    // Bengal tant: white, red border
    [3, ['#efe6d4', '#283b66'], ['#283b66', '#1f3050'], ['#efe6d4'], 0, 4, 2, 0],                                                        // indigo dabu block print
    [3, ['#2f7a3a', '#d8a838'], ['#b02020', '#c2306a', '#2a3f8a'], ['#2f7a3a', '#d8a838'], 0, 3, 2, 0],                                  // bandhani
    [3, ['#c8c8cc', '#f2efe6'], ['#e9a985', '#b8a8d8', '#a8cbb0', '#f0c8c8'], ['#c8c8cc'], 0, 0, 0, .4],                                  // chiffon pastels
    [2, ['#1f1b18', '#b3261e'], ['#7a1f2a', '#2a3f6e', '#d29a2a'], ['#1f1b18'], 0, 5, 2, 0],                                             // Pochampally ikat
    [1, ['#d8a838'], ['#1c1a1c'], ['#d8a838'], 0, 0, 0, 1],                                                                             // black and gold
    [2, ['#2f7a3a'], ['#e0662a', '#e8a020'], ['#2f7a3a', '#7a1f2a'], 0, 0, 0, .5],                                                       // saffron with a green border
  ],
  [ // LEHENGA
    [3, ['#d8a838', '#7a1f2a'], ['#7a1f2a', '#8a1a3a'], ['#d8a838', '#c2306a'], 0, 4, 0, 1],
    [3, ['#2f7a3a'], ['#d84a7a', '#c2306a'], ['#2f7a3a', '#e8b040'], 0, 0, 0, .8],
    [2, ['#c8c8cc'], ['#1f2a5a', '#2a1f4a'], ['#c8c8cc', '#d8a838'], 0, 4, 2, .8],
    [2, ['#c2306a'], ['#1d6a4a'], ['#e8a020'], 0, 3, 2, .6],
    [2, ['#f0c8c8'], ['#e9d8b8', '#f2e4d0'], ['#e0a0a8'], 0, 4, 1, .4],
  ],
  [ // KURTA
    [8, ['#f3ede2', '#efe6d4', '#f5f0e6', '#e9e1d0'], ['#f5f0e6', '#efe6d4'], ['#d8a838'], 0, 0, 0, 0],                                   // white and cream
    [3, ['#b5c9dc', '#a8cbb0', '#e3c0bc', '#d8c8a8', '#c8c0d8'], ['#f5f0e6', '#2c3e5c', '#1f2a3d'], ['#d8a838'], 0, -1, 0, 0],             // pastels, pyjama or jeans
    [2, ['#e3792a', '#c9662a'], ['#f5f0e6'], ['#d8a838'], 0, 0, 0, 0],                                                                    // saffron
    [2, ['#7a1f2a', '#1f2a44', '#2f4a3a'], ['#efe6d4', '#d8c8a8'], ['#d8a838'], 0, 0, 0, .35],                                            // festive raw silk
    [2, ['#2a3f6e'], ['#efe6d4'], ['#d8a838'], 4, 0, 2, 0],                                                                               // indigo block print
    [2, ['#efe6d4'], ['#2c3e5c', '#1f2a3d', '#1d1d1f'], ['#d8a838'], 1, -1, 1, 0],                                                       // striped kurta over jeans
  ],
  [ // DHOTI / LUNGI
    [4, ['#f3ede2', '#efe6d4'], ['#f5f0e6', '#efe9dc'], ['#d0a748', '#e3792a'], 0, 0, 0, .5],                                             // white mundu with a kasavu edge
    [4, ['#efe6d4', '#9db8d4', '#d8c8a8'], ['#2a4a7a', '#1f5a4a', '#6a1f2a', '#3a3a6a'], ['#e3792a', '#efe6d4'], 0, 2, 2, 0],            // checked lungi
    [2, ['#e3792a', '#d9772e'], ['#e3792a', '#c9662a'], ['#e3792a'], 0, 0, 0, 0],                                                         // saffron
    [2, ['#2f4a3a', '#5a3a26', '#7a6a4a'], ['#efe6d4'], ['#b3261e', '#d8a838'], 2, 0, 1, 0],                                              // checked shirt, white dhoti
  ],
  [ // SALWAR
    [3, ['#efe9dc'], ['#efe9dc', '#e8e1d0'], ['#c2306a', '#2a3f6e', '#e8a020'], 0, 0, 0, 0],                                              // white chikankari, a coloured dupatta
    [3, ['#2a3f6e', '#1f3050'], ['#efe6d4'], ['#c2306a', '#e8a020'], 4, 0, 2, 0],                                                        // indigo block print
    [3, ['#d2a03a', '#e3c040'], ['#2a5a5a', '#7a1f2a'], ['#7a1f2a', '#2a5a5a'], 4, 0, 1, 0],                                              // mustard
    [3, ['#2c7a7a', '#1f6a6a'], ['#efe6d4', '#e9d8b8'], ['#e8a020', '#c2306a'], 0, 0, 0, 0],                                              // teal
    [3, ['#c2306a', '#d84a7a'], ['#efe6d4', '#f0c8c8'], ['#2a3f8a', '#e8a020'], 3, 0, 2, 0],                                              // Rani bandhani
    [2, ['#e9a985', '#a8cbb0', '#a690c0', '#e3d36a'], ['#efe6d4', '#f2efe6'], ['#c8c8cc', '#e9a985'], 0, 0, 0, 0],                        // pastels
    [2, ['#7a1f2c'], ['#d8a838', '#efe6d4'], ['#d8a838'], 5, 0, 2, 0],                                                                   // maroon ikat
    [2, ['#1c1a1c'], ['#1c1a1c', '#efe6d4'], ['#e8a020', '#c2306a'], 4, 0, 0, 0],                                                        // black with a printed dupatta's colour
  ],
  [ // JEANS_M
    [5, TEES, [...DENIM, ...DENIM, ...CHINOS], SHOES, 8, -1, 0, 0],                                                                       // tee and jeans
    [3, ['#9db8d4', '#eef0f2', '#d8d4e8', '#e8e0d0'], [...DENIM, ...CHINOS], SHOES, 0, -1, 0, 0],                                         // plain shirt
    [3, ['#2f4f8a', '#9b2a2a', '#2f5a3a', '#4a4a5a'], [...DENIM, ...CHINOS], SHOES, 2, -1, 2, 0],                                         // checked shirt
    [2, ['#eef0f2', '#c8d8e8'], ['#23283a', '#1d1d1f', '#55585e'], SHOES, 1, 0, 1, 0],                                                    // striped office shirt
    [2, TEES, DENIM, SHOES, 6, 7, 2, 0],                                                                                                  // striped tee
  ],
  [ // JEANS_F
    [4, ['#2a3f6e', '#efe6d4', '#d2a03a', '#c2306a', '#2c7a7a', '#e9a985', '#7a1f2c'], DENIM, CHAPPAL, 4, 7, 2, 0],                        // block-print kurti over jeans
    [3, ['#1e1e20', '#ecebe6', '#e8c8d0', '#c8d8c8', '#b8a8cc', '#d84a5a'], DENIM, SHOES, 0, 7, 0, 0],                                    // a top and jeans
    [2, ['#c2306a', '#e3792a', '#2a3f8a'], ['#efe6d4', '#1d1d1f'], CHAPPAL, 5, 0, 2, 0],                                                  // ikat kurti over leggings
    [2, ['#efe6d4', '#f2efe6'], ['#1d1d1f', '#2c3e5c'], CHAPPAL, 1, -1, 1, 0],                                                            // white striped kurti
  ],
];
// skin from wheat-fair to deep brown, weighted toward the middle of the range
const SKIN = ['#e0b08a', '#d4a07a', '#c48f68', '#b07a52', '#9c6844', '#8a5a3a', '#764a30', '#623c27', '#4e301f'], SKIN_W = [1, 2, 3, 4, 4, 4, 3, 2, 1];
const PAL_HAIR = ['#1a1412', '#15110f', '#241a14', '#2b211a', '#1f1814'];

function buildPeople(scene, Q) {
  const r = rng(1729);
  const pick = (arr, w) => { let s = 0; for (const x of w) s += x; let v = r() * s; for (let i = 0; i < arr.length; i++) { v -= w[i]; if (v <= 0) return arr[i]; } return arr[0]; };
  const F = (n = NMAX) => new Float32Array(n);
  const D = {
    kind: new Uint8Array(NMAX), d: F(), lat: F(), h: F(), sitter: new Uint8Array(NMAX), circler: new Uint8Array(NMAX), cityMode: new Uint8Array(NMAX),
    foreX: F(), foreZ: F(), millX: F(), millZ: F(), millYaw: F(),
    gR: F(), gT: F(), gW: F(), eR: F(), eT: F(), eW: F(), dR: F(), dT: F(), dW: F(), zR: F(), zT: F(), zW: F(),
    slX: F(), slZ: F(), slYaw: F(), awake: new Uint8Array(NMAX), eaX: F(), eaZ: F(),
    cX: F(), cZ: F(), cYaw: F(), cS: F(), cV: F(), doorX: F(), doorZ: F(), carry: new Int8Array(NMAX).fill(-1),
    // display state
    x: F(), y: F(), z: F(), yaw: F(), lie: F(), sit: F(), hide: F(), spd: F(), init: new Uint8Array(NMAX),
    hist: new Float32Array(NMAX * HIST * 4), histHead: 0, histAcc: 0,
    act: new Uint8Array(NMAX), armL: F(), armR: F(), bounce: F(), glow: F(), rnd: F(), tp: new Uint8Array(NMAX), cfade: F().fill(1),
  };
  const P = GEO.P, C = GEO.C, R = GEO.R;
  const polar = (cx, cz, r0, r1) => { const a = r() * TAU, rr = Math.sqrt(lerp(r0 * r0, r1 * r1, r())); return [cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]; };
  const chaiTables = [[2.2, 1.1], [-2.4, -.6], [1, -2.2]];
  for (let i = 0; i < NMAX; i++) {
    D.kind[i] = i === 0 ? 2 : i <= NCARRY ? 1 : (i % 8 === 5 ? 3 : 0);
    D.d[i] = r(); D.lat[i] = (r() - .5) * 6; D.h[i] = .9 + r() * .2; D.rnd[i] = r();
    D.sitter[i] = r() < .3 ? 1 : 0; D.circler[i] = r() < .72 ? 1 : 0; D.awake[i] = r() < .08 ? 1 : 0;
    [D.foreX[i], D.foreZ[i]] = [GEO.FORE.x - 4 + (r() - .5) * 18, (r() - .5) * 26];
    const mm = r() < .25 ? polar(C.x, C.z, 4.8, 10.5) : polar(C.x, C.z, 16.5, 36); D.millX[i] = mm[0]; D.millZ[i] = mm[1]; D.millYaw[i] = Math.atan2(-mm[0], -mm[1]) + (r() - .5) * 1.6;
    const inner = r() < .22;
    D.gR[i] = inner ? lerp(4.8, 10.6, r()) : lerp(16.5, 29, Math.sqrt(r())); D.gT[i] = r() * TAU; D.gW[i] = lerp(.45, 1.15, r()) / D.gR[i];
    D.eR[i] = lerp(2.6, 11.6, Math.sqrt(r())); D.eT[i] = r() * TAU; D.eW[i] = lerp(.8, 1.7, r()) / D.eR[i] * (r() < .15 ? -1 : 1);
    D.dR[i] = r() < .2 ? lerp(4.8, 10.6, r()) : lerp(16.5, 34, Math.sqrt(r())); D.dT[i] = r() * TAU; D.dW[i] = lerp(.25, .75, r()) / D.dR[i];
    D.zR[i] = lerp(18.4, 24.4, r()); D.zT[i] = r() * TAU; D.zW[i] = lerp(.85, 1.3, r()) / D.zR[i];
    const sl = polar(R.x - 5, R.z + 4, 2.5, 16); D.slX[i] = sl[0]; D.slZ[i] = sl[1]; D.slYaw[i] = r() * TAU;
    D.eaX[i] = R.x + 5 + r() * 9; D.eaZ[i] = R.z + (r() - .5) * 22;
    const cm = r(); D.cityMode[i] = cm < .16 ? 0 : cm < .6 ? 1 : 2;
    if (D.cityMode[i] === 0) { const tb = chaiTables[Math.floor(r() * 3)], a = r() * TAU; D.cX[i] = GEO.CHAI.x + tb[0] + Math.cos(a) * .75; D.cZ[i] = GEO.CHAI.z + tb[1] + Math.sin(a) * .75; D.cYaw[i] = Math.atan2(-Math.cos(a), -Math.sin(a)); }
    else if (D.cityMode[i] === 2) { const north = r() < .5, side = r() < .5; D.cX[i] = side ? lerp(-100, -32, r()) : lerp(40, 100, r()); D.cZ[i] = (north ? 114.5 : 129.5) + (r() - .5) * 2.4; D.cYaw[i] = r() * TAU; }
    D.cS[i] = r(); D.cV[i] = lerp(.7, 1.3, r()) * (r() < .5 ? 1 : -1);
    D.doorX[i] = D.cX[i] || lerp(-90, 90, r()); D.doorZ[i] = r() < .5 ? 113.5 : 130.5;
  }
  // carriers' gate slots: 24 panels ↔ carriers 1..24
  const stroll = new Route([[-100, 114.5], [-34, 114.5], [-18, 91], [26, 91], [42, 114.5], [100, 114.5], [100, 129.5], [42, 129.5], [26, 153], [-18, 153], [-34, 129.5], [-100, 129.5], [-100, 114.5]]);
  const hillToGate = new Route([...ROUTES.hill.x.map((x, k) => [x, ROUTES.hill.z[k]]), [-86, 0], [-80, 0], [-57, 0]]);
  const gateToCity = [-1, 1].map(sg => new Route([[-43, sg * LANE_Z], [-47, sg * LANE_Z], [-51, sg * LANE_Z], [-80, sg * LANE_Z], [-88, sg * LANE_Z], ...ROUTES.hillR.x.map((x, k) => [x, ROUTES.hillR.z[k]])]));
  const gateDown = new Route([[-60, 0], [-80, 0], [-85, 0]]);

  /* ---------- mocap crowd: 7 outfits × 3 levels of detail, each an instanced, GPU-skinned mesh ---------- */
  CROWD_U.uBones.value = RIG.build();
  const { mat: bodyMat, depth: bodyDepth } = crowdMaterials();
  D.vari = new Uint8Array(NMAX); D.pal = new Float32Array(NMAX * 15); D.pat = new Float32Array(NMAX * 4); D.lod = new Uint8Array(NMAX);
  D.clipA = new Uint8Array(NMAX); D.tA = F(); D.clipB = new Uint8Array(NMAX); D.tB = F(); D.fadeB = F(); D.seat = F();
  const c = new THREE.Color(), pc = (hexes, w) => c.set(w ? pick(hexes, w) : hexes[Math.floor(r() * hexes.length)]);
  const capV = new Array(VAR_N).fill(0);
  for (let i = 0; i < NMAX; i++) {
    const k = D.kind[i], u = r();
    // who wears what: carriers mostly in work clothes; the crowd half women, half men, mixing everyday city wear with festival dress
    const v = i === 0 ? VAR.KURTA : k === 1 ? (u < .4 ? VAR.DHOTI : u < .6 ? VAR.KURTA : VAR.JEANS_M)
      : r() < .5 ? (u < .34 ? VAR.SAREE : u < .64 ? VAR.SALWAR : u < .88 ? VAR.JEANS_F : VAR.LEHENGA)
      : (u < .52 ? VAR.JEANS_M : u < .85 ? VAR.KURTA : VAR.DHOTI);
    D.vari[i] = v; capV[v]++;
    const o = i * 15, put = (j) => { D.pal[o + j] = c.r; D.pal[o + j + 1] = c.g; D.pal[o + j + 2] = c.b; };
    const fade = () => c.multiplyScalar(.9 + r() * .14);          // dye lots, washing and sun: no two garments quite the same
    const one = (x) => Array.isArray(x) ? x[Math.floor(r() * x.length)] : x;
    const fits = OUTFITS[v], F_ = pick(fits, fits.map(f => f[0]));
    const bot = one(F_[2]);
    c.set(one(F_[1])); fade(); put(0); c.set(bot); fade(); put(3); c.set(one(F_[3])); fade(); put(6);
    D.pat[i * 4] = F_[4]; D.pat[i * 4 + 1] = F_[5] === -1 ? (DENIM.includes(bot) ? 7 : 0) : F_[5]; D.pat[i * 4 + 2] = F_[6]; D.pat[i * 4 + 3] = F_[7];
    if (i === 0) { c.set('#1d1a18'); put(0); c.set('#26211d'); put(3); c.set('#e8792a'); put(6); D.pat[0] = D.pat[1] = D.pat[3] = 0; }
    c.set(pick(SKIN, SKIN_W)).multiplyScalar(.96 + r() * .08); put(9);
    { const hr = r(); if (hr < .05) c.set('#8a8580'); else if (hr < .1) c.set('#5d5a57'); else if (hr < .12) c.set('#5a2414'); else c.set(PAL_HAIR[Math.floor(r() * PAL_HAIR.length)]); put(12); }
  }
  const crowd = [];
  for (let v = 0; v < VAR_N; v++) {
    crowd.push([]);
    const cap = Math.max(1, capV[v]);
    for (let l = 0; l < 3; l++) {
      const g = buildFigure(v, l);
      const at = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
      const A = { iAnim: at(4), iC0: at(4), iC1: at(4), iC2: at(4), iHair: at(4), iPat: at(4) };
      for (const key in A) g.setAttribute(key, A[key]);
      const im = new THREE.InstancedMesh(g, bodyMat, cap);
      im.customDepthMaterial = bodyDepth; im.frustumCulled = false; im.castShadow = l < 2; im.receiveShadow = l < 2; im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      crowd[v].push({ im, A, n: 0, tris: g.index.count / 3 });
    }
  }
  // stools under the chai drinkers (the sitting clip's hips sit ~.33 m behind the feet)
  const chaiIdx = []; for (let i = 0; i < NMAX; i++) if (D.kind[i] !== 1 && D.cityMode[i] === 0) chaiIdx.push(i);
  const stoolG = mergeGeometries([new THREE.CylinderGeometry(.17, .15, .05, 10).translate(0, .445, 0), new THREE.CylinderGeometry(.13, .16, .42, 8, 1, true).translate(0, .21, 0)]);
  const stools = new THREE.InstancedMesh(stoolG, new THREE.MeshStandardMaterial({ color: '#b8322a', roughness: .6 }), Math.max(1, chaiIdx.length));
  chaiIdx.forEach((i, k) => { const bx = -Math.sin(D.cYaw[i]) * .33, bz = -Math.cos(D.cYaw[i]) * .33; stools.setMatrixAt(k, new THREE.Matrix4().makeTranslation(D.cX[i] + bx, 0, D.cZ[i] + bz)); });
  stools.castShadow = stools.receiveShadow = true; scene.add(stools);
  // long-exposure streaks: one vertical card per trail segment (2 per person), fading along its length
  const trailG = new THREE.BufferGeometry();
  trailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1, 0, 1, -1, 0, 1, 0], 3));
  trailG.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  trailG.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  trailG.setIndex([0, 1, 2, 0, 2, 3]);
  const ramp = new THREE.InstancedBufferAttribute(new Float32Array(NMAX * 4), 2); ramp.setUsage(THREE.DynamicDrawUsage);
  trailG.setAttribute('aRamp', ramp);
  const trailMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide });
  // each card spans its segment (instance z column = segment vector, y column = figure height) and turns around
  // that axis to face the camera: full-height smear side-on, ground smear from above, gone from behind
  trailMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRamp; varying float vTA;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vTA = mix(aRamp.x, aRamp.y, uv.x) * smoothstep(0.0, 0.14, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));')
      .replace('#include <project_vertex>', `
        vec3 tO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 tZ = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
        float tL = length(tZ); vec3 tA = tZ / max(tL, 1e-4);
        float tH = length((instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 tC = tO + vec3(0.0, tH * 0.5, 0.0);
        vec3 tV = normalize(cameraPosition - tC);
        vec3 tN = tV - dot(tV, tA) * tA; float tn = length(tN); tN = tn > 1e-3 ? tN / tn : vec3(0.0, 1.0, 0.0);
        vec3 tB = normalize(cross(tN, tA)); if (tB.y < 0.0) tB = -tB;
        float tE = mix(0.55, tH, abs(tB.y));
        vec3 tW = tC + tA * (-position.z * tL) + tB * ((position.y - 0.5) * tE);
        vec4 mvPosition = viewMatrix * vec4(tW, 1.0);
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTA;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vTA;');
  };
  const trails = new THREE.InstancedMesh(trailG, trailMat, NMAX * 2);
  trails.frustumCulled = false; trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage); trails.renderOrder = 2;
  for (let i = 0; i < NMAX; i++) { const o = i * 15 + (D.vari[i] <= VAR.LEHENGA ? 3 : 0); c.setRGB(D.pal[o], D.pal[o + 1], D.pal[o + 2]); trails.setColorAt(i * 2, c); trails.setColorAt(i * 2 + 1, c); }
  scene.add(trails);
  // torches: about one in six walkers and watchers carries one after dusk and before dawn — a stick in the fist, a flame on top
  D.torchB = new Uint8Array(NMAX); D.torchLit = F();
  for (let i = 0; i < NMAX; i++) { D.torchB[i] = D.kind[i] !== 1 && D.kind[i] !== 2 && D.rnd[i] > .84 ? 1 : 0; D.torchLit[i] = .15 + .6 * ((D.rnd[i] * 13.37) % 1); }
  const NT = 200;
  const sticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.015, .021, .52, 5).translate(0, .14, 0), new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: .9 }), NT);
  sticks.frustumCulled = false; sticks.count = 0; sticks.castShadow = true; sticks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(sticks);
  const tPos = new THREE.BufferAttribute(new Float32Array(NT * 3), 3), tW = new THREE.BufferAttribute(new Float32Array(NT), 1), tPh = new Float32Array(NT);
  tPos.setUsage(THREE.DynamicDrawUsage); tW.setUsage(THREE.DynamicDrawUsage); for (let k = 0; k < NT; k++) tPh[k] = r() * 100;
  const tG = new THREE.BufferGeometry(); tG.setAttribute('position', tPos); tG.setAttribute('aW', tW); tG.setAttribute('aPh', new THREE.BufferAttribute(tPh, 1)); tG.setDrawRange(0, 0);
  const torchU = { uTime: { value: 0 }, uSize: { value: 600 } };
  const flames = new THREE.Points(tG, new THREE.ShaderMaterial({
    uniforms: torchU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPh, aW; uniform float uTime, uSize; varying float vF;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float fl = .74 + .26 * sin(uTime * 11.0 + aPh) * sin(uTime * 6.1 + aPh * 1.7);
        vF = fl * aW; gl_PointSize = uSize * .4 * (.75 + .25 * fl) * aW / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vF; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0, p = q; p.y = p.y * .72 - .1; p.x *= 1.0 + max(p.y, 0.0) * .6; float d = length(p);
        float core = smoothstep(.42, 0.0, d), halo = exp(-d * d * 3.5) * .4 * (1.0 - smoothstep(.6, .98, length(q))), a = (core * 1.6 + halo) * vF; if (a < .003) discard;
        gl_FragColor = vec4(mix(vec3(1.0, .34, .07), vec3(1.0, .7, .32), core) * (1.0 + core) * a, 1.0); }`,
  }));
  flames.frustumCulled = false; scene.add(flames);
  const torch = { sticks, flames, U: torchU, pos: tPos, w: tW, n: 0, NT };
  return { D, crowd, trails, trailMat, bodyMat, stools, stroll, hillToGate, gateToCity, gateDown, chaiTables, torch, beatClock: 0, orb: 0, lit: 0, frustum: new THREE.Frustum(), cam: null };
}

/* ---------- stations ---------- */
const PO = { x: 0, z: 0, face: 0, act: 0, lie: 0, sit: 0, hide: 0, carry: -1 };
const JA = { x: 0, z: 0, face: 0, act: 0, lie: 0, sit: 0, hide: 0 }, JB = { x: 0, z: 0, face: 0, act: 0, lie: 0, sit: 0, hide: 0 }, JJ = { x: 0, z: 0, dx: 0, dz: 1 };
function st(o, x, z, face, act, lie = 0, sit = 0) { o.x = x; o.z = z; o.face = face; o.act = act; o.lie = lie; o.sit = sit; o.hide = 0; return o; }
// orbits run on W.orb (advanced by dt × crowd energy), so moving the energy slider never jumps anyone;
// dancers drift slowly (their feet are dancing, not walking) and face the DJ
const DRIFT_G = .4, DRIFT_E = .3, DRIFT_D = .5;
function sZero(W, i, rt, o) { const D = W.D, th = D.zT[i] - D.zW[i] * W.orb; return st(o, GEO.P.x + Math.cos(th) * D.zR[i], GEO.P.z + Math.sin(th) * D.zR[i], th - Math.PI, A_CIRCLE); }
function sCity(W, i, rt, o) {
  const D = W.D, m = D.cityMode[i];
  if (m === 0) return st(o, D.cX[i], D.cZ[i], D.cYaw[i], A_CHAI, 0, 1);
  if (m === 2) return st(o, D.cX[i] + Math.sin(rt * .2 + i) * .3, D.cZ[i], D.cYaw[i] + Math.sin(rt * .15 + i) * .5, A_STAND);
  const L = W.stroll.len, s = ((D.cS[i] * L + D.cV[i] * rt) % L + L) % L;
  evalJourney(W.stroll.x[0], W.stroll.z[0], W.stroll, W.stroll.x[0], W.stroll.z[0], s / (L + 1e-3), 0, JJ);
  const dir = D.cV[i] > 0 ? 1 : -1;
  return st(o, JJ.x + D.lat[i] * .25, JJ.z + D.lat[i] * .25, Math.atan2(JJ.dx * dir, JJ.dz * dir), A_CIRCLE);
}
function sOrbit(cx, cz, rr, th, act, o) { return st(o, cx + Math.cos(th) * rr, cz + Math.sin(th) * rr, th + Math.PI / 2, act); }
function sG(W, i, rt, o) { const D = W.D, th = D.gT[i] + D.gW[i] * W.orb * DRIFT_G; sOrbit(0, 0, D.gR[i] + Math.sin(rt * .23 + i) * .7, th, A_DG, o); o.face = Math.atan2(-Math.cos(th), -Math.sin(th)) + Math.sin(rt * .6 + i) * .75; return o; }
function sE(W, i, rt, o) { const D = W.D, th = D.eT[i] + D.eW[i] * W.orb * DRIFT_E; sOrbit(GEO.R.x, GEO.R.z, D.eR[i] + Math.sin(rt * .3 + i) * .5, th, A_DE, o); o.face = Math.atan2(-Math.cos(th), -Math.sin(th)) + Math.sin(rt * .8 + i) * .6; return o; }
function sD(W, i, rt, o) { const D = W.D, th = D.dT[i] + D.dW[i] * W.orb * DRIFT_D; sOrbit(0, 0, D.dR[i] + Math.sin(rt * .25 + i) * .5, th, A_DD, o); o.face = Math.PI / 2 + Math.sin(rt * .5 + i) * .7; return o; }
function sFore(W, i, rt, o) { const D = W.D; return st(o, D.foreX[i] + Math.sin(rt * .23 + i) * .4, D.foreZ[i], Math.PI / 2 + Math.sin(rt * .17 + i) * .4, A_WATCH); }
function sMill(W, i, rt, o) { const D = W.D; return st(o, D.millX[i] + Math.sin(rt * .19 + i) * .5, D.millZ[i] + Math.cos(rt * .21 + i) * .5, D.millYaw[i], D.sitter[i] ? A_SIT : A_STAND, 0, D.sitter[i]); }
function sSleep(W, i, rt, o) { const D = W.D; return st(o, D.slX[i], D.slZ[i], D.slYaw[i], D.awake[i] ? A_SIT : A_SLEEP, D.awake[i] ? 0 : 1, D.awake[i]); }
function sEast(W, i, rt, o) { const D = W.D; return st(o, D.eaX[i], D.eaZ[i], Math.PI / 2 + Math.sin(rt * .2 + i) * .25, A_WATCH); }
function sBooth(W, i, rt, o) { return st(o, 0, -.35, 0, A_DJ); }
function sSynth(W, i, rt, o) { return st(o, GEO.SYNTH.x, GEO.SYNTH.z - .75, 0, A_DJ); }
function sDoor(W, i, rt, o) { const D = W.D; return st(o, D.doorX[i], D.doorZ[i], 0, A_STAND); }
const panelSpot = (k, o) => { const a = (k + .5) / NCARRY * TAU; o.x = GEO.P.x + Math.cos(a) * 15.6; o.z = GEO.P.z + Math.sin(a) * 15.6; o.face = a + Math.PI; return o; };
const pickupSpot = (k, o) => { o.x = -41.5 - (k % 3) * 1.3; o.z = (Math.floor(k / 3) - 3.5) * 1.5; o.face = -Math.PI / 2; return o; };
const slotStand = (k, o) => { o.x = -54.5 - (k % 2) * 1.4; o.z = ((k >> 1) - 5.5) * .85; o.face = Math.PI / 2; return o; };
function sPanel(W, i, rt, o) { panelSpot(i - 1, o); return st(o, o.x - Math.cos(o.face) * .9, o.z - Math.sin(o.face) * .9, Math.atan2(Math.cos(o.face), Math.sin(o.face)), A_STAND); }

// journey between two station functions along a route
function jr(W, i, rt, fa, route, fb, u, act, o, latScale) {
  fa(W, i, rt, JA); fb(W, i, rt, JB);
  const uu = u < 0 ? 0 : u > 1 ? 1 : u;
  buildPath(JA.x, JA.z, route, JB.x, JB.z);
  evalPath(uu * uu * (3 - 2 * uu) * .35 + uu * .65, W.D.lat[i] * (latScale !== undefined ? latScale : route ? 1 : .3), JJ);
  return st(o, JJ.x, JJ.z, Math.atan2(JJ.dx, JJ.dz), act);
}
const within = (t, a, b) => t >= a && t < b;

/* ---------- the day of person i at time t (hours) ---------- */
function pose(W, i, t, rt, o) {
  const D = W.D, k = D.kind[i], d = D.d[i], tau = wrap24(t - 15);
  o.carry = -1;
  if (k === 3) { // citizens: city life by day, home at night
    if (tau >= 6.3 && tau < 15.3) { sDoor(W, i, rt, o); o.hide = 1; return o; }
    if (tau >= 6.1 && tau < 6.3) { jr(W, i, rt, sCity, null, sDoor, (tau - 6.1) / .2, A_WALK, o); o.hide = smooth(6.25, 6.3, tau); return o; }
    if (tau >= 15.3 && tau < 15.5) { jr(W, i, rt, sDoor, null, sCity, (tau - 15.3) / .2, A_WALK, o); o.hide = 1 - smooth(15.3, 15.35, tau); return o; }
    if (tau >= 20.9 && D.circler[i] && D.rnd[i] < .5) { if (tau < 21.1) return jr(W, i, rt, sCity, null, sZero, (tau - 20.9) / .2, A_WALK, o); return sZero(W, i, rt, o); }
    return sCity(W, i, rt, o);
  }
  const zeroOrCity = (D.circler[i] || k === 1) ? sZero : sCity;
  if (k === 1) { // carriers
    const kk = i - 1, depC = .08 + .15 * d, arrC = depC + 1.15;
    if (tau < depC) { o.carry = kk; return sPanel(W, i, rt, o); }
    if (tau < arrC) { o.carry = kk; return jr(W, i, rt, sPanel, W.hillToGate, (W_, i_, rt_, oo) => { slotStand(kk, oo); return st(oo, oo.x, oo.z, oo.face, A_WATCH); }, (tau - depC) / 1.15, A_CARRY, o); }
    if (tau < 2.2) { slotStand(kk, o); return st(o, o.x, o.z, Math.PI / 2, A_WATCH); }
    if (tau < 2.32) return jr(W, i, rt, (W_, i_, rt_, oo) => { slotStand(kk, oo); return st(oo, oo.x, oo.z, oo.face, A_WATCH); }, W.gateDown, sFore, (tau - 2.2) / .12, A_WALK, o);
    if (tau >= 18.0 && tau < 23.78 + .08 * d) {
      const dep = 18 + .08 * d, pk = 18.33 + .15 * d, dep2 = pk + .02, arr2 = dep2 + 1.15;
      const pick = (W_, i_, rt_, oo) => { pickupSpot(kk, oo); return st(oo, oo.x, oo.z, oo.face, A_STAND); };
      if (tau < dep) return sD(W, i, rt, o);
      if (tau < dep + .22) return jr(W, i, rt, sD, null, pick, (tau - dep) / .22, A_WALK, o);
      if (tau < dep2) { if (tau > pk - .02) o.carry = kk; return pick(W, i, rt, o); }
      if (tau < arr2) { o.carry = kk; return jr(W, i, rt, pick, W.gateToCity[kk & 1], sPanel, (tau - dep2) / 1.15, A_CARRY, o, .1); }
      if (tau < 19.9) return sPanel(W, i, rt, o);
      if (tau < 20.05) return jr(W, i, rt, sPanel, null, sCity, (tau - 19.9) / .15, A_WALK, o);
      if (tau < 20.9 + .3 * d) return sCity(W, i, rt, o);
      if (tau < 21.05 + .3 * d) return jr(W, i, rt, sCity, null, sZero, (tau - 20.9 - .3 * d) / .15, A_WALK, o);
      return sZero(W, i, rt, o);
    }
    if (tau >= 23.78 + .08 * d) return jr(W, i, rt, sZero, null, sPanel, (tau - 23.78 - .08 * d) / .12, A_WALK, o);
    // else fall through to the common night timeline (forecourt → enter → … → diamond)
  }
  // ---- common timeline ----
  if (k !== 1) {
    const depR = .1 + .6 * d;
    if (tau < depR) return zeroOrCity(W, i, rt, o);
    if (tau < depR + 1.25) return jr(W, i, rt, zeroOrCity, ROUTES.hill, sFore, (tau - depR) / 1.25, A_WALK, o);
  }
  const depE = 3.05 + .9 * d;
  if (tau < depE) return sFore(W, i, rt, o);
  const isDJ = k === 2;
  const millFn = isDJ ? sBooth : sMill;
  if (tau < depE + .42) return jr(W, i, rt, sFore, D.lat[i] < 0 ? ROUTES.stairsUpL : ROUTES.stairsUpR, millFn, (tau - depE) / .42, A_WALK, o, .08);
  const depG = 6.0 + .25 * d;
  if (tau < depG) return millFn(W, i, rt, o);
  const gFn = isDJ ? sBooth : sG;
  if (tau < depG + .12) return jr(W, i, rt, millFn, null, gFn, (tau - depG) / .12, A_WALK, o);
  const depRi = 8.7 + .35 * d;
  if (tau < depRi) return gFn(W, i, rt, o);
  const eFn = isDJ ? sSynth : sE;
  if (tau < depRi + .45) return jr(W, i, rt, gFn, ROUTES.ridge, eFn, (tau - depRi) / .45, A_WALK, o);
  const depS = 12.0 + .3 * d;
  if (tau < depS) return eFn(W, i, rt, o);
  if (isDJ) { if (tau < 15.35 + .25 * d) return sSynth(W, i, rt, o); }
  else {
    if (tau < depS + .12) return jr(W, i, rt, sE, null, sSleep, (tau - depS) / .12, A_WALK, o);
    const wake = 14.75 + .2 * d;
    if (tau < wake) { sSleep(W, i, rt, o); if (!D.awake[i]) { o.lie = smooth(depS + .12, depS + .27, tau); o.act = o.lie > .5 ? A_SLEEP : A_STAND; } return o; }
    if (tau < wake + .1) { sSleep(W, i, rt, o); if (!D.awake[i]) { o.lie = 1 - smooth(wake, wake + .1, tau); o.act = A_STAND; } return o; }
    if (tau < wake + .18) return jr(W, i, rt, sSleep, null, sEast, (tau - wake - .1) / .08, A_WALK, o);
  }
  const depD = 15.35 + .25 * d;
  const dFn = isDJ ? sBooth : sD;
  if (tau < depD) return isDJ ? sSynth(W, i, rt, o) : sEast(W, i, rt, o);
  if (tau < depD + .45) return jr(W, i, rt, isDJ ? sSynth : sEast, ROUTES.ridgeR, dFn, (tau - depD) / .45, A_WALK, o);
  const depX = 18.0 + .6 * d;
  if (tau < depX) return dFn(W, i, rt, o);
  const cityFn = isDJ ? ((W_, i_, rt_, oo) => st(oo, GEO.CHAI.x + 2.2 + .7, GEO.CHAI.z + 1.1, -Math.PI / 2, A_CHAI, 0, 1)) : sCity;
  if (tau < depX + .55) return jr(W, i, rt, dFn, ROUTES.road, cityFn, (tau - depX) / .55, A_WALK, o);
  const depZ = 20.9 + .5 * d;
  if (tau < depZ || !D.circler[i]) return cityFn(W, i, rt, o);
  if (tau < depZ + .15) return jr(W, i, rt, cityFn, null, sZero, (tau - depZ) / .15, A_WALK, o);
  return sZero(W, i, rt, o);
}

/* ---------- panels (the portal's rim) ---------- */
const _pa = V3(), _pb = V3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _sa = V3(), _sb = V3(), _mm = new THREE.Matrix4(), _tmpO = { x: 0, z: 0, face: 0 };
const _basis = new THREE.Matrix4();
function carriedMat(x, y, z, yaw, s, out) {
  // panel local: x radial → up, y tangent → right, z axis → forward
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
  _basis.set(0, rx, fx, 0, 1, 0, 0, 0, 0, rz, fz, 0, 0, 0, 0, 1);
  _basis.scale(_sa.set(s, s, s)); _basis.setPosition(x, y, z); out.copy(_basis); return out;
}
function mixMat(A, B, f, lift, out) {
  A.decompose(_pa, _qa, _sa); B.decompose(_pb, _qb, _sb);
  _pa.lerp(_pb, f); _pa.y += Math.sin(Math.PI * f) * lift; _qa.slerp(_qb, f); _sa.lerp(_sb, f);
  return out.compose(_pa, _qa, _sa);
}
const _MA = new THREE.Matrix4(), _MB = new THREE.Matrix4(), _MC = new THREE.Matrix4();
function panelMatrix(W, gate, kk, t, out) {
  const D = W.D, i = kk + 1, d = D.d[i], tau = wrap24(t - 15);
  const depC = .08 + .15 * d, arrC = depC + 1.15, dep = 18 + .08 * d, pk = 18.33 + .15 * d, arr2 = pk + .02 + 1.15;
  const hands = (m) => carriedMat(D.x[i] + Math.sin(D.yaw[i]) * .34, D.y[i] + 1.13, D.z[i] + Math.cos(D.yaw[i]) * .34, D.yaw[i], .42, m);
  const display = (m) => { panelSpot(kk, _tmpO); return carriedMat(_tmpO.x, .38, _tmpO.z, _tmpO.face + Math.PI, .55, m); };
  const ground = (m) => { pickupSpot(kk, _tmpO); return carriedMat(_tmpO.x, HP + .34, _tmpO.z, -Math.PI / 2, .42, m); };
  const slot = gate.slotMat[kk];
  if (tau < .05) return mixMat(display(_MA), hands(_MB), ease(tau / .05), .2, out);
  if (tau < arrC + .02) return hands(out);
  if (tau < arrC + .3) return mixMat(hands(_MA), slot, easeIO((tau - arrC - .02) / .28), 3, out);
  const rel = 18.0 + .15 * (kk / NCARRY);
  if (tau < rel) return out.copy(slot);
  if (tau < rel + .2) return mixMat(slot, ground(_MA), easeIO((tau - rel) / .2), 2.5, out);
  if (tau < pk) return ground(out);
  if (tau < pk + .03) return mixMat(ground(_MA), hands(_MB), ease((tau - pk) / .03), .3, out);
  if (tau < arr2) return hands(out);
  if (tau < arr2 + .06) return mixMat(hands(_MA), display(_MB), ease((tau - arr2) / .06), .2, out);
  return display(out);
}
function gateCompletion(W, t) {
  const D = W.D, tau = wrap24(t - 15); let n = 0;
  for (let kk = 0; kk < NCARRY; kk++) { const d = D.d[kk + 1], arrC = .08 + .15 * d + 1.15, rel = 18.0 + .15 * (kk / NCARRY); if (tau >= arrC + .3 && tau < rel) n++; }
  return n / NCARRY;
}

/* ---------- per-frame update ---------- */
const _M = new THREE.Matrix4(), _MA2 = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(0, 0, 0, 'YXZ'), _P = V3(), _S = V3(), _AL = new THREE.Matrix4(), _AR = new THREE.Matrix4();
function stepY(x, z) {
  if (Math.abs(z) < STAIR.half && x > STAIR.x0 && x < STAIR.x1) {
    const sd = (STAIR.x1 - STAIR.x0) / 24, k = Math.floor((x - STAIR.x0) / sd) + 1;
    return lerp(FORE_H, HP, clamp(k * sd / (STAIR.x1 - STAIR.x0), 0, 1)) + .03;
  }
  return groundY(x, z) + (x * x + z * z < 10.2 ? .5 : 0);
}
// clip choice per activity. Gaits are picked by ground speed and play at a cadence matched to it (within
// natural limits); dance clips ride the music's beat clock; everything else free-runs with a per-person phase
const CLIP_N = ['idle', 'talk', 'walk', 'walkF', 'jog', 'dance', 'jump', 'spell', 'torch', 'sit', 'sitTalk', 'crouch', 'dj', 'sleep', 'armsUp', 'carryWalk', 'carryIdle', 'sprint', 'carryJog', 'torchWalk', 'torchJog'];
const CI = {}; CLIP_N.forEach((n, k) => { CI[n] = k; });
const CLIPS = CLIP_N.map(n => RIG.clips[n]);
// [reference speed m/s, slowest cadence, fastest cadence]: walks are matched to the planted foot (0.98–1.03 m/s);
// the library's jog and sprint are athletic (5.9 / 8.9 m/s), so they're referenced lower and let the feet slip a little
const GAIT = { walk: [.98, .55, 1.55], walkF: [1.03, .55, 1.5], carryWalk: [.98, .55, 1.45], torchWalk: [.98, .55, 1.5], jog: [4.2, .8, 1.25], carryJog: [4.2, .8, 1.2], torchJog: [4.2, .8, 1.2], sprint: [7.5, .85, 1.3] };
const TORCH = CLIP_N.map(n => n === 'torch' || n === 'torchWalk' || n === 'torchJog');
const GAIT_V = CLIP_N.map(n => GAIT[n] ? GAIT[n][0] : 0), GAIT_LO = CLIP_N.map(n => GAIT[n] ? GAIT[n][1] : 1), GAIT_HI = CLIP_N.map(n => GAIT[n] ? GAIT[n][2] : 1);
const BEATS = CLIP_N.map(n => n === 'dance' ? 2 : n === 'jump' ? 2 : 0);               // beats per cycle (beat-locked)
const BEAT_PH = CLIP_N.map(n => n === 'dance' ? .25 : 0);                              // dance: knees dip on the beat; jump: land on it
const SEATED = CLIP_N.map(n => n === 'sit' || n === 'sitTalk' || n === 'crouch' || n === 'sleep');
const COLLAPSE = CLIP_N.map(n => n === 'sleep' ? 1 : n === 'crouch' ? .6 : n === 'sit' || n === 'sitTalk' ? .45 : 0);
function clipTime(W, i, c, tFree) {
  const C = CLIPS[c], D = W.D;
  if (C.dur <= 0) return 0;
  if (BEATS[c]) {                       // whole-beat offsets split the floor into groups; a little human looseness on top
    const nb = BEATS[c], r = D.rnd[i];
    return (W.beatClock / nb + BEAT_PH[c] + (Math.floor(r * 97) % nb) / nb + ((r * 37.7) % 1 - .5) * .05) * C.dur;
  }
  return tFree;
}
const gaitRate = (c, sp) => GAIT_V[c] > 0 ? clamp(sp / GAIT_V[c], GAIT_LO[c], GAIT_HI[c]) : 0;
// walk ↔ jog ↔ sprint with hysteresis, so nobody flickers between gaits at a threshold
// mode: 0 empty-handed, 1 carrying a panel, 2 carrying a torch
function gaitClip(D, i, sp, mode, formal) {
  const cur = D.clipA[i];
  let band = cur === CI.sprint ? 2 : (cur === CI.jog || cur === CI.carryJog || cur === CI.torchJog) ? 1 : 0;
  if (band === 0 && sp > 1.95) band = 1;
  if (band === 1 && sp < 1.5) band = 0;
  if (band === 1 && sp > 7.2 && mode === 0) band = 2;
  if (band === 2 && sp < 6.3) band = 1;
  if (mode === 1) return band ? CI.carryJog : CI.carryWalk;
  if (mode === 2) return band ? CI.torchJog : CI.torchWalk;
  return band === 2 ? CI.sprint : band === 1 ? CI.jog : formal ? CI.walkF : CI.walk;
}
const clipRow = (c, t) => { const C = CLIPS[c]; if (C.dur <= 0) return C.row; const f = t / C.dur; return C.row + Math.min(C.n - 1, Math.floor((f - Math.floor(f)) * C.n)); };
// crowd energy (0–2) reshapes each dance floor: talkers at the edges when it's low, jumpers and raised hands when
// it's high. Bands are ordered so a change moves the fewest people.
function chooseClip(D, i, act, sp, en, lit) {
  const rnd = D.rnd[i], moving = sp > (GAIT_V[D.clipA[i]] > 0 ? .18 : .32);
  const torch = D.torchB[i] && lit > D.torchLit[i];                 // torch-bearers light up one by one as it gets dark
  if (D.carry[i] >= 0) return moving ? gaitClip(D, i, sp, 1, false) : CI.carryIdle;
  switch (act) {
    case A_WALK: return moving ? gaitClip(D, i, sp, torch ? 2 : 0, false) : torch ? CI.torch : (rnd < .4 ? CI.talk : CI.idle);
    case A_CIRCLE: return moving ? gaitClip(D, i, sp, torch ? 2 : 0, true) : torch ? CI.torch : CI.idle;
    case A_CARRY: return moving ? gaitClip(D, i, sp, 1, false) : CI.carryIdle;
    case A_DG: { // late evening, techno at the booth
      const talk = clamp(.3 - .14 * en, .02, .45), jump = clamp(.03 + .1 * en + .1 * Math.max(0, en - 1), 0, .45), up = clamp((en - 1.1) * .22, 0, .18);
      return rnd < talk ? CI.talk : rnd >= 1 - jump ? CI.jump : rnd >= 1 - jump - up ? CI.armsUp : CI.dance;
    }
    case A_DE: { // midnight peak on the ridge
      const talk = clamp(.3 - .3 * en, 0, .3), spell = .14, jump = clamp(.1 + .32 * en, 0, .7);
      return rnd < talk ? CI.talk : rnd < talk + spell ? CI.spell : rnd >= 1 - jump ? CI.jump : CI.dance;
    }
    case A_DD: { // sunrise: hands up to the sun
      const talk = clamp(.25 - .25 * en, 0, .25), up = clamp(.3 + .5 * en, 0, .9), jump = clamp((en - 1) * .3, 0, .3);
      return rnd < talk ? CI.talk : rnd >= 1 - jump ? CI.jump : rnd >= 1 - jump - up ? CI.armsUp : CI.dance;
    }
    case A_DJ: return CI.dj;
    case A_SLEEP: return CI.sleep;
    case A_SIT: return CI.crouch;
    case A_CHAI: return rnd < .5 ? CI.sit : CI.sitTalk;
    case A_WATCH: return torch ? CI.torch : rnd < .35 ? CI.talk : CI.idle;
    default: return torch ? CI.torch : rnd < .3 ? CI.talk : CI.idle;
  }
}
const _PV = new THREE.Matrix4(), _SPH = new THREE.Sphere();
function updatePeople(W, gate, t, rt, dt, N, beat, energy) {
  const D = W.D, k = Math.min(1, dt * 7), cp = S.camPos;
  W.beatClock = S.beatPos; W.orb += dt * PARAM.energy;
  const cam = W.cam; let useFr = false;
  if (cam) { cam.updateMatrixWorld(); _PV.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); W.frustum.setFromProjectionMatrix(_PV); useFr = true; }
  for (const row of W.crowd) for (const B of row) B.n = 0;
  const T = W.torch; T.n = 0;
  for (let i = 0; i < NMAX; i++) {
    if (i >= N && i > NCARRY) { D.init[i] = 0; D.hide[i] = 1; continue; }
    pose(W, i, t, rt, PO);
    if (!D.init[i]) { D.x[i] = PO.x; D.z[i] = PO.z; D.yaw[i] = PO.face; D.lie[i] = PO.lie; D.sit[i] = PO.sit; D.hide[i] = PO.hide; D.init[i] = 1; }
    const ox = D.x[i], oz = D.z[i];
    let dx = PO.x - ox, dz = PO.z - oz;
    const dist = Math.hypot(dx, dz);
    if (dist > 40) D.tp[i] = 1;                       // big time jump: dissolve out, reappear in place
    let snapped = false;
    if (D.tp[i]) {
      D.hide[i] = Math.min(1, D.hide[i] + dt * 6);
      if (D.hide[i] >= .99) { D.x[i] = PO.x; D.z[i] = PO.z; D.yaw[i] = PO.face; D.lie[i] = PO.lie; D.sit[i] = PO.sit; D.tp[i] = 0; snapped = true; }
    } else { D.x[i] += dx * k; D.z[i] += dz * k; }
    const moved = snapped ? 0 : Math.hypot(D.x[i] - ox, D.z[i] - oz);
    D.spd[i] = lerp(D.spd[i], moved / Math.max(dt, 1e-3), Math.min(1, dt * 6));
    let face = PO.face;
    if ((PO.act === A_WALK || PO.act === A_CARRY || PO.act === A_CIRCLE) && moved > 1e-3) face = Math.atan2(D.x[i] - ox, D.z[i] - oz);
    let dy = face - D.yaw[i]; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); D.yaw[i] += dy * Math.min(1, dt * 5);
    D.lie[i] += (PO.lie - D.lie[i]) * Math.min(1, dt * 4); D.sit[i] += (PO.sit - D.sit[i]) * Math.min(1, dt * 4); if (!D.tp[i]) D.hide[i] += (PO.hide - D.hide[i]) * Math.min(1, dt * 5);
    D.act[i] = PO.act; D.carry[i] = PO.carry;
    // animation: pick the clip, crossfade from the previous one, advance both
    const sp = D.spd[i];
    const want = chooseClip(D, i, PO.act, sp, PARAM.energy, W.lit);
    if (!D.init2 || D.init2[i] !== 1 || snapped) { if (!D.init2) D.init2 = new Uint8Array(NMAX); D.init2[i] = 1; D.clipA[i] = want; D.tA[i] = D.rnd[i] * 7.3; D.fadeB[i] = 0; }
    else if (want !== D.clipA[i]) {
      // a gait change keeps the stride phase, so feet don't jump; anything else starts at its own phase
      const keep = GAIT_V[want] > 0 && GAIT_V[D.clipA[i]] > 0 ? D.tA[i] / CLIPS[D.clipA[i]].dur * CLIPS[want].dur : D.rnd[i] * 7.3;
      D.clipB[i] = D.clipA[i]; D.tB[i] = D.tA[i]; D.fadeB[i] = 1; D.clipA[i] = want; D.tA[i] = keep;
    }
    const free = (.9 + .2 * D.rnd[i]) * (want === CI.armsUp || want === CI.dj || want === CI.spell ? energy : 1);
    D.tA[i] += dt * (GAIT_V[want] > 0 ? gaitRate(want, sp) : free);
    D.tB[i] += dt * (GAIT_V[D.clipB[i]] > 0 ? gaitRate(D.clipB[i], sp) : free);
    D.fadeB[i] = Math.max(0, D.fadeB[i] - dt / (D.clipA[i] === CI.sleep || D.clipB[i] === CI.sleep ? .9 : .4));
    const seatT = SEATED[D.clipA[i]] ? 1 : 0; D.seat[i] = snapped ? seatT : D.seat[i] + (seatT - D.seat[i]) * Math.min(1, dt * 5);
    D.bounce[i] = 0;
    // matrices
    const y = stepY(D.x[i], D.z[i]);
    D.y[i] = y;
    const cd = Math.hypot(D.x[i] - cp.x, y + 1 - cp.y, D.z[i] - cp.z);
    D.cfade[i] = smooth(1.1, 2.4, cd);
    const v = D.vari[i], hs = D.h[i] * (1 - D.hide[i]) * D.cfade[i] * (varFem(v) ? .95 : 1);
    if (hs < .002) continue;
    if (useFr && !W.frustum.intersectsSphere(_SPH.set(_P.set(D.x[i], y + .9, D.z[i]), 3))) continue;
    // level of detail with a little hysteresis
    let lod = D.lod[i];
    if (cd < (lod === 0 ? 22 : 19)) lod = 0; else if (cd < (lod === 2 ? 52 : 57)) lod = 1; else lod = 2;
    D.lod[i] = lod;
    const B = W.crowd[v][lod], s = B.n++, A = B.A;
    _E.set(0, D.yaw[i], 0, 'YXZ'); _Q.setFromEuler(_E);
    _P.set(D.x[i], y, D.z[i]); _S.set(hs, hs, hs);
    _M.compose(_P, _Q, _S); B.im.setMatrixAt(s, _M);
    const cA = D.clipA[i], cB = D.clipB[i], fb = D.fadeB[i];
    const rowA = clipRow(cA, clipTime(W, i, cA, D.tA[i])), rowB = fb > 0 ? clipRow(cB, clipTime(W, i, cB, D.tB[i])) : 0;
    A.iAnim.setXYZW(s, rowA, rowB, fb, D.seat[i]);
    // a torch in the left fist (grows out of the hand as the pose fades in)
    const tw = (TORCH[cA] ? 1 - fb : 0) + (fb > 0 && TORCH[cB] ? fb : 0);
    if (tw > .02 && T.n < T.NT) {
      const g = RIG.grip, gr = (TORCH[cA] ? rowA : rowB) * 3, gx = g[gr] * hs, gy = g[gr + 1] * hs, gz = g[gr + 2] * hs;
      const cy = Math.cos(D.yaw[i]), sy = Math.sin(D.yaw[i]), wx = D.x[i] + gx * cy + gz * sy, wy = y + gy, wz = D.z[i] - gx * sy + gz * cy;
      _P.set(wx, wy, wz); _S.set(tw, tw, tw); _MA2.compose(_P, _Q.identity(), _S); T.sticks.setMatrixAt(T.n, _MA2);
      T.pos.setXYZ(T.n, wx, wy + .44 * tw, wz); T.w.setX(T.n, tw * (.8 + .4 * D.rnd[i])); T.n++;
    }
    const o = i * 15, P_ = D.pal;
    A.iC0.setXYZW(s, P_[o], P_[o + 1], P_[o + 2], P_[o + 9]); A.iC1.setXYZW(s, P_[o + 3], P_[o + 4], P_[o + 5], P_[o + 10]);
    A.iC2.setXYZW(s, P_[o + 6], P_[o + 7], P_[o + 8], P_[o + 11]); A.iHair.setXYZW(s, P_[o + 12], P_[o + 13], P_[o + 14], D.seat[i] * COLLAPSE[D.clipA[i]]);
    { const q = i * 4; A.iPat.setXYZW(s, D.pat[q], D.pat[q + 1], D.pat[q + 2], D.pat[q + 3]); }
  }
  for (const row of W.crowd) for (const B of row) {
    B.im.count = B.n;
    if (B.n) { B.im.instanceMatrix.needsUpdate = true; for (const key in B.A) B.A[key].needsUpdate = true; }
  }
  T.sticks.count = T.n; T.flames.geometry.setDrawRange(0, T.n);
  if (T.n) { T.sticks.instanceMatrix.needsUpdate = true; T.pos.needsUpdate = true; T.w.needsUpdate = true; }
  // history for ghost trails (fixed 30 Hz sampling)
  D.histAcc += dt;
  while (D.histAcc >= HIST_DT) {
    D.histAcc -= HIST_DT; D.histHead = (D.histHead + 1) % HIST;
    const base = D.histHead * 4;
    for (let i = 0; i < NMAX; i++) { const o = i * HIST * 4 + base; D.hist[o] = D.x[i]; D.hist[o + 1] = D.y[i] + D.bounce[i]; D.hist[o + 2] = D.z[i]; D.hist[o + 3] = D.yaw[i]; }
  }
  // panels
  for (let kk = 0; kk < NCARRY; kk++) { panelMatrix(W, gate, kk, t, _M); gate.panelIM.setMatrixAt(kk, _M); }
  gate.panelIM.instanceMatrix.needsUpdate = true;
}
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const _TM = new THREE.Matrix4(), _TP = V3(), _TS = V3(), _TQ = new THREE.Quaternion(), _TY = V3(0, 1, 0);
function updateTrails(W, N, trailSec, opacity) {
  const D = W.D, im = W.trails, ramp = im.geometry.attributes.aRamp;
  im.visible = opacity > .01; W.trailMat.opacity = Math.min(.95, opacity);
  if (!im.visible) return;
  const dA = Math.max(1, Math.round(trailSec * .5 / HIST_DT)), dB = Math.max(2, Math.round(trailSec / HIST_DT));
  const iA = ((D.histHead - Math.min(dA, HIST - 1)) % HIST + HIST) % HIST * 4, iB = ((D.histHead - Math.min(dB, HIST - 1)) % HIST + HIST) % HIST * 4;
  for (let i = 0; i < N; i++) {
    const j = i * 2;
    if (D.hide[i] > .5 || D.lie[i] > .5 || D.cfade[i] < .9) { im.setMatrixAt(j, ZERO_M); im.setMatrixAt(j + 1, ZERO_M); continue; }
    const o = i * HIST * 4, x0 = D.x[i], y0 = D.y[i] + D.bounce[i], z0 = D.z[i];
    const x1 = D.hist[o + iA], y1 = D.hist[o + iA + 1], z1 = D.hist[o + iA + 2];
    const x2 = D.hist[o + iB], y2 = D.hist[o + iB + 1], z2 = D.hist[o + iB + 2];
    const l1 = Math.hypot(x1 - x0, z1 - z0), l2 = Math.hypot(x2 - x1, z2 - z1);
    const hgt = 1.78 * D.h[i] * (1 - D.sit[i] * .3);
    if (l1 < .05 || l1 > 25) { im.setMatrixAt(j, ZERO_M); } else {
      _TM.set(1, 0, -(x1 - x0), x0, 0, hgt, -(y1 - y0), y0, 0, 0, -(z1 - z0), z0, 0, 0, 0, 1); im.setMatrixAt(j, _TM);
    }
    if (l2 < .05 || l2 > 25 || l1 < .05) { im.setMatrixAt(j + 1, ZERO_M); } else {
      _TM.set(1, 0, -(x2 - x1), x1, 0, hgt, -(y2 - y1), y1, 0, 0, -(z2 - z1), z1, 0, 0, 0, 1); im.setMatrixAt(j + 1, _TM);
    }
    ramp.setXY(j, .85, .42); ramp.setXY(j + 1, .42, 0);
  }
  im.count = N * 2; im.instanceMatrix.needsUpdate = true; ramp.needsUpdate = true;
}
function updateAutos(city, t, rt) {
  const A = city.autos, L = A.autoRoute.len, tau = wrap24(t - 15);
  const running = !(tau > 9.9 && tau < 14.9);
  for (let k = 0; k < A.NA; k++) {
    if (k === A.NA - 1) { _P.set(A.parked.x, 0, A.parked.z); _Q.setFromAxisAngle(_S.set(0, 1, 0), A.parked.yaw); _M.compose(_P, _Q, _S.set(1, 1, 1)); A.autoIM.setMatrixAt(k, _M); continue; }
    if (!running) { A.autoIM.setMatrixAt(k, ZERO_M); continue; }
    const s = ((k / (A.NA - 1)) * L + rt * (6.5 + (k % 3))) % L;
    evalJourney(A.autoRoute.x[0], A.autoRoute.z[0], A.autoRoute, A.autoRoute.x[0], A.autoRoute.z[0], s / L, 0, JJ);
    _P.set(JJ.x, .02, JJ.z); _Q.setFromAxisAngle(_S.set(0, 1, 0), Math.atan2(JJ.dx, JJ.dz)); _M.compose(_P, _Q, _S.set(1, 1, 1));
    A.autoIM.setMatrixAt(k, _M);
  }
  A.autoIM.instanceMatrix.needsUpdate = true;
}
