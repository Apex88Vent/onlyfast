# OnlyFast 2027 Phase 3B — subscription infrastructure and trials

Target launch: **January 1, 2027, 12:00 AM Pacific / `2027-01-01T08:00:00Z`**.

Repository/branch: `Apex88Vent/onlyfast`, `develop/onlyfast-2027`, primary checkout. Base HEAD: `613c25d9f22616db4e218ace268c742b08868204`. Reference: [Phase 3A audit](ONLYFAST_2027_PHASE3A_BILLING_AUDIT.md).

**Historical local implementation checkpoint: code and review artifacts prepared; no installation/deployment had occurred at that checkpoint.** See the [hosted acceptance follow-up](ONLYFAST_2027_PHASE3B_HOSTED_ACCEPTANCE.md) for the subsequently verified installation, Preview, compatibility repair and remaining blockers. Production billing remains inactive.

## Implemented architecture

The 2027 system is additive and testing-only. Existing live RevenueCat/Stripe handlers, provider products, subscriptions, offerings, purchase gates and secrets remain unchanged. New provider-verifying endpoints feed private database state. That state supplies the existing membership/permission RPC contract and a sanitized own-account management response.

| Layer | Implementation |
| --- | --- |
| Product normalization | `supabase/functions/_shared/subscription-catalog-2027.ts`: explicit provider/environment/app/store/product/base-plan matching, interval, entitlement, legacy/acquisition status, verified-duration requirement |
| HTTP authentication/reconciliation | `supabase/functions/_shared/billing2027-handlers.ts`: authenticated account verification, provider server fetches, signature checks, app/environment validation and service-only snapshot application |
| Mobile verification | `billing-2027-sync`, `billing-2027-revenuecat-webhook`; RevenueCat REST subscriber snapshots fetched for the verified Supabase UUID |
| Rookie promotion | `claim-2027-sportsman-trial` authenticates the session; private atomic SQL claim decides eligibility and exact dates |
| Secondary web verification | `billing-2027-stripe-webhook`: sandbox-only Stripe lifecycle reconciliation, current-provider refetch, modern/legacy invoice references, bounded signature age |
| Restricted reconciliation | `billing-2027-reconcile`: separate worker authorization; explicit account/provider, plus verified Stripe subscription ownership for web reconciliation |
| Database authority | Nine private RLS tables, restricted RPCs, per-user transaction locks, provider event/observation tracking, effective-tier projection and downgrade state |
| Client state | `billing2027State.ts` and `subscription2027Billing.ts`: verified own-account response, date validation, account-generation guards, authenticated reads/claims, server-clock offset for display |
| Prepared interface | `Subscription2027Plans.tsx` inside the 2027 plan selection: monthly/annual Pro choice, featured Pro card, disabled purchase buttons, Rookie claim notice and subscription management |

All new HTTP handlers reject requests **before database/provider IO** unless `SUPABASE_URL` equals `https://mfzajhnfonrfuiwxgvhe.supabase.co`, `ONLYFAST_2027_BILLING_ENABLED=true`, and `BILLING_2027_ENVIRONMENT=sandbox`. Defaults leave them disabled. Stripe requests additionally require a new testing-only `sk_test_`/`rk_test_` credential. No production fallback or inheritance from legacy billing secret names exists.

The dedicated testing project and organization were independently reverified through the explicit **testing account** connector: `mfzajhnfonrfuiwxgvhe` / `wxswxtsewczfijycqnwi`, `ACTIVE_HEALTHY`. Hosted operations in this phase were project/catalog **reads only**. Primary was not used.

## Product registry and plans

`phase3b-products.plan.json` is an **unconfigured review contract**, not published products. New store/Price IDs are null. Neither the global RevenueCat offering nor native package IDs were changed.

| Plan | USD terms prepared | Functional policy |
| --- | --- | --- |
| Sportsman | $4.99/month; no annual | One class, 2 active base/5 active race slots, 48-hour race editing, 2 timing scans/weekend, existing Rookie Assist allowance, no ads/new Track Trace recording |
| Pro monthly | $7.99/month; 14-day trial for provider-eligible new subscribers | One class, unlimited setups/scans, existing Pro Assist, full Track Trace, archive access/restoration |
| Pro annual | $60/year; same 14-day eligibility condition | Identical Pro functionality; verified annual duration required |
| Factory | $14.99/month; no annual | Unlimited classes/setups/scans, existing Team Assist, full Track Trace, archive access/restoration |

Sportsman archives remain permanent but their contents/restoration require Pro or Factory. Eligible historical telemetry viewing is separate from recording permission. No existing setup/session/result data is deleted to enforce a downgrade or expiration.

The SQL registry preserves Apple `app.onlyfast.pro.monthly` / `app.onlyfast.teams.monthly`, Play `pro:pro` / `teams:teams`, their existing RC app IDs and `OnlyFast Pro` / `OnlyFast Teams` lookup keys. Legacy Pro maps to Pro; legacy Teams maps to Factory. Classification uses identifiers, never price similarity. Sandbox and production identities are separate rows; the new endpoints can ingest sandbox rows only.

Four historical live Stripe Price IDs from the audit are retained as production history references. The unresolved archived Teams $8/$10 IDs remain disabled pending review. They are not silently treated as new acquisition products. No live Stripe Price was created, archived, repriced or moved.

New acquisition products require exact reviewed IDs, `duration_verified=true`, and correct interval/trial terms before registration can authorize access. Sportsman is explicitly prohibited from using the legacy Pro/Teams entitlement in both SQL constraints and the server matcher. The old Test Store product named “Yearly” is not used as annual evidence. Existing Apple legacy monthly IDs are compatibility entries, not a claim that the App Store Connect blocker has been resolved.

## Rookie transition and promotional claim

The approved half-open claim window is exactly:

`[2027-01-01T08:00:00Z, 2027-01-31T08:00:00Z)`.

Prelaunch server observations populate the private Rookie eligibility cohort. The installation captures qualifying existing free accounts without changing their auth/subscription/racing records. An `AFTER INSERT` trigger on testing `auth.users` records server-observed prelaunch registrations between installation and launch. Post-cutoff registrations do not qualify. Paid provider evidence invalidates Rookie eligibility; existing paid source identifiers also prevent a claim. No user metadata, browser flag or client timestamp creates eligibility.

`billing2027_capture_rookie_cohort()` is service-only and idempotent, for prelaunch enrollment reconciliation. It refuses to manufacture prelaunch evidence after the cutoff. An installation attempted after that evidence window closes stops for review rather than retroactively certifying accounts.

Eligible, unclaimed existing Rookies keep their existing free Rookie functionality throughout the transition window. After the cutoff, they become historical read-only unless verified paid access or an active promotional grant applies.

The promotion is **30 days of Sportsman**, starting at the successful server claim. SQL uses `720 hours`, independent of timezone/DST. January 25 at a given time ends February 24 at that time. It is not the provider Pro trial.

The authenticated endpoint ignores body user IDs, plan, dates, eligibility and purchase responses. SQL uses `auth.uid()`, takes the existing per-user advisory transaction lock before row reads/writes, and enforces a primary key on user identity. A retry returns the original dates, including after expiry; it never extends or duplicates the grant. No subscription, payment authorization, payment information, provider API purchase or automatic conversion is created.

At promotional expiry, SQL recomputes the effective tier immediately from server time; another verified paid source can continue access. The browser also expires its cached canonical grant and refreshes through the existing membership lifecycle. The client clock affects display only; database permissions remain authoritative.

## Provider-managed Pro introductory trial

The prepared acquisition contract is **14 days free** for eligible new Pro monthly and annual subscribers, followed by the selected recurring price. Server mapping requires an actual supported store subscription, configured product/entitlement, finite provider dates, correct sandbox environment and verified product duration. For new Pro trial records, the verified trial period must be 14 days. Existing legacy trials retain their original provider terms; they are not extended or converted into new trials.

The application does not mint introductory eligibility. Account switching, reinstall, restore, interval selection and repeated callbacks do not create another trial or reset its expiration. A store-confirmed nontrial purchase grants its paid functionality without a fabricated free period. Native “purchase succeeded” bodies are ignored; authenticated server verification is required.

Canceling renewal while a verified trial remains active keeps access through the provider's verified entitlement expiration. Native grace dates and refunds are mapped explicitly. Expiration removes new-write/recording permissions and preserves eligible historical data. Stripe active/trialing state is verified from the current subscription; a late failure event cannot overwrite a currently active/trialing subscription using stale event status.

The prepared UI clearly separates selected interval, conditional trial eligibility, recurring amount/frequency, cancellation terms and a verified expected first billing date when available. Purchase controls remain disabled. The stock Median RevenueCat paywall remains the selected purchase integration; historical custom Swift/Kotlin adapters are untouched. No new checkout/trial authorization flow was activated.

Store eligibility and payment-sheet terms must be tested on real sandbox binaries after configuration. RevenueCat describes store-driven introductory eligibility and cautions that the final store authorization controls the offer. [RevenueCat introductory offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers)

## Grandfathering and source conflicts

Protection boundaries are stored as `2027-01-01T08:00:00Z` through `2028-01-01T08:00:00Z`. The private ledger records user, provider, legacy plan/product, subscription lineage, actual protected amount/currency/unit, eligibility evidence, status, reconciliation history and notice/consent state.

Legacy access and price protection are distinct. Paid Pro remains Pro even if its old rate resembles Sportsman. Qualifying Teams receipts map to Factory without canceling/recreating their subscription. The new code has no provider price-update operation, subscription schedule creation, price-increase cron or automatic January 2028 billing action.

Verified prelaunch provider observations establish paid cohort evidence. A complete lineage/price/currency record plus eligible prelaunch evidence can become protected at launch. Incomplete evidence stays a candidate. A changed amount/currency requires review; lapse/refund is recorded without erasing original evidence. Price-protection expiry does not terminate paid functionality.

RevenueCat REST v1 does not guarantee original transaction lineage or purchased-currency price in the subscriber snapshot. Those values are not invented from a renewal transaction, UI label or nominal USD price. An authenticated provider webhook can supplement them only when its transaction/product matches the freshly fetched server subscription. Missing evidence remains a launch reconciliation requirement. [RevenueCat customer snapshot model](https://www.revenuecat.com/docs/api-v1/customer-info-model)

The effective projection chooses the highest qualifying verified functional access across providers. Source facts and historical legacy columns are preserved; the code never cancels a losing subscription. Original legacy server-owned paid rows remain readable until that provider stream is reconciled, with paid-through/expiration checks. Missing legacy paid-through evidence requires reconciliation rather than an indefinite new 2027 grant.

Cross-account aliases/receipt ownership conflicts fail closed. RevenueCat transfer events are quarantined for verified ownership review rather than automatically copying paid access or trial history. This is a deliberate safety boundary, **not completed automatic transfer support**.

## Stripe compatibility work

The isolated Stripe handler implements five-minute signature freshness, multiple valid signature support, malformed/duplicate timestamp rejection, modern and legacy invoice references, server-side subscription refetch, database-backed event deduplication/stale-observation handling and explicit Price matching. Outgoing requests pin `2026-04-22.dahlia`.

Existing server-owned Stripe subscription→user bindings remain usable without forcing new metadata or resubscription. A binding conflicting with fetched metadata is rejected. Restricted reconciliation supports both native and Stripe sources. Unknown Prices, live-mode events, live secret keys and malformed provider states do not grant access or silently downgrade existing state.

The existing production `stripe-webhook` function and destination were **not changed or deployed**. Its Phase 3A findings therefore remain production release work. The new handler is a separately named testing route and must not be substituted for the live endpoint during review.

Stripe refund/dispute/fraud events return an explicit review-required response; automatic risk-event entitlement policy is not implemented. Stripe `past_due`/`unpaid` currently become read-only under the prepared policy; a different web grace policy requires review. Current portal behavior, discounts, tax settings and actual customer cohorts were not mutated or exported. All audited live Prices have unspecified tax behavior; registrations/default tax settings still require review before acquisition activation.

## Shared contracts and retained work

Only `src/lib/subscription.ts` and `trustedMembership.ts` needed shared authorization integration: optional sanitized 2027 state is read only from the exact testing project; a missing not-yet-installed RPC preserves the existing isolated test schema path. Legacy production callers do not set this state. Existing lifecycle expiry scheduling is reused; `membership.ts` and `membershipLifecycle.ts` were not edited.

The SQL keeps existing membership/permission RPC signatures and adds effective Factory downgrade/class-selection tracking. Time expiry requires class selection even when no callback has arrived. Per-user advisory locking precedes new billing/claim row operations. Sportsman slot/48-hour/archive rules and Track Trace historical/read-versus-recording policies remain Phase 2 contracts.

The installation compares whitespace-normalized source fingerprints for the four shared SQL helpers it replaces. Any later membership/Track Trace drift stops the transaction before DDL. A local negative test proves this stop. The reviewed testing catalog fingerprints are:

| Helper | Normalized source MD5 |
| --- | --- |
| `membership_tier(uuid)` | `3c38be05d114ef5fe56322179cd58422` |
| `can_write_class_2027(uuid,text)` | `0597be18eaac74712bd3bfcb2060c0d5` |
| `choose_2027_class(text)` | `0e8ca0980c240ab2c8666b3302f9c76e` |
| `account_access_2027()` | `b4fd75e7fe63ef4ffd153fbbb2798d4d` |

Thirty-five preexisting concurrent Track Trace source/QA/test files were fingerprinted before implementation and checked afterward: **zero changed**. No concurrent Track Trace SQL/docs were edited. Applied Phase 1/2 migrations, root migration history, standalone OnlyLaps, historical native bridges, provider catalogs and production configuration were left untouched.

## Local validation

| Check | Result / scope |
| --- | --- |
| `npm test` | **707 passed, 0 failed, 0 skipped** in the current `tests/*.test.ts` discovery; includes the Phase 3B cases |
| `node --experimental-strip-types --test tests/billing2027*.test.ts` | **16 passed, 0 failed**; provider maps, HTTP authentication, PostgreSQL privileges/claims/cohorts/projection/downgrades/retention, client account switching, artifact identity/source-drift guards |
| Additional existing billing `.mjs` suites | **34 passed, 0 failed**: native controls, RevenueCat database lifecycle, subscription authorization and synthetic tier persistence |
| Application TypeScript | `npx tsc -p tsconfig.app.json --noEmit` passed |
| Shared edge TypeScript | Strict no-emit check of both new shared edge modules passed; thin Deno deployment entry points have not been executed in a hosted runtime |
| Local 2027 build | Passed with exact Preview branch/target flags and a synthetic testing publishable key; purchase/advertising holds retained. No deployment |
| Actual React browser fixture | **1440×1000 and 390×844 passed**, built styles loaded, no horizontal overflow, disabled purchase controls, annual selection, promo claim, canceled trial management and expired read-only state; **zero remote requests** |
| Post-install catalog verification SQL | **11 checks passed locally** on disposable PostgreSQL; not a hosted post-install result |
| Retention SQL | Runs locally and returns **16 UTC count/hash rows**, including original billing rows; meaningful seeded racing/billing preservation assertions pass |

Local PostgreSQL uses disposable PGlite/WASM. Eight queued claim submissions produce one grant with unchanged dates; the advisory lock and uniqueness are checked. This is not a substitute for multi-connection hosted concurrency acceptance after installation. Real Apple/Google eligibility, payment sheets, renewals and store price cohorts have not been exercised. No live purchase, charge or refund occurred. GitHub Actions was not triggered; no commit/push was performed.

The current regression count is the command's observed result, not a restatement of earlier reported Phase 2 totals. The 34 additional cases are separate from the 707-case npm run; the 16 new cases are included in it.

Reproduction commands use installed local dependencies only. Extra `.mjs` suites need `PGLITE_MODULE` pointing to `node_modules/@electric-sql/pglite/dist/index.js` and `REACT_TEST_RENDERER_MODULE` pointing to `node_modules/react-test-renderer/index.js`. Browser QA is `node qa/automation/billing-2027-local.mjs` and accepts `ONLYFAST_PLAYWRIGHT_MODULE` for an installed Playwright module. Local screenshots/results are in `tmp/phase3b-browser/`; these are synthetic UI evidence, not hosted acceptance.

## SQL artifacts and fingerprints

Artifacts live in `supabase/testing-2027/`. SHA-256 values cover exact file bytes:

| File | SHA-256 |
| --- | --- |
| `phase3b-subscriptions-install.sql` | `C6A57B6B217141DB0640C60191F5D2FF446E44F2A5B4A1DC5BDB909FC356FE9C` |
| `phase3b-subscriptions-retention.sql` | `05BA4C829BD5E368948978FB12B4438CFECD9EA8B31F705E5468B26D3D6BCB5D` |
| `phase3b-subscriptions-verify.sql` | `71E1C2B4C20D050933F057D10F39C4A32CA3361477421CA9D698EAF70CEB418B` |
| `phase3b-products.plan.json` | `E0AD65EC31948E8DDDCC14B8BA021B0DFD448A14BF38A36DE33CA8468E857680` |

`phase3b-subscriptions.manifest.json` records the exact project, organization, proposed migration name, byte lengths, hashes and `installation_authorized=false` / `deployment_authorized=false`. `node scripts/prepare-2027-phase3b.mjs` prepares/checks local artifacts without connecting to a database/provider. A changed SQL byte requires a new hash and review; do not install an earlier draft fingerprint.

### Installation instructions — for separate review, not executed

1. Review this implementation, the three SQL files, product contract and current shared Track Trace work. Resolve any source-drift stop by review, never by removing the guard blindly.
2. Independently verify the explicit testing account, project `mfzajhnfonrfuiwxgvhe` and organization `wxswxtsewczfijycqnwi`. Do not use Primary or production credentials.
3. Confirm prior order: Phase 1C bootstrap/API hardening → installed Track Trace foundation and Phase 2B → **already-installed combined Phase 2 archives/history** → reviewed Phase 3B. Never reapply Phase 1/2 to install Phase 3B.
4. Verify SHA-256, then run `phase3b-subscriptions-retention.sql` in UTC **before** installation and save every aggregate row. It returns counts/hashes, not customer records.
5. After separate installation authorization, apply `phase3b-subscriptions-install.sql` once in its transaction through the verified testing connection, recording migration name `onlyfast_2027_phase3b_subscriptions_testing`. Its exact-project, prerequisite, already-installed and shared-source guards must pass. No `db push` of root migrations is part of this handoff.
6. Immediately rerun retention **before fixture mutations** and compare all 16 count/hash pairs. Run `phase3b-subscriptions-verify.sql`: the project must match and all 11 checks must be true. Run security advisors against the installed testing schema. A mismatch stops acceptance.
7. Review sanitized own-account responses and private cohort candidates using synthetic accounts only. Deploy/configure the new testing functions only under separate deployment authorization. Webhook/worker gateway JWT handling must permit their explicit provider/worker authentication; claim/sync still independently validate the authenticated user. Never redirect the existing production webhooks or reuse production secrets.
8. Complete hosted feature/security/concurrency/retention acceptance and real native sandbox trials before considering any acquisition activation. A production migration/rollout requires its own separately reviewed artifact and authorization; this installation SQL deliberately refuses production.

Testing function configuration names are `ONLYFAST_2027_BILLING_ENABLED`, `BILLING_2027_ENVIRONMENT`, `BILLING2027_REVENUECAT_SECRET_API_KEY`, `BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION`, `BILLING2027_RECONCILE_AUTHORIZATION`, `BILLING2027_STRIPE_SECRET_KEY`, `BILLING2027_STRIPE_WEBHOOK_SECRET`, `BILLING2027_STRIPE_ACCOUNT_ID`, plus the testing Supabase server configuration. No values were provisioned or changed. Keep all server secrets out of Vite variables.

## Remaining launch blockers

1. **Apple:** resolve the App Store Connect agreement/authorization error; verify actual legacy prices, group relationships/levels, two-week introductory terms for both Pro intervals, territories and eligibility. No Apple state was invented or changed.
2. **Google:** separately authorize/configure reviewed new acquisition IDs/base plans and P14D offers for both Pro intervals. Existing seven-day offers and protected legacy cohorts remain unchanged. Verify replacement modes on actual sandbox binaries.
3. **RevenueCat/Median:** confirm distinct Sportsman entitlement, annual duration, new package/offer mappings, installed bridge identifier semantics and account-transfer policy. No global offering switch or historical custom bridge activation is authorized. Automated cross-account transfers remain quarantined.
4. **Paid cohorts:** reconcile verified prelaunch eligibility, original lineage, actual regional/discounted renewal price and source overlap. Complete candidate evidence before promising protected customer amounts; especially resolve Apple prices and historical Stripe $8/$10 cases. No production customer export was performed.
5. **Stripe:** sandbox acquisition configuration/verified ownership must be established before any new checkout flow. Review portal/discount/tax/grace and refund/dispute policy. The isolated compatibility implementation has not replaced the production endpoint; no production risk fix is claimed.
6. **Hosted verification:** SQL installation, testing function deployment/configuration, security advisors, multi-connection races and end-to-end native sandbox/hosted acceptance are pending by instruction. Provider managed trials cannot be certified from local fixtures.
7. **Release approval:** purchases and advertising holds remain. No January 2028 automatic price increases or price-change scheduler exists. Any later price transition requires provider-specific notice/consent review and separate authorization.

## Changed-file boundary

Existing files edited: `src/components/PlanSelection.tsx`, `src/lib/subscription.ts`, `src/lib/trustedMembership.ts`, `src/lib/subscription2027Catalog.ts`, and the legacy build-flag simulation in `tests/membershipSelection.test.ts` (all original behavioral assertions retained).

New files: the two shared edge modules; the five testing endpoint `index.ts` files listed above; `src/lib/billing2027State.ts`, `src/lib/subscription2027Billing.ts`, `src/components/Subscription2027Plans.tsx`; six `tests/billing2027*.test.ts` files and `tests/helpers/billing2027.mjs`; `qa/automation/billing-2027-local.mjs`; `scripts/prepare-2027-phase3b.mjs`; the three SQL files, product plan and manifest; and this report.

**Stop point reached: code, local validation and artifacts only. Do not install, deploy, publish products, change subscriptions or enable purchases from this report.**
