# OnlyFast Track Trace — Phase 2B

Current testing status: [Phase 2D live GPS and scanning](ONLYFAST_2027_TRACK_TRACE_PHASE2D.md).
Recording/scanning pending statements in this earlier audit are historical.

Latest follow-up: [UI refinements and independent session preparation](ONLYFAST_2027_TRACK_TRACE_REFINEMENTS.md).
This adds owned unlinked preparation and exact discipline badge/card styling;
the report below records the earlier Phase 2B delivery and audit.

Verified November 14, 2026 on `develop/onlyfast-2027`. Release target: OnlyFast
1.2, Tulsa Shootout, **BETA**. This is an incremental extension of the existing
Track Trace route, authorization, tables, session preparation and review.

## Implemented

- Central BETA configuration in `config.ts`; existing badge styling on the
  landing entry, menu header, per-setup linking controls, preparation and review.
  The menu contains the requested beta information verbatim. Both paid tiers
  display it; entitlements are unchanged.
- The individual setup editor now contains **Link Track Trace Telemetry**.
  The picker lists owned circuit sessions with name, date, track, lap count and
  fastest valid lap. It uses the immutable `race_setups.id`; Hot Laps, Heat,
  Main and custom sessions remain independent.
- Link, replacement, unlink and review stay inside dialogs while the setup
  editor remains mounted. Existing one-to-one associations are enforced.
  Linked-elsewhere choices are disabled. Missing or unavailable telemetry,
  read-only setups, retries and API failures have explicit states.
- Sportsman sees a locked control and the existing upgrade route. Existing
  read-only history capability, when supplied by the server, is preserved.
  Pro and Factory use the same server-authoritative permission hook.
- Track Library lists actual RLS-visible saved circuit maps, map versions,
  saved start/finish state and default/personal sector definition versions.
  It handles incomplete scan data and selects an owned map for the existing
  preparation RPC. No open-route/Gumball track is included. Existing visible
  maps that cannot be selected remain view-only; no ownership policy is widened.
- A user-triggered **GPS availability** check reuses OnlyLaps' one-fix options
  and coordinate conversion. It reports accuracy or a clear denied/unavailable
  state. It never watches location, arms a session, writes samples or times laps.

The six original dashboard buttons and their order are unchanged. The existing
Track Trace menu and shared telemetry navigation entry are reused.

## Database and Setup Assist

Applied only to testing project `mfzajhnfonrfuiwxgvhe`:
`supabase/testing-2027/20261114144200_track_trace_phase2b.sql`.
The migration asserts the testing environment marker before making changes.
No new tables, duplicated entitlement logic, data copy or historical relinking.

New public SECURITY INVOKER RPCs:

- `list_track_trace_link_candidates(setup_id, offset)` — exact setup, 25 rows.
- `set_track_trace_session_link(setup_id, session_id, expected_session_id)` —
  wraps the original service-only atomic set/unlink functions. Rechecks paid
  access, setup editability/class, both owners, circuit mode and one-to-one
  constraints. A per-user lock plus expected-current comparison rejects stale
  changes. Replacing a link retains its existing link-row identifier.
- `list_track_trace_tracks(offset)` — 50 maps, existing table RLS retained.

Private helpers have fixed empty search paths, explicit grants and caller checks.
New restrictive link-table write policies also enforce setup editability on
direct authenticated writes. Anonymous calls are denied. Original owner,
composite FK, circuit and unique constraints remain active.

The shared review component uses the existing session/context RPCs.
`onlyfast_onlylaps_setup_context_v1` and its distinction between measured
evidence, derived analysis and AI interpretation remain unchanged. Link changes
emit the existing refresh event. HandlingFeedback uses the existing
`track-trace-setup-context` endpoint in the isolated app. The `get-suggestions`
source now checks central Track Trace permission in the testing environment,
using the caller's JWT; permission errors disable optional context and preserve
ordinary Setup Assist. The existing non-testing authorization path is retained.

No Edge Function was deployed in Phase 2B. Live testing AI provider configuration
and a reviewed testing-only deployment of `get-suggestions` remain necessary
before claiming AI recommendations use this new testing permission path.

Both installed Phase 1C and the separate pending archive/history schema were
tested in disposable local databases. The archive SQL files were neither edited
nor installed; their initial SHA-256 hashes match after this task. The existing
hosted `/app` permissions notice from that separate unapplied integration is
not fixed here. A signed-in Pro browser smoke check against the final built
preview confirmed that notice, no mounted link control and no JavaScript errors.
Actual hosted core-editor acceptance remains dependent on that work; mounted
component tests verify draft/save isolation independently.

## OnlyLaps source audit and reuse

The local `Apex88/OnlyLaps` directory contains images, not application source.
Read-only GitHub inspection located `Apex88Vent/OnlyLaps-app`, pinned to
`22f372508582fb43d56b66947c26740233bcdb19`.
No standalone files, database or deployment were changed.

| Responsibility | Existing OnlyLaps source and boundary |
| --- | --- |
| GPS permission and single precise fix | `lib/lap-session/lapSessionService.ts`: `getCurrentHighAccuracyPosition` and point conversion. Only this small behavior was adapted locally, with provenance and unchanged high-accuracy/zero-cache/10-second options. |
| Location monitoring, arming, sample persistence, completion | `hooks/lap-session/useLapRecorder.ts`; `createLiveLapSession`, `appendLiveTelemetrySample`, `saveCompletedLapSession` in the service. Tracks pending persistence promises and saved sample indexes. Hook directly imports Gumball detection/processing/map services. |
| Start/finish and lap filtering | `lib/lap-session/startFinishCrossing.ts`, `lapFiltering.ts`; consumed by the recorder/service. Existing algorithms must be retained during extraction. |
| Sector timing and smoothing | `sectorTiming.ts`, `sectorService.ts`, `telemetrySmoothing.ts`, plus track projection, corner analysis and optimum-lap helpers. Not reimplemented here. |
| Scanning | `components/track-scan/TrackScanPage.tsx`, `TrackScanRecorder.tsx`, `hooks/useTrackScanGps.ts`, `lib/track-scan/onlylapsTrackMapService.ts`. Geolocation watch, permission/wake-lock state, captured geometry and map saving are coupled to OnlyLaps auth/config and selected-track services. |
| Track library | `components/track-library/TrackLibraryPage.tsx`, map service. Its published-track query expects `publication_status`, which is absent from the current testing schema. OnlyFast uses the existing permitted map/sector fields through its RLS-preserving adapter instead of importing that query. |
| Platform lifecycle | `useWakeLock.ts`, `useMotionTelemetry.ts`; browser visibility/wake-lock and device motion permissions. Screens use Next navigation and the OnlyLaps auth/dev-bypass environment. OnlyFast is Vite/React 18; OnlyLaps uses Next/React 19. |
| Review and comparisons | `ReviewSessionsPage.tsx`, `SessionDetailPage.tsx`, `LapComparison.tsx`, replay/sector/corner components; service detail loading and normalization. Existing OnlyFast saved review is reused; full replay/comparison is still pending. |
| Share code validation | `lib/lap-session/telemetryShareService.ts`: normalizes the existing eight-character format; `loadSharedTelemetry` calls `onlylaps_resolve_telemetry_share({requested_code})`; handles invalid, expired, revoked and missing results. `SharedTelemetryPage.tsx` renders the returned payload. |

The audited `SessionActiveScreen` calls `onEndSession` directly;
`StartSessionPage.endSession` calls the recorder and navigates to saved review.
No four-digit end confirmation was found in this audited flow. A compatible
implementation/version containing that behavior must be identified or the
confirmation design separately reviewed. Nothing here removes an existing
OnlyFast confirmation or claims that a new recorder is operational.

## Remaining integrations and approval scope

**Recording and scanning remain unavailable.** The UI states this explicitly and
provides safe navigation away. Importing the mixed-mode recorder/service or scan
pages wholesale would carry standalone auth/dev bypass, Next navigation and
Gumball code into OnlyFast. No simulated scans, generated laps, local-only
recordings or replacement timing algorithms were added.

Proposed cross-repository work requiring approval:

1. Extract circuit-only start/finish, filtering, smoothing, sector and recording
   orchestration from the pinned OnlyLaps modules into a shared module/package.
   Separate Gumball imports without changing the standalone app's behavior.
2. Define injected location, motion, wake-lock, authenticated persistence and
   navigation adapters. OnlyFast must retain its testing-only client and current
   owner/circuit policies. The standalone app would adopt the shared module only
   through a separately reviewed change and its regression suite.
3. Adapt circuit scan geometry/start-finish/corner/sector/version saving to the
   existing map contract, then verify actual-device permission, accuracy,
   background/visibility recovery, persistence/retry and completion behavior.
   Identify the four-digit confirmation source before adopting it.
4. Reuse the existing secure sharing service and resolver contract against an
   approved backend. The resolver is absent from this testing project. Do not
   install standalone sharing migrations or create a new code format implicitly.

**Sharing remains pending.** The existing Home entry opens the honest dependency
dialog. There is no pretend code validator, session response, import or setup
link. Invalid/expired/revoked code execution cannot be accepted until the actual
resolver is available. Existing View Shared Setup remains unchanged and tested.

**No physical-device GPS validation was performed.** Automated one-fix success,
denial and failure tests are not evidence that live timing works. These engine,
sharing and testing AI dependencies block a complete 1.2 telemetry experience.

## Verification and preview

- Final `npm run qa:regression`: **752 passed, 0 failed, 0 skipped**.
  Includes 16 Phase 2B database tests across both schema variants, mounted
  Pro/Factory link/change/unlink/save isolation, central BETA configuration,
  Sportsman/missing-session states, GPS errors and actual-handler Setup Assist
  permission-outage fallback.
- Hosted verifier: **20 grouped checks passed** using synthetic testing accounts
  and real testing Auth/RPCs/records, plus 12 browser traversals across three
  tiers and four viewports. Synthetic stored GPS/laps verify durability/security;
  they were not device recordings. Disposable records and five orphan weekend
  metadata records were removed; test tiers restored.
  The existing map DELETE policy returned no rows for the authenticated cleanup;
  the exact disposable map was verified and removed through the testing-only
  operator connection. Policies were not relaxed. The verifier records this
  pending cleanup explicitly on future runs.
- Synthetic component browser verification: **320, 390, 768, 1280 px**, both
  paid tiers, Sportsman upgrades, original six buttons, double-width telemetry
  entry, 2x2 menu, track selection/metadata, review, links and independent setup
  context, unsaved draft preservation, simulated GPS denial, share pending state,
  unchanged shared-setup form and mobile navigation. No JS errors or external
  network calls. Visual screenshots reviewed at 320 px.
- App/node TypeScript, feature-module ESLint, isolated testing preview build and
  `git diff --check` pass. Build retains the existing large-chunk warning.
  Whole-file lint for the two existing editor components has **45 errors and
  8 warnings**, identical to their initial versions, with no new messages.
- Security advisor comparison: no added findings. Existing notices are 8 INFO
  RLS-without-policy, 14 WARN public authenticated SECURITY DEFINER functions,
  and 1 WARN disabled leaked-password protection. See the existing
  [function advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
  and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Evidence:
`tmp/qa-automation/2026-11-14T15-01-53.213Z-6b74b123-4d01-45e2-8076-5a88f0f7dee6/report.json`,
`tmp/track-trace-navigation/report.json` and screenshots,
`tmp/track-trace-review/hosted.json`,
`tmp/track-trace-phase2b/{advisors.json,lint-baseline.json,preserved-hashes.json}`.
The separate core Home smoke result is `tmp/track-trace-phase2b/home-smoke.json`
with `hosted-home-390.png`; it blocked an existing external image CDN request.

Local built preview: <http://127.0.0.1:4191/track-trace> (testing login required).
Home: <http://127.0.0.1:4191/app>. No hosted frontend deployment was created.

## Files changed in Phase 2B

- Existing feature files: `api.ts`, `TrackTraceEntry.tsx`, `TrackTraceMenu.tsx`,
  `TrackTracePage.tsx`, `SharedTelemetryDialog.tsx`.
- New files inside that same feature: `config.ts`, `TrackTraceBeta.tsx`,
  `TrackTraceSessionLink.tsx`, `TrackTraceSessionReview.tsx`,
  `TrackTraceLibrary.tsx`, `GpsReadiness.tsx`, `gpsAvailability.ts`.
- Relevant hunks only: `src/components/{SetupDashboard,HandlingFeedback}.tsx`,
  `supabase/functions/get-suggestions/index.ts`.
- Testing-only migration: `supabase/testing-2027/20261114144200_track_trace_phase2b.sql`.
- Tests: `tests/trackTraceNavigation.test.ts`,
  `tests/trackTracePhase2b{Database,UI}.test.ts`,
  `tests/helpers/trackTracePhase2b.mjs`, `tests/setupAssistTrackUpdates.test.ts`.
- Existing verifiers: `qa/automation/track-trace-{navigation,hosted}.mjs`.
- This report and phase links in the two existing Track Trace documents.

Other preexisting dirty files remain preserved. No commits, pushes, merges,
production operations, billing changes, subscriber migration activation,
standalone OnlyLaps edits or archive integration edits were performed.
