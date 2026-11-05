# OnlyFast QA automation

Authentication configuration follow-up (November 5, 2026): the existing interface now has an external, Windows-account-restricted configuration at `C:\Users\c_mar\.onlyfast-qa\qa.env` with confirmed production URL, existing enabled publishable key and approved QA UUID. Credential fields remain blank because no approved password/session was available in the checked local sources. The existing configuration check and production read-only smoke command both stopped at `QA_AUTH_CONFIGURATION_REQUIRED`, **before authentication**. No account data, permissions, implementation or deployment changed. Exact one-time setup and redacted run evidence are in [the authentication setup guide](qa/automation/AUTHENTICATION_SETUP.md). The A–N sections below retain the earlier local implementation audit and test results.

Local implementation and verification: November 5, 2026. This work does **not** resume the Phase 1 release. No production writes, migrations, function/frontend deployments, credential resets, commits or pushes occurred. No production fixture creation or authenticated production smoke test occurred.

## A. Existing QA functionality discovered

The audit covered canonical `src`, historical `supabase/src`, migrations, Edge Functions, Auth callbacks, beta flags, membership authorization, existing QA directories, scripts, tests and configuration references. Existing functionality was reused:

- `test@test.com` is the designated identity in the database-backed tester model. `betaFeatures.ts`, `testAccount.ts` and `_shared/beta-features.ts` already implement trusted tester/feature checks. Editable Auth metadata is not an entitlement authority.
- `AppLayout.tsx` invokes `resetTestAccountData()` after test-account login, once per browser session; `Header.tsx` invokes it before logout. The canonical local reset implementation previously deleted broad sets of owned records, including subscription state, and cleared Auth metadata. That implementation was unsuitable for permanent fixtures.
- The deployed function inventory has **no `reset-test-account` endpoint**. Source code alone did not prove automatic production deletion was active. Historical copies in `supabase/src` and `supabase/docs` are retained historical material, outside the root Vite entry; they must not be used as deployment sources.
- Trusted membership RPCs, setup ownership/RLS, active-class rules, server quota reservations, secure sharing redemption, OnlyLaps ownership helpers and timing serializers already exist. Some reviewed Phase 1 enforcement is still local/pending release.
- Existing `.test.ts` suites exercise actual application helpers and transpiled component callbacks. `setupLibraryHarness.ts` reuses actual component functions. Mounted `.mjs` suites use React's renderer. Six PGlite suites exercise real PostgreSQL policies/functions in disposable engines. `phase1Postgres.mjs` is a separate opt-in real PostgreSQL concurrency harness.
- `qa/median-paywall` already supplies an isolated native paywall acceptance tool. It intentionally has different identity/full-access restrictions. It was preserved rather than repurposed. Existing native/device diagnostics, preview artifacts and staging preparation tools were retained.

## B. Functionality already working

The existing QA identity, stored tester permissions and trusted Team beta access were verified read-only. Existing unit/database suites already cover Rookie/Pro/Team/expired entitlements, account switching, forged metadata rejection, advertisements' eligibility rules, ownership, setup-library saves/copies, weekend identity, sharing, timing normalization, quota behavior and OnlyLaps isolation.

These are local simulations/database tests, not proof of live purchases, devices, provider responses or complete production UI flows. The broader regression run has seven failures detailed in section K; this report does not label that run green.

## C. Missing functionality identified

There was no single reusable operator command combining secure environment classification, dedicated-identity verification, fixture provenance, bounded cleanup and redacted reports. There was no versioned persistent fixture manifest. Ordinary Auth was coupled to a broad reset facade. Reusable authentication credentials were not configured in the new approved external-secret interface. Existing mounted tests also have stale dependencies and pre-Phase-1 assumptions.

## D. Functions added or completed

- Added Node-only `qa/automation` commands, reusing existing tests and application serializers. Added pinned **development** dependencies `react-test-renderer@18.3.1` and `@electric-sql/pglite@0.3.14`; existing runtime lock entries/versions were preserved. `npm ci --ignore-scripts --no-audit --no-fund` passed.
- Added normal Supabase Auth, verified identity/project guards, session refresh, account-switch detection, local-session logout and memory disposal. No password was generated, read from application code or reset.
- Added deterministic fixture IDs, marked persistent records, idempotent insert-only seeding, current-run disposable receipts, explicit reset and fail-closed cleanup.
- Changed `src/lib/testAccount.ts`: legacy no-argument calls now return `false` immediately, without Auth/network/database access. Login/logout callers remain unchanged. Explicit fixture reset requires a separate action, confirmation and allowlist, followed by server authorization.
- Prepared the canonical reset Edge Function with dedicated identity, experimental tester and reset-feature checks. It supports explicit catalog reset, current-run cleanup and a read-only cleanup-capability probe. It performs bounded deletes with the verified user's JWT. It does not delete subscriptions, Auth metadata, usage records, OnlyLaps telemetry or legacy QA setups.
- Added 19 focused safety tests, including execution of the actual prepared Edge handler with controlled dependencies. No new migrations or public QA page/login route were added.

The reset/function changes are **prepared locally only**. An existing production browser bundle retains its previously deployed behavior until a separately authorized frontend release.

## E. Existing test account verification

Supabase project: `thpyjvwtfvfxiufchrxn`. Dedicated identity: `test@test.com`, UUID `4b9864ff-2195-4be0-83a4-39308446577e`.

Read-only Auth/database inspection confirmed that the identity exists, is not deleted or banned, and has a configured password. No password/hash/token was retrieved. Current subscription row: **Pro / trialing / Stripe**, active class **Pro Stock**. Effective trusted tier: **Team**, through the existing experimental beta grant.

Stored tester settings remain `is_test_account=true`, `beta_features_enabled=true`, `tester_kind=experimental`. Existing enabled flags remain `test_account_reset`, `test_account_full_access`, `onboarding_preview_route` and `rookie_ad_slot_preview_route`. No identity, permission or subscription change was made.

Existing inventory before fixture planning: 15 setups, two shares, no schedule rows. It includes Dwarf Cars and Pro Stock weekend sessions plus GT3, Legends, RC Touring Car, Road Racing/Superbike and Winged Sprint Cars templates/custom data. Existing setup rows are older than 48 hours; they have no timing data. Final read-only inventory still showed 15 setups, two shares, zero schedule rows and zero OnlyLaps links. Existing data was not adopted into the reset catalog or duplicated in production.

An actual approved Auth session was **not used**. Production login/logout, save/load and subscription UI smoke testing remain unverified. The previously proposed personal account is not used by this automation system.

## F. Subscription testing coverage

Use existing isolated membership/database fixtures for Rookie, Pro, Team, expired and account-switching scenarios. They exercise trusted server authorization, one active class, setup/weekend limits, 48-hour locking, Assist weekend usage, timing monthly usage, paid access and ad eligibility. Relevant suites include `membershipAuthorization`, `membershipLifecycle`, `subscriptionAccountSwitch`, `subscriptionServerAuthorization`, `subscriptionAuthorizationDatabase`, `revenuecatDatabase`, `phase1Database` and `nativeAds`.

The real QA account's full-access beta grant remains intact; it cannot establish genuine Rookie restrictions by changing a client tier or editable metadata. No production tier-switch override was added. The multi-class catalog seed requires an existing trusted Team/admin tier **and** existing setup-library permission; it refuses to grant those rights itself. Tests prove refusal for insufficient rights.

No customer subscription, price, RevenueCat owner, Median configuration, purchase or advertising activation changed. Native/store entitlements remain simulated unless separately tested on approved devices/store sandboxes. The historical iOS assertion failure is retained in the regression result.

## G. Persistent QA fixture design

Catalog: `onlyfast-qa-v1`. It contains **24** records: 20 setups across Dwarf Cars, Legends, GT3, Shifter Kart and Clutch Kart; three schedules; and one share. Each class has a base template, hotlaps/base session, heat and main. Synthetic main sessions contain lap data and finishing position; expanded sheets reuse `buildLibraryCustomFields`; timing reuses `mergeTimingScanResults`. Dirt sessions link to the current synthetic schedule.

Schedule dates are previous/current/upcoming relative to `ONLYFAST_QA_FIXTURE_DATE` or the planning date. Past schedules include a finishing position. Server-created timestamps are never forged or backdated. Existing old records remain available for eventual read-only age checks; isolated database tests exercise clock-based locking.

IDs derive from catalog + project + approved owner + fixed key. Setups carry `custom_fields.onlyfast_qa_v1`; schedule provenance uses an exact marked `organization` string because that table has no notes/custom JSON column. The share has a fixed catalog ID, random code on first insert and an exactly identified marked parent. No real provider telemetry is fabricated. OnlyLaps linking/retrieval/unlinking and context scenarios reuse existing isolated fixtures; a real authorized linked session is a separate setup requirement.

Seed preflights existing permissions, every owned marker/parent and catalog collision before inserting. It never upserts or overwrites an existing row. Repeat seeding preserves IDs, saved contents, dates and an existing sharing code. An unknown existing QA marker/name requires reconciliation instead of silently inserting another catalog. Existing unmarked QA records remain untouched. On a later date, seed preserves the original schedules; intentionally updating them requires a reviewed explicit fixture reset/reseed.

Disposable mutation tests create a distinct `persistent=false` marker plus run UUID and retain an immutable receipt **before** insertion, including when the response is lost. Only current-run receipts can be edited/cleaned. Ordinary tests/Auth preserve permanent fixtures. An interrupted process can leave marked disposables: review their exact IDs/owner/run marker before any subsequent recovery; no broad orphan cleanup exists.

## H. Authentication configuration

Requires a current Node runtime with type stripping, `node:util.parseEnv` and `import.meta.resolve` (verified with Node v24.18.0), and `npm ci` development dependencies.

`qa/automation/.env.example` contains **variable names with blank values only**. Credentials belong in an approved external secret store, CI secrets, or an absolute private environment file **outside this repository**. `ONLYFAST_QA_SECRET_FILE` resolves symlinks and rejects repository-contained files. Restrict the external file's OS permissions to the operator. The harness does not create a secret file or account/password.

One-time operator configuration:

1. Supply `ONLYFAST_QA_URL`, `ONLYFAST_QA_PUBLIC_KEY` and the dedicated account's existing password (`ONLYFAST_QA_PASSWORD`) or a dedicated automation session's `ONLYFAST_QA_REFRESH_TOKEN` through that external store. Do not paste credentials into chats, shell command arguments, reports or application `VITE_*` variables. Do not reuse a personal session. No authentication configuration is currently installed for this harness.
2. For staging, set the explicitly approved, non-production `ONLYFAST_QA_STAGING_REF` and that environment's existing approved QA UUID in `ONLYFAST_QA_USER_ID`. The harness never creates an Auth identity. Local network operations only accept loopback Supabase on port 54321. Never forward that port to production.
3. Production is pinned to the project and UUID in section E. Set the runtime environment flag `ONLYFAST_QA_PRODUCTION_READS_APPROVED=true` only after approval for that run. A conflicting UUID or production URL masquerading as staging/local is rejected.
4. Runtime-only flags are **not loaded from the credential file**: `ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED`, `ONLYFAST_QA_RESET_APPROVED`, `ONLYFAST_QA_PRODUCTION_READS_APPROVED` and `ONLYFAST_QA_EDGE_READS_APPROVED`. Set them explicitly in the approved process/CI job, then clear them after the run. They are not public app controls or server authorization.

The runner uses a public publishable/anon key and normal `signInWithPassword` or `refreshSession`. `getSession` alone is insufficient: fresh `getUser` plus the stored tester row must match before checks/mutations. Expiring sessions refresh; failures require a fresh approved login. Every invocation reauthenticates rather than trusting another run's cache. Account switching aborts writes. Session storage is isolated in memory; logout explicitly uses `{scope:'local'}` to avoid signing out the account's other devices. See [Supabase sign-out scopes](https://supabase.com/docs/reference/javascript/auth-signout).

The runner rejects service-role/private keys, rejects redirects to another project, applies request timeouts, suppresses SDK error bodies and disposes its memory/session on exit. Using a refresh token rotates it; a run's local logout revokes that session. For repeated invocations, use an approved password credential or provision a fresh dedicated session outside the repository.

## I. Automated testing commands

Run from the primary checkout. These local commands need no Auth credentials and perform no network database writes:

```powershell
npm run qa:smoke
npm run qa:regression
npm run qa:database
npm run qa:fixtures -- plan --env production
```

`qa:smoke` defaults to focused local unit/mocked safety tests. `qa:regression` runs all existing `.test.ts` suites, five mounted suites and six isolated database suites. `qa:database` runs the latter six. It never pushes migrations. The separate real-PostgreSQL `tests/phase1Postgres.mjs` requires its existing dedicated loopback configuration and is not automatically included; PGlite does not substitute for real concurrent connection testing.

After external configuration and environment approval:

```powershell
npm run qa:check -- --env staging
npm run qa:smoke -- --env staging
npm run qa:fixtures -- seed --env staging
```

`qa:check` validates configuration without authenticating. Hosted smoke performs normal Auth/identity verification, own setup/schedule/share reads, authoritative membership, invalid sharing-code rejection and token refresh/logout. Optional `ONLYFAST_QA_EDGE_READS_APPROVED=true` enables an owned-session OnlyLaps `status_only` request; no provider request is made by default. This is HTTP/API smoke, not a browser E2E suite.

`qa:smoke -- --env staging --mutations` additionally creates, edits, reopens and cleans a disposable setup. It first probes the separately configured safe-cleanup endpoint; an absent/incompatible endpoint prevents insertion. Production smoke uses `--env production` and requires the read approval flag. Adding `--mutations`, or production seed/reset, also requires the production mutation flag. These are future commands, **not authorization to run production mutations now**.

Explicit fixture reset requires `ONLYFAST_QA_RESET_APPROVED=true` and:

```powershell
npm run qa:fixtures -- reset --env staging --confirm RESET-ONLYFAST-QA-FIXTURES
```

Reset is never part of smoke, regression, login, refresh, account switching or logout. Reset/cleanup require the prepared endpoint to be separately deployed/configured after approval; it is absent in production today. Server configuration must enable `TEST_ACCOUNT_RESET_ENABLED`, pin the non-production `ONLYFAST_QA_USER_ID`, retain normal JWT verification and existing tester/reset flags. Production additionally requires the separate server flag `ONLYFAST_QA_PRODUCTION_RESET_APPROVED=true`. Keep it disabled outside a specifically approved operation.

Reports are written under ignored `tmp/qa-automation/<UTC timestamp>-<run UUID>/report.json`; local groups also retain TAP files. Reports include UTC/Pacific time, environment, QA identifier, suite, counts, skipped checks, limitations, Auth and cleanup status. Nonzero exit means failure; no historical failure is waived. Reports never intentionally serialize passwords, access/refresh tokens, key values, SDK errors or private setup contents. Local test subprocesses have QA/provider credentials removed from their environment.

## J. Customer data protection safeguards

All mutable operations require environment classification, fresh normal Auth, fixed approved identity, verified tester permission, owned records and the selected mode's approval. Production defaults to read-only; there is no service-role runner mode. Fixture IDs prove provenance, never authentication. Client/user metadata cannot grant a membership.

Explicit reset validates at most 24 deterministic catalog IDs and owned markers/parents. Disposable cleanup validates exact current-run receipts and marker/run UUID. Before any disposable insert, the endpoint's safe-cleanup protocol must be available. Client cleanup checks references and the server repeats dependency checks with visibility beyond RLS: shares outside the approved table-specific allowlist, any OnlyLaps link, and non-catalog schedule children cause refusal. Tests include a foreign share hidden from the user's RLS view and cross-table UUID collisions.

The server's existing service-role credential is used **only inside the prepared Edge Function for dependency reads**, never returned to or accepted from the runner. All deletes use the normal verified user's JWT and exact ID + owner predicates. The function does not reset a database or disable RLS. Its readiness probe uses impossible-ID schema/permission reads, without returning customer records.

Reset is a bounded, sequential operation, not an atomic transaction. A failure may leave a partially reset catalog; it fails visibly. Review exact remaining marked IDs and dependencies before retry/reseed. Reference preflight is not a substitute for database constraints/policies under concurrent writes. Before separately enabling hosted destructive QA, review the target's actual foreign keys and owner-insertion policies, prohibit concurrent changes to the targeted synthetic records and confirm no new cascade relationships exist. The present partial production release is not approved by this report for mutable QA. No production reset/cleanup was attempted.

The current main checkout was used as instructed; no worktree/branch was created. A pre-edit snapshot is retained at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-qa-rollback-DJ7TPC`. The previously frozen Phase 1 artifact at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-release-R9t3aQ` was not modified. SHA-256 checks confirmed both existing Phase 1 report files, all three Phase 1 SQL files, AppLayout, Header, native advertising, native purchases and release billing source remained byte-for-byte unchanged from the QA-start snapshot. Do not replace the frozen release artifact with this combined checkout.

Production history was rechecked: M1 remains applied as `20261105155821`; M2/M3 remain absent. Original Assist v27 and OCR v22 remain active; no function version changed. No frontend deployment was initiated. Billing, advertising holds, UI components, styles and racing behavior were not edited.

## K. Test results

| Verification | Result |
|---|---|
| New QA safety tests | **19 passed, 0 failed**; actual facade/Edge handler with controlled Auth/database dependencies |
| Focused `qa:smoke` | **69 passed, 0 failed, 0 skipped** |
| Full `qa:regression` | **560 passed, 7 failed, 0 skipped**; nonzero exit correctly retained |
| Full unit group | 519 passed, 1 failed (520 total, including 19 new tests) |
| Mounted group | 19 passed, 6 failed (25 reported; onboarding file abort prevents its internal tests running) |
| Isolated database group | **22 passed, 0 failed**, all six PGlite suites |
| Fixture plan | Passed; generated 24 offline records, inserted none |
| Missing staging configuration | Correctly refused with `QA_URL_REQUIRED`; Auth not attempted |
| Application/config TypeScript | Passed `tsc --noEmit -p tsconfig.app.json` and `tsconfig.node.json` |
| New tests/shared/Edge TypeScript | Passed supplemental `tsc` using a local Deno-global/remote-module declaration shim; not a Deno deployment/runtime check |
| Changed-file ESLint | Passed, no findings |
| Production Vite build/release output checks | Passed in isolated ignored output, leaving existing `dist`/release evidence alone |
| QA excluded from customer bundle | Passed actual 284-module output graph/content checks: no `qa/automation`, tests, PGlite or React test renderer modules; no operator config/credential variables |
| Fixture/Auth/reset/isolation safety | Passed simulated preservation, wrong identity, expired token, revoked flag, idempotency, bad marker, lost insert response, bounded reset and hidden-reference refusal tests |
| Live approved QA Auth, UI/device/provider checks | **Not run**, configuration/authorization still required |

Build output: `tmp/qa-automation/production-build/qa-build-verification.json`. CSS remains `main-Cu_p-s5V.css`, SHA-256 `768ce7b6a2cc24ea30c0eca55d43dd2e5edc4c9e791da544c2bac75d759a8c63`. Existing bundle-size and dependency deprecation warnings remain; no optimization/Phase 2 work was undertaken. The existing facade guard is application code and is included normally; the Node operator harness is excluded. Existing `.vercelignore` also excludes `qa`, tests, tmp and secret files from source uploads.

Evidence:

- Focused report: `tmp/qa-automation/2026-11-05T16-48-03.753Z-de8d8461-8238-42f0-b978-7e6d1ea0ea76/report.json`.
- Regression report/TAP: `tmp/qa-automation/2026-11-05T16-49-39.223Z-0b324b23-358e-4c8a-af6a-80935f648c3a/`.
- Latest 19-test check after the final guard refinements: `tmp/qa-unit-final.log`.
- Offline plan report: `tmp/qa-automation/2026-11-05T16-51-31.166Z-06158562-b2f3-4574-bb0a-5aed6b70f1cc/report.json`.
- Missing-config report: `tmp/qa-automation/2026-11-05T16-51-32.272Z-fedb7f33-7d24-465d-9dbb-dfa33f4fda07/report.json`.

Seven existing regression failures remain visible:

1. `iosReleaseBridge.test.ts:43`: historical custom-native assertion expects `NATIVE_PURCHASES_READY=false`; the current stock Median source returns true. This task did not change billing readiness or rewrite the assertion.
2. `onboardingNavigation.mjs`: component compilation aborts because the harness lacks the existing `./HouseAdPlacement` dependency.
3. `setupAssistTrackUpdates.mjs:159`: same missing house-ad dependency in the inline-footprint test.
4. `setupAssistTrackUpdates.mjs:219`: same missing dependency in the platform upgrade-design test.
5. `setupAssistTrackUpdates.mjs:252`: Assist harness omits the saved `onlyfastSessionId` required by Phase 1; no successful answer/bottom CTA appears (one versus two CTAs).
6. `setupAssistTrackUpdates.mjs:309`: the same missing saved-session identity prevents a request; expected request discipline is undefined.
7. `nativeAdSettings.mjs:291`: old mock expects a client-side used-count read to stop a request (three versus four calls). Current Phase 1 Assist relies on authoritative server quota/retry handling; the mock does not return a quota error.

These existing files and affected product code were not modified to obtain green results. The failures are not proof of a production regression, and they prevent claiming full mounted/E2E acceptance. Aligning those historical harnesses with the reviewed billing/advertising/Phase 1 contracts remains follow-up QA maintenance.

## L. Remaining setup requirements

1. Configure approved external QA credentials and a target staging project/UUID; run normal Auth smoke there. No existing password may be generated/reset without separate authorization.
2. Separately review/deploy/configure the prepared reset endpoint in an approved disposable/staging environment before reset or disposable mutation tests. Its absence deliberately prevents insertion by mutation smoke. Review actual dependencies/concurrency conditions first. No production activation is authorized here.
3. Approve a production **read-only** run explicitly before enabling its runtime flag. Today's database inspection was connector read-only administration, not the QA account's authenticated session.
4. Reconcile the seven historical regression failures above. The full regression command will continue to fail until their assertions/mocks are reviewed and repaired.
5. Use separately approved isolated real PostgreSQL for actual concurrent-connection checks, approved provider fixtures for live AI/OCR, an authorized OnlyLaps linked session for live telemetry, and real approved device/store sandboxes for native acceptance. None is claimed complete by simulated tests.
6. Persistent production fixtures remain an offline plan only. Review existing records, target security rollout state and permissions before authorizing any seed. No Phase 1 migrations are applied by these tools.

## M. Exact files modified

Existing files modified by this QA task:

- `.gitignore` — local credential/config exclusions.
- `package.json`, `package-lock.json` — five QA commands and two pinned development dependencies (plus the renderer's development transitive package).
- `src/lib/testAccount.ts` — inert ordinary-Auth calls and explicit bounded reset request.
- `supabase/functions/reset-test-account/index.ts` — prepared authenticated bounded reset/cleanup/probe.
- `docs/edge-functions/reset-test-account.ts` — canonical implementation pointer/safety notes.

New files:

- `qa/automation/.env.example`
- `qa/automation/config.mjs`
- `qa/automation/auth.mjs`
- `qa/automation/fixtures.mjs`
- `qa/automation/coverage.mjs`
- `qa/automation/runner.mjs`
- `supabase/functions/_shared/qa-fixtures.ts`
- `tests/qaAutomationHarness.mjs`
- `tests/qaAutomation.test.ts`
- `ONLYFAST_QA_AUTOMATION.md`

Ignored generated reports/builds/logs/check scripts are under `tmp`; they are not deployment source. Existing `ONLYFAST_PHASE1_RELEASE_READINESS.md` modifications and untracked `ONLYFAST_PHASE1_PRODUCTION_RELEASE.md` predate this QA task and were preserved exactly. They are not QA edits. No existing tests, migrations, TSX/UI, billing, advertising, environment activation or native source was edited.

## N. Future Codex usage instructions

Read this report and repository `AGENTS.md`; check CWD, status, current branch and remotes. Preserve local work/recovery evidence. Start with local `qa:smoke`; use regression for broad coverage and read every failure, not only the total. Consult `coverage.mjs` to reuse existing suites before adding tests. Use `qa:database` for destructive scenarios in disposable engines.

For hosted QA, obtain explicit environment/account authorization, use the external configuration interface, run `qa:check`, then normal read-only smoke. Verify current production rollout/schema separately; do not equate a local Phase 1 database test with deployed enforcement. Never resume a deployment, seed production, activate purchases/ads, reset an account or run migrations because a QA command exists. Mutation approval is specific to an operation and environment. Validate cleanup prerequisites before inserting. On cleanup failure, stop and review retained exact run records; do not delete by owner or marker alone.

Do not use historical shadow sources or modify the frozen Phase 1 artifact. QA source changes must be deliberately selected into any future release. No deploy, production configuration change, commit/push or Phase 2 begins without separate authorization.

### Final capability matrix

Status vocabulary: **EXISTS AND WORKS**, **EXISTS BUT INCOMPLETE**, **MISSING**, **REQUIRES CONFIGURATION**. Local success and hosted readiness are distinguished explicitly.

| Feature | Previous status | Final status | Files involved | Test result |
|---|---|---|---|---|
| Dedicated account/permissions | EXISTS AND WORKS | EXISTS AND WORKS | existing beta helpers/migrations; section E | Read-only live identity/flags verified; unchanged |
| Ordinary Auth without reset | EXISTS BUT INCOMPLETE | EXISTS AND WORKS locally | `src/lib/testAccount.ts`; unchanged AppLayout/Header callers | No-argument facade performs zero requests; preservation tests pass; frontend not deployed |
| Explicit safe reset | EXISTS BUT INCOMPLETE | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | canonical reset Edge; `_shared/qa-fixtures.ts`; `fixtures.mjs` | Actual handler bounded/foreign/cascade/flag tests pass; endpoint not deployed |
| Secure reusable Auth | MISSING operator workflow | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | `auth.mjs`, `config.mjs` | Wrong credentials/identity, switching, expiry, refresh and local logout pass with mocks |
| Secret management | REQUIRES CONFIGURATION | REQUIRES CONFIGURATION, interface complete | `.env.example`, `.gitignore`, `config.mjs` | External-only path/private-key/approval-file refusal passes; no credentials configured |
| Rookie/Pro/Team/expired tiers | EXISTS AND WORKS in isolation | EXISTS AND WORKS in isolation | existing membership, subscription/RevenueCat/Phase 1 suites | Database/unit checks pass; no live tier changes or native acceptance claimed |
| Persistent standard fixture catalog | MISSING manifest; reusable records exist | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | `fixtures.mjs`, `_shared/qa-fixtures.ts` | 24-record offline plan, idempotency and legacy preservation pass; zero production inserts |
| Setup disciplines/custom/timing/schedule fixtures | EXISTS BUT INCOMPLETE | EXISTS AND WORKS locally | same catalog; existing serializers | Dirt/pavement/road/two karts, heat/main, current/past/next, timing/position verified |
| Older locked setups | EXISTS AND WORKS | EXISTS AND WORKS | existing QA records; `phase1Database.mjs` | Existing old rows retained; isolated clock/lock checks pass; no forged server timestamps |
| Disposable create/edit/reopen/cleanup | EXISTS BUT INCOMPLETE reusable operator workflow | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | `fixtures.mjs`, prepared reset Edge | Lost-response receipt, marker, allowlist and RLS-hidden dependency checks pass |
| Base/weekend/library and offline actions | EXISTS AND WORKS in local suites | EXISTS AND WORKS in local suites | existing setup-library/weekend/navigation/offline tests | Reused unit/database checks pass; hosted UI mutation run not performed |
| Onboarding/navigation/application mounted coverage | EXISTS BUT INCOMPLETE | EXISTS BUT INCOMPLETE | existing onboarding/mounted suites; `coverage.mjs` | Six mounted failures include the onboarding file abort; not accepted E2E |
| Schedule/finishing position | EXISTS AND WORKS locally | EXISTS AND WORKS locally | existing schedule tests; catalog | Focused selection/position tests pass; no hosted CRUD run |
| Secure sharing | EXISTS AND WORKS locally; rollout incomplete | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | existing Phase 1 sharing/database tests; catalog | Valid/invalid/expired/revoked/owner checks reused; no approved live Auth redemption run |
| Setup Assist | EXISTS AND WORKS server/unit; mounted harness incomplete | EXISTS BUT INCOMPLETE overall acceptance | existing usage/Assist/Phase 1 tests | Server/quota/owner checks pass; three mounted scenarios fail; no live provider call |
| Timing/OCR | EXISTS AND WORKS in isolated tests | EXISTS AND WORKS in isolated tests | existing timing/usage/Phase 1 suites | Results/multi-image/session/quota helpers reused; no live screenshot/OCR-provider acceptance |
| OnlyLaps | EXISTS AND WORKS in isolated tests | EXISTS AND WORKS locally; live REQUIRES CONFIGURATION | existing link/context/card/Assist suites | Ownership/link/context tests pass; QA has no live link; status-only request opt-in |
| Native billing/ad behavior | EXISTS BUT INCOMPLETE acceptance | EXISTS BUT INCOMPLETE acceptance, unchanged | existing native suites; untouched native/billing/ad source | Local simulations only; historical iOS assertion + ad mock failure retained; no purchases/ads |
| Local/staging/production mode guards | MISSING unified operator guards | EXISTS AND WORKS locally; hosted REQUIRES CONFIGURATION | `config.mjs`, `auth.mjs`, `runner.mjs` | Production masquerading, bad identity, missing runtime approval fail closed |
| Reusable smoke/regression/reports | MISSING unified command | EXISTS AND WORKS | package scripts; `runner.mjs`, `coverage.mjs` | Smoke 69/69; regression honestly fails 560/567; redacted JSON/TAP reports |
| Customer bundle exclusion | EXISTS partial QA exclusions | EXISTS AND WORKS for new harness | existing Vite/`.vercelignore`; Node-only QA directory | Actual production graph/content checks pass, no QA/dev-engine/renderer module |
| Approved production authenticated E2E | REQUIRES CONFIGURATION | REQUIRES CONFIGURATION | external secrets/approval/session; future run | Not attempted or claimed; no deploy/production mutation |
