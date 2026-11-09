# OnlyFast public homepage: pre-production compatibility audit

Audit date: November 8, 2026 (America/Los_Angeles).

**Initial recommendation: NO-GO under the original all-checks-pass gate.**

**Release-readiness update, November 8, 2026:** the owner subsequently accepted
the documented, unrelated lint baseline as technical debt for this release.
It is no longer a release blocker. The current recommendation and prepared
deployment/rollback procedure are in [FINAL_RELEASE_READINESS.md](FINAL_RELEASE_READINESS.md).
The original audit findings below are retained as historical evidence; actual
Median Android/iOS WebView testing remains NOT VERIFIED.

The source-level and simulated-browser checks pass after correcting one ad-route
regression. Actual Median Android/iOS WebView acceptance is **NOT VERIFIED** and
the repository-wide lint command **FAILS** on existing files and ignored local
material. This report is not a claim that installed native apps were tested.
Nothing was committed, pushed, deployed, rebuilt in Median, or changed in a store,
database schema, subscription catalog, production environment, or customer account.

## Direct answers

| Question | Status | Answer and evidence |
| --- | --- | --- |
| 1. Will unauthenticated visitors to `onlyfast.app` see the homepage? | PASS, local production build | Yes. Cold desktop/mobile browser loads render marketing after the existing SDK session check. Native context is checked first. |
| 2. Will authenticated browser users automatically enter the app? | PASS, local production build | Yes. `/` replaces to `/app`, retaining search/hash. Direct authenticated `/app` opens the original app. Session reload and expired-session refresh were exercised. No marketing flash was observed in the authenticated-root test. |
| 3. Will the existing Median Android app bypass marketing? | NOT VERIFIED in Android WebView | The exact launch URL and Android Median user-agent simulations bypass marketing and retain native login, app landing, navigation, back, logout/reload and recovery return. No connected Android device/emulator was available to test the current build. |
| 4. Will the existing Median iOS app bypass marketing? | NOT VERIFIED in iOS WebView | The corresponding iOS Median simulations pass the same flows. Actual WKWebView, iOS link handling and native SDK/plugin execution were not tested. |
| 5. Are native updates or rebuilds required? | PASS, source/configuration contract; installed builds NOT VERIFIED | No native package or configuration change is required by this hosted website change. The specified startup URL stays `https://onlyfast.app?nativeApp=true`. Available source/release snapshots record that URL, but snapshots are historical and do not certify the currently installed packages or live Median portal configuration. |
| 6. Are subscriptions, authentication and advertising unaffected? | PASS for preserved code/policies and automated checks; live native services NOT VERIFIED | Auth/onboarding, subscription/entitlement, RevenueCat controller, pricing and native-ad implementation files are unchanged. The audit corrected `/app` ad placement support and verified the actual Rookie house banner in the browser. Real purchases/restores/native ad delivery and production email were not exercised. |
| 7. Is the build safe to deploy now? | NO-GO | Build/type/routing/regression checks pass, but the required full lint check fails and installed-native acceptance is incomplete. Do not interpret passing simulations as full native compatibility certification. |
| 8. What could not be tested? | NOT VERIFIED | Physical/actual Median Android and iOS, OS-level email/deep-link return, real purchase/restore/localized products, native ad plugin/consent delivery, production callback allowlist/email delivery, deployed response headers and live customer feature flows. |

## Scope and architecture

The app is **Vite + React Router**, not Next.js. There is no new routing middleware
or separate application/database/project. Existing account, pricing, checkout,
subscription-success, password-reset, legal and support routes are retained.
`/app` and `/login` are additive entries; existing functional routes were not moved.
The existing SPA rewrite excludes `/api/`; `api/admob-region.js` remains unchanged.

`AppEntry` checks the existing native context before mounting the browser-only
session gate. Native context enters the original `Index` → `AppLayout` tree.
Ordinary browsers use the existing Supabase client/session storage. During session
verification the gate renders a loading state. Auth events update that state;
revision checks ignore stale initial reads. Errors offer a retry without clearing
the existing session. This is UI routing only, never an authorization grant.

| Scenario | Result |
| --- | --- |
| A. `/`, unauthenticated browser | PASS: marketing homepage |
| B. `/`, authenticated browser | PASS: `/app` redirect; no marketing flash |
| C. `/app`, authenticated browser | PASS: existing dashboard/normal onboarding requirements |
| D. `/app`, unauthenticated browser | PASS: existing `AuthModal`; login returns to `/app` |
| E. `/?nativeApp=true` | PASS in both wrapper simulations: existing native tutorial/login/app; actual WebViews NOT VERIFIED |
| F. Mobile browser without native context | PASS: public marketing or authenticated `/app`; viewport/mobile UA alone does not enable native mode |

## Native context persistence: verified mechanism

The parameter is **not assumed to survive navigation**. Existing
`paymentVisibility.ts` reads `nativeApp=true` at document initialization, writes
`onlyfast_hide_external_payments=true` to same-origin localStorage, and normally
cleans the launch parameter from the address bar. Subsequent routes/reloads read
the persisted marker. Existing Median/GoNative user-agent evidence provides a
fallback. A payment-only build flag does not classify ordinary browsers as native.

If marker persistence throws, this change retains `nativeApp=true` in the URL
instead of cleaning it, preserving that reload case. Real Median UA detection
also applies if a subsequent full navigation loses the parameter. A generic UA,
blocked storage and a parameterless cross-document navigation cannot independently
prove native context; it must not be treated as a tested physical-wrapper guarantee.

Browser automation exercised native parameter cleanup, marker-based reloads and
route changes without a wrapper UA; Android/iOS UA fallbacks; authenticated native
reload; native menu navigation and back events; native logout followed by reload;
and the existing password form's post-update return to `/`. Only synthetic local
backend responses were used. Native logout continues to show the original
Welcome/tutorial/login flow, never the public marketing page in these tests.

Native safe-back history guards remain native-only. Both `/` and `/app` are
recognized as dashboard paths, retaining query/hash and dashboard view state.
Native context does not bypass the existing app's login, server membership or
feature authorization checks. Actual OS/browser-to-WebView callback handoff is
still an acceptance requirement, especially when email opens outside the wrapper.

## Compatibility issue found and fixed

**Fixed: Rookie house advertising suppressed at the new browser entry.**

`AppProvider` previously called `setRouteSupported(pathname === '/')`. Redirecting
an authenticated browser to `/app` therefore disabled existing house-ad placements.
The route check now recognizes **both `/` and `/app`**. Other routes retain their
unsupported state. No ad eligibility, consent, placement list, frequency, SDK,
membership or rollout policy was changed. A mounted provider regression and a
browser assertion of the real `OnlyFast upgrade banner` at `/app` both pass.

The source still uses the pre-existing `houseOnly: true` native-ad hold; the remote
production `VITE_MEDIAN_ADMOB_ENABLED` setting was read as `false`. Neither was
changed. Median's native startup/preload behavior was not exercised.

Nine lint errors in the new routing test harness were also corrected by adding
proper test/session/module types. They were not hidden with rule suppressions.

## Authentication and feature regression audit

| Category | Source/automated result | Remaining live verification |
| --- | --- | --- |
| Supabase auth/session persistence | PASS: original client, keys/fallback and storage format retained; actual SDK login, signout, reload and expired refresh exercised with intercepted responses | Production credentials/session services not exercised with a real account |
| Password reset and email verification | PASS: existing reset URL/form retained; root recovery goes to the original form; root confirmation enters `/app`; native recovery return retains context in simulations | Actual SMTP delivery, production redirect allowlist and OS-level return NOT VERIFIED |
| Native login/onboarding | PASS for unchanged source, existing regression suite and simulated entry | Actual Android/iOS WebViews NOT VERIFIED |
| Setup Notebook, Setup Assist, schedules, timing and OnlyLaps | PASS: existing implementations retained; relevant suite tests pass, including timing/session/OnlyLaps isolation and authorization checks; schedule navigation smoke exercised | End-to-end live customer/provider data NOT VERIFIED |
| Shared setups, deep links and navigation | PASS: existing routes retained, query/hash preserved, native back/schedule and `/account` alias exercised; existing share/backend tests pass | External app/universal-link handoff NOT VERIFIED |
| Rookie/Pro/Team access | PASS: membership and server authorization code unchanged; existing entitlement tests pass; native marker is not an access credential | Live store-to-backend synchronization NOT VERIFIED |
| RevenueCat subscriptions | PASS: controllers, SDK identity, refresh/purchase/restore policy and remote environment values unchanged; existing RevenueCat tests pass | Actual store purchase/restore/renewal and native bridge NOT VERIFIED |
| Advertising | PASS after route-alias fix; actual Rookie house banner asserted; existing ad/consent/isolation tests pass | Real Median plugin rendering/consent NOT VERIFIED |
| Existing accounts/data | PASS: no real accounts signed in or mutated; no schema migration/function deployment; browser backend fully intercepted | This is not a live data-integrity audit of existing customer rows |

All production-source differences under `native/` and `supabase/` are empty.
AuthModal, AppLayout, OnboardingFlow, ResetPassword, native purchase controller,
native ad controller, membership, subscription logic and dependency manifests
remain unchanged. The single existing app-provider modification is the ad-route
compatibility fix described above.

## Build, type, lint and browser evidence

| Check | Status | Result |
| --- | --- | --- |
| `npm test` | PASS | **541 passed, 0 failed**, including 10 public-routing/session/provider regressions |
| `tsc --noEmit -p tsconfig.app.json` | PASS | Application type check |
| `tsc --noEmit -p tsconfig.node.json` | PASS | Vite/build-configuration type check |
| `npm run release:check` | PASS | Production build, **82 output files** checked; no QA endpoints, historical bridge modules, experimental ad transport or source maps in release output |
| `npm run lint` | FAIL | **528 errors, 108 warnings** across the existing repository and ignored local material after fixing the 9 new test errors |
| Focused ESLint on changed runtime and routing test files | PASS with existing warning | **0 errors, 1 existing React-refresh warning** in AppContext's pre-existing hook export |
| Local production-build browser suite | PASS | **14 groups**, listed below; uses actual app/router/SDK with intercepted backend responses |
| Vercel configuration schema | PASS | All used configuration properties validate against the current official schema |
| `git diff --check` | PASS | No whitespace errors |

The full lint baseline contained **418 errors / 95 warnings in unchanged tracked
files**, plus **110 errors / 12 warnings in ignored/other local files**. The one
warning in the modified provider existed before this audit. The 9 errors in the
new test file are fixed, leaving no new lint errors. Existing lint debt was not
silenced, excluded or mass-refactored as a release-audit workaround.

The 14 browser groups cover: desktop public rendering/SEO/store links; mobile
menu/keyboard/anchors; Login and Launch buttons/back/cancel; browser login/reload/
signout; returning auth redirect without flash and query/hash retention; Android/
iOS native parameter login/reload; marker-only persistence and explicit browser
reset; reset route/root recovery; blocked marker storage reload; email confirmation;
Rookie ads at `/app`; native schedule/back/logout/reload/recovery return; mobile
authenticated browser and account alias; and expired SDK session refresh.

These tests are **not** Android WebView, iOS WKWebView, live Supabase or real
RevenueCat tests. They use fresh Chrome contexts with synthetic sessions and
intercept **all** backend/provider traffic. No real purchases, restores, password
changes, emails or customer records were sent/modified. The test fixture seeds
authentication once, so signout/reload results cannot be hidden by re-seeding it.

Evidence is retained in ignored local files:

- `tmp/preproduction-audit/tests.log`
- `tmp/preproduction-audit/types.log`
- `tmp/preproduction-audit/types-build-config.log`
- `tmp/preproduction-audit/release.log`
- `tmp/preproduction-audit/lint-final.json`
- `tmp/preproduction-audit/lint-classification.json` (initial baseline before 9 test fixes)
- `tmp/preproduction-audit/changed-lint.json`
- `tmp/preproduction-audit/browser.log`
- `tmp/preproduction-audit/vercel-schema.json`
- `tmp/public-website/results.json`
- `tmp/final-production-release/web-build-manifest.json`

## Production configuration: read-only observations

The existing Vercel OnlyFast project is linked to `Apex88Vent/onlyfast`, framework
Vite, Node 24.x. The latest existing deployment was READY. No dashboard routing
rules were returned, so no additional project-level rewrite/redirect conflict
was found. Repository `vercel.json` keeps automatic Git deployments from `main`
disabled. This audit did not create a deployment, push Git or change that setting.

The app introduces **no new required environment variables**. Vite currently uses
its existing bundled public Supabase URL/key fallback when `VITE_SUPABASE_*` or
legacy Vite names are absent. Remote Supabase metadata reports the existing
OnlyFast project `ACTIVE_HEALTHY`. Other Supabase/Postgres server variables were
listed read-only; masked secret values were not treated as missing or decrypted.
No server/service-role secret was added to Vite code.

Existing production RevenueCat master and per-platform flags were read as enabled;
both encrypted public SDK-key entries exist. Source `NATIVE_PURCHASES_READY=true`
is a pre-existing October 30 activation, not a change made for this homepage.
The ad flag remains disabled and diagnostics false. Values and rollout policy
were not changed, SDK key correctness was not asserted from masked values, and
no store configuration was changed. Older retained native reports describing a
false purchase hold are historical, not the current code/configuration evidence.

No new callback path is required for the existing auth flow. `/reset-password`
stays unchanged and root confirmation remains supported. The live Supabase redirect
allowlist/email templates were not obtainable from the available read-only project
metadata tools, so production email/callback acceptance remains NOT VERIFIED.
Vercel headers/schema were inspected locally; deployed header behavior for this
unreleased source has not been tested.

Official reference checks: [Supabase session API](https://supabase.com/docs/reference/javascript/auth-getsession),
[auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls), and
[Vercel configuration schema](https://openapi.vercel.sh/vercel.json).
The Supabase changelog was checked; no SDK or CLI upgrade was introduced.

## Latest requested visual refinements

Removed the whole hero kicker line, moved hero copy/photo composition upward,
tightened feature/pricing card gaps and feature icon-to-title spacing, and kept
the four toolkit cards in a 2 × 2 grid. Footer links are a compact horizontal
**Features → Pricing → Download → Login** row with email below.
The user's existing preview tab was stale; it was refreshed and the actual visible
mobile footer was verified. Button/link destinations and marketing wording outside
the explicitly removed kicker remain unchanged.

## Conditions for a production GO

1. Exercise this exact build in the existing Median Android and iOS WebViews:
   cold unauthenticated/authenticated launch, login/onboarding, internal navigation,
   reload/resume, password/verification return and logout/reload. Confirm native
   subscription management and held advertising behavior without activating new
   purchasing or ad delivery. Record real-device/native-environment evidence.
2. Resolve the repository-wide lint failure, or explicitly review and accept the
   documented pre-existing lint baseline as a change to the all-checks-pass gate.
3. Confirm production Supabase email callback allowlisting/return behavior and
   inspect the deployed routing/header behavior through an approved preview path.
4. Review this report and explicitly approve production deployment only after the
   required acceptance conditions are satisfied or explicitly revised.

**Current action: hold production. Await the user's review; do not deploy.**
