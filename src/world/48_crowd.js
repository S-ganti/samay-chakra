/* =========================================================================
   CROWD — mocap skeleton (CC0 Universal Animation Library, Quaternius),
   clips baked to a bone texture, procedural Indian clothing, instanced GPU
   skinning with two-pose crossfades and three levels of detail
   ========================================================================= */
const RIG = (() => {
  const D = RIG_DATA, NR = D.bones.length, NB = NR + 2;           // + two virtual "skirt" bones
  const b64 = (s, T) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); };
  const bone = {}; D.bones.forEach((n, i) => { bone[n] = i; }); bone['skirt.L'] = NR; bone['skirt.R'] = NR + 1;
  const inv = [], jp = {};
  for (let b = 0; b < NR; b++) { const m = new THREE.Matrix4().fromArray(D.invBind, b * 16); inv.push(m); jp[D.bones[b]] = V3().setFromMatrixPosition(m.clone().invert()); }
  // a skirt side swings with its thigh, but only part of the way: a rigid rotation about the hip joint by
  // SKIRT_FOLLOW of the thigh's own rotation relative to the hips (keeps the cloth's volume in a running stride)
  const SKIRT_FOLLOW = .58;
  const clips = { bind: { row: 0, n: 1, dur: 0, src: null } }; let rows = 1;          // row 0 = bind pose (identity)
  const OUT_FPS = 60;
  for (const c of D.clips) { const n = c.dur > 0 ? Math.max(1, Math.round(c.dur * OUT_FPS)) : 1; clips[c.name] = { row: rows, n, dur: c.dur, src: c }; rows += n; }
  let tex = null;
  // where the left fist is in every frame (model space): torches and the like are placed there on the CPU
  const grip = new Float32Array(rows * 3), gripBind = V3(jp['hand.L'].x + .055, jp['hand.L'].y - .003, jp['hand.L'].z + .002), _g = V3();
  // run FK once per 60 fps frame of every clip → skinning matrices (3 rows of 4) in a half-float texture
  function build() {
    if (tex) return tex;
    const Q = b64(D.q, Int16Array), H = b64(D.h, Int16Array), W = NB * 3, data = new Uint16Array(W * rows * 4), toH = THREE.DataUtils.toHalfFloat;
    const restT = [], restR = [];
    for (let b = 0; b < NR; b++) { restT.push(V3().fromArray(D.restT, b * 3)); restR.push(new THREE.Quaternion().fromArray(D.restR, b * 4)); }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), tv = V3(), one = V3(1, 1, 1), local = new THREE.Matrix4(), world = [], skm = [];
    for (let b = 0; b < NR; b++) { world.push(new THREE.Matrix4()); skm.push(new THREE.Matrix4()); }
    const hipInv = new THREE.Matrix4(), dM = new THREE.Matrix4(), dQ = new THREE.Quaternion(), qI = new THREE.Quaternion(), sv = new THREE.Matrix4(), tA = new THREE.Matrix4(), tB = new THREE.Matrix4();
    const put = (row, b, m) => {
      const e = m.elements, o = (row * W + b * 3) * 4;
      data[o] = toH(e[0]); data[o + 1] = toH(e[4]); data[o + 2] = toH(e[8]); data[o + 3] = toH(e[12]);
      data[o + 4] = toH(e[1]); data[o + 5] = toH(e[5]); data[o + 6] = toH(e[9]); data[o + 7] = toH(e[13]);
      data[o + 8] = toH(e[2]); data[o + 9] = toH(e[6]); data[o + 10] = toH(e[10]); data[o + 11] = toH(e[14]);
    };
    const qAt = (fr, b, out) => { const o = (fr * (NR - 1) + (b - 1)) * 3, x = Q[o] / 32767, y = Q[o + 1] / 32767, z = Q[o + 2] / 32767; return out.set(x, y, z, Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z))); };
    const HIPS = bone.hips;
    for (let b = 0; b < NB; b++) { const o = b * 12; data[o] = data[o + 5] = data[o + 10] = toH(1); }
    for (const name in clips) {
      const C = clips[name], src = C.src; if (!src) continue;
      for (let f = 0; f < C.n; f++) {
        const s = src.dur > 0 ? f / OUT_FPS * D.fps : 0; let i0 = Math.floor(s); const fr = s - i0; i0 %= src.n; const i1 = (i0 + 1) % src.n;
        const g0 = src.row + i0, g1 = src.row + i1;
        for (let b = 0; b < NR; b++) {
          if (b === 0) { qa.copy(restR[0]); tv.fromArray(src.rootT); }
          else {
            qAt(g0, b, qa); qAt(g1, b, qb); if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w); qa.slerp(qb, fr);
            if (b === HIPS) tv.set(lerp(H[g0 * 3], H[g1 * 3], fr), lerp(H[g0 * 3 + 1], H[g1 * 3 + 1], fr), lerp(H[g0 * 3 + 2], H[g1 * 3 + 2], fr)).multiplyScalar(.001);
            else tv.copy(restT[b]);
          }
          local.compose(tv, qa, one);
          if (D.parent[b] >= 0) world[b].multiplyMatrices(world[D.parent[b]], local); else world[b].copy(local);
          skm[b].multiplyMatrices(world[b], inv[b]);
          put(C.row + f, b, skm[b]);
        }
        _g.copy(gripBind).applyMatrix4(skm[bone['hand.L']]); grip[(C.row + f) * 3] = _g.x; grip[(C.row + f) * 3 + 1] = _g.y; grip[(C.row + f) * 3 + 2] = _g.z;
        // virtual skirt bones: hips × (partial thigh rotation about the hip joint)
        hipInv.copy(skm[HIPS]).invert();
        for (const [v, tn] of [[NR, 'thigh.L'], [NR + 1, 'thigh.R']]) {
          dM.multiplyMatrices(hipInv, skm[bone[tn]]); dQ.setFromRotationMatrix(dM); qI.identity().slerp(dQ, SKIRT_FOLLOW);
          const j = jp[tn]; tA.makeTranslation(j.x, j.y, j.z); tB.makeTranslation(-j.x, -j.y, -j.z);
          sv.makeRotationFromQuaternion(qI).premultiply(tA).multiply(tB).premultiply(skm[HIPS]);
          put(C.row + f, v, sv);
        }
      }
    }
    tex = new THREE.DataTexture(data, W, rows, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    return tex;
  }
  return { NB, bone, jp, clips, rows, build, grip };
})();

/* ---------- procedural bodies + clothing (bind pose: T-pose, +z forward, +x = the figure's left) ---------- */
// regions: 0 skin, 1 top, 2 bottom, 3 accent, 4 hair, 5 feet
const VAR = { SAREE: 0, LEHENGA: 1, KURTA: 2, DHOTI: 3 };
function buildFigure(variant, lod) {
  const B = RIG.bone, fem = variant === VAR.SAREE || variant === VAR.LEHENGA;
  const P = [], P2 = [], K = [], K2 = [], I = [];
  // second weight set (K2) used when seated/lying: skirts follow the legs instead of hanging from the hips
  const vtx = (x, y, z, bA, bB, wA, reg, alt, p2) => { P.push(x, y, z); K.push(bA, bB, wA, reg); if (alt) K2.push(alt[0], alt[1], alt[2]); else K2.push(bA, bB, wA); if (p2) P2.push(p2[0], p2[1], p2[2]); else P2.push(x, y, z); return P.length / 3 - 1; };
  const _u = V3(), _v = V3(), _t = V3(), _c = V3();
  // generalized tube: rings of {c, t (axis), u (first radius dir), ru, rv, skin(angle, x, y, z) → [bA, bB, wA, reg], min}
  function tube(rings, sides, capA, capB, a0 = 0) {
    rings = rings.filter(r => (r.min === undefined ? 2 : r.min) >= lod);
    const base = P.length / 3;
    for (const R of rings) {
      _t.copy(R.t).normalize(); _u.copy(R.u).addScaledVector(_t, -R.u.dot(_t)).normalize(); _v.crossVectors(_t, _u);
      for (let s = 0; s < sides; s++) {
        const a = a0 + s / sides * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const rr = R.rmod ? R.rmod(a) : 1;
        const x = R.c.x + (_u.x * ca * R.ru + _v.x * sa * R.rv) * rr, y = R.c.y + (_u.y * ca * R.ru + _v.y * sa * R.rv) * rr, z = R.c.z + (_u.z * ca * R.ru + _v.z * sa * R.rv) * rr;
        const sk = R.skin(a, x, y, z); vtx(x, y, z, sk[0], sk[1], sk[2], sk[3], sk[4], sk[5]);
      }
    }
    const n = rings.length;
    for (let k = 0; k < n - 1; k++) for (let s = 0; s < sides; s++) {
      const a = base + k * sides + s, b = base + k * sides + (s + 1) % sides, c = a + sides, d = b + sides;
      I.push(a, b, c, b, d, c);
    }
    const cap = (k, dir) => {
      const R = rings[k]; _t.copy(R.t).normalize();
      const cx = R.c.x + _t.x * dir * (R.capOut || 0), cy = R.c.y + _t.y * dir * (R.capOut || 0), cz = R.c.z + _t.z * dir * (R.capOut || 0);
      const sk = R.skin(0, cx, cy, cz), c = vtx(cx, cy, cz, sk[0], sk[1], sk[2], R.capReg !== undefined ? R.capReg : sk[3], sk[4], sk[5]);
      for (let s = 0; s < sides; s++) { const a = base + k * sides + s, b = base + k * sides + (s + 1) % sides; if (dir < 0) I.push(c, b, a); else I.push(c, a, b); }
    };
    if (capA) cap(0, -1); if (capB) cap(n - 1, 1);
  }
  const X = V3(1, 0, 0), Yv = V3(0, 1, 0), Yd = V3(0, -1, 0), Z = V3(0, 0, 1);
  const mix2 = (a, b, w) => w <= 0 ? [a, a, 1] : w >= 1 ? [b, b, 1] : [a, b, 1 - w];
  const S = [12, 8, 5][lod], SL = [7, 5, 4][lod], SK = [16, 10, 6][lod];

  /* torso + neck */
  const TP = fem ? [[.80, .130, .100, -.035], [.86, .165, .115, -.04], [.93, .180, .118, -.04], [1.00, .160, .105, -.03], [1.06, .125, .092, -.015], [1.13, .128, .095, -.005], [1.20, .140, .112, .005], [1.27, .150, .122, .012], [1.34, .155, .112, .008], [1.40, .165, .098, 0], [1.45, .156, .080, -.01], [1.485, .066, .055, -.01], [1.53, .046, .046, 0], [1.61, .043, .043, .012]]
    : [[.80, .120, .095, -.03], [.86, .150, .110, -.035], [.93, .165, .115, -.035], [1.00, .150, .105, -.025], [1.06, .140, .100, -.015], [1.13, .145, .102, -.005], [1.20, .155, .108, 0], [1.28, .170, .115, .005], [1.35, .180, .115, .005], [1.41, .190, .105, 0], [1.455, .176, .085, -.01], [1.49, .075, .060, -.01], [1.53, .052, .050, 0], [1.61, .048, .048, .012]];
  const tMin = [2, 1, 2, 1, 2, 0, 2, 1, 2, 1, 2, 2, 1, 2];
  const torsoSkin = (y) => y <= .95 ? [B.hips, B.hips, 1] : y <= 1.10 ? mix2(B.hips, B['spine.001'], (y - .95) / .15) : y <= 1.24 ? mix2(B['spine.001'], B['spine.002'], (y - 1.1) / .14) : y <= 1.37 ? mix2(B['spine.002'], B['spine.003'], (y - 1.24) / .13) : y <= 1.49 ? mix2(B['spine.003'], B.neck, (y - 1.37) / .12 * .5) : mix2(B.neck, B.head, (y - 1.49) / .12);
  // regions are flat per triangle (taken from the band's upper ring), so boundaries fall on ring lines
  const topReg = (y) => {
    if (y > 1.50) return 0;                                              // neck
    if (variant === VAR.SAREE) return y < 1.01 ? 2 : y < 1.07 ? 0 : 1;   // petticoat / midriff / blouse
    return 1;
  };
  tube(TP.map(([y, hw, hd, zc], k) => ({
    c: V3(0, y, zc), t: Yv, u: X, ru: hw, rv: hd, min: tMin[k],
    skin: (a, x, yy, z) => {
      const s = torsoSkin(y); const ax = Math.abs(x);
      if (y > 1.33 && y < 1.49 && ax > .09) { const w = smooth(.09, .19, ax) * .55; return [s[0] === B.neck ? B['spine.003'] : s[0], x > 0 ? B['shoulder.L'] : B['shoulder.R'], 1 - w, topReg(y)]; }
      return [s[0], s[1], s[2], topReg(y)];
    },
  })), S, true, false);

  /* head */
  const hc = V3(0, 1.675, .025), hr = fem ? [.083, .106, .097] : [.088, .112, .102];
  const hairReg = (x, y, z) => {
    if (variant === VAR.DHOTI) return y > 1.705 ? 3 : (z < hc.z - .03 && y > 1.63) ? 4 : 0;          // turban over the crown
    if (fem) return (y > 1.735 || (z < hc.z - .005 && y > 1.60) || (Math.abs(x) > .07 && y > 1.66 && z < hc.z + .04)) ? 4 : 0;
    return (y > 1.745 || (z < hc.z - .02 && y > 1.64)) ? 4 : 0;
  };
  const LAT = [7, 5, 3][lod];
  { const rings = []; for (let k = 1; k < LAT; k++) { const ph = k / LAT * Math.PI, cy = hc.y + Math.cos(ph) * hr[1], sp = Math.sin(ph);
      rings.push({ c: V3(0, cy, hc.z - (ph > 2 ? (ph - 2) * .02 : 0)), t: Yd, u: X, ru: hr[0] * sp, rv: hr[2] * sp * (ph > 1.9 ? .92 : 1), capOut: k === 1 || k === LAT - 1 ? hr[1] * (1 - Math.cos(Math.PI / LAT)) : 0,
        skin: (a, x, y, z) => [B.head, B.head, 1, hairReg(x, y, z)] }); }
    tube(rings, [10, 7, 5][lod], true, true); }
  if (variant === VAR.DHOTI) { // turban shell
    const tc = V3(0, 1.745, .012), rings = [];
    for (let k = 1; k < [5, 4, 3][lod]; k++) { const ph = k / [5, 4, 3][lod] * Math.PI * .62, sp = Math.sin(ph); rings.push({ c: V3(0, tc.y + Math.cos(ph) * .08, tc.z), t: Yd, u: X, ru: .104 * sp + .005, rv: .114 * sp + .005, capOut: k === 1 ? .012 : 0, skin: () => [B.head, B.head, 1, 3] }); }
    rings.push({ c: V3(0, 1.69, .01), t: Yd, u: X, ru: .094, rv: .104, skin: () => [B.head, B.head, 1, 3] });
    tube(rings, [10, 7, 5][lod], true, false);
  }
  if (variant === VAR.SAREE) { // hair bun
    const bc = V3(0, 1.665, -.092), rings = [];
    for (let k = 1; k < [5, 3, 3][lod]; k++) { const ph = k / [5, 3, 3][lod] * Math.PI, sp = Math.sin(ph); rings.push({ c: V3(0, bc.y, bc.z - Math.cos(ph) * .045), t: Z, u: X, ru: .055 * sp, rv: .05 * sp, capOut: .01, skin: () => [B.head, B.head, 1, 4] }); }
    tube(rings, [8, 6, 4][lod], true, true);
  }
  if (variant === VAR.LEHENGA && lod < 2) { // braid
    const pts = [[1.66, -.085, .03], [1.52, -.115, .028], [1.36, -.13, .024], [1.18, -.13, .02], [1.04, -.125, .012]];
    tube(pts.map(([y, z, r], k) => ({ c: V3(0, y, z), t: Yd, u: X, ru: r, rv: r * .8, capOut: .01, min: k % 2 ? 0 : 2, skin: () => y > 1.55 ? [B.head, B.head, 1, 4] : y > 1.3 ? [B['spine.003'], B.head, .6, 4] : [B['spine.002'], B['spine.003'], .5, 4] })), [6, 4, 4][lod], false, true);
  }

  /* arms */
  const sleeve = variant === VAR.SAREE ? .31 : variant === VAR.DHOTI ? .5 : .64;
  const af = fem ? 1.0 : 1.14;
  for (const sd of [1, -1]) {
    const L = sd > 0 ? '.L' : '.R', sh = B['shoulder' + L], ua = B['upper_arm' + L], fa = B['forearm' + L], hd = B['hand' + L];
    const AR = [[.13, .05, .053, 2], [.19, .052, .054, 2], [.28, .049, .051, 1], [.38, .045, .047, 0], [.466, .040, .042, 2], [.55, .040, .042, 1], [.64, .035, .038, 0], [.72, .030, .034, 2]];
    const armSkin = (x) => x < .2 ? [sh, ua, .5] : x < .40 ? [ua, ua, 1] : x < .53 ? mix2(ua, fa, (x - .40) / .13) : x < .70 ? [fa, fa, 1] : mix2(fa, hd, (x - .70) / .04 * .6);
    tube(AR.map(([x, ry, rz, mn]) => ({ c: V3(sd * x, 1.441, -.065 + (x < .2 ? (.2 - x) * .3 : 0)), t: V3(sd, 0, 0), u: Yv, ru: ry * af, rv: rz * af, min: mn,
      skin: () => { const s = armSkin(x); return [s[0], s[1], s[2], x < sleeve ? 1 : 0]; } })), SL, false, lod === 2, 0);
    if (lod < 2) { // hands: a mitten
      const HR = [[.72, .022, .036], [.77, .021, .042], [.83, .017, .038], [.87, .01, .024]];
      tube(HR.map(([x, ry, rz]) => ({ c: V3(sd * x, 1.438, -.063), t: V3(sd, 0, 0), u: Yv, ru: ry * af, rv: rz * af, capOut: .008, skin: () => x < .74 ? [fa, hd, .35, 0] : [hd, hd, 1, 0] })), [6, 4, 4][lod], false, true);
    }
  }

  /* legs + feet */
  const lf = fem ? .92 : 1;
  const legReg = (y) => variant === VAR.DHOTI ? (y > .32 ? 2 : 0) : 2;
  for (const sd of [1, -1]) {
    const L = sd > 0 ? '.L' : '.R', th = B['thigh' + L], sn = B['shin' + L], ft = B['foot' + L], to = B['toe' + L];
    const LR = [[.97, .084, .088, 0, 2], [.90, .082, .085, 0, 1], [.80, .075, .078, 0, 0], [.68, .066, .070, 0, 1], [.58, .058, .062, 0, 0], [.532, .053, .057, 0, 2], [.46, .054, .062, -.012, 1], [.36, .050, .054, -.008, 0], [.26, .044, .046, 0, 1], [.15, .038, .040, 0, 0], [.10, .034, .037, -.005, 2]];
    const legSkin = (y) => y > .88 ? [B.hips, th, .35] : y > .60 ? [th, th, 1] : y > .47 ? mix2(th, sn, (.60 - y) / .13) : y > .14 ? [sn, sn, 1] : mix2(sn, ft, (.14 - y) / .04 * .5);
    const under = (y) => variant === VAR.KURTA && y > .62 ? .86 : 1;         // hidden under the kurta: keep clear of its hem
    tube(LR.map(([y, rx, rz, dz, mn]) => ({ c: V3(sd * (y > .93 ? .08 : .089), y, dz), t: Yd, u: X, ru: rx * lf * under(y), rv: rz * lf * under(y), min: mn,
      skin: () => { const s = legSkin(y); return [s[0], s[1], s[2], legReg(y)]; } })), SL, false, false);
    const FR = [[-.07, .062, .040, .050, 2], [-.02, .048, .045, .045, 0], [.06, .036, .048, .030, 1], [.13, .026, .045, .020, 0], [.175, .02, .03, .012, 2]];
    tube(FR.map(([z, y, rx, ry, mn]) => ({ c: V3(sd * .089, y, z), t: Z, u: X, ru: rx * lf, rv: ry, min: mn, capOut: .006,
      skin: () => z < .05 ? [ft, ft, 1, 5] : z < .13 ? [ft, to, .5, 5] : [to, to, 1, 5] })), [6, 4, 4][lod], true, true);
  }

  /* skirts: saree / lehenga / dhoti / kurta hem — hips-anchored, the sides following the thighs */
  // seated/lying: hips at the waist, then the thigh down to the knee, the shin below it
  const seatedSkin = (x, y) => { const th = x >= 0 ? B['thigh.L'] : B['thigh.R'], sn = x >= 0 ? B['shin.L'] : B['shin.R'];
    return y > .9 ? [B.hips, B.hips, 1] : y > .62 ? mix2(B.hips, th, (.9 - y) / .28) : y > .47 ? mix2(th, sn, (.62 - y) / .15) : [sn, sn, 1]; };
  // collapsed skirt shape (for sitting / lying): hug the leg on that side instead of flaring
  const hug = (x, y, z) => {
    if (y > .9) return null;
    const lx = x >= 0 ? .089 : -.089, dx = x - lx, dz = z, d = Math.hypot(dx, dz) || 1, r = Math.min(d, (y > .5 ? .1 : .075));
    const f = smooth(.9, .7, y); return [lerp(x, lx + dx / d * r, f), y, lerp(z, dz / d * r, f)];
  };
  const skirt = (yTop, yBot, rTop, rBot, legK, reg, borderReg, pleat, pad = .012, soft = false) => {
    const sideBone = (x) => x >= 0 ? B[soft ? 'skirt.L' : 'thigh.L'] : B[soft ? 'skirt.R' : 'thigh.R'];
    const spread = soft ? [0, .55] : [.1, .7];              // soft skirts: the panel over each knee follows it too
    const nR = [7, 4, 2][lod], rings = [];
    for (let k = 0; k <= nR; k++) {
      const f = k / nR, y = lerp(yTop, yBot, f);
      const tp = TP.reduce((best, r) => Math.abs(r[0] - Math.min(y, yTop)) < Math.abs(best[0] - Math.min(y, yTop)) ? r : best, TP[0]);
      const fl = Math.pow(f, .8);
      const rx = lerp(Math.max(rTop[0], tp[1] + pad), rBot[0], fl), rz = lerp(Math.max(rTop[1], tp[2] + pad), rBot[1], fl);
      rings.push({ c: V3(0, y, lerp(-.035, -.02, f)), t: Yd, u: X, ru: rx, rv: rz,
        rmod: pleat && lod === 0 ? (a) => 1 + (Math.cos(a) > .2 ? .035 * Math.sin(a * 11) * f : 0) : null,
        skin: (a, x, yy, z) => {
          const legW = Math.pow(clamp((.92 - yy) / (.92 - yBot), 0, 1), 1.1) * legK * smooth(spread[0], spread[1], Math.abs(x) / rx);
          return [B.hips, sideBone(x), 1 - legW, reg, seatedSkin(x, yy), hug(x, yy, z)];
        } });
      if (k === nR - 1 && borderReg !== reg && lod < 2) { // border band just above the hem
        const yb = yBot + .035, fb = (yb - yTop) / (yBot - yTop), flb = Math.pow(fb, .8);
        rings.push({ c: V3(0, yb, lerp(-.035, -.02, fb)), t: Yd, u: X, ru: lerp(rTop[0], rBot[0], flb), rv: lerp(rTop[1], rBot[1], flb), rmod: rings[rings.length - 1].rmod,
          skin: (a, x, yy, z) => { const legW = Math.pow(clamp((.92 - yy) / (.92 - yBot), 0, 1), 1.1) * legK * smooth(spread[0], spread[1], Math.abs(x) / rx); return [B.hips, sideBone(x), 1 - legW, reg, seatedSkin(x, yy), hug(x, yy, z)]; } });
      }
    }
    // hem rings carry the border colour
    if (borderReg !== reg && lod < 2) rings[rings.length - 1].skin = ((sk) => (a, x, y, z) => { const r = sk(a, x, y, z); r[3] = borderReg; return r; })(rings[rings.length - 1].skin);
    tube(rings, SK, false, false);
  };
  if (variant === VAR.SAREE) skirt(1.005, .03, [.13, .10], [.235, .2], 1, 2, 3, true, .012, true);
  if (variant === VAR.LEHENGA) skirt(1.03, .035, [.14, .11], [.33, .3], .85, 2, 3, false, .012, true);
  if (variant === VAR.KURTA) skirt(1.0, .56, [.16, .12], [.205, .17], .75, 1, 1, false, .016);
  if (variant === VAR.DHOTI) { skirt(1.0, .80, [.16, .12], [.19, .15], .6, 1, 1, false, .02); skirt(.96, .30, [.15, .12], [.2, .17], .85, 2, 3, false, .006); }

  /* ribbons: saree pallu over the left shoulder; lehenga dupatta around the neck */
  const ribbon = (pts, width, thick, reg, lastReg) => {
    const n = pts.length, rings = [];
    for (let k = 0; k < n; k++) {
      const p = pts[k], q0 = pts[Math.max(0, k - 1)], q1 = pts[Math.min(n - 1, k + 1)];
      const t = V3(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]).normalize();
      const out = V3(p[0], 0, p[2] + .02).normalize();                        // outward from the torso axis
      const w = V3().crossVectors(out, t).normalize();
      const reg_ = k >= n - 2 && lastReg !== undefined ? lastReg : reg;
      rings.push({ c: V3(p[0], p[1], p[2]), t, u: w, ru: (Array.isArray(width) ? lerp(width[0], width[1], k / (n - 1)) : width) * .707, rv: thick * .707, min: p[4] === undefined ? 2 : p[4], skin: () => [p[3][0], p[3][1], p[3][2], reg_] });
    }
    tube(rings, 4, true, true, Math.PI / 4);
  };
  if (variant === VAR.SAREE && lod < 2) {
    const s1 = B['spine.001'], s2 = B['spine.002'], s3 = B['spine.003'];
    ribbon([
      [-.105, 1.06, .108, [B.hips, s1, .5]], [-.075, 1.15, .115, [s1, s1, 1], 0], [-.02, 1.25, .135, [s2, s2, 1]], [.045, 1.34, .128, [s2, s3, .4], 0],
      [.10, 1.42, .09, [s3, s3, 1]], [.14, 1.475, -.01, [s3, B['shoulder.L'], .5]], [.135, 1.42, -.105, [s3, s3, 1]], [.12, 1.27, -.125, [s2, s2, 1], 0],
      [.11, 1.08, -.118, [s1, s1, 1]], [.1, .9, -.15, [B.hips, B.hips, 1], 0], [.095, .66, -.172, [B.hips, B.hips, 1]],
    ], [.19, .25], .014, 2, 3);
  }
  if (variant === VAR.LEHENGA && lod < 2) {
    const s2 = B['spine.002'], s3 = B['spine.003'];
    ribbon([
      [.1, 1.0, .118, [B['spine.001'], s2, .5]], [.11, 1.2, .132, [s2, s2, 1], 0], [.125, 1.38, .112, [s3, s3, 1]], [.12, 1.47, .025, [s3, B['shoulder.L'], .6]],
      [.055, 1.505, -.07, [s3, B.neck, .6], 0], [0, 1.51, -.08, [s3, B.neck, .5]], [-.055, 1.505, -.07, [s3, B.neck, .6], 0], [-.12, 1.47, .025, [s3, B['shoulder.R'], .6]],
      [-.125, 1.38, .112, [s3, s3, 1]], [-.11, 1.2, .132, [s2, s2, 1], 0], [-.1, 1.0, .118, [B['spine.001'], s2, .5]],
    ], .1, .012, 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aSkin', new THREE.Float32BufferAttribute(K, 4));
  g.setAttribute('aSkin2', new THREE.Float32BufferAttribute(K2, 3));
  g.setAttribute('aPos2', new THREE.Float32BufferAttribute(P2, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/* ---------- material: GPU skinning from the bone texture, two-pose blend, per-person palette ---------- */
const CROWD_VS_PARS = `
uniform sampler2D uBones;
attribute vec4 aSkin;              // bone A, bone B, weight A, region
attribute vec3 aSkin2;             // the same when seated (skirts follow the legs)
attribute vec3 aPos2;              // collapsed skirt shape when sitting / lying
attribute vec4 iAnim;              // row A, row B, weight of B, seated amount
attribute vec4 iC0, iC1, iC2;      // top.rgb + skin.r, bottom.rgb + skin.g, accent.rgb + skin.b
attribute vec4 iHair;              // hair.rgb, skirt collapse
flat varying vec3 vPCol;
mat4 crowdBone(int row, int b){
  vec4 r0 = texelFetch(uBones, ivec2(b * 3, row), 0), r1 = texelFetch(uBones, ivec2(b * 3 + 1, row), 0), r2 = texelFetch(uBones, ivec2(b * 3 + 2, row), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 crowdPoseW(int row, vec3 w){
  mat4 m = crowdBone(row, int(w.x + .5));
  if (w.z < .999) m = m * w.z + crowdBone(row, int(w.y + .5)) * (1.0 - w.z);
  return m;
}
mat4 crowdPose(int row){
  float st = iAnim.w;
  if (st < .001 || all(equal(aSkin.xyz, aSkin2))) return crowdPoseW(row, aSkin.xyz);
  if (st > .999) return crowdPoseW(row, aSkin2);
  return crowdPoseW(row, aSkin.xyz) * (1.0 - st) + crowdPoseW(row, aSkin2) * st;
}
mat4 crowdSkin(){
  mat4 m = crowdPose(int(iAnim.x + .5));
  if (iAnim.z > .002) m = m * (1.0 - iAnim.z) + crowdPose(int(iAnim.y + .5)) * iAnim.z;
  return m;
}`;
function crowdHook(sh, withColor) {
  sh.uniforms.uBones = CROWD_U.uBones;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CROWD_VS_PARS)
    .replace('#include <beginnormal_vertex>', 'mat4 cSkinM = crowdSkin();\nvec3 objectNormal = normalize(mat3(cSkinM) * normal);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
    .replace('#include <begin_vertex>', `vec3 transformed = (cSkinM * vec4(mix(position, aPos2, iHair.w), 1.0)).xyz;
      { int reg = int(aSkin.w + .5); vec3 skin = vec3(iC0.w, iC1.w, iC2.w);
        vPCol = reg == 0 ? skin : reg == 1 ? iC0.rgb : reg == 2 ? iC1.rgb : reg == 3 ? iC2.rgb : reg == 4 ? iHair.rgb : skin * 0.62; }`);
  if (withColor) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nflat varying vec3 vPCol;').replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vPCol;');
}
const CROWD_U = { uBones: { value: null } };
function crowdMaterials() {
  const mat = new THREE.MeshStandardMaterial({ roughness: .82, metalness: 0 });
  mat.onBeforeCompile = (sh) => crowdHook(sh, true);
  mat.customProgramCacheKey = () => 'crowd';
  // depth material for the shadow pass (the beginnormal chunk isn't in depth shaders, so skin in begin_vertex there)
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = CROWD_U.uBones;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CROWD_VS_PARS)
      .replace('#include <begin_vertex>', 'vec3 transformed = (crowdSkin() * vec4(mix(position, aPos2, iHair.w), 1.0)).xyz;');
  };
  depth.customProgramCacheKey = () => 'crowd-depth';
  return { mat, depth };
}
