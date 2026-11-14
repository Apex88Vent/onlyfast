# OnlyFast 2027 Phase 2 review — 2026-11-13

Status: **incomplete; remote migration and hosted acceptance are on hold**.

Latest combined validation and resolved Track Trace conflict: [Phase 2 finalization](ONLYFAST_2027_PHASE2_FINALIZATION.md). The evidence below records the earlier archive checkpoint.

This continues the existing archive draft in the primary checkout on the existing `develop/onlyfast-2027` branch. No branch/worktree was created or switched. Existing changes, including concurrent Track Trace work, were preserved. No commit or push was made by this continuation.

## Implemented and locally verified

- Archive/restore metadata and audit events are separate from racing rows. Base setup IDs and immutable weekend IDs define the archive unit; all sessions follow the parent.
- Sportsman counts only active base setups and distinct active weekends. Archived records release their matching slot. The original weekend clock and aliases remain intact.
- A shared transaction advisory lock serializes archive, restore, creation, tier changes and usage operations. Repeated archive/restore requests produce one transition event.
- Restrictive archive reads cover setup rows, session links, setup shares, timing sessions, laps, sectors, telemetry samples and stored analysis.
- Sharing-code redemption excludes archived setups. Service-role link mutations and candidate aggregates explicitly enforce archive access. The testing Edge readers use the verified user's RLS client.
- Child writes check both OLD and NEW relationships. Relinking a child cannot detach it from a read-only parent.
- Usage reservations check permission before returning cached content; completion rechecks tier, class, archive and edit state. Invalidated leases can still be released.
- Factory downgrades require an explicit active-class choice. A subscription gap retains that requirement. Upgrading back to Factory clears it. Other classes remain saved and viewable.
- Over-quota Sportsman setup edits and new child sessions are denied. Existing 48-hour-locked active setups remain readable.
- No-subscription behavior is confined to the isolated testing migration. Production Rookie behavior is preserved.
- UI includes gray archived cards, lock icons, filters, counters, confirmation, confirmed-success feedback, Pro/Factory viewing/restoration, class selection and no-subscription explanation.
- Save/update, rename, delete, copy and base-template actions enforce read-only state. Saved lap details remain interactive outside disabled editing controls.

Snapshot tests compare every retained setup/child row and timestamp before and after archive/read/denied-write workflows. No racing data is deleted or rewritten by the archive operation.

## Validation evidence

| Check | Result |
| --- | --- |
| Full `npm run qa:regression` | **720 passed, 0 failed, 0 skipped** |
| Archive-specific database/UI tests | 10 passed |
| App TypeScript | Passed |
| Isolated 2027 Preview build | Passed; existing bundle-size warning remains |
| Native PostgreSQL concurrency | **9 assertions passed** |
| Actual Chrome local UI fixture | 1280×900 and 375×812 passed; no remote requests or browser errors |
| Hosted synthetic-account acceptance | **Not performed for Phase 2** |

Regression report: `tmp/qa-automation/2026-11-14T03-59-44.350Z-36072b08-559e-4ffa-aa5e-d2e29acc5a8b/report.json`.

Native concurrency evidence database: `onlyfast_phase2_228abe7dde8a4ca08fed5704e55524d4`, created fresh inside the local `supabase_db_onlyfast-disposable-staging` Docker container. It is retained, with synthetic data only. Tests cover competing weekend/base creates after an archive, idempotent archive/restore calls, restoration racing a downgrade, subscription loss during a waiting operation, over-quota permissions and retained notes.

Browser fixture report/screenshots: `tmp/phase2-ui-browser/`. This uses real components with a synthetic local backend and explicitly does **not** count as hosted acceptance.

Reproduce native checks:
```powershell
$env:ONLYFAST_PHASE2_LOCAL_POSTGRES='1'
node scripts/test-2027-concurrency.mjs
```

The browser fixture requires the isolated app build in `tmp/phase2-build` and an installed Playwright 1.56.1 module provided through `ONLYFAST_PLAYWRIGHT_MODULE`; run `node qa/phase2-ui-browser.mjs`.

## Migration review and status

Draft: `supabase/testing-2027/phase2-archives.sql`.

Reviewed SHA-256: `F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598`.

The migration was applied only to disposable local databases. **It has not been applied to hosted testing by this continuation.** It is outside production's root migration history.

Local review verifies:
- Exact testing environment marker `mfzajhnfonrfuiwxgvhe`; an incorrect marker aborts before changes.
- Existing Phase 1C function/table dependencies, and abort-on-drift anchors for patched functions.
- All application tables have RLS enabled.
- Both direct foreign-key child tables of `race_setups` are covered.
- Browser roles cannot execute internal owner-parameter helpers or service-only RPCs.
- Anonymous callers cannot invoke account, class-selection, archive or summary endpoints.
- Privileged functions pin their search paths.
- Existing public function signatures/OIDs and their restrictive grants are preserved where policies depend on them.

Live migration history, schema drift and Supabase advisors still require the dedicated MCP before application. The reviewed hash must be rechecked if the SQL changes.

## Track Trace integration — resolved locally

The concurrent, separately authored `supabase/testing-2027/track-trace.sql` currently creates a restrictive `track_trace_entitlement` policy **FOR ALL** on timing/history tables. Its entitlement helper permits only Pro/Factory. Its session helper also requires that entitlement.

Its tests explicitly expect Sportsman SELECTs of timing, laps, samples and analysis to return zero rows. Applied together, that can prevent viewing independent historical results/telemetry for Sportsman or unsubscribed accounts, even when those records are not archived.

That conflict is corrected by the forward migration `track-trace-history-access.sql`. Combined local tests now allow eligible owner-scoped historical reads while independently enforcing Pro/Factory recording and mutation rights and the original archive restrictions. The original applied foundation SQL is preserved. See the finalization report for current evidence and hashes. Hosted verification is still required.

No archive-content leak was observed in the archive-specific tests. That statement does not certify the still-unverified hosted schema or the concurrent combined release.

## Dedicated MCP availability

Required server: `supabase-onlyfast-2027`.

No tool from that dedicated server is exposed in this session. Filtering the current tool registry for `supabase_onlyfast` / `supabase-onlyfast` returns an empty list.

There is **no transport/authentication error payload to report**, because the dedicated tools cannot be invoked. This is a missing-tool availability condition, not evidence of expired authentication. No OAuth authorization was attempted.

The bundled plugin exposes the exact tool names below. Its metadata lists connections named `testing account` and `Primary`; neither was used as a substitute for the required dedicated server.

- `mcp__codex_apps__supabase_apply_migration`
- `mcp__codex_apps__supabase_confirm_cost`
- `mcp__codex_apps__supabase_create_branch`
- `mcp__codex_apps__supabase_create_notebook`
- `mcp__codex_apps__supabase_create_project`
- `mcp__codex_apps__supabase_delete_branch`
- `mcp__codex_apps__supabase_delete_feedback`
- `mcp__codex_apps__supabase_delete_notebook`
- `mcp__codex_apps__supabase_deploy_edge_function`
- `mcp__codex_apps__supabase_execute_sql`
- `mcp__codex_apps__supabase_generate_typescript_types`
- `mcp__codex_apps__supabase_get_advisors`
- `mcp__codex_apps__supabase_get_cost`
- `mcp__codex_apps__supabase_get_edge_function`
- `mcp__codex_apps__supabase_get_notebook`
- `mcp__codex_apps__supabase_get_organization`
- `mcp__codex_apps__supabase_get_project`
- `mcp__codex_apps__supabase_get_project_url`
- `mcp__codex_apps__supabase_get_publishable_keys`
- `mcp__codex_apps__supabase_list_branches`
- `mcp__codex_apps__supabase_list_edge_functions`
- `mcp__codex_apps__supabase_list_extensions`
- `mcp__codex_apps__supabase_list_migrations`
- `mcp__codex_apps__supabase_list_notebooks`
- `mcp__codex_apps__supabase_list_organizations`
- `mcp__codex_apps__supabase_list_projects`
- `mcp__codex_apps__supabase_list_tables`
- `mcp__codex_apps__supabase_merge_branch`
- `mcp__codex_apps__supabase_pause_project`
- `mcp__codex_apps__supabase_query_logs`
- `mcp__codex_apps__supabase_rebase_branch`
- `mcp__codex_apps__supabase_reset_branch`
- `mcp__codex_apps__supabase_restore_project`
- `mcp__codex_apps__supabase_run_notebook`
- `mcp__codex_apps__supabase_search_docs`
- `mcp__codex_apps__supabase_submit_feedback`

## Hosted completion gates

1. Restore availability of the already-configured dedicated MCP tools.
2. Independently confirm their testing project identity, applied migrations, schema and advisors. Reconcile any concurrent Track Trace migration.
3. Reconcile the reviewed combined migration with any live schema drift; the historical-read conflict is resolved and tested locally.
4. Apply the reviewed archive migration using only the dedicated testing connection.
5. Deploy the development Preview and any reviewed testing-only Edge changes.
6. Exercise the actual hosted app with Sportsman, Pro, Factory and unprivileged synthetic accounts: archive, quota reuse, upgrades, restoration, downgrade choice, excess quotas, 48-hour viewing, no-subscription viewing/writes, child API protection and account switching.
7. Check actual testing data retention and production isolation. Only then can Phase 2 be declared complete.

No production Supabase, RevenueCat, Stripe, stores or standalone OnlyLaps changes were performed by this continuation.

## Existing private test credentials

The requested private file exists:
`C:\Users\c_mar\.codex\private\onlyfast-2027-phase1c-credentials.json`.

Its project reference is `mfzajhnfonrfuiwxgvhe`. Its ACL grants full access only to `CJSLAPTOP\c_mar`. Passwords were neither reset nor printed, copied into this repository, committed, logged or placed in Vercel environment variables.

Open that file locally in a text editor, find the matching entry in `accounts`, and retrieve its `password` value.

| Synthetic account | Email |
| --- | --- |
| Sportsman | of27-sportsman-638defeb@onlyfast.app |
| Pro | of27-pro-caa5cbb8@onlyfast.app |
| Factory | of27-factory-093734ce@onlyfast.app |
| Unprivileged | of27-unprivileged-3e28c265@onlyfast.app |

Hosted existence, current permissions and logins were not revalidated during this continuation because the required dedicated connection is unavailable. No duplicate accounts were created.
