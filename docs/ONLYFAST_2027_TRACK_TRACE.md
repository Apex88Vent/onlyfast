# OnlyFast Track Trace foundation

Current corrective update: [OnlyLaps circuit parity, GPS status and historical telemetry](ONLYFAST_2027_TRACK_TRACE_PARITY.md).
Original recording/review/replay and graphical timing-marker components now run
inside the existing integration. The report distinguishes verified compatibility
from remaining device/provider/cleanup dependencies. No production release is implied.

Previous implementation: [Phase 2D live circuit recording and scanning](ONLYFAST_2027_TRACK_TRACE_PHASE2D.md).
The testing route records actual GPS, saves/reviews circuit laps and captures
private scans using the existing catalog. BETA remains; physical device testing
and unscanned automatic lap timing are outstanding. Older phase status below is
historical and superseded by this report.

Previous phase: [Phase 2C shared community catalog](ONLYFAST_2027_TRACK_TRACE_PHASE2C.md).
Testing supports controlled scan publication and direct cross-user track reuse;
production publication remains subject to the documented review and approval.

Latest update: [UI refinements and independent session preparation](ONLYFAST_2027_TRACK_TRACE_REFINEMENTS.md).
Start Session now supports owned preparation with or without a setup, using
either a saved circuit or Free Record. Live recording remains unavailable.

Current follow-up: [Phase 2B report](ONLYFAST_2027_TRACK_TRACE_PHASE2B.md),
November 14, 2026. It adds BETA labeling, exact-session manual linking and the
saved circuit library. Its integration status and verification supersede the
older remaining-work list below; recording, scanning and sharing remain pending.

November 13, 2026 (America/Los_Angeles). Branch: `develop/onlyfast-2027`.

## Delivered scope and environment

OnlyFast Track Trace (`track_trace`) now has a dashboard shortcut, an entry inside
the exact saved race-session workflow, a protected route, durable session
preparation, saved-session review, lap results, sector counts and existing saved
analysis/optimum-lap summaries. Sportsman sees a locked state and a Pro pathway.
Pro and Factory receive identical Track Trace permissions and unlimited sessions.
The existing class entitlement remains independent.

The feature requires the activated 2027 Preview build AND the exact testing URL.
Its route is absent from normal production builds, and its frontend adapter refuses
other environments. Work stayed in the primary checkout on the existing branch.
Unrelated archive work already present, and updates appearing during this task,
were preserved. No commits, pushes, merges, production deployments, production
database calls, live RevenueCat changes, advertising activation or subscriber
migrations were performed. Standalone OnlyLaps was neither edited nor deployed.

Testing project `mfzajhnfonrfuiwxgvhe`, organization `wxswxtsewczfijycqnwi`, was
independently verified through the **testing account** connection before writes.
The initial hosted state was Phase 1C, with zero timing sessions and links and no
Edge Functions. Local archive work was not applied as part of this task.

## Architecture findings and reuse

The existing integration is a shared-data integration, not an embedded OnlyLaps
website. OnlyFast's beta link card calls `manage-onlylaps-session-link` to find,
link and unlink timing sessions. Its shared linking code checks both owners and
uses the immutable `race_setups.id` for Hot Laps, Heat, Main or an extra session.
The owner-composite foreign keys protect both parents of each relationship.

`get-onlylaps-setup-context` and `get-suggestions` already use the compact,
versioned `onlyfast_onlylaps_setup_context_v1` contract. The context builder
collects owned links, session metadata, laps, sectors and versioned analysis;
Setup Assist formats bounded measured evidence separately from untrusted AI
interpretations. Existing candidate matching, evidence inspection, prompt
formatting, ambiguity handling and analysis contracts can be reused.

Available durable data:

| Existing source | Available data and role |
| --- | --- |
| `onlylaps_timing_sessions` | Session name/type, start/end, vehicle, weather/device data, track-map ID and deterministic corner analysis/version |
| `onlylaps_track_maps` | Circuit geometry, start/finish paths, raw/smoothed paths, scan/version metadata, corner definitions and open-route marker |
| `onlylaps_lap_times` | Millisecond duration, lap number, validity/exclusion, embedded sector values, speed and acceleration/braking/grip metrics |
| `onlylaps_lap_sector_times` | Individual sector durations and source/version metadata tied to the exact lap and session |
| `onlylaps_telemetry_samples` | Server-persisted GPS coordinates, elapsed/recorded time, speed, heading, accuracy and sensor values |
| `onlylaps_session_analysis` | Versioned summary/structured observations, setup-relevant observations and optimum-lap data; saved analysis may be absent |
| `onlyfast_onlylaps_session_links` | Existing private association from one OnlyFast setup-session row to a timing session |

There is no recording engine or complete timing UI in this repository's
OnlyFast integration. The test bootstrap contains schema prerequisites, not the
standalone timing application. No historical records were imported or copied.

## Relationships

Authenticated `auth.users.id` owns schedules, setups and timing sessions.
`race_setups.race_schedule_id` optionally connects to `race_schedule.id`;
`race_weekend_id` groups a weekend's setup-session rows through the existing
private weekend identity. A setup's canonical `race_class` uses the existing
class catalog and subscription class selection.

`onlyfast_onlylaps_session_links.onlyfast_session_id` points to the exact
`race_setups.id`; its `onlylaps_session_id` points to `onlylaps_timing_sessions.id`.
The timing session optionally points to `onlylaps_track_maps.id`; a null track
map is the existing free/unscanned circuit representation. Laps and samples use
`timing_session_id`. Sector results use both the timing-session ID and `lap_id`.
Saved analysis uses `session_id` plus `analysis_version`. Existing associations
are retained; no relationships are inferred from names or dates.

## Server authorization and migration

Applied **only to testing**: `supabase/testing-2027/track-trace.sql`, recorded as
`track_trace_foundation_testing`. It creates **no new tables** and changes no
subscription products, pricing, billing rows or membership resolvers.

`onlyfast_private.track_trace_enabled()` checks the current authenticated UID
and fresh server membership through `onlyfast_subscription_tier`, allowing only
`pro` and `factory`. No editable metadata, browser cache, supplied tier or beta
flag grants Track Trace. Current test-tier overrides remain server-controlled.

21 restrictive policies add entitlement, ownership and circuit restrictions to
the existing owner policies, including direct REST table access. Child rows
must refer to an owned, allowed session. Sector rows must also belong to the
matching owned lap. Anonymous table access is revoked. Existing owners cannot
reassign records to another owner. Gumball/unknown session modes and open-route
tracks fail closed. Accepted legacy circuit types are `practice`, `qualifying`,
`race` and `circuit`; additional legitimate circuit types require reviewed mapping.

Five public RPCs run as **security invoker**, so RLS remains active:

| RPC | Purpose |
| --- | --- |
| `get_track_trace_permission()` | Central current-tier decision and common capability set; `session_limit: null` means unlimited |
| `list_track_trace_sessions(setup_id?, offset)` | Owned circuit sessions, optional exact setup link; pages of 100 are pagination, not a plan limit |
| `create_track_trace_session(setup_id, name, track_map_id?)` | Atomically prepare a durable session and link; requires an owned, editable saved race session and existing class permission |
| `get_track_trace_session(session_id)` | Authorized session/lap/sector/analysis review |
| `get_track_trace_setup_context(setup_id)` | Exact-setup context; refuses ambiguous multiple links |

Session preparation locks the setup row, refuses to replace an existing link,
and leaves `started_at` empty: saving a shell does not pretend GPS recording has
begun. It supports both the installed Phase 1C clock response and Phase 2's richer
editability response, respecting archive/class restrictions when installed.

The new `track-trace-setup-context` Edge Function was deployed **only to testing**,
version 1, with JWT verification enabled. It independently validates the bearer
user and central permission, then reuses the existing context store/builder and
measured-evidence inspector. It constructs only the caller's JWT client, never
a service-role client, so RLS protects every underlying read. It refuses any
Supabase URL except the exact testing URL. The shell uses its status response.
No existing Edge Function was replaced or enabled by this task.

## UI and state behavior

Customer-facing integration copy consistently uses **OnlyFast Track Trace**.
The dashboard tile uses the existing `HomeLanding.middleSlot`; the setup entry
receives `selectedSessionId`. `/track-trace?setup=<immutable-id>` scopes preparation
and review to the correct race session. The dashboard shortcut opens the saved
session library. Sportsman gets the existing `/upgrade` path, whose 2027
configuration keeps purchases disabled.

Permission queries are keyed by authenticated identity and membership revision;
switches unmount session state and remove query caches. Authorization lookup
failures fail closed. Permissions refresh on focus and every 30 seconds, and
every server operation independently rechecks current membership. The backend
therefore denies a downgrade immediately, regardless of browser refresh timing.

## Verification

- Full `npm run qa:regression`: **719 passed, 0 failed/skipped** — 604 unit tests
  (including PostgreSQL Track Trace tests), 92 mounted tests, 23 database tests.
  Report: `tmp/qa-automation/2026-11-14T03-51-39.920Z-f174d375-5349-44e5-b21e-293d565e790d/report.json`.
- New Track Trace targeted suites: **14 passed**. Coverage includes equal paid
  permissions, Sportsman/direct-table/API denial, owner spoofing, existing links,
  exact setup creation, durable laps/GPS, switching with retained data,
  Gumball/open routes, anonymous denial, wrong environment, unchanged billing,
  production-disabled frontend and JWT/RLS-preserving Edge behavior.
- Actual hosted Auth/REST/Edge checks used existing synthetic test identities:
  equal Pro/Factory capability responses, Sportsman/unprivileged denial, durable
  create/read of a session/lap/GPS sample, reused measured-evidence contract,
  foreign-owner denial and immediate downgrade denial with later data recovery.
- Browser verification used the built local Preview against real testing Auth
  and APIs for all three tiers at **320, 390, 768 and 1280 px**. Verified locked
  direct routes, paid review, persisted 12.345-second lap, no horizontal overflow,
  no JavaScript errors and no application connections outside local/testing.
  Screenshots and hosted results: `tmp/track-trace-review/`.
- Application and node/Vite TypeScript checks, focused ESLint, `git diff --check`
  and isolated Preview build passed. Existing large-bundle warning remains.
- Hosted inspection confirmed all relevant tables still have RLS and all five
  public Track Trace RPCs are invokers. Security advisors introduced no findings:
  the pre-existing 14 guarded authenticated definer warnings, eight private or
  server-only RLS-without-policy informational findings and disabled leaked-password
  protection remain unchanged. See [definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [private table guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Three existing test fixture files needed current read-only/environment state
  bindings after the archive changes; their application expectations were retained.

Re-run hosted verification using `qa/automation/track-trace-hosted.mjs` with the
testing publishable key and `ONLYFAST_2027_CREDENTIALS` pointing to the private
synthetic-credential file. Browser checks additionally accept the Playwright
module path and a localhost `ONLYFAST_LAYOUT_URL`. No credentials or tokens are
written to repository reports. Created racing/telemetry fixtures are deleted and
original server test tiers restored; existing records are not reset.

Local preview: <http://127.0.0.1:4188/track-trace>. It requires a testing login.
No new hosted frontend URL was created or existing hosted frontend updated.
The local checkout's separate archive/account-access work currently displays
“Testing permissions are unavailable” against Phase 1C; this refers to that
pending archive RPC, not the independently verified Track Trace permission API.

## Files changed for this task

- `src/features/track-trace/{api.ts,useTrackTrace.ts,TrackTraceEntry.tsx,TrackTracePage.tsx}`
- Track Trace hunks in `src/App.tsx` and `src/components/SetupDashboard.tsx`
- 2027 naming in `src/lib/subscription2027Catalog.ts` and `src/pages/Phase2027Preview.tsx`
- `supabase/testing-2027/track-trace.sql`
- `supabase/functions/track-trace-setup-context/index.ts` and its explicit JWT config in `supabase/config.toml`
- `tests/trackTraceDatabase.test.ts`, `tests/trackTraceIsolation.test.ts`
- Fixture bindings in `tests/nativeAds.test.ts`, `tests/offlineQueueSecurity.test.ts`, `tests/setupLibraryHarness.ts`
- `qa/automation/track-trace-hosted.mjs` and this report

Other modified/untracked files belong to the preserved archive/account-access
work. The existing production migration directory and standalone repository
were not changed by this task.

## Remaining timing integration

1. Extract/reuse the circuit recording engine behind a reviewed adapter, including
   device GPS permissions, lifecycle/background behavior, start/finish crossing,
   persistence batching, crash/retry recovery and session finalization. The current
   shell prepares sessions; it does not record GPS.
2. Add scanned-track selection and free-circuit start/finish configuration using
   existing map contracts. The creation API accepts an authorized map ID; the
   first shell deliberately does not recreate the scanning/timing interface.
3. Render GPS paths, individual sectors, lap overlays/comparisons and complete
   optimum-lap/corner analysis using existing stored records. Add bounded/paged
   reads for long telemetry histories and stress-test larger sessions.
4. Expose reviewed manual linking of existing circuit sessions through the
   existing linking contract. Current history is retained and readable, but the
   shell does not bulk-match or copy historical sessions.
5. Connect the bounded telemetry context to actual testing AI recommendations
   once testing provider configuration is supplied. The authorization and context
   adapter are verified; live AI recommendations were not activated or tested.
6. Before any later rollout, review legacy circuit mode mapping and any standalone
   extraction dependency. Changes to standalone OnlyLaps, production subscription
   behavior, production databases or live RevenueCat require a separate request.
   No Gumball integration, migration activation or production release is included.
