# Preserved native bridge development

These custom Android/iOS adapters, source preparers and QA artifacts are retained
from `codex/native-revenuecat-release` for recovery and historical development.
They are **not the application's selected billing implementation** and are not
imported by the production application entry points.

The later [stock Median paywall release plan](../docs/MEDIAN_PAYWALL_RELEASE_PLAN.md)
supersedes the custom catalog, transport and source-build release path. The
application uses `NativePurchaseController` and Median's stock paywall. Public
purchasing remains held by `NATIVE_PURCHASES_READY=false`.

The matching `src/lib/releaseNativeBilling.ts`, `releaseNativeTransport.ts` and
their tests remain available as inactive development material. Do not wire these
adapters into a native wrapper, run their QA servers or follow historical release
instructions without a separately requested development task. The historical
reports describe the state at their dates; they do not authorize a release.
