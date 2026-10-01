# Test account and onboarding verification — October 1, 2026

**Later live deployment update:** the three required production database migrations have now been applied and real-account backend checks passed. The production frontend deployment and authenticated browser checks remain pending. See [the live deployment report](LIVE_SETUP_LIBRARY_DEPLOYMENT_REPORT.md) for current results; this report preserves the earlier local verification record below.

The onboarding fixes are implemented and verified locally. **Live development-class activation remains pending:** the previous live selection returned `CLASS_INVALID` (shown as “That class is not available”), consistent with the undeployed development-library database migration. During this pass both available preview tabs were signed out, and no authenticated Supabase admin session or database connection was available. No live account/profile/setup data was reset or changed. The real account's current database flags and live create/save/reopen path cannot honestly be marked verified until that access is provided.

## 1. Why the test account could not select new classes

The browser's expanded class registry and the live database's canonical class allowlist were out of sync. The frontend offered expanded classes in the earlier signed-in preview, but `change_active_race_class` rejected Legends as `CLASS_INVALID`. The existing backend RPCs call `onlyfast_canonical_race_class`; the `20260930_add_development_setup_library.sql` migration updates that allowlist and adds the server-side development gate. Changing only frontend visibility cannot fix this.

There is a second possible deployment issue: the original beta migration assigns the designation to auth users present when it runs. If `test@test.com` was created or recreated afterward, it needs the same user-ID-backed designation. This possibility was reproduced and repaired in an isolated database, but is not confirmed as the current live account's state.

## 2. Exact gating mechanism

At runtime, authorization is based on the authenticated Supabase user ID, not an email comparison:

- `beta_tester_accounts.user_id` matches the signed-in user ID.
- `is_test_account = true`.
- `beta_features_enabled = true`.
- `tester_kind = 'experimental'`.
- The same user's `user_feature_flags` includes enabled `test_account_full_access`.

`BetaFeaturesProvider` reads these rows under the existing RLS rules. `canAccessSetupLibrary` uses that snapshot for discipline/class visibility; existing test-account helpers use its fail-closed synchronous cache. `onlyfast_can_use_setup_library` enforces the equivalent conditions in PostgreSQL. Rookie/Pro/Team tier, administrator status, a DEV environment, editable profile metadata, or the email address alone does not grant development access.

The email is used only by the administrative migration to resolve `test@test.com` to its actual Auth user ID. The new repair migration modifies only that account's existing tester designation and `test_account_full_access` flag. It does not designate other accounts, enable reset, or enable unrelated beta flags. As with the existing authorization architecture, an administrator can deliberately assign the same experimental designation/flag to another account; no such assignment is introduced by this change.

## 3. Changes made

- Signed-in class hydration now waits for the authenticated account's state. It never initializes a new account from the device-wide `onlyfast_car` cache.
- Real auth identity transitions clear previous class/entry state; same-user token refreshes preserve the mounted landing screen.
- Existing classes recover from the account's active class or its own saved setup history. On network failure, an account-specific class cache can recover an existing selection. A successful empty server state overrides cached selections.
- Membership data no longer acts as an onboarding-completion signal. Logging in from introductory guidance rechecks the actual account state.
- First-run Finish and Skip mark the existing onboarding-completion signal and lead to discipline selection. Replay Close/Finish retains the configured user's normal landing destination.
- Authenticated class selection enters the application only after the existing initialization RPC succeeds. A rejected development class stays on Select Class with an error, rather than pretending it was saved.
- Class selection waits for the beta authorization lookup so it does not initially display unauthorized/incorrect class availability.
- Changed misleading “Pick My Plan” and “Skip to plans” labels to “Select My Discipline” and “Skip to discipline selection.” Replay's final action is “Finish.” No membership/pricing behavior changed.
- The existing protected onboarding preview now displays the actual discipline/class components after Finish/Skip, rather than a placeholder claiming membership selection would follow. Its class selection remains a preview and never writes account data.
- Added `20261001_verify_designated_test_account.sql` for safe, idempotent reassignment of the designated account after the development-library migration. It fails if the Auth user does not exist and never modifies onboarding/profile/setup data.

## 4–5. Skip and Close history

Compared against repository HEAD `a2ab5bbf`. The setup expansion did **not** remove Skip or introduce Close/X. `HowOnlyFastWorks.tsx` was unchanged by that expansion.

- First-time guidance intentionally hides Skip for the first five slides. Skip appears on slide 6 through slide 11; the final slide offers completion.
- Both first-time Skip controls exit the remaining introduction through the same completion callback. They do not merely skip one slide.
- Replay intentionally shows Close with an X on every slide. It exits help without writing onboarding completion data.
- The authentication dialog's close action dismisses login; it does not complete onboarding.
- The obsolete plan labels existed before this expansion and were corrected in this pass.

The observed Close-to-landing behavior is appropriate when replaying help from a configured account. It must not substitute for first-time Skip; the actual first-time/replay distinction remains in place.

## 6. Route before the fix

These are component entry states at `/`, rather than separate React Router URLs:

1. Splash → introductory guidance if neither cached class, membership data, login escape nor completion signal suppressed it.
2. Guidance Finish/Skip → completion callback → discipline selector only if `isOnboarded` was false; otherwise landing.
3. Global `onlyfast_car` immediately set `isOnboarded = true`, even if it came from a guest or another account.
4. After login, a missing server active class could be initialized from that stale global selection.
5. Class selection called the initialization RPC, but its catch branch still applied the chosen class locally on failure.
6. Replay Close → landing. Protected `/onboarding-preview` Finish/Skip → a completion placeholder with outdated membership instructions.

With clean state, first-run completion already reached discipline selection. The bug was that cached/identity/membership state could bypass that route. These weaknesses predated the setup expansion.

## 7–8. Route after the fix

New signed-in user: **auth/profile state checked → introduction → Finish or eligible Skip → Select Your Discipline → Select Your Car → successful class initialization → normal landing/application**.

Actual disciplines are **Dirt Track Oval, Pavement Oval, Road Course, Motorcycle, RC**. Open-wheel classes belong to Road Course, as defined by the existing expansion; no new discipline/category was added here.

Completed but unconfigured user: auth/profile state checked → Select Your Discipline → Select Your Car → successful initialization → landing.

Configured returning user: auth/profile state checked → normal landing, with no forced introduction or class selection.

Help replay: Close or final Finish → existing configured landing. Login modal Close → current introduction. Guest class selection retains the existing local guest behavior; signed-in accounts never inherit that guest cache.

**Confirmed in mounted React tests and browser fixtures:** first-run Finish and Skip end at Select Your Discipline, not landing. Normal returning users still enter landing. No routing delays or arbitrary timers were added.

## 9–10. Production isolation and designated-account verification

Normal users retain the original discipline cards: Dirt Track Oval is enterable, the other four retain Coming Soon. The seven existing production-enabled class choices remain unchanged. None of the 36 new development class buttons appear for normal accounts. The original disabled production class cards remain as before.

The flagged `test@test.com` fixture sees all five enterable disciplines, the appropriate category-specific development classes, and all 47 choices in the class-change modal. It selects GT3 from Road Course. An unflagged fixture with that same email remains on production permissions.

In actual PostgreSQL using the real migrations and application setup serializers, a designated `test@test.com` created after the old beta migration initially had no library access. After the repair migration, all 36 development classes can be selected/changed repeatedly, saved, reopened, copied, edited and renamed. Normal Rookie/Pro/Team/admin accounts and a personal beta tester cannot select/save/read development sheets. Normal-user cooldown remains; the existing experimental-account unlimited-class bypass works. Existing legacy rows and Auth/onboarding metadata remain byte-for-byte unchanged by the migrations.

**This verifies the code and database behavior with isolated data. It does not substitute for live verification of the real account.** Live confirmation of `test@test.com` seeing/selecting/saving/reopening the new sheets is still pending the database deployment and an authenticated session.

## Test cases

| Case | Result and evidence |
| --- | --- |
| A — normal existing user | Mounted React: active Dwarf Cars goes directly to landing; replay Close returns there; no onboarding/class write. |
| B — new normal user | Mounted React: stale GT3 and paid membership caches do not bypass introduction; Skip reaches selector; only production choices are enterable. |
| C — designated test account | Mounted React: flagged test email sees all disciplines, selects GT3, and gets all 47 class-change options. PostgreSQL: all 36 sheets save/reopen and test class changes bypass cooldown. Real account pending. |
| D — Finish | Mounted React traverses every Continue; final Select My Discipline opens discipline selection. Browser fixture confirms the same. |
| E — Skip | Hidden through first five slides; visible on slide 6. Both controls share the completion callback. Mounted React/browser confirm discipline destination. |
| F — Close/X | Existing replay control preserved. Mounted React verifies returning-user landing, unchanged metadata, and login dismissal without onboarding completion. |

Additional checks cover user switching, late stale async results, same-user token refresh preserving the mounted screen, account-specific offline fallback, failed class initialization, missing beta flags, and read-only preview behavior.

## 11. Exact files changed in this verification pass

Previously modified setup-library and Custom Car work was preserved. This pass changes/adds only:

1. `src/components/AppLayout.tsx` — auth/profile entry guard, class recovery, first-run destination, selection error.
2. `src/components/OnboardingFlow.tsx` — existing selector error display and accurate gate comment.
3. `src/components/HowOnlyFastWorks.tsx` — destination labels and replay Finish label.
4. `src/pages/OnboardingPreview.tsx` — actual read-only discipline/class continuation.
5. `supabase/migrations/20261001_verify_designated_test_account.sql` — targeted account designation repair.
6. `tests/medianPickerLifecycle.test.ts` — update existing dependency assertion for ID-keyed hydration; selectedCar no longer restarts hydration.
7. `tests/onboardingNavigation.mjs` — 12 mounted React integration tests of real entry, intro, selector, preview and class-change components, with mocked backend and unrelated child screens.
8. `tests/setupLibraryDatabase.mjs` — actual PostgreSQL regression reproducing late/recreated designated account; verifies repair scope and no metadata changes.
9. `docs/TEST_ACCOUNT_ONBOARDING_REPORT.md` — this report.
10. `docs/onboarding-discipline-qa.jpg` — browser evidence from an isolated flagged-account fixture, not the live account.

Temporary browser fixture HTML/TSX files were removed after verification. No production preview/bypass route was added.

## 12. Build and checks

- `npm run build`: passed (existing bundle-size warning only).
- Existing Node TypeScript suite: **287/287 passed**.
- Mounted React integration suite: **12/12 passed**.
- Actual PostgreSQL integration: passed for **all 36** development sheets and designation repair, RLS isolation, original cooldown/test bypass, idempotency and untouched legacy/Auth data.
- ESLint on the four changed UI components/pages: passed.
- TypeScript with `--lib ES2021,DOM,DOM.Iterable`: passed. Default project lib still has the pre-existing unrelated `HandlingFeedback.tsx` use of `replaceAll` under ES2020; this pass does not change it.
- `git diff --check`: passed.

No subscription pricing/production entitlements, ads, timing scan, Setup Assist, OnlyLaps, schedule, telemetry, auth provider or saved setup serialization logic was changed. The existing separately flagged disposable-account reset behavior was not modified or invoked to simulate onboarding, and the repair migration does not enable its reset flag.

## Remaining live deployment

Use an authenticated Supabase SQL/database session for the project configured by `src/lib/supabase.ts` (fallback project `thpyjvwtfvfxiufchrxn`). Verify the existing active-class and beta migrations are present; apply the Custom Car migration if it is still missing. Then apply, in order:

1. `supabase/migrations/20260930_add_development_setup_library.sql`
2. `supabase/migrations/20261001_verify_designated_test_account.sql`

Both are tested transactionally and idempotently. The development migration adds the server class allowlist and restrictive policies; the new repair migration targets only the designated test account's existing authorization mechanism. No frontend email bypass or global permission change should be used instead.

After deployment, use the existing signed-in test session to verify selection via the normal onboarding/class-change controls and create/reopen a clearly named development QA setup. Do not erase profile/onboarding/setup data to force the flow. No live deployment or real-account save has been performed in this pass because the required authenticated sessions are unavailable.

Reproduce the additional isolated suites with external QA packages (no repository dependency changes):

```powershell
$qaRoot = Join-Path $env:TEMP 'onlyfast-setup-library-qa'
npm install --prefix $qaRoot --no-save --package-lock=false @electric-sql/pglite react@18.3.1 react-test-renderer@18.3.1
$env:PGLITE_MODULE = Join-Path $qaRoot 'node_modules/@electric-sql/pglite/dist/index.js'
$env:REACT_TEST_RENDERER_MODULE = Join-Path $qaRoot 'node_modules/react-test-renderer/index.js'
node --experimental-strip-types --test tests/onboardingNavigation.mjs tests/setupLibraryDatabase.mjs
```
