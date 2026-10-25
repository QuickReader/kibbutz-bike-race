# DESIGN v2 — Kibbutz Bike Race

Look only. Gameplay, track, controls, AI, sim unchanged. Reference render: `preview.html` (built from the same helpers described here; Frontend may lift `solid()`, `person()`, `bike()`, `ik()` from it).

Feel: BOLD CARTOON. Thick dark outlines, strong flat colours, soft 3-step toon shading, big-headed friendly people, sunny kibbutz morning. Comic sticker UI.

## Rendering rules
- Full resolution: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, `setSize(innerWidth, innerHeight)`, `antialias: true`. Remove `image-rendering: pixelated` and the 0.6 scale.
- Core Three r170 only. No external models, textures, fonts, libraries.
- **Toon shading**: `MeshToonMaterial({ color, gradientMap })`, one shared gradient map = `DataTexture(Uint8Array[95,160,220,255], 4, 1, RedFormat)`, Nearest filters (3 visible bands + highlight). Cache one material per colour. No shadow maps. Shadow = flat dark ellipse under each actor (`#1B2A10`, 20% opacity, polygonOffset).
- **Outline rule**: every character, bike, house, tree, tower and hall part gets an inverted-hull outline: same geometry, `ShaderMaterial` with `side: BackSide`, vertex pushed along an averaged (position-welded) normal by `0.012 + 0.0035 * viewDepth` m (keeps a near-constant on-screen line, about 2-3 px at 720p). Thin variant (`0.006 + 0.002*d`) for small parts (hands, face, spokes, handlebar). Colour `#2A2233` (never pure black), blended to the fog colour with distance so far outlines fade. Not outlined: ground, path, flowers, clouds' far hills, tiny face details (pupils, blush, brows).
- Outline geometry shares the mesh geometry (just a second mesh); averaged normals computed once per geometry (`onormal` attribute) so box corners do not gap.
- Sky: gradient dome `#CDEBFA` horizon to `#3FA9F0` top, `fog: false`. Fog `#CDEBFA`, near 45, far 150 (hull outlines use the same values). Soft cartoon clouds = 4 outlined white spheres, squashed in z; two far hills, no outline.
- Lighting: `DirectionalLight #FFF1D6` 2.2 from (-30, 50, 20); `HemisphereLight` sky `#CFEFFF` / ground `#BFD98A` 1.9. Bright and flat-ish; shadow side must stay light.

## Palette
| Use | Hex |
|---|---|
| Ink (outlines, UI borders, text) | `#2A2233` |
| Grass A / B (8 m squares) | `#8ED043` / `#7CC338` |
| Path / kerb / dashed centre line | `#CFC6B4` / `#F4EEDF` / `#F4EEDF`; dark edge line under kerb `#2A2233` |
| Walls (mix) | `#FFF1D6`, `#FBE7B8`, `#E9F1D8` |
| Roofs (mix) | terracotta `#D2573A`, `#C24A32`, blue `#3F7DB8`; tile lines `#9D3A26` |
| Door/shutters (mix) | teal `#4C7A8C`, `#2E8FA3`, terracotta `#D2573A`; glass `#BFE7F4`; trim `#D9CDB5` |
| Trees | eucalyptus `#6FB07F` `#7CC08C` `#5FA070`; cypress `#2F7A45` `#3E9457`; trunk `#8A6240` |
| Water tower | legs `#BDB8AE`, tank `#F0EADB`, cap `#D04A32`, band `#2E6F8E` |
| Dining hall | walls `#F6E3B8`, roof `#D2573A`, columns `#FFFFFF`, sign board `#2E6F8E` with cream lettering block |
| Finish arch | posts `#FFFFFF`, banner `#FFD23F` with `#2A2233` checks |
| Player (unique red+yellow) | bike `#FF3D2E`, shirt `#FFD23F` + red chest stripe, white helmet with red stripe, yellow basket with red lid, navy shorts `#34406B` |
| AI bike + shirt | blue `#2D6CDF`, purple `#8B4FD0`, teal `#12A594` + white shirt stripe; no helmet, own hair |
| Walker shirts | `#D96C8E`, `#5AA0D8`, `#9AA0A6`, `#7BBF6A`, `#E8A33D`; trousers `#4A4F63` `#6B5B45`; never red/yellow |
| Skin | `#F1C9A0`, `#C68E5E`, `#8D5A3B`; cheek blush `#F08A7E` |
| Hair | `#3A2A1A`, `#1E1A16`, `#8A5A2B`, `#B8B2A8` |
| UI cream / sun / accent / oops | `#FFF6E0` / `#FFD23F` / `#FF8A1F` / `#E5372A` |

Rule: the player is the only red+yellow thing in the scene. Keep roofs terracotta (not red), nothing yellow on walkers or AIs.

## Figure anatomy (metres, about 1.8 m total, face = +z)
Hierarchy: `root > hip(y 0.86) > upper(torso, neck, head, arms)` + `hip > leg x2`. All parts outlined.
- Pelvis: sphere r 0.17 (y scale 0.75), trouser colour.
- Torso: capsule r 0.17, length 0.2, z squashed 0.74, shirt colour; optional 0.07 stripe band.
- Neck: cylinder r 0.06, h 0.12, skin.
- Head: sphere r 0.2 (y 1.04) at +0.79 above hip. Ears: spheres r 0.045. Nose: sphere r 0.034. Eyes: white sphere r 0.052 (z squashed 0.5) at x +-0.075, y +0.035 with dark pupil r 0.03 and a 0.012 white glint; brows: tiny dark capsules angled; smile: half torus r 0.045 tube 0.009, dark red; blush: pink flattened spheres.
- Hair (pick per person): `short` cap (sphere cap theta 1.85, tilted back 0.35 rad) + side tufts; `pony` (cap + capsule + pink tie); `bun`; `long`; `curly` (4 spheres on top); `cap` (blue brim + cap); `bald`. Helmet (player): dome r 0.225, theta 2.0, red stripe.
- Arm: shoulder pivot (+-0.235, +0.47): shoulder ball r 0.075 + upper arm capsule r 0.062 (shirt = short sleeve), length 0.3 to elbow; forearm capsule r 0.05 length 0.28 (skin), hand sphere r 0.065.
- Leg: hip pivot (+-0.1, 0): thigh capsule r 0.085, 0.4 to knee; shin capsule r 0.065, 0.4 (skin if shorts); shoe: sphere r 0.08 scaled (0.95, 0.6, 1.5), forward-offset 0.06.
- Animation: walkers swing hips +-0.55 rad, knee 0.05-0.85 on the forward swing, arms +-0.5 with elbow 0.3, body bobs 0.03 m, ~2 Hz. Riders: torso lean 0.55 rad, head counter-rotated, legs and arms solved with two-bone IK (`ik()`: thigh+shin to pedal, upper+fore arm to grip) so knees and elbows bend correctly while the crank turns; wheels spin. Crash pose: reuse v1 tilt/tumble on the `tilt` group; the "!" mark stays a yellow capsule + dot over a stunned walker.
- Scale riders by 0.9 relative to walkers if the camera needs it (head still reads).

## Bike (front = +z, wheelbase 1.16 m)
- Wheels: torus r 0.34 tube 0.045 (`#2C2833`), inner rim ring and 3 crossing spokes `#DAD6CC`, hub sphere. Radius 0.37 m.
- Frame: thin cylinders (r 0.018-0.032) joining bottom bracket, seat, head tube, rear and front hub in bike colour; fork and stem `#5A5560`; handlebar bar r 0.022 with two grip blobs; saddle flattened capsule `#2C2833`; chainring disc, crank arms and pedals (a `crank` group the animation rotates).
- Player extras: rear rack + yellow basket 0.34x0.14x0.26 with red lid (kept small so the rider's back reads).

## Props
- House: 6x3x5 body, plinth, extruded-triangle pitched roof (overhang, 3 tile lines, chimney) or flat roof with parapet; arched door, window with white cross + two shutters, sill, flower balls, doorstep. Mix wall/roof/trim from palette; per-instance +-4% brightness.
- Eucalyptus: leaning trunk cylinder r 0.22 plus 3 overlapping spheres (r 1.3-1.9). Cypress: slim sphere scaled (0.85, 3.1, 0.85) plus lighter highlight blob. Palm: trunk + 4-5 flattened curved leaf capsules.
- Water tower: 4 tapered cylinder legs, cylinder tank r 2.4, cone cap, blue band.
- Dining hall: v1 layout (16x4.5x9, porch, 4 columns, sign board, banner arch) built from rounded/outlined parts; sign board gets a plate-and-spoon icon in cream.
- Ground flowers: 0.12 m spheres (white, yellow, pink), instanced, no outline.
- Path: 4 m wide ribbon, cream kerb ribbon, ink edge ribbon, dashed centre line.

## Camera
Unchanged from v1 (4.5 m behind, 2.6 m up, FOV 62, roll into turns, crash pull-back) except: far plane 220, sky dome radius 200. Preview uses (0.35, 2.4, -4.7) looking at (0, 1, 6). Menu camera: low, 3/4 front view of the lined-up riders and walkers so faces are visible.

## Type and UI (cartoon sticker style)
- Font: system only: `"Arial Rounded MT Bold", ui-rounded, "SF Pro Rounded", "Trebuchet MS", system-ui, sans-serif`, weight 900 (rounded and heavy on Apple, bold sans elsewhere). Tabular numbers for time.
- Base size `clamp(14px, 3.2vh, 22px)`; HUD in `vh` units.
- Every panel/pill: cream `#FFF6E0`, 0.55vh solid ink border (min 3 px), radius 2vh, hard offset shadow `0 0.7vh 0 ink`, slight tilt (-3 deg to +3 deg) on stickers. No gradients except diagonal progress stripes, no blur/glass.
- Safe area padding on all four sides; tap targets >= 48 px, main buttons 64 px; `touch-action:none`, no selection; honour `prefers-reduced-motion` (no pulse, no shake).
- HUD (top edge only, middle and bottom corners stay clear): top-left yellow tilted position badge ("2" 10vh + "/4"); top-centre cream timer pill 5.4vh; top-right progress bar (white track with orange diagonal-stripe fill, outlined 4.6vh player dot red with yellow underline, AI dots blue/purple/teal, checkered flag tilted 6 deg at the end). Steering feedback: faint white tint on the held half.
- Countdown: 3 / 2 / 1 / GO! 28vh, white (GO yellow) with thick ink stroke and 1vh hard drop shadow, scale-pop.
- Oops sticker: red text on cream pill, ink border, rotated -4 deg, pop 0.5 to 1.15 to 1.
- Start menu: title "Kibbutz Bike Race" two lines, 12vh, ink text with thick cream stroke plus offset ink shadow, a yellow tilted sticker "to the chadar ochel!", orange pill button "Tap to start" (pulse 1.04), how-to strip in a cream sticker. Scene behind: menu camera on lined-up cast, no dark overlay.
- Results: dark 55% overlay; cream sticker panel, max 70vw; title "Race over!" or yellow "You won!" banner tilted -2 deg; 4 rows (place, bike-colour dot, name, time), player row yellow; "Race again" orange button; fits 4 rows at 320 px height.
- Portrait hint: unchanged behaviour, sticker-style card.

## Performance budget (mid-range phone)
- Pixel ratio cap 2. Target 60 fps, floor 30. If frame time averages above 25 ms for 2 s, drop pixel ratio to 1.5, then 1.
- Draw calls <= ~150. Static scenery (houses, trees, tower, hall) merge per type + `InstancedMesh`; outlines merged the same way (second merged mesh with the hull shader). Instance count unchanged from v1.
- Actors (4 riders + ~10 walkers): each ~35 small meshes x2 for outline is too many unmerged, so Frontend merges the non-animated parts per body piece (head, torso, each limb segment) into 1 mesh + 1 outline each (about 12 draws per person) and culls beyond 85 m (existing). Use vertex colours for the merge.
- Geometry detail: spheres 14-20x10-14 segments, capsules 5x12, torus 8x28; never more.
- Outline shader: one shared material per thickness, no per-frame uniform updates.
- Fog hides spawn/despawn at 150 m; far plane 220.

## Don'ts
No purple-blue gradients, no glass/blur, no pure `#000`, no emoji icons (CSS/SVG shapes), no sound, no external fonts/models/textures, no shadow maps, no outline on the ground, no red/yellow on non-players, no HUD in the middle or bottom corners.
