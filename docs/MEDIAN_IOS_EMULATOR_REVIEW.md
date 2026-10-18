# Median iOS emulator review — October 17, 2026 (Pacific)

**Partial runtime verification: the existing OnlyFast cloud app launched, rendered its tutorial, and Skip reached Sign In. RevenueCatPlugin is present in native launch logs. Authenticated login and native JavaScript method responses remain unverified.** No purchase, restore, paywall, rebuild, submission or production deployment occurred.

## Actual session observations

Used the existing authenticated Median App Studio browser session and existing OnlyFast app. Native Plugins → RevenueCat explicitly showed **Plugin Enabled / PLUS**. Build & Deploy showed bundle **app.onlyfast**, iOS source **CURRENT**, and IPA **OUTDATED**. The existing simulator artifact was used; a source export's CURRENT status does not establish that every cloud binary is current. Runtime SDK/plugin versions were not independently read.

Opened the existing iPhone 14 Pro / iOS 26.0 Appetize simulator through Median's own link and enabled its simulator Debug Mode for native logs. Web Console Logs were already enabled; no build setting was changed. The native app displayed the OnlyFast logo/tutorial and cookie notice. Accept Essential dismissed the notice. Tutorial Skip reached the actual Sign In form. No production account was created or account credentials entered by the agent. The user was asked to sign in with an approved test account; completion has not been confirmed. The five-minute session expired normally and the tab remains available to restart. No unexpected app crash was observed in the captured session.

Native launch logs were downloaded through Appetize's Download Logs UI. Private local evidence:

`tmp/median-ios-emulator-review/native-launch.log`

SHA-256: `89F651D718316D00D479CF27D31E7C577F43C43EC0CFFF4CF5FD87448DC11561`.

The log includes **239 duplicate RevenueCat/RevenueCatUI class warnings**, with classes appearing in both `OnlyFast.app/Frameworks/RevenueCatPlugin.framework/RevenueCatPlugin` and the `OnlyFast.app/OnlyFast` executable. This proves the vendor framework is packaged and loaded, but is not proof that its JS methods or SDK initialization work. The warnings warrant linkage review; causation of a crash was not established. The log has no captured fatal/uncaught/SIGABRT marker. There is no successful SDK-configuration banner or `isInitialized` / `getOfferings` callback. A class name containing `NotConfiguredPurchases` is a duplicate-class warning, **not an actual method response**. No earlier Android diagnostic result is reused as iOS evidence.

## Safety condition found before rebuilding

The current iOS IPA configuration shows **Upload to App Store Connect → Automatic**, with Distribution Profile selected. This differs from the earlier source-resolution snapshot. It was inspected only; no signing/upload setting was changed. Because an IPA rebuild could auto-upload, no IPA/Rebuild All action was used. The simulator's Rebuild iOS button was also left untouched because an independently safe simulator-only rebuild path was not established in the available UI. The existing artifact already contains the plugin, so no rebuild was necessary merely to prove inclusion.

## Built-in bridge versus OnlyFast adapter

The following describes the currently documented [Median RevenueCat API](https://docs.median.co/docs/revenue-cat) and [official bridge implementation](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts) / [types](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/types/revenueCat.ts). It is **not** a claim of successful calls in this session.

| Requirement | Built-in documented bridge | Runtime result here |
| --- | --- | --- |
| Initialize public iOS key with Supabase UUID | `configure({apiKey, appUserID})`; identity is supplied by web caller | Not initialized by agent; verified signed-in UUID unavailable |
| Check initialization | `isInitialized()` | No actual callback obtained |
| Fetch package identifiers | `getOfferings()` returns identifiers/success/error, without an offering input | No actual callback/catalog obtained |
| Select `onlyfast_monthly_v1` by name | No documented offering-identifier argument; JS implementation forwards no input | Not selected; no undocumented argument attempted |
| Retrieve Pro/Teams product details, localized prices/periods | No such fields in published getOfferings response type | No product or price returned/claimed |
| Explicit purchase selection | `purchase({identifier})` exists; exact native selection behavior must be checked against installed version | Not called; purchases held |
| Account identity changes | Current official JS source exposes login/logout with appUserID; native-version support still requires validation | Not called; no identity change/transfer/restore |
| Restore | Documented method exists | Not called |

The plugin's App Studio page has no key/identity/offering configuration fields. Median documents runtime JS configuration, so basic initialization does not require a new custom Swift adapter if the plugin is already packaged. Product/catalog fields or offering selection cannot be added by passing an invented argument to getOfferings. The custom OnlyFast source adapter adds the exact named catalog, price/term metadata, authenticated UUID verification, bound explicit selection and account-generation protections absent from this published contract. It remains local, uncompiled and absent from this cloud build; it was not uploaded or installed during this task.

**Conclusion:** custom Swift is not inherently required for basic RevenueCat initialization and built-in purchase/restore capability. For OnlyFast's existing named-offering/full-catalog/security protocol, the published stock bridge is insufficient on its own. That gap needs the existing adapter or a documented equivalent from Median; do not add more native code merely to repeat inclusion/launch checks. A future compatible Median update could change that assessment. The installed iOS JS runtime contract is still unverified, so this session cannot establish that the stock plugin meets the full release requirements.

## Emulator limitations and remaining steps

[Median's testing guide](https://docs.median.co/docs/development-test-deep-dive) and [debugging guide](https://median.co/blog/how-to-troubleshoot-webview-apps-debugging-guide) describe cloud simulators as useful for UI/plugin logs but limited for in-app purchasing. [Appetize requires simulator .app builds](https://docs.appetize.io/platform/app-management/uploading-apps/ios), rather than App Store device IPAs. A missing native bridge field is an API limitation; inability to validate real StoreKit behavior is a separate simulator limitation. No claim that an empty store response proves broken products is made, since no store request occurred.

The Appetize developer-tools selector exposed Automation Recorder, Network Logs and Debug Logs. Median's Devtools control did not expose an interactive native WebView console in the available browser interface. The production web app has no reviewed read-only iOS diagnostic control available in this session. We did not inject code into production, change the website URL, load anonymous SDK identity, or weaken a tester gate to work around that. Browsing a developer demo in an ordinary desktop tab would not test this native bridge.

Shortest next steps:

1. Complete the pending approved test-account sign-in in the existing simulator to verify login. Restart a five-minute session if necessary; do not send credentials in chat or create a production test account.
2. Obtain a read-only diagnostic surface **inside this iOS WebView**: a supported interactive native console or an approved separate diagnostic build using Median's developer demo/test page. First call only isInitialized/getOfferings and capture actual callbacks. Keep transactions absent. Initialization requires a verified Supabase UUID; the local-only synthetic tester cannot authenticate against the production website or be assumed reachable from Appetize.
3. If a new internal build is needed, establish simulator-only generation or separately review the automatic-upload setting before any rebuild. Do not silently alter the production app's startup URL, signing or upload configuration.
4. Confirm the installed bridge's exact catalog limitations and investigate duplicate native linkage. Reuse the existing adapter only for demonstrated gaps, with one SDK owner and unchanged readiness holds.
5. For eventual full Apple subscription validation, use approved device/TestFlight/StoreKit access and isolated test backend connectivity. Median's five-minute simulator alone is not a complete purchase-verification environment. No purchase/restore is approved by this report.

Only this documentation was added locally. No native or web implementation, dependency, SDK key, production Supabase record, Stripe subscription, RevenueCat offering/current/paywall, store product, signing setting, branch or worktree was changed/deleted. Public `NATIVE_PURCHASES_READY=false` remains unchanged. Full runtime/native method testing is pending, not passed.
