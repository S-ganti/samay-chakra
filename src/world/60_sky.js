/* =========================================================================
   SKY + LIGHT + ATMOSPHERE
   ========================================================================= */
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FS = `
uniform vec3 uZen,uHor,uGlow,uFog,uCloud,uSunDir,uPole,uMwN,uFogSun,uScatDir,uSunT,uCloudP,uGround;
uniform float uSunI,uSunVis,uStars,uTrail,uMilky,uCloudAmt,uTime,uRot,uNight,uPhysW,uPhysK,uFogScat;
uniform sampler2D uLUT;
varying vec3 vDir;
float h1(float n){return fract(sin(n*127.1)*43758.5453);}
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm3(vec3 p){float s=0.0,a=0.5; for(int i=0;i<4;i++){s+=a*vn(p); p*=2.03; a*=0.5;} return s * 1.032;}   // four octaves: the fifth is 3% of the cloud's contrast, at a fifth of the cost of the noise
vec3 rotA(vec3 v, vec3 k, float a){ return v*cos(a) + cross(k,v)*sin(a) + k*dot(k,v)*(1.0-cos(a)); }
${LUT_READ_GLSL}
${PHYS_MAP_GLSL}
void main(){
  vec3 d = normalize(vDir);
  float el = d.y;
  // poster sky: two-colour gradient, sun glow, horizon warmth on the sun side
  float t = pow(clamp(el,0.0,1.0), 0.42);
  vec3 c = mix(uHor, uZen, t);
  float sd = max(dot(d,uSunDir),0.0);
  float sunUp = smoothstep(-0.3, 0.05, uSunDir.y);
  c += uGlow * (pow(sd,5.0)*0.45 + pow(sd,48.0)*0.8) * sunUp * clamp(uSunI*0.28,0.0,0.85);
  float az = max(dot(normalize(vec3(d.x,0.0,d.z)), normalize(vec3(uSunDir.x,0.0,uSunDir.z)+1e-4)),0.0);
  c += uGlow * pow(az,3.0) * exp(-abs(el)*9.0) * 0.35 * sunUp * (1.0-smoothstep(0.35,0.8,uSunDir.y));
  // physical sky (Rayleigh + Mie + ozone), blended in by the chapter's realism weight
  if (uPhysW > 0.001) c = mix(c, physMap(physSky(uLUT, d, uSunDir) * uPhysK), uPhysW);
  // clouds
  if(uCloudAmt>0.005){
    vec3 cp = vec3(d.x/(el+0.16), d.z/(el+0.16), 0.0)*0.9 + vec3(uTime*0.006, uTime*0.002, uTime*0.004);
    float n = fbm3(cp*1.3);
    float cl = smoothstep(0.62-uCloudAmt*0.28, 0.95, n) * smoothstep(0.0,0.06,el) * (1.0-smoothstep(0.3,0.75,el));
    vec3 cc = mix(uCloud * (0.55 + 0.9*pow(sd,3.0)), uCloudP * (0.6 + 0.7*pow(sd,6.0)) * (0.8 + 0.4*n), uPhysW);
    c = mix(c, cc, cl*0.9);
  }
#ifndef ENV
  // stars + trails, in the rotating pole frame
  if(uStars>0.005 && el>-0.05){
    vec3 e3=uPole, e1=normalize(cross(uPole, vec3(0.0,1.0,0.0))), e2=cross(e3,e1);
    float th = acos(clamp(dot(d,e3),-1.0,1.0));
    float ph = atan(dot(d,e2), dot(d,e1)) - uRot;
    const float B = 1100.0;
    float bp = th/3.14159265*B, b=floor(bp), v=fract(bp)-0.5;
    float trail = uTrail*1.15;
    float acc=0.0;
    for(int s=0;s<4;s++){
      float fs=float(s);
      float pres = step(h1(b*3.17+fs*17.7), 0.62);
      float phs = (fs + h1(b*7.31+fs*3.3))*1.5707963;
      float along = mod(phs - ph + 62.8318, 6.2831853);
      float outside = along > 3.14159 ? (6.2831853-along) : max(0.0, along - trail);
      float rad = v*3.14159265/B;
      float dist = sqrt(pow(outside*sin(th),2.0) + rad*rad);
      float sz = 0.0011 + 0.0016*h1(b+fs*5.1);
      float br = h1(b*1.73+fs); br = br*br*1.5+0.15;
      float fade = trail>0.01 ? mix(1.0, 0.35, clamp(along/max(trail,0.001),0.0,1.0)) : 1.0;
      acc += pres*br*smoothstep(sz,0.0,dist)*fade*(0.75+0.25*sin(uTime*3.0+b+fs*9.0));
    }
    vec3 dr = rotA(d, e3, uRot);
    float mw = exp(-pow(dot(dr,uMwN)/0.14,2.0)) * (0.35+0.65*fbm3(dr*5.0)) * uMilky;
    float hz = smoothstep(-0.02,0.2,el);
    c += (vec3(0.85,0.9,1.0)*acc*1.6 + vec3(0.55,0.62,0.85)*mw*0.55) * uStars * hz;
  }
  // sun disc, reddened by the air it shines through
  float disc = smoothstep(0.99955, 0.99985, dot(d,uSunDir));
  c += mix(vec3(1.0,0.96,0.88), uSunT, uPhysW) * disc * 9.0 * uSunVis;
#endif
  // the horizon melts into the same sun-lit fog the ground uses
  vec3 fc = mix(uFog, uFogSun, pow(max(dot(d, uScatDir), 0.0), 6.0) * uFogScat);
  c = mix(c, fc, 1.0 - smoothstep(-0.04, 0.12, el));
#ifdef ENV
  c = mix(c, uGround, smoothstep(0.0, -0.1, el));
#endif
  gl_FragColor = vec4(c,1.0);
}`;

function ringElevDeg(t) {
  const K = [[0, -18], [2, 2], [4.5, 22], [7.5, 32], [10.5, 28], [12, 20], [13.5, 6], [15, -6], [16.5, -18], [24, -18]];
  const x = wrap24(t - 16.5);
  for (let i = 1; i < K.length; i++) if (x <= K[i][0]) { const f = (x - K[i - 1][0]) / (K[i][0] - K[i - 1][0]); return lerp(K[i - 1][1], K[i][1], .5 - .5 * Math.cos(Math.PI * f)); }
  return -18;
}
const dirFrom = (elDeg, azDeg, out) => { const e = elDeg * Math.PI / 180, a = azDeg * Math.PI / 180; return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)); };

function buildSky(scene, Q) {
  const U = {
    uZen: { value: col('#000') }, uHor: { value: col('#000') }, uGlow: { value: col('#000') }, uFog: { value: col('#000') }, uCloud: { value: col('#fff') },
    uSunDir: { value: V3(1, 0, 0) }, uPole: { value: V3(0, Math.sin(.227), -Math.cos(.227)).normalize() }, uMwN: { value: V3(.35, .6, .72).normalize() },
    uSunI: { value: 1 }, uSunVis: { value: 1 }, uStars: { value: 0 }, uTrail: { value: 0 }, uMilky: { value: 0 }, uCloudAmt: { value: 0 }, uTime: { value: 0 }, uRot: { value: 0 }, uNight: { value: 0 },
    uFogSun: { value: col('#000') }, uScatDir: { value: V3(0, 1, 0) }, uSunT: { value: col('#fff') }, uCloudP: { value: col('#fff') }, uGround: { value: col('#000') },
    uPhysW: { value: 0 }, uPhysK: { value: 1 }, uFogScat: { value: 0 }, uLUT: { value: null },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  // The sky is drawn after the other opaque objects, not before: it sits at the far plane, so the depth test throws away every
  // pixel the ground, buildings and trees already cover, and its cloud and atmosphere shader runs only where sky shows.
  // (Sprites, mist and particles are transparent, so they still draw after it.)
  sky.renderOrder = 1000; sky.frustumCulled = false; scene.add(sky);

  // moon + sun flare sprites
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTex(texMoon()), transparent: true, depthWrite: false, fog: false, color: '#eef2ff' }));
  moon.scale.setScalar(52); moon.renderOrder = -5; scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTex(texGlow('rgba(255,255,255,.55)', 'rgba(220,230,255,.12)')), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: '#9fb6ff' }));
  moonGlow.scale.setScalar(260); moonGlow.renderOrder = -6; scene.add(moonGlow);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTex(texStarburst()), transparent: true, depthWrite: false, depthTest: true, fog: false, blending: THREE.AdditiveBlending, color: '#fff6e0' }));
  flare.scale.setScalar(300); flare.renderOrder = 50; scene.add(flare);

  // lights
  const hemi = new THREE.HemisphereLight('#ffffff', '#222222', .6); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1);
  key.castShadow = Q.shadows > 0;
  if (Q.shadows) { key.shadow.mapSize.set(Q.shadows, Q.shadows); const sc = key.shadow.camera; sc.left = sc.bottom = -75; sc.right = sc.top = 75; sc.near = 1; sc.far = 400; key.shadow.bias = -.0006; key.shadow.normalBias = .6; }
  scene.add(key, key.target);
  const stageLight = new THREE.PointLight('#ff3a20', 0, 70, 1.4); stageLight.position.set(0, HP + 7, 0); scene.add(stageLight);
  const ridgeLight = new THREE.PointLight('#ff2d95', 0, 60, 1.4); ridgeLight.position.set(GEO.R.x, RH + 6, GEO.R.z); scene.add(ridgeLight);
  const synthLight = new THREE.PointLight('#ffb070', 0, 18, 1.6); synthLight.position.set(GEO.SYNTH.x, groundY(GEO.SYNTH.x, GEO.SYNTH.z) + 2.2, GEO.SYNTH.z + .6); scene.add(synthLight);
  const fog = new THREE.FogExp2('#000000', .01); scene.fog = fog;

  /* ---------- particles ---------- */
  const pts = (n, fill, uniforms, vs, fs, blending = THREE.AdditiveBlending) => {
    const g = new THREE.BufferGeometry(); const P = new Float32Array(n * 3), A = new Float32Array(n * 4); fill(P, A);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aR', new THREE.BufferAttribute(A, 4));
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending });
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  };
  const rr = rng(4242);
  // embers / fireflies around the clearing, steps and gate
  const emberU = { uTime: { value: 0 }, uI: { value: 0 }, uSize: { value: 600 }, uCol: { value: col('#ffae55') } };
  pts(700, (P, A) => { for (let i = 0; i < 700; i++) { let x, z; if (i < 480) { const a = rr() * TAU, d = Math.sqrt(rr()) * 44; x = Math.cos(a) * d; z = Math.sin(a) * d; } else { x = lerp(-100, -40, rr()); z = (rr() - .5) * 26; } P.set([x, groundY(x, z) + .2 + rr() * 4, z], i * 3); A.set([rr(), rr(), rr(), rr()], i * 4); } }, emberU,
    `attribute vec4 aR; uniform float uTime,uSize; varying float vA;
     void main(){ vec3 p=position; float t=uTime*(0.25+aR.x*0.4)+aR.y*20.0; p.x+=sin(t)*1.2; p.z+=cos(t*0.8)*1.2; p.y+=fract(uTime*0.03*(0.5+aR.z)+aR.w)*5.0;
       vA=0.5+0.5*sin(uTime*(2.0+aR.x*4.0)+aR.w*30.0); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=uSize*(0.05+aR.z*0.06)/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
    `uniform float uI; uniform vec3 uCol; varying float vA; void main(){ vec2 q=gl_PointCoord*2.0-1.0; float a=exp(-dot(q,q)*4.0)*vA*uI; if(a<0.004) discard; gl_FragColor=vec4(uCol*a*2.2,1.0);} `);
  // marigold petals (Diamond Ring)
  const petalU = { uTime: { value: 0 }, uI: { value: 0 }, uSize: { value: 600 } };
  pts(1600, (P, A) => { for (let i = 0; i < 1600; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 38; P.set([Math.cos(a) * d, HP, Math.sin(a) * d], i * 3); A.set([rr(), rr(), rr(), rr()], i * 4); } }, petalU,
    `attribute vec4 aR; uniform float uTime,uSize; varying vec3 vC; varying float vRot;
     void main(){ vec3 p=position; float f=fract(uTime*(0.018+aR.x*0.02)+aR.y); p.y += 26.0*(1.0-f); p.x += sin(uTime*0.9+aR.z*20.0)*1.4; p.z += cos(uTime*0.7+aR.w*20.0)*1.4;
       vC = aR.w<0.45? vec3(1.0,0.45,0.08) : aR.w<0.8? vec3(1.0,0.72,0.1) : aR.w<0.93? vec3(0.85,0.12,0.1) : vec3(1.0,0.97,0.9);
       vRot = uTime*(1.0+aR.x*3.0)+aR.z*6.28; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=uSize*(0.12+aR.z*0.1)/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
    `uniform float uI; varying vec3 vC; varying float vRot; void main(){ vec2 q=gl_PointCoord*2.0-1.0; float s=sin(vRot),c=cos(vRot); q=vec2(c*q.x-s*q.y, s*q.x+c*q.y); q.y*=2.2;
       float d=dot(q,q); if(d>1.0||uI<0.01) discard; gl_FragColor=vec4(vC*(0.8+0.2*(1.0-d)), uI*0.95);} `, THREE.NormalBlending);
  // dust motes that follow the camera
  const dustU = { uTime: { value: 0 }, uI: { value: 0 }, uSize: { value: 600 }, uCam: { value: V3() }, uCol: { value: col('#ffd9a0') } };
  pts(1200, (P, A) => { for (let i = 0; i < 1200; i++) { P.set([rr() * 60, rr() * 24, rr() * 60], i * 3); A.set([rr(), rr(), rr(), rr()], i * 4); } }, dustU,
    `attribute vec4 aR; uniform float uTime,uSize; uniform vec3 uCam; varying float vA;
     void main(){ vec3 p=position+vec3(sin(uTime*0.1+aR.x*9.0)*2.0+uTime*0.3, sin(uTime*0.07+aR.y*9.0)*1.0, cos(uTime*0.09+aR.z*9.0)*2.0);
       p = uCam + mod(p - uCam + vec3(30.0,6.0,30.0), vec3(60.0,24.0,60.0)) - vec3(30.0,6.0,30.0);
       vA = 0.4+0.6*aR.w; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=uSize*(0.02+aR.z*0.03)/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
    `uniform float uI; uniform vec3 uCol; varying float vA; void main(){ vec2 q=gl_PointCoord*2.0-1.0; float a=exp(-dot(q,q)*3.0)*vA*uI; if(a<0.004) discard; gl_FragColor=vec4(uCol*a,1.0);} `);
  // mist puffs (billboards) in valleys and on the ridge
  const mistN = 90, mg = new THREE.InstancedBufferGeometry(); mg.copy(new THREE.PlaneGeometry(1, 1));
  const off = new Float32Array(mistN * 4);
  for (let i = 0; i < mistN; i++) {
    let x, z, y, s;
    if (i < 30) { const a = rr() * TAU, d = 60 + rr() * 70; x = Math.cos(a) * d; z = Math.sin(a) * d * .8; y = groundY(x, z) + 3 + rr() * 5; s = 50 + rr() * 50; }
    else if (i < 55) { const a = rr() * TAU, d = rr() * 40; x = GEO.R.x + Math.cos(a) * d; z = GEO.R.z + Math.sin(a) * d; y = groundY(x, z) + 1.5 + rr() * 3; s = 26 + rr() * 30; }
    else { const a = rr() * TAU, d = 130 + rr() * 120; x = Math.cos(a) * d; z = Math.sin(a) * d; y = groundY(x, z) + 6 + rr() * 16; s = 80 + rr() * 90; }
    off.set([x, y, z, s], i * 4);
  }
  mg.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); mg.instanceCount = mistN;
  const mistU = { uTime: { value: 0 }, uI: { value: 0 }, uCol: { value: col('#8899bb') } };
  const mist = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: mistU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute vec4 aOff; uniform float uTime; varying vec2 vUv; varying float vSeed; varying float vD;
      void main(){ vUv=uv; vSeed=aOff.x*0.013+aOff.z*0.007; vec3 c=aOff.xyz + vec3(sin(uTime*0.02+vSeed*10.0)*6.0,0.0,cos(uTime*0.015+vSeed*7.0)*6.0);
        vec4 mv=modelViewMatrix*vec4(c,1.0); vD=-mv.z; mv.xy += position.xy*aOff.w*vec2(1.0,0.45); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uI,uTime; uniform vec3 uCol; varying vec2 vUv; varying float vSeed; varying float vD;
      float hh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 q=vUv*2.0-1.0; float r=dot(q,q); float n=nz(vUv*3.0+vSeed*20.0+uTime*0.01)*0.6+nz(vUv*7.0-vSeed*9.0)*0.4;
        float a=smoothstep(1.0,0.1,r)*n*uI*0.33*smoothstep(8.0,40.0,vD); if(a<0.003) discard; gl_FragColor=vec4(uCol,a);} ` }));
  mist.frustumCulled = false; mist.renderOrder = 3; scene.add(mist);
  // light trails: what a long exposure records of poi spun by people walking the dance orbit. A light swung in a circle beside
  // a moving body traces cycloid and flower loops; the camera keeps a thin white-hot core inside a coloured halo, brightest at
  // the poi itself and letting go along the tail. Fire poi round the stage at the Gathering, cold LED poi among the Eclipse
  // stones. Every ribbon is placed on the GPU from its instance numbers (no per-frame CPU work), depth-tested so the crowd
  // and the stones hide them
  const TSEG = 28, tg = new THREE.InstancedBufferGeometry();
  { const P = [], I = []; for (let k = 0; k <= TSEG; k++) { P.push(k / TSEG, -1, 0, k / TSEG, 1, 0); if (k < TSEG) { const b = k * 2; I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setIndex(I); }
  const spinners = [];   // [centre x, y, z, kind 0 fire / 1 LED]
  const NSG = 56, NSE = 30;
  for (let i = 0; i < NSG; i++) spinners.push([0, HP, 0, 0, 6 + Math.sqrt(rr()) * 22]);
  for (let i = 0; i < NSE; i++) spinners.push([GEO.R.x, RH, GEO.R.z, 1, 4 + Math.sqrt(rr()) * 12]);
  const NT = spinners.length * 2, A0 = new Float32Array(NT * 4), A1 = new Float32Array(NT * 4), A2 = new Float32Array(NT * 4);
  spinners.forEach(([cx, cy, cz, kind, rad], i) => {
    const dir = rr() < .2 ? -1 : 1, walk = dir * (kind ? .55 + rr() * .4 : .85 + rr() * .6) / rad;   // walking pace round the orbit (rad/s): fast enough to open the loops into cycloids
    const spinR = kind ? .55 + rr() * .35 : .5 + rr() * .3, spin = (kind ? 4.5 : 6.5) + rr() * 3.5, ph0 = rr() * TAU, h = cy + 1.2 + rr() * .3;
    const flower = rr() < .4 ? Math.floor(2 + rr() * 3) : 0, tail = kind ? 1.3 + rr() * .9 : 1.0 + rr() * .7, hue = rr(), seed = rr() * 100;
    for (let k = 0; k < 2; k++) {                 // two poi per spinner, half a turn apart (or together, for some)
      const j = (i * 2 + k) * 4, off = k * (rr() < .7 ? Math.PI : 0);
      A0.set([cx, cz, rad, ph0], j); A1.set([walk, spinR, spin * (k && rr() < .25 ? -1 : 1), h], j); A2.set([tail, seed + k * 7.3, kind + flower * 2, off + hue * .001], j);
    }
  });
  tg.setAttribute('aT0', new THREE.InstancedBufferAttribute(A0, 4)); tg.setAttribute('aT1', new THREE.InstancedBufferAttribute(A1, 4)); tg.setAttribute('aT2', new THREE.InstancedBufferAttribute(A2, 4));
  tg.instanceCount = NT;
  const trailU = { uTime: { value: 0 }, uAmtG: { value: 0 }, uAmtE: { value: 0 }, uColG: { value: col('#ff7a2a') }, uColE: { value: col('#8fb0e8') }, uColE2: { value: col('#d0608a') }, uPxK: { value: .001 }, uPulse: { value: 0 } };
  const trailMat = new THREE.ShaderMaterial({
    uniforms: trailU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `attribute vec4 aT0, aT1, aT2; uniform float uTime, uAmtG, uAmtE, uPxK; varying float vX, vS, vA, vKind, vHue, vFl;
      vec3 path(float t){
        float ang = aT0.w + aT1.x * t; vec2 dir = vec2(cos(ang), sin(ang)), tg = vec2(-dir.y, dir.x) * sign(aT1.x);
        vec3 c = vec3(aT0.x + dir.x * aT0.z, aT1.w, aT0.y + dir.y * aT0.z);
        float sp = aT1.z * t + aT2.w, fl = floor(aT2.z * .5);
        float r = aT1.y * (fl > .5 ? .75 + .25 * cos(fl * sp) : 1.0);           // some spinners throw flowers (rose curves) rather than circles
        return c + vec3(tg.x, 0.0, tg.y) * cos(sp) * r + vec3(0.0, sin(sp) * r, 0.0);
      }
      void main(){
        float kind = mod(aT2.z, 2.0), amt = kind < .5 ? uAmtG : uAmtE;
        vS = position.x; vX = position.y; vKind = kind; vHue = fract(aT2.y * .37); vFl = aT2.y;
        float t = uTime - vS * aT2.x;
        vec3 p = path(t), d = path(t + .02) - p;
        vec3 v = cameraPosition - p; float dist = length(v);
        vec3 side = normalize(cross(d, v));
        // the halo is a few centimetres wide; never thinner than ~2 px (the light is spread wider and dimmer, not lost)
        float w0 = (kind < .5 ? .06 : .045) * pow(1.0 - vS, .5), w = max(w0, 2.2 * uPxK * dist);
        vA = amt * w0 / max(w, 1e-5) * step(.01, amt) * smoothstep(1.5, 4.5, dist);   // a light swung right past the lens would only smear it
        gl_Position = projectionMatrix * viewMatrix * vec4(p + side * vX * w, 1.0);
      }`,
    fragmentShader: `uniform float uTime, uPulse; uniform vec3 uColG, uColE, uColE2; varying float vX, vS, vA, vKind, vHue, vFl;
      void main(){
        if (vA < .002) discard;
        float x2 = vX * vX, core = exp(-x2 * 28.0), halo = exp(-x2 * 3.5);
        // the exposure lets go along the tail; fire flickers and sheds, LEDs hold steady
        float along = pow(1.0 - vS, 1.7) * smoothstep(0.0, .015, vS + .005);
        float flick = vKind < .5 ? .7 + .3 * sin(uTime * 21.0 + vFl * 13.0 + vS * 40.0) * sin(uTime * 13.0 + vS * 23.0) : 1.0;
        vec3 hc = vKind < .5 ? mix(uColG, vec3(1.0, .78, .32), .35 * (1.0 - vS)) : mix(uColE, uColE2, step(.7, vHue));
        vec3 hot = vKind < .5 ? vec3(1.0, .78, .45) : vec3(.9, .95, 1.0);   // fire burns gold at the core, LEDs near white
        vec3 c = (hot * core * 1.7 + hc * halo * 1.4) * along * flick * vA * (1.0 + uPulse * .5);
        c += vec3(1.0, .9, .7) * smoothstep(.03, 0.0, vS) * core * 4.0 * vA;          // the poi itself
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const trails = new THREE.Mesh(tg, trailMat); trails.frustumCulled = false; trails.renderOrder = 4; scene.add(trails);
  return { U, sky, moon, moonGlow, flare, hemi, key, stageLight, ridgeLight, synthLight, fog, emberU, petalU, dustU, mistU, mist, trails, trailU };
}

const _sd = V3(), _rd = V3(), _md = V3(), RIDGE_P = V3(GEO.R.x, RH, GEO.R.z), MOONW = col('#f2f4ff'), WHITE = col('#ffffff');
const _sT = [0, 0, 0], _hz = [0, 0, 0], _pc1 = new THREE.Color(), _pc2 = new THREE.Color(), _pc3 = new THREE.Color(), _gc = new THREE.Color();
function updateSky(SK, ST, t, rt, look, w, cam) {
  const U = SK.U;
  // sun: rises due east at 06:00, passes the zenith at noon (zero shadow), sets west at 18:00
  const th = (t - 6) / 12 * Math.PI;
  S.sunDir.set(Math.cos(th), Math.sin(th), -.18 * Math.cos(th)).normalize();
  // celestial ring + moon
  const rEl = ringElevDeg(t);
  dirFrom(rEl, 0, _rd);
  const Rp = RIDGE_P;
  const cel = ST.celestial;
  // in the Eclipse chapter the wheel comes down close, as on its poster: a carved ring filling the sky, its face caught in cold light
  const eclW = w[2], celD = lerp(460, 235, eclW);
  cel.group.position.copy(Rp).addScaledVector(_rd, celD);
  cel.group.lookAt(Rp); cel.group.rotateZ(rt * .004);
  cel.angR = Math.atan(113 / celD);
  if (cel.celMat.emissive) { _pc3.set('#2a3a58').multiplyScalar(.32 * eclW + .08 * w[3]); cel.celMat.emissive.copy(_pc3); cel.celBlockMat.emissive.copy(_pc3); }
  const mAz = hdiff(t, 1.5) * 6;
  dirFrom(rEl + 1.5 * Math.cos(hdiff(t, 1.5) * .4), mAz, S.moonDir);
  const moonUp = smooth(-.06, .04, S.moonDir.y) * (1 - smooth(-.05, .1, S.sunDir.y));
  SK.moon.position.copy(Rp).addScaledVector(S.moonDir, 900); SK.moonGlow.position.copy(SK.moon.position);
  SK.moon.material.opacity = moonUp; SK.moonGlow.material.opacity = moonUp * .6 * (.2 + .8 * MOON.illum) * (1 - WX.cloud * .8);
  SK.moon.material.color.copy(look.skyGlow).lerp(MOONW, .7);
  // key light: sun by day, moon by night
  const dayF = smooth(-.12, .06, S.sunDir.y);
  S.keyDir.copy(S.moonDir).lerp(S.sunDir, dayF);
  if (S.keyDir.y < .15) S.keyDir.y = .15 + (S.keyDir.y - .15) * .2;
  S.keyDir.normalize();
  // realism: how much of the physical sky / sun colour to use (fades out below the horizon, where the posters rule)
  const physW = clamp(look.phys * PARAM.real, 0, 1) * smooth(-.24, -.07, S.sunDir.y);
  S.physW = physW;
  const K = SK.physK || 1;
  atmSunT(0, ATM.RG + ATM.H0, 0, S.sunDir, look.mie, _sT, 12);
  const sMax = Math.max(_sT[0], _sT[1], _sT[2], 1e-4), sLum = _sT[0] * .2126 + _sT[1] * .7152 + _sT[2] * .0722;
  S.sunT.setRGB(_sT[0] / sMax, _sT[1] / sMax, _sT[2] / sMax);
  const pw = physW * dayF;
  SK.key.color.copy(look.sun).lerp(S.sunT, pw);
  SK.key.intensity = look.sunI * lerp(1, clamp(Math.sqrt(sLum / .78), .35, 1.1), pw);
  SK.key.intensity *= lerp(.5 + .5 * MOON.illum, 1, dayF);                    // tonight's moon: a thin crescent lights less than a full moon
  SK.hemi.color.copy(look.hemiS); SK.hemi.groundColor.copy(look.hemiG); SK.hemi.intensity = look.hemiI * (1 - look.envI);
  // scattering light: the sun by day, the moon by night
  S.scatDir.copy(S.moonDir).lerp(S.sunDir, dayF).normalize();
  // horizon colours from the physical sky: toward the sun (in-scatter) and side-on (fog body)
  const saz = Math.atan2(S.sunDir.z, S.sunDir.x), he = .035, ce = Math.cos(he), se = Math.sin(he);
  if (physW > .001) {
    atmSky(ce * Math.cos(saz), se, ce * Math.sin(saz), S.sunDir, look.mie, 1, _hz, 12); physMapC(_pc1.setRGB(_hz[0], _hz[1], _hz[2]).multiplyScalar(K));
    atmSky(ce * Math.cos(saz + 1.5708), se, ce * Math.sin(saz + 1.5708), S.sunDir, look.mie, 1, _hz, 12); physMapC(_pc2.setRGB(_hz[0], _hz[1], _hz[2]).multiplyScalar(K));
  }
  // fog: height fog + haze, coloured by the chapter, pulled toward the physical horizon by the realism weight
  const fogK = PARAM.fog;
  SK.fog.color.copy(look.fog); if (physW > .001) SK.fog.color.lerp(_pc2, physW * .3);
  SK.fog.density = look.fogD * fogK;
  HFOG.hfP.value.set(1 / look.fogH, look.fogY, look.fogD * .06 * fogK, 0);
  HFOG.hfQ.value.x = look.fogS;
  const scatVis = dayF > .5 ? smooth(-.1, .04, S.sunDir.y) : .55 * smooth(-.05, .1, S.moonDir.y);
  HFOG.hfSunCol.value.copy(look.skyGlow).multiplyScalar(1.1); if (physW > .001) HFOG.hfSunCol.value.lerp(_pc1, physW);
  HFOG.hfP.value.w = clamp(lerp(look.scat, .9, physW) * scatVis, 0, 1);
  HFOG.hfSunDir.value.copy(S.scatDir);
  // sky uniforms
  U.uZen.value.copy(look.skyZen); U.uHor.value.copy(look.skyHor); U.uGlow.value.copy(look.skyGlow); U.uFog.value.copy(SK.fog.color); U.uCloud.value.copy(look.cloud);
  U.uSunDir.value.copy(S.sunDir); U.uSunI.value = look.sunI; U.uSunVis.value = smooth(-.02, .02, S.sunDir.y);
  U.uStars.value = look.stars * (1 - dayF); U.uTrail.value = look.trail; U.uMilky.value = look.milky; U.uCloudAmt.value = look.cloudAmt;
  U.uTime.value = rt; U.uRot.value = t / 24 * TAU;
  U.uPhysW.value = physW; U.uPhysK.value = K; U.uSunT.value.copy(S.sunT); U.__mie = look.mie;
  U.uFogSun.value.copy(HFOG.hfSunCol.value); U.uScatDir.value.copy(S.scatDir); U.uFogScat.value = HFOG.hfP.value.w;
  // clouds lit by the (reddened) sun plus the sky
  U.uCloudP.value.copy(S.sunT).multiplyScalar(.55 * Math.sqrt(sLum) * smooth(-.08, .06, S.sunDir.y)).add(_pc3.copy(_pc2).multiplyScalar(.45));
  // environment ground bounce: the ground colour lit by key + sky
  _gc.copy(SK.key.color).multiplyScalar(SK.key.intensity * Math.max(S.keyDir.y, 0) * .13 / Math.PI);
  U.uGround.value.copy(look.hemiG).multiplyScalar(look.hemiI * .6).add(_gc);
  SK.sky.position.copy(cam.position);
  // celestial ring presence, void (eclipse + dawn), corona and diamond flash
  const sep = Math.acos(clamp(S.sunDir.dot(_rd), -1, 1));
  const dawn = smooth(5.1, 5.6, t) * (1 - smooth(7.2, 7.8, t));
  const hidden = 1 - smooth(cel.angR * .86, cel.angR * .985, sep);
  const voidA = Math.max(look.void, dawn * hidden * .98);
  cel.voidU.uA.value = voidA;
  const flash = dawn * Math.exp(-Math.pow((sep - cel.angR) / .028, 2)) * (sep > cel.angR * .9 ? 1 : .2);
  S.flash = flash;
  const presence = clamp(Math.max(look.celes * smooth(4, 14, rEl), dawn * .9), 0, 1) * smooth(-18, -8, rEl);
  cel.group.visible = presence > .01;
  cel.celMat.opacity = cel.celBlockMat.opacity = presence; cel.ros.material[1].opacity = presence;
  cel.corU.uI.value = (look.coronaI + dawn * hidden * 1.4 + flash * 2) * presence;
  cel.corU.uCol.value.copy(look.corona); cel.corU.uTime.value = rt;
  // flare on the sun (diamond ring + low sun glare)
  const sunVis = smooth(-.03, .03, S.sunDir.y) * (1 - hidden * dawn);
  SK.flare.position.copy(cam.position).addScaledVector(S.sunDir, 800);
  const lowGlare = sunVis * (1 - smooth(.15, .5, S.sunDir.y)) * .2;
  SK.flare.material.opacity = clamp(flash * 1.1 + lowGlare, 0, 1.2);
  SK.flare.scale.setScalar(200 + flash * 320);
  SK.flare.visible = SK.flare.material.opacity > .01;
  // practical lights gated by chapter weights
  SK.stageLight.color.copy(look.practical); SK.stageLight.intensity = look.practicalI * (w[1] * 60 + w[0] * 18 + w[4] * 8) * (1 + S.pulse * .6);
  SK.ridgeLight.color.copy(look.practical); SK.ridgeLight.intensity = look.practicalI * (w[2] * 16 + w[3] * 4) * (1 + S.pulse * .5);
  SK.synthLight.intensity = (w[2] + w[3] * 1.6) * 10;
  // particles
  SK.emberU.uTime.value = rt; SK.emberU.uI.value = look.fire;
  SK.petalU.uTime.value = rt; SK.petalU.uI.value = look.petals;
  SK.dustU.uTime.value = rt; SK.dustU.uI.value = look.dust * (.4 + .6 * dayF); SK.dustU.uCam.value.copy(cam.position); SK.dustU.uCol.value.copy(look.sun).lerp(WHITE, .3);
  SK.mistU.uTime.value = rt; SK.mistU.uI.value = look.mist * (1 - .65 * dayF); SK.mistU.uCol.value.copy(look.fog).lerp(look.skyHor, .3);
  SK.mist.visible = look.mist > .01;
}
// light trails: the chapter's amount and colours, and the pixel size (so the thinnest trail stays at least ~2 px wide)
function updateStreaks(SK, look, rt, pulse, cam, H) {
  const U = SK.trailU;
  U.uTime.value = rt; U.uPulse.value = pulse;
  U.uAmtG.value = look.streakG * 1.8; U.uAmtE.value = look.streakE * 2.6;
  U.uColG.value.copy(look.streakCol).lerp(_tc.set('#ff7a2a'), .55);
  U.uColE.value.copy(look.streakCol); U.uColE2.value.copy(look.practical);
  U.uPxK.value = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / Math.max(H, 1);
  SK.trails.visible = look.streakG + look.streakE > .01;
}
const _tc = new THREE.Color();
