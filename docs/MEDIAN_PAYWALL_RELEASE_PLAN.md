# OnlyFast: stock Median RevenueCat paywall release plan

Prepared locally on `codex/median-paywall-simplification`, from production main `9ae29d685bc68c265ef2c363e0943acb49573c3e`. No native source was copied from either earlier development branch. No remote configuration, deployment, purchase, restore or store submission occurred.

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

The published common JS contract provides no offering selector for `presentPaywall()`. The supplied Android 1.3.0 native bytecode has an `offeringId` branch, but this is not a verified portable Android/iOS JS contract; this release does not use it. The shortest common configuration is to make this offering current **after approval** and publish its attached paywall **after approval**. Review existing targeting/experiments before that switch so eligible users actually receive the intended offering. Do not assume an unpublished draft will be served or accept RevenueCat's fallback layout as verification.

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

1. Review this branch and paywall footer/content. Keep the public hold false while confirming both shipped Median wrappers include stock RevenueCat/RevenueCatUI with configure/isInitialized/login/logout/presentPaywall/restore support. Use one SDK owner; do not ship or invoke an earlier custom/debug adapter alongside it. If the existing release wrappers satisfy this, no custom native build is required. If not, obtain ordinary plugin-enabled Median builds; preserve authentication/photo picker, exclude QA overlays, and review signing/versioning. No source-build/hosted-macOS work is intrinsically required for this approach.
2. Under separate approval, validate the same stock-paywall path on Android internal testing and iOS TestFlight/approved device testing, with synthetic authenticated UUIDs and an isolated sandbox-accepting backend. Appetize cannot use this Windows computer's localhost directly; approve private HTTPS connectivity or another safe isolated test arrangement before attempting end-to-end sandbox access. Keep production `REVENUECAT_ALLOW_SANDBOX=false`; never route sandbox access into production subscriber records. Future purchase/restore tests require explicit approval and must not repeat the earlier purchase merely for diagnostics.
3. With readiness holds still in place and after explicit configuration approval, fix/verify footer destinations/restore visibility, publish paywall `pw3a65004212ef4af8`, and make `onlyfast_monthly_v1` current, reviewing targeting and effects on older clients. Preserve existing product/entitlement attachments and record the previous current offering for rollback. No new offering or paywall is needed.
4. After native callback/identity/pending/cancel/restore, localized-term and server-sync acceptance passes on both platforms, separately approve the web activation release: correct public platform keys + existing enable flag + reviewed change to the public readiness constant. Deploy only reviewed web changes; ordinary web purchases remain Stripe. Submit/release native/store changes only if separately needed and approved. Rookie remains free throughout.
5. Smoke-check free and existing paid access and stop on regressions. Roll back the frontend enable flag/web release to re-establish the hold; revert the offering/paywall configuration only under approved configuration rollback. Do not roll back subscription rows, entitlements, migrations or existing Stripe billing. Keep prior branches/backups until the replacement is verified.

Current status: ready for review of the simplified implementation, **not ready for public activation**. Remaining gates are the footer checks, both stock native paywall acceptance tests, isolated iOS sandbox connectivity, store readiness/approval and explicit configuration/activation approval. No live service was changed.
