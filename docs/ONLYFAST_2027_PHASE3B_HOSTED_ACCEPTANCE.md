# OnlyFast 2027 Phase 3B — hosted acceptance

Verified November 15, 2026 UTC. Launch target remains **January 1, 2027, 12:00 AM Pacific (`2027-01-01T08:00:00Z`)**.

**Result: hosted application/database fixture acceptance passed within the scopes below. Real provider and native purchase acceptance remains blocked. Live purchases are disabled.** Successful future-date promotional HTTP claims have not been certified against the current real calendar; that distinction is intentional.

## Deployment and database identity

| Item | Verified result |
| --- | --- |
| Repository/branch | `Apex88Vent/onlyfast`, `develop/onlyfast-2027` |
| Deployed source commit | `81d5732c4c103394e9754b93bb07404e4a867eb9` |
| Preview | [onlyfast-j6ayn0su8-apex88vents-projects.vercel.app](https://onlyfast-j6ayn0su8-apex88vents-projects.vercel.app), `READY` |
| Preview deployment | `dpl_5HfKxai5iU23YQ3YV9zdZxY9VWDQ`; Preview only, no promotion |
| Testing Supabase | `mfzajhnfonrfuiwxgvhe`, organization `wxswxtsewczfijycqnwi`, `ACTIVE_HEALTHY`; explicit testing account connector only |
| Original Phase 3B migration | `onlyfast_2027_phase3b_subscriptions_testing`, version **`20261115052857`**, installed and verified; **not reapplied** |
| Verification SQL | **12/12 passed**, including the project identity result |
| Retention | **16/16 UTC count/hash pairs matched** before/after the compatibility repair and again after hosted fixture cleanup |
| Provider operations | No RevenueCat, Stripe, Apple or Google product/subscription changes; no purchase, charge, refund or price schedule invoked |

Preview environment metadata confirms all three public testing variables are scoped to Preview and the exact development branch. The client points to the testing project. Vite's native purchase/advertising holds and the testing CSP remain intact. Two deployment-scoped one-hour access links were generated; browser acceptance used the latest deployment's link. Cleanup revoked that link; Vercel reported that the earlier link no longer existed. No project-wide protection setting was disabled. Browser reports exclude authorization headers, passwords, tokens and share-link query values.

The Phase 3B code and audit artifacts were committed in `2999e6e3`; the compatibility repair below is `81d5732c`. Only the Phase 3B file list was staged/pushed. Concurrent Track Trace work was left unstaged.

## Compatibility issue found and repaired

Hosted contract review found that Phase 3B's `get_onlyfast_2027_account_access()` response renamed the Phase 2 `selection_required`/`counts` fields and omitted `active_class`. The existing downgrade screen consumes the original fields. Database locks still denied writes, but the class-choice prompt could remain hidden.

The locally validated forward-only repair restores all original fields alongside the new aliases, with identical values. It changes only the response helper, preserving effective downgrade detection and every racing row.

| Repair | Evidence |
| --- | --- |
| SQL artifact | `supabase/testing-2027/phase3b-account-access-compatibility.sql` |
| Migration | `onlyfast_2027_phase3b_account_access_compatibility` |
| Installed version | **`20261115054325`** |
| SHA-256 | `64274CDE09074A15F85628DB014A0797DBF0D70943CA48E1E71CF3752836D03B` |
| Guards | Exact testing project and expected installed function source fingerprint |
| Validation | 16 targeted local tests passed; hosted downgrade class-choice and archive regression passed; all 16 retention aggregates unchanged |

The already-installed Phase 3B installation file and its manifest were not rewritten or executed again.

## Exact acceptance results

These groups have different evidence boundaries and must not be presented as interchangeable end-to-end provider tests.

| Group | Result | Evidence boundary |
| --- | --- | --- |
| Real hosted browser/API | **7 passed** | Actual Preview, testing Auth, installed RPCs and deployed claim function; existing synthetic accounts |
| Hosted interface with recorded synthetic state | **8 passed** | Actual deployed React interface; billing-status responses replay sanitized snapshots produced by the hosted rollback test |
| Hosted database future-date fixtures | **16 passed** | Actual installed PostgreSQL functions/roles, synthetic provider state and future clock inside a rollback-only subtransaction |
| Phase 2 hosted browser/API recheck | **13 passed** | Actual archive, class, quota and Track Trace permission APIs/UI; original account states restored |
| Local complete regression | **707 passed, 0 failed, 0 skipped** | Current checkout, including concurrent uncommitted Track Trace tests |
| Targeted Phase 3B regression | **16 passed** | Includes the restored Phase 2 response-field contract |
| GitHub Actions | **670 passed** | Committed branch: 10 native sandbox tests plus 660 application/database tests; both TypeScript projects and Preview build passed |

GitHub validation: [successful run 43682324078](https://github.com/Apex88Vent/onlyfast/actions/runs/43682324078). The difference between 707 local and 670 CI cases is the concurrent uncommitted Track Trace test work deliberately excluded from the Phase 3B commit. That work was not discarded or overwritten.

### Seven real hosted checks

1. Four existing synthetic identities log in successfully and receive their own sanitized billing projections.
2. The current prelaunch calendar hides the promotional claim; a direct SQL claim returns `CLAIM_WINDOW_CLOSED`, the authenticated HTTP route returns 409, and no grant is created.
3. The deployed claim route returns 401 for missing/forged authentication.
4. Browser users cannot read private billing ledgers, obtain the server registry, apply provider snapshots, escalate a non-tester tier, or query another user's tier.
5. Desktop 1440px Preview shows correct prices, featured Pro, explicit annual selection and disabled purchase buttons.
6. Mobile 390px Preview shows the same terms without horizontal overflow; no real purchase controls activate.
7. Actual Pro sign-out followed by unprivileged sign-in clears the paid display and shows historical read-only status.

The real browser/API runner reported zero unexpected external requests and zero page errors. Only the exact Preview and testing Supabase were permitted; font requests were blocked without allowing provider/payment traffic.

### Eight recorded-state interface checks

The actual hosted interface displayed monthly Pro trial, annual Pro trial, canceled trial retaining access, expired trial/read-only, legacy Teams→Factory, grandfathered Pro, paid Pro after protection ends, and the Rookie→Sportsman claim flow with duplicate-click suppression.

These use response fixtures recorded from the installed testing database's rollback assertions. User authentication remains real, but billing-status and promotional-success responses are intercepted for these display cases. **They do not certify a live provider receipt or a real-date successful HTTP claim.** No intercepted response was used to write racing data or authorize a real purchase.

### Sixteen hosted database checks

The rollback harness verifies eligibility with prelaunch evidence and rejection without it; a single exact 720-hour Sportsman grant; eight idempotent retries; no provider subscription created by the promotion; Sportsman recording denial; expiration to read-only; rejection exactly at the January 31 cutoff; acceptance at the final preceding microsecond; monthly/annual 14-day Pro state and recording access; cancellation without early access loss; callback deduplication; expiry without a callback; provider-specific legacy Pro pricing; Teams→Factory with provider overlap; effective downgrade/class-choice response compatibility; paid access surviving the January 2028 protection boundary; and browser/cross-account authorization denial. Related assertions are grouped into 16 named checks in the result file.

For future-date scenarios, the harness substitutes the clock and fixtures **only within a handled PostgreSQL subtransaction**, then explicitly rolls it back before returning the assertions and sanitized snapshots. It asserts that the original clock function source is restored. Other sessions never receive a committed future clock. Final catalog checks confirm:

- Registry rows: **12**, with no synthetic acquisition rows left behind.
- Promotional claims: **0**; provider states: **0**; provider event rows: **0**.
- Clock source MD5 remains `9e2b8dd937e2424c5910f2ee2f12da82` (the normal server clock).

Eight retries in this harness are sequential transaction calls. Successful multi-connection promotional claim races through the real HTTP route remain unverified while the real claim window is closed. No global clock or permanent test bypass was installed to make those requests pass.

### Thirteen Phase 2 hosted rechecks

Passed: Sportsman normal login and slot counters; archive cancellation/confirmation/slot recovery; gray locked archived cards and content/restoration denial; whole-weekend slot recovery and sixth-slot rejection; Pro archive restoration; Factory mobile restoration; Factory downgrade class choice and excess-quota read-only behavior; Sportsman 48-hour viewability/editor lock; eligible historical lap/sector/analysis/sample reads with mutation denial; unsubscribed read-only mode; archived linked-history restrictions with independent history preservation; Pro/Factory archived history access with recording/linking denial; and cross-account setup/telemetry/context/tier security.

Only a newly created tagged fixture weekend was backdated for the 48-hour case. Its setup and timing fixtures were removed afterward. One new tagged map required exact ID/owner/name cleanup through the verified testing connector after confirming it had no timing-session references. Original archives and test tiers were restored. All 16 original public-data retention fingerprints then matched exactly, including `race_setups`, session/result/telemetry tables and `user_subscriptions`.

## Testing function configuration

`claim-2027-sportsman-trial` is deployed in testing, version **1**, `ACTIVE`. Its non-secret deployment profile enables this route's sandbox/testing flags; the shared guard still requires the exact testing project URL. Gateway JWT verification is off because the handler independently validates the bearer session with Supabase `auth.getUser()` before invoking the authenticated own-account claim RPC. Hosted 401/409 cases verify that boundary. It requires no billing-provider credentials and cannot initiate payment.

The user confirmed that approved provider sandbox credentials are **not configured**. Accordingly `billing-2027-sync`, `billing-2027-revenuecat-webhook`, `billing-2027-stripe-webhook` and `billing-2027-reconcile` were not enabled/deployed as functioning provider routes. No live secret was copied and no substitute live account was used. The existing `track-trace-setup-context` function was left unchanged.

## Advisors and isolation

Security advisors still report **0 errors, 14 warnings**, plus 20 informational RLS-without-policy findings:

- 13 warnings concern authenticated execution of existing exposed SECURITY DEFINER RPCs. Tested authorization boundaries deny browser grant manufacture and cross-account access, but the exposure warnings remain for review. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- 1 warning is disabled leaked-password protection. No Auth configuration was silently changed. [Password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Private billing tables intentionally have RLS and no browser policies/grants. [RLS informational finding](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

Production deployment remained `dpl_8NFvGedoKHaMQXRpbqmqgAy11yte`, source `main` at `46f7552adb51dae89bd9d9616be646e39f232c44`, unchanged before/after this task. No production deployment/promotion, production Supabase connection, Primary connector, main-branch write, production environment-variable change, live provider change, or standalone OnlyLaps operation occurred. Every database write in this acceptance task targeted the explicit testing project.

## Evidence and remaining blockers

Reproducible runners: `qa/automation/phase3b-hosted-acceptance.mjs`, `qa/automation/phase3b-hosted-transactions.sql`, and the existing `qa/automation/phase2-hosted-acceptance.mjs`. Local evidence is in `tmp/phase3b-hosted-browser/report.json`, `tmp/phase3b-hosted-transactions.json` and `tmp/phase2-hosted-browser/report.json`; screenshots are synthetic account UI evidence and contain no payment credentials.

Remaining blockers:

1. Approved sandbox credentials and provider-function configuration are absent. Actual RevenueCat/Stripe server reconciliation, signed callbacks, store eligibility and provider-managed trial conversion remain unverified.
2. Apple agreement/authorization, real new product IDs, annual duration, 14-day offers, subscription groups and installed Median binary compatibility still require the previously documented review. No offering/product publication or purchase activation was performed.
3. Positive promotional HTTP claim persistence, duplicate races and expiry across real requests require the real claim window or a separately reviewed per-account acceptance-clock mechanism. This run validates the future engine in rollback transactions and the display through recorded state, not a permanent time bypass.
4. Automatic account transfers remain quarantined, Stripe risk-event/grace policy remains a release decision, and incomplete grandfathering evidence still requires provider-aware reconciliation.
5. The 14 advisor warnings remain documented; no blanket security-clearance claim is made.

The January 1 launch target is unchanged. Hosted fixture acceptance and production billing readiness are separate gates; **do not enable live purchases or declare full provider acceptance complete from this report**.
