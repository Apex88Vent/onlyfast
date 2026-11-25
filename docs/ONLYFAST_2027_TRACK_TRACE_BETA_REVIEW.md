# OnlyFast Track Trace BETA — mobile review and Overall Assist

November 25, 2026 (America/Los_Angeles). Primary checkout, `develop/onlyfast-2027`, baseline `17b48fad`. Source changes remain local and uncommitted; testing-backend additions are listed below. No Git push, merge or production deployment. Existing `develop/track-trace-onlyfast-ui-2027` checkpoint and preview work remain preserved.

This increment keeps the existing Track Trace route, circuit recorder, authorization, community catalog and exact setup links. It adds compact mobile presentation, independently collapsible review, measured per-corner benchmarks, the requested G-force visual scale and a separate driving-performance Overall Assist. It does not replace mechanical Setup Assist.

## 1. Mobile layout and dimensions

The menu remains Start Session / Review Session / Track Library / Scan Track in a 2×2 grid. Mobile cards have smaller icons, padding and spacing, with wrapping text and accessible controls. Desktop retains 210 px minimum card height. The BETA badge remains visible; its information notice is initially collapsed. The route respects safe-area padding and has one context-appropriate back link.

Measured with the clearly labelled QA banner present:

| Viewport | Card width | Row heights | Last card bottom | Result |
| --- | ---: | ---: | ---: | --- |
| 320×568 | 142 px | 154 / 130 px | 565 px | All four fit |
| 360×640 | 162 px | 130 / 114 px | 509 px | All four fit |
| 390×844, Chrome and WebKit | 177 px | 114 / 114 px | 493 px | All four fit |
| 390×480 | 177 px | 114 / 114 px | 493 px | Scrolls without clipping |
| 768×1024 | 360 px | 210 / 210 px | 725 px | Desktop sizing retained |
| 1280×900 | 440 px | 210 / 210 px | 725 px | Desktop sizing retained |

At 200% root text size, cards grow vertically and remain accessible without page-level horizontal overflow. Safe-area CSS and narrow layouts were checked; actual notched-device/native-wrapper insets still need device acceptance. Existing dashboard six actions, full-width telemetry tile, Home menu ordering, View Shared Setup and Sportsman upgrade pathway pass the navigation checks.

## 2. Review interaction and loading

Initial content is a compact summary with fastest/average lap, valid lap count, duration and a selectable lap list. No lap is automatically selected. These ten sections begin independently collapsed: timing, sectors, GPS trace, speed, G-force, lap comparisons, corners, optimum, Overall Assist and observations.

One selected lap enables individual review; multiple selections enable original comparison controls and an individual-review lap selector. Collapsing a section preserves selections. Opening lap-specific analysis without a selection prompts for one and does not read GPS pages. Overall Assist and optimum deliberately use all compatible eligible laps and identify their sources. Free Record can show its actual session trace/speed/G without inventing completed laps.

Initial review uses a new lean summary RPC that delegates the existing authorized reads, removes embedded traces/track snapshots and retains timings. Full detail is requested only when needed. React Query caches it for five minutes under owner, permission revision and session ID; no persistent telemetry cache is introduced. The mounted review reuses its detail result across sections. Inactive cache is collected on unmount. Existing 500-row cursor pagination remains intact, including cancellation between requests. Read failures show retry while preserving summary and selections.

Original replay controls, playback rate, raw/smoothed trace, follow/full map, selected-lap details, sector tables and optimum replay remain available within the requested collapsible organization. Missing motion, map or speed data stays unavailable.

## 3. Independent corner benchmarks

`circuit/cornerBenchmarks.ts` uses a single oriented track frame from the original `getTrackEditorPath`, with the saved start/finish origin and saved corner boundaries. Every eligible lap projects onto that same reference; each lap is not normalized to its own path length. Start, apex and exit crossing times are interpolated from real sample timestamps. Each corner selects its own lowest valid elapsed time, independently of the fastest complete lap.

Compatibility checks reject explicit layout, version, direction, sector-definition and corner-definition mismatches, invalid laps, incomplete/non-monotonic traversals, interruption flags, gaps over two seconds and very poor fixes. Saved apex coordinates must agree with saved progress in the editor frame. Unverified historical geometry or absent saved corner boundaries produces no corner plan. Inferred preview corners do not become authoritative driving guidance.

The deterministic fixture's fastest full lap is Lap 3, while Turns 1–4 reference Laps **1, 2, 3, 3**, with corner times **2, 2, 2, 3 seconds**. Tests assert selected/reference times, deltas and attribution, rather than treating passing engine tests as UI parity.

Expanded corner evidence includes actual entry/apex/exit positions, recorded path, entry/minimum/exit speed, path distance, observed peak loads, supported braking duration/onset, lateral-load onset and acceleration pickup. Original map components overlay selected/reference traces. Metric and imperial units are supported; imperial distances include yards and feet. Explanations distinguish measured inputs, calculated differences and cautious suggested comparisons; they do not claim causation.

## 4. G-force visual thresholds

The shared live/review indicator uses **0.75 G yellow** and **1.50 G red/outer radius**. Vector magnitude determines radial clamping, so diagonal loads cannot escape the circle. Braking remains up, acceleration down and lateral direction unchanged. Above 1.50 G, only the ball position clamps; the actual numeric reading is retained. Original acceleration values, axis conventions, orientation/calibration, sensor processing and animation smoothing are unchanged.

## 5–6. Overall Assist and actual/theoretical timing

Overall Assist is initially collapsed and separate from mechanical Setup Assist. It shows:

- Fastest actual valid completed lap and eligible source laps.
- Original OnlyLaps optimum sector-sum result with sector-by-sector source attribution.
- Theoretical difference from the actual fastest lap, explicitly not a promised gain.
- Independently fastest measured corner traversals, quality and coverage.
- A start/finish-to-finish strategy using the fastest complete lap as its continuous baseline, corner references, supported load-onset locations, supporting evidence and recorded-line overlays.
- Continuous recorded corner connections where the data supports them. Last-to-first requires the following lap and real continuous samples; it never wraps backward into the same lap or bridges an interruption.

`buildCompatibleOptimum` filters invalid/incompatible inputs before calling the **unchanged original `optimumLap.ts` algorithm**. Review and Overall Assist use the same guard. Fastest individual sectors/corners are theoretical references with possibly incompatible entry/exit conditions. The interface does not call their sum an achievable connected lap. Transition comparisons rank actual recorded connections by combined corner time and explicitly do not optimize the intervening straight.

Each factual item carries an evidence ID, source lap(s), unit, measured/calculated classification and applicable uncertainty. Per-corner differences versus the fastest complete lap are reported only when distinguishable above estimated timing uncertainty. With no valid laps, one lap, missing definitions or missing telemetry, the interface reduces its claims instead of producing invented improvement targets.

## 7. AI integration and deterministic fallback

`track-trace-overall-assist` reuses the established OpenAI provider and usage authorization ledger. It is testing-only and opt-in: `TRACK_TRACE_OVERALL_AI_ENABLED=true` and the existing provider key are both required. **No secret, provider activation or paid provider call was changed/performed in this task.** The deterministic plan works without AI.

The function verifies JWT and current Pro/Factory recording permission, validates body/session/request IDs, reads with the caller JWT through existing circuit/owner-authorized RPCs, and recomputes evidence on the server. Client-supplied facts are rejected. A service client is constructed only for the existing usage lease after authorization; it does not read private telemetry. Provider analysis has an explicit 50,000-sample limit and never presents a partial read as a complete benchmark. Normal review pagination is not capped by that provider limit.

The optional model chooses a grounded explanatory focus and supporting evidence IDs for each existing corner plan. A strict structured schema and server/client validation reject new references, fields, numbers and free-form claims. Numeric facts and cautious narrative remain rendered from deterministic evidence. This intentionally limits AI output to supported focus selection rather than unchecked driving prose. Disabled provider, timeout, quota, malformed output or outage leaves the measured plan available. It never blocks review or normal setup workflows.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), [Supabase Edge JWT verification](https://supabase.com/docs/guides/functions/auth-legacy-jwt).

## 8. Quality safeguards

Precise track-relative position guidance requires known reference/start-finish accuracy and sample accuracy no worse than 4 m, gaps no greater than 600 ms, sufficient samples and no low-confidence smoothing. Unsupported accuracy is not treated as zero error. Approximate position uncertainty includes sample and reference accuracy; timing uncertainty conservatively includes interpolation gaps and position/speed error. These are screening estimates, not calibrated statistical confidence intervals.

Differences below combined uncertainty are suppressed. Inside-boundary distances require an actual sufficiently accurate scanned boundary; no track edges or landmarks are inferred. Absolute distance-after-start/finish guidance is withheld without a recorded start/finish reference. Motion-based locations require recorded phone orientation. An onset requires an observed below-to-above threshold crossing followed by sustained readings; an already active constant load does not establish an onset. GPS load onset is labelled a comparison reference, not measured steering angle or pedal position.

Historical adapters retain explicit source track IDs and geometry provenance instead of overwriting them with the session track. Missing corner boundaries allow lap/sector observations without fabricated corner advice. Original G-force convention handling remains intact, including newer braking-positive samples stored in legacy-shaped rows.

## Source continuity / parity matrix

Original source is `Apex88Vent/OnlyLaps-app` revision `22f372508582fb43d56b66947c26740233bcdb19`, inspected in the [previous corrective audit](ONLYFAST_2027_TRACK_TRACE_PARITY.md). Paths below are relative to the integrated Track Trace feature. That report retains the complete source-by-source matrix and prior GPS/historical-data root causes; this update supersedes its review presentation and AI dependency status only.

| Circuit feature | Original source / retained implementation | Current status and intentional adaptation |
| --- | --- | --- |
| Recording/GPS/lap and sector timing | Recorder hook, `useCircuitGps`, `circuit/recorder`, crossing/sector/math helpers | Controller lifecycle and sample processing unchanged; light live UI retains speed, G, timing, accuracy and actual map |
| Live display | `SessionActiveScreen`, `GForceIndicator`, `ReplayMap` | `LiveCircuitReadouts` preserves values/control order in OnlyFast cards; requested visual G scaling only |
| Session selection/list | `ReviewSessionsPage`, session service | Existing list/pagination retained; light presentation |
| Review organization | `SessionDetailPage`, `LapSectorTable`, `SelectedLapDetails` | Requested ten independent collapsed sections and explicit selection; no automatic chart population |
| Replay and lap comparison | `LapComparison`, `LapTraceView`, `ReplayMap`, `ReplayTelemetryPanel` | Original playback, comparison, projections and raw/smoothed behavior retained inside sections |
| Optimum lap | `optimumLap`, `OptimumLapSummary` | Original algorithm unchanged; shared compatibility gate and theoretical labels |
| Corner analysis | Original corner/editor geometry, recorded samples | Independent per-corner elapsed-time benchmark replaces fastest-full-lap attribution; stored/source analysis remains available |
| Historical telemetry | Existing full bundle/page RPCs and adapter | Legacy/current GPS, speed, G, acceleration, sectors, map and analysis preserved; lean initial summary only |
| Scanning/editors/community | Existing scan, editor, catalog modules | Unchanged; cleanup persistence and telemetry sharing dependencies from prior report remain |
| Setup integration/security | Existing links, entitlement hook/RPCs/RLS and Setup Assist | Unchanged; source audit protects these files; Sportsman lock and equal Pro/Factory access retained |

## 9. Regression and targeted results

| Check | Result |
| --- | --- |
| Full existing automation regression | **912 passed, 5 failed, 0 skipped** |
| New corner/Overall/AI/security/summary tests plus historical parity suite | **29 passed, 0 failed** (21 new, 8 existing) |
| App TypeScript and Node TypeScript | Passed |
| Feature ESLint | 0 errors, 5 existing/source hook or Fast Refresh warnings |
| Isolated testing app Vite build | Passed; existing large-chunk advisory remains |
| Protected source audit | 160 baseline files unchanged, six recorder handlers unchanged, GPS callback/effects unchanged, original optimum algorithm unchanged |
| Hosted testing summary | Owned read accepted; foreign read denied; full payload hash unchanged; invoker/fixed search path/anonymous denial verified |
| Hosted Edge version 4 | Active, JWT verification on; anonymous and invalid JWT both HTTP 401 |
| Historical testing fixture | 502 samples, two laps, four sectors, map and one analysis preserved; optimum 20 seconds; zero invented corner plans |

All Track Trace regression/security tests pass. The five full-suite failures already existed at baseline `17b48fad`: `archive2027InstalledOrder` and `billing2027Artifacts` pin reviewed SQL hashes that differ on checkout CRLF bytes; one native-ad mounted Assist case and two Setup Assist mounted cases omit the existing `./DeferredFeature` test stub. The unrelated archive/billing files and harnesses were preserved. Baseline result was 891 passed / the same five failures; this task adds 21 passing tests. The full suite is therefore **not wholly green**.

Current regression evidence: `tmp/qa-automation/2026-11-25T18-02-12.267Z-eb374d00-24d2-4768-af38-069d06dccd64/report.json` plus `unit.tap`, `mounted.tap` and database logs. Focused, build, lint, source audit and hosted summaries are in `tmp/track-trace-beta/`.

## 10. Browser and historical verification

Seven BETA configurations pass: Chrome at 320×568, 360×640, 390×844, 390×480, 768×1024 and 1280×900, plus WebKit at 390×844. Checks include menu geometry, 200% text, initial ten collapsed sections, no initial sample pages, selection preservation, independent sections, three-page detail cache reuse, original replay/comparison, per-corner references, Overall session-wide sources, G thresholds and AI outage fallback. No page errors or external requests occurred in these isolated fixture runs.

The existing navigation harness also passes seven widths (320/360/390/640/768/1024/1280): original six actions, full-width telemetry tile, tier locks/upgrade, four menu actions, independent/mapped session preparation, community selection, scanner denial, exact Hot Laps/Heat/Main/Custom setup links, duplicate-link prevention, unsaved edits, Home menu placement and unchanged View Shared Setup.

The historical fixture was exported read-only from the exact previously labelled synthetic QA record in testing, not from a customer's production history. Every sample's location, speed, acceleration and convention-correct G values was checked against its source, with no source mutation. Browser checks exercise its two-page trace read, source replay and graceful missing-corner state. Additional tests cover telemetry read failure/retry and Free Record with no completed laps.

Evidence: `tmp/track-trace-beta/browser-report.json`, `historical-report.json`, `hosted-summary-report.json`, `hosted-edge-report.json`, `scope-report.json` and screenshots; navigation evidence is `tmp/track-trace-parity/navigation/report.json`.

These browser checks use actual integrated components with explicitly synthetic data. Hosted summary checks use SQL role/JWT-claim simulation; handler tests inject authenticated readers. A fresh signed Pro/Factory browser/provider HTTP roundtrip was not performed in this increment. Prior hosted recording checks are documented in the corrective report, not counted as newly performed checks here.

The actual port 4201 app also passes a startup smoke check: its guard reads the exact testing project's environment RPC, mounts the testing banner and reaches Sign In without a JavaScript error. The smoke check allowed only localhost and that testing Supabase origin; external fonts were blocked. No production backend request occurred. The gallery and its screenshot assets also load successfully. Evidence: `tmp/track-trace-beta/local-smoke-report.json`.

## 11. Files changed

Exact task inventory: [ONLYFAST_2027_TRACK_TRACE_BETA_FILES.txt](ONLYFAST_2027_TRACK_TRACE_BETA_FILES.txt).

Changes are confined to Track Trace presentation/read adapters, new deterministic analysis and optional testing function, one testing-only summary migration, focused tests/QA previews and these reports. No existing auth/entitlement tables, RLS, recorder engine, calibration, setup integration, original telemetry math, original optimum algorithm or standalone OnlyLaps source was changed. The previous full audit remains available in the corrective report.

## 12. Testing-only database and Edge changes

Only project **`mfzajhnfonrfuiwxgvhe`**, through the testing-account connection, was changed.

- CLI-generated `supabase/testing-2027/20261125175146_track_trace_review_summary.sql`, applied through MCP with hosted migration version **20261125175443**, creates only `get_track_trace_review_summary(uuid,uuid)`. Exact testing-project guard; security invoker; empty search path; authenticated execution only; existing owner/class/archive/circuit and setup-link authorization delegated to existing RPCs. No historical row updates, schema tables, RLS or entitlement duplication.
- New `track-trace-overall-assist` Edge function is **ACTIVE version 4**, JWT verification enabled. Bundled deployment SHA-256 `1900345d3ecf2c3933c0a3ba70568632e44d294cab10b0cc996c70b4b0694e8f`. The checked-in config also requires JWT verification. No provider secret or activation flag changed.
- Security advisory categories are unchanged before/after: one INFO (`rls_enabled_no_policy`) and two WARN categories (existing definer execution and leaked-password protection); no new category for the summary reader.

Production databases were not accessed or modified. No live RevenueCat product, subscriber migration, production purchasing/advertising hold, standalone OnlyLaps, unrelated archive work, source history, branch/worktree or production deployment was changed. Existing preview artifacts were preserved.

## 13. Remaining integration and physical-device acceptance

The previous telemetry share-code resolver and scan-cleanup persistence dependencies remain explicitly unavailable; they were not fabricated or broadened by this task. AI provider activation and a signed authenticated provider roundtrip remain operator testing steps. This increment does not claim physical GPS, native motion, production-history or purchase acceptance.

On the isolated testing build over HTTPS or an appropriate native testing wrapper:

1. Sign in as an existing testing Pro or Factory account. Confirm Sportsman sees the existing lock/upgrade path. Select a saved circuit and independently prepare a session; separately verify an exact setup-linked session.
2. On a mounted phone, grant location and motion from the explicit start action. Check all supported mounting orientations, first-fix readiness, actual accuracy, current speed and G direction/actual number. Compare known controlled motion with the new visual thresholds; readings above 1.50 must remain numeric while the ball stays within the circle.
3. On a controlled circuit, record actual laps/sectors and inspect live trace/current/last/fastest timing. Test denial, timeout/no fix, signal loss, visibility changes, screen lock and recovery. A registered watch without real samples must not display successful recording or allow empty completion.
4. End with the existing confirmation. Reload and review actual persisted GPS/speed/G, sectors, map and replay. Test offline retry/lost response and recovery without duplicate samples or sessions.
5. Confirm ten initial collapsed sections, single/multiple selection, cache reuse, independent expansion and readable 200% text on short/notched phones and desktop. Compare recorded corner references with the actual saved layout/version/direction.
6. Review Overall Assist with real device accuracy and sampling. Expect precise positions to be withheld when accuracy, calibration or saved definitions are insufficient. Confirm actual fastest/sector theoretical values against the source table; do not interpret isolated corner gains as a promised lap time.
7. With separately reviewed provider configuration, exercise the signed Explain request, usage lease, disabled-provider and outage fallback. Attempt another user's session and an invalid entitlement; both must remain denied. Keep all acceptance data in testing.

Localhost on another device is not the desktop server, and ordinary LAN HTTP is not a sufficient secure context for browser GPS/motion. Physical testing needs the approved testing HTTPS/native environment; these local previews do not establish device acceptance.

## 14. Local preview and reproduction

- [Mobile-first visual gallery](http://127.0.0.1:4200/gallery.html)
- [Interactive synthetic menu](http://127.0.0.1:4200/track-trace)
- [Interactive synthetic session review](http://127.0.0.1:4200/track-trace?view=review&session=10000000-0000-4000-8000-000000000001)
- [Actual isolated testing application, sign-in required](http://127.0.0.1:4201/app)

Port 4200 packages the actual components with a visible synthetic-data banner, no production client and a `connect-src 'none'` policy. It does not record GPS or fabricate successful saves/scans. Port 4201 serves the exact preview build with the existing isolated testing-backend guard. Both local processes run hidden; PIDs/logs are in `tmp/track-trace-beta/local-processes.json` and `local-*.log`.

Re-run the focused tests:

```powershell
node --experimental-strip-types --test tests/trackTraceOverallAssist.test.ts tests/trackTraceOverallSecurity.test.ts tests/trackTraceReviewSummaryDatabase.test.ts tests/trackTraceTelemetryParity.test.ts
node --experimental-strip-types qa/automation/runner.mjs regression
node qa/automation/verify-track-trace-beta-scope.mjs
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
```

For browser QA set `ONLYFAST_PLAYWRIGHT_MODULE` to an installed Playwright module, build the isolated app using the established 2027 preview environment, then run `build-track-trace-beta-preview.mjs` and `track-trace-beta-browser.mjs`. The latter owns port 4200 while running, so stop only this task's saved preview PID before rerunning it. `track-trace-navigation.mjs` verifies the existing navigation flows. The optional historical UI check requires the labelled synthetic testing export at `tmp/track-trace-beta/historical-fixture.json`; no production export is required or authorized.

After checks, rebuild the synthetic preview to include screenshots, then serve each output using Vite preview on ports 4200/4201. Do not push to obtain a preview: pushes can trigger deployment, and no push or production release is authorized here.
