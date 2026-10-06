# HOODDINO — ALTERCO

An interactive WebGL world for the Italian rap artist **HOODDINO** and his 7-track project **ALTERCO**.
Not a landing page: one continuous, scroll-directed journey — alley → the seven tracks → liquid pass-through → rooftop —
with a hidden second universe (**DUALISMO**) waiting to be found.

```
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

> **V2 — second-pass visual overhaul.** Same architecture and interaction model as V1, rebuilt look: shader-level material
> variation + relief on every wall, a wetness *field* (asphalt / damp / standing water that grows along the journey),
> motivated cool-vs-warm light with haze and shafts, authored foreground layers and wall furniture, a camera that weaves and rolls
> past them, seven physical track objects hung from a truss ring, a fragment-assembly reveal of the official artwork inside a
> real frame, a liquid transition where the camera breaks the pool and falls through the mirrored alley, a procedural-facade
> skyline and wet rooftop with the artwork as a bolted billboard, and DUALISMO as a mirrored black-glass hall. See "V2 notes" below.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Three.js · React Three Fiber · Motion · GSAP + ScrollTrigger · Lenis · zustand.
All environment art is generated **procedurally** (canvas textures + code-built geometry). The only external imagery are the two
official covers, used exactly as supplied (resized/re-encoded to WebP/AVIF, never redrawn).

---

## The experience (scroll timeline)

| progress | scene | what happens |
|---|---|---|
| 0.00 | **Loader → ENTER** | Typographic preloader (HOODDINO / ALTERCO + live %). Nothing plays until the click. |
| 0.00–0.20 | **Alley** | Eye-level camera, real XYZ parallax from the pointer, steam, dust, flickering lamp, HOODDINO banner hung across the alley. |
| 0.20–0.34 | **ALTERCO** | Camera looks up; light-projected ALTERCO on the brick; the DUALISMO wheat-paste hides on the left wall. |
| 0.36–0.60 | **The Seven** | Seven real 3D cards orbit the artwork. Scroll/drag/swipe rotate it with inertia, snapping, hover repulsion, click-to-focus. |
| 0.60–0.72 | **Contamination → liquid** | RGB split, rippling reflections, artwork swells; camera dives into the puddle and passes *through* the water. |
| 0.72–1.00 | **Rooftop** | Release. Sunset → blue hour → night, string lights, skyline, the artwork floating over the city, CTA. |
| any time | **DUALISMO** | Find the portal → tunnel → an ethereal alternate space with the official artwork, two orbiting tracks, pointer-reactive particles. |

Time of day runs on scroll: *late afternoon → sunset → blue hour → night* (`lib/timeOfDay.ts`).

## Architecture

```
app/                    Next shell, metadata, global CSS
components/
  App.tsx               boot: capability check, asset loading, scroll rig, UI layers
  ScrollRig.tsx         Lenis smooth scroll → GSAP ScrollTrigger → rt.progress
  scene/                everything inside the <Canvas>
    Director.tsx        owns time: spring-smoothed scroll, GSAP param timeline, time-of-day, camera spline + pointer parallax
    StreetEnvironment / street/*   walls, windows, fire escapes, props, lamps (3 real lights hop between 8 lamps), decals, steam, cables, wet-ground reflections
    TrackOrbit.tsx      7-card orbit physics (spring, rate limit, hysteresis snap, drag momentum)
    AltercoArtwork.tsx  official ALTERCO sleeve (dissolve-from-fog, water drift, RGB split)
    RooftopEnvironment.tsx   code-split chunk, lazily built after ENTER
    DualismoWorld.tsx   code-split chunk: tunnel rings, artwork, two orbiters, particles, return rift
    PortalPoster.tsx    the hidden DUALISMO poster
  ui/                   DOM layer (Motion): Loader, HUD/nav, world typography, TrackUI/TrackFocus, FinalCTA, DualismoUI, cursor, toast, credits
effects/                PostFX (single HDR full-screen pass), SkyDome, Atmosphere
lib/                    runtime (shared per-frame state), store (zustand), timeline (camera path + checkpoints), textures (procedural), assets, audio, actions
data/                   project.ts · streaming.ts · audio.ts · credits.ts   ← all content/config lives here
public/covers/          official artwork (original JPEG + WebP/AVIF/thumb)
scripts/                optimize-assets.mjs · shoot.mjs · e2e.mjs · eggs.mjs · reduced.mjs
```

**True WebGL 3D:** the alley, fire escapes, lamps, orbit cards, artwork, rooftop, Dualismo space, reflections, particles.
**2.5D:** distant skyline layers and the far city (billboard silhouettes + lit-window layers) with atmospheric fog.
**DOM (Motion):** loader, nav, scroll-linked depth-layered titles, track readout/focus view, CTA, cursor, toasts, credits.

### Camera
`lib/timeline.ts` defines keyframes for two Catmull-Rom splines (alley, roof; position + look-at) and a monotone-cubic time warp so speed stays C¹.
`Director` feeds them a progress value that has passed through an under-damped spring (mass, tiny overshoot) and adds
weighted pointer parallax (lateral/vertical *translation* — near objects move more), breathing, velocity FOV-kick, intro fly-in.
A paused GSAP timeline whose time **is** the progress drives RGB aberration, contamination, liquid, grain, vignette, exposure.

### Post-processing
One custom pass (`effects/postfx.glsl.ts`) on a half-float MSAA target: chromatic aberration, bloom *only on HDR lights*,
liquid pass-through (domain-warped, uses the artwork as "water"), Dualismo radial tunnel, glitch, grain, vignette, ACES, sRGB.
Everything is uniform-gated; at rest the pass costs three taps.

## V2 notes

| area | what changed |
|---|---|
| Materials (`components/scene/street/materials.ts`) | One patched `MeshStandardMaterial` chunk set: per-cell brick-bond offsets (kills the tile repeat), screen-space relief from the height maps (`textureGrad`, seam-safe), macro warm/cool brick lots, soot, rising damp, drip streaks, patched/painted-over panels, decal chipping, wetness-field asphalt, cloth flutter, DUALISMO dissolve. |
| Wet ground | `puddleMask` is now a *field* (R depth, G damp, B oil). The puddle threshold falls with progress, so puddles widen from ordinary wet street to the pool; reflection strength, blur and thin-film oil tint are driven by the same field. |
| Light | `lib/timeOfDay.ts` re-keyed: cool sky fill vs warm sun/lamps/windows (no blanket orange); `AirLayers` adds drifting haze sheets and low-sun shafts; bloom uses a rotated Vogel disk (no rosettes). |
| Layers | `Foreground.tsx` (scooter, blade signs, awnings, laundry, bags), `WallDetail.tsx` (meters, conduit, wall lamps with spill, CCTV, vents, dishes, neon), irregular windows (12 states, per-instance tone), authored graffiti words. |
| Camera | Longer key set with lateral weave, rise and per-shot roll + speed bank (`lib/timeline.ts`, `Director.tsx`). |
| Tracks | `TrackObjects.tsx`: seven different objects (paste-up slab, lightbox, steel plaque, weighted banner, glass pane, positive/negative twin, lit billboard) on one orbit — different depths, heights, sizes; the front one steps forward; truss ring + wires + light cones. Orbit physics untouched. |
| Artwork | `AltercoArtwork.tsx`: 8×8 fragment assembly (scatter → RGB artifacts → lock) → the sleeve itself, inside a steel frame on legs with four uplights. The artwork is never edited. |
| Liquid | Camera leans over the pool, breaks the surface (shock ring, refraction, caustics, selective RGB), then falls through the alley rendered as its own reflection (`rt.mirror`) before emerging on the roof. |
| Rooftop | `effects/TowerMaterial.ts` procedural facades (per-building floor height / bay width / material; dark, warm, TV-flicker, blinds, lit office floors, dead columns), layered skyline with setbacks and crowns, wet roof with real reflections, artwork as a monumental billboard (`RoofBillboard`). |
| DUALISMO | Black-glass mirror floor, symmetric glass monoliths, mirrored crystals, spectral shafts + haze, lens halo around the official artwork; Chirone / Messaggio as point-symmetric opposing poles. Entering first dissolves the street (spectral highlights, swelling walls). |
| Opening | The alley is alive (dimmed, not black) behind the ENTER screen; cursor shows `EXPLORE` until the first scroll. |
| Performance | Reflection camera renders layer 0 only (`NoReflect`); laundry atlas, merged bags / wall lamps / haze / shafts. `node scripts/perf.mjs high` prints draw-call census. |

## Configure content

* **Streaming links** → `data/streaming.ts`. No URLs were supplied, so none are invented; services left `''` are never rendered
  (the UI shows "coming soon"). Per-track links override project links.
* **Credits** (hidden poster) → `data/credits.ts` (real credits were not supplied).
* **Audio** → `data/audio.ts`. Drop a licensed loop at `public/audio/ambient-city.mp3` and set the path; until then a tiny synthesised
  room tone is used. **No previews are generated.** Audio never starts before the explicit ENTER click and can be muted from the HUD.
* **Tracks/artwork** → `data/project.ts`. To replace artwork, overwrite `public/covers/*-official.jpeg` and run `npm run assets`.

## Placeholders to replace (nothing fake is shipped as "official")
* Artist portrait/photography: none supplied, none used. (If provided, add it to `public/images/` and wire it where you like.)
* Streaming URLs, credits, ambient audio loop — see above.
* `public/models`, `public/audio`, `public/environment` exist for future assets; the world is fully procedural today.

## V3.1 notes — street authenticity & the quiet secrets

| area | what changed |
|---|---|
| Graffiti | `lib/graffiti.ts` + `lib/graffitiSheet.ts`: seven families drawn by different "hands" (hand tags, throw-ups, wildstyle, blockbusters, stencils, wheatpaste/poster typography, handwritten notes). Each piece has its own scale / rotation / baseline / kerning / stroke / spray softness / drips / fading / erosion / cross-outs / paint-overs. Everything lives in **two texture atlases** (spray, paper) and is placed in one authored `LAYOUT` (`street/StreetGraffiti.tsx`) as instanced decals — 3 draw calls for the whole street's writing. Decals are patched into the street shader so paint breaks up on brick/mortar, and paper bows, curls and tears with contact shadows. |
| Numbers 01–07 | One per physical object (utility-box stencil, drainpipe sticker, door number, torn poster, fire-escape tag, rooftop tank marking, painted mark beside the water). Hover/rest (desktop) or tap (touch). No counter, no toast. |
| Anamorphic ALTERCO | `street/Anamorph.tsx`: painted on the road so it reads as a word **only** from the scroll camera's pose at progress 0.165. Near alignment: a hair of colour separation, a slight glow, a faint glass tone (only if sound is on). Silent. |
| Impossible puddle | The mid-alley puddle reflects a tall iridescent doorway that does not exist above it (analytic, works on every quality tier). Touch/hover: ripple + a flash in the pane + a far-off tone (sound on). |
| 7 / 7 | Seven numbers found → a dead sign (`HiddenSign` in `RooftopEnvironment.tsx`) on a far tower slowly lights, stuttering first. Nobody is told; without it the roof is complete. |
| After DUALISMO | `street/StreetMemory.tsx`, `Lamps.tsx`, puddle shader: a UV scrawl that never fully goes dark, a tiny glyph low on a wall, one lamp that occasionally splits into red/blue halves, one distant lamp whose colour depends on where you look, the egg puddle gains an iridescent edge. |
| Time | Windows each have their own hour (`aWin` instance attribute) and a few go dark late; steam thickens at dusk; the UV scrawl rises with the dark. |
| Track focus | The front track tints the light it stands in. |
| Ambience (optional) | `lib/audio.ts`: positioned (`PannerNode`, listener = camera) synthesised beds — alley traffic, lamp hum, ventilation, drips; rooftop wind/traffic/structural hum; a low abstract DUALISMO drone. **Only after the visitor enables sound**; nothing autoplays; no music is synthesised or previewed; the site works muted. |
| UI | `--ui-secondary` steps secondary chrome back during the liquid / dissolve / tunnel moments (never below 45 %; navigation stays). |
| DUALISMO | Centre line kept clear of haze, a soft dark pool of air behind the official artwork. The artwork is untouched. |

### Persistence & reset
Only three local keys are stored (`hd:nums`, `hd:dualismo`, `hd:dualret`) — no personal data, no accounts, no analytics.
Reset: open the site with `?reset=1`, or in a `?debug=1` session call `window.__hd.reset()`.

## Fonts & licences

Graffiti/poster lettering is drawn into canvas textures with a small, curated set of **self-hosted** families from [Fontsource](https://fontsource.org)
(npm packages; **latin subset, one weight each**; nothing is fetched from a third party at runtime). All are open-licensed for web use:

| family | used for | licence | source |
|---|---|---|---|
| Permanent Marker | hand tags, markers | Apache-2.0 | `@fontsource/permanent-marker` (Google Fonts) |
| Reenie Beanie | handwritten notes | OFL-1.1 | `@fontsource/reenie-beanie` |
| Rock Salt | scrawled tags | Apache-2.0 | `@fontsource/rock-salt` |
| Nanum Pen Script | handwritten notes | OFL-1.1 | `@fontsource/nanum-pen-script` |
| Titan One | throw-ups | OFL-1.1 | `@fontsource/titan-one` |
| Bungee | blockbusters, road paint | OFL-1.1 | `@fontsource/bungee` |
| Saira Stencil One | stencils | OFL-1.1 | `@fontsource/saira-stencil-one` |
| Playfair Display (900 italic) | poster typography | OFL-1.1 | `@fontsource/playfair-display` |
| Anton, Space Mono | site UI / posters (since V1) | OFL-1.1 | `@fontsource/anton`, `@fontsource/space-mono` |

No other external fonts, images or audio were added in V3.1. The ALTERCO / DUALISMO artworks are the supplied files, used unmodified.

## Easter eggs (spoilers)
<details><summary>Show</summary>

1. The nearest street lamp (left, start of the alley) switches off/on when clicked.
2. The torn poster on the left wall (~⅔ down the alley) hums with the DUALISMO artwork as the pointer nears — click it.
3. Seven small graffiti letters hide along the walls — find all and the word is revealed.
4. The seven numbers (01–07) are on seven objects: utility box, drainpipe, a door, a torn poster, the fire escape, the rooftop tank, the plaza beside the water. Find all seven and a dead sign on the rooftop comes alive.
5. The mid-alley puddle shows something that is not there. Touch it.
6. Stop the camera where the road paint says ALTERCO (about a sixth of the way in).
7. A half-hidden wheat-paste in the plaza reveals the credits.
8. A glyph on the rooftop parapet is a second way into DUALISMO.
9. Open all seven tracks → the rooftop warning lights turn white and chase.
10. Rarely, an RGB glitch flashes a line of hidden text.
11. Click the HOODDINO wordmark seven times.
12. A painted glyph on the left wall (~⅓ down the alley) only exists at a grazing angle.
13. If DUALISMO has been found, a faint iridescent glint stays on a distant tower on the rooftop; after you come back from DUALISMO the street is slightly wrong in a few places.
</details>

## V3.2 notes — the track installation + real-device performance

### Track experience (`lib/installation.ts`, `lib/trackRig.ts`, `components/scene/TrackOrbit.tsx`, `TrackTypography.tsx`)
The seven tracks are no longer a carousel. The plaza holds one installation: the official ALTERCO artwork stands at its centre and the seven
objects hang around it at their own depth / height / scale / angle from an overhead truss. The **camera walks around the outside** (one pose per
track, entry → 01 … 07 → back to the pool), always looking inward, so the artwork is the shared background of every composition and the
neighbours sit in peripheral depth. Dark steel poles stand just inside the camera path and slide past the lens between tracks.
* **Input**: the page scroll *is* the walk (`zoneT(progress)·6`); horizontal drag adds inertial offset (vertical drags stay with the page scroll
  on touch); idle input snaps magnetically (velocity-aware) to the nearest track. The camera never travels faster than 2.1 stations/s, so one aggressive
  wheel flick cannot skip four tracks — it passes each one. A tap on a neighbour travels there; a tap on the track in front opens a deeper focus where the
  **camera itself moves toward the track** (the object is not pulled to the camera). No modal: a compact caption + links, the scene stays visible.
* **Typography is environmental** (Anton, one cream/amber system, seven compositions built only from `alterco.tracks`): 01 assembles/obscured, 02 lifts,
  03 rigid and frontal, 04 monumental and vertical, 05 loosens (restrained), 06 two masses crossing in depth, 07 settles. A neighbour is only a ghost of itself.
* **Track UI** is minimal: `03 / 07`, previous/open/next, seven tiny dots. Portrait phones gather the composition toward the centre and dolly back.
* **Reduced motion**: no spring travel (fast critical damping), no float/sway, typography reveals instantly.

### Performance (`lib/quality.ts`, `lib/adaptive.ts`, `components/scene/PerfGovernor.tsx`)
* **Tiers** `ultra · high · balanced · mobile` (never shown to visitors): chosen from touch / screen size (phone → mobile, iPad-class tablet → balanced), cores, memory, GPU
  renderer string (software renderer → mobile) and `MAX_TEXTURE_SIZE`.
* **Adaptive manager** (`lib/adaptive.ts`): 1-second window averages (never one dropped frame); 3 consecutive slow windows (>24 ms) → first lower the DPR in 0.15
  steps (least visible), then drop a tier; 8 consecutive calm windows (≤18.2 ms ≈ locked 60 fps) + 12 s cooldown → restore DPR, then the tier, never above the device's
  initial tier; a restore that fails within 25 s blocks that tier for 90 s and makes the next restore more patient. Tab switches / world changes get a grace period.
  Live-adaptive: DPR, MSAA (HDR target re-allocated only on change), reflection cadence, bloom/grain, particle counts (draw range), track LOD reach.
* **Reflections** were the biggest cost (the planar reflection is a second full scene render: 194 of 399 calls at the opening). Now: refreshed at most every 0.25 s while the
  camera stands still, every N frames (N by tier) while moving, rendered with a short far plane, and the reflected scene is reduced (fire escapes, decals, cables, number marks,
  light cones, track typography/wires/uplights are drawn once, not twice; only the focused track is mirrored). The `mobile` tier uses the analytic reflection in the same shader.
  The impossible puddle works on every tier.
* **Section-based activation**: `useWorldFrame` — the rooftop, DUALISMO and street-only systems do no per-frame work while another world is on screen. Small alley systems
  (lamps, number marks, letters, fire escapes, UV paint, anamorph…) are distance-culled. Hit meshes use `material.visible = false` (still raycast, no draw call).
* **Hygiene**: no allocations in the lamp / particle / typography loops, pointer & scroll state stay in `rt` (no React state per frame), one-tap post-FX path when
  there is no chromatic aberration, `rt.stats` separates the main and the reflection pass.
* There are **no shadow maps** (contact shadows are baked decals), no per-frame raycasting (R3F raycasts on pointer events only).
* **Developer tools**: `?perf=1` shows FPS, smoothed frame time, DPR, tier, draw calls, triangles, textures, hitches and adaptation count (no analytics, nothing stored or sent).
  `?quality=mobile|balanced|high|ultra` pins a tier and turns adaptation off (legacy `low`/`medium` still work).
* `scripts/census.mjs <tier>` (per-section calls/tris averaged over real frames), `scripts/profile.mjs` (per-subtree attribution), `scripts/tracks-check.mjs` (input-feel behaviours).
  All headless runs use software GL: **counts only, never FPS**.

### Measured rendering census (headless software GL — **counts only, no FPS**)
Draw calls per frame, averaged over 24 real frames (`scripts/census.mjs`; "main + reflection" because the planar reflection is a second scene pass that is now throttled;
a headless frame is ~1 s long so *every* frame looks "stale" to the throttle — at 60 fps a standing camera refreshes the reflection ~4×/s, see the last column).
V3.1 = the deployed build at `7c6445b`, same machine, same script.

| section | V3.1 high | V3.2 high | V3.1 medium → V3.2 balanced | V3.1 low → V3.2 mobile |
|---|---|---|---|---|
| A opening alley | 400 | **235** (−41 %) | 398 → **212** (−47 %) | 215 → **174** (−19 %) |
| B mid alley | 248 | **165** (−33 %) | 246 → **159** (−35 %) | 169 → **148** (−12 %) |
| C tracks idle | 260 | **224** (−14 %) | 258 → **218** (−16 %) | 134 → 154 (+15 %) |
| D tracks, moving | 262 | 297 (+13 %) | 260 → **240** (−8 %) | 135 → 159 (+18 %) |
| E track focused | 250 | 297 (+19 %)¹ | 249 → 245 (−2 %)¹ | 130 → 155 (+19 %) |
| F rooftop | 132 | **81** (−39 %) | 132 → **78** (−41 %) | 67 → 67 |
| G DUALISMO | 132 | 133 | 132 → **100** (−24 %) | — → 67 |

¹ Headless artefact: at 60 fps a *standing* camera (idle / focused) pays main ≈ 194 + 103 × (4/60) ≈ **201** calls (−20 % vs V3.1), because the reflection refreshes at most every 0.25 s.
While the camera moves the reflection refreshes every frame (high), every 2nd frame (balanced) or not at all (mobile uses the analytic reflection).

The track section is the one place where the draw-call count is not lower on every tier: it is now a place (seven objects with their hardware, environmental typography, truss, poles, the artwork rig) and the
camera looks down the whole alley from the far side of the plaza, where the old carousel only ever looked at the plaza. Mitigations: proximity LOD (full cost only for the focused object + neighbours; phones draw only the focused
composition), one mirrored object instead of seven, short reflection far plane, distance culling of far alley props. Triangles: A 123k → 80k, C 59k → 60k, D/E 59k → 80k (high).
Textures are flat (71–88) and GPU resources stay bounded across world switches (e2e).

## V3.3 notes — THE HOODDINO ROOM

One authored space behind the street: the person and the process behind ALTERCO. Nothing in the street, the track installation, the rooftop, DUALISMO or the secrets was redesigned.

### What it is
* **Entrance** — a small prefab (corrugated steel, acoustic foam on the brick, an enamel plate *THE HOODDINO ROOM*, a red work lamp, a padded door) bolted to the **alley's left wall at z ≈ −67, just before the plaza** (scroll progress ≈ 0.327; `components/scene/street/StudioDoor.tsx`). Within ~13 m an `ENTER` chip appears (keyboard-reachable); the 3D door is clickable too; `MENU → THE ROOM` and `/?room=hooddino` (after ENTER) walk there and go in.
* **Threshold** — one continuous camera move (`lib/roomActions.ts`, `lib/room.ts`): street pose → in front of the door (the leaf swings open) → through the aperture → *(the world swaps while the dark airlock fills the frame behind a 0.2 s dip; the first room frames are drawn before the fade returns)* → entry station. Leaving replays it backwards and ends on the exact street pose the visitor left: the scroll position is never touched while inside.
* **Stations** (no WASD, no free camera; pointer = subtle parallax only): `entry hero → workstation → WHO IS HOODDINO? → live → exit`. ←/→, wheel, horizontal swipe, dots, prev/next. `Esc` closes the video focus, then exits. `BACK TO STREET` is always on screen.
* **Room** (`components/scene/room/`): workstation as the hero (vertical studio monitor, secondary arrangement view, MIDI keyboard, interface, monitors on stands, desk lamp, cables), bio wall, live wall, a lounge corner with a CRT-like display, the official ALTERCO artwork (untouched) as a framed print above the sofa — *not* a track selector. Motivated light only: desk lamp, blue LED strip, deep-red under-desk strip, orange LED frame, fluorescent fixtures, the dusk of the alley leaking through the open door. No DUALISMO entrance, cover, track or clue anywhere in the room.

### Real artist material (and where it is used)
| file in the media pack | delivery file(s) in `public/room/` | used for |
|---|---|---|
| `HOODDINO_PHOTO_02` (portrait, orange/white jacket) | `portrait-lo.webp` 384 px, `portrait-hi.webp` 1024 px | print on the WHO IS HOODDINO? wall |
| `HOODDINO_PHOTO_01` (live) | `live-lo.webp`, `live-hi.webp` | print on the live wall |
| `HOODDINO_PHOTO_03` (distorted) | `signal-lo.webp` 256 px, `signal-hi.webp` 768 px | the CRT-like display (restrained scanlines / jitter) |
| `HOODDINO_STUDIO_ARRANGIAMENTO_WEB.mp4` | `hooddino-studio-arrangiamento.mp4` (byte-for-byte copy) + `studio-poster.webp` (frame at 55 s) | the vertical monitor |
| `ROOM_REF_01–05` | — | visual direction only, not shipped |

`scripts/optimize-room-media.sh <pack>` regenerates the derivatives (originals are never modified). The brief names the source `ScreenRecording_10-04-2026 03-53-25_1.mp4`; the pack contained the web delivery file above, which is what ships.
**Video**: MP4, H.264 High@3.1 + AAC-LC 44.1 kHz stereo, 512×854 (portrait), 30 fps, 56.07 s, 4,860,666 bytes (≈4.6 MiB, ≈693 kbit/s overall), `moov` atom first (progressive start). Note the footage is an outdoor guitar session with burned-in captions, not a screen recording of a DAW.
**Biography**: exactly the supplied paragraph (`data/room.ts`), on the wall as a photocopied sheet, as real text in the DOM (`SemanticContent`, always present), and as a readable caption on portrait screens.

### Video (`lib/roomVideo.ts`)
Outside the room nothing exists. Approaching creates a detached `<video preload="none">` (no network, no decode). **PLAY is the only thing that attaches the source and starts picture + sound** — `play()` runs synchronously inside the click/tap (Safari/iOS), `playsinline` is set, audio is on *because the visitor pressed PLAY* (the optional ambience ducks while it plays). PLAY pushes the camera to the monitor and lowers the room lights; controls are real DOM buttons: `PLAY/PAUSE`, `SOUND ON/OFF`, time, `CLOSE` (pauses, restores camera and lights). Exiting the room pauses, drops the `src`, and disposes the `VideoTexture`. The 3D monitor shows a `THREE.VideoTexture` once the first frame is ready; `?roomvideo=dom` (or a future per-device switch) shows the same element in a vertical DOM frame instead; an undecodable source leaves the poster and offers the file as a link. Stock headless Chromium has no H.264 decoder, so the tests answer the mp4 request with a WebM re-encode of the same footage — **real Safari / iPhone / iPad testing is still required**.

### Social (spatial first, accessible always)
Spotify → the right studio monitor; TikTok → the phone on the desk; Instagram → the *LIVE DATES / UPDATED ON INSTAGRAM ↗* card on the live wall (no invented dates). Hover/focus wakes the object (screen / glow) and shows a small label (`SPOTIFY ↗`). A restrained quick-access list of the same three real URLs (`open.spotify.com/artist/6ETJU37OTsdfeTeDMN7oKI`, `instagram.com/hoodddddddd`, `tiktok.com/@hooddddddddd`) is always on screen inside the room (real `<a>`, new tab, ≥44 px targets) and in the semantic DOM.

### Performance & loading
* **Loading tiers** — initial page: nothing of the room (only +~28 KB of JS for the door, state and actions); *approach* (≈13 m from the door): the room's JS chunk, procedural shell textures and the low photo tier (≈55 KB) + poster; *committing to enter*: high-detail photos, the typographic walls and the paste-up atlas load during the 1.7 s walk to the door, textures are uploaded off-screen; *PLAY*: the video.
* **Activation** — the room group is hidden by `WorldGate` outside `rt.world === 'room'`; every room `useFrame` is `useWorldFrame('room')`; the street door is distance-culled (46 m) and drawn once (`NoReflect`), its airlock only exists while the door is opening. Inside, the street is a hidden world (no draw, no per-frame work), the SkyDome and Dust are hidden.
* **No extra reflection pass, no shadow maps.** Static geometry merged per material (≈12–22 draw calls), vertex-coloured props in one mesh, one decal atlas, contact shadows as one merged layer, up to 4 point lights (desk lamp always; fluorescent wash + blue fill from `balanced`; red accent from `high`). The CRT shader and its jitter run only in the room, are off with reduced motion, and the `mobile` tier uses a static texture instead.
* **Tiers** — `mobile` keeps the architecture, portrait, biography, video, links, ALTERCO print and the desk lamp; drops secondary decals, the high photo tier, props/cables, the shelf, the rug, extra lights, the CRT shader. Texture sizes follow the tier (`S()` in `lib/roomTextures.ts`).
* `?perf=1` already shows `world room`; `?quality=` is unchanged.

### Accessibility
Semantic biography/links/room description; `BACK TO STREET` always visible; stations reachable by keyboard and dots; video controls are labelled buttons with `aria-pressed`; `aria-live` narration of the room; touch targets ≥ 44 px; reduced motion = short damped moves, no idle drift, no CRT instability, instant station changes; the street entrance is offered by a real button, not only by the 3D door.

### Measured census (headless software GL — counts only, no FPS; `scripts/census-room.mjs`)
Draw calls / triangles per frame, averaged over 24 real frames (same method as V3.2).
| state | high | balanced | mobile |
|---|---|---|---|
| ROOM ENTRY (arriving) | 22 / 3.4k | 22 / 3.4k | 19 / 2.1k |
| ROOM IDLE | 21 / 3.4k | 21 / 3.4k | 19 / 2.1k |
| BIO WALL | 13 / 2.3k | 13 / 2.3k | 13 / 1.9k |
| WORKSTATION IDLE | 16 / 3.1k | 16 / 3.1k | 14 / 1.8k |
| VIDEO PLAYING | 15 / 3.1k | 15 / 3.1k | 14 / 1.8k |
| LIVE WALL | 12 / 2.2k | 12 / 2.2k | 11 / 1.9k |

Textures / geometries / programs: street at the door 79 / 161 / 78 (high) → inside the room 104–106 / 195–196 / 91–92 → after leaving 105 / 197 / 93. **After returning to the street the room's GPU resources (~25 textures, ~35 geometries, ~15 programs; texture memory not measured — sizes are capped at 1024² / 768² / 512² by tier) stay allocated; no room draw call and no room `useFrame` runs** (street frames after leaving are in the same range as at the door: 133–202 vs 130–235 calls on high, 118 vs 118–140 on mobile — the spread is the throttled planar reflection), and the **video element is paused with its `src` removed and its texture disposed**.
Street cost of the entrance (high, same machine, vs. the V3.2 build): initial load 30 → 32 requests, 1913 → 1941 KB JS; draw calls near the door ≈ +5–7 (merged shell + leaf + plate + lamp), none in the reflection pass, none beyond 46 m.

### Tests
`node scripts/room-check.mjs [tier] [WxH]` (56–58 checks: entrance, threshold, bio, links, explicit PLAY, no autoplay, pause/close/exit, release, keyboard, no console errors; `TOUCH=1`, `REDUCED=1`, `EXTRA='&roomvideo=dom'`, `BASEPATH=/sito-hood PORT=3100` for the static export), `scripts/room-shots.mjs` (visual walk-through), `scripts/census-room.mjs`, `scripts/street-calls.mjs`. Existing suites unchanged (E2E 22/22, secrets 18/18, tracks 8/8; `secrets.mjs` now waits for the pointer parallax in simulation time before the grazing-glyph click so it is frame-rate independent).

## V3.4 notes — site-wide rendering quality pass

Scope = the whole experience, not the iPad screenshots (those were *before* evidence of two symptoms). Method: a 21-checkpoint visual capture (`scripts/qa21.mjs`, desktop 1280×720 / tablet 1366×1024 / phone 390×844, software GL → pictures only) before and after, per-system code audit, then fixes ordered hero → midground → background. **No hardware FPS is claimed anywhere; real Safari / iPhone / iPad testing is still required.**

### Systemic findings → what changed
| finding | change |
|---|---|
| **Tablets were treated as low-end phones.** WebKit (iPadOS Safari and every iOS browser) reports a capped `hardwareConcurrency` and no `deviceMemory`, so `cores ≤ 4` demoted capable iPads to the `mobile` tier (DPR 0.8–1.2 on a ×2 panel) — the soft, blocky look. | `detectTier`: a tablet starts at `balanced` (only an explicit ≤2 GB report or a weak/software GPU demotes it). DPR caps raised: high 1.5→2, balanced 1.4→1.75, mobile 1.2→1.5 (min 0.85); the V3.2 adaptive manager still steps DPR/tier down on sustained slow windows. `?perf=1` now prints drawing-buffer vs CSS size and the device ratio. |
| **Screen-space DOM title words (HOODDINO / ALTERCO)** floated in front of the lens, blurred, clipped, and covered the lower-right of tablet viewports. | Physical objects instead: the existing HOODDINO banner (z −26) plus a new hung ALTERCO banner (z −50) on four cables, fogged/occluded like everything else; the DOM keeps only a quiet one-line caption per title. The glitch "whisper" egg is size-capped. |
| **Room entrance not discoverable** from the authored path (dark porch, out of frame, no state until 13 m). | Lit enamel plate, light leaking round the leaf and threshold, a slow red lamp with halo, a faint pavement spill; the `ENTER THE HOODDINO ROOM` state now appears ~18 m before the door (touch-sized). |
| **Brick = flat rounded rectangles; texel density fixed at 2.3 mm.** | Per-brick kiln gradient, sand-face speckle, chipped corners, hairline cracks, grainy mortar; density follows the tier (1280 / 1536 / 2048 px, 1.9 / 1.5 / 1.1 mm) with a 1024² bump map. The finer tile is generated **after ENTER, one slice per frame**, and swapped into the live textures (`lib/assets.upgradeBricks`) — the loader waits for the base tile only (loader 12.4 s → 12.8–13.6 s headless, within noise). |
| Detail below texture resolution shimmered / looked synthetic at close range. | `uMicro` micro-surface (34 and 97 cycles/m aggregate + pitting on albedo and roughness), faded out between 5 and 15 m (no shimmer, off on `mobile`). Anisotropy ×2 on high/ultra for oblique asphalt, floors, walls. |
| Windows were flat planes pasted on the wall. | Instanced jambs give a ~15 cm reveal around every window (one extra draw call). |
| Metals had no environment (pure metals reflect nothing → black). | Analytic, roughness-aware sky reflection in the street shader (warm horizon / cool zenith / dark ground, desaturated, Fresnel at grazing angles) — no extra render pass; per-world sky (street, roof, DUALISMO, room). |
| Track hardware was cut-out boxes. | Rounded (2-segment) frames and bodies on the hero hardware (`GeoBuilder.rbox`). |
| Rooftop skylights were glowing slabs lying on the deck. | Curbed skylights with a thin pane and mullions; roof night fill raised. |
| DUALISMO: milky lift, over-bloom. | Iridescence only in the lights (no black lift), gentle S-curve, bloom ×0.65 there, deeper fog/hemisphere. CHIRONE, MESSAGGIO and the return logic are untouched. |
| Room: dark, floating screens. | Monitors are a body + raised bezel with the screen recessed ~2 cm; brighter walls and a stronger fluorescent wash; the video lives on a physical vertical display. |

Audited and left as is: tone-mapping/colour management (HDR target → ACES → `1/2.2`, sRGB for colour maps and the video, linear for data), post (chromatic aberration is ≈0 until progress 0.16 and grows narratively), reflections (V3.2 throttled planar pass kept — nothing returned to per-frame cost), shadows (still none: baked contact decals).
**KTX2 / Basis / Draco were audited and not adopted**: every environment texture is generated on a canvas at runtime (GPU-compressing a canvas would need a build-time bake of procedural output) and the only downloaded images are the WebP covers and ≤107 KB room photographs; no GLTF/photo-texture pipeline exists to benefit. The decoder paths therefore do not exist to break under `/sito-hood/`.

### Measured (headless software GL — counts only, same method as V3.2; `scripts/census.mjs`, `census-room.mjs`, `street-calls.mjs`, `load-time.mjs`)
Draw calls per frame (avg of 24 frames, main + reflection):
| section | V3.2 high | V3.4 high | V3.2 balanced | V3.4 balanced | V3.2 mobile | V3.4 mobile |
|---|---|---|---|---|---|---|
| A opening | 235 | 237 | 212 | 214 | 174 | 175 |
| B mid alley | 165 | 168 | 159 | 165 | 148 | 154 |
| C tracks idle | 224 | 226 | 218 | 216 | 154 | 154 |
| D tracks moving | 297 | 301 | 240 | 244 | 159 | 161 |
| E track focused | 297 | 299 | 245 | 246 | 155 | 155 |
| F rooftop | 81 | 78 | 78 | 81 | 67 | 67 |
| G DUALISMO | 133 | 128 | 100 | 100 | 67 | 67 |

Triangles are **higher** (window jambs, bevelled hardware): street p = 0.2 high 81k → 101k, p = 0.327 high 71k → 92k, balanced 60k → 78k. Textures 71–93 (unchanged ±2), geometries +3. Room census (draw calls / triangles): ROOM ENTRY 22 / 3.5k, IDLE 21 / 3.5k, BIO WALL 13 / 2.3k, WORKSTATION 16 / 3.2k, VIDEO 15 / 3.2k, LIVE WALL 12 / 2.3k (high & balanced; mobile 19–11 / 2.2–1.9k); after leaving the room its textures/geometries stay allocated but nothing is drawn and the video is paused with its `src` dropped. Initial load: 32 requests, 2575 → 2580 KB (JS 1941 → 1947 KB).

### Still below the V3.4 target (honest list)
* Building massing is still boxy; there are no real shadow maps, only baked contact decals, so some hung / stacked props still read as slightly pasted. Window interiors have no parallax.
* The plaza ground is still a flat plane with texture variation; the distant skyline is blocky (aggressively cheap by design) and its windows repeat.
* DUALISMO remains additive-blend based; it is darker and cleaner but not "high-end" in the sense of real volumetrics.
* The room is intentionally dark; the entry hero is readable but dim on small screens.
* Triangle count rose ~25 %; draw calls did not.
* Everything above was judged on software-rendered captures. **Real Safari / iPhone / iPad testing (tier chosen, DPR reached, adaptive behaviour, WebKit texture upload of the swapped brick tiles, video texture) is still required.**

## V3.5 notes — real-device performance stabilisation

**Trigger.** V3.4 was tested on a real device and "can lag heavily". That is treated as a confirmed production issue. **Scope received for V3.5: this performance addendum only** — no further V3.5 visual brief / shadow-system brief arrived, so this pass is a performance-stabilisation pass: no new geometry, no shadow maps, no new volumetrics. (The addendum's rule for a future hybrid shadow system stays binding: no broad dynamic shadow maps; only important lights/objects, tightly fitted, minimal casters, disabled outside their world.)

**Method.** Profile first, with tools in `scripts/` (headless software GL = **relative** numbers only; nothing here is a device FPS):
`perf-frame.mjs` (wall frame-time distribution p50/p95/p99/worst, JS cost per `useFrame` callback and per `gl.render` submit, JS-heap allocation per frame, React commits via the DevTools hook), `perf-ablate.mjs` / `perf-ablate2.mjs` (hide one system at a time), `perf-alloc.mjs` (V8 sampling heap profiler), `perf-calls.mjs` (draw objects in view per material), `perf-wall.mjs` and `perf-compare.mjs` (interleaved A/B of render configurations in one session).

**What the profile said (V3.4, balanced tier).**
* **React/R3F re-renders: none** (0 R3F commits during steady state). **`useFrame` JS: negligible** — every scene callback 0.01–0.16 ms; the only large item is the PostFX callback = the scene render *submit* (≈5–8 ms for 160–240 draw calls).
* **Allocation 160–200 KB/frame** is almost entirely three.js internals proportional to draw calls (`getParameters` ≈ 60, uniform setters ≈ 50, program-key joins ≈ 10 KB/frame) — not our code. Not the lag source (minor GCs), tracked with the draw-call count.
* **Draw calls are already moderate** (≈130–170 objects in view, + the reflection pass every 2nd frame at balanced); triangles 60–110k. Not a GPU limit on a tablet-class device. Invisible worlds already cost nothing (`WorldGate` hides them; roof/DUALISMO are generated lazily).
* **The cost is pixels.** Frame time scales with drawing-buffer area (internal scale 0.6 → ≈45 % less time in the proxy). A tablet at canvas DPR 1.75 draws ≈ 3 M pixels into an HDR half-float, **MSAA-2**, mip-chained target, and V3.4's adaptive manager needed ~20 s to settle and re-allocated every buffer on each DPR step (a hitch of its own). That combination — heavy start, slow reaction, destructive steps — is the best explanation of "lags heavily" and what V3.5 attacks.

**Changes (in the order of the addendum's priority list).**
1. *Per-frame CPU*: nothing material left in JS; the frame's main-thread time is now measured (`rt.cpuMs`) and used by the manager to tell CPU-bound from GPU-bound.
2. *Re-renders*: none found; none added.
3. *Culling invisible worlds*: verified (WorldGate, DistCull/FarGate); nothing further.
4. *Transparent overdraw / shaders*: the haze sheets and light shafts (full-width overlapping layers) and the street surfaces now read one shared **baked tileable noise texture** (256², 1 fetch) instead of 15–20 sin/hash noise evaluations per fragment; the sky dome is drawn **last with a far-plane depth test**, so its fbm shader only runs for visible sky pixels instead of the whole screen. Visually unchanged (screenshots compared). **Honest note: the headless proxy could not resolve a gain from these three changes** (run-to-run noise ±15 %, texture fetches are expensive in software GL); they remove ALU/overdraw work on real GPUs but are *not measured*.
5–6. *Instancing / LOD*: draw calls and triangles are not the bottleneck (above) → no geometry work; no detail was added in V3.5 (the addendum forbids buying realism with GPU load).
7. *Reflections*: unchanged cadence/resolution (already per tier); the manager now moves to the lighter tier first when the main thread is the limit.
8–10. *Particles / volumetrics / shadows*: unchanged. No shadow maps introduced.
11. **Internal render scale** (the main lever): the scene is rendered into a *viewport* of the same HDR target and the post pass samples the matching region (`uScale`/`uMax`, bloom taps included) — **no re-allocation, effective on the next frame**. Quantised levels 1 · .9 · .82 · .75 · .68 · .62 · .56 · .5, floored so `canvas dpr × scale` never drops below the tier's `dprMin` (a 1.75-DPR tablet bottoms out at ≈1.0 effective density, i.e. never visibly "blurry-low"). Canvas DPR is now fixed per tier and changes only with a tier change.
12. *Hero quality*: untouched. Pinning (`?quality=…`) still disables adaptation; `?scale=0.4–1` pins the scale for testing.
* **MSAA** is off at a drawing-buffer density ≥ 1.5 device px per CSS px (stair-steps are not resolvable there; MSAA cost is real bandwidth), kept below that. The HDR target's **depth is no longer resolved** each frame (it is never sampled).

**Adaptive manager (rewritten, `lib/adaptive.ts`).** 0.5 s windows; two bad windows (or one < 24 fps window) trigger a step; the step is proportional (`scale' = scale·√(16.7 ms / frame time)`, 1–3 levels); CPU-bound frames go straight to the tier; the tier drops only when the scale is at its floor; restoring is a *probe* (one level up after 10 s of calm; a failed probe is undone after one window and that level is locked out for 2× longer each time — no oscillation); sustained frames > 250 ms (a device at < 4 fps) now count as evidence (a lone one is still treated as a tab switch); touch devices start at scale 0.9 and ramp up once proven; a stable ~30 fps on a heavy device is accepted rather than flapped. `scripts/adaptive-sim.mjs` runs it closed-loop against synthetic devices (capable, borderline, too heavy, very heavy, hopeless, < 1 fps, CPU-bound, desktop): settles in 2.5–5 s, no flapping, 0 % jank after settling for the 60-fps-capable cases.

**`?perf=1` HUD** now shows p95 / p99 / worst frame time, tier, canvas dpr and **render scale**, JS ms and CPU/GPU-bound, calls, triangles, drawing-buffer size and the *render* size, hitches, and the last adaptation events.

**Measured (headless software GL, relative, interleaved A/B, median of 3 rounds; tablet-like 512×384 @2× → canvas dpr 1.75, buffer 896×672):**

| configuration | street p=0.16 | tracks p=0.46 |
|---|---|---|
| V3.4 (MSAA 2, depth resolve, scale 1) | 100 % | 100 % |
| V3.5 default at that density (no MSAA, no depth resolve, scale 1) | 77 % | 79 % |
| V3.5 + scale 0.85 | 59 % | 59 % |
| V3.5 + scale 0.75 (effective density 1.31) | 49 % | 50 % |
| V3.5 + scale 0.6 | 36 % | 38 % |

At canvas dpr 1 (desktop) MSAA is kept, so only the scale rows apply: measured with MSAA off, scale 0.85 → ≈ 80 %, 0.75 → ≈ 68 %, 0.6 → ≈ 57 % of scale 1 (the MSAA-on baseline at dpr 1 was not A/B-measured). **These are relative software-GL numbers. No real-device FPS is claimed.** The real-device comparison (the actual success criterion: smoother than V3.4 on the device that lagged) still has to be done on that device: open `?perf=1`, scroll the journey, and read p95/p99, scale and adaptation events.

**Not changed / limits.** Safari/iPhone/iPad were not available; WebKit behaviour of the render-target viewport path is standard WebGL 2 but unverified. `rt.cpuMs` measures JS submit time; on a back-pressured GPU that can read as CPU-bound, so the manager falls back to scale steps when the lighter tier is exhausted.

**Tests.** E2E 22/22, secrets 18/18, tracks 8/8, room-check 50/50 in desktop, touch and reduced-motion variants (production build, `quality` pinned where the suites pin it); `scripts/adaptive-sim.mjs` passes; static export under `/sito-hood/` re-verified (see below).

## V3.6 notes — extreme photoreal hero-world rebuild

**Dependency.** This work is stacked on PR #5 (V3.5 performance foundation, branch `claude/hooddino-v3-5-performance`). Everything V3.5 delivered is kept: HDR target with **internal render scale**, the fast quantised adaptive controller, MSAA density rule, no depth resolve, baked shader noise, sky-dome-last, `?perf=1`, `?scale=`. PR #6 targets the PR #5 branch so its diff is only V3.6; retarget to `main` after PR #5 merges. Nothing here was merged.

**What this pass is.** Not a performance pass: the visual world was rebuilt towards photographic credibility (geometry, construction logic, contact, materials, light) while paying for it only where the camera actually looks.

### Audit — what read as "CG" in V3.5 (and the cause)
GEOMETRY/CONSTRUCTION: facades were flat planes with window pictures floating 5 cm in front; no reveals, piers, cornices, parapets. CONTACT: kerb absent (ground plane met the sidewalk box), no gutter/crown/drains. SILHOUETTE: stacked-box skyline, no plant, no setbacks. SHADOW: contact blobs only. MATERIAL/TEXTURE SCALE: brick tiled at a single scale (already partly broken up by V3.4 cell offsets). ROOM: unlit-looking shell, floating objects, no constructed furniture. DUALISMO: raw bloom on flat planes.
**Colour / camera / post audit conclusion:** the pipeline is coherent (scene rendered into a linear half-float HDR target, one manual `pow(1/2.2)` encode in the post pass, bloom/grain applied there); the checkpoint cameras use a 42–50° vertical FOV, which is a normal-to-slightly-long lens. Only change: exposure keyframes for the roof (`lib/timeline.ts`) so the roof reads lit rather than crushed. **Post restraint was kept** — no new bloom was added to hide anything (DUALISMO in particular did *not* just gain bloom).

### What was rebuilt
* **Facades** (`street/facadeBuild.ts`, `Facades.tsx`): walls are built **with openings** — a wall surface with rectangular holes and four reveal faces per hole (vertex-colour AO: open at the face, closed at the back), so windows/doors are shafts cut into the wall with parallax and a shadowed inside. Brick piers every second bay with caps, belt courses and floor lines, a corbelled cornice, parapet + coping, chimneys, water tank, bulkhead, mast. Window surrounds (sill, lintel, two casing strips) are instanced plain boxes; sashes sit at depth; **lit windows use interior mapping** (a ray vs a virtual room box in window space) inside 24 m only. Street-level doors/shutters are recessed with thresholds.
* **Ground as topography** (`street/groundBuild.ts`, `Ground.tsx`): crowned road falling into a shallow gutter dish at each kerb, plaza grading, **1.8 m stone kerb blocks** (chamfered edge, per-block tone, 1-in-4 chipped corner) and cast-iron storm drains; the ground is a handful of large slabs (see the performance lesson below). Water is a reflection sheet whose edge noise, far-field reflection and tap clamp are distance-relaxed.
* **Props/utility**: front-load dumpster rebuilt (ribbed tub, rim, lids, fork pockets, casters), track-pole flanges, truss guy-cables with wall plates, eyebolts, turnbuckles.
* **Skyline** (`street/cityBlocks.ts`, `effects/TowerMaterial.ts`): stepped towers with cornice bands, plant, tanks, masts; near/mid depth bands; one merged mesh/one draw call; tower material gained reveal shadow, sill highlight, pilasters/spandrel, slab-edge lines.
* **Rooftop**: castShadow parapets/bulkhead/tank, deck receives the sun; exposure/hemi/sun retuned.
* **ROOM** (`components/scene/room/*`, `lib/room*.ts`): dark identity kept; motivated entry light, constructed studio (baseboards, ceiling beams, acoustic panels, wood floor, desk with keyboard/monitors/speakers/headphones, flight case, sofa + rug), the video is a real monitor surface (still no autoplay), lazy build + full cleanup, DOM fallback intact.
* **DUALISMO** (`DualismoWorld.tsx`, `DualismoShaders.ts`): rebuilt as a composed set — a framed artwork plinth, glass pylons with reflective floor, iridescent rings, atmospheric gradient (no bloom crutch); CHIRONE/MESSAGGIO labels remain readable; **official artwork untouched**. Draw calls at entry fell from 111 → 33.

### Shadows — HYBRID, measured, small
ONE `DirectionalLight` shadow map, `autoUpdate = false`, refreshed on demand with a **tightly fitted** ortho frustum per world (alley snapped to 12 m, plaza every 2 frames, roof ≈ every 20); map size by tier (high 1536 · ultra 2048 · balanced 1024 · **mobile 0 = none**); PCF 5-tap on high+, 1-tap on balanced. Receivers are limited to ground/sidewalk/kerb/roof deck (a `receiveShadow` fragment costs a per-pixel branch, so walls only *cast*); the wall sun-band samples the map manually and only above the sun line. Everything else keeps baked vertex AO and contact shading. **Measured cost ≈ 0** in the headless proxy (full 1198/1233 ms vs shadows-off 1186/1174 ms, 640×360 high); **honest visual value: modest** (a sun-pool edge and a few cast bars) — kept because it is free at its fit size and tier-gated, removable by setting `shadow: 0` in `lib/quality.ts`. No broad dynamic shadows; nothing enabled on mobile.

### Performance (headless software GL: RELATIVE numbers only, never FPS)
Street frame, interleaved A/B (A,B,A,B on the same machine, 960×540, high, alternating **PR #5 vs V3.6**), median frame ms: p=0.02 **1795 / 1759 vs 2186** (+23 %), p=0.16 **1718 / 1649 vs 2090** (+24 %), p=0.40 **1290 / 1569 vs 959** (noise exceeds the difference). Earlier at 640×360, p=0.16: 1067/1005 vs 1198/1233 (≈ +17 %). So the street costs roughly **+20 %** of pixel work in the proxy; the render-scale controller from PR #5 absorbs that on a device that cannot afford it. Triangles: street 79 k → 120 k, ROOM 3 k → 46 k, DUALISMO 36–44 k → 17–20 k (draw calls 111 → 33).

Census (`scripts/census36.mjs`, production build, 960×540, scale 1; wall time is a single non-interleaved run → **noisy, indicative only**):


### high
| checkpoint | calls PR#5 → V3.6 | tris | textures | geometries | rel. headless ms |
|---|---|---|---|---|---|
| 1 opening-street | 191 → 189 | 79k → 120k | 72 → 74 | 133 → 132 | 1435 → 2547 (178 %) |
| 10 mid-alley | 189 → 175 | 84k → 117k | 74 → 76 | 135 → 134 | 1555 → 2270 (146 %) |
| 11 deep-alley | 177 → 135 | 82k → 99k | 80 → 81 | 156 → 150 | 1539 → 1706 (111 %) |
| 13 track-plaza-wide | 205 → 143 | 72k → 90k | 82 → 84 | 169 → 170 | 1042 → 1030 (99 %) |
| 14 track-01 | 171 → 138 | 58k → 89k | 82 → 84 | 170 → 171 | 985 → 975 (99 %) |
| 23 rooftop-wide | 80 → 80 | 9k → 9k | 87 → 88 | 212 → 208 | 885 → 896 (101 %) |
| 26 room-entry | 21 → 21 | 3k → 46k | 110 → 115 | 245 → 249 | 264 → 492 (186 %) |
| 27 room-workstation | 16 → 16 | 3k → 46k | 110 → 115 | 245 → 249 | 306 → 494 (161 %) |
| 30 room-video | 15 → 15 | 3k → 46k | 111 → 116 | 245 → 249 | 267 → 340 (128 %) |
| 32 dualism-entry | 111 → 33 | 36k → 18k | 115 → 121 | 262 → 271 | 417 → 294 (70 %) |
| 33 dualism-wide | 133 → 36 | 44k → 20k | 115 → 121 | 262 → 271 | 430 → 325 (76 %) |

### balanced
| checkpoint | calls PR#5 → V3.6 | tris | textures | geometries | rel. headless ms |
|---|---|---|---|---|---|
| 1 opening-street | 191 → 189 | 79k → 120k | 72 → 74 | 133 → 132 | 1247 → 1848 (148 %) |
| 10 mid-alley | 189 → 175 | 84k → 117k | 74 → 76 | 135 → 134 | 1235 → 1876 (152 %) |
| 11 deep-alley | 152 → 134 | 70k → 99k | 80 → 81 | 156 → 150 | 1140 → 1448 (127 %) |
| 13 track-plaza-wide | 164 → 141 | 55k → 90k | 82 → 84 | 169 → 170 | 895 → 1020 (114 %) |
| 14 track-01 | 158 → 137 | 53k → 89k | 82 → 84 | 170 → 171 | 823 → 870 (106 %) |
| 23 rooftop-wide | 80 → 80 | 9k → 9k | 87 → 88 | 212 → 208 | 852 → 918 (108 %) |
| 26 room-entry | 21 → 21 | 3k → 46k | 110 → 116 | 245 → 251 | 254 → 412 (162 %) |
| 27 room-workstation | 16 → 16 | 3k → 46k | 110 → 116 | 245 → 251 | 311 → 440 (141 %) |
| 30 room-video | 15 → 15 | 3k → 46k | 111 → 117 | 245 → 251 | 303 → 353 (116 %) |
| 32 dualism-entry | 100 → 35 | 32k → 17k | 115 → 121 | 262 → 271 | 406 → 275 (68 %) |
| 33 dualism-wide | 100 → 35 | 32k → 17k | 115 → 121 | 262 → 271 | 395 → 246 (62 %) |

### mobile
| checkpoint | calls PR#5 → V3.6 | tris | textures | geometries | rel. headless ms |
|---|---|---|---|---|---|
| 1 opening-street | 175 → 174 | 71k → 105k | 71 → 71 | 133 → 132 | 1465 → 684 (47 %) |
| 10 mid-alley | 161 → 160 | 69k → 102k | 73 → 73 | 135 → 134 | 916 → 658 (72 %) |
| 11 deep-alley | 123 → 121 | 58k → 87k | 79 → 78 | 153 → 150 | 889 → 1056 (119 %) |
| 13 track-plaza-wide | 109 → 104 | 32k → 43k | 80 → 78 | 163 → 164 | 621 → 687 (111 %) |
| 14 track-01 | 104 → 100 | 32k → 42k | 80 → 78 | 163 → 164 | 644 → 632 (98 %) |
| 23 rooftop-wide | 69 → 69 | 8k → 8k | 84 → 81 | 209 → 198 | 678 → 677 (100 %) |
| 26 room-entry | 19 → 20 | 2k → 32k | 107 → 106 | 240 → 240 | 166 → 138 (83 %) |
| 27 room-workstation | 14 → 15 | 2k → 32k | 107 → 106 | 240 → 240 | 154 → 165 (107 %) |
| 30 room-video | 14 → 15 | 2k → 32k | 108 → 107 | 240 → 240 | 159 → 183 (115 %) |
| 32 dualism-entry | 67 → 24 | 21k → 10k | 110 → 109 | 257 → 260 | 187 → 195 (104 %) |
| 33 dualism-wide | 67 → 24 | 21k → 10k | 110 → 109 | 257 → 260 | 148 → 157 (106 %) |

**Lessons paid for in measurements (so they are not repeated):** (1) a dense displaced ground grid (26 k triangles) made the heavy asphalt shader run on sub-pixel quads and roughly doubled the street frame in the proxy → the ground is a few large slabs and topography lives in the kerb/gutter strips; (2) `RoundedBoxGeometry` is 300+ triangles — it must never be an instanced template (window surrounds are plain boxes; 530 k → 134 k triangles); (3) interior mapping is near-only (24 m) and the water reflection blur is 5 fixed taps; (4) headless SwiftShader is pixel-bound, so these are *pixel-cost* numbers; real GPUs will weigh triangles/draw calls differently.

### Artefacts found by the final QA and fixed
A white 1-px speckle appeared over the far wet road at the hero facade cameras (03/02/01). It was **not** the ground, kerbs, shadows or the water mask: the planar reflection render was aliasing bright sky against thin geometry at the mirrored horizon. Fix: damp-asphalt reflection relaxes to the analytic horizon colour with distance, taps are clamped (puddles keep their full reflection), and the sheet's edge noise/relief distortion fade with distance. (The dotted columns visible at 08/10 are the existing 01–07 number-trail particles, not a defect.)

### Before/after — the 36 checkpoints (1280×720, high, same cameras; baseline = PR #5)
Verdict key: ▲ clearly better · △ better · ≈ similar. "Reads as filmed?" = would I believe it was filmed, and what is still CG (cause).

| # | checkpoint | verdict | still CG because |
|---|---|---|---|
| 1 | opening street | ▲ | TEXTURE SCALE (brick repeats), flat MATERIAL on doors/sheet metal |
| 2 | facade near | ▲ | TEXTURE SCALE, laundry/pipes are simple GEOMETRY |
| 3 | facade medium | ▲ | CONSTRUCTION of the far fire escapes; far ground now smooth |
| 4 | hero window | ▲ | MATERIAL — sash has no glass reflection/dirt |
| 5 | door threshold | ▲ | TEXTURE on the door; bin CONTACT |
| 6 | fire-escape/utility | △ | GEOMETRY of signage/laundry |
| 7 | wet asphalt | △ | TEXTURE SCALE of the asphalt grain, LIGHTING bounce |
| 8 | kerb/gutter | ▲ | TEXTURE on kerb stone |
| 9 | puddle | △ | REFLECTION is smooth-edged (no ripples/film) |
| 10 | mid alley | ▲ | GEOMETRY of repeated windows |
| 11 | deep alley | ▲ | ATMOSPHERE good; skyline still stylised |
| 12 | room exterior | △ | silhouette of the entrance |
| 13 | track plaza wide | △ | GROUND texture at plaza scale |
| 14–20 | tracks 01–07 | ≈/△ | artwork billboards are *designed* objects; only lighting/ground changed |
| 21 | ALTERCO transition | ≈ | transient effect (timing differs between runs) |
| 22–25 | rooftop entry/wide/hero/skyline | △ | LIGHTING flat on deck; skyline detail is texture-light |
| 26 | room entry | ▲ | constructed studio; MATERIAL of the floor planks is flat |
| 27 | workstation | ▲ | still CG: soft shading on small props |
| 28 | who is hooddino | △ | UI-forward by design |
| 29 | live photo wall | ▲ | paper/tape fine; wall TEXTURE |
| 30 | room video | ▲ | video is a real monitor surface; bezel detail simple |
| 31 | dualism transition | ≈ | effect-driven |
| 32–36 | DUALISMO entry/wide/CHIRONE/MESSAGGIO/return | ▲ | composed set with depth; still stylised by intent |

Honest summary: the street, window, door, kerb and ROOM checkpoints now read as *constructed* spaces. They would not pass as filmed: the causes are TEXTURE SCALE/MATERIAL (flat diffuse response, one-pass grime) and the absence of area-light bounce — not geometry any more. DUALISMO is stylised by design.

### Tablet strategy
Unchanged mechanism (PR #5): adaptive render scale first; tier last. V3.6 adds nothing that bypasses it: shadows are off on `mobile`, interior mapping is near-only, the ROOM/DUALISMO worlds are built lazily and cleaned up on exit. **No blurry-tablet regression is claimed or measured on a device.**

### Tests (production build, software GL, final V3.6 code)
E2E **22/22**, secrets **18/18**, tracks **8/8**, room-check **56/56** desktop · **56/56** touch · **56/56** reduced-motion · **58/58** with `?roomvideo=dom` (DOM video fallback) — no console errors. Static export (`STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/sito-hood`, served under `/sito-hood/`): smoke (loader → ENTER, canvas, no failed requests, no console errors) and room-check **58/58**. The 36 checkpoint captures were taken from the build immediately before the last reflection-clamp tweak; checkpoints 08 and 10 were re-shot after it. `scripts/perf-ab36.mjs` (interleavable relative frame-time probe) and `scripts/census36.mjs`/`qa36.mjs` are the tools used here.

### Limits
Headless timings are relative; no Safari/iPhone/iPad/real-device FPS was measured; WebKit behaviour of the render-target viewport path is unverified; the ROOM video was exercised with a WebM re-encode (stock Chromium cannot decode H.264).


## Temporary public preview (static export)

`STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/sito-hood npm run build` writes a fully static site to `.next-export/` (verified under a sub-path with `scripts/serve-sub.mjs` + `scripts/smoke.mjs`: no failed requests, no console errors).
`.github/workflows/preview.yml` publishes it to GitHub Pages. One-time: **Settings → Pages → Source: GitHub Actions**, make sure the workflow file is on the default branch, then **Actions → Preview (GitHub Pages) → Run workflow**.
The preview URL is then `https://<owner>.github.io/<repo>/`. Delete the Pages site (Settings → Pages) to take it down. Normal `npm run build && npm start` is unchanged.

## Performance & quality tiers
* Canvas DPR fixed per tier (caps in `lib/quality.ts`), MSAA on the HDR target only (off at density ≥ 1.5), **internal render scale** + tier adaptation by `PerfGovernor` / `lib/adaptive.ts` (see V3.5 notes).
* Tiers also switch: planar reflections (real ↔ fake), reflection resolution, particles, steam, bloom, grain.
* Draw calls: facades merged per material, windows/shutters/doors/decals instanced, one merged mesh for the tower field, 3 real lights hop between 8 lamps by distance (no popping).
* Rooftop and Dualismo are separate JS chunks and are generated after ENTER during idle time, then shader-compiled by first sight.
* All textures are canvas-generated (≤1024²) or WebP covers (≤1144²) — no 4K textures. Geometry is code-built, so Draco/KTX2 aren't needed; add them if you later import GLTF/photo textures.
* Resources are disposed on unmount; `scripts/e2e.mjs` asserts no GPU geometry/texture growth across world switches.
* `?quality=high|medium|low` pins a tier (and disables adaptation). `?debug` exposes `window.__hd` for the test scripts.

## Accessibility
Semantic `<h1>`/tracklist/links always in the DOM (`SemanticContent`), `aria-live` scene narration, keyboard access to nav/tracks (Esc, ←/→ in focus view),
`prefers-reduced-motion` (no pointer parallax or camera sway, no spring overshoot, liquid/tunnel become crossfades, glitch off),
custom cursor only on fine pointers, no-WebGL fallback page, optional (never required) device-tilt on mobile.

## Testing
```
npm run dev
node scripts/e2e.mjs  <outDir> 1280x720      # 22 behavioural checks + screenshots (software GL)
node scripts/eggs.mjs                         # real-pointer Easter-egg tests
node scripts/reduced.mjs <out.png>            # reduced-motion
TOUCH=1 node scripts/shoot.mjs <outDir> 390x844 low 0,0.3,0.46,1   # mobile screenshots
```
(Headless Chromium uses software GL, so FPS there is not representative — the suite checks behaviour, not speed.)
