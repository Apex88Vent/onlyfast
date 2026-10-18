# Stock Median paywall acceptance — October 18, 2026

Current checkpoint on `codex/median-paywall-simplification` (base `cbd53eaa`). This supersedes the historical unpublished-paywall/undeployed-Terms observations in the release plan. Public `NATIVE_PURCHASES_READY=false` remains unchanged. No push, deployment, store upload, native build or production database change is included.

## Android

The approved stock-plugin sandbox purchase and restore acceptance passed previously. Do not repeat it. Evidence is preserved locally in `tmp/stock-android-acceptance/RESUMED_ACCEPTANCE_REPORT.md`.

The cancellation bug was a bridge-contract mismatch: stock Median's `addCommandCallback` rejects `data.error`, not the complete native response. The shared controller now normalizes bare message/code objects and strings through its existing failure checker, while preserving full-response compatibility. Cancellation rejects with `NativePurchaseError(cancelled=true)` and never reaches the success/synchronization path. Identity, authorization, server verification, public readiness and native SDK ownership are unchanged.

Validation: 374 unit tests and 9 mounted subscription-control tests passed; application/QA TypeScript, scoped ESLint, production Vite build and `git diff --check` passed. The build retains its existing large-chunk warning. The mounted test runner requires the existing `REACT_TEST_RENDERER_MODULE` environment path; the initial invocation without that setting failed during runner setup and was corrected without source changes. No repeat store transaction was used to validate this fix.

The user completed Chrome's first-run agreement. Its subsequent informational notice was dismissed. Chrome then showed an actual `Chrome isn't responding` dialog during browser navigation; Wait was chosen, without clearing data/settings. End-to-end Android legal-page rendering remains pending. The earlier paywall Terms action launched Chrome, and both public legal URLs returned HTTP 200 without authentication. These are not a claim that the post-setup Android page-rendering check passed.

## Existing iOS wrapper

Read-only live Median review confirms OnlyFast, bundle `app.onlyfast`, RevenueCat plugin enabled under PLUS. The verified revision-16 local source resolves Median plugin 1.1.2 and RevenueCat iOS SDK 5.96.0; its plugin links both RevenueCat and RevenueCatUI. Median documents no-argument `median.revenueCat.presentPaywall()`. No custom Swift adapter is needed for the stock-paywall approach; no iOS transaction or runtime paywall compatibility result is inferred from dependency linkage.

The existing Appetize artifact `uc6w5cozslay2pgyef4okvhxru` launched the original OnlyFast tutorial. Its normal initial URL is production `https://onlyfast.app?nativeApp=true`; the local synthetic tester must not be signed in there. No inspector or production tester bypass was used.

### Verified no-build routing

The existing `GNConfigPreferences` reads `co.median.ios.initialUrl` through NSUserDefaults. `LEANWebViewController` uses that preference before the configured initial URL. Appetize's documented `launchArgs` can supply the temporary preference:

```json
["-co.median.ios.initialUrl", "https://onlyfast.app/terms-of-service"]
```

This was tested in the actual existing iOS artifact: it rendered OnlyFast's public Terms page directly, without login, inspector execution, rebuild or saved Median configuration changes. The same session-only route can target an approved HTTPS QA origin. This verifies navigation, not the native paywall or StoreKit.

### Prepared isolated iOS environment

- Separate synthetic LOCAL UUID: `5ea2a2af-876a-42bb-84cc-4e4319a90a7e`. Local login, server-managed experimental authorization and Rookie/no-grant membership were verified. The approved tester-specific onlyfast_monthly_v1 override was assigned after verified stock SDK initialization. No entitlement was granted.
- Private credentials: ignored `tmp/ios-stock-paywall-acceptance/ios-tester.local.json`. Created using an isolated copy of the existing local tester utility, changing only its fixed root/output paths; original Android utility and tester retained.
- Existing local-only sync preparer produced `tmp/ios-stock-paywall-local-sync`, restricted to that UUID and native sandbox receipts. No function was served/deployed and no subscription granted. Existing public iOS SDK key is already present in the private QA configuration.
- The existing QA server/controller are reused. No new native bridge, paywall implementation or production route is added.
- With explicit approval, one Cloudflare Quick Tunnel forwarded only to `127.0.0.1:8086`. The official portable 2026.10.1 client matched its published SHA-256. Exact-origin/process-local configuration and synthetic tester authorization remained active; local and HTTPS endpoint security tests passed. The tunnel, QA server and temporary loopback helper are now stopped, all port-8086 listeners are gone, and the temporary URL returns HTTP 530. Existing local Supabase containers remain running. The private default approval stays false and no permanent hostname was configured.

Reproduction under fresh approval: run the QA server with process-local iOS UUID/exact HTTPS origin overrides, verify denied admin/secret/unauthorized membership requests, launch the same simulator artifact with the QA initial-URL preference, sign in locally, identify the SDK with the verified UUID and apply the approved customer-specific `onlyfast_monthly_v1` override. Use stock paywall presentation only; do not select purchase/restore. Inspect branding, both package selections, actual returned store text, legal links and dismissal. Keep global default and production sandbox rejection unchanged. Store prices/trials must be reported only if the simulator actually returns them.

## Device/TestFlight boundary

### Completed iOS visual acceptance

The approved temporary HTTPS test used the existing Appetize artifact, stock Median plugin and shared web controller, across two ordinary five-minute sessions. No inspector, source rebuild, custom Swift adapter, purchase or restore was used.

| Check | Result |
| --- | --- |
| Local Auth and server-managed tester authorization | PASS; exact UUID `5ea2a2af-876a-42bb-84cc-4e4319a90a7e` |
| Stock RevenueCat initialization | PASS; native UI confirmed that UUID and RevenueCat recorded the new iOS customer |
| Published `onlyfast_monthly_v1` paywall | PASS; actual stock native presentation with the OnlyFast logo and approved slogan |
| Pro and Teams selection | PASS; each selected card and renewal text reflect its plan |
| Prices/trial presentation | UI PASS; Pro $5.00/month USD, Teams $8.00/month USD, one-week trial shown; physical-device pricing/eligibility and StoreKit transaction behavior are not verified |
| Terms and Privacy | PASS; each footer link rendered its correct public OnlyFast page without login, then returned to the paywall |
| Dismissal | PASS; returned to QA normally and displayed Rookie with `synchronized:false`, no grant and no native error |
| No access from dismissal | PASS; authenticated local membership remained Rookie and RevenueCat active entitlements stayed empty |
| Isolation and shutdown | PASS; global `default` remains current, named offering remains non-current, production `NATIVE_PURCHASES_READY=false`; tunnel and temporary QA services stopped |

No native plugin compatibility blocker was observed for this UI flow. Stock iOS dismissal returned normally, so no Android-style generic error appeared. Restore was visible in the paywall but deliberately untouched; the separate QA restore button and backend sync route were disabled for this run. The tester-only offering override remains assigned for future authorized acceptance; it grants no entitlement.

Ignored evidence under `tmp/ios-stock-paywall-acceptance/`: `ios-paywall-pro.png`, `ios-paywall-teams.png`, `ios-paywall-terms.png`, `ios-paywall-privacy.png`, `ios-paywall-dismissed-rookie.png`, `loopback-security-preflight.json`, `https-security-preflight.json`, `local-tester-readiness.json`, `shutdown-verification.json` and `IOS_VISUAL_ACCEPTANCE.json`. Files containing credentials remain private and are denied by the QA server. These artifacts are not production release inputs.

The current Median build page reports iOS SOURCE CURRENT, iOS IPA OUTDATED, IPA Configure unchecked, Rebuild disabled pending signing, and missing App Store Connect credentials for upload. No TestFlight build/version or authorized physical iPhone tester has been verified. The user subsequently prioritized the existing emulator; do not build another app or upload a binary for this UI check.

A physical iPhone with an appropriate stock-plugin TestFlight build and approved tester remains necessary for real Apple sandbox checkout, receipt/entitlement verification, local server Pro synchronization and restore acceptance. Those transactions require separate approval. Simulator navigation/visual results do not establish these outcomes.

References: [Median RevenueCat](https://docs.median.co/docs/revenue-cat), [Appetize launch arguments](https://docs.appetize.io/platform/query-params-reference), [Apple argument preference domain](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/UserDefaults/AboutPreferenceDomains/AboutPreferenceDomains.html), [Cloudflare temporary tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
