# OnlyFast Phase 1 security report

**November 5, 2026 · Local implementation and review artifacts · main**

## A. Executive summary

Phase 1 adds owner-bound, durable offline saves, code-based share redemption with a reviewed field projection, stable server-owned weekend identities, atomic usage reservations, direct-write guards, and a common database membership authority.

The implementation and SQL have been exercised locally. Production received schema/history reads only. Production security behavior will change only after a separately approved release and migration sequence.

| Audit finding | Status | Local result and activation dependency |
|---|---|---|
| D1, offline ownership | **FIXED LOCALLY** | New queue entries carry the original owner and stable row ID. Owner-scoped replay, separate storage keys, retry recovery and account-remounted drafts prevent automatic cross-account reassignment. Requires frontend release to reach users. |
| D2, Assist identity | **PREPARED — NOT DEPLOYED** | Edge requests resolve an owned saved session to an immutable weekend ID. Display names are never quota identifiers. Requires expansion/usage SQL and Edge release. |
| D3, sharing | **PREPARED — NOT DEPLOYED** | Owner-only direct table access plus a code-validated, field-projected redemption RPC. Requires compatible viewer and final enforcement migration. The live schema concern was confirmed through metadata. |
| D4, Rookie restrictions | **PREPARED — NOT DEPLOYED** | Database guards cover original ownership, active class, one base, two saved weekends, immutable lock clocks and direct mechanical edits at 48 hours. Existing rows remain. Annotation details and legacy grouping require release review below. |
| E1, quota concurrency | **PREPARED — NOT DEPLOYED** | Database reservation/finalization serializes per account, counts outstanding work, records successful responses and releases failures. Requires usage SQL plus Edge release. |
| E9, membership consistency | **PREPARED — NOT DEPLOYED** | Both paid API endpoints use the same database authority as RLS and existing trusted membership. Verified app grants, admin/testing access and expiry are retained. Existing trusted client resolution remains in place. |
| E14, membership probing | **PREPARED — NOT DEPLOYED** | Legacy public membership/class signatures are owner-scoped. Arbitrary-user service entry points are restricted to service_role. Requires membership expansion SQL. |

The completed audit report remains unchanged. Prices, numerical tier limits, Median stock paywall and advertising policy were outside implementation changes.

## B. Vulnerabilities investigated

Reviewed the complete audit, then traced queue serialization and replay, workspace restoration, normal save and session insertion, sharing UI and RLS, Assist and OCR request handlers, membership derivation, subscription/class helpers and migration dependencies.

The primary checkout was `C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast`. Branch `main` and remote `Apex88Vent/onlyfast` were verified. The starting commit was `d4c07efa644c3f28e107932d857c818013976eb7` and the remote main ref matched at preparation.

A rollback snapshot was created before edits at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-rollback-4954lj`. Its manifest records 702 project files, SHA-256 values, initial Git status and commit. The committed package cache was excluded from the copy and left intact. This met the requested rollback requirement while keeping the primary branch and existing worktrees.

The initial automated baseline reproduced **487 passing tests out of 488**, with the historical iOS bridge assertion failing. Existing local advertising/native work was preserved.

## C. Confirmed vulnerabilities and production evidence

**D1.** The prior queue had a device-global array without authenticated owner metadata. Replay explicitly replaced `user_id` with the current account. Nonnetwork failures were removed from the queue. New inserts lacked a durable ID before the first network attempt.

**D2/E1.** Assist accepted arbitrary weekend key strings. Assist and timing checked quota and later recorded usage through separate reads/upserts, with a provider call between them. Retrying or overlapping requests could consume work beyond the intended boundary.

**D3.** Read-only queries against project `thpyjvwtfvfxiufchrxn` found public/unexpired share SELECT policies, table SELECT grants for anon and authenticated, and multiple permissive setup-through-share policies. Share rows include `shared_by_email`. Those grants and policies permit enumeration of eligible public records without presenting a code. This review established the authorization condition using catalogs and function definitions, without enumerating customer share records.

**D4/E14.** Live metadata showed class helper signatures that accept an arbitrary UUID and public role grants on affected helpers. The subscription tier helper lacked an owner predicate. Live setup triggers were the development-library guard and timestamp touch trigger, with no Phase 1 count/time guard. Both roles had broad grants on affected tables, including privileges such as TRUNCATE that are independent of row filters. No destructive privilege was exercised in production.

**E9.** The client already uses server-owned subscription rows and verified app metadata. The two Edge tier resolvers duplicated database logic. Phase 1 replaces that duplication at the API authorization boundary and tests parity against database fixtures.

Production history differs from repository filenames and the newest local schema. The metadata listed RevenueCat/expiration/secure-membership migrations under `20261017000811`, `20261017000836` and `20261017000856`. The repository's restore-onboarding and enable-road-racing migrations were absent from that history, and the corresponding setup vehicle trigger was absent from the inspected trigger list. This is a release preflight condition. Phase 1 does not authorize rolling out those separate feature migrations.

## D. Vulnerabilities fixed locally

### Offline save and account isolation

- New entries use version 2, original `ownerId`, original `payload.user_id`, a stable setup UUID and a distinct storage key per owner/session row.
- The operation is stored before the request. A lost insert response is recovered by finding the exact owned row ID and applying the latest queued values to that row. Retrying does not allocate a second setup.
- Queue reads, counts, replay and acknowledgments are owner-scoped. Auth identity is checked before replay and database writes. Updates include an owner filter.
- Failed auth, network and policy requests remain pending. Removing an acknowledged older snapshot preserves a newer queued edit of the same row.
- In-process drains coalesce. Web Locks serialize cross-tab drains where supported. Separate storage keys prevent one tab from replacing another operation through an array read/modify/write. Stable row IDs also protect insert retries when Web Locks are unavailable.
- Account changes remount the workspace, and drafts use an account-specific storage key. Legacy global drafts and queue data remain stored.
- Entries without trustworthy version-2 owner metadata are quarantined from automatic replay and UI data. Phase 1 deliberately does not infer ownership from a legacy payload's `user_id`.

Legacy recovery needs an explicit owner-verification process. Neither sign-in nor sign-out claims or deletes unknown entries. Storage write failure reports save failure before issuing a write, so the application cannot report a durable queued save that was never stored. This is an intentional integrity tradeoff for storage-denied/full environments.

### Sharing

The viewer calls `redeem_setup_share` and has no fallback to direct public table reads. The server verifies the exact eight-character code, share status, expiry/revocation and that the share owner owns the referenced setup.

A fixed allowlist covers the setup fields represented by the current schemas. Owner identity, email, storage IDs, coordinates, timestamps, schedule/weekend IDs and timing metadata are omitted. Notes and user-authored custom setup values remain intentional shared content. Future physical columns do not automatically become public.

The owner-facing share dialog reuses only a valid public share, uses cryptographic random input for new codes and stops writing owner email into new share rows. Existing valid codes are retained. Expired, private and revoked codes do not redeem.

### Assist and timing quotas

The server derives the identity from an authenticated user's saved setup. New clients always send the actual saved-session ID independently of whether OnlyLaps telemetry is enabled. The legacy compatibility RPC can resolve an owned saved name only when it refers to one immutable weekend. Unknown and ambiguous labels cannot create quota buckets.

Both APIs now reserve a slot before provider work. Successful processing atomically finalizes usage and caches the result. A repeat request ID with the same payload returns the cached response, while a different payload conflicts. Outstanding reservations count against the Rookie limit.

Provider failure, malformed output or timeout releases the slot. Interrupted workers have a two-minute database lease. A new attempt gets a different token, preventing an old worker from finalizing the replacement attempt. Assist has a 60-second provider timeout and OCR retains its existing 30-second provider timeout.

Limits remain **one Assist per weekend** and **two timing scans per UTC month** for Rookie. Paid/admin/approved tester access remains unlimited. The existing server-configured endpoint admin email exemption is preserved and derived from the verified user. Browser roles cannot call reserve/finalize RPCs or change usage counters.

Client retries retain request IDs within the current action/batch. Older callers without a request ID receive a server-generated ID and still pass the same quota guard, but cannot retrieve a lost response by that generated ID.

### Membership and Rookie writes

A private database resolver retains the reviewed membership precedence. Public legacy UUID helpers are restricted to the signed-in owner, while service-only APIs receive the verified Auth user ID from Edge. Browser metadata is excluded from privilege decisions.

Setup guards serialize by owner and use that authority. They preserve existing records above a limit, while checking new inserts. One base template and two distinct saved-weekend containers are enforced for Rookie in the active class. The current save-screen two-name check is also retained, so repeating a name on another date cannot collapse the weekend limit.

Weekend identity follows the existing saved-race model using owner, class and linked schedule ID, then track/date, with name as a fallback for incomplete legacy rows. A saved row's identity and creation clock are immutable. Renaming and subsequently adding sessions to a linked event reuse the existing container. Schedule links must belong to the same owner.

At and after 48 hours, mechanical content changes and new sessions in that weekend are blocked for Rookie. Viewing and deletion remain available under the existing class rules. The existing direct annotation paths for session labels/order, timing data and schedule links remain permitted. Pro removes the age/count restriction, Team preserves multi-class access, and server grants/test exemptions are retained.

## E. Protections requiring database changes

All database protections are pending review and deployment. Local fixture success does not establish that they are active for production customers.

| Data area | Prepared change | Data preservation |
|---|---|---|
| `race_setups` | Add `race_weekend_id`, owner/class/count/time trigger and owner-only direct reads | Existing setup payload, original created/updated timestamps and legacy rows are retained. Existing over-limit rows remain viewable/editable subject to normal age/class rules. |
| `shared_setups` | Add optional expiry/revocation columns where missing and restrict direct reads/writes | Existing valid codes and owner rows remain. New RPC projects public content. |
| `onlyfast_private.setup_weekends` | Server-owned stable identity and original lock clock | Existing rows receive an identity without rewriting chassis/session data. |
| `setup_assist_usage`, `timing_scan_usage` | Remove browser mutations, retain owner reads and service writes | Existing usage rows stay. Matching legacy Assist consumption is copied to the stable identity using the maximum existing count. |
| `onlyfast_private.usage_requests` | Atomic reservation, token, lease and response cache | Owned by Auth identity and inaccessible to browser roles. Auth deletion cascades. |
| Membership/class functions and ACLs | Owner checks and service-only internal resolution | Subscription rows, RevenueCat ownership and approved grants are retained. |
| Source bootstrap | Owner-only direct share/setup policy declarations | Public redemption is installed by the reviewed migration, not a public-table filter. |

The backfill is transactional. It checks the two known trigger names/states, briefly disables the timestamp/development validators while changing identity metadata, and restores them in the same transaction. A missing or disabled known trigger fails preflight; any additional triggers still require manual comparison with the production export. This avoids changing recency or rejecting valid retained development sheets during operator backfill. Application writes remain outside this maintenance transaction.

## F. Exact files modified

Changed existing files relative to the saved pre-Phase-1 working state are listed below. Some already contained local changes at the start.

| File | Phase 1 change |
|---|---|
| `SUPABASE_SETUP.sql` | Owner-only bootstrap sharing reads and migration guidance |
| `src/components/AppLayout.tsx` | Workspace key follows authenticated identity |
| `src/components/SetupDashboard.tsx` | Durable owned writes/replay, scoped drafts, stable IDs and weekend-aware preflight |
| `src/components/SavedSetups.tsx` | Added sessions retain the parent's weekend identity |
| `src/components/HandlingFeedback.tsx` | Validated session ID and retry identity, server-authoritative quota response |
| `src/components/ScanTimingScreen.tsx` | Stable per-image request ID across retries |
| `src/components/ShareSetupModal.tsx` | Valid existing shares, cryptographic code input, no new email copy |
| `src/components/ViewSharedSetupModal.tsx` | Code redemption RPC |
| `src/lib/offlineQueue.ts` | Owner-partitioned durable storage and serialized replay |
| `supabase/functions/get-suggestions/index.ts` | Trusted membership, saved identity, reservation/finalization/release |
| `supabase/functions/scan-timing-screen/index.ts` | Same atomic quota protocol around existing OCR processing |
| `supabase/staging/plan.json` | Explicitly holds the three review-only Phase 1 migrations out of the legacy staging sequence |
| `tests/nativeAds.test.ts` | Save harness supports write-ahead operations and retained failures |
| `tests/setupAssistOnlyLapsIntegration.test.ts` | New quota contract while retaining beta telemetry checks |
| `tests/setupAssistTrackUpdates.test.ts` | New authorization dependency/session fixtures, existing response assertions retained |
| `tests/stagingDatabase.mjs` | Checks explicit Phase 1 exclusions separately from account-specific migrations |
| `tests/subscriptionServerAuthorization.test.ts` | Trusted RPC contract and client/database precedence fixtures |

New files are the shared Edge module `supabase/functions/_shared/usage-authorization.ts`, the three SQL files in §G, the three tests in §H, and this report. No application dependency, price, native billing source, ad controller, asset or stylesheet was changed by Phase 1.

## G. Database migrations prepared, not deployed

| Order | File | Purpose and activation |
|---:|---|---|
| 1 | `supabase/migrations/20261105090932_phase1_membership_and_sharing.sql` | Expand share RPC/columns, constrain membership helper APIs and expose service-only membership resolution. Direct share reads remain until step 3. |
| 2 | `supabase/migrations/20261105090937_phase1_setup_and_usage_authorization.sql` | Stable identities, legacy usage snapshot, write guards, summaries, atomic request ledger and service-only quota protocol. Requires coordinated Edge cutover. |
| 3 | `supabase/migrations/20261105091108_phase1_restrict_legacy_access.sql` | Activate owner-only direct setup/share access and least-privilege table grants after the RPC viewer is verified. |

The Supabase CLI created these migration filenames. The CLI was run as temporary tooling through npm's cache and was not added to application dependencies. Its commands created files only.

No hosted migration application, repair, history write, configuration change or Edge deployment was executed. Existing staging preparation explicitly excludes these steps until review. The dedicated Phase 1 database suite applies them explicitly to disposable fixtures in order.

## H. Tests added and updated

- `tests/offlineQueueSecurity.test.ts` exercises original-owner replay, A→B→A, retained legacy entries, multiple operations, expired sessions, failure/retry, overlapping drains, storage failure and actual insert recovery after a lost response.
- `tests/usageAuthorization.test.ts` runs the actual Assist/OCR handlers with mocked infrastructure and the actual shared authorization helper. It checks response replay, duplicate payload conflicts, provider failure/timeout/malformed output, release/finalization, forged body user IDs and foreign/unknown session rejection.
- `tests/phase1Database.mjs` executes the SQL with real PostgreSQL/WASM roles, RLS and functions. It checks public enumeration denial, valid/invalid/expired/private/revoked codes, projection, foreign records, membership probing, grants/expiry, count/time boundary, schedule ownership, duplicate and expired reservations, paid access, legacy consumption and unchanged stored payload/timestamps.
- The same database suite includes a production-shaped migration fixture that omits the two locally newer feature migrations. It preserves an approved tester's development sheet without releasing onboarding or development classes.
- Existing response-format, OnlyLaps, native advertising save-harness and staging tests were adapted to the new security boundary. The historical iOS test was retained.
- Final verification added `tests/phase1Postgres.mjs`, an opt-in native PostgreSQL suite guarded by a dedicated loopback cluster identity. It verifies actual multi-connection advisory-lock waits, concurrent quotas/saves, interrupted transactions, expiry, ownership, sharing and migration rollback. It never loads application credentials.

The tests use synthetic identities and mocked providers. They do not spend OCR/AI credits or make store/ad transactions.

## I. Test results before and after

| Check | Before | After |
|---|---|---|
| Default automated suite | 487/488 initially; Phase 1 baseline 499/500 | **500 passed / 501**, no skips. Only the reproduced historical iOS assertion failed. The added test covers a committed save retried after its lock. |
| Existing database suites plus Phase 1 | Phase 1 baseline 21/21 | **22/22 passed**, including the additional forged-base-identity regression and the production-shaped fixture, membership, RevenueCat, onboarding, library and staging suites. |
| Native PostgreSQL multi-connection and migration suite | Previously unavailable | **15/15 passed** (14 subtests plus parent) on disposable PostgreSQL 17.11, including observed advisory-lock contention and failure/rollback tests. |
| Focused authorization/offline/OnlyLaps tests | Included in automated baseline | **35/35 passed**; a subset of the default suite, not additional unique tests. |
| App and Vite config TypeScript | Passed | Both passed. |
| Isolated production build and release module verification | Passed, large chunk warning | Passed in a fresh system-temp output directory. Release environment/module checks passed. Existing >500 kB chunk warning remains. |
| ESLint on changed TS/TSX and test files | 111 errors / 9 warnings before Phase 1; 101/8 before final verification | **101 errors / 8 warnings**, all matched existing rule/message findings. New helper and security tests lint cleanly. No new findings. |
| Supplemental Edge TypeScript with local runtime/remote SDK declarations | Existing OnlyLaps TS2322 at `onlylaps-setup-context.ts:323` | Same single pre-existing TS2322. No additional diagnostics with the same local declarations. |
| Tracked whitespace check | Existing work preserved | Passed. Git still prints existing CRLF conversion notices. |

The global audit lint baseline was 415 errors and 97 warnings. Changed-file lint is compared to exact original file snapshots to distinguish these existing issues from new ones. No unrelated lint fixes were made.

The historical failure at `tests/iosReleaseBridge.test.ts:43` still expects `NATIVE_PURCHASES_READY` false while the selected stock billing readiness is true. Phase 1 leaves that historical integration and assertion for its own review.

Docker's daemon remained unavailable. Final verification instead used a temporary loopback PostgreSQL 17.11 cluster with independent TCP connections, synthetic data and the production-shaped fixture. Actual advisory-lock waits were observed, and concurrent reservations/finalizations and saves passed. Production metadata reports PostgreSQL 17.6, so this is the same major version, not an exact hosted-platform replica. The cluster was stopped after testing, with its data retained. Physical Android/iOS, live billing, the hosted Edge/PostgREST runtime and authenticated deployed user flows remain unverified. See [the final release-readiness report](ONLYFAST_PHASE1_RELEASE_READINESS.md) for evidence and approval gates.

Final verification reproduced and narrowly corrected three Phase 1 defects: base templates could carry a phantom/borrowed weekend ID; a committed insert retried after 48 hours could hit the insert guard before its duplicate key; and the usage/final restriction migrations could commit without their expansion predecessors. Base identities and Assist container ownership are now checked, exact owned-row retry recovery still passes through the guarded update, and out-of-order migrations fail before mutation. Prices, limits, billing, advertising and existing customer payloads were not changed.

## J. Remaining vulnerabilities and uncertainties

1. Production still has the confirmed public sharing/grant and helper conditions until the approved migrations and code are released. Legacy Edge functions also retain their old quota protocol until cutover.
2. Historical queue entries lack trustworthy provenance. They are retained and excluded from replay, requiring an explicit recovery review. Ownership cannot safely be inferred after the fact.
3. Historical Assist keys that no longer match any retained saved name cannot be mapped reliably. The SQL preserves their rows and snapshots matches, with unmatched history requiring operator review.
4. Incomplete legacy setups use a name/row fallback when schedule and track/date are absent. Multiple same-class races at the same track/date without distinct schedule IDs follow the current saved-race grouping. Review such data before backfill approval. No customer records were merged or deleted in production.
5. The UI's original count used display names, while landing cards group actual races. The draft preserves the two-name restriction and closes repeated-name bypass through two stable event identities. The grouping and lock-annotation policy in §D need product acceptance before activation. A broader rule for all metadata changes was deliberately deferred.
6. Request cache retention and response-storage growth need an operational policy. No automatic purge was added. Leases expire for counting purposes without a cleanup job.
7. Legacy clients without request IDs receive atomic quota protection but cannot replay a cached response by ID after losing it. New clients provide IDs per action/batch. Browser refresh/reinstall is a separate recovery boundary.
8. Public-code guessing/rate monitoring, broad cross-app account-deletion recovery, and unrelated audit concerns remain outside this targeted patch.
9. Supplemental local TypeScript uses stub declarations for Deno/remote SDK imports. It is not a replacement for staging Edge runtime verification.

## K. Regression concerns and review gates

Normal save, session naming, copying, schedule linking and timing output were preserved through existing tests and new fixtures. No default test regression is accepted beyond the already reproduced historical iOS failure.

Review the following release-sensitive behavior before approval.

- Queue write-ahead storage needs available persistent browser storage. A full/denied store causes an explicit failure rather than a falsely reported durable save.
- Old drafts and untrusted queues remain retained but do not automatically populate another account. A recovery flow must establish the original owner.
- Server write errors can now reject direct bypasses that the old UI alone checked. Existing over-limit rows remain. Existing inactive-class visibility rules are retained.
- Only authorized metadata annotation paths remain available after the 48-hour mechanical lock. A request to lock timing imports, session labels or schedule annotations as well would require an explicit business-rule decision.
- The public share payload is intentionally narrower than a raw setup row. Review the explicit setup-field allowlist and confirm that notes/custom fields are intended sharing content.
- New frontend/Edge code requires database expansion. The final direct-read restriction requires the RPC-based viewer. An old viewer cannot be rolled back after enforcement without a compatible replacement.
- Existing installed wrappers, native paywall identity, purchase holds and ad cooldown/placement rules need the ordinary release acceptance checks. Local tests provide contract evidence without physical-device verification.

## L. Proposed deployment sequence

This is a review sequence, not an instruction to execute the release now.

1. Review the Phase 1 diff against the rollback snapshot. Reconcile current production migration definitions and trigger states. Retain a schema/grant/policy export and an approved database backup. Review unmatched usage, legacy queues, ambiguous event grouping and locked annotation semantics.
2. Native PostgreSQL concurrency/rollback tests have now passed locally. Reproduce the hosted Edge/PostgREST integration in isolated Supabase staging. Verify service-only RPC grants, the Edge bundle, old/new clients, and exact native build contracts.
3. Apply the membership/share expansion step only after approval. Confirm that the RPC-aware viewer can redeem an existing valid code with the reviewed projection while owners retain management access.
4. Coordinate a short AI/OCR request cutover. Drain old requests, then apply the identity/usage step and release the two updated Edge functions with their shared module. Avoid old endpoint writes during the usage snapshot. Verify a Rookie reservation, provider failure release, cached retry and Pro/Team access before reopening traffic.
5. Release the frontend with stable save/request IDs, owned replay and the RPC share viewer. The new server supports unambiguous legacy name hints, allowing old clients to keep using their saved data during the transition. Ambiguous old hints must use a session-aware client.
6. Verify web, Android and iOS account switching, offline reconnect, picker return, subscription refresh, RPC sharing and eligible house-ad/save paths using the actual supported installed builds. Confirm reload/update behavior for warm and cached WebViews. Keep activation controls under the separate existing release approvals.
7. Only after that native compatibility gate and explicit approval, apply the final table-access restriction. Recheck anon enumeration/direct IDs, owner management, expiry, grants and metadata projection using dedicated disposable test identities.

Apply these review-only steps individually. Do not use a bulk migration push that also applies unrelated pending feature history.

The ten-step sequence, per-step success/failure/recovery criteria and current **NOT READY — BLOCKERS REMAIN** recommendation in [ONLYFAST_PHASE1_RELEASE_READINESS.md](ONLYFAST_PHASE1_RELEASE_READINESS.md) supersede this abbreviated sequence.

## M. Rollback procedure

For this uncommitted local task, the rollback source is `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-rollback-4954lj/files` and its sibling `manifest.json`.

Save the current Phase 1 patch and any later user changes before restoring. Restore only the files listed in §F from that snapshot after comparing their hashes/diffs, preserving unrelated changes made since the snapshot. New Phase 1 SQL, modules, tests and this report should be retained or moved aside only with user approval. A reset to Git HEAD would discard pre-existing local work and is unsuitable here.

For a future approved rollout, prefer a compatible forward fix or reverting only the application layer while retaining expanded columns, identities, request receipts and usage. Retain the code-based share viewer after direct reads are restricted. Keep the atomic backend protocol active for legacy clients where compatible.

Database rollback needs its own reviewed, data-preserving script based on the actual preflight schema export. Do not reopen anonymous table reads, restore broad mutation grants, drop customer identities/receipts or undo usage by subtraction. No automatic destructive down migration is included.

## N. Items requiring approval

- Accept the proposed grouping/backfill and the exact locked-operation policy, including grandfathered data and historical unmatched usage.
- Approve the three migration steps, Edge/frontend release sequence, old-client transition and operational rollback plan after isolated Supabase acceptance.
- Authorize any production data remediation or legacy queue recovery separately, with an identity-verification procedure.
- Approve a commit/push only when the final reviewed diff is ready. Neither was performed during this task.
- Approve further Phase 2 work separately.

**Final preservation check.** SHA-256 comparison against the rollback manifest found changes only in the 17 existing files listed in §F. All other snapshotted files, including the existing native/ad controllers, assets, styles, dependency manifests and the original audit report, matched their saved bytes. Git HEAD remained d4c07efa644c3f28e107932d857c818013976eb7.

**Activation status.** The new protections exist in local code and reviewed test fixtures. All production activation steps remain pending approval.

**Final-verification preservation.** A second snapshot at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-readiness-rollback-ZscOcc` records 710 files before release verification. That pass changed only the dashboard retry branch, two Phase 1 migrations, the offline/database regression tests, this report, and the new PostgreSQL test/readiness report. Existing advertising, native, assets, dependency manifests and unrelated local work were preserved. The original audit report is unchanged.
