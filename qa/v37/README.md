# V3.7 verification evidence

Work is based on V3.6 main `d03c0297c9df1be1b171cf199d151f25674fff5f`
and Claude's partial V3.7 `f9b5c301762e0b2844fa1f34856df050d5e0a9b9`.
Main contains the V3.5 performance foundation and V3.6 structural rebuild.

The verification run is produced by `scripts/verify37.mjs`. `results.json` records exact
commands, configurations, timestamps and exit codes; `logs/` contains full output.
Photographic captures use `qa37-lib.mjs`: eight inward and eight outward plaza
directions, seven authored track poses, the distant rear passage, and twenty
ROOM checkpoints including ceiling, floor, rear/side walls and exit.

Measurements use Linux Chromium with SwiftShader. Wall-frame times are relative
software-rendering evidence, not hardware FPS. Real Safari/iPad/iPhone behavior
and sharpness remain unverified. Touch tests emulate input in Chromium.

The packaged video `public/room/hooddino-studio-arrangiamento.mp4` contains outdoor
guitar/rap footage, not the studio/arrangement recording requested by the brief.
Its authentic content is retained. Chromium video tests use a WebM transcode of
the same complete source; they do not establish native H.264 or Safari support.

Build and paired performance results are recorded in `REPORT.md`. All 19 required stages have a passing latest attempt in `results.json`; complete results and limits are linked in [TESTS.md](TESTS.md). An unexecuted or failed stage is not a pass. Photographic acceptance is not achieved, despite complete sampled plaza coverage.

## Implemented completion work

The inherited plaza blocks, bridge, loading dock, utility hardware and background
layers are retained. The additional fix addresses a separate alley-mouth defect:
the former return planes faced away from the plaza. Both returns now face the
visitor, have actual recessed openings, use the shared instanced windows, and
carry physical plinths, coping, string courses, pilasters and drainpipes.

The first complete rotation also exposed overly sparse central side-wall bays
and incorrectly oriented electrical cabinets. Each side now has recessed
service access in the central bay, plus its retained corner entry. These use
the existing instanced door materials and actual wall openings. Stone plinths
stop at doorways, thresholds remain clear, and merged hinge/handle hardware
provides physical construction. Cabinet glazing faces into the plaza and
risers connect continuously to the overhead cable tray. The old separate
surface door planes are removed. No additional draw-call category is introduced.

ROOM changes retain the existing constructed desk, equipment, acoustic shell,
photography, biography and navigation. Additional work includes suspended fabric
absorbers and their supports, display and interface connections, distinct small
bump response for plaster/wood/fabric/floor, bounded roughness variation, warm and
cool local irradiance, and practical-light bakes separated from wall albedo.
The ceiling fixture and high-tier monitor use finite area lights rather than
point sources placed in free space. Their shared LTC resources are loaded with
the ROOM module; no extra reflection target or realtime GI is introduced.

Video display shaders now decode VideoTexture samples from sRGB to linear once.
Still images already use hardware sRGB decoding and are not decoded twice.
Existing explicit playback, inline mode, lazy allocation and release are retained.

Development-only `NOPOST=1` captures remove bloom, grain, vignette, chromatic split
and major narrative distortion while preserving camera exposure/tone mapping.
The override requires `?debug` and never appears in the ordinary product UI.
A separate `NOPOST=1 NOFOG=1` sweep removes global scene fog in the owned
inspection page for five HERO frames. World particle sprites and volumetric
geometry remain; this does not claim that every atmospheric effect is absent.

Wet reflections now sample a generated mip chain using the projected pixel
footprint and surface roughness. Three filtered vertical taps replace five
unfiltered taps. Reflection targets also explicitly avoid depth resolve; their
resolution and update cadence remain unchanged. The mip chain adds roughly one
third of the reflection colour storage and must be included in the relative
performance comparison. The existing wetness mask, Fresnel, reflection-horizon
correction and interactive puddle are retained.

The first Fresnel isolation appeared successful, but normal and no-post final
captures still showed white water. That verdict is retained as an error in the
audit history. Readback subsequently found NaN pixels in the reflection target;
those values spread through the filtered mip chain. Street-material output initially discarded non-finite fragments. The paired
performance comparison then exposed unacceptable overhead. Final output
recovers the finite lighting terms without discard, preserving opaque depth
rejection; practical lamp halos use one instanced billboard draw. A temporary live probe showed
eight successive finite readbacks and a nonempty reflected scene. Final proof
comes from the fresh production build, not these temporary shader experiments.
The ALTERCO channel-split branch also uses the same filtered, bounded samples.
`reflection-health.mjs` checks actual half-float contents after photographic and
performance samples. Baseline invalid values are recorded; V3.7 rejects them.
The diagnostic images/logs and earlier failed verdict remain available.

Original captures are 960×540 PNGs at high tier and internal scale 0.75.
Review WebPs use quality 94, and contact sheets are resized review aids.
Evidence is kept outside `public/` and is not part of the deployed site payload.

## Infrastructure correction

An initial regression attempt failed because an export build ran while the normal
Next server was using an earlier manifest. This Next version's static-export
build also replaces normal build outputs, producing stale JavaScript references
and 404 requests. The normal server was stopped, its build recreated, and the
suite restarted. `logs/infrastructure-stale-build.log` retains that failed
attempt. Successful results refer to the subsequent coherent build.

## Photographic timeout and resumption

The first final sweep captured checkpoints 1–30 but exceeded the camera-settlement
timeout before checkpoint 31. That attempt remains failed in the retained historical results files; its
full log is retained as `logs/photographic-final-attempt1-timeout.log`.
Resumption retains the settlement assertion and increases the allowance to ten
minutes for software rendering. Existing captures are reused only for the same
production build ID, viewport, tier and post configuration.

The original far-ahead inspection pose was obscured by the installation artwork.
The fresh complete sweep uses a checkpoint behind the installation to inspect
the passage directly. The camera is recorded in each final manifest. Production
navigation and artwork are unchanged.

## Final numerical and measurement checks

Current implementation is `4a455df`. Prior candidate captures and measurements are preserved separately; final current-source verification is complete with all 19 required stages passing. Bump derivatives are computed outside the varying footprint branch. Fully filtered bump sampling is skipped, and a zero surface determinant retains the geometric normal. The final production build, typecheck and isolated `/sito-hood/` export build passed. Capture/measurement passes establish valid evidence, not photographic quality or acceptance of every performance increase.

The current nine-view software comparison is recorded in `performance-v36.json`, `performance-v37.json` and `REPORT.md`. The rear plaza and rooftop show material relative increases; an additional serial three-view comparison uses forty warm-up frames and twenty distinct rendered-frame intervals to investigate stable cost. Both methods remain software wall-time proxies, not GPU/device FPS.

ROOM captures after the playing-video checkpoint wait for focus dimming to
return to its resting state before judging equipment, fabric and walls.
The actual camera, station and focus amount are recorded per final frame.

## Threshold inspection correction

The initial final checkpoint 39 put a post-entry inspection camera in the
airlock before the room front wall. It captured a featureless proxy/wall
rather than the physical threshold. That original pose/state is retained
in `threshold-pose-before.json`; the original front/exit proxy was subsequently replaced with the actual opposite alley segment. A corrected inside-room view
looks toward the doorway casing and floor threshold. This is a QA camera
correction; production navigation and the transition are unchanged.

`RECAPTURE=39 RESUME_SHOTS=1` replaces only that selected frame in a matching
61-frame manifest, retaining all other captures and guarding build/configuration.
The serial verifier includes this correction as a separate recorded stage.


## Native input fixture corrections

The first final Easter-egg run failed the door hover and its dependent persistence check. Dedicated mouse/touch click coverage passed for the same unchanged number. The hover fixture now reprojects after camera parallax and waits actual simulation dwell, retaining its hover-only assertion.

The first ROOM touch run passed 60 checks and failed the left swipe; its complete log is retained. Sequential CDP acknowledgments can insert slow GL frames between native touch events and turn a quick swipe into a hold. The fixture now queues the native start/move/end events together and records trusted pointer events and actual timing. The right-swipe assertion also requires starting at station 2, so it cannot pass by remaining at station 1. Final retest results are recorded separately; product gesture handling is unchanged.

The verifier archives preceding logs before any failed-stage retry, and retains every attempt in the results history.

The next Easter-egg attempt passed the corrected door hover/persistence but failed the grazing glyph click (20 passed/1 failed). Its old coordinate was computed before pointer parallax. That fixture now re-aims in simulation time and clicks the current projection, retaining the real-click and registered-secret assertions; the dedicated secrets suite already passes the same unchanged glyph. The latest complete current-source Easter-egg retest passed 21 checks with zero failures; see the stage log in TESTS.md.

The latest current-source complete touch retest passed 61 checks with 0 failures and no console/hydration errors. [Native event proof](native-gesture-proof.json) records trusted touch down/move/up events and both real station transitions. No product gesture-handling change was needed.

Before/after captures match declared camera poses, viewport, tier and render scale. Particle animation and playing-video timestamps are not synchronized between runs; comparisons are visual scene audits, not pixelwise image-difference or video colorimetry measurements. The complete source video is unchanged in both versions.

## Further implementation after the prior audit

The shared vestibule formerly had opaque end caps, which hid both views through the open door. Both caps are removed. Source-local baked lighting, physically scaled plaster, skirting, conduit/clips, switch and a mounted utility strip replace the uniform brown passage. The interior view now contains the actual opposite street segment from the existing layout, with its real window/door/shutter positions, reveals, course, kerb and asphalt; textures remain shared and local geometry/materials are disposed. The old luminous rectangle and its texture are removed. Surfaces are batched by material and frustum culled.

The studio ceiling uses a lighter painted substrate and localized floor/desk light return, retaining contact occlusion. Masonry unit variation is restrained to avoid repeated isolated black/white units. New distant plaza materials use a separate PBR path with two projected baked-noise samples, two sun/sky directional BRDFs and static vertex irradiance from the installed practical lamps; invisible micrograin and redundant fragment light loops are omitted. Studio spatial light fields evaluate per vertex; a 0.4 m floor grid preserves local interpolation. Their masonry relief, PBR lighting, bounce and ALTERCO deformation remain. No plaza architecture is removed. Current source captures and measurements establish the recorded visual coverage, strict photographic grades and relative software-cost limits; they do not establish device performance.

The final physical-height audit calibrates world-space masonry/concrete/plaster/asphalt/roof bump in millimetres and removes baked lit-top/shaded-bottom masonry strokes from albedo. Concrete and intact plaster no longer receive the masonry kiln/tile shader.

The first full current-source Easter-egg attempt passed 20 checks and failed the grazing glyph click while its PORTAL hover assertion passed. The dedicated secrets suite passed the same real click. Read-only live inspection records the actual glyph centre at x=-2.9 m in [glyph-fixture-centre.json](glyph-fixture-centre.json); the legacy aim x=-2.95 lay 5 cm behind its plane, close to its projected edge at a grazing angle. The fixture now projects the actual centre, strictly waits for pointer/camera settlement and less than 0.4 CSS px drift, then clicks the established hover point and waits simulation response. It retains the real-click/registered-secret assertion. The complete latest retest passed after the serial regression; its earlier failed attempt and geometry proof remain recorded. No product glyph or event handling is changed.

All 135 frames were actually inspected; see [FRAME-REVIEW.md](FRAME-REVIEW.md) for strict grades and matched evidence. Street filmed: NO. ROOM photographed studio: NO. Sampled reachable 360° plaza constructed: YES. Camera-visible empty plaza background observed: NO.

The final grazing-glyph retest preserves the actual centre and all three projections in [glyph-retest-proof.json](glyph-retest-proof.json). Observed drift fell from 22.88 to 0.67 to 0.040 CSS pixels before the native click registered the egg; the complete suite then passed 21 checks.

## GitHub publication

Authenticated writing now succeeds after reconnecting GitHub. The branch is published and [draft PR #7](https://github.com/BoninaBID2527/sito-hood/pull/7) targets main. Earlier 403 responses are historical. No merge or deployment is performed, and photographic acceptance remains unmet.
