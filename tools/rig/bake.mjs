// Bake the CC0 Quaternius Universal Animation Library into a compact crowd rig:
// 23-bone skeleton, decimated body LODs with region ids, and resampled clips (int16 quaternions).
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';

const g = JSON.parse(fs.readFileSync(new URL('./AnimationLibrary_Godot_Standard.gltf', import.meta.url), 'utf8'));
const binB = fs.readFileSync(new URL('./AnimationLibrary_Godot_Standard.bin', import.meta.url));
const bin = binB.buffer.slice(binB.byteOffset, binB.byteOffset + binB.length);
const CT = { 5126: Float32Array, 5123: Uint16Array, 5121: Uint8Array, 5125: Uint32Array, 5122: Int16Array, 5120: Int8Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function acc(i) {
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView], C = CT[a.componentType], n = NC[a.type];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0), es = C.BYTES_PER_ELEMENT, stride = bv.byteStride || n * es;
  const out = new C(a.count * n);
  const dv = new DataView(bin);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
    const p = off + k * stride + c * es;
    out[k * n + c] = C === Float32Array ? dv.getFloat32(p, true) : C === Uint16Array ? dv.getUint16(p, true) : C === Uint8Array ? dv.getUint8(p) : C === Uint32Array ? dv.getUint32(p, true) : C === Int16Array ? dv.getInt16(p, true) : dv.getInt8(p);
  }
  if (a.normalized && C !== Float32Array) { const f = new Float32Array(out.length), m = C === Uint8Array ? 255 : C === Uint16Array ? 65535 : C === Int16Array ? 32767 : 127; for (let k = 0; k < out.length; k++) f[k] = Math.max(out[k] / m, -1); return f; }
  return out;
}

/* ---------- skeleton ---------- */
const nodes = g.nodes, skin = g.skins[0];
const parent = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
const rest = nodes.map(n => ({ t: new THREE.Vector3(...(n.translation || [0, 0, 0])), r: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), s: new THREE.Vector3(...(n.scale || [1, 1, 1])) }));
const jointNodes = skin.joints;                            // 53 node indices
const jointName = jointNodes.map(j => nodes[j].name.replace('DEF-', ''));
const ibm = acc(skin.inverseBindMatrices);
// keep 23 bones: fold fingers into hands
const KEEP = ['root', 'hips', 'spine.001', 'spine.002', 'spine.003', 'neck', 'head', 'shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L', 'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'foot.L', 'toe.L', 'thigh.R', 'shin.R', 'foot.R', 'toe.R'];
const keepIdx = KEEP.map(n => jointName.indexOf(n));
if (keepIdx.some(i => i < 0)) throw new Error('missing bone ' + KEEP[keepIdx.indexOf(-1)]);
const remap = jointName.map((n, j) => { const k = KEEP.indexOf(n); if (k >= 0) return k; if (/\.L$/.test(n)) return KEEP.indexOf('hand.L'); if (/\.R$/.test(n)) return KEEP.indexOf('hand.R'); throw new Error('unmapped ' + n); });
// parents in the reduced skeleton (the nearest kept ancestor)
const keptNode = keepIdx.map(j => jointNodes[j]);
const bParent = keptNode.map(nd => { let p = parent[nd]; while (p >= 0 && !keptNode.includes(p)) p = parent[p]; return keptNode.indexOf(p); });
// every node from the scene root down to each kept joint (so non-joint ancestors like "Rig" and "root" transforms apply)
function worldOf(nodeIdx, local) { const chain = []; for (let p = nodeIdx; p >= 0; p = parent[p]) chain.unshift(p); const m = new THREE.Matrix4(); for (const c of chain) m.multiply(local[c]); return m; }

/* ---------- mesh: M_Main (+ joint caps), welded ---------- */
const prims = g.meshes[0].primitives;
const P = [], NRM = [], JI = [], JW = [], IDX = [], PART = [];
prims.forEach((pr, part) => {
  const pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL), ji = acc(pr.attributes.JOINTS_0), jw = acc(pr.attributes.WEIGHTS_0), ind = acc(pr.indices);
  const base = P.length / 3, map = new Map(), local = [];
  const n = pos.length / 3;
  for (let k = 0; k < n; k++) {
    const key = `${pos[k * 3].toFixed(5)},${pos[k * 3 + 1].toFixed(5)},${pos[k * 3 + 2].toFixed(5)}`;
    if (map.has(key)) { local.push(map.get(key)); continue; }
    const v = P.length / 3; map.set(key, v); local.push(v);
    P.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); NRM.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
    // fold weights to the 23 bones
    const w = new Array(23).fill(0); for (let c = 0; c < 4; c++) w[remap[ji[k * 4 + c]]] += jw[k * 4 + c];
    JW.push(w); PART.push(part);
  }
  for (let k = 0; k < ind.length; k++) IDX.push(local[ind[k]]);
});
console.log('welded verts', P.length / 3, 'tris', IDX.length / 3);

/* ---------- bind pose joint positions (world) ---------- */
const restLocal = nodes.map((n, i) => new THREE.Matrix4().compose(rest[i].t, rest[i].r, rest[i].s));
const bindWorld = keptNode.map(nd => worldOf(nd, restLocal));
const jp = bindWorld.map(m => new THREE.Vector3().setFromMatrixPosition(m));
KEEP.forEach((n, k) => console.log(n.padEnd(12), jp[k].toArray().map(v => v.toFixed(3)).join(' ')));
// verify: invBind × bindWorld ≈ identity for kept bones
{ const m = new THREE.Matrix4().fromArray(ibm, keepIdx[1] * 16).premultiply(bindWorld[1]); console.log('hips check', m.elements.map(v => v.toFixed(3)).join(' ')); }

fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('./out/rig_debug.json', import.meta.url), JSON.stringify({ KEEP, bParent, jp: jp.map(v => v.toArray()) }));
export { g, acc, nodes, parent, rest, keepIdx, keptNode, bParent, worldOf, restLocal, ibm, P, NRM, JW, IDX, PART, jp, KEEP, jointName };

/* ---------- clip sampling ---------- */
function sampler(anim, s) {
  const sm = anim.samplers[s];
  return { t: acc(sm.input), v: acc(sm.output), interp: sm.interpolation || 'LINEAR' };
}
function evalChannel(S, path, time, out) {
  const T = S.t, n = T.length, w = path === 'rotation' ? 4 : 3;
  if (time <= T[0] || n === 1) { for (let c = 0; c < w; c++) out[c] = S.v[c]; return out; }
  if (time >= T[n - 1]) { for (let c = 0; c < w; c++) out[c] = S.v[(n - 1) * w + c]; return out; }
  let k = 1; while (k < n - 1 && T[k] < time) k++;
  const t0 = T[k - 1], t1 = T[k], f = S.interp === 'STEP' ? 0 : (time - t0) / (t1 - t0);
  if (path === 'rotation') {
    const qa = new THREE.Quaternion().fromArray(S.v, (k - 1) * 4), qb = new THREE.Quaternion().fromArray(S.v, k * 4);
    qa.slerp(qb, f); out[0] = qa.x; out[1] = qa.y; out[2] = qa.z; out[3] = qa.w; return out;
  }
  for (let c = 0; c < w; c++) out[c] = S.v[(k - 1) * w + c] * (1 - f) + S.v[k * w + c] * f;
  return out;
}
// local TRS of every kept bone at time t
function sampleClip(anim, time) {
  const L = keptNode.map(nd => ({ t: rest[nd].t.clone(), r: rest[nd].r.clone(), s: rest[nd].s.clone() }));
  const tmp = [0, 0, 0, 0];
  anim.channels.forEach(ch => {
    const k = keptNode.indexOf(ch.target.node); if (k < 0) return;
    const S = sampler(anim, ch.sampler), v = evalChannel(S, ch.target.path, time, tmp);
    if (ch.target.path === 'rotation') L[k].r.set(v[0], v[1], v[2], v[3]).normalize();
    else if (ch.target.path === 'translation') L[k].t.set(v[0], v[1], v[2]);
    else if (ch.target.path === 'scale') L[k].s.set(v[0], v[1], v[2]);
  });
  return L;
}
// forward kinematics in the reduced skeleton (root's ancestors are identity)
function fk(L) {
  const W = [];
  for (let b = 0; b < KEEP.length; b++) {
    const m = new THREE.Matrix4().compose(L[b].t, L[b].r, L[b].s);
    W[b] = bParent[b] >= 0 ? W[bParent[b]].clone().multiply(m) : m;
  }
  return W;
}
{ // sanity: FK of rest == bindWorld
  const L = keptNode.map(nd => ({ t: rest[nd].t.clone(), r: rest[nd].r.clone(), s: rest[nd].s.clone() }));
  const W = fk(L); let err = 0; W.forEach((m, b) => m.elements.forEach((v, i) => err = Math.max(err, Math.abs(v - bindWorld[b].elements[i])))); console.log('fk rest err', err.toExponential(2));
}
const anim = (name) => g.animations.find(a => a.name === name);
/* ---------- procedural arm overrides (arms up / carrying) ---------- */
const Y = new THREE.Vector3(0, 1, 0);
function worldRots(L) { const R = []; for (let b = 0; b < KEEP.length; b++) R[b] = bParent[b] >= 0 ? R[bParent[b]].clone().multiply(L[b].r) : L[b].r.clone(); return R; }
// aim bone b so its +Y axis points along world direction d (keeps twist minimal), then re-derive children via FK
function aim(L, b, d, amt = 1) {
  const R = worldRots(L), cur = Y.clone().applyQuaternion(R[b]);
  const q = new THREE.Quaternion().setFromUnitVectors(cur, d.clone().normalize());
  const target = q.multiply(R[b]);                                 // desired world rotation
  const pw = bParent[b] >= 0 ? R[bParent[b]] : new THREE.Quaternion();
  const local = pw.clone().invert().multiply(target);
  L[b].r.slerp(local, amt);
}
const B = (n) => KEEP.indexOf(n);
function armsUp(L, t) {
  const sway = Math.sin(t * 2.4) * .08, sw2 = Math.sin(t * 2.4 + 1.3) * .06;
  aim(L, B('upper_arm.L'), new THREE.Vector3(.42 + sway, .9, .12)); aim(L, B('forearm.L'), new THREE.Vector3(.2 + sway, 1, .22));
  aim(L, B('upper_arm.R'), new THREE.Vector3(-.42 + sw2, .9, .12)); aim(L, B('forearm.R'), new THREE.Vector3(-.2 + sw2, 1, .22));
}
function carry(L) {
  // square the shoulders first so the idle's spine twist doesn't skew the hold
  for (const [n, k] of [['hips', .7], ['spine.001', .6], ['spine.002', .7], ['spine.003', .7]]) L[B(n)].r.slerp(rest[keptNode[B(n)]].r, k);
  aim(L, B('upper_arm.L'), new THREE.Vector3(.16, -.8, .58)); aim(L, B('forearm.L'), new THREE.Vector3(-.32, -.02, .95));
  aim(L, B('upper_arm.R'), new THREE.Vector3(-.16, -.8, .58)); aim(L, B('forearm.R'), new THREE.Vector3(.32, -.02, .95));
}

// pogo: the rave jump, one hop per beat (two per cycle), feet planted by two-bone IK while on the ground
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function legIK(L, side, ankle, knee, lift) {
  const th = B('thigh' + side), sn = B('shin' + side), ft = B('foot' + side), to = B('toe' + side);
  const W = fk(L), J = new THREE.Vector3().setFromMatrixPosition(W[th]);
  const a = .400, b = .429, D = ankle.clone().sub(J), d = Math.min(Math.max(D.length(), .25), a + b - .004);
  const u = D.normalize(), fwd = knee.clone().addScaledVector(u, -knee.dot(u)).normalize();
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const K = J.clone().addScaledVector(u, a * ca).addScaledVector(fwd, a * sa), A = J.clone().addScaledVector(u, d);
  aim(L, th, K.clone().sub(J)); aim(L, sn, A.clone().sub(K));
  aim(L, ft, V(0, -.5 - lift * 2.2, .86 - lift).normalize()); aim(L, to, V(0, -lift * 2.5, 1).normalize());
}
function pogo(L, t) {
  const hop = (t * 2) % 1, ground = .36;               // t in [0,1): two hops; hop phase 0 = touchdown
  const dip = hop < ground ? -.075 * Math.sin(Math.PI * hop / ground) : 0;
  const air = hop >= ground ? .12 * Math.sin(Math.PI * (hop - ground) / (1 - ground)) : 0;
  // square up the idle's weight shift so both feet share the load
  for (const [n, k] of [['hips', .85], ['spine.001', .6], ['spine.002', .5], ['spine.003', .5], ['neck', .4]]) L[B(n)].r.slerp(rest[keptNode[B(n)]].r, k);
  const H = L[B('hips')].t; H.z = .877 + dip + air; H.x = 0; H.y = .06;
  // lean into the landing, nod with it
  const lean = -dip * 2.2 + .04;
  L[B('spine.001')].r.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), lean * .6));
  L[B('neck')].r.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), lean * .8));
  const lift = air > 0 ? air * .9 : 0;
  for (const [side, sx] of [['.L', .115], ['.R', -.115]]) legIK(L, side, V(sx, .103 + lift, -.02), V(sx * .6, 0, 1), lift);
  // arms up in a V, fists pumping on the landing
  const pump = .5 + .5 * Math.cos(TWO_PI * (hop - .12));
  for (const [side, sx] of [['.L', 1], ['.R', -1]]) {
    aim(L, B('upper_arm' + side), V(sx * (.5 - .08 * pump), .86, .12 + .12 * pump));
    aim(L, B('forearm' + side), V(sx * (.22 - .1 * pump), .98 - .5 * pump, .2 + .6 * pump));
  }
}
const TWO_PI = Math.PI * 2;
// hold a torch out in front while walking: the left arm from the torch idle, the rest of the gait untouched
let torchL = null;
function torchArm(L) {
  if (!torchL) torchL = sampleClip(anim('Idle_Torch_Loop'), .4);
  for (const n of ['shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L']) L[B(n)].r.copy(torchL[B(n)].r);
}
function djArms(L, t) {
  const w = Math.sin(t * 5.03) * .12, w2 = Math.sin(t * 3.7 + 1) * .1;
  for (const [n, k] of [['spine.002', .4], ['spine.003', .5]]) L[B(n)].r.slerp(rest[keptNode[B(n)]].r, k);
  aim(L, B('upper_arm.L'), new THREE.Vector3(.3, -.78, .55)); aim(L, B('forearm.L'), new THREE.Vector3(-.1 + w, -.45, .9));
  aim(L, B('upper_arm.R'), new THREE.Vector3(-.3, -.78, .55)); aim(L, B('forearm.R'), new THREE.Vector3(.1 + w2, -.4, .9));
}
/* ---------- clip table ---------- */
const FPS = 24;
const CLIPS = [
  ['idle', 'Idle_Loop'], ['talk', 'Idle_Talking_Loop'], ['walk', 'Walk_Loop'], ['walkF', 'Walk_Formal_Loop'], ['jog', 'Jog_Fwd_Loop'],
  ['dance', 'Dance_Loop'], ['jump', 'Idle_Loop', { mod: pogo, dur: 1, baseT: 0 }], ['spell', 'Spell_Simple_Idle_Loop'], ['torch', 'Idle_Torch_Loop'],
  ['sit', 'Sitting_Idle_Loop'], ['sitTalk', 'Sitting_Talking_Loop'], ['crouch', 'Crouch_Idle_Loop'], ['dj', 'Idle_Loop', { mod: djArms }],
  ['sleep', 'Death01', { still: 1 }], ['armsUp', 'Idle_Loop', { mod: armsUp }], ['carryWalk', 'Walk_Loop', { mod: carry }], ['carryIdle', 'Idle_Loop', { mod: carry }],
  ['sprint', 'Sprint_Loop'], ['carryJog', 'Jog_Fwd_Loop', { mod: carry }], ['torchWalk', 'Walk_Loop', { mod: torchArm }], ['torchJog', 'Jog_Fwd_Loop', { mod: torchArm }],
];
// natural ground speed of an in-place locomotion loop: how fast a planted foot slides backwards under the hips
function gait(a, dur) {
  const N = 240, fy = [], fz = [];
  for (let f = 0; f <= N; f++) { const W = fk(sampleClip(a, dur * f / N)); for (const n of ['toe.L', 'toe.R']) { const p = new THREE.Vector3().setFromMatrixPosition(W[B(n)]); (fy[f] = fy[f] || {})[n] = p.y; (fz[f] = fz[f] || {})[n] = p.z; } }
  let sum = 0, cnt = 0;
  for (const n of ['toe.L', 'toe.R']) {
    let lo = Infinity; for (let f = 0; f <= N; f++) lo = Math.min(lo, fy[f][n]);
    for (let f = 0; f < N; f++) if (fy[f][n] < lo + .012 && fy[f + 1][n] < lo + .012) { sum += (fz[f + 1][n] - fz[f][n]) / (dur / N); cnt++; }
  }
  const v = Math.abs(sum / Math.max(1, cnt));
  return { speed: v, stride: v * dur, stance: cnt / (2 * N) };
}
const clipDur = (a) => Math.max(...a.samplers.map(s => g.accessors[s.input].max[0]));
const out = { fps: FPS, bones: KEEP, parent: bParent, restT: [], restR: [], invBind: [], clips: [] };
keptNode.forEach((nd, b) => { out.restT.push(...rest[nd].t.toArray()); out.restR.push(...rest[nd].r.toArray()); out.invBind.push(...Array.from(ibm.slice(keepIdx[b] * 16, keepIdx[b] * 16 + 16))); });
const qbuf = [], hbuf = [];
let row = 0;
for (const [name, src, opt = {}] of CLIPS) {
  const a = anim(src), dur = opt.dur || clipDur(a);
  const n = opt.still ? 1 : Math.max(1, Math.round(dur * FPS));
  const clip = { name, n, dur: opt.still ? 0 : dur, row, rootT: [0, 0, 0] };
  for (let f = 0; f < n; f++) {
    const t = opt.still ? dur : f / FPS;
    const L = sampleClip(a, opt.baseT !== undefined ? opt.baseT : t);
    if (opt.mod) opt.mod(L, t);
    if (opt.still) { // recentre the lying body over the origin
      const W = fk(L), hp = new THREE.Vector3().setFromMatrixPosition(W[B('hips')]);
      const hd = new THREE.Vector3().setFromMatrixPosition(W[B('head')]);
      const c = hp.clone().lerp(hd, .35); clip.rootT = [-c.x, 0, -c.z];
    }
    // bones 1..22 as 3 int16 (x,y,z with w>=0), hips translation in mm
    for (let b = 1; b < KEEP.length; b++) { const q = L[b].r.clone(); if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w); qbuf.push(Math.round(q.x * 32767), Math.round(q.y * 32767), Math.round(q.z * 32767)); }
    const ht = L[B('hips')].t; hbuf.push(Math.round(ht.x * 1000), Math.round(ht.y * 1000), Math.round(ht.z * 1000));
  }
  if (/walk|jog|sprint|Walk|Jog/.test(name)) { const G = gait(a, dur); clip.stride = +G.stride.toFixed(3); console.log('  gait', name, 'speed', G.speed.toFixed(2), 'm/s stride', G.stride.toFixed(2), 'm stance', G.stance.toFixed(2)); }
  row += n; out.clips.push(clip);
  console.log(name.padEnd(10), 'frames', String(n).padStart(3), 'dur', dur.toFixed(2));
}
const q16 = Int16Array.from(qbuf), h16 = Int16Array.from(hbuf);
out.q = Buffer.from(q16.buffer).toString('base64'); out.h = Buffer.from(h16.buffer).toString('base64');
out.frames = row;
fs.writeFileSync(new URL('./out/rig.json', import.meta.url), JSON.stringify(out));
console.log('frames', row, 'q bytes', q16.byteLength, 'h bytes', h16.byteLength, 'json', fs.statSync(new URL('./out/rig.json', import.meta.url)).size);
// where the carry pose puts the hands (for the carried panels)
{ const L = sampleClip(anim('Idle_Loop'), 0); carry(L); const W = fk(L); for (const n of ['hand.L', 'hand.R']) console.log('carry', n, new THREE.Vector3().setFromMatrixPosition(W[B(n)]).toArray().map(v => v.toFixed(3)).join(' ')); }
{ const L = sampleClip(anim('Idle_Loop'), 0); armsUp(L, 0); const W = fk(L); for (const n of ['hand.L', 'hand.R']) console.log('armsUp', n, new THREE.Vector3().setFromMatrixPosition(W[B(n)]).toArray().map(v => v.toFixed(3)).join(' ')); }
{ const L = sampleClip(anim('Idle_Loop'), 0); djArms(L, 0); const W = fk(L); for (const n of ['hand.L', 'hand.R']) console.log('dj', n, new THREE.Vector3().setFromMatrixPosition(W[B(n)]).toArray().map(v => v.toFixed(3)).join(' ')); }
// write the embeddable source file
fs.writeFileSync(new URL('../../src/world/47_rigdata.js', import.meta.url), '/* Crowd rig: CC0 Universal Animation Library by Quaternius (quaternius.com), 23 bones, clips resampled to ' + FPS + ' fps */\nconst RIG_DATA = ' + JSON.stringify(out) + ';\n');
console.log('wrote src/world/47_rigdata.js', fs.statSync(new URL('../../src/world/47_rigdata.js', import.meta.url)).size);
