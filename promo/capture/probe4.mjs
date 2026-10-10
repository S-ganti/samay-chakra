import { launch, openWorld, prepare } from './lib.mjs';
const b = await launch();
const { page } = await openWorld(b, { w: 1440, h: 1440, q: 'med' });
await prepare(page, { hour: 19.5, shot: 0, wx: 'clear' }, 60, 3);
const T = async (label, setup, n = 5) => {
  await page.evaluate(setup);
  const ts = [];
  for (let i = 0; i < n; i++) { const t = Date.now(); await page.evaluate(() => { window.__H.step(1, false); window.__H.sync(); }); ts.push((Date.now() - t) / 1000); }
  console.log(label.padEnd(28), ts.map(x => x.toFixed(2)).join(' '), 'mean(last4)=', (ts.slice(1).reduce((a, c) => a + c, 0) / (n - 1)).toFixed(2));
};
await T('baseline', () => { });
await T('dof off', () => { __samay.PARAM.dof = false; });
await T('ao 0', () => { __samay.PARAM.ao = 0; });
await T('shafts 0', () => { __samay.PARAM.shafts = 0; });
await T('shadows off', () => { __samay.SK.key.castShadow = false; });
await T('pop 60', () => { __samay.PARAM.population = 60; });
await T('all off', () => { });
await b.close();
