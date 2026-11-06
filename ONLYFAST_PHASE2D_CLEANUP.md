# OnlyFast Phase 2D — conservative maintenance cleanup

Completed locally November 5, 2026 (PST). **All seven baseline failures are resolved: 616 passed, 0 failed, 0 skipped.** Local QA smoke passes 69/69, both TypeScript checks pass, and the production-mode build passes. The before/after builds and the fresh-install build have **73/73 identical file hashes**. No application behavior was changed to make a test pass.

**No commit, push, deployment, dependency upgrade, production database operation, billing/ad activation, historical-file deletion or cache removal occurred.**

## Baseline and preserved work

Read the code audit, Phase 1 security/readiness/production records, Phase 2A/2B optimization and graphics deployment reports, and Phase 2C performance/deployment reports. Historical readiness statements were interpreted using the later completed release records, not used to restart a release.

The connected Vercel project confirms production remains **dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz**, READY, before and after cleanup. Its existing 74-file publication, five active runtime chunks plus two compatibility JS files, Phase 1 protections, 59 graphics and stylesheet were not redeployed or changed.

Used the primary checkout on `main`, HEAD `3e5440947c8f20d13800f690c8f1aeb0249ac6a8`, remote `Apex88Vent/onlyfast`. Fetch showed HEAD and origin/main aligned (0/0). No branch or worktree was created or switched.

Saved the **64 pre-existing uncommitted files** with hashes and recovery copies under `tmp/phase2d/before`. Of those, **62 remain byte-identical**. Only `SetupDashboard.tsx` and `onboardingNavigation.mjs` received the additional Phase 2D changes described below; their pre-existing Phase 2C changes remain intact. The 54 modified graphics, previous reports, AppLayout changes, deferred-loading implementation and existing new tests were preserved.

The primary checkout contains previously preserved work outside the isolated production release. Build comparisons below compare this checkout **before and after cleanup**, not a new production release artifact. No production QA account, provider, purchase or ad test was run during Phase 2D.

## Every source/test file modified

| File | Minor correction | Reference and side-effect assessment |
|---|---|---|
| `src/components/SetupDashboard.tsx` | Removed the unused `PendingSave` type import, unused `WeekendPreview` interface and its otherwise-unreferenced `WeekendSessionStatus` alias. | Reference search and TypeScript unused diagnostics confirmed their scope. These are erased types; remaining queue value imports and every function/hook remain unchanged. Before/after emitted JS, CSS, HTML and assets are identical. |
| `tests/iosReleaseBridge.test.ts` | Removed the historical Swift suite's unrelated assertion that the selected stock controller's `NATIVE_PURCHASES_READY` flag must be false; removed that now-unused import and clarified the test name/comment. | `native/README.md` explicitly separates the preserved custom adapter from the selected stock Median implementation. Existing stock readiness/platform-gating tests already expect readiness true with independent rollout holds. **All Swift transaction-hold, ownership, identity invalidation, main-frame, Auth and SDK-boundary assertions remain.** No native or billing source changed. |
| `tests/nativeAdSettings.mjs` | Replaced the obsolete browser `used_count` quota mock/expectation with a mocked authoritative Edge HTTP 429. Assert saved-session/request IDs, quota notice, absence of a dismissible successful answer and no extra ad. | Phase 1 intentionally sends retries to server-owned quota enforcement. An Edge invocation is not a paid provider call. The former “no invocation when local count is one” assertion described an obsolete client gate. Cooldown, generation, dismissal and changed-owner assertions remain. |
| `tests/onboardingNavigation.mjs` | Added missing house-ad exports/slot mocks, ad eligibility stub and a stable closed house-ad external-store snapshot/subscription. | The real AppLayout gained these dependencies before this task. Onboarding fixtures do not exercise ads; advertising has its own suites. The stable snapshot matches `useSyncExternalStore`'s contract. Existing auth, class, plan, navigation and account-isolation assertions were not relaxed. The prior deferred-dashboard stub was preserved. |
| `tests/setupAssistTrackUpdates.mjs` | Supplied the missing house-ad plans-path export; corrected obsolete iOS-only interstitial expectations; supplied Phase 1 saved-session identity in two Assist fixtures and asserted request identity. | The plans-path mock reads the actual exported string declaration and asserts `/pricing`. Existing inline platform pricing, `/upgrade` route and external-payment-state assertions remain. Full-screen Continue/details navigation is checked on web, Android and iOS simulations. Road-map/What If payload and failure assertions remain. No ad, pricing, racing or Assist implementation changed. |
| `ONLYFAST_PHASE2D_CLEANUP.md` | Added this report. | Documentation only. |

New ignored support scripts/evidence are contained in `tmp/phase2d`: `prepare.mjs`, `evidence.mjs`, `build.mjs`, `cache-review.mjs`, `verify.mjs`, snapshots, logs, TAP, JSON manifests and build outputs. They are not application imports or deployment files. No other repository source/configuration file was modified by this pass.

## The seven failures and their resolutions

| Baseline failure | Verified cause | Resolution/result |
|---|---|---|
| Swift security/SDK boundary | Coupled the inactive custom Swift adapter to the active stock controller's readiness flag. The custom adapter itself still has `transactionsEnabled = false`. | Separate the contracts; keep every custom-adapter security/hold assertion and the existing active-controller gating tests. Passed. |
| Assist answer/ad lifecycle and usage limit | Expected an obsolete browser count to prevent the server request. | Mock server rejection, verify the session/request contract and preserve the no-ad/error checks. Passed. |
| Onboarding mounted suite bootstrap | Missing `HouseAdPlacement` and related current AppLayout dependencies prevented the suite from starting. | Complete only those dependency mocks. The previously blocked onboarding cases now execute. Passed. |
| Inline house-ad footprint | Missing `HOUSE_AD_PLANS_PATH` dependency, unrelated to the footprint assertion. | Supply the actual named constant; retain every placement/tone/fixed-height/loading-space assertion. Passed. |
| Inline upgrade/native Continue behavior | Missing dependency followed by obsolete expectation that iOS post-save content is only a Continue button. | Retain inline pricing/navigation checks and verify the existing full-screen Continue/details controls across all three platform fixtures. Passed. |
| Two What If CTAs / shared panel / failure handling | Fixture omitted the saved-session ID now required before sending an Assist request. | Supply an isolated fixture ID, assert it reaches the request with a generated request ID; retain duplicate-panel, no-automatic-request, answer-formatting and missing-token assertions. Passed. |
| Road-map selection payload | Same missing saved-session identity meant no request existed to inspect. | Supply the fixture ID; retain exact speed/phase-key payload comparisons and What If assertions. Passed. |

**Remaining failures: none in the executed full local regression suite.** No test was skipped, disabled, removed from the runner, changed to unconditional success or made to accept a product defect. The passing count grew by more than seven because the formerly blocked onboarding file now runs its individual cases: total reported cases increased from **572 to 616**.

## Test and build results

| Check | Result |
|---|---|
| Fresh baseline `npm run qa:regression` | 565 passed / 7 failed / 0 skipped |
| Focused historical native, ad/Assist and onboarding suites after harness corrections | 65 passed / 0 failed / 0 skipped |
| Final `npm run qa:regression` | **616 passed / 0 failed / 0 skipped** |
| Unit / mounted / disposable database breakdown | **525 / 69 / 22 passed**, all zero failures |
| `npm run qa:smoke` (local) | **69 passed / 0 failed / 0 skipped** |
| `npx tsc -p tsconfig.app.json --noEmit` | Passed |
| `npx tsc -p tsconfig.node.json --noEmit` | Passed |
| Vite production-mode build before/after | Both passed; **73 files / 16,442,066 bytes**, exact matching SHA-256s for every file |
| Clean-install production build | Passed; **73/73 files match** the primary checkout output exactly |
| Dependency manifests | `package.json` and `package-lock.json` unchanged |
| Whitespace | `git diff --check` passed |
| Production release identifier | Unchanged, READY |

Builds use the existing Vite configuration and installed dependencies, production mode and `VERCEL_ENV=production`, with separate scratch output directories. No production environment values were pulled or changed. The existing >500 KB chunk warning remains; it is not a new build failure and no further performance work was undertaken.

Local unit/mounted fixtures and disposable database engines do not certify physical Median devices, live Auth, provider behavior, advertising, purchases or installed wrappers. No such claim is made. The emitted-file equality is the direct evidence that the small type cleanup introduces no JS/CSS/asset/UI change under the same build conditions.

## Committed package cache: evidence and recommendation

Git tracks **18,954 `.pnpm-store` files**, totaling **206,623,716 bytes** of logical working-tree file contents. This is not a measurement of compressed Git pack size or browser transfer. The cache was not removed, untracked or rewritten.

An isolated clean-install experiment copied 734 project files, **excluding `.pnpm-store` and existing `node_modules`**, to:

`C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2d-clean-install-iDCb15/source`

It used a separate initially empty npm cache, the unchanged existing lockfile, Node **24.18.0** and npm **11.16.0**:

```text
npm ci --ignore-scripts --no-audit --no-fund --cache <fresh-external-cache>
npm run build
```

The install succeeded (356 locked packages), the build succeeded, the copied lockfile remained unchanged and every output file matched the current checkout. This proves the tested **Windows/npm/lockfile build path** can reproduce its output without the committed pnpm cache, including with installation lifecycle scripts disabled. It does not prove every pnpm/offline/other-platform workflow is independent of it.

The repository has `package-lock.json`, no root `pnpm-lock.yaml` or `packageManager` pin, and a `pnpm-workspace.yaml` with placeholder text for the SWC/esbuild `allowBuilds` settings. No configuration was guessed or repaired. npm printed existing Recharts deprecation and newer-npm notices; **no upgrade was performed**.

Recommend a separately approved housekeeping change that first documents the selected package manager, validates supported CI/platform and any offline/pnpm consumers, and reviews ignore/source-upload rules. There is no explicit `.pnpm-store` entry in the current `.gitignore` or `.vercelignore`; do not confuse cache tracking with the existing explicitly scoped static production package. Only after owner review should removal from version control be proposed, preserving any required local/offline recovery material. **The successful npm proof did not override this pass's prohibition on deletion.**

## Historical source candidates — identified, not deleted

| Candidate | Current reference evidence | Decision |
|---|---|---|
| Root `App.tsx`, `AppLayout.tsx`, `SetupDashboard.tsx` and other parallel root TSX copies | Vite explicitly enters `index.html` → `src/main.tsx` → `src/App.tsx`; prior audit and restoration/library reports identify the root copies as older snapshots. | Leave intact. Confirm external/export/recovery consumers with the owner before any archive proposal. |
| `supabase/src` and older `supabase/docs` / `docs/edge-functions` copies | Not the canonical Vite entry or current `supabase/functions` deployment source; previous reports document divergence. | Leave intact. Obsolete provisioning snippets can be confusing, but changing/deleting operator history is outside this pass. |
| Preserved custom native bridges and their preparers/tests | `native/README.md` identifies them as inactive recovery/development material. Tests and preparers still reference them. | Intentionally retained; they are not treated as disposable merely because stock Median is selected. |

A successful browser build alone cannot prove historical files have no external consumer. No historical file or dependency was deleted and no working functions were consolidated.

## Cleanup deliberately avoided and functional risks

- Unused payment-visibility imports were left in place: that module reads/persists runtime flags and cleans URL parameters during initialization. Removing whole import edges or changing evaluation order is unnecessary risk.
- Unused subscription imports were left intact under the billing/subscription restriction. No membership, quota or trust-boundary functions were consolidated.
- Scanner leftovers, unused state setters and the unused dashboard `useId()` allocation were not removed. Removing hook calls can affect hook identity/order and would require a separate lifecycle/remount review. Large components were not rewritten.
- React default imports flagged by the automatic-JSX application checker were not removed wholesale; some source-compiling test helpers still use classic JSX transforms. This is not a mass unused-code cleanup.
- Shared queries/providers, inactive UI primitives, duplicate source trees, lockfile/package-manager conventions and deployment exclusions were not reorganized. They require separate decisions and are unnecessary to resolve these failures.

**No new functional defect was confirmed by this pass.** The seven failures were stale harness/contract expectations, not evidence that product behavior should be rewritten. The legacy source copies, ambiguous package-manager configuration and large tracked cache remain maintenance concerns, not newly demonstrated production failures. Device/provider/store behavior remains outside this local verification.

## Recovery and retained evidence

Starting state, backups, before/after TAP/reports, ordinary/strict unused TypeScript diagnostics, build manifests, fresh-install logs and preservation checks are under:

`C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/phase2d`

Existing pre-task changes are recoverable from `before` and `starting-state.json`; new modifications to previously clean test files are reviewable against the unchanged Git HEAD. No individual change introduced a regression, so no product workaround or rollback was required.

**Conservative cleanup is complete. Production and all existing recovery material remain unchanged. No commit, push or deployment was performed.**
