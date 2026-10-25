# DESIGN — Kibbutz Bike Race

Feel: a bright, warm Israeli morning. Chunky toy-like blocks, soft sun, a little humour. Not neon, not "game template".

## Palette
| Use | Hex |
|---|---|
| Grass A / B (alternate in big patches, ~8 m squares) | `#8DBE4F` / `#7AAE45` |
| Path (paved, narrow) | `#A7A9A4`, edge kerb `#C9C8C0` |
| Dirt (worn grass near path, optional) | `#B79A6A` |
| House walls (mix) | `#F4EBD9`, `#FFFFFF`, `#EFE0C2` |
| Roofs | red tile `#C2492F`, flat roof `#D8D4CC`, door/window `#4C7A8C` |
| Trees: cypress / eucalyptus / palm-ish | `#2F5D3A` / `#6F9A78` / `#5E9B3C`; trunks `#7A5A3A` |
| Water tower | legs `#BDB8AE`, tank `#E8E2D4` |
| Dining hall (chadar ochel) | walls `#F6E3B8`, roof `#B8402A`, big sign board `#2E6F8E`, columns `#FFFFFF` |
| Finish arch / line | posts `#FFFFFF`, banner `#FFD23F` with `#222` checks |
| Sky (top) / horizon + fog | `#8FD0EE` / `#DFF1F5` (fog = horizon colour) |
| Player bike frame / rider shirt | `#FF3D2E` / `#FFD23F` + white helmet `#FFFFFF` (only warm saturated pair in scene) |
| AI 1 / 2 / 3 (bike, shirt) | blue `#2D6CDF`, purple `#8B4FD0`, teal `#12A594`, each with a white shirt stripe |
| Walkers shirts (pick random) | `#E8A33D`, `#D96C8E`, `#5AA0D8`, `#9AA0A6`, `#7BBF6A`; trousers `#4A4F63` or `#6B5B45`; skin `#F1C9A0`, `#C68E5E`, `#8D5A3B` |
| UI cream panel / ink text | `#FFF6E0` / `#2B2A33` (contrast ~14:1) |
| UI accent (buttons) / accent dark | `#FF8A1F` / `#B34E00` (button text `#2B2A33`) |
| Crash "Oops" | `#E5372A` text on cream pill |

Rule: player is the only red+yellow thing; keep red roofs desaturated (above) and never put red/yellow on walkers.

## Block style
- Flat shading only: `MeshLambertMaterial({color})`, no textures, no shadows maps in v1 (a dark `#000` 25% blob quad under bikes/people is the shadow). Low-res: renderer pixel ratio ~0.5-0.6 of device, canvas CSS-scaled with `image-rendering: pixelated`.
- Colour variance: jitter each house/tree by +-4% lightness so it isn't uniform.
- Person (about 1.7 m, chunky): legs 2 boxes 0.25x0.7x0.25; torso 0.6x0.7x0.35; arms 0.2x0.6x0.2; head 0.4x0.4x0.4 (skin) + hair box on top. Walkers swing legs/arms +-30 deg at ~2 Hz.
- Bike (about 1.7 m long, 0.5 wide): 2 wheels as boxes 0.1x0.7x0.7 (dark `#2A2A2A`), frame 3 thin boxes (0.1 thick) in bike colour, handlebar box 0.5x0.1x0.1, seat box. Rider sits on it, legs animate with pedalling. Wheels may spin by flipping a lighter hub box.
- Houses: 6x3x5 m box + roof (red: pitched, built from 2 tilted boxes; flat: 0.3 m slab with parapet). 1-2 window boxes, 1 door. Dining hall: 16x4.5x9 m, wide porch with 4 columns, large sign board on front, banner arch over the path just before it.
- Trees: cypress = tall 1.2x6x1.2 stack of 2-3 narrowing boxes; eucalyptus = trunk + 2 offset leaf cubes 3 m; palm = trunk 0.4x5 + crossed flat green boxes on top. Water tower: 4 legs, 4x3x4 tank, 14 m high, once or twice along the course.
- Path ~4 m wide with kerb strips, gentle curves. Grass has sparse flower specks (0.2 m cubes `#FFFFFF`, `#F4C430`).

## Camera
- Chase cam: 4.5 m behind, 2.6 m above the bike, looks at a point 6 m ahead of the bike at 0.8 m height. FOV 62 (landscape vertical FOV). Near 0.3, far 120.
- Smooth follow: lerp position at ~6/s, lerp yaw slower (~3/s) so turns feel weighty. Slight roll (+-3 deg) into turns.
- On crash: pull back to 6 m / 3.4 m over 0.4 s; return when rider recovers. Speed lines: FOV +4 at top speed only.

## Lighting
- `DirectionalLight #FFF1D6` intensity 1.1 from (-30, 50, 20) (low-ish morning sun, gives roofs/walls a bright and a shaded face). `HemisphereLight` sky `#BFE3F5`, ground `#8DBE4F`, intensity 0.7.
- `scene.background` = sky colour; `scene.fog = new Fog(0xDFF1F5, 35, 90)`. Fog hides pop-in: spawn/despawn scenery beyond 90 m.

## Type and UI language
- Font: system stack only (no download): `ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif`; weight 800 for numbers/titles, 600 body. (A Google font e.g. Baloo 2 would add a network dependency; needs Leader approval. Not in v1.)
- Shapes: cream panels, 14 px radius, 3 px solid ink border `#2B2A33`, hard 0 3px 0 offset shadow (sticker/block feel, matches the blocky world). No gradients, no glass blur.
- Use `rem`/`clamp()` with viewport units; base size `clamp(14px, 3.2vh, 22px)` (landscape: height is the short side).
- Safe area: all HUD/panels padded with `max(12px, env(safe-area-inset-*))` on every side; `viewport-fit=cover`.
- Min tap target 48x48 px; main buttons 64 px tall. Respect `prefers-reduced-motion` (no shake, no pulse).
- `touch-action: none; user-select: none` on the game layer; no text selection / long-press menu.

## Screens (landscape)
**Start**: full-screen 3D scene (idle camera orbiting the start line, bikes parked) under a dim sun overlay. Centre-left: title "Kibbutz Bike Race" in two lines, 12vh tall, ink text with cream outline-stroke, small tilted yellow sticker "to the chadar ochel!". Below: orange pill button "Tap to start" (pulse scale 1 to 1.04, 1.2 s). Bottom: how-to line with two arrow icons: "Hold left or right side to steer. You pedal by yourself." Anywhere-tap also starts.
**Portrait hint**: when `orientation: portrait` cover everything with cream card, a phone icon rotated with a 1.5 s CSS rotate loop, text "Turn your phone sideways". Race pauses/hides. Pure CSS media query.
**HUD** (top edge only; middle and both bottom corners must stay empty, they are steering zones):
- Top-left: position pill "2/4" — number 7vh bold, "/4" smaller; pill turns yellow flash for 0.4 s on position change.
- Top-centre: timer "0:42.3" in cream pill, tabular numbers (`font-variant-numeric: tabular-nums`), 5vh.
- Top-right: progress bar 22vw x 1.4vh, track cream, 4 dots (player = player red-yellow, AIs their colours) sliding along; finish flag at the end. `pointer-events: none` on whole HUD.
- Start countdown: centre "3 2 1 GO!" huge, scale-pop, "GO!" in `#FFD23F` with ink stroke.
- Steering feedback: faint 10% white tint on the half being held (full-height, no border); no on-screen buttons.
**Results**: dark overlay 55% `#000`; cream panel centre, max 70vw. Title "Race over!" (or "You won!" in yellow banner). List 4 rows: place, coloured dot/bike icon, name ("You", "Avi", "Noa", "Tamar"), time; player row highlighted with yellow background and bold; crash penalty shown small "+2.0s oops" if any. Under the list: button "Race again" (orange, full width of panel, 64 px). Rows enter staggered 80 ms. Avoid the cramped feel: the panel must fit 4 rows at 320 px viewport height (row 7vh).

## Crash feedback (hit a walker)
1. Bike tips 80 deg sideways over 0.25 s, rider tumbles off (flat-pose rotate), speed to 0 and stays down ~1.5 s then stands, total ~2 s loss.
2. Camera: 0.25 s shake (+-0.15 m, decaying), pull back (see Camera). Skip shake when `prefers-reduced-motion`.
3. "Oops!" sticker pops in at screen centre-top (below HUD), 9vh, `#E5372A` on cream pill, rotated -4 deg, scale 0.5 to 1.15 to 1 in 0.25 s, stays 1 s, fades. Brief red vignette (inset box-shadow 0 0 12vh rgba(229,55,42,.35)) for 0.3 s.
4. Walker: stumbles back 0.5 m, tilts 25 deg, small "!" yellow box over head, then walks on.
5. Small `#FFFFFF` cube puff (6 cubes, 0.3 s) at impact. No sound in v1.
Grass slowdown: light dust cubes `#C9B98A` behind the bike while off path; slight camera bob.

## Don'ts
No purple-blue gradients, no glass/blur, no pure `#000` text, no emoji as icons (use CSS/SVG shapes), no centred-everything layout on Start.
