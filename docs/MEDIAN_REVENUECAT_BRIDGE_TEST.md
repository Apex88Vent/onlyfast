# Median RevenueCat read-only device test

This extends the existing isolated `/native-subscription-test` screen. No Median
support ticket is needed to run these diagnostics. The native plugin is enabled
according to the owner; its behavior still needs evidence from an Android device.
Nothing was deployed, built in Median, purchased, restored or published here.

## What the screen now does

After verifying local Auth and fresh server-owned experimental tester assignments,
it calls exactly:

```javascript
await median.revenueCat.isInitialized();
await median.revenueCat.getOfferings();
```

Both calls use zero arguments, preserve the native `this` receiver and have
bounded waits (8 seconds / 20 seconds). The legacy `gonative.revenueCat` bridge is
accepted when `median.revenueCat` is absent. Authorization is rechecked before
each native call and before displaying results. Logout/account changes clear
results; late responses from the earlier session are discarded.

The page shows returned or rejected values, elapsed times, available method
names, any observed identifier/package/product/price/trial fields and a complete
JSON report. Unknown response fields remain visible. Credential and identity
fields are redacted; there are no hardcoded store prices or assumed trial terms.
A native `success:false` response remains visible as returned data; it is not
treated as successful subscription access. Missing methods and timeouts are
reported separately. A timeout cannot cancel a native request.

The SDK is **not initialized by this screen**. Plugin enablement and SDK runtime
initialization are different. If initialization is false, the read-only offerings
call is still attempted to collect the actual native error/response. No implicit
`configure`, `login`, `logout`, purchase, paywall or restore call occurs.

## Does named-offering selection work?

The current published JavaScript implementation accepts no `getOfferings`
arguments, and the response types describe identifiers rather than a complete
named catalog. Neither the documented purchase nor paywall parameter types expose
a named-offering selector. The screen does not try speculative arguments or
execute additional methods found on the device.
[Official bridge implementation](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts),
[official bridge types](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/types/revenueCat.ts).

The diagnostic searches the returned catalog for the exact string/key
`onlyfast_monthly_v1` and displays its JSON locations. Presence proves only that
the identifier was returned; it does not prove selectable offering context.
Absence does not establish that the offering is absent in RevenueCat. Generic
`identifiers` may denote packages/products; their kind is left unverified.
An unexpected method name is an observation, not proof of a supported contract.

No current offering, paywall or RevenueCat dashboard configuration is changed.
Public native purchasing stays disabled. Rookie and existing Stripe web behavior
are preserved. Production retains its sandbox rejection setting.

## Prepare the existing local app

Keep Docker/Supabase running from the existing isolated
`tmp/staging-database` workspace. The already generated
`.env.native-sandbox.local` points at `http://127.0.0.1:54321`; it contains only a
local public key and purchase-disable flags. Do not replace it with production
credentials or run cloud migration commands. If it is missing, run the existing
`prepare-native-sandbox.mjs` script as described in the prior readiness report.

Build and serve only the diagnostic mode:

```powershell
npx.cmd --no-install vite build --mode native-sandbox
npx.cmd --no-install vite --mode native-sandbox --host 127.0.0.1 --port 8086 --strictPort
```

The diagnostic is absent from production routes/bundles. The sandbox output is
`dist-native-sandbox`, separate from `dist`; do not upload it to Vercel.

Use a synthetic **local** Auth account with an operator-assigned enabled
`native_subscription_testing` flag, `is_test_account=true`,
`beta_features_enabled=true`, `tester_kind='experimental'`, and no enabled
`test_account_full_access` override. Its definition/assignments belong only in the
local beta tables. Existing integration tests enroll temporary synthetic accounts
and clean them up, so they leave no persistent login for the device. Do not use
production accounts, customer records, grants or credentials. This extension does
not change tester enrollment or RLS.

## Generate an Android diagnostic build without customer support

1. Open your existing Median App Studio private management page. Verify Native
   Plugins → RevenueCat remains enabled. Record its visible version/build details;
   if no version is displayed, record that fact. Plugin initialization is through
   the runtime bridge, not an assumed App Studio SDK-key field.
   [Median RevenueCat setup](https://docs.median.co/docs/revenue-cat).
2. Keep the live Website URL and release configuration unchanged. Use an existing
   isolated test configuration if available on your plan. If App Studio cannot
   isolate its start URL, download the **Android source** from Build & Deploy and
   make the local start-URL change only in that downloaded test source. A browser
   preview or an APK pointing at the unchanged production website will not load
   this repository's local changes. Do not buy a new plan or change a live URL.
3. In the test configuration/source, set its start URL to
   `http://127.0.0.1:8086/`, allow the diagnostic path inside the WebView, and verify
   the generated build includes the enabled plugin. Keep `app.onlyfast` as the
   Android package for eventual real-store testing. Use a clean test device/profile
   to avoid replacing or signing into an everyday production installation.
4. If using the isolated App Studio configuration, use Build & Deploy to generate
   **Android only**, then download its APK. Do not choose an iOS/automatic upload
   workflow or publish to a store. An APK is sufficient for these read-only checks.
   [App Studio downloads](https://docs.median.co/docs/app-studio).
5. If using downloaded source, open it in Android Studio, let its Gradle/SDK setup
   finish, and build/run a debug APK on your dedicated test device. Follow the
   actual generated configuration for the test URL. Median documents
   `app/assets/appConfig.json` as its Website URL configuration location; find that
   file in the download and change its existing website URL value in the local
   test copy. This repository does not contain that native source/config file.
   If HTTP is blocked, make a narrowly
   scoped localhost HTTP exception only in that local debug build's network
   security configuration. Do not change production transport settings or bypass
   certificate warnings. No native framework migration is needed.
   [Build Android from source](https://docs.median.co/docs/build-android-from-source).

Median also documents the generated file's `security.network.allowInsecure`
setting. A localhost-only debug network policy is preferable to broadly allowing
HTTP. Any such test change stays in downloaded debug source and is removed before
a release build. [Median local configuration guide](https://docs.median.co/docs/android-studio-with-localhost-website).

App Studio's online preview cannot reach PC loopback/private addresses. The
following USB method targets the installed native WebView, not that preview. If
your plan cannot provide either an isolated test APK or the plugin-enabled Android
source, report that exact build/download limitation; do not substitute a browser
mock or change the live project.

## Connect the physical device to local services over USB

Install Android SDK Platform-Tools if `adb` is unavailable. Enable USB debugging
on the dedicated device and authorize only your own PC. Choose its serial from
`adb devices`; replace `DEVICE_SERIAL` below with that value:

```powershell
adb devices
adb -s DEVICE_SERIAL reverse tcp:8086 tcp:8086
adb -s DEVICE_SERIAL reverse tcp:54321 tcp:54321
adb -s DEVICE_SERIAL reverse --list
```

Android's documented reverse forwarding lets the WebView reach the PC's local
servers using loopback. This keeps the existing Supabase URL/guard intact and
avoids public tunnels and LAN firewall changes. It forwards neither the database
port nor any server-only credentials. Keep the USB connection and local services
running. [Android WebView local server guide](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server).

Open the **Median test APK**, sign in to the synthetic local account at `/`, then
open `/native-subscription-test` within that same WebView and tap **Read
initialization and offerings**. The path is navigation, not authorization; URL
parameters/localStorage cannot enroll a tester. If the wrapper has no in-app way
to navigate to the route, set that route as the test-only start URL, then use its
Back to local OnlyFast link to sign in and the app's back navigation to return.
Do not assume an undocumented deep link or `adb VIEW` command opens the Median app.

When finished, remove only these forwarding entries:

```powershell
adb -s DEVICE_SERIAL reverse --remove tcp:8086
adb -s DEVICE_SERIAL reverse --remove tcp:54321
```

No Play internal-track release or test transaction is necessary just to inspect
the bridge. Actual later purchases still need the separately prepared sandbox
runtime, suitable store testers and store-install acceptance tests.

## Return this evidence from the device

1. Expand **Complete diagnostic report for device handoff** and copy its JSON.
   It includes timestamp, bridge name, user agent, method inventory, initialization
   and offerings responses/errors, response durations and observed catalog paths.
   Include missing/rejected responses too; do not replace them with expected data.
2. Capture the initialization and offerings result sections, plus the named-offering
   result. If the page cannot load or authorization fails, capture that error.
3. Record Android version, device model, Median Android build/version code, plugin
   version if shown, APK versus Play installation, package name, and whether this
   was a fresh launch. Do not include passwords, Auth JWTs, server keys or receipts.
4. Confirm the local start URL, USB forwarding state and that the authorized local
   synthetic account was used. If USB or HTTP failed, include that error before
   drawing any conclusion about RevenueCat.

How the evidence determines the next step:

| Observation | Next step |
| --- | --- |
| No bridge / read method missing / timeout | Check installed native build, plugin inclusion and bridge injection readiness |
| `initialized:false` / not-configured error | Prepare a separately scoped initialization step with the Android public key and local UUID; this read-only update does not perform it |
| Only generic identifiers returned | Resolve their meaning from device/store evidence; localized pricing and named-offering selection remain unverified |
| Full offering/package/product details returned | Assess the exact returned shape and product mappings before implementing a native adapter |
| Requested identifier returned | Investigate supported selection context; presence alone cannot authorize a purchase implementation |
| Catalog absent / native error / offline | Diagnose the captured native code/message and network/initialization state before changing configuration |

All software tests here use synthetic native response fixtures. No successful
device bridge result or native purchase is claimed until device evidence arrives.

## Verification for this extension

- `npm test`: 361 passed, zero failures (10 sandbox tests, including zero-argument
  read calls, unknown/rich catalogs, errors, timeouts, revocation and isolation).
- `tests/*.mjs`: 53 passed, zero failures, one intentionally skipped local Docker
  suite. Includes a new mounted diagnostic test proving actual response rendering,
  safe store-title text, revoked access and old-account response removal.
- Application and Vite-config TypeScript checks: passed. Focused ESLint: passed.
- Local browser check: updated screen renders both method names, and a regular
  browser is refused before native calls. Actual native response rendering is
  covered by the mounted fixture test, not claimed as physical-device evidence.
- Production and native-sandbox Vite builds: passed, with existing chunk-size
  warnings. Production assets contain neither the diagnostic route nor its page
  chunk. The separate sandbox output includes the extended page.
- No database schema, tester authorization policy, backend handler, offering or
  store setting changed. The previous real Docker/RLS checks remain documented in
  the readiness report; they were not rerun for this read-only UI extension.

Logs: ignored `tmp/median-bridge-*.log`. A Median APK was not generated and a device
bridge was not exercised in this workspace.
