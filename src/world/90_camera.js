/* =========================================================================
   CAMERA — a director that frames each prahar like its poster, plus
   orbit / follow / top modes. Everything glides (or cuts, for capture).
   ========================================================================= */
const gy = (x, z, o = 0) => groundY(x, z) + o;
const SY = GEO.SYNTH, RR = GEO.R, PP_ = GEO.P, CH = GEO.CHAI;
const SHOTS = [
  [ // 1 Enter the Ring — procession up the lamp-lit steps into the glowing portal
    (rt) => ({ p: [-85 + 1.5 * Math.sin(rt * .03), FORE_H + 1.7, 8.6], l: [-47, HP + 6.4, -1], fov: 50, name: 'Ascent' }),
    (rt) => ({ p: [-22, HP + 2.4, 10 + 2 * Math.sin(rt * .04)], l: [-47, HP + 5.6, 0], fov: 50, name: 'Through the portal', dof: 1.3 }),
    // from the top of the steps, back down at the torches climbing out of the afterglow
    (rt, h, st = 0) => ({ p: [-50.5, HP + 2.3, -2.6 + .8 * Math.sin(rt * .05)], l: [-86, FORE_H + 1.2, 1.5], fov: 44, name: 'Procession', dof: 1.4, fd: 9 + 5 * ease((st - 4) / 10) }),
    (rt) => ({ p: [-88 + 8 * Math.sin(rt * .02), HP + 30, 56], l: [-44, HP + 3, 0], fov: 50, name: 'Canopy' }),
  ],
  [ // 2 The Gathering — the swirling red mehfil around the ring stage
    (rt) => { const a = rt * .03 + .6; return { p: [Math.cos(a) * 36, HP + 27, Math.sin(a) * 36], l: [0, HP + 1, 0], fov: 50, name: 'Mehfil' }; },
    (rt) => { const a = rt * .055; return { p: [Math.cos(a) * 21.5, HP + 1.7, Math.sin(a) * 21.5], l: [Math.cos(a + 1) * 9, HP + 1.8, Math.sin(a + 1) * 9], fov: 62, name: 'In the orbit', dof: 1.8, fd: 13 }; },
    // rack focus: the DJ's hands, then the floor behind, then back
    (rt, h, st = 0) => ({ p: [3.2 + Math.sin(rt * .1) * .6, HP + 2.3, 5.4], l: [0, HP + 1.6, -.3], fov: 44, name: 'Booth', dof: 2.8, fd: 6.2 + 7 * (ease((st - 6) / 2.5) - ease((st - 14) / 2.5)) }),
  ],
  [ // 3 Eclipse — the dark wheel over the stone circle
    (rt) => ({ p: [RR.x - 17, RH + 3, RR.z + 7 + 1.5 * Math.sin(rt * .03)], l: [RR.x + 40, RH + 16, RR.z - 4], fov: 66, name: 'Under the ring' }),
    (rt) => { const a = rt * .045; return { p: [RR.x + Math.cos(a) * 19.5, RH + 1.8, RR.z + Math.sin(a) * 19.5], l: [RR.x, RH + 2.6, RR.z], fov: 56, name: 'Among the stones', dof: 1.3 }; },
    (rt) => ({ p: [10, HP + 22, 16], l: [RR.x + 20, RH + 18, RR.z - 4], fov: 46, name: 'From the clearing' }),
  ],
  [ // 4 Brahma Muhurta — star wheel, sleepers, one figure at the synth
    (rt) => ({ p: [RR.x + 1, RH + 1.45, RR.z + 10], l: [RR.x - 3, RH + 16, RR.z - 40], fov: 64, name: 'Star wheel' }),
    (rt) => ({ p: [RR.x - 30 + 3 * Math.sin(rt * .02), RH + 5, RR.z + 24], l: [-120, 6, -130], fov: 46, name: 'Valley mist' }),
    (rt) => ({ p: [SY.x + 2.3, gy(SY.x, SY.z) + 1.35, SY.z + 1.7], l: [SY.x, gy(SY.x, SY.z) + .95, SY.z - .5], fov: 40, name: 'Synth', dof: 3.2 }),
    // the torch-bearers at the eastern edge, waiting for first light (only once they're there)
    (rt, h) => (h !== undefined && h < 5.62) ? null : ({ p: [RR.x - 1 + Math.sin(rt * .04), RH + 1.65, RR.z + 5], l: [RR.x + 60, RH + 5, RR.z - 6], fov: 52, name: 'First light', dof: 1.2, fd: 11 }),
  ],
  [ // 5 Diamond Ring — arms up under the white-gold arches; the flash
    (rt) => ({ p: [3, HP + 1.35, 23], l: [16, HP + 11, -6], fov: 74, name: 'Arms up' }),
    (rt) => { const a = rt * .025; return { p: [Math.cos(a) * 48, HP + 44, Math.sin(a) * 48], l: [0, HP + 10, 0], fov: 48, name: 'Crown' }; },
    (rt) => ({ p: [RR.x + 16, RH + 4.5, RR.z + 3], l: [RR.x + 120, RH + 12, RR.z], fov: 56, name: 'Diamond' }),
  ],
  [ // 6 Dispersal — chai on the pavement, autos, the pillar with the ring
    (rt, h, st = 0) => ({ p: [CH.x - .1, 1.1, CH.z + .95], l: [PP_.x + 2, 3.2, PP_.z], fov: 44, name: 'Chai', dof: 3, fd: .75 + 7 * (ease((st - 7) / 3) - ease((st - 15) / 3)) }),
    (rt) => ({ p: [15, 15, 57], l: [2, 3, 88], fov: 48, name: 'Down the road' }),
    (rt) => { const s = (rt * 1.3) % 90; return { p: [-80 + s, 1.7, PP_.z + 6.7], l: [-60 + s, 1.6, PP_.z + 4.6], fov: 55, name: 'Street', dof: 1.2, fd: 9, cutKey: Math.floor(rt * 1.3 / 90) }; },
  ],
  [ // 7 Zero Shadow — straight down on the great wheel
    (rt) => { const a = rt * .008; return { p: [PP_.x + 9 * Math.cos(a), 80, PP_.z + 9 * Math.sin(a) + .01], l: [PP_.x + 9 * Math.cos(a), 0, PP_.z + 9 * Math.sin(a)], fov: 30, name: 'Mandala' }; },
    (rt) => { const a = -rt * .05; return { p: [PP_.x + Math.cos(a) * 27.5, 1.6, PP_.z + Math.sin(a) * 27.5], l: [PP_.x, 1.4, PP_.z], fov: 55, name: 'Pradakshina', dof: 1.3 }; },
    (rt) => ({ p: [PP_.x - 42, 27, PP_.z - 40], l: [PP_.x, 0, PP_.z], fov: 44, name: 'Rooftop' }),
  ],
  [ // 8 Return — carriers climbing with the pieces; the ring rebuilt
    (rt) => ({ p: [-82, FORE_H + 5, 15], l: [-47, HP + 6.8, 0], fov: 46, name: 'Rebuilding' }),
    null, // follow a carrier (filled at runtime)
    (rt) => ({ p: [-132, 28, 104], l: [-78, 3, 46], fov: 44, name: 'Hillside' }),
    // late light: from the gate, west down the steps into the low sun, the crowd and the leaves backlit
    (rt, h) => (h !== undefined && h < 16.7) ? null : ({ p: [-52.5, HP + 1.45, 3.6 + .5 * Math.sin(rt * .04)], l: [-98, FORE_H + 6, -5], fov: 48, name: 'Into the sun', dof: 1, fd: 30 }),
  ],
];

function buildCamera(renderer, Q) {
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 4000);
  cam.position.set(-103, FORE_H + 1.9, 6.5); cam.lookAt(-47, HP + 8, 0);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = .08; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 3; controls.maxDistance = 420;
  return { cam, controls, vel: V3(), lvel: V3(), pos: cam.position.clone(), look: V3(-47, HP + 8, 0), fov: 50, desiredP: V3(), desiredL: V3(), chapter: -1, chapterRt: 0, shot: -1, cutKey: null, follow: 1 + NCARRY + 5, lastMode: 'director', dofK: 0, dofF: 10 };
}
const _cp = V3(), _cl = V3();
// critically damped spring (exact for any dt): the camera eases out of rest and into its mark with no jolt in velocity, the way a
// weighted head on a crane moves, instead of jumping to full speed the moment a shot's target changes
function springTo(x, v, target, w, dt) {
  const e = Math.exp(-w * dt);
  for (const k of ['x', 'y', 'z']) { const d = x[k] - target[k], t = (v[k] + w * d) * dt; v[k] = (v[k] - w * t) * e; x[k] = target[k] + (d + t) * e; }
}
function followShot(W, i, rt) {
  const D = W.D, x = D.x[i], z = D.z[i], y = D.y[i], yaw = D.yaw[i];
  const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
  return { p: [x + bx * 5.5 + bz * 1.2, y + 2.3, z + bz * 5.5 - bx * 1.2], l: [x - bx * 4, y + 1.3, z - bz * 4], fov: 55, name: 'Follow', dof: 1.8, fd: 5.7 };
}
function updateCamera(CAM, W, dt, rt, t) {
  const cam = CAM.cam, mode = PARAM.camera;
  const ch = chapterAt(t);
  if (mode !== CAM.lastMode) {
    CAM.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') { CAM.controls.target.copy(CAM.look); CAM.controls.update(); }
    CAM.lastMode = mode; CAM.shot = -1;
  }
  if (mode === 'orbit') { CAM.controls.update(); CAM.look.copy(CAM.controls.target); CAM.pos.copy(cam.position); S.focus.copy(CAM.controls.target); S.camPos.copy(cam.position); CAM.flight = null; CAM.dofK = 0; return; }
  if (ch !== CAM.chapter) { CAM.chapter = ch; CAM.chapterRt = rt; }
  let shot, snap = false;
  if (!CAM.booted) { snap = true; CAM.booted = true; }
  if (mode === 'director') {
    const list = SHOTS[ch];
    let idx = Math.floor((rt - CAM.chapterRt) / PARAM.shotLen) % list.length;
    const h = wrap24(t);
    if (ch === 4 && h > 6.3 && h < 7.05) idx = 2;                  // hold on the diamond flash
    // a shot can sit out when its moment hasn't come (it returns null): take the next one that's ready
    let j = idx;
    for (let k = 0; k < list.length; k++) { j = (idx + k) % list.length; if (!list[j] || list[j](rt, h, 0) !== null) break; }
    if (j !== CAM.shot) { if (PARAM.cut) snap = true; CAM.shot = j; CAM.shotRt = rt; }
    shot = list[j] ? list[j](rt, h, rt - CAM.shotRt) : followShot(W, 1 + (Math.floor(rt / 30) % NCARRY), rt);
    if (shot.cutKey !== undefined && shot.cutKey !== CAM.cutKey) { if (CAM.cutKey !== null) snap = true; CAM.cutKey = shot.cutKey; }
  } else if (mode === 'follow') {
    const i = CAM.follow; if (W.D.hide[i] > .5 || i >= PARAM.population) CAM.follow = 1 + Math.floor(Math.random() * Math.min(PARAM.population - 1, NMAX - 1));
    shot = followShot(W, CAM.follow, rt);
  } else { // top
    const f = [[-60, 0], [0, 0], [RR.x, RR.z], [RR.x - 4, RR.z + 2], [0, 0], [PP_.x, PP_.z - 10], [PP_.x, PP_.z], [-70, 40]][ch];
    const a = rt * .01; shot = { p: [f[0] + Math.cos(a) * .01, 120, f[1] + Math.sin(a) * .01 + .01], l: [f[0], 0, f[1]], fov: 40 };
  }
  CAM.desiredP.set(shot.p[0], shot.p[1], shot.p[2]); CAM.desiredL.set(shot.l[0], shot.l[1], shot.l[2]);
  const gmin = groundY(CAM.desiredP.x, CAM.desiredP.z) + .9; if (CAM.desiredP.y < gmin) CAM.desiredP.y = gmin;
  const jump = CAM.pos.distanceTo(CAM.desiredP);
  CAM.snapped = snap;
  if (snap) { CAM.flight = null; CAM.vel.set(0, 0, 0); CAM.lvel.set(0, 0, 0); }
  else if (!CAM.flight && jump > 55) {
    // crane flight: arc up over the canopy instead of gliding through hills and trees
    let top = Math.max(CAM.pos.y, CAM.desiredP.y);
    for (let k = 1; k < 8; k++) { const f = k / 8; top = Math.max(top, groundY(lerp(CAM.pos.x, CAM.desiredP.x, f), lerp(CAM.pos.z, CAM.desiredP.z, f)) + 26); }
    CAM.vel.set(0, 0, 0); CAM.lvel.set(0, 0, 0);
    CAM.flight = { p0: CAM.pos.clone(), l0: CAM.look.clone(), f0: CAM.fov, t0: rt, dur: clamp(2.6 + jump / 75, 3, 7.5), top: top + jump * .12 };
  }
  if (CAM.flight) {
    const F = CAM.flight, f = clamp((rt - F.t0) / F.dur, 0, 1), e = easeIO(f), ie = 1 - e;
    const cx = (F.p0.x + CAM.desiredP.x) / 2, cz = (F.p0.z + CAM.desiredP.z) / 2;
    CAM.pos.set(ie * ie * F.p0.x + 2 * ie * e * cx + e * e * CAM.desiredP.x, ie * ie * F.p0.y + 2 * ie * e * F.top + e * e * CAM.desiredP.y, ie * ie * F.p0.z + 2 * ie * e * cz + e * e * CAM.desiredP.z);
    const el = easeIO(clamp(f * 1.25 - .1, 0, 1));
    CAM.look.copy(F.l0).lerp(CAM.desiredL, el); CAM.fov = lerp(F.f0, shot.fov, el);
    if (f >= 1) CAM.flight = null;
  } else {
    const k = snap ? 1 : 1 - Math.exp(-dt * (mode === 'follow' ? 3 : .85));
    // spring rates are 2x the old ease rates: the same steady lag behind a moving mark, so shots keep their framing
    if (snap) { CAM.pos.copy(CAM.desiredP); CAM.look.copy(CAM.desiredL); }
    else { const w = mode === 'follow' ? 6 : 1.7; springTo(CAM.pos, CAM.vel, CAM.desiredP, w, dt); springTo(CAM.look, CAM.lvel, CAM.desiredL, w * 1.2, dt); }
    CAM.fov = lerp(CAM.fov, shot.fov, k);
  }
  const gnow = groundY(CAM.pos.x, CAM.pos.z) + .7; if (CAM.pos.y < gnow) CAM.pos.y = gnow;
  cam.position.copy(CAM.pos); cam.lookAt(CAM.look);
  if (Math.abs(cam.fov - CAM.fov) > .01) { cam.fov = CAM.fov; cam.updateProjectionMatrix(); }
  const hx = CAM.look.x - CAM.pos.x, hz = CAM.look.z - CAM.pos.z, hd = Math.hypot(hx, hz) || 1, fd = Math.min(38, hd);
  const fx = CAM.pos.x + hx / hd * fd, fz = CAM.pos.z + hz / hd * fd;
  S.focus.set(fx, groundY(fx, fz), fz);
  CAM.shotName = shot.name || '';
  CAM.dofK = CAM.flight ? 0 : (shot.dof || 0);
  CAM.dofF = shot.fd || Math.hypot(shot.l[0] - shot.p[0], shot.l[1] - shot.p[1], shot.l[2] - shot.p[2]);
  S.camPos.copy(cam.position);
}
