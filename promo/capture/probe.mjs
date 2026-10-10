import { launch, openWorld, steps, GRAB_FN, sleep } from './lib.mjs';
const [,, W, Q] = process.argv; const w = +W;
const b = await launch(); const t0 = Date.now();
const { page } = await openWorld(b, { w, h: w, q: Q, hour: 19.5 });
console.log('boot s', (Date.now() - t0) / 1000);
const info = await page.evaluate(() => { const s = window.__samay; const c = s.renderer.domElement; return { cw: c.width, ch: c.height, q: s.PARAM.quality, ipr: s.ipr(), scale: s.DR.scale, t: s.S.t, ua: navigator.userAgent, gl: s.renderer.getContext().getParameter(s.renderer.getContext().VERSION) }; });
console.log(info);
for (let k = 0; k < 3; k++) { const t = Date.now(); await steps(page, 3); console.log('3 steps', (Date.now() - t) / 3000, 's/step'); }
const t = Date.now(); const r = await page.evaluate(GRAB_FN); console.log('grab s', (Date.now() - t) / 1000, r.w, r.h, r.b64.length);
await b.close();
