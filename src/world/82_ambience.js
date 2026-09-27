/* =========================================================================
   SOUNDS OF THE HOUR — a synthesised soundscape under the ragas, following
   the clock and the weather: crickets and owls at night, temple bells and a
   conch before dawn, koels and songbirds in the morning, crows and the far
   hum of the city by day, birds settling at dusk, fire crackle by the torches,
   the murmur of the crowd at the gathering, rain, frogs and thunder in the
   monsoon. Nothing is sampled: every sound is built from oscillators and noise.
   ========================================================================= */
const AMB = { ready: false, next: {}, rate: {}, lvl: {}, thunderQ: [] };
function ambInit() {
  const c = AUD.ctx, g = (v = 0) => { const n = c.createGain(); n.gain.value = v; return n; };
  AMB.bus = g(PARAM.amb * 3.2); AMB.bus.connect(AUD.master);
  AMB.verb = g(.35); AMB.bus.connect(AMB.verb); AMB.verb.connect(AUD.verbIn);
  const noise = (lp, hp, q = .7, bp) => {
    const s = c.createBufferSource(); s.buffer = AUD.noise; s.loop = true; s.loopStart = Math.random() * .5; s.start(0, Math.random());
    let n = s;
    if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.Q.value = q; n.connect(f); n = f; }
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q; n.connect(f); n = f; }
    if (bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; n.connect(f); n = f; AMB.lastBP = f; }
    return n;
  };
  const bed = (name, node, pan = 0) => { const gg = g(0), p = c.createStereoPanner(); p.pan.value = pan; node.connect(gg); gg.connect(p); p.connect(AMB.bus); AMB.lvl[name] = gg; return gg; };
  // beds
  const wind = noise(0, 0, .6, 520); AMB.windBP = AMB.lastBP; bed('wind', wind, -.2);
  bed('city', noise(210, 30, .5), .15); const far = noise(0, 0, 1.2, 950); AMB.farBP = AMB.lastBP; bed('traffic', far, .3);
  bed('rain', noise(7200, 650, .5), 0); bed('rainLow', noise(380, 60, .5), 0);
  const crowd = noise(0, 0, .9, 520); AMB.crowdBP = AMB.lastBP; bed('crowd', crowd, -.1);
  // crickets: a few voices, each a tone gated by a fast pulse and a slower chirp rhythm
  const cr = g(0); AMB.lvl.crickets = cr; cr.connect(AMB.bus);
  for (const [f, pr, cr2, pan] of [[4300, 29, 1.7, -.5], [4750, 33, 2.3, .4], [5150, 24, 1.1, .1], [3900, 21, 2.9, -.2]]) {
    const o = c.createOscillator(); o.frequency.value = f; o.start();
    const a = g(0), b = g(0), p = c.createStereoPanner(); p.pan.value = pan;
    const l1 = c.createOscillator(); l1.type = 'square'; l1.frequency.value = pr; const l1g = g(.5); l1.connect(l1g); l1g.connect(a.gain); a.gain.value = .5; l1.start();
    const l2 = c.createOscillator(); l2.type = 'square'; l2.frequency.value = cr2; const l2g = g(.5); l2.connect(l2g); l2g.connect(b.gain); b.gain.value = .5; l2.start();
    o.connect(a); a.connect(b); b.connect(p); const v = g(.045); p.connect(v); v.connect(cr);
  }
  AMB.ready = true;
}
const _amb = (t, f) => { const c = AUD.ctx, p = c.createStereoPanner(); p.pan.value = Math.random() * 1.6 - .8; p.connect(AMB.bus); return p; };
const expR = (rate) => -Math.log(1 - Math.random()) / Math.max(rate, 1e-6);
/* ---------- the calls ---------- */
const CALLS = {
  owl(t) {       // a spotted owlet's hoots, far off
    const c = AUD.ctx, out = _amb(t), lp = c.createBiquadFilter(); lp.frequency.value = 900; lp.connect(out);
    for (const [dt, f] of [[0, 400], [.52, 385], [.82, 380]]) { const o = osc('sine', f, t + dt, t + dt + .5), gg = c.createGain(); o.frequency.exponentialRampToValueAtTime(f * .86, t + dt + .38); env(gg.gain, t + dt, .05, .07, .38); o.connect(gg); gg.connect(lp); }
  },
  koel(t) {      // the koel's rising "ku-oo", climbing with each repeat
    const c = AUD.ctx, out = _amb(t), n = 4 + (Math.random() * 4 | 0), f0 = 780 + Math.random() * 80;
    for (let i = 0; i < n; i++) { const tt = t + i * .62, f = f0 * Math.pow(1.055, i), o = osc('sine', f * .8, tt, tt + .5), gg = c.createGain();
      o.frequency.linearRampToValueAtTime(f * 1.28, tt + .1); o.frequency.linearRampToValueAtTime(f * 1.22, tt + .42); env(gg.gain, tt, .03, .05 + i * .006, .4); o.connect(gg); gg.connect(out); }
  },
  chirps(t) {    // a songbird: a burst of quick sweeps
    const c = AUD.ctx, out = _amb(t), n = 3 + (Math.random() * 6 | 0), f0 = 2400 + Math.random() * 2600, up = Math.random() < .5;
    for (let i = 0; i < n; i++) { const tt = t + i * (.07 + Math.random() * .06), f = f0 * (1 + (Math.random() - .5) * .25), o = osc('sine', up ? f * .7 : f * 1.3, tt, tt + .12), gg = c.createGain();
      o.frequency.exponentialRampToValueAtTime(up ? f * 1.35 : f * .75, tt + .06); env(gg.gain, tt, .005, .018, .07); o.connect(gg); gg.connect(out); }
  },
  crow(t) {      // a house crow: two or three hoarse caws
    const c = AUD.ctx, out = _amb(t), n = 1 + (Math.random() * 3 | 0), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 2.2; bp.connect(out);
    for (let i = 0; i < n; i++) { const tt = t + i * .38, f = 420 + Math.random() * 60, o = osc('sawtooth', f, tt, tt + .3), gg = c.createGain(); o.frequency.linearRampToValueAtTime(f * .82, tt + .22);
      const nz = c.createBufferSource(); nz.buffer = AUD.noise; nz.start(tt, Math.random()); nz.stop(tt + .3); const ng = c.createGain(); ng.gain.value = .35; nz.connect(ng); ng.connect(gg);
      env(gg.gain, tt, .015, .05, .2); o.connect(gg); gg.connect(bp); }
  },
  bells(t) {     // a temple bell rung for a while (aarti), heard across the valley
    const c = AUD.ctx, out = _amb(t), lp = c.createBiquadFilter(); lp.frequency.value = 3200; lp.connect(out); const f = 560 + Math.random() * 180, n = 8 + (Math.random() * 14 | 0);
    for (let i = 0; i < n; i++) { const tt = t + i * (.85 + Math.random() * .3), a = .02 * (1 - i / n * .5);
      for (const [m, d, k] of [[1, 3.2, 1], [2.76, 2, .5], [5.4, 1.1, .3], [8.93, .6, .15]]) { const o = osc('sine', f * m, tt, tt + d), gg = c.createGain(); env(gg.gain, tt, .003, a * k, d); o.connect(gg); gg.connect(lp); } }
  },
  conch(t) {     // a shankh blown before dawn and at dusk aarti
    const c = AUD.ctx, out = _amb(t), lp = c.createBiquadFilter(); lp.frequency.value = 1500; lp.Q.value = 1.4; lp.connect(out);
    for (const m of [1, 2.01, 3]) { const o = osc('sawtooth', 229 * m, t, t + 4.6), gg = c.createGain(); o.frequency.setValueAtTime(229 * m * .94, t); o.frequency.linearRampToValueAtTime(229 * m, t + .8);
      gg.gain.setValueAtTime(.0001, t); gg.gain.linearRampToValueAtTime(.022 / m, t + 1.2); gg.gain.setValueAtTime(.022 / m, t + 3.2); gg.gain.exponentialRampToValueAtTime(.0001, t + 4.5); o.connect(gg); gg.connect(lp); }
  },
  horn(t) {      // an auto-rickshaw or scooter horn, blocks away
    const c = AUD.ctx, out = _amb(t), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2; bp.connect(out); const f = 400 + Math.random() * 180, n = 1 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) { const tt = t + i * .2, o = osc('square', f, tt, tt + .16), o2 = osc('square', f * 1.26, tt, tt + .16), gg = c.createGain(); env(gg.gain, tt, .01, .012, .13); o.connect(gg); o2.connect(gg); gg.connect(bp); }
  },
  crackle(t) {   // torch and diya fire
    const c = AUD.ctx, out = _amb(t), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 2000; bp.Q.value = .9; bp.connect(out); const n = 2 + (Math.random() * 7 | 0);
    for (let i = 0; i < n; i++) { const tt = t + Math.random() * .45, s = c.createBufferSource(), gg = c.createGain(); s.buffer = AUD.noise; s.start(tt, Math.random()); s.stop(tt + .02); env(gg.gain, tt, .001, .05 + Math.random() * .08, .012); s.connect(gg); gg.connect(bp); }
  },
  frog(t) {      // monsoon frogs: pulsed croaks in a loose chorus
    const c = AUD.ctx, out = _amb(t), n = 2 + (Math.random() * 4 | 0), f = 380 + Math.random() * 260;
    for (let i = 0; i < n; i++) { const tt = t + i * (.35 + Math.random() * .2), o = osc('sawtooth', f, tt, tt + .3), am = osc('square', 26 + Math.random() * 10, tt, tt + .3), ag = c.createGain(), gg = c.createGain(), bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f * 1.6; bp.Q.value = 3; ag.gain.value = .5; am.connect(ag.gain); env(gg.gain, tt, .02, .035, .22); o.connect(bp); bp.connect(ag); ag.connect(gg); gg.connect(out); }
  },
  drip(t) {      // drops off leaves and eaves after rain
    const c = AUD.ctx, out = _amb(t), f = 1700 + Math.random() * 1800, o = osc('sine', f, t, t + .08), gg = c.createGain(); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + .03); env(gg.gain, t, .002, .02, .05); o.connect(gg); gg.connect(out);
  },
};
function ambThunder(delay, strength) { if (AMB.ready && AUD.on) AMB.thunderQ.push([AUD.ctx.currentTime + delay, clamp(strength, .15, 1)]); }
function thunder(t, k) {
  const c = AUD.ctx, out = _amb(t), s = c.createBufferSource(), lp = c.createBiquadFilter(), gg = c.createGain(), dur = 4 + k * 3;
  s.buffer = AUD.noise; s.loop = true; s.start(t, Math.random()); s.stop(t + dur + .5); lp.frequency.setValueAtTime(900 * k + 200, t); lp.frequency.exponentialRampToValueAtTime(90, t + dur);
  gg.gain.setValueAtTime(.0001, t); gg.gain.linearRampToValueAtTime(.5 * k, t + .08 + (1 - k) * .5); gg.gain.exponentialRampToValueAtTime(.08 * k, t + 1.4); gg.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(lp); lp.connect(gg); gg.connect(out);
}
// schedule the calls a little ahead (runs on the audio clock worker)
function ambTick(ahead) {
  if (!AMB.ready) return;
  const c = AUD.ctx;
  for (const k in AMB.rate) {
    const r = AMB.rate[k];
    if (!(AMB.next[k] > c.currentTime - 1) || AMB.next[k] - c.currentTime > 4 / Math.max(r, 1e-6)) AMB.next[k] = c.currentTime + expR(r);   // a rate that just rose is re-drawn
    while (AMB.next[k] < ahead) { if (r > 1e-4) try { CALLS[k](Math.max(AMB.next[k], c.currentTime + .01)); } catch (e) { } AMB.next[k] += expR(r); }
  }
  while (AMB.thunderQ.length && AMB.thunderQ[0][0] < ahead) { const [t, k] = AMB.thunderQ.shift(); thunder(Math.max(t, c.currentTime + .01), k); }
}
const bump = (h, a, b, c, d) => smooth(a, b, h) * (1 - smooth(c, d, h));
// levels and call rates for this moment (called every frame)
function ambFrame(w, now) {
  if (!AMB.ready) return;
  const h = wrap24(S.t), m = new Date().getMonth(), R = AMB.rate, L = AMB.lvl, st = (g, v) => g.gain.setTargetAtTime(v, now, .6);
  const night = clamp(1 - smooth(5.2, 6.3, h) + smooth(18.7, 19.8, h), 0, 1), dawn = bump(h, 4.6, 5.6, 7.2, 8.4), morn = bump(h, 6, 7, 9.5, 11), day = bump(h, 8.5, 10, 16, 17.5), dusk = bump(h, 16.3, 17.2, 18.8, 19.6);
  const rain = WX.rain, dry = 1 - rain * .85, wet = Math.max(rain, BLR.rainDays[m] / 10 * .5), city = clamp(w[5] + w[6] + w[7] * .6 + day * .3, 0, 1), fest = clamp(w[1] + w[0] * .45 + w[4] * .35 + w[2] * .25, 0, 1);
  AMB.bus.gain.setTargetAtTime(PARAM.amb * 3.2, now, .1);            // make-up gain: the slider's 100% sits a little under the music
  // beds
  const gust = .6 + .4 * Math.sin(now * .13) * Math.sin(now * .071 + 1);
  st(L.wind, (.085 + .06 * day + .06 * WX.mist + .1 * rain + .03 * night) * gust); AMB.windBP.frequency.setTargetAtTime(380 + 320 * gust, now, 1.5);
  st(L.city, .14 * city); st(L.traffic, .04 * city); AMB.farBP.frequency.setTargetAtTime(800 + 300 * Math.sin(now * .05), now, 2);
  st(L.rain, .42 * rain); st(L.rainLow, .22 * rain);
  st(L.crowd, .06 * fest * (.7 + .3 * Math.sin(now * .21))); AMB.crowdBP.frequency.setTargetAtTime(480 + 140 * Math.sin(now * .37), now, .8);
  st(L.crickets, .6 * night * (1 - rain * .8) * (m >= 11 || m <= 1 ? .5 : 1));
  // calls per second
  R.owl = night * bump(h, 20.5, 21.5, 4.2, 5) * (1 - rain) / 55 + (h < 5 && h > 0 ? night * dry / 70 : 0);
  R.koel = (dawn * .8 + morn) * dry * (m >= 1 && m <= 5 ? 1 : .35) / 22;
  R.chirps = (dawn * 1.4 + morn + dusk * 1.3 + day * .25) * dry / 3.2;
  R.crow = (morn + day * .8 + dusk * .7) * dry / 11;
  R.bells = (bump(h, 4.3, 4.6, 5.9, 6.2) + bump(h, 18.3, 18.5, 19.3, 19.6)) / 70 + day / 900;
  R.conch = (bump(h, 5, 5.15, 5.6, 5.8) + bump(h, 18.35, 18.45, 18.7, 18.85)) / 60;
  R.horn = city * (day + morn * .7 + dusk * .7) / 7;
  R.crackle = LOOK.fire * night * 1.4;
  R.frog = night * wet * (m >= 5 && m <= 10 ? 1 : .15) / 3;
  R.drip = (smooth(.05, .3, rain) * (1 - smooth(.5, .9, rain)) + wet * .1) * 2;
}
