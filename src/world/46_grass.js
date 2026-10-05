/* =========================================================================
   GRASS — ~33k blades in a window that travels with the camera. Every blade
   is placed on the GPU from its instance number: terrain height and a grass
   density map come from one small float texture, so moving costs nothing
   ========================================================================= */
function buildGrass(scene, Q) {
  if (!Q.grass) return null;
  const n = TER.seg + 1, data = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -TER.size / 2 + i * TER.step, z = -TER.size / 2 + j * TER.step, k = j * n + i, h = TER.h[k];
    // slope from the height grid
    const hx = TER.h[j * n + Math.min(n - 1, i + 1)] - TER.h[j * n + Math.max(0, i - 1)], hz = TER.h[Math.min(n - 1, j + 1) * n + i] - TER.h[Math.max(0, j - 1) * n + i];
    const slope = Math.hypot(hx, hz) / (2 * TER.step);
    let d = .35 + .65 * fbm(x * .045 + 5, z * .045 + 9, 3);                 // meadows and bare patches
    d *= 1 - smooth(.55, .95, slope);                                      // not on rock faces
    d *= 1 - smooth(26, 40, h);                                            // thins out up the far hills
    const dC = Math.hypot(x, z), dR = Math.hypot(x - GEO.R.x, z - GEO.R.z);
    d *= smooth(46, 49, dC);                                               // the clearing is flagstones
    d *= .35 + .65 * smooth(15, 21, dR);                                   // sparse among the ridge stones
    const dp = Math.min(distToRoute(x, z, ROUTES.hill), distToRoute(x, z, ROUTES.ridge), distToRoute(x, z, ROUTES.road));
    d *= smooth(1.4, 3.2, dp);                                             // trodden paths
    d *= 1 - (smooth(82, 90, z) * (1 - smooth(100, 112, Math.abs(x - GEO.P.x))) * (1 - smooth(176, 184, z)));   // city
    d *= 1 - (1 - smooth(11, 16, Math.abs(z))) * smooth(-114, -108, x) * (1 - smooth(-45, -40, x));            // forecourt, steps, gate
    data[k * 2] = h; data[k * 2 + 1] = clamp(d, 0, 1);
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const GN = Q.grass, STEP = .34, HALF = GN * STEP / 2;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, -.36, .45, 0, .36, .45, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); g.instanceCount = GN * GN;
  g.boundingSphere = new THREE.Sphere(V3(), 1e6);
  const U = { uGrass: { value: tex }, uOrigin: { value: new THREE.Vector2() }, uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 }, uFadeR: { value: HALF } };
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform sampler2D uGrass; uniform vec2 uOrigin, uCenter; uniform float uTime, uFadeR; varying vec3 vGC;
      float gh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh1(i), gh1(i + vec2(1, 0)), f.x), mix(gh1(i + vec2(0, 1)), gh1(i + vec2(1, 1)), f.x), f.y); }
      vec2 gTer(vec2 xz){ vec2 f = (xz + ${(TER.size / 2).toFixed(1)}) / ${TER.step.toFixed(4)}; vec2 i = floor(f), u = f - i; ivec2 c = ivec2(clamp(i, 0.0, ${(TER.seg - 1).toFixed(1)}));
        vec2 a = texelFetch(uGrass, c, 0).rg, b = texelFetch(uGrass, c + ivec2(1, 0), 0).rg, d = texelFetch(uGrass, c + ivec2(0, 1), 0).rg, e = texelFetch(uGrass, c + ivec2(1, 1), 0).rg;
        vec2 r = (u.x + u.y < 1.0) ? a + (b - a) * u.x + (d - a) * u.y : e + (d - e) * (1.0 - u.x) + (b - e) * (1.0 - u.y);
        return vec2(r.x, mix(mix(a.y, b.y, u.x), mix(d.y, e.y, u.x), u.y)); }`)
      .replace('#include <beginnormal_vertex>', `
      int gid = gl_InstanceID; vec2 gcell = vec2(float(gid % ${GN}), float(gid / ${GN}));
      vec2 gabs = floor(uOrigin / ${STEP.toFixed(3)}) + gcell;                  // absolute cell: blades stay put as the window moves
      float gr1 = gh1(gabs), gr2 = gh1(gabs + 17.3), gr3 = gh1(gabs + 41.9);
      vec2 gxz = (gabs + vec2(gr1, gr2)) * ${STEP.toFixed(3)};
      vec2 gt = gTer(gxz);
      float gE = max(abs(gxz.x - uCenter.x), abs(gxz.y - uCenter.y));
      float gKeep = step(gr3, gt.y) * (1.0 - smoothstep(uFadeR * .72, uFadeR * .98, gE));
      float gYaw = gr1 * 6.2832; vec2 gR = vec2(cos(gYaw), sin(gYaw)), gF = vec2(-gR.y, gR.x);
      float gH = (.22 + .38 * gr2) * (.55 + .7 * gt.y) * gKeep, gW = (.045 + .04 * gr3) * gKeep;
      vec3 objectNormal = normalize(vec3(gF.x * .35, 1.0, gF.y * .35));
#ifdef USE_TANGENT
      vec3 objectTangent = vec3(1.0, 0.0, 0.0);
#endif`)
      .replace('#include <begin_vertex>', `
      float gv = position.y, gBend = (.25 + .35 * gr3) * gv * gv;
      float gWind = sin(uTime * 1.7 + gxz.x * .35 + gxz.y * .22) * .5 + sin(uTime * 3.1 + gxz.x * .9) * .2;
      vec3 transformed = vec3(gxz.x, gt.x - .04, gxz.y) + vec3(gR.x, 0.0, gR.y) * position.x * gW
        + vec3(0.0, gv * gH, 0.0) + vec3(gF.x, 0.0, gF.y) * gBend * gH + vec3(.6, 0.0, .35) * gWind * gv * gv * gH * .35;
      // green where it holds water, straw where it doesn't (patches tens of metres across), dark at the root, sunlit at the tip
      float gDry = smoothstep(.38, .72, gvn(gxz * .045) * .7 + gvn(gxz * .17) * .3);
      vec3 gGreen = mix(vec3(.024, .032, .012), vec3(.07, .088, .028), gr2 * .5 + gv * .6);
      vec3 gStraw = mix(vec3(.04, .033, .016), vec3(.125, .1, .048), gr2 * .45 + gv * .6);
      vGC = mix(gGreen, gStraw, gDry * .9) * mix(.55, 1.0, gv) * (.78 + .44 * gh1(floor(gabs / 4.0)));
      // seed heads in the dry grass; a few wildflowers (yellow, white, purple) standing a little taller
      float gTip = step(.9, gv), gFl = step(.986, gh1(gabs + 73.1));
      vGC = mix(vGC, vec3(.15, .125, .07), gTip * step(.72, gr3) * gDry);
      vec3 gFC = gr1 < .5 ? vec3(.24, .17, .02) : gr1 < .8 ? vec3(.22, .21, .19) : vec3(.1, .05, .16);
      vGC = mix(vGC, gFC, gTip * gFl);
      transformed.y += gTip * gFl * .1 * gKeep;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vGC;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');   // both faces lit like the ground
  };
  mat.customProgramCacheKey = () => 'grass';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
  scene.add(mesh);
  const fwd = V3();
  // follow the camera: centre the window a little ahead of the lens, hide it when flying high
  function update(cam, rt) {
    U.uTime.value = rt;
    cam.getWorldDirection(fwd); const f = Math.hypot(fwd.x, fwd.z) || 1;
    const cx = cam.position.x + fwd.x / f * HALF * .55, cz = cam.position.z + fwd.z / f * HALF * .55;
    U.uCenter.value.set(cx, cz); U.uOrigin.value.set(cx - HALF, cz - HALF);
    mesh.visible = PARAM.quality !== 'low' && cam.position.y - groundY(cam.position.x, cam.position.z) < 30;
  }
  return { mesh, U, update };
}
