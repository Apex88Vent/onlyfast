# OnlyFast 2027 Phase 2 finalization — November 13, 2026

Latest installation handoff: [November 14 deployment unblock](ONLYFAST_2027_PHASE2_DEPLOYMENT_UNBLOCK.md). The explicit generic testing-account connection is now verified; the atomic SQL artifact passes 754 regression tests. Hosted archive/history installation and acceptance remain pending. The material below records the earlier finalization checkpoint.

**Local conflict resolved. Phase 2 remains incomplete because the dedicated MCP and hosted acceptance are unavailable.**

## Historical reads and telemetry writes

The existing applied `track-trace.sql` foundation is preserved. A forward correction lives in `supabase/testing-2027/track-trace-history-access.sql`; it requires both the archive layer and Track Trace foundation and refuses an incorrect environment marker.

| Permission | Sportsman | Pro / Factory | Unsubscribed |
| --- | --- | --- | --- |
| Eligible owned historical telemetry | Read-only | Read | Read-only |
| Other users' private historical records | Denied | Denied | Denied |
| Archived setup contents and linked telemetry | Denied | Owner read | Denied |
| Record / prepare telemetry sessions | Denied | Allowed; linked preparation requires an editable owned race setup | Denied |
| Modify / delete protected telemetry | Denied | Existing owner/class/archive rules apply | Denied |
| Restore archived setups | Denied | Existing active-class rules apply | Denied |

Historical eligibility retains the existing circuit/open-route restrictions. Timing sessions, laps, sectors, telemetry samples, stored analysis, setup links and telemetry shares continue to obey independent archive policies. Existing schedules and unlinked historical results remain readable.

The correction replaces the foundation's combined entitlement policy with separate restrictive SELECT, INSERT, UPDATE and DELETE policies on all twelve related tables. Ownership is explicit in each policy. Existing owner, circuit, sector/lap relationship and archive policies continue to AND with these rules. Anonymous grants remain revoked.

Private lookup helpers avoid recursive RLS and never return another owner's map contents. A non-owned map may remain a circuit-eligibility reference for an already-owned historical session; arbitrary foreign map identifiers do not grant read access.

Writes recheck fresh membership after acquiring the same transaction lock used by archive, quota and tier operations. Server-only link RPCs validate their verified user argument and their target setup's edit state. Internal owner-parameter helpers are not executable by browser roles. Required trusted server writers retain their existing privileges.

Read RPCs remain SECURITY INVOKER. The testing context adapter uses the verified owner's JWT client and the explicit historical-read permission. Recording controls require the separate paid permission plus an editable setup. Read-only users have a saved-history route; paid navigation remains visibly locked where applicable. Tier changes clear previously loaded archived details and fetch again under the new permissions.

No racing values, relationships or timestamps are updated by the correction. It changes functions, triggers and policies only.

## Combined local validation

| Check | Result |
| --- | --- |
| Full `npm run qa:regression` | **730 passed, zero failed, zero skipped** |
| Targeted archive + Track Trace tests | **34 passed**; includes 10 archive-specific tests |
| Native PostgreSQL concurrency | **13 assertions passed** |
| App TypeScript | Passed |
| Isolated 2027 Preview build | Passed; existing large-bundle warning remains |
| Real Chrome local UI fixture | Desktop 1280×900 and mobile 375×812 passed; zero remote requests and browser errors |
| Hosted archive / historical telemetry acceptance | **Not performed** |

The local database tests cover both installation orders: archive then Track Trace foundation, and the documented testing order of Track Trace foundation then archives. Both finish with the forward historical-access correction. The native PostgreSQL run uses the latter order.

Combined checks cover owner isolation, historical reads through direct tables and RPCs, archived setup/session/notes/results restrictions, independent schedules, anonymous denial, read-only insert/update/delete attempts, sharing, service-only links, downgrade class choice, quota protection, restoration and 48-hour active Sportsman viewing. Racing-row snapshots and timestamps remain unchanged.

Native concurrency includes competing archive/create requests, idempotent archive/restore operations, tier changes while requests wait, and telemetry insertion/editing waiting through downgrade or subscription loss. Local evidence database: `onlyfast_phase2_f3be8b70880d4be197755ba4461dd741`, retained inside the local disposable Docker container.

Browser checks use real components and a synthetic local backend. They verify historical lap/analysis viewing, archived-row removal and cached-detail clearing after downgrade, unavailable recording paths, archive confirmation/restoration and explicit class choice. They do not claim real Auth or hosted database acceptance.

Evidence:
- `tmp/qa-automation/2026-11-14T04-33-46.961Z-2eb75b42-1f48-4618-9c0b-30bb457faa78/report.json`
- `tmp/phase2-finalization-regression.log`
- `tmp/phase2-combined-concurrency.log`
- `tmp/phase2-finalization-types.log`
- `tmp/phase2-finalization-build.log`
- `tmp/phase2-ui-browser/report.json` and viewport screenshots

## Reviewed migration fingerprints

| Source | SHA-256 |
| --- | --- |
| `phase2-archives.sql` | `F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598` |
| Original `track-trace.sql` | `6AF2DA1B640EA512537DEA27E79DD2D26513E50D2AC26F9CD024E1E45DACF6BC` |
| Forward `track-trace-history-access.sql` | `6751213223C5AF524BE57D1DA578AE77C405E7152517FB9F7E8CBE197692386A` |

The foundation is documented as previously applied to testing by the separate Track Trace task. That live state was not independently queried in this continuation. Do not reapply the foundation or assume the current migration history: inspect the dedicated connection first.

## Deployment blocker and remaining work

Required connection: **`supabase-onlyfast-2027`**, project **`mfzajhnfonrfuiwxgvhe`**.

The dedicated server exposes no tools in the current registry. Only the bundled `mcp__codex_apps__supabase_*` tools are available; their exact inventory is recorded in `ONLYFAST_2027_PHASE2_REVIEW.md`. Neither Primary nor the bundled testing account was used. No OAuth was attempted. No dedicated connection error payload could be retrieved because no dedicated tool could be invoked; there is no evidence of expired authentication.

Database deployment is stopped as requested. **Neither the archive migration nor the forward historical-access correction was applied to hosted testing by this continuation. No Phase 2 development deployment, commit or push was made.**

Remaining gates:
1. Restore the existing dedicated MCP tool availability.
2. Confirm project identity, actual migrations, schema/function definitions, grants, RLS policies and advisors through that connection.
3. Reconcile any live drift, then apply only the missing reviewed archive/correction migrations to testing.
4. Deploy only `develop/onlyfast-2027`, including the reviewed testing context adapter.
5. Verify actual hosted logins and the full archive, restoration, downgrade, historical telemetry and unsubscribed workflows with the existing four synthetic accounts; verify data retention and production isolation.

No remaining access violation was observed in the combined local checks. Live schema review, advisors and hosted acceptance remain unverified. The Phase 2 completion criterion has therefore **not** been met.

Production Supabase, RevenueCat, Stripe, stores, live advertising/purchasing holds and standalone OnlyLaps were not changed by this continuation. Existing private credentials were reused as an available artifact and were not reset or exposed.
