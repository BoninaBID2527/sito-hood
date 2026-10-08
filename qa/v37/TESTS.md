# Final verification results

All 19 required stages have a passing latest attempt for implementation `4a455df52441e2d0b53a748b41f25637586b1062`, with the explicitly named V3.6 baseline stages running against `d03c0297c9df1be1b171cf199d151f25674fff5f`. Earlier failures and infrastructure interruptions remain in the recorded history. A capture/measurement pass does not establish photographic quality or a performance-budget pass.

| Stage | Latest result | Functional assertions | Log |
| --- | :---: | --- | --- |
| performance-V36 | PASS | See complete stage log | [log](logs/performance-V36.log) |
| performance-V37 | PASS | See complete stage log | [log](logs/performance-V37.log) |
| post-disabled | PASS | See complete stage log | [log](logs/post-disabled.log) |
| base-render-no-fog | PASS | See complete stage log | [log](logs/base-render-no-fog.log) |
| photographic-final | PASS | See complete stage log | [log](logs/photographic-final.log) |
| threshold-recapture | PASS | See complete stage log | [log](logs/threshold-recapture.log) |
| adaptive-simulation | PASS | See complete stage log | [log](logs/adaptive-simulation.log) |
| e2e | PASS | 22 passed, 0 failed | [log](logs/e2e.log) |
| ROOM-desktop | PASS | 56 passed, 0 failed | [log](logs/ROOM-desktop.log) |
| photographic-baseline | PASS | See complete stage log | [log](logs/photographic-baseline.log) |
| secrets | PASS | 18 passed, 0 failed | [log](logs/secrets.log) |
| easter-eggs | PASS | 21 passed, 0 failed | [log](logs/easter-eggs.log) |
| tracks | PASS | 8 passed, 0 failed | [log](logs/tracks.log) |
| reduced-motion | PASS | See complete stage log | [log](logs/reduced-motion.log) |
| ROOM-touch | PASS | 61 passed, 0 failed | [log](logs/ROOM-touch.log) |
| ROOM-reduced | PASS | 56 passed, 0 failed | [log](logs/ROOM-reduced.log) |
| ROOM-DOM-video | PASS | 58 passed, 0 failed | [log](logs/ROOM-DOM-video.log) |
| static-smoke | PASS | See complete stage log | [log](logs/static-smoke.log) |
| static-ROOM | PASS | 58 passed, 0 failed | [log](logs/static-ROOM.log) |

Production build, TypeScript check and isolated `/sito-hood/` export build also passed; logs are [build](logs/build.log), [typecheck](logs/typecheck.log) and [export](logs/static-build.log). Touch is Chromium emulation; video playback uses a same-source WebM transcode. No real iOS/Safari or hardware GPU performance is claimed.
