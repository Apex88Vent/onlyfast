# Median iOS source blocker resolved — October 17, 2026 (Pacific)

Follow-up: [Swift adapter implementation and minified Android runtime review](NATIVE_BRIDGE_COMPLETION_REVIEW.md). This report preserves the earlier source-resolution evidence; its runtime/signing statements describe that earlier stage.

The iOS configuration/dependency blocker is resolved **without macOS hosting, signing, an IPA build or an upload**. Only Median's **iOS SOURCE CODE → Rebuild** was invoked, followed by downloading and inspecting that source archive. No app/plugin setting was changed. Android release compilation/R8 also passed; its photo-picker runtime check encountered a separate emulator system crash.

## 1. Exact bundle-ID cause

The old Downloads archives are a **cached export of an earlier configuration of the same OnlyFast application**. They contain configuration revision 12 and the old auto-generated identifier `co.median.ios.bnkramx`. The live OnlyFast App Studio page has public sharing ID `bnkramx`, the published OnlyFast store listings, and current iOS/Android identifiers `app.onlyfast`. Its iOS source row explicitly said **OUTDATED** while Android source was CURRENT.

This rules out a current incorrect Median app identifier and the wrong-app explanation for these files. `co.median.ios.bnkramx` is an actual exported build setting, not the Tuist template default. The template default is separately `io.gonative.ios.dev`; the builder supplies `TUIST_*` values. The exported Info.plist reads `$(PRODUCT_BUNDLE_IDENTIFIER)`, so an unchanged local build of the old generated project would use the old ID. No archive-local build phase silently changes it to `app.onlyfast`. A new cloud generation uses current app settings; it does not retroactively rewrite an old downloaded project.

The portal does not expose the full historical settings-change audit here, so the exact date/actor of the earlier ID change is not claimed. The original archives and their hashes were preserved.

## 2. Exact RevenueCat-linkage cause and verified resolution

The earlier revision-12 export predates the plugin-enabled configuration: no `services.revenueCat`, empty plugin dependency metadata, empty builder package/product injection slots, and no RevenueCat pin/linkage. This was not a missing `pod install` step: the actual export uses **Tuist / Swift Package Manager**, and has no Podfile.

The live app already had **RevenueCat enabled under PLUS**. Source-only regeneration produced revision 16 and fixed both issues:

| Check | Old source | Newly generated source |
| --- | --- | --- |
| Config / generated target bundle | `co.median.ios.bnkramx` | `app.onlyfast` |
| Configuration revision | 12 | 16 |
| RevenueCat active | absent | true |
| Median RevenueCat package | absent | `median.revenue-cat-plugin` **1.1.2** |
| Linked Xcode product | absent | **RevenueCatPlugin** in app dependencies/Frameworks |
| Resolved official SDK | absent | `purchases-ios-spm` **5.96.0** |
| GoNativeCore | 3.0.10 (metadata 2.4.1) | **3.0.17**, metadata consistent |
| Source intake | blocked | **passed**, zero blockers |

`Project.swift` now injects the exact Median package/product, and the workspace lock resolves the official SDK transitively. Preserve these pins; do not add a second SDK version or blindly regenerate with Tuist defaults. Registry configuration points to `https://packages.median.co`; resolution/access must eventually be verified on the selected build host.

The plain bundled `GoNativeJSBridgeLibrary.js` still does not contain RevenueCat functions. That alone is not missing integration: `LEANAppDelegate.m` forwards launch/lifecycle into `GNBridge`, and `LEANWebViewController.m` calls `bridge loadUserScriptsForContentController:` to load plugin scripts. Plugin internals/registration are provided by the resolved Median packages, not an app-local handwritten registration file. The source hooks and dependency linkage are established; actual iOS registration/JavaScript exposure still require a native build/runtime. No runtime success is claimed.

Source: `C:\Users\c_mar\Downloads\ios_source.tar (1).gz`.

SHA-256: `91431FBDC8761910F1CEF4EA8E167E0EB9C2810296C83E1321418CA0FEA11628`.

Preserved extraction: `C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\ios-source-current\ios`.

[Machine-readable source/portal evidence](../native/ios/source-resolution.snapshot.json). The inspection utility is deliberately offline; its `liveMedianConfigurationVerified: false` field describes what that utility itself verifies. The separate `livePortal` evidence records this task's authenticated UI inspection.

## 3. Recommended integration route

**Shortest supported route now:** retain the verified licensed export and its existing RevenueCat SDK, then implement the OnlyFast named-offering adapter using the existing shared protocol. This is a direct native SDK integration alongside the licensed Median plugin, with a single coordinated SDK owner. It requires no additional Median custom-plugin service for source-built binaries. No Swift adapter or SDK dependency change was made during this source-resolution task.

Median's custom-plugin route remains supported if their engineering team agrees to incorporate the extra named-offering/pricing functions into their cloud build platform. Custom-plugin access, scope and cost are unverified. A stock plugin-enabled export fixes missing SDK linkage; it does **not** by itself add OnlyFast's named-offering protocol or prove the stock bridge can select it.

If using source builds, do not replace the plugin or add a second RevenueCat instance. Use the resolved 5.96.0 SDK, preserve lifecycle/navigation/photo handling, and implement authenticated UUID verification, exact package selection, account-generation checks and existing server sync as specified in [the shared iOS plan](IOS_NATIVE_RELEASE_PATH.md). Keep all transaction holds disabled. macOS/Xcode is still needed later for compilation/runtime; do not purchase hosting yet.

Documented basis: [Median source downloads/builds](https://docs.median.co/docs/build-ios-from-source), [app identifiers](https://docs.median.co/docs/app-identifiers), [RevenueCat enablement/API](https://docs.median.co/docs/revenue-cat), [custom-plugin services](https://docs.median.co/docs/native-plugins-overview), [licensed source customization](https://median.co/faq), and [official RevenueCat iOS SPM installation](https://www.revenuecat.com/docs/getting-started/installation/ios).

## 4. Exact Median actions

Already completed in the signed-in OnlyFast app:

1. Confirmed Build & Deploy → App Identifiers shows iOS `app.onlyfast`; did not edit identifiers/version fields.
2. Confirmed Native Plugins → RevenueCat shows **Plugin Enabled**; did not toggle it, change the plan or buy support.
3. Selected **Build & Deploy → iOS SOURCE CODE → Rebuild**, not Rebuild All, iOS IPA, simulator Rebuild iOS or Upload.
4. Waited for that source row to become **CURRENT**, downloaded it, extracted into a new ignored directory and passed source intake.

**No further Median configuration action is required to resolve this blocker.** Keep the new archive/extraction. A plain Download of the old OUTDATED row would have redownloaded the stale source. For future exports, regenerate that specific source row after saved configuration/plugin changes. If it again exports a mismatched ID or omits the enabled plugin, preserve the archive and stop rather than editing it to conceal the discrepancy.

Do not enable automatic App Store Connect uploads, rebuild an IPA, change signing/versioning or submit anything during this review. The IPA remained OUTDATED and its upload configuration was not enabled by this task.

## 5. Android parallel preparation

Prepared a **new** source copy at `tmp/android-release-minification-review`, using the existing release preparer and the original licensed Android download. Original Android source, prior debug/purchase implementation, reports, APKs and other worktrees were untouched.

| Check | Result |
| --- | --- |
| Kotlin/Java release compilation + R8 | **Passed** `:app:minifyNormalReleaseWithR8`, 31 tasks, offline, 2m25s |
| Signing / APK / AAB | No signing task ran; no APK/AAB generated, installed or distributed |
| Minified output | Release bridge/Median activity/file-upload classes present in R8 mapping; named-offering/bridge/package strings present in DEX |
| QA exclusion | Debug source absent; QA localhost endpoints, operator marker, old debug application and QA network marker absent from DEX; startup remains HTTPS OnlyFast |
| Public transaction holds | Native `TRANSACTIONS_ENABLED=false`; web `NATIVE_PURCHASES_READY=false` |
| Version/signing review | Existing `app.onlyfast`, versionCode **44**, versionName **1.0.0**, SDK 36/min26, release logs/debuggable false; signing declarations unchanged; signing material not copied or used |
| Authentication smoke | **Passed** on already-installed hash-verified QA APK: synthetic local login, A→B, logout→A, wrong-token/UUID rejection, no unexpected navigation reset |
| Photo chooser | **Opened** via the unchanged Median file handler; no upload |
| Photo selection/cancel | **Not passed**: Photos selection crashed Android's system process; stopped runtime check |
| Minified runtime | **Not tested**; requires a separately approved signed QA artifact, beyond this task's signing boundary |

The installed APK SHA-256 matched the preserved QA artifact `57DF5F7D3984A8E3C5AFC59D99A43407FB6A39E9D6F74BC1EF0E3D62A204AC9F`. No binary was replaced. The serve-only QA harness gained a manual image input that records synthetic filename/type/size and verifies Auth after selection/cancel, without reading/uploading image content. The fixture was a 68-byte synthetic PNG, `ONLYFAST-QA-photo.png`, on the dedicated emulator only.

At `17:28:41` Pacific, the API 36 emulator reported `FATAL EXCEPTION IN SYSTEM PROCESS`, `NullPointerException` in `IntentFilter.getDataType` → `DataManager.reportShareTargetEvent` → `ShareTargetPredictor`. Intent resolver/media/SystemUI then reported `DeadSystemException`; emulator shared storage became disconnected. This establishes a system-process failure during the chooser, not a completed photo-picker regression pass or a verified OnlyFast billing-bridge crash. Root attribution beyond this stack is unproven. No system settings, emulator data, OS image, production photo-picker code or native callbacks were changed to bypass it.

Retest selection and cancellation on a stable compatible Android runtime before release approval. Compare the eventual signing/upload certificate against Play App Signing and choose a versionCode greater than the highest already used; the live Play code/certificate was not verified here. Do not change keys or versioning silently.

Nonblocking compile advisories: SDK XML reader/tool metadata version mismatch, existing deprecated Android APIs and Gradle features. [Android optimization guidance](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization) requires validating the actual optimized artifact; a successful R8 task alone is not runtime proof.

[Android evidence](../native/android/release-preparation.snapshot.json). Local build/crash logs: `tmp/android-release-minification.log`, `tmp/android-preparation-crash-full.log`; QA report: `tmp/android-release-bridge-qa/runtime-report.json`.

## Validation and safety

96 relevant source-intake/shared-bridge/readiness/iOS-UI tests passed; application + QA TypeScript and focused lint passed. The production Vite build passed with its existing large-chunk advisory; its output excludes the QA photo/operator modules and local backend URLs. The source intake correctly rejects the old archive and accepts the newly generated one. No native framework was installed. No iOS implementation was made against the old export.

No production web deployment, Supabase setting/record/schema, Stripe subscription, RevenueCat offering/paywall, Apple/Google store configuration, native transaction, paid hosting, signing, store upload, push, merge or deployment was performed. The only Median mutation was regenerating the requested source artifact. Public purchase and restore controls remain held. Review before any implementation build/signing/upload stage.
