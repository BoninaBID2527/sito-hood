## Additional three-view steady-cost diagnostic

| View | V3.6 median ms | V3.7 median ms | Change | Calls V36/V37 | Triangles V36/V37 |
| --- | ---: | ---: | ---: | ---: | ---: |
| plaza-front | 707.4 | 755.2 | +6.8% | 136/159 | 97210/122850 |
| plaza-rear | 454.3 | 596.5 | +31.3% | 84/104 | 86396/111886 |
| rooftop | 730.6 | 508.2 | -30.4% | 69/69 | 8004/8004 |

This additional diagnostic uses 40 warm-up frames and 20 intervals with advanced simulation time, with the same 640×360 balanced tier/internal scale 0.6 and complete 1280-pixel masonry. It runs V3.6 then V3.7 serially after the capture page closes and before functional regressions, with no overlapping software-GL test. The criterion excludes unchanged simulation ticks; it does not timestamp GPU completion. Complete samples, resource counts and reflection readbacks are retained in `performance-steady-v36.json` and `performance-steady-v37.json`; exact commands/times/exits are in `steady-results.json`.

The earlier nine-view table remains above. Differences between the short and longer probes demonstrate wall-time/cadence/host variability; neither is a device FPS measurement, a statistical speedup claim or a real-device budget acceptance. Resource rows follow a shorter three-view journey and should not be compared as component ownership against the original nine-view journey.

The outer `photographic-final` stage finish timestamp includes the coordinator pause while it waited to process the capture child’s close callback. The capture client had exited before the first steady probe started at 10:23:40 UTC; the coordinator resumed after the paired probes and recorded the stage finish at 10:33:24. This recording delay is not overlapping render work.
