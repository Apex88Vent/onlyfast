# Test subscription switching — local fix, awaiting staging/device acceptance

Implemented November 10, 2026. No commit, push, deployment, hosted migration, purchase, or production data write was performed for this task.

## Cause

The live, read-only investigation confirmed that `test@test.com` still has its explicit experimental tester designation, enabled beta master switch, and enabled `test_account_full_access` flag. The other existing explicitly authorized tester also retains those grants. Missing account authorization was not the cause.

The application and database instead forced those accounts to Team, regardless of a selected plan. The October 15 membership hardening (`f16dff52`) stopped trusting membership values in browser storage and user-editable metadata. The older plan screen wrote its selection through `saveMembership`; that storage no longer authorizes access. The replacement paid-plan actions use provider billing/paid-account guards, while Rookie selection saves only a preference. There was no server-owned test-tier setter to replace the old selection mechanism. Restoring editable metadata as an authority would reintroduce a security problem.

## Result and boundaries

- The existing plan screen shows authorized testers **Rookie, Pro, Team**, the current test tier, and no-payment selections. Switches remain on the screen so repeated changes are easy; Continue returns to the app/completes onboarding.
- The choice is stored in `beta_tester_accounts.test_subscription_tier`, outside `user_subscriptions`. A null choice retains the legacy Team access until that authorized tester chooses a tier.
- Every server read and write requires the existing UUID-backed designation, beta master switch, experimental tester kind, and full-access flag. No email/domain, browser flag, or editable profile value grants access. No account designations are added or removed.
- Own-account RPCs accept a tier only. The setter validates all three values and has no cooldown. Browser roles cannot update the underlying authorization table. Privileged functions reside in the private schema, use an empty search path, and have explicit execution grants.
- Frontend membership, account labels, ad eligibility, database class restrictions, setup limits, and server usage authorization resolve the selected test tier. Rookie keeps the original restrictions and ad eligibility, Pro keeps one class and no ads, and Team keeps unlimited classes and no ads. Existing development-feature permissions remain separate.
- Existing billing records remain separate and unchanged when selecting test tiers. Test selection never invokes Stripe, RevenueCat, Median checkout, purchases, or restore. Legitimate provider synchronization still works independently; revoking test authorization returns the account to its real entitlement.
- Settings and account-menu upgrade entry points remain. Normal accounts retain the existing web/provider and stock Median interfaces. Existing purchase and advertising holds remain; Rookie eligibility does not enable production ad serving.
- No pricing, tier definitions/limits, saved setups, historical native bridge sources, or RevenueCat configuration were changed.

## Validation completed

| Check | Result |
| --- | --- |
| Application tests (`npm test`) | 555 passed |
| Mounted navigation, Settings, and Median controls | 71 passed |
| Disposable PostgreSQL database suite (`npm run qa:database`) | 23 passed |
| App TypeScript (`npx tsc -p tsconfig.app.json --noEmit`) | Passed |
| Focused ESLint on new UI/client and changed resolver/native hook | Passed, no warnings |
| Production build and `npm run release:check` | Passed; existing large-bundle advisory remains |

The new mounted tests exercise Rookie → Pro → Team → Rookie, repeated switches, remount/refresh, cleared login state and relogin, feature/ads/class limits, account-switch races, and stale reads. Median tests cover all tiers in the normal and onboarding control variants with purchases mocked enabled: no offerings, store calls, or RevenueCat synchronization occur for test overrides. Existing normal-user tests still exercise the stock purchase/restore flows and purchase holds.

The new PostgreSQL test uses real roles, RPCs, triggers, and permissions in disposable PGlite. It verifies persisted tier reads in fresh authenticated sessions, existing usage quotas and class gating, unchanged billing/setup snapshots, rejection of anonymous and normal users, ignored email/metadata forgery, authorization revocation, and preservation of genuine RevenueCat access. The staging rebuild test also refuses this migration before its Phase 1 prerequisite.

These are automated component and isolated database checks. Real hosted Auth logout/login, a live staging browser session, and physical iOS/Android Median acceptance have **not** been performed. No real ads or store purchases were requested.

## Preview and acceptance before deployment

1. Use an isolated/staging database that already contains the reviewed Phase 1 membership authorization schema. Apply **only** `supabase/migrations/20261110233145_restore_test_subscription_switching.sql` there after reviewing it. Do not bulk-push the repository's historical/pending migrations. Its prerequisite check rejects older schemas.
2. Use disposable staging Auth users: one with the existing explicit tester grants, another without them. Do not copy production billing records. The real `test@test.com` authorization is already confirmed; no production designation repair is needed.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to that staging backend before starting `npm run dev`. The repository otherwise falls back to production. Open the Vite URL printed in the terminal, then `/pricing`.
4. Sign in as the staging tester. Through Settings → View Plans, verify all three test buttons and Current test tier. Choose Rookie → Pro → Team → Rookie, repeat quickly, refresh after each choice, and sign out/in. Verify account labels, export/paid feature access, Rookie quotas, Pro's class restriction, Team's multiple classes, and Rookie house-ad eligibility. Confirm stored setups remain available under the existing class rules.
5. Repeat with an approved staging Median iOS and Android wrapper loading the same staging frontend. Use the existing stock Median integration. Verify no paywall opens for test selections; verify Rookie eligibility and paid-tier ad suppression while leaving ad rollout/consent/device holds intact. Actual ad serving remains subject to those existing holds.
6. Sign in as the normal staging user. Confirm the existing plan/upgrade UI and purchase hold behavior. Where a separately approved sandbox configuration permits purchases, verify normal stock paywall routing. An authenticated call to `set_onlyfast_test_tier` must return `TEST_ACCOUNT_REQUIRED`; forged profile metadata and a matching email/domain must not change that result.
7. Compare staging billing rows before/after test switches: only the tester's new tier field and existing beta-row update timestamp should change. Confirm the selected tier in `get_onlyfast_test_tier`, `get_onlyfast_membership`, and `get_active_race_class_state` where that onboarding RPC is deployed.

The compatible frontend requires the new own-account RPC. Review and coordinate the database/frontend rollout after acceptance; shipping the frontend alone against an older backend will show a retryable membership error. Production deployment has not been initiated.

## Files changed for this task

Application:

- `src/components/Header.tsx`
- `src/components/NativeSubscriptionControls.tsx`
- `src/components/PlanSelection.tsx`
- `src/components/TestSubscriptionGate.tsx` (new)
- `src/hooks/useNativeSubscription.ts`
- `src/lib/membership.ts`
- `src/lib/nativePurchases.ts`
- `src/lib/subscription.ts`
- `src/lib/testSubscription.ts` (new)
- `src/lib/trustedMembership.ts`

Database and QA:

- `supabase/migrations/20261110233145_restore_test_subscription_switching.sql` (new, unapplied to hosted databases)
- `supabase/staging/plan.json` (explicit review-only migration exclusion)
- `qa/automation/coverage.mjs`
- `tests/membershipSelection.test.ts`
- `tests/nativeSubscriptionControls.mjs`
- `tests/onboardingNavigation.mjs`
- `tests/stagingDatabase.mjs`
- `tests/testSubscription.test.ts` (new)
- `tests/testSubscriptionDatabase.mjs` (new)
- `docs/TEST_SUBSCRIPTION_SWITCHING.md` (this report)

The checkout also contains pre-existing/concurrent advertising edits. This task did not author, discard, commit, or deploy those changes.
