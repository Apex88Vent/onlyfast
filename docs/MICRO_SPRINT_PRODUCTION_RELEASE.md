# Micro Sprint current-version production release

Released November 19, 2026, America/Los_Angeles. This report supersedes the initial test-only preparation status in SMALL_OVAL_CLASS_EXPANSION.md. That document's field inventories and 2027 carry-forward guidance are retained.

## Actual deployment

- Production site: https://onlyfast.app (and www.onlyfast.app).
- Verified production deployment: dpl_FDF1cEszTxzTmfcEsnNzt28mL2ko, READY, with both custom domains assigned.
- Deployment URL: https://onlyfast-kv31z5z4g-apex88vents-projects.vercel.app.
- Existing project: onlyfast, prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR, team_smopqnOs6cFIL3nxEZ7O9O7Z.
- Backend: existing current-version OnlyFast project thpyjvwtfvfxiufchrxn. No 2027 project or branch was modified.
- The production frontend was built with the existing production public variables, checked locally, uploaded and tested in a protected preview, then deployed with the production runtime. The existing api/admob-region.js shipped unchanged. Production returns HTTP 200, {region:US}, and private/no-store. The Vercel project retains its existing Vite framework, Node 24, domains and deployment protection.
- Served main-C-h0AwlO.js exactly matches the checked artifact, SHA-256 959403ec7c1682fdfd03c5ea7608672fff88bfe7c072a4a6869251d154ae7481. Homepage, /app, /privacy and /terms returned 200.
- This was a sequential database-first cutover, not a cross-service atomic transaction. Activation was recorded at approximately 10:53:17 PST; the production deployment became READY and received the custom domains at approximately 10:53:28 PST. There was an approximately 11-second database-first interval. Both services now match; no frontend-first rejection interval was introduced. Already-open older clients may require refresh.

## Availability and unchanged setup contract

| Canonical ID | Frontend status | Live PostgreSQL status | Normal account | Authorized experimental account |
| --- | --- | --- | --- | --- |
| micro_sprint | production | production | Allowed, normal class/subscription rules | Allowed |
| quarter_midget | test | test | Denied | Allowed |
| junior_sprint | test | test | Denied | Allowed |
| mini_dwarf | test | test | Denied | Allowed |

Micro Sprint remains under Dirt Track Oval, with one class and schema micro_sprint_v1. SMALL_OVAL_RELEASE_STATUS and onlyfast_small_oval_release_status control availability independently per class. The per-class system was retained.

No setup fields changed. micro_configuration still stores winged or non_winged in each setup snapshot. Non-Winged disables/grays exactly wing_angle while preserving the saved value. Changing back to Winged reactivates it. Save/reopen, copy and race-from-base retain configuration and values. Lightning Sprints and Micro Sprint still share the exact blue/white icon registry object and existing assets; no artwork was duplicated. The production sheet no longer carries the development-only badge.

## Exact migrations created and applied

| Source file | Applied migration name | Live history version |
| --- | --- | --- |
| supabase/migrations/20261119175239_add_small_oval_setup_classes.sql | add_small_oval_setup_classes | 20261119185315 |
| supabase/migrations/20261119182714_release_micro_sprint_production.sql | release_micro_sprint_production | 20261119185317 |

The connector assigns live migration timestamps, so source and applied version numbers differ; names and reviewed SQL identify the mapping above. This repository already had earlier source/live migration version differences. Do not run an unreviewed blanket db push against production.

Preflight checked both connected shared projects. The registration migration was absent from the current production and 2027 testing histories. Its unapplied source was corrected for a release-blocking live-schema mismatch, rather than rewriting any already-applied migration. The separate new forward migration changes only Micro Sprint's status from test to production. Registration still defines all four as test-only before activation.

The live backend still used the experimental-only global library gate and lacked current-main's onboarding-progress columns/RPCs. Compatibility therefore adds the missing progress state/endpoints and wraps the original class-state function, preserving its original rules. It permits only individually production-released small-oval classes through the existing legacy snapshot gate; it never changes onlyfast_can_use_setup_library to true. The setup summary retains the existing race_weekend_id field. Quarter Midget keeps one canonical identity accepted from either oval discipline. The existing live 7-day class-change policy is preserved, rather than silently installing the newer 30-day policy from an unrelated migration.

Unchanged live function-definition hashes were verified for class changes, unlimited-class authorization, setup limits and the older library gate. No subscription/billing/advertising/AI/telemetry function or production environment variable was changed.

## Verification evidence and limits

- Application suite: 579 passed, zero failures. Covers Dwarf, Lightning, other existing dirt classes, subscriptions, ads, Setup Assist, OnlyLaps, Track Trace, timing/telemetry and the shared setup architecture.
- Mounted navigation: 51 passed. Normal non-beta Micro Sprint initialization ends on landing; class selection does not open an editor. Existing explicit New Setup/Open Setup behavior remains covered.
- Additional PostgreSQL suites: 3 passed (historical library, onboarding/class locks and test-tier quota enforcement). The main suite also tests the small-oval lifecycle against both newer onboarding and a reproduction of the live legacy gate plus current quota rules.
- TypeScript application and build-config checks passed.
- Focused ESLint on all changed application/configuration files and both new regression test files passed with zero errors/warnings. Repository-wide npm run lint remains failing: its run reported 1,636 errors and 349 warnings across mature, duplicated and generated local files. Eleven explicit-any issues in the new test fixtures were then corrected; focused checks passed. No broad cleanup, ignore or rule suppression was added. A clean repository-wide lint result is not claimed.
- Production build and release-output verification passed for 82 static files; the existing bundle-size advisory remains. The unchanged regional API is packaged separately in deployment.
- Real browser form checks at 390px and 1440px passed. Micro Sprint used CLOSED_BETA_ACCESS, saved/reloaded/reopened its snapshot, retained 24 degrees in Non-Winged mode and reactivated it in Winged mode. The other three sheets displayed the test-account restriction to the same normal browser context; authorized experimental contexts still rendered them. No overflow, browser exceptions or hosted-account requests occurred in these isolated form checks.
- Live PostgreSQL verification used a fresh ordinary non-beta Pro fixture under the actual authenticated role, plus the existing designated experimental identity. It asserted normal onboarding completion, base save/reopen/copy/rename, race-from-base, wing/configuration retention, RPC and direct-write denial for the three test classes, all-four access for the designated tester, unchanged older-library denial and normal cooldown enforcement.
- All live fixture mutations ran inside BEGIN/ROLLBACK. No fixture account, subscription or setup was retained; no Auth login/logout/reset, email, store transaction or customer-credential use occurred. A real customer's password-login/browser end-to-end session was not performed. The browser normal-user checks and live backend checks are separate evidence layers.
- Post-release counts match preflight: 103 Auth users, 130 setups, 10 subscription rows. Subscription content hash excluding only the additive onboarding columns is unchanged. No new Supabase security advisories were introduced.
- git diff --check passed. Local HTTP/artifact evidence is under ignored tmp/micro-sprint-release; build/test logs are tmp-micro-release-*.log. The reusable live assertions are in docs/MICRO_SPRINT_RELEASE_VERIFY.sql.

## Exact cumulative files changed for this release

This includes the accepted initial implementation still present in the primary checkout, its release-status adjustments and release evidence.

- docs/MICRO_SPRINT_PRODUCTION_RELEASE.md
- docs/MICRO_SPRINT_RELEASE_VERIFY.sql
- docs/SMALL_OVAL_CLASS_EXPANSION.md
- qa/automation/small-oval-layout.mjs
- rc/components/ChassisSetupForm.tsx
- src/components/ClassChangeModal.tsx
- src/lib/classConfigs.ts
- src/lib/classIcons.ts
- src/lib/setupLibrary.ts
- src/lib/setupLibraryAccess.ts
- src/lib/setupLibraryStorage.ts
- src/lib/smallOvalSetupSchemas.ts
- supabase/migrations/20261119175239_add_small_oval_setup_classes.sql
- supabase/migrations/20261119182714_release_micro_sprint_production.sql
- supabase/staging/plan.json
- tests/onboardingNavigation.mjs
- tests/racingOnboardingDatabase.mjs
- tests/setupLibrary.test.ts
- tests/setupLibraryDatabase.mjs
- tests/setupLibraryHarness.ts
- tests/smallOval.test.ts
- tests/smallOvalDatabase.test.ts

## 2027 CARRY-FORWARD

Keep the existing complete carry-forward list and field inventories in SMALL_OVAL_CLASS_EXPANSION.md. Also carry the independent Micro activation forward migration and both release-status entries. Reconcile the destination's onboarding and library gate rather than blindly copying the legacy compatibility wrapper. No 2027 code was implemented or modified here; develop/onlyfast-2027 remains at 448c16104faea37e6213aa69e0c60d1c5d05b9f5.
