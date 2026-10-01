# Live setup-library deployment — October 1, 2026

The production Supabase migrations are applied and the live database checks passed. **The frontend at https://onlyfast.app still runs the September 24 build. Deployment of the tested workspace frontend and authenticated browser verification remain pending.** No additional frontend implementation changes were made during this deployment pass.

**Manual GitHub handoff:** the user chose to push through GitHub after the embedded login remained unresponsive. The production build was rerun successfully on October 1 (`main-DyhosJnG.js`). The release is prepared as a local commit on `main` for `origin`, `https://github.com/Apex88Vent/onlyfast.git`. See [manual push and post-deployment checks](MANUAL_GITHUB_DEPLOYMENT.md). No push or new production frontend deployment has been performed by the agent.

## Requested 15-point report

| # | Requested result | Verified outcome |
| --- | --- | --- |
| 1 | Exact production Supabase project | **`thpyjvwtfvfxiufchrxn`**, project OnlyFast, `us-west-2`. Verified from the JavaScript actually served by `onlyfast.app`, its runtime Supabase configuration log, and the authenticated CLI project listing. The deployed bundle uses this URL with its bundled defaults; no inlined URL override was present. The source fallback alone was not used as evidence. |
| 2 | Previously present migrations | `20260630_prepare_user_subscriptions_for_revenuecat`, `20260713_add_race_schedule_end_date`, `20260720_enforce_active_race_class`, `20260728_add_account_beta_feature_flags`, `20260817_link_race_setups_to_schedule`. Neither requested migration nor Custom Car was recorded before this pass. The active-class RPCs, beta tables, subscription table and setup table were present. |
| 3 | Migrations applied | **First** prerequisite `20260929_add_custom_car_class.sql`; **then** `20260930_add_development_setup_library.sql`; **then** `20261001_verify_designated_test_account.sql`. Each completed successfully against the verified project. Only these executed versions were subsequently marked applied in migration history. An independent connected Supabase query confirmed all three history entries. |
| 4 | Designated account exists | Yes. `test@test.com` resolves to Auth UID **`4b9864ff-2195-4be0-83a4-39308446577e`**. All subsequent authorization and setup tests use this UID. |
| 5 | Actual account authorization | `is_test_account=true`, `beta_features_enabled=true`, `tester_kind='experimental'`, enabled `test_account_full_access` for the same UID. The existing onboarding-preview, rookie-ad-preview and test-reset flags were already enabled and were not changed. |
| 6 | Did the repair change authorization? | The designation and full-access flag were already correct before deployment. The idempotent upserts reasserted those same values; no permission value changed. Auth/onboarding metadata fingerprint before and after: `5eff4a5bc8e75da21b930ae011ce3c8a`. `onboarding_completed` remained null. No reset was invoked. |
| 7 | Development classes accepted live | **36/36** canonical names accepted under the actual designated UID and PostgreSQL `authenticated` role; `onlyfast_can_use_setup_library()` returns true. |
| 8 | Test account can select them | Live `change_active_race_class` succeeded for Winged Sprint Cars, Legends, GT3, Road Racing / Superbike, and RC Touring Car, covering all five disciplines. No `CLASS_INVALID` occurred. This verifies live server selection; the corresponding deployed UI selection remains pending the frontend deployment. |
| 9 | Selection survives refresh/relogin | **Server persistence confirmed across separate requests:** GT3 selection committed, a fresh request returned GT3, then original Pro Stock was restored. Actual browser refresh, logout/login and app reopen are **not verified**. The existing enabled reset flag makes login/logout destructive for this account; see the remaining checks below. |
| 10 | Create/save/reopen live setups | **Live backend passed**, with actual application serializer payloads, authenticated role and the real UID. Six QA setups persisted, covering all five disciplines. Independent post-commit queries returned their values. Browser form/save/reopen still pending. |
| 11 | Rename/copy/edit | **Live backend passed:** GT3 original renamed; copied snapshot initially matched; copy temperature changed from `82.5` to `90.0`; original stayed `82.5` and its full snapshot remained unchanged. Independent readback confirmed both rows and names. Actual browser controls remain pending. |
| 12 | Repeated class switching | **Nine successful changes**, including separate committed GT3/Pro Stock requests. Existing experimental-account unlimited eligibility returned `unlimited=true`, `can_change=true`, `next_eligible_at=null`, `last_class_change_at=null`. Original active Pro Stock restored. No production cooldown modification. |
| 13 | Normal production isolation | Real non-test Rookie/Pro fixture: development gate false; **36/36** development names canonicalize to null; existing Dwarf Cars remains valid. Initialize and change RPCs returned `CLASS_INVALID` for a representative class from every discipline. Direct inserts for all five representatives were rejected. Development rows visible under this UID: **0**, also tested after QA rows existed. All fixture checks rolled back. Guest production UI showed Dirt Track Oval enterable and other four disciplines Coming Soon. |
| 14 | No RLS or permission bypass | RLS remains enabled on `race_setups`, `user_subscriptions`, `beta_tester_accounts`, and `user_feature_flags`. Verification SQL changes role to `authenticated` and sets transaction-local claims to exercise stored UID permissions; it does not disable RLS or remove RPC validation. No email frontend bypass, broad tester grant, admin grant, subscription entitlement change, cooldown weakening or data reset was introduced. All nine preexisting setups compared byte-for-byte unchanged. |
| 15 | Remaining issue | **Stale production frontend**, awaiting the user's manual GitHub push. The Vercel connector can read the deployment through the default account scope, but an explicit team-scoped request returns 403 and its advertised deploy tool returns “Tool deploy_to_vercel not found.” Embedded sign-in was unresponsive; a fresh tab reached GitHub's login form, but CLI authentication did not complete. No new frontend deployment has occurred. An authenticated test-account browser session and a safe plan for the already-enabled reset behavior are also required to finish browser verification without wiping data. |

## Live QA records left for review

Existing setup count: **9**. Current count: **15**, consisting of those unchanged nine plus these six identifiable QA rows. They were deliberately retained for review.

| Discipline | Class / setup name | Saved values |
| --- | --- | --- |
| Dirt Track Oval | `LIVE QA - Winged Sprint Cars - 20261001` | track `LIVE QA circuit`, weather `Dry`, ambient temperature `82.5`, fuel `10.25` |
| Pavement Oval | `LIVE QA - Legends - 20261001` | Same four values |
| Road Course | `LIVE QA - GT3 - RENAMED - 20261001` | Same four values; ID `fe44bf96-7ba7-418d-a15e-787aa4b46597` |
| Road Course | `LIVE QA - GT3 - COPY - 20261001` | Same except ambient temperature `90.0`; ID `7c17318d-f7e6-445c-b50c-356e734b2fab` |
| Motorcycle | `LIVE QA - Road Racing / Superbike - 20261001` | Same four values plus fork height `3.5` |
| RC | `LIVE QA - RC Touring Car - 20261001` | track `LIVE QA circuit`, front camber `-1.25`, front ride height `5.0` |

The payload generator uses the real `CreateBaseSetupView` serializer via the existing test harness. SQL inserts/updates use `authenticated` with the account's claims. This proves server authorization and stored payload compatibility, but does not constitute real browser form interaction or an end-to-end Supabase Auth login test.

## Production frontend evidence and deployment target

- Domain: https://onlyfast.app
- Vercel project: `onlyfast`, ID `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`.
- Team/account ID returned by project listing: `team_smopqnOs6cFIL3nxEZ7O9O7Z`, slug `apex88vents-projects`.
- Current production deployment: `dpl_2s41RXH6xyP9HDrUZFZ8PR7jRSgc`, READY; deployment URL `onlyfast-r4w3yymlj-apex88vents-projects.vercel.app`.
- Git source: `main`, commit `a2ab5bbfb9620bdac0696dedc1bc2d87f7fff3fc`, message `9-24 IOS CLEANUP`.
- Served asset: `/assets/main-m9nQttuU.js`; it lacks `onlyfast_setup_library_v1`, `GT3`, `Formula Vee`, `Select My Discipline` and `Skip to discipline selection`; obsolete `Pick My Plan` remains.
- Live unsigned onboarding traversed to Select Your Discipline, then Dirt Track Oval to Select Your Car. The old six enabled dirt choices appeared. No signed-in class save, configured-user login or real test-account login was claimed.
- Screenshot: [live onboarding discipline selector](live_onboarding_sanity.jpg).

The current workspace contains the already-tested expanded frontend and prior Custom Car/onboarding work. Redeploying the old Git commit would not publish those uncommitted changes. Deploy the current workspace to the existing project once the CLI is authenticated:

```powershell
npx --yes vercel@latest login
npx --yes vercel@latest link --project onlyfast --scope apex88vents-projects
Get-Content -LiteralPath .vercel/project.json
npx --yes vercel@latest deploy --prod --scope apex88vents-projects
```

Before the last command, confirm `.vercel/project.json` contains the project ID and org ID above. Run from the OnlyFast workspace. Successful output must identify a READY production deployment for that existing project and alias `onlyfast.app`; then inspect the domain's new bundle and run the remaining browser checks. [Vercel login](https://vercel.com/docs/cli/login), [project linking](https://vercel.com/docs/cli/link), [deployment CLI](https://vercel.com/docs/cli/deploy).

## Exact database commands and repeatable verification

These deployment commands **already completed successfully**, in this order. There is no need to repeat them to enable the backend:

```powershell
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file supabase/migrations/20260929_add_custom_car_class.sql --output json
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file supabase/migrations/20260930_add_development_setup_library.sql --output json
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file supabase/migrations/20261001_verify_designated_test_account.sql --output json
npx --yes supabase@latest migration repair 20260929 20260930 20261001 --status applied --linked --project-ref thpyjvwtfvfxiufchrxn
```

Only those three explicitly executed versions were repaired. A broad `db push` was avoided because the repository also contains unrelated pending migrations. The CLI migration-list display paired the short new versions oddly with local files; the actual `supabase_migrations.schema_migrations` query independently confirmed the correct versions/names. Do not repair or execute unrelated migrations based on that formatting.

Repeatable verification commands:

```powershell
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file docs/live_setup_library_preflight.sql --output json
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file docs/live_setup_library_access_checks.sql --output json
npx --yes supabase@latest db query --linked --project-ref thpyjvwtfvfxiufchrxn --file docs/live_setup_library_readback.sql --output json
```

Alternatively select the verified project in the [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview) and run those exact SQL files. Preflight/readback perform no persistent writes. Access checks use a temporary results table and roll back all attempted changes.

Expected results:

- Preflight: all three new migration-history entries, all prerequisite booleans true, `development_gate_present=true`, actual UID/designation above, all four RLS booleans true, current setup count 15.
- Access checks: `test_classes={accepted:36,total:36}`, test `allowed=true`, normal `allowed=false`, `normal_classes={blocked:36}`, normal `gt3=null`, `dwarf='Dwarf Cars'`, `visible_development_setups=0`, `enforcement='PASS: normal account initialize/change/write rejected in all five disciplines'`.
- Readback: `development_access=true`, full-access flag true, experimental designation, active class Pro Stock, unlimited true, total setups 15, six `qa_rows` with the values shown above. The SQL Editor also displays the migration and metadata query result sets; the CLI displays the final `persisted_qa` result.

`live_setup_library_setup_checks.sql` is the **already-executed** QA creation/rename/copy/edit transaction. Its duplicate-name guard prevents accidental reruns; use the readback script for subsequent checks. `generate_live_setup_checks.mjs` records how the actual serializer supplied its payloads.

## Remaining browser checks and existing reset behavior

After frontend deployment, verify all five disciplines and representative classes in a real authenticated session, open the retained QA rows, and exercise real form saving/rename/copy/edit. Verify page refresh and reopen separately from backend readback. A clean new-account fixture and configured returning-account session are needed for the two signed-in onboarding paths; the guest traversal only proves the unsigned path.

The designated account already has enabled `test_account_reset`. Existing `AppLayout.tsx` invokes the reset function on a fresh login without its session marker; `Header.tsx` invokes it on logout. A login/logout persistence test would therefore invoke behavior that conflicts with the request to preserve setups and onboarding state. No reset, flag change, marker injection or authentication hack was performed. This needs an explicit safe testing decision before cycling that account's login/logout. The reset behavior predates this deployment pass and is separate from the development-class migration failure.

Prior local implementation validation remains documented in [the onboarding report](TEST_ACCOUNT_ONBOARDING_REPORT.md) and [the setup-library report](SETUP_LIBRARY_REPORT.md). This pass changed only QA/report artifacts and applied the three existing migration files.
