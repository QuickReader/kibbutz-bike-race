# Architecture

Static page + Three.js. No server, no build step. Opens via any static host (GitHub Pages later).

## Three.js
Pinned **r170**, vendored at `vendor/three.module.min.js`. Why vendored: works offline, no CDN outage or version drift, GitHub Pages serves it as-is. r170 is the last release with a single-file module (r171+ split into two files). Import map in `index.html`: `"three": "./vendor/three.module.min.js"`.

## Files
```
index.html      canvas, HUD/menu/results overlays (plain HTML+CSS), import map, rotate-device notice
style.css       overlays only
src/track.js    TRACK data + helpers (route, props, walker spawns)
src/sim.js      game state + update(dt, input). No Three.js import.
src/render.js   builds the scene from TRACK, draws sim state each frame
src/main.js     loop, touch input, screens (menu/countdown/race/results), wires sim to render
vendor/three.module.min.js
```
Rule: `sim.js` and `track.js` never touch DOM or Three. `render.js` never changes state. That is the whole multiplayer-readiness plan: later, a server runs `sim.update` and clients render snapshots.

## Track
`TRACK.points`: array of `[x, z]` centreline points (metres), start at the house, end at the dining hall. `TRACK.width` (path half-width ~1.2 m). Used by:
- **Road check:** distance from rider to nearest segment (searching only near the rider's last segment index) `<= width` means paved, else grass.
- **Progress:** each rider keeps `seg` + `t` along the polyline; progress = distance along route. Ranking and finish = progress >= length (finish line is perpendicular to the last segment).
- **AI steering target:** a point a few metres ahead on the polyline.
- **Rendering:** path ribbon mesh built from the same points.
Also in `track.js`: static props (houses, trees as circles `{x,z,r}` plus type) and walker definitions (start point, route/crossing line, speed).

## Game loop
`requestAnimationFrame`; fixed sim step 1/60 s with an accumulator (deterministic, multiplayer-friendly), render once per frame. dt clamped on tab-resume. States: menu -> countdown (3 s) -> racing -> results. "Race again" calls `sim.reset()`.

## Sim
Plain objects: `riders[4]` (player + 3 AI) `{x,z,heading,speed,fallTimer,progress,finishTime}`, `walkers[]` `{x,z,dir,speed,stumbleTimer}`.
Per step: steer (input -1/0/1 or AI) -> turn heading at a capped rate -> accelerate toward target speed (paved max, grass ~50%, fallen = 0) -> move -> collide -> update progress.
Input: touch on left/right half of screen = -1/+1; both/none = 0. Auto-pedal means speed always eases to max.

## Collision (no physics library)
- Everything is a circle. Rider-vs-walker: distance < r1+r2 and rider not already falling: rider `fallTimer = 2` (speed 0, then recovers), walker `stumbleTimer`. Walkers are brief obstacles, not pushed.
- Rider-vs-prop (trees, houses): circle push-out, speed loss. Houses are 1-3 circles each, not AABB, to keep one code path.
- Rider-vs-rider: none in v1 (ride through) - fewer edge cases; revisit if it feels wrong.
- O(n*m) checks: ~4 riders x ~40 nearby walkers/props, no spatial grid needed.

## AI riders
Each follows the polyline: aim at the point ~6 m ahead, steer toward it, with a per-rider lateral offset and a per-rider max speed (slightly different, so the race is close; player can win by dodging well). Simple avoidance: if a walker circle is within ~5 m ahead and near the heading, shift the aim point sideways. They fall like the player if hit. No rubber-banding in v1 (add only if races feel lopsided).

## Rendering and performance (older phones)
- `WebGLRenderer({antialias:false})`, `setPixelRatio(min(devicePixelRatio, 1))` at most, canvas drawn at ~half CSS resolution and scaled with `image-rendering: pixelated` = blocky look and cheap fill rate.
- Only `MeshLambertMaterial` / flat colours with `flatShading`; one directional + one ambient light, no shadows (a dark blob quad under each rider/walker instead), no post-processing, no textures (vertex/flat colours).
- Budget: **< 100 draw calls**, < 50k triangles. Trees, houses, grass tufts as `InstancedMesh` (one per kind); ground, path ribbon each one mesh. Riders and walkers are tiny groups of boxes (merged per character, ~7 meshes total x 4-10 walkers is the main cost; keep walkers <= 10 visible).
- Fog + short far plane (~80 m) so far scenery is culled; no per-frame allocations in sim/render loops.
- Landscape lock: CSS "rotate your phone" overlay in portrait; `screen.orientation.lock` attempted but not relied on.
- Camera: chase camera behind player, smoothed; fixed FOV.

## Not in v1
Sound, rider-vs-rider collision, rubber-banding, multiplayer, save data, build tooling, tests beyond a small `sim` self-check (`node src/sim-check.js` - added when sim exists, since sim has no DOM/Three).
