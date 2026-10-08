# HOODDINO × ALTERCO — V3.7 implementation and verification

Implementation candidate with a complete sampled 360° plaza and a rebuilt studio construction/material/light pass. **Photographic acceptance is not achieved.** All 135 current/baseline frames are actually reviewed. All 19 required verification stages and both additional three-view cost probes have passing latest attempts. Functional passes do not establish photographic acceptance or a real-device performance-budget pass.

## Git and starting point

V3.6 baseline/main: `d03c0297c9df1be1b171cf199d151f25674fff5f`.
Inherited Claude V3.7: `f9b5c301762e0b2844fa1f34856df050d5e0a9b9`.
Implementation: `4a455df52441e2d0b53a748b41f25637586b1062`. Prior candidate: `3882a72`, preserved separately.
Branch: `codex/hooddino-v3-7-completion`. Main is not modified.
The V3.5 performance and V3.6 structure are ancestors of main; the final
implementation retains the adaptive controller, quality configuration,
runtime and sky-overdraw foundation byte for byte. The production post pass
retains its internal viewport scale, density-based MSAA and no-depth-resolve
behavior. Its only additional mode is a debug-only post-effects inspection.

## Street, photographic materials and lighting

The final material audit separates concrete and covered plaster from masonry tile/kiln shading. Concrete panel seams, form-tie recesses and small casting holes now have matching height relief. Intact plaster masks the brick height beneath it, leaving mortar only in the actual peeled regions. World-space bump derivatives previously received metre-scale height coefficients (brick 1.4, road 0.8, roof 0.9), producing exaggerated relief. The calibrated full height ranges are masonry 8 mm, concrete 10 mm, peeled plaster 12 mm, asphalt 12 mm and roof coating 6 mm; actual relief also depends on the height data range. Five-decimal shader constants preserve millimetre values. Intact plaster stands approximately 1.5 mm above exposed brick. Brick unit tone/height scatter and rare burnt units are restrained; repeated lit-top/shaded-bottom strokes are removed from albedo so bevel/mortar lighting comes from surface response. Real tile scale remains 2.4 m / 11 units horizontally and 32 courses vertically (approximately 218 × 75 mm including joints). No texture resolution increase is used to conceal repetition.

Street bounce now enters PBR indirect diffuse, rather than self-emission. Its existing calibrated diffuse brightness is retained while metallic surfaces cease to receive diffuse coloured glow. The complete new mid/background plaza uses a separate PBR material path with two projected baked-noise samples, matching metre-scale relief and no invisible micrograin. A scalar vertex irradiance field comes from actual installed lamp locations, separate from albedo. Its PBR sun/sky key and fill, hemisphere contribution, baked installed-practical irradiance, metre-scale masonry relief and narrative deformation remain; no 360° architecture is removed.

Claude's kiln variation, facade/window refinements and coloured analytic street
bounce are retained. The final wet-ground correction follows an actual
no-post audit: the opening still contained a clipped white stripe after the
initial reflection changes. The earlier disappearance verdict was incorrect.

Readback found non-finite half-float values in the planar reflection target.
A few thin/clipped street and prop fragments can poison the filtered mip chain
under SwiftShader. The exact compiler/math producer was not established by the
single-material probes. The first correction discarded fragments with non-finite outgoing radiance.
The paired probe then exposed unacceptable overhead. The final correction
recovers finite diffuse, specular and emissive contributions without fragment
discard, preserving opaque depth rejection. Practical lamp halos also share
one instanced billboard draw instead of separate sprite draws. Bump sampling
and perturbation are skipped when the existing footprint filter is exactly
zero; derivatives remain outside the varying branch. A zero surface determinant
returns the geometric normal rather than normalizing a null vector. This is numerical validity at the surface output, not a new light,
exposure change or post-processing mask. A temporary live test produced eight
successive finite readbacks with the reflected scene still present; the fresh
production verification is recorded separately in the final logs/manifests.

Water uses `F0=0.0204`, Schlick's fifth power and no 3.5× reflection boost.
Underlying asphalt remains aggregate-rough. Reflection sampling uses
footprint/roughness-selected mips and three filtered vertical taps instead of
five unfiltered taps. The ALTERCO channel-split branch uses the same filtered,
bounded sampling instead of reintroducing raw highlights. Resolution, cadence,
wetness fields, drainage, the reflection-horizon fix and the interactive puddle
remain intact. The mip chain adds about one third of reflection colour storage.
Final photographic captures and performance probes inspect reflection health
after the image/timing sample and reject non-finite values for V3.7.

The existing sun, sky, practical sources and contact architecture remain.
Street bounce is an efficient analytic approximation, not measured or baked
realtime GI. Narrative effects are restored in normal captures and are not
increased to conceal materials or missing architecture.

## Plaza: coverage and construction

V3.6 lacked the rear continuation beyond the plaza. Claude's two rear blocks,
loading dock, stepped roofline, passage walls, bridge, terminal facade and
utility infrastructure are preserved. They provide foreground installations,
midground buildings, a 32-metre service passage and farther city layers.

The alley-mouth returns had an additional visibility defect: their old planes
faced away from plaza visitors. Both now face into the plaza, contain actual
recessed window openings, share the existing instanced sash system and have
plinths, coping, horizontal courses, pilasters and drainpipes.

The first full rotation also exposed sparse central side-wall bays. Each side
now has recessed central service access plus its corner entry. Shared instanced
doors sit behind true masonry reveals; the stone base course stops at each
opening. Thresholds, hinges and lever handles give the access physical
construction. Cabinet glazing is corrected to face visitors, with continuous
risers into the cable tray and central electrical service adjacent to the
track installation. Separate surface-mounted side-door planes are removed.
The change uses existing materials and instancing rather than adding a new
draw-call category.

Ground grading, seams, cracks, patches, trench drainage, embedded fittings and
bollards are retained. All seven original tracks, titles, interaction logic,
authored poses, rear supports and wiring remain. Printed-card front shading and
narrative illumination still have photographic limitations; they are assessed
in the per-frame audit rather than treated as automatically realistic.

## ROOM: construction, workstation, materials and light

The later full-room inspection identified a structural entrance defect: the shared vestibule was a six-sided box, so its end caps concealed the view through the open door. Both caps are removed. The passage now has physically scaled plaster, differentiated floor/wall/ceiling colour, source-local baked light, skirting, conduit with clips, switch, installed ceiling channel and ribbed threshold in two merged draws. Its geometry and light remain identical across the world swap.

The luminous exterior rectangle is replaced by the opposite alley segment taken from the actual street layout. Window/door/shutter locations, recess depths and textures come from existing definitions; a course, pilasters clear of openings, kerb and asphalt complete the visible continuation. Surfaces merge by shared material and frustum cull naturally. No second street renderer, shadow pass or reflection target is introduced, and the unused aperture texture/material are removed. The ceiling has a lighter painted substrate, with spatially limited floor/desk light return to retain information under absorbers and furniture while preserving baked contact.

The initial mirrored audit found that Claude's inherited ROOM was essentially
unchanged from V3.6. This completion retains the detailed structural shell,
bevelled desk, monitors, speakers/stands, generic equipment and contact bakes,
then adds suspended fabric acoustic clouds, timber backing, mounting wires,
and physically routed display/interface connections. It does not invent
branded equipment or artist facts.

Painted plaster, floor boards, desk wood, fabric, plastic and metal receive
distinct bounded roughness and subtle bump response. Coloured practical-light
bakes are removed from wall albedo and carried in a separate irradiance
attribute. The floor's coloured additive pools are removed; its neutral
multiply bake retains corner and furniture contact. Local low-frequency
irradiance gives restrained warm practical/door bounce, cool monitor influence
and neutral upper fill. Five broad spatial light fields now evaluate per vertex rather than per pixel. The floor uses a 0.4 m grid (606 additional triangles) so these local fields interpolate accurately; material response/contact remain per fragment. Metal diffuse bounce is weighted by the PBR material's
diffuse colour, so metallic surfaces do not become painted diffuse surfaces.

A finite ceiling area source is mounted at the actual fixture, replacing a
free-space point that blew out a nearby absorber. High tier also uses a finite
monitor-sized area source instead of a giant blue point. Upper LED influence is
restrained and neutral; the warm practicals remain motivated by installed
fixtures. Shared LTC textures load with the ROOM module and are not rebuilt
per visit. No extra reflection target or brute-force GI is introduced.

The full sweep includes entry/threshold, workstation wide/medium/close,
monitor and playing video, speaker, acoustic treatment, desk/floor contact,
cables, biography, authentic photography, side/rear walls, ceiling, floor,
dark corner and exit. The existing viewing stations and navigation are retained.

The physical video-display shader now decodes VideoTexture samples from sRGB
to linear exactly once. Supplied still images already use hardware sRGB
texture decoding. Explicit PLAY, no sound autoplay, lazy attachment, inline
mode, DOM fallback and release on exit remain.

**Video discrepancy:** the unchanged packaged file
`public/room/hooddino-studio-arrangiamento.mp4` is 512×854 H.264/AAC,
56.0667 seconds, 4,860,666 bytes, and contains outdoor guitar/rap footage.
It differs from the studio/arrangement screen recording named in the brief.
No replacement footage is invented. Chromium tests route its URL to a full
same-source VP9/Opus transcode; they do not prove native H.264/Safari decoding.

Artist photography, biography, real social links and official ALTERCO/DUALISMO
artwork are unchanged. Their source files and all public assets are byte-identical
to main; runtime presentation is improved without modifying identity.

## Material scale and differentiation

| Surface | Physical basis / final response |
| --- | --- |
| Hero masonry | Retained 2.4 m tile: 11 units × 32 courses, about 218×75 mm pitch including mortar. Kiln/macroscopic variation and relief retained; close repetition remains subject to photographic grading. |
| Painted ROOM plaster | Roughness 0.94 with bounded broad variation; bump scale 0.65 mm; practical lighting is irradiance rather than albedo. |
| ROOM floor | 1.68 m tile / 12 boards = 140 mm board width; roughness 0.72, 1.2 mm bump, neutral contact bake. Dark albedo is not misused as a gloss map. |
| Desk wood | Roughness 0.64, restrained environment response and 0.8 mm bump. |
| Acoustic fabric | Roughness 1, 0.4 mm bump, real thickness/backing/mounts. |
| Plastic / painted equipment | Separate matte and satin batches, roughness 0.88 / 0.52. |
| Bare equipment metal | Roughness 0.36, metalness 0.85, environmental reflection; indirect diffuse respects metalness. |
| Asphalt / standing water | Wet aggregate roughness stays at least 0.24; water is a separate Fresnel-weighted sheet with roughness-filtered reflection. |
| Window / display glass | Retained window Fresnel/dirt/interior refinements; monitor reflection/black level and correct video colour decoding. |
| Paper / photos / graffiti | Authentic content retained. Existing substrate-aware decals and physical print presentation remain; printed-card front lighting is still a limitation. |

The normal-response values are bounded material choices, not a claim that every
procedural surface matches a measured real-world sample. Macro weathering,
meso construction and micro response are evaluated separately in the captures.

## Rooftop, skyline and DUALISMO

V3.6 roof construction, utilities, seams, parapets and selective shadows are
preserved. Roof ponds receive the shared physical-Fresnel reflection correction.
Claude's skyline window/reflection variation remains; atmospheric near/mid/far
layering is retained. No additional unrelated decorative skyline is built.

DUALISMO retains V3.6's efficient composition and unchanged official artwork.
Claude's floor disturbance and view/distance-dependent reflection roughness
remain, with the existing angle-dependent iridescence and contact cues.
It remains an intentionally impossible environment; its photographic and
material limitations are graded without treating bloom as proof of quality.

Final rooftop/skyline frames remain grade C: box-like facade/window repetition, insufficient coating/weathering variation, broad roof-water response and theatrical fixture/blue illumination persist after calibrated coating relief. DUALISMO also remains grade C: obsidian and mirror-floor response is visibly synthetic, with stylized luminous beams/typography and conspicuous narrative particles. The no-post checks do not upgrade either environment to photographic quality.

## Verification artifacts and hardware limits

`results.json` records exact commands, configuration, timestamps and exit codes.
`visual-review.json` records actual reviewed frames and their remaining CG cues.
`source-checks.json` records content/foundation checks and video/hardware facts.
Review evidence lives outside `public/` and does not increase the deployed
site's artist-media payload.

The environment is Linux Chromium 151 with SwiftShader and a two-core CPU
quota. Touch is Chromium input emulation. No real Safari, iPad, iPhone, device
sharpness or hardware GPU FPS is claimed. Relative software frame times and
resident resource counts are evidence of this proxy only.

Eight production frames are captured without post-processing; five additional
HERO frames also disable global scene fog in the inspection page. Exposure and
tone mapping remain camera settings. World particles and volumetric meshes
remain visible and are assessed as remaining CG cues, not silently removed.

## Loading and resource lifecycle

The emitted browser JavaScript chunks total 2,561,460 bytes (21 chunks), versus 2,256,778 (20) for V3.6. Summed gzip sizes are 797,710 versus 673,844 bytes: +123,866 bytes. This includes shared/lazy chunks and is **not** initial-navigation transfer. Public media assets are unchanged.
The area-light lookup module is loaded with ROOM; its lookup textures are shared
and initialized once. Acoustic supports and service-door hardware use existing
merged batches/shared materials. The reflection mip chain remains owned by the
existing reflection target and follows its disposal lifecycle.

The final desktop ROOM regression on source `4a455df` completed 56 checks without failures or
console/hydration errors. It verifies no early video request, explicit PLAY,
pause/resume/mute/close, unchanged street progress and source/texture release
on exit. Touch, reduced-motion, DOM-video and static-path runs also passed; exact commands, configurations and full logs are linked in [TESTS.md](TESTS.md).

## Paired performance: final implementation

| View | V3.6 median ms | V3.7 median ms | Change | Calls V36/V37 | Triangles V36/V37 | Textures V36/V37 | Geometries V36/V37 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| opening-street | 1935.5 | 1888.9 | -2.4% | 175/194 | 108058/127472 | 74/74 | 133/152 |
| deep-street | 1252.0 | 1199.0 | -4.2% | 123/142 | 88422/107836 | 80/80 | 149/168 |
| plaza-front | 757.2 | 801.1 | +5.8% | 136/159 | 97210/122850 | 83/83 | 170/191 |
| plaza-rear | 441.3 | 589.2 | +33.5% | 84/104 | 86396/111886 | 84/84 | 174/195 |
| tracks-idle | 794.5 | 832.7 | +4.8% | 136/159 | 97210/122850 | 84/84 | 174/195 |
| rooftop | 571.6 | 863.8 | +51.1% | 69/69 | 8004/8004 | 88/88 | 211/232 |
| ROOM | 478.6 | 511.8 | +6.9% | 16/16 | 46004/48098 | 114/118 | 247/272 |
| DUALISMO | 276.6 | 285.7 | +3.3% | 44/44 | 22368/22368 | 120/123 | 269/295 |
| tracks-moving | 799.0 | 806.9 | +1.0% | 182/216 | 113660/150238 | 120/123 | 269/295 |

Both runs use 640×360, balanced tier, internal scale 0.6, complete 1280-pixel masonry, four warm-up frames and ten wall-time samples. They run serially in the same current environment, not interleaved; these are requestAnimationFrame wall-time proxies, not synchronized GPU timings or device FPS. Complete sample distributions remain in the two performance JSON files. Resource counts are cumulative along the journey. Moving probes require actual progress advance and retain start/end progress in each JSON row. They do not cover perfectly synchronized trajectory intervals; moving call/triangle counts also depend on visibility and reflection cadence and must not be interpreted as newly allocated geometry. No statistical hardware speedup or real-device budget acceptance is claimed.

The earlier intermediate source `ebe7baa` measured +81.1% at plaza front, +59.0% at rear and +68.3% in ROOM and was rejected for further optimization. The new mid/background PBR path uses two baked-noise samples and scalar baked practical irradiance; studio light fields evaluate per vertex, with a 0.4 m floor grid. Architecture and contact remain. The current table records the resulting measurements rather than carrying the rejected intermediate values forward.

Measurement stages passing means all nine probes completed without browser errors and final reflection readback was finite; it does not establish photographic acceptance or acceptance of every performance increase.

## Final-source visual coverage

The final normal-render plaza inspection covers inward and outward directions
0°,45°,90°,135°,180°,225°,270°,315°, the unobscured far passage and every
authored track pose (checkpoints 11–34). All are actually viewed and recorded
in `visual-review.json`; no camera-visible empty backdrop was observed.
The returns, central service accesses and rear continuation are constructed.
This is a geometry-coverage verdict, not a photographic verdict: those frames
remain grade C because of regular masonry, simplified printed installations,
stylized light and broad lower-surface illumination.

Renderer texture/geometry counts in the performance table are cumulative
resident counts along the same scripted journey. They are not isolated
per-component ownership or measured GPU byte allocations. ROOM’s triangle
and draw counts describe its active pass; its resident memory row also
includes resources loaded earlier in the street/plaza sequence.

## Completed final-code regressions

The production E2E suite completed 22 checks with 0 failures and no console
errors/hydration warnings on source `4a455df`. It exercises explicit audio entry,
pointer parallax, street progression, track orbit/hover/select/focus/Escape,
horizontal camera input, lamp interaction, hidden letters, ALTERCO transition,
rooftop, DUALISMO and return, resize and bounded resident resources.
The adaptive-controller simulation also passed. All final required regressions have a passing latest attempt on source `4a455df`, including ROOM touch/reduced-motion/DOM playback and static `/sito-hood/`. Their final table is generated from recorded exit codes, not inherited earlier-source results.

## Matched before/after observations

V3.6 checkpoint 19 exposes sky on both sides of the alley mouth because the
return faces are absent from this viewing direction. Final checkpoint 19
shows inward-facing construction and recessed windows instead.
V3.6 checkpoint 23 exposes ungrounded far-building forms above a luminous
sky gap; final 23 shows constructed rear blocks, service passage and bridge.
V3.6 checkpoint 27 shows the plaza floor ending before an unconstructed
bright horizon; final 27 looks through a real service passage toward its
terminal facade. These are the same declared inspection poses in both
versions, not alternative compositions chosen to hide the old weak views.
The final bridge glazing/lamp halos and brick repetition remain grade C.

The original H.264 MP4 was also checked independently of the WebM test route:
both production and `/sito-hood/` return HTTP 200, `video/mp4`,4,860,666 bytes.
The exported file has the same SHA256 as the unchanged supplied asset.
This proves packaging/serving, not native decoding on Safari/iOS.


## Visual acceptance verdicts

- **Would the street pass as filmed? NO.** Regular masonry relief/weathering, simplified street props and stylized particles remain visible. Wet reflections are numerically valid and more restrained; that fix does not make the entire street photographic.
- **Would ROOM pass as a photographed real studio? NO.** Equipment remains simplified, ceiling/cloud undersides and under-desk connections lack sufficient light information, and glass/plastic/fabric response remains too uniform. The former closed airlock and flat exterior proxy are corrected, with the actual opposite alley visible. The workstation/material/light changes improve presentation, but the brief's dramatic photographic HERO target remains unmet.
- **Is the entire reachable 360° plaza constructed? YES**, for all sampled reachable inward/outward directions and seven authored track camera poses.
- **Any camera-reachable empty/unfinished plaza background observed? NO**, including the far passage and no-global-fog audit. This coverage result does not imply photographic quality; all reviewed plaza frames are grade C.

Current final normal grades are A 0, B 3, C 58: wet asphalt, the close monitor presentation and the floor are B; the remaining frames are C. No reviewed final frame receives grade A. The per-frame reasons and matched evidence are recorded in `visual-review.json`; the separate final threshold recapture passed and was actually re-inspected. See [all 61 matched frames and the base-render checks](FRAME-REVIEW.md).

## Publication status

The branch is now published on GitHub after the connection was reauthorized. New [draft PR #7](https://github.com/BoninaBID2527/sito-hood/pull/7) targets `main`. No merge or deployment is performed. Earlier authenticated Git pushes and integration branch creation returned HTTP 403; those failures remain recorded as history. Native Git push and PR creation now succeed. Photographic acceptance remains unmet, so the PR is explicitly a draft with the remaining limitations in its description.

The focused cost check ran after the complete capture page closed and before the remaining functional stages, with the coordinator paused at that boundary. No software-GL workloads overlapped. Exact commands and timestamps are retained in `steady-results.json`.

## Additional three-view steady-cost diagnostic

| View | V3.6 median ms | V3.7 median ms | Change | Calls V36/V37 | Triangles V36/V37 |
| --- | ---: | ---: | ---: | ---: | ---: |
| plaza-front | 707.4 | 755.2 | +6.8% | 136/159 | 97210/122850 |
| plaza-rear | 454.3 | 596.5 | +31.3% | 84/104 | 86396/111886 |
| rooftop | 730.6 | 508.2 | -30.4% | 69/69 | 8004/8004 |

This additional diagnostic uses 40 warm-up frames and 20 intervals with advanced simulation time, with the same 640×360 balanced tier/internal scale 0.6 and complete 1280-pixel masonry. It runs V3.6 then V3.7 serially after the capture page closes and before functional regressions, with no overlapping software-GL test. The criterion excludes unchanged simulation ticks; it does not timestamp GPU completion. Complete samples, resource counts and reflection readbacks are retained in `performance-steady-v36.json` and `performance-steady-v37.json`; exact commands/times/exits are in `steady-results.json`.

The earlier nine-view table remains above. Differences between the short and longer probes demonstrate wall-time/cadence/host variability; neither is a device FPS measurement, a statistical speedup claim or a real-device budget acceptance. Resource rows follow a shorter three-view journey and should not be compared as component ownership against the original nine-view journey.

The longer probe measures plaza front +6.8% and rear +31.3%, agreeing closely with the original +5.8%/+33.5%. Rear completion therefore carries a real regional software cost. Rooftop changes from +51.1% in the short probe to -30.4% in the longer one, with unchanged active 69 calls/8,004 triangles. This inconsistency prevents a stable-regression or speedup claim for the rooftop; both runs remain visible. The measured rear cost is kept explicit rather than called a budget pass.

The outer `photographic-final` stage finish timestamp includes the coordinator pause while it waited to process the capture child’s close callback. The capture client had exited before the first steady probe started at 10:23:40 UTC; the coordinator resumed after the paired probes and recorded the stage finish at 10:33:24. This recording delay is not overlapping render work.


## Complete evidence and tests

All 135 frames were manually inspected: 61 V3.6, 61 final normal-render, 8 without post and 5 without post/global fog. Final normal grades: **A 0, B 3, C 58**. [Interactive comparison](compare.html), [per-frame review](FRAME-REVIEW.md), [19-stage test results](TESTS.md), [plaza inward rotation](images/plaza-in-360.webp), [plaza outward rotation](images/plaza-out-360.webp), [ROOM before](images/room-hero-v36.webp), [ROOM after](images/room-hero-v37.webp).
