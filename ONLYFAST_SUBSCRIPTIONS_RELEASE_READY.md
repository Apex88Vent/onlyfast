# OnlyFast subscription release preparation

November 6, 2026. Local implementation and verification only.

**The onboarding implementation is prepared for Pro and Teams purchases through the existing stock Median/RevenueCat paywall on Android and iOS. There is no application restriction based on Apple's `READY_TO_SUBMIT` status. This is not an Apple approval, a completed physical-device transaction acceptance, or a production deployment.**

The production frontend remains `/assets/main-Crx3oVS1.js`. It was read back unchanged from the preceding audit. No deployment, commit, push, store submission, native rebuild, RevenueCat configuration change, database change, customer edit or real purchase was performed.

## 1. Scope and preserved work

Worked on the primary checkout's existing `main`, HEAD `3e5440947c8f20d13800f690c8f1aeb0249ac6a8`. A read-only fetch confirmed no difference from `origin/main` before editing. No branch or worktree was created. Existing graphics, advertising, performance, cleanup, onboarding Skip and slide-dimension work was preserved.

Starting hashes of pre-existing modified/untracked files were recorded in `tmp/subscriptions-release/starting-work.json`. The only such file intentionally edited by this task is `tests/onboardingNavigation.mjs`; its prior changes remain, with the obsolete subscription-button assertions updated. Other pre-existing files retain their starting hashes.

### Application files modified

| File | Change |
|---|---|
| `src/components/OnboardingFlow.tsx` | Opt the existing plan screen into onboarding-specific purchase/continuation controls. |
| `src/components/PlanSelection.tsx` | Remove the paid-plan Coming Soon badge/disabled branch; show the existing $5/$8 reference prices during native onboarding; retain Rookie; add renewal clarification and existing legal routes; share the existing submission guard across free/paid completion callbacks. |
| `src/components/MembershipPaidAction.tsx` | Pass onboarding context to the existing native controls; add freshly verified paid-user continuation on web; retain existing Stripe upgrades and provide an informative mobile-store fallback during web onboarding. |
| `src/components/NativeSubscriptionControls.tsx` | Add onboarding offering-loading/unavailable/retry states, Pro/Teams labels, paid-member continuation, Restore Purchases and Refresh subscription. Replace obsolete unavailable-build Coming Soon copy. |
| `src/hooks/useNativeSubscription.ts` | Check the selected monthly package at runtime; recheck account identity; continue existing paid users without billing; permit confirmed delayed/restore access to finish onboarding; retain cancellation/error handling. |
| `src/lib/nativePurchaseController.ts` | Add the two existing package identifiers and an identity-serialized offering check; recheck package availability immediately before the existing stock paywall. Preserve its initialization, identity, timeout and concurrent-request protections. |

### Tests modified

- `tests/membershipSelection.test.ts`: plan presentation, reference pricing, legal links, web fallback and simultaneous paid-completion assertions.
- `tests/nativePurchaseReadiness.test.ts` and `tests/nativeSandbox.test.ts`: preserve purchase-hold assertions using the new unavailable-build wording.
- `tests/nativeSubscriptionControls.mjs`: mounted onboarding tests for both packages, verified success, cancellation/pending/error, missing/withdrawn products, retries, restore, delayed confirmation, existing subscribers, account changes and completion retry.
- `tests/onboardingNavigation.mjs`: retain the actual tutorial/auth/discipline/class/landing tests; assert authenticated delegation to paid controls instead of obsolete Coming Soon placeholders. Store outcomes are covered separately by the actual hook/controller and local browser checks.
- `tests/revenuecat.test.ts`: runtime package validation, missing/malformed/offline/unsupported responses, retry and account switching during an offering request.

This report is new. Ignored fixture, screenshot, build and test evidence is under `tmp/subscriptions-release/`. No dependency, lockfile, environment file, native source, optimized graphic, entitlement, billing price, advertising controller, setup, OnlyLaps, racing-class, Supabase schema/RLS or Edge Function file was changed.

## 2. Purchase behavior

The production authentication checkpoint is preserved: tutorial → existing sign-in/registration → discipline → vehicle class → plan → optional purchase → existing onboarding completion/landing. Guests cannot reach an account-backed plan purchase before that checkpoint. Consequently a guest's selected paid tier does not cross a new authentication route; no anonymous billing or duplicate deferred-plan mechanism was introduced. Existing account-creation and sign-in navigation tests remain passing.

Rookie continues without billing. Authenticated Pro and Teams controls become available after the store reports their corresponding package. Missing products disable checkout and show an explanation plus Retry loading plans. Restore and membership refresh remain available independently of catalog availability where the wrapper supports them.

Both cards deliberately retain the **same existing stock paywall**. The portable Median `presentPaywall()` contract does not accept a package-selection argument. Each card checks its respective monthly package and tells the customer to choose that tier on the paywall; the paywall owns final package selection, localized prices, trial eligibility and store confirmation. There is no custom purchase API, hidden second charge, undocumented preselection parameter or entitlement grant from a card click. [Median API reference](https://docs.median.co/docs/revenue-cat).

The documented `getOfferings()` response exposes identifiers, not localized price metadata. The cards therefore display the requested existing USD reference prices ($5/$8), with clarification; the native paywall displays actual store metadata before payment. No amount is used in purchase logic. Google US prices currently remain $4.99/$7.99; Apple remains $5/$8. Neither was changed.

| Outcome | Implemented behavior |
|---|---|
| Successful purchase | Existing native flow → authenticated server reconciliation → verified membership → existing onboarding completion. A successful store dialog alone cannot grant access. |
| Canceled/pending/failed | Remain on the plan step, display the result, grant no access, and retain Rookie/retry options. |
| Missing/withdrawn package | Prevent paywall initiation for that selection, display unavailable state and offer catalog retry. |
| Delayed server confirmation | Refresh subscription can finish onboarding once paid access is actually confirmed, without another checkout. |
| Existing paid subscriber | Continue with current membership rechecks authoritative access and identity; no purchase or restore is required. This includes existing Stripe and native memberships. |
| Completion failure after payment | Preserve paid membership and the plan step; retry completion using current membership rather than buying again. |
| Expired membership/account switch | A stale paid button cannot authorize continuation; identity and current access are rechecked. |
| Ordinary web onboarding | Select Pro/Teams to see the mobile-store explanation, or continue Rookie. Native billing is not spoofed and onboarding does not activate Stripe. Existing web `/pricing`/`/upgrade` Stripe checkout remains intact. |

Settings, the profile upgrade route, the published paywall, subscription authorization and existing upgrade/provider protections remain in place. Their default purchase behavior is unchanged.

## 3. RevenueCat verification

Fresh read-only checks of project `proj79983fe3` confirmed:

| Item | Result |
|---|---|
| Android | `appd348665a60`, package `app.onlyfast`; Play credentials configured. |
| iOS | `app82192c9834`, bundle `app.onlyfast`; App Store Connect and subscription keys configured. |
| Public SDK keys | Both current production platform keys exactly matched their corresponding connected RevenueCat app keys. Values were compared without including them in this report. |
| Current offering | `onlyfast_monthly_v1` / `ofrng35794ca3b5`, current and active. Existing `deployment: staging` metadata is not a client purchase gate and was not edited. |
| Published paywall | `pw3a65004212ef4af8`, revision 12, published October 18. Both packages and store-price/renewal bindings are present. |

| Tier | Package | Google product | Apple product | Entitlements |
|---|---|---|---|---|
| Pro | `$rc_monthly` | `pro:pro` | `app.onlyfast.pro.monthly` | `OnlyFast Pro` |
| Teams | `$rc_custom_teams_monthly` | `teams:teams` | `app.onlyfast.teams.monthly` | `OnlyFast Teams` and `OnlyFast Pro` |

All four real-store products are monthly subscriptions. Existing Teams precedence and Test Store mappings remain unchanged. Real platform SDK keys are used for the release configuration.

Store-state reads at **2026-11-06 18:33:57 UTC** returned Google base plans ACTIVE with US new subscribers allowed; both Apple products returned **READY_TO_SUBMIT**. That Apple status does not disable the application. Purchases become usable when the actual device/store returns the products; otherwise the runtime unavailable/retry state applies.

The Google responses included an anomalous Apple-territory-pricing warning about 20 configured territories. This cross-store warning was not treated as an instruction to change prices or run equalization. Intended regional availability still requires store/device release coverage; no territory or price changes were made.

Read-only dashboard references: [apps](https://app.revenuecat.com/projects/79983fe3/apps), [offering](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings/ofrng35794ca3b5), [entitlements](https://app.revenuecat.com/projects/79983fe3/product-catalog/entitlements).

## 4. Android readiness and emulator results

Used the existing Pixel 8 / Android 16 emulator and stock Median 1.0.2 (61). The existing initialized production bridge returned exactly:

```json
{"identifiers":["$rc_monthly","$rc_custom_teams_monthly"]}
```

`getOfferings`, `presentPaywall` and `restorePurchases` were available. The new check accepts this response without requiring the obsolete `success` field. This was a catalog read, not a purchase, restore, login or SDK identity change.

The updated actual components/controller were then loaded temporarily inside that wrapper from a **clearly labeled local fixture with a simulated account, store and server**. Five targeted checks passed: all three plan choices; no subscription Coming Soon/overflow; Pro reaches the simulated paywall; Teams reaches it; an existing Teams subscriber finishes without a purchase. Screenshots include `android-emulator-plans.png`, `android-emulator-pro.png`, `android-emulator-teams.png` and `android-emulator-paid-complete.png`.

The original production page/history entry was restored afterward. No app data wipe, reset, account logout, customer setup edit, real paywall transaction, restore transaction or ad activation was performed.

The installed APK is debug signed and ADB installed. Its Play license-tester/account/payment eligibility was not established, so no real sandbox transaction was attempted. The emulator evidence verifies UI and mocked outcomes plus actual bridge/catalog availability; it does not certify Play purchase/restore acceptance. [Google test-account requirements](https://developer.android.com/google/play/billing/test).

## 5. iOS wrapper and release readiness

The preserved `OnlyFast-ios-1.0.2-59.ipa` still matches its recorded SHA-256 `9C6CAFAC2D66A8D1B359EAD3E96F026606A99C90D579D09AFFE2BE15A8DC6282`. Its `app.onlyfast` configuration enables `services.revenueCat.active`, opens `https://onlyfast.app?nativeApp=true`, and includes RevenueCat/RevenueCatUI bundles and the stock RevenueCatPlugin framework. Its binary contains the three offering/paywall/restore method symbols. These are archive/configuration checks, not iPhone execution or Apple signature-processing acceptance.

Both native platform flags and the master flag were already enabled in the reviewed production baseline. A separate local production build was verified with those same enabled flags and the matching public keys; no environment file or production setting was changed. Neither application code nor configuration waits for a manually hardcoded product-approval flag.

| Submission capability | Evidence/status |
|---|---|
| Pro/Teams purchase options | Implemented, runtime catalog checked; shared stock paywall bindings verified. |
| Restore Purchases | Explicit onboarding control plus existing Settings/upgrade controls and published paywall restore action. |
| Pricing/renewal terms | Published paywall uses product-price/period bindings and monthly auto-renewal text; eligible trial text is conditional. |
| Privacy Policy | Onboarding and published paywall reference `/privacy-policy`. |
| Terms of Use | Onboarding and published paywall reference `/terms-of-service`. The published Terms action resolves to an explicit URL; the old audit's historical missing-URL note is superseded. |
| Entitlement descriptions | Existing plan descriptions/comparison and native package descriptions retained. |
| Failure/cancellation | Passing mocked controller, hook and browser coverage; no access from unsuccessful or unconfirmed results. |
| Physical iPhone sandbox purchase/restore | **Not performed; remains release acceptance work.** |

The source is prepared for a subscription-enabled submission, but complete App Store readiness cannot be certified from local simulations and archive inspection. Neither Apple subscription is approved yet. The current pending App Store submission/build selection was not changed or independently reverified in this task.

## 6. Tests and build

| Check | Result |
|---|---|
| Starting local regression baseline | 617 passed, 0 failed. |
| Final local regression | 631 passed, 0 failed: 531 unit, 78 mounted, 22 disposable-database checks. |
| Focused onboarding/RevenueCat/native/identity/iOS UI suites | 199 passed, 0 failed. |
| Local QA smoke | 69 passed, 0 failed. |
| TypeScript | `tsconfig.app.json` and `tsconfig.node.json`, no emit: passed. |
| Targeted React/TypeScript lint | No errors or warnings in the changed purchase components, hook and controller. |
| Production build | Passed. Existing large-chunk warning remains; no unrelated bundle refactor. |
| Native-enabled production module graph | Passed using the existing release verifier; QA routes, fixtures, historical custom native sources and experimental bridges excluded. |
| Browser scenarios | Android/iOS simulated native screens at 390px and web at 1440px passed; no page errors, horizontal overflow or external requests. |
| Installed Android wrapper | Actual bridge/catalog read and five isolated preview checks passed, as qualified above. |

The regression baseline was already clean after Phase 2D; no old product behavior was changed to obtain these results. The additional tests exercise the new subscription behavior. Disposable database tests use existing local harnesses, not production schema changes. No live QA account permissions or fixtures were altered.

Builds are under `tmp/subscriptions-release/build` and `tmp/subscriptions-release/native-build`. They verify the shared working checkout, including pre-existing local work, and are **not an isolated, approved production deployment artifact**. A future release must select/review its authorized changes. Current source changes are not live: the native wrappers still load the unchanged production website, so replacing a wrapper alone will not publish this frontend implementation.

## 7. Manual Apple actions and remaining release work

1. Review the replacement app/version/build in [App Store Connect](https://appstoreconnect.apple.com/apps/6792149373/distribution/ios/version/inflight), replacing the pending submission as appropriate to its actual status. No pending submission was withdrawn here.
2. Include **both** `app.onlyfast.pro.monthly` and `app.onlyfast.teams.monthly`, and the **OnlyFast Memberships** group, in the same replacement submission. Apple's first auto-renewable subscription submission requires an associated new app version; the app version, group and subscriptions must be added to the same draft for joint review. [Apple submission instructions](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase).
3. Verify the replacement stock Median wrapper retains the correct bundle ID, RevenueCat plugin and production startup URL. After a separately authorized frontend release, confirm it loads this reviewed implementation. Do not submit the old frontend merely by rebuilding the wrapper.
4. Complete actual iPhone sandbox/TestFlight Pro and Teams purchase, cancellation/error, server synchronization, restore and interrupted-onboarding acceptance using approved store testers. Also complete qualified Play sandbox acceptance. Confirm localized prices, any eligible trial and final billing terms on the native paywall. Simulated success is not store acceptance. [RevenueCat sandbox guidance](https://www.revenuecat.com/docs/test-and-launch/sandbox).
5. Review the existing subscription screenshots/localizations, availability, app review notes, required agreements and any requirements shown by App Store Connect. Supply approved reviewer access manually; do not expose credentials in source or this report. Explain onboarding and Settings purchase/restore entry points.
6. Verify actual-device legal links, restore controls and subscription disclosures before submission. The app and paywall now expose the required routes/actions, but store-review approval remains Apple's decision. [Apple subscription guidelines](https://developer.apple.com/app-store/review/guidelines/#subscriptions).
7. Submit/release the replacement app and both subscriptions only when separately authorized and store/device acceptance is complete. Production billing, advertising/privacy holds and unrelated release requirements were not changed by this task.

**Remaining limitations:** no physical iPhone transaction/restore evidence, no newly qualified Play sandbox transaction, no Apple approval, and no deployed frontend replacement. These are recorded release actions, not reasons to retain a permanent Coming Soon restriction.

## 8. Local review

The isolated preview is `http://127.0.0.1:8090/__subscription-review?platform=android`; use `platform=ios` or `platform=web` for the other UI modes. Its toolbar is local QA only, with synthetic Rookie/paid/missing-product fixtures and a simulated paywall. No purchase in this preview charges money or contacts a store/server. It is excluded from the production build.

Stop point: implementation, local testing and reporting complete. No deployment, submission or further phase was started.
