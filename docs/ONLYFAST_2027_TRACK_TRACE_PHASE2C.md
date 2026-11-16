# Phase 2C — shared community circuit catalog

Follow-up: [Phase 2D live circuit GPS and scanning](ONLYFAST_2027_TRACK_TRACE_PHASE2D.md)
connects this same catalog to recording and private scan capture in testing.

November 14, 2026. Branch: `develop/onlyfast-2027`. **Testing only.**

## Delivered architecture

There is one catalog: the existing `public.onlylaps_track_maps` table. Approved
scans are published **in place with their existing IDs**. Selecting another
user's shared circuit stores that same map ID on the timing session; no import,
per-user clone, fabricated race setup or second public catalog is involved.

OnlyFast and current standalone OnlyLaps use production project
`thpyjvwtfvfxiufchrxn`, confirmed by the user. All changes in this phase were
applied exclusively to isolated testing project `mfzajhnfonrfuiwxgvhe`.
Production was inspected read-only. The original testing map's geometry,
start/finish, corners, version and predecessor hash is unchanged.

OnlyLaps source was inspected read-only at
`Apex88Vent/OnlyLaps-app@22f372508582fb43d56b66947c26740233bcdb19`:

- `lib/track-scan/onlylapsTrackMapService.ts`: published/active library query,
  scan saving, rescans and predecessor/version handling.
- `lib/track-scan/onlylapsTrackScanUtils.ts`: map/GPS/publication field shapes.
- `supabase/migrations/202607260001_onlylaps_gumball_mode.sql`: existing
  `publication_status` values (`private`, `published`), source/scan flags and
  published-or-owned reading convention.
- Sector migration/service contracts: default versus private driver layouts,
  versioned definitions and `start`/`end` line endpoints. Legacy `a`/`b` endpoints
  are also accepted without converting stored data.
- `lib/lap-session/lapSessionService.ts`: normal circuit writer uses
  `session_type='timed_laps'`; shared selection does not require track ownership
  in the client. That exact circuit alias is now supported in testing while
  preserving owner, map, archive and mode restrictions. Unknown/Gumball modes
  remain denied.

The deployed source database lacks the publication columns used by this source
revision. This is an existing schema/code gap, not evidence that active legacy
scans already have approval for community publication.

## Initial library inventory and approval plan

Read-only source inventory:

| Existing track | Version | Geometry screening | Sector definition | Proposed treatment |
| --- | --- | --- | --- | --- |
| Barona | 1 | Eligible | 2 sectors, v1 | Candidate; confirm layout/location and publication authority |
| Marysville | 3 | Eligible | 2 sectors, v2 | Candidate; confirm layout/location and publication authority |
| Test | 2 | Eligible | 2 sectors, v3; saved corners | Identity review required before considering publication |
| Track Scan - 2026-07-06 | 1, inactive | Incomplete | None | Retain as historical predecessor; exclude from current catalog |

`supabase/testing-2027/community-initial-publication.plan.json` records the exact
source IDs, versions, predecessor, sector IDs/versions and SHA-256 fingerprints.
Every entry has `publicationApproved:false`; proposed layout/location fields
are deliberately unfilled. No source record or geometry was copied into testing.
All four production map checksums were re-read and match the initial inventory.

`scripts/prepare-community-track-publication.mjs` is an offline, read-only planner.
It reuses the actual SQL geometry validator in a disposable local database,
rejects duplicate source IDs and emits a plan, never database writes. The raw
operator inventory is retained only under ignored `tmp/track-trace-phase2c/`.

Before production: approve the exact tracks, establish publication authority,
confirm human-readable locations and distinct layout identities, inspect the
geometry/defaults/corners, recheck hashes, and review a production-compatible
schema/access migration. The testing migrations explicitly refuse production
and must not simply be applied there. Publish existing rows rather than copying
them. No production migration, publication, push or deployment was performed.

## Discovery and session selection

The existing Track Library now has name/location search, All Available,
Shared Community and My Saved Scans filters, stable pagination, layout/location
labels and shared/private status. Shared active circuits are selectable without
ownership. Own incomplete/private records retain their prior preparation path
and warnings; they cannot enter the community catalog without validation/review.
Gumball/generated/open-route tracks are excluded from discovery and new selection.

The existing linked and independent preparation paths both reuse this library.
Radio/selection state and the typed session name stay mounted. Search controls,
pagination and scan submission cannot submit the timing-session form; the forms
are separate. Mobile search controls wrap at full width.

Only the map permission is shared. Timing sessions, GPS samples, lap/sector
results, analysis, setup links and personal sector overrides remain private to
their owners. Retired published versions remain available to existing owned
session references; they disappear from current discovery and cannot be selected
for a new cross-user session. Existing saved-session review retains the old ID.

## New scans, moderation and versions

An owner can submit an existing saved full circuit scan using its ID, a layout
name/key and location. This works with the existing OnlyLaps scan-save contract;
it is not a track import. OnlyFast's GPS scan-capture engine remains unavailable,
so the interface explicitly requires a saved scan rather than simulating capture.

The public map status remains the OnlyLaps `private`/`published` convention.
Pending/rejected review state is kept in a **private moderation queue**, not a
second track catalog. Rejected owners can correct/resubmit their draft. Updates
after submission invalidate its fingerprint and require a fresh submission.

Server validation checks source/scan flags and circuit type, required location
metadata, finite/ranged GPS coordinates, distinct path points, array limits,
closed boundary endpoints (within 50 m), nonzero enclosed area, consistency with
the circuit center (25 km bound), and sector counts/line coordinates. This is
structural screening; curators must still inspect layout, start/finish, sectors,
corners and GPS quality before approving. No survey accuracy or device GPS
validation is claimed.

Duplicate review considers facility identity, name and nearby published circuits
(750 m). A reviewer must acknowledge the current candidates. Active facility /
layout identity and normalized geometry have unique constraints; geometry hashes
ignore GPS capture timestamps, accuracy and generated sector-line IDs. Stored
geometry is never normalized or rewritten. Nearby distinct layouts can coexist.

Only a trusted server/operator can approve, reject or explicitly replace an
approved version. Expected SHA-256 fingerprints, a catalog-wide transaction lock,
row locks and unique constraints prevent stale decisions and silent duplicate
publication. Replacing a scan requires an explicit same-facility/layout target;
the old row is retired, its geometry/version retained, and the new row points to
it through `supersedes_track_map_id` with an increasing version. Another user's
submission never automatically replaces a published track.

Published maps and shared sector defaults are immutable to browser users,
including their original owners and existing cleanup RPC paths. Ownership
cannot be reassigned. Private driver-sector edits do not mutate the published
map's canonical version.

## Testing database changes and operator workflow

Applied only to the verified testing project:

- `20261114194747_track_trace_community_catalog.sql`: compatible map columns,
  private review queue, validated submission/moderation/search, shared-map
  selection policies and version preservation. No source track rows are seeded.
- `20261114234029_community_catalog_server_review_access.sql`: schema usage for
  the trusted `service_role`; no browser/anonymous moderation grant.

New public RPCs are SECURITY INVOKER: `search_track_trace_tracks`,
`find_track_trace_duplicates`, `submit_track_trace_scan`, `review_track_trace_scan`.
The last is executable only by the trusted server role/operator. Private definer
helpers have fixed search paths, explicit grants and caller/owner checks.
The original `list_track_trace_tracks` signature remains a compatibility wrapper.
Existing entitlement resolvers, billing products and circuit/ownership checks are
retained. This migration must follow the existing Track Trace/history installation;
do not reinstall older policy packages over the community extensions.

Moderation plan fields: `projectRef`, entries containing `trackId`, reviewed
`fingerprint`, `approve`, `note`, optional `replaceId` and
`acknowledgedDuplicates`. Read pending fingerprints from the private queue using
the trusted operator connection, then review the corresponding current map.

`node scripts/review-community-tracks.mjs --plan reviewed.json` is a no-network
dry run. `--apply-testing` additionally requires the server-only
`ONLYFAST_2027_REVIEW_SERVICE_KEY`, verifies the exact testing URL/environment,
and stops on stale/duplicate/access errors. It refuses production. No service
credential is shipped to the browser or written into reports.

## Standalone client compatibility boundary

The existing published-library query, map field shapes and normal circuit
session/map reference contract are compatible with this testing schema. Full
standalone UI acceptance or deployment is not claimed. Before an approved
production rollout, its scan/publication controls need an adapter for the review
workflow: the current rescan service tries to deactivate the previous map
directly, which is now correctly refused for a published scan. New private scan
saving remains supported, but published replacement must go through moderation.
Its direct Gumball-publish action must not be connected to this circuit catalog.
No standalone source was edited; this dependency also applies to the later
copied/renamed product.

## Future standalone product

The user clarified that OnlyLaps will eventually be copied/renamed into a
standalone product with its own Supabase project. No new project, product,
subscriber migration or standalone source change was made here.

Keep one authoritative catalog and stable track/version IDs. A future separate
backend must access it through a trusted catalog API/adapter that validates the
requesting product's issuer and eligibility, exposes only approved circuit data,
and submits scans for the same moderation process. Do not trust a browser-supplied
app name or reuse another project's user JWT as authorization.

Separate projects cannot share a normal database foreign key or assume matching
Auth user IDs. That phase needs an explicit canonical-reference / immutable
version-cache contract, author provenance, and approved product-specific access.
Any cache must be read-only with one publishing authority, not a competing public
catalog or per-user import. Do not copy Auth identities or private session data
to make the connection appear to work. The new project and this adapter have not
been implemented. Current OnlyFast testing eligibility remains Pro/Factory;
Sportsman history and normal Setup Assist fallback behavior are preserved.

## Verification and preview

- Full regression: **792 passed, zero failed/skipped**, including existing setup,
  subscription, archive, Track Trace and context tests.
  Report: `tmp/qa-automation/2026-11-14T23-48-20.609Z-49c4097e-546d-4151-9e9a-439a9096cdd1/report.json`.
- Focused suites: **23 passed** — 20 catalog/database cases under both foundation
  and history policies, plus three offline-plan/operator safety tests. Actual
  `service_role` moderation is exercised; browser/anonymous review is denied.
- Hosted testing: **7 grouped checks** covering both paid tiers, direct OnlyLaps
  published-table queries, canonical cross-user selection, owned review, private
  data isolation, duplicate/layout detection, immutable publication and Sportsman
  denial. Four real browser flows at 390/1280 px cover search → select → durable
  preparation. A real invalid submission inside preparation preserves the draft
  and cannot trigger session creation.
- Synthetic component browser checks: **320, 360, 390, 640, 768, 1024, 1280 px**,
  including existing dashboard dimensions/navigation and both preparation paths.
  The actual catalog was visually inspected; search width is 358 px on 390 px
  mobile and approximately 430 px at 1280 px. No horizontal overflow or JS errors.
- App/node TypeScript, focused feature lint, preview build and diff checks pass.
  The preexisting large-bundle warning remains. Security advisor counts are
  unchanged: 11 INFO RLS notices, 13 public-definer WARN and one password WARN.
  [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  [definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Evidence: `tmp/track-trace-phase2c/` (hosted reports/screenshots, local database
results, advisors and retention snapshots), and the final regression report under
`tmp/qa-automation/`. Synthetic QA sessions and maps are cleaned up; test tiers
are restored. No real scans were copied/published, so the shared testing catalog
may be empty after cleanup while existing own saved scans remain available.

Local preview: <http://127.0.0.1:4193/track-trace?view=library> — testing login.
Recording, scan capture, replay/comparisons and future cross-project integration
retain their previously documented dependencies. No GPS recorder was added.

Changed files: existing `TrackTraceLibrary.tsx`, `TrackTracePage.tsx`,
`TrackTraceMenu.tsx`, `api.ts`; new `TrackTracePublication.tsx`; the two testing
migrations and initial publication plan; `scripts/prepare-community-track-publication.mjs`
and `review-community-tracks.mjs`; `tests/trackTraceCommunityCatalog.test.ts` and
`communityTrackPublicationPlan.test.ts`; new hosted catalog verifier and the
existing navigation verifier's fixture/API/output bindings; this report and
phase links in the existing Track Trace documentation.

All existing uncommitted work and unrelated archive sources are preserved.
Nothing was pushed, merged or deployed to production. Standalone OnlyLaps,
production source data, live billing and production purchase/advertising holds
were not modified.
