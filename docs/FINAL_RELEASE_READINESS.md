# OnlyFast homepage — final release readiness

Prepared November 8, 2026 (America/Los_Angeles).

**Subsequent owner authorization:** direct production deployment to the existing
`onlyfast.app` domain is now approved. The owner expressly accepts the documented
Median-device and existing-lint risks and requests no staging deployment. This
authorization supersedes the staging/approval sequence retained below. Deploy
the reviewed source with the existing Vercel production environment, preserve
`dpl_GCBkm1V1YkuGBT89MGhJJfCSTRYg` for rollback, and immediately smoke-test the
production responses. No service configuration or data changes are authorized.

**Recommendation: CONDITIONAL GO for an approval-controlled release.** No
production-breaking regression has been identified in this change. The existing
lint debt is accepted by the owner and does not block this release. Actual Median
Android/iOS WebView acceptance remains outstanding. Prefer testing the staged
production build in both wrappers before promotion; if unavailable, promotion
requires the owner's explicit acceptance of that remaining risk.

**Nothing has been committed, pushed, deployed or promoted.** No native package,
launch URL, database, production environment value or subscription configuration
was changed. This preparation does not authorize a release.

## Verified working

| Area | Evidence |
| --- | --- |
| Production-mode build | Release check passes; all 82 existing output files rechecked against their SHA-256 manifest |
| Types and regression tests | Both application/build-config TypeScript checks pass; 541 tests pass, zero failures |
| Browser entry points | All 14 local production-build browser groups pass again during readiness review |
| Public `/` | Unauthenticated desktop/mobile browsers see the homepage |
| Browser `/app` | Authenticated root automatically replaces to `/app`; direct `/app` opens the existing app; unauthenticated `/app` uses the existing login |
| Sessions and callbacks | Login, reload, logout, expired-session refresh, recovery and verification exercise the actual router/SDK with intercepted responses |
| Existing functionality | Existing routes, app components, native integrations and entitlement enforcement retained; applicable regression suite passes |
| Pricing/subscriptions/ads | Pricing, RevenueCat controller, purchase/restore logic and ad eligibility/hold policies unchanged. The `/app` alias was added to existing dashboard ad-route support; actual Rookie house banner assertion passes |
| Data/environment | No schema, migration, dependency, native package or environment change is required by this homepage |
| Rollback | Vercel confirms current production deployment READY and `isRollbackCandidate: true`; its identity and domain assignment are recorded below |

These are local browser tests with synthetic sessions and intercepted backend
traffic, not live account/store end-to-end acceptance.

## Accepted lint baseline

The owner expressly accepted the 528 pre-existing repository-wide lint errors
as technical debt for this release. No broad cleanup, rule suppression or ignore
change was made. The prior classification is 418 errors in unchanged tracked files
and 110 in ignored/other local material. The apparent hooks-rule error is an
unavailable ESLint rule in a generated Vite dependency cache, not a new hooks
violation in the application.

Readiness review reran ESLint on all ten changed/new application/routing-test
files: **0 errors, 1 pre-existing Fast Refresh warning** on the existing AppContext
hook export. The new browser QA script also has **0 errors and 0 warnings**.
The earlier nine new routing-test lint errors were corrected in the audit.
No production-breaking issue was identified from the remaining lint evidence;
passing tests are not a claim that all existing technical debt is harmless.

Evidence: `tmp/preproduction-audit/release-readiness-lint.json`,
`readiness-qa-lint.json`, `lint-final.json`, and `readiness-browser.log`.

## Median: simulated, not actual-device verified

The production startup URL stays **`https://onlyfast.app?nativeApp=true`**.
Native mode is checked before the browser session/homepage gate and opens the
original Index/AppLayout tree. The query flag writes the existing
`onlyfast_hide_external_payments` localStorage marker before normal URL cleanup.
That marker persists across routes/reloads. Median/GoNative user agents also
identify the wrapper. A payment-only build flag does not mark ordinary browsers
as native. If storage fails, the true parameter is retained for reload.

Both Android/iOS user-agent simulations passed cold entry, login, authenticated
reload, menu/schedule navigation, back, logout/reload, and password recovery
return. Marker-only operation, explicit browser reset and blocked-storage reload
also passed. Native context never grants account or membership authorization.

No connected Android device/emulator was found, and no actual iOS WKWebView was
available. Native plugin execution, OS link handoff, real RevenueCat
purchase/restore, native-ad delivery and production email return are **NOT
VERIFIED**. Generic UA plus unavailable storage plus a parameterless full
navigation is a remaining context-loss edge case. Current installed package and
live Median portal configuration were not independently inspected.

No native URL/package/configuration change or rebuild is indicated by this hosted
change. No new native build or historical custom bridge is part of this release.

## Prepared candidate and environment boundary

- Repository: `Apex88Vent/onlyfast`, primary checkout, branch `main`.
- Reviewed base commit: `29f51f524c9030ee4c0cbe72a9737adf65428f52`.
- Read-only fetch confirms local and remote main are synchronized (0 ahead/0 behind).
- Candidate source fingerprint: `635ee0f4e58d2c1ec81e8e4a130319c6d09eacd92f630b902f8f834038de9ac6`.
- `tmp/release-readiness/candidate-manifest.json` records hashes for 286 source/build-input files and the 82-file audited output manifest.
- `tmp/release-readiness/audited-dist/` preserves the exact locally tested output.

**Do not upload the local `dist` as a production prebuilt release.** The local
preview's RevenueCat build flags are unset. Read-only production metadata confirms
master/Android/iOS flags enabled, both encrypted public SDK-key entries present,
AdMob disabled and ad diagnostics disabled. The intended release must build the
reviewed source using the existing Vercel **production** environment. This is
normal use of existing configuration, not a new environment migration.

No secrets were decrypted or printed. Source `NATIVE_PURCHASES_READY=true` and
`houseOnly: true` are existing state; do not toggle them during this release.
The `.vercelignore` excludes QA, native historical sources, local environment files
and generated material from source uploads. No local `.vercel/project.json` or
installed Vercel CLI was found; do not allow a CLI to create/select a different
project implicitly. The authenticated Vercel connector has verified the target.

## Staging and native acceptance procedure — prepared, not executed

No hosted staging URL was created because the owner requested preparation and
explicit approval before deployment. The local exact-build entry for inspection
is `http://127.0.0.1:4173/?nativeApp=true`; opening it in Chrome remains a simulation.

After deployment approval:

1. Reconfirm the source fingerprint, current production alias and project IDs.
   Use project `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR` (`onlyfast`), team
   `team_smopqnOs6cFIL3nxEZ7O9O7Z` (`apex88vents-projects`). Existing work remains
   on main; no branch/worktree or automatic Git push is needed.
2. Use a reviewed Vercel CLI version and explicitly link/inspect this existing
   project if the CLI is needed. Do not create a project or alter settings. Stage
   a production-target source build with `vercel deploy --prod --skip-domain`
   in this checkout and verified scope. Keep `onlyfast.app` on the current build.
   A plain preview build can have different environment values and is insufficient.
3. Record the staged deployment ID, its output hashes and production environment
   provenance. Repeat public/authenticated/native-context routing checks and verify
   actual SPA responses, API exclusion, robots headers and all release assets.
   Re-test any changed output. Promote this staged production deployment without
   rebuilding; the local snapshot is evidence, not the release upload.
4. If an existing designated test wrapper supports opening an allowed internal
   test URL, use `https://<staged-deployment-host>/?nativeApp=true` in its actual
   WebView. Confirm it remains inside the wrapper and can use existing plugins;
   Safari/Chrome or an external browser is not a Median test. Preserve production
   launch URL and store packages. Do not change the portal URL, rebuild packages,
   alter navigation allowlists or disable deployment protection to force this.
   If existing wrapper navigation/protection cannot support staging, record that
   limitation and obtain risk acceptance before production promotion.
5. On Android and iOS record device, OS, installed app version, staged deployment
   ID and result for: fresh unauthenticated launch; existing-session launch;
   login/onboarding; internal navigation/back; reload/resume; logout/reload;
   password/email verification return; existing subscription management UI and
   house-ad policy. Do not perform real charges or activate held advertising.
   Use a designated test account for any state-changing login/recovery tests.
6. Obtain promotion approval with native results or explicit acceptance of the
   outstanding native/live-service risks. Promote that exact staged production
   deployment. Smoke-test the unchanged production launch URL, `/`, `/app`, login
   and critical routes immediately; observe runtime errors and rollback if needed.

A staged origin cannot prove the installed app's cold startup at the production
origin or its OS-level auth-link association. Those require an immediate
post-promotion smoke test using `https://onlyfast.app?nativeApp=true` in the existing
installed apps. No production app URL/package change is needed for that test.

## Rollback prepared

Read-only Vercel alias and deployment-history queries confirm:

- `onlyfast.app` currently targets **`dpl_GCBkm1V1YkuGBT89MGhJJfCSTRYg`**.
- URL: `https://onlyfast-5swbh29be-apex88vents-projects.vercel.app`.
- State: READY; target: production; rollback candidate: true.
- Previous READY production rollback candidate also retained:
  `dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz`.

After releasing the homepage, use Vercel Instant Rollback to restore
`dpl_GCBkm1V1YkuGBT89MGhJJfCSTRYg`, confirming both `onlyfast.app` and
`www.onlyfast.app` mappings. With verified CLI context the equivalent command is
`vercel rollback dpl_GCBkm1V1YkuGBT89MGhJJfCSTRYg --scope apex88vents-projects`.
Neither rollback nor promotion was executed as a test.

Rollback restores the earlier build, not external database/provider state.
There is no migration to reverse in this release. Vercel disables automatic
domain assignment after rollback; preserve the existing disabled main-branch
auto-deployment setting and review promotion deliberately.
See [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) and
[staging production deployments](https://vercel.com/docs/cli/deploy#skip-domain).

## Remaining risks and decision

The new homepage/routing has no identified critical regression. Lint debt is
accepted. Existing application/billing/ad logic requires no unrelated change.
Actual native WebView/plugin/OS handoff, production callback allowlisting, and
live customer/provider flows remain unverified. The production-configured staged
artifact and deployed headers are still pending deployment approval.

**Ready for the owner's explicit approval of the staged release process.**
Production domain promotion remains a separate approval step after staged results
and native verification or explicit risk acceptance. No automatic deployment.
