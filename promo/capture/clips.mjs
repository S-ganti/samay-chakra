// Clip specs. prep = passed to window.__H.reset(); frames at 30 fps.
const MOONFN = `const m = S2.S.moonDir, u = Math.min(1, H.i / 120), p = [72, 23.7, -54]; H.orbit = { p, l: [p[0] + m.x * 100, p[1] + m.y * 100 - 13 + 7 * u, p[2] + m.z * 100], fov: 50 };`.replace('S2', 's');
const GATEFN = `const u = Math.min(1, H.i / 120), e = u * u * (3 - 2 * u); H.orbit = { p: [-60 + 6.5 * e, 14.2 + 1.6 * e, 6.5 - 4.5 * e], l: [-47, 16.4 - .1 * e, .6 - .9 * e], fov: 44 - 6 * e };`;
const ENTERFN = `const u = Math.min(1, H.i / 180), e = u * u * (3 - 2 * u); H.orbit = { p: [-92 + 20 * e, 3.0 + 1.7 * e, 9.5 - 3 * e], l: [-47, 16.0 + .6 * e, -.5], fov: 52 - 5 * e };`;
const CROWDFN = `const a = .5 + (s.S.rt) * .035; H.orbit = { p: [Math.cos(a) * 25, 11.9, Math.sin(a) * 25], l: [0, 13.2, 0], fov: 52 };`;
const TLFN = `S.t = (18 + 23.98 * Math.max(0, H.i) / 179) % 24;`;
const style = (st) => ({ frames: 45, prep: { hour: 7.2, shot: 1, wx: 'clear', style: st, rt0: 1000 }, desc: `Diamond Ring, top-down crown over the arches and mandala, style=${st}` });
export const CLIPS = {
  s01_timelapse_day: { frames: 180, prep: { hour: 18, wx: 'clear', playing: false, orbit: { p: [-100, 55, 20], l: [-40, 14, 0], fov: 55 }, fnSrc: TLFN }, desc: 'Full 24 h day timelapse from a fixed elevated view over the stairs, portal wheel and ring stage' },
  s02_enter: { frames: 180, prep: { hour: 18.5, wx: 'clear', orbit: { p: [-92, 3, 9.5], l: [-47, 16, -.5], fov: 52 }, fnSrc: ENTERFN }, desc: 'Dusk push-in up the lamp-lit steps to the glowing portal wheel' },
  s03_gathering: { frames: 180, prep: { hour: 22.5, shot: 0, wx: 'clear' }, desc: 'Gathering: high orbit over the ring stage and the red mehfil' },
  s04_eclipse: { frames: 180, prep: { hour: 1.5, shot: 0, wx: 'clear' }, desc: 'Eclipse: looking up under the dark wheel with its corona' },
  s06_diamond: { frames: 180, prep: { hour: 7.5, shot: 0, wx: 'clear' }, desc: 'Diamond Ring: arms-up view under the white-gold arches' },
  s07_dispersal: { frames: 180, prep: { hour: 10.5, shot: 2, wx: 'clear' }, desc: 'Dispersal: tracking shot along the plaza street behind a walker, auto and the great pillar' },
  s10_crowd_dance: { frames: 150, prep: { hour: 22.8, wx: 'clear', population: 420, orbit: { p: [25, 11.9, 0], l: [0, 13.2, 0], fov: 52 }, fnSrc: CROWDFN }, desc: 'Crowd dancing around the ring stage' },
};

// Lower-priority clips: rendered at 15 fps (frames = rendered frames) and motion-interpolated to 30 fps, because the software GL
// renderer costs ~4 s per frame regardless of resolution. outSeconds = frames / 15.
export const HALF = {
  s09_return: { frames: 90, prep: { hour: 16.5, shot: 0, wx: 'clear' }, desc: 'Return: the scaffolded portal wheel being rebuilt' },
  s13_rain: { frames: 60, cheap: 360, prep: { hour: 22.5, shot: 1, wx: 'rain' }, interp: 'blend', desc: 'Monsoon rain over the ring stage: streaks in the lamp light, glowing dancer trails' },
  s05_brahma: { frames: 90, prep: { hour: 4.5, shot: 0, wx: 'clear' }, desc: 'Brahma Muhurta: star-trail wheel over the ridge' },
  s08_zero: { frames: 90, prep: { hour: 13.5, shot: 0, wx: 'clear' }, desc: 'Zero Shadow: straight-down view on the carved great wheel' },
  s11_style_real: style('real'), s11_style_fusion: style('fusion'), s11_style_sumi: style('sumi'), s11_style_neon: style('neon'), s11_style_paint: style('paint'),
  s12_carving: { frames: 60, prep: { hour: 10.8, wx: 'clear', orbit: { p: [-60, 14.2, 6.5], l: [-47, 16.4, .6], fov: 44 }, fnSrc: GATEFN }, desc: 'Daylight push-in on the carved stone portal wheel' },
  s14_moon: { frames: 60, prep: { hour: 22, wx: 'clear', orbit: { p: [72, 23.7, -54], l: [100, 30, -54], fov: 50 }, fnSrc: MOONFN }, desc: 'Full moon beside the dark eclipse wheel above the stone circle' },
};
