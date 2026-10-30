# OnlyFast: stock Median RevenueCat paywall release plan

**October 30 public-launch authorization:** the owner explicitly authorized production
activation/deployment. Source readiness is now true, with the master
`VITE_REVENUECAT_ENABLED` and independent `VITE_REVENUECAT_ANDROID_ENABLED` /
`VITE_REVENUECAT_IOS_ENABLED` build gates. Android is enabled; iOS remains gated until
its Apple submission/reviewer readiness is resolved. The owner already made
`onlyfast_monthly_v1` current; do not switch it again. Third-party AdMob remains off
until mandatory consent/privacy requirements pass; Rookie house promotions remain.
No customer purchase, membership row, Stripe path or backend authorization was changed.
Earlier preparation/hold observations below are historical, not a renewed approval requirement.

Prepared locally on `codex/median-paywall-simplification`, from production main `9ae29d685bc68c265ef2c363e0943acb49573c3e`. No native source was copied from either earlier development branch. No remote configuration, deployment, purchase, restore or store submission occurred.

**Preparation update (October 18):** the Terms page is now implemented locally using the unchanged shared agreement. A separate stock-controller QA entry and offline local sync preparer are ready with store actions disabled. [The current sandbox procedure](../qa/median-paywall/README.md) uses a **per-customer offering override**, keeping the global `default` unchanged. It supersedes the earlier global-switch testing sequence and missing-QA-entry observations retained below. The public Terms URL still requires approved deployment, and no paywall link/override/publication was changed.

## Decision

Use the existing `NativePurchaseController` and Median's documented `presentPaywall()` on both Android and iOS. RevenueCatUI owns the package selector, localized prices, eligible offers and store transaction. OnlyFast retains authenticated identity, serialization/account-switch protection and server-side synchronization. A custom native catalog/price bridge is unnecessary for this revised requirement.

This is a supported implementation path, **not a claim that this particular unpublished paywall has rendered or completed a transaction in both release wrappers**. No old inspector/Android emulator diagnostics or purchases were repeated. The earlier Android custom-bridge purchase proves the backend path, not the stock paywall's callbacks or iOS StoreKit behavior.

Official references: [Median RevenueCat](https://docs.median.co/docs/revenue-cat), [Median JS implementation](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/plugins/revenueCat.ts), [Median response types](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/types/revenueCat.ts), [RevenueCat paywall presentation](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls).

## Read-only RevenueCat audit

Project `proj79983fe3`. Offering [`onlyfast_monthly_v1`](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings/ofrng35794ca3b5), ID `ofrng35794ca3b5`, is active, **not current**. Attached [paywall](https://app.revenuecat.com/projects/79983fe3/paywalls/pw3a65004212ef4af8/builder) `pw3a65004212ef4af8` has draft revision 3 and **published_at: null**. Neither state was changed. Metadata still describes staging; metadata does not select an offering or authorize purchases.

| Plan | Package | Android product | iOS product | Entitlements |
| --- | --- | --- | --- | --- |
| Pro | `$rc_monthly` | `pro:pro` | `app.onlyfast.pro.monthly` | `OnlyFast Pro` |
| Teams | `$rc_custom_teams_monthly` | `teams:teams` | `app.onlyfast.teams.monthly` | `OnlyFast Teams` and `OnlyFast Pro` |

The packages each also retain their existing Test Store product; those products were not detached. Backend store/app allowlisting and production sandbox rejection remain unchanged. Teams granting both entitlements is intentional: the server mapper gives Teams precedence. No entitlement remapping is needed.

Expanded draft configuration confirms separate Pro and Teams package components, Pro selected by default, a RevenueCat purchase button, a close action, restore action, privacy link and Terms control. Prices/renewal wording bind to `product.price`, `product.price_per_period` and related store variables. Trial text is conditional on intro-offer state and uses the returned offer period; the catalog's null trial fields do not establish device eligibility. The static render showed both plan cards and a purchase CTA. Its USD values are preview data, not proof of localized device prices or trial eligibility.

Before publishing, resolve two footer checks: the Terms control has `destination: terms` without an explicit URL in the returned configuration; verify/configure the approved legal destination. OnlyFast currently exposes Terms through its existing modal, so do not invent a public Terms URL. The restore action exists in configuration but its text was absent in the static no-offer render; verify visibility and usability in the actual native paywall before release. Privacy points to `https://onlyfast.app/privacy-policy`. No draft was edited remotely during this task.

The published common JS contract provides no offering selector for `presentPaywall()`. The supplied Android 1.3.0 native bytecode has an `offeringId` branch, but this is not a verified portable Android/iOS JS contract; this release does not use it. [RevenueCat's documented customer override](https://www.revenuecat.com/docs/tools/paywalls/testing-paywalls#3-override-a-customers-default-offering) supplies this offering as only the designated tester's current offering **after approval**, without changing the global default. Publish its attached paywall **after approval**. Do not assume an unpublished draft will be served or accept RevenueCat's fallback layout as verification.

## Application changes and preserved boundaries

- Reuse the production controller, bridge lookup and UI; no new runtime dependency, SDK wrapper or native code.
- Remove the redundant `getOfferings()` preflight and its required-method/type entry. RevenueCatUI already loads its offering. The supplied Android callback sends identifiers without the `success` field required by the old preflight, so that redundant check could reject a valid response.
- Remove the optional cancellation callback scaffold and use the native paywall result. Recognize Android's message-only `User cancelled` response as cancellation, for resolved and rejected callbacks. Existing coded pending/error handling remains.
- Require a UUID-shaped account ID and add an account revision guard, including A → B → A. Keep queued native identity changes, API-key mismatch rejection, one active store request and timeout protection. SDK identity comes from the authenticated Supabase session, not editable profile metadata, a URL or localStorage. UUID syntax is defense in depth; actual authentication remains the existing verified Supabase flow.
- A native card opens the full Pro/Teams paywall, so it uses the existing generic label instead of implying that a specific plan was already selected. Remove the web card's specific trial-duration claim; actual eligible terms are shown before purchase. Existing designs and free onboarding remain.
- Preserve `NativeSubscriptionControls`: recheck paid access before opening an offer, block duplicate billing for existing paid accounts, invoke `sync-revenuecat-subscription` after native completion, then reload authoritative membership. A native success alone never unlocks access. Cancellation, pending and failure cannot confirm a purchase. Native restoration remains an explicit held action, never an automatic login step.
- Preserve existing subscriber refresh/resume/expiration, trusted membership and authorization, Stripe checkout/portal/webhook, promotional/admin grants, Rookie limits, saved setups, disciplines/classes, sessions, schedule, Setup Assist, authentication and photo-picker code.

`NATIVE_PURCHASES_READY=false` remains a compile-time public hold. `VITE_REVENUECAT_ENABLED=true` alone cannot activate it. Purchase and restore buttons remain disabled/Coming Soon; no new bypass/tester route or alternate purchase entry point was added. Existing RevenueCat members can still refresh access while purchasing is held. Web upgrade billing still uses Stripe.

Client keys, when eventually enabled, use existing `VITE_REVENUECAT_ANDROID_API_KEY` and `VITE_REVENUECAT_IOS_API_KEY` with the corresponding public keys. Existing `VITE_REVENUECAT_ENABLED` remains subordinate to the hold. No key was added, printed or changed here. No secret REST or service-role key belongs in Vite/native code. No Supabase migration/function deployment is required for this frontend simplification; historical pending-migration checklists are not deployment instructions for this change.

## Cleanup scope

Previous branches/worktrees, separate downloaded Android source, ignored local environments, credentials and QA evidence were preserved. There are no tracked custom adapters or native diagnostic routes in production main to delete. Starting from main removes them from the proposed release by exclusion, rather than deleting their backups or merging either development branch. The redundant production preflight/callback code above was actually removed; no tracked file was deleted.

| Earlier work reviewed | Final release decision |
| --- | --- |
| `src/lib/releaseNativeBilling.ts`, `releaseNativeTransport.ts` | Exclude the competing controller, catalog cache and custom message transport. |
| `native/android/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt` | Exclude custom SDK ownership, named catalog, product serializer and transaction adapter. |
| `native/ios/OnlyFastBilling.swift`, protocol/registration/preparation code | Exclude custom Swift bridge and source patches; private macOS CI is unnecessary for this stock-plugin route. |
| `native/android/qa/*`, release/source snapshots, iOS CI workflow and validator, `scripts/prepare-*ios*`, source inspection/preparation scripts | Exclude from release; preserve as historical QA/source evidence. |
| Native custom-bridge/source-preparation tests | Exclude tests for implementations absent from this release; retain stock-flow/backend/security regressions. |
| Native release/compilation/runtime investigation reports | Preserve on the earlier branch; this plan supersedes their custom-build requirement. |
| `NativeSubscriptionTest.tsx`, `nativeCatalogDiagnostic.ts`, `nativeSandboxPolicy.ts`, diagnostic Vite/build helpers and tests on onboarding preparation branch | Exclude from production; preserve local synthetic test access and evidence. |
| `supabase/staging/*`, baseline/preparation/local database test tools | Preserve on their existing branch; not obsolete merely because purchase UI changed, and not production release inputs. |
| Earlier native changes to shared controls/plan selection/readiness tests | Do not import wholesale; use main's existing stock path with only the small changes listed above. |
| Dependencies / duplicate legacy files elsewhere in repository | No RevenueCat SDK dependency was added to the web package; no package/lockfile change is necessary. Unrelated legacy files are outside this cleanup. |

Core custom files avoided: 135-line release controller + 41-line transport + 226-line Android adapter + 378-line Swift adapter = **780 lines**, before QA, CI, documentation and source-preparation helpers. The previous native branch as a whole adds 3,514 and removes 239 lines relative to main; those are historical branch totals, not lines physically deleted by this cleanup. Four production files change here, primarily safety fixes; their net line count is slightly higher than main. Runtime dependency reduction versus main: **zero** (none had been added). No exaggerated deletion/bundle-saving claim is made.

## Validation

- `npm test`: **364 passed**, zero failed/skipped. Covers subscription mapping/trials/expiry, backend auth, duplicate/out-of-order events, account switching, plans, setup/session/schedule/Setup Assist and picker lifecycle regressions.
- Mounted/native UI + onboarding + Setup Assist + all four disposable PostgreSQL suites: **66 passed**, zero failed/skipped. Purchase-success tests require server-confirmed Pro/Teams; cancel/pending/error stay Rookie; paid Stripe recheck blocks another paywall. SQL also verifies onboarding persistence, RLS and setup save/reopen/copy/share. It uses PGlite in memory, no cloud database or customer data. Total across unit and integration runs: **430 passed**.
- `tsc -p tsconfig.app.json --noEmit` and `tsc -p tsconfig.node.json --noEmit`: passed. Production Vite build: passed (14.48 seconds), with existing large-chunk warning.
- Changed production files and controller tests: ESLint passed. Full `npm run lint`: **419 errors / 92 warnings**, matching the unchanged main source exactly. The modified membership selection test retains two pre-existing `any` lint errors; its only content change updates the trial-copy assertion. Unrelated lint debt was not rewritten.
- `git diff --check`: passed. Backend, Stripe, app routes, dependency manifests and lockfile are unchanged.

Isolated temporary test dependencies live only under ignored `tmp/test-deps`; they are not package/lockfile or release inputs. These checks use mocked native callbacks and synthetic/in-memory state. They do not establish device paywall rendering, iOS StoreKit purchase/restore, trial eligibility, production configuration correctness or end-to-end store readiness.

## Single Android/iOS launch procedure — approval required

1. Approve/establish the isolated QA entry point before any store action: reuse the stock controller in a QA-only web bundle, require the existing server-authorized synthetic local tester, and connect only to local sandbox-accepting Supabase. Production `NATIVE_PURCHASES_READY=false` stays unchanged. The production buttons cannot serve as this entry point: the environment flag alone cannot bypass the hold, and this branch intentionally contains no tester bypass. For iOS approve a secured HTTPS route to that isolated environment plus a designated iPhone/TestFlight tester; Appetize alone cannot complete real StoreKit acceptance and cannot reach Windows localhost. Do not expose database ports, Studio, operator endpoints or credentials. Any necessary ordinary plugin-enabled internal/TestFlight build or upload needs explicit approval; no custom native bridge is required. Reuse compatible existing Median wrappers, with one SDK owner and no custom/debug adapter or QA overlay in production.
2. Approve the legal destination and required draft correction. The existing modal is not a standalone Terms URL; provide the approved public OnlyFast Terms address or separately approve exposing the existing Terms content through a public route. Verify the privacy link and Restore visibility. No legal text or destination is invented by this plan.
3. After explicit configuration approval, publish paywall `pw3a65004212ef4af8`, then make `onlyfast_monthly_v1` current, with the public hold still false and targeting/experiment checks clear. This ordering makes the configured stock paywall available before its acceptance test; do not expect an unpublished draft from the ordinary stock presentation API. Preserve product/entitlement attachments. Record previous current offering `default` (`ofrng9c4268b9bb`) for rollback. No new offering or paywall is needed.
4. Under a separately approved sandbox transaction/restore scope, run Android Play license/internal testing and iOS TestFlight/device acceptance through that QA entry point. Check authenticated UUID before presentation, both selectable packages/localized terms, close/cancel/pending/error, successful transaction → RevenueCat → local sync → server-confirmed membership, restore, switching, expiration and existing Stripe/Rookie access. Keep production `REVENUECAT_ALLOW_SANDBOX=false`; never synchronize sandbox access into production subscriber records. Do not repeat the earlier purchase merely for diagnostics. After both platforms pass, separately approve the web activation release: correct public platform keys + existing enable flag + reviewed change to the public readiness constant, then reviewed deployment/store releases as needed. Ordinary web purchases remain Stripe; Rookie remains free.
5. Smoke-check free and existing paid access and stop on regressions. Roll back the frontend enable flag/web release to re-establish the hold; revert the offering/paywall configuration only under approved configuration rollback. Do not roll back subscription rows, entitlements, migrations or existing Stripe billing. Keep prior branches/backups until the replacement is verified.

Current status: ready for review of the simplified implementation, **not ready for public activation**. Remaining gates are the footer checks, both stock native paywall acceptance tests, isolated iOS sandbox connectivity, store readiness/approval and explicit configuration/activation approval. No live service was changed.

## Final readiness check — October 18, 2026 (Pacific)

Read-only configuration recheck: draft revision 3 remains unpublished; the named offering remains non-current; `default` is current. No targeting rules or running experiments were returned. Pro/Teams package/product/entitlement mappings remain correct, with both store apps registered as `app.onlyfast` and their RevenueCat credential-configured indicators true. Privacy is configured to the existing `/privacy-policy` route, and the public destination returned HTTP 200. Terms still lacks an explicit destination URL. Restore has a real `restore_purchases` action, but its operation is **not** confirmed without a permitted native restore test.

Android's preserved 1.3.0 manager bytecode implements configure/login/logout/paywall/restore. The verified iOS 1.1.2 package manifest links both RevenueCat and RevenueCatUI, resolved SDK 5.96.0; Median documents the shared paywall method for both platforms. This establishes the supported route, not successful presentation/callbacks in a particular shipped iOS binary. Those are acceptance checks, not a reason to rebuild the custom adapter. No inspector, emulator diagnostic, native build or purchase/restore was run for this review.

Reviewed all four production files in `a80cd0bd`: controller identity/cancellation safeguards; stock bridge lookup/public hold/server sync; generic native membership action with unchanged Stripe branch; plan text with unchanged free/Coming Soon controls. The existing controls verify the authenticated session, await configure/login with its UUID, await the paywall result, call the authenticated `sync-revenuecat-subscription` endpoint and reload server membership. This is source/test verification, not a new native transaction claim. Custom bridges/routes/dependencies and backend modifications remain excluded. One optional unused customization remains: `NativeSubscriptionControls.purchaseLabel` has no caller override after simplification. It is harmless and does not block acceptance; no further refactor was performed. Previous 430 passing test results remain the evidence; they were not rerun.

The outstanding approvals are therefore concrete: isolated tester-only QA access/networking and any needed ordinary test-build distribution; the approved Terms destination/draft correction; paywall publication; current-offering switch; a specifically scoped sandbox purchase/restore acceptance run; and, only after acceptance, public activation/deployment. None was executed by this review.
