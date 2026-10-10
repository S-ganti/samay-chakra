// Records the Samay Chakra raga engine + ambience, losslessly, from the page's own Web Audio graph.
// usage: node record.mjs [--only a_enter,a_zero] [--port 4174] [--fps 12] [--out DIR]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg('port', 4174), FPS = +arg('fps', 6), SETTLE = +arg('settle', 5);
const RAW = arg('out', path.join(HERE, 'raw')); fs.mkdirSync(RAW, { recursive: true });
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SR = 48000;
const NORENDER = arg('render', 'off') === 'off';   // stub renderer.render: the music is clocked by a worker, drawing frames only steals CPU

const JOBS = [
  { name: 'a_enter', h: 19.5, dur: 30, raga: 'Yaman', bpm: 108 },
  { name: 'a_gathering', h: 22.5, dur: 30, raga: 'Bihag', bpm: 128 },
  { name: 'a_eclipse', h: 1.5, dur: 30, raga: 'Malkauns', bpm: 144 },
  { name: 'a_brahma', h: 4.5, dur: 30, raga: 'Lalit', bpm: 72 },
  { name: 'a_diamond', h: 7.5, dur: 30, raga: 'Bhairav', bpm: 138 },
  { name: 'a_dispersal', h: 10.5, dur: 30, raga: 'Todi', bpm: 96 },
  { name: 'a_zero', h: 13.5, dur: 30, raga: 'Bhimpalasi', bpm: 104 },
  { name: 'a_return', h: 16.5, dur: 30, raga: 'Marwa', bpm: 116 },
  { name: 'a_bed_long', h: +arg('bedh', 7.5), dur: 100, raga: 'Bhairav', bpm: 138 },
];
const only = arg('only', '') ? arg('only').split(',') : null;

const INIT = `(() => {
  const SRATE = ${SR}, FPS = ${FPS};
  window.__ctxs = []; window.__lag = { max: 0, over100: 0, over250: 0 }; window.__sched = { n: 0, late: 0, lateMax: 0, minAhead: 1e9 };
  const Orig = window.AudioContext;
  class AC2 extends Orig { constructor(o) { super({ ...(o || {}), sampleRate: SRATE }); window.__ctxs.push(this); } }
  window.AudioContext = AC2; window.webkitAudioContext = AC2;
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...a) { if (d instanceof AudioDestinationNode && !window.__tapSrc) window.__tapSrc = this; return oc.call(this, d, ...a); };
  const hookStart = (P) => { const os = P.start; P.start = function (w, ...a) { try { if (w > 0 && this.context) { const dd = w - this.context.currentTime, S = window.__sched; S.n++; if (dd < S.minAhead) S.minAhead = dd; if (dd < -0.003) { S.late++; if (-dd > S.lateMax) S.lateMax = -dd; } } } catch (e) {} return os.call(this, w, ...a); }; };
  hookStart(AudioScheduledSourceNode.prototype); hookStart(AudioBufferSourceNode.prototype);
  // event-loop lag monitor
  let last = performance.now(); setInterval(() => { const n = performance.now(), g = n - last - 20; last = n; const L = window.__lag; if (g > L.max) L.max = g; if (g > 100) L.over100++; if (g > 250) L.over250++; }, 20);
  // optional frame-rate cap: the music does not depend on rAF (worker clock), so spare the CPU
  if (FPS > 0) { const raf = window.requestAnimationFrame.bind(window); let lastT = 0; window.requestAnimationFrame = (cb) => raf((t) => { const n = performance.now(); if (n - lastT >= 1000 / FPS - 2) { lastT = n; cb(t); } else window.requestAnimationFrame(cb); }); }
})();`;

const WORKLET = `
class Rec extends AudioWorkletProcessor {
  constructor() { super(); this.s = -1; this.e = -1; this.buf = new Float32Array(2 * 8192); this.n = 0; this.tot = 0; this.nblocks = 0; this.last = -1; this.gaps = 0; this.gl = []; this.cf = -1; this.idx = 0;
    this.port.onmessage = (ev) => { this.s = ev.data.start; this.e = ev.data.end; }; }
  process(inputs) {
    const i = inputs[0], L = i && i[0], R = i && (i[1] || i[0]);
    // Chrome sometimes renders 8 quanta in a catch-up burst and reports the same currentFrame for all of them: count within the burst ourselves
    if (currentFrame === this.cf) this.idx++; else { this.cf = currentFrame; this.idx = 0; }
    const f0 = currentFrame + 128 * this.idx;
    if (this.last >= 0 && f0 !== this.last + 128) { this.gaps++; if (this.gl.length < 40) this.gl.push([f0, f0 - this.last]); } this.last = f0;
    if (this.s >= 0 && f0 + 128 > this.s && f0 < this.e) {
      for (let k = 0; k < 128; k++) { const f = f0 + k; if (f < this.s || f >= this.e) continue;
        this.buf[2 * this.n] = L ? L[k] : 0; this.buf[2 * this.n + 1] = R ? R[k] : 0; this.n++; this.tot++;
        if (this.n === 8192) { this.port.postMessage({ pcm: this.buf.slice(0) }); this.n = 0; } }
      if (f0 + 128 >= this.e) { if (this.n) this.port.postMessage({ pcm: this.buf.slice(0, 2 * this.n) }); this.n = 0; this.port.postMessage({ done: this.tot, gaps: this.gaps, gapList: this.gl }); this.s = this.e = -1; }
    }
    return true;
  }
}
registerProcessor('rec', Rec);`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
import { execSync } from 'node:child_process';
// CPU is shared with a heavy video-capture job: give this browser's processes a higher scheduling priority so the main thread (which feeds the note scheduler) is not starved
function prio(browser) {
  try {
    const root = browser.process().pid; const all = [root]; let frontier = [root];
    while (frontier.length) { const kids = []; for (const p of frontier) { try { execSync(`pgrep -P ${p}`, { encoding: 'utf8' }).split('\n').filter(Boolean).forEach(k => kids.push(+k)); } catch (e) {} } all.push(...kids); frontier = kids; }
    execSync(`renice -n -12 -p ${all.join(' ')}`, { stdio: 'ignore' });
  } catch (e) { }
}

async function recordOne(browser, job) {
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 240 }, bypassCSP: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const logs = []; page.on('console', m => { const t = m.text(); if (/error|warn/i.test(m.type()) || /audio/i.test(t)) logs.push(m.type() + ': ' + t.slice(0, 200)); }); page.on('pageerror', e => logs.push('pageerror: ' + String(e).slice(0, 300)));
  const chunks = [];
  await page.exposeFunction('__pcm', (b64) => { chunks.push(Buffer.from(b64, 'base64')); });
  await page.goto(`http://localhost:${PORT}/?q=low&off=shadows,scans,grass,post`, { waitUntil: 'domcontentloaded' });
  prio(browser); const prT = setInterval(() => prio(browser), 4000);
  await page.waitForFunction(() => window.__samay && window.__samay.UI && window.__samay.UI.started, null, { timeout: 180000, polling: 500 });
  // state: pause the clock so we stay inside the chapter; levels per brief
  await page.evaluate(({ h, NORENDER }) => {
    const A = window.__samay; A.PARAM.volume = 0.9; A.PARAM.gen = 1; A.PARAM.amb = 0.3; A.PARAM.playing = false; A.PARAM.titles = false;
    if (NORENDER) { A.renderer.render = function () {}; }
    A.setTime(h);
  }, { h: job.h, NORENDER });
  await sleep(500);
  await page.evaluate(() => document.getElementById('bSound').click());
  await page.waitForFunction(() => window.__samay.AUD.on && window.__samay.AUD.ctx && window.__samay.AUD.ctx.state === 'running' && window.__tapSrc, null, { timeout: 20000 });
  // attach the tap
  const info = await page.evaluate(async ({ code }) => {
    const c = window.__samay.AUD.ctx, url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await c.audioWorklet.addModule(url);
    const node = new AudioWorkletNode(c, 'rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
    const mute = c.createGain(); mute.gain.value = 0;
    window.__tapSrc.connect(node); node.connect(mute); mute.connect(c.destination);
    window.__rec = { node, done: null };
    node.port.onmessage = (ev) => {
      if (ev.data.pcm) { const u = new Uint8Array(ev.data.pcm.buffer); let s = ''; for (let i = 0; i < u.length; i += 24576) s += String.fromCharCode.apply(null, u.subarray(i, i + 24576)); window.__pcm(btoa(s)); }
      else if (ev.data.done !== undefined) window.__rec.done = ev.data;
    };
    return { sr: c.sampleRate, state: c.state, base: c.baseLatency };
  }, { code: WORKLET });
  if (info.sr !== SR) console.log('  WARNING sample rate', info.sr);
  // settle, then lock the start to a bar downbeat of the engine's own step clock
  await page.waitForFunction((s) => window.__samay.AUD.ctx.currentTime > s, SETTLE, { timeout: 60000, polling: 250 });
  const plan = await page.evaluate(({ dur }) => {
    const A = window.__samay.AUD, c = A.ctx, sd = 60 / A.tempo / 4, b = A.beats[A.beats.length - 1];
    const need = c.currentTime + 1.2; let step = b[1] + 1, t = b[0] + sd;
    while (t < need || step % 16 !== 0) { step++; t += sd; }
    const start = Math.round(t * c.sampleRate), end = start + Math.round(dur * c.sampleRate);
    window.__rec.node.port.postMessage({ start, end }); window.__lag = { max: 0, over100: 0, over250: 0 }; window.__sched = { n: 0, late: 0, lateMax: 0, minAhead: 1e9 };
    return { startT: t, start, end, tempo: A.tempo, step, ctxNow: c.currentTime };
  }, { dur: job.dur });
  const state0 = await page.evaluate(() => { const A = window.__samay; return { t: A.S.t, dom: A.S.dom, bpm: A.S.bpm, wx: { rain: A.WX.rain, mist: A.WX.mist, storm: A.WX.storm, mode: A.WX.mode, label: A.WX.label }, w: Array.from(A.AUD.w).map(x => +x.toFixed(3)) }; });
  // wait for completion
  const deadline = Date.now() + (job.dur + 60) * 1000; let done = null; const samples = [];
  while (Date.now() < deadline) {
    await sleep(2000);
    const r = await page.evaluate(() => ({ done: window.__rec.done, now: window.__samay.AUD.ctx.currentTime, tempo: window.__samay.AUD.tempo, t: window.__samay.S.t, lag: { ...window.__lag }, sched: { ...window.__sched }, wall: performance.now() }));
    samples.push({ now: +r.now.toFixed(2), tempo: +r.tempo.toFixed(2), t: +r.t.toFixed(4), wall: Math.round(r.wall) });
    if (r.done) { done = r; break; }
  }
  await sleep(500);
  const state1 = await page.evaluate(() => { const A = window.__samay; return { t: A.S.t, dom: A.S.dom, tempo: A.AUD.tempo, lag: { ...window.__lag }, sched: { ...window.__sched }, state: A.AUD.ctx.state, w: Array.from(A.AUD.w).map(x => +x.toFixed(3)), amb: Object.fromEntries(Object.entries(A.AMB.rate).map(([k, v]) => [k, +v.toFixed(4)])) }; });
  clearInterval(prT); await ctx.close();
  if (!done) throw new Error('recording did not complete: ' + JSON.stringify(samples.slice(-3)));
  const pcm = Buffer.concat(chunks);
  const f32 = path.join(RAW, job.name + '.f32'); fs.writeFileSync(f32, pcm);
  const frames = pcm.length / 8;
  const meta = { ...job, sr: SR, frames, frames_expected: Math.round(job.dur * SR), workletGaps: done.done.gaps, gapList: done.done.gapList, workletFrames: done.done.done, plan, state0, state1, samples, wallSec: (Date.now() - t0) / 1000, logs: logs.slice(0, 20), fps: FPS };
  fs.writeFileSync(path.join(RAW, job.name + '.json'), JSON.stringify(meta, null, 1));
  console.log(`${job.name}: ${frames} frames (${(frames / SR).toFixed(3)} s) tempo ${plan.tempo.toFixed(2)} lag max ${state1.lag.max.toFixed(0)}ms >100ms:${state1.lag.over100} lateNotes ${state1.sched.late}/${state1.sched.n} lateMax ${(state1.sched.lateMax * 1000).toFixed(1)}ms wall ${meta.wallSec.toFixed(0)}s t=${state1.t.toFixed(3)}`);
  meta.good = state1.sched.lateMax < 0.010; 
  return meta;
}

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  for (const job of JOBS) { if (only && !only.includes(job.name)) continue; for (let at = 1; at <= 4; at++) { try { const m = await recordOne(browser, job); if (m.good) break; console.log(`  ${job.name}: attempt ${at} had late notes (stall) - retrying`); } catch (e) { console.log(job.name, 'FAILED', e.message); } } }
} finally { await browser.close(); }
