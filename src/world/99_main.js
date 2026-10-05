/* =========================================================================
   BOOT + LOOP
   ========================================================================= */
// pr: the canvas's sharpest pixel ratio (native up to this). mp: the megapixels the picture is actually drawn at; it is
// upscaled and sharpened to the canvas, so a big or high-density screen costs no more to draw than a small one.
// dens: square pixels each triangle of a scanned mesh may cover before a simplified copy is used instead (higher = coarser, cheaper).
// errPx: how far (in pixels) a simplified copy may sit from the real surface.
const QUAL = {
  low: { pr: 1, mp: .8, tex: 1024, shadows: 0, trees: .55, treeShadows: false, smaa: false, fxaa: false, dens: 12, errPx: 3, ao: 0, shafts: false, dof: false, grass: 0, fusion: false },
  med: { pr: 2, mp: 1.5, tex: 1024, shadows: 2048, trees: .85, treeShadows: false, smaa: false, fxaa: true, dens: 5, errPx: 1.5, ao: 8, shafts: true, dof: true, grass: 124, fusion: true },
  high: { pr: 2, mp: 3, tex: 2048, shadows: 4096, trees: 1, treeShadows: true, smaa: true, fxaa: false, dens: 2.4, errPx: .9, ao: 12, shafts: true, dof: true, grass: 190, fusion: true },
};
async function boot() {
  const canvas = $('gl');
  const T0 = performance.now(), mark = (k) => diagNote('boot', `${k} +${Math.round(performance.now() - T0)} ms`);
  let renderer;
  // ask for the fast GPU first; some hybrid laptops refuse that request (or the fast GPU is mid-reset), so ask again without a preference
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }); }
  catch (e) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false }); diagNote('webgl', 'fast-GPU request refused; using the default GPU'); }
    catch (e2) { diagNote('webgl', 'no context: ' + (e2.message || e2)); $('glerr').classList.add('on'); $('loading').classList.add('done'); return; }
  }
  // a start that never reaches its first frame (GPU reset, killed tab) leaves this mark; the next start then goes one quality lower (see QPICK).
  // Leaving the page on purpose clears it
  try { localStorage.setItem('samay.boot', String(Date.now())); addEventListener('pagehide', () => { try { if (!UI.started) localStorage.removeItem('samay.boot'); } catch (x) { } }); } catch (e) { }
  // features this start must go without (from the link, or because the last start lost the graphics)
  { const q = QUAL[PARAM.quality]; if (SAFE.shadows) q.shadows = 0; if (SAFE.post) { q.ao = 0; q.shafts = false; q.dof = false; } if (SAFE.grass) q.grass = 0; }
  // start-up is checked stage by stage: after each heavy GPU step, wait for it to finish and see whether the graphics survived. The stage
  // that did not is named in the log, and the next start goes without the likely culprit (shadows first), then at Low, instead of failing again
  const gl0 = renderer.getContext(), syncPx = new Uint8Array(4);
  const bootLost = (stage) => {
    if (BOOT.lost) return; BOOT.lost = stage; diagNote('webgl', `graphics lost during: ${stage}`);
    if (SAFE.lvl >= 2) { diagShow('The graphics card dropped the scene', 'The browser reset the graphics while starting, even at Low quality. Quit the browser completely and reopen it; if it keeps happening, update the graphics driver.'); return; }
    try { localStorage.setItem('samay.safe', JSON.stringify({ lvl: SAFE.lvl + 1, at: Date.now(), stage })); } catch (e) { }
    setTimeout(() => location.replace(location.href), 400);
  };
  const gpuSync = (name) => {
    if (BOOT.lost) return false;
    try { renderer.setRenderTarget(null); gl0.readPixels(0, 0, 1, 1, gl0.RGBA, gl0.UNSIGNED_BYTE, syncPx); } catch (e) { }
    if (gl0.isContextLost()) { bootLost(name); return false; }
    BOOT.stage = name; diagNote('boot', `${name} ok +${Math.round(performance.now() - T0)} ms`); return true;
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); UI.glLost = true; if (!UI.started || (UI.frameN || 0) < 3) bootLost(BOOT.stage + ' (next)'); }, false);
  const Q = { ...QUAL[PARAM.quality] }; CULL.dens = Q.dens; CULL.errPx = Q.errPx;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
  renderer.toneMapping = THREE.NoToneMapping;          // tone mapping (AgX) happens in the output pass
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // fonts used inside canvas textures
  try { await Promise.race([Promise.all([document.fonts.load('800 190px "Big Shoulders Stencil Display"'), document.fonts.load('600 64px "Noto Sans Kannada"', 'ವಿಸರ್ಜನೆ'), document.fonts.load('500 30px Jost')]), new Promise(r => setTimeout(r, 2200))]); } catch (e) { }

  const scene = new THREE.Scene();
  const now = new Date(); S.t = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  // coming back from a quality change: pick up where the viewer was
  try { const r = JSON.parse(sessionStorage.getItem('samay.resume') || 'null'); sessionStorage.removeItem('samay.resume'); if (r && Date.now() - r.at < 60000) { S.t = r.t; PARAM.palette = r.palette || PARAM.palette; WX.mode = r.wx || WX.mode; } } catch (e) { }
  // each subsystem's objects carry its name in userData.sys, so the cost of every part of the world can be measured on its own
  const sys = (name, fn) => { const n0 = scene.children.length, r = fn(); for (let i = n0; i < scene.children.length; i++) scene.children[i].userData.sys = name; return r; };
  const TR = sys('terrain', () => buildTerrain(scene));
  const ST = sys('structures', () => buildStructures(scene, Q));
  const CT = sys('city', () => buildCity(scene, Q));
  const FO = sys('forest', () => buildForest(scene, Q));
  const TE = sys('temple', () => buildTemple(scene, Q, ST));
  const DE = sys('decor', () => buildDecor(scene, Q, ST, TE));
  const GR = sys('grass', () => buildGrass(scene, Q));
  const W = sys('crowd', () => buildPeople(scene, Q));
  const carving = carveStart();                          // the carved sheets are cut in background workers from here on
  const SK = sys('sky', () => buildSky(scene, Q));
  const LI = sys('light', () => buildLight(renderer, scene, SK, ST, CT, TR, Q)); SK.physK = LI.physK;
  SK.key.shadow.camera.up.set(0, 0, 1);                 // stable light-space basis through the noon zenith
  const CAM = buildCamera(renderer, Q); W.cam = CAM.cam;
  const PP = buildPost(renderer, scene, CAM.cam, Q);
  const NA = sys('nature', () => buildNature(scene, Q, SK));
  injectFog(scene); mark('world built');
  const scans = (SAFE.scans ? Promise.resolve(SAFE) : loadScans(scene, Q, renderer, FO, ST)).catch((e) => { SCAN.failed = true; diagNote('scan', String(e && e.message || e)); });   // photogrammetry streams in while the loading screen is up
  const ctx = { canvas, renderer, CAM, resize: null, applyQuality: null };
  let vw = 1, vh = 1;
  // dynamic resolution: scale multiplies the quality's pixel budget; the frame-time controller in step() moves it
  const DR = { scale: .85, base: 1, cool: 2.5, ft: 1000 / 60, miss: 0, vsync: 1000 / 60, hist: [], n: 0, slowT: 0, upT: 0, upWait: 2, lastUp: -99, atMin: 0, min: .55, cap30: false, dts: 0 };
  const outPR = () => Math.min(devicePixelRatio || 1, QUAL[PARAM.quality].pr);
  let IPR = 1, outKey = '';                                                  // IPR: pixel ratio the picture is drawn at
  ctx.resize = () => {
    const W0 = innerWidth, H0 = innerHeight; let w = W0, h = H0;
    const fr = PARAM.frame; if (fr !== 'fill') { const [a, b] = fr.split(':').map(Number), asp = a / b; if (W0 / H0 > asp) { h = H0; w = Math.round(H0 * asp); } else { w = W0; h = Math.round(W0 / asp); } }
    vw = w; vh = h;
    const o = outPR(), q = QUAL[PARAM.quality];
    DR.base = Math.min(1, Math.sqrt(q.mp * 1e6 / (w * h * o * o)));
    const rs = clamp(DR.base * DR.scale, .4, 1);
    IPR = o * rs;
    const key = `${w}x${h}@${o}`;                                            // the canvas is only touched when its own size changes
    if (key !== outKey) { outKey = key; renderer.setPixelRatio(o); renderer.setSize(w, h); }
    PP.composer.setPixelRatio(IPR); PP.composer.setSize(w, h);
    PP.up.enabled = rs < .985;
    DR.rs = rs; DR.cool = Math.max(DR.cool, .8);
    CAM.cam.aspect = w / h; CAM.cam.updateProjectionMatrix();
    const ps = h * IPR;
    NA.flies.U.uSize.value = ps; ST.diyas.flameU.uSize.value = ps; W.torch.U.uSize.value = ps; DE.bulbU.uSize.value = ps; SK.emberU.uSize.value = ps; SK.petalU.uSize.value = ps; SK.dustU.uSize.value = ps; CT.lamps.lampGlowU.uSize.value = ps;
  };
  ctx.applyQuality = () => {
    const q = QUAL[PARAM.quality]; CULL.dens = q.dens; CULL.errPx = q.errPx; PP.smaa.enabled = q.smaa; PP.fxaa.enabled = q.fxaa; if (q.ao) PP.sp.setAOSamples(q.ao);
    treeQuality(PARAM.quality);
    SK.key.castShadow = q.shadows > 0; if (q.shadows) { SK.key.shadow.mapSize.set(q.shadows, q.shadows); if (SK.key.shadow.map) { SK.key.shadow.map.dispose(); SK.key.shadow.map = null; } }
    ctx.resize();
  };
  addEventListener('resize', ctx.resize); ctx.resize(); treeQuality(PARAM.quality);
  setupDial(); setupControls(ctx);
  // warm-up: compile every material, upload every texture and build the post chain while the loading screen is up,
  // so no chapter stalls the first time it appears
  {
    // prime the sky, its physical LUT and the environment probe so materials compile with IBL from the start
    const w0 = chapterWeights(S.t, PARAM.soft), l0 = blendLook(w0);
    updateSky(SK, ST, S.t, 0, l0, w0, CAM.cam); LI.updateLUT(S.sunDir, l0.mie); LI.env.update(true); LI.updateProbe(SK.U, true); LI.probe.intensity = l0.envI;
    const hidden = []; scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const wasAfter = PP.after.enabled; PP.after.enabled = true;
    try { await renderer.compileAsync(scene, CAM.cam); } catch (e) { try { renderer.compile(scene, CAM.cam); } catch (e2) { } }
    const seen = new Set();
    scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) for (const key in m) { const v = m[key]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); try { renderer.initTexture(v); } catch (e) { } } } });
    paletteLUT('poster'); updatePalette(PP, w0);
    // run every post program once (AO, shafts, depth of field) so none compiles mid-show
    const sp = PP.sp, wasSh = sp.useSh;
    if (!SAFE.post) { sp.useAO = true; sp.useSh = true; sp.needDepth = true; sp.compU.uAO.value = 1; sp.maskU.uOnA.value = sp.maskU.uOnB.value = 1; PP.dof.enabled = true; PP.dof.set(CAM.cam, 10, 2); }
    try { PP.composer.render(1 / 60); } catch (e) { }
    sp.useSh = wasSh; sp.needDepth = false; PP.dof.enabled = false;
    hidden.forEach(o => { o.visible = false; }); PP.after.enabled = wasAfter;
  }
  mark('shaders warmed'); gpuSync('post-warm');
  // give the carving a moment to land before the curtain lifts (it keeps going in the background either way)
  try { await Promise.race([carving, new Promise(r => setTimeout(r, 2500))]); await Promise.race([scans, new Promise(r => setTimeout(r, 15000))]); } catch (e) { }
  mark(SCAN.ready ? 'scans ready' : 'scans late');
  if (SCAN.ready) {
    try { await renderer.compileAsync(scene, CAM.cam); } catch (e) { }
    gpuSync('scan-compile');
    // the scanned meshes' first draw (shadow programs, index buffers, textures) happens here, behind the loading screen and
    // into a small frame, rather than in the first seconds of the show. Colour first, then the shadow pass, each checked on its own
    try {
      const wasOn = CULL.on, shadowOn = SK.key.castShadow; CULL.on = false; CULL.warm = true;
      PP.composer.setPixelRatio(.2); PP.composer.setSize(vw, vh);
      SK.key.castShadow = false; fitShadow(SK, CAM.cam, CAM, 0); cullFrame(CAM.cam, SK.key, vh * IPR); PP.composer.render(1 / 60);
      if (gpuSync('scan-colour') && shadowOn) { SK.key.castShadow = true; fitShadow(SK, CAM.cam, CAM, QUAL[PARAM.quality].shadows); cullFrame(CAM.cam, SK.key, vh * IPR); PP.composer.render(1 / 60); gpuSync('scan-shadow'); }
      SK.key.castShadow = shadowOn; CULL.on = wasOn; CULL.warm = false; CULL.dirty = true; ctx.resize();
    } catch (e) { CULL.on = true; CULL.warm = false; diagNote('boot', 'scan warm-up: ' + (e.message || e)); }
    mark('scans warmed');
  }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }

  const scafM = new THREE.Matrix4(), scafP = V3(), scafS = V3(), AMBER = col('#ff8a2a'), DIYA = col('#ffae55'), LAMP = col('#ffb36a');
  const LINFO = { celVis: 0, celPos: V3(), portalI: 0, portalPos: V3(GEO.GATE.x, WHEEL_Y, GEO.GATE.z), portalCol: col('#ff8a2a') };
  let last = performance.now(), frames = 0, fpsT = 0, slow = 0;
  const G = ST.gate, gateBase = HP;
  window.__samay = { SCAN, IMP, HERITAGE, S, PARAM, DE, FO, GR, ST, CARVE, NA, WX, MOON, AMB, UI, LISTEN, CULL, cull: () => cullFrame(CAM.cam, SK.key, vh * IPR), SK, SIMP, simplifyGeometry, triCount, ipr: () => IPR, step: (ms) => step(ms), scene, setTime: (hh) => { S.t = wrap24(hh); S.travel = null; }, W, CAM, AUD, DR, renderer, lots: CT.lots, poseAt: (i, tt, r, orb) => { const o0 = W.orb; if (orb !== undefined) W.orb = orb; pose(W, i, tt, r, PO); W.orb = o0; return [PO.x, PO.z, PO.act]; }, PP, LI, TONE, QUAL, LOOKS, HFOG, ctx };
  // one failing step must never freeze the scene: report it once, keep the loop alive
  UI.errs = UI.errs || {};
  const reportOnce = (key, e) => {
    console.error(e); diagNote(key, ((e && e.stack) || String(e)).split('\n').slice(0, 3).join(' | '));
    UI.errN = (UI.errN || 0) + 1;
    if (!UI.errs[key]) { UI.errs[key] = 1; toast(`Something went wrong (${(e && e.message) || e}). The scene keeps running; reload the page if it looks wrong.`, 9000); }
    if (UI.errN === 30) diagShow('The scene keeps hitting an error', 'Copy the details below and send them over, then reload.');
  };
  // numbers that must stay finite; a NaN in any of them turns the whole picture black
  const _hp = new THREE.Vector3();
  const health = () => {
    const bad = [];
    for (const k of ['t', 'rt', 'beatPos', 'beat', 'pulse', 'bass', 'level', 'bpm']) if (!Number.isFinite(S[k])) { bad.push('S.' + k + '=' + S[k]); S[k] = k === 'bpm' ? 100 : k === 't' ? 12 : 0; }
    const cp = CAM.cam.position; if (!Number.isFinite(cp.x + cp.y + cp.z)) { bad.push('camera'); CAM.booted = false; cp.set(0, 20, 60); CAM.pos.copy(cp); CAM.look.set(0, 10, 0); }
    const ex = PP.grade.uniforms.uExpo; if (!Number.isFinite(ex.value)) { bad.push('exposure'); ex.value = 1; }
    if (bad.length) { UI.nanN = (UI.nanN || 0) + 1; if (UI.nanN < 6) diagNote('nan', bad.join(', ')); }
  };
  // a cheap look at the finished frame every few seconds: a sustained all-black picture gets reported
  const probe = new Uint8Array(4 * 16);
  const blackCheck = () => {
    const gl = renderer.getContext(), c = renderer.domElement; let sum = 0;
    for (let i = 0; i < 16; i++) { gl.readPixels(((i % 4) + .5) / 4 * c.width | 0, ((i >> 2) + .5) / 4 * c.height | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe.subarray(i * 4, i * 4 + 4)); sum += probe[i * 4] + probe[i * 4 + 1] + probe[i * 4 + 2]; }
    DIAG.blackN = sum < 6 && PP.grade.uniforms.uExpo.value > .2 ? DIAG.blackN + 1 : 0;
    if (DIAG.blackN === 3 && !DIAG.shown) { diagNote('black', `frame black; expo ${PP.grade.uniforms.uExpo.value.toFixed(2)}, cam ${CAM.cam.position.toArray().map(v => v.toFixed(1)).join(',')}`); diagShow('The picture went black', 'Copy the details below and send them over. Reloading usually brings the scene back.'); }
  };
  // the browser can drop the WebGL context (driver reset, memory pressure, a device sleeping): restore instead of going blank
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); UI.glLost = true; if (BOOT.lost) return; toast('The browser reset the graphics. Restoring the scene…', 4000);
    diagNote('webgl', 'context lost');
    // if the browser doesn't give the graphics back, start again one quality step lower, once; after that, say what happened
    setTimeout(() => {
      if (!UI.glLost) return;
      try {
        const at = +sessionStorage.getItem('samay.recover') || 0;
        if (Date.now() - at > 120000) {
          sessionStorage.setItem('samay.recover', String(Date.now()));
          const next = PARAM.quality === 'high' ? 'med' : 'low';
          try { localStorage.setItem('samay.quality', next); sessionStorage.setItem('samay.resume', JSON.stringify({ at: Date.now(), t: S.t, palette: PARAM.palette, wx: WX.mode })); } catch (x) { }
          const u = new URL(location.href); u.searchParams.set('q', next); u.hash = '';
          toast(`The browser reset the graphics. Starting again at ${next === 'low' ? 'Low' : 'Medium'} quality…`, 3000);
          setTimeout(() => location.replace(u.toString()), 900); return;
        }
      } catch (x) { }
      diagShow('The graphics card dropped the scene', 'The browser reset the graphics and they did not come back. Reload the page; if it keeps happening, pick Medium or Low quality.');
    }, 5000);
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    UI.glLost = false; LI.lastY = -9; try { LI.env.update(true); ctx.resize(); } catch (e) { }
    toast('Scene restored', 1600);
  }, false);
  let lastRaf = performance.now(), rafId = 0;
  function frame(nowMs) {
    lastRaf = performance.now();
    if (DIAG.rafPausedAt) { diagNote('stall', `animation frames resumed after ${((lastRaf - DIAG.rafPausedAt) / 1000).toFixed(1)} s (focus ${document.hasFocus() ? 'yes' : 'no'})`); DIAG.rafPausedAt = 0; }
    rafId = requestAnimationFrame(frame);
    try { step(nowMs); } catch (e) { reportOnce('frame', e); }
  }
  // if the browser stops sending animation frames while the page is on screen, note it and keep re-arming the frame
  // loop so a dropped request can never freeze the scene. (Drawing from a timer instead was tried: on a slow GPU it
  // competes with the real frame loop and makes frames rarer, so the timer only re-arms.)
  setInterval(() => {
    const tNow = performance.now();
    if (!UI.started || document.visibilityState !== 'visible' || tNow - lastRaf < 800) return;
    if (!DIAG.rafPausedAt) { DIAG.rafPausedAt = lastRaf; diagNote('stall', `the browser paused animation frames (focus ${document.hasFocus() ? 'yes' : 'no'})`); }
    if (tNow - (DIAG.rearmAt || 0) > 1500) { DIAG.rearmAt = tNow; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame); }
  }, 250);
  function step(nowMs) {
    const rawMs = nowMs - last;
    if (LISTEN.asleep) { last = nowMs; return; }            // the sleep timer ran out: rest until someone moves
    // frames land on the display's refresh ticks, so a steady 60 Hz can still arrive as 16/33/16/17 ms; time is advanced by a
    // lightly smoothed step (long stalls pass straight through) so motion stays even instead of pulsing with the jitter
    const dtRaw = Math.min(.1, Math.max(.001, rawMs / 1000)); last = nowMs;
    DR.dts = DR.dts ? DR.dts + (dtRaw - DR.dts) * .3 : dtRaw;
    const dt = window.__fixedDt || (dtRaw > DR.dts * 2.5 ? dtRaw : DR.dts);
    // dynamic resolution: trade pixels for a steady frame rate. The target is the display's own refresh interval
    if (!window.__fixedDt && !window.__noAdapt && document.visibilityState === 'visible' && rawMs < 250) {
      DR.cool -= dt;
      DR.hist.push(rawMs); if (DR.hist.length > 240) DR.hist.shift();
      if (++DR.n % 30 === 0 && DR.hist.length >= 90) {
        // refresh rate: the fastest steady cadence seen (frames can only arrive on a tick). 60 Hz is the floor unless a locked 30 fps is proven
        const sorted = [...DR.hist].sort((a, b) => a - b), p10 = sorted[Math.floor(sorted.length * .1)], p90 = sorted[Math.floor(sorted.length * .9)];
        const snap = [6.94, 8.33, 11.11, 13.89, 16.67].find((v) => Math.abs(p10 - v) / v < .09);
        DR.vsync = DR.cap30 ? 33.33 : clamp(snap || p10, 6.5, 16.67);
        if (!DR.cap30 && DR.scale <= DR.min + .01 && p10 > 30 && p90 - p10 < 4) { DR.cap30 = true; DR.vsync = 33.33; DR.scale = 1; DR.atMin = 0; ctx.resize(); }   // the browser hands out 30 fps frames: that is the pace, not a load problem
      }
      if (DR.cool > 0) { DR.ft = DR.vsync; DR.miss = 0; }
      else {
        DR.ft += (rawMs - DR.ft) * .08; DR.miss += ((rawMs > DR.vsync * 1.35 ? 1 : 0) - DR.miss) * .05;
        const over = DR.ft > DR.vsync * 1.18 || DR.miss > .12;
        if (over) {
          DR.upT = 0; DR.slowT += dt;
          if (DR.slowT > .7) {
            if (DR.scale > DR.min + .005) {
              // cost follows pixels, i.e. scale squared: step by the square root of the overload
              DR.scale = Math.max(DR.min, Math.round(DR.scale * clamp(Math.sqrt(DR.vsync / DR.ft), .8, .95) * 50) / 50);
              DR.upWait = S.rt - DR.lastUp < 12 ? Math.min(40, DR.upWait * 1.8) : 4;   // an attempt to go back up failed: wait longer next time
              ctx.resize(); DR.cool = 1.4;
            }
            DR.slowT = 0;
          }
          if (DR.scale <= DR.min + .01) {
            DR.atMin += dt;
            if (DR.atMin > 8 && !PARAM.qualityPinned && PARAM.quality !== 'low') { PARAM.quality = PARAM.quality === 'high' ? 'med' : 'low'; $('sQual').value = PARAM.quality; ctx.applyQuality(); DR.atMin = 0; DR.scale = 1; ctx.resize(); toast('Lowered render quality to keep things smooth (pick a quality in the panel to keep it)', 3200); }
          } else DR.atMin = 0;
        } else {
          DR.slowT = Math.max(0, DR.slowT - dt); DR.atMin = 0;
          if (DR.scale < 1 && DR.miss < .02 && DR.ft < DR.vsync * 1.1) {
            DR.upT += dt;
            if (DR.upT > DR.upWait) { DR.scale = Math.min(1, DR.scale + .05); DR.upT = 0; DR.lastUp = S.rt; ctx.resize(); DR.cool = 1.2; }
          } else DR.upT = 0;
        }
      }
    }
    S.dt = dt; S.rt += dt;
    // clock
    if (S.travel) { const f = (S.rt - S.travel.t0) / S.travel.dur; if (f >= 1) { S.t = wrap24(S.travel.to); S.travel = null; } else S.t = wrap24(lerp(S.travel.from, S.travel.to, easeIO(f))); }
    else if (PARAM.clock) { const d = new Date(); S.t = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + d.getMilliseconds() / 3.6e6; }
    else if (PARAM.playing) S.t = wrap24(S.t + dt * 24 / (PARAM.dayMinutes * 60));
    const t = S.t, h = wrap24(t), rt = S.rt;
    const w = chapterWeights(t, PARAM.soft), look = blendLook(w);
    updateWeather(dt, h); applyWeather(look);
    const ch = chapterAt(t);
    // music / beat
    let audioOk = AUD.on;
    if (AUD.on) { try { audioFrame(w, BPM); } catch (e) { audioOk = false; reportOnce('audio', e); } }
    // one continuous beat clock for the dancers: free-running without sound, phase-locked to the engine's bar when playing
    if (!audioOk) { let b = 0; for (let k = 0; k < 8; k++) b += w[k] * BPM[k]; S.bpm = b; S.beatPos += dt * b / 60; S.beat = fract(S.beatPos); S.pulse = Math.pow(1 - S.beat, 6) * (1 - w[3]) * .8; }
    else { S.beatPos += dt * S.bpm / 60; if (S.beatAud >= 0) { let e = S.beatAud - S.beatPos; e -= Math.round(e / 4) * 4; S.beatPos += e * Math.min(1, dt * 3); } }
    // camera, sky, lights
    updateCamera(CAM, W, dt, rt, t);
    if (GR) GR.update(CAM.cam, rt);
    updateSky(SK, ST, t, rt, look, w, CAM.cam);
    updateNature(NA, SK, CAM.cam, dt, rt, h, look);
    if (SCAN.ready) scanFrame(SK, look);
    if (S.physW > .001) LI.updateLUT(S.sunDir, look.mie);
    LI.env.update(false); LI.updateProbe(SK.U, false); LI.probe.intensity = look.envI;
    fitShadow(SK, CAM.cam, CAM, QUAL[PARAM.quality].shadows);
    cullFrame(CAM.cam, SK.key, vh * IPR);               // only the scanned pieces the camera or the shadow box can see, at the right detail
    // portal gate
    const comp = gateCompletion(W, t);
    const dusk = h > 12 ? smooth(17.2, 18.3, h) : 1 - smooth(5.6, 7.0, h);
    const portalI = comp * dusk * (.3 + .7 * (w[0] + w[1] * .55 + w[7] * .8 + w[2] * .4)) * (1 + S.pulse * .25);
    G.portalU.uI.value = portalI; G.portalU.uTime.value = rt; G.portalU.uCol.value.copy(look.practical).lerp(AMBER, w[0] * .6);
    G.gateLight.intensity = portalI * 60; G.gateLight.color.copy(G.portalU.uCol.value);
    LINFO.portalI = portalI; LINFO.portalCol.copy(G.portalU.uCol.value);
    LINFO.celPos.copy(ST.celestial.group.position); LINFO.celVis = ST.celestial.group.visible ? ST.celestial.celMat.opacity * clamp(ST.celestial.corU.uI.value, 0, 1) : 0;
    // arches rise at dawn
    const rise = smooth(5.2, 6.35, h) * (1 - smooth(9.3, 10.4, h));
    const AR = ST.arches.group; AR.visible = rise > .002; AR.position.y = HP - 36 * (1 - easeIO(rise));
    ST.M.marble.emissiveIntensity = ST.M.marbleBlock.emissiveIntensity = look.archGlow * .1 + S.flash * .5;
    ST.M.gold.emissiveIntensity = look.archGlow * .45 + S.flash;
    // banners, stage strips, diyas, synth, rangoli
    ST.banners.bannerU.uTime.value = rt; ST.banners.bannerMat.color.copy(look.banner);
    ST.stage.stripMat.color.copy(look.strip).multiplyScalar(look.stripI * 2.4 * (1 + S.pulse * 1.2) * (.25 + .75 * dusk));
    ST.stage.knobMat.color.copy(look.strip).multiplyScalar(1.5 + S.pulse * 2);
    ST.diyas.flameU.uLit.value = dusk; ST.diyas.flameU.uTime.value = rt;
    POOLU.uPoolA.value.copy(DIYA).multiplyScalar(dusk * 4.4 * (.6 + .4 * look.fire));
    POOLU.uPoolC.value.copy(ST.stage.stripMat.color).multiplyScalar(.9);
    ST.ridge.synthKnobMat.color.setRGB(1, .6, .3).multiplyScalar(.6 + (w[2] + w[3]) * 2 + S.pulse);
    ST.rangoliMat.opacity = smooth(5.6, 6.6, h) * (1 - smooth(10.5, 12, h)) * .9;
    // scaffolding while the ring is rebuilt
    const scafAmt = smooth(14.3, 15.0, h) * (1 - smooth(17.9, 18.5, h));
    G.scaf.visible = scafAmt > .005;
    if (G.scaf.visible) { G.scafList.forEach((b, j) => { scafP.copy(b.mid); scafP.y = gateBase + (b.mid.y - gateBase) * scafAmt; scafS.copy(b.s); scafS.y *= scafAmt; scafM.compose(scafP, b.q, scafS); G.scaf.setMatrixAt(j, scafM); }); G.scaf.instanceMatrix.needsUpdate = true; }
    // city lights
    const night = clamp(1 - smooth(6.0, 7.2, h) + smooth(17.8, 19.0, h), 0, 1);
    CT.facade.uNight.value = night; CT.lamps.headMat.color.setRGB(1, .7, .4).multiplyScalar(.15 + night * 2.2); CT.lamps.lampGlowU.uI.value = night * .9;
    POOLU.uPoolB.value.copy(LAMP).multiplyScalar(night * 3.2);
    DE.bulbU.uLit.value = night; DE.bulbU.uTime.value = rt;
    for (const m of CT.shopSigns) m.emissiveIntensity = night * .35;
    DE.uvU.value = night * (w[2] * 1.7 + w[1] * .7 + w[3] * .6 + w[0] * .35);
    FO.windU.uTime.value = rt;
    // population
    const N = Math.min(NMAX, PARAM.population);
    W.lit = dusk; W.torch.U.uTime.value = rt;
    const tp0 = performance.now();
    updatePeople(W, G, t, rt, dt, N, S.beat, PARAM.energy * (1 + S.pulse * .3));
    S.msPeople = lerp(S.msPeople || 0, performance.now() - tp0, .1);
    const trailSec = (.18 + .55 * PARAM.trails) * look.ghost;
    updateTrails(W, N, trailSec, clamp(.34 * PARAM.trails * look.ghost, 0, .8));
    updateAutos(CT, t, rt);
    updateStreaks(SK, look, rt, S.pulse);
    W.bodyMat.color.copy(look.pTint).multiplyScalar(1.35); W.bodyMat.emissive.copy(look.pEmis).multiplyScalar(look.pEmisI * (1 + S.pulse * .6));
    W.trailMat.color.copy(look.pTint).multiplyScalar(1.25); W.trailMat.emissive.copy(look.pEmis).multiplyScalar(look.pEmisI * .75);
    // post + render
    const kd = 1 - Math.exp(-dt * 2.5);
    const kdk = CAM.snapped ? 1 : kd;
    PP.dofK = lerp(PP.dofK, CAM.dofK * vh * IPR / 1080, kdk); PP.dofF = lerp(PP.dofF, CAM.dofF, kdk);
    updatePost(PP, look, rt, vw * IPR, vh * IPR, CAM.cam, LINFO);
    if (updateFusion(PP, w, CAM.cam, rt)) PP.sp.needDepth = true;   // the ink lines read the depth buffer
    updatePalette(PP, w);
    listenTick(dt); if (LISTEN.fade < 1) PP.grade.uniforms.uExpo.value *= LISTEN.fade * LISTEN.fade;
    health();
    PP.composer.render(dt);
    diagFrame();
    if ((UI.frameN || 0) < 3 && !window.__fixedDt) gpuSync('frame ' + ((UI.frameN || 0) + 1));
    if ((UI.frameN = (UI.frameN || 0) + 1) % 180 === 0 && !window.__fixedDt) { try { blackCheck(); } catch (e) { } }
    if (UI.wantStill) { UI.wantStill = false; grabStill(canvas); }
    if (UI.wantCard) { UI.wantCard = false; try { grabPostcard(canvas); } catch (e) { reportOnce('card', e); } }
    if (!UI.started) { UI.started = true; try { localStorage.removeItem('samay.boot'); } catch (e) { } mark('first frame'); if (SAFE.lvl) setTimeout(() => toast(SAFE.lvl === 1 ? 'The graphics reset while starting, so this start runs without shadows. Add ?safe=0 to the link to try again with them.' : 'The graphics reset while starting, so this start runs at Low quality. Add ?safe=0 to the link to try again.', 9000), 1800); else if (QPICK.stepped) setTimeout(() => toast('The last start did not finish, so this one runs at a lighter quality. You can change it under Controls → Render quality.', 8000), 1800); $('loading').classList.add('done'); setTimeout(() => { if (!AUD.on && !QPICK.stepped && !SAFE.lvl) toast('Press Sound (or S) for the raga music · keys 1–8 travel between chapters', 5200); }, 3200); }
    updateHUD(ch);
  }
  rafId = requestAnimationFrame((ms) => { last = ms; frame(ms); });
}
boot();
