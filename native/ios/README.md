# iOS native release path

The shared web contract exists; an iOS native adapter and StoreKit/TestFlight purchase remain unimplemented and untested. Public readiness stays false. See the [release-path and implementation plan](../../docs/IOS_NATIVE_RELEASE_PATH.md).

The audit found `C:\Users\c_mar\Downloads\ios_source.tar.gz` and `ios_source (1).tar.gz`. They are identical, SHA-256 `391BE0CFDB9BCA5C7BD5EB043B7CE98328B9E66ED5AD3500172C5AFF8A292B1D`. Originals were preserved; the audit extraction is under ignored `tmp/ios-source-audit/ios/`.

This export contains `OnlyFast.xcworkspace`, a generated Xcode project and Objective-C/Swift source. However, its generated app and appConfig use **`co.median.ios.bnkramx`**, while RevenueCat is registered to **`app.onlyfast`**. RevenueCat enablement, native dependency/plugin linkage and a resolved SDK version are missing. Do not build or silently rewrite it into a release.

The actual export uses **Tuist/SPM**, not CocoaPods. Preserve `Project.swift`, `Workspace.swift`, `Tuist.swift`, `.package.resolved`, workspace `Package.resolved`, registry configuration, plugin dependencies and builder environment. Tuist's default bundle ID is a development ID; do not regenerate with defaults. Dependency metadata says core 2.4.1 while resolved packages say GoNativeCore 3.0.10.

Obtain a current export matching the intended existing App Store Connect app, with the licensed RevenueCat plugin included. Run the read-only Windows intake utility before a hosted build:

```powershell
node scripts/inspect-median-ios-source.mjs 'C:\path\to\extracted\ios'
```

Exit 0 means source intake checks passed, not that signing, native compilation or purchases work. Exit 2 reports specific blockers. No source is rewritten and no dependency/build/network operation runs.

[store-readiness.snapshot.json](store-readiness.snapshot.json) records the live read-only Apple mapping: both products `READY_TO_SUBMIT`, with one-week trial configuration across all 175 territories. This is store configuration evidence, not runtime StoreKit price/eligibility evidence.

Remaining inputs: corrected/current SDK-bearing source, approved hosted or borrowed macOS/Xcode and secure signing setup, a trusted compatible Apple-device tester, and safe connectivity to the existing isolated local backend. A personal Mac/iPhone purchase is not required. No build, source upload, hosted workflow, product submission or transaction was performed.

If a fresh plugin export is unavailable, the plan also covers a separately reviewed direct integration of RevenueCat's official SPM SDK in the licensed source. It still requires confirmed app identity, dependency compatibility and macOS validation; no such dependency change was made here.
