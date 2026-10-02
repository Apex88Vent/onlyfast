# OnlyFast manual GitHub deployment

The release is prepared as local commits on `main` in this OnlyFast checkout. The user will perform the push. `origin` is `https://github.com/Apex88Vent/onlyfast.git`.

## Push the prepared commits

Open this checkout in your Git client and push local `main` to `origin/main`. The command-line equivalent, run from this repository, is:

```powershell
git log origin/main..main --oneline
git push origin main
```

If Git reports that the remote branch advanced, reconcile those changes before pushing; do not force-push. The release commit contains the expanded setup library, required Custom Car runtime support, onboarding fixes, regression tests, migrations and verification documentation. Local preview helper files and login screenshots are not part of the release commit.

## Check the production deployment

1. Open the existing Vercel `onlyfast` project and verify the new Git commit deploys to production. Project ID: `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`. The previous production deployment came from Git `main` at `a2ab5bbfb9620bdac0696dedc1bc2d87f7fff3fc`.
2. Confirm the deployment is READY and serves `https://onlyfast.app`. A push alone does not prove that production changed.
3. Confirm the served frontend contains `onlyfast_setup_library_v1`, GT3, Formula Vee, Shifter Kart, Clutch Kart, and the corrected `Select My Discipline` / `Skip to discipline selection` labels. The freshly checked local build is `dist/assets/main-DyRSZjm7.js`; the remote build may produce a different hash depending on its environment. The older production build is `main-m9nQttuU.js`.
4. Verify the deployed frontend still targets Supabase project `thpyjvwtfvfxiufchrxn`.

## Database is already deployed

Do not rerun the migrations as a prerequisite for this push. These were applied in order and their migration-history rows verified:

- `20260929_add_custom_car_class.sql`
- `20260930_add_development_setup_library.sql`
- `20261001_verify_designated_test_account.sql`
- `20261002030004_add_development_kart_classes.sql`

The real designated account accepts all 38 development classes. The kart addition used a new additive migration; its live save/reopen/copy/rename and normal-account denial checks were fully rolled back. Existing rows and active classes were preserved. See [the kart and navigation report](KART_SETUP_NAVIGATION_REPORT.md). Six QA setups persisted, covering all five disciplines; GT3 rename/copy/edit and original preservation passed. Normal-account PostgreSQL/RLS checks blocked the original 36 classes and both additional kart classes. The original nine setups remain unchanged, and active class Pro Stock was restored.

Read-only persistence verification and transaction-rolled-back access checks are documented in [the live deployment report](LIVE_SETUP_LIBRARY_DEPLOYMENT_REPORT.md). Do not rerun the QA creation transaction; the QA rows already exist.

## Remaining live browser checks

- In the designated test account, verify all five disciplines and their classes appear, select a representative class per discipline, and check no `CLASS_INVALID` occurs.
- Open the existing `LIVE QA - ... - 20261001` setups and verify their values. Exercise real browser saving, renaming, copying and editing; backend tests have passed but do not substitute for UI verification.
- Verify selected class after page refresh and app reopen.
- With normal-account fixtures, confirm only the existing production options are available and the other disciplines remain Coming Soon.
- With separate new/unconfigured and configured-returning fixtures, verify onboarding → discipline → class → successful server save → landing, and returning login → landing.

**Before login/logout persistence testing:** `test@test.com` already has enabled `test_account_reset`. Existing application code resets this account's data on fresh login and logout. The agent did not reset data or change the flag. Resolve this conflict with the requested data-preservation requirement before cycling that account's session.

## Validation

- October 1 production build: passed, 1,838 modules; existing bundle-size warning only.
- `git diff --check`: passed.
- Current implementation verification: 290 project tests, 19 mounted React/navigation checks, and actual PostgreSQL tests for all 38 sheets passed. See [onboarding verification](TEST_ACCOUNT_ONBOARDING_REPORT.md) and [setup-library verification](SETUP_LIBRARY_REPORT.md).
- Live backend deployment and role-based access/persistence checks: passed.
- Fresh production frontend deployment and authenticated browser flow: pending the manual push and live verification.
