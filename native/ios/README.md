# iOS native source adapter — implemented, not compiled

`OnlyFastBilling.swift` implements shared protocol 1 using the **existing** RevenueCat SDK 5.96.0 and Median plugin 1.1.2 in the verified revision-16 export. It has not been compiled with Swift/Xcode or tested on iOS. Native transactions and public purchasing remain disabled. See [the completion review](../../docs/NATIVE_BRIDGE_COMPLETION_REVIEW.md).

Current priority: [the prepared private GitHub Actions unsigned simulator compilation path](../../docs/IOS_COMPILATION_READINESS.md). A self-contained local review workspace and inactive manual workflow are ready; no CI push/run or paid macOS hosting has been authorized or performed.

First-compilation request: [pre-upload stop report](../../docs/IOS_FIRST_COMPILATION_STATUS.md). The draft timeout is now 30 minutes. Upload/CI authorization is conditional on verifying the source license and billing checks; no upload or run occurred.

Use only `C:\Users\c_mar\Downloads\ios_source.tar (1).gz`, SHA-256 `91431FBDC8761910F1CEF4EA8E167E0EB9C2810296C83E1321418CA0FEA11628`. Its preserved extraction is `tmp/ios-source-current/ios`. Old revision-12 exports remain untouched. The [source evidence](source-resolution.snapshot.json) records bundle `app.onlyfast`, configuration 16, plugin 1.1.2 and SDK 5.96.0. The [store snapshot](store-readiness.snapshot.json) records earlier Apple configuration; it does not prove runtime prices or eligibility.

## Reproduce in a new copy

From this worktree, choose a nonexistent output directory whose parent exists:

```powershell
node scripts/inspect-median-ios-source.mjs tmp/ios-source-current/ios
node scripts/prepare-median-ios-release-source.mjs --source tmp/ios-source-current/ios --output tmp/ios-release-adapter-final
```

The tool rejects wrong bundle/plugin, changed revision or SDK pins, changed vendor anchors, overlapping paths, existing output and already patched source. A newer Median export requires fresh intake and anchor review before extending the preparer; do not bypass assertions. `ONLYFAST_IOS_PREPARATION.json` records original hashes and four native changes:

- Add `LeanIOS/OnlyFastBilling.swift`.
- Attach before initial navigation in `LeanIOS/LEANUtilities.m`, including pooled WebViews.
- Attach idempotently in `LeanIOS/LEANWebViewController.m` for adopted/restored views.
- Add Swift source/reference to `OnlyFast.xcodeproj/project.pbxproj`.

The existing Tuist Swift glob covers the new file. Bundle ID, signing, SDK/plugin manifests, locks and vendor delegates are unchanged. Both Objective-C hooks already import `GonativeIO-Swift.h`. No second RevenueCat dependency is added. Xcode must still prove that the existing transitive RevenueCat module is visible to the app target; static linkage inspection cannot establish compilation.

## Identity, catalog and ownership

Only main-frame HTTPS `onlyfast.app` / `www.onlyfast.app` is accepted, with native frame/current-URL checks. Only public SDK/publishable keys are embedded. Identify/catalog verify the UUID against fixed Supabase Auth `/user`, with no redirects, cookie storage, token logging or editable-metadata authorization. Transactions additionally reverify immediately before submission.

OnlyFast must be the sole configure caller. The adapter configures with a verified UUID, never anonymously. Median's plugin, handlers and delegate remain installed; a foreign configured SDK returns `SDK_OWNER` rather than being adopted/reset. Verify ownership in a real build. Switching invalidates user-bound catalog tokens and old callbacks, logs out the owned identity, then logs in the verified account. No restore occurs during login. A document nonce rejects replies after navigation.

The adapter reads `offerings().all["onlyfast_monthly_v1"]`, requires exact Pro/Teams packages and Apple products, and returns actual title, price, currency, period, introductory metadata and best-effort eligibility. Missing/ambiguous products and invalid prices fail closed. Purchase uses the exact cached native Package bound to user/generation/expiry; cancellation, pending and store failures remain distinct. Restore is explicit. The independent native hold rejects both operations before Auth/store transaction calls.

Background invalidates selection; resume and owned customer-info changes emit a payload-free `subscription-updated` event for existing authenticated server refresh. The stream does not overwrite Median's delegate. Purchase/restore success also follows the existing web caller's Supabase sync path. SDK entitlements never grant membership directly.

## Compilation and runtime blockers

Windows has no Swift/Xcode toolchain. Source assertions, bootstrap execution and mocked web contract tests passed; no iOS SDK execution, StoreKit, signing or IPA is claimed. Use approved borrowed/hosted macOS with Xcode compatible with the vendor binary's Swift 6.2.3 interface, existing licensed registry access, and the generated workspace. First compile unsigned with `CODE_SIGNING_ALLOWED=NO`; inspect module visibility, generated header, actor isolation and lifecycle. Do not regenerate Tuist using development bundle defaults.

Then review SDK ownership and isolated QA origin/Auth configuration. This release adapter accepts production HTTPS only; a separate reviewed QA copy must use the isolated local backend. Keep sandbox records out of production. Signing/device or TestFlight access and transaction tests require separate approval. No paid hosting or cloud custom-plugin service was purchased. Licensed source builds can include this adapter; Median cloud inclusion still requires supported custom integration.

References: [exact Purchases 5.96.0 APIs](https://github.com/RevenueCat/purchases-ios/blob/5.96.0/Sources/Purchasing/Purchases/Purchases.swift), [Median source builds](https://docs.median.co/docs/build-ios-from-source), [Median RevenueCat](https://docs.median.co/docs/revenue-cat). Inspected vendor sources/binaries remain ignored under `tmp`; they are not redistributed.
