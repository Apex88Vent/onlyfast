# OnlyFast web onboarding release review

October 17, 2026 (America/Los_Angeles). Branch:
`codex/onboarding-release-preparation`. Local preparation only; no push,
Vercel deployment, store upload, purchase, restore or production database change.

## Actual app, not a component preview

Ran the main Vite application at `http://127.0.0.1:8080/` in `release-review`
development mode. This used the existing Docker Supabase workspace
`onlyfast-disposable-staging`, API `http://127.0.0.1:54321`, database port 54322.
The workspace's project ID and absence of a remote link were verified. No database
reset, migration application, backend rebuild or customer-data copy was needed.
Explicit local environment overrides prevented the production fallback URL.
The app had no component mocks, injected diagnostic UI or native purchase permit.

Two fresh synthetic local accounts were created using local Auth admin access.
The second account had a server-owned, synthetic active Stripe Pro subscription;
its fake customer/subscription IDs were never sent to Stripe. Credentials and
runtime proofs stay in ignored `tmp/` files, outside this commit.

Verified through the real UI and independent authenticated database/RPC reads:

| Check | Result |
| --- | --- |
| Welcome tutorial, original logo/colors | Passed |
| Skip on the first slide | Passed; only `onboarding_step=discipline`, no selected class or completed onboarding |
| Existing discipline catalog | Dirt Track, Pavement Oval and Road Racing selectable; Motorcycle/RC retain their existing Coming Soon state |
| Existing car/class catalogs | Dwarf Cars and GT3 selected through their existing screens |
| Subscription selection | Rookie enabled, Pro/Teams disabled Coming Soon |
| Rookie free continuation | Landing reached; server records Rookie selection, active class and completed onboarding |
| Returning Rookie | Reload enters landing with no tutorial or plan selection |
| Existing Stripe subscription | Completing onboarding still returns Pro from the server membership RPC; Stripe plan/status/customer/subscription fields unchanged |
| Returning paid account | Reload enters landing; header and Settings show Pro |
| Saved setups | Saved a synthetic Hot Laps setup, found it in Saved Setups and reopened cross weight 51.5 and notes |
| Race schedule | Saved a synthetic race and verified it appears in the actual schedule |
| Sessions | Heat session opens; Hot Laps/Heat/Main remain available in the saved event |
| Setup Assist | Existing interface remains accessible; paid/feature/session behavior is covered by regression tests; no paid/live AI request was sent |
| Public native billing | Release code keeps purchase and restore held independently of environment flags |

## Small fixes found in final review

- Removed the duplicate first-slide login link exposed when Skip became available
  immediately; preserved one existing login action.
- Wrapped tutorial indicators so all targets stay inside the mobile card while
  retaining the existing minimum target size, colors and button behavior.
- Connected the tutorial's skip-to-main target and moved focus to the plan heading
  when plan selection opens.
- Rechecked account identity before refreshing class allowance on membership
  events, avoiding a stale account request during sign-out.
- Located the public native readiness hold in the release controller module so
  the web release does not depend on local diagnostic policy/source files.

No setup sheet, racing class definition, schedule/session/Setup Assist feature,
Stripe checkout/portal implementation or backend function/migration was changed.

## Subscription behavior

Onboarding now holds paid plan selection on web as well as native. Continue Free
records an onboarding preference; it does not cancel or downgrade a paid account.
The existing web Upgrade page still explicitly allows its existing Stripe checkout
path. The Stripe public key, buy-button IDs, checkout, portal and backend remain
unchanged. Native purchases and restore remain unavailable until the release
native bridge is ready and activation is separately approved.

The shared lifecycle reads server-owned membership, refreshes at sign-in/resume/
expiration and handles account changes. It does not initialize RevenueCat, buy,
restore or create paid access while the readiness hold is false. Legacy `team`
rows display consistently with `teams`.

## Release validation

Validated an isolated snapshot of the Git index, excluding the unstaged diagnostic
and staging work. Tested source tree: `e6c728b7d7b7b01e20ab700ce589e701da183451`.
Only this report was finalized after those checks; application/test source remains
the tested version.

| Check | Result |
| --- | --- |
| `npm test` | 360 passed; zero failed or skipped |
| `node --experimental-strip-types --test tests/*.mjs` | 57 passed; zero failed or skipped, including mounted React flows and disposable PostgreSQL authorization/setup checks |
| `npm run build` | Passed; existing large-chunk warning remains |
| `npx tsc --noEmit -p tsconfig.app.json` | Passed |
| Full-repository lint | Not passing: 419 existing errors and 92 warnings; error count unchanged |
| Actual local app | Completed the synthetic Rookie and Stripe Pro flows and saved/reopened racing data described above |

Full lint is a remaining repository quality limitation, not a passing release
check. No unrelated lint cleanup or application redesign is included. Native Android/iOS purchase
release work is outside this web deployment and remains blocked as described in
[the integration report](ONBOARDING_SUBSCRIPTION_INTEGRATION.md).

## Excluded local work

The release commit excludes all `supabase/staging/` files, migration preparation
scripts, native sandbox/diagnostic routes and policy, sandbox-only Supabase client
and Vite configuration changes, earlier backend/staging audit notes, Android source,
test APKs, local credentials, Docker state, generated output and QA helper scripts.
Those files remain available locally and were not discarded. No production
Supabase migrations or Edge Functions are part of this commit.

## Approval boundary and rollback

Stop after the local feature commit. Do not push or merge to main, deploy to Vercel,
or enable native billing without the user's deployment approval. This web change
needs no new database migration or secret. It uses the already implemented racing
onboarding/membership RPCs and existing RevenueCat backend.

After approved deployment, smoke-test new and existing accounts against the
production backend. Production customer accounts and records were not used for
this local review. If the frontend regresses, restore the previous Vercel web
deployment or revert this feature commit; no schema/data rollback is required.
Do not change the existing offering, backend sandbox policy, Stripe billing or
native readiness hold during rollback.

Screenshots of the actual app:
[welcome on mobile](release-review-welcome-mobile.png),
[plans on mobile](release-review-plans-mobile.png),
[plans on desktop](release-review-plans-desktop.png).

## Files in this release commit

29 files. `src/App.tsx` includes only the shared provider changes; its local native
diagnostic route is excluded. Existing unrelated working-tree changes remain
unstaged.

```text
.gitignore
docs/ONBOARDING_RELEASE_REVIEW.md
docs/ONBOARDING_SUBSCRIPTION_INTEGRATION.md
docs/release-review-plans-desktop.png
docs/release-review-plans-mobile.png
docs/release-review-welcome-mobile.png
src/App.tsx
src/components/AppLayout.tsx
src/components/HowOnlyFastWorks.tsx
src/components/NativeSubscriptionControls.tsx
src/components/OnboardingFlow.tsx
src/components/PlanSelection.tsx
src/components/SettingsModal.tsx
src/contexts/AppContext.tsx
src/lib/membershipLifecycle.ts
src/lib/nativePurchaseController.ts
src/lib/nativePurchases.ts
src/lib/subscription.ts
src/lib/trustedMembership.ts
src/pages/Index.tsx
src/pages/Upgrade.tsx
tests/medianPickerLifecycle.test.ts
tests/membershipLifecycle.test.ts
tests/membershipSelection.test.ts
tests/nativePurchaseReadiness.test.ts
tests/nativeSubscriptionControls.mjs
tests/onboardingNavigation.mjs
tests/revenuecat.test.ts
tests/setupAssistTrackUpdates.mjs
```
