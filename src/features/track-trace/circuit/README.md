# Circuit source provenance

Source: `Apex88Vent/OnlyLaps-app`, latest commit checked through GitHub on
2026-11-15 UTC: `22f372508582fb43d56b66947c26740233bcdb19`.

`startFinishCrossing`, `lapFiltering`, `telemetryMath`, `telemetrySmoothing` and
`onlylapsTrackScanUtils` retain the source function bodies. Imports use local
explicit `.ts` paths for Vite and Node's deterministic test runner. The scan map
type's redundant Gumball union member was removed. `types` contains only the
needed circuit declarations. `sectorTiming` extracts `toGpsPoint`,
`telemetryToGps`, `calculateLapSectorTimes` and the original 1000 ms threshold;
the standalone editor/generation dependencies are excluded.

`recorder` adapts the **normal** branch of `hooks/lap-session/useLapRecorder`:
first directional crossing arms the timer, subsequent valid crossings complete
laps, and crossing-point sample assignment follows the source. It uses the same
summary/filter/sector/smoothing functions. It deliberately rejects invalid and
out-of-order fixes and resets the incomplete lap across an interruption or a
gap over 10 seconds. Raw samples remain retained. This gap safeguard is an
OnlyFast compatibility change, tested separately from the timing algorithms.

GPS conversion/options, wake-lock lifecycle and motion normalization are adapted
from `hooks/useTrackScanGps`, `hooks/lap-session/useWakeLock` and
`hooks/lap-session/useMotionTelemetry`. The Next.js auth/dev-bypass persistence
service is replaced by the existing authenticated Track Trace contracts and an
IndexedDB write-ahead journal. No standalone source is changed.

The audited normal recorder requires a saved track and has no unscanned circuit
workflow or four-digit completion confirmation. Free Record here captures raw
circuit GPS without automatic laps; no Gumball detector is used. Completion
confirmation is implemented in OnlyFast. Physical GPS/device validation remains
outstanding.
