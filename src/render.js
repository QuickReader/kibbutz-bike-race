// Builds the 3D scene from TRACK and draws sim state. Never changes sim state.
// Look: DESIGN.md v2 (toon shading + ink outlines). Everything static is merged, each actor is one skinned mesh pair.
import * as THREE from 'three';
import { TRACK, pointAt } from './track.js';
import { FALL } from './sim.js';
import { Batch, Rig, toon, toonFlat, toonPlain, outline, FOG, FOG_NEAR, FOG_FAR, G } from './toon.js';
import { person, bike, ride, walk, house, tree, tower, hall, arch, cloud } from './figures.js';

const hex = h => new THREE.Color(h);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, k) => a + (b - a) * Math.min(1, k);
const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k);
const at = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));

// flat ground pieces (field checker, path, kerb, dashes, start/finish strips): one mesh
function flat() {
  const pos = [], col = [], idx = [];
  const quad = (pts, y, color) => { // pts: 4 [x, z] corners
    const c = hex(color), n = pos.length / 3;
    for (const [x, z] of pts) { pos.push(x, y, z); col.push(c.r, c.g, c.b); }
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const strip = (cx, cz, h, w, l, y, color) => { // centred rectangle, w across the heading, l along it
    const sx = Math.cos(h) * w / 2, sz = -Math.sin(h) * w / 2, fx = Math.sin(h) * l / 2, fz = Math.cos(h) * l / 2;
    quad([[cx - sx - fx, cz - sz - fz], [cx + sx - fx, cz + sz - fz], [cx + sx + fx, cz + sz + fz], [cx - sx + fx, cz - sz + fz]], y, color);
  };
  const build = () => {
    const g = new THREE.BufferGeometry(), up = new Float32Array(pos.length);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); return g;
  };
  return { quad, strip, build };
}

const clamp01 = v => Math.max(0, Math.min(1, v));
// instanced fill + hull sharing one matrix buffer, split into 128 m cells so far cells are frustum-culled; per-instance +-4% brightness
function scatter(batch, items, scale = () => 1) {
  const tint = new THREE.Color(), [fg, hg] = batch.geometries(), cells = new Map(), m = new THREE.Matrix4(), out = [];
  items.forEach((it, i) => { const k = Math.floor(it.x / 128) + ',' + Math.floor(it.z / 128); if (!cells.has(k)) cells.set(k, []); cells.get(k).push([it, i]); });
  for (const list of cells.values()) {
    const f = new THREE.InstancedMesh(fg, toon, list.length), h = new THREE.InstancedMesh(hg, outline, list.length);
    list.forEach(([it, i], j) => {
      f.setMatrixAt(j, m.copy(at(it.x, 0, it.z, it.rot || 0, scale(i))));
      const b = 1 + (((i * 7919) % 100) / 50 - 1) * 0.04; f.setColorAt(j, tint.setRGB(b, b, b));
    });
    h.instanceMatrix = f.instanceMatrix; f.computeBoundingSphere(); h.computeBoundingSphere(); out.push(f, h);
  }
  return out;
}

export function createRenderer(canvas, sim) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  let pr = Math.min(devicePixelRatio, 2);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(62, 2, 0.3, 220);
  scene.fog = new THREE.Fog(FOG, FOG_NEAR, FOG_FAR);
  const sun = new THREE.DirectionalLight(0xFFF1D6, 2.2); sun.position.set(-30, 50, 20);
  scene.add(sun, new THREE.HemisphereLight(0xCFEFFF, 0xBFD98A, 1.9));

  // sky dome, far hills and clouds follow the camera
  const sg = new THREE.SphereGeometry(200, 16, 10), sc = [], top = hex(0x3FA9F0);
  for (let i = 0; i < sg.attributes.position.count; i++) {
    const c = hex(0xCDEBFA).lerp(top, Math.pow(clamp01(sg.attributes.position.getY(i) / 120), 0.8));
    sc.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sky = new THREE.Group();
  const dome = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -1; sky.add(dome);
  const hills = new Batch();
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4; hills.add(G.sphere(1, 20, 10), i & 1 ? 0x9CC283 : 0xA7C98B, { x: Math.sin(a) * 175, y: -8, z: Math.cos(a) * 175, sx: 60 + (i * 17) % 30, sy: 20 + (i * 7) % 8, sz: 28 }); }
  sky.add(new THREE.Mesh(hills.geometries()[0], new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  const clouds = new Batch();
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 1.1; cloud(clouds, at(Math.sin(a) * (90 + (i * 13) % 30), 18 + (i * 11) % 12, Math.cos(a) * (90 + (i * 13) % 30), a + Math.PI, 0.8 + (i % 3) * 0.25)); }
  sky.add(...clouds.meshes());
  scene.add(sky);

  // ground: checker of two greens (8 m cells), path, kerb, ink edge, dashed centre line, start strip
  const P = TRACK.points, F = flat();
  const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 80) / 8), x1 = Math.ceil((Math.max(...xs) + 80) / 8);
  const z0 = Math.floor((Math.min(...zs) - 80) / 8), z1 = Math.ceil((Math.max(...zs) + 80) / 8);
  for (let i = x0; i < x1; i++) for (let j = z0; j < z1; j++)
    F.quad([[i * 8, j * 8], [i * 8 + 8, j * 8], [i * 8 + 8, j * 8 + 8], [i * 8, j * 8 + 8]], 0, (i + j) & 1 ? 0x8ED043 : 0x7CC338);
  function ribbon(half, y, color) {
    const L = [], R = [];
    P.forEach((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / l * half, nz = (b[0] - a[0]) / l * half;
      L.push([p[0] + nx, p[1] + nz]); R.push([p[0] - nx, p[1] - nz]);
    });
    for (let i = 0; i < P.length - 1; i++) F.quad([L[i], L[i + 1], R[i + 1], R[i]], y, color);
  }
  ribbon(TRACK.width + 0.55, 0.02, 0x2A2233); ribbon(TRACK.width + 0.4, 0.03, 0xF4EEDF); ribbon(TRACK.width, 0.045, 0xCFC6B4);
  const o = { x: 0, z: 0, h: 0 };
  for (let s = 4; s < TRACK.length - 4; s += 4) { pointAt(s + 0.8, 0, o); F.strip(o.x, o.z, o.h, 0.16, 1.6, 0.055, 0xF4EEDF); }
  pointAt(1, 0, o); F.strip(o.x, o.z, o.h, 4, 0.6, 0.06, 0xFFFFFF);
  const last = P.length - 2, fh = Math.atan2(P[last + 1][0] - P[last][0], P[last + 1][1] - P[last][1]), back = TRACK.length - TRACK.finish;
  const fx = P[last + 1][0] - Math.sin(fh) * back, fz = P[last + 1][1] - Math.cos(fh) * back;
  F.strip(fx, fz, fh, 4, 0.6, 0.06, 0xFFFFFF);
  scene.add(new THREE.Mesh(F.build(), toonFlat));

  // scenery: one fill + one outline draw per kind
  const byKind = (list, n, f) => Array.from({ length: n }, (_, k) => list.filter((it, i) => f(it, i) === k));
  byKind(TRACK.houses, 3, (h, i) => (i + h.kind) % 3).forEach((list, v) => scene.add(...scatter(house(v), list)));
  byKind(TRACK.trees, 3, t => t.kind).forEach((list, k) => scene.add(...scatter(tree(k), list, i => 0.85 + ((i * 37) % 10) / 25)));
  scene.add(...scatter(tower(), TRACK.towers));
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), toonPlain, 300), fm = new THREE.Matrix4(), fp = { x: 0, z: 0, h: 0 };
  for (let i = 0; i < 300; i++) {
    pointAt((i * 37.7) % TRACK.length, ((i * 13) % 40 - 20) * 1.2 + 3, fp);
    flowers.setMatrixAt(i, fm.makeTranslation(fp.x, 0.12, fp.z));
    flowers.setColorAt(i, hex([0xFFFFFF, 0xFFD23F, 0xFF8FB1][i % 3]));
  }
  flowers.frustumCulled = false; scene.add(flowers);

  // dining hall and finish arch (world-placed, one fill + one outline)
  const hb = hall(), ab = arch(), hm = at(TRACK.hall.x, 0, TRACK.hall.z, TRACK.hall.rot), am = at(fx, 0, fz, fh);
  hb.items.forEach(it => { it.at = hm; }); ab.items.forEach(it => { it.at = am; });
  const place = new Batch(); place.items = [...hb.items, ...ab.items];
  scene.add(...place.meshes());
  // FINISH lettering on the sign board (small canvas texture, one extra draw)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const cx = cv.getContext('2d'); cx.font = '900 80px "Arial Rounded MT Bold", ui-rounded, "Trebuchet MS", system-ui, sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round'; cx.lineWidth = 12; cx.strokeStyle = '#2A2233'; cx.fillStyle = '#FFD23F';
  cx.strokeText('FINISH', 256, 52); cx.fillText('FINISH', 256, 52);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4 * 96 / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  sign.position.set(0, 6.35, 4.36); sign.applyMatrix4(hm); scene.add(sign);

  // characters: bones from figures.js, one SkinnedMesh pair each
  const SKIN = [0xF1C9A0, 0xC68E5E, 0x8D5A3B], SHIRT = [0xD96C8E, 0x5AA0D8, 0x9AA0A6, 0x7BBF6A, 0xE8A33D], PANTS = [0x4A4F63, 0x6B5B45];
  const HAIR = [0x3A2A1A, 0x1E1A16, 0x8A5A2B, 0xB8B2A8], STYLES = ['short', 'pony', 'bun', 'long', 'curly', 'cap', 'bald'];
  const BIKE = [0xFF3D2E, 0x2D6CDF, 0x8B4FD0, 0x12A594];
  const LOOK = [
    { skin: SKIN[0], shirt: 0xFFD23F, stripe: 0xFF3D2E, pants: 0x34406B, helmet: 0xFFFFFF },
    { skin: SKIN[1], shirt: 0x2D6CDF, stripe: 0xFFFFFF, pants: 0x34406B, hair: 0x1E1A16, style: 'curly' },
    { skin: SKIN[0], shirt: 0x8B4FD0, stripe: 0xFFFFFF, pants: 0x34406B, hair: 0x8A5A2B, style: 'pony', shorts: true },
    { skin: SKIN[2], shirt: 0x12A594, stripe: 0xFFFFFF, pants: 0x34406B, hair: 0x1E1A16, style: 'long' },
  ];
  const riders = sim.riders.map((r, i) => {
    const rig = new Rig(), tilt = rig.bone(null), p = person(rig, tilt, LOOK[i]), bk = bike(rig, tilt, BIKE[i], i === 0);
    const grp = new THREE.Group(); grp.add(...rig.skinned(), tilt); scene.add(grp);
    return { grp, tilt, p, bk, ph: i, wa: 0, lean: i ? 0.5 : 0.55 };
  });
  const walkers = sim.walkers.map(w => {
    const k = w.look, rig = new Rig(), root = rig.bone(null);
    const p = person(rig, root, { skin: SKIN[(k >> 3) % 3], shirt: SHIRT[k % 5], pants: PANTS[k % 2], hair: HAIR[(k >> 5) % 4], style: STYLES[(k >> 7) % 7],
      shorts: k % 7 === 0, shoe: k & 1 ? 0xFFFFFF : 0x3A3340, bang: true });
    const [fill, hull] = rig.skinned(), grp = new THREE.Group(); grp.rotation.order = 'YXZ'; grp.add(fill, hull, root); scene.add(grp);
    return { grp, p, hull, ph: k % 6 };
  });

  // shadow blobs: one instanced mesh of flat dark ellipses
  const N = riders.length + walkers.length;
  const blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x1B2A10, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
  blobs.frustumCulled = false; scene.add(blobs);

  // particles: puffs on a crash, dust on grass
  const parts = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false; m.life = 0; m.v = new THREE.Vector3(); scene.add(m); return m;
  });
  let pi = 0, dustT = 0;
  function spawn(x, y, z, color, vx, vy, vz, life) {
    const m = parts[pi++ % parts.length];
    m.position.set(x, y, z); m.v.set(vx, vy, vz); m.material.color.set(color); m.life = m.life0 = life; m.visible = true;
  }

  // menu line-up: cast stands in front of the start line facing the camera (display only, sim untouched)
  const STAGE_R = [{ x: 1.6, z: 1.2, h: -0.25 }, { x: 0.4, z: 0.4, h: 0.3 }, { x: 2.8, z: 0.5, h: -0.4 }, { x: 3.9, z: 0.2, h: -0.3 }];
  const STAGE_W = [{ x: 1.0, z: -1.6, h: 0.1 }, { x: 3.3, z: -1.5, h: -0.2 }];

  const cp = new THREE.Vector3(), look = new THREE.Vector3(), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), sc1 = new THREE.Vector3();
  let camH = 0, pull = 0, shake = 0, t = 0, ready = false;

  function resize() {
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // drop resolution if frames stay slow (2 s average above 25 ms): 2 -> 1.5 -> 1
  let slow = 0, frames = 0, tPrev = performance.now();
  function adapt() {
    const n = performance.now(), ft = n - tPrev; tPrev = n;
    if (ft > 250 || pr <= 1) return;
    slow += ft; frames++;
    if (slow >= 2000) { if (slow / frames > 25) { pr = pr > 1.5 ? 1.5 : 1; resize(); } slow = frames = 0; }
  }

  function draw(dt, menu) {
    t += dt; adapt(); flowers.visible = !menu;
    const me = sim.riders[0];
    let n = 0;
    const near = (x, z) => !menu && Math.hypot(x - cam.position.x, z - cam.position.z) < 2.5; // keep passers-by out of the lens
    const blob = (x, z, h, w, l) => blobs.setMatrixAt(n++, mat.compose(cp.set(x, 0.08, z), q.setFromAxisAngle(Y, h), sc1.set(w, 1, l)));
    riders.forEach((v, i) => {
      const r = sim.riders[i], s = menu ? STAGE_R[i] : r;
      const x = menu ? s.x : r.x, z = menu ? s.z : r.z, h = menu ? s.h : r.heading;
      v.grp.position.set(x, 0, z); v.grp.rotation.y = h;
      const k = !menu && r.fall > 0 ? Math.min(1, (FALL - r.fall) / 0.25) * Math.min(1, r.fall / 0.3) : 0;
      v.tilt.rotation.z = k * 1.4 - (menu ? 0 : r.steer * 0.15 * (1 - k));
      v.p.root.position.x = k * 0.8; v.p.root.rotation.z = k * 0.8;
      v.ph += (menu ? 2.2 : r.speed * 1.0) * dt; v.wa += (menu ? 0 : r.speed / 0.34) * dt;
      v.bk.wheels.forEach(w => { w.rotation.x = v.wa; });
      ride(v.p, v.bk, v.ph, v.lean);
      v.grp.visible = menu || (Math.hypot(r.x - me.x, r.z - me.z) < 90 && (i === 0 || !near(r.x, r.z)));
      if (v.grp.visible) blob(x, z, h, 0.5, 1.0); else blob(0, 0, 0, 0, 0);
      if (menu) return;
      if (r.fall > 0 && !v.hit) { v.hit = true; if (i === 0) shake = 0.25; for (let c = 0; c < 6; c++) spawn(r.x, 0.5, r.z, 0xFFFFFF, (Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.35); }
      if (r.fall <= 0) v.hit = false;
    });
    sim.walkers.forEach((w, i) => {
      const v = walkers[i], moving = menu || w.stumble <= 0, s = menu && STAGE_W[i];
      const x = s ? s.x : w.x, z = s ? s.z : w.z, h = s ? s.h : w.h;
      v.grp.position.set(x, 0, z); v.grp.rotation.y = h;
      v.grp.rotation.x = moving ? 0 : -0.44;
      if (moving && !s) v.ph += dt * w.speed * 4.2;
      walk(v.p, v.ph, moving && !s);
      v.p.mark.position.y = moving ? -60 : 2.3;
      const dm = Math.hypot(w.x - me.x, w.z - me.z);
      v.grp.visible = s ? true : !menu && dm < 85 && !near(w.x, w.z); v.hull.visible = !!s || dm < 40;
      if (v.grp.visible) blob(x, z, h, 0.55, 0.55); else blob(0, 0, 0, 0, 0);
    });
    blobs.instanceMatrix.needsUpdate = true;

    for (const m of parts) if (m.visible) {
      m.life -= dt; m.v.y -= 9 * dt;
      m.position.addScaledVector(m.v, dt); m.scale.setScalar(Math.max(0.01, m.life / m.life0)); m.visible = m.life > 0;
    }

    if (menu) { // low front shot of the line-up; sways a little
      cam.fov = 40; cam.position.set(0.25 + Math.sin(t * 0.3) * 0.4, 1.3, 7.6);
      cam.lookAt(0.25, 1.05, 0);
    } else {
      if (!reduced && !me.onRoad && me.speed > 2 && (dustT -= dt) < 0) {
        dustT = 0.08;
        spawn(me.x - Math.sin(me.heading), 0.3, me.z - Math.cos(me.heading), 0xC9B98A, 0, 1, 0, 0.4);
      }
      pull = lerp(pull, me.fall > 0 ? 1 : 0, dt * 6);
      camH = ready ? angLerp(camH, me.heading, dt * 3) : me.heading;
      const dist = 4.5 + pull * 1.5, up = 2.8 + pull * 0.8, fx = Math.sin(camH), fz = Math.cos(camH);
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
