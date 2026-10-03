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

## Temporary public preview (static export)

`STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/sito-hood npm run build` writes a fully static site to `.next-export/` (verified under a sub-path with `scripts/serve-sub.mjs` + `scripts/smoke.mjs`: no failed requests, no console errors).
`.github/workflows/preview.yml` publishes it to GitHub Pages. One-time: **Settings → Pages → Source: GitHub Actions**, make sure the workflow file is on the default branch, then **Actions → Preview (GitHub Pages) → Run workflow**.
The preview URL is then `https://<owner>.github.io/<repo>/`. Delete the Pages site (Settings → Pages) to take it down. Normal `npm run build && npm start` is unchanged.

## Performance & quality tiers
* Renderer DPR clamped (`≤1.5` high / `1.25` medium / `1` low), MSAA on the HDR target only, adaptive tier drop (`PerfGovernor`) if frame time stays > ~26 ms.
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
