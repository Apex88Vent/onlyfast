# OnlyFast local Supabase / RevenueCat verification

Completed October 16, 2026 (America/Los_Angeles). **Local validation passed. No
production deployment or purchase enablement occurred.** The database and API
checks below used actual Docker services, not the earlier PGlite platform fixture.

## Environment and isolation

| Component | Verified result |
| --- | --- |
| Docker | Engine 29.8.2, `desktop-linux`, local named pipe `dockerDesktopLinuxEngine` |
| Supabase CLI | 2.121.0, invoked with `npx --no-install` |
| Workspace | `tmp/staging-database`, project ID `onlyfast-disposable-staging` |
| API / PostgreSQL | `http://127.0.0.1:54321` / `127.0.0.1:54322` |
| Database | PostgreSQL 17.11, image `supabase/postgres:17.11.0.004` |
| Cron | Native `pg_cron` 1.6.4; worker running |
| Edge Runtime | 1.77.4, compatible with Deno 2.1.4 |
| Application schema | 23 public tables, all with RLS; 16 migrations applied |

Docker initially retained a startup failure from before WSL installation. WSL
was now installed; restarting Docker Desktop resolved that stale failure. No
Windows reset, Docker factory reset, or extra software installation was needed.

Before starting or resetting the database, the staging project ID, absence of
`[remotes]`, absence of `supabase/.temp/project-ref`, migration source hashes and
local Docker endpoint were checked. Commands used the explicit staging `--workdir`;
the reset additionally used `--local --no-seed`. The repository's linked production
workspace was not used for database operations. The CLI's migration listing uses
a column named `remote` even with `--local`; here that column referred to the
local container database, and all 16 versions matched the prepared files.

The existing baseline, manifest, generator and prepared workspace were reused.
Both initial startup and a second explicit local reset replayed the complete
migration sequence successfully. No staging migrations were moved into the root
production migration directory.

No production Supabase connector, cloud branch, Vercel deployment, customer-data
export, RevenueCat account API, Stripe API, Apple or Google store action was used.
Public container images and pinned public JavaScript dependencies were downloaded
as needed. No paid cloud resources were created.

## Test results

| Suite | Passed | Failed | Notes |
| --- | ---: | ---: | --- |
| `npm test` | 351 | 0 | TypeScript application/unit/regression suite |
| `tests/*.mjs` without local-runtime flag | 52 | 0 | Mounted components and PostgreSQL/PGlite regressions; the new local-only suite is intentionally skipped in this command |
| `tests/localSupabaseRevenueCat.mjs` with local-runtime flag | 13 | 0 | 12 scenario tests plus their enclosing suite, against actual Supabase services |
| Focused ESLint | Passed | 0 | New local preparation/test scripts and updated fixture harness |
| Local security advisors | No issues reported | — | `supabase db advisors --local --type security` |

The local suite verifies the following through real Auth-issued JWTs, PostgREST,
Edge HTTP handlers and PostgreSQL:

- All 16 migration versions exactly match the manifest. All 22 audited production
  tables retain the expected column types, nullability and constraint definitions;
  the additional RevenueCat event table makes 23. Every application table has RLS.
- Rookie stays free. Editing `user_metadata` to claim Teams/admin does not grant
  access. Authenticated clients cannot insert, update, delete or truncate
  subscriptions, execute the service-only apply RPC, or read another account's row.
- Pro and Teams resolve correctly from authoritative-shaped subscriber responses.
  A trial grants access with a finite expiration. A forged request-body user ID
  cannot synchronize another account or elevate the caller.
- Cancellation retains paid access before expiration. Expired native access is
  removed, while a valid billing grace period retains temporary access.
- Existing Stripe trials keep precedence over native Teams. Stripe cancellation
  falls back to valid native access; native expiration removes that fallback;
  Stripe renewal reclaims Stripe access. The legacy deployed Stripe upsert shape
  works without `subscription_source`, and its billing period/customer ID survive.
- Duplicate webhook IDs do not trigger another provider fetch or change the
  stored snapshot. Stale snapshots cannot replace newer state. Malformed writes
  roll back their event IDs rather than preventing a valid retry.
- Transfers reconcile the two accounts independently. Conflicting UUID aliases
  fail visibly. Events for a non-allowlisted app are ignored.
- Missing/invalid credentials, unsupported methods and malformed webhooks receive
  the expected failures. A provider 503 causes webhook 500 / sync 502, preserves
  existing paid access and leaves the event retryable. Retrying succeeds.

**Actual cron verification:** the single `onlyfast-expire-revenuecat` job is active
on `* * * * *`. The test made a synthetic native expiration overdue, verified
authorization rejected it immediately, and waited for the cron worker to change
the effective row to free/expired. It never manually invoked the sweep. A native
worker run succeeded at **4:47 PM PDT**, with `return_message = '1 row'`; valid
Stripe access remained available. Earlier successful worker runs were also recorded.

Four synthetic `example.invalid` accounts were created through local Auth and
deleted afterward. Final verification found **0 Auth users, 0 subscription rows,
and 0 webhook-event rows**, while the 23-table schema and cron job remained.

## Local Edge Function testing method

`scripts/prepare-local-revenuecat-functions.mjs` copies the actual
`revenuecat-webhook`, `sync-revenuecat-subscription`, and shared RevenueCat code
into the ignored local workspace. Those three copies were confirmed
**byte-for-byte identical** to their repository source.

A clearly labeled local-only bootstrap intercepts the hardcoded RevenueCat GET
request and sends it to a synthetic HTTP fixture at
`host.docker.internal:55439`. It blocks other external API requests and rejects
nonlocal Supabase endpoints. The fixture requires a dummy local API key. No real
RevenueCat secret or actual customer record is used. Supabase Auth and database
requests still go to the real local services.

This validates the real handlers, SDK, HTTP status behavior and database integration.
It does **not** validate actual RevenueCat credentials, real webhook delivery,
store receipts, a physical device purchase, store trial eligibility or refunds
issued by Apple/Google. Those remain separate acceptance requirements.

Both functions were served locally with gateway JWT verification disabled and
their own handler authentication active, matching the intended deployment config.
The fixture server exists only during the test process and closes afterward.
The local function server remains available for reruns; subscription sync without
the fixture running intentionally fails instead of contacting RevenueCat.

## Changes made

- Added `scripts/prepare-local-revenuecat-functions.mjs` for guarded local handler
  copies, fake credentials and outbound fixture interception.
- Added `tests/localSupabaseRevenueCat.mjs` for the actual-container verification.
  It is opt-in; ordinary offline test runs skip it.
- Fixed two stale dependencies in `tests/setupAssistTrackUpdates.mjs`: the
  membership revision hook and locked-feature notice/router fixture. These caused
  the initial two mounted-test failures. After correcting the test harness, all
  mounted regressions passed. No application feature behavior changed.
- Added this report and links from the earlier staging/deployment documents.

**No application subscription code, original migration SQL, Stripe webhook,
frontend billing, store products, production secrets or production history was
changed in this local testing task.** No migration repair was needed: the prepared
sequence passed on native Supabase without altering its SQL.

## Reproduce the local checks

The local stack is running. Local development keys are in the ignored workspace's
`local-status.json`; they are not included in this report or committed source.

For another local test run, keep the local function server running and use:

```powershell
$env:ONLYFAST_LOCAL_WORKSPACE = (Resolve-Path 'tmp/staging-database').Path
$env:ONLYFAST_DOCKER = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
node --experimental-strip-types --test tests/localSupabaseRevenueCat.mjs
```

If the function-serving process has stopped, restart it in a separate terminal:

```powershell
$taskStagingRoot = (Resolve-Path 'tmp/staging-database').Path
npx.cmd --no-install supabase functions serve --workdir $taskStagingRoot --env-file (Join-Path $taskStagingRoot 'local-functions.env')
```

To inspect only this local instance:

```powershell
$taskStagingRoot = (Resolve-Path 'tmp/staging-database').Path
npx.cmd --no-install supabase migration list --local --workdir $taskStagingRoot
npx.cmd --no-install supabase db advisors --local --type security --workdir $taskStagingRoot
```

The local-only test refuses other project IDs, linked workspaces, non-loopback API
addresses, unexpected database hosts or a nonlocal Docker context. The function
preparer refuses an existing functions directory; reuse the current prepared
copies rather than overwriting them. If source SQL changes, prepare a new isolated
workspace using the original generator and review its manifest before resetting.

Local logs:

- `tmp/local-supabase-start.log`, `tmp/local-supabase-reset.log`
- `tmp/local-supabase-migrations.log`, `tmp/local-supabase-advisors.log`
- `tmp/local-supabase-functions.log`, `tmp/local-supabase-e2e.log`
- `tmp/local-supabase-regression-ts.log`, `tmp/local-supabase-regression-mjs.log`

Expected negative-case errors in the function log are deliberate test assertions.
The startup/status logs contain local development credentials; keep them local.

## Production readiness and exact next steps

**The backend passed local deployment and integration checks. Production rollout
and purchase launch are still pending.** The local fixture cannot certify real
RevenueCat/store delivery or production environment configuration.

1. Review the production rollout separately. Recheck actual production history,
   schema and independent grant records before changing anything there. Use the
   original production migration files and the order in
   `REVENUECAT_DEPLOYMENT_CHECKLIST.md`; do not apply the newly numbered staging
   history. At the last read-only audit, June preparation was applied and these
   original migrations remained pending, in order:
   - `202609240001_revenuecat_subscription_sync.sql`
   - `202609240002_schedule_revenuecat_expiration.sql`
   - `20261015235847_secure_membership_authorization.sql`
   If a separately approved onboarding restoration is included, it must precede
   the final secure authorization migration, as that checklist explains.
2. Back up the relevant production schema/functions/state and prepare the
   checklist's rollback plan. Preserve legitimate Stripe records, trusted grants,
   native expiration enforcement and event idempotency history.
3. Set/verify the real server-only RevenueCat API key, exact webhook Authorization,
   real app allowlist and entitlement identifiers. Production sandbox acceptance
   defaults to false. Preserve all existing Stripe/portal secrets and functions.
4. Under separate deployment authorization, deploy the reviewed original handlers:
   `revenuecat-webhook`, `sync-revenuecat-subscription`, `get-suggestions`, and
   `scan-timing-screen`, with their shared dependencies and documented JWT settings.
   **Never deploy the local fixture bootstrap or dummy environment file.**
5. Configure the RevenueCat webhook against the deployed backend with the exact
   Authorization value, intended apps/environment and lifecycle/transfer events.
   Verify TEST delivery, then actual provider synchronization and server access.
   Verify cron runs and authorization boundaries in the deployed environment.
6. Complete actual iOS/Android sandbox acceptance with synthetic test accounts:
   Pro/Teams trials, purchase, cancellation through expiry, renewal, restore,
   account switching and billing grace/refund behavior. Existing Stripe checkout
   and portal behavior must also pass a separately authorized acceptance check.

Keep live purchases disabled throughout backend rollout validation. Offering
changes, paywall publication, store submission and public purchase enablement
require their own launch decision. No action in this list was performed against
production in this task.
