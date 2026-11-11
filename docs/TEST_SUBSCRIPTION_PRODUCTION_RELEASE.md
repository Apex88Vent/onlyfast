# Test subscription production release — November 10, 2026

**Deployed and verified on the production web app.** The real `test@test.com` account now switches without checkout. It was left on Team after acceptance. Physical Median iOS and Android checks remain.

## Release identity

| Item | Verified value |
| --- | --- |
| Production URL | https://onlyfast.app |
| Vercel project | `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR` |
| Production deployment | `dpl_9TersMqnSDPkD3BDrGEGN2R3dp54`, READY |
| Release source commit | `4c0f37a9cdbb44b0a2fd04b4e2488dd7675f410e` |
| Served JavaScript | `/assets/main-CdTxW2wY.js` |
| Supabase project | `thpyjvwtfvfxiufchrxn` |
| Approved SQL source | `supabase/migrations/20261110233145_restore_test_subscription_switching.sql` |
| Recorded hosted migration | `20261111003124_restore_test_subscription_switching` |

Supabase's migration tool assigned its execution timestamp `20261111003124` when applying the unchanged approved SQL. The original local file has already been executed in production; do not replay it merely because the local filename has an older timestamp. Future CLI migration-history reconciliation must account for this mapping.

## Isolation and configuration

The production baseline was the already-live store-navigation deployment `dpl_2tY9W51pm7uMTXhf9G3ZdK15NJAt`, not an unrestricted build of current main. All 276 source files in its preserved upload manifest matched the live deployment byte for byte. The initially unexplained 277th entry was Vercel's generated `out/api/admob-region` function, not another source file.

The release preserves that live store-navigation fix and changes only these ten application files for test subscription support:

- `src/components/Header.tsx`
- `src/components/NativeSubscriptionControls.tsx`
- `src/components/PlanSelection.tsx`
- `src/components/TestSubscriptionGate.tsx`
- `src/hooks/useNativeSubscription.ts`
- `src/lib/membership.ts`
- `src/lib/nativePurchases.ts`
- `src/lib/subscription.ts`
- `src/lib/testSubscription.ts`
- `src/lib/trustedMembership.ts`

The advertising-specific optional `applyTestTier` parameter from unpublished main work was excluded from the isolated trusted-membership source. Advertising controller/mode, AppContext, house-ad layout, native purchase controller, payment visibility, API region code, dependencies, and `vercel.json` remained identical to the live baseline. The runtime received no unrelated onboarding, advertising, or native bridge changes.

An isolated release commit was created in `Apex88Vent/onlyfast` and used as the deployment's source identity. Main, existing branches, and worktrees were not moved or replaced. The deployment used the existing project's production configuration. All 24 production environment-variable records matched before and after; no rollout, pricing, RevenueCat, or billing settings were edited. All 278 deployed source files were verified against the reviewed release package.

Source, upload manifests, package provenance, test logs, and delivery checks are retained under `tmp/test-subscription-production-release/`. This is a deployment artifact directory, not another Git checkout or worktree.

Automatic main deployments remain disabled in the existing configuration. Git history shows this was introduced by `8ee0ec58` on October 26 to prevent a repository-preservation push from automatically releasing unreviewed work. This release did not change that setting.

## Database safety and activation

Only the approved migration was applied. Its prerequisite checks passed. The new constrained tester-tier column, own-account getter/setter, and selection-first membership/class resolvers were verified active.

Authenticated clients can execute the own-account setter but cannot update the authorization table directly or call the internal arbitrary-user resolver. Anonymous execution is denied. A production normal-user identity, exercised under the authenticated database role in a rolled-back transaction, received `TEST_ACCOUNT_REQUIRED`, and its getter returned null. No normal account's tier was changed.

The existing security-advisor findings were unchanged and no new test-tier findings appeared. The migration uses private privileged functions with fixed search paths and public invoker wrappers.

Integrity digests remained identical immediately after migration and again after live tier changes and logout/login:

| Data | Before and after digest |
| --- | --- |
| All `user_subscriptions` rows | `7958fd7987be15397c2ec2687aec1d53` |
| All `race_setups` rows | `f759abcca82f52b4323e0ec261c85354` |
| All RevenueCat webhook event rows | `317c3d458f8fd185e6f62e47a9a73df9` |

The other existing authorized tester's selection remained null, preserving its prior default access. No account designations or feature flags were changed. The test account's ordinary sign-in/session activity and selected test-tier field are expected changes; its billing and saved setups were preserved.

## Acceptance results

- The exact isolated package passed **666 regression checks**, TypeScript, and the production build before release. The existing large-bundle advisory remains.
- `/app` and `/pricing` returned 200 and served the new asset containing the test-tier getter, setter, selector, and correct Supabase backend URL.
- Using the user's actual signed-in `test@test.com` browser session, **Team → Rookie → Pro → Team** succeeded through the no-payment UI. No checkout, purchase, restore, or RevenueCat configuration change was initiated.
- Rookie persisted across refresh and navigation. Its dashboard/menu showed Rookie, Settings showed the free Rookie plan, and the existing house-ad teaser/banner appeared.
- Pro persisted across refresh and a new browser tab. The dashboard/menu and Settings showed Pro and the Rookie house ads were absent.
- The actual production stored field, getter, and membership resolver agreed at every tier. Rookie and Pro returned `unlimited_classes=false` and rejected access to a different class; Team returned `unlimited_classes=true` and allowed it.
- A second tab read Team after the original tab changed it, confirming cross-tab persistence.
- Pro was selected again for a meaningful login-persistence check. The agent signed out, the user signed back in, and both the dashboard and plan selector showed the saved Pro selection. One locator wait timed out during page rendering; a fresh accessibility snapshot immediately confirmed the expected Pro state. No state repair or code change was needed.
- Team was then restored through the UI. Final database readback confirmed stored and effective Team.
- No deployment-scoped runtime error/fatal logs were returned for the verification window. This is a limited post-release observation, not a claim of long-term monitoring.

Production usage quotas were not consumed, saved setups were not edited, and real purchases were not tested. Existing quota/feature boundaries and normal-user provider flows passed the isolated regression suite; live verification additionally checked tier resolution, class permissions, labels, ad presentation, persistence, and unauthorized setter denial.

## Remaining device acceptance

On physical stock Median iOS and Android apps, fully reopen the app to load the updated site, open Settings → View Plans, and repeat Rookie → Pro → Team. Verify no checkout opens for the authorized tester, labels and class access update, refresh/relaunch retains the selection, and native ads remain subject to the unchanged rollout/consent/device holds. The normal-user store UI and native callbacks should also be checked on their original store accounts. No native app binary was rebuilt or changed for this release.
