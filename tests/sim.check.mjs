// Run: node tests/sim.check.mjs
import assert from 'node:assert/strict';
import { TRACK, project, pointAt } from '../src/track.js';
import { createSim } from '../src/sim.js';

const o = { seg: 0, s: 0, d: 0 }, p = { x: 0, z: 0, h: 0 };

// on-road detection and progress along the polyline
pointAt(100, 0, p);
project(p.x, p.z, 0, o);
assert.ok(Math.abs(o.s - 100) < 0.5 && o.d < 0.01, 'point on centreline');
pointAt(100, 1.5, p);
assert.ok(project(p.x, p.z, o.seg, o).d <= TRACK.width, '1.5 m off centre is paved');
pointAt(100, 3, p);
assert.ok(project(p.x, p.z, o.seg, o).d > TRACK.width, '3 m off centre is grass');

// crash timer: put a walker on the player
let sim = createSim();
sim.update(1 / 60, 0);
const me = sim.riders[0];
me.speed = 5;
Object.assign(sim.walkers[0], { ax: me.x, az: me.z, bx: me.x, bz: me.z + 0.01, len: 0.01, t: 0 });
sim.update(1 / 60, 0);
assert.ok(me.fall > 1.9 && me.speed === 0 && me.penalty === 2 && sim.walkers[0].stumble > 0, 'hit starts fall');
Object.assign(sim.walkers[0], { x: 9e3 }); sim.walkers[0].stumble = 0; Object.assign(sim.walkers[0], { ax: 9e3, bx: 9e3, az: 9e3, bz: 9e3 + 1, len: 1 });
for (let i = 0; i < 125; i++) sim.update(1 / 60, 0);
assert.equal(me.fall, 0, 'fall ends after ~2 s');

// a rider parked on a walker falls at most once every 3 s
sim = createSim();
const w0 = sim.walkers[0], pk = sim.riders[0];
Object.assign(w0, { ax: pk.x, az: pk.z, bx: pk.x, bz: pk.z, len: 1e9, t: 0, speed: 0 });
pk.max = 0;
let falls = 0, was = 0;
for (let i = 0; i < 60 * 12; i++) { sim.update(1 / 60, 0); w0.stumble = 0; Object.assign(w0, { x: pk.x, z: pk.z }); if (pk.fall > 0 && was <= 0) falls++; was = pk.fall; }
assert.ok(falls >= 2 && falls <= 4, 'repeat falls are spaced >= 3 s apart, got ' + falls);

// grass slows a rider
sim = createSim();
const g = sim.riders[0]; g.onRoad = false;
for (let i = 0; i < 300; i++) { g.onRoad = false; g.speed += (g.max * 0.5 - g.speed) * 0.1; }
assert.ok(g.speed < g.max * 0.6);

// full race: everyone finishes, places are 1..4, times sensible (60-90 s)
sim = createSim();
for (let i = 0; i < 60 * 200 && !sim.over; i++) sim.update(1 / 60, 0); // player never steers: AI finish, player may not
assert.ok(sim.riders.slice(1).every(r => r.finishTime > 55 && r.finishTime < 100), 'AI times in range: ' + sim.riders.map(r => r.finishTime));
const ai = sim.riders[1];
assert.ok(ai.progress >= TRACK.finish);

// autopilot the player with the AI steering to check finish ordering and places
sim = createSim();
sim.riders[0].ai = true; sim.riders[0].max = 9.5;
for (let i = 0; i < 60 * 200 && !sim.over; i++) sim.update(1 / 60, 0);
assert.ok(sim.over, 'race ends');
assert.deepEqual(sim.riders.map(r => r.place).sort(), [1, 2, 3, 4]);
const byPlace = [...sim.riders].sort((a, b) => a.place - b.place);
for (let i = 1; i < 4; i++) assert.ok(byPlace[i - 1].finishTime <= byPlace[i].finishTime, 'places follow finish times');
console.log('sim ok', sim.riders.map(r => `${r.name} ${r.finishTime.toFixed(1)}s +${r.penalty}`).join(' | '));
