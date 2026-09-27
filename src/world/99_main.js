/* =========================================================================
   BOOT + LOOP
   ========================================================================= */
const QUAL = {
  low: { pr: 1, tex: 1024, shadows: 0, trees: .55, treeShadows: false, smaa: false, ao: 0, shafts: false, dof: false, grass: 0 },
  med: { pr: 1.25, tex: 1024, shadows: 2048, trees: .85, treeShadows: false, smaa: true, ao: 8, shafts: true, dof: true, grass: 124 },
  high: { pr: 2, tex: 2048, shadows: 4096, trees: 1, treeShadows: true, smaa: true, ao: 12, shafts: true, dof: true, grass: 190 },
};
async function boot() {
  const canvas = $('gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }); }
  catch (e) { $('glerr').classList.add('on'); $('loading').classList.add('done'); return; }
  const Q = { ...QUAL[PARAM.quality] };
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
  renderer.toneMapping = THREE.NoToneMapping;          // tone mapping (AgX) happens in the output pass
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // fonts used inside canvas textures
  try { await Promise.race([Promise.all([document.fonts.load('800 190px "Big Shoulders Stencil Display"'), document.fonts.load('600 64px "Noto Sans Kannada"', 'ವಿಸರ್ಜನೆ'), document.fonts.load('500 30px Jost')]), new Promise(r => setTimeout(r, 2200))]); } catch (e) { }

  const scene = new THREE.Scene();
  const now = new Date(); S.t = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  // coming back from a quality change: pick up where the viewer was
  try { const r = JSON.parse(sessionStorage.getItem('samay.resume') || 'null'); sessionStorage.removeItem('samay.resume'); if (r && Date.now() - r.at < 60000) { S.t = r.t; PARAM.palette = r.palette || PARAM.palette; WX.mode = r.wx || WX.mode; } } catch (e) { }
  const TR = buildTerrain(scene);
  const ST = buildStructures(scene, Q);
  const CT = buildCity(scene, Q);
  const FO = buildForest(scene, Q);
  const TE = buildTemple(scene, Q, ST);
  const DE = buildDecor(scene, Q, ST, TE);
  const GR = buildGrass(scene, Q);
  const W = buildPeople(scene, Q);
  const carving = carveStart();                          // the carved sheets are cut in background workers from here on
  const SK = buildSky(scene, Q);
  const LI = buildLight(renderer, scene, SK, ST, CT, TR, Q); SK.physK = LI.physK;
  SK.key.shadow.camera.up.set(0, 0, 1);                 // stable light-space basis through the noon zenith
  const CAM = buildCamera(renderer, Q); W.cam = CAM.cam;
  const PP = buildPost(renderer, scene, CAM.cam, Q);
  const NA = buildNature(scene, Q, SK);
  injectFog(scene);
  const ctx = { canvas, renderer, CAM, resize: null, applyQuality: null };
  let vw = 1, vh = 1;
  const DR = { scale: 1, slowT: 0, fastT: 0, cool: 2, lowT: 0 };            // dynamic resolution
  const basePR = () => Math.min(devicePixelRatio || 1, QUAL[PARAM.quality].pr);
  ctx.resize = () => {
    const W0 = innerWidth, H0 = innerHeight; let w = W0, h = H0;
    const fr = PARAM.frame; if (fr !== 'fill') { const [a, b] = fr.split(':').map(Number), asp = a / b; if (W0 / H0 > asp) { h = H0; w = Math.round(H0 * asp); } else { w = W0; h = Math.round(W0 / asp); } }
    vw = w; vh = h;
    renderer.setPixelRatio(basePR() * DR.scale);
    renderer.setSize(w, h); PP.composer.setPixelRatio(renderer.getPixelRatio()); PP.composer.setSize(w, h);
    CAM.cam.aspect = w / h; CAM.cam.updateProjectionMatrix();
    const ps = h * renderer.getPixelRatio();
    NA.flies.U.uSize.value = ps; ST.diyas.flameU.uSize.value = ps; W.torch.U.uSize.value = ps; DE.bulbU.uSize.value = ps; SK.emberU.uSize.value = ps; SK.petalU.uSize.value = ps; SK.dustU.uSize.value = ps; CT.lamps.lampGlowU.uSize.value = ps;
  };
  ctx.applyQuality = () => {
    const q = QUAL[PARAM.quality]; PP.smaa.enabled = q.smaa; if (q.ao) PP.sp.setAOSamples(q.ao);
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
    const sp = PP.sp, wasSh = sp.useSh; sp.useAO = true; sp.useSh = true; sp.needDepth = true; sp.compU.uAO.value = 1; sp.maskU.uOnA.value = sp.maskU.uOnB.value = 1; PP.dof.enabled = true; PP.dof.set(CAM.cam, 10, 2);
    try { PP.composer.render(1 / 60); } catch (e) { }
    sp.useSh = wasSh; sp.needDepth = false; PP.dof.enabled = false;
    hidden.forEach(o => { o.visible = false; }); PP.after.enabled = wasAfter;
  }
  // give the carving a moment to land before the curtain lifts (it keeps going in the background either way)
  try { await Promise.race([carving, new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }

  const scafM = new THREE.Matrix4(), scafP = V3(), scafS = V3(), AMBER = col('#ff8a2a'), DIYA = col('#ffae55'), LAMP = col('#ffb36a');
  const LINFO = { celVis: 0, celPos: V3(), portalI: 0, portalPos: V3(GEO.GATE.x, WHEEL_Y, GEO.GATE.z), portalCol: col('#ff8a2a') };
  let last = performance.now(), frames = 0, fpsT = 0, slow = 0;
  const G = ST.gate, gateBase = HP;
  window.__samay = { S, PARAM, DE, FO, GR, ST, CARVE, NA, WX, MOON, AMB, scene, setTime: (hh) => { S.t = wrap24(hh); S.travel = null; }, W, CAM, AUD, DR, renderer, lots: CT.lots, poseAt: (i, tt, r, orb) => { const o0 = W.orb; if (orb !== undefined) W.orb = orb; pose(W, i, tt, r, PO); W.orb = o0; return [PO.x, PO.z, PO.act]; }, PP, LI, TONE, QUAL, LOOKS, HFOG, ctx };
  // one failing step must never freeze the scene: report it once, keep the loop alive
  UI.errs = UI.errs || {};
  const reportOnce = (key, e) => { console.error(e); if (!UI.errs[key]) { UI.errs[key] = 1; toast(`Something went wrong (${(e && e.message) || e}). The scene keeps running; reload the page if it looks wrong.`, 9000); } };
  // the browser can drop the WebGL context (driver reset, memory pressure, a device sleeping): restore instead of going blank
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); UI.glLost = true; toast('The browser reset the graphics. Restoring the scene…', 4000);
    setTimeout(() => { if (UI.glLost) toast('The graphics did not come back. Reload the page to restore the scene.', 12000); }, 6000);
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    UI.glLost = false; LI.lastY = -9; try { LI.env.update(true); ctx.resize(); } catch (e) { }
    toast('Scene restored', 1600);
  }, false);
  function frame(nowMs) {
    requestAnimationFrame(frame);
    try { step(nowMs); } catch (e) { reportOnce('frame', e); }
  }
  function step(nowMs) {
    const rawMs = nowMs - last;
    if (LISTEN.asleep) { last = nowMs; return; }            // the sleep timer ran out: rest until someone moves
    const dt = window.__fixedDt || Math.min(.1, Math.max(.001, rawMs / 1000)); last = nowMs;
    // dynamic resolution: trade pixels for a steady frame rate
    if (!window.__fixedDt && !window.__noAdapt && document.visibilityState === 'visible' && rawMs < 250) {
      DR.cool -= dt;
      if (rawMs > 21) DR.slowT += dt; else DR.slowT = Math.max(0, DR.slowT - dt * .5);
      if (rawMs < 18.5) DR.fastT += dt; else DR.fastT = 0;
      if (DR.cool <= 0 && DR.slowT > 1.2) {
        if (DR.scale > .56) { DR.scale = Math.max(.55, DR.scale - .12); ctx.resize(); }
        else if (!PARAM.qualityPinned && PARAM.quality !== 'low' && (DR.lowT += 1) > 3) { PARAM.quality = PARAM.quality === 'high' ? 'med' : 'low'; $('sQual').value = PARAM.quality; ctx.applyQuality(); DR.lowT = 0; toast('Lowered render quality to keep things smooth (pick a quality in the panel to keep it)', 3200); }
        DR.cool = 1.6; DR.slowT = 0;
      } else if (DR.cool <= 0 && DR.fastT > 6 && DR.scale < 1) { DR.scale = Math.min(1, DR.scale + .08); ctx.resize(); DR.cool = 3; DR.fastT = 0; }
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
    if (S.physW > .001) LI.updateLUT(S.sunDir, look.mie);
    LI.env.update(false); LI.updateProbe(SK.U, false); LI.probe.intensity = look.envI;
    fitShadow(SK, CAM.cam, CAM, QUAL[PARAM.quality].shadows);
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
    PP.dofK = lerp(PP.dofK, CAM.dofK * vh * renderer.getPixelRatio() / 1080, kdk); PP.dofF = lerp(PP.dofF, CAM.dofF, kdk);
    updatePost(PP, look, rt, vw * renderer.getPixelRatio(), vh * renderer.getPixelRatio(), CAM.cam, LINFO);
    updatePalette(PP, w);
    listenTick(dt); if (LISTEN.fade < 1) PP.grade.uniforms.uExpo.value *= LISTEN.fade * LISTEN.fade;
    PP.composer.render(dt);
    if (UI.wantStill) { UI.wantStill = false; grabStill(canvas); }
    if (UI.wantCard) { UI.wantCard = false; try { grabPostcard(canvas); } catch (e) { reportOnce('card', e); } }
    if (!UI.started) { UI.started = true; $('loading').classList.add('done'); setTimeout(() => { if (!AUD.on) toast('Press Sound (or S) for the raga music · keys 1–8 travel between chapters', 5200); }, 3200); }
    updateHUD(ch);
  }
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
}
boot();
