# OnlyFast subscription redesign — local review

Status: visual redesign approved by the user; staging locally on the existing `main` checkout is authorized. No commit, push, deployment, release publication, purchase, live billing change, or advertising/purchasing activation was performed.

The current revision follows the user-supplied [OnlyFast subscription mockup](<C:/Users/c_mar/Downloads/OnlyFast Subscription Plans Mockup.png>), with additional light grey to match the rest of the app. It uses the existing `public/onlyfast-logo.png` asset. The original honest “Best for Solo Racers” badge and FREE Rookie pricing are retained.

## Existing screens and entry points discovered

| Existing surface | Implementation and result |
| --- | --- |
| Onboarding after discipline and car/class selection | `src/components/OnboardingFlow.tsx`, existing plan step → `PlanSelection`. Same progression, persistence, Back and free/verified paid completion callbacks. Compact brand header and wider desktop plan layout. |
| Full subscription/upgrade/comparison screen | `src/pages/Upgrade.tsx` renders `PlanSelection` for existing `/pricing`, `/upgrade`, and `/checkout` routes. No route was added or destination changed. |
| Account Settings subscription section | `SettingsModal`: existing View Plans and upgrade links still lead to `/pricing`; provider management and cancellation controls stay in place. Teams gets “View Subscription”; Pro gets “Upgrade to Teams”. |
| Username/account menu | `Header`: existing Rookie “Upgrade to Pro” leads to `/pricing` and Settings opens the same existing modal. |
| Multi-class / Teams upgrade prompts | `AppLayout.openTeamsUpgrade` leads to `/upgrade` with the existing Teams state; ClassChangeModal and dashboard class restrictions retain their callbacks. |
| Feature restriction prompts | `LockedFeatureNotice` leads to `/pricing`; save, Setup Assist, export and related restrictions keep existing limits and destinations. Other compact inline upgrade prompts remain compact. |
| House ads and post-save interstitials | `HouseAdPlacement` and `RookieHouseAdContent` retain `/pricing` and `/upgrade` destinations, pending-plan behavior and placement/dimensions. Shared destination picks up the redesign. |
| Public homepage membership summary | `PublicHome` now uses the same presentation cards, with existing `/upgrade` paid and `/app` free links. |
| Authorized test-tier selector | `TestSubscriptionGate` reuses the presentation cards; its server-approved test switch, selected state and no-payment controls are unchanged. |
| Development house-ad preview | `src/dev/HouseAdsPreview.tsx` already reuses `PlanSelection`, so the shared presentation propagates without route or harness changes. |
| Historical source copies | Root `OnboardingFlow.tsx` and `supabase/src` plan/onboarding/upgrade sources are not imported by the active Vite application. Left intact; no competing implementation was activated. |

No separate production plan-selection modal or independent Rookie→Pro, Rookie→Teams or Pro→Teams destination was found. Existing upgrade entry points converge on the shared selector or current provider management. Native purchase, restoration and management remain in the stock Median flow.

## Presentation changes

The mockup revision uses title-case plan names and right-aligned prices on the same row, compact feature spacing, heavier blue checkmarks, a bold italic slogan, navy/blue paid buttons with white text, and a pale blue Rookie button. Rookie’s no-payment note now sits below its button. Light grey page/card/comparison surfaces match the surrounding app. The extra visible selector heading is removed; its accessible heading remains for assistive technology. Detailed limits stay in the expanded comparison, and price/renewal disclosures remain visible below it. The original preview files remain available in `tmp/subscription-review`; the current captures are in `tmp/subscription-review-mockup`.

- Teams $8/month → Pro $5/month → Rookie FREE on every active plan listing.
- Actual horizontal logo and “Race Smarter. Finish Faster.” on full selectors.
- Pro: blue border, light blue fill, “Best for Solo Racers”, stronger CTA. Teams: navy accents and neutral border. Rookie: quieter neutral styling and “Free Forever”.
- Exact requested marketing summaries and CTA labels, including the $3 Teams anchor and no-payment Rookie support copy.
- Stacked phone/tablet cards and three equal-height desktop cards, aligned CTAs, no horizontal card scroll or nested card scroll containers.
- Existing comparison, with all 12 feature rows still derived from `tierLimits`, inside keyboard-accessible “Compare All Features”. Single-class restrictions, vehicle change rules, editing-lock details and subscription disclosures retained.
- Existing paid users see current plan / included-access messaging and provider-management instructions rather than another purchase action for their active paid access.
- Existing native localized prices remain owned by the stock store paywall. Cards disclose USD reference prices and the USD basis for the $3 difference. No custom pricing bridge was introduced.
- Safe-area padding, focus indication, blue feature checks, readable button contrast, and 200% text reflow. A 320px heading overflow found during review was fixed.

## Files changed by this task

| File | Purpose |
| --- | --- |
| [src/components/MembershipPlanCard.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/MembershipPlanCard.tsx>) | Shared presentation-only card; callers retain their existing actions. |
| [src/components/membership-plans.css](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/membership-plans.css>) | Scoped card, logo, responsive layout, CTA and safe-area styles. |
| [src/components/PlanSelection.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/PlanSelection.tsx>) | Existing full selector, branding, shared cards and preserved disclosures/actions. |
| [src/components/MembershipComparison.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/MembershipComparison.tsx>) | Expandable comparison; retained feature data and mobile reading layout. |
| [src/components/MembershipPaidAction.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/MembershipPaidAction.tsx>) | Requested CTA copy/styling hook and account-specific display wording; existing handlers unchanged. |
| [src/components/NativeSubscriptionControls.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/NativeSubscriptionControls.tsx>) | Account-specific paid-plan display wording; existing hook, actions and provider routing unchanged. |
| [src/components/OnboardingFlow.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/OnboardingFlow.tsx>) | Presentation of the existing plan step, compact existing logo and desktop width. |
| [src/components/TestSubscriptionGate.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/TestSubscriptionGate.tsx>) | Same card presentation for existing authorized test controls; avoids duplicate onboarding branding. |
| [src/components/SettingsModal.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/SettingsModal.tsx>) | Account-specific subscription link label, retaining destinations and management controls. |
| [src/lib/membership.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/membership.ts>) | Only PlanMeta / PLANS presentation order and marketing copy; tierLimits and billing configuration untouched. |
| [src/index.css](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/index.css>) | Load the shared plan stylesheet. |
| [src/pages/Upgrade.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/pages/Upgrade.tsx>) | Existing page light grey background, safe-area spacing, removes duplicate logo. |
| [src/pages/PublicHome.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/pages/PublicHome.tsx>) | Reuse shared plan presentation with existing link destinations. |
| [src/pages/public-home.css](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/pages/public-home.css>) | Light grey background for the existing pricing section. |
| [tests/membershipSelection.test.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/membershipSelection.test.ts>) | Update copy/price assertions; verify order, recommendation badge, collapsed comparison markup and preserved callbacks. |
| [tests/iosSubscriptionUI.test.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/iosSubscriptionUI.test.ts>) | Update the expected account-specific Settings label. |
| [tests/onboardingNavigation.mjs](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/onboardingNavigation.mjs>) | Load the shared presentation component in the existing mounted navigation harness. |
| [qa/automation/subscription-layout.mjs](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/qa/automation/subscription-layout.mjs>) | Repeatable local browser screenshot and interaction checks with all external requests intercepted. |
| [docs/SUBSCRIPTION_REDESIGN_REVIEW.md](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/docs/SUBSCRIPTION_REDESIGN_REVIEW.md>) | This review record and screenshot index. |

Unrelated concurrent edits in the AdMob documentation/tests and `tests/revenuecatDatabase.mjs` were observed during verification and left intact. They are not part of this redesign.

## Actual browser screenshots

All captures are from the modified running Vite app using existing routes, not concept art. Synthetic subscription/auth responses were intercepted inside isolated browser contexts. No test state was written to a real account and all non-local requests were either mocked or blocked.

| Required preview | Screenshot |
| --- | --- |
| A. Mobile, all three cards, 390px wide | [mobile.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/mobile.png>) |
| B. Desktop, Teams / Pro / Rookie, 1440px wide | [desktop.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/desktop.png>) |
| C. Existing onboarding selection | [onboarding.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/onboarding.png>) |
| D. Existing account upgrade destination, reached through Settings | [account-upgrade.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/account-upgrade.png>) |
| E. Expanded full feature comparison | [comparison-expanded.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/comparison-expanded.png>) |
| F. Active Pro user | [existing-pro.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/existing-pro.png>) |
| F. Active Teams user | [existing-team.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/existing-team.png>) |
| Account Settings entry point | [account-settings.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/account-settings.png>) |
| Tablet, 768px wide | [tablet.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/tablet.png>) |
| Mobile expanded comparison | [comparison-mobile.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/comparison-mobile.png>) |
| 200% text, 320px viewport | [text-scaling-200.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/text-scaling-200.png>) |
| Existing public homepage plan summary | [public-plans.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/public-plans.png>) |

Additional wrapper simulations: [android rookie](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/android-rookie.png>), [android pro](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/android-pro.png>), [android team](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/android-team.png>), [ios rookie](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/ios-rookie.png>), [ios pro](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/ios-pro.png>), [ios team](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/ios-team.png>).

## Verification results

- `npm test`: **561 passed, 0 failed**.
- Existing mounted onboarding/navigation and native controls suites: **77 passed, 0 failed**.
- `npx tsc -p tsconfig.app.json --noEmit`: passed.
- `npx tsc -p tsconfig.node.json --noEmit`: passed.
- ESLint for all redesigned selector/card/control/page components: passed. Full repository lint was not run.
- `npm run build`: passed. Vite reports the existing large-bundle advisory (>500 kB); no build error.
- `git diff --check` for the redesign source/test changes: passed.
- Local browser checks: **14 scenarios passed**, no runtime page errors. Viewports: 320×568, 375×667, 390×844, 430×932, 768×1024, 844×390, 1024×768 and 1440×900. No horizontal overflow or nested card scrolling. Desktop heights and CTA alignment verified.
- Keyboard comparison expansion, all 12 feature rows, 200% text reflow/action reachability, real onboarding Back/class selection/free completion, Settings and username upgrade entry points, and existing aliases verified.
- Both paid web actions retain their existing Stripe buy-button IDs and authenticated client reference. External Stripe JavaScript/network was blocked during the test; no transaction was initiated.
- Android/iOS Median UA simulations for Rookie, Pro and Teams verify native gating, no Stripe rendering, active-plan messaging and management links to the recorded original store.
- Existing automated tests cover RevenueCat stock controller integration, holds, active subscription detection, account switching, restoration/management, and unchanged authorization limits.

[Detailed local browser results](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/results.json>) · [Automated test log](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-mockup-tests.log>) · [Build log](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-mockup-build.log>)

## Remaining limits and approval

Physical Android/iOS wrapper rendering, real StoreKit/Google Play purchase/restore acceptance, and actual localized store prices were not exercised. Wrapper checks use Chromium with representative Median user agents and mocked subscription responses. Existing store purchase/restoration holds remain in place. No production or live RevenueCat configuration was changed.

The native screenshot CTAs deliberately show the existing held/unavailable state where purchasing is disabled; the standard web screenshots show the requested CTA labels. Account-specific paid states preserve management rather than offering duplicate paid purchases.

The user approved the visual redesign and requested Git staging only. No commit, push, deployment, or publication is authorized by that request. Work stops after staging.

## Primary preview gallery

### A. Mobile, all three cards, 390px wide

![A. Mobile, all three cards, 390px wide](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/mobile.png>)

### B. Desktop, Teams / Pro / Rookie, 1440px wide

![B. Desktop, Teams / Pro / Rookie, 1440px wide](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/desktop.png>)

### C. Existing onboarding selection

![C. Existing onboarding selection](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/onboarding.png>)

### D. Existing account upgrade destination, reached through Settings

![D. Existing account upgrade destination, reached through Settings](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/account-upgrade.png>)

### E. Expanded full feature comparison

![E. Expanded full feature comparison](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/comparison-expanded.png>)

### F. Active Pro user

![F. Active Pro user](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/existing-pro.png>)

### F. Active Teams user

![F. Active Teams user](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/subscription-review-mockup/existing-team.png>)
