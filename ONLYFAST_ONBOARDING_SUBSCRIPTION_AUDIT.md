# OnlyFast onboarding subscription audit

Investigation only — November 6, 2026 (America/Los_Angeles).

**The “Coming Soon” state in the local browser preview is an intentional, enforced checkout guard. It does not mean RevenueCat products are missing. Native onboarding already reuses the existing stock Median/RevenueCat purchase flow. The current production bundle enables that flow for Android and iOS, but Apple’s two subscriptions are still `READY_TO_SUBMIT`, so iOS production purchase readiness is not established. Web onboarding separately disables its existing Stripe checkout path by default.**

No application code, configuration, environment variables, database, customer records, RevenueCat/store settings, pricing or entitlements were changed. No purchase, restore, checkout session, deployment, commit or push was initiated. All pre-existing local changes were preserved. Only this audit and ignored investigation evidence were created.

## 1. Why Pro and Team say “Coming Soon”

The actual sequence is `AppLayout` → `HowOnlyFastWorks` → authenticated `OnboardingFlow` → `PlanSelection`. The current informational-slide sizing and Skip changes do not control billing availability.

[`PlanSelection.tsx:65`](src/components/PlanSelection.tsx#L65) computes:

```ts
const comingSoon = plan.tier !== 'rookie' &&
  (hideExternalPayments ? !nativePurchasesEnabled : !allowWebCheckout);
```

- `allowWebCheckout` defaults to **false** at line 23.
- [`OnboardingFlow.tsx:354`](src/components/OnboardingFlow.tsx#L354) supplies `userId`, Back and completion callbacks, but does **not** opt into `allowWebCheckout`.
- When held, the cards render a “Coming Soon” badge and a genuinely disabled button without a purchase handler. The supported purchase component is mounted only for an authenticated `userId` when the guard passes ([lines 116–129](src/components/PlanSelection.tsx#L116)).
- Rookie uses the existing free completion callback and is unaffected by this guard.

Native availability is calculated in [`nativePurchases.ts:11`](src/lib/nativePurchases.ts#L11):

```ts
NATIVE_PURCHASES_READY && hideExternalPayments &&
VITE_REVENUECAT_ENABLED === 'true' && platformPurchasesEnabled
```

`platformPurchasesEnabled` selects `VITE_REVENUECAT_ANDROID_ENABLED` or `VITE_REVENUECAT_IOS_ENABLED` using the detected OS. Unknown platforms remain off. The current [`nativePurchaseController.ts:4`](src/lib/nativePurchaseController.ts#L4) sets `NATIVE_PURCHASES_READY = true`.

[`paymentVisibility.ts`](src/lib/paymentVisibility.ts) selects the native payment UI from the build flag, the existing `nativeApp=true`/stored payment-visibility hint, or Median/GoNative user-agent evidence. [`nativeEnvironment.ts`](src/lib/nativeEnvironment.ts) separately detects Android/iOS. A visibility hint or spoofed user agent does not provide the native plugin or authorize paid access; the bridge and authenticated server verification are still required. Do not use those hints to make an ordinary browser preview appear purchase-ready.

### Local preview versus current production

The checked local process and conventional root `.env` files supply none of the four rollout/visibility flags above. The current isolated preview scripts do not enable native purchases or supply a Median native bridge. On ordinary desktop/mobile browsers, onboarding also lacks the explicit web-checkout opt-in. “Coming Soon” is therefore expected there.

The protected developer [`OnboardingPreview.tsx:16`](src/pages/OnboardingPreview.tsx#L16) additionally renders `OnboardingFlow` without `userId`; that visual preview cannot initiate purchases. The functional review preview’s plan selector changes browser-local sample data, not a real subscription. Neither is purchase acceptance evidence.

Fresh public readback of `https://onlyfast.app` referenced **`/assets/main-Crx3oVS1.js`**. Static extraction and isolated evaluation of its native-gate declarations, without running the app or calling billing, produced:

| Clean host context | Production `nativePurchasesEnabled` | Onboarding behavior |
|---|---:|---|
| Ordinary desktop web | false | Pro/Teams held because `allowWebCheckout=false` |
| Ordinary Android browser | false | Same web-onboarding restriction |
| Android Median wrapper | true | Existing native purchase controls are eligible to load |
| iOS Median wrapper | true | Native controls are eligible; store readiness is a separate requirement |

The bundle folds the master/readiness gates to enabled and permits both detected native platforms. Its platform SDK keys were compared **in memory** with the two connected RevenueCat app public-key sets: **both matched**. No key values are included here. This establishes configured eligibility, not a successful transaction or runtime bridge test.

Older portions of `MEDIAN_PAYWALL_RELEASE_PLAN.md`, `ONBOARDING_SUBSCRIPTION_INTEGRATION.md` and acceptance reports describe earlier public holds. Their `NATIVE_PURCHASES_READY=false`, first-slide Skip or iOS-hold statements are historical; current source, public bundle and the later activation notes in `NATIVE_RELEASE_SUBMISSION_PACKET.md` take precedence for this audit.

## 2. Visual restriction or real purchase restriction?

**Real restriction at the affected entry point.** The held onboarding cards have no paid action. The native controller and hook independently reject purchase/restore while the native enable gate is false. Removing a label would not restore purchasing.

This is not a global Pro/Team entitlement shutdown. Existing paid access is read independently from trusted membership/subscription state. Native subscriber refresh remains supported while new purchases are held (`watchNativePurchases`, `nativePurchases.ts:55–74`).

Neither product lookup failure nor account loading generates the `comingSoon` formula. On an eligible native host, later failures—missing/incompatible bridge, missing SDK key, unavailable store products, no verified session, subscription read failure—produce errors or disabled controls through the existing purchase flow. They must not be conflated with the initial browser-onboarding guard.

## 3. Settings and profile-menu upgrade paths

| Entry | Existing implementation |
|---|---|
| Settings in native wrapper | [`SettingsModal.tsx:476`](src/components/SettingsModal.tsx#L476) renders `NativeSubscriptionControls` directly, with the same platform gate and subscriber protections. |
| Settings in ordinary web | “Upgrade Subscription” / “View Plans” routes to `/pricing`. |
| Profile/name menu | For a confirmed Rookie account, [`Header.tsx:58`](src/components/Header.tsx#L58) routes “Upgrade to Pro” to `/pricing`; the menu option is intentionally absent for existing paid/admin access. |
| `/pricing` and `/upgrade` | Existing routes use [`Upgrade.tsx:52`](src/pages/Upgrade.tsx#L52), which supplies **`allowWebCheckout`** and an authenticated `user.id`. |
| Shared paid action | [`MembershipPaidAction.tsx:24`](src/components/MembershipPaidAction.tsx#L24) selects native controls in a wrapper and the existing Stripe Buy Button flow on web. |

Both native paid cards open the **same stock paywall**, where the customer chooses Pro or Teams. The page does not currently preselect a specific RevenueCat package. This is intentional in the stock flow; the native label is “View Pro and Teams subscriptions.” Web selection uses its own local `checkoutTier` state and the appropriate existing Stripe button.

**What “works” is established:** the routes, guards, shared handler and verified-success callbacks are implemented and covered by passing focused tests. Historical Android stock-paywall purchase/restore acceptance is documented in `MEDIAN_PAYWALL_ACCEPTANCE_STATUS.md`; historical iOS acceptance was visual/dismissal coverage, with physical transaction/restore still unverified. No transaction was repeated here. Consequently this audit does **not** newly certify live Settings/profile checkout, Google release rollout, or Apple purchase completion. Apple’s current store status remains a release blocker even though the frontend gate is on.

Existing paid accounts intentionally cannot open a second paid offer through these controls; they are directed to their current provider. In particular, “Pro → Team” for an existing subscriber is not automatically authorized as a second independent subscription by these buttons.

## 4. Can onboarding reuse the existing RevenueCat flow?

**Yes—native onboarding already does.** The chain is:

`PlanSelection` → `MembershipPaidAction` → `NativeSubscriptionControls` → `useNativeSubscription` → `NativePurchaseController` → stock `median.revenueCat`/`gonative.revenueCat` → `sync-revenuecat-subscription` → trusted membership refresh → onboarding completion.

`PlanSelection` passes `onPaidComplete || onComplete` as `onVerified`. Onboarding does not supply a separate `onPaidComplete`, so an authenticated, server-confirmed paid purchase falls back to its existing completion callback. [`AppLayout.tsx:423`](src/components/AppLayout.tsx#L423) completes the persisted discipline/class profile and then requests the landing page.

The controller waits for configure/login using the signed-in UUID, preserves one SDK owner and identity queue, then calls **`presentPaywall()`**, not a separate custom product catalog or a second `purchase()` call. [Median documents the SDK initialization, identity, paywall and restoration APIs](https://docs.median.co/docs/revenue-cat).

## 5. Account, initialization, plan persistence and outcomes

- **Account first:** guests pass through the existing Auth modal before account-backed discipline/class/plan selection (`AppLayout.tsx:465–469,514`). A valid signed-in session is checked before billing, synchronization and completion. No anonymous purchase bypass is appropriate.
- **SDK initialization:** the controller waits for the stock plugin methods, obtains the correct platform public SDK key, checks initialization/key agreement, and configures or logs in with the authenticated OnlyFast UUID. Missing bridge/configuration fails safely rather than granting access.
- **Desired paid plan:** native Pro/Team clicks do not persist a deferred choice or select a package. The stock paywall owns that choice. `checkoutTier` is only local web UI state. The generic `pending_plan` helpers elsewhere are not an onboarding purchase queue; `/upgrade` clears stale pending-plan state.
- **Order:** native billing runs while onboarding is still at the plan step. Completion occurs only after the store result, authenticated server reconciliation and a confirmed paid account status. It does not finish onboarding before starting billing.
- **Success:** `useNativeSubscription.ts:79` calls `onVerified` only after confirmed paid access. The selected class must still pass the existing completion checks before landing.
- **Cancel, pending or failure:** the controller rejects these as non-success, the hook displays the message and the user remains on the plan screen. No completion callback or paid grant is based on a store dialog alone. Failed backend confirmation also leaves the user on that step.
- **Restore and entitlement updates:** restoration is implemented by the same controller, followed by server reconciliation. Settings and the native upgrade page expose the existing restore/refresh controls; onboarding’s `purchaseOnly` controls do not expose a dedicated Restore button. Membership lifecycle refresh handles account changes, resume and expiration. These mechanisms must be reused, not duplicated.

The existing local migration’s `complete_racing_onboarding` records `onboarding_plan='rookie'` as a profile preference, while explicitly leaving paid subscription/billing/grant fields unchanged. Thus the current shared completion path does not downgrade a verified purchase, but that preference field is **not** a reliable record of a selected paid SKU. No production database/function query or mutation was performed to revalidate that migration definition in this audit.

### Confirmed continuation gap to address before expanding checkout

An already-paid account returning to an unfinished plan step is protected against duplicate purchase. `useNativeSubscription.ts:66–69` returns early when `existing.isPaid`; it does **not** call `onVerified`. Later membership-refresh events update display but do not automatically complete onboarding. There is no dedicated **continue with already-confirmed paid access** action on this plan screen. Rookie’s Continue Free can finish the profile without downgrading billing, but that is confusing for a customer who just paid.

The same issue matters after an interrupted purchase, delayed entitlement confirmation, or external web checkout return. `SubscriptionSuccess.tsx` waits for an active paid row, publishes a refresh event and routes to `/`; it does not itself complete a pending racing profile. `AppLayout` correctly resumes an unfinished `onboarding_step='plan'`. Simply opting web onboarding into checkout therefore does not fully solve its paid-success return experience.

This is a navigation/verified-continuation gap inferred from the reviewed handlers, not evidence that existing subscriptions were lost. It was not reproduced with a new real purchase or changed account.

## 6. Live RevenueCat mappings and platform compatibility

Read-only inspection of **OnlyFast / `proj79983fe3`** found:

- Android app `appd348665a60`, package `app.onlyfast`; Play credentials configured.
- iOS app `app82192c9834`, bundle `app.onlyfast`; App Store Connect and subscription credentials configured.
- Current active offering **`onlyfast_monthly_v1`**, `ofrng35794ca3b5`.
- Pro package **`$rc_monthly`** and Teams package **`$rc_custom_teams_monthly`**, both with real Google/Apple product mappings.
- Active entitlement **`OnlyFast Pro`** covers Pro and Teams products; **`OnlyFast Teams`** covers Teams products. This matches the server mapper’s Teams-over-Pro precedence. Test Store mappings also exist; they are not proof of store acceptance and the production platform keys matched the real apps, not the Test Store.
- The current offering has a `deployment: staging` metadata tag. The reviewed client does not use that tag as an availability gate; the offering is current and has real-store packages. No metadata was changed.

Catalog links: [apps](https://app.revenuecat.com/projects/79983fe3/apps), [products](https://app.revenuecat.com/projects/79983fe3/product-catalog/products), [entitlements](https://app.revenuecat.com/projects/79983fe3/product-catalog/entitlements), [offerings](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings).

Fresh store-state reads were timestamped **2026-11-06 16:21:42–43 UTC**:

| Platform/plan | Product mapping | Store result | US price read, not changed |
|---|---|---|---|
| Android Pro | `pro:pro` / `prod9c2b5b4888` | `ok`; `pro` base plan **ACTIVE**, US new subscribers allowed | USD 4.99/month |
| Android Teams | `teams:teams` / `prodc26de99b58` | `ok`; `teams` base plan **ACTIVE**, US new subscribers allowed | USD 7.99/month |
| iOS Pro | `app.onlyfast.pro.monthly` / `proda39dd87405` | `needs_action`; **READY_TO_SUBMIT** | USD 5/month |
| iOS Teams | `app.onlyfast.teams.monthly` / `prod901efecc38` | `needs_action`; **READY_TO_SUBMIT** | USD 8/month |

RevenueCat catalog `active` is not Apple approval. Apple subscriptions still require the appropriate submission/review/release process; [Apple documents submitting in-app purchases with the app version](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase). No submission or store change was made.

The store-state tool returned an Apple territory-pricing warning on each **Google Play** response, mentioning only 20 configured price territories. That cross-store wording is not treated as an authoritative Google blocker or an instruction to alter prices. Both returned Google base plans are ACTIVE; regional availability still needs release testing for intended territories. Apple responses returned no separate warnings beyond `needs_action / READY_TO_SUBMIT`. No price equalization was attempted.

| Platform | Supported existing billing route | Qualification still needed |
|---|---|---|
| Android Median | Stock RevenueCat/Google Play; eligible in current production bundle | Approved wrapper/plugin, valid Play account/testing or distribution, actual offerings and server-confirmed purchase/restore. ACTIVE products do not establish the app binary’s public rollout status. |
| iOS Median | Stock RevenueCat/StoreKit; frontend gate enabled | Apple products are not yet production-approved; physical iPhone sandbox/TestFlight transaction, reconciliation and restore acceptance remain required. |
| Web browser | Existing Stripe checkout through `/pricing`/`/upgrade`; web onboarding currently does not opt in | No RevenueCat Web SDK/web checkout path is implemented. Do not force native billing flags or redirect a browser to a nonexistent bridge. |
| Current Android emulator | Useful native UI inspection; ADB-installed debug-signed APK is not proof of billing acceptance | Its Google Play account/license-tester/install eligibility was not established. [Google permits qualifying license testers to test matching-package sideloaded builds](https://developer.android.com/google/play/billing/test); ordinary sideloading alone does not establish eligibility. No purchase attempted. |

## 7. Exact minimal future work

These are recommendations only; **none were implemented**.

1. **Use the supported native path already present.** Do not replace the controller, add a catalog/SDK, change entitlements or blindly remove Coming Soon. Build the release candidate with the reviewed platform public configuration and test the stock wrapper. Current production Android/iOS frontend gates already evaluate true; there is no universal source hold left to remove. Unknown/unsupported hosts must remain unavailable.
2. **Add only a verified onboarding continuation.** In the onboarding plan/action integration, let an authenticated account whose existing authoritative status is already paid finish the persisted discipline/class profile through the existing completion callback, without initiating another purchase. Cover delayed confirmation/reload and completion failure. Preserve the existing duplicate-charge guard, session checks, and entitlement authority.
3. **Keep native card semantics honest.** Both cards currently open the full existing Pro/Teams paywall. Reuse that behavior; do not imply that clicking a card has already selected or purchased that tier. Actual package choice and localized terms remain in the native paywall.
4. **Resolve Apple store readiness before declaring immediate public iOS purchase availability.** Product approval/release and device acceptance are separate operational work, not something a Coming Soon label edit can supply. Do not change its live gate during this investigation.
5. **If paid web onboarding is in scope, make an explicit provider decision.** The smallest reuse is `allowWebCheckout` at the existing `OnboardingFlow` plan call, plus verified post-checkout/profile continuation through the existing Stripe success/resume flow. It must keep native external payments hidden. Enabling that prop alone is insufficient for the return-path edge case above. Requiring RevenueCat checkout in browsers would be a separate integration, not reuse of the currently implemented native bridge.

For native-only release behavior, the main additional application work is the small paid-continuation integration and its tests; a new subscription system or schema migration is not indicated by the reviewed code. Any change to the informational `onboarding_plan` preference would need separate consideration; it is unnecessary for entitlement authorization and is not proposed as a billing change.

## 8. Risks to current subscribers

This read-only audit introduced no subscriber risk. A future implementation must retain:

- Server-confirmed entitlements; never grant Pro/Teams from a selected card, client receipt claim, browser storage or a paywall success boolean.
- Existing Stripe/native/promotional/admin/tester access and provider precedence. Do not start a second native subscription for an account already paid through Stripe or another provider.
- Teams precedence when both entitlements are present, current expiration/grace behavior and account-switch isolation.
- The separate platform rollout guards, existing native provider management links and restoration behavior.
- Completion as a profile action rather than a paid-plan write; no reset, forced Rookie downgrade, migration or fixture deletion.

The approved `test@test.com` account’s Team/full tester access is unsuitable for proving a brand-new Rookie purchase path, because the existing paid-account guard may correctly block a second offer. Use approved isolated test identities/store testers for future transaction acceptance; no account permissions were changed here.

## 9. Can this avoid changing the underlying subscription system?

**Yes, for native onboarding and for preserving the current Stripe-based web route.** The stock controller, product/entitlement mappings, authenticated reconciliation endpoint, webhook processing and membership lifecycle already exist. The remaining integration work should reuse those boundaries and the existing racing-profile completion callback. Apple approval and real-store verification remain operational prerequisites. RevenueCat-based browser purchasing would be additional scope and is not currently implemented.

## 10. Testing required before release

The audit reran existing focused suites for native readiness, controller/store-result handling, server mapping/endpoints, membership selection, account switching, iOS subscription UI, mounted native controls and onboarding navigation: **175 passed, 0 failed**. These use mocks/local simulation; no transaction, live synchronization write or configuration change was performed.

Before releasing expanded paid onboarding, verify:

1. Rookie remains free; guests authenticate normally before purchases; discipline and class remain required.
2. Both native packages appear for an approved fresh Rookie tester, with correct platform key, current offering, store product, localized price and eligible terms.
3. Pro and Teams success each reconcile through RevenueCat and the existing server, retain the selected class, complete the profile and reach landing. Reopening the app must not repeat onboarding or billing.
4. Cancel/dismiss, pending, declined payment, missing products/bridge, offline conditions and synchronization failure keep the correct step without granting access or charging again.
5. Already-paid and delayed-confirmation users can continue onboarding without another purchase. Failure to complete the profile after a paid transaction must offer safe retry.
6. Explicit restore, background/resume, expiration/refund and account switching preserve ownership and existing entitlements. Confirm current Stripe, promotional, admin and Team accounts remain intact.
7. Ordinary desktop/mobile browsers retain the supported web behavior; if web onboarding checkout is approved, test Stripe success, cancellation and webhook delay with pending profile completion.
8. Test actual Android Play and iPhone StoreKit environments, not only the preview, emulator or RevenueCat Test Store. [RevenueCat distinguishes platform sandbox acceptance from its Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox). Transactions require separately authorized test scope; do not repeat historical purchases solely for diagnostics.

Investigation evidence is under `tmp/onboarding-subscription-audit/`: public entry/gate expressions and platform matrix, redacted local boolean configuration, content hash baseline and `focused-tests.log`. No API keys, passwords, access tokens or privileged credentials are included in this audit. No implementation was begun.
