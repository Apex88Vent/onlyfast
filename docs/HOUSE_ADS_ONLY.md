# House ads only — Median build preparation

OnlyFast's house-only mode blocks the web app's calls to Median's banner and interstitial display commands. It cannot turn off Google's SDK or cancel an interstitial already queued by a running native app.

Before generating the next Android and iOS release candidates, open **OnlyFast → Native Plugins → AdMob Native Ads** in Median App Studio. Preserve the current settings in a build backup. For the house-only candidates, set **Plugin Enabled** to disabled on both platforms. This leaves OnlyFast's house placements independent of the native AdMob plugin. Leave the other native plugins as configured.

If the plugin must remain enabled for a specific internal build, keep **AdMob Banner Ad Enabled** on **Disable** and leave **AdMob Interstitial Ad Unit ID** empty on both platforms in that build configuration. An empty interstitial unit stops the known startup interstitial preload path. The enabled plugin can still initialize the Google Mobile Ads SDK, so use the disabled-plugin configuration for the house-only release candidates.

Review the resulting native build configurations and verify a cold launch on both platforms before release. Existing installed binaries can still initialize or preload from their bundled configuration. Median App Studio settings and production builds were left untouched for the design review.
