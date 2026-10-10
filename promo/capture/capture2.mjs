// Half-rate variant (15 fps render + interpolation to 30). Usage: node capture2.mjs <size> <q> <clipName,clipName,...>   (clip specs live in clips.mjs)
import { launch, openWorld, prepare, record, FOOTAGE } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [,, SIZE, Q, NAMES] = process.argv;
const size = +SIZE, names = NAMES.split(',');
fs.mkdirSync(path.join(FOOTAGE, 'meta'), { recursive: true });
const b = await launch();
const t0 = Date.now();
const { page } = await openWorld(b, { w: size, h: size, q: Q });
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const name of names) {
    const { HALF } = await import('./clips.mjs?h' + Date.now());
  const spec = HALF[name]; if (!spec) { console.error('no such clip', name); continue; }
  const out = path.join(FOOTAGE, name + '.mp4');
  const ts = Date.now();
  try {
    await page.evaluate(() => { window.__fixedDt = 1 / 15; });
    await prepare(page, spec.prep, spec.cheap ?? 60, spec.real ?? 5);
    const r = await record(page, out, spec.frames, { crf: 14, inFps: 15, interp: spec.interp || process.env.INTERP || 'mci' });
    // camera cuts: frames where the camera snapped (after frame 0) or the director shot index changed
    const cuts = []; r.log.forEach((l, i) => { if (i > 0 && (l.snap || l.shot !== r.log[i - 1].shot)) cuts.push(+(i / 15).toFixed(3)); });
    const meta = { name, width: size, height: size, fps: 30, renderFps: 15, interpolated: spec.interp || process.env.INTERP || 'mci', frames: spec.frames * 2, duration: spec.frames / 15, quality: Q, style: spec.prep.style || 'real', hourStart: r.log[0].t, hourEnd: r.log[r.log.length - 1].t, shots: [...new Set(r.log.map(l => l.name))], cuts, wallSeconds: r.secs, desc: spec.desc || '' };
    fs.writeFileSync(path.join(FOOTAGE, 'meta', name + '.json'), JSON.stringify(meta, null, 1));
    console.log(`DONE ${name} in ${((Date.now() - ts) / 1000).toFixed(0)} s (${(r.secs / spec.frames).toFixed(2)} s/frame) cuts=${JSON.stringify(cuts)}`);
  } catch (e) { console.error('FAILED', name, e); }
}
await b.close();
