# Test account still on Team — production audit, November 10, 2026

**Production remains unresolved.** The previously implemented fix has not been deployed and its database migration has not been applied. This follow-up made targeted local corrections and verified the existing implementation against actual disposable PostgreSQL RPCs. It did not deploy, push, apply a hosted migration, or change the real account's data.

## Live evidence

The user confirmed they are testing production `onlyfast.app` or the Median app. Read-only Vercel, HTTP, and Supabase checks established:

| Layer | Observed state |
| --- | --- |
| Production domain | `onlyfast.app` |
| Vercel deployment | `dpl_2XnyhFD5FEQ7dKiMYCKFfBiBsihP`, READY, production |
| Served Git commit | `62c48ffdbd53543a7022fdde2d48423e2d2d7ef9` |
| Fix commit | `33593c5d329a270b548056525da90d9aa3990482`, now present on `origin/main` |
| Deployments for fix commit | None returned by Vercel |
| Served JS at `/` and `/pricing` | `/assets/main-M-nsRRLE.js`; no `get_onlyfast_test_tier`, `set_onlyfast_test_tier`, or current-test-tier selector |
| Backend embedded in served JS | `https://thpyjvwtfvfxiufchrxn.supabase.co` |
| Migration `20261110233145` recorded there | No |
| `beta_tester_accounts.test_subscription_tier` exists | No |
| `public.get_onlyfast_test_tier()` exists | No |
| `public.set_onlyfast_test_tier(text)` exists | No |
| Phase 1 private membership resolver exists | Yes |
| Actual account authorization | Existing test designation, beta master switch, experimental kind, full-access flag all enabled |
| Actual provider row | Pro / trialing / Stripe; left unchanged |
| Actual effective server tier | Team |

The fix being on GitHub does not mean it is deployed. The actual production asset lacks the implementation. This is not a stale-Team diagnosis inferred from tests or a browser cache alone.

Computer Use could not safely identify the current Chrome URL and stopped browser inspection. Production identification is supported by the user's answer and the deployment/served-asset evidence. No attached physical iOS/Android device or authenticated live browser session was exercised.

## Exact point where the tier becomes Team

The active `onlyfast_private.membership_tier(uuid)` still contains the legacy branch:

```sql
when exists (
  -- existing experimental test designation + enabled full-access flag
) then 'team'
```

That branch runs before provider access and has no stored-selection lookup. The served commit also contains `if (isCurrentUserTestAccount()) return 'team'` in `getEffectiveTier`, the unconditional feature bypass in `hasFeatureAccess`, and the unconditional Teams result in `deriveAccountStatus`.

The resulting production trace is:

1. Auth identifies the existing `test@test.com` user ID.
2. Server-owned account/flag rows authorize the tester correctly.
3. The old plan interface saves a Rookie preference or uses the ordinary paid-plan flow; the new authorized setter is absent from the served application.
4. The active database has neither a test-tier storage column nor read/write RPCs. An authenticated caller therefore has no installed operation capable of persisting the requested test tier.
5. The legacy SQL branch resolves the authorized tester to Team.
6. The old frontend independently resolves that tester to Team and enables all features.
7. Dashboard, Settings, and account-menu labels consequently remain Team.
8. Refresh, navigation, new tabs, or logout/login reload the same old code and database rule. They cannot restore a selection that was never persisted.

The active beta-row trigger only updates `updated_at`. No trigger resetting a saved tier was found; the tier column does not yet exist. Browser clients currently have SELECT only on the authorization table, as intended. The missing secure RPC, not a need to loosen table policies, is the persistence blocker.

The current source's migration already has correct precedence: an explicitly selected `rookie`, `pro`, or `team` wins; its Team fallback applies only when an authorized tester has not selected anything. Historical copies under `supabase/src` also contain old overrides, but the Vite root, HTML entry, and `@` alias build the root `src` tree. They were not rewritten as another implementation.

## Targeted corrections in this follow-up

- `src/components/TestSubscriptionGate.tsx`: removed its duplicate React tier value. The selector now subscribes to the shared trusted membership and reads its authoritative tier, including after a lifecycle refresh caused by another tab. A previously recognized tester with unavailable membership sees a retry/error state, never normal checkout as an accidental fallback.
- `src/lib/subscription.ts`: missing-function/column/schema responses produce a clear server-update-required error. An incompatible backend cannot retain a cached test-tier grant as if it had just been confirmed. Normal provider entitlement precedence is unchanged.
- `src/lib/testSubscription.ts`: checks the RPC's response, reads the server tier back through the existing synchronization path, and returns that confirmed tier. Missing setup and authorization failures produce useful errors. Failed writes or mismatched readback cannot signal success.
- `tests/testSubscription.test.ts`: regression coverage for explicit missing setup, stale Team invalidation, failed saves, unconfirmed HTTP success, and existing switch/readback races.
- `tests/testSubscriptionDatabase.mjs` and new `tests/testSubscriptionDatabaseUI.mjs`: actual application selector/client/resolver, dashboard Header, and Settings run against the real migrated PostgreSQL functions and protected records in disposable PGlite. Only Auth/HTTP transport and unrelated widgets are substituted; the final tier is not mocked.
- `docs/TEST_SUBSCRIPTION_SWITCHING.md`: added a prominent production-status correction.
- `docs/TEST_SUBSCRIPTION_LIVE_AUDIT.md`: this audit and rollout handoff.

No new subscription store, alternate entitlement system, or additional SQL migration was introduced. The existing test-tier migration remains unchanged. Pre-existing uncommitted store-navigation changes were preserved and are not part of the file list above.

## Regression evidence and limits

`npm run qa:regression` passed **671 checks: 559 unit, 89 mounted, 23 database; zero failures/skips**. TypeScript (`npx tsc -p tsconfig.app.json --noEmit`), focused ESLint on the selector and tier mutation client, the Vite production build, and whitespace checks passed. The build retains its existing bundle-size advisory.

The database-backed UI test begins with a tester receiving legacy Team access, then performs **Team → Rookie → Team → Pro → Rookie → Pro** through the actual selection handler and SQL setter. After each change it reads the stored column and real entitlement resolver, checks the mounted dashboard/account badge and Settings, ad eligibility, an empty-cache remount, and simulated logout/login. It also writes Rookie as a different tab would, refreshes through the existing membership synchronizer, and verifies the still-mounted selector changes to Rookie.

The surrounding PostgreSQL test verifies Rookie quotas, Pro's single-class restriction, Team's unlimited classes, rejected normal-user mutations, immutable billing/setup snapshots, and genuine RevenueCat entitlement preservation. Existing mounted Median tests cover purchase/restore/hold behavior and test-tier bypasses.

Auth sessions and HTTP transport are simulated locally; SQL roles/functions/triggers and client/UI resolution are real. **No live authenticated test-tier save/readback, live logout/login, or physical Median acceptance is claimed. The production database cannot persist the selected tier until the existing migration is applied.**

## Required database change

Use the already-reviewed file:

`supabase/migrations/20261110233145_restore_test_subscription_switching.sql`

It adds the constrained nullable tester-tier column, installs own-account get/set wrappers and private authorized operations, and replaces the shared membership/class resolvers with selection-first precedence. The installed Phase 1 schema is a prerequisite; the file checks for it. It changes no pricing, provider snapshots, real subscriptions, saved setups, account designations, or RevenueCat configuration. An untouched authorized tester still defaults to Team until explicitly selecting a tier.

## Exact sequence to make production switching available

1. Complete the isolated/staging acceptance described in the original report using the same migration and frontend, including a normal account. Review the release diff and preserve the existing production advertising and purchasing holds. The repository contains other changes; do not treat a broad push/deploy as a test-only patch.
2. In the **identified production Supabase project `thpyjvwtfvfxiufchrxn`**, apply only the existing `20261110233145` migration through the controlled migration workflow, recording that version. Do not bulk-apply other historical or pending files. Recheck the new column, both public RPC signatures, their grants, and the selection-first private resolver. A failed migration must stop the rollout.
3. Deploy the reviewed compatible frontend containing the prior fix and these targeted corrections. Vercel currently serves `62c48ffd`; merely rebuilding that old deployment will not include the fix. Keep current billing/ad environment gates unchanged. Verify the deployment's commit and production alias and verify the served JS contains both test-tier RPC names and the test selector. The safe order is **database first, compatible frontend second**; frontend first cannot persist selections against today's schema.
4. Sign into the real `test@test.com` account. Open Settings → View Plans (or the existing account-menu upgrade entry when shown). Choose Rookie. Require a successful authorized setter response followed by getter readback of `rookie`, `get_onlyfast_membership().tier = rookie`, Rookie in the dashboard/account badge, and the free Rookie status in Settings. Do not edit the real provider row to achieve this.
5. Run Team → Rookie → Team and Team → Pro → Rookie. Confirm the stored tier, feature/class/ad eligibility, navigation, refresh, sign-out/in, and a second browser tab. Confirm the legacy provider record and saved setups remain unchanged. Verify a normal account's direct setter request is rejected.
6. Repeat the same acceptance in the stock Median iOS and Android wrappers loading the updated production site. Require no checkout for tester switches; keep purchase/ad holds and normal-user store handling intact. If a wrapper still serves an old asset, verify its loaded site/build before changing server entitlements.
7. Only then mark the production issue resolved. Until those steps occur, the accurate status is **local repair verified; required production migration and deployment outstanding**.
