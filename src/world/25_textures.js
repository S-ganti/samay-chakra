/* =========================================================================
   PROCEDURAL TEXTURES — carved relief, Konark wheel, banners, rangoli…
   ========================================================================= */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}
function speckle(ctx, w, h, n, a, r0 = .5, r1 = 1.6, colFn) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colFn ? colFn(Math.random()) : `rgba(0,0,0,${Math.random() * a})`;
    const r = r0 + Math.random() * (r1 - r0);
    ctx.fillRect(Math.random() * w, Math.random() * h, r, r);
  }
}
// carved stroke: shadow offset + highlight offset, then body
function carve(ctx, draw, depth = 2) {
  ctx.save(); ctx.translate(depth, depth); ctx.fillStyle = ctx.strokeStyle = 'rgba(20,14,8,.55)'; draw(); ctx.restore();
  ctx.save(); ctx.translate(-depth * .6, -depth * .6); ctx.fillStyle = ctx.strokeStyle = 'rgba(255,248,230,.35)'; draw(); ctx.restore();
}
function figureDancer(ctx, x, y, s, flip) {
  ctx.beginPath(); ctx.arc(x, y - s * .9, s * .16, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * .22, y - s * .7); ctx.lineTo(x + s * .22, y - s * .7); ctx.lineTo(x + s * .32, y + s * .2); ctx.lineTo(x - s * .32, y + s * .2); ctx.closePath(); ctx.fill();
  ctx.lineWidth = s * .09; ctx.lineCap = 'round';
  const f = flip ? -1 : 1;
  ctx.beginPath(); ctx.moveTo(x - s * .2 * f, y - s * .65); ctx.lineTo(x - s * .55 * f, y - s * 1.05); ctx.moveTo(x + s * .2 * f, y - s * .65); ctx.lineTo(x + s * .5 * f, y - s * .35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * .12, y + s * .2); ctx.lineTo(x - s * .3, y + s * .75); ctx.moveTo(x + s * .12, y + s * .2); ctx.lineTo(x + s * .35 * f, y + s * .7); ctx.stroke();
}
function figureElephant(ctx, x, y, s, flip) {
  const f = flip ? -1 : 1;
  ctx.beginPath(); ctx.ellipse(x, y, s * .62, s * .4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * .6 * f, y - s * .18, s * .3, 0, TAU); ctx.fill();
  ctx.lineWidth = s * .12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + s * .82 * f, y - s * .1); ctx.quadraticCurveTo(x + s * 1.02 * f, y + s * .3, x + s * .86 * f, y + s * .55); ctx.stroke();
  ctx.lineWidth = s * .16;
  for (const lx of [-.4, -.15, .2, .42]) { ctx.beginPath(); ctx.moveTo(x + s * lx * f, y + s * .2); ctx.lineTo(x + s * lx * f, y + s * .62); ctx.stroke(); }
}
function rosette(ctx, x, y, r, petals = 8) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = r * .1; ctx.stroke();
  for (let i = 0; i < petals; i++) {
    const a = i / petals * TAU;
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, r * .34, r * .13, a, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y, r * .18, 0, TAU); ctx.fill();
}
function miniWheel(ctx, x, y, r, sp = 8) {
  ctx.lineWidth = r * .12;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * .8, 0, TAU); ctx.stroke();
  ctx.lineWidth = r * .08;
  for (let i = 0; i < sp; i++) { const a = i / sp * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, r * .2, 0, TAU); ctx.fill();
}

// Horizontal relief band (tiles in u). Greyscale: multiply by material colour.
function texRelief() {
  const W = 1024, H = 512, [c, x] = cnv(W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d9cdb6'); g.addColorStop(1, '#c4b597');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  speckle(x, W, H, 9000, .16, .6, 2.2);
  speckle(x, W, H, 2500, 0, .6, 1.6, () => 'rgba(255,250,235,.12)');
  // borders: beaded rows
  const bead = (y, r) => carve(x, () => { for (let i = r; i < W; i += r * 2.6) { x.beginPath(); x.arc(i, y, r, 0, TAU); x.fill(); } }, 1.5);
  carve(x, () => { x.fillRect(0, 34, W, 6); x.fillRect(0, H - 40, W, 6); }, 2);
  bead(20, 7); bead(H - 20, 7);
  // panels
  const n = 6, pw = W / n;
  for (let i = 0; i < n; i++) {
    const px = i * pw;
    carve(x, () => { x.fillRect(px, 52, 10, H - 104); x.fillRect(px + pw - 10, 52, 10, H - 104); x.fillRect(px + 20, 60, pw - 40, 5); x.fillRect(px + 20, H - 66, pw - 40, 5); }, 2.5);
    x.save(); x.beginPath(); x.rect(px + 18, 70, pw - 36, H - 140); x.fillStyle = 'rgba(60,45,30,.22)'; x.fill(); x.restore();
    const cx = px + pw / 2, cy = H / 2 + 6, k = i % 4;
    carve(x, () => {
      if (k === 0) rosette(x, cx, cy, 58, 12);
      else if (k === 1) { figureDancer(x, cx - 30, cy + 20, 70, false); figureDancer(x, cx + 34, cy + 20, 70, true); }
      else if (k === 2) figureElephant(x, cx, cy + 20, 70, i % 2 === 0);
      else miniWheel(x, cx, cy, 58, 8);
    }, 3);
  }
  return c;
}

// Top-down Konark wheel (colour) — the great wheel in the city plaza (Zero Shadow poster).
function texKonark(S) {
  const [c, x] = cnv(S, S), m = S / 2, R = S * .49;
  x.fillStyle = '#d8c7a4'; x.fillRect(0, 0, S, S);
  x.save(); x.translate(m, m);
  const stone = '#d6c09a', stone2 = '#c9b186', dark = 'rgba(58,40,22,.55)', light = 'rgba(255,248,228,.55)';
  const ring = (r0, r1, fill) => { x.beginPath(); x.arc(0, 0, r1, 0, TAU); x.arc(0, 0, r0, 0, TAU, true); x.fillStyle = fill; x.fill(); };
  const shadeRing = (r, w) => { x.lineWidth = w; x.strokeStyle = dark; x.beginPath(); x.arc(S * .002, S * .003, r, 0, TAU); x.stroke(); x.strokeStyle = light; x.beginPath(); x.arc(-S * .001, -S * .002, r, 0, TAU); x.stroke(); };
  // outer rim band
  ring(R * .8, R, stone); shadeRing(R, S * .004); shadeRing(R * .8, S * .004); shadeRing(R * .93, S * .002);
  // rim panels with figures
  const np = 32;
  for (let i = 0; i < np; i++) {
    const a = i / np * TAU;
    x.save(); x.rotate(a);
    x.strokeStyle = dark; x.lineWidth = S * .0022;
    x.beginPath(); x.moveTo(R * .8, 0); x.lineTo(R * .93, 0); x.stroke();
    x.translate(R * .865, R * .1); x.rotate(Math.PI / 2);
    x.fillStyle = 'rgba(70,50,28,.4)';
    const s = S * .022;
    if (i % 3 === 0) figureElephant(x, 0, 0, s, i % 2); else if (i % 3 === 1) { figureDancer(x, -s * .5, s * .3, s, false); figureDancer(x, s * .6, s * .3, s, true); } else rosette(x, 0, 0, s * .8, 8);
    x.restore();
  }
  // beads on rim edge
  for (let i = 0; i < 180; i++) { const a = i / 180 * TAU; x.fillStyle = dark; x.beginPath(); x.arc(Math.cos(a) * R * .965, Math.sin(a) * R * .965, S * .003, 0, TAU); x.fill(); }
  // spokes: 8 wide + 8 thin
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, wide = i % 2 === 0, w = wide ? S * .055 : S * .02;
    x.save(); x.rotate(a);
    x.fillStyle = 'rgba(60,40,20,.35)'; x.fillRect(R * .26, -w / 2 + S * .004, R * .56, w);
    x.fillStyle = wide ? stone : stone2; x.fillRect(R * .26, -w / 2, R * .56, w);
    x.strokeStyle = dark; x.lineWidth = S * .0018; x.strokeRect(R * .26, -w / 2, R * .56, w);
    if (wide) {
      for (let k = 0; k < 7; k++) { x.strokeStyle = dark; x.beginPath(); x.moveTo(R * (.3 + k * .075), -w / 2); x.lineTo(R * (.3 + k * .075), w / 2); x.stroke(); }
      x.fillStyle = stone; x.beginPath(); x.arc(R * .54, 0, w * .75, 0, TAU); x.fill(); x.strokeStyle = dark; x.stroke();
      x.fillStyle = 'rgba(70,50,28,.45)'; rosette(x, R * .54, 0, w * .55, 8);
    }
    x.restore();
  }
  // floor between spokes (inner field) — slightly darker, with pigment
  // hub
  ring(R * .1, R * .27, stone); shadeRing(R * .27, S * .004); shadeRing(R * .2, S * .002);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; x.save(); x.rotate(a); x.fillStyle = 'rgba(80,55,30,.35)'; x.beginPath(); x.ellipse(R * .19, 0, R * .055, R * .018, 0, 0, TAU); x.fill(); x.restore(); }
  x.lineWidth = S * .005; x.strokeStyle = '#c9942e'; x.beginPath(); x.arc(0, 0, R * .235, 0, TAU); x.stroke();
  x.fillStyle = '#b8a47e'; x.beginPath(); x.arc(0, 0, R * .1, 0, TAU); x.fill();
  x.fillStyle = '#3a2f24'; x.beginPath(); x.arc(0, 0, R * .045, 0, TAU); x.fill();
  // eight small wheels on the rim
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) / 8 * TAU;
    x.fillStyle = stone; x.beginPath(); x.arc(Math.cos(a) * R * .8, Math.sin(a) * R * .8, R * .075, 0, TAU); x.fill();
    x.fillStyle = dark; x.strokeStyle = dark; miniWheel(x, Math.cos(a) * R * .8, Math.sin(a) * R * .8, R * .065, 10);
  }
  // red markers + gold pigment specks (poster 7)
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.fillStyle = '#b8342a'; x.fillRect(Math.cos(a) * R * .77 - S * .004, Math.sin(a) * R * .77 - S * .004, S * .008, S * .008); }
  x.restore();
  speckle(x, S, S, S * 6, 0, S * .0008, S * .003, (r) => r < .7 ? `rgba(233,180,59,${.35 + r * .5})` : `rgba(200,120,40,${r * .6})`);
  speckle(x, S, S, S * 10, .12, S * .0005, S * .0015);
  return c;
}

// circular flagstone floor for the forest clearing
function texFlagstones(S) {
  const [c, x] = cnv(S, S), m = S / 2;
  x.fillStyle = '#8b8170'; x.fillRect(0, 0, S, S);
  x.translate(m, m);
  let r = S * .02;
  while (r < S * .5) {
    const w = S * (.018 + Math.random() * .01), n = Math.max(6, Math.floor(TAU * r / (S * .03)));
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + Math.random() * .02, a1 = (i + 1) / n * TAU - .004;
      const v = 118 + Math.random() * 40;
      x.fillStyle = `rgb(${v + 12},${v + 4},${v - 10})`;
      x.beginPath(); x.arc(0, 0, r + w - 1.2, a0, a1); x.arc(0, 0, r + 1.2, a1, a0, true); x.closePath(); x.fill();
    }
    r += w;
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  speckle(x, S, S, S * 20, .18, .5, 2);
  // moss
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(60,70,40,${Math.random() * .25})`; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, Math.random() * S * .02, 0, TAU); x.fill(); }
  return c;
}

// rangoli (dawn) — white rice-flour kolam with marigold dots, on transparent
function texRangoli(S) {
  const [c, x] = cnv(S, S), m = S / 2;
  x.translate(m, m); x.strokeStyle = 'rgba(255,252,245,.95)'; x.fillStyle = 'rgba(255,252,245,.95)'; x.lineCap = 'round';
  const rings = [.12, .2, .3, .42];
  x.lineWidth = S * .004;
  for (const rr of rings) { x.beginPath(); x.arc(0, 0, S * rr, 0, TAU); x.stroke(); }
  for (let k = 0; k < 3; k++) {
    const n = [8, 16, 24][k], r = S * [.16, .25, .36][k], pr = S * [.04, .045, .05][k];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; x.save(); x.rotate(a); x.translate(r, 0);
      x.beginPath(); x.moveTo(-pr, 0); x.quadraticCurveTo(0, -pr * .9, pr, 0); x.quadraticCurveTo(0, pr * .9, -pr, 0); x.stroke();
      x.beginPath(); x.arc(pr * 1.4, 0, S * .004, 0, TAU); x.fill();
      x.restore();
    }
  }
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; x.fillStyle = i % 2 ? 'rgba(255,150,30,.95)' : 'rgba(255,200,40,.95)'; x.beginPath(); x.arc(Math.cos(a) * S * .46, Math.sin(a) * S * .46, S * .007, 0, TAU); x.fill(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.fillStyle = 'rgba(220,50,40,.9)'; x.beginPath(); x.arc(Math.cos(a) * S * .085, Math.sin(a) * S * .085, S * .01, 0, TAU); x.fill(); }
  return c;
}

// banner cloth with a gold sun mandala (white base, tinted by material colour)
function texBanner() {
  const [c, x] = cnv(256, 768);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 768);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; x.fillRect(Math.random() * 256, Math.random() * 768, 1, 3); }
  x.strokeStyle = '#f2c14e'; x.fillStyle = '#f2c14e'; x.lineWidth = 3;
  x.strokeRect(14, 14, 228, 740);
  const cx = 128, cy = 300;
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48); x.lineTo(cx + Math.cos(a + .06) * 92, cy + Math.sin(a + .06) * 92); x.lineTo(cx + Math.cos(a + .13) * 48, cy + Math.sin(a + .13) * 48); x.fill(); }
  x.beginPath(); x.arc(cx, cy, 44, 0, TAU); x.stroke(); x.beginPath(); x.arc(cx, cy, 30, 0, TAU); x.stroke();
  miniWheel(x, cx, cy, 26, 8);
  for (let i = 0; i < 9; i++) { x.fillRect(40 + i * 21, 560, 8, 8); }
  x.beginPath(); x.moveTo(14, 740); for (let i = 0; i <= 8; i++) x.lineTo(14 + i * 28.5, i % 2 ? 700 : 740); x.stroke();
  return c;
}

function texGlow(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  const [c, x] = cnv(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.25, mid); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
}
function texStarburst() {
  const S = 512, [c, x] = cnv(S, S), m = S / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.06, 'rgba(255,250,235,.9)'); g.addColorStop(.2, 'rgba(255,230,180,.18)'); g.addColorStop(1, 'rgba(255,220,160,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + (i % 2) * .1, L = m * (i % 4 === 0 ? .98 : i % 2 ? .45 : .7), w = i % 4 === 0 ? 5 : 2.5;
    const lg = x.createLinearGradient(m, m, m + Math.cos(a) * L, m + Math.sin(a) * L);
    lg.addColorStop(0, 'rgba(255,255,245,.9)'); lg.addColorStop(1, 'rgba(255,240,210,0)');
    x.strokeStyle = lg; x.lineWidth = w; x.beginPath(); x.moveTo(m, m); x.lineTo(m + Math.cos(a) * L, m + Math.sin(a) * L); x.stroke();
  }
  return c;
}
function texMoon() {
  const S = 256, [c, x] = cnv(S, S), m = S / 2;
  const g = x.createRadialGradient(m - 20, m - 20, 10, m, m, m * .95); g.addColorStop(0, '#f4f1ea'); g.addColorStop(1, '#a9a69e');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, m * .94, 0, TAU); x.fill();
  x.save(); x.beginPath(); x.arc(m, m, m * .94, 0, TAU); x.clip();
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(90,88,82,${.08 + Math.random() * .18})`; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 26, 0, TAU); x.fill(); }
  x.restore(); return c;
}
// concrete wall with the Dispersal lockup carved in (poster 6)
function texDispersalWall() {
  const W = 1024, H = 1024, [c, x] = cnv(W, H);
  x.fillStyle = '#b9b3a8'; x.fillRect(0, 0, W, H);
  speckle(x, W, H, 30000, .16, .6, 2.4);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(90,85,78,${Math.random() * .12})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 3 + Math.random() * 8, 0, TAU); x.fill(); }
  x.fillStyle = '#2a2622'; x.font = '500 30px Jost, Futura, sans-serif'; x.fillText('THE RING / SAMAY CHAKRA', 90, 150); x.fillText('06 / 08', 830, 150);
  x.fillRect(90, 170, 850, 3);
  x.font = '800 190px "Big Shoulders Stencil Display", Impact, "Arial Narrow", sans-serif';
  x.fillStyle = 'rgba(40,36,32,.85)'; x.fillText('DISPERSAL', 84, 400);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillText('DISPERSAL', 80, 396);
  x.fillStyle = '#9e2a22'; x.fillRect(80, 318, 870, 5); x.beginPath(); x.arc(500, 320, 9, 0, TAU); x.fill();
  x.fillStyle = '#2a2622'; x.font = '500 34px Jost, Futura, sans-serif'; x.fillText('09:00 - 12:00   /   RAGA TODI', 90, 480);
  x.fillStyle = '#9e2a22'; x.font = '600 64px "Noto Sans Kannada", sans-serif'; x.fillText('ವಿಸರ್ಜನೆ', 90, 590);
  x.fillRect(90, 625, 560, 2); x.beginPath(); x.arc(200, 626, 7, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(40,36,32,.7)'; x.lineWidth = 2; x.beginPath(); x.arc(1024, 900, 330, Math.PI * .9, Math.PI * 1.5); x.stroke();
  x.fillStyle = '#9e2a22'; x.beginPath(); x.arc(700, 900, 7, 0, TAU); x.fill();
  return c;
}
// building sign (Kannada: Bengaluru) + shop board
function texSign(text, fg = '#2a2622', bg = '#e8e1d2', font = '600 120px "Noto Sans Kannada", sans-serif') {
  const [c, x] = cnv(1024, 256); x.fillStyle = bg; x.fillRect(0, 0, 1024, 256);
  speckle(x, 1024, 256, 4000, .12); x.fillStyle = fg; x.font = font; x.textBaseline = 'middle'; x.fillText(text, 40, 136); return c;
}
