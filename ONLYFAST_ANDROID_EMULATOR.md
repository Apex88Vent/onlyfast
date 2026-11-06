# OnlyFast Android emulator — launched and ready

Completed November 6, 2026 (America/Los_Angeles). The existing Pixel 8 emulator is running **OnlyFast 1.0.2 (61), package `app.onlyfast`, in the actual Median Android wrapper**. Chrome fallback was not used. The owner signed in manually; the account menu confirmed **test@test.com**, and Settings displayed **BETA TEST ACCOUNT / active Teams membership**. The app was left on its signed-in Home screen after a successful background/resume check.

This is a local, ADB-installed version derived from the approved Android release bundle. It uses the live website, so it is not a sandbox backend. Inspection was limited to navigation, opening screens/dropdowns, and scrolling. The agent did not save, rename, delete or reset setups, change class/profile/subscription selections, start purchases/restores, upload timing images, request AI suggestions, or activate advertising. The external QA credentials were not copied into the emulator, printed, or placed in scripts. No app source, graphics, production deployment, database, Edge Function, RevenueCat or Median configuration was changed. Existing uncommitted work remained on primary `main`; no commit, push, branch, worktree or SDK/system installation was made.

## 1. Reused tools and emulator

| Item | Verified configuration |
|---|---|
| Android Studio | Existing installation; `253.32098.37.0-AI` |
| SDK root | `C:\Users\c_mar\AppData\Local\Android\Sdk` |
| Emulator | 36.5.10.0, build 15081367 |
| ADB | 1.0.41, platform-tools 37.0.0-14910828 |
| Build tools used | Existing 36.1.0 (`aapt`, `apksigner`) |
| Java | Existing Android Studio JBR 21.0.10 |
| Hardware acceleration | Existing Windows Hypervisor Platform; acceleration check passed |
| Existing AVD | `OnlyFast_RevenueCat_API36` — no new AVD created |
| Device | Pixel 8, x86_64, four virtual CPUs, 2 GB RAM |
| Android | Android 16 / API 36; installed Google Play system image revision 7 |
| Security patch reported | 2025-07-05; image was reused without upgrading it |
| Display | Portrait, 1080 × 2400, density 420; approximately 411 logical pixels wide |
| Google components | `com.google.android.gms` and `com.android.vending` installed |
| Play qualification | Existing `PlayStore.enabled=no` in the AVD configuration; Play sign-in, certification and billing readiness were not established |
| WebView | `com.google.android.webview` 156.0.8078.47 |
| Connected serial | `emulator-5554` |
| AVD directory | `C:\Users\c_mar\.android\avd\OnlyFast_RevenueCat_API36.avd` |

The visible emulator was cold-started with `-no-snapshot-load -no-snapshot-save`. Existing userdata, AVD configuration and older snapshots were preserved. No `-wipe-data`, uninstall, app-data clear, host virtualization change, or new SDK download was used. Physical keyboard input is enabled in the existing AVD.

## 2. Exact app artifact and production connection

The selected stock Median implementation is documented in `native/README.md`, `docs/MEDIAN_PAYWALL_RELEASE_PLAN.md` and `docs/NATIVE_RELEASE_SUBMISSION_PACKET.md`. Historical custom RevenueCat/AdMob bridge projects and diagnostic APKs were not rebuilt or wired into this app.

| Item | Result |
|---|---|
| Approved source bundle | `tmp/final-production-release/native/OnlyFast-android-1.0.2-61.aab` |
| Source AAB SHA-256 | `B9B9105E110163591D63AB55506D31E582D85775158FB7512D82BA60B2A02D41` — matches the later, superseding submission-packet entry |
| Conversion tool | Existing `tmp/final-production-release/native/tools/bundletool-all-1.18.3.jar` |
| Local APK set | `tmp/android-emulator/OnlyFast-1.0.2-61.apks` |
| Installed universal APK | `tmp/android-emulator/OnlyFast-1.0.2-61-emulator.apk` |
| APK SHA-256 | `444D3DF7D354747B94B3BFDF7834FBEC786992E3C4D5995B792939289BADD0FB` |
| APK size | 15,662,599 bytes |
| Identity | `app.onlyfast`, versionName 1.0.2, versionCode 61; min SDK 26 / target SDK 36 |
| Launch activity | `co.median.android.LaunchActivity` |
| Included ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 |
| Configured startup URL | `https://onlyfast.app?nativeApp=true` — unchanged |
| Actual website | `https://onlyfast.app/`; public HTML returned 200 |
| Current public entry references | `/assets/main-Crx3oVS1.js`, `/assets/main-BxxoOEC8.css`, matching the recorded Phase 2C runtime |
| Recorded production baseline | Phase 2C report: `dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz`; no deployment was performed in this task |

`bundletool build-apks --mode=universal` converted the approved AAB; no application source build was performed. The existing local Android debug keystore signed the emulator APK. Its certificate SHA-256, `fcc8c18972f202a20b5d130d418a3b308dbe597b9477009fb409b876add32482`, exactly matched the previously installed version 44, allowing a successful **`adb install -r` update that retained app data**. A copy of the prior installed APK is retained as `tmp/android-emulator/installed-before.apk`.

All seven reviewed AAB-to-APK entries (six DEX/native-code entries plus `appConfig.json`) matched byte-for-byte after extraction. The APK manifest independently reported version 61 and the launch activity above. The approved wrapper's startup URL, Median user-agent suffix, stock RevenueCat integration and AdMob configuration were preserved. The configured automatic banner remains `showBanner=false`; no native ad API was invoked by the agent.

**Difference from Google Play:** this universal APK uses local debug signing and ADB installation, rather than Play signing, Play-delivered device splits and Play installation/licensing. This verifies the real Median wrapper and production web UI, but does not certify Play Billing, purchase/restore flows, Play Integrity, release signing or physical-device behavior. The source AAB was not changed or uploaded again.

The manifest includes internet/network access, coarse/fine location, phone state, vibration, push messaging, advertising/ad-services IDs, Google Play Billing, wake lock and foreground service permissions. These declarations were inspected, not edited; no new runtime location or camera grant was issued by the agent.

## 3. Authentication and data safeguards

- The owner manually entered the existing QA credentials inside the emulator and explicitly authorized continuing with read-only checks. The agent did not type, retrieve or transfer the stored password/refresh token. `C:\Users\c_mar\.onlyfast-qa\qa.env` remains the host QA interface, not an Android login injection mechanism.
- The account dropdown visibly showed `test@test.com`. Settings showed the beta-test label and an active Teams entitlement, including the existing-membership purchase hold. No tester permissions or plan were changed.
- Read-only Supabase function inspection returned “Function not found” for `reset-test-account`; the current function inventory independently confirmed that endpoint is absent. No reset request or reset deployment was made by the agent. The older frontend reset caller is not a guarantee of safe behavior if that endpoint is added later.
- Existing named QA setups appeared in Saved Setups. No setup was edited or deleted, and no reset/logout cycle was performed by the agent. The observed Lightning Sprints draft/current-weekend state was left intact. This is observation and an action audit, not a database-wide before/after checksum or proof about actions performed independently by the owner.

## 4. Screen and visual results

Screenshots below are native-emulator captures at 1080 × 2400. Local scratch captures also exist in `tmp/android-emulator/`; the links below identify the reviewed evidence.

| Screen/check | Result and evidence |
|---|---|
| Native and web splash | Both displayed OnlyFast branding. [Native splash](tmp/android-emulator/11-recovered.png), [web splash](tmp/android-emulator/01-launch.png). |
| Welcome/onboarding | Welcome, introductory class illustration and final ready slide displayed; introductory navigation worked. [Welcome](tmp/android-emulator/03-welcome.png), [class introduction](tmp/android-emulator/04-onboarding-class.png), [final introduction](tmp/android-emulator/06-ready-onboarding.png). These are introductory slides, not proof of completing a new account's profile. |
| Sign in | Native-wrapper sign-in dialog displayed; owner subsequently signed in manually. [Login](tmp/android-emulator/05-login.png). Android's physical-keyboard toolbar appears in this capture. |
| Registration | Not independently verified. The session was kept signed in after the owner's login; no new account or password reset was attempted. |
| Home/landing | Branding, quick links, current Lightning Sprints icon, class and current weekend displayed. [Home](tmp/android-emulator/29-landing-top.png). |
| Discipline and vehicle selection | Dialog and both Android option lists opened. Current Dirt Track Oval / Lightning Sprints selection was retained; dialog canceled. [Dialog](tmp/android-emulator/30-class-picker.png), [disciplines](tmp/android-emulator/31-discipline-options.png), [vehicle options](tmp/android-emulator/32-class-options.png). |
| Rookie / Pro / Teams and upgrade information | All plan sections readable through vertical scrolling; existing-member hold displayed. No Continue Free, purchase, restore or subscription-refresh action was used. [Rookie](tmp/android-emulator/15-plans.png), [Pro and Teams](tmp/android-emulator/16-plans-scroll.png). No store purchase sheet was tested. |
| Saved setups | Existing named QA setups listed successfully, with long names ellipsized inside cards. No card delete/save controls were used. [Saved setups](tmp/android-emulator/20-saved-setups.png). |
| Base setups | Existing blank Create Base Setup form displayed, with class-specific fields and Save Template footer. No template was created. [Base form](tmp/android-emulator/21-base-setups.png). |
| Setup forms | Existing Lightning Sprints Hot Laps form, class label, OnlyLaps unlinked panel, base-template control, chassis/corner inputs and fixed save footer displayed. Scrolling worked. No field was entered or saved. [Top](tmp/android-emulator/12-setup-form.png), [corner fields](tmp/android-emulator/24-setup-scroll.png). |
| Race schedule | Empty state and Add Race controls displayed; no race was added. [Schedule](tmp/android-emulator/22-schedule.png). |
| Timing scanner | Upload/Take Photo controls and empty timing section displayed. No image was submitted and no OCR request was started by the agent. [Scanner](tmp/android-emulator/25-scanner.png), [timing and Assist](tmp/android-emulator/26-assist.png). |
| Setup Assist | Completion warning, entry/mid/exit state and disabled suggestion controls displayed for the empty draft. No AI generation or What If request was started. [Assist](tmp/android-emulator/27-assist-controls.png). |
| Parts reference | Form, empty saved-parts state and search field displayed; no part added. [Parts](tmp/android-emulator/23-parts.png). |
| Settings | Profile fields, beta account label, active Teams access and purchase hold rendered within a scrollable dialog. No profile value saved. [Settings](tmp/android-emulator/14-settings.png). |
| Rookie house ads / interstitial layouts | Not displayed in this Team session. No account-tier override, ad activation, forced impression or artificial production route was used. In-app advertising layout/creative coverage remains unverified in this task. |

Across the reviewed portrait screens, text and logos were readable, rounded cards/dialogs remained inside the viewport, vertical scrolling and menu/dropdown touch controls worked, and header/system gesture areas remained separated. The fixed save footer stays above the Android gesture bar; underlying form content scrolls past it. No persistent horizontal overflow or overlapping app controls was observed in these captures. The class icon on Home loaded visibly; this is **not an exhaustive visual re-review of all 48 optimized icons or advertising assets**. Existing name truncation and the partially scrolled native select placeholder are visible; they were not changed.

## 5. Native behavior, issue and limits

| Capability | Actual result / limitation |
|---|---|
| Android Back | Returned from the initial auth dialog; dismissed native select lists; returning from plan information caused the wrapper to reload and recover the signed-in setup screen. It is not assumed to match every in-app close button. |
| Background/resume | Home key showed Android launcher; relaunching the activity brought its existing task forward with the QA session and Home intact. [Resumed](tmp/android-emulator/33-resumed.png). |
| Keyboard | Owner completed manual login with existing emulator input. Physical keyboard enabled; Android displayed a compact input toolbar. Full software-keyboard resize/IME variants were not tested or reconfigured. |
| File picker / share sheet | A system-level failure occurred during the interactive session; see below. No successful image selection/upload or native share-sheet completion is claimed. |
| Camera | Existing AVD has an emulated back camera. Real optics, photo quality, camera permissions and capture/upload flow were not verified. |
| Native subscriptions | Wrapper/configuration and membership UI inspected. Play-installed, license-tester purchase/restore acceptance requires the separate authorized billing workflow; no transaction initiated here. |
| Native advertisements | No ad activation or forced request. Team session does not exercise Rookie impressions or native interstitial layout. |
| OnlyLaps | Unlinked-status UI visible. No linking, unlinking, telemetry import or authorization flow performed. |
| Orientation, deep links, notifications, GPS | Not independently exercised; the AVD was left in portrait. Real-device, OS lifecycle and permission coverage remains necessary where applicable. |

**Observed emulator system failure:** Android logged a fatal system-process `NullPointerException` in `android.content.IntentFilter.getDataType` → `com.android.server.people.data.DataManager.reportShareTargetEvent` → `ShareTargetPredictor`. `com.android.intentresolver` then reported `DeadSystemException`; Android briefly displayed its Google boot animation before returning to the launcher. The log identifies an Android system-service failure; it does not establish an OnlyFast JavaScript defect or the precise initiating user action. No app fix, system-image update, data wipe or permission workaround was attempted. OnlyFast relaunched successfully and retained the manually authenticated session. Picker/share-sheet triggers were avoided afterward. [System restart capture](tmp/android-emulator/10-android-system-restart.png); filtered, credential-free stack evidence is in `tmp/android-emulator/system-crash-extract.txt`.

This existing API 36 image therefore provides a useful interactive visual environment, with a known picker/share-related system stability limitation. Physical Android acceptance remains necessary for camera/file selection, share targets, keyboard/device variations, real display density, background process death, and any separately authorized store/advertising integrations. No Chrome testing is substituted for native results above.

## 6. Exact future launch commands

Use PowerShell. **If this AVD is already running, skip the Start-Process command** and use the ADB launch command. Keep existing emulator data and snapshots; do not add `-wipe-data`.

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

# Start the existing visible Pixel 8 emulator, only when it is stopped.
Start-Process -FilePath (Join-Path $androidSdk 'emulator\emulator.exe') `
  -ArgumentList @('-avd', 'OnlyFast_RevenueCat_API36', '-no-snapshot-load', '-no-snapshot-save')

# Confirm the connected serial; use its actual value if another AVD occupies 5554.
& (Join-Path $androidSdk 'platform-tools\adb.exe') devices
& (Join-Path $androidSdk 'platform-tools\adb.exe') -s emulator-5554 wait-for-device
& (Join-Path $androidSdk 'platform-tools\adb.exe') -s emulator-5554 shell getprop sys.boot_completed
# Wait for sys.boot_completed to print 1 before launching.

& (Join-Path $androidSdk 'platform-tools\adb.exe') -s emulator-5554 shell am start `
  -n app.onlyfast/co.median.android.LaunchActivity
```

The app is already installed. For reference, the exact successful installation operation was the following, from the primary checkout; repeating it is unnecessary for ordinary launches:

```powershell
Set-Location -LiteralPath 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast'
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& (Join-Path $androidSdk 'platform-tools\adb.exe') -s emulator-5554 install -r `
  'tmp\android-emulator\OnlyFast-1.0.2-61-emulator.apk'
```

A signing mismatch or downgrade failure is a reason to inspect the installed app, **not** to uninstall or clear its data. The retained prior APK is evidence/recovery material; no downgrade was attempted.

For artifact provenance, the one-time conversion used the existing tools below. It is already complete; the APK set output intentionally has no overwrite flag:

```powershell
& 'C:\Program Files\Android\Android Studio\jbr\bin\java.exe' `
  -jar 'tmp\final-production-release\native\tools\bundletool-all-1.18.3.jar' build-apks `
  --bundle='tmp\final-production-release\native\OnlyFast-android-1.0.2-61.aab' `
  --output='tmp\android-emulator\OnlyFast-1.0.2-61.apks' --mode=universal
```

The universal APK was extracted from that ZIP-format APK set. Default local debug signing uses the pre-existing `C:\Users\c_mar\.android\debug.keystore`; no release keystore, password or token was requested or exposed. Official references: [Android emulator commands](https://developer.android.com/studio/run/emulator-commandline), [ADB](https://developer.android.com/tools/adb), [bundletool APK generation/signing](https://developer.android.com/tools/bundletool), [Median Android source workflow](https://docs.median.co/docs/build-android-from-source).

## 7. Handoff

The owner can click and type directly in the emulator; OnlyFast is left signed in on Home. The final ADB check confirmed boot completed, version 61 installed and `app.onlyfast/co.median.android.LaunchActivity` focused inside Android. The last attempt to bring its Windows window to the foreground was blocked by `GetCursorPos failed: Access is denied (0x80070005)`; select **Android Emulator - OnlyFast_RevenueCat_API36:5554** from the Windows taskbar if it is behind another window. No Windows security/desktop setting was changed to work around that restriction.

Treat it as production: browse existing screens, and avoid Save/Delete, subscription transactions, uploads/AI generation and live ad activation unless separately intended and authorized. If authentication expires, enter existing credentials manually inside Android; do not paste them into this report, chat, ADB command arguments or a URL.

Only this report and ignored local emulator evidence/artifacts were created for the task. App source and pre-existing local work were preserved. No deployment or further development phase was started.
