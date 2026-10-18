# iOS unsigned compilation plan — October 17, 2026 (Pacific)

**Next priority: one approved GitHub Actions unsigned simulator compile. No CI has been pushed or executed.** The Swift adapter remains implemented but uncompiled. Android picker code is preserved; final photo selection is deferred to a physical Android device, without further emulator troubleshooting unless evidence establishes an OnlyFast regression.

## Android comparison with the presumed working upload

The user believes the July 13 bundle was the last working Play upload. Read-only inspection of `C:\Users\c_mar\Downloads\app-bundle.aab` identifies **app.onlyfast, versionCode 21, versionName 1.0.0**, Median configuration **12**, compile/target SDK **36**, min SDK **26**, AGP **9.0.1**, AndroidX WebKit **1.16.0**. SHA-256: `40580A9310183DA7A9D20D0360AF1383B813226D8AEE6F20334389B14BCFD1A3`. This is a local candidate corroborated by the user's recollection, not independent confirmation of the Play track's last release. Its metadata says `NO_SUPPORTED_VCS_FOUND`; no historical native source commit/export was found for exact source reconstruction.

The October 15 candidate `app-bundle (1).aab` is versionCode **42**, configuration **16**, same package and SDK limits. Its SHA-256 is `B6CDB84C70E71A9F2C6640832255C9BA19F67DA5480C76DBBDC8F5E6B39F66C5`. The current downloaded release source is versionCode **44**, configuration **16**, Median core **2.7.41**, RevenueCat plugin **1.3.0** / SDK **10.3.0**, minified release with release logging disabled. These identities are not interchangeable upload provenance.

Using the existing cached bundletool 1.18.3 and installed APK Analyzer, the July bundle's R8 mapping identified `FileUploadContract` as `u1.p`. Its bytecode retains the same chooser structure: image/video `ACTION_PICK` with MediaStore URI, MIME/multiple-selection extras, combined media types, and `ACTION_GET_CONTENT` with `CATEGORY_OPENABLE` for files. It includes the same legacy image-only URI intent behavior implicated in the emulator system crash. This is not a newly introduced OnlyFast picker rewrite. R8 class/method names and optimization differ; bytecode structure does not establish historical source/binary equality.

Exact current-source hash comparison across the **original downloaded Android**, **release-prepared source**, and **minified QA source** confirms:

| File | SHA-256 in all three copies |
| --- | --- |
| `FileUploadContract.kt` | `ED3BA8796DF2FC249035642AF6C519CB989855ED08F24B547C3F7F293806FA47` |
| `GoNativeWebChromeClient.java` | `DFCEADF15BC215167057CB304390F23715E1A865D8A93F9F5EA164424C44618A` |

The native release preparer adds a pre-navigation billing hook in MainActivity and the existing RevenueCat SDK pin; it does not change the picker or file callback. Meaningful build/config differences from presumed v21: native version/config revision, enabled RevenueCat plugin/OnlyFast extension, and QA-only local Auth/origin/overlay/debug signing. Release picker/auth resume protections remain intact. No actual OnlyFast picker regression was identified. No picker code, vendor build settings or emulator configuration was changed in this task, and no emulator picker test was repeated.

Before Android release, use a physical device to select/cancel a synthetic image through actual OnlyFast upload screens; check callback, auth, retained form state and background/resume. Verify the uploaded Play version code when convenient. This does not block preparing the iOS compile.

## iOS source and dependency readiness

Available locally: verified revision-16 archive `C:\Users\c_mar\Downloads\ios_source.tar (1).gz` (1,559,199 bytes); generated `OnlyFast.xcworkspace` / `OnlyFast.xcodeproj`; shared **OnlyFast** scheme; Objective-C/Swift/resources/Derived files; empty signing team, bundle **app.onlyfast**, iOS **15.5**, Swift language mode **5**; existing lockfiles and Median registry configuration. Adapter and reproducible hooks are from local commit **e118baca**.

Pins: Median core **3.0.17**, MedianIcons **1.2.0**, Median RevenueCat plugin **1.1.2**, RevenueCat SDK **5.96.0**, ZipArchive **2.6.0**. SDK/plugin dependencies are preserved. Registry package manifests were reachable without credentials during this read-only check. RevenueCatPlugin and GoNativeCore binary checksums match their manifests, and both XCFramework Info.plists include **arm64/x86_64 iOS simulator** plus arm64 iOS-device slices. MedianIcons is a source package. This supports attempting simulator compilation; it does not prove Swift compilation, module visibility or runtime SDK ownership.

Use the generated workspace directly. Do not run Tuist with development defaults or add CocoaPods: this actual export uses SPM, despite the generic Median guide's CocoaPods wording. No additional native project configuration change is currently justified. Command-line signing/architecture overrides apply only to the compile job. If `import RevenueCat` is not visible through current linkage, or actor/header issues appear, fix the actual compiler finding while retaining SDK 5.96.0; do not preemptively add another SDK/plugin.

## Prepared private GitHub Actions route

GitHub metadata confirms **Apex88Vent/onlyfast is public**, with admin/push access on the current connection. The licensed Median source should stay out of this public web repository. The shortest contained route is a separate **private native compilation repository** with no Vercel integration. No repository, Git remote, upload or CI run was created. Existing Actions allowance, billing balance and policy were not accessible/verified.

Concrete local review folder:

`C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\ios-private-compilation-review`

It contains the exact verified vendor archive, SHA-256 file, adapter, existing source preparer/intake utility, CI input validator, README and manual workflow. No signing/private API keys, production credentials, Android source or web app are included. Archive path and credential-file checks passed. The original archive was not rewritten. No Git repository was initialized in the review folder.

Reproduce into a NEW directory:

```powershell
node scripts/prepare-ios-compilation-workspace.mjs --archive 'C:\Users\c_mar\Downloads\ios_source.tar (1).gz' --output tmp/ios-private-compilation-review
```

Draft workflow: `native/ios/ci/unsigned-simulator.yml`, intentionally outside this web repository's active workflow directory. The local review folder copies it into its own `.github/workflows/ios-unsigned-compile.yml`, ready for a separately approved private upload.

Workflow: **manual dispatch only**, private-repository guard, explicit approval boolean default false, read-only contents token, pinned checkout action with no persisted credentials, standard **macos-26** arm64 runner, pinned **Xcode 26.6** path, one job, **45-minute timeout**. The current official runner image lists that Xcode; preflight stops if it is missing instead of silently installing or selecting another version. There is no automatic push/PR trigger, no cache/artifact upload, no deployment, no archive/IPA export and no app launch/runtime API call.

Steps: verify vendor archive hash → extract into a fresh runner temp directory → apply the existing source preparer → validate bundle/scheme/holds/adapter hash/registry/pins → configure Median registry on the disposable runner → resolve locked dependencies → recheck locks → build Debug arm64 simulator unsigned → require `OnlyFastBilling.o` → recheck locks. Uses `-disableAutomaticPackageResolution` and `-onlyUsePackageVersionsFromResolvedFile`; dependency drift stops the run. The generated workspace and version-16 hooks remain authoritative.

Core compile command:

```bash
xcodebuild build -workspace "$IOS/OnlyFast.xcworkspace" -scheme OnlyFast \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" -clonedSourcePackagesDirPath "$PACKAGES" \
  -disableAutomaticPackageResolution -onlyUsePackageVersionsFromResolvedFile \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES
```

No Apple Developer/App Store Connect signing access is needed for this compile. No Supabase/RevenueCat private credentials are needed. No store login, trial eligibility check, purchase or restore occurs. A clean GitHub runner may still expose SPM registry/authentication, binary trust, compiler or linker issues; preserve the failure and address it after review. Do not loosen package trust, change pins or invent credentials to bypass it.

## Expected usage/cost and approval

Planning estimate: **15–30 minutes cold**, not measured. Standard macOS currently costs **$0.062/minute** beyond included allowance: approximately **$0.93–$1.86**, or **$2.79 at the 45-minute job timeout** before any applicable taxes/other account use. Private-repository allowance may cover the run; remaining allowance and budget must be checked before dispatch. GitHub Free lists 2,000 included minutes/month, shared account use matters. No additional artifact storage is requested; logs remain in the private Actions run. No larger runner or paid hosting plan is required by this draft. Sources: [runner rates](https://docs.github.com/en/billing/reference/actions-runner-pricing), [billing/allowance](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

**Exact next action:** approve (a) creation/use of a private native compilation repository, (b) uploading only the prepared review folder to its default branch, and (c) one manual unsigned macOS compile within the reviewed budget/available allowance. Creating/updating the private repository and executing CI are distinct external actions; neither has been performed. GitHub requires the dispatch workflow on the default branch and write access to run it. Current access is confirmed only for the public web repository; private-repo access/Actions policy must be checked after it exists. No web main merge/deployment is needed.

## Validation and remaining release blockers

Validation passed: **3 new preparation tests**, YAML parsing and `bash -n` on all **3** workflow shell blocks, focused ESLint, local review-package recreation using its own copied scripts/archive, and source/lock validation before/after. The initial local archive-hash assertion caught a mistyped literal; it was corrected against the verified original before packaging succeeded. No source mismatch was bypassed. Previously completed Android runtime and 373/63 suites were not repeated. Xcode compilation and CI remain **not executed**. A successful compile will establish compiler/linker compatibility only; runtime initialization, SDK ownership, identity/account switching and eventual StoreKit testing still need an isolated QA build and an approved Apple tester/device. Android still needs physical photo-selection validation, final signing/version review and approved AAB packaging. Public Pro/Teams purchasing and both native transaction holds stay false. Trial verification is deferred; no trial eligibility/terms are claimed as guaranteed. Existing plan copy already qualifies introductory offers as eligibility-dependent; no trial was changed or checked here. Stripe, production Supabase, RevenueCat offerings and existing memberships are unchanged.

References: [GitHub standard runner labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [current macOS-26 image/Xcodes](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md), [manual dispatch requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Apple locked package CI](https://developer.apple.com/documentation/xcode/building-swift-packages-or-apps-that-use-them-in-continuous-integration-workflows), [Swift registry configuration](https://github.com/swiftlang/swift-package-manager/blob/main/Documentation/PackageRegistry/PackageRegistryUsage.md), [Median source/simulator build guide](https://docs.median.co/docs/build-ios-from-source).
