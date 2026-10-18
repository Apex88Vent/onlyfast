# Physical iPhone acceptance preparation — October 18, 2026

Preparation only. Do not purchase or restore until separately approved. Android acceptance and the stock iOS simulator visual acceptance are complete; do not repeat them.

## Ready

- Reuse the stock Median RevenueCat plugin and shared simplified controller. No custom Swift adapter.
- Reuse the separate LOCAL synthetic iOS user `5ea2a2af-876a-42bb-84cc-4e4319a90a7e` (`median-bridge-91ecc2448f@example.invalid`). Local sign-in and server-managed tester authorization were rechecked; membership is Rookie without a grant. RevenueCat currently has no active entitlement.
- This tester's `onlyfast_monthly_v1` override was already assigned during the completed simulator session. Retain it; do not change the global offering. The project `default` offering was rechecked and remains current.
- Credentials stay in ignored `tmp/ios-stock-paywall-acceptance/ios-tester.local.json`; open that file privately for the tester. Do not put its password in this document, an invitation, a URL or the native binary.
- Existing UUID-restricted native-sandbox synchronization workspace: `tmp/ios-stock-paywall-local-sync`. It reuses the existing handler, rejects remote Supabase and production receipts, and is not production deployable.
- The temporary visual-test HTTPS tunnel and QA server are stopped. Do not reuse their expired hostname.

## Build/access gate — read-only TestFlight inspection completed

OnlyFast (Apple app ID `6792149373`) was inspected after developer sign-in. The newest uploaded build is **1.0.0 (41)**, uploaded September 24, 2026 at 9:37 PM as displayed by App Store Connect. It is Validated, bundle `app.onlyfast`, arm64, iPhone/iPad, minimum iOS **15.5**, with 67 days remaining. Its original filename is `7dbd5dd6-13b0-4ecd-8910-71d7cfc61f8c.ipa`. It belongs only to `internal`; external-testing status is **Ready to Submit**. What to Test is empty and no individual testers are assigned. Neither stock-plugin contents nor isolated QA routing can be established from this metadata.

The existing `external` group has three testers and only build **1.0.0 (25)**, status **Rejected**. Its testers show **No Builds Available**. Thus there is currently no verified external TestFlight build to recommend to the wife. No testers/groups/build assignments were changed and no invitations or review submissions were sent.

The verified simulator artifact is not a TestFlight device build. It contains the stock plugin and supports `presentPaywall()`, but this does not establish what an existing TestFlight binary contains.

The normal wrapper opens production `https://onlyfast.app?nativeApp=true`. The simulator used an Appetize-only launch argument to open isolated QA. That argument is not a TestFlight entry mechanism. An existing build is suitable only if it has a verified supported way to open the isolated HTTPS QA site **inside its native WebView**, with the stock plugin. Opening QA in Safari is insufficient. Do not sign the local synthetic account into production or enable production purchases.

If no existing build has that route, a signed stock-plugin QA wrapper is necessary. Prepare it separately, preserving production Median configuration. On this inspection, the **fully loaded** Median page reports iOS IPA **OUTDATED**, iOS source **CURRENT**, bundle `app.onlyfast`, Configure unchecked, and Rebuild enabled. The upload control says **Version 1.0.0 is already on App Store Connect. Rebuild, or set a higher Version Name, then upload again.** The IPA backup list says **No Backups Available**, so it cannot establish build-41 provenance. The earlier initial/loading-state messages about missing signing/API credentials are not a verified current blocker. Signing and upload eligibility for a separate QA configuration still need confirmation; do not infer them merely from the enabled Rebuild control. No rebuild, configuration change, binary upload or distribution was performed.

## Wife's installation and invitation

1. On her iPhone, install Apple's **TestFlight** from the App Store using her existing Apple account. Keep her Apple/iCloud account unchanged.
2. Once a suitable build is confirmed, use OnlyFast → TestFlight → a restricted **External Testing** group → add her email → invite. Do not add App Store Connect administrator/developer access or create a public invitation link. Obtain her invitation email and explicit send authorization before sending.
3. External builds need TestFlight beta review where applicable; this is distinct from a public App Store release. Open the approved invitation on the iPhone, accept it in TestFlight, and install the exact agreed build.
4. Record the iPhone model and iOS version to confirm build compatibility. No Apple password or verification code should be shared.

Apple states that apps downloaded from TestFlight automatically operate in the sandbox. Basic purchase/restore acceptance does not require signing out of her existing Apple account. Optional dedicated Sandbox Apple Account controls for renewal/billing scenarios are outside this one-test scope.

## Operator readiness before transaction approval

1. Confirm the selected QA binary and its isolated WebView startup URL. Keep `NATIVE_PURCHASES_READY=false` in production.
2. Reuse the running unlinked Docker Supabase environment. Do not reset, migrate, link or expose its API/database/Studio ports.
3. Arrange an approved temporary HTTPS route only to the hardened QA server at `127.0.0.1:8086`; set its exact allowed origin. Re-run the existing endpoint security preflight. No credentials, admin or diagnostic routes may be exposed. Keep the Windows host awake during the scheduled acceptance session.
4. Reuse `tmp/ios-stock-paywall-local-sync` and its private server env; verify the marker's tester ID above. Serve the existing function locally when transaction approval is given, without any production deployment or setting change.
5. Only after explicit purchase/restore approval, enable the existing QA server operator action setting for this UUID and turn off the prior visual-only mode. Production settings remain unchanged. Do not run acceptance against the earlier presentation-only server: that mode deliberately blocks restore and subscription synchronization.
6. Sign in with the local synthetic credentials. Use **Initialize authenticated native SDK**; verify the displayed UUID equals the one above before presenting the stock paywall. Never initialize anonymously or switch to her real OnlyFast account.

## Exact acceptance steps — pending approval

**Purchase:** Open the stock paywall in the QA wrapper → select Pro → inspect Apple's returned monthly price and any actual eligibility-dependent trial → confirm the installation is TestFlight and checkout is sandbox/test → complete exactly one authorized Pro test purchase. Stop on an unexpected real-money checkout. Verify RevenueCat's sandbox transaction belongs to the exact UUID and grants OnlyFast Pro; let the existing local sync verify the receipt; confirm the server membership resolver returns Pro. A native success callback alone is not a pass.

**Restore:** Keep the same TestFlight/Apple account and synthetic OnlyFast UUID → use the existing stock Restore Purchases action → verify the restored entitlement stays with that UUID → verify local server-confirmed Pro again. Do not clear app data, create another account or repeat the purchase. Test cancellation without completing another transaction and confirm it grants no additional access.

Record the transaction environment, product `app.onlyfast.pro.monthly`, UUID, RevenueCat entitlement, local membership result and restore response without publishing receipt tokens. Stop the tunnel and temporary QA services afterward, restore local operator approval to false, and preserve evidence. Production sandbox rejection, real customers, Stripe and the global offering remain unchanged.

References: [Apple TestFlight sandbox behavior](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight), [Apple external invitations](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/), [TestFlight installation](https://testflight.apple.com/).
