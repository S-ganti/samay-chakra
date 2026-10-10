import { launch, openWorld, prepare } from './lib.mjs';
const b = await launch();
const { page } = await openWorld(b, { w: 640, h: 640, q: 'med' });
await prepare(page, { hour: 19.5, shot: 0, wx: 'clear' }, 60, 3);
const T = async (label, setup, n = 3) => {
  await page.evaluate(setup);
  const ts = [];
  for (let i = 0; i < n; i++) { const t = Date.now(); await page.evaluate(() => { window.__H.step(1, false); window.__H.sync(); }); ts.push((Date.now() - t) / 1000); }
  console.log(label.padEnd(20), ts.map(x => x.toFixed(2)).join(' '));
};
const info = await page.evaluate(() => { const s = __samay, c = {}; s.scene.traverse(o => { if (o.userData && o.userData.sys) c[o.userData.sys] = 1; }); return { sys: Object.keys(c), calls: s.renderer.info.render.calls, tris: s.renderer.info.render.triangles }; });
console.log(JSON.stringify(info));
await T('baseline', () => { });
for (const sys of info.sys) {
  await T('hide ' + sys, `(() => { __samay.scene.children.forEach(o => { if (o.userData.sys === '${sys}') o.visible = false; }); })()`);
  await page.evaluate(`(() => { __samay.scene.children.forEach(o => { if (o.userData.sys === '${sys}') o.visible = true; }); })()`);
}
await b.close();
