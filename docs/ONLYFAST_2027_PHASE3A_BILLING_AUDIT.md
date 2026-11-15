# OnlyFast 2027 Phase 3A — subscription infrastructure audit

Audit date: November 14, 2026 (America/Los_Angeles). Target launch: January 1, 2027.

Repository: `Apex88Vent/onlyfast`. Branch: `develop/onlyfast-2027`. Remote branch observed at `613c25d9f22616db4e218ace268c742b08868204`. This audit uses the primary checkout and preserves its concurrent, uncommitted Track Trace work.

**Status: audit and implementation plan only. Billing implementation and launch readiness are not complete.** The 2027 feature catalog exists, but paid subscription ingestion still supports the legacy free/Pro/Teams model. No trial-claim or 12-month price-protection ledger exists in the inspected testing schema. Apple store verification is blocked. The authorized Stripe live catalog and webhook metadata audit is complete within the scope below; customer cohorts, deployed code and runtime configuration remain unverified.

## 1. Scope and evidence

The only repository change made for this audit is this document. Provider checks were read-only. No products, offerings, subscriptions, webhooks, prices, database objects, environment variables, purchase gates, deployment settings, or customer records were changed. No purchases, restores, subscription-sync RPCs, billing portal creation, deployments, commits, pushes, or production Supabase queries were performed. Standalone OnlyLaps was not touched.

| Source | Check and result | Limit of evidence |
| --- | --- | --- |
| Repository | Branch, working tree, remote, remote branch head, billing source, migrations, tests, release documentation inspected | Existing local Track Trace changes remain outside this audit |
| Testing Supabase | Explicit **testing account** selector; project `mfzajhnfonrfuiwxgvhe`, organization `wxswxtsewczfijycqnwi`, `ACTIVE_HEALTHY`; environment RPC identifies the same project | Production schema/deployment parity was not assumed; Primary was not used |
| Testing database | Read-only catalog queries: subscription columns, constraints, policies, functions, grants, limits, scheduled expiration job; deployed edge-function inventory | No customer subscription rows or payment credentials exported |
| RevenueCat | Project/apps/products/entitlements/offerings/webhook integration read; fresh Apple/Google product store-state checks | Catalog presence does not prove store availability, actual customer prices, or published paywall behavior |
| Google Play via RevenueCat | Pro and Teams live products/base plans/offers returned successfully | Customer-specific legacy price cohorts and purchase histories were not read |
| Apple via RevenueCat | Both product reads returned `store_unauthorized`; subscription-group listing failed with nonretryable 403 citing missing/expired App Store Connect agreement | Actual prices, subscription groups/levels, availability and offer eligibility cannot be certified |
| Stripe | User explicitly authorized Apex88 Ventures, `acct_1TZK26GEWZrPYXmK`, live-mode GET checks: 3 products, 4 active Prices, 0 inactive Prices, 1 webhook endpoint; all list responses `has_more=false` | No customers, subscriptions, invoices, payment methods, events/delivery payloads, secrets, Payment Links, portal configurations or schedules read |

Stripe account selection was explicitly supplied by the user before account-specific checks. Only `GET /v1/products`, `GET /v1/prices` (active and inactive) and `GET /v1/webhook_endpoints` were executed against that account. No customer/payment resources or signing secrets were requested, read or exported. The results below describe catalog and endpoint metadata, not subscription usage, delivery success or deployed-handler parity. Standard Price listing excludes inline Prices, so the inventory is not proof that no other historical subscription price exists.

Read-only source/catalog checks were used. No regression suite, build, hosted purchase test, GitHub Actions run, or production acceptance run was started for this documentation-only audit. Earlier Phase 2 test results do not establish Phase 3 billing readiness.

## 2. Current billing architecture

### Web: Stripe directly

`src/components/StripeBuyButton.tsx` embeds Stripe Buy Button checkout. The signed-in Supabase UUID becomes `client-reference-id`; client plan selection or success-page query parameters are not entitlement authority. `src/lib/membership.ts` contains a public Stripe publishable key and these public button identifiers:

| Legacy selection | Buy Button identifier | Server mapping |
| --- | --- | --- |
| Pro | `buy_btn_1TdzjMGEWZrPYXmKqblFVGCp` | `STRIPE_PRO_PRICE_ID` → `pro` |
| Teams | `buy_btn_1TjNSYGEWZrPYXmKdJbu6VSP` | `STRIPE_TEAMS_PRICE_ID` → `teams` |

Live Product/Price identifiers were subsequently verified through the authorized read-only Stripe connector and are listed in section 3. The Buy Button → Payment Link → Price association and deployed `STRIPE_PRO_PRICE_ID`/`STRIPE_TEAMS_PRICE_ID` values were not read. Product default prices do not independently prove those runtime mappings. Do not substitute button IDs for Price IDs or read secret environment values into this report.

`supabase/functions/stripe-webhook/index.ts` verifies an HMAC over the signed timestamp and body, refetches the current Stripe subscription, and updates `public.user_subscriptions`. **Correction to the initial audit wording: it does not check timestamp freshness.** A captured valid signed request is not rejected solely for age. Add a bounded timestamp tolerance and replay/idempotency coverage in the reviewed implementation; do not change the live endpoint during this audit. Stripe recommends checking signature age as well as integrity. [Stripe signature and replay protection](https://docs.stripe.com/webhooks#preventing-replay-attacks)

The handler covers checkout completion, subscription created/updated/deleted, and invoice payment success/failure. Its price mapper recognizes exactly the two configured legacy Price IDs and throws for an unknown price. It reads the first subscription item. Adding an annual Pro price or Sportsman price without first changing this allowlist would fail synchronization. The two additional catalog Prices on the archived Teams product also require an explicit legacy-mapping decision; do not assume that they are accepted by the deployed handler or currently used by customers.

Unlike RevenueCat processing, this handler has no event-ID ledger. Refetching current subscription state reduces stale-event risk, but duplicate deliveries can repeat writes. Requests do not pin a Stripe API version; the account default for outgoing GET requests remains unverified and is distinct from the verified webhook version.

**High-priority compatibility finding:** the live webhook uses `2026-04-22.dahlia`, while repository invoice handling reads only `invoice.subscription`. Stripe's Basil change replaced that field with `invoice.parent.subscription_details.subscription`, after checking the parent type. A modern invoice payload lacking the old field would make this repository handler throw before reconciliation. Add version-compatible parsing and sandbox fixtures before launch. This is a source/endpoint-version mismatch; deployed production source and actual delivery failures were not inspected or reproduced. [Stripe invoice parent-field migration](https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects)

`create-billing-portal-session` authenticates the caller, finds their Stripe customer/subscription, and creates a portal session. It does not select an explicit portal configuration. The live default portal's permitted products, cancellation options and proration settings remain unknown. It was not invoked because session creation/backfill can write. `SubscriptionSuccess.tsx` waits for the database paid state rather than granting access from a redirect.

### iOS/Android: stock Median → RevenueCat → store

The selected path is the stock `NativePurchaseController`, as documented in `native/README.md` and the current portion of `docs/MEDIAN_PAYWALL_RELEASE_PLAN.md`. Historical custom Kotlin/Swift bridge sources, `releaseNativeBilling.ts`, and `releaseNativeTransport.ts` are retained development material and must not be reactivated.

Current source has `NATIVE_PURCHASES_READY = true`. Older documents describing it as false are historical. Runtime access also requires native-wrapper detection, `VITE_REVENUECAT_ENABLED`, the corresponding Android/iOS flag and configuration. Production flags and installed binary behavior were not read or changed. The 2027 Preview build explicitly disables purchase/advertising flags and keys and requires the testing target/branch; preserve that isolation.

The controller configures/logs RevenueCat in using the authenticated Supabase UUID, serializes bridge operations, invalidates results after account changes, and poisons timed-out native sessions to prevent late identity responses racing later purchases. Restore uses the original provider. Purchases open the stock RevenueCat paywall; a successful native result still requires authenticated server reconciliation before app access changes.

The only preflight package mappings are `pro: $rc_monthly` and `team: $rc_custom_teams_monthly`. The preflight compares them with `getOfferings().identifiers`, while purchase calls `presentPaywall()` without a selected package argument. Median's documentation describes identifiers and a separately configured paywall; it does not establish this installed binary's exact identifier semantics. Verify that contract on real sandbox binaries before adding annual/Sportsman choices. This audit does not assert a proven bridge defect. Preserve the stock flow and account guards. [Median RevenueCat bridge](https://docs.median.co/docs/revenue-cat)

After purchase/restore, `sync-revenuecat-subscription` validates the Supabase token, fetches RevenueCat's server subscriber snapshot, applies it through a service-only SQL RPC and returns database state. The audit did not call it. Native controls block a second purchase for an already paid account and direct subscription changes to provider management. Native-wrapper payment visibility suppresses the web Stripe path; no blanket external checkout change is proposed.

### Entitlement synchronization and expiration

`supabase/functions/_shared/revenuecat.ts` maps trusted server snapshots to `free`, `pro` or `teams`, with Teams taking precedence. Only supported App Store/Play recurring subscription records qualify; dates, refunds, expiration and grace fields are checked. Test Store/promotional/Stripe RevenueCat grants are not a general access source in this mapper. A RevenueCat promotional grant alone therefore does not implement the requested Sportsman claim.

The handler has a restricted Apple sandbox compatibility exception in addition to broad sandbox configuration. Its exact app/product/transaction checks must be retained and reviewed when new SKUs are proposed. Do not infer that all sandbox events are rejected from older documentation, or broaden sandbox acceptance for production.

`revenuecat-webhook` validates its shared authorization secret, envelope, app allowlist, environment and user identity; handles transfer participants; refetches current server state; and deduplicates event/user pairs. `onlyfast_apply_revenuecat` rejects invalid plans/statuses, deleted users, duplicates and older observed snapshots. Client metadata and native success responses cannot grant paid access.

Testing has an active once-per-minute `onlyfast-expire-revenuecat` cron job. Its SQL updates expired RevenueCat-backed rows so subscription projection recomputes access. Browser membership refresh also reacts to expiry, visibility, focus and online changes. Stripe `active`/`trialing` projection does not independently expire from `current_period_end`; missed Stripe terminal events need a reconciliation strategy. Cancellation-at-period-end remains paid while provider state is paid; Stripe `past_due`/`unpaid` do not currently qualify. Native snapshot handling includes supported grace dates. Cancellation, renewal preference, billing retry and final expiration must remain separate concepts.

## 3. Verified product and entitlement inventory

### RevenueCat and native stores

RevenueCat project: `proj79983fe3` (**OnlyFast**).

| App | RevenueCat app ID | Store identity |
| --- | --- | --- |
| Apple | `app82192c9834` | Bundle `app.onlyfast`; configured ASC and subscription keys, but live store reads blocked |
| Google Play | `appd348665a60` | Package `app.onlyfast`; configured service account; successful product reads |
| Test Store | `app589cba2036` | Synthetic RevenueCat testing, not proof of store billing support |

| Provider product identifier | RC product ID | Verified state | 2027 functional mapping |
| --- | --- | --- | --- |
| Apple `app.onlyfast.pro.monthly` | `proda39dd87405` | RC catalog monthly/one-week trial; actual store state unavailable | Existing Pro → new Pro, retain subscription identity |
| Apple `app.onlyfast.teams.monthly` | `prod901efecc38` | RC catalog monthly/one-week trial; actual store state unavailable | Existing Team → Factory, retain subscription identity |
| Play `pro:pro` (product `pro`, base plan `pro`) | `prod9c2b5b4888` | ACTIVE, monthly; US **$4.99**; new subscribers available; seven-day grace | Existing Pro → new Pro, preserve actual cohort price |
| Play `teams:teams` (product `teams`, base plan `teams`) | `prodc26de99b58` | ACTIVE, monthly; US **$7.99**; new subscribers available; seven-day grace | Existing Team → Factory, preserve actual cohort price |
| Play `rookie:rookie` | `prod8b4607e845` | Store `not_found`; no base plans returned | Not an established paid Rookie subscription or Sportsman trial |
| Test `Pro` / `Teams` | `prod2c057ace8d` / `prodf4c9778135` | Test Store products | Synthetic only |
| Test `yearly` | `prod1aa52dd370` | Catalog duration **P1M**, despite “Yearly” label | Not an implemented $60/year store product |

Play offers `1weekpro` and `1weekteams` are ACTIVE, US-only, seven-day free acquisition offers. They are not the requested one-month Sportsman offer. Base plans report charge-on-next-billing-date replacement mode; actual upgrade/downgrade behavior still needs provider/binary testing.

Legacy UI labels show $5 Pro/$8 Teams. Google verified rates are $4.99/$7.99; Stripe's current default monthly Prices are $5/$8, with additional $8/$10 Prices on an archived Teams product. Apple actual rates remain unverified. Catalog amounts do not establish an individual customer's discounts or contracted amount. Preserve the actual renewal amount/currency/territory for each eligible customer. Do not raise existing Google customers by one cent to match rounded labels.

### Existing entitlements and offerings to preserve

| Identifier | Current association and implication |
| --- | --- |
| `OnlyFast Pro` (`entl73664a0fc7`) | Legacy Pro **and Teams** products, plus paid Test Store products. Sportsman must not simply receive this entitlement under the current mapper |
| `OnlyFast Teams` (`entlcd6b151566`) | Teams products; Teams intentionally also receives Pro. Preserve precedence and both associations |
| `onlyfast_monthly_v1` (`ofrng35794ca3b5`) | **Current** offering, with Pro `$rc_monthly` (`pkge0fef64356e`) and Teams `$rc_custom_teams_monthly` (`pkgead82d815af`), mapped across Apple/Play/Test Store |
| `default` (`ofrng9c4268b9bb`) | Noncurrent; test “Yearly” in monthly package and incomplete legacy packages |
| `3 packages` (`ofrng63230c6ed1`) | Noncurrent; incomplete Rookie package |

The current offering has paywall ID `pw3a65004212ef4af8`; its metadata still says staging/rookie_pro_teams. Metadata is not a purchase safety gate. Paywall publication/design was not changed or certified. No Sportsman or Factory-named products, and no real-store annual Pro product, were found in this RC catalog. No Stripe/Web Billing app was listed; direct Stripe subscriptions are independent of this RC product graph.

RevenueCat webhook `whintgrd6b6ff2503`, “OnlyFast Supabase — Production,” is active and targets `https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/revenuecat-webhook`. Integration environment, app and event filters are null, so handler restrictions matter. **Do not redirect this integration to testing.** Testing's deployed edge-function inventory contains `track-trace-setup-context` only; billing webhook/sync endpoints are not deployed there.

Preserve existing Apple/Play application identities, product/base-plan IDs, RevenueCat project/app/product/entitlement/package identifiers, and UUID identity mapping. Future reconciliation must retain Stripe customer/subscription/Price IDs, Apple original-transaction linkage and Google purchase-token linkage securely. Those customer-specific identifiers were not exported. Changing a display name to Factory does not require canceling or recreating an existing Teams subscription. RevenueCat entitlements are access labels, not store renewal-price schedules. [RevenueCat entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)

### Stripe live catalog — authorized read-only follow-up

Account `acct_1TZK26GEWZrPYXmK` (Apex88 Ventures), `livemode=true`. The unfiltered Product list returned three products. Explicit active/inactive Price lists returned four active and zero inactive standard Prices. Every Price is USD, licensed recurring, interval `month`, interval count `1`, `trial_period_days=null`, `lookup_key=null`, and `tax_behavior=unspecified`. All three products have tax code `txcd_10202000`; this does not establish tax registration or collection behavior.

| Product / state | Product ID | Price ID / state | Catalog amount | Required January 2027 treatment |
| --- | --- | --- | --- | --- |
| Pro subscription — active; listed Price is default | `prod_UcascfoFbEa4Lc` | `price_1TdLgNGEWZrPYXmKdkpNb1EQ` — active | $5/month | Preserve ID and verified eligible customers' renewal terms; effective access maps to new Pro |
| Teams subscription — active; listed Price is default | `prod_Uip4WeA7nFakyh` | `price_1TjNQBGEWZrPYXmKH5vSvdJB` — active | $8/month | Preserve ID and eligible renewal terms; effective access maps to Factory |
| Teams subsciption — archived product; listed Price is default | `prod_UcasCW8QYF7xsV` | `price_1Tj1FXGEWZrPYXmKiyLHivYW` — active | $8/month | Retain as a historical identifier; establish ownership/eligibility and mapper coverage before any future migration |
| Same archived Teams product | `prod_UcasCW8QYF7xsV` | `price_1TdLgjGEWZrPYXmKXwFYPTPd` — active, nondefault | $10/month | Unresolved historical tier/rate case. Do not automatically relabel, reprice, deactivate, or assume no subscribers |

No Sportsman/Factory-named Product, annual Price, $4.99 Sportsman Price, $7.99 new Pro Price, $60/year Pro Price or $14.99 Factory Price was returned in this standard catalog. The $10 historical Price is not evidence of an annual or Factory subscription. Product archival and Price activity are distinct flags; catalog state alone cannot prove customer usage or renewal health.

For the transition, retain the existing Pro/Teams identifiers and append reviewed new acquisition Prices/products only after authorization. Sportsman needs its own Product/tier mapping. Pro monthly/annual variants should belong to the reviewed Pro Product, while Factory can retain Teams continuity through explicit access mapping; whether to retain its current customer-visible product label or introduce a new acquisition Product requires approval. Do not rename or reuse the Pro $5 Price as Sportsman because the amounts are close. Preserve both historical Teams Price IDs until separately scoped reconciliation establishes their role.

### Stripe webhook metadata

| Field | Verified value |
| --- | --- |
| Endpoint ID | `we_1Te25VGEWZrPYXmKqwfuKzXU` |
| State | `enabled`, `livemode=true` |
| Destination | `https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/stripe-webhook` — production |
| Endpoint API version | `2026-04-22.dahlia` |
| Enabled events (complete returned list) | `checkout.session.completed`; `customer.subscription.created`; `customer.subscription.updated`; `customer.subscription.deleted`; `invoice.payment_succeeded`; `invoice.payment_failed` |
| Other metadata | `application=null`, `description=null`, `metadata={}` |

One endpoint was returned, `has_more=false`. No signing secret or event/customer payload was requested. Enabled status does not prove delivery success or deployed-source parity. The returned endpoint list does not certify other event-destination mechanisms outside this API.

The six selected event types match the repository handler's six explicit cases. There is no returned subscription to asynchronous checkout success, `invoice.paid`, refund/dispute/fraud or subscription-schedule lifecycle events. Define the actual behavior required for the approved checkout methods and later schedule reconciliation, implement and sandbox-test the corresponding handlers, then separately review any endpoint event changes. Do not subscribe to every event or change the live endpoint during the audit. Never redirect this production destination to testing or create real invoices/events to test it.

The January 1 transition therefore requires: a version-compatible/replay-protected/idempotent handler; a registry that retains valid legacy Prices and adds reviewed new Prices; independently verified customer/cohort eligibility; provider-specific price-protection planning; and an isolated sandbox endpoint/configuration. Portal policy, Buy Button/Payment Link linkage, deployed allowlist values and existing customer schedule conflicts remain outside this authorized inventory read.

## 4. Database and feature-access audit

Testing `public.user_subscriptions` has a unique authenticated `user_id`, Stripe customer/subscription/price/checkout references, legacy `plan`/`status`, `current_period_end`, source, separate Stripe/RevenueCat plan/status fields, RevenueCat product/entitlement/store/expiration/event/observation fields, and class/onboarding state. There is no inspected plan CHECK restricting text, but SQL projection and ingestion explicitly accept legacy paid values. Adding a string to a client union would not authorize a new product safely.

`public.revenuecat_webhook_events` has primary key `(event_id,user_id)`. `onlyfast_apply_revenuecat` is service-only. Authenticated users have own-row SELECT access to subscriptions and no INSERT/UPDATE/DELETE privilege; they cannot execute that application RPC. These checked grants are useful safeguards, not a complete production security certification.

The catalog search found only `public.user_subscriptions`, `public.revenuecat_webhook_events` and `onlyfast_private.subscription_2027_limits` among subscription/billing/trial/cohort/grandfather/webhook-named tables in the inspected schemas. There is no inspected structured ledger for eligibility, trial claims, protected renewal prices, grandfather end dates, notice/consent evidence or future provider price actions. Trusted promo metadata exists but is not a cohort ledger.

`onlyfast_project_subscription` chooses active/trialing Stripe Pro/Teams first, then unexpired active RevenueCat Pro/Teams. An active Stripe Pro can therefore outrank native Teams. Preserve paid provider facts and define an explicit conflict policy before normalizing tiers; do not silently cancel a losing provider subscription. Existing prevention of double purchase should remain.

The 2027 server limit rows already match the requested Sportsman/Pro/Factory class/setup/edit/scan access. Current Setup Assist allowances are one/weekend for Sportsman (Rookie allowance), unlimited for Pro and Factory (legacy Team allowance). These are allowance facts, not an AI cost budget approval. Archive metadata and class-selection requirements live separately in private tables.

| New plan | Target billing | Existing feature support | Billing work still required |
| --- | --- | --- | --- |
| Sportsman | $4.99/month | One class; 2 active base/5 active race slots; archive/history policy; 48-hour editing; 2 scans/weekend; 1 Assist/weekend; no ads/new recording | New distinct product/entitlement mapping, server trial claims and provider checkout |
| Pro | $7.99/month or $60/year | One class; unlimited setups/scans/Assist; full Track Trace; no ads | New-customer pricing, annual product/base plan/Price, legacy price protection |
| Factory | $14.99/month | Unlimited classes/setups/scans/Assist; full Track Trace; no ads | Teams→Factory feature alias, new-customer pricing and legacy protection |
| Unsubscribed | No automatic charge | Eligible historical read-only behavior; no new paid writes/recording | Consistent paid-expiry projection and trial-end handling |

`subscription2027Catalog.ts` is explicitly display-only and contains target prices, including Pro annual $60. Live purchase controls still use legacy plans. The catalog's Sportsman/Factory “annual pricing to be determined” text should become an explicit monthly-only choice unless annual plans are separately approved. `trustedMembership.ts` still resolves paid Pro/Team; server/test overrides supply newer tiers in the isolated testing flow. SQL resolves legacy Teams as `team`, and Phase 2 converts ordinary unpaid Rookie to `unsubscribed` except explicit testing Rookie. The January Rookie transition must therefore be implemented as a deliberate server entitlement policy; it is not already provided by the test switcher.

## 5. Recommended migration design

### Separate feature access, provider facts and price protection

Use an additive server product registry and eligibility ledger. Retain raw provider IDs and legacy source fields for old clients; derive a canonical 2027 effective tier separately. Map qualifying legacy Pro to **Pro**, qualifying legacy Team/Teams to **Factory**, and unpaid accounts to the approved transition/read-only policy. A $4.99 old Pro purchase remains Pro; price alone must never classify it as Sportsman.

Registry keys should include provider, app/store, environment, product/base plan or Stripe Price ID, interval and version/effective dates. Keep all valid legacy identifiers. Define a new distinct Sportsman entitlement; retain `OnlyFast Pro`/`OnlyFast Teams` and legacy product associations. A Factory alias can be additive, but renaming/removing old keys would break older binaries and server mappers. New Pro annual access must map to the same functional Pro tier, without broad substring/name matching.

A proposed versioned 2027 offering can contain Sportsman monthly, Pro monthly, Pro annual and Factory monthly. Preserve the old offering/packages for old binaries. Exact new SKU/base-plan/entitlement/package identifiers and the offering-selection mechanism require review; no new IDs were created or reserved here. Do not switch the global current offering before compatibility and sandbox acceptance pass.

Record grandfather eligibility from verified provider state at the agreed launch cutoff, including original plan, currency, amount, interval, provider subscription lineage, protection start/end, later migration status and required notices/consent. Snapshotting must be idempotent, auditable and recoverable. Do not derive historical eligibility from a current UI label, client clock, editable user metadata or merely an account creation date. Keep payment/purchase tokens out of client-readable tables and logs.

### Rookie claim and transition

Use an authenticated server claim endpoint with atomic one-claim-per-eligible-user enforcement and an immutable claim record. Eligibility must use prelaunch evidence, exclude ineligible paid/previously claimed identities under approved rules, and withstand concurrent retries/account switching. A time-limited server Sportsman grant can supply a no-payment promotional month; it must not create a subscription, collect payment or start automatic billing. Paid conversion requires a separate authorized provider transaction and applicable consent.

If the owner instead chooses an auto-renewing store introductory trial, verify store eligibility and disclose renewal/payment terms; do not promise every existing Rookie can claim it. Apple allows one introductory offer per subscription group, so a new SKU does not reset a prior user's group eligibility. Current one-week Google offers are not equivalent to the proposed month. [Apple introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/)

The claim's expiry must be independent of the transition-window deadline. Expiry removes trial write permissions and preserves eligible historical records; it must not delete setups, results, sessions, telemetry or archives. No recurring charge follows a server-only trial automatically.

### Platform-specific 12-month protection

**Stripe:** Keep each existing subscription and its actual recurring Price. After approved cohort classification, a subscription schedule can retain that phase until the permitted renewal and change to the reviewed new Price afterward. Preserve anchors, quantities, discounts, tax settings and existing schedule/cancellation intent; avoid immediate proration, cancellation/recreation and `cancel` schedule end behavior. Existing schedules need conflict review. A new Price does not itself migrate existing subscriptions. A calendar year of protection is not necessarily 12 future schedule iterations. Recheck notice/consent obligations and simulate exact invoices before any authorized action. [Stripe subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)

**Apple:** Preserve existing subscriber prices when publishing a new-customer price. Ending preservation later is a separate guarded provider action, with territory-specific timing, notifications and consent requirements; it is not an entitlement expiry in RevenueCat. Do not promise a universal exact-date charge. Retain product, group and original-transaction continuity; do not unlist renewal products merely to hide legacy acquisition. Resolve the agreement error first, then verify groups, levels, actual price cohorts and eligibility. Regional effective dates require careful cutoff handling. [Apple subscription pricing](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/), [RevenueCat price changes](https://www.revenuecat.com/docs/subscription-guidance/price-changes)

**Google Play:** New base-plan prices normally leave existing subscribers in legacy price cohorts. Keep those cohorts throughout protection; later migrate the reviewed cohort/regions through Play's supported process. Apply the required opt-in or eligible opt-out procedure and notice lead time; a renewal can move later than the nominal cutoff. Keep product/base-plan and purchase-token continuity. Validate replacement/proration and resubscription effects separately. Do not force customers to cancel/rebuy to rename Teams as Factory. [Google Play price changes](https://developer.android.com/google/play/billing/price-changes)

**RevenueCat:** Continue aggregating native receipts and access. It is not the scheduler that raises Apple/Google renewal prices after 12 months. Observe provider price/renewal state and reconciliation evidence. Preserve UUID login/transfer safety, app/environment allowlists, stale-event protection and bounded sandbox exceptions. Provider changes require separate reviewed actions later; no products, offers, schedules or mutations are prepared through live APIs in this audit.

Price-protection expiry must not expire functional Pro/Factory access while the underlying subscription remains paid. Failure to consent/pay later follows the provider's actual access expiration and historical read-only rules.

## 6. Required decisions and unresolved checks

| Decision/blocker | Recommended starting point / evidence required |
| --- | --- |
| Launch timezone and interval | Propose Jan 1, 2027 00:00 America/Los_Angeles (`2027-01-01T08:00:00Z`); owner must confirm |
| “30-day” window | A half-open 30-day interval starting Jan 1 ends Jan 31 at the same time, with Jan 30 the last full claim day. Including all Jan 31 would be 31 days. Specify the intended boundary |
| “One month” trial | Decide calendar month versus 30 days, start-at-claim, eligibility cutoff, previous trial handling and late claims extending past the transition window |
| Rookie transition access | Define whether all eligible Rookie users keep legacy write access during the 30 days or only claimants receive Sportsman; keep ad/purchase holds unchanged |
| Protected customer cohort | Define active/trialing/grace/canceled-but-paid eligibility at cutoff, existing introductory/discounted plans, annual customers if any, refunds and prior lapses |
| Protection duration | Prefer a common Jan 1, 2027–Jan 1, 2028 window if that is the business intent; clarify calendar year versus 12 paid renewals. Never charge the new price before approved protection ends |
| Rate promise | Play catalog is $4.99/$7.99; Stripe defaults are $5/$8 with additional historical Teams $8/$10 Prices. Confirm individual eligibility/discounted terms through separately authorized reconciliation and obtain Apple proof before promising amounts |
| Plan changes/resubscribe | Define whether voluntary upgrade, annual conversion, cancellation/lapse, cross-store move or account transfer ends protection; no implicit forfeiture |
| Upgrade/downgrade policy | Specify timing, credits/proration and provider-specific replacement settings. Apply class selection/quota locks when the effective downgrade occurs, not when a future downgrade is requested |
| Payment recovery | Define Stripe grace/retry behavior and reconciliation frequency, respecting native grace states and terminal expiry |
| Provider conflict | Decide highest qualifying access versus legacy Stripe-first precedence; prevent double purchase and route resolution without automatic cancellation |
| Apple live audit | Owner resolves agreement outside this audit; reread products, prices, subscription groups/levels, offers and territory availability |
| Stripe follow-up | Product/Price/webhook metadata audit completed in the selected live account. Still verify Buy Button/Payment Link linkage, deployed Price allowlist, portal configurations and schedule compatibility in a separately scoped read. No customer/cohort export authorized by this catalog audit |
| Stripe handler readiness | Invoice parsing mismatch with verified endpoint API version, no signature-age tolerance and no Stripe event ledger require reviewed sandbox implementation. Do not patch production under audit authorization |
| Taxes/currency | Confirm whether targets are USD base prices, regional conversions and tax-inclusive display. All four Stripe Prices have `tax_behavior=unspecified`; Product tax codes alone do not prove collection. Tax registrations/default settings were not audited or activated |
| Storefront rules | Review current native purchase/management links and required disclosures for each distribution territory before release; preserve wrapper web-payment suppression until reviewed |
| Deployment evidence | Testing has no billing functions deployed. Production billing endpoint code/version, flags and database parity remain unverified; no production access is implied by this report |

## 7. Track Trace coordination and preservation constraints

Current local work includes Track Trace library/menu/page/review/API/config changes, recorder/scanner/publication/telemetry/circuit additions, community/live SQL and QA/tests. None were edited. Do not refresh, stash, revert or overwrite them as part of billing work.

Billing shares `src/lib/membership.ts`, `subscription.ts`, `trustedMembership.ts`, `membershipLifecycle.ts`, membership revision hooks, and server membership RPCs with Track Trace. Phase 2 archive/class-selection guards and Track Trace policies consume the same effective tier. Existing database work uses a per-user advisory transaction lock (`hashtextextended(user_id::text,0)`), followed by membership/record operations. A billing transition must use a compatible lock order; test that ordering rather than assuming a row-only webhook update is safe.

Freeze the existing feature-consumer contract until coordinated review: `public.get_onlyfast_membership`, `public.onlyfast_subscription_tier`, private membership/transition helpers and Track Trace enable/history predicates. A later canonical tier change must preserve RPC shape and identity checks and correctly trigger Factory→single-class selection even when the raw legacy plan string does not change. `team` and `factory` aliases need explicit verification wherever recording requires Pro/Factory.

Sportsman trial/purchase must not grant new Track Trace recording. Canceled/unsubscribed users must retain only eligible historical viewing. Archive restoration, active-slot recovery, locked 48-hour cards, class selection and quota handling remain Phase 2 responsibilities. Billing expiry/downgrade must preserve underlying setups, race schedules, results, session links, timing, telemetry and analysis. Never implement retention by deleting racing rows.

Keep `src/features/track-trace/**`, concurrent Track Trace SQL/tests/docs, standalone OnlyLaps, historical custom bridges and production advertising/purchase holds outside the billing patch. Additive billing contracts first; coordinate any shared membership edits with the current Track Trace owner before implementing them.

## 8. Recommended implementation sequence and acceptance gates

1. **Close audit gaps and approve rules.** Confirm the decisions above, resolve Apple's agreement error, verify actual cohorts and historical Stripe $8/$10 cases under separately scoped access, and pin the integration/API/binary contract. Stripe account selection and Product/Price/webhook inventory are complete. Do not mutate live billing while closing the remaining gaps.
2. **Design and review testing-only infrastructure.** Add private product registry, price-protection/claim ledgers and auditable provider event/reconciliation state. Add forward-only SQL guarded to the exact testing project. Do not edit/reapply installed Phase 1/2 migrations or assume testing billing functions already exist.
3. **Implement authoritative normalization in isolation.** Preserve legacy receipt support while mapping effective Sportsman/Pro/Factory/unsubscribed access. Add annual price support, idempotent Stripe ingestion, bounded reconciliation and atomic claims. Keep provider credentials/environment separation and no client-written entitlement fields.
4. **Coordinate shared authorization changes.** Review membership/class/archive/recording contracts against the latest Track Trace head; preserve lock order. Verify expiry and effective downgrade transitions before touching purchase UI.
5. **Prepare provider sandbox configurations only after authorization.** Review exact product/entitlement/base-plan/Price identifiers, annual interval, group levels, localized prices, offers and legacy renewal availability. Test stock Median compatibility on iOS/Android binaries. Never point testing at the existing production webhook or copy production secrets as a shortcut.
6. **Implement purchase/management UI behind disabled release gates.** Use confirmed provider-localized prices and interval disclosures; keep the display catalog separate from authorization. Test Pro annual without turning the test “Yearly” monthly product into evidence. Preserve old binaries/current offering until a reviewed compatibility rollout.
7. **Complete testing/Preview acceptance.** Synthetic accounts and provider sandboxes only. Run full local regression/type checks and appropriate CI, then hosted feature and end-to-end sandbox billing verification. Test duplicate/out-of-order/forged events, transfer/account-switch races, stale snapshots, grace/refund/expiry, annual renewals, claim concurrency, source conflicts and clock boundaries. Verify old Pro/Teams receipts grant correct new functionality at unchanged prices. Compare racing retention counts/hashes before/after fixture mutations; test archives, class selection, historical telemetry and recording denial.
8. **Separate launch approval from audit.** Review cohort counts, notices/terms/consent, store approvals and rollback strategy before any production activation. Feature rollout, acquisition-price rollout and later protected-cohort price increases are distinct approvals. The January 2028 transition needs provider-aware reconciliation/operations; no future automatic mutation job was created here.

Recheck production isolation at every implementation stage: exact testing project, testing credentials, disabled Preview purchase flags, no production Vercel deployment/push side effects, no Primary connector, no live customer mutation. A rollback should disable new acquisition/claims safely while preserving purchased access and ledger history; it must not cancel customers or delete racing data.

## 9. Exact proposed file scope

**Applied in Phase 3A audit:** `docs/ONLYFAST_2027_PHASE3A_BILLING_AUDIT.md` only.

The following is the proposed implementation patch scope for review, not a claim that these changes exist. New files use proposed names; a timestamped applied migration must be generated only after SQL review and installation authorization. No provider configuration is changed by writing this plan.

| Exact path | Planned responsibility |
| --- | --- |
| `supabase/testing-2027/phase3a-billing-infrastructure.sql` (new) | Testing-project-guarded registry, eligibility/claim/protection/event schema, grants, additive RPCs and forward-only projection changes |
| `supabase/functions/_shared/subscription-catalog-2027.ts` (new) | Server product/base-plan/Price allowlist and canonical tier/interval normalization with legacy compatibility |
| `supabase/functions/_shared/revenuecat.ts` | Add Sportsman/annual/Factory normalization without weakening receipt, identity or environment validation |
| `supabase/functions/revenuecat-webhook/index.ts` | Preserve dedup/snapshot/transfer checks; ingest approved normalized state |
| `supabase/functions/sync-revenuecat-subscription/index.ts` | Authenticated normalized snapshot reconciliation; never trust native success alone |
| `supabase/functions/stripe-webhook/index.ts` | Registry-based legacy/new Price support, event ledger, signature-age tolerance, reviewed API/invoice compatibility and lifecycle state |
| `supabase/functions/create-billing-portal-session/index.ts` | Explicit reviewed testing portal configuration and customer ownership; no implicit new-price permission |
| `supabase/functions/claim-2027-sportsman-trial/index.ts` (new) | Authenticated, idempotent eligible claim with no automatic subscription/charge |
| `supabase/functions/reconcile-2027-subscriptions/index.ts` (new) | Restricted provider-state reconciliation and audit evidence; no unapproved price-changing scheduler |
| `src/lib/subscription2027Billing.ts` (new) | Typed client billing/claim state contract, with no entitlement authority or secrets |
| `src/lib/subscription2027Catalog.ts` | Approved monthly/annual labels and transition disclosures; no invented live IDs |
| `src/components/PlanSelection.tsx` | Reviewed 2027 tier/interval choices, claim entry and transition state |
| `src/components/MembershipPlanCard.tsx` | Display interval/eligibility state without granting access |
| `src/components/MembershipComparison.tsx` | Approved Sportsman/Pro/Factory comparison and historical access copy |
| `src/components/MembershipPaidAction.tsx` | Provider/interval selection, trial separation and duplicate-billing prevention |
| `src/components/NativeSubscriptionControls.tsx` | Stock native paywall/restore/provider management for approved catalog |
| `src/components/StripeBuyButton.tsx` | Reviewed web-only purchase selection for confirmed new and legacy mappings |
| `src/hooks/useNativeSubscription.ts` | New package/interval types while retaining account-switch and paid-account guards |
| `src/lib/nativePurchaseController.ts` | Reviewed preflight mappings/contract; retain stock paywall and timeout/identity protection |
| `src/lib/nativePurchases.ts` | Typed approved catalog integration; preserve all rollout gates |
| `src/pages/SubscriptionSuccess.tsx` | Provider-confirmed interval/tier and pending-state messaging |
| `src/lib/membership.ts` | **Shared; coordinate first.** Canonical tier metadata/legacy aliases and reviewed web mapping, preserving feature limits |
| `src/lib/trustedMembership.ts` | **Shared; coordinate first.** Authorized effective-tier/expiry resolution, no user-metadata grant |
| `src/lib/subscription.ts` | **Shared; coordinate first.** Canonical server state and provider management routing |
| `src/lib/membershipLifecycle.ts` | **Shared; coordinate first.** Trial/protection/provider expiry refresh semantics |
| `tests/billing2027Migration.test.ts` (new) | Legacy identifier preservation, registry and canonical mapping |
| `tests/billing2027Database.test.ts` (new) | Privileges, source conflicts, lock-order/effective downgrade and retention integration |
| `tests/billing2027Webhooks.test.ts` (new) | Provider lifecycle, duplicates/stale events, signature-age/replay cases, modern/legacy invoice fixtures and environment rejection |
| `tests/billing2027TrialClaims.test.ts` (new) | Eligibility, exact calendar boundaries, atomic retries and no-autocharge behavior |
| `qa/automation/billing-2027-sandbox.mjs` (new) | Explicit sandbox-only hosted acceptance with no live purchase fallback |
| `docs/ONLYFAST_2027_PHASE3A_BILLING_AUDIT.md` | Update verified decisions/evidence as implementation proceeds |

Existing regression suites to reuse include `revenuecat.test.ts`, `revenuecatEndpoints.test.ts`, `revenuecatDatabase.mjs`, `stripeSubscriptionLifecycle.test.ts`, `nativePurchaseReadiness.test.ts`, `nativeSubscriptionControls.mjs`, membership authorization/lifecycle tests, 2027 subscription/isolation/database tests and Track Trace security/history suites. Extend existing tests only for changed contracts; do not rewrite the current Track Trace tests or manufacture passing counts in this audit.

`src/hooks/useMembershipRevision.ts`, `src/lib/testSubscription.ts`, `src/lib/nativeEnvironment.ts`, `src/lib/paymentVisibility.ts`, `_shared/usage-authorization.ts` and the existing feature RPC consumers are review/freeze dependencies, not routine implementation edit targets. If a contract change requires them, expand the approved scope explicitly. Applied `supabase/migrations/**`, current Phase 2 SQL, `native/**`, `src/lib/releaseNativeBilling.ts`, `src/lib/releaseNativeTransport.ts`, production environment files and standalone OnlyLaps are excluded.

## 10. Audit conclusion

The existing system provides authenticated native reconciliation, legacy product continuity, source projection, protected client access and useful expiry safeguards. It does not yet provide the Sportsman paid/trial path, real Pro annual billing, a 12-month grandfathering ledger or a coordinated provider price-transition process. The Stripe follow-up verifies $5 Pro/$8 current Teams monthly catalog prices, two additional historical Teams Prices and the production endpoint version/events. Its invoice-format and signature-freshness findings must be addressed in reviewed implementation. Existing Team functionality can map to Factory while preserving subscriptions; existing Pro must retain Pro access even though its legacy price resembles new Sportsman.

Proceed to implementation only after the business boundaries and provider inventory gaps are resolved and the testing-only schema/contract plan is reviewed. This document does not certify production billing, authorize live changes, or declare Phase 2 hosted acceptance complete.
