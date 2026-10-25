// Game state and rules. No DOM, no Three.js: a server could run this later.
import { TRACK, project, pointAt } from './track.js';

const NAMES = ['You', 'Avi', 'Noa', 'Tamar'];
const MAX = [9, 8.6, 8.8, 8.4];       // top speed on the path, m/s
const LANE = [-0.5, -1.5, 0.5, 1.5];  // start lateral offset (left +)
const AIM = [0, -0.7, 0.6, 0];        // AI preferred lane
const R = 0.45, WALKER_R = 0.4;
const TURN = 1.7, ACC = 6, GRASS = 0.5, STUMBLE = 1.2, SAFE = 1; // SAFE: seconds of immunity after getting up
export const FALL = 2;

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tmp = { seg: 0, s: 0, d: 0 }, aim = { x: 0, z: 0, h: 0 };

export function createSim() {
  const sim = { riders: [], walkers: [], time: 0, over: false, reset, update };

  function reset() {
    sim.time = 0; sim.over = false;
    sim.riders = NAMES.map((name, id) => {
      const p = pointAt(1, LANE[id], { x: 0, z: 0, h: 0 });
      return { id, name, x: p.x, z: p.z, heading: p.h, speed: 0, steer: 0, fall: 0, safe: 0, penalty: 0,
        seg: 0, progress: 1, onRoad: true, finishTime: null, place: id + 1, ai: id > 0, max: MAX[id], lane: AIM[id] };
    });
    sim.walkers = TRACK.walkers.map(w => {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az);
      return { ...w, len, t: w.t0, dir: 1, x: w.ax, z: w.az, h: 0, stumble: 0 };
    });
    sim.walkers.forEach(moveWalker);
  }

  function moveWalker(w) {
    w.x = w.ax + (w.bx - w.ax) * w.t; w.z = w.az + (w.bz - w.az) * w.t;
    w.h = Math.atan2(w.bx - w.ax, w.bz - w.az) + (w.dir < 0 ? Math.PI : 0);
  }

  // AI: aim at a point ahead on the path, sidestep walkers in front.
  function aiSteer(r) {
    let lat = r.lane;
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    for (const w of sim.walkers) {
      const dx = w.x - r.x, dz = w.z - r.z, ahead = dx * fx + dz * fz, right = -dx * fz + dz * fx;
      if (ahead > 0 && ahead < 9 && Math.abs(right) < 1.6) lat += right > 0 ? 1.8 : -1.8;
    }
    pointAt(r.progress + 6 + r.speed * 0.15, clamp(lat, -1.6, 1.6), aim);
    return -clamp(wrap(Math.atan2(aim.x - r.x, aim.z - r.z) - r.heading) * 3, -1, 1);
  }

  function stepRider(r, dt, input) {
    const done = r.finishTime !== null, falling = r.fall > 0;
    r.fall = Math.max(0, r.fall - dt);
    if (falling && r.fall === 0) r.safe = SAFE; else r.safe = Math.max(0, r.safe - dt);
    const want = falling ? 0 : r.ai || done ? aiSteer(r) : input;
    r.steer += (want - r.steer) * Math.min(1, 10 * dt);
    r.heading -= r.steer * TURN * dt * Math.min(1, r.speed / 3);
    const target = falling || done ? 0 : r.max * (r.onRoad ? 1 : GRASS);
    r.speed += clamp(target - r.speed, -(done ? 8 : 12) * dt, ACC * dt);
    r.x += Math.sin(r.heading) * r.speed * dt;
    r.z += Math.cos(r.heading) * r.speed * dt;

    for (const c of TRACK.colliders) {
      const dx = r.x - c.x, dz = r.z - c.z, d = Math.hypot(dx, dz) || 1e-6, min = R + c.r;
      if (d < min) { r.x = c.x + dx / d * min; r.z = c.z + dz / d * min; r.speed = Math.min(r.speed, 1.5); }
    }
    if (!falling && !done && r.safe <= 0)
      for (const w of sim.walkers) {
        if (Math.hypot(r.x - w.x, r.z - w.z) >= R + WALKER_R) continue;
        r.fall = FALL; r.penalty += FALL; r.speed = 0; r.steer = 0;
        w.stumble = STUMBLE; w.t = clamp(w.t - w.dir * 0.5 / w.len, 0, 1); moveWalker(w);
        break;
      }

    project(r.x, r.z, r.seg, tmp);
    r.seg = tmp.seg; r.progress = tmp.s; r.onRoad = tmp.d <= TRACK.width;
    if (!done && r.progress >= TRACK.finish) r.finishTime = sim.time;
  }

  function update(dt, input) {
    if (sim.over) return;
    sim.time += dt;
    for (const w of sim.walkers) {
      if (w.stumble > 0) { w.stumble -= dt; continue; }
      w.t += w.dir * w.speed / w.len * dt;
      if (w.t > 1 || w.t < 0) { w.t = clamp(w.t, 0, 1); w.dir = -w.dir; }
      moveWalker(w);
    }
    for (const r of sim.riders) stepRider(r, dt, input);
    const ahead = (a, b) => a.finishTime !== null || b.finishTime !== null
      ? b.finishTime === null || (a.finishTime !== null && (a.finishTime < b.finishTime || (a.finishTime === b.finishTime && a.id < b.id)))
      : a.progress > b.progress;
    for (const r of sim.riders) r.place = 1 + sim.riders.filter(o => o !== r && ahead(o, r)).length;
    sim.over = sim.riders.every(r => r.finishTime !== null);
  }

  reset();
  return sim;
}
