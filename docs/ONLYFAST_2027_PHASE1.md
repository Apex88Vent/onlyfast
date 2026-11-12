# OnlyFast 2027 Phase 1

November 12, 2026. Development preview only. Production release is prohibited.

## Verified preview

- [Development URL](https://onlyfast-git-develop-onlyfast-2027-apex88vents-projects.vercel.app/upgrade)
- [Verified deployment](https://onlyfast-20kimy8a3-apex88vents-projects.vercel.app/upgrade):
  `dpl_Dh34XTwqPETw2SqUQBBiL5CXfD3W`, source commit `c9e0b223`, Vite,
  Preview target (`target: null` in the Vercel API), `READY`.
- Build duration: approximately 79 seconds, from Vercel building/ready timestamps.
- Authenticated browser verification returned HTTP 200, rendered all three
  cards, exercised Factory's class permission example, and found no page errors
  or mobile horizontal overflow. Deployed CSP includes `connect-src 'none'`;
  `X-Robots-Tag` is `noindex, nofollow`.
- Vercel's existing authentication protection remains enabled. The owner can
  use the development URL while signed into Vercel. A temporary authorized
  sharing link was used for verification; it is not persisted here.
- Remote main still points to `46f7552a`; latest production deployment remains
  `dpl_8NFvGedoKHaMQXRpbqmqgAy11yte`. No production deployment was triggered.

## Branch and recovery

- Development branch: `develop/onlyfast-2027`, created in the primary checkout from
  `origin/main` at `46f7552adb51dae89bd9d9616be646e39f232c44`, the commit serving
  production when inspected. `main` was neither edited nor merged into.
- No previous `develop` or testing branch existed on the remote. Existing
  `codex/*` branches were retained. The former onboarding branch was 59 commits
  behind main and the native RevenueCat branch 49 commits behind, with no unique
  commits. A fresh branch avoids carrying historical experiments forward.
- The pre-existing uncommitted billing/ads/analytics work from main is preserved
  in stash commit `6ea66c994b80ae10fef2ff372d8d2e51a525345a`, titled
  `preserve-main-before-onlyfast-2027-phase1-2026-11-12`. It includes untracked
  files. Do not drop this stash. Review it before applying it back on main.
- No worktree, recovery branch or existing backup was removed.

## Deployment and isolation

The existing Vercel project is `onlyfast` (`prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`),
under `apex88vents-projects`. Production uses main and the onlyfast.app domains.
No Vercel custom environments currently exist; the account reports a custom
environment allowance of zero. Historical preview/staging deployments exist but
do not establish a reusable isolated backend.

The branch enables a standard Vercel Preview deployment. Its explicit build
command is `vite build --mode onlyfast-2027`. This mode, and builds from this Git
branch, reject `VERCEL_ENV=production`. Main's deployed configuration remains
unchanged. Do not merge this branch's preview-only deployment configuration into
a production release without a separate review.

No production or preview environment variables were changed. Every environment
variable returned for this project was scoped to production. The source's normal
Supabase fallback points to **production**, so a normal preview would not isolate
data. The 2027 build ignores inherited backend credentials, constructs only a
non-networked client at a reserved `.invalid` URL, disables session persistence,
and never mounts the normal app's auth, billing, ads or data providers.
Its CSP blocks fetch/WebSocket connections, frames and form submissions. Only
the existing Google Fonts stylesheet/font origins are allowed beyond self.

The hosted preview is a permission inspector with disposable examples. Its
“Inspect … permissions” buttons do not assign membership, write records, make a
purchase, or represent a successful subscription. The same screen serves the
preview's onboarding, pricing and upgrade paths. Account-based onboarding and
test-tier switching remain blocked until a separate backend is provisioned.

## Tier configuration

`src/lib/membership.ts` is the shared permission source. The proposed pricing and
card copy live in `src/lib/subscription2027Catalog.ts`; card features derive from
the permission definitions. `PLANS` remains the separate legacy billing catalog.

| Permission | Sportsman | Pro | Factory |
| --- | --- | --- | --- |
| Monthly USD | $4.99 | $7.99 | $14.99 |
| Annual USD | Undecided | $60 | Undecided |
| Active racing classes | 1 | 1 | Unlimited |
| Base setups | 2 | Unlimited | Unlimited |
| Total regular race-weekend saves | 5 | Unlimited | Unlimited |
| Regular setup edit window | 48 hours | Unlimited | Unlimited |
| Timing scans | 2/month | Unlimited | Unlimited |
| Setup Assist | 1/weekend | Unlimited | Unlimited |
| Advertisements | None | None | None |
| Future OnlyLaps/telemetry permissions | False | True | True |

Regular setups retain the existing saved race-weekend identity, including its
session rows; sessions do not become additional quota slots. Locked and
historical setups count. Sportsman quota enforcement counts all retained classes
rather than resetting the allowance on class switching. No automatic deletion or
slot recycling was introduced; existing deletion semantics are preserved.

The Sportsman lock uses the existing immutable weekend creation clock. All
values, notes and session results stay readable. The testing SQL rejects updates
to annotations/results as well as mechanical values after the window; legacy
Rookie's existing annotation exceptions remain unchanged. The application has a
Sportsman read-only fieldset/save guard and requests the authoritative clock.
An unavailable clock RPC leaves an existing Sportsman setup read-only.

Existing Rookie, Pro and Team identifiers, quotas, ad behavior, subscriptions and
entitlement mapping remain intact. Team is not silently renamed to Factory;
Rookie is not converted to Sportsman. New tiers can currently be assigned only
through the prepared server-authorized testing override on a separate database.
They are never inferred from user_metadata, URL parameters or browser storage.

## Server preparation — not deployed

`scripts/prepare-2027-testing-policy.mjs` prepares SQL **offline**, outside the
production migration stream:

```powershell
node scripts/prepare-2027-testing-policy.mjs tmp/onlyfast-2027-testing.sql
```

It refuses to overwrite an existing file. The SQL requires the existing reviewed
staging baseline, Phase 1 authorization/usage schema and test-tier RPC schema.
It refuses installation unless an operator has explicitly declared a non-live
testing project reference with `onlyfast.testing_project_ref`. The known
production reference is rejected. This marker is an operator assertion: verify
the actual database/project identity independently before setting it.

The prepared policy adds a private RLS-protected environment marker and policy
table, broadens only the testing override's tier constraint, updates the existing
guard/reservation functions, and adds an owner-only immutable-clock RPC. The
server policy table is generated from the same client permission definitions.
No customer, subscription, entitlement or historical setup rows are migrated.
Privileged code remains in the private schema; exposed wrappers run as invokers.
Overrides require the existing experimental tester record plus enabled explicit
feature grant, verified by the database. Normal users cannot assign tiers or
update billing rows. Revocation restores the actual legacy paid access.

The Edge authorization resolver recognizes the two new tier IDs, with existing
server-side reservation logic enforcing Sportsman's inherited usage limits.
No Edge Function was deployed and no SQL was applied to Supabase. No new files
were added under `supabase/migrations`, avoiding automatic production replay.

## RevenueCat

Read-only inspection found project `proj79983fe3` with App Store, Play Store and
Test Store apps. Existing entitlement lookup keys are `OnlyFast Pro` and
`OnlyFast Teams`. The Test Store shares this live project and entitlements;
it must not be treated as an isolated new billing configuration.

No Sportsman/Factory products, prices, offerings, entitlements or sandbox
purchases were created or changed. The stock Median billing path is preserved.
New cards have no purchase action and never fabricate success. A separate reviewed
2027 sandbox product/entitlement mapping is required before purchase QA.

## Verification

- Full automated suite: 576 passed, 0 failed.
- TypeScript: app and Vite/node configurations pass.
- Normal optimized application build and optimized 2027 preview build pass.
  The normal application build retains its existing large-chunk warning.
- Production-target rejection tested for both explicit mode and Git branch.
- Disposable PostgreSQL/PGlite tests exercise authenticated/anonymous/service
  roles, authorization revocation, quotas, locked read access, immutable clocks,
  class restrictions, usage limits and preservation of billing rows. They reject
  installation with no environment marker or with the production reference.
- Browser verification at 320, 390, 768 and 1280 pixels: cards and permission
  inspection work, no horizontal overflow, no page errors, no backend/billing
  requests. Existing font requests are allowed. Pricing, upgrade and onboarding
  preview routes use the same cards. Screenshots/results are in the ignored
  `tmp/onlyfast-2027-review` directory.
- No real RevenueCat purchase, hosted test login, hosted setup save or Supabase
  sandbox write is claimed. The local Docker daemon was unavailable when checked;
  PostgreSQL assertions ran in disposable WASM, not a hosted/local Supabase stack.

`.github/workflows/onlyfast-2027.yml` adds read-only CI on development pushes and
pull requests to main/development. It runs tests, both TypeScript checks and the
preview build; it contains no deployment or database credentials. No workflow
existed in the inspected production checkout.

The first hosted run, [43266261365](https://github.com/Apex88Vent/onlyfast/actions/runs/43266261365),
received a runner shutdown signal during the final native sandbox test. It
reported 575 passed and one interrupted test file, then cancellation; subsequent
type/build steps were skipped. This is distinct from the complete local run of
576 passed. Do not describe that hosted run as passing. Check the latest branch
run before requiring its `validate` status for merges.

## Blockers and operator steps

1. Provision an independently isolated Supabase testing project with schema-only
   data and synthetic authorized accounts. The only hosted project visible was
   production `thpyjvwtfvfxiufchrxn`; its only branch was default main with a
   historical `MIGRATIONS_FAILED` status. Do not reuse production credentials.
2. Review the separate schema rebuild/policy against the new project's actual
   schema, install it there, and verify RLS/authorization with real Auth sessions.
   The production migration history is not a complete empty-database bootstrap;
   see `STAGING_DATABASE_REBUILD.md`.
3. Connect that backend through a separately reviewed environment/build gate,
   then mount the real testing application and authorized selector. The current
   preview intentionally cannot be enabled for writes through an environment
   variable or a client-side switch.
4. Configure a reviewed isolated RevenueCat sandbox catalog before native
   purchase/restore tests. Preserve all live entitlement/product associations.
5. Require pull requests and the `validate` CI job for production merges. No
   rulesets were listed, but the GitHub connector returned 403 for main branch
   protection inspection. Existing protection status could not be verified and
   no protections were changed. An owner must review/configure this in GitHub;
   a workflow alone does not enforce PR-only merges.

## Phase 2

Complete hosted sandbox acceptance, real authorized tier switching and purchase
QA before planning subscriber migration or launch. Annual Sportsman/Factory
pricing and any revised deletion/slot recovery policy remain undecided. A future
OnlyLaps/telemetry integration must use Pro/Factory permissions, exclude Gumball,
and receive its own implementation review. No standalone OnlyLaps repository,
code, deployment or credentials were changed in this phase.
