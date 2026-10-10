// Shared helpers: deterministic stepping capture of the Samay Chakra build via Playwright + SwiftShader.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.SAMAY_URL || 'http://localhost:4173/';
export const FOOTAGE = path.resolve(new URL('../footage', import.meta.url).pathname);
export const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--enable-webgl', '--disable-gpu-vsync', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function launch() {
  let exe = CHROME; if (!fs.existsSync(exe)) exe = undefined;
  return chromium.launch({ headless: true, executablePath: exe, args: ARGS });
}

// open a page, boot it, stop the app's own rAF loop so we drive frames via __samay.step()
export async function openWorld(browser, { w, h, q = 'med', style = 'real', hour = null, virtualTimers = false, dsf = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console.error]', m.text().slice(0, 300)); });
  await page.addInitScript(({ virtualTimers }) => {
    window.__fixedDt = 1 / 30;
    // a fixed "now" for the moon phase (full moon, 2026-10-26) so every clip sees the same sky
    { const rn = Date.now.bind(Date); window.__fakeNow = Date.UTC(2026, 9, 26, 12, 0, 0); Date.now = () => window.__fakeNow; window.__realNow = rn; }
    try { localStorage.removeItem('samay.boot'); localStorage.removeItem('samay.safe'); localStorage.removeItem('samay.quality'); localStorage.removeItem('samay.style'); sessionStorage.clear(); } catch (e) { }
    // rAF gate: once __freeze is true, callbacks are swallowed (the page's own loop dies after one more frame)
    const raf = window.requestAnimationFrame.bind(window);
    window.__freeze = false;
    window.requestAnimationFrame = (cb) => window.__freeze ? 0 : raf(cb);
    if (virtualTimers) {
      // timers created while __vt.on are driven by simulated time, so toasts / the title card live in frame time
      const st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window);
      const VT = window.__vt = { on: false, now: 0, id: 1e6, q: new Map() };
      window.setTimeout = (fn, ms = 0, ...a) => { if (!VT.on || typeof fn !== 'function') return st(fn, ms, ...a); const id = ++VT.id; VT.q.set(id, { due: VT.now + (+ms || 0), fn, a }); return id; };
      window.clearTimeout = (id) => { if (VT.q.has(id)) VT.q.delete(id); else ct(id); };
      window.__vtAdvance = (ms) => { VT.now += ms; for (const [id, t] of [...VT.q]) if (t.due <= VT.now) { VT.q.delete(id); try { t.fn(...t.a); } catch (e) { } } };
    }
  }, { virtualTimers });
  const url = `${BASE}?q=${q}&style=${style}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__samay && window.__samay.UI && window.__samay.UI.started === true, null, { timeout: 600000, polling: 500 });
  await page.evaluate(() => { window.__freeze = true; });
  await sleep(300);
  await page.evaluate(() => { const s = window.__samay; s.DR.scale = 1; s.ctx.resize(); s.PARAM.playing = true; });
  await page.evaluate(HELPERS);
  if (hour !== null) await page.evaluate((hh) => window.__samay.setTime(hh), hour);
  return { ctx, page };
}

// in-page helpers (window.__H): deterministic scene preparation, camera locking, cheap warm-up
export const HELPERS = `(() => {
  const s = window.__samay;
  const H = window.__H = {
    idx: null, orbit: null, fn: null,
    chOf: (h) => Math.floor((((h % 24) + 24) % 24 + 6) % 24 / 3),
    // put the world in a reproducible state: time, clock, beat, camera spring; lock the director to one shot (idx) or a custom orbit camera
    reset(o) {
      const { S, PARAM, CAM } = s;
      s.setTime(o.hour); S.rt = o.rt0 ?? 1000; S.beatPos = 0; S.beat = 0; S.pulse = 0;
      CAM.booted = false; CAM.chapter = -1; CAM.shot = -1; CAM.flight = null; CAM.cutKey = null; CAM.vel.set(0, 0, 0); CAM.lvel.set(0, 0, 0);
      PARAM.shotLen = 1e6; PARAM.cut = true; PARAM.titles = false; PARAM.playing = o.playing !== false;
      H.idx = o.shot ?? 0; H.orbit = o.orbit || null; H.fn = o.fnSrc ? new Function('S', 's', 'H', o.fnSrc) : null; H.i = 0;
      if (o.population) PARAM.population = o.population;
      PARAM.camera = H.orbit ? 'orbit' : 'director';
      if (o.wx) { const sel = document.getElementById('sWx'); sel.value = o.wx; sel.dispatchEvent(new Event('change')); }
      if (o.style) { const sel = document.getElementById('sStyle'); sel.value = o.style; sel.dispatchEvent(new Event('change')); }
      s.MOON.at = -1e9;
      s.PP.taa.reset = true;
    },
    pre() {
      const { S, CAM, PARAM } = s;
      if (H.fn) H.fn(S, s, H);
      if (H.orbit) {
        const O = H.orbit; CAM.controls.maxPolarAngle = Math.PI; CAM.controls.minDistance = 0.01; CAM.cam.position.set(...O.p); CAM.controls.target.set(...O.l);
        if (CAM.cam.fov !== O.fov) { CAM.cam.fov = O.fov; CAM.cam.updateProjectionMatrix(); }
      } else { CAM.chapter = H.chOf(S.t); CAM.chapterRt = S.rt - 1e6 * H.idx; }
    },
    step(n, cheap) {
      const { PP } = s, r = PP.composer.render;
      if (cheap) PP.composer.render = () => {};
      try { for (let i = 0; i < n; i++) { H.pre(); s.step(1000 / 30); H.i++; } } finally { PP.composer.render = r; }
    },
    sync() { const gl = s.renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); },
  };
})()`;

// run N simulated frames (no readback)
export async function steps(page, n) {
  await page.evaluate((n) => { const s = window.__samay; for (let i = 0; i < n; i++) s.step(1000 / 30); }, n);
}

// grab the current canvas as raw RGBA (bottom-up) base64 -> Buffer
export const GRAB_FN = `(() => {
  const s = window.__samay, c = s.renderer.domElement, gl = s.renderer.getContext();
  const w = c.width, h = c.height; if (!window.__buf || window.__buf.length !== w * h * 4) window.__buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, window.__buf);
  // base64 in chunks
  let bin = ''; const b = window.__buf, CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) bin += String.fromCharCode.apply(null, b.subarray(i, i + CH));
  return { w, h, b64: btoa(bin) };
})()`;

export function startFfmpeg(out, w, h, { crf = 14, fps = 30, vflip = true, cropTo = null } = {}) {
  const vf = [vflip ? 'vflip' : null, cropTo ? `scale=${cropTo}:flags=lanczos` : null, 'format=yuv420p'].filter(Boolean).join(',');
  const p = spawn('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-', '-vf', vf,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  return { stdin: p.stdin, done };
}

// step N frames, grabbing each to ffmpeg. perFrame(i) optional hook (runs in node before each step)
export async function record(page, out, n, { crf = 14, perFrame = null, evalPerFrame = null, size = null } = {}) {
  let ff = null, t0 = Date.now(); const log = [];
  for (let i = 0; i < n; i++) {
    if (perFrame) await perFrame(i);
    const r = await page.evaluate(`(() => { const s = window.__samay, H = window.__H; H.step(1, false); const o = ${GRAB_FN}; o.t = s.S.t; o.shot = s.CAM.shot; o.snap = !!s.CAM.snapped; o.name = s.CAM.shotName; return o; })()`);
    log.push({ t: r.t, shot: r.shot, snap: r.snap, name: r.name });
    if (!ff) ff = startFfmpeg(out, r.w, r.h, { crf });
    const buf = Buffer.from(r.b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res));
    if (i % 15 === 0) console.log(`  ${path.basename(out)} frame ${i}/${n}  ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame`);
  }
  ff.stdin.end(); await ff.done;
  return { frames: n, secs: (Date.now() - t0) / 1000, log };
}

// reset + warm-up: `cheap` frames with the draw call skipped, then `real` fully rendered frames (TAA history, DOF, shadows settle)
export async function prepare(page, o, cheap = 100, real = 10) {
  await page.evaluate((o) => window.__H.reset(o), o);
  await page.evaluate((n) => window.__H.step(n, true), cheap);
  for (let i = 0; i < real; i++) await page.evaluate(() => { window.__H.step(1, false); window.__H.sync(); });
  await page.evaluate(() => { window.__H.i = 0; });
}
export async function stepSync(page, n = 1) { await page.evaluate((n) => { for (let i = 0; i < n; i++) { window.__H.step(1, false); } window.__H.sync(); }, n); }
// raw grab -> file via ffmpeg (PNG or JPG)
// (the WebGL drawing buffer is only valid in the task that rendered it, so the last step and the read-back share one evaluate)
export async function grabTo(page, file, { vflip = true, scale = null } = {}) {
  const r = await page.evaluate(`(() => { window.__H.step(1, false); return ${GRAB_FN}; })()`);
  const vf = [vflip ? 'vflip' : null, scale ? `scale=${scale}:flags=lanczos` : null].filter(Boolean).join(',');
  await new Promise((res, rej) => { const p = spawn('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${r.w}x${r.h}`, '-i', '-', ...(vf ? ['-vf', vf] : []), '-frames:v', '1', ...(file.endsWith('.jpg') ? ['-q:v', '2'] : []), file], { stdio: ['pipe', 'inherit', 'inherit'] }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); p.stdin.end(Buffer.from(r.b64, 'base64')); });
  return r;
}
