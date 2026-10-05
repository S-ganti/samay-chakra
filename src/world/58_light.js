/* =========================================================================
   LIGHT — physical atmosphere (sky-view LUT + sun colour), height fog with
   sun in-scattering, sky-driven ambient (PMREM environment), light pools
   ========================================================================= */

/* ---------- atmosphere: Rayleigh + Mie + ozone single scattering, units km ---------- */
const ATM = { RG: 6360, RT: 6460, H0: .25, BR: [5.802e-3, 13.558e-3, 33.1e-3], BO: [.65e-3, 1.881e-3, .085e-3], BMS: 3.996e-3, BME: 4.4e-3, G: .78 };
const LUT_W = 128, LUT_H = 64;
const ATM_GLSL = `
const float A_RG = 6360.0, A_RT = 6460.0, A_PI = 3.14159265;
const vec3 A_BR = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const vec3 A_BO = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float A_BMS = 3.996e-3, A_BME = 4.40e-3, A_G = 0.78;
uniform float uMie, uMS;
vec3 aExt(float h, out vec3 sR, out float sM){
  float dm = exp(-h / 1.2) * uMie;
  sR = A_BR * exp(-h / 8.0); sM = A_BMS * dm;
  return sR + vec3(A_BME * dm) + A_BO * max(0.0, 1.0 - abs(h - 25.0) / 15.0);
}
float aTop(vec3 o, vec3 d){ float b = dot(o, d), c = dot(o, o) - A_RT * A_RT; return -b + sqrt(max(b * b - c, 0.0)); }
float aGround(vec3 o, vec3 d){ float b = dot(o, d), c = dot(o, o) - A_RG * A_RG, q = b * b - c; if (q < 0.0 || b > 0.0) return -1.0; return -b - sqrt(q); }
vec3 aSunT(vec3 p, vec3 s){
  if (aGround(p, s) > 0.0) return vec3(0.0);
  float tt = aTop(p, s); vec3 od = vec3(0.0), sR; float sM;
  for (int i = 0; i < 6; i++) {
    float f0 = float(i) / 6.0, f1 = float(i + 1) / 6.0, t0 = tt * f0 * f0, t1 = tt * f1 * f1;
    vec3 q = p + s * (0.5 * (t0 + t1)); od += aExt(length(q) - A_RG, sR, sM) * (t1 - t0);
  }
  return exp(-od);
}
vec3 aSky(vec3 dir, vec3 s){
  vec3 o = vec3(0.0, A_RG + ${ATM.H0.toFixed(3)}, 0.0);
  float tg = aGround(o, dir), tm = tg > 0.0 ? tg : aTop(o, dir);
  float mu = dot(dir, s), pR = 3.0 / (16.0 * A_PI) * (1.0 + mu * mu);
  float pM = 3.0 / (8.0 * A_PI) * ((1.0 - A_G * A_G) * (1.0 + mu * mu)) / ((2.0 + A_G * A_G) * pow(1.0 + A_G * A_G - 2.0 * A_G * mu, 1.5));
  vec3 L = vec3(0.0), T = vec3(1.0), sR; float sM;
  for (int i = 0; i < 24; i++) {
    float f0 = float(i) / 24.0, f1 = float(i + 1) / 24.0, t0 = tm * f0 * f0, t1 = tm * f1 * f1, dt = t1 - t0;
    vec3 p = o + dir * (0.5 * (t0 + t1)); float h = max(length(p) - A_RG, 0.0);
    vec3 ext = aExt(h, sR, sM), Ts = aSunT(p, s);
    vec3 sc = Ts * (sR * pR + sM * pM + (sR + sM) * uMS * (0.25 / A_PI));
    vec3 sT = exp(-ext * dt);
    L += T * sc * (1.0 - sT) / max(ext, vec3(1e-9)); T *= sT;
  }
  return L;
}`;
// LUT parameterisation (shared by the LUT writer and the sky reader): u = azimuth from the sun 0..PI,
// v = elevation with a square-root warp that spends texels near the horizon
const LUT_READ_GLSL = `
vec3 physSky(sampler2D lut, vec3 d, vec3 sun){
  vec2 sxz = sun.xz; float sl = length(sxz); vec2 sn = sl > 1e-4 ? sxz / sl : vec2(1.0, 0.0);
  vec2 dxz = d.xz; float dl = length(dxz); vec2 dn = dl > 1e-4 ? dxz / dl : sn;
  float tu = acos(clamp(dot(dn, sn), -1.0, 1.0)) / 3.14159265;
  float el = asin(clamp(d.y, -1.0, 1.0));
  float tv = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / 1.5707963);
  return texture2D(lut, vec2((tu * ${LUT_W - 1}.0 + 0.5) / ${LUT_W}.0, (tv * ${LUT_H - 1}.0 + 0.5) / ${LUT_H}.0)).rgb;
}`;

// soft knee on the physical sky: keeps the (physically very bright) horizon and sun glow from washing the frame out
const PHYS_KNEE = .5, PHYS_RANGE = 1.0;
const PHYS_MAP_GLSL = `vec3 physMap(vec3 p){ float l = dot(p, vec3(0.2126, 0.7152, 0.0722)); if (l > ${PHYS_KNEE.toFixed(2)}) { float e = l - ${PHYS_KNEE.toFixed(2)}; p *= (${PHYS_KNEE.toFixed(2)} + e / (1.0 + e / ${PHYS_RANGE.toFixed(2)})) / l; } return p; }`;
function physMapC(c) { const l = c.r * .2126 + c.g * .7152 + c.b * .0722; if (l > PHYS_KNEE) { const e = l - PHYS_KNEE; c.multiplyScalar((PHYS_KNEE + e / (1 + e / PHYS_RANGE)) / l); } return c; }
// JS mirror (coarse) for light colours: sun transmittance at the viewer, a few horizon samples for fog
const _aE = [0, 0, 0], _aS = [0, 0, 0, 0];
function aExtJ(h, mie) {
  const dr = Math.exp(-h / 8), dm = Math.exp(-h / 1.2) * mie, dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
  for (let c = 0; c < 3; c++) { _aS[c] = ATM.BR[c] * dr; _aE[c] = _aS[c] + ATM.BME * dm + ATM.BO[c] * dO; }
  _aS[3] = ATM.BMS * dm;
}
function aTopJ(ox, oy, oz, dx, dy, dz) { const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - ATM.RT * ATM.RT; return -b + Math.sqrt(Math.max(b * b - c, 0)); }
function aGroundJ(ox, oy, oz, dx, dy, dz) { const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - ATM.RG * ATM.RG, q = b * b - c; if (q < 0 || b > 0) return -1; return -b - Math.sqrt(q); }
function atmSunT(px, py, pz, s, mie, out, N = 8) {
  if (aGroundJ(px, py, pz, s.x, s.y, s.z) > 0) { out[0] = out[1] = out[2] = 0; return out; }
  const tt = aTopJ(px, py, pz, s.x, s.y, s.z); let o0 = 0, o1 = 0, o2 = 0;
  for (let i = 0; i < N; i++) {
    const f0 = i / N, f1 = (i + 1) / N, t0 = tt * f0 * f0, t1 = tt * f1 * f1, tm = .5 * (t0 + t1);
    const qx = px + s.x * tm, qy = py + s.y * tm, qz = pz + s.z * tm;
    aExtJ(Math.hypot(qx, qy, qz) - ATM.RG, mie); const dt = t1 - t0;
    o0 += _aE[0] * dt; o1 += _aE[1] * dt; o2 += _aE[2] * dt;
  }
  out[0] = Math.exp(-o0); out[1] = Math.exp(-o1); out[2] = Math.exp(-o2); return out;
}
const _aT = [0, 0, 0];
function atmSky(dx, dy, dz, s, mie, ms, out, N = 16) {
  const oy = ATM.RG + ATM.H0, tg = aGroundJ(0, oy, 0, dx, dy, dz), tm = tg > 0 ? tg : aTopJ(0, oy, 0, dx, dy, dz);
  const mu = dx * s.x + dy * s.y + dz * s.z, g = ATM.G, pR = 3 / (16 * Math.PI) * (1 + mu * mu);
  const pM = 3 / (8 * Math.PI) * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  let L0 = 0, L1 = 0, L2 = 0, T0 = 1, T1 = 1, T2 = 1;
  for (let i = 0; i < N; i++) {
    const f0 = i / N, f1 = (i + 1) / N, t0 = tm * f0 * f0, t1 = tm * f1 * f1, dt = t1 - t0, t = .5 * (t0 + t1);
    const px = dx * t, py = oy + dy * t, pz = dz * t;
    atmSunT(px, py, pz, s, mie, _aT, 4);
    aExtJ(Math.max(Math.hypot(px, py, pz) - ATM.RG, 0), mie);
    const e = _aE, sR = _aS, sM = _aS[3], k = ms * .25 / Math.PI;
    for (let c = 0; c < 3; c++) {
      const sc = _aT[c] * (sR[c] * pR + sM * pM + (sR[c] + sM) * k), st = Math.exp(-e[c] * dt), tr = c === 0 ? T0 : c === 1 ? T1 : T2;
      const add = tr * sc * (1 - st) / Math.max(e[c], 1e-9);
      if (c === 0) { L0 += add; T0 *= st; } else if (c === 1) { L1 += add; T1 *= st; } else { L2 += add; T2 *= st; }
    }
  }
  out[0] = L0; out[1] = L1; out[2] = L2; return out;
}

/* ---------- height fog: exponential in altitude + uniform haze, lit by the sun/moon ---------- */
// replaces three's FogExp2 chunks for every material with fog (terrain, buildings, people, sprites...)
const HFOG = {
  hfP: { value: new THREE.Vector4(1 / 16, 0, .0015, .5) },   // x: 1/scale height, y: base altitude, z: uniform haze density, w: in-scatter
  hfQ: { value: new THREE.Vector4(8, 2.5, 0, 0) },           // x: clear distance in front of the camera, y: density cap
  hfSunCol: { value: col('#ffffff') }, hfSunDir: { value: V3(0, 1, 0) },
};
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vFogRay;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogRay = transpose(mat3(viewMatrix)) * mvPosition.xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying vec3 vFogRay;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  uniform vec4 hfP, hfQ; uniform vec3 hfSunCol; uniform vec3 hfSunDir;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  {
    float fL = length(vFogRay); vec3 fV = vFogRay / max(fL, 1e-4);
    float fk = hfP.x, fy0 = cameraPosition.y - hfP.y, fdy = fk * vFogRay.y;
    float fI = abs(fdy) > 1e-3 ? (exp(-fk * fy0) - exp(-fk * (fy0 + vFogRay.y))) * fL / fdy : fL * exp(-fk * fy0);
    float fRel = min(fI / max(fL, 1e-4), hfQ.y);          // mean density along the ray vs the base altitude (capped)
    float fD = max(fL - hfQ.x, 0.0);                        // a clear zone in front of the camera
    #ifdef FOG_EXP2
      float fOD = pow(fogDensity * fRel * fD, 2.0) + hfP.z * fD;
    #else
      float fOD = hfP.z * fD;
    #endif
    vec3 fC = mix(fogColor, hfSunCol, pow(max(dot(fV, hfSunDir), 0.0), 6.0) * hfP.w);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fC, 1.0 - exp(-fOD));
  }
#endif`;
// share the extra fog uniforms with every fogged material (keeps each material's own program key)
function chainHook(m, tag, fn) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); fn(sh, r); };
  m.customProgramCacheKey = () => key + '|' + tag;
}
function injectFog(scene) {
  const seen = new Set();
  scene.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { if (!m || seen.has(m) || !m.fog) continue; seen.add(m); chainHook(m, 'hf', (sh) => Object.assign(sh.uniforms, HFOG)); }
  });
}

/* ---------- light pools: lamps light the ground they stand on ---------- */
const POOL = { x0: -128, z0: -96, size: 256, res: 1024 };
function buildPoolTex(diyaPts, lampPts) {
  const c = document.createElement('canvas'); c.width = c.height = POOL.res;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, POOL.res, POOL.res); g.globalCompositeOperation = 'lighter';
  const k = POOL.res / POOL.size;
  const blob = (x, z, r, a, ch, prof) => {
    const px = (x - POOL.x0) * k, pz = (z - POOL.z0) * k, R = r * k;
    const gr = g.createRadialGradient(px, pz, 0, px, pz, R);
    prof.forEach(([t, v]) => gr.addColorStop(t, `rgba(${ch === 0 ? 255 : 0},${ch === 1 ? 255 : 0},${ch === 2 ? 255 : 0},${(v * a).toFixed(3)})`));
    g.fillStyle = gr; g.fillRect(px - R, pz - R, R * 2, R * 2);
  };
  // a lamp at height h lights the ground as h / (h^2 + d^2)^1.5: sample that profile into gradient stops
  // stored as sqrt (squared back in the shader) so faint tails keep their precision in 8 bits
  const prof = (h, r) => { const s = []; for (let i = 0; i <= 10; i++) { const t = i / 10, d = t * r; s.push([t, Math.sqrt(Math.pow(h * h / (h * h + d * d), 1.5) * (1 - t * t))]); } return s; };
  const pD = prof(.8, 3.2), pL = prof(6.5, 16), pS = prof(1.2, 5);
  for (const [x, y, z] of diyaPts) blob(x, z, 3.2, .6, 0, pD);
  for (let i = 0; i < lampPts.length; i += 3) blob(lampPts[i], lampPts[i + 2], 16, .8, 1, pL);
  // the stage strips: a ring of light hugging the wall inside and out
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; for (const r of [11.4, 14.6]) blob(Math.cos(a) * r, Math.sin(a) * r, 5, .32, 2, pS); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
const POOLU = {
  uPool: { value: null }, uPoolR: { value: new THREE.Vector4(POOL.x0, POOL.z0, 1 / POOL.size, 1 / POOL.size) },
  uPoolA: { value: col('#000') }, uPoolB: { value: col('#000') }, uPoolC: { value: col('#000') },
};
function addPools(m) {
  chainHook(m, 'pool', (sh) => {
    Object.assign(sh.uniforms, POOLU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPoolUv; uniform vec4 uPoolR;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 pw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pw = instanceMatrix * pw;
          #endif
          pw = modelMatrix * pw; vPoolUv = (pw.xz - uPoolR.xy) * uPoolR.zw; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPoolUv; uniform sampler2D uPool; uniform vec3 uPoolA, uPoolB, uPoolC;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 pl = texture2D(uPool, vPoolUv).rgb; pl *= pl;
          reflectedLight.directDiffuse += (pl.r * uPoolA + pl.g * uPoolB + pl.b * uPoolC) * BRDF_Lambert(material.diffuseColor); }`);
  });
}

/* ---------- build: LUT target, environment probe, pools ---------- */
function buildLight(renderer, scene, SK, ST, CT, TR, Q) {
  const lutRT = new THREE.WebGLRenderTarget(LUT_W, LUT_H, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
  lutRT.texture.wrapS = lutRT.texture.wrapT = THREE.ClampToEdgeWrapping;
  const lutU = { uSun: { value: V3(1, 0, 0) }, uMie: { value: 1 }, uMS: { value: 1 } };
  const lutQ = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: lutU, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${ATM_GLSL}
      uniform vec3 uSun; varying vec2 vUv;
      void main(){
        float az = (vUv.x * ${LUT_W}.0 - 0.5) / ${LUT_W - 1}.0 * A_PI;
        float v = (vUv.y * ${LUT_H}.0 - 0.5) / ${LUT_H - 1}.0 * 2.0 - 1.0;
        float el = sign(v) * v * v * 1.5707963;
        float se = asin(clamp(uSun.y, -1.0, 1.0));
        vec3 s = vec3(cos(se), sin(se), 0.0);
        vec3 d = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
        gl_FragColor = vec4(aSky(d, s), 1.0);
      }`,
  }));
  SK.U.uLUT.value = lutRT.texture;
  // normalise the physical sky so a clear noon zenith sits near the posters' daylight zenith
  const noon = atmSky(0, 1, 0, V3(0, Math.sin(1.05), Math.cos(1.05)).normalize(), 1, 1, [0, 0, 0], 24);
  const physK = .3 / (noon[0] * .2126 + noon[1] * .7152 + noon[2] * .0722);

  // environment: the same sky shader (ground bounce below the horizon, no sun disc/stars) into a small cube
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({ uniforms: SK.U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, defines: { ENV: 1 } });
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envMat); envSky.frustumCulled = false; envScene.add(envSky);
  const cubeRT = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(.1, 100, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  // reflections only where they read (gold, marble); diffuse sky light comes from the SH probe below, which is far cheaper
  const reflective = [ST.M.gold, ST.M.marble, ST.M.marbleBlock, ...(ST.reflect || [])];
  const specOnly = THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '');
  reflective.forEach(m => { m.envMapIntensity = .8; chainHook(m, 'envspec', (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', specOnly); }); });
  const env = {
    frame: 0,
    update(force) {
      // the sky only drifts: ~3 refreshes a second is plenty, and each one is a cube render plus a PMREM pass (a visible hitch if frequent)
      if (!force && (this.frame++ % (S.travel ? 6 : 20)) !== 0) return;
      cubeCam.update(renderer, envScene);
      envRT = envRT ? pmrem.fromCubemap(cubeRT.texture, envRT) : pmrem.fromCubemap(cubeRT.texture);
      reflective.forEach(m => { if (m.envMap !== envRT.texture) { m.envMap = envRT.texture; m.needsUpdate = true; } });
    },
  };
  // sky-driven ambient: project the (poster + physical) sky onto spherical harmonics, evaluated per pixel by three
  const probe = new THREE.LightProbe(); probe.intensity = 0; scene.add(probe);

  // pools
  POOLU.uPool.value = buildPoolTex(ST.diyas.pts, CT.lamps.pts);
  const poolMats = [TR.mesh.material, ST.floorMat, ST.M.plain, ST.M.stoneFine, ST.stepMat, ST.C.lotus, ST.C.ashlar, ...CT.groundMats];
  poolMats.forEach(addPools);

  return {
    lutRT, lutU, lutQ, physK, env, probe, probeFrame: 0,
    updateProbe(U, force) {
      if (!force && (this.probeFrame++ % (S.travel ? 4 : 14)) !== 0) return;
      skyToSH(U, physK, probe.sh);
    },
    lastY: -9, lastMie: -9,
    lutAge: 0,
    updateLUT(sunDir, mie) {
      // the LUT only depends on the sun's elevation and the haze: skip frames where neither moved, and never redraw it more than
      // every third frame unless the sun jumped (a chapter jump or the dial)
      const dy = Math.abs(sunDir.y - this.lastY), dm = Math.abs(mie - this.lastMie);
      if (dy < 2.5e-4 && dm < .004) return;
      if (++this.lutAge < 3 && dy < .012 && dm < .05) return;
      this.lutAge = 0; this.lastY = sunDir.y; this.lastMie = mie;
      lutU.uSun.value.copy(sunDir); lutU.uMie.value = mie;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(lutRT); lutQ.render(renderer); renderer.setRenderTarget(prev);
    },
  };
}

/* ---------- JS mirror of the environment sky, projected onto SH L2 for the ambient probe ---------- */
const SH_N = 96, SH_DIRS = (() => { const a = new Float32Array(SH_N * 3), ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < SH_N; i++) { const y = 1 - 2 * (i + .5) / SH_N, r = Math.sqrt(1 - y * y), th = ga * i; a.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3); } return a; })();
const _qB = new Array(9).fill(0), _qc = new THREE.Color(), _qp = new THREE.Color(), _qA = [0, 0, 0], _qd = V3();
function skyRadJS(U, dx, dy, dz, K, out) {
  const el = dy, t = Math.pow(clamp(el, 0, 1), .42), sun = U.uSunDir.value;
  out.copy(U.uHor.value).lerp(U.uZen.value, t);
  const sd = Math.max(dx * sun.x + dy * sun.y + dz * sun.z, 0), sunUp = smooth(-.3, .05, sun.y);
  const g1 = (Math.pow(sd, 5) * .45 + Math.pow(sd, 48) * .8) * sunUp * clamp(U.uSunI.value * .28, 0, .85);
  const hl = Math.hypot(dx, dz) || 1, sl = Math.hypot(sun.x, sun.z) || 1;
  const az = Math.max((dx * sun.x + dz * sun.z) / (hl * sl), 0);
  const g2 = Math.pow(az, 3) * Math.exp(-Math.abs(el) * 9) * .35 * sunUp * (1 - smooth(.35, .8, sun.y));
  out.r += U.uGlow.value.r * (g1 + g2); out.g += U.uGlow.value.g * (g1 + g2); out.b += U.uGlow.value.b * (g1 + g2);
  const pw = U.uPhysW.value;
  if (pw > .001) { atmSky(dx, dy, dz, sun, U.__mie || 1, 1, _qA, 8); physMapC(_qp.setRGB(_qA[0], _qA[1], _qA[2]).multiplyScalar(K)); out.lerp(_qp, pw); }
  const sc = U.uScatDir.value, ins = Math.pow(Math.max(dx * sc.x + dy * sc.y + dz * sc.z, 0), 6) * U.uFogScat.value;
  _qp.copy(U.uFog.value).lerp(U.uFogSun.value, ins);
  out.lerp(_qp, 1 - smooth(-.04, .12, el));
  out.lerp(U.uGround.value, smooth(0, -.1, el));
  return out;
}
function skyToSH(U, K, sh) {
  const c = sh.coefficients; for (const v of c) v.set(0, 0, 0);
  for (let i = 0; i < SH_N; i++) {
    const x = SH_DIRS[i * 3], y = SH_DIRS[i * 3 + 1], z = SH_DIRS[i * 3 + 2];
    skyRadJS(U, x, y, z, K, _qc);
    THREE.SphericalHarmonics3.getBasisAt(_qd.set(x, y, z), _qB);
    for (let j = 0; j < 9; j++) { c[j].x += _qc.r * _qB[j]; c[j].y += _qc.g * _qB[j]; c[j].z += _qc.b * _qB[j]; }
  }
  const norm = 4 * Math.PI / SH_N; for (const v of c) v.multiplyScalar(norm);
}

/* ---------- key-light shadows: fit the frustum to the shot, snap to texels so edges don't crawl ---------- */
const _sx = V3(), _sy = V3(), _sc = V3(), _sUp = V3(0, 0, 1);
function fitShadow(SK, cam, CAM, mapSize) {
  const key = SK.key, dl = cam.position.distanceTo(CAM.look);
  let half = clamp(dl * 1.1 + 14, 24, 90);
  half = Math.pow(1.25, Math.round(Math.log(half) / Math.log(1.25)));
  // centre: ahead of the camera along its view, on the ground
  let hx = CAM.look.x - cam.position.x, hz = CAM.look.z - cam.position.z; const hd = Math.hypot(hx, hz) || 1; hx /= hd; hz /= hd;
  const ahead = Math.min(hd, half * .75);
  _sc.set(cam.position.x + hx * ahead, 0, cam.position.z + hz * ahead); _sc.y = groundY(_sc.x, _sc.z);
  // light-space basis exactly as the shadow camera builds it (lookAt with up = +z)
  const z = S.keyDir; _sx.crossVectors(_sUp, z).normalize(); _sy.crossVectors(z, _sx);
  const texel = mapSize ? 2 * half / mapSize : .1;
  const cx = Math.round(_sc.dot(_sx) / texel) * texel, cy = Math.round(_sc.dot(_sy) / texel) * texel, cz = _sc.dot(z);
  _sc.copy(_sx).multiplyScalar(cx).addScaledVector(_sy, cy).addScaledVector(z, cz);
  key.target.position.copy(_sc); key.position.copy(_sc).addScaledVector(z, 160);
  const sc = key.shadow.camera;
  if (sc.right !== half) { sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.updateProjectionMatrix(); }
  key.shadow.normalBias = texel * 1.6; key.shadow.bias = -.00015;
}
