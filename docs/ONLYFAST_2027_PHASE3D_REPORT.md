# OnlyFast 2027 — Phase 3D offerings and sandbox integration

Audited November 15, 2026 Pacific / November 16 UTC. Target launch: January 1, 2027. Repository: `Apex88Vent/onlyfast`; branch: `develop/onlyfast-2027`; existing HEAD: `28d58e6ec1bb76fe919e425debfd4bd45aebbb4f`.

**Result: the separate 2027 offering and entitlement associations are configured and verified. Actual native sandbox purchase acceptance remains blocked. No live purchasing was enabled.**

## RevenueCat configuration completed

Project `proj79983fe3`; Apple app `app82192c9834`, Google app `appd348665a60`. Both store apps identify `app.onlyfast`; their store-credential configuration indicators are true. These indicators do not supply approved testing Edge Function credentials.

Created offering **`onlyfast_2027_v1`**, ID **`ofrng8a104c3869`**. A fresh expanded read confirms **`is_current=false`**, four packages and exactly two correctly paired store products per package. No Test Store or legacy product was added to this offering.

| Plan / package identifier | Package ID | Apple SKU / RevenueCat product ID | Google SKU / RevenueCat product ID | Entitlement |
| --- | --- | --- | --- | --- |
| Sportsman Monthly / `$rc_custom_sportsman_monthly` | `pkgeecdd1361b2` | `app.onlyfast.2027.sportsman` / `prod94524e0912` | `onlyfast2027sportsman:monthly` / `prod01fa8df53f` | `OnlyFast Sportsman` |
| Pro Monthly / `$rc_monthly` | `pkge3e2521240f` | `app.onlyfast.2027.pro_monthly` / `prod6cb1efb920` | `onlyfast2027promonthly:monthly` / `prodb72565e303` | `OnlyFast Pro` |
| Pro Annual / `$rc_annual` | `pkge5107a201bc` | `app.onlyfast.2027.pro_annual` / `prodc0b7d866be` | `onlyfast2027proannual:annual` / `prod2e5726de34` | `OnlyFast Pro` |
| Factory Monthly / `$rc_custom_factory_monthly` | `pkge7b7b8ecd1a` | `app.onlyfast.2027.factory` / `prod97071559b6` | `onlyfast2027factory:monthly` / `prod883c88a2f5` | `OnlyFast Teams` |

Created the distinct Sportsman entitlement, ID `entlee92734805`, and attached only its two new products. Added the four new Pro products to existing entitlement `entl73664a0fc7`, and the two new Factory products to existing Teams entitlement `entlcd6b151566`. Factory deliberately uses the established Teams entitlement; the testing registry maps it to Factory access. No legacy entitlement was renamed or detached. Sportsman receives neither Pro nor Teams.

The complete expanded record for current offering **`onlyfast_monthly_v1`**, ID `ofrng35794ca3b5`, compared equal before/after these changes, including packages, products, metadata and paywall association `pw3a65004212ef4af8`. It remains current. No paywall was created, edited, published or reassigned. Noncurrent is a default-selection setting, not a secret or an authorization boundary: SDK clients can enumerate other offerings. Application purchase holds remain necessary.

## Live store reads

All eight products were read with RevenueCat `get_product_store_state(refresh=true)` at approximately `2026-11-16T02:32:00Z`; prices were read from store state, not inferred from catalog labels.

| Plan | US price | Apple duration / state | Google duration / base-plan state | Introductory offer |
| --- | --- | --- | --- | --- |
| Sportsman | USD 4.99/month | P1M / READY_TO_SUBMIT | P1M / DRAFT | None returned |
| Pro Monthly | USD 7.99/month | P1M / READY_TO_SUBMIT | P1M / DRAFT | Apple FREE_TRIAL P2W × 1, starts 2027-01-01; Google `pro14day2027`, P14D free × 1, DRAFT |
| Pro Annual | USD 60/year | P1Y / READY_TO_SUBMIT | P1Y / DRAFT | Same two-week Apple / P14D Google terms |
| Factory | USD 14.99/month | P1M / READY_TO_SUBMIT | P1M / DRAFT | None returned |

Apple subscription-group reads independently confirm the four new durations. All four new products and the existing Pro/Teams products belong to **OnlyFast Memberships**, group `22485557`. Group levels were not exposed by this read, so upgrade/downgrade ranking is not certified. Apple returns `needs_action` for each READY_TO_SUBMIT product. Google returns overall `ok`, but each relevant base plan and both offers explicitly remain DRAFT; `ok` does not imply purchasability. No additional warnings field was returned by these eight reads.

Google's acquisition targeting is `anySubscriptionInApp`: prior subscribers may be ineligible. Apple's shared group also means a product change does not itself reset introductory eligibility. Configured offers and synthetic trial states do not prove eligibility for a particular store account. No store submission, activation, price edit or offer-date change occurred.

## Existing subscribers and prices

Paginated entitlement-product reads with limit 100 confirm **all seven original Pro attachments and all three original Teams attachments remain present**. Legacy Apple `app.onlyfast.pro.monthly` and Google `pro:pro` remain Pro; Apple `app.onlyfast.teams.monthly` and Google `teams:teams` remain Factory through the existing mapping. The legacy monthly packages remain unchanged.

No customer profile, payment detail, purchase history or provider subscription was accessed or changed. No price, subscription schedule, renewal setting or grandfathered rate was changed. The configured new acquisition prices therefore do not migrate existing subscribers. The existing 12-month protection engine and its evidence requirements remain intact; hosted rollback fixtures verified legacy Pro pricing evidence, Teams-to-Factory access, provider precedence and paid access after the protection boundary. This is engine verification, not certification of every customer's provider renewal price. Do not move legacy customers onto new SKUs to obtain new functionality.

## Testing Supabase and function audit

Only the explicit **testing account** connector was used. Independent project read: `mfzajhnfonrfuiwxgvhe`, organization `wxswxtsewczfijycqnwi`, ACTIVE_HEALTHY, PostgreSQL `17.11.0.019`.

Installed migrations verified, without reapplication:

- `onlyfast_2027_phase3b_subscriptions_testing`, version `20261115052857`.
- `onlyfast_2027_phase3b_account_access_compatibility`, version `20261115054325`.

All **12 post-install catalog checks passed**. The private product registry still contains its original 12 legacy/history rows; the new eight SKUs have **not** been installed persistently. The reviewed catalog is prepared in `supabase/testing-2027/phase3d-revenuecat-products.plan.json`; it is an inert review artifact, not an executed migration. Register sandbox-only rows through a separately reviewed additive installation after the blockers below are resolved. Preserve existing registry rows and never reapply Phase 3B.

Deployed functions remain:

- `claim-2027-sportsman-trial`: ACTIVE, version 1; own-account Auth verification, exact testing URL guard, no provider secret or charging capability. Its testing flags are supplied by its existing entrypoint profile.
- `track-trace-setup-context`: ACTIVE, version 2; unchanged.

The four provider-dependent routes remain **undeployed**: `billing-2027-sync`, `billing-2027-revenuecat-webhook`, `billing-2027-stripe-webhook`, `billing-2027-reconcile`. No function or secret configuration was changed in this task.

The user previously confirmed sandbox credentials were not configured. No approved provider credentials are available in the process environment or dedicated private credential location; the latter contains only the existing synthetic Supabase login fixture. The connector exposes no secret-list/configuration tool. Consequently remote secret presence was not independently inventoried, and no existing production secret was read or copied. Deployment remains blocked rather than assuming any unverified remote value is approved.

| Route / requirement | Exact variable names |
| --- | --- |
| All provider routes, nonsecret testing guards | `ONLYFAST_2027_BILLING_ENABLED=true`, `BILLING_2027_ENVIRONMENT=sandbox` |
| Supabase managed, testing project only | `SUPABASE_URL=https://mfzajhnfonrfuiwxgvhe.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` |
| RevenueCat sync | `BILLING2027_REVENUECAT_SECRET_API_KEY` |
| RevenueCat webhook, in addition to sync | `BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION` |
| Reconcile, in addition to selected provider credentials | `BILLING2027_RECONCILE_AUTHORIZATION` |
| Stripe webhook / Stripe reconciliation | `BILLING2027_STRIPE_SECRET_KEY` (`sk_test_` or `rk_test_` only), `BILLING2027_STRIPE_ACCOUNT_ID`; webhook additionally requires `BILLING2027_STRIPE_WEBHOOK_SECRET` |

RevenueCat native apps use their platform public SDK keys for actual store sandboxes; a public key is not the server subscriber-read credential above. RevenueCat store-connection keys must not be copied into Edge Functions. No Stripe account or live billing tool was accessed for this phase.

## Verification results

| Verification | Exact result / boundary |
| --- | --- |
| Full local `npm test` | **747 passed, 0 failed, 0 skipped**, including concurrent analytics work and 14 new audited-SKU fixture cases |
| Supplemental billing/UI/PostgreSQL tests | **34 passed, 0 failed** |
| App / Node / strict shared Edge TypeScript | **All passed** |
| Full testing Preview build | **Passed**, existing large-chunk warning |
| Hosted Preview real Auth/API | **7 passed**: four synthetic logins/own projections; closed-calendar claim denial; missing/forged Auth denial; private grant/cross-account denial; desktop/mobile disabled-purchase plans; actual account switching |
| Hosted Preview recorded-state UI | **8 passed**: monthly/annual Pro trial, cancellation, expiration, grandfathered Pro, Teams/Factory, paid-after-protection, Rookie claim/duplicate-click display |
| Hosted installed database rollback fixtures | **16 passed**: eligibility, one claim/retries/expiry, monthly/annual Pro, cancellation/deduplication, grandfathering, downgrade, permission and retention boundaries |
| Phase 2 hosted archive/Track Trace recheck | **13 passed**, actual browser/API |
| Retention | **16/16 UTC count/hash pairs match exactly** before/after all hosted fixtures and cleanup |
| Existing GitHub Actions HEAD validation | [Run 43778000747](https://github.com/Apex88Vent/onlyfast/actions/runs/43778000747), **success** for `28d58e6e`; new local Phase 3D artifacts were not pushed and are not included in that run |

The 14 new local fixture cases use the eight actual audited SKU/base-plan identifiers and entitlement names. They verify active access mapping, repeat restoration without extension, cancellation retaining paid-through access, expiration, all four Pro trial variants, Sportsman's separate entitlement, wrong-base-plan/unknown-product/production-receipt denial, and the accelerated-trial blocker below. They make no network requests. They do not certify a real store trial eligibility decision or restored receipt.

Preview tested: **https://onlyfast-gzkaaovxu-apex88vents-projects.vercel.app**, deployment `dpl_GPJXYLvXvdb3s5vqsJbPhiuMQrp4`, READY, existing source `28d58e6e`. No new deployment was created. The 15-check report has zero page errors and zero unexpected external requests. Recorded UI states are intercepted sanitized database fixtures; they are not provider transactions.

The Phase 2 recheck covered Sportsman active-slot recovery and gray locked archives; archived content/restoration denial; Pro/Factory restoration; Factory downgrade/class choice and excess quotas; Sportsman's 48-hour editor lock; unsubscribed/historical read-only access; archived linked telemetry versus independent history; recording/linking denial and cross-account security. Only the new tagged fixture weekend was backdated. All new fixtures, including the exact tagged unreferenced track map requiring connector cleanup, were removed; original tiers/archives were restored. The rollback harness restored its temporary clock and provider fixtures; final clock source fingerprint remains `9e2b8dd937e2424c5910f2ee2f12da82`. Final persistent counts are unchanged: registry **12**, claims **0**, provider states **0**, provider events **0**.

The supplemental UI harness initially appended `.ts` to already-suffixed imports and failed opening `setupLibrary.ts.ts`. Its loader now normalizes explicit TypeScript suffixes; the unchanged product code then passes all 34 supplemental cases.

## Native purchase blockers and required test-build steps

1. **Approved server credentials are unavailable.** Do not deploy the four provider-dependent functions until their exact testing configuration is supplied through a secure channel, verified against this project and validated without displaying values. An RC API credential is not inherently sandbox-only; the existing server sandbox checks and exact account/app restrictions must remain in place.
2. **Webhook isolation is unresolved.** The only existing RevenueCat webhook is `whintgrd6b6ff2503`, active, pointing at the production Supabase `revenuecat-webhook`; environment/app/event filters are null. No testing webhook was created. Adding a SANDBOX webhook would not stop delivery to that existing unfiltered endpoint. Production code includes conditional sandbox handling, so source inspection cannot certify a safe live delivery path without verified deployment configuration. Resolve isolation separately before any real sandbox transaction; do not modify that production endpoint under this task.
3. **Accelerated native trials currently fail the strict mapper.** `mapRevenueCat2027` requires new Pro trial expiration minus purchase date to equal exactly 14 wall-clock days. A synthetic accelerated five-minute trial is reproducibly rejected with `UNEXPECTED_INTRODUCTORY_TRIAL_TERMS`. Real sandbox time is accelerated. Keep the guard until a reviewed provider-aware implementation can validate the configured P2W/P14D offer independently of accelerated receipt expiry; never simply accept arbitrary trial lengths. [RevenueCat sandbox timing](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store)
4. **Store/configuration readiness is incomplete.** Google DRAFT plans/offers cannot serve as approved purchasable test products in the current state. Apple products remain READY_TO_SUBMIT, offers start January 1, and actual tester eligibility/propagation remains unverified. No activation/submission was attempted. A separately isolated Test Store/StoreKit configuration can exercise UI and receipt logic but cannot certify these actual Apple/Google products. [Testing environment distinctions](https://www.revenuecat.com/docs/test-and-launch/sandbox)
5. **The stock Median path has no portable JS offering selector.** `NativePurchaseController` uses `presentPaywall()` without an offering argument. Do not switch the global current offering to test. A separately approved synthetic-customer override is an available testing mechanism, but no override was assigned here and no 2027 paywall was configured. A null paywall ID alone does not prove absence of a legacy paywall. [RevenueCat tester offering override](https://www.revenuecat.com/docs/tools/paywalls/testing-paywalls#3-override-a-customers-default-offering)
6. **A testing native profile/build must be verified before use.** The existing installed wrapper was not inspected or exercised here. If it cannot load the isolated Preview/QA origin, authenticate only against testing Supabase and send sync to `billing-2027-sync`, create an internal Median build/profile with those changes, the approved platform SDK public key and compatible Purchases/RevenueCatUI versions. Preserve stock Median; do not activate the historical custom adapters in `native/`. No native rebuild is needed merely to create the noncurrent offering, but existing production binaries are not accepted as a testing route by assumption.

After these blockers are resolved: install the additive sandbox registry; deploy only credential-complete testing functions; establish reviewed sandbox callback isolation and isolated tester offering selection; verify the native build's exact backend/origin; then test each SKU on eligible and ineligible store testers. Verify dashboard SANDBOX environment and exact synthetic appUserID, server-refetched entitlement, cancellation through paid-through expiry, accelerated renewal/expiry, restore on reinstall, cross-account transfer denial, downgrade/history and unchanged grandfathered pricing. Record actual receipts only in private evidence. Clear test-only overrides/access after testing. Keep production and live-purchase holds in place.

## Isolation, security and changed files

Production Supabase `thpyjvwtfvfxiufchrxn` and Primary were never queried. Production Vercel remains `dpl_8NFvGedoKHaMQXRpbqmqgAy11yte`, main commit `46f7552adb51dae89bd9d9616be646e39f232c44`. Remote main is unchanged. No production env vars, deployed frontend, provider products/prices, customer subscriptions or standalone OnlyLaps installation were changed. The existing concurrent modified-file hashes compare identical to their start-of-task values; no Track Trace or analytics source was edited. No commit/push was performed.

Security advisors: **0 errors, 14 warnings, 20 informational findings**. The existing 13 authenticated SECURITY DEFINER exposure warnings and disabled leaked-password-protection warning remain; private RLS-without-policy findings are informational. No security settings were changed. [RPC exposure guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [private RLS findings](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Files created/changed for Phase 3D:

- `docs/ONLYFAST_2027_PHASE3D_REPORT.md` — this report.
- `supabase/testing-2027/phase3d-revenuecat-products.plan.json` — reviewed nonsecret catalog, not installed.
- `tests/billing2027RevenueCatProducts.test.ts` — actual-identifier synthetic mapping and lifecycle coverage.
- `tests/testSubscriptionDatabaseUI.mjs` — import-suffix normalization in the supplemental test harness.

Catalog artifact SHA-256: `DC4BF87A408903171972D944F1244923EB6BEC99CDB58E34C3611CCD8566EFBC`.

Ignored local evidence: `tmp/phase3d-regression.log`, `phase3d-extra-regression.log`, `phase3d-products-tests.log`, `phase3d-ts-*.log`, `phase3d-build.log`, `phase3d-preview.log`, `phase3d-phase2.log`; browser JSON/screenshots in `tmp/phase3b-hosted-browser` and `tmp/phase2-hosted-browser`. Temporary Preview access was deployment-scoped with a one-hour TTL and revoked after testing; no bypass value or credential is included here.

**Phase 3D catalog preparation passed. Real provider/native sandbox acceptance and production readiness have not passed.**
