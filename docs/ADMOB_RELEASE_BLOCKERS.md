# AdMob release blockers, November 4, 2026

**Not ready for production activation.** The canonical deployment still uses
`VITE_MEDIAN_ADMOB_ENABLED=false`. Vercel has no production mode configured.
This audit and the local source changes do not change that deployment.

## Stock Median wrappers

- **Android 1.0.2 (61):** In the extracted DEX, `h7.g.g` handles
  `/showInterstitialIfReady`. If the cached ad is absent, the handler sets
  `h7.g.b` and calls `h7.g.i` to load. `h7.f.onAdLoaded` consumes that flag and
  presents the ad without another OnlyFast eligibility check. The native load
  helper has no direct UMP `canRequestAds` check. `h7.a` checks UMP during the
  consent flow, but can return success without showing the saved choices form.
  The public bridge offers no separate ready-only or privacy-options command.
  The current build 63 still maps the stock plugin to the same AdMob classes.
  Its stock 2.0.0-alpha dependency loads on activity start without checking
  `canRequestAds`, and can display from the interstitial load callback.
- **iOS 1.0.2 (59):** The IPA has the existing App ID
  `ca-app-pub-9431443509195212~1722134918`, banner
  `ca-app-pub-9431443509195212/7067841263`, and interstitial
  `ca-app-pub-9431443509195212/5469808233`. It includes Median AdMob 1.2.13,
  Google Mobile Ads 11.13.0, UMP 2.7.0, and Meta Audience Network 6.20.1. Manual
  ATT and its purpose string are present. The plugin binary contains SDK start,
  UMP update and privacy-options selectors. Symbols alone do not establish
  when those calls run or whether Settings can invoke the saved choices form.
- **Required native work:** Use a supported Median plugin update or a scoped
  change to the licensed native plugin. An interstitial command must check
  foreground state, current opportunity and consent, show a cached ad once,
  or return immediately. An ad-load callback may cache an ad for a future
  event but must never present it. Native consent must refresh on launch,
  respect stored choices and check UMP before any load or preload. Expose
  supported privacy-options availability and presentation for Settings where
  required, and apply changes to already loaded ads. Keep EEA, UK and Swiss ad
  requests excluded until the regional consent and exclusion path is verified.
  A mediation group targeted to the US alone does not enforce that exclusion.

References: [Median AdMob bridge](https://docs.median.co/docs/admob-native-ads),
[Android UMP](https://developers.google.com/admob/android/privacy), and
[iOS UMP](https://developers.google.com/admob/ios/privacy).

## iOS attribution configuration

The inspected build 59 app `Info.plist` has no `SKAdNetworkItems`. The local
[plist merge input](../native/ios/AdMob-SKAdNetwork.plist) contains the 50
identifiers published by Google for Google and its select third-party buyers,
including the two entries Google lists for Meta. The entries support install
attribution and do not activate a mediation group. Confirm the active mediation
configuration before adding any additional network entries. Merge the array
into the current Median iOS target's `Info.plist`, preserving its existing
keys and deduplicating by `SKAdNetworkIdentifier`. Use a supported Median build
configuration or the current licensed Xcode source. Verify the resulting IPA's
app-level plist when a native build is separately authorized. The local input
is not embedded in build 59.

References: [Google iOS SDK setup](https://developers.google.com/admob/ios/quick-start),
[Google buyer identifiers](https://developers.google.com/admob/ios/3p-skadnetworks),
and [Median iOS source workflow](https://docs.median.co/docs/build-ios-from-source).

## Production switch and acceptance

The web controller requires an enabled advertising mode, verified Rookie
membership, a US result from the production Vercel country check, the native
bridge, and current permission from a trusted native UMP source. Settings still
runs Median's consent refresh and iOS ATT request. The refresh result does not
report UMP's current `canRequestAds` state. The stock integration has no
documented permission reader, so its permission remains unknown and app-initiated
native requests stay off. Eligible Rookie house ads still work and share the
manual-save cooldown.

This policy controls only app-initiated ad requests. The stock SDK's autonomous
startup loads and Android's delayed interstitial display still require native
verification and correction.

Before activation, confirm the supported bridge contract on the actual Android
and iPhone release builds. Verify that old installed wrappers cannot receive live
ad commands, then review the code gate against the verified wrapper. Use registered
test devices to check a missed interstitial followed by navigation, both eligible
triggers, the shared 600-second cooldown, first-run and saved UMP choices, rejection
and errors, regional exclusion, banner placement and keyboard handling, and ad
removal on paid membership. Retain the production hold until device acceptance.

After the stock bridge exposes trustworthy UMP permission and native loading,
ready-only display and regional enforcement are verified, connect the documented
permission source and use these settings in the **Vercel Production environment
only**, after release approval,
and deploy a reviewed production build to `https://onlyfast.app` with Vercel's
`VERCEL_ENV=production` build provenance:

```text
VITE_MEDIAN_ADMOB_ENABLED=true
VITE_MEDIAN_ADMOB_MODE=production
VITE_MEDIAN_ADMOB_DIAGNOSTICS=false
```

The environment settings take effect when a new build is deployed. Confirm
production impressions separately from requests, matching and test display.

## Store and AdMob console checks

- **Android:** Play Console → App content → Actioned shows Advertising ID dated
  October 30, 2026, and the action-needed tab is clear. No further declaration
  action is indicated. AdMob shows Ready and verifies the Android `app-ads.txt`.
- **iOS:** AdMob still shows Requires review, limited serving and Verify app.
  Its crawler report says No app-ads.txt file found for App Store ID 6792149373.
  The public listing has a privacy-policy link but no Developer Website link.
  The live publisher file returns HTTP 200 with the expected record. Once the
  App Store Marketing URL `https://onlyfast.app` is public, request a recrawl and
  complete Verify app in AdMob. Confirm iOS is included in applicable US-state
  privacy messaging. A physical iPhone acceptance test remains required.

References: [Play Console app content](https://play.google.com/console/u/0/developers/5717693031546951711/app/4972733565237330967/app-content/overview),
[AdMob crawler report](https://admob.google.com/v2/apps/appadstxt),
[public App Store listing](https://apps.apple.com/us/app/onlyfast/id6792149373),
[live app-ads.txt](https://onlyfast.app/app-ads.txt), and
[Google app-ads.txt instructions](https://support.google.com/admob/answer/9363762).
