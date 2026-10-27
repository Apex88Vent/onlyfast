# OnlyFast worktree consolidation — October 26, 2026

## Primary checkout and baseline

Use `C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast`
on `main`. Its `.git` directory is the shared repository for all six registered
worktrees. All use `https://github.com/Apex88Vent/onlyfast.git`; none is a separate
repository. The five directories under `C:\Users\c_mar\.codex\worktrees` are the
other registered OnlyFast checkouts. No embedded repositories were found while
inventorying preserved local files; generated dependency/cache trees were excluded.

Fetched `origin` before integration. The baseline was local/remote `main` at
`24cb68981d183a916a793d2e0da0a537a03af762`, the public Terms release. All six
worktrees were clean, with zero nonignored untracked files and zero commits absent
from origin's branches. The problem was unmerged branches, not missing pushes.

## Branch/worktree inventory before consolidation

`C:\Users\c_mar\.codex\worktrees\` is abbreviated as `worktrees\` below.
All timestamps are the original latest commit's Pacific offset.

| Checkout | Branch | Original HEAD | Latest commit | Unique commits vs main | Review |
| --- | --- | --- | --- | ---: | --- |
| Primary directory above | `codex/onboarding-release-preparation` | `84d9fb3d` | 2026-10-26 16:48 -07:00, `10-26 2` | 2 | Held Android AdMob, Rookie eligibility, consent request/Settings, isolated native diagnostics and staging rebuild tools |
| `worktrees\fix-startup-onboarding\onlyfast` | `codex/fix-startup-onboarding` | `ca03c1a0` | 2026-10-17 15:47 -07:00, startup/authentication handoff fix | 0 | Already merged; onboarding fixes retained |
| `worktrees\median-paywall-simplification\onlyfast` | `codex/median-paywall-simplification` | `64583cd9` | 2026-10-19 13:55 -07:00, `10-19-1` | 5 | Later stock Median paywall direction, cancellation/identity fixes and isolated acceptance tools |
| `worktrees\native-revenuecat-release\onlyfast` | `codex/native-revenuecat-release` | `13f3de50` | 2026-10-18 11:06 -07:00, `5` | 9 | Earlier custom Android/iOS adapters, native source preparation and evidence; superseded as the active billing path |
| `worktrees\pavement-road-icons\onlyfast` | `main` | `24cb6898` | 2026-10-18 07:02 -07:00, Terms merge | 0 | Directory name was misleading: the icon branch was not checked out here |
| `worktrees\terms-of-service-release\onlyfast` | `codex/terms-of-service-release` | `2b7f9a5d` | 2026-10-18 07:01 -07:00, public Terms page | 0 | Already merged; shared Terms text and public route retained |
| No checked-out worktree | `codex/pavement-road-icons` | `3f6f0825` | 2026-10-26, `10-26 1` | 1 | Pavement/road artwork and shared class icon registry |

All four branches with unique work contained development newer than the main
baseline. Every branch was inspected using its merge-base diff, rather than
treating files added independently to main as deletions from an older branch.
The full original commit lists, status and absolute paths are in the private
backup inventory. Seventeen original development commits required consolidation.

## Recovery

Verified private snapshot:
`C:\Users\c_mar\.codex\backups\onlyfast-consolidation-20261026T235612Z`.

- Seven refs under `refs/backups/consolidation/20261026T235612Z/` protect every
  original local branch, including main. The old main worktree was detached at
  its unchanged commit so the primary directory could check out main.
- `all-refs.bundle` preserves all reachable branch/tag/remote/backup history.
  Verification included `git bundle verify`, cloning the bundle into a separate
  bare repository, `git fsck --full`, and checking all seven recovered ref hashes.
- 9,744 local files (416,924,998 bytes) were copied outside the repository and
  verified with SHA-256. This includes ignored native source/intake packages,
  scripts, QA evidence and private local configuration. Zero copy/hash errors.
- Per-worktree staged/unstaged patches and status are preserved; the patches are
  empty because no uncommitted tracked edits existed. No source edits were discarded.
- Dependency/build/cache output remains untouched in the original directories;
  omitted paths are listed separately. Five `node_modules` links point to the
  primary dependency installation and are recorded as links. Private files were
  not committed or uploaded. The backup README explains reconstruction.
- Existing test-only dependencies were copied, without installation, from the
  paywall worktree's ignored `tmp/test-deps` to primary `tmp/test-deps`, so future
  checks do not depend on keeping that worktree. These remain ignored.

Do not delete the private backup or backup refs without explicit approval.

## Integration and conflict decisions

Merge commits preserve the stock-paywall, onboarding/AdMob, class-icon and native
development histories. Existing startup/auth and Terms merges remain intact.

The later `MEDIAN_PAYWALL_RELEASE_PLAN.md` explicitly supersedes custom native
catalog/source-build billing. Five text conflicts were reviewed per hunk:

- `MembershipPaidAction.tsx`: retain the generic stock paywall action; do not bind
  a custom catalog or suggest that a particular product has already been selected.
- `PlanSelection.tsx`: retain the later localized-offer wording, free continuation
  and stock paywall flow; omit the superseded custom catalog effect/rendering.
- `nativePurchaseController.ts`: keep the stock controller, UUID/revision checks,
  cancellation normalization, timeout serialization and public purchase hold.
- `nativePurchases.ts`: keep stock bridge lookup/SDK identity, server-verified
  synchronization and the existing subscriber lifecycle; do not wire the custom
  controller/transport or add the older Rookie sync behavior.
- `revenuecat.test.ts`: retain stock-controller regressions; retain separate
  custom-adapter tests as historical development coverage.

Two automatically merged dependent files were also reviewed:
`NativeSubscriptionControls.tsx` retains stock invocation/button conditions;
`nativePurchaseReadiness.test.ts` checks the actual stock production controller.
No blanket `ours`/`theirs` file selection was used.

Custom adapter sources, preparers, reports and tests remain available as inactive
development material, with guidance in `native/README.md`. The application does
not import `releaseNativeBilling` or `releaseNativeTransport`. Production output
was scanned for the custom bridge, QA overlay/operator and sandbox route markers;
none were found. This is not a new native compile or store acceptance result.

The combined implementation preserves:

- Tutorial/auth handoff, plan/class selection, saved setups/race weekends,
  timing-session isolation, Setup Assist and existing access controls.
- Pavement and road class artwork without changing class availability/permissions.
- Public Terms and Privacy routes, existing Stripe billing and server-authoritative
  paid/promotional/admin membership behavior.
- All 17 production migration files and 17 Edge Function/shared files, byte-for-byte
  against every original worktree, plus the separate staging baseline/tooling.
- `src/lib/nativeAds.ts`, `ads.ts`, `SettingsModal.tsx` and `CookieConsent.tsx`,
  including the existing Rookie eligibility and native Advertising Privacy action.

**AdMob remains held.** The existing `request.consent()` call is preserved, but
`NATIVE_ADS_CONSENT_VERIFIED=false` still prevents display; this consolidation does
not establish a reliable native consent-readiness contract or resolve that blocker.
The master advertising flag is unchanged, iOS ads remain disabled, and the
600-second interstitial cooldown remains. The Settings action is still conditional
on the enabled master flag, authenticated user, Median Android bridge and foreground
state. This is not a claim that the missing production Settings option is now live.
`NATIVE_PURCHASES_READY=false` also remains unchanged.

## Verification

- Unit suite: 443 passed, no failures/skips.
- Mounted UI/onboarding/diagnostic and disposable PostgreSQL suites: 71 passed,
  no failures/skips after adding the missing no-op AdMob suspension fixture to the
  onboarding harness. No store, production Auth or production database operations.
- TypeScript: application, tooling and both QA clients pass using repository options.
  The first standalone QA invocation omitted required JSX/path/Vite compiler options;
  the corrected check uses the application's compiler configuration.
- Focused lint comparison across 27 changed application files: no new findings;
  58 errors and 11 warnings exactly match existing main debt. Those unrelated
  findings were not rewritten. Dedicated controller/AdMob/icon and AdMob-test lint
  passes after replacing three inherited test-only `any` annotations with explicit
  module/bridge types; test behavior and application code are unchanged.
- Production build passes. Existing main bundle-size warning remains.
- Production imports/dependencies resolve; no package manifest/lockfile changes
  or dependency installations. Backend preservation check reports zero missing
  or changed migration/function files. No deployments or live ads were requested.

Detailed test, lint, build and preservation logs are in the private snapshot.

## Push/deployment safety and future workflow

`vercel.json` sets `git.deploymentEnabled.main=false` before any push, following
[Vercel's documented branch deployment control](https://vercel.com/docs/project-configuration/git-configuration).
This permits the requested GitHub update without an automatic main deployment.
The guard intentionally remains until a separately approved release removes it;
manual deployment is not authorized by this consolidation. The existing production
alias remains on its previous deployment. Push/remote confirmation is reported in
the final response and private post-integration verification records.

`AGENTS.md` records primary-directory/main development, status/branch checks and
no new worktrees/feature branches without an explicit request. For new Codex chats,
choose **Local** in the composer and select the primary project, rather than
**Worktree**. Existing background chats can use **Hand off → Local** when appropriate.
The app's worktree root/cleanup settings do not choose Local for a chat. No global
Codex application setting was changed. See [official worktree documentation](https://learn.chatgpt.com/docs/environments/git-worktrees).

After final ancestry/status checks, all five secondary worktrees are candidates
for user-approved cleanup. None was deleted, and no feature/backup branch was
deleted. Their generated caches/builds remain local; relevant private state is
preserved externally. Do not keep using those checkouts for new development.
