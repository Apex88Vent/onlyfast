# Track Trace navigation update

Current follow-up: [Phase 2B report](ONLYFAST_2027_TRACK_TRACE_PHASE2B.md),
November 14, 2026. The Track Library is now functional and BETA labels and
in-place setup linking are implemented. Phase 2B records current test results,
preview URL and the remaining recording/scanning/sharing dependencies.

November 13, 2026 (America/Los_Angeles), `develop/onlyfast-2027`.
Incremental update to [the existing foundation](ONLYFAST_2027_TRACK_TRACE.md).

## Interface

- The original six Home actions, their labels, handlers and grid classes are
  unchanged. A new `HomeLanding.actionGridSlot` inserts **Track Trace Telemetry**
  as the last grid child with `col-span-2`. The previous standalone dashboard
  shortcut is replaced, so the landing page has one telemetry entry.
- Sportsman sees a lock and **Upgrade to Pro to Unlock**; clicking uses the
  existing `/upgrade` route. Pro and Factory open the existing `/track-trace`
  route. Unknown or failed authorization leaves navigation unavailable.
- `/track-trace` now defaults to a 2x2 menu: **Start Session**, **Review Session**,
  **Track Library**, **Scan Track**. Query-string views reuse the same route.
- Start Session selects a saved race-session row using the existing owner-scoped
  `list_user_setup_summaries` RPC, then opens the existing preparation form and
  calls the unchanged `create_track_trace_session` RPC. Base templates and
  non-editable/archived choices are excluded when the server reports them.
  The creation RPC remains authoritative about ownership, class, editability,
  subscription, existing links and circuit restrictions.
- Review Session opens the existing persisted-session list, lap review and
  analysis. Existing `/track-trace?setup=<id>` links retain the original combined
  workflow and exact immutable setup association. Setup Assist status remains
  connected to the existing telemetry adapter.
- **View Shared Telemetry** appears immediately after **View Shared Setup** in
  the Home menu, with subtitle **Enter a share code to view telemetry**. The
  drawer closes on selection. Sportsman enters the existing upgrade pathway;
  paid access opens a styled modal. Escape and the close control dismiss it.
  The original shared-setup action, event handler and modal were not changed.

## Explicit integration dependencies

Track Library and Scan Track have no integrated OnlyFast circuit UI. Their
menu cards and destination panels clearly say unavailable/integration pending.
The timing-results OCR screen is not a circuit scanner and was not repurposed.

The existing `onlylaps_telemetry_shares` table does not provide a public shared
session reader by itself. Repository inspection and a read-only catalog query
on testing found no accessible telemetry share-code resolver. Owner RLS cannot
be used to read somebody else's session by guessing a code. The shared telemetry
modal therefore explains the missing share-code service, with no fabricated
validation, share-code input or session data. Connecting a reviewed circuit-only
share resolver remains future work.

No GPS recording engine, Gumball mode, new feature module, route, database table,
migration, Edge deployment or entitlement policy was added by this update.

## Permission compatibility and concurrent work

The existing central frontend permission hook consumes the current server
decision. Its navigation result now distinguishes full access from history-only
reading, without inferring permissions from a client tier. Both the installed
Phase 1C `allowed` response and the separate work's newer `can_read_history` /
`can_record` response are supported. Historical-read permission does not unlock
the new landing/menu/shared-telemetry controls. Server-side authorization remains
unchanged by this task.

Separate archive/history-permission work changed files during verification.
Its migrations, database policies, tests and existing history-review behavior
were preserved. Compatibility was handled only in the Track Trace frontend.
The clock-only Phase 1C setup response remains supported alongside the richer
editability response; the creation RPC independently rechecks authorization.

## Verification and preview

- Seven new navigation tests cover exact six-action preservation/order, full
  grid span, locked upgrade links, both paid tiers, the four menu choices,
  shared-menu placement and both server permission response formats.
- The combined Track Trace targeted suites passed **23 tests**.
- `qa/automation/track-trace-navigation.mjs` passed at **320, 390, 768 and 1280 px**,
  using actual interface components with explicitly synthetic backend fixtures.
  Telemetry width matched grid width exactly: **288, 358, 736 and 1024 px**.
  Verified both paid tiers, Sportsman upgrade navigation, 2x2 menu geometry,
  preparation from a saved setup, saved lap review, unavailable states, shared
  telemetry modal, unchanged shared-setup form, Escape and mobile navigation.
  No JavaScript errors or external connections occurred.
- The existing hosted verifier passed **18 grouped checks** against the real
  isolated testing backend and final built interface. Paid users traversed the
  new menu into existing preparation and persisted lap review; Sportsman stayed
  locked. Synthetic telemetry fixtures and their weekend metadata were cleaned
  up and original testing tiers restored. Existing records were preserved.
- Application and node/Vite TypeScript checks, focused ESLint, isolated Preview
  build and `git diff --check` passed. The existing large-chunk warning remains.
- Final full `npm run qa:regression`: **730 passed, 0 failed/skipped**.
  Report: `tmp/qa-automation/2026-11-14T04-27-50.338Z-5b5cfb55-7bab-4d28-9e3f-aa84220a9145/report.json`.
  Initial runs overlapped separate archive edits; the final run includes the
  current archive-security tests, which also pass without edits by this task.

Preview: <http://127.0.0.1:4190/app> (existing testing login required).
Direct Track Trace menu: <http://127.0.0.1:4190/track-trace>.
The separate unapplied archive/account-access work can still show its existing
permissions notice against the hosted Phase 1C backend. No archive migration was
applied to remove that notice.

Evidence: `tmp/track-trace-navigation/report.json`, its mobile/desktop screenshots,
and `tmp/track-trace-review/hosted.json`. The UI fixture uses synthetic data;
the hosted verifier separately exercises real testing Auth, RPCs and records.

## Files changed for this navigation task

- `src/components/HomeLanding.tsx` — optional last grid slot only.
- `src/components/SetupDashboard.tsx` — use the existing telemetry entry in that slot.
- `src/components/AppMenu.tsx` and `src/components/Header.tsx` — new shared telemetry entry, permission state and modal launch.
- `src/features/track-trace/TrackTraceEntry.tsx` — double-width landing variant; existing setup entry retained.
- `src/features/track-trace/TrackTracePage.tsx` — menu views, saved-session picker, existing preparation/review integration and response compatibility.
- `src/features/track-trace/TrackTraceMenu.tsx` and `SharedTelemetryDialog.tsx` — menu and explicit sharing dependency.
- `src/features/track-trace/api.ts` and `useTrackTrace.ts` — optional server capability fields and centralized navigation interpretation.
- `tests/trackTraceNavigation.test.ts` — seven navigation/compatibility tests.
- `tests/nativeAdSettings.mjs` and `tests/testSubscriptionDatabaseUI.mjs` — isolate new Header dependencies in existing fixtures; expectations retained.
- `qa/automation/track-trace-navigation.mjs` and `track-trace-hosted.mjs` — interface geometry/flow checks and new menu traversal before existing hosted review checks.
- This report.

No commits, pushes, merges, hosted frontend deployments, production database
operations, live RevenueCat changes, subscriber migration, standalone OnlyLaps
changes or archive integration edits were performed by this task.
