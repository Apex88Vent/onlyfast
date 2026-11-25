# OnlyFast Track Trace corrective integration

Updated November 24, 2026. Work is local on `develop/onlyfast-2027` in the primary checkout. This is a correction to the existing feature, not a second Track Trace application.

The original circuit recording/review components and calculations are now used inside the existing OnlyFast route. Historical telemetry reads include legacy OnlyLaps samples, motion fields and separately stored sectors. **Physical-device acceptance and complete production-history validation remain outstanding.** This report does not claim complete release parity.

## Source inspected and comparison method

Audited [Apex88Vent/OnlyLaps-app at 22f372508582fb43d56b66947c26740233bcdb19](https://github.com/Apex88Vent/OnlyLaps-app/tree/22f372508582fb43d56b66947c26740233bcdb19), including its circuit pages, `hooks/lap-session/useLapRecorder.ts`, `lib/lap-session/lapSessionService.ts`, sector/corner services, scan services, presentation components and styles. The reviewed source snapshot is in `tmp/track-trace-parity/source/`; ported files carry the source revision. Standalone OnlyLaps was not edited.

Compared against the existing Phase 2D implementation at OnlyFast `f943f81f`. Its timing engine already reused OnlyLaps math, but its recording/review presentation was substantially reduced. Passing engine/security tests did not establish presentation or historical-data parity.

UI status below means source-component/layout parity with necessary OnlyFast adapters. It is not a pixel comparison against a running standalone deployment. Browser checks exercised the integrated build at mobile and desktop widths.

## Feature parity matrix

Original paths below are relative to the source revision above. Integrated paths are under `src/features/track-trace/`, unless otherwise stated.

| Circuit feature | Original source | Previous integration gap | Current implementation / functional status | UI parity / remaining gap |
| --- | --- | --- | --- | --- |
| Entry and navigation | `components/lap-session/StartSessionPage.tsx`, source application navigation | Simplified integration flow | Existing OnlyFast six actions, double-width telemetry entry, BETA, upgrade path and four-button menu retained | OnlyFast navigation intentionally retained; source circuit screens appear inside it |
| Session preparation | `StartSessionPage.tsx`, `lapSessionService.ts` | Minimal preparation form | Existing exact setup-session preparation and independent recording retained; same saved circuit/start-finish prerequisites | Setup choices and shared catalog replace standalone account/private-track choices; source phone mounting controls restored |
| GPS readiness and permissions | `useLapRecorder.ts`, `SessionArmedScreen.tsx` | Watch registration looked like working recording | `useCircuitGps.ts` distinguishes requesting, active, stale, denied and error; one-fix readiness remains a separate check | Source armed/live status reflects actual fix state; device permission behavior still requires physical acceptance |
| Live recording screen | `SessionActiveScreen.tsx` | Small text controls | Source `views/SessionActiveScreen.tsx`, embedded in durable recorder | Original organization, GPS state, clock, speed/G panel and large End Session control; additional circuit timing/map readouts |
| GPS sample processing | `useLapRecorder.ts`, telemetry/crossing helpers | Device diagnosis incomplete | High-accuracy watch, timestamp/coordinate validation, direction/accuracy gates, gap resets and owner-scoped journal | Actual callbacks only; no synthetic input in application code |
| Current speed | `SessionActiveScreen.tsx`, `telemetryMath.ts` | Missing source indicator | Source display and exact m/s → mph conversion | Restored; missing measured speed stays unavailable |
| Motion and G-force | `GForceIndicator.tsx`, `telemetryMath.ts`, source motion hooks | Missing indicator/orientation UI | Source animated indicator/readouts, motion and orientation permission handling, four mounting orientations | Restored; actual sensor availability/calibration unvalidated on a physical device |
| Lap timing / last / fastest | `startFinishCrossing.ts`, `lapFiltering.ts`, recorder hook | Minimal lap readout | Existing source timing calculations preserved; live current/last/fastest lap and completed count | Source live screen plus requested circuit timing values; automatic laps still require saved line |
| Sector timing | `sectorTiming.ts`, `sectorService.ts`, `LapSectorTable.tsx` | Limited result text | Source gate calculations and table; live completed-lap sectors; immutable recording layout snapshot | Restored; unmeasured/missing gates are not invented |
| Track map and live trace | `ReplayMap.tsx`, `trackProjection.ts` | No source map in reduced UI | Source projected boundaries/start-finish/trace renderer; actual collected samples shown live | Restored renderer. Source normal live screen itself had no map; requested live map is added using its replay component |
| Wake lock / visibility | Source wake-lock hook and recorder lifecycle | Browser lifecycle lacked usable failure distinction | Screen lock request/release, visibility interruption, resumed fixes, no false background guarantee | Messages and diagnostics present; native wrapper/background behavior remains a device test |
| Completion | `SessionActiveScreen.tsx`, recorder/service | Successful-looking state possible before first fix | Existing four-digit confirmation and atomic/idempotent completion retained; zero-sample completion blocked in UI | Original large end control; failed/no-fix attempt stays resumable, never becomes a successful recording |
| Offline/recovery | Recorder hook and service persistence | Different storage integration | Existing durable journal, server journal recovery, exact sample retry and snapshot retained | OnlyFast recovery controls retained; source sample/motion values survive retries |
| Saved sessions | `ReviewSessionsPage.tsx` | Simplified list and incomplete summaries | Source card list with real aggregate lap/sample counts, fastest/average/duration; pages all owned results | Source card layout. Menu now clears old selection so Review opens the list |
| Session details | `SessionDetailPage.tsx` | Reduced text-only review | Source detail organization, rename, quality/status messages and excluded laps | Restored; errors and unfinished sessions cannot show Complete |
| Lap table / selection | `LapSectorTable.tsx`, `SelectedLapDetails.tsx` | Source table absent | Source table, fastest highlighting, speed, sector columns and keyboard selection | Restored; horizontal table scroll is intentional on narrow screens |
| GPS replay | `LapComparison.tsx`, `LapTraceView.tsx`, `ReplayMap.tsx` | Missing | Source play/pause/reset, playback rate, scrubber, raw/smoothed trace and full/follow views | Restored; missing historical geometry falls back to actual GPS trace, never a made-up map |
| Lap comparison | `LapComparison.tsx`, `sessionReview.ts`, `trackProjection.ts` | Missing | Source normalized track-position overlay, primary/comparison selection and synchronized speed/G panels | Restored and browser exercised |
| Optimum lap | `optimumLap.ts`, `OptimumLapSummary.tsx` | Only stored summary text | Source optimum composition, sector provenance, detail/replay controls; stored analysis optimum remains visible separately | Restored when actual sector data supports it; no estimated replacement for absent sectors |
| Corner analysis | `cornerAnalysis.ts`, `CornerComparisonCards.tsx` | Presentation absent | Source deterministic corner detection/comparison, confidence, line/braking/speed metrics; stored analysis or in-memory source calculation | Source cards restored. Regenerate is a calculation preview; stored historical analysis is not rewritten |
| AI lap/corner explanations | `LapAiSummary.tsx`, source `/api/lap-insights` integration | Provider absent in testing | Deterministic measured cards work; explicit unavailable message for AI explanations | **Dependency:** authenticated testing provider/API integration; no fabricated AI answer or live-provider call |
| Track scanning | `TrackScanPage.tsx`, `TrackScanDetails/Recorder/Preview/Review/Stepper.tsx` | Reduced controls and preview | Original details → outside → start/finish → inside → review components, geometry/precision checks, retained draft, private save, metadata persistence | Source stage controls/layout restored; OnlyFast name/location/community submission requirements retained |
| Scan naming / discovery | `TrackNameStep.tsx`, `TrackScanGpsSearch.tsx`, `NearbyTrackResults.tsx` | Different discovery flow | Existing shared catalog search by name/location, duplicate review and direct cross-user reuse | Adapted for one shared catalog; original GPS-nearby suggestion wizard is **not ported**. Users can search before scanning |
| Track library | `SavedTrackMapsList.tsx`, `onlylapsTrackMapService.ts` | Separate integration catalog UI | Existing canonical published/private catalog retained; no per-user clones or competing catalog | OnlyFast shared search/version/publication cards retained because source list is a different private-track flow |
| Graphical corner/sector editing | `TrackEditPage.tsx`, `CornerEditorPage.tsx`, `SectorEditorPage.tsx`, `TrackDefinitionMap.tsx` | Missing graphical editors | Source maps, sliders, undo/reset, finalize and save confirmation. Private owner edits use version checks; published sectors use personal overrides | Restored with required immutable community/historical protections; published corners/geometry remain read-only |
| Scan cleanup | `TrackScanCleanupPanel.tsx`, cleanup helpers, `onlylaps_save_scan_cleanup` | Missing | Source anomaly/cleanup calculation and graphical preview ported | **Preview only.** Save explicitly disabled until atomic geometry/sector remapping, restore history and version checks are integrated into testing |
| Telemetry share codes | Original telemetry-share UI/services | Testing resolver not integrated | Existing Home View Shared Telemetry placement/lock path retained; honest unavailable state | **Dependency:** reviewed testing share-code resolver/permissions. Private sessions remain private |
| Gumball / public routes | Gumball branches in original source | Must remain excluded | No integrated mode, recording engine or UI path added; circuit SQL restrictions retained | Intentionally excluded; Gumball-only generated-map/manual-line flows are not circuit parity gaps |

## GPS diagnosis and correction

The code-confirmed failure was **state reporting**, not evidence that the browser/device successfully delivered GPS. The former adapter set `running` immediately after registering `watchPosition`, and retained that state through timeout/no-fix errors. The reduced UI therefore suggested recording even when no sample had arrived. It also omitted source mounting controls, orientation updates, motion readouts and the original live screen.

`useCircuitGps` now separates a registered watch from an active fix; reports actual error codes; rejects stale/invalid fixes; detects a silent no-fix watch; resets an incomplete lap across visibility/signal interruptions; and clears watches/listeners/wake locks. Motion permission requests begin inside the explicit click gesture. The source axis normalizers and all four phone orientations are reused. Diagnostic downloads include the GPS state, error, secure-context/visibility status and actual retained samples.

The UI cannot complete a zero-sample recording. A failed empty attempt retains its prepared session/journal and offers resume/diagnostics. Browser verification asserts `ended_at` remains null, then resumes the same session and completes measured synthetic callbacks normally.

**The cause of the user's physical-device failure has not been established.** No device/browser trace or physical GPS run was available. HTTPS, precise-location permission, device services, native wrapper restrictions, signal conditions and OS lifecycle behavior must be checked on the actual target device. Registering a browser watch or passing synthetic tests is not device validation.

## Historical telemetry diagnosis and compatibility

The develop Phase 2D `get_track_trace_samples` reader filters for `recorder_id IS NOT NULL` and returns only `raw.sample`. Original OnlyLaps rows use the same tables but store GPS/speed/G in columns and motion/lap tags in top-level `raw`; they do not need those new recorder fields. Consequently the old reader returns `[]` for real legacy-shaped rows. Its reduced review also lacked the original map/replay/comparison presentation.

The new read-only bundle and `(recorded_at,id)` cursor contract reuse the existing history/owner/circuit authorization and return original rows. Pages contain 500 samples, including timestamp ties; IDs remain strings to preserve bigint precision. The old recorder reader remains unchanged for exact retry recovery.

`telemetryModel.ts` handles both legacy columns/top-level `raw` and Phase 2D nested samples, including acceleration, rotation, mounting orientation, source G-force conventions, stored traces/smoothing, device JSON corner definitions/analysis/diagnostics, recording failures and relational sector results. Columns remain authoritative. Missing measurements remain null; invalid coordinates never become `0,0`. Legacy acceleration-positive longitudinal G is normalized with the original conversion; current braking-positive data is not inverted.

Empty embedded sector arrays now fall back to saved relational sectors. Recorded sector width/version outranks today's library or personal layout. This restores historical table/optimum behavior without recalculating or rewriting history. Source smoothing/corner calculations run in memory only where appropriate. Stored analysis text and optimum summaries remain visible separately from computed replay analysis.

This diagnosis is confirmed for **develop/testing contracts and synthetic historical fixtures**. Production was not accessed. It is not a claim that every symptom in another deployed branch has this same cause. Real historical data or production-specific schema/RLS differences still require an explicitly authorized read-only acceptance pass.

## Database and safety boundary

Only isolated testing project `mfzajhnfonrfuiwxgvhe` was used. Every added migration checks that exact environment. No tables, subscription rules or catalog were duplicated. Added public functions are invokers with fixed search paths, public/anonymous execution revoked, and existing entitlement/write/ownership helpers reused.

Applied testing-only migrations:

- `20261125020946_track_trace_telemetry_parity.sql`: authorized review bundle, complete legacy/current telemetry pagination, real session-card summaries and guarded rename.
- `20261125024733_track_trace_circuit_editors.sql`: eligible map read, private-owner corner metadata compare-and-swap, versioned default/personal sectors. Published map geometry/defaults cannot be overwritten, even by their owner.
- `20261125030225_track_trace_scan_metadata.sql`: wraps the existing validated private scan save to retain source notes/length atomically. Lost-response retries return the first saved scan and never overwrite it.

Historical GPS/laps/analysis and recording snapshots are not migrated, duplicated or rewritten. Existing archive integration, setup-link CAS, ownership RLS, community moderation and circuit restrictions remain in place. No production access, live RevenueCat changes, standalone edits, subscriber changes, pushes, merges or deployments occurred. Existing untracked preview work was preserved.

Advisors still report existing testing-project findings: public definer functions and password protection, plus existing RLS/performance notices. The new functions are invokers. References: [definer-execution review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS initialization performance](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). No unrelated security policy was changed to make tests pass.

## Verification and evidence

- Full regression: **891 passed, 5 failed, 0 skipped** (777/2 unit, 91/3 mounted, 23/0 database). All Track Trace/security tests passed. The five failures are unchanged unrelated files: archive hash pinning and billing-artifact hash pinning fail on checkout CRLF bytes; three mounted Assist tests omit the existing `./DeferredFeature` dependency. HEAD and LF-normalized hashes match reviewed fingerprints (`tmp/track-trace-parity/baseline-hashes.json`). Protected files were not normalized or edited.
- Final focused Track Trace run: **112 passed, 0 failed, 0 skipped**, including existing subscription/ownership/circuit regressions and historical/editor compatibility tests (`track-trace-final.log`).
- Hosted recording: **17 grouped checks passed**, real isolated Auth/RPC/database with deterministic synthetic GPS/motion. Pro/390 px and Factory/1280 px record three laps, preserve the recording's actual sector layout, retain exactly 64 samples through offline/lost-response retry, complete atomically and review through source controls. Free Record survives reload and server recovery after local-journal eviction. Timeout, zero-fix completion, denial, ownership and Sportsman recording restrictions are exercised.
- Historical compatibility: **3 grouped checks passed**. A synthetic original-format session has 502 samples, speed 20 m/s, raw acceleration/rotation, lateral/longitudinal/vertical G, two 20-second laps, four saved sectors, a track map and stored analysis. Both 390/1280 px render actual speed/G, sector columns, optimum details, replay, scrub/comparison and stored analysis. The animated G indicator reaches the measured value. Review requests no live GPS.
- Graphical editors: **3 hosted grouped checks passed**. Source corner ranges persist through private-owner CAS; source shared-track sector controls save personal overrides for Pro and Factory while canonical version/geometry/default sectors remain identical. Cleanup save is visibly disabled.
- Navigation: **7 widths passed** (320, 360, 390, 640, 768, 1024, 1280), zero page errors/external requests. Includes exact six Home actions, double-width placement/sizing, tier locks/upgrade, four-menu grid, independent/mapped/linked preparation, session list/review, unsaved setup preservation, exact linking, both Home share entries and scanner denial.
- App/node TypeScript, focused ESLint and testing preview build pass. ESLint has five source/existing fast-refresh warnings and zero errors. Build retains the existing large-chunk advisory.
- **No physical GPS, native sensor, purchase, advertising or production-history acceptance is claimed.**

Evidence in the local workspace:

- `tmp/qa-automation/2026-11-25T03-18-29.076Z-a33a50fc-47d4-44be-9fc3-eff6179e8bb6/report.json` and suite TAP files.
- `tmp/track-trace-parity/hosted/verify.json`, `legacy/report.json`, `editors/report.json`, `navigation/report.json` and screenshots in those directories.
- `tmp/track-trace-parity/model-final.log`, `focused.log`, `lint.json`, `build.log`, `baseline-hashes.json`.

## Local preview and physical-device acceptance

Local testing preview: <http://127.0.0.1:4196/track-trace> (isolated testing login required). The build lives under `tmp/track-trace-parity/build`. It is not a deployment. The loopback HTTP exception works on this computer; another phone cannot use this address as its HTTPS GPS test surface.

For review, [open the synthetic historical fixture](http://127.0.0.1:4196/track-trace?view=review&session=9e3bf213-79e7-4cfb-86fe-ceecb3341b23) using the dedicated testing Pro owner. One deliberately labelled `QA legacy OnlyLaps parity 3b743970` session (502 samples) and its synthetic canonical map are retained in the testing backend for this preview. They are not real historical telemetry. Disposable scan-test maps were removed by exact ID after checking owner/name and absence of dependent sessions; test tiers were restored. Screenshots remain available without signing in.

Before physical acceptance, use an approved HTTPS testing build or testing native wrapper configured for `mfzajhnfonrfuiwxgvhe`, with real device callbacks and all synthetic browser overrides absent.

1. Use the testing Pro/Factory account. Grant precise location and verify device location services. Check GPS readiness outdoors, then arm a session on a known closed circuit with a valid saved start/finish line. Select the actual phone mounting arrow.
2. Confirm Armed remains visible until a fresh fix. Deny location once and test no-fix/timeout: zero samples must never become Live or a completed recording. Resume after permission is corrected.
3. Explicitly enable motion sensors; accept both permission prompts where required. Check speed, axes, G polarity and accuracy with the device mounted as selected. Absent sensors must show unavailable values.
4. Run the closed circuit in its saved direction. Check start/finish, minimum-duration/accuracy rejection, current/last/fastest laps, sector results and live trace against an independent reference. Record device, OS/wrapper/browser, signal conditions and reference timing.
5. Test screen lock/unlock, background/foreground, temporary location loss and offline/reconnect. Completed laps/data must remain; an interrupted incomplete lap restarts at the next valid crossing. Do not assume background continuity from a wake-lock message.
6. End with confirmation, verify persisted sample/lap/sector counts, then reopen review. Exercise raw/smoothed maps, speed/G, lap comparison, optimum and corner confidence, play/pause/rate/scrub/full/follow views. Missing source measurements must remain unavailable.
7. Test recovery after reload and a lost response. Export diagnostics before clearing any device data if it fails. Scan outside/start-finish/inside, review metadata and geometry, save privately and define corners/sectors graphically. Shared maps must retain immutable canonical geometry.
8. Repeat on target iOS and Android hardware/wrappers, then perform long-session and dense-sample stress tests. Separately authorize any production read-only historical comparison; this work grants no production write/publication/deployment permission.

Release gaps remain the AI/share resolver and atomic cleanup dependencies above, original GPS-nearby suggestion wizard, long-session stress testing, real historical acceptance and physical-device validation. These are explicit gaps, not simulated working features.

## Changed files

The exact task file inventory is recorded in [ONLYFAST_2027_TRACK_TRACE_PARITY_FILES.txt](ONLYFAST_2027_TRACK_TRACE_PARITY_FILES.txt). Main groups are the existing route/recorder/scanner/review adapters, source circuit views/math, telemetry compatibility and editor services, three testing-only migrations, three focused test files and four browser harnesses. The original six dashboard actions, entitlement implementation, production migrations and archive/billing artifacts were not edited.
