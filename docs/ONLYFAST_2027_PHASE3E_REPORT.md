# OnlyFast 2027 — Phase 3E sandbox hardening and test readiness

Verified November 17, 2026 Pacific. Repository `Apex88Vent/onlyfast`, branch `develop/onlyfast-2027`; starting HEAD `28d58e6e`.

**Result: accelerated-trial code, additive testing migration and deployment preparation validated. Genuine native sandbox acceptance remains blocked on external routing isolation, approved credentials and store/build controls. No provider transaction, function deployment, hosted migration installation or push occurred.**

## Changes made

`mapRevenueCat2027` now treats accelerated sandbox trials as a provider-evidence problem rather than requiring every sandbox receipt to span 14 wall-clock days. The new server-only `revenuecat-sandbox-2027.ts` defines the four audited new Pro SKU/app/store identities and the exact Google offer `pro14day2027`.

For those products, both accelerated and ordinary-duration trial receipts require:

- A freshly fetched RevenueCat subscriber snapshot for the verified/allowlisted synthetic Supabase UUID; a different original UUID is quarantined as an account alias conflict.
- Exact sandbox environment, registered store/product/base plan and app; `PURCHASED` ownership, `trial` purchase state, finite ordered dates and a nonempty store transaction identifier.
- An authenticated RevenueCat **INITIAL_PURCHASE** webhook with matching UUID, app, store, SKU, transaction, purchase/expiration timestamps, Pro entitlement, zero price, no family sharing and `presented_offering_id=onlyfast_2027_v1`.
- Google: exact offer code `pro14day2027`. Apple: automatic introductory trial with no offer/promotion code; no fictitious Apple offer identifier is invented. The audited automatic introductory offer is identified by its exact SKU and TRIAL state. Apple's nominal P2W configuration and Google's nominal P14D configuration must still be reverified before native acceptance.

The accelerated period must be positive and at most the configured 14-day nominal term. Its duration is never inferred from a client success response or arbitrary shortened date alone. The provider expiration is retained exactly; no 14-day expiration is manufactured. Invalid or absent proof fails closed. The matching webhook evidence is stored atomically with successful snapshot application in the existing private event ledger. Sync/restore can then reuse it for that exact user/product/transaction/period. A delayed cancellation does not require manufacturing another initial-purchase event, and expiration does not extend access.

RevenueCat REST v1 can return Google's bare subscription key with `product_plan_identifier` separately. The mapper now joins those into the exact registered SKU and rejects conflicting explicit/suffixed plans. Entitlement matching accepts the corresponding bare product identity only with that verified subscription plan. Unknown purchase states, reversed dates and future purchase dates outside the existing skew allowance fail closed. [RevenueCat field and product-identifier documentation](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)

Production native receipts are still rejected by the testing mapper. Existing production RevenueCat mapping/handlers were not edited. Stripe's nominal 14-day trial-duration validation remains strict. Legacy native trials retain their original compatibility rules and are not assigned new acquisition offer evidence.

This implementation authenticates RevenueCat delivery and independently refetches its subscriber data; it does **not** claim to decode or cryptographically verify Apple JWS or Google purchase tokens directly. Real provider payload/offer-field propagation remains an acceptance check. Missing Google offer code or missing offering identity is denied, not guessed.

## Testing function hardening

All four provider routes require the existing exact testing URL and sandbox/billing gates before database/provider IO. They now also require `BILLING2027_SANDBOX_ISOLATION_CONFIRMED=true`, plus an explicit `BILLING2027_TEST_USER_IDS` allowlist. Both default to denying provider work. The isolation flag is an operator attestation **after** independent routing verification; setting it alone does not make routing safe.

| Route | Verified boundary |
| --- | --- |
| `billing-2027-sync` | `auth.getUser(bearer)`, allowlisted UUID, ignores client UID/receipt/evidence/tier, fetches provider server data; own-account sanitized status |
| `billing-2027-revenuecat-webhook` | Separate constant-time Authorization comparison; bounded future event timestamp; exact environment/app/store/registered product; single UUID; transfer quarantine; fresh snapshot; atomic evidence/application; event deduplication |
| `billing-2027-stripe-webhook` | Five-minute HMAC freshness and malformed timestamp rejection; test key only; live-event rejection; fetched `/v1/account` must match configured account; optional event account must agree; current subscription refetch, owner binding/allowlist, exact Price/interval, SQL deduplication |
| `billing-2027-reconcile` | Separate worker Authorization, explicit allowlisted account/provider; native evidence lookup or independently verified Stripe account/subscription ownership |

The testing Stripe GET header is pinned to `2026-10-28.endive`; modern and legacy invoice-reference handling remains tested. Provider risk/refund/dispute policy still requires review; no new price, checkout, cancellation, subscription schedule or charge API was added. Restricted test credentials should have only the required read permissions, including account identity and subscription reads. [Stripe restricted key guidance](https://docs.stripe.com/keys/restricted-api-keys)

Prepared `supabase/testing-2027/phase3e-functions.plan.json` lists each route, authorization contract, explicit testing project, required secrets and disabled nonsecret defaults. Gateway JWT verification is planned off because each handler verifies its own user/provider/worker authentication. The authenticated sync route still verifies its bearer with Supabase Auth. No change was made to root Supabase deployment configuration, the claim function deployment or Track Trace deployment.

## Migration status and exact order

Prepared artifact:

`supabase/testing-2027/20261117235314_onlyfast_2027_phase3e_sandbox_billing_testing.sql`

Generated with Supabase CLI `2.90.0 migration new`, then kept in the isolated testing-artifact directory, outside automatic root migration deployment. Version `20261117235314`; suggested migration name `onlyfast_2027_phase3e_sandbox_billing_testing`.

SHA-256: **`5E4283346E4A3D64E07EE2FBD3D772664E8D49CE190BCEA1023D70D832340125`**.

Required order:

1. Already installed `onlyfast_2027_phase3b_subscriptions_testing` (`20261115052857`).
2. Already installed `onlyfast_2027_phase3b_account_access_compatibility` (`20261115054325`).
3. Review/install this additive Phase 3E artifact once through the independently verified testing connection. Do not reapply Phase 1/2/3B or use a bulk `db push`.

The artifact requires both exact testing environment markers for **`mfzajhnfonrfuiwxgvhe`**, checks prerequisites and refuses reinstallation. It inserts all eight reviewed sandbox product identities without updating/deleting any existing registry row. Identity conflicts abort the transaction. After installation the registry should contain **20 rows**, retaining all original 12 legacy/history entries.

Two new service-only RPCs are included: `billing2027_trial_evidence(uuid)` and `billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb)`. The latter calls the existing locked/deduplicated snapshot function and stores corroborated initial-trial evidence in the same transaction. Duplicate/stale callbacks do not add or overwrite evidence. Existing tables, shared membership functions, archive policies and Track Trace code are not replaced.

**Not installed in hosted testing during this task.** Current hosted registry remains **12** and the new RPC is absent. The requested action was preparation. Local disposable PostgreSQL tests install the actual artifact and pass the four new checks in `phase3e-sandbox-verify.sql`, along with identity refusal, reinstall refusal, exact eight-product mapping, original-data retention, service-only authorization and callback deduplication. The manifest is reproducible with `node scripts/prepare-2027-phase3e.mjs`.

Before/after eventual installation, run `phase3b-subscriptions-retention.sql` with UTC and compare every count/hash before fixtures run. Then run the existing Phase 3B verification and the new Phase 3E verification. Never resolve a drift failure by deleting existing registry/history rows.

## Webhook isolation status — external blocker

A fresh read of RevenueCat project `proj79983fe3` still returns only webhook **`whintgrd6b6ff2503`**, active, pointing at production Supabase's `revenuecat-webhook`, with environment/app/event filters null. Nothing was modified or disabled.

Adding a SANDBOX webhook or assigning a tester offering override does **not** prevent the existing unfiltered production destination from receiving the same events. Offering metadata is not routing isolation. Therefore **no genuine sandbox transaction is permitted in the current shared project configuration**.

Two explicit isolation strategies are available:

| Strategy | Required configuration / proof | Status |
| --- | --- | --- |
| Shared RC project, preserve existing store products | Separately approve changing the existing production destination to **PRODUCTION-only**, audit transfer/test/other event routing and production sandbox handling; create a separate **SANDBOX-only** destination for `https://mfzajhnfonrfuiwxgvhe.supabase.co/functions/v1/billing-2027-revenuecat-webhook` with a new authorization secret; verify all destinations and retries cannot write testing events to production | **Requires separate production-routing approval; not performed** |
| Separate RC testing project/apps | Separate testing RC project, approved store connections/keys, offering and entitlement configuration, no production destinations; verify receipt/notification routing and update the testing-only app-ID/project policy and registry in a reviewed follow-up | **No project provisioned; requires external configuration and reviewed identifier changes** |

The shared-project route preserves the audited project/app/SKU identities and is the shortest path, but its production filter change is outside this task's authority. The separate-project route is stronger project isolation but is not automatically compatible with the currently pinned app IDs. Do not merely point a different key at the existing compiled policy.

Required proof before enabling the isolation attestation: review every destination/filter and provider notification path; verify environment-specific routing with a controlled non-transaction test whose delivery is already guaranteed not to reach production; then confirm the test destination accepts only approved sandbox identities. Do not send a dashboard test event while the existing unfiltered route can deliver it to production. No such event was generated here.

## Credential requirements

No provider secrets were read, printed, committed or copied. The previously confirmed absence of approved sandbox credentials has not been replaced by verified new credentials. Remote secret inventory is not available through the connector; no assumption was made that an unknown remote secret is approved.

| Scope | Exact variables |
| --- | --- |
| Managed testing backend only | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Nonsecret gates | `ONLYFAST_2027_BILLING_ENABLED`, `BILLING_2027_ENVIRONMENT`, **`BILLING2027_SANDBOX_ISOLATION_CONFIRMED`**, **`BILLING2027_TEST_USER_IDS`** |
| RC server reads | `BILLING2027_REVENUECAT_SECRET_API_KEY` |
| RC callback | `BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION` |
| Worker | `BILLING2027_RECONCILE_AUTHORIZATION` |
| Stripe optional testing | `BILLING2027_STRIPE_SECRET_KEY` (`rk_test_` preferred, or `sk_test_`), `BILLING2027_STRIPE_ACCOUNT_ID`, `BILLING2027_STRIPE_WEBHOOK_SECRET` |

Provision separate testing credentials in the platform's secret manager, never Vite variables or committed env files. RC keys are project-scoped rather than inherently sandbox-only; exact environment/account restrictions remain essential. Stripe account identity is now refetched rather than trusted solely from an env label. Supabase's managed service-key lifecycle and any required new-secret-key migration must be verified with the testing project owner before January launch; no production key rotation was attempted.

All four provider functions remain **undeployed**. Existing deployed functions remain claim version 1 and Track Trace context version 2. Credentials, migration installation and routing proof are deployment prerequisites; do not deploy a partially configured route to test it against live providers.

## Native testing/build requirements

Use the existing stock Median `NativePurchaseController`, retaining its account-switch serialization and `presentPaywall()`/restore calls. Do not activate the historical custom native adapters. No production native or app source was changed.

The portable controller contract has no offering argument for `presentPaywall()`. The current code's optional `getOfferings()` preflight is not an offering selector. To test noncurrent `onlyfast_2027_v1`, prefer a **synthetic-customer-only offering override**, after routing isolation and separate configuration approval, without changing the global current offering. RevenueCat documents individual customer overrides. No override was created here, and no existing paywall was changed. A separately reviewed paywall/presentation setup is still needed; a null API paywall ID does not prove that no legacy paywall exists. [RevenueCat testing options](https://www.revenuecat.com/docs/tools/paywalls/testing-paywalls#3-override-a-customers-default-offering)

An internal Median build/profile must:

1. Load only an approved isolated testing Preview/QA origin, with public purchase controls still held in ordinary builds.
2. Authenticate only to `https://mfzajhnfonrfuiwxgvhe.supabase.co`, using testing publishable configuration and an approved synthetic UUID; require server project-marker verification and reject account changes.
3. Configure the appropriate platform public SDK key for the reviewed RC project/app, never a server secret or Test Store key substituted for genuine Apple/Google acceptance.
4. Run the stock controller's identity/purchase/restore flow, then use **`reconcileNative2027` → `billing-2027-sync`** for authority. `src/lib/nativePurchases.ts` currently invokes legacy `sync-revenuecat-subscription`, and the historical `qa/median-paywall` harness is local-backend-only. Neither is an accepted 2027 hosted test route unchanged. Keep this new routing inside the internal QA profile; do not repoint the production singleton or change concurrent `useNativeSubscription` work.
5. Handle initial sync as pending if its authenticated initial-purchase callback has not yet persisted proof; retry after callback delivery. A native success callback alone grants nothing. Verify the actual installed Purchases/RevenueCatUI and Median callback contract on each platform.
6. Use an Apple sandbox tester and Google license tester/internal test build with eligible/ineligible purchase histories. Recheck real store availability, nominal P2W/P14D terms, shared Apple-group eligibility and Google's exact offer field. Google remains DRAFT and Apple's scheduled trial start was January 1 in the Phase 3D audit; these external controls were not activated or changed here.

No new build is required simply to create a noncurrent offering. A separate internal build/profile is required if the installed wrapper cannot satisfy the origin/backend/key/routing constraints above. No native build was distributed or store transaction executed. Apple sandbox/TestFlight purchases use sandbox behavior, and accelerated expiry must be confirmed from actual receipts rather than assumed from fixture durations. [RevenueCat Apple testing](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store)

After external controls are supplied, test all four plans and both store platforms: trial eligibility/ineligibility, cancellation through expiry, paid renewal, restoration without another trial, duplicate/out-of-order callbacks, wrong-account ownership/transfer denial, downgrade/class selection, permanent archives and historical Track Trace access. Confirm dashboard SANDBOX, exact appUserID and testing-only server projection; retain private receipt evidence without exporting payment details.

## Verification results

| Check | Result and scope |
| --- | --- |
| Full automated regression | **756 passed, 0 failed, 0 skipped**; current checkout, including preserved concurrent analytics/onboarding work |
| Billing-specific tests | **39 passed**, including all four real Pro SKU accelerated variants, invalid offers/receipts, cancellation/restore/renewal/expiry, callback authentication, duplicate application, project and browser authorization, legacy access/grandfathering and migration retention |
| Supplemental legacy billing/UI/PostgreSQL | **34 passed**, 0 failed |
| TypeScript | App, Node and strict shared Edge modules **passed** |
| Full testing Preview build | **Passed**, existing large-chunk warning; local artifact only |
| Hosted testing identity | Exact project `mfzajhnfonrfuiwxgvhe`, org `wxswxtsewczfijycqnwi`, ACTIVE_HEALTHY |
| Installed database catalog | **12/12 passed**, existing Phase 3B/compatibility schema; Phase 3E is not installed |
| Hosted installed engine/authorization | **16 rollback checks passed**, including legacy Pro, Teams/Factory, original pricing evidence, protection boundary, downgrade/class choice, unauthorized grant manufacture and cross-account denial |
| Hosted retention | **16/16 UTC counts/hashes match exactly** before/after rollback checks |
| Real native/provider purchases | **Not run; blocked by isolation/credentials/store/build prerequisites** |

The synthetic payloads use documented RevenueCat field shapes; they are not captured real receipts. The initial Phase 3E run exposed four existing grace fixtures whose purchase time was later than their expiry; those fixtures now use ordered real-world dates and retain all prior grace assertions. No production validation was loosened to pass them.

Local PostgreSQL tests apply the prepared migration, verify all eight exact mappings against the Phase 3D catalog, retain original registry/racing values, deny browser access, prove atomic evidence+state/deduplication and refuse the production identity before writes. The hosted rollback harness changes only existing synthetic fixtures/clock inside a subtransaction and restores them before returning. Persistent hosted counts remain registry **12**, claims **0**, provider states **0**, events **0**. No original setup/session/result data was migrated or deleted.

Security advisors remain **0 errors, 14 warnings, 20 informational findings**: 13 existing authenticated SECURITY DEFINER exposure warnings and disabled leaked-password protection. Private RLS-without-policy findings remain informational. New service-only RPC exposure was verified locally; hosted advisors must be rerun after eventual installation. [RPC warning guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Grandfathering and isolation preservation

Legacy Apple Pro / Google `pro:pro` still map to Pro; legacy Apple Teams / Google `teams:teams` still map to Factory. No existing customer is moved to a new acquisition SKU. No renewal-price write API, schedule or price-increase job exists in these changes. The 12-month evidence-based protection logic is unchanged; missing original lineage/price/currency remains a reconciliation requirement, not an invented protected amount. This phase verifies engine behavior and absence of subscription/price mutations, not every customer's actual provider renewal bill.

Fresh RevenueCat reads confirm `onlyfast_monthly_v1` is still current and `onlyfast_2027_v1` remains noncurrent with four packages. All RC operations in Phase 3E were reads. No provider products/offers, customers, paywalls or webhook settings were modified. Production Supabase/Primary, production native builds, production environment variables and standalone OnlyLaps were not accessed or modified. No Vercel deployment/promotion occurred and main was not edited.

Concurrent analytics, onboarding and Track Trace work was preserved. Only Phase 3D/3E owned paths were selected for the requested local commit; no push or GitHub Actions run for that new commit was triggered. Existing remote validation is not presented as validation of unpushed changes.

## Owned files and remaining blockers

Phase 3D owned report/catalog/product tests and the supplemental test-loader suffix fix are included in the local commit. Phase 3E adds/changes:

- Shared testing modules: `subscription-catalog-2027.ts`, `billing2027-handlers.ts`, new `revenuecat-sandbox-2027.ts`.
- Testing migration, `phase3e-sandbox-verify.sql`, `phase3e-functions.plan.json`, `phase3e-sandbox.manifest.json`.
- `scripts/prepare-2027-phase3e.mjs`.
- Billing handler/provider tests; new sandbox validator, handler and PostgreSQL tests; `tests/helpers/revenuecatSandbox2027.ts`.
- This report.

Evidence is ignored under `tmp/phase3e-*.log`; migration and plan fingerprints are in the committed manifest. No credentials or raw real provider receipts are included.

Remaining gates are explicit: **review/install the additive testing migration; obtain approved testing credentials; prove RevenueCat routing isolation under separate approval; verify store availability/offer evidence; prepare and inspect the isolated Median QA build/profile; then perform genuine native acceptance.** The code is validated for those controlled tests, but external isolation and provider acceptance are not certified. Production purchasing, the global offering and grandfathered subscriptions remain held/preserved.
