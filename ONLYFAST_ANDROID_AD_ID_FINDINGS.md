# OnlyFast Android AD_ID findings

Completed Friday, November 6, 2026 at 6:07:13 PM PST. Read-only packaged-artifact investigation; no configuration or release changes.

**Android 1.0.2 (61) contains com.google.android.gms.permission.AD_ID in its final packaged AAB and APK manifests. Rebuilding version 61 for this permission is unnecessary.**

Locally inspected production-package builds **19, 21, 26, 27, 32, 34, 42 and 44 lack AD_ID**. Builds **47, 58, 61, 63, 64 and 65 contain it**. None of these local results establishes which version is currently active in Google Play. The offending active artifact and track remain unconfirmed; no track or release should be changed until identified.

## 1. Inspection method and scope

- Searched Downloads, the OnlyFast project/Median/backups tree, local Temp, and retained Codex worktrees for APK, AAB and APKS files. Retained worktrees were read only; no checkout or branch was switched. This is a scoped local inventory, not a claim to have inspected the Google Play artifact library or every archive on the computer.
- Inspected **37 artifact paths / 26 unique APK or AAB binaries**: 15 AAB paths and 22 APK entries, including the existing universal.apk inside one APKS archive. Identical copies are individually listed and share a checksum.
- APK: Android SDK build-tools 36.1.0 aapt dump badging and aapt dump xmltree against the APK's actual AndroidManifest.xml. Independently cross-checked permission declarations with aapt2 dump permissions. Tool builds: aapt v0.2-14042983; aapt2 2.20-14042983.
- AAB: existing bundletool 1.18.3 dump manifest against each packaged module. Every inspected AAB contains only the base manifest. Namespace-aware XML inspection was independently checked against the explicit permission element in the extracted XML.
- Calculated complete SHA-256 checksums and rechecked originals after inspection. The APKS container checksum was also rechecked; its universal.apk was extracted only to scratch evidence, without rebuilding or changing the container. All source artifacts remained unchanged.
- All inspected binaries target Android SDK **36** and have minimum SDK **26**.

An initial automation parser misread AAB XML attributes and incorrectly classified their permissions. This was corrected before this report. The final inventory is backed by raw bundletool XML and an independent cross-check for all 37 paths. The earlier interim statement that version 64 lacked AD_ID is withdrawn: version 64 contains it. The retained initial log is not the authoritative result.

No browser navigation was retried. No reliable authenticated track-reading connector is available in this session; current Play Console release status was not inspected. The existing submission packet records an owner's earlier upload confirmation for build 61, but that historical note does not prove its current track, rollout, retention or review status.

## 2. Artifact manifest comparison

The location labels below are exact filenames with source-directory prefixes to distinguish duplicates. Each label links to the original artifact.

| Prefix | Source location |
| --- | --- |
| R | C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast |
| D | C:/Users/c_mar/Downloads |
| M | C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/Median |
| A | C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android |
| W | C:/Users/c_mar/.codex/worktrees |

| ID | Filename / location | Package identifier | Version name | Version code | Target SDK | AD_ID | Artifact SHA-256 |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| A01 | [D/app-bundle (3).aab](<C:/Users/c_mar/Downloads/app-bundle (3).aab>) | app.onlyfast | 1.0.2 | 61 | 36 | Present | b9b9105e110163591d63ab55506d31e582d85775158fb7512d82ba60b2a02d41 |
| A02 | [R/tmp/android-emulator/OnlyFast-1.0.2-61-emulator.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-emulator/OnlyFast-1.0.2-61-emulator.apk>) | app.onlyfast | 1.0.2 | 61 | 36 | Present | 444d3df7d354747b94b3bfdf7834fbec786992e3c4d5995b792939289badd0fb |
| A03 | [R/tmp/android-emulator/OnlyFast-1.0.2-61.apks → universal.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-emulator/OnlyFast-1.0.2-61.apks>) | app.onlyfast | 1.0.2 | 61 | 36 | Present | 444d3df7d354747b94b3bfdf7834fbec786992e3c4d5995b792939289badd0fb |
| A04 | [R/tmp/final-production-release/native/OnlyFast-android-1.0.2-61.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/final-production-release/native/OnlyFast-android-1.0.2-61.aab>) | app.onlyfast | 1.0.2 | 61 | 36 | Present | b9b9105e110163591d63ab55506d31e582d85775158fb7512d82ba60b2a02d41 |
| A05 | [M/app-bundle.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/Median/app-bundle.aab>) | app.onlyfast | 1.0.0 | 19 | 36 | ABSENT | 137b6a58daa623ec252f53f5ac36e15fb7e755e213a72e79df0858424e08da32 |
| A06 | [D/app-bundle.aab](<C:/Users/c_mar/Downloads/app-bundle.aab>) | app.onlyfast | 1.0.0 | 21 | 36 | ABSENT | 40580a9310183da7a9d20d0360af1383b813226d8aee6f20334389b14bcfd1a3 |
| A07 | [M/publish 1.0 8-8-26.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/Median/publish 1.0 8-8-26.aab>) | app.onlyfast | 1.0.0 | 26 | 36 | ABSENT | 389a1b58e68ff8ba6d0557ab044da504542b8ac7b4578c4cb2ca8e876a5bb403 |
| A08 | [M/1.01 8-13-26.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/Median/1.01 8-13-26.aab>) | app.onlyfast | 1.0.0 | 27 | 36 | ABSENT | db2a2382886bc5f0aa1844aa1ad22766c4732b360b2c766854157c65baa43162 |
| A09 | [D/app-release (3).apk](<C:/Users/c_mar/Downloads/app-release (3).apk>) | app.onlyfast | 1.0.0 | 32 | 36 | ABSENT | 80afecff95cb5d32831d61bdc5226189c90e68608fd1317d78a4ad33412875b6 |
| A10 | [M/1.02 8-13 median fix.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/Median/1.02 8-13 median fix.aab>) | app.onlyfast | 1.0.0 | 34 | 36 | ABSENT | 4e046b6c88a58f1768305ad2d477278bb844633fc0d6232e2470fca328eb567f |
| A11 | [D/app-bundle (1).aab](<C:/Users/c_mar/Downloads/app-bundle (1).aab>) | app.onlyfast | 1.0.0 | 42 | 36 | ABSENT | b6cdb84c70e71a9f2c6640832255c9ba19f67da5480c76dbbdc8f5e6b39f66c5 |
| A12 | [W/median-paywall-simplification/onlyfast/tmp/stock-android-acceptance/app-build/outputs/apk/normal/stockPaywallQa/app-normal-stockPaywallQa.apk](<C:/Users/c_mar/.codex/worktrees/median-paywall-simplification/onlyfast/tmp/stock-android-acceptance/app-build/outputs/apk/normal/stockPaywallQa/app-normal-stockPaywallQa.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | ba71c6ec0f388bfc07bb1a87a4ff0d3da77bcacb8bce4a1d1ed59a6228a6634c |
| A13 | [W/median-paywall-simplification/onlyfast/tmp/stock-android-acceptance/installed-before-stock.apk](<C:/Users/c_mar/.codex/worktrees/median-paywall-simplification/onlyfast/tmp/stock-android-acceptance/installed-before-stock.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | 2346898e8499daefbd1516dbf0fbb3ae9e6acd2c8e9cc7aaffb799d2882822b0 |
| A14 | [W/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/app/build/outputs/apk/normal/internalMinifiedQa/app-normal-internalMinifiedQa-unsigned.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/app/build/outputs/apk/normal/internalMinifiedQa/app-normal-internalMinifiedQa-unsigned.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | a01f0748d1c024f979e7046737a6ee35f97650716dad4476db11aa76a0e6be2a |
| A15 | [W/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/installed-before-minified.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/installed-before-minified.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | 57df5f7d3984a8e3c5afc59d99a43407fb6a39e9d6f74bc1ef0e3d62a204ac9f |
| A16 | [W/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/onlyfast-minified-qa-debug-signed.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-minified-runtime-review/onlyfast-minified-qa-debug-signed.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | 2346898e8499daefbd1516dbf0fbb3ae9e6acd2c8e9cc7aaffb799d2882822b0 |
| A17 | [W/native-revenuecat-release/onlyfast/tmp/android-preparation-installed.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-preparation-installed.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | 57df5f7d3984a8e3c5afc59d99a43407fb6a39e9d6f74bc1ef0e3d62a204ac9f |
| A18 | [W/native-revenuecat-release/onlyfast/tmp/android-release-bridge-qa/app/build/outputs/apk/normal/debug/app-normal-debug.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-release-bridge-qa/app/build/outputs/apk/normal/debug/app-normal-debug.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | 57df5f7d3984a8e3c5afc59d99a43407fb6a39e9d6f74bc1ef0e3d62a204ac9f |
| A19 | [W/native-revenuecat-release/onlyfast/tmp/android-release-bridge-qa/installed-before-qa.apk](<C:/Users/c_mar/.codex/worktrees/native-revenuecat-release/onlyfast/tmp/android-release-bridge-qa/installed-before-qa.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | f47ceafa81aba567d563a5f74c6681fac161938e5b56a8c85542feb5a6da490f |
| A20 | [A/app/build/outputs/apk/normal/debug/app-normal-debug.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android/app/build/outputs/apk/normal/debug/app-normal-debug.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | f47ceafa81aba567d563a5f74c6681fac161938e5b56a8c85542feb5a6da490f |
| A21 | [A/diagnostics/apk/app-onlyfast-one-play-test.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android/diagnostics/apk/app-onlyfast-one-play-test.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | f47ceafa81aba567d563a5f74c6681fac161938e5b56a8c85542feb5a6da490f |
| A22 | [A/diagnostics/apk/installed-before-update.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android/diagnostics/apk/installed-before-update.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | f34fa09727eddea8541e4c3bbad007328b3e2bc14119f8a2b457e392e2562ab6 |
| A23 | [A/diagnostics/apk/installed-verify.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android/diagnostics/apk/installed-verify.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | f34fa09727eddea8541e4c3bbad007328b3e2bc14119f8a2b457e392e2562ab6 |
| A24 | [R/tmp/android-emulator/installed-before.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-emulator/installed-before.apk>) | app.onlyfast | 1.0.0 | 44 | 36 | ABSENT | ba71c6ec0f388bfc07bb1a87a4ff0d3da77bcacb8bce4a1d1ed59a6228a6634c |
| A25 | [D/app-release (4).apk](<C:/Users/c_mar/Downloads/app-release (4).apk>) | app.onlyfast | 1.0.0 | 47 | 36 | Present | f65e0f6018463d0d89b0d398e1d1be928bd4e7059c4fd5c17c17350cda852e7e |
| A26 | [D/app-bundle (2).aab](<C:/Users/c_mar/Downloads/app-bundle (2).aab>) | app.onlyfast | 1.0.0 | 58 | 36 | Present | 2f891fdab0c2fe4b2bca54b2551810ee838b53adde01141b914e3d56446e4e35 |
| A27 | [R/tmp/final-production-release/native/OnlyFast-android-candidate.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/final-production-release/native/OnlyFast-android-candidate.aab>) | app.onlyfast | 1.0.0 | 58 | 36 | Present | 2f891fdab0c2fe4b2bca54b2551810ee838b53adde01141b914e3d56446e4e35 |
| A28 | [D/app-bundle (4).aab](<C:/Users/c_mar/Downloads/app-bundle (4).aab>) | app.onlyfast | 1.0.2 | 63 | 36 | Present | d94ea9fe1767335aca4072065c203fa89e92d191a9cdcb9b87d2574e967bc3a7 |
| A29 | [R/tmp/onlyfast-median-release/OnlyFast-Median-Android.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/onlyfast-median-release/OnlyFast-Median-Android.aab>) | app.onlyfast | 1.0.2 | 63 | 36 | Present | d94ea9fe1767335aca4072065c203fa89e92d191a9cdcb9b87d2574e967bc3a7 |
| A30 | [R/tmp/onlyfast-release-candidate/android/app/build/intermediates/intermediary_bundle/normalRelease/packageNormalReleaseBundle/intermediary-bundle.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/onlyfast-release-candidate/android/app/build/intermediates/intermediary_bundle/normalRelease/packageNormalReleaseBundle/intermediary-bundle.aab>) | app.onlyfast | 1.0.2 | 64 | 36 | Present | 43479e21ae4dadff4abf146e24e0dd753cfb4d5c5d98459bca98dd810e400dc3 |
| A31 | [R/tmp/onlyfast-release-candidate/android/app/build/outputs/bundle/normalRelease/app-normal-release.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/onlyfast-release-candidate/android/app/build/outputs/bundle/normalRelease/app-normal-release.aab>) | app.onlyfast | 1.0.2 | 64 | 36 | Present | c15843f6a426c153400e18ec7ebc33e42192d810ad3574dfffe69d46335daca1 |
| A32 | [D/app-bundle (5).aab](<C:/Users/c_mar/Downloads/app-bundle (5).aab>) | app.onlyfast | 1.0.2 | 65 | 36 | Present | 444e5bc15364142eec0eac77fa0d722e4bc07fd96220d4749e8c19209c4ea7bb |
| A33 | [A/diagnostics/apk/app-onlyfast-suffixed-diagnostic.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/android/diagnostics/apk/app-onlyfast-suffixed-diagnostic.apk>) | app.onlyfast.debug | 1.0.0 | 44 | 36 | ABSENT | 464bd702a2e01b586afd45523b472a278368f4195508f16f57137e0754ab3fde |
| A34 | [R/tmp/admob-replacement-20261104/android/app/build/outputs/apk/normal/debug/app-normal-debug.apk](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/admob-replacement-20261104/android/app/build/outputs/apk/normal/debug/app-normal-debug.apk>) | app.onlyfast.debug | 1.0.2 | 63 | 36 | Present | cceafe7bb950c843cf3556fe4d911f9fa3575591fdbac11331261aeb5bc01932 |
| A35 | [D/app-release.apk](<C:/Users/c_mar/Downloads/app-release.apk>) | co.median.android.bnkramx | 1.0.0 | 8 | 36 | ABSENT | eb51313ce9b956526fc45f6da07e2a4169c8a3f1d8ab34e3bb99d34696461f2c |
| A36 | [D/app-release (1).apk](<C:/Users/c_mar/Downloads/app-release (1).apk>) | co.median.android.bnkramx | 1.0.0 | 10 | 36 | ABSENT | 8bac9fe0c293b3dfbf4b937c54da43b21c79f30bd267b4f3023dd8897076a1c3 |
| A37 | [D/app-release (2).apk](<C:/Users/c_mar/Downloads/app-release (2).apk>) | co.median.android.bnkramx | 1.0.0 | 11 | 36 | ABSENT | 98611e5e3202d2b3ccc1f1c45836f4c1c4998a728b16bf0811b84ad85a7281ba |

For the APKS row, SHA-256 is the contained universal.apk's digest, not the archive's digest. The archive SHA-256 is recorded separately in the machine-readable inventory. The emulator APK is locally debug-signed and is not a substitute upload for the release AAB.

The full path, filename, minimum SDK, complete permission list, SDK properties, duplicate identity and checksum are also recorded in [artifacts.json](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/artifacts.json>); the [CSV comparison](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/artifact-comparison.csv>) provides one row per artifact for filtering.

## 3. Version 61 verification

The release file [OnlyFast-android-1.0.2-61.aab](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/final-production-release/native/OnlyFast-android-1.0.2-61.aab>) and Downloads/app-bundle (3).aab are byte-identical:

- Package: app.onlyfast
- Version: 1.0.2 / version code 61
- Minimum / target SDK: 26 / 36
- AAB SHA-256: **b9b9105e110163591d63ab55506d31e582d85775158fb7512d82ba60b2a02d41**
- Final base manifest contains the exact declaration below, without a maximum-SDK restriction:

```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
```

It also contains android.permission.ACCESS_ADSERVICES_AD_ID, android.permission.ACCESS_ADSERVICES_ATTRIBUTION and android.permission.ACCESS_ADSERVICES_TOPICS. The generated emulator APK and the universal.apk already stored inside its APKS archive have all four permissions and match each other byte-for-byte. This investigation did not generate an APK.

Raw evidence: [bundletool base manifest](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/b9b9105e110163591d63ab55506d31e582d85775158fb7512d82ba60b2a02d41-base-manifest.xml>). Packaged SDK properties identify Google Mobile Ads **24.7.0**, advertising-identifier library **18.0.0**, and UMP **3.2.0**; the manifest contains the AdMob application-ID metadata. These are packaged-artifact findings, not reliance on a Median settings screenshot.

Google documents that Mobile Ads SDK 20.4.0 and later supplies AD_ID through its library manifest. Version 61's SDK and final manifest are consistent with that automatic merge. The final inclusion is verified; a version-61 Gradle merge-provenance report was not needed or used to assign its origin. [Google SDK setup](https://developers.google.com/admob/android/quick-start), [Google advertising-ID guidance](https://support.google.com/googleplay/android-developer/answer/6048248?hl=en).

## 4. Affected builds and advertising context

| Local package / version codes | Finding | Relevance to app.onlyfast's Play warning |
| --- | --- | --- |
| app.onlyfast: 19, 21, 26, 27, 32, 34, 42, 44 | AD_ID absent; the three AdServices declarations and AdMob application-ID metadata are also absent | Possible warning sources only if the matching binaries are active or retained in an evaluated release. Some version-44 files are diagnostic/QA builds; local existence does not prove upload. |
| app.onlyfast: 47, 58, 61, 63, 64, 65 | AD_ID and all three AdServices permissions present; AdMob application-ID metadata present | No AD_ID omission found in these local artifacts. This does not certify every other native feature or approve these builds for release. |
| co.median.android.bnkramx: 8, 10, 11 | AD_ID absent | Different package; cannot be the artifact for app.onlyfast's Play listing. |
| app.onlyfast.debug: 44 / 63 | AD_ID absent in 44, present in 63 | Separate debug package; cannot be the artifact for app.onlyfast's Play listing. |

**No unexpected advertising-permission omission was found in the inspected advertising-enabled app.onlyfast builds.** Older non-AdMob manifests lack those permissions as a group. That is not proof of a permission-merge regression, nor proof that a particular old build is active.

OnlyFast house promotions are website images and do not require Google's advertising-ID permission. Native AdMob can use the identifier; Google documents identifier collection as optional and notes that limited-ad modes can omit it. AD_ID is required for an SDK to access that identifier on the targeted Android versions; its absence is not proof that every kind of ad fails. The permission does not itself provide consent or authorize turning ads on. [Google Mobile Ads disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure).

Retain the existing advertising-ID declaration for the current AdMob-enabled binary configuration; do not switch it to No or suppress validation merely to clear this warning. Frontend display holds do not remove the native SDK or manifest, and this task has not established that the SDK never accesses the identifier. No declaration, AdMob setting, ad placement, frequency or production hold was changed.

## 5. Confirmed versus suspected cause

**Confirmed:** version 61's local release AAB and APK contain AD_ID; the eight older app.onlyfast version codes listed above do not. The current local newer builds also contain it. A frontend deployment cannot change permissions inside any already-uploaded binary.

**Suspected, not confirmed:** an older active release in production, internal testing, open testing, or a named closed-testing track, or an old bundle retained in the release under review, may be the manifest causing the mismatch. An uninspected uploaded artifact is another possibility. This report assigns no active track to any version.

The historical packet's earlier incomplete-declaration advice addresses a different validation state. The current reported message says the declaration already indicates advertising-ID use and an active artifact lacks permission. Repeating declaration edits is not a verified solution to that artifact mismatch.

## 6. Exact manual Play Console investigation

These are read-only identification steps. Do not create, deactivate, roll out or discard a release during this investigation.

1. Select **OnlyFast**, package **app.onlyfast**. Open the reported advertising-ID issue and record any version codes or artifact links shown in its expanded details. Keep the declaration unchanged.
2. Open **Test and release → Latest releases and bundles → All app versions** (older UI: App bundle explorer). Select each version implicated by the warning; record version name, code and current status. Do not infer active status merely because a version appears in the library.
3. Inspect **Production**, **Testing → Internal testing**, **Testing → Open testing**, and **Testing → Closed testing → Manage track** for every named closed track. In each active or evaluated release, open its details and inspect the **App bundles and APKs** list. Record new, retained and deactivated entries separately, along with rollout/review state. Include retained bundles and any unfinished staged rollout.
4. Compare the actual app.onlyfast version codes with this report. Codes **19, 21, 26, 27, 32, 34, 42, 44** are known local missing-permission candidates. Codes **47, 58, 61, 63, 64, 65** passed locally, but verify that the Console artifact is the same build rather than assuming from a filename.
5. For the precise implicated version, use its **Downloads** tab to download the **Signed, universal APK**. Inspect its manifest with aapt/aapt2 and record its package, code and AD_ID result. The Play-signed APK's checksum will normally differ from a local debug-signed universal APK or from its source AAB; match package/version and inspect permissions, not incompatible file digests. If the uploaded AAB itself is available, compare its AAB checksum with this table.
6. Finish with a record of **package + affected version code + track/release + active/retained status + packaged-permission result**. Only then is the offending active artifact positively identified. If every evaluated Play-generated base/universal manifest has AD_ID, retain that evidence and contact Play Console support with the error and version/track details; no speculative rebuild is justified.

Google documents the version-inspection/download path in [Latest releases and bundles](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en) and release tracks, rollout history, and the new/retained/deactivated artifact lists in [Release management](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en).

## 7. Smallest correction after the Console artifact is identified

**No permission change and no Median rebuild are required for version 61.** Do not edit its AAB/APK or rebuild it simply to add a permission it already contains.

If an older missing-permission app.onlyfast build is confirmed active on a particular track, the minimum correction is normally a replacement release on **that same track** using an already-reviewed, compatible, permission-bearing stock Median bundle. If the existing uploaded version 61 is eligible there, use **Add from library** rather than re-uploading or rebuilding version 61. Confirm version-code ordering, signing, device coverage and other release requirements first. All inspected files share min SDK 26, but that alone does not establish complete device/country/track compatibility. Google documents reuse of previously uploaded bundles in [release preparation](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en).

If the warning instead identifies an unintentionally retained old bundle in a pending replacement release, review whether it must remain for device coverage. A reviewed change to that release's retained-bundle selection may suffice. Do not deactivate tracks or remove required coverage. No such action was taken or authorized here.

A newer build is needed only if no existing approved permission-bearing bundle can legitimately supersede the confirmed offender, or if another specific native defect is independently established. The locally retained custom/QA version-64 project is historical development material, not an instruction to replace the stock Median wrapper. Do not choose a higher local version merely because its number is larger.

For any future build that is actually confirmed to omit AD_ID while retaining advertising-ID use, the exact manifest requirement is a top-level child of manifest, alongside application:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
    <application ...>
        ...
    </application>
</manifest>
```

Apply that only through the existing licensed Median project's supported Android permission/custom-manifest mechanism, or have Median include it if App Studio does not expose the override. Do not create a second Android project or modify historical bridge sources. No current App Studio setting name was verified in this investigation, so no speculative toggle path is prescribed. Reinspect the resulting final AAB before any future submission. That conditional correction is unnecessary for all locally inspected version-61 artifacts.

## 8. Evidence and completion

- [Complete per-artifact inventory](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/artifacts.json>)
- [Filterable comparison CSV](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/artifact-comparison.csv>)
- [Independent cross-check: 37 passed](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/cross-check.json>)
- [Final extraction log](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/android-ad-id-investigation/inspection-complete.log>)
- Raw SHA-256-named AAB manifests, APK manifest trees, badging and independent aapt2 permission outputs are retained beside the inventory.

The inspection used dump commands only. No application, native source, Median setting, AdMob declaration, advertising-ID declaration, RevenueCat setting, subscription behavior, Supabase, frontend or production deployment was changed. No build, install, submission, commit or push was performed. No original artifact or recovery worktree was edited. Only this requested report and ignored local inspection evidence were written.

**Next required information is the offending active Play version/track, not another version-61 build.** Investigation stops with the report; release changes await that identification.
