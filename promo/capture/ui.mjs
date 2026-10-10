// UI snippets at native viewports. Usage: node ui.mjs v|h [parts]   parts = comma list of hud,card,panel,scrub (default all)
import { launch, openWorld, prepare, FOOTAGE, sleep } from './lib.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const o = process.argv[2] || 'h', parts = (process.argv[3] || 'hud,card,panel,scrub').split(',');
const [w, h] = o === 'v' ? [1080, 1920] : [1920, 1080];
const b = await launch();
const { page } = await openWorld(b, { w, h, q: 'med', virtualTimers: true });
// the stall detector would show its modal because the page's own frame loop is stopped: hide it
await page.addStyleTag({ content: '#diag{display:none !important}' });
// toasts off (they are timer driven and would sit over the picture)
await page.evaluate(() => { window.__samay.UI.quiet = true; document.getElementById('toast').classList.remove('show'); });
const shot = async (name) => { await sleep(1300); await page.screenshot({ path: path.join(FOOTAGE, `ui_${o}_${name}.png`) }); console.log('shot', name); };
const frameStep = () => page.evaluate(() => { window.__H.step(1, false); window.__H.sync(); });

if (parts.includes('hud')) {
  await prepare(page, { hour: 19.5, shot: 0, wx: 'clear' }, 120, 6);
  await frameStep();
  await page.evaluate(() => { const a = document.getElementById('app'); a.classList.remove('carding'); document.getElementById('card').classList.remove('show'); });
  await shot('hud');
}
if (parts.includes('card')) {
  await prepare(page, { hour: 22.5, shot: 0, wx: 'clear' }, 120, 6);
  // the card's 6.5 s hide timer runs on virtual time (never advanced here), so a slow screenshot cannot race it
  await page.evaluate(() => { const s = window.__samay; window.__vt.on = true; s.PARAM.titles = true; s.UI.lastCh = -1; window.__H.step(1, false); window.__H.sync(); });
  await sleep(2500);
  await shot('card');
  await page.evaluate(() => { window.__vt.on = false; window.__vt.q.clear(); });
}
if (parts.includes('panel')) {
  await prepare(page, { hour: 7.5, shot: 0, wx: 'clear' }, 120, 6);
  await frameStep();
  await page.evaluate(() => { const a = document.getElementById('app'); a.classList.remove('carding'); document.getElementById('card').classList.remove('show'); });
  await page.click('#bPanel');
  await shot('panel');
  await page.click('#bClose'); await sleep(600);
}
if (parts.includes('scrub')) {
  // time-travel from dusk (Enter) to the Eclipse by pressing the chapter chip; UI timers and CSS transitions run on frame time
  // rendered at 15 fps (60 frames = 4 s) and blended up to 30 fps: the software renderer is ~4 s per frame
  await page.evaluate(() => { window.__fixedDt = 1 / 15; });
  await prepare(page, { hour: 18.6, shot: 0, wx: 'clear', playing: false }, 60, 5);
  await page.evaluate(() => { const s = window.__samay; s.PARAM.titles = true; s.PARAM.playing = true; window.__H.step(1, false); window.__vt = window.__vt; window.__vt.on = true; });
  await sleep(1500);
  const out = path.join(FOOTAGE, `ui_${o}_dial_scrub.mp4`);
  const ff = spawn('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', '15', '-i', '-', '-vf', 'minterpolate=fps=30:mi_mode=blend,tpad=stop=1:stop_mode=clone', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  const N = 60, t0 = Date.now(); const log = [];
  for (let i = 0; i < N; i++) {
    if (i === 8) { await page.click('#chips button:nth-child(3)'); await page.evaluate(() => { const S = window.__samay.S; if (S.travel) S.travel.dur = 3.4; }); }
    await page.evaluate((i) => {
      const s = window.__samay; window.__H.step(1, false);
      window.__vtAdvance(1000 / 15);
      // CSS transitions/animations follow frame time too: pause every animation and set it to its frame-time age
      const now = i * 1000 / 15;
      for (const a of document.getAnimations()) { if (a.__b === undefined) { a.__b = now; a.pause(); } a.currentTime = Math.max(0, now - a.__b); }
      window.__H.sync();
    }, i);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 10 === 0) { const st = await page.evaluate(() => window.__samay.S.t); log.push(st); console.log(`scrub ${o} frame ${i}/${N} t=${st.toFixed(2)} ${((Date.now() - t0) / (i + 1) / 1000).toFixed(1)} s/frame`); }
  }
  ff.stdin.end(); await done;
  fs.writeFileSync(path.join(FOOTAGE, 'meta', `ui_${o}_dial_scrub.json`), JSON.stringify({ hours: log }));
}
await b.close();
