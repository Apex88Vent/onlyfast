# OnlyFast staging database rebuild audit

> Follow-up: [LOCAL_SUPABASE_REVENUECAT_TEST_REPORT.md](LOCAL_SUPABASE_REVENUECAT_TEST_REPORT.md)
> records the successful native Docker/Supabase rebuild, local Edge tests and
> actual cron-worker verification. The earlier local-runtime availability blocker
> below has now been cleared; production-history restrictions still apply.

Reviewed October 16, 2026. Production project: `thpyjvwtfvfxiufchrxn`.
**Local preparation and read-only production inspection only.** No live schema,
rows or migration history changed. No paid branch was created, and no Edge
Function, website, webhook or purchase configuration was deployed or enabled.

## Root cause

The recorded migrations are incremental patches to an existing, manually created
database. They are not a complete schema bootstrap.

The first migration in both repository and production history is
`20260630_prepare_user_subscriptions_for_revenuecat.sql`. Its first operation
alters `public.user_subscriptions`. No earlier recorded migration creates that
table. On an empty database, PostgreSQL raises:

```text
relation "public.user_subscriptions" does not exist
```

The local regression test reproduces that error and confirms zero public tables
remain. Resetting and replaying the same history repeats the same failure.
The deleted branch's deployment logs were not available, so the precise deleted
run's error message cannot be recovered here; the failure above is independently
reproduced from the actual first migration.

Supabase documents that database schemas are built from migrations: dashboard
branches use the base project's recorded migration history, and GitHub branches
use repository migration files. The live schema itself is not copied. Therefore
production can have working tables while its new branch has none.
[Supabase branching behavior](https://supabase.com/docs/guides/deployment/branching)

Additional rebuild failures were also identified:

- `supabase/setup.sql`, root `SUPABASE_SETUP.sql`, and `SUBSCRIPTIONS_RLS.sql`
  contain manual setup definitions outside the migration stream. Branch replay
  does not run these files. They also differ from the current live schema.
- Once the manual OnlyFast setup is supplied, July's linking foundation still
  fails because `onlylaps_timing_sessions` is absent. The pre-existing OnlyLaps
  schema was supplied outside this repository's migration history. The linking
  migration creates relationship/analysis tables, not their OnlyLaps parents.
- `timing_scan_usage` has no creation migration. Manual setup also lacks live
  details such as subscription `id` / unique `user_id` / `current_period_end`,
  share expiry, and the schedule's `race_class` column.
- Two migrations assume real named Auth accounts exist and raise if they do not.
  Branches start without those accounts. Seeding after migrations cannot fix an
  account requirement that aborts the earlier migrate step.
- Mixed 8-, 12-, and 14-digit versions make filename sorting non-obvious.
  In lexical order `202607280002_...` precedes `20260728_...`. This is not the
  initial failure, but date-looking filenames are insufficient as a dependency
  plan. The prepared staging order explicitly puts beta definitions before links.
- `supabase/config.toml` enables seeding from `./seed.sql`, which is absent.
  No production/customer seed should be added to solve this. The standalone
  staging config disables seeds entirely.
- The RevenueCat expiration migration needs actual Supabase `pg_cron` support.
  This is a runtime dependency, not the cause of the initial zero-table failure.

## Production history compared with repository

The read-only migration listing still contains nine entries. The live catalog
has 22 public application tables, all with RLS enabled. The presence of OnlyLaps
link/analysis tables despite absent history entries demonstrates out-of-band
schema setup; missing history does not mean an object is absent.

| Repository migration version / name | Production history | Standalone staging action |
| --- | --- | --- |
| `20260630_prepare_user_subscriptions_for_revenuecat` | Recorded | Replay after baseline |
| `20260713_add_race_schedule_end_date` | Recorded | Replay |
| `20260720_enforce_active_race_class` | Recorded | Replay |
| `20260728_add_account_beta_feature_flags` | Recorded | Replay with empty Auth; static feature definitions only |
| `202607280002_onlyfast_onlylaps_backend_foundation` | Absent; objects exist | Replay after OnlyLaps baseline |
| `202607280004_onlyfast_onlylaps_session_linking` | Absent; objects exist | Replay after linking foundation |
| `202607280005_enable_cmar_test_account_full_access` | Absent | Exclude account-only grant |
| `20260817_link_race_setups_to_schedule` | Recorded | Replay |
| `202609240001_revenuecat_subscription_sync` | Absent | Replay unchanged |
| `202609240002_schedule_revenuecat_expiration` | Absent | Replay with supported `pg_cron` |
| `20260929_add_custom_car_class` | Recorded | Replay |
| `20260930_add_development_setup_library` | Recorded | Replay |
| `20261001_verify_designated_test_account` | Recorded | Exclude account-only verification/grant |
| `20261002030004_add_development_kart_classes` | Recorded | Replay |
| `202610130001_restore_racing_onboarding` | Absent | Replay |
| `20261013183621_enable_road_racing` | Absent | Replay after onboarding and setup library |
| `20261015235847_secure_membership_authorization` | Absent | Replay last; trusted grants and expiry enforcement |

Existing documentation corroborates this split: `REVENUECAT_DEPLOYMENT_CHECKLIST.md`
describes the unrecorded subscription baseline, and
`ONLYFAST_ONLYLAPS_BACKEND_FOUNDATION.md` describes the already-deployed OnlyLaps
parent tables as prerequisites rather than objects it creates.

## Prepared staging resources

- `supabase/staging/20261016230333_staging_baseline.sql`: new, data-free baseline
  created using `supabase migration new staging_baseline` (CLI 2.121.0), then kept
  outside the production migration directory. It reconstructs 17 missing core/
  shared tables from read-only catalog metadata, including keys, constraints,
  identity sequence, indexes, required maintenance triggers and owner RLS.
- `supabase/staging/schema-expectations.json`: audited names, column types,
  nullability and constraints for the 22 live tables. Contains no table rows,
  Auth users, credentials or customer data.
- `supabase/staging/plan.json`: explicit source ordering and the two excluded
  account-only scripts. Every canonical migration must be included or excluded
  exactly once; a future unreviewed migration causes preparation to fail.
- `scripts/prepare-staging-database.mjs`: offline generator for a separate,
  unlinked Supabase workspace. It refuses an existing destination, does not copy
  `.temp`, secrets, seeds, remotes or functions, and never opens a database or
  runs a deployment command.
- `tests/stagingDatabase.mjs`: empty-database replay, failure reproduction,
  source hash checks, schema assertions, RLS and synthetic billing/onboarding tests.

The baseline deliberately aborts if public application tables **or Auth users**
already exist. It is not an idempotent production repair script. The later
staging history includes current reviewed onboarding and subscription changes;
it represents the repository's intended state, not a frozen production clone.

All 15 retained historical migration files are copied **byte-for-byte** into the
generated workspace, including the Stripe/RevenueCat SQL. Only the *generated
staging filenames* receive contiguous 14-digit versions after the new baseline.
`manifest.json` maps each generated name to its original source path and SHA-256.
The root `supabase/migrations` files, their versions, and all billing integration
code are unchanged. The two excluded migrations contain no schema definitions;
their real-user privileges are not appropriate bootstrap data for empty staging.

The baseline supplies the shared OnlyLaps tables needed by OnlyFast linking and
analysis, plus their maintenance triggers. It does not attempt to reconstruct
the separate OnlyLaps application's complete RPC surface, workers, UI or storage
configuration. Do not treat this OnlyFast staging profile as a full migration
replacement for the separate OnlyLaps codebase.

Explicit grants make the baseline work with current Supabase Data API defaults.
Clients receive owner-scoped application access, subscription reads, and no direct
subscription or quota writes. Service writes remain available. The final secure
membership migration removes the historical editable-metadata authorization.
[Supabase changes to default API exposure](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## Reproduce the offline staging workspace

From the repository root:

```powershell
node scripts/prepare-staging-database.mjs
```

The prepared workspace is already available locally at `tmp/staging-database/`.
The default output is ignored by Git and contains `supabase/config.toml`,
16 ordered migration files, README and manifest. An existing destination is
refused; specify a different new directory to prepare another copy:

```powershell
node scripts/prepare-staging-database.mjs C:/Temp/onlyfast-staging-new
```

This command only writes files. It cannot create a paid branch, reset a database,
change a linked project, deploy functions or enable purchases.

The generated sequence is:

1. Fresh schema baseline: seven OnlyFast core/usage/billing tables and ten
   existing shared OnlyLaps tables, with no customer rows.
2. June RevenueCat preparation.
3. July schedule end dates, active class and beta feature definitions.
4. July OnlyLaps linking foundation and one-to-one session linking.
5. August schedule associations.
6. September RevenueCat snapshots/atomic sync and expiration schedule.
7. September Custom Car and setup library; October kart classes.
8. October onboarding restoration and road-racing enablement.
9. October secure membership authorization.

For a future **authorized local Supabase** rehearsal, use the generated workspace
as the CLI `--workdir` rather than the repository's production-oriented workdir.
Docker/Supabase services and `pg_cron` must be available. No hosted target is
configured in the generated files. Commands to start/reset that stack are not
executed by the generator and were not run in this task.

## Disposable database validation

Validation uses actual PostgreSQL in PGlite 0.3.14, with Supabase-managed Auth
roles/functions represented by a minimal platform fixture. No application tables
are mocked: all 23 are created by the actual prepared SQL. Auth starts empty;
synthetic `example.invalid` users are added only after migration replay.

```powershell
$qaRoot = Join-Path $env:TEMP 'onlyfast-onboarding-qa'
# Only if the existing isolated dependency is absent:
npm.cmd install --prefix $qaRoot --no-save --package-lock=false @electric-sql/pglite@0.3.14
$env:PGLITE_MODULE = Join-Path $qaRoot 'node_modules/@electric-sql/pglite/dist/index.js'
node --experimental-strip-types --test tests/stagingDatabase.mjs tests/revenuecatDatabase.mjs tests/subscriptionAuthorizationDatabase.mjs tests/racingOnboardingDatabase.mjs
```

Results: **7 tests passed, 0 failed**, including the four new staging tests.
Focused ESLint on the new preparation/test scripts passed. The staging tests verify:

- The unmodified first migration fails with zero public tables; manually loading
  the old setup still leaves the OnlyLaps parent dependency missing.
- The complete prepared sequence succeeds without named users or customer data.
- All 22 audited production tables retain their column types, nullability and
  constraint definitions, and the new RevenueCat event table brings the total to 23.
- Every application table has RLS enabled. Native and Stripe provider columns,
  subscription `id` / unique `user_id`, billing period, share expiry, and telemetry
  identity generation are present.
- Free Rookie onboarding completes without a subscription. Forged editable
  metadata cannot grant paid/admin access. Clients cannot write or truncate
  subscriptions or read another account's row.
- The deployed legacy Stripe upsert shape still works; native synchronization
  preserves Stripe trial access, billing period and the active vehicle.
- Source bytes match the generated SHA-256 manifest, unknown migrations cannot
  silently enter the plan, and existing output directories are refused.
- Running the baseline against an initialized database aborts instead of modifying it.

**Extension boundary:** PGlite cannot install Supabase's native `pgcrypto` or
`pg_cron` binaries. Tests use built-in `gen_random_uuid`, omit only the two extension
installation statements, and provide a test-only `cron.schedule` recorder. The
actual expiration migration records the expected job name, every-minute schedule
and SQL command. No application migration SQL is otherwise changed. This tests
SQL dependencies and schedule registration intent, **not a running cron worker**.
The emitted migration files retain real extension installation statements.

The existing RevenueCat, trusted membership and combined onboarding PostgreSQL
regressions also pass. SQL and manifest verification cover this schema-only task;
no frontend or billing code was changed. Logs: `tmp/staging-database-tests.log`
and `tmp/staging-database-regression.log` (ignored local QA logs).

## Remaining blockers and safe next steps

1. **Dashboard branch creation remains blocked by the old production history.**
   Keeping that history untouched means recreating/resetting another dashboard
   branch from it will reproduce the missing-baseline failure. This task does
   not claim that server-side history has been repaired.
2. The independent prepared history is for a **new empty staging database** only.
   It must never be merged into production or used with production `db push`,
   `migration repair`, `db reset`, or history-table SQL. Existing production
   migrations cannot safely be replaced with these newly numbered staging copies.
3. A future GitHub-based setup needs an independently approved staging-only
   integration/project and the generated workspace's parent as its working
   directory. Supabase's GitHub **Working directory** points to the directory
   containing `supabase/`. Do not change the production project's integration or
   publish this generated history into its production pipeline. Validate the
   selected migration source/history before paying for a future branch.
   [GitHub integration and working directory](https://supabase.com/docs/guides/deployment/branching/github-integration)
4. Docker/native Supabase services were unavailable locally. A supported Supabase
   runtime still needs to confirm native extension installation, successful cron
   worker runs, PostgREST/RPC exposure, Auth token issuance and hosted Edge behavior.
   These checks are not substitutes for the passed SQL rebuild and require no
   production customer data.
5. Create synthetic accounts only after the schema is ready. Any tester/promo/admin
   grants must be explicit and server-owned; do not bootstrap real customer records
   or real-user grants from production. The default workspace seeds nothing.
6. Live RevenueCat migrations/functions/secrets/webhook deployment and real-device
   sandbox acceptance remain the separate items in `REVENUECAT_DEPLOYMENT_CHECKLIST.md`.
   This staging repair does not activate purchases, change Stripe billing or solve
   production's pending authorization rollout.

No retrying paid branch, production baseline/history repair, deployment, or
customer-data copy was performed.
