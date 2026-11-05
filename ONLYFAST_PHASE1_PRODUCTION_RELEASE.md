# OnlyFast Phase 1 production release record

## Verified production state and M3 recursion correction — November 5, 2026

**The M3 sharing-policy recursion is corrected in production.** The exact previously failing owner-share transaction now succeeds. Customer-data fingerprints match before and after. Only the two obsolete permissive setup-through-share policies were removed; no grants, remaining policies, SQL functions, triggers, frontend or Edge Functions were changed by this correction. No unresolved recursion was found in the tested sharing/owner/isolation paths.

### Actual deployment history

| Component | Actual production result |
|---|---|
| M1 membership/sharing expansion | Previously applied as **20261105155821 / phase1_membership_and_sharing**; not reapplied. |
| M2 setup/usage authorization | Applied individually during the preceding continuation as **20261105183638 / phase1_setup_and_usage_authorization**. |
| M3 final access restriction | Applied individually as **20261105184601 / phase1_restrict_legacy_access**. Its owner-share INSERT interaction exposed SQLSTATE **42P17**, `infinite recursion detected in policy for relation shared_setups`. Further changes stopped until the owner authorized this correction. |
| Narrow forward correction | **20261105203732 / phase1_fix_sharing_policy_recursion**, applied November 5 at **12:37:32 PM PST (20:37:32 UTC)** after isolated tests and a fresh exact production-policy comparison. No bulk push or unrelated migration. |
| Frontend | Previously released Phase 1 deployment **dpl_r6cXZXEWkCGxvwWsbWFLQfhV8xRo**, **READY**, serving [OnlyFast](https://onlyfast.app). No frontend redeployment during the correction. |
| Assist / OCR | **get-suggestions v29 / scan-timing-screen v24**, ACTIVE with JWT verification retained. No Edge deployment during the correction; all other function versions retained. |

The preceding Phase 1 cutover used the retained reviewed source export at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-release-R9t3aQ`: **260 source files**, all verified against the prior scoped candidate; exactly **eight** reviewed Phase 1 files differ from production base `494abb981be6ab5808467f526832fea8690b1f9a`, and **252** remain unchanged. The production source upload was independently checked against all 260 hashes. Unrelated local QA, advertising and billing work was excluded.

Assist/OCR were temporarily paused as v28/v23 beginning approximately **18:29:35 UTC**, and the old-worker drain exceeded the documented 400-second paid-plan worker limit before M2. Compatible v29/v24 were deployed by approximately **18:36:59 UTC**; maintenance ended. Original setup payloads/clocks, subscriptions, shares and legacy usage matched the cutover baseline. M2 established 30 owned weekend containers for 93 non-template sessions, left 21 templates without a weekend identity, retained five legacy Assist usage rows and copied four matched stable-identity buckets. One unmatched legacy usage row was retained unchanged; no usage reset or customer reconciliation occurred.

The frontend build completed after an initial scheduling delay. No cancellation or duplicate deployment was issued: Vercel moved to BUILDING before the proposed retry. The production build took approximately 80 seconds after initialization. Public readback verified `/assets/main-BGO7x460.js` contains secure share redemption and owner-scoped queues. CSS remained `/assets/main-BxxoOEC8.css`, SHA-256 `c5059c9351befec97a34e1ee132cec8519e6821eab2d9795bc45717cfe09afe1`, identical to the prior production stylesheet. The code/asset scope and existing activation settings were preserved; no purchase, live ad or paid provider request was issued by these release checks.

### Exact recursion and correction

M3's `phase1_share_owner_write` ownership check reads `race_setups`. The legacy permissive SELECT policies `race_setups_select_via_share` and `race_setups_select_via_unexpired_public_share` each read `shared_setups`, creating a circular RLS expansion during an owner share INSERT. Ordinary owner reads could still pass, which is why the read-only smoke suite alone did not expose this write-path defect.

The forward migration drops **only those two legacy policies on `public.race_setups`**. All M3 restrictive owner checks remain, including the share-to-owned-setup check. Owner SELECT/class restrictions remain. Anonymous table SELECT stays denied. `public.redeem_setup_share` remains an invoker wrapper over the unchanged private security-definer redeemer; valid codes retain the reviewed field projection and expiry/revocation/ownership validation.

Source: `supabase/migrations/20261105202924_phase1_fix_sharing_policy_recursion.sql`, created by Supabase CLI. SHA-256: **ed2c18b67f4dbe934d94867306e5fa16a0ee2d412394f94e6991d30aeb6be5f2**. The platform assigned the actual applied-history version above; no history repair was performed. The transaction checks the reviewed legacy expression hashes and M3/owner prerequisites and fails closed if they differ. A 10-second local lock timeout bounds lock acquisition. There is no data DML, privilege expansion, function replacement, trigger change or destructive rollback.

Immediately before application, **all 16 production policy definitions** matched the reviewed export, including roles, command, permissive/restrictive status, USING and WITH CHECK. Afterward, the exact delta was two removals: the other **14 policies were unchanged**. Nine related SQL functions retained their definition hashes; the inspected owners, ACLs, search paths and security modes also remained unchanged. Membership, quotas and 48-hour locking were not changed.

### Isolated verification before production

`tests/phase1SharingRecursion.mjs` reuses the existing dedicated loopback PostgreSQL harness and staging schema. It recreates the **exact exported production policy set** from `tests/fixtures/phase1-production-sharing-policies.json`, using synthetic users/data only. It never loads application credentials or connects to production.

Native **PostgreSQL 17.11** result: **13 passed, 0 failed, 0 skipped** (12 cases plus their parent). It:

- Reproduced the original 42P17 owner-share INSERT error before correction.
- Proved that leaving either legacy policy in place still recurses, so both removals are necessary.
- Proved that a changed legacy definition causes the migration guard to refuse before applying the correction.
- Verified owner setup create/read/update, owned immutable identity, new share creation, existing-share reads, revocation, expiry and disposable share deletion.
- Verified new/existing valid codes, invalid-code rejection, private-field exclusion, anonymous enumeration/direct-access denial, foreign read/update denial and forged ownership rejection.
- Retained Rookie one-base/two-weekend limits, the 48-hour mechanical lock and allowed annotation path; browser usage mutation/reservation remained denied.
- Compared original synthetic setup/share/subscription rows, all SQL functions and setup triggers before/after.

The first local bootstrap could not connect because the restarted test server used its default port; startup was corrected to its guarded loopback test port before SQL assertions ran. The definitive isolated run above passed before any production correction was attempted.

The existing six disposable database suites also passed **22/22**, with no skips. Changed-file ESLint and tracked whitespace checks passed. Historical M1–M3 fixture tests now name those three migrations explicitly; the new corrective migration is tested separately against the production policy fixture. The staging plan explicitly excludes automatic application of the correction. No broader QA system was rebuilt.

### Production verification after correction

| Check | Actual result |
|---|---|
| Existing QA configuration | **1 passed, 0 failed** using the existing external credential interface. No credential values printed or changed. |
| Normal Auth/read-only QA smoke | **7 passed, 0 failed, 0 skipped**; `test@test.com` identity verified, token refreshed and only the automation session signed out. |
| Targeted read-only sharing checks | **7 passed**: reviewed handler/live RPC redemption, invalid-code rejection, anonymous valid-code projection, anonymous table enumeration denial, authenticated foreign setup/share isolation, foreign tester/feature metadata isolation. |
| Exact previously failing production write transaction | **Passed after correction.** Authenticated QA database-role checks created/read/edited base and weekend setups, linked an owned synthetic schedule, created/redeemed/revoked/expired a new share and deleted a run-created disposable copy. The entire transaction was rolled back. |
| Synthetic cleanup | **Zero synthetic setup rows remain**; no original setup/share was edited or deleted and no permanent QA fixtures were inserted/reset. The transaction check is database-role evidence, not a committed browser/UI save. |
| Customer data / ownership | All before/after aggregate row counts and full-payload fingerprints match; zero inconsistent share/setup owners. See table below. |
| Frontend / Edge state | Same READY frontend ID and active Assist v29/OCR v24; no redeployment or code change during the correction. |
| OnlyLaps | Provider-free status-only check passed through the existing QA suite. QA has no linked telemetry session; actual linked-session/provider/device acceptance is not claimed. |

| Audited data | Before / after rows | Matching fingerprint |
|---|---:|---|
| Race setups, including original timestamps and weekend IDs | 114 / 114 | `5c9c13dd3557b40811eb265ce983a4d4` |
| Subscription rows | 10 / 10 | `49fe3e2dfc69fa616f2daab0b9454221` |
| Shares | 11 / 11 | `cb2c12d1b77424905153d09410f732e4` |
| Assist usage, including retained/stable buckets | 9 / 9 | `2c42c58ad281425119ffdd90643e875e` |
| Timing usage | 0 / 0 | No rows |

These are fresh correction-baseline hashes; the setup digest includes M2's new weekend column and therefore is not directly comparable with earlier pre-M2 digests. The correction contains no statements that modify customer rows. No account, password, subscription entitlement or test permission was changed.

### Evidence, local scope and final status

Evidence: `C:/Users/c_mar/AppData/Local/Temp/onlyfast-policy-recursion-b83e9e830f2d443592630e8f6fc32fa5`. It retains the pre-edit report/plan, reviewed SQL/policy/function export, isolated PostgreSQL log and final verification record. The retained synthetic database is `onlyfast_readiness_recursion_ce81e235956d45a0a0dabf7c939fd733` in the existing dedicated loopback cluster. No customer data was copied into it, and no synthetic database/recovery artifact was deleted.

Production QA reports:

- Configuration: `tmp/qa-automation/2026-11-05T20-39-14.881Z-9a59d8fb-4234-4bc3-a401-d028001c458d/report.json`.
- Smoke: `tmp/qa-automation/2026-11-05T20-39-15.911Z-fe5b6725-e144-4fb6-9188-e6a705c7c5bf/report.json`.
- Existing database suites: `tmp/qa-automation/2026-11-05T20-35-16.796Z-411c7323-7ffb-4d08-981f-cb9312f1952e/report.json`.
- Targeted sharing evidence: `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-final-bee8136d40254db29fe96d788d88e516/sharing-probe-post-m3.json` (latest successful run at 20:39 UTC).

Correction-task files: the new forward SQL, new focused native-PostgreSQL test and data-free policy fixture, the staging exclusion, the two small existing test-sequencing/count adjustments, and this report. Existing application/QA implementation, billing/advertising/native sources, graphics and unrelated uncommitted work were preserved. No commit/push, frontend/Edge deployment, billing/ad activation or Phase 2 work occurred during this correction.

**Final status: the deployed M3 recursion is fixed and the requested RLS/sharing checks pass.** Production is serving normally in the verified Auth, owner data and sharing paths. These checks do not claim real paid AI/OCR, purchase/ad, native-device rendering or a committed browser save test. No remaining blocker was identified for this narrowly scoped policy correction. The historical stop notes below remain as the release chronology and are superseded by this verified state.

## Accepted recovery point for the preceding rollout

The owner manually reconfirmed that the November 5, 2026, **07:55:32 UTC** Supabase physical backup still has a Restore option. This satisfies the agreed availability requirement; no isolated restore demonstration is required. No backup-dashboard navigation will be attempted. This recovery point does not include every subsequent customer write; current aggregate preservation evidence and the reviewed forward-recovery procedure will be used through cutover. Prior backup-verification and QA-session stopping conditions are superseded by this confirmation and the now-working approved QA authentication.

The continuation proceeded from M2 and was followed by the separately authorized narrow policy correction recorded above. No unrelated migrations, combined-checkout deployment, billing/ad activation or Phase 2 occurred.

## Latest continuation — November 5, 2026, approximately 17:34–17:37 UTC

**STOPPED BEFORE PRODUCTION MUTATION: current backup availability could not be independently rechecked in this attempt.** The earlier QA-authentication blocker is resolved. No new maintenance window, migration, Edge deployment, frontend promotion, commit or push occurred during this continuation. The prior release outcome remains M1 only. The historical execution sections below describe the earlier attempt and are superseded by this section for the current stopping reason.

### Verification actually completed

| Item | Fresh result |
|---|---|
| Existing QA configuration | `npm run qa:check -- --env production`: **1 passed, 0 failed** using the existing external credential file; credential values were not printed. |
| Normal QA authentication and read-only smoke | `npm run qa:smoke -- --env production`: **6 passed, 0 failed, 1 skipped**. Report records `authenticated_and_verified` and `local_session_disposed`. No fixture mutations/reset were enabled. |
| Prior successful smoke report | `tmp/qa-automation/2026-11-05T17-30-20.872Z-2e8d6cc6-8b2d-4af9-9013-3c711dc302a2/report.json`: same 6/0/1 result. |
| Skipped check | **OnlyLaps live status-only request**, because the optional Edge-read approval was not enabled. This is not a pass; no live linked-session/provider acceptance is claimed. |
| Migration history | Same 12 prior entries plus **20261105155821 / phase1_membership_and_sharing (M1)**. M1 was not reapplied; M2/M3 are absent. No migration history was changed. |
| M1 functionality | Membership and redemption RPCs exist; fresh authenticated smoke passes trusted Team membership, owned setup/schedule/share reads and invalid-code redemption. QA owns 15 setups (all older than 48 hours), two shares and zero schedule rows. |
| M2 preliminary prerequisites | M1 private/public/service helpers exist. Private weekend/request tables and the public weekend column remain absent. Both reviewed setup triggers are enabled with the expected definitions. Full schema/artifact integrity comparison was not completed before the stop; this is not a claim that every deployment prerequisite passed. |
| Ownership/data inventory | Read-only aggregate inspection: 114 setups, 10 subscription rows, five Assist usage rows, zero timing usage rows, zero mismatched setup/schedule owners and zero mismatched share/setup owners. No customer payload was returned. No data mutation was issued. |
| Current production frontend | **READY**, `dpl_GLzaxvX6vWkDsgDxJLnt459RbTLH`, commit `494abb981be6ab5808467f526832fea8690b1f9a`; `onlyfast.app` still points to this deployment. |
| Existing scoped candidate | `dpl_EtcyQGeUE5WBG7PWCVZNXL8fG2R7` remains **READY**, project `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`, URL `onlyfast-e4xbquyru-apex88vents-projects.vercel.app`. Retained source export/manifest identified at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-release-R9t3aQ`; no promotion or new build occurred. Exact artifact revalidation remains required before cutover. |
| Current Edge Functions | Original-source **get-suggestions v27**, **scan-timing-screen v22**, both ACTIVE with JWT verification retained. Other function versions were not changed. No old writer drain began. |
| Local work | Primary main checkout and `Apex88Vent/onlyfast` remote verified. Existing QA, advertising/billing and release changes preserved. Only this release record was updated in this continuation. |

Fresh redacted evidence:

- Configuration: `tmp/qa-automation/2026-11-05T17-34-14.868Z-0a55963c-f47e-49ff-a937-25aecff51e19/report.json`.
- Authenticated smoke: `tmp/qa-automation/2026-11-05T17-34-15.785Z-bfb1fa98-a69b-41ed-b995-657014c1a20f/report.json`.

### Specific stopping condition and next step

The owner-confirmed November 5, 2026, **07:55:32 UTC** daily physical backup remains the previously accepted recovery point. The isolated restore demonstration remains waived; it was not reinstated. The new request also requires verifying a currently available recovery point before proceeding.

The Supabase connector exposes no database backup-inspection tool. Native browser inspection identified an existing Supabase Backups tab, but **automatic approval review stopped selecting it because Computer Use could not determine the current browser URL on Windows with enough confidence to enforce policy**. Computer input ended immediately. No backup information was read from that tab, no new backup was created, and Restore was never clicked. This failure does not establish that a backup is missing; current availability simply was not reverified in this attempt.

To continue this same release, obtain the owner's current confirmation of the available backup timestamp and Restore availability, or an approved supported read-only verification route. No tested restore is requested. Then complete the outstanding schema/artifact preflight and proceed from M2 under the documented drain, compatible Edge/frontend and M3 sequence. Do not reapply M1, deploy the combined main checkout, weaken policies or make a destructive rollback. Outdated-client sharing compatibility is accepted and is not the stopping reason.

Production continues serving its existing frontend and original Edge functions, with authenticated QA reads operational. **The Phase 1 security release is still incomplete.** Setup writes, Rookie/Pro boundaries, live Assist/OCR, schedule linking, OnlyLaps, valid-code sharing after M3 and offline/browser/device flows were not newly accepted in this continuation. No paid provider calls, purchases, live ads, customer-data mutations or Phase 2 work occurred.

## Owner-confirmed backup

The project owner confirmed in this chat that Supabase project `thpyjvwtfvfxiufchrxn` has automatic daily physical database backups. The latest displayed backup is **November 5, 2026 at 07:55:32 UTC**, previous daily backups are also available, and each displayed backup has a Restore option.

Source: the project owner's manual dashboard inspection. This records availability and a recovery option; it does not claim an isolated restore has been executed or independently verified by this agent.

No additional backup through browser automation and no production Restore action is authorized or attempted for this release pass.

## Release scope and initial state

- Requested scope: the three Phase 1 migrations individually, coordinated Assist/OCR Edge functions, compatible Phase 1 frontend and focused verification.
- Outdated-client sharing compatibility loss is explicitly accepted. Insecure table permissions must not be retained for that compatibility.
- Preserve customer data, subscriptions, OnlyLaps, UI, billing and advertising; no unrelated migrations or Phase 2.
- Primary checkout on `main`, clean at start; HEAD, local `origin/main` and freshly queried remote main all equal `b03148f28372e0c6b4577a1cc9363b573baff7dd`.
- That commit contains both Phase 1 and earlier advertising work. A full deployment of this commit is not assumed to meet the requested release scope.

## Execution status

**PARTIALLY RELEASED — STOPPED ON THE OWNER'S APPROVED-QA-SESSION GATE.**

### Actual release outcome

The owner removed the isolated-restore requirement and accepted the confirmed daily backup. M1 was then applied, and a scoped frontend preview was prepared. During the coordinated Edge drain, the owner identified `c_marin88@yahoo.com` as the proposed QA account and explicitly required stopping if it could not be safely verified or authenticated through an existing approved session. Its identity and permissions were verified, but no approved authenticated session was accessible to the agent. Assist/OCR were restored to their original source before stopping. M2, the production frontend and M3 were not released.

| Item | Actual result |
|---|---|
| M1: `20261105090932_phase1_membership_and_sharing.sql` | **Applied alone and successfully**, with the exact approved SHA-256 below. Supabase recorded it as **20261105155821 / phase1_membership_and_sharing**. |
| M2: `20261105090937_phase1_setup_and_usage_authorization.sql` | **Not applied**. |
| M3: `20261105091108_phase1_restrict_legacy_access.sql` | **Not applied**. |
| Production frontend | **Not deployed or promoted**; production remains deployment `dpl_GLzaxvX6vWkDsgDxJLnt459RbTLH`, commit `494abb981be6ab5808467f526832fea8690b1f9a`. |
| Scoped preview | **READY**, deployment `dpl_EtcyQGeUE5WBG7PWCVZNXL8fG2R7`, [preview URL](https://onlyfast-e4xbquyru-apex88vents-projects.vercel.app/). Deployment protection remains enabled. |
| Assist/OCR Phase 1 bundles | **Not activated**. The temporary maintenance bundles were replaced by their original source after the new QA-session stop instruction. |
| Unrelated migrations, billing/ad activation, Phase 2 | None. |

The migration tool assigned M1's actual history timestamp; the prepared file timestamp was not substituted into history. Final history contains the same 12 prior entries plus M1 only. No history repair or bulk migration push occurred. The private weekend and request-ledger tables remain absent, confirming M2 did not run.

### Edge maintenance and service restoration

| Function | Original version | Temporary maintenance | Final active version |
|---|---:|---:|---|
| `get-suggestions` | 25 | 26 | **27 — original source restored** |
| `scan-timing-screen` | 20 | 21 | **22 — original source restored** |

The planned drain returned 503 for new Assist/OCR work from approximately 15:58:50 UTC until restoration completed by 16:01:27 UTC, about 2 minutes 35 seconds. The owner supplied the QA-account restriction during that drain. M2 had not run, so restoring the original quota protocol was compatible with the unchanged usage schema and removed maintenance safely.

Fresh function exports matched **every original source file exactly**, including OnlyLaps and beta helpers. Both final deployments report ACTIVE and retain `verify_jwt=true`. Their platform-generated bundle hashes changed during redeployment; exact source restoration is established, not binary-bundle identity. Unsigned POSTs return 401 for both functions. No provider calls were issued by these checks. No OnlyLaps endpoint or RevenueCat webhook/sync function was deployed.

### Approved QA verification and specific blocker

Read-only inspection of `c_marin88@yahoo.com` confirmed:

- The Auth account exists, is not deleted and is not banned.
- Its stored subscription remains **Pro / active / Stripe**.
- It is an experimental tester with beta master access and `test_account_full_access` enabled, retaining effective **Team** access.
- **No enabled `test_account_reset` flag exists.** The documented experimental reset-on-login/logout path requires that flag; it is absent for this account.
- It owns **31 existing setups**. An authenticated database-role readback sees all 31; `list_user_setup_summaries()` also returns 31; the trusted tier RPC returns Team.

These are database-role checks, not a Supabase Auth sign-in. The accessible in-app browser displayed the public sign-in form, and no approved authenticated session was available. Chrome was not exposed as a connected browser session. No account password was requested or exposed, and no login/logout was performed. None of the account's setups was edited or deleted.

An earlier M1 smoke check for the previously designated QA identity retained its Team tier and 15 visible setups. Once the owner instructed not to use `test@test.com`, it was not used again. Its web login/logout was never cycled during this release pass.

**The stopping reason is the owner's approved-session condition.** The backup/isolated-restore gate remains removed. Outdated-client sharing compatibility is accepted and is not the stopping reason.

### Scoped frontend and verification evidence

The preview is an artifact export of the actual production commit with only the reviewed Phase 1 patch applied. It is not another Git checkout/worktree. Exactly these eight files differ from production:

- `src/components/AppLayout.tsx`
- `src/components/HandlingFeedback.tsx`
- `src/components/SavedSetups.tsx`
- `src/components/ScanTimingScreen.tsx`
- `src/components/SetupDashboard.tsx`
- `src/components/ShareSetupModal.tsx`
- `src/components/ViewSharedSetupModal.tsx`
- `src/lib/offlineQueue.ts`

The other **252 deployment files** match the production base, including billing/ad implementation, styles and assets. All **53 unique PNG assets** passed Vercel digest checks. Preview and production reference the identical stylesheet `main-BxxoOEC8.css`. Later billing/advertising work in local main was excluded and preserved. The final production HTML still references its original `main-CGeSD5bQ.js`, confirming no frontend cutover.

| Verification | Result |
|---|---|
| Scoped frontend TypeScript | Passed, exit 0. |
| Scoped production build | Passed; existing large-chunk warning remains. |
| Focused offline/security/authorization/OnlyLaps tests on the scoped artifact | **35/35 passed**. |
| Disposable database suites against the approved SQL | **22/22 passed**. |
| Remote preview build / HTTP | READY / 200. |
| M1 authorization | Existing QA membership/setup visibility retained; invalid code returns null; service-only membership RPC grants and anonymous redemption execute privilege verified. |
| Approved QA owner readback | 31 setups and 31 summaries; effective Team access retained over its active Pro subscription. |
| Restored functions | Exact original source, ACTIVE, JWT verification retained; unsigned requests rejected. |
| Real login/logout | **Not run: no accessible existing approved authenticated session**. |
| New production save / Rookie boundary / paid UI flows | **Not run after the stop instruction**. Isolated tests are not production end-to-end evidence. |
| Live Assist provider / timing OCR / OnlyLaps UI flow | **Not run after the stop instruction**; original source was restored. |
| Final secure table restriction and full sharing acceptance | **Incomplete: M3 not applied**. M1 redemption exists, but legacy direct-read exposure remains. |

### Customer-data preservation

Aggregate counts and original-payload fingerprints before M1 and after Edge restoration match exactly:

| Data | Before/after count | Matching fingerprint |
|---|---:|---|
| Race setups | 114 | `ab028d37fdb3a95a4d79d526fc5e8651` |
| Subscription rows | 10 | `8e55f6c6721ecdcca99b6c6692776c24` |
| Share rows | 11 | `8cc4ed4d3e9124afc23cb4ac50b905d0` |

The share digest excludes the additive `revoked_at` column; all original share fields are included. The setup digest excludes the proposed weekend column, which remains absent because M2 did not run. Assist usage remains **5 rows**, timing usage **0 rows**. Only aggregate digests/counts were returned, not customer setup payloads.

No setup/subscription data was modified, no quota/ownership record was deleted/reset, and no backup restore occurred. The live frontend appearance, billing and advertising remain unchanged. Existing local changes, worktrees, branches and recovery evidence were preserved. Only release documentation changed in the primary checkout; no commit/push occurred.

### Recovery evidence and next permitted step

The retained artifact/evidence directory is `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-release-R9t3aQ`. It contains the production-base archive, scoped source/manifest, build/focused-test logs, original database function definitions and Edge source, integrity digests, prior release record and final public-web readback. The database-suite log is `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-release-database.log`. Nothing was deleted.

M1 remains installed as a verified expansion. Do not drop its RPC/columns or reopen grants as a rollback shortcut. M2 never ran, so original Edge source was restored against its original usage schema. No automatic production backup restore is authorized.

**Required to resume:** an existing approved authenticated session for `c_marin88@yahoo.com` must be available for the requested non-destructive smoke tests. Do not request passwords or use `test@test.com`. Recheck current history/schema, recognize M1's actual recorded version, then coordinate a fresh drain, M2, compatible Edge/frontend and M3 in order. Do not blindly reapply M1 or run bulk migrations. The isolated-restore requirement remains removed. Do not start Phase 2.

### Historical pre-cutover notes (superseded by the actual outcome above)

The latest owner instruction accepts the confirmed November 5, 2026, 07:55:32 UTC daily physical backup and its Restore option as the recovery safeguard, accepts proceeding without a tested restore, and removes the isolated-restore demonstration from the release gates. The owner has reconfirmed this backup availability in the current release authorization. No independent backup inspection through the connector is claimed: it exposes no backup-management command. No browser backup attempt or production Restore will be used. The historical stopping decision below is superseded by this explicit revision.

The current release will use the approved migrations individually and only Phase 1 frontend/Edge changes. Compatibility loss for outdated sharing code remains accepted. Recovery will favor compatible forward fixes and retain identities/usage; a production backup restore would require its own explicit incident decision because it replaces later writes.

### Historical pre-revision backup gate (superseded)

The owner's confirmation resolves the earlier inability to establish backup availability. The automatic physical backup and its displayed Restore option are accepted as owner-confirmed facts. No additional browser verification was requested or attempted, and production Restore was not clicked.

Step 1 of `ONLYFAST_PHASE1_RELEASE_READINESS.md` defines its success criterion as: **“An operator demonstrates a restore into isolation and catalog diffs match reviewed prerequisites.”** Its failure criterion explicitly includes missing restore proof. The recovery section also requires rehearsing restores into isolation before production mutation.

This is a criterion of the previously prepared OnlyFast release plan, not a universal Supabase requirement to test a restore before every migration. Current official [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) describes daily physical backups and restoration, but does not establish that this project's backup has been test-restored. A visible Restore option establishes the recovery operation's availability, not successful isolated recovery.

No completed isolated restore or restore-validation record was found in the reviewed project evidence. Connected project enumeration returned only the production OnlyFast project. Branch enumeration returned only its default main branch, with the historical `MIGRATIONS_FAILED` branch record; the production project itself reports `ACTIVE_HEALTHY`. No isolated restored destination was available to validate. Previous synthetic schema rebuild/concurrency tests are not a restoration of this physical production backup.

No new project, paid restore destination or branch was provisioned, and no production restore was attempted. The specific unmet prerequisite is evidence of an isolated restore of a relevant production backup, with customer setup/subscription integrity and schema verified. The owner's statement confirms availability only and does not state that this restore drill occurred or waive the documented drill criterion.

### Fresh production preflight

- Project ref/name: `thpyjvwtfvfxiufchrxn` / OnlyFast; `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.111`.
- Migration history remains the same 12 entries reviewed previously, ending at `20261017000856 secure_membership_authorization`. None of the three Phase 1 files is applied. No history repair or bulk migration command was executed.
- `guard_development_setup_library` and `race_setups_touch_updated_at` are the two non-internal setup triggers, both enabled (`O`), with the reviewed function targets/events.
- Existing membership/class/summary helper signatures and return types match the reviewed preflight. Private unlimited-vehicles authority and required schedule/tester/feature/usage tables exist.
- Phase 1 private weekend/request tables and redemption/reservation RPCs are still absent as expected before expansion.
- Fresh metadata covers the same 112 columns in `race_setups`, `shared_setups`, both usage tables and `user_subscriptions`. Comparison with the prior reviewed metadata found no added/missing columns or changes to types, nullability or defaults.
- No customer rows were fetched for this preflight. Catalog checks do not claim authenticated customer workflows have passed.

Reviewed migration SHA-256 values remain unchanged:

| Order | File | SHA-256 |
|---|---|---|
| 1 | `20261105090932_phase1_membership_and_sharing.sql` | `92bc43a20b65d5496719b562c1024c61909900ab3fd9dac0e0c77e04f4f00e2a` |
| 2 | `20261105090937_phase1_setup_and_usage_authorization.sql` | `ab0afe702c5c8ae3e0fd53bc4464161f2d9bb1ece1c1de8340fabe28e1735a9a` |
| 3 | `20261105091108_phase1_restrict_legacy_access.sql` | `8013a54216a8e9059714dfc072111c353a2363314754d054b6b25a5d03d38520` |

### Exact release outcome

| Item | Result |
|---|---|
| Membership/sharing expansion (M1) | Applied later as 20261105155821; see actual outcome above |
| Setup/usage authorization (M2) | Not applied |
| Final sharing/security restriction (M3) | Not applied |
| Assist/OCR Edge Functions | Temporary maintenance and original-source restoration; see actual outcome above |
| Frontend | Preview only; no production deployment |
| Focused post-release checks | Not run; no release occurred |
| Authentication, saves/loads, subscriptions, timing, Assist, OnlyLaps | No new production end-to-end verification claimed |
| Production data, setups, subscription records, billing, advertising and UI | No mutation or deployment performed |
| Git | No commit/push; only this release record was added locally |

Existing committed work, branches, worktrees and recovery evidence were preserved. Outdated-client sharing incompatibility is accepted and is not the stopping reason. Production permissions were neither changed nor deliberately retained as a compatibility workaround; execution stopped before the first approved migration because the documented recovery gate remains unverified.

The owner subsequently removed the isolated-restore requirement. The actual release and remaining QA-session gate are recorded above. A future resume must recheck current schema/history and release only Phase 1, excluding unrelated advertising changes in the current combined commit.
