// Track data and geometry helpers. No DOM, no Three.js (see ARCHITECTURE.md).
const P = [[0, 0], [0, 40], [10, 80], [35, 110], [75, 125], [120, 125], [160, 140], [185, 175],
  [190, 220], [175, 260], [150, 290], [150, 330], [170, 370], [210, 395], [260, 400]];
const WIDTH = 2; // half-width of the path in metres
const cum = [0];
const hd = [];
for (let i = 1; i < P.length; i++) {
  const dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1];
  cum.push(cum[i - 1] + Math.hypot(dx, dz));
  hd.push(Math.atan2(dx, dz));
}
const LENGTH = cum[cum.length - 1];

// Closest point on the polyline, searching only segments near `hint`.
// out = {seg, s (distance along route), d (distance from centreline)}
export function project(x, z, hint, out) {
  let best = Infinity;
  for (let i = Math.max(0, hint - 1); i <= Math.min(P.length - 2, hint + 2); i++) {
    const ax = P[i][0], az = P[i][1], bx = P[i + 1][0] - ax, bz = P[i + 1][1] - az;
    const len2 = bx * bx + bz * bz;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / len2));
    const d = Math.hypot(x - ax - bx * t, z - az - bz * t);
    if (d < best) { best = d; out.seg = i; out.s = cum[i] + t * Math.sqrt(len2); out.d = d; }
  }
  return out;
}

// Point at distance s along the route, shifted `lat` metres to the left. out = {x, z, h}
export function pointAt(s, lat, out) {
  s = Math.max(0, Math.min(LENGTH, s));
  let i = 0;
  while (i < P.length - 2 && cum[i + 1] < s) i++;
  const h = hd[i], u = s - cum[i];
  out.x = P[i][0] + Math.sin(h) * u + Math.cos(h) * lat;
  out.z = P[i][1] + Math.cos(h) * u - Math.sin(h) * lat;
  out.h = h;
  return out;
}

function distToPath(x, z) {
  const o = { seg: 0, s: 0, d: 0 };
  let best = Infinity;
  for (let i = 0; i < P.length - 1; i++) best = Math.min(best, project(x, z, i + 1, o).d);
  return best;
}

let seed = 7; // mulberry32, so every load builds the same village
const rnd = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const houses = [], trees = [], towers = [], colliders = [], walkers = [];
const o = { x: 0, z: 0, h: 0 };
for (let s = 6; s < LENGTH - 25; s += 8) {
  for (const side of [-1, 1]) {
    const r = rnd(), lat = side * (6 + rnd() * 22);
    if (r > 0.8) continue;
    pointAt(s + rnd() * 6, lat, o);
    const isHouse = r < 0.2 && Math.abs(lat) > 9;
    if (distToPath(o.x, o.z) < (isHouse ? 9 : 3.8)) continue;
    if (isHouse) {
      const rot = Math.atan2(side * Math.cos(o.h), -side * Math.sin(o.h)); // door faces the path
      houses.push({ x: o.x, z: o.z, rot, kind: rnd() < 0.5 ? 0 : 1 });
      for (const k of [-1.5, 1.5])
        colliders.push({ x: o.x + Math.cos(rot) * k, z: o.z - Math.sin(rot) * k, r: 2.6 });
    } else {
      trees.push({ x: o.x, z: o.z, kind: Math.floor(rnd() * 3) });
      colliders.push({ x: o.x, z: o.z, r: 0.5 });
    }
  }
}
for (const [s, lat] of [[150, 16], [430, -16]]) {
  pointAt(s, lat, o);
  towers.push({ x: o.x, z: o.z });
  colliders.push({ x: o.x, z: o.z, r: 2.4 });
}

// Walkers pace between two points: across the path, or along it on one side.
const a = { x: 0, z: 0, h: 0 }, b = { x: 0, z: 0, h: 0 };
function walker(ax, az, bx, bz, speed) {
  walkers.push({ ax, az, bx, bz, speed, t0: rnd(), look: Math.floor(rnd() * 1000) });
}
for (const s of [70, 150, 235, 300, 380, 470, 520, 575]) {
  pointAt(s, -9, a); pointAt(s, 9, b);
  walker(a.x, a.z, b.x, b.z, 1.2 + rnd() * 0.5);
}
for (const [s, len, lat] of [[100, 16, 1], [200, 14, -1], [350, 16, 1], [440, 14, -1]]) {
  pointAt(s, lat, a); pointAt(s + len, lat, b);
  walker(a.x, a.z, b.x, b.z, 1.1 + rnd() * 0.4);
}

pointAt(LENGTH, 0, o);
export const TRACK = {
  points: P, cum, width: WIDTH, length: LENGTH,
  finish: LENGTH - 12, // dining hall porch is at LENGTH
  houses, trees, towers, colliders, walkers,
  hall: { x: o.x + Math.sin(o.h) * 7, z: o.z + Math.cos(o.h) * 7, rot: o.h + Math.PI },
};
