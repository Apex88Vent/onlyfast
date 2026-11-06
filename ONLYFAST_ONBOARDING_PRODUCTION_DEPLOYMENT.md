# OnlyFast onboarding production deployment

Completed November 6, 2026. The approved frontend is live at https://onlyfast.app using the existing Median wrappers.

## Deployment record

| Item | Result |
| --- | --- |
| New production deployment | **dpl_GCBkm1V1YkuGBT89MGhJJfCSTRYg — READY** |
| Deployment created | 2026-11-06 20:26:29.203 UTC / 12:26:29.203 PST |
| Production deployment URL | https://onlyfast-5swbh29be-apex88vents-projects.vercel.app |
| Staged preview | dpl_BbsTGmwQSzJvb7FNpVBzHnnXXK5i — READY |
| Previous production / rollback | **dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz — retained, READY** |
| Existing Vercel project | onlyfast / prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR |
| Production aliases | onlyfast.app, www.onlyfast.app, onlyfast.vercel.app, onlyfast-apex88vents-projects.vercel.app |
| New active entry | /assets/main-9F0vdsnB.js |
| New active CSS | /assets/main-ck434xXH.css |
| Reviewed checkout | main, 89bb4a5499373590e6d7131e451e90ce2f675c9e |

This was a scoped static artifact deployment, not publication of the entire checkout. The checkout contains other advertising, QA, Settings and maintenance work that was deliberately excluded. No commit or push was performed. No native binary was rebuilt or submitted.

## Exact changes deployed

The source snapshot was reconstructed from the retained Phase 2C production source. Rebuilding that baseline reproduced all 72 active production files byte-for-byte. Exactly eight runtime source files differ in the new build:

| File | Approved change |
| --- | --- |
| src/components/HowOnlyFastWorks.tsx | Consistent 12-slide card dimensions; Skip first appears on slide 6 and remains available; bottom Skip to Sign In removed; existing member sign-in preserved. |
| src/components/AppLayout.tsx | Removed only the obsolete bottom skip-label prop from the deployed baseline file. Its deployed advertising structure was retained. |
| src/components/OnboardingFlow.tsx | Reviewed discipline, class and plan progression; existing verified paid-member completion. |
| src/components/PlanSelection.tsx | Rookie, Pro and Teams selection through existing membership and purchase paths; reviewed subscription disclosures. |
| src/components/MembershipPaidAction.tsx | Existing native controls receive onboarding context; verified subscriber continuation and browser store fallback. |
| src/components/NativeSubscriptionControls.tsx | Offering availability, retry, Restore Purchases, refresh and existing-member continuation controls. |
| src/hooks/useNativeSubscription.ts | Reviewed shared subscription hook extracted from the previous controls; account and entitlement verification retained. |
| src/lib/nativePurchaseController.ts | Existing stock Median bridge with runtime package-availability checks for the two approved packages. |

All other runtime source files match the deployed baseline by checksum. No independent CSS source was changed; generated CSS reflects the approved component classes. SetupDashboard, native advertising controller, subscription authorization, native platform detection, server entitlement checks and all 59 graphics remain from the verified production baseline.

The deployment contains 81 source files: 80 public files plus the existing vercel.json packaging configuration. Active HTML/CSS/JavaScript were replaced by the reviewed build. Prior runtime chunks and CSS remain available for clients that already loaded older HTML. The staging deployment's complete source manifest matched the 81 reviewed file hashes before production deployment.

## Billing and configuration preservation

- The exact existing Android and iOS RevenueCat public SDK keys were retained from the public production artifact and used only in process-local build configuration. No keys, passwords, privileged API keys or account tokens are recorded here.
- Existing master/platform eligibility flags were preserved. No new purchasing or advertising activation was performed.
- Existing native platform detection and authoritative entitlement verification files are byte-identical to the production source baseline.
- Pro maps to $rc_monthly and Teams to $rc_custom_teams_monthly. The existing Android bridge returned both identifiers after deployment.
- Existing product/entitlement mappings and stock Median paywall remain unchanged. No RevenueCat, Google Play, App Store, pricing, entitlement, Median, database, RLS, migration or Edge Function configuration was changed.
- All 23 Vercel environment-variable metadata records matched before and after deployment. No environment-variable values were changed or decrypted through the connector. Existing domains and project were reused.

## Pre-deployment tests and interpretation

| Check | Result |
| --- | --- |
| Full primary-checkout regression suite | **631 passed, 0 failed** |
| Primary-checkout local QA smoke | **69 passed, 0 failed** |
| Exact scoped source regression suite | **613 passed, 18 failed**; all 18 reproduced with the same current test infrastructure against unchanged production source |
| Exact scoped source local QA smoke | **68 passed, 1 failed**; the same inherited legacy reset-facade expectation described below |
| TypeScript against the exact scoped build source | Passed: tsc --noEmit --project tsconfig.app.json |
| Production baseline reconstruction | Passed: 72/72 active files byte-identical |
| Scoped production build and release guard | Passed; five runtime chunks; no QA preview or experimental custom native bridge imported into production |
| Graphics checksums | All 59 unchanged |
| Built-artifact slide geometry | All 12 forward slides and 11 backward visits passed at 320x800, 390x844, 430x932 and 1440x1200 |
| Local onboarding flow | Member sign-in/cancel; Skip to discipline, vehicle, plan, Rookie completion, landing and returning profile passed using a local simulated backend |
| Subscription UI integration simulations | Android, iOS and web passed; both paid plans, cancellation, verified simulated success, missing products, retry and existing Team continuation |
| Authenticated built-artifact browser smoke | 12 checks passed against production reads; data fingerprints preserved; no provider calls or writes |
| Production authentication / read smoke before release | Configuration check passed; 7 smoke checks passed |

The scoped build intentionally excludes unrelated newer source even though the complete primary checkout passes 631 tests. The 18 scoped regression mismatches are 15 unit and 3 mounted checks: one local review-backend checkout expectation, seven newer Settings/support-wording expectations, six newer native-ad-controller expectations, one legacy QA reset-facade expectation, two newer account/advertising Settings expectations, and one Setup Assist upgrade-route expectation. Every failing test name reproduced against frozen production source; there are **zero candidate-only failures** in that comparison. No application behavior or tests were changed to suppress these failures.

Initial snapshot verification also lacked root SQL and API fixtures. They were copied into verification infrastructure only; the resulting 22 database checks pass. They were not applied, built into the frontend or uploaded. A full unchanged-baseline run was interrupted because current tests for newer purchase behavior did not complete against the older controller; the focused baseline comparison covered all 18 remaining failing checks. Evidence retains the unsuccessful initial runs as well as final results.

The legacy production QA-account reset facade still attempts its historical endpoint call. The live authenticated browser checks blocked that call before dispatch, and all other unapproved writes/provider requests were guarded. This inherited runtime was preserved rather than adding an unrelated QA-system change. No reset, fixture seeding or cleanup was requested or performed.

Browser capture initially stalled under this machine's headless GPU renderer, and measurements could catch an unfinished animation. Final browser runs used disabled headless GPU acceleration; geometry checks used the application's supported reduced-motion setting. Production mobile and desktop screenshots were subsequently captured successfully and visually inspected. No application animation code was changed. An exploratory keyboard-End scroll check did not establish a result and is not claimed as passed; it was excluded from the task-focused navigation check.

## Post-deployment production verification

- onlyfast.app resolves to the new READY production deployment and serves main-9F0vdsnB.js.
- **80/80 public URLs** returned HTTP 200 and their exact reviewed SHA-256 checksums, including active and retained JavaScript/CSS, HTML, logo, supporting files and all 59 graphics. The five advertising WebPs return image content rather than HTML.
- All 12 slides passed production geometry checks at 390x844 and 1440x1200, including backward navigation, no horizontal overflow, Skip absent on slides 1-5, present from slide 6, and the normal guest sign-in checkpoint after Skip. The authenticated simulated flow separately verified that required discipline/class/plan selections remain in sequence.
- Production phone and desktop screenshots were inspected: logo, card, artwork, typography, navigation and member sign-in are present; no bottom Skip to Sign In or premature top Skip appears.
- npm run qa:check -- --env production: **passed** using the existing external secure QA configuration and normal Supabase authentication.
- npm run qa:smoke -- --env production: **7 passed, 0 failed, 0 skipped**, including normal verified dedicated tester identity, own setup reads, authoritative Team membership, schedule/share owner isolation, invalid secure share code, OnlyLaps status-only request and token refresh.
- Guarded production browser smoke: **12 checks passed**. Existing Team recognized; saved setups visible; an owned setup loaded; timing scanner and Setup Assist chunks loaded without paid provider requests; session/setup survived reload; schedule and parts navigation worked; secure sharing viewer and an existing valid share worked; no missing JavaScript chunks or browser page errors.
- Final independent authenticated row fingerprints still match the pre-test snapshot: **18 setups, 2 shares, 0 schedule rows and 1 subscription row** for the dedicated QA account. These are read-only test-account checks, not a claim that every customer's rows were enumerated. No customer data was intentionally modified.

Evidence is in tmp/onboarding-production-deployment, including production-assets.json, production-slides.json, browser-production.json, final-evidence.json, release.json and the build/test logs. Authentication reports are referenced by the corresponding command logs. Secure credentials remain outside the repository.

## Android and iOS wrapper results

Existing Pixel 8 emulator, app.onlyfast **1.0.2 (61)**, was reloaded in place. No uninstall, application-data clear or account logout occurred.

- Existing signed-in test / Team session survived and received main-9F0vdsnB.js from production.
- All 12 replay slides passed in the actual WebView with identical card dimensions (379.43 x 765 CSS pixels); Skip was absent on slides 1-5 and present on 6-12; bottom Skip to Sign In absent. Replay Skip returned this existing user to the landing page.
- Existing native RevenueCat bridge is initialized and exposes configure, isInitialized, login, logout, getOfferings, presentPaywall and restorePurchases.
- Real getOfferings returned $rc_monthly and $rc_custom_teams_monthly; no paywall purchase or restore transaction was invoked.
- The real wrapper's /pricing page displays Rookie, Pro and Teams without Coming Soon, recognizes the existing paid account and exposes enabled Restore Purchases and Refresh subscription controls.
- Saved Setups opens with all **18** load controls present. Normal navigation returns to Home.
- An initial synthetic history/popstate probe read a transient blank route before normal navigation completed; it is retained as an unsuccessful test attempt. The final check navigated the real /pricing URL and passed. No source fix was needed.

The completed paid QA profile was not changed into a fresh Rookie or sent through account-writing onboarding. Fresh discipline/class/plan completion and existing-member continuation were exercised in the isolated fixtures; actual native checks verified the preserved paid account, catalog, controls and saved setups.

The existing iOS **1.0.2 (59)** wrapper remains compatible by the previously reviewed startup URL and stock bridge configuration, matching seven-method contract, retained iOS public SDK key/platform gates and the passing iOS UI simulations. No new iOS device session or App Store transaction was executed in this deployment task. Both wrappers load the live website; no frontend bundle or new native configuration was required. No Android or iOS rebuild was performed.

## Performance and graphics

| Active build measurement | Previous | New | Difference |
| --- | ---: | ---: | ---: |
| JavaScript chunks | 5 | 5 | 0 |
| JavaScript bytes | 1,235,327 | 1,242,726 | +7,399 |
| JavaScript gzip bytes | 339,789 | 341,681 | +1,892 |
| CSS bytes | 132,279 | 132,213 | -66 |
| CSS gzip bytes | 20,657 | 20,644 | -13 |
| Approved graphics unchanged | 59 | 59 | 0 |

The Phase 2C deferred scanner/dashboard/handling structure remains. The small JavaScript increase contains the approved onboarding and offering-state controls. Retained compatibility files increase uploaded artifact size but do not add requests to the new entry's active module graph. The normal existing large-entry build warning remains; no dependency upgrades were performed.

## Remaining limitations and rollback

- No real purchases, purchase restoration transactions, paid AI/OCR calls, live advertising activation, profile changes or account resets were performed.
- Fresh real-store Android/iOS transaction acceptance remains separate from these simulations and catalog/bridge reads. No new iOS runtime test is claimed.
- The 18 inherited scoped regression mismatches and the scoped legacy-reset smoke expectation remain; newer unrelated implementations were deliberately excluded. They are not newly introduced production regressions.
- TypeScript, build, approved-feature tests, browser/device checks and data preservation checks found no new critical regression. Rollback was not required.

For a confirmed critical frontend regression, use Vercel's production rollback on project prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR to **dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz** (team team_smopqnOs6cFIL3nxEZ7O9O7Z), then verify onlyfast.app and rerun read-only QA. The previous deployment is still READY. This action requires no database rollback, migration, native rebuild or billing configuration change. Rollback was prepared and verified as available, not executed as a test.

Work stopped after this frontend deployment and verification. No unrelated cleanup, application changes, commit, push, native submission or subsequent phase was started.
