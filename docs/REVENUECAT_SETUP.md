# OnlyFast native subscriptions: implementation and rollout

Status: implemented locally, **not deployed or store-tested**. Native purchasing
is disabled until `VITE_REVENUECAT_ENABLED=true`. The app still needs configured
store products, RevenueCat, a rebuilt Median app, and sandbox acceptance tests.
The pre-change architecture and file inventory are in `REVENUECAT_AUDIT.md`.

## What changed

Web Rookie users still buy through the original Stripe Buy Buttons; Stripe Pro
and Team subscribers keep their existing database-backed access and portal.
Native users use Median's RevenueCat paywall, with both paid plans and store-local
prices. Web dollar prices and the web trial badge are hidden in native plan cards.
The same Supabase user UUID identifies purchases across devices.

Native purchase/restore requests are serialized with login/logout, and account
changes invalidate in-flight purchase results. SDK identity is verified/rebound
on app startup and before purchases. Missing/old bridges and missing public keys
fail closed with an actionable message. A timed-out native command requires an
app restart because native commands cannot safely be aborted from JavaScript.

Store success never grants access directly. The app calls an authenticated Edge
Function, which fetches RevenueCat subscriber state with a server-only key. The
existing membership bridge continues reading the same `plan/status` fields.
Subscription metadata writes are bound to the captured account JWT, and auth
changes invalidate delayed local-cache writes.

## Database migrations

Apply in order, after the repository's existing migrations:

1. `supabase/migrations/202609240001_revenuecat_subscription_sync.sql`
   - Adds `stripe_plan`, `stripe_status`, `revenuecat_plan`, `revenuecat_status`,
     `revenuecat_observed_at` to `user_subscriptions`.
   - Retains all existing Stripe identifiers, RevenueCat metadata, and class fields.
   - Backfills Stripe snapshots from existing rows without changing their access.
   - Adds `revenuecat_webhook_events` (event ID + user UUID primary key, type,
     event time, processing time), with RLS and no client access.
   - Adds a projection trigger plus service-only `onlyfast_apply_revenuecat` and
     `onlyfast_expire_revenuecat` functions. Event recording and updating access
     share one transaction and row lock; failed writes roll back event IDs.
   - Revokes direct client subscription writes; existing class-selection definer
     functions remain the mechanism for changing class fields.
2. `supabase/migrations/202609240002_schedule_revenuecat_expiration.sql`
   - Enables Supabase `pg_cron` and schedules expiry checks every minute.
     A late/missing store webhook cannot indefinitely preserve expired access.

The initial table is defined in root `SUBSCRIPTIONS_RLS.sql`, not the migration
history. For a fresh staging database, establish that baseline before migrations.
For an existing project, inspect migration history and live table grants/policies
first; do not blindly replay root SQL or reset a production database. These
migrations were tested locally, not against your deployed database. Confirm the
`onlyfast-expire-revenuecat` job succeeds in Supabase Cron after deployment.

### Provider precedence

| State | Effective result |
| --- | --- |
| Active/trialing Stripe Pro or Team | Stripe plan retained regardless of native state |
| Inactive Stripe and active native entitlement | Native Pro/Team |
| Native Team and Pro entitlements both active | Team |
| Neither provider active | Rookie (`free` in the table) |

Snapshot freshness uses RevenueCat's response timestamp; stale/equal snapshots
cannot replace a newer snapshot. Provider projection runs for existing Stripe
upserts as well, so Stripe cancellation does not erase active native access.
Cancellation preserves native access through the paid period. Billing issues
preserve access through any valid grace period. Renewal, product change,
uncancellation, expiration, refunds/revocation and refund reversal are reconciled
from current RevenueCat state rather than interpreted as untrusted client flags.
Transfers reconcile both accounts; omitted transfer environment fields are allowed
because the fetched snapshot still filters store and sandbox eligibility.

Do not deliberately sell simultaneous Stripe and native subscriptions to one
account: active Stripe takes precedence even if the native plan is higher. The
native UI recognizes existing paid users and avoids prompting another purchase.
Paid native users manage upgrades/downgrades in their store subscription settings;
this implementation does not add a custom cross-product replacement API.

## Edge Functions and secrets

New functions:

- `revenuecat-webhook`: POST only; gateway JWT verification off; requires an exact
  match to the configured webhook Authorization header. Missing/wrong auth is
  rejected before any database or RevenueCat call. Unknown/anonymous-only identity
  fails visibly for investigation. Multiple distinct UUID aliases fail instead of
  granting one receipt to several OnlyFast accounts. No raw receipts are logged.
- `sync-revenuecat-subscription`: validates the bearer token using `auth.getUser`;
  ignores client-supplied user IDs, plans and subscription state; fetches only the
  authenticated user's RevenueCat record. Used after purchases/restores and on
  native sign-in/resume. Gateway JWT verification is off because authentication is
  performed in the handler, supporting current Supabase key configurations.

Modified `stripe-webhook`: now checks database write errors and returns failure
so Stripe can retry. Its checkout/price/customer mapping is otherwise preserved.
The Stripe portal function is unchanged.

Set these **Supabase Edge Function secrets**, never `VITE_` variables:

| Name | Value |
| --- | --- |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat secret API key usable with REST v1 `GET /subscribers/{UUID}` |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | A long random value including the prefix, e.g. `Bearer <random-secret>`; copy exactly into RevenueCat's webhook configuration |
| `REVENUECAT_APP_IDS` | Comma-separated RevenueCat iOS/Android app IDs, not bundle/package identifiers |
| `REVENUECAT_PRO_ENTITLEMENT_ID` | `pro` by default |
| `REVENUECAT_TEAM_ENTITLEMENT_ID` | `team` by default; must differ from Pro |
| `REVENUECAT_ALLOW_SANDBOX` | `true` in isolated staging for TestFlight/Play testing; default false in production |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase's runtime.
Retain all existing Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
price IDs, `PROJECT_URL`, and the portal's existing `SERVICE_ROLE_KEY/SITE_URL`).

Set these **frontend build variables** after configuration and testing:

```dotenv
VITE_REVENUECAT_ENABLED=true
VITE_REVENUECAT_IOS_API_KEY=appl_<public_sdk_key>
VITE_REVENUECAT_ANDROID_API_KEY=goog_<public_sdk_key>
```

Only platform-specific public SDK keys belong here. Normal browser users still
use Stripe with these set. Do not set `VITE_HIDE_EXTERNAL_PAYMENTS=true` on the
shared web build unless you intentionally want Stripe hidden everywhere. Existing
`?nativeApp=true` persists native mode, and Median/GoNative user-agent detection is
an additional guard. `nativeApp=false` cannot override a real Median user agent.

Deploy after applying migrations and secrets, using your selected project:

```text
supabase functions deploy revenuecat-webhook
supabase functions deploy sync-revenuecat-subscription
supabase functions deploy stripe-webhook
```

No remote deployment or configuration was performed in this task.

## RevenueCat dashboard

1. Use one OnlyFast RevenueCat project, with iOS and Android apps matching the
   existing Median bundle/package identifiers. Connect the store credentials.
2. Create entitlements `pro` and `team`. Attach each platform's Pro subscription
   to `pro` and Team subscription to `team`. The backend maps those to existing
   table values `pro` and `teams`; Rookie requires no paid product.
3. Import the real store products. Example product names are
   `onlyfast_pro_monthly` and `onlyfast_team_monthly`; these are **suggestions**, not
   hardcoded requirements. Existing product IDs can be used. The backend maps by
   entitlement, and the Median paywall determines which product/package to buy.
4. Create a **current/default offering** containing both paid plans and publish a
   native paywall for it. Use custom package identifiers if both are monthly.
   Display store-local price, billing interval, recurring terms, benefits, privacy,
   terms, and any actually configured/eligible trial. Match OnlyFast styling.
   `presentPaywall()` presents this offering; an unpublished/empty offering is not
   a completed integration.
5. Set restore behavior deliberately. For subscriptions bound to an OnlyFast
   account, select **Keep with original App User ID** and provide account recovery
   support. The store owner must sign into the purchasing OnlyFast account.
   RevenueCat notes that this setting also affects new purchases using an existing
   store receipt; test the second-account case. Avoid legacy sharing/UUID aliases.
   Transfers are handled if support changes ownership intentionally.
6. Add a webhook URL:
   `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`.
   Set its Authorization value exactly as the secret above. Select the intended
   apps and all subscription lifecycle events, including transfers. Use separate
   staging/production integrations and the appropriate environment filters.
7. Send a TEST event, then real sandbox lifecycle events. Inspect event delivery
   failures; fix and retry them. TEST verifies connectivity/auth only, not mapping.

Only Apple/Google recurring subscriptions are accepted. Promotional/lifetime/web
RevenueCat products are not part of this integration; web billing stays on Stripe.

## Median dashboard and build

1. Enable/license the **RevenueCat native plugin** for the existing application.
   Rebuild both platforms; a website deployment cannot add a native plugin to an
   already installed binary.
2. Use a current plugin/JavaScript bridge with `configure`, `isInitialized`,
   `login`, `logout`, `getOfferings`, `presentPaywall`, `restorePurchases`.
   These names/signatures were verified in Median's official source and demo.
3. Keep JavaScript bridge injection enabled (this code uses injected `window.median`
   or legacy `window.gonative`, not an npm native SDK). Allow bridge access on the
   OnlyFast origin and upgrade/settings routes. Do not replace this with a web
   RevenueCat SDK.
4. Keep `nativeApp=true` on the initial app URL and the documented Median user-agent
   suffix. Confirm both iOS and Android platform detection on the actual binaries.
5. Verify the official Median RevenueCat demo in a test build if any method is
   missing. An old bridge shows an update-required message; no Stripe fallback is
   provided in native mode.

## App Store Connect

Use the existing app/bundle ID. Complete paid-app agreements, tax and banking;
create auto-renewing Pro/Team subscriptions in the appropriate subscription group
with Team above Pro; set duration, localized names, prices, territories and review
metadata/screenshots. Configure any introductory offer explicitly. Connect the
required Apple purchase credentials and notifications to RevenueCat. Test using
TestFlight/sandbox accounts, attach subscriptions to the app submission as required,
and give App Review a working login and clear purchase/restore instructions.
The native app exposes no Stripe checkout or website purchase links.

## Google Play Console

Use the existing package. Create Pro/Team subscription products and active base
plans, set prices/regions and offers, and import them into RevenueCat. Connect the
required service-account/Play Developer API credentials and real-time developer
notifications. Upload the rebuilt signed AAB to an internal test track; add license
testers and test through a Play-installed build. Verify product changes in store
management; custom replacement/proration controls are not added to the bridge.

## Restore and existing subscribers

Restore Purchases appears only in native upgrade/settings controls, with the
feature enabled. A user tap binds RevenueCat to the Supabase UUID and invokes the
real Median restore method. The backend then fetches current entitlements; only a
confirmed database subscription unlocks access. Cancellation, error, no active
purchase, and pending confirmation have distinct messages. Refresh subscription
retries server confirmation without making another purchase.

Existing Stripe users get their current paid plan from `user_subscriptions` on
either platform. An empty RevenueCat record cannot overwrite valid Stripe access.
Their native UI says no additional purchase is needed and exposes no Stripe link.
Store subscribers also retain database-backed access when signing into the web app.

## Verification and remaining acceptance tests

All 158 automated tests and the separate PostgreSQL integration test passed.
Local checks cover the mapper, native controller, HTTP handlers with mocked
external services, and real PostgreSQL trigger/RLS behavior in PGlite. These are
not substitutes for device/store tests. Build passed; the full test suite passed.
Default TypeScript checking reports an existing `replaceAll` vs ES2020 library
mismatch in `src/components/HandlingFeedback.tsx:91`; checking with ES2021 libraries
passes. The build retains its existing large-chunk warning.

Commands:

```powershell
npm.cmd run test
npm.cmd run build
npx.cmd tsc --noEmit -p tsconfig.app.json --lib ES2021,DOM,DOM.Iterable
# Isolated database validation; installs only a temporary test dependency:
$dbTestPath = Join-Path $env:TEMP 'onlyfast-revenuecat-dbtest'
npm.cmd install --prefix $dbTestPath @electric-sql/pglite --no-audit --no-fund --ignore-scripts
$env:PGLITE_MODULE = Join-Path $dbTestPath 'node_modules/@electric-sql/pglite/dist/index.js'
node --test tests/revenuecatDatabase.mjs
```

Before enabling purchasing in production, run this matrix on your configured
staging service and real native builds:

| Scenario | Required observation | Local coverage |
| --- | --- | --- |
| Web Rookie / Stripe Pro / Stripe Team | Original Stripe checkout/portal and current access | Build, existing tests, DB projection; live checkout/portal not exercised |
| Native flags / restart | Native UI and no Stripe script/element; persisted Supabase login | Detection/controller tests; device restart pending |
| Pro and Team purchase | Local price, correct UUID, correct paid table plan | Mock controller/mapper/HTTP tests; store transaction pending |
| Cancel / store error | No grant; cancellation/useful error message | Controller tests including rejected Median responses |
| Restore / no purchases | Correct original account; no extra purchase | Controller/mapper/HTTP tests; real receipts pending |
| Existing Stripe login in native | Paid access, no native repurchase | SQL provider-precedence tests; device login pending |
| Logout A / login B during purchase | No A result accepted for B; next action uses B | Controller/account-switch tests; device testing pending |
| Renewal / cancellation / grace / expiry / refund | Correct effective plan; Stripe preserved | Mapper/SQL/HTTP tests; store events pending |
| Duplicate / failed / out-of-order webhook | Idempotent, atomic, retriable; no stale overwrite | SQL and HTTP tests |
| Cron expiry | Expired native access revoked, Stripe unaffected | SQL function tested; hosted pg_cron scheduling pending |

The task did not log into store dashboards, set secrets, apply production SQL,
publish the website, deploy functions, rebuild Median, purchase subscriptions,
or submit an app review. Those are the remaining rollout steps.

## Exact changed files

Production frontend: `src/components/NativeSubscriptionControls.tsx` (new),
`src/components/PlanSelection.tsx`, `src/components/SettingsModal.tsx`,
`src/contexts/AppContext.tsx`, `src/lib/nativeEnvironment.ts` (new),
`src/lib/nativePurchaseController.ts` (new), `src/lib/nativePurchases.ts` (new),
`src/lib/membership.ts`, `src/lib/paymentVisibility.ts`, `src/lib/subscription.ts`,
`src/pages/SubscriptionSuccess.tsx`, `src/pages/Upgrade.tsx`.

Backend: `supabase/config.toml`, `supabase/functions/stripe-webhook/index.ts`,
`supabase/functions/_shared/revenuecat.ts` (new),
`supabase/functions/revenuecat-webhook/index.ts` (new),
`supabase/functions/sync-revenuecat-subscription/index.ts` (new), and the two
`202609240001` / `202609240002` migrations listed above (new).

Tests: `tests/revenuecat.test.ts`, `tests/revenuecatEndpoints.test.ts`,
`tests/revenuecatDatabase.mjs`, `tests/subscriptionAccountSwitch.test.ts` (new).
Documentation: `docs/REVENUECAT_AUDIT.md`, `docs/REVENUECAT_SETUP.md` (new).
No package dependencies, Stripe IDs, routing, or unrelated racing features changed.

## Official references

- [Median RevenueCat](https://docs.median.co/docs/revenue-cat),
  [official demo](https://median.dev/revenue-cat),
  [bridge types](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/types/revenueCat.ts)
- [Median app detection](https://docs.median.co/docs/detecting-app-usage)
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks),
  [REST subscriber model](https://www.revenuecat.com/docs/api-v1/customer-info-model),
  [restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)
- [iOS product setup](https://www.revenuecat.com/docs/getting-started/entitlements/ios-products),
  [Google product setup](https://www.revenuecat.com/docs/getting-started/entitlements/android-products)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
