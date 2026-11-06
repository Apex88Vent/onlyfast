# OnlyFast final Android and iOS release-readiness audit

November 6, 2026. **Verification only; no application changes.**

## Recommendation

**NO-GO for final store-submission sign-off today. GO for the local candidate's automated code-validation checkpoint.** No new application regression was found. Remaining work concerns release delivery, store acceptance and submission verification:

1. Both preserved native wrappers open `https://onlyfast.app?nativeApp=true`, which still serves the older production frontend. The recent onboarding/slide/subscription changes are local. Reusing or replacing a wrapper without publishing the reviewed frontend does not deliver them.
2. Actual store acceptance is incomplete: historical Google **Pro purchase and restore** passed, but Google **Teams purchase** and physical iPhone **Pro/Teams purchase and restoration** have not been established. Current onboarding outcomes are tested with mocks/local simulation.
3. The exact replacement App Store version/build and attachment of both subscriptions have not been verified in App Store Connect. Current Play release/declaration acceptance also needs Console confirmation.

**Apple `READY_TO_SUBMIT` is expected before review and is not itself a submission blocker or an application purchase restriction.** Apple approval is required for production sale, not as a prerequisite to submitting the products for approval.

No speculative fixes, deployment, build submission, store/RevenueCat configuration change, commit, push or production-data mutation was performed.

## 1. Candidate and audit scope

Read `ONLYFAST_SUBSCRIPTIONS_RELEASE_READY.md`, `ONLYFAST_ONBOARDING_SUBSCRIPTION_AUDIT.md` and `ONLYFAST_ANDROID_EMULATOR.md`, along with the current source and historical stock-paywall acceptance evidence. Older Coming Soon/hold statements are historical where the current implementation supersedes them.

- Primary checkout remains on `main`, HEAD **`3e5440947c8f20d13800f690c8f1aeb0249ac6a8`**. A fresh remote-head read matches it.
- Recorded starting hashes for **83 pre-existing modified/untracked files**. Their contents remained unchanged throughout verification, including graphics, previous onboarding edits and unrelated local work.
- Fresh production readback still references **`/assets/main-Crx3oVS1.js`**, byte-identical to the preceding audit. Both embedded public SDK keys match the corresponding connected RevenueCat apps; key values are omitted.
- Existing Android AAB: **1.0.2 (61)**, SHA-256 `B9B9105E110163591D63AB55506D31E582D85775158FB7512D82BA60B2A02D41`.
- Existing iOS IPA: **1.0.2 (59)**, SHA-256 `9C6CAFAC2D66A8D1B359EAD3E96F026606A99C90D579D09AFFE2BE15A8DC6282`.

New verification builds and evidence are under `tmp/final-readiness-audit/`. `candidate-hashes.json` records the principal onboarding/purchase sources and native-enabled build asset hashes. Existing release artifacts and recovery material were not overwritten. The local builds verify the current shared checkout; they are not a deployed replacement or a selected store submission.

## 2. Fresh tests and builds

| Check | Result |
|---|---|
| Full local regression: `npm run qa:regression -- --env local` | **631 passed, 0 failed**: 531 unit, 78 mounted, 22 disposable-database checks. Matches the preceding candidate's passing baseline. |
| QA smoke: `npm run qa:smoke -- --env local` | **69 passed, 0 failed**. Local/mocked checks; no hosted login or customer mutation. |
| TypeScript, `tsconfig.app.json` and `tsconfig.node.json`, no emit | Passed, no diagnostics. |
| Standard production Vite build | Passed into the audit directory. Existing large-chunk warning remains. |
| Native-enabled production build | Passed with both platform flags enabled and the matching public SDK keys, in this build process only. Existing release graph verifier passed: 285 modules; QA routes/fixtures and historical custom native/experimental bridges excluded. |
| Slide geometry | **48 forward-slide measurements and 44 backward checks passed** across 320×800, 390×844, 430×932 and 1440×1200. |
| Onboarding button audit | All 12 slides passed: Skip starts at 6, remains available, bottom Skip to Sign In absent, member button retained. |
| Browser onboarding flow | Passed: member sign-in dialog/cancel, scroll and viewport checks, Skip → discipline → class → Rookie → landing → reload/return. Uses the existing isolated preview backend. |
| Subscription browser checks | Simulated Android/iOS UI at 390px and web at 1440px passed, with no page errors, overflow or external requests. |
| Public legal routes | Both returned HTTP 200 and rendered their actual Privacy Policy / Terms of Service headings in a fresh unauthenticated browser context. |

Regression and smoke JSON/TAP outputs are identified in `regression.log` and `smoke.log`; source/build checks and browser results are alongside them. No application or test expectation was changed to make a check pass.

## 3. Onboarding verification

| Requirement | Verified result |
|---|---|
| Consistent 12-slide presentation | Shared card, heading, artwork/text regions and navigation geometry stayed consistent across slides at each viewport. Artwork fit; no horizontal overflow; long descriptions remained scrollable. Representative screenshots were inspected. |
| Skip begins on slide 6 | Absent on fresh slides 1–5; present from 6 through 12. After reaching halfway it also remains available when returning to earlier slides. Label remains Skip. |
| Bottom Skip to Sign In removed | Absent on every slide. |
| Already a Member | One existing member button per slide; opens the normal Sign In dialog. Cancel returns without completing onboarding. |
| Discipline and vehicle selection | Existing Dirt Track Oval → Dwarf Cars browser path and broader mounted selection/resume tests passed. No class definitions were edited. |
| Rookie, Pro and Teams | All three visible. Rookie continues free. Both native paid controls become selectable when their monthly package is available; no subscription Coming Soon state remains in the local candidate. |
| Authentication | Existing checkpoint is preserved before account-backed discipline/class/plan onboarding. Mounted guest signup/sign-in, account-switch and resume tests passed. No live credentials were entered. |
| Landing and returning users | Rookie browser flow reached landing and retained its profile after reload. Verified paid completion, interrupted completion, duplicate-callback protection and existing-subscriber continuation passed mocked/mounted checks. |

Both paid cards retain the same stock Median paywall: the user makes the final Pro/Teams package choice there. The portable API does not preselect a tier from a card argument. The selected card checks its package's availability and explains the paywall choice. Store metadata supplies localized prices and renewal/eligible-offer terms; the existing $5/$8 card values are labeled USD reference prices, not amounts used in purchase logic. [Median API](https://docs.median.co/docs/revenue-cat).

These results establish the **local candidate**, not that the unchanged production startup URL already contains these updates.

## 4. Subscription configuration and authorization

Fresh read-only RevenueCat/store reads completed at **2026-11-06 19:23:32–33 UTC**, project `proj79983fe3`.

| Tier | Monthly package | Android SKU | iOS product | Entitlements |
|---|---|---|---|---|
| Pro | `$rc_monthly` | `pro:pro` | `app.onlyfast.pro.monthly` | `OnlyFast Pro` |
| Teams | `$rc_custom_teams_monthly` | `teams:teams` | `app.onlyfast.teams.monthly` | `OnlyFast Teams` and `OnlyFast Pro` |

Current offering **`onlyfast_monthly_v1` / `ofrng35794ca3b5`** is active/current, with both real-store monthly products mapped. Teams precedence is preserved. Its existing staging metadata tag is not a purchase gate. Android app `appd348665a60` and iOS app `app82192c9834` both use `app.onlyfast`; their required store credentials are reported configured. No mapping or setting was changed.

On the existing initialized Android Median bridge, a fresh catalog read returned both `$rc_monthly` and `$rc_custom_teams_monthly`; `getOfferings`, `presentPaywall` and `restorePurchases` were present. No SDK configure/login, purchase, restore or entitlement-sync action was invoked for this read.

The deployed `sync-revenuecat-subscription` and `revenuecat-webhook` functions are **ACTIVE, version 7**. Read-only retrieval confirmed that both entry files and their shared RevenueCat helper match the reviewed local source after newline normalization. The synchronization endpoint validates the bearer session through `getUser`, looks up the authenticated UUID's provider snapshot server-side and applies the existing server RPC. Client-selected plans/receipts/paywall booleans are not entitlement authority. Gateway JWT verification being off does not remove that explicit session validation.

Current source/tests preserve paid-account recognition, Stripe/native provider protections, expiration/refund handling, Teams precedence and identity pinning. Failed, canceled, pending, malformed or unconfirmed outcomes cannot complete paid onboarding. Existing paid access can continue without another purchase. No live grant or customer subscription row was written to test these paths; database authorization was exercised in disposable local engines.

[RevenueCat apps](https://app.revenuecat.com/projects/79983fe3/apps), [offering](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings/ofrng35794ca3b5), [entitlements](https://app.revenuecat.com/projects/79983fe3/product-catalog/entitlements).

## 5. Actual store evidence versus simulation

| Evidence | What is actually established |
|---|---|
| **Historical Android Pro sandbox purchase, October 18** | The preserved acceptance report records one Google test-card purchase, an active RevenueCat sandbox `pro:pro` entitlement and server-confirmed **local** Pro membership. Google explicitly indicated no charge. |
| **Historical Android Pro restore, October 18** | The same report records a real stock SDK restore, successful sandbox Pro verification and local synchronization when the paywall closed. This is actual store testing, not a mocked restore. |
| Historical Android Teams | Native package selection and $7.99/month USD display were checked. **No Teams purchase was performed.** |
| Historical iOS Appetize | Stock SDK initialization, Pro/Teams paywall selection, displayed terms/prices, legal links and dismissal were checked. **No StoreKit purchase or restoration was performed.** |
| Fresh Android audit | Actual initialized bridge and package catalog read succeeded. This proves current catalog availability, not a checkout or receipt/restore result. |
| Current candidate purchase outcomes | Success, cancellation, pending/error, unavailable/withdrawn products, retry, restore, delayed verification, existing subscribers and completion retry pass mocks/local simulations. They are not newly store-tested results. |
| **New actual store transactions in this audit** | **None.** No real purchase, sandbox purchase or store restoration was initiated. |

The historical Android report was located read-only at `C:/Users/c_mar/.codex/worktrees/median-paywall-simplification/onlyfast/tmp/stock-android-acceptance/RESUMED_ACCEPTANCE_REPORT.md`; that checkout was not edited or used for development. Its generic cancellation-warning issue was subsequently corrected in the shared controller, with current cancellation regression checks passing. That correction has not been newly accepted through a store dialog in this audit.

No qualified isolated store-transaction workflow was verified for this candidate. The last approved emulator session was production-connected with an existing paid test account; current Play tester/payment qualification was not independently verified. A fresh health request to the historical local sandbox backend at port 54321 returned `ECONNREFUSED`. No approved physical iPhone/TestFlight session was available. The production-connected session was not used for billing, and no new environment, identity, tester permission or configuration was created during this verification-only audit. Existing test permissions and fixtures were preserved.

## 6. Google Play readiness

- Verified Android package **`app.onlyfast`**, version **1.0.2 (61)**, minimum API 26, target API 36; `com.android.vending.BILLING` is declared.
- Manifest metadata reports **Play Billing Library 8.3.0**. Google's current schedule supports Billing 8 for new apps/updates until August 31, 2027; no Billing-library deadline blocker was found. [Google version timeline](https://developer.android.com/google/play/billing/deprecation-faq).
- Both `pro` and `teams` base plans are **ACTIVE**, monthly (`P1M`), with US new subscribers allowed. Current US store prices remain **$4.99/$7.99**, unchanged.
- Both have 20 configured territories, but the sets differ: Spain is Pro-only and Belgium is Teams-only. Confirm intended launch-country coverage; this is not a US availability blocker.
- Store responses repeated the anomalous Apple-territory warning on Google products. It is cross-store wording, not a verified instruction to change Google prices; no equalization/write was attempted.
- The installed emulator APK is debug signed/ADB installed. This alone does not prove test billing eligibility. A matching-package sideload can work for a qualified Play license tester; an ordinary testing-track account can incur real charges. Verify the actual tester and explicit test-payment notice before any future checkout. [Google billing testing](https://developer.android.com/google/play/billing/test).

**Manual Console actions:** inspect the already-uploaded build 61's actual test/review status; confirm its advertising-ID declaration issue recorded in the older submission packet is resolved; verify signing, intended regions and qualified test-account access; complete the missing Teams store acceptance and current onboarding integration acceptance in an isolated approved test workflow. Do not upload another Android build merely because this audit did not inspect its Console status. No current Console tab/session was available for readback, and no Console change was made.

## 7. App Store readiness

- Preserved archive bundle **`app.onlyfast`**, version **1.0.2 (59)**, iPhoneOS, minimum iOS **15.5**, built with **Xcode 26.2 / iOS SDK 26.2**. These meet Apple's current Xcode/SDK and minimum-deployment requirements. Signature validity and App Store processing acceptance were not certified from Windows archive inspection. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/).
- `services.revenueCat.active` is true; stock RevenueCat/RevenueCatUI assets are present. Framework symbols include offering, paywall and restore methods. The correct iOS public SDK key matches RevenueCat. These checks do not replace iPhone runtime acceptance.
- Both products remain **READY_TO_SUBMIT**. Each has a one-month duration, US pricing ($5/$8), en-US title/description, subscription-group localization, review screenshot and review notes; pricing/availability cover 175 territories. Apple returned no additional store-state warnings. This verifies those metadata fields, not every app/account submission requirement.
- Published paywall **`pw3a65004212ef4af8`, revision 12** contains both monthly packages, product-bound price/period text, monthly automatic-renewal/cancellation disclosures and conditional eligible-trial text. A fresh static render was inspected; it is not StoreKit acceptance.
- Restore Purchases is wired in the paywall and explicit onboarding/Settings controls. Actual iPhone restoration is unverified.
- Published Terms/Privacy actions resolve explicitly to `https://onlyfast.app/terms-of-service` and `https://onlyfast.app/privacy-policy`; both public pages rendered without authentication in fresh browser checks. The older missing-Terms-URL observation is superseded.

**Include both products with the replacement submission:** `app.onlyfast.pro.monthly` and `app.onlyfast.teams.monthly`, plus the **OnlyFast Memberships** group. Apple's first auto-renewable subscription submission must accompany an app version; the version, group and subscriptions must be added to the same draft for joint review. `READY_TO_SUBMIT` permits this preparation and is not prior approval. [Apple submission procedure](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase).

**Manual App Store Connect actions:** inspect the actual pending submission and intended replacement build; confirm both products/group are attached; verify reviewer access and remaining app/account requirements; complete physical iPhone sandbox/TestFlight purchase and restore acceptance for both tiers. Retain existing identifiers/prices and stock Median integration. No submission was canceled, replaced or submitted here. Apple product approval remains a later production-sale requirement.

## 8. Existing-feature regression coverage

| Area | Passing evidence and boundary |
|---|---|
| Setup saving/loading | Setup-library/weekend/session, offline-queue, ownership and disposable-database checks. No customer setup was saved, edited or deleted. |
| Race schedule | Schedule selection, finishing-position and performance tests. No live race record changed. |
| Timing scanner | Timing parsing/data, authorization/quota and related tests. No paid OCR or native camera/upload was invoked. |
| Setup Assist | Mounted track-update, server quota/ownership and payload tests. No live paid AI call. |
| OnlyLaps | Session-link/context/card-isolation and Assist integration tests. No external account linking/import or live provider request. |
| Advertising | Existing native/house-ad settings and controller regression checks. No ad activation, forced impression or production configuration change. |
| Membership restrictions | Rookie/Pro/Teams authorization, expiration, limits and server/database tests. No membership grant or tier edit. |
| Login/account isolation | Mounted guest/sign-in/account-switch and token-refresh tests, membership lifecycle and ownership/database tests. No live login/logout cycle or reset. |

These results support no detected regression from recent onboarding changes. They do not claim every native/provider feature has been retested live. The previously recorded API-36 emulator picker/share-system crash remains an environment limitation; it was not triggered or fixed here, and real-device picker/camera acceptance is not inferred from these tests.

## 9. Required release actions

1. Select the reviewed candidate and retain its existing native purchase flags/public keys in the eventual release configuration. Publish the reviewed frontend only under a separately authorized deployment task; verify both wrappers actually load it afterward.
2. Reuse the historical Android Pro purchase/restore evidence rather than repeating a transaction solely for duplicate evidence. Complete missing Teams and current onboarding acceptance using an approved isolated test backend and qualified store tester; preserve customer/test fixtures.
3. Complete real iPhone sandbox/TestFlight Pro/Teams purchase, synchronization, cancellation/error and restoration acceptance. Preserve provider-verified entitlement requirements.
4. Confirm Play build 61's actual Console status and recorded declaration issue; verify intended product territories and tester/payment qualification.
5. Confirm the replacement App Store version/build and joint attachment of both subscriptions/group, reviewer access and remaining Console requirements. Submit only under a separate authorization. Do not wait for product approval before submitting the products for review.

No further development is recommended on the basis of this audit alone. **Submission sign-off remains pending those delivery, store-acceptance and Console checks.** Stop point reached: report completed; application and external configuration preserved.
