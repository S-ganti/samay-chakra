/* =========================================================================
   CARVING — stone relief the way the posters show it. Motifs (Hoysala-style
   friezes of elephants, horsemen and musicians, dancers and seated figures
   in niches, lotus and chakra medallions, vine scrolls, beaded mouldings,
   incised inscriptions) are drawn as HEIGHT, not as painted shading. Each
   sheet becomes a normal map (so the sun and the lamps rake across the
   relief), an albedo with dust in the grooves, worn bright edges, lichen,
   rain streaks and patina, and a roughness/metal map (gold inlay).
   Sheets are generated in slices so the page never stalls; the materials
   exist from the start and sharpen as their sheet finishes.
   ========================================================================= */
/* The carving library is one self-contained function: the page calls it once, and the workers run the very same
   source (carveLib.toString()), so it survives any bundler or minifier renaming. */
function carveLib() {
  // the few core helpers the carving needs, kept inside so the whole library can run in a worker as-is
  const TAU = Math.PI * 2, clamp = (x, a, b) => (x < a ? a : x > b ? b : x), lerp = (a, b, t) => a + (b - a) * t, fract = (x) => x - Math.floor(x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash2 = (a, b) => fract(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
  const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const _mkc = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function hbuf(w, h, v = 0, ty = false) { const a = new Float32Array(w * h); if (v) a.fill(v); return { w, h, a, ty }; }
  // separable box blur: wraps in x (every sheet tiles sideways), wraps in y only for sheets that tile vertically.
  // Running sums, index tables instead of modulo, and a row-order vertical pass (cache friendly)
  function blurH(H, r, it = 2) {
    const { w, h, ty } = H, n = w * h; r = Math.max(1, Math.round(r));
    const inv = 1 / (2 * r + 1), tmp = new Float32Array(n), A = new Float32Array(n), col = new Float64Array(w); let B = null, src = H.a;
    const wx = (x) => ((x % w) + w) % w, wy = ty ? (y) => ((y % h) + h) % h : (y) => (y < 0 ? 0 : y >= h ? h - 1 : y);
    const xa = new Int32Array(w), xs = new Int32Array(w), ya = new Int32Array(h), ys = new Int32Array(h);
    for (let x = 0; x < w; x++) { xa[x] = wx(x + r + 1); xs[x] = wx(x - r); }
    for (let y = 0; y < h; y++) { ya[y] = wy(y + r + 1) * w; ys[y] = wy(y - r) * w; }
    for (let k = 0; k < it; k++) {
      const dst = k % 2 ? (B || (B = new Float32Array(n))) : A;
      for (let y = 0; y < h; y++) {
        const o = y * w; let s = 0;
        for (let i = -r; i <= r; i++) s += src[o + wx(i)];
        for (let x = 0; x < w; x++) { tmp[o + x] = s * inv; s += src[o + xa[x]] - src[o + xs[x]]; }
      }
      col.fill(0);
      for (let i = -r; i <= r; i++) { const o = wy(i) * w; for (let x = 0; x < w; x++) col[x] += tmp[o + x]; }
      for (let y = 0; y < h; y++) {
        const o = y * w, oa = ya[y], os = ys[y];
        for (let x = 0; x < w; x++) { dst[o + x] = col[x] * inv; col[x] += tmp[oa + x] - tmp[os + x]; }
      }
      src = dst;
    }
    return { w, h, a: src, ty };
  }
  // a mask canvas (drawn in white) → float buffer
  function maskOf(c, ty) { const w = c.width, h = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = d[i * 4] / 255; return { w, h, a, ty }; }
  // raised layer with a rounded ("pillowed") profile: crisp carved outline, soft swelling inside
  function addPillow(H, M, amp, r, flat = .38) { const B = blurH(M, r); for (let i = 0; i < H.a.length; i++) { const m = M.a[i]; if (m > 0) H.a[i] += amp * m * (flat + (1 - flat) * Math.min(1, B.a[i] * 1.6)); } }
  function addLayer(H, M, amp, r = 0) { const B = r ? blurH(M, r, 1) : M; for (let i = 0; i < H.a.length; i++) H.a[i] += amp * B.a[i]; }
  // tileable value noise (period px, py lattice cells; py = 0 → no wrap in y)
  function tnoise(x, y, px, py) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px; let y0 = yi, y1 = yi + 1; if (py) { y0 = ((yi % py) + py) % py; y1 = (y0 + 1) % py; }
    const a = hash2(x0, y0), b = hash2(x1, y0), c = hash2(x0, y1), d = hash2(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // smooth tileable fbm field: computed at quarter resolution, upsampled bilinearly
  function field(w, h, cells, oct, seed, ty, sy = 1) {
    const lw = Math.max(8, w >> 2), lh = Math.max(8, h >> 2), lo = new Float32Array(lw * lh), cy = Math.max(1, Math.round(cells * h / w * sy)), norm = 1 / (1 - Math.pow(.5, oct));
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      let s = 0, a = .5, f = 1; const nx = x / lw * cells, ny = y / lh * cy;
      for (let o = 0; o < oct; o++) { s += a * tnoise(nx * f + seed * 7, ny * f + seed * 3, cells * f, ty ? cy * f : 0); f *= 2; a *= .5; }
      lo[y * lw + x] = s * norm;
    }
    const out = new Float32Array(w * h), XA = new Int32Array(w), XB = new Int32Array(w), TX = new Float32Array(w);
    for (let x = 0; x < w; x++) { const fx = (x + .5) / w * lw - .5, xi = Math.floor(fx); TX[x] = fx - xi; XA[x] = ((xi % lw) + lw) % lw; XB[x] = (XA[x] + 1) % lw; }
    for (let y = 0; y < h; y++) {
      const fy = (y + .5) / h * lh - .5, yi = Math.floor(fy), t = fy - yi;
      const ya = (ty ? ((yi % lh) + lh) % lh : clamp(yi, 0, lh - 1)) * lw, yb = (ty ? (((yi + 1) % lh) + lh) % lh : clamp(yi + 1, 0, lh - 1)) * lw, o = y * w;
      for (let x = 0; x < w; x++) { const a = XA[x], b = XB[x], p = lo[ya + a] + (lo[ya + b] - lo[ya + a]) * TX[x], q = lo[yb + a] + (lo[yb + b] - lo[yb + a]) * TX[x]; out[o + x] = p + (q - p) * t; }
    }
    return out;
  }
  // stone grain: broad undulation, fine sand, and short chisel strokes
  function grain(H, amp, seed, chisel = 1) {
    const { w, h } = H, r = rng(seed), n = w * h, F = field(w, h, 16, 3, seed, H.ty);
    const wn = new Float32Array(n); for (let i = 0; i < n; i++) wn[i] = r() - .5;
    const B = blurH({ w, h, a: wn, ty: H.ty }, 1, 1);
    for (let i = 0; i < n; i++) H.a[i] += amp * ((F[i] - .5) * .9 + B.a[i] * 2.4);
    const nm = (n / 600 * chisel) | 0;
    for (let k = 0; k < nm; k++) { const x0 = (r() * w) | 0, y0 = (r() * h) | 0, L = 3 + r() * 7, dx = r() < .5 ? 1 : -1; for (let j = 0; j < L; j++) { const yy = H.ty ? (y0 + j) % h : Math.min(h - 1, y0 + j); H.a[yy * w + ((x0 + dx * (j >> 1)) % w + w) % w] -= amp * .8; } }
  }
  // horizontal moulding across a band: torus (roll), fillet (flat step), cyma (S-curve), cavetto (hollow)
  function moulding(H, y0, y1, kind, amp) {
    const { w } = H;
    for (let y = Math.max(0, y0 | 0); y < Math.min(H.h, Math.ceil(y1)); y++) {
      const t = (y + .5 - y0) / (y1 - y0);
      const v = kind === 'torus' ? Math.sqrt(Math.max(0, Math.sin(clamp(t, 0, 1) * Math.PI))) : kind === 'cyma' ? (t < .5 ? Math.sin(t * Math.PI) : .5 + .5 * Math.cos((t - .5) * 2 * Math.PI)) * .9 : kind === 'cavetto' ? 1 - Math.sin(clamp(t, 0, 1) * Math.PI) * .6 : 1;
      for (let x = 0; x < w; x++) H.a[y * w + x] += amp * v;
    }
  }

  /* ---------- drawing: a motif draws into up to three layers at once
     C.a = main relief, C.b = raised detail on top, C.n = incised lines ---------- */
  function mcv(w, h) { const c = _mkc(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; return [c, x]; }
  function layers(w, h, ...keys) { const L = { cv: {} }; for (const k of keys) { const [c, x] = mcv(w, h); L.cv[k] = c; L[k] = x; } return L; }
  const _cx = (C) => [C.a, C.b, C.n].filter(Boolean);
  function cstamp(C, W, px, py, fn, flip = false, wrap = true, sc = 1) {
    for (const o of wrap ? [-W, 0, W] : [0]) {
      const cs = _cx(C); for (const c of cs) { c.save(); c.translate(px + o, py); c.scale(flip ? -sc : sc, sc); }
      fn(C); for (const c of cs) c.restore();
    }
  }
  const _cP = (x) => { x.beginPath(); return x; };
  const MOTIF = {
    lotus(C, r, petals = 12) {
      const a = C.a;
      for (let i = 0; i < petals; i++) { a.save(); a.rotate(i / petals * TAU); _cP(a).moveTo(r * .28, 0); a.quadraticCurveTo(r * .62, -r * .22, r * .98, 0); a.quadraticCurveTo(r * .62, r * .22, r * .28, 0); a.fill(); a.restore(); }
      _cP(a).arc(0, 0, r * .28, 0, TAU); a.fill();
      if (C.b) { const b = C.b; for (let i = 0; i < petals; i++) { b.save(); b.rotate((i + .5) / petals * TAU); _cP(b).moveTo(r * .2, 0); b.quadraticCurveTo(r * .42, -r * .15, r * .64, 0); b.quadraticCurveTo(r * .42, r * .15, r * .2, 0); b.fill(); b.restore(); } _cP(b).arc(0, 0, r * .16, 0, TAU); b.fill(); }
      if (C.n) { C.n.lineWidth = r * .018; for (let i = 0; i < petals; i++) { const q = i / petals * TAU; _cP(C.n).moveTo(Math.cos(q) * r * .34, Math.sin(q) * r * .34); C.n.lineTo(Math.cos(q) * r * .9, Math.sin(q) * r * .9); C.n.stroke(); } }
    },
    starLotus(C, r, n = 8) {   // pointed petals in two layers, in a beaded ring (the eclipse rim medallions)
      const a = C.a;
      a.lineWidth = r * .09; _cP(a).arc(0, 0, r * .95, 0, TAU); a.stroke();
      for (let i = 0; i < n; i++) { a.save(); a.rotate(i / n * TAU); _cP(a).moveTo(r * .14, 0); a.quadraticCurveTo(r * .5, -r * .19, r * .84, 0); a.quadraticCurveTo(r * .5, r * .19, r * .14, 0); a.fill(); a.restore(); }
      if (C.b) { const b = C.b; for (let i = 0; i < n; i++) { b.save(); b.rotate((i + .5) / n * TAU); _cP(b).moveTo(r * .12, 0); b.quadraticCurveTo(r * .34, -r * .11, r * .56, 0); b.quadraticCurveTo(r * .34, r * .11, r * .12, 0); b.fill(); b.restore(); }
        _cP(b).arc(0, 0, r * .15, 0, TAU); b.fill(); for (let i = 0; i < 32; i++) { const q = i / 32 * TAU; _cP(b).arc(Math.cos(q) * r * .95, Math.sin(q) * r * .95, r * .035, 0, TAU); b.fill(); } }
      if (C.n) { C.n.lineWidth = r * .02; for (let i = 0; i < n; i++) { const q = i / n * TAU; _cP(C.n).moveTo(Math.cos(q) * r * .2, Math.sin(q) * r * .2); C.n.lineTo(Math.cos(q) * r * .78, Math.sin(q) * r * .78); C.n.stroke(); } }
    },
    chakra(C, r, spokes = 8) {  // Konark wheel: rim, thick and thin spokes, hub
      const a = C.a;
      a.lineWidth = r * .14; _cP(a).arc(0, 0, r * .9, 0, TAU); a.stroke();
      for (let i = 0; i < spokes * 2; i++) { const q = i / (spokes * 2) * TAU; a.lineWidth = i % 2 ? r * .05 : r * .1; _cP(a).moveTo(Math.cos(q) * r * .2, Math.sin(q) * r * .2); a.lineTo(Math.cos(q) * r * .83, Math.sin(q) * r * .83); a.stroke(); }
      _cP(a).arc(0, 0, r * .24, 0, TAU); a.fill();
      if (C.b) { const b = C.b; for (let i = 0; i < 28; i++) { const q = i / 28 * TAU; _cP(b).arc(Math.cos(q) * r * .9, Math.sin(q) * r * .9, r * .045, 0, TAU); b.fill(); } _cP(b).arc(0, 0, r * .12, 0, TAU); b.fill();
        for (let i = 0; i < spokes; i++) { const q = i / spokes * TAU; _cP(b).arc(Math.cos(q) * r * .55, Math.sin(q) * r * .55, r * .07, 0, TAU); b.fill(); } }
      if (C.n) { C.n.lineWidth = r * .02; _cP(C.n).arc(0, 0, r * .8, 0, TAU); C.n.stroke(); _cP(C.n).arc(0, 0, r * .3, 0, TAU); C.n.stroke(); }
    },
  };
  // patra-lata: a wavy stem with spiral curls and leaves, tileable over W
  function vine(C, W, y0, amp, n, lw) {
    const a = C.a; a.lineWidth = lw; _cP(a);
    for (let i = 0; i <= 240; i++) { const t = i / 240, px = t * W, py = y0 + Math.sin(t * n * TAU) * amp; i ? a.lineTo(px, py) : a.moveTo(px, py); } a.stroke();
    for (let k = 0; k < n * 2; k++) {
      const t = (k + .25) / (n * 2), px = t * W, up = k % 2 ? 1 : -1, cy = y0 + up * amp * .15;
      a.lineWidth = lw * .8; _cP(a);
      for (let j = 0; j <= 30; j++) { const q = j / 30 * TAU * 1.3, rr = amp * .85 * (1 - j / 34); const qx = px + Math.cos(q * up) * rr * .9, qy = cy - up * amp * .3 + Math.sin(q * up) * rr * .7; j ? a.lineTo(qx, qy) : a.moveTo(qx, qy); } a.stroke();
      const L = C.b || a; _cP(L).ellipse(px + W / (n * 4), y0 - up * amp * .55, amp * .38, amp * .15, up * .6, 0, TAU); L.fill();
    }
  }
  function beads(x, W, y, r, gap = 2.7) { for (let px = r; px < W + r; px += r * gap) { _cP(x).arc(px, y, r, 0, TAU); x.fill(); } }
  // an incised line of pseudo-script (Old Kannada-like loops and hooks), seeded
  function glyphs(x, W, y, h, seed) {
    const r = rng(seed); x.lineWidth = h * .14; let px = h * .4;
    while (px < W - h) {
      const k = (r() * 6) | 0, g = h * .5; x.save(); x.translate(px, y);
      _cP(x);
      if (k === 0) { x.arc(0, 0, g * .45, Math.PI * .2, Math.PI * 1.9); }
      else if (k === 1) { x.moveTo(-g * .4, -g * .5); x.lineTo(-g * .4, g * .4); x.quadraticCurveTo(0, g * .7, g * .4, g * .2); }
      else if (k === 2) { x.arc(0, g * .1, g * .35, 0, TAU); x.moveTo(0, -g * .25); x.lineTo(0, -g * .7); }
      else if (k === 3) { x.moveTo(-g * .45, 0); x.quadraticCurveTo(0, -g * .8, g * .45, 0); x.quadraticCurveTo(0, g * .5, -g * .2, g * .1); }
      else if (k === 4) { x.moveTo(-g * .4, -g * .4); x.lineTo(g * .4, -g * .4); x.moveTo(0, -g * .4); x.lineTo(0, g * .5); x.arc(g * .2, g * .5, g * .2, Math.PI, 0, true); }
      else { x.arc(-g * .2, 0, g * .25, 0, TAU); x.moveTo(g * .05, 0); x.arc(g * .3, 0, g * .25, Math.PI, Math.PI * 2.6); }
      x.stroke(); x.restore(); px += h * (.75 + r() * .35); if (r() < .12) px += h * .5;
    }
  }

  /* ---------- height → maps ---------- */
  // colours: two base tones, groove grime, worn edge, lichen / patina / pigment, rain streaks
  const STONES = {
    sandstone: { a: '#d2b893', b: '#b08a62', band: '#c49864', groove: '#3a2a1d', edge: '#f2e4c8', rough: .86, lichen: ['#c26f2e', '#9c5e2a'], stain: '#6a5a48', patina: '#4a7d72', pigment: '#8e3524' },
    buff: { a: '#dcc8a4', b: '#c2a47a', band: '#cca976', groove: '#4a3726', edge: '#f6ecd6', rough: .84, lichen: ['#c26f2e', '#b08638'], stain: '#766652', patina: '#4a7d72', pigment: '#8e3524' },
    marble: { a: '#f3ede2', b: '#e6dcc8', band: '#ece3d3', groove: '#8a7a62', edge: '#fffbf2', rough: .36, stain: '#cbbfa8', gold: '#d4a53a', vein: '#aaa298' },
    granite: { a: '#7b7872', b: '#5b5854', band: '#6c6964', groove: '#161514', edge: '#b4b0a8', rough: .78, lichen: ['#8c8c5c', '#aaa694'], stain: '#3a3836', speck: ['#262422', '#c8c4bc'], patina: '#4a6a78' },
    laterite: { a: '#a0714f', b: '#7a4f35', band: '#8e5e3e', groove: '#261810', edge: '#cea27a', rough: .92, lichen: ['#6f7a4a', '#b8864e'], stain: '#48301f', pigment: '#5a2a1a' },
    slate: { a: '#6e7b74', b: '#56635d', band: '#62706a', groove: '#1c2321', edge: '#aab5ad', rough: .85, lichen: ['#c8742e', '#d09a3c'], stain: '#38423e' },
    bronze: { a: '#8e5e2e', b: '#6c4422', band: '#7c5028', groove: '#24413a', edge: '#e4b060', rough: .4, stain: '#3a2a1a', patina: '#4a8676', metal: .9 },
  };
  const _lin3 = (hx) => { const n = parseInt(hx.slice(1), 16), f = (c) => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return [f(n >> 16), f((n >> 8) & 255), f(n & 255)]; };   // sRGB hex → linear
  const _SRGB = (() => { const t = new Uint8Array(4096); for (let i = 0; i < 4096; i++) { const c = i / 4095; t[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); } return t; })();
  // fill a sheet's three RGBA arrays from its height buffer.
  // Two scales of occlusion: grooves (small blur) and recesses (large blur); the recessed field goes dark the way deep relief does
  function carveMaps(H, kind, O, out) {
    const { w, h } = H, S = STONES[kind], seed = O.seed || 7, n = w * h, a = H.a;
    let rs = (seed * 2654435761) >>> 0; const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
    const depth = (O.depth || .02) * w * .5, kS = O.kS || 7, kL = O.kL || 4.5, kE = O.kE || 9;
    const Bs = blurH(H, Math.max(2, w / 340)), Bl = blurH(H, Math.max(4, w / 64)), E = blurH(H, 1, 1);
    const F1 = field(w, h, 5, 4, seed, H.ty), F2 = field(w, h, 13, 3, seed + 5, H.ty), F3 = O.streaks ? field(w, h, 40, 2, seed + 9, H.ty, .06) : null;
    const L = (k, d) => (S[k] ? _lin3(S[k]) : d), A = L('a'), B = L('b'), Bd = L('band', A), G = L('groove'), Ed = L('edge'), St = L('stain', G), Pa = L('patina', G), Pg = L('pigment', G), Au = L('gold', A), Vn = L('vein', B);
    const Li = O.lichenCols ? O.lichenCols.map(_lin3) : S.lichen ? S.lichen.map(_lin3) : [A, A], Sp = S.speck ? S.speck.map(_lin3) : null, RM = O.redM ? O.redM.a : null, Rd = _lin3('#a8281e');
    const alt = O.alt ? STONES[O.alt] : null, AA = alt ? _lin3(alt.a) : A, AB = alt ? _lin3(alt.b) : B, AG = alt ? _lin3(alt.groove) : G, ALi = alt && alt.lichen ? alt.lichen.map(_lin3) : Li;
    const lichenAmt = O.lichen ?? .5, pigAmt = O.pigment || 0, patAmt = O.patina || 0, metal0 = S.metal || 0, rough0 = S.rough, band = S.band ? .2 : 0, vein = S.vein ? .55 : 0;
    const PM = O.patinaM ? O.patinaM.a : null, GM = O.goldM ? O.goldM.a : null, AM = O.altM ? O.altM.a : null;
    const { alb, nrm, orm } = out, T = _SRGB;
    for (let y = 0; y < h; y++) {
      const ro = (h - 1 - y) * w, yu = (H.ty ? (y - 1 + h) % h : Math.max(0, y - 1)) * w, yd = (H.ty ? (y + 1) % h : Math.min(h - 1, y + 1)) * w, yo = y * w, yf = y / h, sy = .4 + .6 * yf;
      for (let x = 0; x < w; x++) {
        const i = yo + x, o = (ro + x) * 4, xl = x ? x - 1 : w - 1, xr = x < w - 1 ? x + 1 : 0;
        const nx = (a[yo + xl] - a[yo + xr]) * depth, ny = (a[yd + x] - a[yu + x]) * depth, inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        nrm[o] = (nx * inv * .5 + .5) * 255; nrm[o + 1] = (ny * inv * .5 + .5) * 255; nrm[o + 2] = (inv * .5 + .5) * 255; nrm[o + 3] = 255;
        const hi = a[i], dS = (Bs.a[i] - hi) * kS, dL = (Bl.a[i] - hi) * kL, dE = (hi - E.a[i]) * kE;
        const occS = dS < 0 ? 0 : dS > 1 ? 1 : dS, occL = dL < 0 ? 0 : dL > 1 ? 1 : dL, cvx = dE < 0 ? 0 : dE > 1 ? 1 : dE, occ = Math.min(.92, occS * .7 + occL * .75);
        const f1 = F1[i], f2 = F2[i];
        let t = (f1 - .3) * 1.6; t = t < 0 ? 0 : t > 1 ? 1 : t;
        let r = A[0] + (B[0] - A[0]) * t, g = A[1] + (B[1] - A[1]) * t, b = A[2] + (B[2] - A[2]) * t, q;
        if (band) { q = yf * 9 + f2 * 2.2; q = Math.abs(q - Math.floor(q) - .5) * 2 * band; r += (Bd[0] - r) * q; g += (Bd[1] - g) * q; b += (Bd[2] - b) * q; }
        if (vein) { q = 1 - Math.abs(f2 * 2 - 1); q = q * q; q = q * q; q = q * q * q * vein; r += (Vn[0] - r) * q; g += (Vn[1] - g) * q; b += (Vn[2] - b) * q; }
        let am = AM ? AM[i] : 0;
        if (am > 0) { q = (f2 - .3) * 1.6; q = q < 0 ? 0 : q > 1 ? 1 : q; r += (AA[0] + (AB[0] - AA[0]) * q - r) * am; g += (AA[1] + (AB[1] - AA[1]) * q - g) * am; b += (AA[2] + (AB[2] - AA[2]) * q - b) * am; }
        if (PM) { q = PM[i] * (.45 + .45 * f2) * (patAmt || 1); if (q > 0) { r += (Pa[0] - r) * q; g += (Pa[1] - g) * q; b += (Pa[2] - b) * q; } }
        else if (patAmt) { q = (occ * 1.5 - .15) * patAmt * (.4 + f2); q = q < 0 ? 0 : q > 1 ? 1 : q; r += (Pa[0] - r) * q; g += (Pa[1] - g) * q; b += (Pa[2] - b) * q; }
        if (pigAmt) { q = (occL * 2 - .3) * pigAmt * ((f2 - .42) * 3); if (q > 0) { q = q > .7 ? .7 : q; r += (Pg[0] - r) * q; g += (Pg[1] - g) * q; b += (Pg[2] - b) * q; } }
        if (F3) { q = (F3[i] - .55) * 3; if (q > 0) { q = (q > 1 ? 1 : q) * sy * .35; r += (St[0] - r) * q; g += (St[1] - g) * q; b += (St[2] - b) * q; } }
        const Gc = am > .5 ? AG : G; r += (Gc[0] - r) * occ; g += (Gc[1] - g) * occ; b += (Gc[2] - b) * occ;
        q = cvx * .5; r += (Ed[0] - r) * q; g += (Ed[1] - g) * q; b += (Ed[2] - b) * q;
        let met = metal0 * (1 - occS * .7), rough = rough0 + occS * .1 - cvx * .14;
        if (RM && RM[i] > .02) { q = RM[i] * .9; r += (Rd[0] * (.8 + .3 * f2) - r) * q; g += (Rd[1] - g) * q; b += (Rd[2] - b) * q; }
        if (GM && GM[i] > .5) { q = .8 + .32 * f2 - occS * .3; r = Au[0] * q; g = Au[1] * q; b = Au[2] * q; met = .92; rough = .26 + occS * .2; }
        else {
          if (lichenAmt) { q = (f1 * .7 + f2 * .6 - .78) * 4; if (q > 0 && rnd() < (q > 1 ? 1 : q) * (1 - cvx) * lichenAmt * .55) { const lc = (am > .5 ? ALi : Li)[rnd() < .6 ? 0 : 1], k = .5 + rnd() * .4; r += (lc[0] - r) * k; g += (lc[1] - g) * k; b += (lc[2] - b) * k; } }
          q = rnd();
          if (Sp) { if (q < .06) { r += (Sp[0][0] - r) * .5; g += (Sp[0][1] - g) * .5; b += (Sp[0][2] - b) * .5; } else if (q < .085) { r += (Sp[1][0] - r) * .45; g += (Sp[1][1] - g) * .45; b += (Sp[1][2] - b) * .45; } }
          else if (q < .025) { q = .86 + q * 10; r *= q; g *= q; b *= q; }
        }
        alb[o] = T[r >= 1 ? 4095 : (r * 4095) | 0]; alb[o + 1] = T[g >= 1 ? 4095 : (g * 4095) | 0]; alb[o + 2] = T[b >= 1 ? 4095 : (b * 4095) | 0]; alb[o + 3] = 255;
        orm[o] = (1 - occ * .8) * 255; orm[o + 1] = (rough < .05 ? .05 : rough > 1 ? 1 : rough) * 255; orm[o + 2] = met * 255; orm[o + 3] = 255;
      }
    }
  }

  /* ---------- sculpted figures: skeletons in temple-sculpture poses, rasterised as rounded
     capsules and ellipsoids straight into height, so limbs, torsos and costume have real volume ---------- */
  // joints in figure units (standing height ≈ 1, y up, x to the viewer's right, optional z toward the viewer)
  const _J0 = { hd: [0, .925], nk: [0, .845], sL: [-.115, .81], sR: [.115, .81], ch: [0, .74], wa: [0, .63], pv: [0, .54], hL: [-.062, .52], hR: [.062, .52], kL: [-.066, .28], kR: [.066, .28], aL: [-.066, .045], aR: [.066, .045], tL: [-.095, .006], tR: [.095, .006], eL: [-.15, .62], eR: [.15, .62], wL: [-.16, .46], wR: [.16, .46], fL: [-.16, .38], fR: [.16, .38] };
  const POSES = {
    tribhanga: { f: 1, j: { pv: [.04, .54], hL: [-.02, .52], hR: [.1, .52], kR: [.09, .28], aR: [.07, .045], tR: [.1, .006], kL: [-.01, .29, .03], aL: [.04, .06, .04], tL: [.01, .012, .04], wa: [.025, .63], ch: [-.02, .74], sL: [-.135, .79], sR: [.095, .83], nk: [-.015, .85], hd: [.005, .93], eR: [.25, .93, .03], wR: [.14, 1.02, .04], fR: [.08, 1.06, .04], eL: [-.23, .66], wL: [-.29, .5], fL: [-.31, .42] }, x: { skirt: [.34, .1], sash: 1, crown: 1, flower: 'fR' } },
    aramandi: { f: 1, j: { pv: [0, .46], hL: [-.07, .44], hR: [.07, .44], kL: [-.22, .29], kR: [.22, .29], aL: [-.12, .045], aR: [.12, .045], tL: [-.22, .008], tR: [.22, .008], wa: [0, .555], ch: [0, .665], sL: [-.115, .735], sR: [.115, .735], nk: [0, .77], hd: [.02, .85], eR: [.27, .8, .02], wR: [.31, .95, .02], fR: [.3, 1.03, .02], eL: [-.28, .72], wL: [-.45, .74], fL: [-.53, .76] }, x: { fan: 1, crown: 1 } },
    drummer: { f: 0, j: { pv: [0, .52], hL: [-.065, .5], hR: [.065, .5], kL: [-.14, .28], kR: [.15, .29], aL: [-.12, .045], aR: [.19, .07], tL: [-.16, .006], tR: [.24, .03], wa: [0, .615], ch: [.01, .725], sL: [-.11, .795], sR: [.12, .79], nk: [.01, .83], hd: [.03, .91], eL: [-.21, .68, .04], wL: [-.25, .6, .08], fL: [-.23, .57, .09], eR: [.22, .68, .04], wR: [.26, .6, .08], fR: [.24, .57, .09] }, x: { dhoti: 1, drum: [-.23, .6, .23, .6], turban: 1 } },
    flautist: { f: 0, j: { pv: [.02, .54], hR: [.08, .52], kR: [.07, .28], aR: [.05, .045], tR: [.09, .006], hL: [-.04, .52], kL: [.03, .29, .03], aL: [.13, .07, .04], tL: [.17, .025, .04], wa: [.012, .63], ch: [-.01, .74], sL: [-.125, .8], sR: [.105, .82], nk: [0, .85], hd: [.035, .925], eL: [-.07, .69, .05], wL: [.07, .86, .06], fL: [.1, .88, .06], eR: [.25, .72, .03], wR: [.3, .88, .05], fR: [.32, .92, .05] }, x: { dhoti: 1, flute: [.03, .885, .44, .915], crown: 1, peacock: 1 } },
    seated: { f: 0, j: { pv: [0, .26], hL: [-.08, .25], hR: [.08, .25], kL: [-.3, .19], kR: [.3, .19], aL: [.07, .15, .05], aR: [-.07, .15, .05], tL: [.14, .19, .06], tR: [-.14, .19, .06], wa: [0, .37], ch: [0, .48], sL: [-.12, .55], sR: [.12, .55], nk: [0, .59], hd: [0, .675], eL: [-.19, .37, .02], wL: [-.06, .28, .05], fL: [-.01, .27, .05], eR: [.19, .37, .02], wR: [.06, .28, .05], fR: [.01, .27, .05] }, x: { arms2: [[-.24, .62], [-.27, .75], [.24, .62], [.27, .75]], halo: .15, crown: 1.4, seat: 1 } },
    bearer: { f: 0, j: { pv: [0, .54], hL: [-.05, .52], kL: [-.1, .29], aL: [-.15, .05], tL: [-.2, .01], hR: [.06, .52], kR: [.09, .28], aR: [.12, .055], tR: [.17, .015], wa: [0, .63], ch: [0, .74], sL: [-.115, .81], sR: [.115, .81], nk: [0, .845], hd: [0, .925], eR: [.23, .92, .02], wR: [.25, 1.06, .03], fR: [.25, 1.1, .03], eL: [-.17, .64], wL: [-.21, .48], fL: [-.22, .41] }, x: { dhoti: 1, spear: [.25, .38, .24, 1.32], turban: 1 } },
    devotee: { f: 1, j: { eL: [-.13, .65, .02], wL: [-.02, .73, .05], fL: [0, .8, .06], eR: [.13, .65, .02], wR: [.02, .73, .05], fR: [0, .8, .06] }, x: { skirt: [.24, .04], crown: 1 } },
    rider: { f: 0, side: 1, j: { pv: [0, .38], hL: [0, .38, .04], kL: [.18, .34, .06], aL: [.16, .1, .06], tL: [.23, .09, .06], hR: [0, .38, -.04], kR: [.18, .34, -.06], aR: [.16, .1, -.06], tR: [.23, .09, -.06], wa: [-.01, .48], ch: [-.02, .6], sL: [-.02, .68, .06], sR: [-.02, .68, -.06], nk: [-.01, .72], hd: [.01, .8], eL: [.1, .56, .08], wL: [.22, .6, .08], fL: [.28, .6, .08], eR: [.08, .82, -.02], wR: [.07, .98, -.02], fR: [.07, 1.02, -.02] }, x: { spear: [.07, .55, .07, 1.35], turban: 1 } },
  };
  const LIMBS = [['pv', 'wa', .092, .072], ['wa', 'ch', .072, .094], ['sL', 'sR', .052, .052], ['nk', 'hd', .036, .034], ['hL', 'kL', .07, .048], ['kL', 'aL', .046, .03], ['aL', 'tL', .026, .018], ['hR', 'kR', .07, .048], ['kR', 'aR', .046, .03], ['aR', 'tR', .026, .018],
    ['sL', 'eL', .037, .031], ['eL', 'wL', .03, .024], ['wL', 'fL', .023, .018], ['sR', 'eR', .037, .031], ['eR', 'wR', .03, .024], ['wR', 'fR', .023, .018]];
  // primitives into a float buffer, union by max; heights already in sheet units (k = units per figure-unit of thickness)
  function capPx(B, x0, y0, z0, r0, x1, y1, z1, r1, k, flat = .75) {
    const w = B.w, h = B.h, a = B.a, rm = Math.max(r0, r1), bx0 = Math.floor(Math.min(x0, x1) - rm), bx1 = Math.ceil(Math.max(x0, x1) + rm), by0 = Math.max(0, Math.floor(Math.min(y0, y1) - rm)), by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + rm));
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x - x0 - dx * t, py = y - y0 - dy * t, d2 = px * px + py * py, r = r0 + (r1 - r0) * t;
      if (d2 >= r * r) continue;
      const v = (z0 + (z1 - z0) * t + r * flat * Math.sqrt(1 - d2 / (r * r))) * k, i = y * w + ((x % w) + w) % w;
      if (v > a[i]) a[i] = v;
    }
  }
  function ellPx(B, cx, cy, rx, ry, z, rz, k, rot = 0) {
    const w = B.w, h = B.h, a = B.a, rm = Math.max(rx, ry), c = Math.cos(rot), s = Math.sin(rot);
    for (let y = Math.max(0, Math.floor(cy - rm)); y <= Math.min(h - 1, Math.ceil(cy + rm)); y++) for (let x = Math.floor(cx - rm); x <= Math.ceil(cx + rm); x++) {
      const qx = ((x - cx) * c + (y - cy) * s) / rx, qy = (-(x - cx) * s + (y - cy) * c) / ry, d2 = qx * qx + qy * qy;
      if (d2 >= 1) continue;
      const v = (z + rz * Math.sqrt(1 - d2)) * k, i = y * w + ((x % w) + w) % w; if (v > a[i]) a[i] = v;
    }
  }
  // sculpt one figure: pose name, ground point (px), size (px per figure unit), mirrored?, thickness scale
  function sculpt(B, pose, gx, gy, S, flip = false, amp = .8) {
    const P = POSES[pose], J = { ..._J0 }; for (const k in P.j) J[k] = P.j[k];
    const k = amp / (.12 * S), X = (p) => gx + (flip ? -p[0] : p[0]) * S, Y = (p) => gy - p[1] * S, Z = (p) => (p[2] || 0) * S;
    const cap = (a, b, r0, r1, dz = 0, flat) => capPx(B, X(a), Y(a), Z(a) + dz * S, r0 * S, X(b), Y(b), Z(b) + dz * S, r1 * S, k, flat);
    const sph = (p, r, dz = 0, ry = r) => ellPx(B, X(p), Y(p), r * S, ry * S, Z(p) + dz * S, r * .8 * S, k);
    const x = P.x || {}, fem = P.f;
    // costume underneath the body: skirt / fan / dhoti
    if (x.skirt) { const [hw, hy] = x.skirt, n = 9; for (let i = 0; i < n; i++) { const f = i / (n - 1) - .5; cap([J.pv[0] + f * .12, J.wa[1] - .02], [J.pv[0] + f * hw * 2 + (J.kL[0] + J.kR[0]) * .25, hy + .06], .03, .042, -.01, .6); } }
    if (x.fan) { const n = 11, c = [J.pv[0], J.pv[1] - .03]; for (let i = 0; i < n; i++) { const q = -Math.PI / 2 + (i / (n - 1) - .5) * 2.2; cap(c, [c[0] + Math.cos(q) * .22, c[1] + Math.sin(q) * .2], .02, .036, -.005, .55); } }
    if (x.dhoti) { cap(J.hL, [J.kL[0] * .8 + J.hL[0] * .2, J.kL[1] + .04], .085, .062, -.005, .6); cap(J.hR, [J.kR[0] * .8 + J.hR[0] * .2, J.kR[1] + .04], .085, .062, -.005, .6); }
    for (const [a, b, r0, r1] of LIMBS) {
      let s0 = r0, s1 = r1;
      if (fem && a === 'pv') { s0 = .1; s1 = .06; } else if (fem && a === 'wa') { s0 = .06; s1 = .082; }
      cap(J[a], J[b], s0, s1);
    }
    sph(J.hL, fem ? .085 : .075); sph(J.hR, fem ? .085 : .075);
    if (fem) { sph([J.ch[0] - .048, J.ch[1] - .005, .02], .046); sph([J.ch[0] + .048, J.ch[1] - .005, .02], .046); }
    ellPx(B, X(J.hd), Y(J.hd), .06 * S, .073 * S, Z(J.hd), .06 * S, k);
    sph(J.fL, .026, .005); sph(J.fR, .026, .005);
    if (x.arms2) { const [e1, w1, e2, w2] = x.arms2; cap(J.sL, e1, .032, .027, -.02); cap(e1, w1, .026, .02, -.02); cap(J.sR, e2, .032, .027, -.02); cap(e2, w2, .026, .02, -.02); sph(w1, .03, -.01); sph(w2, .03, -.01); }
    // ornament: necklace, bangles, anklets, belt
    const nk = J.nk, sw = (J.sR[0] - J.sL[0]) * .32;
    for (let i = 0; i < 9; i++) { const q = Math.PI * (.15 + .7 * i / 8); sph([nk[0] + Math.cos(q) * sw, nk[1] - .03 - Math.sin(q) * .055, .03], .012); }
    for (const w of ['wL', 'wR', 'aL', 'aR']) { const p = J[w], q = w[0] === 'w' ? J['e' + w[1]] : J['k' + w[1]], dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * .03, ny = dx / L * .03; cap([p[0] - nx + dx / L * .01, p[1] - ny + dy / L * .01, (p[2] || 0) + .01], [p[0] + nx + dx / L * .01, p[1] + ny + dy / L * .01, (p[2] || 0) + .01], .011, .011); }
    for (let i = 0; i < 7; i++) { const f = i / 6 - .5; sph([J.wa[0] * .5 + J.pv[0] * .5 + f * .14, (J.wa[1] + J.pv[1]) / 2 - .01 - Math.abs(f) * .02, .04], .013); }
    // headgear and props
    const hd = J.hd;
    if (x.crown) { const c = x.crown; cap([hd[0], hd[1] + .05], [hd[0], hd[1] + .05 + .09 * c], .05, .014, .01); for (const d of [-1, 1]) sph([hd[0] + d * .05, hd[1] + .05], .018, .01); }
    if (x.turban) { ellPx(B, X([hd[0], hd[1] + .045]), Y([hd[0], hd[1] + .045]), .07 * S, .04 * S, Z(hd) + .01 * S, .05 * S, k); sph([hd[0] + .03, hd[1] + .085], .016, .02); }
    if (x.peacock) { cap([hd[0] + .02, hd[1] + .06], [hd[0] + .09, hd[1] + .16], .012, .006, .02); ellPx(B, X([hd[0] + .1, hd[1] + .17]), Y([hd[0] + .1, hd[1] + .17]), .025 * S, .035 * S, .02 * S, .02 * S, k, .6); }
    if (x.halo) { const n = 40, R = x.halo; for (let i = 0; i < n; i++) { const q = i / n * TAU; sph([hd[0] + Math.cos(q) * R, hd[1] + .01 + Math.sin(q) * R, -.06], .014); } }
    if (x.seat) { for (let i = 0; i < 9; i++) { const f = i / 8 - .5; ellPx(B, X([f * .6, .07]), Y([f * .6, .07]), .045 * S, .06 * S, 0, .04 * S, k); } cap([-.34, .02], [.34, .02], .03, .03, -.01); }
    if (x.drum) { const [a0, b0, a1, b1] = x.drum; cap([a0, b0, .07], [a1, b1, .07], .065, .065, 0, .7); for (const e of [[a0, b0], [a1, b1]]) cap([e[0], e[1] - .07, .1], [e[0], e[1] + .07, .1], .016, .016); for (let i = 1; i < 6; i++) { const f = i / 6; cap([a0 + (a1 - a0) * f - .02, b0 - .06, .12], [a0 + (a1 - a0) * f + .02, b0 + .06, .12], .007, .007); } }
    if (x.flute) { const [a0, b0, a1, b1] = x.flute; cap([a0, b0, .07], [a1, b1, .07], .012, .01); }
    if (x.spear) { const [a0, b0, a1, b1] = x.spear; cap([a0, b0, .02], [a1, b1, .02], .011, .009); cap([a1, b1 - .02, .02], [a1, b1 + .1, .02], .028, .004); }
    if (x.flower) { const p = J[x.flower]; for (let i = 0; i < 6; i++) { const q = i / 6 * TAU; sph([p[0] + Math.cos(q) * .025, p[1] + .04 + Math.sin(q) * .025, .06], .014); } }
    if (x.sash) { cap([J.wa[0] - .06, J.wa[1] - .02, .03], [J.wL[0] + .02, J.wL[1] - .05, .02], .012, .012); cap([J.wL[0] + .02, J.wL[1] - .05, .02], [J.wL[0] - .02, J.wL[1] - .2, .02], .012, .01); }
  }
  // animals, side view facing right; ground at gy, S = px per unit (elephant height ≈ 1)
  function sculptElephant(B, gx, gy, S, flip = false, amp = .8) {
    const k = amp / (.2 * S), X = (x) => gx + (flip ? -x : x) * S, Y = (y) => gy - y * S, rot = (q) => (flip ? -q : q);
    const cap = (x0, y0, x1, y1, r0, r1, z = 0) => capPx(B, X(x0), Y(y0), z * S, r0 * S, X(x1), Y(y1), z * S, r1 * S, k, .7);
    for (const [lx, z] of [[-.32, -.04], [.26, -.04]]) cap(lx, .42, lx + .02, .03, .115, .1, z);
    ellPx(B, X(-.02), Y(.55), .5 * S, .32 * S, 0, .2 * S, k);
    ellPx(B, X(-.34), Y(.58), .2 * S, .26 * S, .01 * S, .18 * S, k);
    for (const [lx, z] of [[-.22, .04], [.36, .04]]) cap(lx, .42, lx - .01, .03, .12, .105, z);
    ellPx(B, X(.5), Y(.66), .22 * S, .26 * S, .03 * S, .22 * S, k);
    ellPx(B, X(.5), Y(.84), .14 * S, .09 * S, .06 * S, .1 * S, k);
    const tr = [[.66, .58], [.74, .44], [.76, .3], [.74, .17], [.8, .07], [.86, .09]]; for (let i = 0; i < tr.length - 1; i++) cap(tr[i][0], tr[i][1], tr[i + 1][0], tr[i + 1][1], .1 - i * .014, .086 - i * .014, .07);
    ellPx(B, X(.36), Y(.64), .15 * S, .24 * S, .1 * S, .06 * S, k, rot(-.12));
    cap(.62, .46, .82, .42, .03, .012, .12);                                          // tusk
    cap(-.5, .62, -.6, .32, .022, .016, 0); ellPx(B, X(-.6), Y(.3), .03 * S, .05 * S, 0, .02 * S, k);   // tail
    // caparison with a beaded hem, headdress, bells and anklets
    ellPx(B, X(-.05), Y(.66), .34 * S, .2 * S, .1 * S, .07 * S, k);
    for (let i = 0; i < 11; i++) { const x = -.36 + i * .062; ellPx(B, X(x), Y(.47), .022 * S, .022 * S, .17 * S, .02 * S, k); }
    ellPx(B, X(.5), Y(.9), .1 * S, .045 * S, .12 * S, .04 * S, k);
    for (const bx of [-.12, .06, .22]) ellPx(B, X(bx), Y(.38), .03 * S, .035 * S, .2 * S, .02 * S, k);
    for (const lx of [-.32, .26, -.22, .36]) cap(lx - .11, .12, lx + .11, .12, .02, .02, .13);
  }
  function sculptHorse(B, gx, gy, S, flip = false, amp = .8, rider = true) {
    const k = amp / (.2 * S), X = (x) => gx + (flip ? -x : x) * S, Y = (y) => gy - y * S;
    const cap = (x0, y0, x1, y1, r0, r1, z = 0) => capPx(B, X(x0), Y(y0), z * S, r0 * S, X(x1), Y(y1), z * S, r1 * S, k, .72);
    cap(-.28, .56, -.36, .3, .085, .05, -.04); cap(-.36, .3, -.32, .04, .045, .035, -.04);          // far hind leg
    cap(.3, .56, .42, .38, .075, .05, -.04); cap(.42, .38, .56, .44, .045, .035, -.04);             // far foreleg, raised
    ellPx(B, X(0), Y(.6), .4 * S, .22 * S, 0, .17 * S, k);
    ellPx(B, X(.28), Y(.62), .21 * S, .23 * S, .02 * S, .16 * S, k); ellPx(B, X(-.3), Y(.64), .22 * S, .22 * S, .02 * S, .16 * S, k);
    cap(.34, .7, .52, .98, .13, .09, .03); cap(.54, .98, .78, .84, .085, .05, .04);                    // neck, head
    cap(.53, 1.03, .55, 1.09, .02, .006, .05);                                                            // ear
    for (let i = 0; i < 6; i++) cap(.37 + i * .03, .82 + i * .03, .33 + i * .03, .86 + i * .035, .018, .012, .07);   // mane
    cap(-.24, .56, -.2, .3, .09, .05, .03); cap(-.2, .3, -.24, .04, .048, .035, .03);            // near hind leg
    cap(.26, .56, .28, .3, .08, .05, .03); cap(.28, .3, .26, .04, .046, .035, .03);                 // near foreleg
    cap(-.4, .7, -.58, .5, .05, .035, 0); cap(-.58, .5, -.56, .28, .035, .02, 0);                   // tail
    ellPx(B, X(0), Y(.7), .2 * S, .12 * S, .08 * S, .06 * S, k);                                         // saddle cloth
    for (let i = 0; i < 7; i++) ellPx(B, X(-.18 + i * .06), Y(.585), .018 * S, .018 * S, .12 * S, .018 * S, k);
    cap(.62, .9, .1, .82, .008, .008, .12);                                                               // rein
    if (rider) sculpt(B, 'rider', gx + (flip ? -.02 : .02) * S, gy - .4 * S, S * .86, flip, amp * 1.05);
  }
  // a whole figure layer for a sheet
  function figLayer(w, h, ty) { return hbuf(w, h, 0, ty); }

  /* ---------- composition helpers ---------- */
  // fine foliage in the recessed fields: little spiral curls and leaves, so no background is ever blank stone
  function foliage(x, x0, y0, w, h, s, seed) {
    const r = rng(seed), n = Math.max(3, (w * h / (s * s) * .45) | 0); x.lineWidth = s * .1;
    for (let k = 0; k < n; k++) {
      const px = x0 + r() * w, py = y0 + r() * h, rr = s * (.25 + r() * .3), dir = r() < .5 ? 1 : -1;
      _cP(x); for (let j = 0; j <= 14; j++) { const q = j / 14 * TAU * 1.1, ra = rr * (1 - j / 16); const qx = px + Math.cos(q * dir) * ra, qy = py + Math.sin(q * dir) * ra; j ? x.lineTo(qx, qy) : x.moveTo(qx, qy); } x.stroke();
      x.save(); x.translate(px + rr * 1.2 * dir, py - rr * .4); x.rotate(r() * TAU); _cP(x).ellipse(0, 0, rr * .7, rr * .28, 0, 0, TAU); x.fill(); x.restore();
    }
  }
  // a framed relief panel: raised frame with beads and an incised line, a recessed field of foliage, a sculpted scene
  const SCENES = {
    musicians(B, cx, gy, hh) { sculpt(B, 'aramandi', cx - hh * .27, gy, hh * .9); sculpt(B, 'drummer', cx + hh * .32, gy, hh * .82, true); },
    horse(B, cx, gy, hh) { sculptHorse(B, cx - hh * .06, gy, hh * .62); },
    elephant(B, cx, gy, hh) { sculptElephant(B, cx + hh * .08, gy, hh * .68, true); },
    seated(B, cx, gy, hh) { sculpt(B, 'seated', cx, gy, hh * 1.02); },
    flute(B, cx, gy, hh) { sculpt(B, 'flautist', cx - hh * .22, gy, hh * .86); sculpt(B, 'tribhanga', cx + hh * .3, gy, hh * .84, true); },
    pair(B, cx, gy, hh) { sculpt(B, 'tribhanga', cx - hh * .22, gy, hh * .86); sculpt(B, 'tribhanga', cx + hh * .22, gy, hh * .86, true); },
    devotees(B, cx, gy, hh) { sculpt(B, 'devotee', cx - hh * .2, gy, hh * .84); sculpt(B, 'bearer', cx + hh * .22, gy, hh * .78, true); },
  };
  function framedPanel(L, x0, y0, cw, ch, scene, seed, fr = .07) {
    const b = Math.min(cw, ch) * fr, f = L.f;
    f.fillRect(x0, y0, cw, b); f.fillRect(x0, y0 + ch - b, cw, b); f.fillRect(x0, y0, b, ch); f.fillRect(x0 + cw - b, y0, b, ch);
    const nb = Math.max(6, Math.round(cw / (b * .8)));
    for (let i = 0; i < nb; i++) { const px = x0 + b * .5 + i * (cw - b) / (nb - 1); _cP(L.b).arc(px, y0 + b * .5, b * .19, 0, TAU); L.b.fill(); _cP(L.b).arc(px, y0 + ch - b * .5, b * .19, 0, TAU); L.b.fill(); }
    L.n.lineWidth = b * .1; L.n.strokeRect(x0 + b * 1.2, y0 + b * 1.2, cw - b * 2.4, ch - b * 2.4);
    if (L.g) foliage(L.g, x0 + b, y0 + b, cw - 2 * b, ch - 2 * b, ch * .09, seed);
    L.b.fillRect(x0 + b, y0 + ch - b * 1.55, cw - 2 * b, b * .5);                              // a ground ledge the figures stand on
    SCENES[scene](L.fig, x0 + cw / 2, y0 + ch - b * 1.5, ch - 2.6 * b);
  }
  // assemble a sheet's height from its layers: f = frames (flat, high), a = relief (pillowed), b = raised detail, n = incised,
  // g = background foliage, fig = sculpted figures
  function carveRelief(H, L, { fA = 1, aA = .85, aR = .018, bA = .18, nA = -.16, gA = .14, flat = .25 } = {}) {
    const ty = H.ty, R = aR * Math.min(H.w, H.h * 4), n = H.a.length;
    const mA = L.cv.a ? maskOf(L.cv.a, ty) : null, FG = L.fig ? blurH(L.fig, 1, 1) : null;
    if (L.cv.f) addLayer(H, maskOf(L.cv.f, ty), fA, 2);
    if (L.cv.g) { const g = blurH(maskOf(L.cv.g, ty), 1, 1); for (let i = 0; i < n; i++) { const occ = (mA ? mA.a[i] : 0) + (FG ? FG.a[i] * 8 : 0); H.a[i] += gA * g.a[i] * Math.max(0, 1 - occ); } }
    if (mA) addPillow(H, mA, aA, R, flat);
    if (FG) for (let i = 0; i < n; i++) H.a[i] += FG.a[i];
    if (L.cv.b) addLayer(H, maskOf(L.cv.b, ty), bA, 1.5);
    if (L.cv.n) addLayer(H, maskOf(L.cv.n, ty), nA, 1);
  }
  const _figL = (L, w, h, ty) => { L.fig = hbuf(w, h, 0, ty); return L; };

  // copy a small height buffer into a big one, centred at (cx, cy) and turned by ang (union by max)
  function blitRot(H, Sb, cx, cy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), hw = Sb.w / 2, hh = Sb.h / 2, R = Math.ceil(Math.hypot(hw, hh));
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H.h - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(H.w - 1, Math.ceil(cx + R)); x++) {
      const dx = x - cx, dy = y - cy, u = dx * c + dy * s + hw, v = -dx * s + dy * c + hh;
      if (u < 0 || v < 0 || u >= Sb.w - 1 || v >= Sb.h - 1) continue;
      const u0 = u | 0, v0 = v | 0, fu = u - u0, fv = v - v0, o = v0 * Sb.w + u0, A = Sb.a;
      const val = (A[o] * (1 - fu) + A[o + 1] * fu) * (1 - fv) + (A[o + Sb.w] * (1 - fu) + A[o + Sb.w + 1] * fu) * fv, i = y * H.w + x;
      if (val > H.a[i]) H.a[i] = val;
    }
  }
  /* ---------- the sheets (canvas y runs down; the design's top is the texture's top) ---------- */
  const SHEETS = {
    // the ring stage's walls: vine scroll, inscription, musicians in niches, an elephant procession (tiles in x)
    frieze(W) {
      const Hh = W >> 2, H = hbuf(W, Hh, 0), y = (f) => f * Hh, L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g'), W, Hh);
      const F = L.f; F.fillRect(0, 0, W, y(.06)); F.fillRect(0, y(.29), W, y(.035)); F.fillRect(0, y(.375), W, y(.035)); F.fillRect(0, y(.705), W, y(.03)); F.fillRect(0, y(.935), W, y(.065));
      moulding(H, y(.06), y(.1), 'torus', .7); beads(L.b, W, y(.08), y(.014)); moulding(H, y(.9), y(.935), 'torus', .7); beads(L.b, W, y(.918), y(.014));
      moulding(H, y(.325), y(.375), 'fillet', .55); glyphs(L.n, W, y(.35), y(.04), 31);
      vine({ a: L.a, b: L.b }, W, y(.195), y(.06), 10, y(.024)); foliage(L.g, 0, y(.1), W, y(.19), y(.05), 4);
      const cast = ['aramandi', 'drummer', 'flautist', 'seated', 'tribhanga', 'bearer'], nm = cast.length, nw = W / nm;
      for (let k = 0; k < nm; k++) {
        cstamp({ a: F }, W, k * nw, 0, (Q) => { Q.a.fillRect(-nw * .035, y(.41), nw * .07, y(.3)); }, false);
        cstamp({ a: L.b }, W, k * nw, 0, (Q) => { for (let j = 0; j < 5; j++) Q.a.fillRect(-nw * .05, y(.43 + j * .06), nw * .1, y(.012)); }, false);
        sculpt(L.fig, cast[k], (k + .5) * nw, y(.695), y(cast[k] === 'seated' ? .31 : cast[k] === 'bearer' ? .2 : .235), k % 2 === 1);
        foliage(L.g, k * nw + nw * .05, y(.41), nw * .9, y(.29), y(.05), 40 + k);
      }
      const ne = 7; for (let k = 0; k < ne; k++) sculptElephant(L.fig, (k + .5) * W / ne, y(.9), y(.155), k === 3);
      foliage(L.g, 0, y(.735), W, y(.165), y(.04), 77);
      carveRelief(H, L, { aR: .014 });
      grain(H, .025, 3);
      return { H, O: { depth: .014, streaks: true, lichen: .6, pigment: .45 } };
    },
    // wall tops: four framed square panels in a row (tiles in x)
    strip(W) {
      const Hh = W >> 2, H = hbuf(W, Hh, 0), L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g'), W, Hh), sc = ['horse', 'musicians', 'elephant', 'seated'];
      for (let k = 0; k < 4; k++) framedPanel(L, k * Hh, 0, Hh, Hh, sc[k], 90 + k);
      carveRelief(H, L); grain(H, .025, 8);
      return { H, O: { depth: .016, lichen: .6, pigment: .6 } };
    },
    // portal rim reliefs: a 2 × 2 atlas of framed panels
    panels(W) {
      const Hh = W * .7 | 0, H = hbuf(W, Hh, 0), cw = W / 2, chh = Hh / 2, L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g'), W, Hh), sc = ['musicians', 'horse', 'elephant', 'seated'];
      for (let k = 0; k < 4; k++) framedPanel(L, (k % 2) * cw, ((k / 2) | 0) * chh, cw, chh, sc[k], 60 + k);
      carveRelief(H, L); grain(H, .025, 5);
      return { H, O: { depth: .018, lichen: .5, pigment: .5 } };
    },
    // rim faces of the portal: beaded fillets with verdigris, a row of rosette blocks
    band(W) {
      const Hh = W >> 3, H = hbuf(W, Hh, 0), y = (f) => f * Hh, L = layers(W, Hh, 'a', 'b', 'n', 'f', 'p');
      L.f.fillRect(0, 0, W, y(.14)); L.f.fillRect(0, y(.86), W, y(.14)); moulding(H, y(.14), y(.26), 'torus', .75); moulding(H, y(.74), y(.86), 'torus', .75);
      L.p.fillRect(0, 0, W, y(.14)); L.p.fillRect(0, y(.86), W, y(.14));
      beads(L.b, W, y(.2), y(.035)); beads(L.b, W, y(.8), y(.035));
      const n = 12; for (let k = 0; k < n; k++) cstamp({ a: L.a, b: L.b, n: L.n }, W, (k + .5) * W / n, y(.5), (Q) => { Q.a.fillRect(-y(.2), -y(.2), y(.4), y(.4)); for (let i = 0; i < 4; i++) { Q.b.save(); Q.b.rotate(i * Math.PI / 2 + Math.PI / 4); _cP(Q.b).ellipse(y(.085), 0, y(.085), y(.045), 0, 0, TAU); Q.b.fill(); Q.b.restore(); } _cP(Q.b).arc(0, 0, y(.04), 0, TAU); Q.b.fill(); Q.n.lineWidth = y(.02); Q.n.strokeRect(-y(.16), -y(.16), y(.32), y(.32)); });
      carveRelief(H, L, { aA: .7, aR: .01 }); grain(H, .025, 6);
      return { H, O: { depth: .02, patinaM: blurH(maskOf(L.cv.p), 3, 1), patina: 1, lichen: .7 } };
    },
    // a lathe-turned spoke: rings, beads, lotus collars and fluting (tiles both ways; x = around the spoke)
    spoke(W) {
      const Hh = W * 2, H = hbuf(W, Hh, .3, true), y = (f) => f * Hh, L = layers(W, Hh, 'a', 'n');
      for (let f = 0; f < 1; f += .25) {
        moulding(H, y(f), y(f + .03), 'torus', .5); moulding(H, y(f + .215), y(f + .25), 'torus', .55); moulding(H, y(f + .03), y(f + .045), 'fillet', .25);
        beads(L.a, W, y(f + .058), W * .03, 2.6);
        for (let i = 0; i < 10; i++) { const px = (i + .5) * W / 10; _cP(L.a).moveTo(px - W * .045, y(f + .118)); L.a.quadraticCurveTo(px, y(f + .066), px + W * .045, y(f + .118)); L.a.closePath(); L.a.fill(); }
        for (let i = 0; i < 16; i++) { const px = (i + .5) * W / 16; L.n.lineWidth = W * .02; _cP(L.n).moveTo(px, y(f + .13)); L.n.lineTo(px, y(f + .2)); L.n.stroke(); }
      }
      carveRelief(H, L, { aA: .4, aR: .006, nA: -.22 }); grain(H, .03, 9);
      return { H, O: { depth: .03, patina: .6, lichen: .4 } };
    },
    // square medallions (hub faces, rosettes, wheel tops): 'lotus', 'chakra', 'star'
    medallion(W, kind = 'lotus') {
      const H = hbuf(W, W, 0), m = W / 2, L = layers(W, W, 'a', 'b', 'n', 'f');
      for (const c of [L.a, L.b, L.n, L.f]) c.translate(m, m);
      L.f.lineWidth = W * .04; _cP(L.f).arc(0, 0, W * .475, 0, TAU); L.f.stroke();
      for (let i = 0; i < 60; i++) { const q = i / 60 * TAU; _cP(L.b).arc(Math.cos(q) * W * .44, Math.sin(q) * W * .44, W * .011, 0, TAU); L.b.fill(); }
      if (kind === 'lotus') { MOTIF.lotus(L, W * .41, 16); for (let i = 0; i < 16; i++) { L.a.save(); L.a.rotate((i + .5) / 16 * TAU); _cP(L.a).moveTo(W * .3, 0); L.a.lineTo(W * .415, -W * .022); L.a.lineTo(W * .415, W * .022); L.a.fill(); L.a.restore(); } }
      else if (kind === 'star') MOTIF.starLotus(L, W * .42, 8);
      else MOTIF.chakra(L, W * .43, 12);
      carveRelief(H, L, { aA: .8, aR: .012, flat: .3 });
      for (let yy = 0; yy < W; yy++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - m, yy - m) / (W * .085); if (d < 1) H.a[yy * W + x] += .4 * Math.sqrt(1 - d * d); }
      grain(H, .02, 11);
      return { H, O: { depth: .022, lichen: .4, pigment: .4 } };
    },
    // a temple wall: two bays (dancer, flautist) in niches under torana arches between pilasters (tiles both ways)
    wall(W) {
      const Hh = W * .7 | 0, H = hbuf(W, Hh, 0, true), y = (f) => f * Hh, L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g'), W, Hh, true);
      const F = L.f; F.fillRect(0, 0, W, y(.06)); F.fillRect(0, y(.94), W, y(.06)); moulding(H, y(.06), y(.095), 'torus', .7); moulding(H, y(.905), y(.94), 'torus', .7);
      beads(L.b, W, y(.078), y(.011)); beads(L.b, W, y(.922), y(.011));
      const bw = W / 2;
      for (let k = 0; k < 3; k++) { const px = k * bw; F.fillRect(px - bw * .085, y(.095), bw * .17, y(.81)); for (let f = .13; f < .88; f += .085) L.b.fillRect(px - bw * .1, y(f), bw * .2, y(.016)); L.n.lineWidth = bw * .012; _cP(L.n).moveTo(px, y(.12)); L.n.lineTo(px, y(.88)); L.n.stroke(); }
      for (let k = 0; k < 2; k++) {
        const cx = (k + .5) * bw; F.fillRect(cx - bw * .31, y(.2), bw * .05, y(.705)); F.fillRect(cx + bw * .26, y(.2), bw * .05, y(.705));
        F.lineWidth = bw * .05; _cP(F).arc(cx, y(.31), bw * .285, Math.PI, 0); F.stroke();
        foliage(L.g, cx - bw * .4, y(.1), bw * .8, y(.8), y(.06), 20 + k);
        cstamp({ a: L.a, b: L.b, n: L.n }, 0, cx, y(.19), (Q) => MOTIF.lotus(Q, bw * .075, 10), false, false);
        L.b.fillRect(cx - bw * .26, y(.87), bw * .52, y(.02)); sculpt(L.fig, k ? 'flautist' : 'tribhanga', cx, y(.87), y(.56), k === 1);
      }
      carveRelief(H, L, { aR: .012 }); grain(H, .025, 13);
      return { H, O: { depth: .016, streaks: true, lichen: .7, pigment: .45 } };
    },
    // dressed ashlar: courses of blocks with drafted margins and tooling (tiles both ways)
    ashlar(W) {
      const H = hbuf(W, W, .5, true), rows = 4, r = rng(21);
      for (let j = 0; j < rows; j++) {
        const y0 = j * W / rows, y1 = y0 + W / rows; let x0 = r() * W * .3; const xs = [];
        while (x0 < W + W * .3) { xs.push(x0); x0 += W * (.28 + r() * .3); }
        const cut = [...xs.filter(v => v < W), W + xs[0]];
        for (let q = 0; q < cut.length - 1; q++) {
          const xa = cut[q], xb = cut[q + 1], lift = (r() - .5) * .12, tilt = (r() - .5) * .05;
          for (let yy = y0 | 0; yy < y1; yy++) for (let x = xa | 0; x < xb; x++) {
            const e = Math.min(x - xa, xb - x, yy - y0, y1 - yy) / (W * .02);
            H.a[yy * W + (x % W)] = .5 + lift + tilt * (x - xa) / W + (e < 1 ? -.35 * (1 - e) * (1 - e) : 0);
          }
        }
      }
      grain(H, .05, 17, 2);
      return { H, O: { depth: .012, kS: 4, kL: 1.5, streaks: true, lichen: .8 } };
    },
    // the eclipse ring: star-lotus medallions in beaded rings between framed seated figures and dancers
    eclipse(W) {
      const Hh = W >> 2, H = hbuf(W, Hh, 0), y = (f) => f * Hh, L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g'), W, Hh);
      const F = L.f; F.fillRect(0, 0, W, y(.06)); F.fillRect(0, y(.94), W, y(.06)); moulding(H, y(.06), y(.11), 'torus', .75); moulding(H, y(.89), y(.94), 'torus', .75);
      F.fillRect(0, y(.2), W, y(.03)); F.fillRect(0, y(.77), W, y(.03));
      moulding(H, y(.11), y(.2), 'fillet', .45); glyphs(L.n, W, y(.155), y(.05), 57);
      const nb = 30; for (let k = 0; k < nb; k++) cstamp({ a: L.a }, W, (k + .5) * W / nb, y(.845), (Q) => { Q.a.fillRect(-y(.03), -y(.03), y(.06), y(.06)); }, false);
      const n = 3;
      for (let k = 0; k < n; k++) {
        const px = k * W / n, qx = px + W / n / 2, pw = y(.62);
        cstamp({ a: L.a, b: L.b, n: L.n }, W, px, y(.5), (Q) => MOTIF.starLotus(Q, y(.25), 8));
        framedPanel(L, qx - pw * .55, y(.23), pw * 1.1, y(.54), k === 1 ? 'pair' : 'seated', 110 + k, .06);
        for (const d of [-.26, .26]) cstamp({ a: L.b }, W, px + W / n * d, y(.5), (Q) => { _cP(Q.a).arc(0, 0, y(.04), 0, TAU); Q.a.fill(); });
      }
      foliage(L.g, 0, y(.23), W, y(.54), y(.05), 71);
      beads(L.b, W, y(.085), y(.014)); beads(L.b, W, y(.915), y(.014));
      carveRelief(H, L, { aR: .014 }); grain(H, .025, 19);
      return { H, O: { depth: .014, lichen: .45, patina: .25 } };
    },
    // the great wheel of the city plaza, seen from above: carved rim panels, small wheels, turned spokes, a lotus hub
    konark(W) {
      const H = hbuf(W, W, 0), m = W / 2, R = W * .49, L = _figL(layers(W, W, 'a', 'b', 'n', 'f', 'alt', 'red'), W, W);
      for (const k of ['a', 'b', 'n', 'f', 'alt', 'red']) L[k].translate(m, m);
      const ring = (x, r0, r1) => { _cP(x).arc(0, 0, r1, 0, TAU); x.arc(0, 0, r0, 0, TAU, true); x.fill('evenodd'); };
      const F = L.f; ring(F, R * .79, R); ring(F, R * .1, R * .28);
      L.b.lineWidth = R * .012; for (const r of [R * .805, R * .985, R * .275]) { _cP(L.b).arc(0, 0, r, 0, TAU); L.b.stroke(); }
      for (let i = 0; i < 220; i++) { const q = i / 220 * TAU; _cP(L.b).arc(Math.cos(q) * R * .965, Math.sin(q) * R * .965, R * .005, 0, TAU); L.b.fill(); }
      // rim panels (sunk into the rim) holding sculpted reliefs, heads outward
      const np = 32, pw = (R * .895) * TAU / np * .84, ph = R * .15, scenes = ['elephant', 'musicians', 'horse', 'pair', 'seated', 'flute', 'devotees', 'elephant'];
      for (let k = 0; k < np; k++) {
        if (k % 4 === 2) continue;                                             // the small wheels sit here
        const q = (k + .5) / np * TAU, cx = Math.cos(q) * R * .895, cy = Math.sin(q) * R * .895;
        F.save(); F.rotate(q + Math.PI / 2); F.translate(0, -R * .895); F.fillStyle = '#000'; F.fillRect(-pw / 2, -ph / 2, pw, ph); F.fillStyle = '#fff'; F.restore();
        L.n.save(); L.n.rotate(q + Math.PI / 2); L.n.translate(0, -R * .895); L.n.lineWidth = R * .004; L.n.strokeRect(-pw / 2 + R * .006, -ph / 2 + R * .006, pw - R * .012, ph - R * .012); L.n.restore();
        const Sb = hbuf(Math.ceil(pw), Math.ceil(ph), 0); SCENES[scenes[k % scenes.length]](Sb, Sb.w / 2, Sb.h - ph * .06, ph * .82);
        blitRot(L.fig, Sb, m + cx, m + cy, q + Math.PI / 2);
      }
      // eight small wheels on the rim and red markers between them
      for (let i = 0; i < 8; i++) { const qq = (i * 4 + 2.5) / np * TAU; const x = Math.cos(qq) * R * .895, y = Math.sin(qq) * R * .895; for (const c of [L.a, L.b, L.n]) { c.save(); c.translate(x, y); } MOTIF.chakra({ a: L.a, b: L.b, n: L.n }, R * .085, 8); for (const c of [L.a, L.b, L.n]) c.restore(); }
      for (let i = 0; i < 16; i++) { const q = i / 16 * TAU; L.red.fillRect(Math.cos(q) * R * .765 - R * .01, Math.sin(q) * R * .765 - R * .01, R * .02, R * .02); }
      // spokes: eight thick, turned, with collars and bosses; eight thin
      const kk = .9 / (R * .05);
      for (let i = 0; i < 16; i++) {
        const q = i / 16 * TAU, thick = i % 2 === 0, c = Math.cos(q), s = Math.sin(q), r0 = R * .28, r1 = R * .79, rr = thick ? R * .034 : R * .015;
        capPx(L.fig, m + c * r0, m + s * r0, 0, rr, m + c * r1, m + s * r1, 0, rr * .92, kk, .8);
        for (const f of thick ? [.33, .42, .62, .72, .95] : [.4, .7]) { const r = R * f, px = -s * rr * 1.08, py = c * rr * 1.08; capPx(L.fig, m + c * r - px, m + s * r - py, rr * .62, rr * .3, m + c * r + px, m + s * r + py, rr * .62, rr * .3, kk, .8); }
        if (thick) { ellPx(L.fig, m + c * R * .53, m + s * R * .53, R * .05, R * .05, R * .01, R * .03, kk); for (const c2 of [L.b]) { c2.save(); c2.translate(c * R * .53, s * R * .53); MOTIF.lotus({ a: c2 }, R * .04, 8); c2.restore(); } }
      }
      // hub: lotus medallion, a dark stone ring, the axle boss
      MOTIF.lotus({ a: L.a, b: L.b, n: L.n }, R * .2, 16);
      L.alt.lineWidth = R * .03; _cP(L.alt).arc(0, 0, R * .235, 0, TAU); L.alt.stroke();
      L.red.lineWidth = R * .006; _cP(L.red).arc(0, 0, R * .215, 0, TAU); L.red.stroke();
      carveRelief(H, L, { aA: .6, aR: .006, bA: .16 });
      for (let yy = 0; yy < W; yy++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - m, yy - m) / (R * .06); if (d < 1) H.a[yy * W + x] += .5 * Math.sqrt(1 - d * d); }
      grain(H, .02, 29, .6);
      return { H, O: { depth: .03, kL: 2.6, lichen: 1.6, lichenCols: ['#d89a2c', '#c9772e'], alt: 'slate', altM: blurH(maskOf(L.cv.alt), 1, 1), redM: blurH(maskOf(L.cv.red), 1, 1), streaks: false } };
    },
    // white marble for the Diamond Ring arches: gold-lined arcade of seated figures and dancers, gold chakra roundels
    marble(W) {
      const Hh = W >> 2, H = hbuf(W, Hh, 0), y = (f) => f * Hh, L = _figL(layers(W, Hh, 'a', 'b', 'n', 'f', 'g', 'au'), W, Hh);
      const F = L.f; F.fillRect(0, 0, W, y(.07)); F.fillRect(0, y(.93), W, y(.07)); moulding(H, y(.07), y(.1), 'torus', .6); moulding(H, y(.9), y(.93), 'torus', .6);
      F.fillRect(0, y(.3), W, y(.03)); L.au.fillRect(0, y(.1), W, y(.016)); L.au.fillRect(0, y(.884), W, y(.016)); L.au.fillRect(0, y(.33), W, y(.01));
      const n = 8;
      for (let k = 0; k < n; k++) {
        const px = (k + .5) * W / n, bw = W / n;
        cstamp({ a: F }, W, px, 0, (Q) => { const b = Q.a; b.lineWidth = bw * .06; _cP(b).moveTo(-bw * .46, y(.88)); b.lineTo(-bw * .46, y(.46)); for (let j = 0; j < 3; j++) b.arc(-bw * .307 + j * bw * .307, y(.46), bw * .153, Math.PI, 0); b.lineTo(bw * .46, y(.88)); b.stroke(); });
        cstamp({ a: L.au }, W, k * W / n, 0, (Q) => { Q.a.fillRect(-bw * .02, y(.34), bw * .04, y(.54)); });
        sculpt(L.fig, k % 2 ? 'tribhanga' : 'seated', px, y(.875), y(k % 2 ? .46 : .5), k % 4 === 3, .7);
        cstamp({ a: L.au }, W, px, y(.2), (Q) => { Q.a.lineWidth = y(.014); _cP(Q.a).arc(0, 0, y(.075), 0, TAU); Q.a.stroke(); for (let i = 0; i < 8; i++) { const q = i / 8 * TAU; _cP(Q.a).moveTo(0, 0); Q.a.lineTo(Math.cos(q) * y(.075), Math.sin(q) * y(.075)); Q.a.stroke(); } _cP(Q.a).arc(0, 0, y(.02), 0, TAU); Q.a.fill(); });
        cstamp({ a: L.a, b: L.b }, W, k * W / n, y(.2), (Q) => MOTIF.lotus(Q, y(.075), 8));
      }
      foliage(L.g, 0, y(.1), W, y(.2), y(.04), 88);
      carveRelief(H, L, { aR: .014, gA: .1 }); addLayer(H, maskOf(L.cv.au), .1, 1);
      grain(H, .01, 23, .3);
      return { H, O: { depth: .014, kL: 1.6, goldM: maskOf(L.cv.au) } };
    },
  };
  return { SHEETS, carveMaps, STONES, lin3: _lin3 };
}
const CL = carveLib();

/* ---------- sheets → textures: carved in background workers while the scene boots ---------- */
const CARVE = { list: [], by: {}, ms: 0, pending: 0, wall: 0, done: null };
function _dtex(d, w, h, srgb, ty) {
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = ty ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
const SHEET_ASPECT = { konark: 1, strip: .25, frieze: .25, panels: .7, band: .125, spoke: 2, medallion: 1, wall: .7, ashlar: 1, eclipse: .25, marble: .25 };
// declare a sheet: its textures exist at once (flat, in the stone's colour); the relief arrives when the sheet is carved
function carveSheet(key, kind, W, gen) {
  if (CARVE.by[key]) return CARVE.by[key];
  const w = W, h = (W * SHEET_ASPECT[gen[0]]) | 0, n = w * h * 4, S = CL.STONES[kind];
  const alb = new Uint8Array(n), nrm = new Uint8Array(n), orm = new Uint8Array(n), A = CL.lin3(S.a), B = CL.lin3(S.b), g = (i) => Math.round(Math.pow((A[i] * .6 + B[i] * .4) * .82, 1 / 2.2) * 255);
  const br = g(0), bg = g(1), bb = g(2);
  for (let i = 0; i < n; i += 4) { alb[i] = br; alb[i + 1] = bg; alb[i + 2] = bb; alb[i + 3] = 255; nrm[i] = 128; nrm[i + 1] = 128; nrm[i + 2] = 255; nrm[i + 3] = 255; orm[i] = 230; orm[i + 1] = S.rough * 255; orm[i + 2] = (S.metal || 0) * 255; orm[i + 3] = 255; }
  const ty = gen[0] === 'spoke' || gen[0] === 'wall' || gen[0] === 'ashlar';
  const sh = { key, kind, gen, w, h, ty, alb, nrm, orm, done: false, texs: [], seed: (key.length * 7 + w) % 97 + 3 };
  sh.map = _dtex(alb, w, h, true, ty); sh.normalMap = _dtex(nrm, w, h, false, ty); sh.orm = _dtex(orm, w, h, false, ty);
  sh.texs.push(sh.map, sh.normalMap, sh.orm);
  CARVE.by[key] = sh; CARVE.list.push(sh); CARVE.pending++;
  return sh;
}
function _carveApply(sh, alb, nrm, orm, ms) {
  if (sh.done) return;
  sh.map.image.data = alb; sh.normalMap.image.data = nrm; sh.orm.image.data = orm; sh.alb = alb; sh.nrm = nrm; sh.orm_ = orm;
  for (const t of sh.texs) t.needsUpdate = true;
  sh.done = true; CARVE.pending--; CARVE.ms += ms || 0;
}
function carveRun(sh) {
  if (sh.done) return;
  const t0 = performance.now(), { H, O } = CL.SHEETS[sh.gen[0]](sh.w, sh.gen[1]), n = H.w * H.h * 4, out = { alb: new Uint8Array(n), nrm: new Uint8Array(n), orm: new Uint8Array(n) };
  CL.carveMaps(H, sh.kind, { seed: sh.seed, ...O, ...(sh.gen[2] || {}) }, out);
  _carveApply(sh, out.alb, out.nrm, out.orm, performance.now() - t0);
}
// the worker runs the same library source
function carveWorkerSrc() {
  return `const L = (${carveLib.toString()})();
onmessage = (e) => { const m = e.data; try { const t0 = performance.now(), r = L.SHEETS[m.gen[0]](m.w, m.gen[1]), n = r.H.w * r.H.h * 4, out = { alb: new Uint8Array(n), nrm: new Uint8Array(n), orm: new Uint8Array(n) };
  L.carveMaps(r.H, m.kind, Object.assign({ seed: m.seed }, r.O, m.gen[2] || {}), out);
  postMessage({ id: m.id, alb: out.alb, nrm: out.nrm, orm: out.orm, ms: performance.now() - t0 }, [out.alb.buffer, out.nrm.buffer, out.orm.buffer]); }
  catch (err) { postMessage({ id: m.id, err: String((err && err.message) || err) }); } };`;
}
// carve every declared sheet: in workers when the browser has them (OffscreenCanvas), else right here.
// Returns a promise that settles when all sheets are in
function carveStart() {
  const t0 = performance.now(), todo = CARVE.list.filter(s => !s.done);
  let W = [];
  try {
    if (!window.__carveMain && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && new OffscreenCanvas(4, 4).getContext('2d')) {
      const url = URL.createObjectURL(new Blob([carveWorkerSrc()], { type: 'text/javascript' }));
      const n = clamp(((navigator.hardwareConcurrency || 2) / 2) | 0, 1, 3);
      for (let i = 0; i < n; i++) W.push(new Worker(url));
    }
  } catch (e) { W = []; }
  return CARVE.done = new Promise((resolve) => {
    const fin = () => { if (CARVE.pending > 0) return; CARVE.wall = performance.now() - t0; for (const wk of W) wk.terminate(); resolve(); };
    // no workers: carve here, one sheet per slice so the page keeps breathing
    const local = () => { const sh = todo.shift(); if (!sh) { fin(); return; } try { carveRun(sh); } catch (e) { console.warn('carve', sh.key, e); if (!sh.done) { sh.done = true; CARVE.pending--; } } setTimeout(local, 30); };
    if (!W.length) { local(); return; }
    let failed = false;
    const next = (wk) => { const sh = todo.shift(); wk.cur = sh; if (sh) wk.postMessage({ id: sh.key, gen: sh.gen, kind: sh.kind, w: sh.w, seed: sh.seed }); else fin(); };
    const bail = () => { if (failed) return; failed = true; for (const wk of W) { if (wk.cur) todo.unshift(wk.cur); wk.terminate(); } W = []; local(); };
    for (const wk of W) {
      wk.onmessage = (e) => { const m = e.data, sh = CARVE.by[m.id]; if (m.err) { console.warn('carve worker', m.id, m.err); try { carveRun(sh); } catch (e2) { if (!sh.done) { sh.done = true; CARVE.pending--; } } } else _carveApply(sh, m.alb, m.nrm, m.orm, m.ms); wk.cur = null; if (!failed) next(wk); };
      wk.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); console.warn('carve worker failed', e && e.message); bail(); };
      next(wk);
    }
  });
}
// every sheet the world uses, at a resolution for the render quality
function carveRes(q) { return q === 'high' ? 1536 : q === 'low' ? 512 : 1024; }
function buildCarving(q) {
  const R = carveRes(q), K = {}, d = (key, kind, W, ...gen) => (K[key] = carveSheet(key, kind, W, gen));
  d('panels', 'sandstone', R, 'panels'); d('band', 'sandstone', R, 'band'); d('spoke', 'sandstone', R >> 2, 'spoke'); d('bronze', 'bronze', R >> 2, 'spoke');
  d('lotus', 'sandstone', R >> 1, 'medallion', 'lotus'); d('chakra', 'sandstone', R >> 1, 'medallion', 'chakra');
  d('frieze', 'sandstone', R, 'frieze'); d('strip', 'sandstone', R, 'strip'); d('wall', 'sandstone', R >> 1, 'wall'); d('ashlar', 'sandstone', R >> 1, 'ashlar');
  d('eclipse', 'granite', R, 'eclipse'); d('star', 'granite', R >> 1, 'medallion', 'star'); d('granite', 'granite', R >> 1, 'ashlar');
  d('marble', 'marble', R, 'marble'); d('marbleLotus', 'marble', R >> 1, 'medallion', 'lotus'); d('laterite', 'laterite', R >> 1, 'wall'); d('konark', 'buff', R, 'konark');
  return K;
}
// a standard material on a sheet (textures are clones: own repeat, shared image and GPU memory)
function carvedMaterial(sh, { repeat = [1, 1], normalScale = 1, ...extra } = {}) {
  const set = (t) => { const c = t.clone(); c.repeat.set(repeat[0], repeat[1]); c.needsUpdate = true; sh.texs.push(c); return c; };
  const orm = set(sh.orm);
  return new THREE.MeshStandardMaterial({ map: set(sh.map), normalMap: set(sh.normalMap), normalScale: new THREE.Vector2(normalScale, normalScale), roughnessMap: orm, metalnessMap: orm, aoMap: orm, aoMapIntensity: 1, roughness: 1, metalness: 1, ...extra });
}

/* ---------- geometry with UVs laid out for the sheets ---------- */
// an annular block between radii r0..r1 and angles a0..a1, extruded z0..z1:
// group 0 = the two faces (u across the angle, v across the radius), 1 = outer and inner curved faces
// (u along the arc in metres / tile, v across z), 2 = the two end faces
function annularBlock(r0, r1, a0, a1, z0, z1, seg, { tile = 0, capU = 0, capV = 0 } = {}) {
  const P = [], N = [], U = [], I = [], groups = [], rm = (r0 + r1) / 2, span = a1 - a0;
  // a closed ring must repeat a whole number of times
  if (Math.abs(span - TAU) < 1e-4) { if (tile) tile = TAU * r1 / Math.max(1, Math.round(TAU * r1 / tile)); if (capU) capU = TAU * rm / Math.max(1, Math.round(TAU * rm / capU)); }
  const face = (vs) => { const b = P.length / 3; for (const v of vs) { P.push(v[0], v[1], v[2]); N.push(v[3], v[4], v[5]); U.push(v[6], v[7]); } return b; };
  const quad = (b, i0, i1, i2, i3) => I.push(b + i0, b + i1, b + i2, b + i0, b + i2, b + i3);
  const g0 = I.length;
  for (const side of [1, -1]) {         // faces at z1 (front, +z) and z0 (back): u runs against the angle on the front so the relief reads unmirrored
    const z = side > 0 ? z1 : z0, vs = [];
    for (let s = 0; s <= seg; s++) {
      const f = s / seg, q = a0 + span * f, c = Math.cos(q), si = Math.sin(q);
      for (const r of [r0, r1]) { const u = capU ? (side > 0 ? -(q - a0) : (q - a0)) * rm / capU : side > 0 ? 1 - f : f; vs.push([c * r, si * r, z, 0, 0, side, u, capV ? (r - r0) / capV : (r - r0) / (r1 - r0)]); }
    }
    const b = face(vs);
    for (let s = 0; s < seg; s++) { const i = s * 2; if (side > 0) quad(b, i, i + 1, i + 3, i + 2); else quad(b, i, i + 2, i + 3, i + 1); }
  }
  groups.push([g0, I.length - g0, 0]);
  const g1 = I.length;
  for (const [r, out] of [[r1, 1], [r0, -1]]) {
    const vs = [];
    for (let s = 0; s <= seg; s++) { const f = s / seg, q = a0 + span * f, c = Math.cos(q), si = Math.sin(q), u = tile ? (q - a0) * r / tile * out : (out > 0 ? f : 1 - f);
      vs.push([c * r, si * r, z0, c * out, si * out, 0, u, 0], [c * r, si * r, z1, c * out, si * out, 0, u, 1]); }
    const b = face(vs);
    for (let s = 0; s < seg; s++) { const i = s * 2; if (out > 0) quad(b, i, i + 2, i + 3, i + 1); else quad(b, i, i + 1, i + 3, i + 2); }
  }
  groups.push([g1, I.length - g1, 1]);
  const g2 = I.length;
  if (Math.abs(span - TAU) > 1e-4) for (const [q, sg] of [[a0, -1], [a1, 1]]) {
    const c = Math.cos(q), si = Math.sin(q), nx = -si * sg, ny = c * sg, L = (z1 - z0);
    const b = face([[c * r0, si * r0, z0, nx, ny, 0, 0, 0], [c * r1, si * r1, z0, nx, ny, 0, (r1 - r0) / L, 0], [c * r1, si * r1, z1, nx, ny, 0, (r1 - r0) / L, 1], [c * r0, si * r0, z1, nx, ny, 0, 0, 1]]);
    if (sg > 0) quad(b, 0, 3, 2, 1); else quad(b, 0, 1, 2, 3);
  }
  groups.push([g2, I.length - g2, 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I); for (const [s0, c, m] of groups) g.addGroup(s0, c, m);
  return g;
}
// merge geometries that share a group layout, keeping one group per material index
function mergeGrouped(geos) {
  const out = new THREE.BufferGeometry(), names = ['position', 'normal', 'uv'], arr = { position: [], normal: [], uv: [] }, byMat = new Map(); let base = 0;
  for (let g of geos) {
    for (const nm of names) { const a = g.attributes[nm]; for (let i = 0; i < a.count * a.itemSize; i++) arr[nm].push(a.array[i]); }
    const idx = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    const grs = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }];
    for (const gr of grs) { if (!byMat.has(gr.materialIndex)) byMat.set(gr.materialIndex, []); const L = byMat.get(gr.materialIndex); for (let i = gr.start; i < gr.start + gr.count; i++) L.push(idx[i] + base); }
    base += g.attributes.position.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(arr.position, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normal, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2));
  const I = []; for (const m of [...byMat.keys()].sort((a, b) => a - b)) { const L = byMat.get(m); out.addGroup(I.length, L.length, m); for (const v of L) I.push(v); }
  out.setIndex(I); return out;
}
// box UVs in world units: each face maps (its two axes) / tile, v optionally fitted to the face height
function boxUV(g, tu, tv = tu, { fitV = false, off = [0, 0] } = {}) {
  g.computeBoundingBox(); const bb = g.boundingBox, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay > ax && ay > az) { u = x / tu; v = z / tu; }
    else if (ax > az) { u = -z * Math.sign(n.getX(i)) / tu; v = fitV ? (y - bb.min.y) / (bb.max.y - bb.min.y) : (y - bb.min.y) / tv; }
    else { u = x * Math.sign(n.getZ(i)) / tu; v = fitV ? (y - bb.min.y) / (bb.max.y - bb.min.y) : (y - bb.min.y) / tv; }
    uv.setXY(i, u + off[0], v + off[1]);
  }
  uv.needsUpdate = true; return g;
}
// torus UVs for a frieze: u along the ring (× reps), v mirrored about the tube so both faces read top-outward
function torusFriezeUV(g, reps) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * reps, Math.abs(1 - 2 * uv.getY(i))); uv.needsUpdate = true; return g; }
// per-instance atlas cells for the portal panels: aCell = (u offset, v offset, mirror)
function atlasHook(m, scale = [.5, .5]) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCell;\nvec2 cellUv(vec2 t){ t.x = aCell.z > .5 ? 1.0 - t.x : t.x; return clamp(t, 0.004, 0.996) * vec2(' + scale[0].toFixed(3) + ', ' + scale[1].toFixed(3) + ') + aCell.xy; }')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = cellUv(vMapUv);\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv = cellUv(vNormalMapUv);\n#endif\n#ifdef USE_ROUGHNESSMAP\nvRoughnessMapUv = cellUv(vRoughnessMapUv);\n#endif\n#ifdef USE_METALNESSMAP\nvMetalnessMapUv = cellUv(vMetalnessMapUv);\n#endif\n#ifdef USE_AOMAP\nvAoMapUv = cellUv(vAoMapUv);\n#endif');
  };
  m.customProgramCacheKey = () => 'atlas';
  return m;
}
