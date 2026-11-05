# OnlyFast Phase 1 release readiness

> Owner revision for the production release: the isolated-restore demonstration requirement below is removed. The owner accepts the confirmed November 5, 2026, 07:55:32 UTC daily physical backup with Restore option as the recovery safeguard and accepts proceeding without a tested restore. Temporary sharing incompatibility for outdated clients is also accepted. These owner instructions supersede the corresponding historical gates in this report; schema/data safety, release scope and compatible recovery checks remain required. See `ONLYFAST_PHASE1_PRODUCTION_RELEASE.md` for actual execution status.

November 5, 2026. Local final verification on `main` at `d4c07efa644c3f28e107932d857c818013976eb7`, primary checkout `C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast`, remote `https://github.com/Apex88Vent/onlyfast.git`.

## 1. Overall assessment

**NOT READY — BLOCKERS REMAIN**

The local Phase 1 protections pass their targeted tests, actual multi-connection PostgreSQL contention tests and migration rollback tests. Three verified defects were fixed narrowly during this pass. Production remains unchanged and still requires the approved security rollout.

Release readiness is blocked by unverified installed Android/iOS compatibility, absence of hosted staging Edge/PostgREST acceptance, and unresolved acceptance of legacy grouping/usage reconciliation. There is no evidence that every supported installed wrapper will load the RPC-aware share viewer before direct public reads are removed. A website deployment alone does not establish this. The final restriction must remain gated on that proof or a reviewed client transition.

No production migrations, customer changes, deployments, commits, pushes, branch switches, billing/ad activation or Phase 2 work occurred. The existing production advertising and purchasing holds remain in place. The final recommendation applies to the complete Phase 1 release; it is not authorization to activate its expansion steps independently.

## 2. Confirmed security fixes and narrow corrections

The actual implementations were inspected, including the queue/drain, dashboard writes and account storage, sharing UI/RPC/policies, both Edge handlers and shared authorization module, all three migrations, membership helpers and relevant tests. [The security report](ONLYFAST_PHASE1_SECURITY_REPORT.md) remains the detailed implementation record.

| Protection | Verified local behavior | Activation dependency |
|---|---|---|
| Offline ownership | Version-2 queue records retain original owner and row UUID; storage precedes requests; reads/acknowledgments/replay are owner-scoped. Failed writes remain queued. A→B→A isolation and overlapping drains pass. | Frontend release; legacy unknown-owner entries require separate recovery. |
| Account switching | Dashboard remount and account-keyed drafts prevent automatic restoration into another account. Session checks and owner-filtered updates supplement database RLS. Stale owner operations cannot write as the next owner. | Frontend plus database enforcement; real wrapper lifecycle testing remains open. |
| Sharing | Exact eight-character bearer-code redemption checks public/expiry/revocation state and setup-owner consistency. Explicit setup-field allowlist excludes owner ID/email, row IDs, coordinates, timing and schedule/weekend identity. Invalid/private/expired/revoked codes fail. | M1 RPC, compatible viewer, then M3 restriction. Before M3, legacy direct-read exposure remains. |
| Assist identity | Service-only reservation resolves an owned saved row to a private owned weekend container. Renames do not reset quota. Legacy name hints resolve only one unambiguous owned weekend. | M2 and coordinated Edge release. |
| Quotas | Owner advisory transaction locks serialize reserve/finalize; pending leases count toward limits; successful results cache; duplicate IDs cannot double-charge; stale tokens cannot finalize replacements. Browser mutation/TRUNCATE grants are removed. | M2 and new Edge protocol; drain legacy traffic during cutover. |
| Rookie writes | Server guards enforce original ownership, active class, one base, two saved weekends and original 48-hour clock. Mechanical edits/new sessions lock; reviewed annotation paths remain. Existing rows over limits survive. | M1/M2 and acceptance of legacy grouping. |
| Membership | Trusted subscription rows, server app metadata, approved tester flags and legitimate endpoint admin exemption retain their precedence. Editable user metadata cannot grant API authority. Public helpers cannot probe foreign users. Pro remains single-class; Team retains multi-class access. | M1 and both updated Edge functions. |

Only these confirmed implementation defects were corrected in this final pass:

1. **Forged base-template weekend identity.** A synthetic base insert with a random `race_weekend_id` succeeded before the fix. Because it skipped ordinary weekend validation, it could supply a fake quota scope. M2 now rejects non-null base-template weekend IDs and independently checks that an Assist row is not a base and that its container exists and belongs to the verified owner. Tests also bypass the trigger as local maintenance to prove the reservation rejects malformed, phantom and foreign containers. Ordinary legacy bases remain null and unchanged.
2. **Lost insert response replay after lock.** A retry could receive `42501/ROOKIE_SETUP_EDIT_LOCKED` from the BEFORE INSERT trigger before reaching its duplicate-key check. The dashboard now attempts exact owned-row recovery for that specific error as well as `23505`. Recovery performs a normal guarded UPDATE: identical content succeeds; a new mechanical edit after 48 hours still fails. Other authorization errors are not generalized into recovery success.
3. **Missing migration predecessor checks.** Real PostgreSQL showed M2 and M3 could commit out of order because some PL/pgSQL callees are resolved later. M2 now requires M1 membership/redemption RPCs; M3 requires expansion RPCs and the weekend table. Both fail before mutation when those prerequisites are absent. Operators must still compare definitions, grants and release compatibility; existence checks do not certify a deployed client version.

Changed during this final pass: `src/components/SetupDashboard.tsx`; M2 and M3; `tests/offlineQueueSecurity.test.ts`; `tests/phase1Database.mjs`; updated security report; new `tests/phase1Postgres.mjs`; this report. No unrelated refactor or asset optimization was made.

## 3. Exact verification results

| Check | Prior Phase 1 baseline | Final result |
|---|---|---|
| Default `npm.cmd test` | 499/500 | **500 passed / 501 total; 1 failed; 0 skipped/cancelled.** |
| Six existing/Phase 1 disposable database suites | 21/21 | **22/22 passed; 0 skipped/cancelled.** |
| New native PostgreSQL multi-connection/migration suite | Unverified | **15/15 passed**, comprising 14 subtests plus their parent. |
| Focused authorization, offline and OnlyLaps suite | Included in default suite | **35/35 passed.** These are a subset, not extra unique tests. |
| App TypeScript, `tsconfig.app.json` | Passed | **Passed, exit 0.** |
| Config TypeScript, `tsconfig.node.json` | Passed | **Passed, exit 0.** |
| Production Vite build and release environment/output checks | Passed | **Passed**, 1,859 modules; output isolated under system temp. Existing >500 kB chunk warning remains. |
| Changed-file ESLint | 101 errors / 8 warnings after Phase 1 | **101 errors / 8 warnings**, zero new rule/message findings against exact pre-verification snapshots. New PostgreSQL test lint clean. |
| Supplemental Edge TypeScript with local runtime/SDK declarations | One existing TS2322 | **Same one TS2322**, `supabase/functions/_shared/onlylaps-setup-context.ts:323`, before and after. No additional diagnostics. |
| Tracked whitespace, `git diff --check` | Passed | **Passed**; existing Git LF/CRLF conversion notices remain. |

The one automated failure remains `tests/iosReleaseBridge.test.ts:43`: it expects `NATIVE_PURCHASES_READY` false while the selected stock billing integration reports true. This was reproduced before Phase 1 and was not “fixed” by changing billing. It is a separately reviewable historical assertion and must be acknowledged in release acceptance. The main suite is not fully green. Changed-file lint is also not globally clean; its existing findings were preserved.

The default test count increased by one for locked-insert retry recovery. The disposable database count increased by one for forged base identity rejection. Previously reported 499/500 and 21/21 were reproducible baselines, superseded by these added cases. No `FINAL_*` placeholders remain in the security report.

Commands used:

```powershell
npm.cmd test
node node_modules/typescript/bin/tsc -p tsconfig.app.json --pretty false
node node_modules/typescript/bin/tsc -p tsconfig.node.json --pretty false
# PGLITE_MODULE points to external temporary tooling, not an app dependency.
node --experimental-strip-types --test tests/phase1Database.mjs tests/subscriptionAuthorizationDatabase.mjs tests/revenuecatDatabase.mjs tests/racingOnboardingDatabase.mjs tests/setupLibraryDatabase.mjs tests/stagingDatabase.mjs
node --experimental-strip-types --test tests/offlineQueueSecurity.test.ts tests/usageAuthorization.test.ts tests/subscriptionServerAuthorization.test.ts tests/setupAssistOnlyLapsIntegration.test.ts tests/setupAssistTrackUpdates.test.ts
# Opt-in: external pg module and dedicated loopback config, no production DSN.
node --test tests/phase1Postgres.mjs
git diff --check
```

The build used Vite's `build()` API with `mode: 'production'` and a new temp output directory, followed by exported `verifyReleaseEnvironment` and `verifyReleaseOutput` checks. It did not overwrite `dist` or deploy. ESLint used the same file paths/configuration for `lintText()` on snapshot bytes and current bytes across the Phase 1 TS/TSX/JS test files. Matching rule/message multiplicities distinguish prior findings from newly introduced errors. The Edge supplement used identical temporary Deno/remote SDK declarations for both snapshots; it is not a real Deno/Supabase runtime check.

Evidence files are local under `C:/Users/c_mar/AppData/Local/Temp/`:

- `onlyfast-readiness-automated.log`, `onlyfast-readiness-database.log`, `onlyfast-readiness-focused.log`.
- `onlyfast-readiness-postgres-before.log` records missing-predecessor failures; `onlyfast-readiness-postgres.log` records the corrected 15/15 run.
- `onlyfast-readiness-lint.json`, `onlyfast-readiness-edge.json`, `onlyfast-readiness-column-comparison.json`, `onlyfast-readiness-live-columns.json` contain comparison evidence; live columns are metadata only.
- `onlyfast-readiness-build.log`, `onlyfast-readiness-build-result.json`; build output `onlyfast-readiness-build-wPmLJf`.

## 4. Migration compatibility and dependencies

Migrations must be applied individually in this exact order, using reviewed SQL bytes:

| Step | File | Required prior state and behavior |
|---|---|---|
| M1 | `20261105090932_phase1_membership_and_sharing.sql` | Existing secure-membership schema, `onlyfast_private.has_unlimited_vehicles(uuid)`, subscription/RevenueCat fields, tester/feature tables, setup/share tables and auth helpers. Installs trusted private tier and owner/service helpers, adds optional share metadata and redemption RPC. Leaves old direct reads available during the compatibility window. |
| M2 | `20261105090937_phase1_setup_and_usage_authorization.sql` | M1 RPCs plus schedule/setup/usage schema, both known enabled setup triggers. Adds/backfills private weekend containers and public identity, adds atomic usage protocol, installs setup guard and removes browser usage mutations. Requires coordinated Edge cutover. |
| M3 | `20261105091108_phase1_restrict_legacy_access.sql` | M1/M2 expansion objects and independently verified RPC-capable supported clients. Restricts direct table access to owners, defeats permissive legacy policies with restrictive policies and narrows grants. Existing legacy direct-read viewers cease working. |

Read-only inspection of project `thpyjvwtfvfxiufchrxn` found PostgreSQL **17.6.1.111** and these recorded history entries:

```text
20260630        prepare_user_subscriptions_for_revenuecat
20260713        add_race_schedule_end_date
20260720        enforce_active_race_class
20260728        add_account_beta_feature_flags
20260817        link_race_setups_to_schedule
20260929        add_custom_car_class
20260930        add_development_setup_library
20261001        verify_designated_test_account
20261002030004  add_development_kart_classes
20261017000811  revenuecat_subscription_sync
20261017000836  schedule_revenuecat_expiration
20261017000856  secure_membership_authorization
```

RevenueCat/expiration/secure-membership definitions are recorded under versions different from the repository's filenames. `202610130001_restore_racing_onboarding.sql` and `20261013183621_enable_road_racing.sql` are absent from this history. OnlyLaps foundation/session-linking repository entries also do not appear as corresponding history rows; absence of a history row alone cannot determine the actual deployed object set. Do not repair history or apply unrelated history automatically.

Production metadata confirmed both enabled setup triggers: `guard_development_setup_library` calling `onlyfast_guard_development_setup_class()`, and `race_setups_touch_updated_at` calling `touch_updated_at()`. The local newer setup-vehicle guard and Phase 1 guard are absent. M2's backfill checks those two known triggers and restores their enabled states transactionally. It does not prove no additional triggers exist on a later release; re-export/review the complete trigger list before activation.

Inspected production helper signatures/return types are compatible with M1 replacements: `get_onlyfast_membership() -> jsonb`, private `has_unlimited_vehicles(uuid) -> boolean`, `list_user_setup_summaries() -> jsonb`, tier/active-class helpers returning text, class predicates returning boolean. Existing public/helper grants and sharing policies explain the security issue; Phase 1 was not applied during this review.

For the five inspected tables (`race_setups`, `shared_setups`, both usage tables, `user_subscriptions`), **112 live columns** were compared with the native PostgreSQL expanded fixture. No missing columns or data-type/nullability mismatches were found. The fixture's only additional columns in that comparison are `race_setups.race_weekend_id` and `shared_setups.revoked_at`. Live `expires_at` already exists with a 30-day default; `ADD COLUMN IF NOT EXISTS` preserves that default and existing values. No customer payload query was needed. This focused comparison is not a complete hosted schema clone or guarantee of future metadata parity.

The production-shaped fixture deliberately omits the two newer feature migrations and seeds synthetic identities; it is a schema reconstruction from reviewed local resources, not a downloaded production backup. The existing staging plan still excludes all three Phase 1 files from automatic legacy baseline replay. No `supabase db push`, production migration repair, hosted branch creation, or bulk history application was performed.

## 5. Existing customer data compatibility

| Record/account category | Verified preservation and compatibility | Remaining approval/limitation |
|---|---|---|
| Base templates | `base_template`, legacy template-name prefix and `is_template` classification are recognized. Backfill leaves base identity null and preserves stored payload/clocks. New forged base weekend IDs are rejected. | Real customer format distribution was not queried. Review any unsupported legacy marker before rollout. |
| Race weekends/historical sessions | Backfill uses owner/class plus schedule ID, otherwise track/date, otherwise name, otherwise row ID. Sessions receive stable containers; original setup values, IDs, created/updated clocks and custom JSON remain. | Same-track/date events without separate schedules can group together; fallback names can be ambiguous. Approve grouping or reconcile in staging first. |
| Locked weekends | Original minimum creation clock is retained; exactly 48 hours locks mechanical edits/new sessions. Existing data remains readable under existing class rules. Session labels/order, timing data and owned schedule annotations remain permitted. | Notes/other setup fields are outside that annotation exception and remain locked. Product acceptance must match the reviewed Phase 1 distinction. |
| Existing excess rows | No deletion, truncation or quota-row purge. Rookie over-limit history survives; insert count checks do not retroactively remove rows. Paid restrictions remain unchanged. | Existing class/age constraints still apply; preservation is not a new bypass entitlement. |
| Legacy/development JSON | Synthetic production-shaped tester sheet retains its entire original row except added identity, including library/custom JSON. Known development validator is disabled only inside the backfill transaction and restored. | Hosted schema changes or extra triggers require renewed preflight. |
| Class changes | No active class, onboarding date or cooldown is rewritten. Owner-scoped existing class authority remains; Pro stays single-class and Team/admin/approved exemptions remain multi-class. Existing onboarding/class cooldown tests pass. | No rollout of missing onboarding or road-racing history is implied. Old inactive-class restrictions remain. |
| Schedule-linked setups | Existing schedule links are preserved and form the preferred event key. Later sessions reuse stable identity. Foreign schedules and identity changes are rejected. | A later owned schedule annotation does not reset lock/quota identity. |
| Sharing codes | IDs/codes/status and existing expiry default survive. Synthetic existing valid code redeems before and after M3. Private/expired/revoked links do not redeem. Existing email column stays stored but is omitted from RPC output. | Historical wrong-owner associations do not become valid through the RPC; any legitimate repair needs separate approval. Old direct viewers break after M3. |
| Assist usage | Original rows remain. Matched legacy name consumption copies to `weekend:<uuid>` with maximum count, not subtraction or deletion. Reservations also consult matched retained names. | Unmatched renamed/deleted history cannot be mapped reliably. Reused names can conservatively apply consumed status to multiple matched weekends. Reconciliation requires approval; do not reset usage to make migration pass. |
| Timing usage | Existing UTC monthly counters remain; reservations/finalization add only successfully charged requests. | Cutover must drain old writers to avoid a race with the legacy protocol. |
| Pro/Team subscriptions | Subscription/provider/product/price fields are untouched. Active/trialing paid access, RevenueCat expiry, trusted promo expiry and both provider fixtures pass. | Hosted subscription refresh/stock Median identity still require staging/device acceptance; no purchase is necessary or authorized for this verification. |
| Admin/test accounts | Trusted app admin flag, approved experimental tester plus enabled feature flag, valid promo grants and server-configured endpoint exemption remain. Forged user metadata does not elevate. | Fixtures use synthetic accounts, not production customer lookups or grants. |

The new identity column has no foreign-key constraint to the private weekend table. Browser setup writes are validated by the guard and Assist independently validates container ownership. Service maintenance bypasses browser restrictions when no Auth subject is supplied; operator writes therefore require the same ownership checks and are outside ordinary client guarantees. Tests deliberately introduced such malformed local rows to verify Assist rejects them.

## 6. Real concurrency and failure testing

Docker was unavailable and the only listed Supabase branch was the production/default branch. Instead, a temporary **PostgreSQL 17.11** server ran on `127.0.0.1` only, with password authentication and a unique cluster marker. No Windows service or global database installation was registered. The official PostgreSQL Windows download page links to the binary distribution used here: [PostgreSQL Windows binaries](https://www.postgresql.org/download/windows/), [EDB binary downloads](https://www.enterprisedb.com/download-postgresql-binaries).

`tests/phase1Postgres.mjs` refuses a non-loopback host, unexpected user/default database or mismatched cluster marker before creating its new synthetic database. It receives only an explicit temporary config and external `pg` module; it never reads application `.env` files or production credentials. Each execution creates a unique database and retains it. The passing database is `onlyfast_readiness_3f45331fd12644c7b0272f275584e749` in cluster `onlyfast_readiness_fd7b3b307261`.

The passing run established:

- Assist: one transaction holds an owner lock while a second backend is observed waiting on an actual advisory lock; after commit exactly one reservation is admitted.
- Timing: three independent connections contend; exactly two reservations are admitted and concurrent finalizations produce a counter of two without lost updates.
- Duplicate IDs: a second backend waits, then returns pending; a completed retry returns the stored response, conflicting fingerprints reject, repeated finalization does not double-charge.
- Interrupted work: disconnecting an uncommitted connection rolls back its reservation. An unfinalized committed reservation occupies a slot until expiry; local fixture expiry permits a new token, and the old token cannot finalize it. Provider failure releases without charge.
- Concurrent saves: with one slot remaining, an insert holds the lock; a second waits and then fails the two-weekend limit at PostgreSQL's READ COMMITTED isolation. No third saved weekend commits.
- Account/authorization: switching Auth context changes visible rows; foreign setup writes/reservations and browser usage TRUNCATE fail. RPC share projection/redemption/revocation remain correct after restriction.
- Migration failures: M2/M3 missing predecessors fail before mutation; a missing/disabled known backfill trigger aborts; injected division-by-zero immediately before COMMIT in each migration restores prior columns/functions/grants/data/trigger states. Separate M1, M2 and M3 commits all succeed in order.

Fault injection altered SQL strings only inside the test, not the migration files. No contention/load/fault testing touched production. PostgreSQL 17.11 differs from production's 17.6 patch and lacks the full Supabase Auth/PostgREST/Edge infrastructure; this closes the real database contention gate but leaves hosted integration acceptance open.

The cluster at `C:/Users/c_mar/AppData/Local/Temp/onlyfast-readiness-pg-ca0de23fedee4e29a4ff0190e844a7c2` was cleanly stopped after the run. Synthetic databases, server log and external tooling remain for review; no customer data was copied into them.

## 7. Web, Android and iOS compatibility

| Flow | Code/fixture evidence | Release gate |
|---|---|---|
| Authentication | No Auth provider, token, cookie, redirect or Median login configuration was changed. Edge calls `auth.getUser` before service operations. | Cold/warm sign-in, token refresh, logout and A→B→A must pass on supported wrappers and web. Local role switching is not an installed-device test. |
| Setup read/save | Existing public table/summary interfaces remain; owner grants retained. Old inserts without weekend ID get server-derived identity. New inserts use stable IDs; explicit updates retain owner filter. | Check actual old payloads, active/inactive classes, base/copy/save, offline reconnect and long-lived WebView state against staging. Legitimate policy rejections must surface without losing queued data. |
| Assist/OCR | Existing endpoints and response shapes remain. Unambiguous owned legacy name hint supports old Assist callers without exact session ID; new callers send session/request IDs. Old OCR callers can omit request IDs. | Old ambiguous hints reject and must use a session-aware client. Callers without IDs lack lost-response cache recovery. New frontend/Edge must follow database expansion. |
| Sharing | New viewer uses only `redeem_setup_share`; owner management remains table-based. | **Definite protocol incompatibility:** old non-owner viewers use direct table reads, which M3 removes. An old viewer breaks on web or native after M3. |
| Entitlements | Stock Median paywall/native purchase code, RevenueCat mapping, products, prices and holds unchanged. Membership fixtures pass. | Read-only subscription refresh and correct native user identity on Android/iOS still need device evidence. Historical custom bridge test/source does not certify current stock builds. |
| OnlyLaps | Exact saved session ID still reaches beta-gated telemetry; status-only behavior and response contracts pass focused tests. No OnlyLaps schema/endpoint was deployed. | Verify existing linked-session flow against actual staging deployment and installed clients. No telemetry/beta activation is authorized. |
| Advertising | Existing ad code/assets/settings and eligibility/placement rules were preserved byte-for-byte against the task snapshot. Existing save/ad contract tests pass. | Ordinary native lifecycle acceptance remains; no ad display/activation or configuration change was performed. Existing ad release blockers remain separate. |

Repository release records describe production startup URL `https://onlyfast.app?nativeApp=true` and multiple historical Android artifacts; the current iOS release artifact/provenance is still not proven by those records. `native/README.md` selects the stock Median paywall and retains custom bridges as historical material. No canonical application service-worker registration was found, but that does not prove all installed WebViews reload, discard cached JS or lack an older embedded frontend. Prior custom bridge runtime reports do not establish current stock-client Phase 1 compatibility.

**Is a native update required?** There is insufficient evidence to specify a safe minimum Android versionCode or iOS build. A wrapper which reliably loads the compatible hosted frontend may need only a verified reload. A wrapper serving a cached/embedded direct-read viewer, or unable to force a compatible reload, requires an app update or a separately reviewed supported transition before M3. Treat that decision as unresolved until actual installed builds are inventoried and tested.

Safe transition proposal, requiring approval:

1. Install M1 expansion first and verify old and RPC viewers against isolated staging; ship the RPC viewer after database/Edge coordination.
2. Inventory supported Play/TestFlight/App Store builds and test cold start, background/resume, warm session, offline-to-online and stale cached content. Confirm the actual network call is `redeem_setup_share`, and exercise account switching/save/entitlement refresh. Record platform, package/build, frontend asset hash and pass evidence.
3. Establish a reviewed minimum compatible client/reload capability and user update path. No client-version acknowledgment or enforced upgrade mechanism was added in Phase 1. Time elapsed after web deployment is not evidence of adoption.
4. If any supported client cannot load the viewer, hold M3 and obtain approval for the required update/support transition. Keeping direct reads temporarily preserves compatibility **and leaves the known sharing exposure open**; this must be an explicit, time-bounded risk decision. If that exposure cannot be accepted, authorize a short share-viewing outage while requiring a compatible client rather than weakening final security policies.
5. Apply M3 only after compatibility evidence and separate approval. After M3, keep the RPC viewer available on every rollback target; never restore public table reads to accommodate an obsolete viewer.

## 8. Remaining risks and blocking gates

| Gate | Required closure |
|---|---|
| **Installed mobile clients — blocking** | Actual supported Android/iOS build inventory and recorded acceptance of reload/cache behavior, authentication, setup saves, account switching, RPC sharing, entitlement identity and picker return. Approve any minimum update requirement before M3. |
| **Hosted integration — blocking** | Isolated Supabase staging acceptance of real JWT/PostgREST roles, schema reload, both bundled Edge functions/shared module, provider failure paths, OnlyLaps and old/new frontend contracts. No disposable hosted project was available during this pass. Node handler mocks and native PostgreSQL do not replace it. |
| **Data grouping and business acceptance — blocking** | Accept reviewed fallback grouping, original lock clock, allowed annotations, two-name/two-container behavior, grandfathered rows and handling of unmatched/ambiguous historical usage. No production customer reconciliation was performed. |
| **Release preflight/authorization — blocking** | Fresh schema/trigger/function/policy/grant export and backup/restore evidence, migration hashes/history reconciliation, reviewed diff preserving unrelated uncommitted ad/native work, coordinated maintenance window, explicit commit/push/deploy/migration approval. |
| Historical check exceptions | Acknowledge the one historical iOS assertion, unchanged 101/8 lint findings and pre-existing supplemental OnlyLaps TS2322; do not change billing to mask them. Complete genuine Edge runtime/type acceptance in staging. |
| Operational follow-up | Define request receipt/cache retention and access monitoring; there is no purge job. Monitor share-code failures/rate abuse and usage reservation/finalize errors. Legacy unknown-owner queue recovery needs its own owner-verification approval. |

Rookie rules remain one active class, one base, two weekend saves, 48-hour mechanical lock, one Assist/weekend and two timing scans/UTC month. Pro remains one active class with existing paid feature access; Team remains multi-class. No new numerical membership limits were introduced. The compatibility ambiguities above require approval rather than silently redefining these rules.

## 9. Exact ordered production release plan — proposal only

Each step is gated on the previous step's success. Apply only the three reviewed SQL files, individually; never run a bulk migration push. Capture new evidence and stop on failure. The expanded database alone is not the complete security release.

### 1. Production backup and schema verification

**Change:** During an approved release window, create/verify a recoverable production backup/PITR point and export current schema, functions, triggers, RLS policies, grants and migration history without copying customer data into this repository. Record backup ID/time, restore test, current app/Edge deployment IDs and exact release hashes. **Depends on:** Explicit authorization and an isolated restore destination. **Success:** An operator demonstrates a restore into isolation and catalog diffs match reviewed prerequisites. **Failure:** Missing restore proof, drift, unexpected trigger or mixed release bytes. **Recovery:** Stop before mutation; keep serving the current release and reconcile the export. Never overwrite production with an old backup as a routine rollback.

### 2. Migration prerequisite checks

**Change:** Read-only compare the current metadata with M1/M2/M3 dependencies, types, helper signatures/owners/search paths/ACLs, both trigger definitions/states and live history. Record the three file SHA-256 hashes. Rehearse the exact reviewed SQL individually on staging with synthetic old/new clients. **Depends on:** Step 1 and closed acceptance gates. **Success:** No unresolved drift; M2/M3 out-of-order rejection, rollback and all compatibility tests pass on the release candidate. **Failure:** Different signatures, unknown triggers, absent secure membership or historical prerequisites. **Recovery:** Halt; prepare a separate reviewed prerequisite fix. Do not auto-apply missing historical onboarding/OnlyLaps/RevenueCat migrations or edit history to force success.

### 3. First database expansion — M1

**Change:** Separately approve/apply `20261105090932_phase1_membership_and_sharing.sql` in its transaction; record successful migration history once using the reviewed operator procedure. **Depends on:** Step 2 and M1 approval. **Success:** Trusted owner/service membership RPCs and projected share redemption work for dedicated test identities, existing owner management remains, schema cache sees the RPC. **Failure:** SQL error/abort, missing RPC in PostgREST, wrong privileges or projected content. **Recovery:** If transaction failed, rollback and verify catalog parity. If committed, retain expansion, stop advancement and correct the RPC/grants forward; do not reopen or enlarge public permissions. Reconcile history read-only before any retry.

### 4. Sharing compatibility verification

**Change:** Exercise the new viewer/redeemer and owner create/reuse/revoke/expiry paths against M1 in staging; verify old supported clients and document the temporary direct-read window. No final restriction yet. **Depends on:** Step 3 and the reviewed share projection. **Success:** Exact valid legacy codes work, invalid/private/expired/revoked and foreign associations fail, payload excludes owner metadata, and owner save/export use intended fields. **Failure:** Lost fields, stale direct viewer, unusable existing link or ACL mismatch. **Recovery:** Keep M1, fix the compatible viewer/RPC and repeat acceptance. Hold M3. If an extended direct-read window is needed, obtain explicit time-bounded risk acceptance because the original exposure remains.

### 5. Usage/identity database expansion — M2

**Change:** Begin the approved short maintenance period for setup writes plus Assist/OCR. Block new work through an approved maintenance control, drain in-flight legacy provider requests and usage writers, then apply `20261105090937_phase1_setup_and_usage_authorization.sql` alone. Do not assume UI hiding prevents old clients reaching endpoints. Capture synthetic verification of counts/identities and backfill summaries without unnecessary customer payloads. **Depends on:** M1, accepted grouping/reconciliation plan, and ready Edge artifacts. **Success:** Known triggers enabled, original payload/clocks preserved, base IDs null, non-base owned identities established, legacy usage retained/copied, service-only RPCs work and browser mutations fail. **Failure:** Preflight exception, lock timeout, partial assumptions, unowned identity or wrong usage mapping. **Recovery:** On transactional failure rollback and verify prior schema/trigger states. If committed, keep new identity/usage data, keep writes/features paused and correct forward. Do not clear rows or disable guards to reopen traffic. Unmapped legacy usage needs reviewed reconciliation, not a counter reset.

### 6. Edge Function coordination

**Change:** While Assist/OCR remain paused, release the reviewed `get-suggestions` and `scan-timing-screen` bundles with `_shared/usage-authorization.ts` and unchanged legitimate server configuration. Confirm no legacy worker can keep using the old read/check/increment protocol. **Depends on:** Successful M2 and drained legacy work. **Success:** Real JWT → trusted tier → owned reservation → provider → finalize response works; unauthorized/foreign requests fail before spend; provider errors release; duplicate/cache/conflict/stale-token checks pass. **Failure:** Missing RPC/schema cache, import/runtime error, provider timeout leakage, wrong tier or double accounting. **Recovery:** Keep feature pause, retain receipts/counters, deploy a compatible corrected Edge bundle. A rollback to old quota writers is unsafe after cutover. Release setup-write maintenance only after a compatible candidate passes; keep Assist/OCR paused until this step passes.

### 7. Frontend deployment

**Change:** Deploy reviewed frontend with owner queues/drafts, stable save/request IDs, weekend metadata and RPC viewer. Preserve stock Median billing and ad holds and exclude unrelated local changes from the approved release unless separately reviewed. **Depends on:** M1/M2 and both compatible Edge functions. **Success:** Web release asset/hash verified; A→B→A, offline reconnect, lost insert response, locked annotation, setup copy/save, sharing, Assist and timing work end-to-end; no foreign state appears. **Failure:** Stale assets, schema stripping, lost pending edits, owner leakage or broken save. **Recovery:** Pause affected flow and forward-fix or roll back to a specifically tested compatible frontend. Retain owner-bound queued data and database expansion; do not restore the unsafe global queue. RPC viewer must remain available for the later M3 boundary. Reopen paused features only after end-to-end checks pass.

### 8. Native client compatibility verification

**Change:** Verify the exact supported installed Android/iOS builds with the deployed compatible candidate, including old warm/cached WebViews, resume/picker return, sign-in/token refresh, offline A→B→A, setup access/save, read-only subscription identity refresh, OnlyLaps and RPC sharing. Record minimum compatible build/reload requirement. No purchase or ad activation. **Depends on:** Step 7 and device/build access. **Success:** Both platforms demonstrably use the new protocol after documented reload/update steps, with billing/ad behavior unchanged and no unsupported installed viewer left in the support plan. **Failure:** Cached direct-read viewer, embedded old frontend, auth/storage loss, unknown build provenance or inability to validate iOS. **Recovery:** Hold M3, require a separately approved wrapper update/support transition or share-viewing maintenance. Do not infer success from the startup URL or web deploy timestamp.

### 9. Final database access restriction — M3

**Change:** Obtain a separate approval after step 8 evidence, then apply `20261105091108_phase1_restrict_legacy_access.sql` alone. **Depends on:** Successful M1/M2, compatible Edge/frontend/native clients, and accepted rollout/rollback targets. **Success:** Anonymous direct enumeration/ID reads denied; authenticated foreign direct reads/writes denied; legitimate owner management/save remains; valid code RPC works with the reviewed projection; expired/revoked/private codes fail. Verify effective grants and restrictive policies against every existing permissive policy. **Failure:** Owner recursion/denial, broken code redemption, stale supported client or unexpected public privilege. **Recovery:** Preserve committed restriction and issue a forward correction to owner policies/RPC/client. If transaction aborted, verify prior state and treat the known exposure as still open. Never restore broad SELECT/TRUNCATE grants or anonymous table access as rollback.

### 10. Post-release security validation

**Change:** Run a bounded acceptance checklist with dedicated approved synthetic identities across web/Android/iOS, record migrations/deployments/hashes, monitor authorization errors, duplicate saves, quota totals/leases and share failures, and close maintenance. **Depends on:** All prior gates and current backup/evidence. **Success:** No cross-owner visibility/write, valid sharing works, quotas cannot oversubscribe, duplicate retry is safe, original customer identities/usage remain, legitimate entitlements and ad/billing holds remain. **Failure:** New permission errors, count resets, stale client breakage or inconsistent deployment versions. **Recovery:** Pause affected paths, retain logs/receipts/pending work and use the compatible forward-fix procedure below. Do not delete quota/ownership records or run production concurrency/load probes.

**Maintenance requirement:** A short coordinated setup-write and Assist/OCR window spans the M2 backfill/old-worker drain through compatible Edge/frontend verification. Its duration must be measured during staging rehearsal; this report does not invent a production time estimate. M2 uses table locks and a backfill with trigger state changes inside one transaction. Existing sharing compatibility can remain during expansion only with explicit acceptance of its known exposure. M3 itself should not require a full app outage once every supported viewer is compatible; unresolved stale clients may require an approved share-viewing pause.

## 10. Rollback, recovery and explicit approvals

**Before any production mutation:** If a gate fails, stop. A SQL transaction failure should leave no partially installed schema; verify actual catalog/grant/trigger state and history before rerunning. Test fault injection demonstrated transaction rollback, not the ability to undo arbitrary committed production changes. Verify backup/PITR recovery before release, and rehearse restores into isolation.

**After a committed expansion:** Retain additive columns, private containers, original clocks, usage rows, request receipts/tokens and cached responses. Pause affected features and deploy a compatible application/Edge correction. Old Edge quota writers cannot safely be restored while traffic resumes. Restoring an earlier production backup would lose subsequent legitimate writes; use isolated recovery plus an explicitly reviewed reconciliation plan if disaster recovery is necessary.

**After M3:** Owner-only access stays enforced. Preserve the compatible RPC viewer on every rollback candidate. Fix owner policies, field projection or RPC code narrowly when needed; do not restore permissive public reads, broad table mutations or client-supplied quota keys. If no compatible viewer is available, pause share viewing and restore a secure compatible viewer. No destructive down migration is prepared or authorized.

**Local recovery:** The pre-verification snapshot is `C:/Users/c_mar/AppData/Local/Temp/onlyfast-readiness-rollback-ZscOcc` (710-file SHA-256 manifest and `files/`). The original pre-Phase-1 snapshot remains `C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase1-rollback-4954lj`. Save current/later changes first; compare hashes and restore only reviewed task-specific files if explicitly requested. Do not reset to HEAD, clean untracked files, delete branches/worktrees/backups or overwrite unrelated uncommitted work. New tests/reports and synthetic DB evidence remain retained.

**Preservation:** The final snapshot comparison identifies only the intended dashboard, M2/M3, offline/database tests and security report as modified existing files; the PostgreSQL test and this report are new. No snapshotted file was removed. Native/ad controllers/assets/styles, dependency manifests and original audit matched their saved bytes. HEAD and the local `origin/main` ref remained `d4c07efa644c3f28e107932d857c818013976eb7`. No commit/push occurred; pushes can trigger Vercel and require release authorization.

Explicit approval is required for:

1. Legacy event grouping, unmatched/ambiguous usage reconciliation, the reviewed 48-hour annotations and any owner-verified legacy queue recovery. Any customer remediation must be separately specified.
2. Provisioning/using an isolated hosted staging environment and its reviewed integration tests if not already provided; actual supported Android/iOS testing and any minimum wrapper update/support transition.
3. Backup/restore procedure, measured maintenance window, temporary sharing exposure or viewing outage decision, monitoring and compatible recovery targets.
4. The exact reviewed commit/release diff; committing and pushing to `Apex88Vent/onlyfast`; frontend and both Edge deployments; M1 and M2 individual migration execution. Approval of this report alone is not an implicit deployment instruction.
5. **M3 separately**, only after installed-client evidence and all preceding acceptance checks pass. No approval here activates purchases, ads, prices, numerical limits or unrelated feature migrations.

**Final recommendation: NOT READY — BLOCKERS REMAIN.** Local implementation and real PostgreSQL verification are substantially complete; production activation waits for the explicit compatibility, staging, data-policy and release approvals above.
