# Preserved native bridge development

These custom Android/iOS adapters, source preparers and QA artifacts are retained
from `codex/native-revenuecat-release` for recovery and historical development.
They are **not the application's selected billing implementation** and are not
imported by the production application entry points.

The later [stock Median paywall release plan](../docs/MEDIAN_PAYWALL_RELEASE_PLAN.md)
supersedes the custom catalog, transport and source-build release path. The
application uses `NativePurchaseController` and Median's stock paywall.

The matching `src/lib/releaseNativeBilling.ts`, `releaseNativeTransport.ts` and
their tests remain available as inactive development material. Do not wire these
adapters into a native wrapper, run their QA servers or follow historical release
instructions without a separately requested development task. The historical
reports describe the state at their dates; they do not authorize a release.

The experimental `android/admob/OnlyFastAdMob.java` and
`ios/OnlyFastAdMob.{h,m}` sources are also preserved for reference.
Median App Studio supplies the production wrappers. The standalone
`scripts/prepare-onlyfast-admob.mjs` preparer is for the historical experiment
and is excluded from the stock Median release workflow.
