# OnlyFast 2027 Phase 2 installation handoff — November 14, 2026

Subsequent result: [Phase 2 hosted acceptance passed](ONLYFAST_2027_PHASE2_HOSTED_ACCEPTANCE.md). The migration is now installed and verified; do not reapply this handoff artifact. The preparation checkpoint below is retained for its fingerprints and installation history.

Status: **reviewed and locally validated; hosted archive/history installation has not been performed by this continuation. Phase 2 remains incomplete.**

This handoff packages the existing archive implementation. It does not rebuild the app or alter the reviewed component SQL. No frontend deployment, remote database mutation, commit, push, billing change or production change was made.

## Verified testing connection and installed state

The bundled Supabase connector exposes the explicit **testing account** selector. Read-only calls used only `link_6af642d6b8a481919a0c8b091833a669`. Primary was not used. The unavailable dedicated MCP was not troubleshot again.

`get_project` independently returned:

- Project ID/ref: `mfzajhnfonrfuiwxgvhe`
- Organization ID/slug: `wxswxtsewczfijycqnwi`
- Name: `Apex88Vent`; region: `us-east-1`
- Status: `ACTIVE_HEALTHY`
- Database host: `db.mfzajhnfonrfuiwxgvhe.supabase.co`
- PostgreSQL: `17.11.0.019`

The database's `get_onlyfast_2027_environment()` independently reports the same testing project ref. The migration ledger has 26 entries:

| Installed prerequisite | Version |
| --- | --- |
| 23 Phase 1C bootstrap entries | `20261113003030` through `20261113003133` |
| `onlyfast_2027_phase1c_api_hardening` | `20261113003552` |
| `track_trace_foundation_testing` | `20261114034424` |
| `track_trace_phase2b` | `20261114145109` |

The archive table, archive RPC and forward history helper are absent. Both installed Track Trace sources and API hardening match the local SQL after line-ending and surrounding-whitespace normalization. All 28 inspected archive-dependent/Track Trace function definitions and all 88 application policies match a locally reconstructed database with this installed order. All 29 existing application tables have RLS enabled; private tables have no grants to PUBLIC, anon or authenticated.

Evidence: `tmp/phase2-deployment-unblock-catalog.json` and `tmp/phase2-deployment-unblock-drift.json`.

## Exact SQL artifact and order

Install **`supabase/testing-2027/phase2-archives-install.sql`** as the single migration named **`onlyfast_2027_phase2_archives_history_testing`**, only through an independently verified connection to the testing project and organization above.

The required order is:

1. The existing 23 Phase 1C bootstrap entries.
2. Existing Phase 1C API hardening.
3. Existing Track Trace foundation.
4. Existing Track Trace Phase 2B.
5. **The new atomic archive/history install artifact.** Its internal order is archive SQL, then the historical-access correction.

Steps 1–4 are already installed. Do not reapply them. Do not apply either component file separately after installing the combined artifact. Keep the artifact outside the production root migration history; do not use a root `db push` for this installation.

The single transaction removes only the two components' outer transaction wrappers. Their SQL bodies remain unchanged. Added preflight checks require the testing environment marker and installed Phase 2B RPCs, and reject already-installed archive/history layers. A failure rolls back the whole installation, including the history correction. The component notifications are delivered only on commit.

| File | Raw-byte SHA-256 |
| --- | --- |
| **`phase2-archives-install.sql`** | **`7366BC8FA69FA08079F98622024819B5B07EBE69D57B96FBB55B6E58D53FA27E`** |
| Original reviewed `phase2-archives.sql` | `F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598` |
| Required `track-trace-history-access.sql` | `6751213223C5AF524BE57D1DA578AE77C405E7152517FB9F7E8CBE197692386A` |
| Already-installed `track-trace.sql` | `6AF2DA1B640EA512537DEA27E79DD2D26513E50D2AC26F9CD024E1E45DACF6BC` |
| Already-installed `20261114144200_track_trace_phase2b.sql` | `9FDF0E0D5320D53F225583FF29D90893894F7F907930553548C6C28080798D7F` |

The exact manifest is `supabase/testing-2027/phase2-archives-install.manifest.json`. Reproduce the artifact with `node scripts/prepare-2027-phase2-archives.mjs`; the generator aborts if either reviewed source fingerprint changes. Verify raw bytes without reformatting or changing line endings.

## Compatibility and retention

Archive metadata and audit events remain outside racing rows. The migration changes policy/function/trigger definitions and adds archive/class metadata; it does not rewrite setup values, sessions, links, results, analysis, timestamps or original weekend clocks.

The foundation's twelve combined entitlement policies must be replaced by the forward correction. Installing archives alone would leave Sportsman/unsubscribed historical telemetry blocked by the existing paid-only entitlement. The atomic artifact includes this correction: 48 restrictive policies separate SELECT from recording/modification/deletion across all twelve tables. Existing owner, circuit, sector/lap relationship, archive and Phase 2B setup-write policies remain effective.

The six Phase 2B RPC/helper definitions remain intact. Their existing setup-editability helper reads the new authoritative archive/class/quota state. Link/replace/unlink still use the original service-only atomic link RPCs, which gain the reviewed archive and fresh-membership checks. Sportsman/unsubscribed history reads do not grant recording, the paid Track Library/picker, archived setup contents or restoration.

The new installed-order tests seed data before applying the exact packaged artifact, compare every public table plus weekend-clock records immediately afterward, then exercise linked/independent history, archive denial, Pro/Factory restoration, paid link restrictions, cross-account denial and protected racing snapshots. Wrong-target, missing-Phase-2B, failed-install rollback and repeat-install refusal are also tested.

Read-only hosted retention baseline: **26 race setup rows, 1 schedule row, 0 shared setups, 0 telemetry/link rows** in the inspected tables. Full counts and row-content digests are retained in `tmp/phase2-deployment-unblock-retention-before.json`. The lack of hosted telemetry fixtures means historical telemetry acceptance still needs synthetic recordings/results; empty tables are not evidence that hosted access control passes.

For installation:

1. Reverify testing project identity and migration state immediately before any write.
2. Run `supabase/testing-2027/phase2-archives-retention.sql` and save a fresh baseline. It returns counts/digests, without record contents, for fifteen racing/telemetry tables using UTC.
3. Recheck the artifact SHA-256 and install only the combined artifact using the named migration above. An SQL-editor installation does not itself add a Supabase CLI migration-ledger entry; the separately verified installer must use its migration mechanism or explicitly reconcile its ledger. Do not assume raw execution registers a migration.
4. Run `supabase/testing-2027/phase2-archives-verify.sql`. All eleven booleans must be true. Rerun retention before changing test fixtures; every count/digest must match the fresh baseline.
5. Recheck migration history and Supabase security advisors, then perform real account/RLS acceptance. Catalog checks are supplementary and do not prove hosted account behavior.
6. Only after database installation and verification may the development Preview be deployed. Production remains excluded.

The verification and retention SQL artifacts were executed successfully against a local database using the exact installed order and atomic install artifact. Their post-install catalog checks have **not** been claimed as passing on hosted testing.

## Security advisors

The testing project's security advisor returned no ERROR findings, **15 WARN findings** and **8 INFO findings**:

- 14 existing public SECURITY DEFINER functions executable by authenticated users. These require review of their intended authorization boundaries; they are not automatically cleared by this migration. [Advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Leaked-password protection disabled. This setting was not changed. [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Eight RLS-enabled tables without policies: six private metadata tables and public `beta_feature_definitions` / `revenuecat_webhook_events`. RLS denies browser row access without policies; private-table browser grants were independently absent. No broad policies were added to silence the notices. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Validation and remaining gates

| Check | Result |
| --- | --- |
| Full `npm run qa:regression` after adding installed-order tests | **754 passed, 0 failed, 0 skipped**: 639 unit, 92 mounted, 23 database suite results |
| Exact atomic artifact installed-order / rollback tests | **2 passed**; included in the full regression count |
| Native local PostgreSQL concurrency | **13 assertions passed** |
| Application TypeScript | Passed |
| Node/config TypeScript | Passed |
| Post-install verifier on local installed-order database | All **11** booleans true |
| Retention artifact on local database | 15 table fingerprints returned |
| Hosted archive/history installation | **Not performed in this continuation** |
| Phase 2 frontend deployment / hosted browser acceptance | **Not performed** |
| New GitHub Actions run | Not dispatched; no commit/push was made |

Regression report: `tmp/qa-automation/2026-11-14T15-12-22.198Z-f3861e72-0c31-4444-aa78-229bac2042df/report.json`.
Additional evidence: `tmp/phase2-deployment-unblock-installed-order.log`, `tmp/phase2-deployment-unblock-concurrency.log`, `tmp/phase2-deployment-unblock-types.log`, `tmp/phase2-deployment-unblock-node-types.log`, `tmp/phase2-deployment-unblock-local-postinstall.json`.

The native concurrency run retained its new synthetic local evidence database `onlyfast_phase2_5b226a3879994089ad4a194bcc53bcab`; no existing evidence databases or recovery material were removed. Those concurrency checks cover the existing combined archive/history layer; the two new installed-order tests separately exercise the already-installed Phase 2B layer and exact atomic package.

The checkout remains on `develop/onlyfast-2027`; its HEAD and freshly fetched `origin/develop/onlyfast-2027` have no ahead/behind difference. Existing unrelated/uncommitted work was preserved. Main, production Supabase/Vercel, RevenueCat, Stripe, stores, purchasing/advertising holds and standalone OnlyLaps were not changed.

Remaining gates are hosted installation with retention/advisor verification, synthetic telemetry fixture preparation, development Preview deployment, actual hosted account/browser acceptance, and GitHub Actions validation for the final committed source. **Phase 2 is not complete.**
