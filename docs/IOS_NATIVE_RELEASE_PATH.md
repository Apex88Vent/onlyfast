# OnlyFast iOS native RevenueCat release path — October 17, 2026 (Pacific)

> Follow-up: [source blocker resolved](IOS_SOURCE_BLOCKER_RESOLUTION.md). Authenticated App Studio inspection confirmed a stale source archive, and source-only regeneration now provides `app.onlyfast`, Median RevenueCat plugin 1.1.2 and SDK 5.96.0. The missing-source findings below are historical; no iOS native build/signing/upload occurred.

Prepared on `codex/native-revenuecat-release` from `55a0c2c7`. No Android runtime diagnostic/build was repeated. No native/app build, hosted runner, upload, store submission, purchase, restore, deployment or production setting/data change occurred. `NATIVE_PURCHASES_READY=false` remains unchanged.

## Shortest reliable route

**You do not need to own a Mac.** Inspect/edit on Windows, then build/sign with Xcode on approved hosted or borrowed macOS hardware. A trusted tester can use their compatible iPhone/iPad for the eventual real TestFlight test. A CI job alone is not evidence of a TestFlight purchase.

Given the unavailable Median support access, the practical route is a corrected licensed iOS export plus a source-built OnlyFast adapter and hosted/borrowed Xcode. A borrowed trusted Mac avoids initial CI setup; GitHub also documents [macOS hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) and [Xcode signing through a temporary keychain](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications). Private-repository jobs consume plan minutes and may incur charges. No free allowance, billing permission or provider access has been assumed; no workflow was added or run.

If a current plugin-enabled export cannot be obtained, licensed source customization can instead add the [official RevenueCat iOS SDK through SPM](https://www.revenuecat.com/docs/getting-started/installation/ios) and the OnlyFast adapter in a separate reviewed copy. Confirm the intended app identity, compatible SDK version and macOS build access first. This source-built route does not require Median to accept a cloud custom plugin. It is additional dependency/integration work, not a functioning integration today. The intake utility targets normal Median plugin exports; an intentional direct-SDK variant needs its own reviewed configuration checks.

Median cloud builds are another supported route, **conditional on Median integrating the custom plugin**. There is no documented self-service upload-a-source-patch mechanism. Median offers custom SDK/plugin enhancements, but plan/service access for this app is unverified. See [custom plugins](https://docs.median.co/docs/native-plugins-overview) and [licensed source modification](https://median.co/faq). Editing a downloaded export does not automatically change cloud-built binaries.

## Actual source audit: two blockers before implementation

Both Downloads archives, `ios_source.tar.gz` and `ios_source (1).tar.gz`, are identical. SHA-256: `391BE0CFDB9BCA5C7BD5EB043B7CE98328B9E66ED5AD3500172C5AFF8A292B1D`. The audit extraction is `tmp/ios-source-audit/ios/`; vendor source remains ignored and uncommitted.

| Evidence | Finding |
| --- | --- |
| Workspace / scheme | `OnlyFast.xcworkspace`, `OnlyFast.xcodeproj`, scheme `OnlyFast` |
| appConfig and generated app target | **`co.median.ios.bnkramx`**, mismatching RevenueCat's registered **`app.onlyfast`** |
| RevenueCat dependency | No enablement, native plugin/product linkage or resolved SDK version found |
| Build system | Tuist + Swift Package Manager; deployment target iOS 15.5 |
| Resolved packages | GoNativeCore 3.0.10, MedianIcons 1.2.0, ZipArchive 2.6.0 |
| Metadata | `dependencies.json` reports core 2.4.1 / plugins `{}`; inconsistent with resolved core |
| Regeneration | `Project.swift` defaults to `io.gonative.ios.dev`; preserve reviewed `TUIST_*` builder values |
| Signing/capabilities | Team is empty in generated settings; an empty entitlements file does not verify In-App Purchase provisioning |
| Startup | Existing HTTPS OnlyFast URL and Median JS injection; no source URL change made |

The Android export separately declares iOS ID `app.onlyfast` and RevenueCat active. This demonstrates an export mismatch, not proof of the current iOS binary's configuration. The live Median portal and current custom-plugin entitlement were not inspected.

**Do not change a live Apple app's identity to match the stale export.** Confirm the existing App Store Connect app/bundle, obtain an export for that app with the licensed RevenueCat plugin included, and retain its resolved dependencies. If the portal still shows the old ID/plugin disabled, review those Median settings with the owner before changing them. No correction was applied here.

Median documents source download under App Studio → Build & Deploy → iOS Source Code. Download/extract into a new directory, preserving originals. Text editing can happen on Windows; building/linking/signing needs macOS and the Xcode toolchain, not necessarily the Xcode GUI. The [general source-build guide](https://docs.median.co/docs/build-ios-from-source) describes CocoaPods, but this archive's real README/manifests use Tuist/SPM; do not install CocoaPods or regenerate blindly.

## Windows preparation completed

`scripts/inspect-median-ios-source.mjs` is a read-only intake tool. It checks workspace/project, generated/configured app identity, RevenueCat enablement/linkage and resolved dependency evidence; it emits selected fields rather than private app keys. Exit 2 identifies blockers. Passing intake does not verify signing, compilation, provisioning or purchases. Use it on the corrected export before spending macOS build time.

Windows can complete source review/editing, shared TypeScript tests, RevenueCat/Apple dashboard administration and preparation of an approved hosted build plan. This Windows host has no `xcodebuild` or Swift executable available. No toolchain or alternate native framework was installed.

## Equivalent iOS bridge design

Reuse [protocol 1](../native/BRIDGE_PROTOCOL.md), `ReleaseNativePurchaseController`, `releaseNativeTransport`, `nativePurchases`, the existing plan/restore UI components and authenticated `sync-revenuecat-subscription`. The function named `createAndroidBillingTransport` accepts a generic string-message/onmessage channel; the controller already validates `platform: ios` and exact Apple IDs. No generic paywall/current-offering fallback is needed.

The stock [Median RevenueCat API](https://docs.median.co/docs/revenue-cat) and [official JavaScript source](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts) expose no offering-identifier parameter for `getOfferings()`. An undocumented web argument cannot extend native behavior. With the actual SDK-bearing source, add a parallel OnlyFast adapter using that SDK, or have Median supply equivalent custom-plugin functions. Do not replace the licensed plugin or initialize a second SDK instance.

This is a design, **not an installed Swift adapter**. Exact SDK APIs/concurrency support must be verified against the corrected export's resolved RevenueCat version. No placeholder Swift implementation or invented Median method was added.

### WebView lifecycle and transport

Use documented [WKScriptMessageHandler](https://developer.apple.com/documentation/webkit/wkscriptmessagehandler) and main-frame [WKUserScript](https://developer.apple.com/documentation/webkit/wkuserscript/isformainframeonly) facilities. Install a private handler and document-start adapter exposing the existing interface:

```text
window.onlyFastBilling.postMessage(JSON string)
window.onlyFastBilling.onmessage({data: JSON string})
```

The private WK handler name is an implementation detail, not a Median API. Preserve `{requestId,result:{protocolVersion:1,...}}`. Inject only into the main frame; independently check message frame/security origin and current top-level URL against approved HTTPS OnlyFast origins. Safely JSON-encode replies. Reject malformed/unapproved requests before SDK calls.

Actual source anchors are `LEANWebViewController.m`'s `initializeWebview`, `addScriptMessageHandlersInWebView:` (around line 1436) and `switchToWebView:` (around line 1889). `LEANWebViewPool.m` can load pooled views before adoption. Recheck anchors in the corrected export, register before initial navigation and cover pooled/new/restored views. Remove only the adapter's own handlers. Preserve Median's delegates, process pool, navigation, authentication, file writer/photo picker and other document scripts.

### Operation requirements

| Operation | Required behavior |
| --- | --- |
| capabilities | Protocol 1, `platform: ios`, independent native transactions hold initially false |
| identify | Verify bearer token natively against fixed Supabase Auth; require returned UUID equals expected UUID; configure/log in with that exact ID and verify actual SDK identity |
| catalog | Select `onlyfast_monthly_v1` from full offerings; require both exact packages/products; generate an opaque short-lived catalog token bound to UUID and identity generation |
| purchase | Publicly held. After separate approval, reverify identity, consume the displayed catalog selection and purchase exactly that native package with offering attribution |
| restore | Publicly held; explicit authenticated action only, never automatic on login; respect existing transfer policy |
| invalidate | Immediately invalidate cached/in-flight results when identity changes; cannot cancel an already-open store sheet |
| clear | Clear catalog and safely log out the owned SDK identity; reject results for the previous account |

Use the existing iOS public key `appl_ScuxViARpeZHZQyTtVQQpSooVFz`. Never embed REST/server-role credentials. Keep one SDK owner and preserve or coordinate existing Median RevenueCat delegates/listeners.

Return actual localized store price/currency, billing period and applicable introductory terms. Use checked decimal arithmetic for micros, not parsed formatted currency strings. `optionIdentifier` can be null on iOS. Request introductory eligibility through the installed SDK where supported; preserve `unknown` and an eligibility limitation note otherwise. RevenueCat calls eligibility best effort and the store sheet remains final: [introductory-offer guidance](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers). Do not manufacture free phases from the dashboard trial setting.

Map actual completed/cancelled/deferred-or-pending/failed native outcomes to `purchased`, `cancelled`, `pending`, `error`, verifying supported SDK callbacks/error codes during implementation. Pending/offline/timeout never grants access or automatically retries a purchase. Refresh on resume to catch later approvals/expirations. After native success/restore, invoke the existing authenticated server sync and reload trusted membership; client entitlement JSON alone grants nothing. Preserve Rookie free access and Stripe/promotional precedence.

### Isolated TestFlight backend

TestFlight purchases are sandbox. Production `REVENUECAT_ALLOW_SANDBOX=false` stays unchanged; TestFlight must not use production subscriber identities/records to obtain sandbox access.

Use a separate restricted QA binary/web environment with the existing free local Supabase/Docker database, synthetic UUIDs and server-managed experimental tester authorization. Keep public `NATIVE_PURCHASES_READY=false`. Any future QA-only transaction enablement needs explicit approval and remains separate from public builds.

A tester's Apple device or hosted Mac cannot reach Windows services via its own `127.0.0.1`. Before a build, choose approved private-network connectivity or a secured HTTPS development proxy to the existing local web/API services. Do not create a paid database or expose the Android operator/autologin endpoint, Studio, local-status files, database port or service-role credentials. No tunnel or remote resource was created here.

## Live Apple and RevenueCat mapping

[Snapshot](../native/ios/store-readiness.snapshot.json), fetched from App Store Connect through RevenueCat at `2026-10-17T23:55:40Z`:

| Plan | Product | Package | Entitlements | Configured US price |
| --- | --- | --- | --- | --- |
| Pro | `app.onlyfast.pro.monthly` | `$rc_monthly` | OnlyFast Pro | USD 5.00 |
| Teams | `app.onlyfast.teams.monthly` | `$rc_custom_teams_monthly` | OnlyFast Pro + OnlyFast Teams | USD 8.00 |

Both are in `OnlyFast Memberships`, `READY_TO_SUBMIT`, priced/available in 175 territories, with a one-week trial configured in all 175 starting October 16. Store health is `needs_action` pending review, with no read error and no separate warnings field returned. RevenueCat reports App Store Connect and In-App Purchase keys configured. This does not establish CI signing credentials, account agreements or real StoreKit eligibility/prices. The named offering remains non-current; `default` remains current.

Eligibility is group-based: switching from Pro to Teams does not guarantee a second introductory trial. Native prices/terms must come from the actual SDK session, not these configured US prices.

Apple confirms [sandbox testing does not require prior subscription review](https://developer.apple.com/documentation/technotes/tn3186-troubleshooting-in-app-purchases-availability-in-the-sandbox). Verify active Developer membership, Paid Apps Agreement, banking/tax, correct App ID/profile and In-App Purchase capability before testing. [TestFlight purchases use sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).

Public sale later requires subscription approval. The first auto-renewable subscription submission must accompany a new app version and its new group as applicable: [Apple submission requirements](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase). External TestFlight distribution may require separate beta review, distinct from product approval. No submission is authorized now.

## Exact inputs and subsequent steps

1. **Current SDK-bearing iOS export:** correct intended bundle/app, plugin enabled, workspace/project, Tuist/SPM manifests and locks, plugin version/source or binaries. The two identical stale Downloads exports are already located; obtain a fresh correct export rather than resending those files. Run the intake utility.
2. **Build route/access:** approved hosted or borrowed macOS/Xcode, compatible Tuist/SPM and access to Median's package registry. Confirm costs/limits before execution. For Median cloud, obtain their agreement/access for custom-plugin inclusion instead.
3. **Secure signing setup:** confirm existing numeric Apple app record, bundle/team, proper role and certificate/profile or approved managed signing. Configure private keys in the chosen provider's secret storage after approval; do not paste them into chat or commit them. RevenueCat's server keys do not replace signing credentials.
4. **Trusted compatible-device tester:** borrowed/teammate iPhone or iPad is the shortest direct test path. Apple also supports eligible iOS apps via [TestFlight on Apple-silicon Macs](https://developer.apple.com/help/app-store-connect/test-a-beta-version/test-iphone-and-ipad-apps-on-macs-with-apple-silicon), but that does not replace iPhone-specific QA. Windows/Android emulators and CI jobs are not TestFlight iOS runtimes.
5. **QA network decision:** tester-reachable approved web/Auth/API URL backed by the existing isolated local environment.
6. After review/build approval, implement against the actual resolved SDK/lifecycle, then compile and run catalog, identity and hold checks first. Keep transactions held.
7. After separate signing/upload approval, create a restricted TestFlight build, resolve processing/export-compliance prompts and select authorized testers. Obtain beta-review approval if using external distribution.
8. Only after transaction approval, verify StoreKit product/terms, selected package, RevenueCat UUID/sandbox environment, isolated server sync and trusted membership. Cover pending/cancel, renewal/expiration, offline/account switching and explicit restore.

## Android and the shortest joint launch path

Accept Android's `55a0c2c7` runtime evidence. Remaining work: release/minified-variant testing; signing/versioning; authentication and photo-picker smoke tests; exclusion of all QA overlays/local bindings/credentials; and legitimate release AAB creation after build approval. No Android build or further sandbox purchase was run here.

Do Android's release packaging review while obtaining the corrected iOS export and macOS/tester access. Reuse the shared web controller and existing backend. Validate iOS catalog/identity first, then separately approved isolated sandbox transactions. Build/upload, Apple subscription review and public activation remain separate approval stages. Keep Coming Soon and native transaction holds until validation and activation approval are complete.

## Work saved and limits

Read-only archive/configuration audit, live product mapping snapshot, this bridge handoff, refreshed iOS README, and a Windows intake utility with a synthetic regression test. All 96 targeted source-intake/shared-bridge/readiness/iOS-UI tests and focused lint passed. These are not native iOS runtime tests. No application build was run.

No Swift adapter, SDK installation, workflow, binary or StoreKit/TestFlight success is claimed. Implementation needs a confirmed app identity/dependency baseline and macOS toolchain access: a corrected plugin-bearing export is preferred; a separately reviewed direct-SDK source integration is an alternative. No subscription backend rebuild is needed.
