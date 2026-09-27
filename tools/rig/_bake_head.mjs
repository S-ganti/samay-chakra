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

function djArms(L, t) {
  const w = Math.sin(t * 5.03) * .12, w2 = Math.sin(t * 3.7 + 1) * .1;
  for (const [n, k] of [['spine.002', .4], ['spine.003', .5]]) L[B(n)].r.slerp(rest[keptNode[B(n)]].r, k);
  aim(L, B('upper_arm.L'), new THREE.Vector3(.3, -.78, .55)); aim(L, B('forearm.L'), new THREE.Vector3(-.1 + w, -.45, .9));
  aim(L, B('upper_arm.R'), new THREE.Vector3(-.3, -.78, .55)); aim(L, B('forearm.R'), new THREE.Vector3(.1 + w2, -.4, .9));
}

export { sampleClip, fk, anim, B };
