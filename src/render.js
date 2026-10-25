// Builds the 3D scene from TRACK and draws sim state. Never changes sim state.
import * as THREE from 'three';
import { TRACK, pointAt } from './track.js';
import { FALL } from './sim.js';

const hex = h => new THREE.Color(h);
const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, k) => a + (b - a) * Math.min(1, k);
const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k);

// A colour-baked box; geometries are merged so each object is one draw call.
function box(w, h, d, x, y, z, color, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.rotateY(rotY); g.translate(x, y, z);
  const c = hex(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function merge(list) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(list.reduce((n, g) => n + g.attributes[name].array.length, 0));
    let o = 0;
    for (const g of list) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
const mesh = list => new THREE.Mesh(merge(list), MAT);
const place = (g, x, z, rot) => g.rotateY(rot).translate(x, 0, z);

function instanced(geo, items, tint = 0.04) {
  const m = new THREE.InstancedMesh(geo, MAT, items.length), mat = new THREE.Matrix4(), q = new THREE.Quaternion();
  items.forEach((it, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot || 0);
    m.setMatrixAt(i, mat.compose(new THREE.Vector3(it.x, it.y || 0, it.z), q, new THREE.Vector3(1, 1, 1)));
    const j = 1 + (((i * 7919) % 100) / 50 - 1) * tint;
    m.setColorAt(i, hex(0xffffff).multiplyScalar(j));
  });
  m.frustumCulled = false;
  return m;
}

const HOUSE = [
  [box(6, 3, 5, 0, 1.5, 0, 0xF4EBD9), box(6.4, 0.5, 5.4, 0, 3.1, 0, 0xC2492F), box(5.2, 0.5, 4.6, 0, 3.6, 0, 0xC2492F),
    box(1, 2, 0.1, 1.5, 1, 2.52, 0x4C7A8C), box(1.2, 1, 0.1, -1.5, 1.7, 2.52, 0x4C7A8C)],
  [box(6, 3, 5, 0, 1.5, 0, 0xEFE0C2), box(6.2, 0.3, 5.2, 0, 3.15, 0, 0xD8D4CC),
    box(1, 2, 0.1, -1.5, 1, 2.52, 0x4C7A8C), box(1.2, 1, 0.1, 1.5, 1.7, 2.52, 0x4C7A8C)],
].map(merge);
const TREE = [
  [box(1.4, 2.5, 1.4, 0, 1.25, 0, 0x2F5D3A), box(1, 2.5, 1, 0, 3.75, 0, 0x2F5D3A), box(0.6, 2, 0.6, 0, 5.9, 0, 0x2F5D3A)],
  [box(0.4, 3, 0.4, 0, 1.5, 0, 0x7A5A3A), box(3, 3, 3, 0, 4.5, 0, 0x6F9A78), box(2.4, 2.4, 2.4, 0.8, 6.2, 0.4, 0x6F9A78)],
  [box(0.4, 5, 0.4, 0, 2.5, 0, 0x7A5A3A), box(3.8, 0.25, 1, 0, 5.1, 0, 0x5E9B3C), box(1, 0.25, 3.8, 0, 5.1, 0, 0x5E9B3C),
    box(3, 0.25, 0.9, 0, 5.3, 0, 0x5E9B3C, 0.8)],
].map(merge);

function person(shirt, pants, skin, hair, stripe) {
  const body = mesh([box(0.6, 0.7, 0.35, 0, 1.05, 0, shirt), ...(stripe ? [box(0.62, 0.15, 0.37, 0, 1.1, 0, 0xFFFFFF)] : []), box(0.4, 0.4, 0.4, 0, 1.6, 0, skin), box(0.46, 0.2, 0.46, 0, 1.88, 0, hair)]);
  const limb = (w, h, c) => { const g = box(w, h, w, 0, -h / 2, 0, c); return new THREE.Mesh(g, MAT); };
  const g = new THREE.Group(), legs = [0, 1].map(() => limb(0.25, 0.7, pants)), arms = [0, 1].map(() => limb(0.2, 0.6, shirt));
  legs.forEach((l, i) => l.position.set(i ? 0.15 : -0.15, 0.7, 0));
  arms.forEach((a, i) => a.position.set(i ? 0.4 : -0.4, 1.35, 0));
  g.add(body, ...legs, ...arms);
  return { g, legs, arms };
}

function bike(color) {
  return mesh([box(0.1, 0.7, 0.7, 0, 0.35, 0.65, 0x2A2A2A), box(0.1, 0.7, 0.7, 0, 0.35, -0.65, 0x2A2A2A),
    box(0.1, 0.1, 1.3, 0, 0.55, 0, color), box(0.1, 0.5, 0.1, 0, 0.8, 0.45, color), box(0.5, 0.1, 0.1, 0, 1.05, 0.55, 0x2A2A2A),
    box(0.2, 0.08, 0.3, 0, 0.95, -0.35, 0x2A2A2A), box(0.12, 0.12, 0.5, 0, 0.6, 0.65, color)]);
}

export function createRenderer(canvas, sim) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(62, 2, 0.3, 140);
  scene.fog = new THREE.Fog(0xDFF1F5, 55, 110);
  const sun = new THREE.DirectionalLight(0xFFF1D6, 2.6);
  sun.position.set(-30, 50, 20);
  scene.add(sun, new THREE.HemisphereLight(0xBFE3F5, 0xF0E2C0, 1.6));

  // sky dome follows the camera
  const sg = new THREE.SphereGeometry(100, 8, 6), sc = [];
  for (let i = 0; i < sg.attributes.position.count; i++) {
    const c = hex(0xDFF1F5).lerp(hex(0x8FD0EE), Math.max(0, Math.min(1, sg.attributes.position.getY(i) / 35)));
    sc.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1; scene.add(sky);

  // ground: checker of two greens, 8 m cells
  const xs = TRACK.points.map(p => p[0]), zs = TRACK.points.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 80) / 8), x1 = Math.ceil((Math.max(...xs) + 80) / 8);
  const z0 = Math.floor((Math.min(...zs) - 80) / 8), z1 = Math.ceil((Math.max(...zs) + 80) / 8);
  const cells = [];
  for (let i = x0; i < x1; i++) for (let j = z0; j < z1; j++) cells.push(box(8, 0.1, 8, i * 8 + 4, -0.05, j * 8 + 4, (i + j) & 1 ? 0x8DBE4F : 0x7AAE45));
  scene.add(mesh(cells));

  // path ribbon (kerb is a slightly wider, lower ribbon)
  const P = TRACK.points;
  function ribbon(half, y, color) {
    const v = [];
    P.forEach((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * half, nz = (b[0] - a[0]) / l * half;
      v.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    });
    const idx = [], c = hex(color), col = [];
    for (let i = 0; i < P.length; i++) col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    for (let i = 0; i < P.length - 1; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, MAT);
  }
  scene.add(ribbon(TRACK.width + 0.3, 0.03, 0xC9C8C0), ribbon(TRACK.width, 0.06, 0xA7A9A4));

  // scenery
  HOUSE.forEach((g, k) => scene.add(instanced(g, TRACK.houses.filter(h => h.kind === k))));
  TREE.forEach((g, k) => scene.add(instanced(g, TRACK.trees.filter(t => t.kind === k))));
  const tower = merge([...[-1, 1].flatMap(x => [-1, 1].map(z => box(0.3, 11, 0.3, x * 1.6, 5.5, z * 1.6, 0xBDB8AE))), box(4, 3, 4, 0, 12.5, 0, 0xE8E2D4), box(4.4, 0.3, 4.4, 0, 14.2, 0, 0xBDB8AE)]);
  scene.add(instanced(tower, TRACK.towers, 0));
  const flowers = [], fp = { x: 0, z: 0, h: 0 };
  for (let i = 0; i < 300; i++) {
    pointAt((i * 37.7) % TRACK.length, ((i * 13) % 40 - 20) * 1.2 + 3, fp);
    flowers.push({ x: fp.x, z: fp.z, y: 0.1 });
  }
  const fl = instanced(box(0.2, 0.2, 0.2, 0, 0, 0, 0xffffff), flowers, 0);
  flowers.forEach((f, i) => fl.setColorAt(i, hex(i % 3 ? 0xFFFFFF : 0xF4C430)));
  scene.add(fl);

  // dining hall, finish arch and start line, all in one mesh
  const hall = merge([box(16, 4.5, 9, 0, 2.25, 0, 0xF6E3B8), box(17, 0.6, 10, 0, 4.8, 0, 0xB8402A), box(16, 0.3, 3, 0, 3.6, 5.8, 0xB8402A),
    ...[-6, -2, 2, 6].map(x => box(0.5, 3.4, 0.5, x, 1.7, 6.9, 0xFFFFFF)), box(8, 1.4, 0.3, 0, 5.8, 4.6, 0x2E6F8E)]);
  place(hall, TRACK.hall.x, TRACK.hall.z, TRACK.hall.rot);
  const arch = [box(0.4, 5, 0.4, -3.2, 2.5, 0, 0xFFFFFF), box(0.4, 5, 0.4, 3.2, 2.5, 0, 0xFFFFFF), box(7, 1, 0.3, 0, 5, 0, 0xFFD23F),
    ...Array.from({ length: 7 }, (_, i) => box(0.5, 0.5, 0.35, -3 + i, 5 + (i & 1 ? 0.25 : -0.25), 0, 0x222222))];
  const lastSeg = P.length - 2, fh = Math.atan2(P[lastSeg + 1][0] - P[lastSeg][0], P[lastSeg + 1][1] - P[lastSeg][1]);
  const back = TRACK.length - TRACK.finish;
  const strip = () => box(4, 0.02, 0.6, 0, 0.09, 0, 0xFFFFFF);
  const fm = mesh([...arch, strip()]);
  fm.rotation.y = fh;
  fm.position.set(P[lastSeg + 1][0] - Math.sin(fh) * back, 0, P[lastSeg + 1][1] - Math.cos(fh) * back);
  const sm = mesh([strip()]);
  sm.position.set(0, 0, 1);
  scene.add(new THREE.Mesh(hall, MAT), fm, sm);

  // characters
  const SKIN = [0xF1C9A0, 0xC68E5E, 0x8D5A3B], SHIRT = [0xE8A33D, 0xD96C8E, 0x5AA0D8, 0x9AA0A6, 0x7BBF6A], PANTS = [0x4A4F63, 0x6B5B45];
  const BIKE = [0xFF3D2E, 0x2D6CDF, 0x8B4FD0, 0x12A594];
  const bangG = box(0.2, 0.5, 0.2, 0, 2.5, 0, 0xFFD23F);
  const actors = [];
  const riders = sim.riders.map((r, i) => {
    const grp = new THREE.Group(), tilt = new THREE.Group(), p = person(i ? BIKE[i] : 0xFFD23F, 0x4A4F63, SKIN[i % 3], i ? 0x3A2A1A : 0xFFFFFF, i > 0);
    p.g.position.set(0, 0.3, -0.25); p.g.scale.setScalar(0.85);
    if (!i) { // player stays bright: unlit shirt, helmet, red basket
      const lit = new THREE.MeshBasicMaterial({ vertexColors: true });
      p.g.children[0].material = p.arms[0].material = p.arms[1].material = lit;
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0xFF3D2E }));
      bk.position.set(0, 1.15, -0.85); tilt.add(bk);
    }
    p.arms.forEach(a => { a.rotation.x = -1.2; });
    tilt.add(bike(BIKE[i]), p.g); grp.add(tilt); scene.add(grp);
    return { grp, tilt, p, ph: 0 };
  });
  const walkers = sim.walkers.map(w => {
    const k = w.look, p = person(SHIRT[k % 5], PANTS[k % 2], SKIN[(k >> 3) % 3], [0x3A2A1A, 0x1E1A16, 0x8A6A3A][(k >> 5) % 3]);
    const bang = new THREE.Mesh(bangG, MAT); bang.visible = false;
    const grp = new THREE.Group(); grp.add(p.g, bang); scene.add(grp);
    return { grp, p, bang, ph: k };
  });

  // shadow blobs: one instanced mesh
  const N = riders.length + walkers.length;
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
  blobs.frustumCulled = false; scene.add(blobs);

  // particles: puffs on a crash, dust on grass
  const parts = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false; m.life = 0; m.v = new THREE.Vector3(); scene.add(m); return m;
  });
  let pi = 0, dustT = 0;
  function spawn(x, y, z, color, vx, vy, vz, life) {
    const m = parts[pi++ % parts.length];
    m.position.set(x, y, z); m.v.set(vx, vy, vz); m.material.color.set(color); m.life = life; m.visible = true;
  }

  const cp = new THREE.Vector3(), look = new THREE.Vector3(), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), sc1 = new THREE.Vector3();
  let camH = 0, pull = 0, shake = 0, t = 0, ready = false;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(Math.round(w * 0.6), Math.round(h * 0.6), false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  function draw(dt, menu) {
    t += dt;
    const me = sim.riders[0];
    // riders
    riders.forEach((v, i) => {
      const r = sim.riders[i];
      v.grp.position.set(r.x, 0, r.z); v.grp.rotation.y = r.heading;
      const el = FALL - r.fall, k = r.fall > 0 ? Math.min(1, el / 0.25) * Math.min(1, r.fall / 0.3) : 0;
      v.tilt.rotation.z = k * 1.4 - r.steer * 0.15 * (1 - k);
      v.p.g.position.x = k * 0.8; v.p.g.rotation.z = k * 0.8;
      v.ph += r.speed * dt * 1.6;
      v.p.legs[0].rotation.x = Math.sin(v.ph) * 0.8; v.p.legs[1].rotation.x = -Math.sin(v.ph) * 0.8;
      v.grp.visible = Math.hypot(r.x - me.x, r.z - me.z) < 90;
      if (r.fall > 0 && !v.hit) { v.hit = true; if (i === 0) shake = 0.25; for (let c = 0; c < 6; c++) spawn(r.x, 0.5, r.z, 0xFFFFFF, (Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.3); }
      if (r.fall <= 0) v.hit = false;
    });
    sim.walkers.forEach((w, i) => {
      const v = walkers[i], moving = w.stumble <= 0;
      v.grp.position.set(w.x, 0, w.z); v.grp.rotation.y = w.h;
      v.grp.rotation.x = moving ? 0 : -0.44;
      const sw = moving ? Math.sin((t + v.ph) * Math.PI * 4) * 0.5 : 0;
      v.p.legs[0].rotation.x = sw; v.p.legs[1].rotation.x = -sw; v.p.arms[0].rotation.x = -sw; v.p.arms[1].rotation.x = sw;
      v.bang.visible = !moving;
      v.grp.visible = Math.hypot(w.x - me.x, w.z - me.z) < 85;
    });
    sim.riders.forEach((r, i) => blobs.setMatrixAt(i, mat.compose(cp.set(r.x, 0.14, r.z), q.setFromAxisAngle(Y, r.heading), sc1.set(1.1, 1, 1.9))));
    sim.walkers.forEach((w, i) => blobs.setMatrixAt(riders.length + i, mat.compose(cp.set(w.x, 0.14, w.z), q.identity(), sc1.set(0.9, 1, 0.9))));
    blobs.instanceMatrix.needsUpdate = true;

    // particles; dust while the player is on grass
    if (!menu && !me.onRoad && me.speed > 2 && (dustT -= dt) < 0) {
      dustT = 0.08;
      spawn(me.x - Math.sin(me.heading) * 1, 0.3, me.z - Math.cos(me.heading) * 1, 0xC9B98A, 0, 1, 0, 0.4);
    }
    for (const m of parts) if (m.visible) {
      m.life -= dt; m.v.y -= 9 * dt;
      m.position.addScaledVector(m.v, dt); m.visible = m.life > 0;
    }

    // camera
    if (menu) {
      cam.fov = 62; // start line with riders, houses behind
      cam.position.set(-4 + Math.sin(t * 0.2) * 2, 2.4, -8); cam.lookAt(3, 2, 20);
    } else {
      const falling = me.fall > 0;
      pull = lerp(pull, falling ? 1 : 0, dt * 6);
      camH = ready ? angLerp(camH, me.heading, dt * 3) : me.heading;
      const dist = 4.5 + pull * 1.5, up = 2.6 + pull * 0.8, fx = Math.sin(camH), fz = Math.cos(camH);
      cp.set(me.x - fx * dist, up, me.z - fz * dist);
      if (ready) cam.position.lerp(cp, Math.min(1, dt * 6)); else cam.position.copy(cp);
      shake = Math.max(0, shake - dt);
      const sh = reduced ? 0 : shake * 0.6;
      cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh;
      cam.lookAt(look.set(me.x + fx * 6, 0.8, me.z + fz * 6));
      if (!reduced) cam.rotateZ(me.steer * 0.05);
      cam.fov = 62 + Math.min(4, Math.max(0, me.speed - 5));
      ready = true;
    }
    cam.updateProjectionMatrix();
    sky.position.copy(cam.position);
    renderer.render(scene, cam);
  }
  return { draw, restart: () => { ready = false; } };
}
