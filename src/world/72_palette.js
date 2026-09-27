/* =========================================================================
   PIGMENT PALETTES — the final image is repainted with a limited palette,
   the way a painter works from a box of ground pigments. Each chapter's
   palette was measured from its poster (dominant colours by area, then its
   accents); the families come from Indian painting traditions. Value
   (lightness) is kept from the render, hue and chroma are drawn toward the
   nearest pigments, so nothing can go neon.
   ========================================================================= */
const PIGMENT_BOX = [['#b8322a', .5], ['#2f3f5c', .5], ['#4f7f74', .5], ['#d9822b', .5], ['#e3a33b', .5], ['#efe6d4', .5], ['#6b6a45', .45], ['#1c1a18', .5]];
const POSTER_PAL = [
  // [colour, weight] — weights follow each colour's share of the poster, accents a little lower
  [['#0f0d09', 1], ['#20160e', 1], ['#372317', 1], ['#5f361e', 1], ['#454d57', .9], ['#8c5534', .9], ['#e0965e', .8], ['#92532f', .7], ['#e98e51', .6], ['#faba73', .6]],   // enter the ring
  [['#512014', 1], ['#251d17', 1], ['#78321e', 1], ['#33130b', 1], ['#463429', .9], ['#9b4e33', .9], ['#cb815c', .8], ['#a63a25', .7], ['#be623f', .7], ['#e28a5e', .6]],   // the gathering
  [['#010102', 1], ['#161d28', 1], ['#0a0e15', 1], ['#29313e', 1], ['#434c5c', 1], ['#64748d', .9], ['#a7c7e1', .8], ['#46668a', .7], ['#5b84ae', .6], ['#6d3254', .5], ['#ad487e', .45]],   // eclipse
  [['#19314d', 1], ['#132842', 1], ['#203957', 1], ['#294361', 1], ['#102036', 1], ['#37516f', .9], ['#636f7e', .8], ['#3b5574', .7], ['#9aa6b8', .5], ['#d8dde6', .4]],   // brahma muhurta
  [['#a15f36', 1], ['#c18150', 1], ['#daa476', 1], ['#eed1b3', 1], ['#42607f', 1], ['#863f19', .9], ['#7c869a', .9], ['#442113', .8], ['#db792c', .6], ['#eaab6a', .6], ['#fff4e2', .5]],   // diamond ring
  [['#cbbcad', 1], ['#b2a293', 1], ['#8e8074', 1], ['#6e6155', 1], ['#ebe5de', .9], ['#433f37', .9], ['#653d1c', .8], ['#a46f2d', .6], ['#b58f49', .6], ['#8a9aa6', .6], ['#6f7a5a', .55]],   // dispersal
  [['#f5efe6', 1], ['#eddfcd', 1], ['#e5cfb5', 1], ['#d9ba9a', 1], ['#c8a380', 1], ['#ae8866', .9], ['#946e4d', .9], ['#6d4f34', .8], ['#cc792b', .6], ['#e9b56b', .6], ['#b8322a', .45]],   // zero shadow
  [['#504640', 1], ['#7d5942', 1], ['#a5714d', 1], ['#422618', 1], ['#693f26', 1], ['#c69368', .9], ['#24130d', .9], ['#edc494', .8], ['#c78857', .6], ['#e6a86c', .6]],   // return
];
const PALETTE_FAMILIES = {
  pichwai: { name: 'Pichwai night', cols: ['#101a33', '#1d3560', '#2f4f7f', '#e9e2d0', '#c9a227', '#e2b93b', '#3f7d5a', '#b33b2e', '#0b0f1a', '#6d7fa3'] },
  mughal: { name: 'Mughal miniature', cols: ['#2a4d8f', '#c1352b', '#e2b44c', '#3e8e6a', '#c7a24a', '#efe6d2', '#e2a988', '#6b3f2a', '#1c1a18', '#8fb0c9'] },
  kalamkari: { name: 'Kalamkari', cols: ['#ece2cf', '#8e2c1f', '#b8646a', '#c9a44a', '#56704a', '#2f3f5c', '#5a3a28', '#2a2420', '#d8c3a0', '#7c8a96'] },
  chola: { name: 'Chola bronze', cols: ['#16110d', '#5c3a1c', '#8a5a2b', '#4f8a7a', '#d4a93c', '#7d1f1a', '#1f5a45', '#efe3c8', '#b98b52', '#3b4a52'] },
  bengal: { name: 'Bengal wash', cols: ['#e8dfcf', '#c3a15f', '#c49a8a', '#9c8466', '#7d8a72', '#6b7a8f', '#4a4e5a', '#3a332c', '#d8cdb8', '#a9b3b8'] },
  kerala: { name: 'Kerala mural', cols: ['#a3452b', '#d49a2a', '#3c6e4a', '#171412', '#efe7d6', '#2d4a6b', '#c77a3a', '#6e2a1c', '#e0c58a', '#7a8c8a'] },
};
// sRGB ↔ Oklab (Björn Ottosson)
const _lin = (c) => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
const _gam = (c) => c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055;
function toOklab(r, g, b, out) {
  r = _lin(r); g = _lin(g); b = _lin(b);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  out[0] = .2104542553 * l + .7936177850 * m - .0040720468 * s; out[1] = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s; out[2] = .0259040371 * l + .7827717662 * m - .8086757660 * s;
  return out;
}
function fromOklab(L, a, b, out) {
  const l = Math.pow(L + .3963377774 * a + .2158037573 * b, 3), m = Math.pow(L - .1055613458 * a - .0638541728 * b, 3), s = Math.pow(L - .0894841775 * a - 1.2914855480 * b, 3);
  out[0] = _gam(clamp(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, 0, 1)); out[1] = _gam(clamp(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, 0, 1)); out[2] = _gam(clamp(-.0041960863 * l - .7034186147 * m + 1.7076147010 * s, 0, 1));
  return out;
}
// A 3D lookup table that repaints any colour with the palette: keep the value, take hue and chroma from the pigments
// nearest in hue (and loosely in value); a little of the original chroma survives so shading stays alive
const LUT_N = 32;
function buildPaletteLUT(cols, { sAB = .055, sL = .38, keep = .18, lPull = .12, chroma = 1 } = {}) {
  const P = cols.map(([h, w]) => { const c = col(h), o = toOklab(c.r, c.g, c.b, [0, 0, 0]); return [o[0], o[1], o[2], w]; });
  const N = LUT_N, data = new Uint8Array(N * N * N * 4), lab = [0, 0, 0], rgb = [0, 0, 0];
  for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
    toOklab(ri / (N - 1), gi / (N - 1), bi / (N - 1), lab);
    let sw = 0, sa = 0, sb = 0, sl = 0;
    for (const p of P) { const da = lab[1] - p[1], db = lab[2] - p[2], dl = lab[0] - p[0]; const w = p[3] * Math.exp(-(da * da + db * db) / (sAB * sAB) - dl * dl / (sL * sL)) + 1e-9; sw += w; sa += w * p[1]; sb += w * p[2]; sl += w * p[0]; }
    const a = lerp(sa / sw, lab[1], keep) * chroma, b = lerp(sb / sw, lab[2], keep) * chroma, L = lerp(lab[0], sl / sw, lPull);
    fromOklab(L, a, b, rgb);
    const o = ((bi * N + gi) * N + ri) * 4; data[o] = Math.round(rgb[0] * 255); data[o + 1] = Math.round(rgb[1] * 255); data[o + 2] = Math.round(rgb[2] * 255); data[o + 3] = 255;
  }
  const t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}
const PAL = { chapter: [], family: {}, cur: null };
function paletteLUT(k) {
  if (k === 'poster') { if (!PAL.chapter.length) for (let i = 0; i < 8; i++) PAL.chapter.push(buildPaletteLUT([...POSTER_PAL[i], ...PIGMENT_BOX])); return PAL.chapter; }
  if (!PAL.family[k]) PAL.family[k] = buildPaletteLUT([...PALETTE_FAMILIES[k].cols.map(h => [h, 1]), ['#8a8580', .35], ['#d8d2c6', .35], ['#2a2724', .35]], { keep: .22 });
  return PAL.family[k];
}
// per frame: pick the two chapter tables in play (or the family's one) and how far between them we are
function updatePalette(PP, w) {
  const g = PP.grade.uniforms, k = PARAM.palette;
  if (k === 'off') { g.uPal.value = 0; return; }
  if (k === 'poster') {
    const L = paletteLUT('poster'); let a = -1, b = -1;
    for (let i = 0; i < 8; i++) if (w[i] > 1e-4) { if (a < 0) a = i; else b = i; }
    if (a < 0) a = 0; if (b < 0) b = a;
    g.tLutA.value = L[a]; g.tLutB.value = L[b]; g.uLutW.value = a === b ? 0 : w[b] / (w[a] + w[b]);
    g.uPal.value = .62 * PARAM.grade;
  } else {
    const t = paletteLUT(k); g.tLutA.value = t; g.tLutB.value = t; g.uLutW.value = 0; g.uPal.value = .74 * PARAM.grade;
  }
}
