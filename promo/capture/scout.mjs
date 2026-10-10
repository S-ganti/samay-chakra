// Scout every director shot at every chapter centre: one frame each, small & fast.
import { launch, openWorld, prepare, grabTo } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2], W = +process.argv[3] || 640, only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
fs.mkdirSync(OUT, { recursive: true });
const NSHOT = [4, 3, 3, 4, 3, 3, 3, 4], CENT = [19.5, 22.5, 1.5, 4.5, 7.5, 10.5, 13.5, 16.5];
const b = await launch();
const { page } = await openWorld(b, { w: W, h: W, q: 'med' });
for (let c = 0; c < 8; c++) {
  if (only && !only.includes(c)) continue;
  for (let k = 0; k < NSHOT[c]; k++) {
    const t0 = Date.now();
    await prepare(page, { hour: CENT[c], shot: k, wx: 'clear', style: 'real' }, 90, 8);
    const info = await page.evaluate(() => ({ name: window.__samay.CAM.shotName, shot: window.__samay.CAM.shot, t: window.__samay.S.t }));
    await grabTo(page, `${OUT}/c${c + 1}_s${k}.jpg`);
    console.log(`ch${c + 1} shot${k} -> ${info.name} (actual idx ${info.shot}) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
await b.close();
