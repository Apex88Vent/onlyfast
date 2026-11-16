# Phase 2D — live circuit GPS recording and scanning

November 14, 2026 (America/Los_Angeles). `develop/onlyfast-2027`.
**BETA, isolated testing only. Physical GPS validation is outstanding.**

## Implementation and source audit

Latest `Apex88Vent/OnlyLaps-app` commit was checked through GitHub:
`22f372508582fb43d56b66947c26740233bcdb19`. The standalone repository was read
only. The extraction and compatibility changes are documented in
`src/features/track-trace/circuit/README.md`.

Reused source algorithm bodies: `startFinishCrossing`, `lapFiltering`,
`telemetryMath`, `telemetrySmoothing`, circuit `calculateLapSectorTimes`, and
`onlylapsTrackScanUtils` (GPS thinning, distances, centers, bounding boxes,
accuracy summaries and facility/area keys). The recorder adapts the **normal**
branch of `useLapRecorder`: first valid directional crossing starts timing,
later valid crossings complete laps. Source debounce, minimum lap, directional,
endpoint-tolerance and accuracy checks are retained. Sector interpolation,
slow-lap exclusion, speed/motion summaries and deterministic smoothing are
reused. Gumball detectors, open-route processing, generated Gumball maps, Next.js
auth bypass and standalone persistence are excluded.

Browser GPS conversion/options, motion permission/normalization and wake-lock
reacquisition follow the existing GPS/motion/wake hooks. The browser adapter
uses `watchPosition` with high accuracy, maximumAge 0 and a 10-second timeout.
No synthetic GPS is present in application code; the QA harness injects it.

OnlyFast-specific safeguards reject stale/malformed fixes and reset incomplete
lap timing at an interruption or gap over 10 seconds. Completed laps and all
accepted raw samples survive. The next sample carries an interruption marker
for recovery from the server as well as the device journal.

## Recording workflow

Both existing Start Session paths use the existing preparation RPC and exact
setup IDs: Link to Existing Setup, or Record Without Setup. Selecting an owned
or approved community circuit uses its canonical ID, start/finish path and
private sector override or shared default. Beginning the recording freezes the
map/version/sector snapshot into the existing session's `device_info`.

Preparation opens recording controls on the existing `/track-trace` route;
**Arm and start GPS** begins the actual watch. The screen shows accuracy,
recording/timing status, sample count, completed laps, current/last lap and
upload state. Optional motion permission uses the source convention, with the
phone's top facing forward. GPS remains usable without motion permission.

The audited source has **no unscanned normal/circuit workflow**: its arm and
create service reject a missing saved map. Only its excluded Gumball branches
generate automatic lines. Therefore Free Record here is genuine raw **circuit**
GPS capture without a map or automatic laps. The UI states this explicitly.
Unscanned automatic start/finish generation remains a source dependency; no
Gumball mode or invented lap data fills that gap.

The source has no four-digit end confirmation. OnlyFast now generates a
four-digit code and requires it before stopping and saving. GPS continues while
the confirmation is open; cancel keeps recording. A failed save exposes Retry
save and retains the recording. Successful completion opens the existing saved
review, with bounded GPS pages/path preview, speed summary, laps and sectors.
Existing exact-session linking supports later association of standalone
recordings; no setup is required before recording.

## Persistence, recovery and security

- Reuse `onlylaps_timing_sessions`, `onlylaps_telemetry_samples`,
  `onlylaps_lap_times` and `onlylaps_lap_sector_times`.
- IndexedDB journals each accepted sample before upload, scoped to the
  authenticated owner's session. Batches contain at most 100 samples.
- A unique `(timing_session_id, recorder_id, sample_index)` index prevents
  duplicate retry writes. Identical retries are accepted; changed payloads at
  the same index are rejected. Legacy sample rows retain their existing IDs.
- Completion locks the owned parent, verifies contiguous persisted sample count
  and writes laps/sectors/end metadata in one transaction. Repeated identical
  completion returns the same receipt. A different receipt is rejected.
- Unsaved device journals remain available through the retained-recordings
  panel, navigation away, sign-out/sign-in to the same owner, and reload. GPS
  resumes only by deliberate action. Server recovery can reconstruct an active
  recording if the local journal was evicted; only already uploaded samples can
  be recovered that way. Unuploaded samples require the original device journal.
- Offline/lost-response retries retain original sample identity. Uploads retry
  periodically and on reconnect. Local storage failure stops GPS and leaves the
  in-memory recording downloadable; save retries the buffered data.
- GPS denial, timeouts, poor accuracy, visibility changes and wake-lock release
  are visible. Browsers cannot guarantee background/locked-screen GPS. An
  incomplete lap resets across an interruption instead of bridging the gap.
- Each write uses fresh existing Pro/Factory authorization, session ownership,
  circuit restrictions, RLS and installed lifecycle checks. Sportsman retains
  the existing owned historical read rules and cannot write recordings/scans.
  No client metadata grants paid access. No policies on archive work were edited.
- Hosted validation found the legacy lap INSERT/UPDATE policies still required
  map ownership. The narrow follow-up permits the caller's **own** lap/session
  to reference the exact shared map on that session. All restrictive paid,
  owner, circuit and history policies continue to apply. Tests install the real
  legacy policies as well as the lightweight test bootstrap to cover this case.

## Circuit scanning and community compatibility

Scan Track now captures actual GPS outside/inside boundaries and a start/finish
path, with the existing source point-thinning and geometry functions. Scan
capture accepts fixes at 25 m accuracy or better; the server applies Phase 2C's
closed-circuit geometry/metadata validation. Interrupted boundaries are retained
but must be cleared and recaptured before saving. An active boundary is marked
in the journal, so reloading cannot silently join across lost capture.

Users enter track name/location, supported circuit type and travel direction.
Manual corner ranges use percentages of the real outside boundary and recorded
apex positions. Optional sector gates capture two distinct real GPS endpoints,
with ordered progress and up to five sectors. With no gates the whole lap is
one sector. This is a capture adapter, not the standalone graphical track editor
or automatic corner-analysis interface.

Save creates a **private** canonical map and sector defaults, preserving the
existing map/version triggers. Location is initially private description metadata
because publication location is controlled by Phase 2C moderation. Submission
reuses the existing publication component, duplicate detection and operator
review RPC. No second catalog, per-user shared-map clone, automatic publication,
replacement or production import was introduced.

## Testing and evidence

Automated inputs are deterministic synthetic GPS; they do not establish physical
GPS, sensor accuracy or locked-screen reliability.

The hosted browser harness uses actual testing Auth/RPC/database calls:
`qa/automation/track-trace-live-hosted.mjs`. The test-only GPS and browser clock
are injected by Playwright. It checks Pro mobile and Factory desktop shared-map
recordings, offline/lost-response retries, completion, saved telemetry, Free
Record reload/server recovery, private scan capture/submission and GPS denial.
Synthetic fixtures are explicitly marked and cleaned up; no production account
or record participates. Final results and artifact paths are appended below.

## Required physical-device acceptance

1. Use an eligible synthetic Pro or Factory account on the isolated testing
   build at a permitted closed circuit. Verify precise-location permission,
   initial denied/retry behavior, stationary accuracy and a stable phone mount.
2. Select an already approved shared circuit and check its version/SF/sectors.
   Drive multiple same-direction laps; compare crossing/lap/sector times with
   independent timing equipment. Test low-speed crossings, repeated gate jitter,
   opposite-direction passes and poor fixes without claiming precision yet.
3. Repeat with an owned circuit, linked exact setup, and standalone recording.
   Save and reopen; compare sample counts, units, speed/motion, lap validity and
   sectors. Link the standalone recording to a different exact setup afterward.
4. Test airplane mode, reconnect, dropped save response, background/foreground,
   phone lock, battery saver, wake-lock release, navigation, app termination and
   reload. Confirm gaps reset incomplete laps and all retained data can be saved.
5. Test Free Record: actual raw GPS persists, no unsupported automatic laps.
   Verify end-code cancellation, wrong code, correct code, save retry and review.
6. Walk a circuit's real outside/inside boundaries and start/finish, define corners
   and sector gates, inspect geometry, save privately and submit. Independently
   review geometry, direction, location, duplicate layouts and sectors before
   using controlled moderation; do not auto-replace a published scan.
7. Repeat iOS/Android browser and intended Median shell permission/lifecycle
   cases, including optional motion denial. Device testing and release approval
   must precede any change to `liveRecordingValidated: false` or BETA status.

## Files and migrations

New application files:

- `src/features/track-trace/circuit/`: README, selected source types, crossing,
  filtering, sector timing, scan utilities, telemetry math/smoothing and recorder.
- `recordingJournal.ts`, `useCircuitGps.ts`, `TrackTraceRecorder.tsx`,
  `TrackTraceScanner.tsx`, `TracePathPreview.tsx`, `TrackTraceTelemetry.tsx` in
  `src/features/track-trace/`.

Updated existing application files: `TrackTracePage.tsx`, `TrackTraceMenu.tsx`,
`TrackTraceSessionReview.tsx`, `TrackTracePublication.tsx`, `api.ts`, `config.ts`.
Existing navigation, permissions, library and exact-session link modules remain
the foundation; no new routes or feature modules duplicate them.

Testing-only migrations (created with the Supabase CLI and applied via MCP):

- `supabase/testing-2027/20261115000806_track_trace_live_circuit.sql`: sample retry
  columns/index, lap smoothing summary, invoker begin/append/complete/read/scan
  contracts. Existing tables, RLS and guards remain.
- `supabase/testing-2027/20261115002952_track_trace_shared_lap_writes.sql`: narrow
  legacy shared-map lap-write compatibility described above.

Tests: `tests/helpers/trackTraceGps.ts`, `trackTraceRecorder.test.ts`,
`trackTraceLiveDatabase.test.ts`, hosted harness above; existing navigation and
Phase 2B UI expectations updated for the newly available scanner. This report
and existing Track Trace documents link the current status.

## Remaining dependencies and release boundary

Physical device timing/sensor/lifecycle acceptance, unscanned circuit automatic
lap timing, long-session stress testing, richer graphical scan editing and
lap comparison/corner-analysis presentation remain follow-ups. Telemetry share
resolution and testing AI provider configuration retain their prior integration
boundaries. Source extraction for future standalone reuse needs a separate
standalone change; that product/repository was not modified here.

No production database, RevenueCat product, subscriber migration, advertising
hold, archive implementation, standalone deployment, push, merge or production
release was changed. Current live recording and scan integration is testing-only.

Local preview: <http://127.0.0.1:4194/track-trace> (testing login required).

## Final verification

- Full regression: **806 passed, 0 failed, 0 skipped** (691 unit, 92 mounted,
  23 database). Includes 14 new focused algorithm/database tests.
- Hosted browser: **11 grouped checks passed**, using synthetic GPS with real
  testing Auth/RPC/database. Pro at 390 px and Factory at 1280 px both completed
  three 20-second laps and six sector results against the same canonical map.
  Offline and lost-response replay retained exactly 64 samples. Free Record
  survived local reload and recovery after removing the synthetic local journal.
- Navigation/browser fixture: **7 viewports passed** (320, 360, 390, 640, 768,
  1024, 1280), zero page errors or external requests. Preserves six Home actions,
  double-width telemetry entry, locks/upgrades, four-button menu, linked and
  standalone preparation, exact setup linking and unsaved edits, both share-menu
  entries, saved review and real scanner permission-denial state.
- TypeScript app and node checks, focused Track Trace ESLint and preview build
  passed. Build retains the existing large-chunk advisory. Diff whitespace check
  passed. All five new RPCs are invokers; no new privileged public functions.
- Security advisors match the starting baseline: 11 existing INFO findings,
  13 existing public-definer WARN findings and the existing password-protection
  WARN. No new findings. Existing references: [database linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Starting-file SHA256 comparison confirms no archive implementation files,
  prior migrations or unrelated application files changed. Existing dirty Phase
  2C work is preserved. All synthetic Phase 2D sessions/maps/submissions were
  removed, including the operator-published testing fixture; test tiers restored.
- **No physical GPS or real-device acceptance was performed.**

Evidence (local workspace artifacts):

- `tmp/qa-automation/2026-11-15T00-34-09.146Z-a7d7dab4-eb3a-4e91-b30c-5b31186154cd/report.json`
- `tmp/track-trace-phase2d/hosted/verify.json` and final screenshots in that folder
- `tmp/track-trace-phase2d/hosted/cleanup.json` confirms zero remaining fixtures;
  map cleanup used the operator because existing client deletion is denied
- `tmp/track-trace-phase2d/browser/report.json`
- `tmp/track-trace-phase2d/changed-existing-files.json`

The existing navigation browser harness was updated for the now-available scan
capture and recording-controls screens; it retains its prior interaction checks.
