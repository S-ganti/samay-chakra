import { launch, openWorld, GRAB_FN } from './lib.mjs';
const [,, W, Q, N] = process.argv; const w = +W;
const b = await launch();
const { page } = await openWorld(b, { w, h: w, q: Q, hour: 19.5 });
const sync = `(() => { const gl = window.__samay.renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); })()`;
for (let k = 0; k < +N; k++) { const t = Date.now(); await page.evaluate(`(() => { window.__samay.step(1000/30); ${sync}; })()`); console.log('step', k, ((Date.now() - t) / 1000).toFixed(2)); }
let t = Date.now(); const r = await page.evaluate(GRAB_FN); console.log('grab only s', (Date.now() - t) / 1000);
const cpu = await page.evaluate(() => { const s = window.__samay; return { people: s.S.msPeople }; }); console.log(cpu);
await b.close();
