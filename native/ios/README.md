# iOS release adapter: blocked pending source and build access

No iOS native adapter, binary, StoreKit purchase or TestFlight test is claimed. The available download contains Android and the web repository only; no Median iOS Xcode workspace/Podfile was available to inspect. Windows cannot compile or sign the required iOS application.

The web protocol validates the verified iOS product IDs and can consume a matching `onlyFastBilling` channel, but that is a mocked contract, not a functioning WKWebView bridge. Do not enable web/native purchases on iOS yet. The standard Median bridge is insufficient for the required explicitly named offering and complete pricing terms; do not substitute its generic paywall.

Required inputs/actions:

1. Download the licensed Median iOS source for the actual release app, including `.xcworkspace`, plugin sources and Pods/Podfile.lock. Median documents [building iOS from source](https://docs.median.co/docs/build-ios-from-source). Confirm source licensing, signing team, bundle `app.onlyfast`, provisioning and In-App Purchase capability.
2. Provide Mac/Xcode build access. Determine the actual installed RevenueCat iOS SDK version from the source lockfile before choosing APIs; Android SDK 10.3.0 does not establish the iOS SDK version.
3. Implement the shared protocol in the actual WKWebView lifecycle. Use a main-frame handler with approved HTTPS origin checks, native Auth verification, one SDK initialization owner, ephemeral tokens and account generation invalidation. Export the same channel contract; do not assume an undocumented Median method exists.
4. Configure only after validating the authenticated Supabase UUID using the existing iOS **public** SDK key `appl_ScuxViARpeZHZQyTtVQQpSooVFz`. Never ship private API credentials. Fetch `onlyfast_monthly_v1` explicitly; Pro `$rc_monthly` / `app.onlyfast.pro.monthly`, Teams `$rc_custom_teams_monthly` / `app.onlyfast.teams.monthly`.
5. Return actual StoreKit localized prices, periods and introductory eligibility using APIs supported by that SDK; unknown eligibility stays unknown. Purchase the selected package and implement actual cancellation, deferred/pending, errors, identified restore and account-switch rejection. Refresh membership through the existing server sync, not client entitlement grants.
6. Preserve Median login, navigation, photo selection and plugin listeners. If using App Studio cloud packaging instead of source builds, Median must integrate a custom plugin; a web repository change alone cannot add native code. See [Median native plugins](https://docs.median.co/docs/native-plugins-overview).
7. Test using a separately restricted build and the free isolated sandbox backend. A simulator/device cannot assume Windows localhost is its backend: use an explicitly reviewed reachable development endpoint. Keep production sandbox rejection unchanged. Run actual StoreKit/TestFlight purchases only with further approval and appropriate Apple sandbox accounts.

Keep the public purchase hold, restore hold, offering configuration, Apple review state and live subscriptions unchanged. Do not submit a product or upload a binary to resolve these blockers.
