import { launch, openWorld } from './lib.mjs';
const [,, W, Q, SC, N] = process.argv; const w = +W;
const b = await launch();
const { page } = await openWorld(b, { w, h: w, q: Q, hour: 19.5 });
await page.evaluate((sc) => { const s = window.__samay; s.DR.scale = sc; s.ctx.resize(); }, +SC);
const sync = `(() => { const gl = window.__samay.renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); })()`;
const ts = [];
for (let k = 0; k < +N; k++) { const t = Date.now(); await page.evaluate(`(() => { window.__samay.step(1000/30); ${sync}; })()`); ts.push((Date.now() - t) / 1000); }
// cpu-only step cost: no render
const t1 = Date.now(); await page.evaluate(() => { const s = window.__samay, r = s.PP.composer.render; s.PP.composer.render = () => {}; for (let i = 0; i < 30; i++) s.step(1000 / 30); s.PP.composer.render = r; }); const cpu = (Date.now() - t1) / 30000;
console.log(`W=${W} q=${Q} scale=${SC} frames:`, ts.map(x => x.toFixed(1)).join(' '), ' mean(excl first 2)=', (ts.slice(2).reduce((a, c) => a + c, 0) / (ts.length - 2)).toFixed(2), ' cpu-only step', cpu.toFixed(3));
await b.close();
