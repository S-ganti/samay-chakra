// Scout custom specs: node scout2.mjs <outdir> <size> <specs.json>   specs: [{name, prep:{...}}]
import { launch, openWorld, prepare, grabTo } from './lib.mjs';
import fs from 'node:fs';
const [,, OUT, SIZE, SPECS] = process.argv; fs.mkdirSync(OUT, { recursive: true });
const specs = JSON.parse(fs.readFileSync(SPECS, 'utf8'));
const b = await launch(); const { page } = await openWorld(b, { w: +SIZE, h: +SIZE, q: 'med' });
for (const sp of specs) {
  const t0 = Date.now();
  await prepare(page, sp.prep, sp.cheap ?? 90, sp.real ?? 6);
  const info = await page.evaluate(() => { const s = window.__samay; return { t: s.S.t, moon: s.S.moonDir.toArray().map(v => +v.toFixed(3)), sun: s.S.sunDir.toArray().map(v => +v.toFixed(3)), illum: s.MOON.illum, shot: s.CAM.shotName, pos: s.CAM.cam.position.toArray().map(v => +v.toFixed(1)), carve: s.CARVE.pending }; });
  await grabTo(page, `${OUT}/${sp.name}.jpg`);
  console.log(sp.name, JSON.stringify(info), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await b.close();
