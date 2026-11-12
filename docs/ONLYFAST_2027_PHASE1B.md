# OnlyFast 2027 Phase 1B status

November 12, 2026. **Hosted activation is blocked by the testing connection.**
All work remains on `develop/onlyfast-2027`; no merge into main or production
deployment is authorized or performed.

## 1. Project and connection identity

The requested testing project is `mfzajhnfonrfuiwxgvhe`, organization
`wxswxtsewczfijycqnwi`, connected-account nickname **testing account**. These
testing identity details were supplied and confirmed by the owner. This chat's
available Supabase tool calls have not independently verified them: identity and
table inspection return `MCP error -32600: You do not have permission to perform
this action` for this exact testing reference.

Before the owner's instruction to avoid Primary, discovery returned only
production `thpyjvwtfvfxiufchrxn` in organization `qvmrokdvfsdxmuiaclwk` (Apex88Vent).
The exposed tool definitions have no named-account argument or account-switching
operation. No mutation was attempted through that connection, and no production
credentials were used as a substitute. The owner reports that testing account
works elsewhere; it still needs to be routed to this chat's tool runtime.

## 2. Isolation status

The deployed preview remains the backend-disabled permission inspector. It
ignores inherited Supabase credentials, has a non-networked client on a reserved
`.invalid` origin, does not mount application auth/billing/data providers, and
uses CSP `connect-src 'none'`. Its production-build refusal remains intact.

No Vercel variables, domains or project-wide settings were changed in Phase 1B.
No testing publishable key, database secret or Auth/storage settings were
retrieved because testing access could not be verified. No customer data was
copied. The second GitHub repository and standalone OnlyLaps remain untouched.

Prepared `src/lib/testingEnvironment.ts` requires the exact development branch,
Preview environment, exact HTTPS testing-project endpoint, a publishable key,
and a successful schema-marker RPC before returning a usable connection. It
rejects production, alternate preview branches, URL tricks, secret keys, old
schemas and mismatched project markers. This is **not wired to activate the
app**; successful management-plane identity and security verification must come
first. Authentication storage is scoped to the testing reference.

## 3. Repeatable schema-only bootstrap

`scripts/prepare-2027-bootstrap.mjs` emits an ordered, hashed manifest and 23 SQL
files for a new empty testing database. It performs no network, SQL or CLI calls,
requires the exact testing reference, refuses existing output directories and
cannot write into the production migration directory.

```powershell
node scripts/prepare-2027-bootstrap.mjs tmp/onlyfast-2027-bootstrap-new mfzajhnfonrfuiwxgvhe
```

Reviewed order: existing schema-only staging baseline and retained historical
schema steps; Phase 1 authorization/usage/owner policies; existing test-tier RPCs;
testing-only sharing cleanup; 2027 limits, persistent weekend aliases and usage
policies; then a public non-secret environment/version verification RPC.

The old production M3 sharing correction requires exact production catalog
hashes and is unsuitable for a fresh schema. The testing bootstrap instead
removes the same two obsolete permissive sharing policies after installing owner
policies and the code-redemption RPC. Historical production files are untouched.

The current application uses independent Supabase Auth user metadata for profiles
and car-class selection. The schema contains race/base setup/session rows,
notes/results/timing JSON, schedules, parts, sharing, subscription rows, feature
flags, usage counters and existing relational dependencies. No new standalone
OnlyLaps implementation or UI is imported. The baseline contains existing shared
schema prerequisites only; it does not initialize the standalone OnlyLaps app.

The bootstrap rejects an already initialized schema/Auth database rather than
resetting it. All customer/account tables are empty after replay. Real Supabase
Auth, Data API and native extensions must still be checked on the actual testing
project. A management identity check must confirm both project and organization
before every hosted apply; the SQL marker is an assertion, not independent proof
of which connection was selected.

## 4. Database changes applied

**None applied to any hosted database.** SQL was executed only in disposable
in-memory PostgreSQL/PGlite fixtures. New SQL lives under `supabase/testing-2027`,
outside `supabase/migrations`. GitHub validation never invokes a database deploy.

Prepared additions: private RLS-protected weekend-alias and per-weekend timing
usage tables; a testing policy column for scan allowance per weekend; the updated
reservation/finalization protocol; and schema-marker verification. Browser roles
cannot edit these tables, subscriptions, tester grants or quota counters.

## 5–7. Auth, functional setups and tier switching

Hosted signup/login/logout/session persistence, actual application setup saving,
and interactive authorized tier switching **have not been executed**. No
synthetic hosted accounts or passwords were created. The actual application
remains unmounted as required until the backend is verified and secured.

Local database tests verify the complete bootstrap, explicit API grants, all
application-table RLS, anonymous denial, cross-account setup read/update/insert
denial, subscription/usage write denial and unauthorized tier-switch rejection.
The existing 2027 database regressions cover server-authorized Sportsman/Pro/
Factory overrides, revocation, base/regular quotas, viewable 48-hour locks,
class restrictions and unchanged billing rows. These are SQL/React fixtures,
not claims of real Supabase Auth sessions or hosted application acceptance.

## 8. Sportsman timing scans

The canonical config now expresses **two scans per race weekend** and no monthly
allowance for Sportsman. Rookie remains two scans per month. Pro/Factory remain
unlimited. Card copy derives from the corrected config.

The testing SQL resolves an owned persisted session into the existing immutable
weekend ID. Reservations and completed consumption use that ID, serialize on the
user, count in-flight reservations, cache idempotent retries, and never carry
unused allowance into another weekend. A separate private timing counter avoids
writing Sportsman consumption into Rookie's monthly table.

Persistent owner-scoped aliases retain recognized schedule/event/name identity
after edits and deletion. Changing a saved session's name/date retains the same
weekend. Recreating known aliases reuses the original clock and quota. Aliases
are inaccessible to clients. This does not claim to infer real-world event
equivalence when every identifying detail is newly invented.

The Edge reservation adapter forwards the persisted session ID for timing as
well as Assist. Sportsman receives the correct weekend-limit error. No Edge
Function was deployed. Tests verify two allowed scans, a rejected third, a fresh
allowance for another weekend, missing/foreign-session rejection, recognized
rename/date/recreation continuity, and a separate unchanged Rookie monthly quota.

## 9. Preview

[Development preview](https://onlyfast-git-develop-onlyfast-2027-apex88vents-projects.vercel.app/upgrade)
remains a clearly labeled inspector with indexing disabled. Phase 1B does not
claim that it connects to the new database. Owner Vercel sign-in may be required.

## 10. CI and validation

Both earlier hosted runs stopped during `tests/nativeSandbox.test.ts`; the second
log reported a runner shutdown signal and a pending promise after shutdown. The
runner used Node 24.22.2. The native sandbox file passes locally on both 24.18.0
and 24.22.2, including an isolated run of its filesystem test. No deterministic
application assertion failure was reproduced; the shutdown cause is unconfirmed.

The workflow now pins locally verified Node 24.18.0, limits test concurrency to
two processes and sets a 20-minute job timeout. It runs the complete test glob,
both TypeScript checks and the preview build, with read-only GitHub permissions
and no database secrets or migration commands. Hosted reliability must be
confirmed by the new run; it is not inferred from local success.

Local Phase 1B validation: **579 tests passed, zero failed/skipped**; application
and node/Vite TypeScript checks passed; normal optimized application and preview
builds passed (the normal application retains its existing large-chunk warning). Native
extensions, Auth issuance, actual storage, hosted RLS and security advisors were
not exercised through the denied testing connection.

## 11. Security and archive preparation

Anonymous/foreign-owner/unauthorized-tier tests pass on the actual generated SQL
in disposable PostgreSQL. All rebuilt application tables have RLS, explicit
authenticated grants and private-table mutation denial. No service-role key is
introduced into browser code. Hosted Supabase advisors remain unrun.

[Archive design](ONLYFAST_2027_ARCHIVE_PLAN.md) specifies weekend-level permanent
archive state, retained values, Sportsman read/restore denial, Pro/Factory access,
active-slot counting, and immutable clock/quota/alias retention. No archive UI,
archive columns, automatic deletion or premature slot-recovery change is made.

## 12–13. Blockers and required configuration

1. Expose/select the **testing account** Supabase connection for this chat, with
   management/SQL/function access to `mfzajhnfonrfuiwxgvhe` in
   `wxswxtsewczfijycqnwi`. A password, publishable key alone or a production
   connection cannot replace this verification. Do not paste private credentials.
2. Once accessible, inspect existing tables/Auth rows/migrations/triggers/RLS,
   storage, Edge Functions, integration and advisors. Confirm actual project/org
   independently before applying reviewed bootstrap SQL. If nonempty, reconcile
   without deleting or resetting it. Inspect the second-repository integration
   without modifying or deleting that repository.
3. Retrieve only the testing publishable key. Configure branch-specific Preview
   values for `develop/onlyfast-2027`; never production or all previews. Verify
   the environment RPC/Data API/security, then enable the actual application,
   testing badge and authorized three-tier selector with purchase/ad holds.
4. Create synthetic Auth accounts without repository passwords. Run real browser
   signup/login/logout/persistence, setup/session/notes/results and tier tests,
   plus API attacks and security advisors against the verified testing project.
5. Deploy needed Edge Functions only to testing. Provide independently authorized
   testing AI provider secrets if real OCR/Setup Assist calls are required; never
   copy production secrets. No RevenueCat, Stripe, App Store or Google Play
   purchasing should be enabled for this test-tier workflow.
6. Verify the fresh hosted CI run before calling the pipeline reliable. No merge
   or automatic production migration/deployment is part of this task.

The existing stash of billing, advertising and analytics work is retained.
