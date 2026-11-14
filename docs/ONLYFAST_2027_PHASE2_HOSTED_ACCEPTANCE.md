# OnlyFast 2027 Phase 2 hosted acceptance — November 14, 2026

**The requested Phase 2 archive/history hosted acceptance passed.** The testing migration was verified without reapplication, the development frontend reached READY, and all 13 hosted acceptance groups passed. This is testing acceptance, not a production or live-billing release.

## Verified release

- Tested source: `9b5bcdbc487bb6a33b57d38a462f4d5a3c47106f` on `develop/onlyfast-2027` in `Apex88Vent/onlyfast`.
- Immutable [tested Preview](https://onlyfast-46egke5sk-apex88vents-projects.vercel.app/app): `dpl_BWduNjgVKuJ7VmoY3ZA6aTfKpVdk`, **READY**, Preview target (API target `null`), Vite, approximately 91 seconds from creation to readiness.
- [GitHub Actions run 43621627074](https://github.com/Apex88Vent/onlyfast/actions/runs/43621627074): **completed / success** for the exact tested source.
- Supabase project `mfzajhnfonrfuiwxgvhe`, organization `wxswxtsewczfijycqnwi`, independently confirmed `ACTIVE_HEALTHY` using only the explicit **testing account** connector.
- Installed migration `onlyfast_2027_phase2_archives_history_testing`, version **`20261114153521`**, recorded in the ledger. Its source matches the reviewed combined artifact after line-ending/surrounding-whitespace normalization. Raw local SHA-256: `7366BC8FA69FA08079F98622024819B5B07EBE69D57B96FBB55B6E58D53FA27E`.
- All **11** catalog checks passed independently both before and after hosted acceptance. The installed Track Trace independent-preparation extension is also retained. **No migration was reapplied.**

The testing `track-trace-setup-context` adapter was synchronized to the reviewed source as version 2, ACTIVE, with JWT verification retained. It now explicitly requires `can_read_history`; its owner-JWT/RLS reader and shared context code are unchanged. Only this testing function was deployed; no production function or provider configuration was changed.

## Hosted results

The verifier used the existing four synthetic identities, real testing Auth/Data API/RPC/Edge endpoints, and the actual READY Vercel frontend in Chrome. Sportsman and Factory used normal password login through the hosted interface. Pro/Factory tier changes and unsubscribe/downgrade transitions were confirmed through the hosted testing selector. No local mock backend was used.

| Hosted acceptance group | Result |
| --- | --- |
| Sportsman login and initial 2/2 base, 5/5 race slot counters; extra base denied | Passed |
| Archive cancellation, confirmed base archive, one freed slot reused, another creation denied | Passed |
| Gray archived card, lock indicator, archive filtering, opening denial, hidden direct-table contents and restore denial | Passed |
| Whole-weekend archive releases exactly one race slot; replacement accepted and sixth active weekend rejected | Passed |
| Pro restores both archived base/weekend units through the hosted UI | Passed |
| Factory mobile archived viewing/restoration at 390px; no horizontal overflow | Passed |
| Factory downgrade requires explicit class choice; confirmation initially disabled; over-quota setup remains viewable/read-only and direct mutation denied | Passed |
| Sportsman 48-hour setup remains readable, with disabled saved-information fieldset and inherited disabled input/select/textarea controls | Passed |
| Sportsman historical laps, sectors, stored analysis and raw samples readable; recording and deletion denied | Passed |
| Unsubscribed account shows read-only notice, can reopen saved setup and historical analysis/laps; setup creation, archive and editing denied | Passed |
| Archived linked telemetry remains inaccessible to Sportsman/unsubscribed through direct tables and history/context RPCs; independent history survives | Passed |
| Pro/Factory can read archived history, while changing the archived parent's telemetry association remains denied | Passed |
| Cross-account setup/history/archive access denied; unprivileged test-tier escalation and anonymous history RPC denied | Passed |

**13/13 groups passed**, with **zero page JavaScript errors** and **zero unexpected external requests**. Hosted screenshots were inspected for the 48-hour editor, unsubscribed historical review and mobile over-quota editor; locked/restored archive screenshots are also retained.

Five supplemental real Edge checks passed: owned active historical context for Pro, Sportsman and unsubscribed; foreign context denied; Sportsman archived-parent context denied. These checks use the same measured-facts adapter as the frontend, without invoking AI providers.

The 48-hour scenario backdated only the newly generated synthetic fixture's private weekend clock, scoped by exact project, owner, setup ID, weekend ID and generated setup name. No original racing row or original weekend clock was backdated. Historical samples/laps/results in this scenario are explicitly synthetic fixtures; physical GPS recording was not exercised.

## Retention investigation

The pre-install baseline had **26 setup rows** and one schedule row. At this continuation's first snapshot there were 36 setup rows: the original 26 plus ten later Track Trace/Phase 2B QA rows, created after migration installation. This explains the initial whole-table fingerprint difference.

At final verification:

- All **26 original setup rows** remain present and reproduce the original UTC row-content fingerprint exactly: **`1d4e9fae7d1920d689a414a3007d4ed2`**. The digest covers every stored field, including notes/results, relationships and timestamps.
- The original schedule remains identical: **`54813bc201b7a1989fa63c8f81dfddb8`**.
- There are 31 setup rows after concurrent Track Trace QA cleanup: all **31 surviving initial rows** compare field-for-field equal to this continuation's initial snapshot. No surviving initial setup was changed.
- The five removed initial rows are explicitly named `Track Trace QA` / `Phase2B QA`, created at approximately 17:27 UTC. They belong to the separately completed Track Trace verifier's disposable cleanup, documented in `ONLYFAST_2027_TRACK_TRACE_REFINEMENTS.md`. They are not original Phase 1C racing records. Their exact IDs are retained in the investigation artifact.
- All **15 original weekend-clock records** remain identical. Original public weekend IDs and session relationships remain unchanged.
- All public fixtures created by this Phase 2 verifier were removed, and original archive states and synthetic tiers were restored. The exact new map was removed through the verified testing connector because existing authenticated map DELETE policy filters it; policies were retained. Archive audit history and private recovery metadata were preserved.
- Five pre-existing later QA setups and their remaining telemetry were left intact; this continuation did not remove another run's retained records.

Whole-table fingerprints cannot be expected to remain equal while another authorized QA run creates or removes its own disposable rows. The original-cohort digest and the surviving-row comparison establish the original-record preservation separately from that QA churn.

Evidence: `tmp/phase2-hosted-retention-investigation.json`, `tmp/phase2-hosted-original-digest.json`, `tmp/phase2-hosted-originals-final.json`, `tmp/phase2-hosted-retention-current.json`, `tmp/phase2-hosted-retention-final.json` and the full before/after snapshots.

## Security and production isolation

After acceptance, the 11 catalog checks still confirm application-table RLS, restrictive archive policies, twelve-table read/write separation, retained Phase 2B link policies, private-table grant denial and non-browser service/internal RPC grants. Hosted negative tests cover other identities, anonymous access, subscription loss, archived parents and direct-table mutations.

Security advisors: **0 ERROR**, **14 WARN findings** and **11 INFO findings**, unchanged from this continuation's post-install starting state. Existing warnings are 13 authenticated SECURITY DEFINER functions and disabled leaked-password protection; informational notices are RLS-enabled tables without policies, including the three new server-only private archive/class tables. No broad policy was added to silence a notice. The existing Auth warning remains outside this archive acceptance; it is not reported as resolved. See [function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Production isolation independently verified:

- All **24 production Vercel environment records** compare unchanged, including values/scope/update metadata returned by the non-decrypting API.
- Production deployment remains **`dpl_8NFvGedoKHaMQXRpbqmqgAy11yte`**. No production deployment was created/promoted/aliased by this work.
- Vercel deployment protection remains enabled and unchanged. Browser access used a short-lived link scoped to the exact tested Preview.
- GitHub `main` remains **`46f7552adb51dae89bd9d9616be646e39f232c44`**. Only `develop/onlyfast-2027` was pushed.
- Browser traffic used only the testing Supabase project and the Preview application. No production Supabase, RevenueCat, Stripe, store, advertising or purchase endpoint was contacted by the acceptance flow.
- Production Supabase, live billing, advertising/purchasing holds, App Store Connect, Google Play and standalone OnlyLaps were not modified.

## Regression and evidence

| Check | Final result |
| --- | --- |
| Full local `npm run qa:regression` | **769 passed, 0 failed, 0 skipped**: 654 unit, 92 mounted, 23 database suite results |
| Application and Node/config TypeScript | Passed |
| Isolated active testing build | Passed; existing large-chunk warning remains |
| Native PostgreSQL concurrency | **13 assertions passed**; disposable local evidence DB retained |
| Hosted archive/history acceptance | **13 groups passed** |
| Supplemental Edge context acceptance | **5 checks passed** |
| GitHub Actions for tested application commit | **Success**, run 43621627074 |

Local regression report: `tmp/qa-automation/2026-11-14T17-29-45.637Z-a22cf802-c4d0-4b31-ad14-1c67c102561d/report.json`.
Hosted report and screenshots: `tmp/phase2-hosted-browser/report.json` and its adjacent PNG files.
Additional evidence: `tmp/phase2-hosted-edge-acceptance.json`, `tmp/phase2-hosted-production-isolation.json`, `tmp/phase2-hosted-catalog-final.json`, `tmp/phase2-hosted-advisors-final.json`, `tmp/phase2-hosted-concurrency.log`.

Reproduction entry: `qa/automation/phase2-hosted-acceptance.mjs`. It requires the exact testing publishable key, private existing synthetic credentials, reviewed Preview URL and short-lived access, and an installed Playwright module through environment variables. It pauses for a separately verified testing-connector clock update to its exact new fixture; the ready-file setup ID must match. Any deferred map cleanup must be completed through that verified connector before final acceptance is signed off. Credentials, access tokens and browser storage remain outside Git.

Earlier harness attempts exposed stale navigation/filter assumptions, an incorrect fieldset `isDisabled` assertion, and a missing over-quota fixture prerequisite. Those attempts are not counted as passes. The final run corrected the harness, used explicit disposable fixtures and passed every group. Concurrent Track Trace source/report work was preserved; post-commit changes to its documents and verifier were not overwritten or folded into this acceptance report.

There is **no remaining blocker for the requested Phase 2 archive/history hosted acceptance**. Existing testing signup-email/password-protection and AI-provider dependencies, and future live Track Trace GPS/scanning/replay/shared adapters, are separate capabilities and remain unclaimed. No production activation is authorized by this result.
