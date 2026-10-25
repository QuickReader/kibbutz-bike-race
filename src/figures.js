// Characters, bikes and props built from outlined toon solids. Characters are Rigs (bones + one skinned mesh pair),
// props are static Batches. Lifted from preview.html and reworked so each actor is 2 draw calls.
import * as THREE from 'three';
import { Batch, G } from './toon.js';

const Y = new THREE.Vector3(0, 1, 0), V = (x, y, z) => new THREE.Vector3(x, y, z);
const HIP = 0.86, L1 = 0.4, L2 = 0.4;

// thin cylinder between two points (unit-height primitive, stretched)
function tube(rig, bone, a, b, r, color) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  rig.solid(bone, G.cyl(r, 1, 8), color, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, sy: len, q: new THREE.Quaternion().setFromUnitVectors(Y, d.divideScalar(len)), thin: true });
}

/* ---------- people ---------- */
const MOUTH = new THREE.TorusGeometry(0.045, 0.009, 6, 14, Math.PI).toNonIndexed();
export function person(rig, parent, { skin, shirt, pants, shoe = 0xFFFFFF, hair = 0x3A2A1A, style = 'short', shorts = false, stripe = 0, helmet = 0, cheek = 0xF08A7E, bang = false }) {
  const B = (p, x, y, z) => rig.bone(p, x, y, z), S = (b, g, c, o) => rig.solid(b, g, c, o);
  const root = B(parent), hip = B(root, 0, HIP, 0), upper = B(hip), head = B(upper, 0, 0.79, 0);
  S(hip, G.sphere(0.17, 14, 10), pants, { sy: 0.75, sz: 0.85 });
  S(upper, G.caps(0.17, 0.2), shirt, { y: 0.27, sz: 0.74 });
  if (stripe) S(upper, G.cyl(0.176, 0.07, 18), stripe, { y: 0.3, sz: 0.76, outline: false });
  S(upper, G.cyl(0.06, 0.12, 10), skin, { y: 0.58, thin: true });
  S(head, G.sphere(0.2, 16, 10), skin, { sy: 1.04 });
  for (const s of [-1, 1]) {
    S(head, G.sphere(0.045), skin, { x: s * 0.2, y: -0.01, thin: true });
    S(head, G.sphere(0.052), 0xFFFFFF, { x: s * 0.075, y: 0.035, z: 0.17, sz: 0.5, thin: true });
    S(head, G.sphere(0.03), 0x1B1622, { x: s * 0.075, y: 0.03, z: 0.2, sz: 0.5, outline: false });
    S(head, G.sphere(0.012), 0xFFFFFF, { x: s * 0.075 + 0.01, y: 0.04, z: 0.216, outline: false });
    S(head, G.sphere(0.034), cheek, { x: s * 0.125, y: -0.05, z: 0.15, sz: 0.4, outline: false });
    S(head, G.caps(0.009, 0.05), 0x2B1D12, { x: s * 0.078, y: 0.098, z: 0.178, ry: 0.25 * s, rz: Math.PI / 2 + 0.12 * s, outline: false });
  }
  S(head, G.sphere(0.034), skin, { y: -0.015, z: 0.2, thin: true });
  S(head, MOUTH, 0x6B2A2A, { y: -0.055, z: 0.19, rx: -0.15, rz: Math.PI, outline: false });
  if (helmet) {
    S(head, G.cap(0.225, 2.0, 16, 10), helmet, { y: 0.005, rx: -0.2 });
    for (const a of [Math.PI / 2, 3 * Math.PI / 2]) S(head, new THREE.SphereGeometry(0.23, 12, 10, a - 0.25, 0.5, 0, 2.0).toNonIndexed(), 0xFF3D2E, { y: 0.005, rx: -0.2, outline: false });
    S(head, G.sphere(0.2, 14, 8), hair, { y: -0.08, z: -0.03, sy: 0.4, sx: 0.9, thin: true });
  } else {
    S(head, G.cap(0.212, style === 'bald' ? 0.5 : 1.85, 16, 10), hair, { y: 0.01, rx: -0.35 });
    S(head, G.sphere(0.07), hair, { x: 0.19, y: 0.04, z: -0.02, sy: 1.3, thin: true });
    S(head, G.sphere(0.07), hair, { x: -0.19, y: 0.04, z: -0.02, sy: 1.3, thin: true });
    if (style === 'pony') { S(head, G.caps(0.065, 0.2), hair, { y: -0.08, z: -0.26 }); S(head, G.sphere(0.05), 0xE8537A, { y: 0.06, z: -0.22, thin: true }); }
    if (style === 'bun') S(head, G.sphere(0.09), hair, { y: 0.22, z: -0.05 });
    if (style === 'long') S(head, G.caps(0.17, 0.2), hair, { y: -0.14, z: -0.1, sz: 0.7 });
    if (style === 'curly') for (const [x, y, z] of [[0, 0.2, 0], [0.13, 0.16, 0.02], [-0.13, 0.16, 0.02], [0, 0.15, -0.14]]) S(head, G.sphere(0.1), hair, { x, y, z });
    if (style === 'cap') S(head, G.cyl(0.19, 0.025, 20), 0x2D6CDF, { y: 0.07, z: 0.17, sz: 0.65, rx: 0.1 });
  }
  const A = [-1, 1].map(s => {
    const sh = B(upper, s * 0.235, 0.47, 0), el = B(sh, 0, -0.3, 0);
    S(sh, G.sphere(0.075), shirt, { thin: true }); S(sh, G.caps(0.062, 0.18), shirt, { y: -0.15, thin: true });
    S(el, G.caps(0.05, 0.17), skin, { y: -0.14, thin: true }); S(el, G.sphere(0.065), skin, { y: -0.31, thin: true });
    return { sh, el };
  });
  const L = [-1, 1].map(s => {
    const hp = B(hip, s * 0.1, 0, 0), kn = B(hp, 0, -L1, 0);
    S(hp, G.caps(0.085, 0.22), pants, { y: -0.2, thin: true });
    S(kn, G.caps(0.065, 0.26), shorts ? skin : pants, { y: -0.2, thin: true });
    S(kn, G.sphere(0.08), shoe, { y: -0.42, z: 0.06, sx: 0.95, sy: 0.6, sz: 1.5, thin: true });
    return { hp, kn };
  });
  let mark = null; // yellow "!" over a stunned walker; parked far below the ground when hidden
  if (bang) {
    mark = B(root, 0, 2.3, 0);
    S(mark, G.caps(0.07, 0.2), 0xFFD23F, { y: 0.1 }); S(mark, G.sphere(0.07), 0xFFD23F, { y: -0.2 });
  }
  return { root, hip, upper, head, A, L, mark };
}

// two-bone IK in the (z,y) plane; `bend` picks the knee/elbow direction
function ik(limb, from, to, l1, l2, bend, parentRot = 0) {
  const dz = to.z - from.z, dy = to.y - from.y;
  const d = Math.min(Math.hypot(dz, dy), l1 + l2 - 0.002), phi = Math.atan2(dz, -dy);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const t1 = phi + bend * a, kz = from.z + l1 * Math.sin(t1), ky = from.y - l1 * Math.cos(t1);
  const t2 = Math.atan2(to.z - kz, -(to.y - ky));
  limb[0].rotation.x = -t1 + parentRot; limb[1].rotation.x = -(t2 - t1);
}

/* ---------- bike (front = +z) ---------- */
const W = 0.37;
export function bike(rig, parent, color, basket) {
  const S = (b, g, c, o) => rig.solid(b, g, c, o), T = (a, b, r, c, bone = parent) => tube(rig, bone, a, b, r, c);
  const wheels = [-0.58, 0.58].map(z => {
    const w = rig.bone(parent, 0, W, z);
    S(w, G.torus(W - 0.03, 0.045, 6, 20), 0x2C2833, { ry: Math.PI / 2 });
    S(w, G.torus(W - 0.07, 0.014, 4, 20), 0xDAD6CC, { ry: Math.PI / 2, outline: false });
    S(w, G.sphere(0.05, 10, 8), 0xDAD6CC, { thin: true });
    for (let i = 0; i < 3; i++) S(w, G.cyl(0.008, 1, 4), 0xDAD6CC, { sy: (W - 0.07) * 2, rx: i * Math.PI / 3, outline: false });
    return w;
  });
  const bb = V(0, 0.36, 0), seat = V(0, 0.98, -0.24), ht = V(0, 0.92, 0.42), htb = V(0, 0.76, 0.47), rh = V(0, W, -0.58), fh = V(0, W, 0.58);
  T(bb, seat, 0.028, color); T(seat.clone().setY(0.88), ht, 0.026, color); T(bb, htb, 0.032, color); T(bb, rh, 0.02, color); T(seat, rh, 0.018, color);
  T(htb, fh, 0.024, 0x5A5560); T(htb, V(0, 1.02, 0.4), 0.026, 0x5A5560); T(V(-0.3, 1.04, 0.38), V(0.3, 1.04, 0.38), 0.022, 0x2C2833);
  for (const s of [-1, 1]) S(parent, G.sphere(0.04, 8, 6), 0x2C2833, { x: s * 0.3, y: 1.04, z: 0.38, sz: 1.6, thin: true });
  S(parent, G.caps(0.05, 0.16), 0x2C2833, { y: 1.0, z: -0.24, sx: 0.9, sy: 0.6, sz: 1.2, rx: Math.PI / 2, thin: true });
  S(parent, G.cyl(0.07, 0.04, 14), 0xDAD6CC, { x: 0.05, y: 0.36, rz: Math.PI / 2, thin: true });
  const crank = rig.bone(parent, 0, 0.36, 0);
  for (const s of [-1, 1]) {
    tube(rig, crank, V(s * 0.1, 0, 0), V(s * 0.1, s * 0.15, 0), 0.015, 0xDAD6CC);
    S(crank, G.box(0.12, 0.025, 0.1), 0x2C2833, { x: s * 0.16, y: s * 0.15, thin: true });
  }
  if (basket) {
    T(V(0, 0.86, -0.3), V(0, 0.92, -0.72), 0.014, 0x5A5560);
    S(parent, G.box(0.34, 0.14, 0.26), 0xFFD23F, { y: 0.98, z: -0.76 });
    S(parent, G.box(0.36, 0.04, 0.28), 0xFF3D2E, { y: 1.07, z: -0.76, thin: true });
  }
  return { crank, wheels };
}

// seat the person on the bike and solve legs/arms for the crank phase (radians)
const hipP = V(0, 1.0, -0.26), grip = { z: 0.38, y: 1.04 };
export function ride(p, bk, phase, lean = 0.55) {
  p.hip.position.copy(hipP);
  p.upper.rotation.x = -lean; p.head.rotation.x = lean * 0.75;
  bk.crank.rotation.x = phase;
  [0, 1].forEach(i => {
    const a = phase + (i ? Math.PI : 0), dir = i ? 1 : -1;
    ik([p.L[i].hp, p.L[i].kn], { z: hipP.z, y: hipP.y }, { z: Math.sin(a) * 0.15 * dir, y: 0.36 + Math.cos(a) * 0.15 * dir + 0.095 }, L1, L2, 1);
  });
  const shoulder = { z: hipP.z + 0.47 * Math.sin(lean), y: hipP.y + 0.47 * Math.cos(lean) };
  [0, 1].forEach(i => ik([p.A[i].sh, p.A[i].el], shoulder, grip, 0.3, 0.3, -1, lean));
}
export function walk(p, t, moving = true) {
  const s = moving ? Math.sin(t) : 0;
  p.L[0].hp.rotation.x = -s * 0.55; p.L[1].hp.rotation.x = s * 0.55;
  p.L[0].kn.rotation.x = Math.max(0, s) * 0.8 + 0.05; p.L[1].kn.rotation.x = Math.max(0, -s) * 0.8 + 0.05;
  p.A[0].sh.rotation.x = s * 0.5; p.A[1].sh.rotation.x = -s * 0.5; p.A[0].el.rotation.x = -0.3; p.A[1].el.rotation.x = -0.3;
  p.hip.position.y = HIP + Math.abs(Math.cos(t)) * 0.03 * (moving ? 1 : 0);
}

/* ---------- props (static batches, built at the origin, placed by the caller) ---------- */
const WALLS = [0xFFF1D6, 0xFBE7B8, 0xE9F1D8], ROOFS = [0xD2573A, 0xC24A32, 0x3F7DB8], TRIMS = [0x4C7A8C, 0x2E8FA3, 0xD2573A];
function gable(w, h, d) { // triangle profile in x/y, extruded along z (ridge runs along z)
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
  g.deleteAttribute('uv'); return g;
}
export function house(v) {
  const b = new Batch(), wall = WALLS[v % 3], trim = TRIMS[v % 3], flat = v % 3 === 1, roof = ROOFS[v % 3];
  b.add(G.box(6, 3, 5), wall, { y: 1.5 }).add(G.box(6.3, 0.25, 5.3), 0xE9E1CF, { y: 0.1 });
  if (flat) {
    b.add(G.box(6.4, 0.3, 5.4), roof, { y: 3.15 });
    for (const [w, d, x, z] of [[6.4, 0.25, 0, 2.58], [6.4, 0.25, 0, -2.58], [0.25, 5.4, 3.08, 0], [0.25, 5.4, -3.08, 0]]) b.add(G.box(w, 0.35, d), 0xE9E1CF, { x, y: 3.45, z });
  } else {
    b.add(gable(7, 2, 5.8), roof, { y: 3 });
    for (let i = 1; i < 4; i++) b.add(G.box(7.1 - i * 1.55, 0.05, 5.9), 0x9D3A26, { y: 3 + i * 0.5 - 0.02, outline: false });
    b.add(G.box(0.8, 1.6, 0.8), 0xD9CDB5, { x: 1.7, y: 4.4, z: -1.2 }).add(G.box(1, 0.2, 1), 0x8E8576, { x: 1.7, y: 5.2, z: -1.2 });
  }
  b.add(G.box(1.1, 2, 0.15), trim, { x: -1.3, y: 1, z: 2.55 }).add(G.cyl(0.55, 0.15, 14), trim, { x: -1.3, y: 2, z: 2.55, rx: Math.PI / 2 })
    .add(G.sphere(0.07, 8, 6), 0xFFD23F, { x: -0.95, y: 1, z: 2.66, thin: true });
  b.add(G.box(1.5, 1.2, 0.15), 0xBFE7F4, { x: 1.3, y: 1.9, z: 2.55 }).add(G.box(0.1, 1.2, 0.2), 0xFFFFFF, { x: 1.3, y: 1.9, z: 2.58, outline: false })
    .add(G.box(1.5, 0.1, 0.2), 0xFFFFFF, { x: 1.3, y: 1.9, z: 2.58, outline: false })
    .add(G.box(0.5, 1.2, 0.12), trim, { x: 0.3, y: 1.9, z: 2.55 }).add(G.box(0.5, 1.2, 0.12), trim, { x: 2.3, y: 1.9, z: 2.55 })
    .add(G.box(1.7, 0.18, 0.4), 0xD9CDB5, { x: 1.3, y: 1.25, z: 2.7 });
  [0xE8537A, 0xFFFFFF, 0xFFD23F].forEach((c, i) => b.add(G.sphere(0.18, 10, 8), c, { x: 0.8 + i * 0.5, y: 1.5, z: 2.7, thin: true }));
  return b.add(G.box(1.6, 0.18, 1.6), 0xD9CDB5, { x: -1.3, y: 0.09, z: 3.3 });
}
const LEAF = new THREE.CapsuleGeometry(0.2, 1.6, 2, 6).toNonIndexed();
export function tree(kind) {
  const b = new Batch();
  if (kind === 0) { // cypress
    b.add(G.cyl(0.18, 0.8, 8), 0x8A6240, { y: 0.4 }).add(G.sphere(1, 10, 8), 0x2F7A45, { y: 3.4, sx: 0.85, sy: 3.1, sz: 0.85 })
      .add(G.sphere(0.7, 8, 6), 0x3E9457, { x: 0.15, y: 2.4, z: 0.5, sy: 1.8, outline: false });
  } else if (kind === 1) { // eucalyptus
    b.add(G.cyl(0.22, 3.4, 8), 0x8A6240, { y: 1.7, rz: 0.08 }).add(G.sphere(1.9, 12, 8), 0x6FB07F, { y: 4.6, sy: 0.9 })
      .add(G.sphere(1.4, 10, 7), 0x7CC08C, { x: 1.4, y: 5.6, z: 0.3 }).add(G.sphere(1.3, 10, 7), 0x5FA070, { x: -1.3, y: 5.2, z: -0.4 });
  } else { // palm: leaning trunk and drooping leaf capsules
    b.add(G.cyl(0.2, 5, 8), 0x8A6240, { y: 2.5, rz: -0.05 });
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; b.add(LEAF, i % 2 ? 0x5FA070 : 0x6FB07F, { x: -0.91 * Math.cos(a), y: 4.68, z: 0.91 * Math.sin(a), sx: 1.5, sz: 0.4, ry: a, rz: 2.0 }); }
  }
  return b;
}
export function tower() {
  const b = new Batch();
  for (const x of [-1, 1]) for (const z of [-1, 1]) tubeB(b, V(x * 2, 0, z * 2), V(x * 1.4, 11, z * 1.4), 0.2, 0xBDB8AE);
  return b.add(G.cyl(2.4, 3.2, 18), 0xF0EADB, { y: 12.6 }).add(G.cone(2.6, 1.6), 0xD04A32, { y: 14.9 })
    .add(G.cyl(2.45, 0.35, 18), 0x2E6F8E, { y: 12.8, outline: false });
}
function tubeB(b, a, c, r, color) {
  const d = new THREE.Vector3().subVectors(c, a), len = d.length();
  b.add(G.cyl(r, 1, 8), color, { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, z: (a.z + c.z) / 2, sy: len, q: new THREE.Quaternion().setFromUnitVectors(Y, d.divideScalar(len)) });
}
export function hall() { // 16 x 4.5 x 9 dining hall, front (porch) toward +z
  const b = new Batch();
  b.add(G.box(16, 4.5, 9), 0xF6E3B8, { y: 2.25 }).add(G.box(17, 0.6, 10), 0xD2573A, { y: 4.8 }).add(G.box(14, 0.5, 8), 0xC24A32, { y: 5.3 })
    .add(G.box(16, 0.3, 3), 0xD2573A, { y: 3.6, z: 5.8 });
  for (const x of [-6, -2, 2, 6]) b.add(G.box(0.5, 3.4, 0.5), 0xFFFFFF, { x, y: 1.7, z: 6.9 });
  b.add(G.box(8, 1.4, 0.3), 0x2E6F8E, { y: 6.35, z: 4.2 });
  return b.add(G.box(1.6, 2.6, 0.2), 0x2E8FA3, { y: 1.3, z: 4.55 });
}
export function arch() { // finish arch, centred on the path, spans x
  const b = new Batch();
  b.add(G.box(0.4, 5, 0.4), 0xFFFFFF, { x: -3.2, y: 2.5 }).add(G.box(0.4, 5, 0.4), 0xFFFFFF, { x: 3.2, y: 2.5 }).add(G.box(7.2, 1, 0.3), 0xFFD23F, { y: 5 });
  for (let i = 0; i < 7; i++) b.add(G.box(0.5, 0.5, 0.35), 0x2A2233, { x: -3 + i, y: 5 + (i & 1 ? 0.25 : -0.25), outline: false });
  return b;
}
export function cloud(b, at) { // four squashed white spheres, placed by matrix `at`
  for (const [x, y, r] of [[0, 0, 4], [4.2, -0.6, 3], [-4, -0.7, 2.8], [2, 1.8, 3]]) b.add(G.sphere(r, 14, 10), 0xFFFFFF, { x, y, sz: 0.6 }, at);
}
