/* =========================================================================
   MUSIC — generative raga engine. Each prahar is its own "deck": raga notes,
   tempo and groove from the posters. Decks blend like a DJ mix (tempo glide,
   bass swap). A user's own track can replace any deck.
   ========================================================================= */
// semitones from Sa (negative = lower octave). up/down = aaroh/avroh note sets.
const RAGAS = {
  Yaman: { up: [0, 2, 4, 6, 9, 11], down: [0, 2, 4, 6, 7, 9, 11], vadi: 4, sam: 11, drone: 7, pakad: [[-1, 2, 4, 2, 0], [7, 6, 4, 2, 0], [-1, 2, 0]] },
  Bihag: { up: [0, 4, 5, 7, 11], down: [0, 2, 4, 5, 6, 7, 9, 11], vadi: 4, sam: 11, drone: 7, pakad: [[-1, 0, 4, 5, 7], [4, 5, 4, 2, 0], [7, 6, 4, 5, 4]] },
  Malkauns: { up: [0, 3, 5, 8, 10], down: [0, 3, 5, 8, 10], vadi: 5, sam: 0, drone: 5, pakad: [[5, 3, 5, 8, 10, 8, 5], [3, 5, 3, 0], [-2, 0, 3, 5]] },
  Lalit: { up: [0, 1, 4, 5, 6, 8, 11], down: [0, 1, 4, 5, 6, 8, 11], vadi: 5, sam: 0, drone: 5, pakad: [[-1, 1, 4, 5], [5, 6, 5, 4], [5, 6, 8, 6, 8, 5], [4, 5, 4, 1, 0]] },
  Bhairav: { up: [0, 1, 4, 5, 7, 8, 11], down: [0, 1, 4, 5, 7, 8, 11], vadi: 8, sam: 1, drone: 7, pakad: [[4, 5, 8, 8, 7], [4, 5, 1, 1, 0], [11, 12, 13, 12]] },
  Todi: { up: [0, 1, 3, 6, 7, 8, 11], down: [0, 1, 3, 6, 8, 11], vadi: 8, sam: 3, drone: 7, pakad: [[-4, -1, 0, 1, 3, 1, 0], [1, 3, 6, 3, 1, 0], [8, 6, 3, 1]] },
  Bhimpalasi: { up: [0, 3, 5, 7, 10], down: [0, 2, 3, 5, 7, 9, 10], vadi: 5, sam: 0, drone: 7, pakad: [[-2, 0, 5], [5, 3, 7, 5], [3, 5, 3, 2, 0]] },
  Marwa: { up: [0, 1, 4, 6, 9, 11], down: [0, 1, 4, 6, 9, 11], vadi: 1, sam: 9, drone: 11, pakad: [[9, 6, 4, 1], [4, 6, 9], [6, 4, 1, 0], [-1, 1, -3, 0]] },
};
const MUSIC = [
  { raga: 'Yaman', kick: 'half', bass: 'sub', hats: 'shaker', clap: 0, lead: 'flute', bells: .35, tabla: .55, pad: .5, drone: .7, verb: .35, delay: .15, kickA: .8 },
  { raga: 'Bihag', kick: 'four', bass: 'roll8', hats: 'offbeat', clap: .55, lead: 'stab', bells: 0, tabla: 0, pad: .25, drone: .2, verb: .25, delay: .3, kickA: 1 },
  { raga: 'Malkauns', kick: 'four', bass: 'kbbb', hats: 'sixteen', clap: .25, lead: 'acid', bells: 0, tabla: 0, pad: .18, drone: .22, verb: .3, delay: .35, kickA: 1 },
  { raga: 'Lalit', kick: 'none', bass: 'none', hats: 'none', clap: 0, lead: 'flute', bells: .55, tabla: 0, pad: .85, drone: 1, verb: .7, delay: .2, kickA: 0 },
  { raga: 'Bhairav', kick: 'four', bass: 'kbbb', hats: 'sixteen', clap: .45, lead: 'pluck', bells: .45, tabla: 0, pad: .4, drone: .3, verb: .35, delay: .3, kickA: 1 },
  { raga: 'Todi', kick: 'broken', bass: 'sub', hats: 'shaker', clap: .4, lead: 'rhodes', bells: 0, tabla: .6, pad: .3, drone: .4, verb: .3, delay: .2, kickA: .85 },
  { raga: 'Bhimpalasi', kick: 'dub', bass: 'dub', hats: 'dub', clap: 0, lead: 'santoor', bells: .15, tabla: .35, pad: .4, drone: .4, verb: .4, delay: .45, kickA: .75 },
  { raga: 'Marwa', kick: 'four', bass: 'offbeat', hats: 'offbeat', clap: .3, lead: 'sarangi', bells: .2, tabla: .4, pad: .45, drone: .55, verb: .4, delay: .25, kickA: .85 },
];
const SA = 146.83; // D3
const hz = (semi) => SA * Math.pow(2, semi / 12);

const AUD = { ctx: null, on: false, ready: false, step: 0, nextT: 0, tempo: 120, beats: [], kicks: [], bassAvg: 0, users: [], w: new Float32Array(8), wLow: new Float32Array(8) };

function audioInit() {
  if (AUD.ctx) return AUD;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC({ latencyHint: 'playback' }); AUD.ctx = ctx;
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  AUD.master = g(PARAM.volume); AUD.comp = ctx.createDynamicsCompressor();
  AUD.comp.threshold.value = -16; AUD.comp.knee.value = 10; AUD.comp.ratio.value = 3.2; AUD.comp.attack.value = .004; AUD.comp.release.value = .18;
  AUD.analyser = ctx.createAnalyser(); AUD.analyser.fftSize = 1024; AUD.fft = new Uint8Array(AUD.analyser.frequencyBinCount);
  AUD.gen = g(1); AUD.gen.connect(AUD.comp); AUD.comp.connect(AUD.master); AUD.master.connect(AUD.analyser); AUD.analyser.connect(ctx.destination);
  // reverb
  const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * .6 + (Math.random() * 2 - 1) * .4; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
  AUD.verb = ctx.createConvolver(); AUD.verb.buffer = ir; AUD.verbIn = g(1); AUD.verbIn.connect(AUD.verb); AUD.verb.connect(AUD.gen);
  // tempo delay with filtered feedback
  AUD.delay = ctx.createDelay(2); AUD.delayFb = g(.38); AUD.delayLP = ctx.createBiquadFilter(); AUD.delayLP.frequency.value = 2400;
  AUD.delayIn = g(1); AUD.delayIn.connect(AUD.delay); AUD.delay.connect(AUD.delayLP); AUD.delayLP.connect(AUD.delayFb); AUD.delayFb.connect(AUD.delay); AUD.delayLP.connect(AUD.gen);
  // noise
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; AUD.noise = nb;
  // per-deck buses
  AUD.deck = MUSIC.map((m, k) => {
    const out = g(0), low = g(0), vs = g(m.verb), ds = g(m.delay);
    out.connect(AUD.gen); low.connect(AUD.gen); out.connect(vs); vs.connect(AUD.verbIn); out.connect(ds); ds.connect(AUD.delayIn);
    return { out, low, m, raga: RAGAS[m.raga], mel: { cur: 0, dir: 1, q: [], prev: 0, hold: 0 }, bassShift: 0, pad: null, padIdle: 0 };
  });
  AUD.drone = g(0); AUD.drone.connect(AUD.gen); const dv = g(.5); AUD.drone.connect(dv); dv.connect(AUD.verbIn);
  AUD.userBus = g(1); AUD.userBus.connect(AUD.master);
  // worker clock (keeps ticking when the tab is in the background)
  try {
    const blob = new Blob(['let t=null;onmessage=e=>{if(e.data==="start"){clearInterval(t);t=setInterval(()=>postMessage(0),25);}else{clearInterval(t);}}'], { type: 'text/javascript' });
    AUD.worker = new Worker(URL.createObjectURL(blob)); AUD.worker.onmessage = audioTick;
  } catch (e) { AUD.worker = null; }
  try { ambInit(); } catch (e) { console.warn('ambience', e); }
  AUD.ready = true;
  return AUD;
}
function audioStart() {
  if (!audioInit()) return false;
  AUD.ctx.resume();
  AUD.on = true; AUD.nextT = AUD.ctx.currentTime + .08; AUD.droneT = AUD.nextT;
  if (AUD.worker) AUD.worker.postMessage('start'); else AUD.iv = setInterval(audioTick, 25);
  return true;
}
function audioStop() {
  if (!AUD.ctx) return; AUD.on = false;
  if (AUD.worker) AUD.worker.postMessage('stop'); else clearInterval(AUD.iv);
  for (const u of AUD.users) if (u) userPause(u);
  AUD.ctx.suspend();
}

/* ---------- voices ---------- */
function env(p, t, a, peak, d, end = .0001) { p.cancelScheduledValues(t); p.setValueAtTime(.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(Math.max(end, .0001), t + a + d); }
function osc(type, f, t, stop) { const o = AUD.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; }
function vKick(out, t, a = 1, f0 = 155, f1 = 44, dec = .36) {
  const c = AUD.ctx, o = osc('sine', f0, t, t + dec + .05), gg = c.createGain();
  o.frequency.exponentialRampToValueAtTime(f1, t + .09); env(gg.gain, t, .002, a * .95, dec); o.connect(gg); gg.connect(out);
  const n = c.createBufferSource(); n.buffer = AUD.noise; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; const ng = c.createGain(); env(ng.gain, t, .001, a * .12, .018); n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t); n.stop(t + .03);
}
function vHat(out, t, a = .3, open = false) {
  const c = AUD.ctx, n = c.createBufferSource(); n.buffer = AUD.noise; n.playbackRate.value = 1 + Math.random() * .2;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = open ? 7000 : 8500; const gg = c.createGain(); env(gg.gain, t, .001, a, open ? .22 : .035);
  n.connect(hp); hp.connect(gg); gg.connect(out); n.start(t, Math.random() * .5); n.stop(t + (open ? .3 : .06));
}
function vClap(out, t, a = .4) {
  const c = AUD.ctx, n = c.createBufferSource(); n.buffer = AUD.noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = .9;
  const gg = c.createGain(); gg.gain.setValueAtTime(.0001, t);
  for (let k = 0; k < 3; k++) { gg.gain.linearRampToValueAtTime(a, t + k * .011 + .001); gg.gain.exponentialRampToValueAtTime(a * .2, t + k * .011 + .009); }
  gg.gain.exponentialRampToValueAtTime(.0001, t + .2); n.connect(bp); bp.connect(gg); gg.connect(out); n.start(t, Math.random() * .5); n.stop(t + .25);
}
function vBass(out, t, f, dur, a = .5, cut = 600, q = 4, type = 'sawtooth', envAmt = 2.5) {
  const c = AUD.ctx, o = osc(type, f, t, t + dur + .05), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = q;
  lp.frequency.setValueAtTime(cut * envAmt, t); lp.frequency.exponentialRampToValueAtTime(cut, t + dur * .7);
  const gg = c.createGain(); env(gg.gain, t, .004, a, dur); o.connect(lp); lp.connect(gg); gg.connect(out);
  if (type === 'sawtooth') { const s = osc('sine', f, t, t + dur + .05), sg = c.createGain(); env(sg.gain, t, .004, a * .6, dur); s.connect(sg); sg.connect(out); }
}
function vPluck(out, t, f, a = .25, dec = .35, bright = 3500) {
  const c = AUD.ctx, o = osc('sawtooth', f, t, t + dec + .1), o2 = osc('triangle', f * 2.003, t, t + dec + .1), lp = c.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dec); const gg = c.createGain(); env(gg.gain, t, .003, a, dec);
  const g2 = c.createGain(); g2.gain.value = .35; o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(gg); gg.connect(out);
}
function vFlute(out, t, f, dur, a, fPrev) {
  const c = AUD.ctx, o = osc('sine', fPrev || f, t, t + dur + .5), o2 = osc('triangle', (fPrev || f) * 2, t, t + dur + .5);
  if (fPrev && fPrev !== f) { o.frequency.setValueAtTime(fPrev, t); o.frequency.exponentialRampToValueAtTime(f, t + Math.min(.35, dur * .4)); o2.frequency.setValueAtTime(fPrev * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + Math.min(.35, dur * .4)); }
  const vib = osc('sine', 5.2, t, t + dur + .5), vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .009, t + dur * .6); vib.connect(vg); vg.connect(o.frequency);
  const gg = c.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.linearRampToValueAtTime(a, t + .12); gg.gain.setValueAtTime(a, t + dur * .75); gg.gain.exponentialRampToValueAtTime(.0001, t + dur + .45);
  const g2 = c.createGain(); g2.gain.value = .12; o.connect(gg); o2.connect(g2); g2.connect(gg);
  const n = c.createBufferSource(); n.buffer = AUD.noise; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2; const ng = c.createGain(); ng.gain.value = .05; n.connect(bp); bp.connect(ng); ng.connect(gg); n.start(t); n.stop(t + dur + .5);
  gg.connect(out);
}
function vBell(out, t, f, a = .12) {
  const c = AUD.ctx, car = osc('sine', f, t, t + 4.2), mod = osc('sine', f * 3.51, t, t + 4.2), mg = c.createGain();
  mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + 2.5); mod.connect(mg); mg.connect(car.frequency);
  const gg = c.createGain(); env(gg.gain, t, .003, a, 4); car.connect(gg); gg.connect(out);
}
function vStab(out, t, fs, a = .16) {
  const c = AUD.ctx, bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(600, t + .25); bp.Q.value = 1.2;
  const gg = c.createGain(); env(gg.gain, t, .003, a, .28);
  for (const f of fs) { const o = osc('sawtooth', f, t, t + .35); o.detune.value = (Math.random() - .5) * 14; o.connect(bp); }
  bp.connect(gg); gg.connect(out);
}
function vAcid(out, t, f, dur, cut, accent, a = .2) {
  const c = AUD.ctx, o = osc('sawtooth', f, t, t + dur + .05), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 11 + accent * 6;
  lp.frequency.setValueAtTime(cut * (1.8 + accent * 2), t); lp.frequency.exponentialRampToValueAtTime(Math.max(160, cut * .45), t + dur * .9);
  const gg = c.createGain(); env(gg.gain, t, .002, a * (1 + accent * .4), dur); o.connect(lp); lp.connect(gg); gg.connect(out);
}
function vRhodes(out, t, f, dur, a = .16) {
  const c = AUD.ctx, car = osc('sine', f, t, t + dur + 1), mod = osc('sine', f, t, t + dur + 1), mg = c.createGain();
  mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * .1, t + .6); mod.connect(mg); mg.connect(car.frequency);
  const trem = osc('sine', 4.5, t, t + dur + 1), tg = c.createGain(); tg.gain.value = a * .15; trem.connect(tg);
  const gg = c.createGain(); env(gg.gain, t, .004, a, dur + .8); tg.connect(gg.gain); car.connect(gg); gg.connect(out);
}
function vSantoor(out, t, f, a = .12) { vPluck(out, t, f, a, .5, 5200); vPluck(out, t + .045, f * 1.002, a * .5, .35, 4200); }
function vSarangi(out, t, f, dur, a, fPrev) {
  const c = AUD.ctx, o = osc('sawtooth', fPrev || f, t, t + dur + .4);
  if (fPrev && fPrev !== f) o.frequency.exponentialRampToValueAtTime(f, t + Math.min(.4, dur * .5));
  const vib = osc('sine', 5.6, t, t + dur + .4), vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .012, t + dur * .5); vib.connect(vg); vg.connect(o.frequency);
  const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 3; const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2400; f2.Q.value = 4;
  const gg = c.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.linearRampToValueAtTime(a, t + .18); gg.gain.setValueAtTime(a, t + dur * .8); gg.gain.exponentialRampToValueAtTime(.0001, t + dur + .35);
  o.connect(f1); o.connect(f2); f1.connect(gg); f2.connect(gg); gg.connect(out);
}
function vTabla(out, t, bol, a = .3) {
  const c = AUD.ctx;
  if (bol === 'na' || bol === 'dha' || bol === 'tin' || bol === 'dhi') {
    const f = hz(12), o = osc('sine', f, t, t + .6), o2 = osc('sine', f * 2.76, t, t + .2), gg = c.createGain(), g2 = c.createGain();
    env(gg.gain, t, .001, a * (bol === 'tin' || bol === 'dhi' ? .7 : 1), bol === 'tin' ? .5 : .28); env(g2.gain, t, .001, a * .3, .06); o.connect(gg); o2.connect(g2); g2.connect(gg); gg.connect(out);
  }
  if (bol === 'ge' || bol === 'dha' || bol === 'dhi') {
    const o = osc('sine', 78, t, t + .5), gg = c.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(96, t + .18); env(gg.gain, t, .003, a * 1.1, .42); o.connect(gg); gg.connect(out);
  }
  if (bol === 'ka' || bol === 'ti') {
    const n = c.createBufferSource(); n.buffer = AUD.noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = bol === 'ka' ? 900 : 2600; bp.Q.value = 1.5; const gg = c.createGain(); env(gg.gain, t, .001, a * .6, .05); n.connect(bp); bp.connect(gg); gg.connect(out); n.start(t, Math.random() * .5); n.stop(t + .08);
  }
}
function vTanpura(out, t, f, a) {
  const c = AUD.ctx, o = osc('sawtooth', f, t, t + 4.4), o2 = osc('sawtooth', f * 1.003, t, t + 4.4);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.Q.value = 5; pk.gain.value = 10; pk.frequency.setValueAtTime(900, t); pk.frequency.exponentialRampToValueAtTime(3200, t + 2.5);
  const gg = c.createGain(); env(gg.gain, t, .03, a, 4.2); const g2 = c.createGain(); g2.gain.value = .6;
  o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(pk); pk.connect(gg); gg.connect(out);
}
function padOn(deck) {
  const c = AUD.ctx, r = deck.raga, t = c.currentTime, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = .7;
  const lfo = osc('sine', .07, t, t + 3600), lg = c.createGain(); lg.gain.value = 420; lfo.connect(lg); lg.connect(lp.frequency);
  const gg = c.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(deck.m.pad * .16, t + 3);
  const notes = [0, r.drone === 5 ? 5 : r.drone === 11 ? -1 : 7, 12 + (r.vadi % 12 === 0 ? 7 : r.vadi % 12)];
  const oscs = [];
  for (const n of notes) for (const d of [-7, 6]) { const o = osc('sawtooth', hz(n - 12), t, t + 3600); o.detune.value = d; o.connect(lp); oscs.push(o); }
  lp.connect(gg); gg.connect(deck.out);
  deck.pad = { gg, oscs, lfo };
}
function padOff(deck) { const p = deck.pad; if (!p) return; const t = AUD.ctx.currentTime; p.gg.gain.setTargetAtTime(0, t, .5); for (const o of p.oscs) o.stop(t + 3); p.lfo.stop(t + 3); deck.pad = null; }

/* ---------- melody (aaroh / avroh walk with pakad phrases) ---------- */
function nextNote(st, raga, lo = -3, hi = 16) {
  if (st.q.length) return (st.cur = st.q.shift());
  if (Math.random() < .16) { st.q = raga.pakad[Math.floor(Math.random() * raga.pakad.length)].slice(); return (st.cur = st.q.shift()); }
  if (Math.random() < .25) st.dir *= -1;
  if (st.cur >= hi) st.dir = -1; if (st.cur <= lo) st.dir = 1;
  const set = st.dir > 0 ? raga.up : raga.down;
  let n = st.cur; for (let i = 0; i < 24; i++) { n += st.dir; if (set.includes(((n % 12) + 12) % 12)) break; }
  if (Math.random() < .12) { const v = raga.vadi; n = v + 12 * Math.round((n - v) / 12); }
  return (st.cur = n);
}

/* ---------- the sequencer ---------- */
const KICKS = { four: [0, 4, 8, 12], half: [0, 7, 10], broken: [0, 7, 10, 14], dub: [0, 4, 8, 12], none: [] };
const TABLA16 = ['dha', 0, 'ge', 0, 'na', 0, 'ti', 0, 'na', 0, 'ka', 0, 'dhi', 0, 'na', 0];
function deckStep(k, deck, s, t, sd) {
  const m = deck.m, r = deck.raga, bar = Math.floor(s / 16), q = s % 16, out = deck.out, low = deck.low;
  // drums
  if (KICKS[m.kick].includes(q)) { vKick(low, t, m.kickA * (m.kick === 'dub' ? .8 : 1), m.kick === 'four' && (k === 2 || k === 4) ? 165 : 150, 44, m.kick === 'four' && (k === 2 || k === 4) ? .26 : .38); if (AUD.w[k] > .3) { AUD.kicks.push([t, m.kickA * AUD.w[k]]); if (AUD.kicks.length > 16) AUD.kicks.shift(); } }
  if (m.clap && (q === 4 || q === 12)) vClap(out, t, .32 * m.clap);
  if (m.hats === 'sixteen') vHat(out, t, q % 4 === 2 ? .2 : .07, q % 4 === 2 && k === 4);
  else if (m.hats === 'offbeat') { if (q % 4 === 2) vHat(out, t, .19, true); else if (q % 2 === 1) vHat(out, t, .05); }
  else if (m.hats === 'shaker') vHat(out, t + (q % 2 ? sd * .14 : 0), q % 4 === 2 ? .09 : .045);
  else if (m.hats === 'dub' && q % 4 === 2) vHat(out, t, .08);
  if (m.tabla && TABLA16[q] && Math.random() < .85) vTabla(out, t + (q % 4 === 2 ? sd * .08 : 0), TABLA16[q], .22 * m.tabla);
  // bass
  if (q === 0 && bar % 2 === 0) { const opts = [0, 0, 0, r.up[1] || 0, r.drone === 7 ? 7 : 5, r.vadi % 12]; deck.bassShift = opts[Math.floor(Math.random() * opts.length)]; if (deck.bassShift > 7) deck.bassShift -= 12; }
  const bf = hz(-24 + deck.bassShift);
  if (m.bass === 'kbbb' && q % 4 !== 0) vBass(low, t, bf, sd * .85, .34, k === 4 ? 900 : 560, 5, 'sawtooth', k === 4 ? 3 : 2.2);
  else if (m.bass === 'roll8' && (q % 4 === 2 || (q % 4 === 3 && Math.random() < .35))) vBass(low, t, bf, sd * 1.6, q % 4 === 2 ? .4 : .18, 420 + 260 * Math.sin(s * .05), 6);
  else if (m.bass === 'offbeat' && q % 4 === 2) vBass(low, t, bf, sd * 1.8, .42, 520, 3);
  else if (m.bass === 'sub' && (q === 0 || q === 10)) vBass(low, t, bf, sd * 6, .5, 300, 1, 'sine', 1.2);
  else if (m.bass === 'dub' && (q === 0 || q === 6 || q === 11)) vBass(low, t, bf * (q === 11 ? 1.5 : 1), sd * 3, .48, 260, 1, 'sine', 1.1);
  // lead
  const st = deck.mel;
  if (m.lead === 'acid') { if (Math.random() < .88) { const n = nextNote(st, r, -12, 7); vAcid(out, t, hz(n), sd * .9, 700 + 500 * Math.sin(s * .031) + 400 * S.level, q % 4 === 2 ? 1 : 0, .17); } }
  else if (m.lead === 'pluck') { if (q % 2 === 0 || Math.random() < .4) { const n = nextNote(st, r, 0, 19); vPluck(out, t, hz(n), .15, .3, 4200); } }
  else if (m.lead === 'stab') { if ((q === 6 || q === 14 || (q === 11 && bar % 2)) && Math.random() < .8) vStab(out, t, [hz(0), hz(7), hz(r.vadi % 12 + 12)], .12); }
  else if (m.lead === 'flute') { if (st.hold <= 0 && q % 4 === 0 && Math.random() < (k === 3 ? .45 : .6)) { const n = nextNote(st, r, -1, 14), f = hz(n + 12), beats = k === 3 ? 4 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 3); vFlute(out, t, f, beats * sd * 4, k === 3 ? .1 : .12, st.prev); st.prev = f; st.hold = beats * 4; } st.hold--; }
  else if (m.lead === 'rhodes') { if ((q === 0 || q === 6) && Math.random() < .8) { const n = nextNote(st, r, 0, 12); vRhodes(out, t, hz(n), sd * 5, .1); vRhodes(out, t, hz(n - 5 < -2 ? n + 7 : n - 5), sd * 5, .06); } }
  else if (m.lead === 'santoor') { if (q % 2 === 0 && Math.random() < .55) { const n = nextNote(st, r, 0, 17); vSantoor(out, t, hz(n + 12), .07); } }
  else if (m.lead === 'sarangi') { if (st.hold <= 0 && q % 2 === 0 && Math.random() < .7) { const n = nextNote(st, r, -1, 14), f = hz(n), beats = 1 + Math.floor(Math.random() * 3); vSarangi(out, t, f, beats * sd * 4, .09, st.prev); st.prev = f; st.hold = beats * 4; } st.hold--; }
  if (m.bells && q === 0 && bar % 2 === 0 && Math.random() < m.bells) vBell(out, t + sd * 2 * Math.floor(Math.random() * 4), hz(r.up[Math.floor(Math.random() * r.up.length)] + 24), .07);
}
function audioTick() {
  if (!AUD.on) return;
  const c = AUD.ctx, ahead = c.currentTime + .14;
  while (AUD.nextT < ahead) {
    const t = AUD.nextT, sd = 60 / AUD.tempo / 4;
    for (let k = 0; k < 8; k++) if ((AUD.w[k] > .005 || AUD.wLow[k] > .005) && !userActive(k)) deckStep(k, AUD.deck[k], AUD.step, t, sd);
    AUD.beats.push([t, AUD.step]); if (AUD.beats.length > 32) AUD.beats.shift();
    AUD.step++; AUD.nextT += sd;
  }
  // tanpura cycle (free time)
  while (AUD.droneT < ahead) {
    let lvl = 0, dom = 0, best = -1; for (let k = 0; k < 8; k++) { lvl += AUD.w[k] * MUSIC[k].drone * (userActive(k) ? 0 : 1); if (AUD.w[k] > best) { best = AUD.w[k]; dom = k; } }
    const r = RAGAS[MUSIC[dom].raga], seq = [r.drone === 11 ? -1 : r.drone, 12, 12, 0];
    const i = AUD.droneI = ((AUD.droneI || 0) + 1) % 4;
    if (lvl > .01) vTanpura(AUD.drone, AUD.droneT, hz(seq[i] - 12), .07);
    AUD.drone.gain.setTargetAtTime(lvl * PARAM.gen, c.currentTime, .5);
    AUD.droneT += i === 3 ? 1.6 : 1.1;
  }
  ambTick(ahead);
}
// called every frame from the render loop
function audioFrame(w, bpms) {
  if (!AUD.on) return;
  const c = AUD.ctx, now = c.currentTime, adt = clamp(now - (AUD.lastFrame || now), 0, .5); AUD.lastFrame = now;
  let tempo = 0; for (let k = 0; k < 8; k++) tempo += w[k] * bpms[k];
  AUD.tempo = clamp(tempo, 60, 170);
  AUD.delay.delayTime.setTargetAtTime(60 / AUD.tempo * .75, now, .2);
  for (let k = 0; k < 8; k++) {
    const x = w[k]; AUD.w[k] = x;
    const eq = Math.sin(x * Math.PI / 2), sharp = smooth(.35, .65, x); AUD.wLow[k] = sharp;
    const user = userActive(k) ? AUD.users[k] : null, gen = PARAM.gen * (user ? 0 : 1);
    const d = AUD.deck[k];
    d.out.gain.setTargetAtTime(eq * gen, now, .08); d.low.gain.setTargetAtTime(sharp * gen, now, .08);
    if (x > .01 && gen > 0 && !d.pad) padOn(d);
    if (d.pad) { if (x < .005 || gen === 0) { d.padIdle += adt; if (d.padIdle > 4) { padOff(d); d.padIdle = 0; } } else d.padIdle = 0; }
    if (user) {
      user.g.gain.setTargetAtTime(eq, now, .1);
      if (x > .005) { user.idle = 0; if (!user.playing && now >= user.retryAt) userPlay(user); }
      else if (user.playing) { user.idle += adt; if (user.idle > 3) { userPause(user); user.idle = 0; } }
    }
  }
  AUD.master.gain.setTargetAtTime(PARAM.volume * LISTEN.fade, now, .05);
  ambFrame(w, now);
  // beat phase for the visuals
  let bt = null; for (let i = AUD.beats.length - 1; i >= 0; i--) if (AUD.beats[i][0] <= now) { bt = AUD.beats[i]; break; }
  if (bt) { const sd = 60 / AUD.tempo / 4; S.beat = fract(((bt[1] % 4) + (now - bt[0]) / sd) / 4); S.beatAud = (bt[1] + (now - bt[0]) / sd) / 4; }
  S.bpm = AUD.tempo;
  AUD.analyser.getByteFrequencyData(AUD.fft);
  let lo = 0, all = 0; for (let i = 1; i < 8; i++) lo += AUD.fft[i]; for (let i = 1; i < 200; i++) all += AUD.fft[i];
  S.bass = lerp(S.bass, lo / (7 * 255), .3); S.level = lerp(S.level, all / (199 * 255), .1);
  let kp = 0; for (let i = AUD.kicks.length - 1; i >= 0; i--) if (AUD.kicks[i][0] <= now) { kp = Math.exp(-(now - AUD.kicks[i][0]) * 7) * AUD.kicks[i][1]; break; }
  const anyUser = AUD.users.some((u, k) => userActive(k) && w[k] > .3);
  AUD.bassAvg = lerp(AUD.bassAvg, S.bass, .02);
  S.pulse = anyUser ? clamp((S.bass - AUD.bassAvg) * 7, 0, 1) : clamp(kp, 0, 1);
}
/* ---------- the DJ's own tracks ----------
   Stream through a media element (fine for hour-long mixes). If the page's security policy refuses blob
   media, decode the file into memory instead (size-capped). Nothing is retried every frame, and a track
   that can't play hands its chapter back to the raga engine. */
// Loading into memory is the fallback when the browser can't stream a file (or a page's security policy forbids it).
// Decoded audio is large: about 23 MB per minute (48 kHz stereo float), so the fallback holds at most this much
const USER_DECODE_BUDGET_MB = 420;
const userActive = (k) => { const u = AUD.users[k]; return !!(u && u.ready && !u.failed); };
function userDispose(u) {
  if (!u) return;
  try { if (u.node) u.node.stop(); } catch (e) { }
  try { if (u.el) { u.el.pause(); u.el.removeAttribute('src'); u.el.load(); } } catch (e) { }
  try { if (u.src) u.src.disconnect(); } catch (e) { }
  try { u.g.disconnect(); } catch (e) { }
  if (u.url) { URL.revokeObjectURL(u.url); u.url = null; }
}
function audioSetUser(k, file, onState) {
  if (!audioInit()) return;
  const old = AUD.users[k]; if (old) { userDispose(old); AUD.users[k] = null; }
  if (!file) return;
  const g = AUD.ctx.createGain(); g.gain.value = 0; g.connect(AUD.userBus);
  const u = { k, name: file.name, g, ready: false, failed: false, mode: null, playing: false, idle: 0, pos: 0, retryAt: 0, fails: 0 };
  AUD.users[k] = u;
  const say = (state, msg) => { if (AUD.users[k] !== u) return; if (state === 'error') { u.failed = true; userDispose(u); AUD.users[k] = null; } if (onState) onState(state, msg, u); };
  u.say = say;
  say('loading');
  // stream the file from disk through an audio element: no size limit, almost no memory
  let done = false;
  const url = URL.createObjectURL(file); u.url = url;
  const el = new Audio(); el.preload = 'auto'; el.loop = true;
  const fallback = (why) => {
    if (done || AUD.users[k] !== u) return; done = true;
    try { el.removeAttribute('src'); el.load(); } catch (e) { }
    URL.revokeObjectURL(url); u.url = null;
    if (typeof diagNote === 'function') diagNote('track', `streaming unavailable (${why}), loading into memory`);
    decodeUser(u, file, say);
  };
  const ok = () => {
    if (done || AUD.users[k] !== u) return; done = true;
    try { u.src = AUD.ctx.createMediaElementSource(el); u.src.connect(g); }
    catch (e) { done = false; fallback('no media source'); return; }
    u.el = el; u.mode = 'stream'; u.dur = el.duration; u.ready = true; say('ready');
  };
  el.addEventListener('loadeddata', ok, { once: true }); el.addEventListener('canplay', ok, { once: true });
  el.addEventListener('error', () => fallback('media error ' + (el.error ? el.error.code : '')), { once: true });
  // a large file can take a while; only give up on streaming if nothing at all has arrived
  setTimeout(() => { if (!done && el.readyState === 0) fallback('timeout'); }, 25000);
  el.src = url;
}
// how long a file is, from its header when we can read it (WAV, FLAC, MP3), otherwise a cautious guess
function audioProbe(bytes, size, name) {
  const v = new DataView(bytes), str = (o, n) => String.fromCharCode(...new Uint8Array(bytes, o, Math.min(n, bytes.byteLength - o)));
  try {
    if (str(0, 4) === 'RIFF' && str(8, 4) === 'WAVE') {
      let o = 12, sr = 44100, ch = 2, bits = 16, dataOff = 44, dataLen = size - 44;
      while (o + 8 <= bytes.byteLength) { const id = str(o, 4), len = v.getUint32(o + 4, true); if (id === 'fmt ') { ch = v.getUint16(o + 10, true); sr = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true); } if (id === 'data') { dataOff = o + 8; dataLen = Math.min(len, size - dataOff); break; } o += 8 + len + (len & 1); }
      return { kind: 'wav', dur: dataLen / (sr * ch * bits / 8), byteRate: sr * ch * bits / 8, dataOff, block: ch * bits / 8 };
    }
    if (str(0, 4) === 'fLaC') { const sr = (v.getUint32(18) >>> 12), tot = (v.getUint8(21) & 15) * 4294967296 + v.getUint32(22); if (sr && tot) return { kind: 'flac', dur: tot / sr }; }
    let o = 0; if (str(0, 3) === 'ID3') o = 10 + (((v.getUint8(6) & 127) << 21) | ((v.getUint8(7) & 127) << 14) | ((v.getUint8(8) & 127) << 7) | (v.getUint8(9) & 127));
    for (let i = o; i < Math.min(bytes.byteLength - 4, o + 65536); i++) {
      if (v.getUint8(i) === 255 && (v.getUint8(i + 1) & 0xE0) === 0xE0) {
        const b1 = v.getUint8(i + 1), b2 = v.getUint8(i + 2), ver = (b1 >> 3) & 3, layer = (b1 >> 1) & 3, bi = b2 >> 4;
        if (layer !== 1 || bi === 0 || bi === 15) continue;
        const kbps = (ver === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bi];
        return { kind: 'mp3', dur: (size - i) * 8 / (kbps * 1000), kbps, audioOff: i };
      }
    }
  } catch (e) { }
  return { kind: 'other', dur: size * 8 / 128000 };        // AAC/Ogg/Opus and anything unreadable: assume 128 kbps (errs long)
}
async function decodeUser(u, file, say) {
  try {
    const head = await file.slice(0, 262144).arrayBuffer(), info = audioProbe(head, file.size, file.name);
    const perSec = AUD.ctx.sampleRate * 2 * 4, maxDur = USER_DECODE_BUDGET_MB * 1048576 / perSec;
    let blob = file, part = false;
    if (info.dur > maxDur) {
      // too long to hold in memory: keep the opening of the mix (WAV and MP3 can be cut cleanly), or explain
      if (info.kind === 'wav') {
        const keep = Math.floor(maxDur * info.byteRate / info.block) * info.block, hdr = new Uint8Array(await file.slice(0, info.dataOff).arrayBuffer()), dv = new DataView(hdr.buffer);
        dv.setUint32(4, info.dataOff - 8 + keep, true); dv.setUint32(info.dataOff - 4, keep, true);
        blob = new Blob([hdr, file.slice(info.dataOff, info.dataOff + keep)]); part = true;
      } else if (info.kind === 'mp3') { blob = file.slice(0, info.audioOff + Math.floor(maxDur * info.kbps * 125)); part = true; }
      else { say('error', `“${file.name}” is too long to load into memory here (about ${Math.round(info.dur / 60)} min). Use an MP3 or WAV, or a shorter file.`); return; }
    }
    const bytes = await blob.arrayBuffer();
    const audio = await new Promise((res, rej) => { const p = AUD.ctx.decodeAudioData(bytes, res, rej); if (p && p.then) p.then(res, rej); });
    if (AUD.users[u.k] !== u) return;
    u.buffer = audio; u.mode = 'buffer'; u.dur = audio.duration; u.ready = true; say('ready');
    if (part) toast(`“${file.name}” is long, so the first ${Math.round(audio.duration / 60)} minutes play on a loop here.`, 7000);
  } catch (e) { say('error', `“${file.name}” couldn't be decoded. Try an MP3, M4A, WAV or FLAC file.`); }
}
function userPlay(u) {
  if (u.playing || !u.ready) return;
  u.playing = true;
  if (u.mode === 'stream') {
    const p = u.el.play();
    if (p && p.catch) p.catch(() => { u.playing = false; u.fails++; u.retryAt = AUD.ctx.currentTime + 1.5; if (u.fails >= 4 && u.say) u.say('error', `“${u.name}” wouldn't start playing. The raga engine is back on for this chapter.`); });
  } else if (u.mode === 'buffer') {
    const n = AUD.ctx.createBufferSource(); n.buffer = u.buffer; n.loop = true; n.connect(u.g);
    const off = u.pos % u.buffer.duration; n.start(0, off); u.t0 = AUD.ctx.currentTime - off; u.node = n;
  }
}
function userPause(u) {
  if (!u.playing) return; u.playing = false;
  if (u.mode === 'stream') { try { u.el.pause(); } catch (e) { } }
  else if (u.mode === 'buffer' && u.node) { u.pos = (AUD.ctx.currentTime - u.t0) % u.buffer.duration; try { u.node.stop(); } catch (e) { } u.node.disconnect(); u.node = null; }
}
function audioRecStream() {
  if (!AUD.ctx) return null;
  if (!AUD.recDest) { AUD.recDest = AUD.ctx.createMediaStreamDestination(); AUD.master.connect(AUD.recDest); }
  return AUD.recDest.stream;
}
