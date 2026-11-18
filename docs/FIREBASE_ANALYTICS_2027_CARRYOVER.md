# Firebase carryover into the January 2027 release

Updated November 15, 2026, in `develop/onlyfast-2027`.

## What happened and what is restored

The November 11 analytics work was preserved in
`stash@{0}` (`preserve-main-before-onlyfast-2027-phase1-2026-11-12`) when the
2027 iteration began. It had not been transferred into this branch. The analytics
files and additive event hooks have now been recovered selectively. The stash,
other branches, advertising sources and existing Track Trace work were preserved.

`src/main.tsx` now calls `startAnalytics()` before choosing the ordinary app,
2027 permission preview, or verified 2027 testing app. `src/App.tsx` mounts the
shared auth/screen lifecycle. This places initialization in the common source
entry instead of a screen that a January build could bypass. Firebase 13.2.0 is
an explicit package dependency and is recorded in the lockfile.

`npm run analytics:check` validates the dependency, recovered service files,
shared entry point, mounted auth observer, consent controls and config wiring.
`tests/analyticsCarryover.test.ts` executes all three startup branches with
isolated dependencies. Removing Firebase or its startup wiring makes these
checks fail. Include all analytics changes and the lockfile in the reviewed
release commit; pending local changes alone do not update a hosted build.

## Behavior in this iteration

- Standard browser: Firebase Analytics initializes lazily after a complete public
  config, `isSupported()`, the master enable flag, and explicit analytics consent.
- Median Android/iOS: wait for the chained `median_library_ready()` callback,
  verify app identity using `deviceInfo()`, then use only the native plugin. Web
  Analytics is never used as a fallback inside the wrapper.
- Isolated 2027 Preview/testing: collection is denied even if an inherited
  `VITE_ANALYTICS_ENABLED=true` is supplied. The existing restrictive CSP and
  synthetic-data isolation remain in place. Preview consent is stored separately
  from release consent. Startup wiring being present does not mean QA traffic is
  being sent to the live Firebase project.
- No additional Supabase, RevenueCat, native SDK, database or payment
  initialization is introduced. Advertising and purchasing holds remain in place.

The event and native/web service architecture is described in
`FIREBASE_ANALYTICS_INTEGRATION.md`. The 2027 property allowlist includes the
actual current `sportsman`, `pro`, `factory` and `unsubscribed` tiers as well as
legacy `rookie` and `team`. No invented subscription tier is used. The existing
trusted membership notifications refresh properties after tier changes.
`/track-trace` records only a screen name; raw GPS, paths, laps and telemetry are
never added to analytics payloads. The current disabled 2027 plan cards do not
fabricate purchases or plan selections from their permission-inspection UI.

## Consent controls now included

The existing cookie/privacy notice has a distinct **Allow Analytics** action.
**Accept Essential** and **Decline Optional** both decline analytics. An earlier
essential-cookie choice is not imported as analytics consent.

`AnalyticsPrivacyControl` is available in Settings, the public Privacy Policy,
and the in-app privacy modal, so consent can be withdrawn without signing out.
It displays when collection is disabled in the build. The privacy wording
describes the data used and makes advertising permission separate. Review this
wording and Firebase's configured retention settings before launch.

## January release requirements

1. Include these source files and `package-lock.json` in the January release
   commit. Run `npm test` and `npm run analytics:check` as release checks.
2. Inspect the intended Vercel project's existing variables before adding any
   missing public Firebase values from `.env.example`. Do not overwrite other
   variables. For the authorized release, set `VITE_ANALYTICS_ENABLED=true`.
   The current `.env.local` has `false` and was deliberately left unchanged.
3. Run `node scripts/verify-analytics-integration.mjs --release` with the intended
   release environment. This requires enablement and every public Firebase field;
   it performs no deployment or network requests. It checks configuration, not
   consent or live reporting.
4. Use the reviewed production release entry/configuration. The current
   `onlyfast-2027` mode remains intentionally preview-only and rejects production
   deployments. Its production guard and restrictive CSP were not weakened.
   January promotion must deliberately review that guard and configure the
   production CSP for Firebase/Google tag collection; this integration cannot
   enable collection while the preview restrictions remain. Keep preview
   collection disabled when promoting the production build.
5. Verify the supplied Firebase project `onlyfast-2c5e3`, web stream
   `G-41VY91DEP8`, and the Android/iOS streams uploaded to Median. In the web
   stream, review/disable duplicate automatic page/history and form measurement
   before enabling the manual screen flow. Configure retention and register the
   coarse custom dimensions used in reporting.
6. In Median App Studio verify the Firebase Analytics plugin is enabled, the
   existing uploaded service files match the release app, and default consent
   is **Deny**. Rebuild Android/iOS through Median. JavaScript cannot suppress
   automatic SDK startup events before its bridge is ready.
7. Test deny/grant/withdrawal, login/logout/account switching, tier changes and
   events on a real Median-built Android and iOS app. Native UUID identification
   stays withheld until Median documents a supported identity reset. Native
   manual screens stay off until automatic reporting duplication is reviewed.
8. Verify Firebase DebugView, then ordinary Realtime reports for each stream.
   Unit tests and compiled builds are not evidence of Console delivery.

`subscription_activated` and custom `ad_impression` remain intentionally withheld:
the integration needs an authoritative deduplicatable entitlement transition or
confirmed impression callback respectively. This carryover does not activate
billing, advertising, or unverified purchase reporting.

No January automation, deployment, push, store build or remote environment change
was performed. Source carryover is implemented; release activation remains an
explicit launch step, with user consent still required afterward.

## Verification

- `npm test`: 733 passed, including 26 analytics/carryover tests.
- TypeScript: application and Vite/Node projects pass.
- Focused ESLint: new analytics modules, controls, tests and carryover checker pass.
- Build: ordinary production bundle, `onlyfast-2027` permission preview, and the
  isolated 2027 testing-app bundle all pass. The testing-app build used a synthetic
  public-key-shaped fixture and made no backend requests.
- Additional mounted navigation, subscription, advertising and Assist regressions:
  91 passed.
- Repository-wide lint still fails on existing source/generated-file lint debt:
  1,810 errors and 351 warnings. New analytics files pass focused lint. Details
  are in `tmp/analytics-2027-lint.log`; no unrelated lint refactor was made.
- Live Firebase Console delivery and physical Median builds remain unverified.

The local verification logs use the `tmp/analytics-2027-*` prefix. None of the
test commands changes hosted data or the existing release activation flags.

References: [Median Firebase Analytics](https://docs.median.co/docs/firebase-analytics),
[Firebase Analytics reference](https://firebase.google.com/docs/reference/js/analytics),
[DebugView](https://firebase.google.com/docs/analytics/debugview).
