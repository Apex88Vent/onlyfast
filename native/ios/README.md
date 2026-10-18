# iOS native release path

The shared web contract exists; an iOS native adapter and StoreKit/TestFlight purchase remain unimplemented and untested. Public readiness stays false. See the [release-path and implementation plan](../../docs/IOS_NATIVE_RELEASE_PATH.md).

**Source blocker resolved:** see [the follow-up](../../docs/IOS_SOURCE_BLOCKER_RESOLUTION.md) and [current evidence](source-resolution.snapshot.json). The live Median app already had the right ID/plugin; its iOS source was OUTDATED. Source-only regeneration produced `app.onlyfast`, config revision 16, Median plugin **1.1.2**, GoNativeCore **3.0.17**, and RevenueCat SDK **5.96.0**, with successful intake. The new archive is `C:\Users\c_mar\Downloads\ios_source.tar (1).gz`; extraction is `tmp/ios-source-current/ios`. Use this verified export for the next reviewed source-adapter task. No IPA/signing/upload or paid hosting was performed.

The audit found `C:\Users\c_mar\Downloads\ios_source.tar.gz` and `ios_source (1).tar.gz`. They are identical, SHA-256 `391BE0CFDB9BCA5C7BD5EB043B7CE98328B9E66ED5AD3500172C5AFF8A292B1D`. Originals were preserved; the audit extraction is under ignored `tmp/ios-source-audit/ios/`.

Those old exports contain `OnlyFast.xcworkspace`, a generated Xcode project and Objective-C/Swift source. Their generated app and appConfig use **`co.median.ios.bnkramx`**, with RevenueCat linkage absent. They are stale revision-12 exports of the same OnlyFast app. Do not use them for implementation; the new verified revision-16 archive fixes both issues.

The exports use **Tuist/SPM**, not CocoaPods. Preserve `Project.swift`, `Workspace.swift`, `Tuist.swift`, `.package.resolved`, workspace `Package.resolved`, registry configuration, plugin dependencies and builder environment. Tuist's default bundle ID is a development ID; do not regenerate with defaults. Current dependency metadata and resolved GoNativeCore agree at 3.0.17. The plugin links `RevenueCatPlugin` and resolves official SDK 5.96.0 transitively; do not introduce a second SDK instance/version.

The corrected source has already passed the read-only Windows intake utility:

```powershell
node scripts/inspect-median-ios-source.mjs 'C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\ios-source-current\ios'
```

Exit 0 means source intake checks passed, not that signing, native compilation or purchases work. Exit 2 reports specific blockers. No source is rewritten and no dependency/build/network operation runs.

[store-readiness.snapshot.json](store-readiness.snapshot.json) records the live read-only Apple mapping: both products `READY_TO_SUBMIT`, with one-week trial configuration across all 175 territories. This is store configuration evidence, not runtime StoreKit price/eligibility evidence.

Remaining inputs: approved hosted or borrowed macOS/Xcode and secure signing setup, a trusted compatible Apple-device tester, and safe connectivity to the existing isolated local backend. A personal Mac/iPhone purchase is not required. Only the source artifact was regenerated; no IPA, signing, hosted workflow, product submission or transaction was performed.

The shortest route now reuses the verified export's SDK and shared protocol to add the OnlyFast named-offering adapter with one coordinated SDK owner. It needs no additional Median custom-plugin service for licensed source builds; cloud inclusion of the custom adapter still requires Median integration. No native adapter or SDK dependency change was made here.
