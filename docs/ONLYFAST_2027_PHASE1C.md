# OnlyFast 2027 Phase 1C verification

November 12, 2026 (America/Los_Angeles). Work remains on
`develop/onlyfast-2027` in `Apex88Vent/onlyfast`. No merge into main, production
database change, production deployment, customer-data copy, or real billing
activation was performed.

## Database initialization

Only the dedicated `supabase-onlyfast-2027` MCP was used. Its project URL was
checked again before every bootstrap migration and matched
`https://mfzajhnfonrfuiwxgvhe.supabase.co`. Public tables, application migrations,
and Auth users were empty before installation. Required native extensions were
available. The bundled Primary Supabase connection was never used.

The existing `tmp/onlyfast-2027-phase1b-bootstrap-reviewed/manifest.json` and all
23 prepared files matched their SHA-256 hashes and current source definitions.
The files were not regenerated. The dependency order was preserved: baseline,
historical dependencies, authorization, testing overrides, sharing cleanup,
2027 policy/usage limits, then environment verification.

All 23 files applied successfully. A separate testing-only follow-up,
`supabase/testing-2027/phase1c-api-hardening.sql`, removed unnecessary anonymous
canonicalization access and browser execution of a trigger function, and added
the missing owner-only read policy for server-written monthly timing counters.
Production migration files were not edited.

Installed inventory: **24 migration records, 23 public tables, 6 private tables,
59 functions, 23 application triggers, and 64 policies**. Every application table
has RLS enabled. Detailed names, signatures, trigger state, policies and explicit
API grants are recorded in [the schema inventory](ONLYFAST_2027_PHASE1C_SCHEMA.json).
The schema-marker RPC works through the actual Data API with only the testing
publishable key. The native expiration cron job has recorded successful runs.

## Database and security verification

Actual hosted Auth sessions and Data API requests verified:

- Sportsman allows two base templates and five regular weekend slots; the next
  insert is denied. Pro rejects another class; Factory accepts another class.
- Authorized accounts can switch Sportsman, Pro and Factory. Server membership
  resolves the selected tier, while billing rows remain unchanged.
- Foreign setup reads and updates return no rows; foreign-owner inserts fail.
  Direct subscription and quota writes fail. Unauthorized tier switches and
  administrator grant RPCs fail. Editable user metadata cannot grant paid access.
- A foreign membership lookup fails. All client configuration uses a publishable
  key; no service-role key was retrieved or added to frontend configuration.

Hosted PostgreSQL transactions, using the installed functions and real database
roles, additionally verified Sportsman's 48-hour edit lock with retained readable
values, Pro/Factory editing of old setups, two timing scans per weekend, a denied
third scan, idempotent retries, separate weekend allowance, one Setup Assist per
weekend, and unlimited Pro/Factory timing reservations. These verification
transactions rolled back; they did not consume the testers' allowances. They
test the server reservation/finalization protocol, not a live OCR/AI provider.

Security advisors have **no ERROR findings**. The two anonymous definer warnings
were resolved. Remaining findings:

- 14 authenticated definer-function warnings: intentional guarded membership,
  class/onboarding and admin operations. Unauthorized admin calls, foreign
  membership requests and editable-metadata escalation were tested and denied.
  [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- 8 informational RLS-without-policy findings: six private server-only tables
  and two server-only public tables, deliberately inaccessible to clients.
  [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Leaked-password protection is disabled in testing Auth. The dedicated MCP
  exposes no Auth configuration update tool. This setting remains unresolved.
  [Password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Health advisors returned no findings.

## Vercel and application activation

[Testing application](https://onlyfast-git-develop-onlyfast-2027-apex88vents-projects.vercel.app/app).
Existing Vercel authentication protection remains enabled; owner sign-in may be
required. Only the current project's exact development branch received new
Preview variables:

- `VITE_ONLYFAST_2027_APP`
- `VITE_ONLYFAST_2027_SUPABASE_URL`
- `VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY`

All 24 existing Production environment records, their values, scope and update
timestamps were independently compared before and after and were unchanged.
No global/all-Preview overrides or project-wide build settings were modified.

The app now mounts the existing OnlyFast interface after a successful testing
schema-marker request. Wrong branch, deployment target, endpoint, key type or
schema identity fails closed. The testing client has its own persistent Auth
storage key and rejects fetches outside the exact testing origin. Its CSP permits
only this Supabase HTTPS/WebSocket origin, self and required font resources;
production Supabase is excluded. All responses are marked `noindex, nofollow`.

The app displays a TESTING banner. The selector shows Sportsman, Pro and Factory
for server-authorized testers and cannot mount checkout for other accounts.
Native purchase/ad activation flags and purchase API keys are disabled at build
time in this environment. Existing purchase-management controls are replaced by
the testing notice. No Stripe/RevenueCat products, webhooks, stores or live
purchase configuration were activated. Future OnlyLaps linking controls remain
disabled for this exact isolated backend. No standalone OnlyLaps source or
archive UI was changed.

## Hosted functional acceptance

Four synthetic identities were provisioned only in testing: authorized Sportsman,
Pro, and Factory accounts plus an unprivileged account. Normal Supabase password
login succeeded for all four. Credentials are outside the repository in the
operator's private Codex directory with file access restricted to the current
Windows user; no passwords or tokens were committed.

The READY Vercel application was exercised in a browser, against real testing
Auth and Data API endpoints:

- Login and session persistence after reload, with a testing-specific storage key.
- A base template with chassis values saved and verified in the database.
- A new race weekend created with Hot Laps, Heat and Main Event rows.
- Existing weekends reopened with track data and independent session notes.
- Session notes edited and saved independently through the hosted interface.
- Multi-day schedule dates, organization and finishing position saved and visible
  after reload.
- Sportsman, Factory and Pro changed through the hosted selector and independently
  confirmed server-side, with no Stripe checkout element mounted.
- Mobile subscription layout at 390px had no horizontal overflow.
- Recorded browser requests contacted only `mfzajhnfonrfuiwxgvhe` for Supabase;
  zero production Supabase requests and zero application JavaScript errors.

Browser evidence is retained locally under `tmp/onlyfast-2027-phase1c/`, including
a mobile screenshot and a redacted network summary. Temporary deployment access
was used for verification without disabling Vercel protection.

## Automated validation and remaining blockers

Full local `npm run qa:regression`: **696 passed, 0 failed/skipped** (581 unit,
92 mounted-component, 23 database tests). Both application and node/Vite TypeScript
checks passed. The optimized testing build passed, with the existing large-chunk
warning. The testing security follow-up also passed empty-database replay.

Initial activation commit `3c55ef6b` passed
[GitHub Actions run 43339399494](https://github.com/Apex88Vent/onlyfast/actions/runs/43339399494)
and Vercel deployment `dpl_Kx65AWBy4ysgniprvypnDN11KCaA` reached READY.
Follow-up deployment/CI results are reported in the task completion message.

**Signup email delivery is still blocked:** real signup requests return
`over_email_send_rate_limit` / `email rate limit exceeded` from testing Supabase
Auth. Reserved example-domain addresses were also rejected by Auth validation.
Existing login tests use explicitly provisioned, confirmed synthetic identities;
they are not claimed as successful end-to-end signup/verification-email tests.
Testing SMTP/email configuration must be resolved to complete that acceptance
item. No additional OAuth flow was attempted.

Real OCR/Setup Assist provider calls remain unverified because no testing AI
provider secret was supplied or copied. Database allowances and permissions were
verified without provider calls. Live billing, advertisements, customer data,
production settings and standalone OnlyLaps remain outside this phase.
