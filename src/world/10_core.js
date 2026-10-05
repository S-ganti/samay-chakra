import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/* =========================================================================
   CORE — maths, chapters, looks, parameters
   ========================================================================= */
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const fract = (x) => x - Math.floor(x);
const wrap24 = (h) => ((h % 24) + 24) % 24;
const hdiff = (a, b) => { let d = wrap24(a - b); if (d > 12) d -= 24; return d; };
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
const hash2 = (a, b) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (h) => new THREE.Color(h);

// 2D value noise + fbm (deterministic)
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }

/* ---------- the eight prahars (from the posters) ---------- */
// desc: poster copy where the poster has it; `inferred` marks lines/tempos not printed on a poster.
const CHAPTERS = [
  { id: 'enter', n: 1, start: 18, title: 'Enter the Ring', native: 'प्रवेश', lang: 'hi', raga: 'Yaman', font: 'sans', key: '#ff8a3d',
    desc: 'Dusk: the portal wakes, the procession climbs the lamp-lit steps. Organic downtempo.', bpm: 108, inferred: true },
  { id: 'gathering', n: 2, start: 21, title: 'The Gathering', native: 'محفل', lang: 'ur', raga: 'Bihag', font: 'disp', key: '#e0332a',
    desc: 'Late evening: collective warmth, flirtation, hypnotic techno. 124–132 BPM.', bpm: 128 },
  { id: 'eclipse', n: 3, start: 0, title: 'Eclipse', native: 'གཟའ་འཛིན', lang: 'bo', raga: 'Malkauns', font: 'disp', key: '#ff3d9a',
    desc: 'Midnight peak: vast, cold, relentless hypnotic forest psytrance. 140–148 BPM.', bpm: 144 },
  { id: 'brahma', n: 4, start: 3, title: 'Brahma Muhurta', native: 'ബ്രഹ്മമുഹൂർത്തം', lang: 'ml', raga: 'Lalit', font: 'sans', key: '#7fa2e6',
    desc: 'Predawn void: sacred, tender, half-asleep ambient drone. Beatless to 80 BPM.', bpm: 72 },
  { id: 'diamond', n: 5, start: 6, title: 'Diamond Ring', native: 'প্রভাত', lang: 'bn', raga: 'Bhairav', font: 'disp', key: '#ffc247',
    desc: 'Sunrise release: second ecstatic peak, progressive psytrance, dawn after the void.', bpm: 138, bpmInferred: true },
  { id: 'dispersal', n: 6, start: 9, title: 'Dispersal', native: 'ವಿಸರ್ಜನೆ', lang: 'kn', raga: 'Todi', font: 'sten', key: '#d8342b',
    desc: 'Morning: the wheel is carried down into the city. Chai, autos, broken-beat downtempo.', bpm: 96, inferred: true },
  { id: 'zero', n: 7, start: 12, title: 'Zero Shadow', native: 'ଛାୟାହୀନ', lang: 'or', raga: 'Bhimpalasi', font: 'sans', key: '#e9b43b',
    desc: 'Noon: the sun stands overhead and the city circles the great wheel. Minimal dub.', bpm: 104, inferred: true },
  { id: 'return', n: 8, start: 15, title: 'Return', native: 'திரும்புதல்', lang: 'ta', raga: 'Marwa', font: 'sans', key: '#f0a060',
    desc: 'Late afternoon: the pieces are carried back uphill and the ring is rebuilt. Melodic organic house.', bpm: 116, inferred: true },
];
const chapterAt = (t) => { const h = wrap24(t); return h >= 18 ? (h >= 21 ? 1 : 0) : Math.floor(h / 3) + 2; };
const fmtH = (h) => { h = wrap24(h); const H = Math.floor(h), M = Math.floor((h - H) * 60); return String(H).padStart(2, '0') + ':' + String(M).padStart(2, '0'); };
const chapterSpan = (c) => fmtH(c.start) + ' – ' + fmtH(c.start + 3);

/* ---------- looks: one keyframe per chapter, held at the chapter centre ---------- */
const LOOKS = [
  { // 1 ENTER — dusk forest, amber portal
    skyZen: '#14223f', skyHor: '#7a5058', skyGlow: '#ff8a3d', cloud: '#e5874a', cloudAmt: .55, fog: '#251f26', fogD: .0085,
    sun: '#ff9a5a', sunI: 1.15, hemiS: '#46598a', hemiG: '#24180f', hemiI: .55, bloom: .7, bloomR: .55, bloomT: .62,
    lift: '#0b1113', gain: '#ffe2c4', sat: 1.08, con: 1.1, vig: .6, grain: .05, paper: 0,
    stars: .45, trail: 0, milky: .1, celes: .1, corona: '#ffb070', coronaI: .25, void: 0,
    strip: '#ff6a2a', stripI: .55, fire: .9, petals: 0, dust: .1, mist: .12,
    pTint: '#7a6a5c', pEmis: '#ff7a30', pEmisI: .06, ghost: 1.0, banner: '#9c231b', after: .12,
    streakG: 0, streakE: 0, streakCol: '#ff4a1a', practical: '#ff8a3a', practicalI: 1.0, archGlow: 0, dream: '#8a5a3c' },
  { // 2 GATHERING — crimson swirl
    skyZen: '#130a0c', skyHor: '#3d1713', skyGlow: '#7a1a12', cloud: '#3a1512', cloudAmt: .25, fog: '#2a100c', fogD: .009,
    sun: '#c06050', sunI: .7, hemiS: '#3e2c48', hemiG: '#2a1408', hemiI: 1.0, bloom: .6, bloomR: .6, bloomT: .66,
    lift: '#0e070c', gain: '#ffe0bc', sat: .96, con: 1.12, vig: .65, grain: .05, paper: 0,
    stars: .3, trail: 0, milky: .05, celes: .5, corona: '#ff6040', coronaI: .3, void: .2,
    strip: '#c8452a', stripI: .7, fire: 1.0, petals: 0, dust: .05, mist: .05,
    pTint: '#c88a68', pEmis: '#b84a2a', pEmisI: .04, ghost: 1.45, banner: '#9e2b25', after: .25,
    streakG: .55, streakE: 0, streakCol: '#c8502e', practical: '#e08a52', practicalI: 1.3, archGlow: 0, dream: '#7a3222' },
  { // 3 ECLIPSE — black, ice-blue rim, magenta dancers
    skyZen: '#03040a', skyHor: '#0d182c', skyGlow: '#3a5a8a', cloud: '#0a1020', cloudAmt: .12, fog: '#0b1322', fogD: .008,
    sun: '#a8c8ff', sunI: .85, hemiS: '#3a5588', hemiG: '#05060a', hemiI: .7, bloom: .55, bloomR: .45, bloomT: .6,
    lift: '#02040a', gain: '#d8e6ff', sat: .8, con: 1.25, vig: .7, grain: .06, paper: 0,
    stars: .75, trail: 0, milky: 0, celes: 1, corona: '#a8c8e8', coronaI: .6, void: .95,
    strip: '#9a5a78', stripI: .2, fire: .1, petals: 0, dust: 0, mist: .45,
    pTint: '#3a3e4c', pEmis: '#8a5a78', pEmisI: .07, ghost: .75, banner: '#3a2436', after: .2,
    streakG: 0, streakE: .22, streakCol: '#8fa6c8', practical: '#c07a92', practicalI: .7, archGlow: 0, dream: '#3c4a66' },
  { // 4 BRAHMA MUHURTA — indigo cyanotype, star trails
    skyZen: '#0d1a34', skyHor: '#2b4068', skyGlow: '#3a5580', cloud: '#22345a', cloudAmt: .1, fog: '#1e2d4c', fogD: .0115,
    sun: '#9fb8e8', sunI: .5, hemiS: '#3b5585', hemiG: '#0a1224', hemiI: .6, bloom: .55, bloomR: .5, bloomT: .65,
    lift: '#0b1630', gain: '#c8d8ff', sat: .35, con: .95, vig: .6, grain: .075, paper: 0,
    stars: 1.0, trail: 1, milky: .85, celes: .85, corona: '#7a9ad0', coronaI: .45, void: .7,
    strip: '#5a7ad0', stripI: .1, fire: .05, petals: 0, dust: 0, mist: .85,
    pTint: '#3a4a6a', pEmis: '#6a8ad0', pEmisI: .05, ghost: .8, banner: '#2a3350', after: .2,
    streakG: 0, streakE: 0, streakCol: '#6a8ad0', practical: '#8aa6e0', practicalI: .6, archGlow: 0, dream: '#40597a' },
  { // 5 DIAMOND RING — white marble, gold, sunburst, petals
    skyZen: '#3474c8', skyHor: '#ffb07a', skyGlow: '#ffe2b0', cloud: '#ffb89a', cloudAmt: .55, fog: '#d2b49c', fogD: .0024,
    sun: '#fff0d0', sunI: 3.0, hemiS: '#9fc4ff', hemiG: '#b08050', hemiI: .9, bloom: .5, bloomR: .6, bloomT: .92,
    lift: '#0a0810', gain: '#fff4e0', sat: 1.14, con: 1.14, vig: .38, grain: .04, paper: 0,
    stars: 0, trail: 0, milky: 0, celes: .8, corona: '#fff4d0', coronaI: .6, void: 0,
    strip: '#ffc860', stripI: .4, fire: 0, petals: 1, dust: .3, mist: .1,
    pTint: '#f2e4d0', pEmis: '#ffb050', pEmisI: .08, ghost: 1.2, banner: '#e8791e', after: .25,
    streakG: 0, streakE: 0, streakCol: '#ffd070', practical: '#ffd9a0', practicalI: .3, archGlow: 1, dream: '#d49a6a' },
  { // 6 DISPERSAL — flat photographic daylight, concrete, red circle
    skyZen: '#7fa3c8', skyHor: '#dfe4e3', skyGlow: '#fff6e8', cloud: '#ffffff', cloudAmt: .15, fog: '#c4ccd4', fogD: .0024,
    sun: '#fff4e2', sunI: 3.2, hemiS: '#c9d8e8', hemiG: '#7a6f60', hemiI: .8, bloom: .35, bloomR: .4, bloomT: .9,
    lift: '#0a0c10', gain: '#fff8ee', sat: 1.02, con: 1.14, vig: .3, grain: .035, paper: 0,
    stars: 0, trail: 0, milky: 0, celes: .12, corona: '#ffffff', coronaI: 0, void: 0,
    strip: '#b3261e', stripI: 0, fire: 0, petals: 0, dust: .35, mist: 0,
    pTint: '#d8d0c4', pEmis: '#000000', pEmisI: 0, ghost: .9, banner: '#b3261e', after: .05,
    streakG: 0, streakE: 0, streakCol: '#b3261e', practical: '#ffffff', practicalI: 0, archGlow: 0, dream: '#c9c4bc' },
  { // 7 ZERO SHADOW — parchment, sandstone, pigment specks
    skyZen: '#cfd6d6', skyHor: '#f3ecdd', skyGlow: '#fffaf0', cloud: '#fffaf0', cloudAmt: .1, fog: '#e8e0d0', fogD: .0034,
    sun: '#fff4e0', sunI: 2.6, hemiS: '#e4e8ec', hemiG: '#d0b890', hemiI: 1.15, bloom: .3, bloomR: .5, bloomT: .92,
    lift: '#2e261e', gain: '#fff6e8', sat: .88, con: 1.0, vig: .25, grain: .05, paper: .85,
    stars: 0, trail: 0, milky: 0, celes: .05, corona: '#ffffff', coronaI: 0, void: 0,
    strip: '#c0392b', stripI: 0, fire: 0, petals: 0, dust: .15, mist: 0,
    pTint: '#e8dcc8', pEmis: '#000000', pEmisI: 0, ghost: .7, banner: '#c0392b', after: .05,
    streakG: 0, streakE: 0, streakCol: '#c0392b', practical: '#ffffff', practicalI: 0, archGlow: 0, dream: '#d8c8b0' },
  { // 8 RETURN — golden haze, dusty amber
    skyZen: '#4a6894', skyHor: '#f2b36a', skyGlow: '#ffc070', cloud: '#f0a060', cloudAmt: .45, fog: '#c08a62', fogD: .0058,
    sun: '#ffaa58', sunI: 2.6, hemiS: '#8c98c0', hemiG: '#3a2616', hemiI: .72, bloom: .6, bloomR: .6, bloomT: .75,
    lift: '#120c10', gain: '#ffe0b0', sat: 1.12, con: 1.1, vig: .5, grain: .06, paper: 0,
    stars: 0, trail: 0, milky: 0, celes: .15, corona: '#ffd0a0', coronaI: .1, void: 0,
    strip: '#ff8a3a', stripI: .2, fire: .2, petals: .12, dust: .65, mist: .12,
    pTint: '#c8a888', pEmis: '#ffa050', pEmisI: .04, ghost: 1.2, banner: '#9e2b25', after: .2,
    streakG: 0, streakE: 0, streakCol: '#ffa050', practical: '#ffa050', practicalI: .5, archGlow: 0, dream: '#e0b286' },
];
// light + atmosphere per chapter: phys = weight of the physical sky/sun colour, mie = haze, fogG/fogH/fogS = ground fog
// multiplier / scale height (m) / clear distance (m), scat = poster in-scatter, envI = sky ambient, ao, shaft, expo
const LOOKX = [
  { phys: .5, mie: 1.6, fogY: 8, fogH: 16, fogS: 6, scat: .55, envI: .4, ao: .7, shaft: 1.0, expo: 1.3 },     // enter
  { phys: 0, mie: 1.2, fogY: 12, fogH: 16, fogS: 6, scat: .4, envI: .38, ao: .6, shaft: .8, expo: 1.48 },     // gathering
  { phys: 0, mie: 1.0, fogY: 24, fogH: 14, fogS: 6, scat: .5, envI: .3, ao: .55, shaft: .8, expo: 1.25 },      // eclipse
  { phys: .3, mie: 1.2, fogY: 24, fogH: 10, fogS: 4, scat: .45, envI: .4, ao: .5, shaft: .8, expo: 1.2 },     // brahma
  { phys: .15, mie: 1.05, fogY: 12, fogH: 16, fogS: 14, scat: .38, envI: .32, ao: .85, shaft: 1.0, expo: 1.0 },  // diamond
  { phys: .5, mie: 1.1, fogY: 6, fogH: 30, fogS: 10, scat: .35, envI: .45, ao: .85, shaft: .6, expo: 1.0 },    // dispersal
  { phys: .3, mie: 1.2, fogY: 8, fogH: 30, fogS: 10, scat: .3, envI: .45, ao: .8, shaft: .4, expo: 1.0 },      // zero shadow
  { phys: .25, mie: 1.9, fogY: 20, fogH: 34, fogS: 8, scat: .7, envI: .4, ao: .8, shaft: 1.0, expo: 1.0 },    // return
];
const LOOKG = [
  { shade: '#3a5590', hilite: '#ffb070', split: .3, purk: .12 },    // enter: twilight blue against the amber portal
  { shade: '#3a3a6a', hilite: '#ffc890', split: .26, purk: .08 },   // gathering: plum-indigo shade, warm firelight
  { shade: '#2a4a8a', hilite: '#e4eeff', split: .26, purk: .4 },    // eclipse: moonlit, cold
  { shade: '#2a4280', hilite: '#e0e8ff', split: .22, purk: .45 },   // brahma muhurta: cyanotype night
  { shade: '#4a6aa8', hilite: '#ffd090', split: .3, purk: 0 },      // diamond ring: sky-blue shade, gold sun
  { shade: '#5a78a8', hilite: '#fff0d8', split: .22, purk: 0 },     // dispersal: clean morning
  { shade: '#6a7890', hilite: '#ffe8c8', split: .16, purk: 0 },     // zero shadow: parchment, a whisper of cool in the shade
  { shade: '#5a5aa0', hilite: '#ffbc68', split: .34, purk: 0 },     // return: violet shade, golden hour
];
LOOKS.forEach((L, i) => Object.assign(L, LOOKX[i], LOOKG[i]));
// convert hex strings to THREE.Color once
const LOOK_KEYS = Object.keys(LOOKS[0]);
const LOOKC = LOOKS.map(L => { const o = {}; for (const k of LOOK_KEYS) o[k] = typeof L[k] === 'string' ? col(L[k]) : L[k]; return o; });
const LOOK = {}; for (const k of LOOK_KEYS) LOOK[k] = typeof LOOKS[0][k] === 'string' ? col(LOOKS[0][k]) : 0;

// chapter weights at time t: two neighbours blended around the boundary (softness s in 0..1)
const W = new Float32Array(8);
function chapterWeights(t, s) {
  W.fill(0);
  const h = wrap24(t);
  // centres at start+1.5; order by time from 19.5
  const rel = wrap24(h - 19.5) / 3;         // 0..8
  const i0 = Math.floor(rel) % 8, i1 = (i0 + 1) % 8, f = rel - Math.floor(rel);
  const s2 = clamp(s, .02, 1) / 2;
  const w1 = smooth(.5 - s2, .5 + s2, f);
  W[i0] = 1 - w1; W[i1] = w1;
  return W;
}
function blendLook(w) {
  let a = -1, b = -1;
  for (let i = 0; i < 8; i++) if (w[i] > 0) { if (a < 0) a = i; else b = i; }
  if (b < 0) b = a;
  // when the pair wraps (7 then 0) keep order irrelevant: weights carry it
  const wa = w[a], wb = a === b ? 0 : w[b];
  const A = LOOKC[a], B = LOOKC[b];
  for (const k of LOOK_KEYS) {
    const va = A[k], vb = B[k];
    if (va.isColor) LOOK[k].copy(va).multiplyScalar(wa).add(_tmpC.copy(vb).multiplyScalar(wb));
    else LOOK[k] = va * wa + vb * wb;
  }
  return LOOK;
}
const _tmpC = new THREE.Color();

/* ---------- user parameters ---------- */
// phones and tablets by the device, not the window: on a desktop the page may sit in a small embedded frame
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || ((() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })() && Math.min(screen.width, screen.height) < 900);
// render quality: ?q=high or #high in the link, else the viewer's last choice, else by device. A chosen quality is never lowered automatically
const QUALS = ['low', 'med', 'high'];
// features switched off for this start. From the link: ?off=shadows,scans,grass,post (to find what a machine can't draw). And from a start that
// lost the graphics (see bootLost): level 1 runs the same quality without shadows, level 2 runs Low. ?safe=0 forgets it
const SAFE = (() => {
  const o = { shadows: false, post: false, grass: false, scans: false, lvl: 0 };
  try {
    const u = new URLSearchParams(location.search);
    (u.get('off') || '').split(',').forEach(k => { if (k in o && k !== 'lvl') o[k] = true; });
    if (u.get('safe') === '0') localStorage.removeItem('samay.safe');
    const m = JSON.parse(localStorage.getItem('samay.safe') || 'null');
    if (m && Date.now() - m.at < 7 * 864e5) { o.lvl = m.lvl; if (m.lvl >= 1) o.shadows = true; }
  } catch (e) { }
  return o;
})();
const QPICK = (() => {
  let q = null; try { q = new URLSearchParams(location.search).get('q') || location.hash.slice(1); } catch (e) { }
  if (!QUALS.includes(q)) try { q = localStorage.getItem('samay.quality'); } catch (e) { }
  // Medium is the default everywhere; phones that report very little memory start on Low. Anyone who picks a quality keeps it
  const frail = isMobile && navigator.deviceMemory && navigator.deviceMemory <= 3;
  const r = QUALS.includes(q) ? { q, pinned: true } : { q: frail ? 'low' : 'med', pinned: false };
  // the last start never reached its first frame (the graphics reset or the tab was killed): go one quality lower and remember it, so the
  // page can't crash the same way every visit. A quality named in the link is a deliberate choice and is left alone
  if (SAFE.lvl >= 2) { r.q = 'low'; r.pinned = true; }
  let urlQ = null; try { urlQ = new URLSearchParams(location.search).get('q') || location.hash.slice(1); } catch (e) { }
  try {
    const at = +localStorage.getItem('samay.boot') || 0;
    if (at && Date.now() - at < 15 * 60000 && !QUALS.includes(urlQ) && r.q !== 'low') {
      r.q = r.q === 'high' ? 'med' : 'low'; r.pinned = true; r.stepped = true;
      localStorage.setItem('samay.quality', r.q); localStorage.removeItem('samay.boot');
    }
  } catch (e) { }
  return r;
})();
// render style: 'real' (the lit, graded render), 'fusion' (each chapter in its Fusion Series poster style), or one of the styles in
// 75_styles.js ('sumi', 'neon', 'paint'). ?style=… in the link, else the viewer's last choice. The styled looks need Medium or High
const STYLE_KEYS = ['real', 'fusion', 'sumi', 'neon', 'paint'];
const STYLE0 = (() => { let v = null; try { v = new URLSearchParams(location.search).get('style') || localStorage.getItem('samay.style'); } catch (e) { } return STYLE_KEYS.includes(v) ? v : 'real'; })();
const PARAM = {
  dayMinutes: 8, clock: false, playing: true,
  population: 180, dream: .75, stone: 1, energy: 1.6, trails: 1, exposure: 1, fog: 1, glow: 1, grain: 0, grade: 1, soft: .6,
  real: 2, shafts: 1, ao: 1, dof: true, palette: 'off', style: STYLE0,
  quality: QPICK.q, qualityPinned: QPICK.pinned,
  camera: 'director', shotLen: 8, cut: false, titles: true, frame: 'fill', lbx: false,
  volume: .8, gen: 1, amb: .3,
};
const BPM = CHAPTERS.map(c => c.bpm);

/* ---------- live state ---------- */
const S = {
  t: 3.8,          // hours
  rt: 0,           // real seconds since start
  dt: 0,
  dom: 3,          // dominant chapter index
  beat: 0, beatPos: 0, beatAud: -1, bpm: 72, pulse: 0, bass: 0, level: 0, flash: 0,   // beatPos: continuous beat count (dancers ride it)
  travel: null,    // {from, to, t0, dur}
  sunDir: V3(), moonDir: V3(), keyDir: V3(), camPos: V3(), scatDir: V3(0, 1, 0), sunT: new THREE.Color(1, 1, 1), physW: 0,
  focus: V3(),
};
