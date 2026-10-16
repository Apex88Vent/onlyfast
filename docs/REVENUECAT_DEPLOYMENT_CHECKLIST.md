# OnlyFast RevenueCat backend deployment checklist

Reviewed October 16, 2026 (America/Los_Angeles). **Prepared locally; nothing deployed.**
No migrations were applied to Supabase, production records changed, purchases
enabled, offerings changed, paywalls published, or Apple products submitted.
SQL tests execute only in disposable in-memory PostgreSQL (PGlite).

The code is ready for a staging rehearsal. Production readiness still requires
the operator checks and acceptance tests below; this is not evidence of a live
store purchase or successful hosted deployment.

## Read-only inventory and current blockers

Supabase: `thpyjvwtfvfxiufchrxn`. RevenueCat: `proj79983fe3`.

- June subscription preparation is recorded as applied. The September sync,
  September expiration schedule, and October 15 authorization migrations are absent.
- Neither `revenuecat-webhook` nor `sync-revenuecat-subscription` is deployed.
- No RevenueCat webhook integration exists. None of the six `REVENUECAT_*`
  secrets below is present in the Supabase secret-name inventory. Secret values
  were not retrieved or printed.
- Live subscription rows: 2 active Stripe Pro, 1 trialing Stripe Pro, and 6 free
  inactive rows. No live RevenueCat subscriptions exist in this table.
- Live metadata audit: 0 legacy promo/admin claims, 0 server-owned promo/admin
  grants, and 0 scoped vehicle grants. Two accounts have the explicit experimental
  tester full-access flag. Recheck these counts and business grant records at rollout.
- **Security blocker:** the live `onlyfast_subscription_tier` and deployed
  `get-suggestions` still accept user-editable admin/promo claims. The pending
  authorization migration and reviewed local authorization handlers must ship
  before considering the backend secure. These live functions were not changed.
- Live subscription RLS permits only own-row SELECT, but legacy table grants
  include client write/TRUNCATE privileges. Pending migrations now revoke all
  client table privileges and explicitly restore authenticated own-row SELECT.
  The live table has no explicit column ACLs to preserve or clear separately.
- RevenueCat entitlements are active: `OnlyFast Pro` (`entl73664a0fc7`) and
  `OnlyFast Teams` (`entlcd6b151566`). Both platforms' Pro products grant Pro;
  Teams products grant both entitlements. The Test Store is excluded by the
  backend's allowed stores and webhook app allowlist.

Store prices, seven-day trials, and Apple's 175 territories are accepted from
the user's completed configuration. This review confirmed RevenueCat product
attachments, not store pricing/territories or trial eligibility on a physical device.
RevenueCat catalog fields such as `trial_duration: null` are not proof that the
store's introductory offer is missing. Do not recreate or submit products here.

## Required database migrations, in order

Baseline dependencies already present in this project: `user_subscriptions`,
its unique `user_id` constraint, own-row SELECT RLS, July class-selection and
beta-feature tables/functions. Root `SUBSCRIPTIONS_RLS.sql` is the fresh-database
baseline, not a migration to replay over production.

| Order | Migration | Live status / purpose |
| --- | --- | --- |
| Prerequisite | `20260630_prepare_user_subscriptions_for_revenuecat.sql` | Already applied; provider identity/expiration columns and Stripe source backfill. |
| 1 | `202609240001_revenuecat_subscription_sync.sql` | Pending; provider snapshots, event ledger, atomic service-only RPC, legacy Stripe write recognition, expiry function and client privilege boundary. |
| 2 | `202609240002_schedule_revenuecat_expiration.sql` | Pending; enable `pg_cron` if needed and schedule `onlyfast-expire-revenuecat` every minute. Requires the sync migration. |
| 3 | `20261015235847_secure_membership_authorization.sql` | Pending; replace editable-claim authorization with database subscriptions, server-owned grants and explicit tester flags. Requires RevenueCat columns and beta tables. Preserves scoped server vehicle grants. |

The two edited migrations are confirmed unapplied in the connected project.
If another environment has already applied either original file, use a separately
reviewed forward migration there rather than silently editing its migration history.

Other local history gaps must be handled separately: July OnlyLaps foundation,
July session linking, July designated-account grant, October onboarding restoration
and October road-racing enablement. The October 1 account verification is recorded
as applied. Missing history is not proof its schema/data is absent: tester flags
already exist. Do not run a blanket `db push`, replay account-grant scripts, or
apply unrelated migrations to deploy subscriptions. Reconcile history against
live definitions with the responsible operator first.

`202610130001_restore_racing_onboarding.sql` touches subscription/class state and
`onlyfast_private.has_unlimited_vehicles`; it is not required for the subscription
backend alone. If an independently approved app/onboarding release includes it,
apply it before the secure authorization migration (chronological order), so
the final vehicle helper enforces native expiry and preserves trusted grants.
The existing combined onboarding + membership SQL suite covers this sequence.
Road-racing enablement does not replace subscription authorization.

## Required Edge Functions

| Function | Gateway JWT setting | Authentication / deployment action |
| --- | --- | --- |
| `revenuecat-webhook` | `false` | New. Exact configured Authorization header required before DB/API access; allowlisted apps/environments; authoritative subscriber lookup. |
| `sync-revenuecat-subscription` | `false` | New. Handler verifies bearer JWT with `auth.getUser`; syncs only that authenticated UUID. Request-body user ID, product and plan are ignored. |
| `get-suggestions` | Keep `true` | Deploy reviewed local handler to remove editable admin claims and enforce server grants/native expiry. Include `_shared/beta-features.ts`. |
| `scan-timing-screen` | Keep existing `true` | Deploy reviewed local handler to use the same trusted membership/expiry rules for paid scan quotas. Include `_shared/beta-features.ts`. |

Both new RevenueCat functions bundle `_shared/revenuecat.ts` and pin
`@supabase/supabase-js` to `2.108.2`; `deno.lock` records the checked dependencies.
JWT settings for the new endpoints are in
`supabase/config.toml`; disabled gateway verification does not disable handler auth.
Preserve the existing scan quota table; do not reset usage records.

**Keep the deployed Stripe webhook and billing portal.** The deployed webhook
uses `SERVICE_ROLE_KEY`, preserves its existing email/customer fallback and
`current_period_end`, and omits `subscription_source`. The new capture trigger
recognizes its explicit Stripe identifier writes before projecting the effective
plan. Tests cover this legacy upsert, cancellation into native access, renewal
back into Stripe access, and service-role writes. The repository's different
Stripe implementation must not be deployed as part of this checklist.
No frontend checkout, Stripe price, Buy Button, portal or payment-link changes
are required for this backend work.

## Required Supabase secrets

| Name | Required value |
| --- | --- |
| `REVENUECAT_SECRET_API_KEY` | Server-only OnlyFast project key usable with REST v1 `GET /subscribers/{Supabase UUID}`; confirm access in staging. Do not use a public SDK key. |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Long random secret including the exact chosen prefix, e.g. `Bearer <random-secret>`. Copy the full value to the webhook. |
| `REVENUECAT_APP_IDS` | `app82192c9834,appd348665a60` (RevenueCat app IDs, not `app.onlyfast`). |
| `REVENUECAT_PRO_ENTITLEMENT_ID` | `OnlyFast Pro` (matches default; use identifier, not opaque `entl...` ID). |
| `REVENUECAT_TEAM_ENTITLEMENT_ID` | `OnlyFast Teams` (matches default). |
| `REVENUECAT_ALLOW_SANDBOX` | `false` for production; `true` only in isolated staging. |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; their names
are already present. Keep all existing Stripe/portal secrets unchanged, including
`PROJECT_URL`, `SERVICE_ROLE_KEY`, `SITE_URL`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, and `STRIPE_TEAMS_PRICE_ID`.
Preserve `ONLYFAST_ADMIN_EMAILS` if an independently approved server allowlist is
used by the existing authorization handlers. No RevenueCat secret belongs in a
`VITE_*` variable, browser bundle, migration, test fixture, or this document.

## RevenueCat webhook configuration (manual, future deployment)

- Create only after schema, secrets and function deployment have been validated.
- Production URL:
  `https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/revenuecat-webhook`.
- Configure the Authorization field to exactly match the Supabase secret.
- Select both real store apps; production environment only. Staging needs a
  separate URL/configuration and sandbox environment with the staging secret.
- Include all subscription lifecycle events and transfers: purchase, renewal,
  cancellation, uncancellation, product change, billing issue, expiration,
  extension, refund/revocation and refund reversal as available. No fragile
  per-event plan interpretation is used: each event fetches current subscriber state.
- A TEST delivery checks authentication/connectivity only. A valid subscription
  event must also reach RevenueCat REST v1 and the atomic database RPC.
- Monitor failures and retry failed deliveries after resolving their cause.
  The handler returns failure on API/database errors instead of acknowledging a
  lost update. Duplicate event IDs are tracked per user; partial transfers can retry.
- Anonymous-only IDs and conflicting UUID aliases fail visibly for identity
  investigation. Use the Supabase user UUID as appUserID, retain the intended
  restore ownership policy, and test both sides of transfers independently.

## Authorization and access acceptance criteria

- Subscription writes and RevenueCat RPC execution are service-only. Clients may
  read their own subscription; they cannot update, insert, delete, truncate, add
  triggers, read the event ledger, or invoke the sync RPC directly.
- Paid/admin authorization never reads `raw_user_meta_data`, user-editable
  `membership_tier`, localStorage or client-supplied entitlement assertions.
  The final SQL tier resolver, local UI trust resolver and paid Edge handlers
  use trusted database records / fresh `auth.getUser().app_metadata` instead.
- Review legitimate legacy grants against independent records. Preserve the
  original level and expiry through server-owned `app_metadata` before rollout;
  never bulk-copy editable claims. Current read-only audit found none to migrate.
  Active server promotions/admin grants and explicit tester flags survive native
  sync/expiration; scoped vehicle grants retain only their vehicle scope.
- Active/trialing Stripe Pro/Teams takes precedence even if native Teams is higher.
  Cancellation/inactivity falls back to a valid native entitlement. Stripe IDs,
  billing period, class fields and existing account data remain intact.
- `OnlyFast Teams` maps to `teams`; `OnlyFast Pro` maps to `pro`. Teams wins when
  both are active. Products are matched through entitlements, including Apple's
  `app.onlyfast.pro.monthly` / `app.onlyfast.teams.monthly` and Google's
  `pro:pro` / `teams:teams`; their price strings do not authorize access.
- Native trials are active access until their store expiration without requiring
  payment. Cancellation keeps access until expiry; valid grace extends access;
  refunded, expired, unsupported-store and production-disallowed sandbox
  subscriptions cannot grant access. A newer authoritative snapshot replaces an
  older one; duplicate/equal/stale snapshots do not overwrite newer state.
- Native expiry is checked during authorization before cron runs. Cron additionally
  updates the effective plan/status for other readers. If a webhook is missed,
  expiration fails closed; a fresh authenticated sync reconciles any lower native
  entitlement still active. Cron is an expiry sweep, not a RevenueCat API poller.
- Existing Supabase promotions are supported. RevenueCat promotional/lifetime
  entitlements and non-native stores are deliberately excluded from this store
  subscription integration; do not migrate server grants into those products.
- Rookie remains free with no RevenueCat product, purchase, card, API key or
  native plugin required. Continue Free and the existing Rookie quotas remain;
  an unavailable purchase or optional preference write cannot force checkout.

## Deployment and testing procedure (operator actions still pending)

1. Recheck the live inventory and grants, snapshot relevant schema/functions,
   subscription/provider rows, table ACLs, and authorized app grants. Retain the
   existing deployed Stripe source and function versions for comparison.
2. Rehearse the exact migration sequence and hosted Edge deployment in an isolated
   staging project with the actual production table shape (including `id`, unique
   `user_id`, and `current_period_end`). Do not copy real customer payment data.
3. Confirm RLS, RPC grants, required function bundle files and runtime auth settings.
   Verify `onlyfast-expire-revenuecat` exists once, runs every minute and records
   success in `cron.job_run_details`. Cron cannot run inside the in-memory tests.
4. Configure staging secrets and a sandbox webhook. Send TEST, then genuine sandbox
   purchases/restores using test binaries and the store's product configuration.
   Keep production purchase enablement and paywall/offering state unchanged.
5. Test new and returning Rookie accounts taking Continue Free without a payment;
   Pro and Teams trials on both stores; renewal, cancellation through period end,
   grace, refund, expiry, restore, foreground resume, logout/account switch and
   transfer. Verify RevenueCat UUID, provider columns, effective tier and server
   feature gates, not just the SDK success message.
6. Test an existing active/trialing Stripe account with no native entitlements and
   with native events. Confirm original web checkout/portal and paid access persist.
   Exercise the deployed Stripe upsert shape after native access becomes effective.
   Test legitimate promotions/admin/tester flags alongside native expiry.
7. With synthetic staging users, forge user metadata and request bodies, attempt
   direct writes and service RPC calls, replay/duplicate/reorder events, reject
   bad auth, disable RevenueCat/API/database connectivity and retry. Access must
   never upgrade from forged state; failed writes must leave event IDs retryable.
8. After separately authorized deployment, repeat hosted smoke checks and security
   advisors. Verify schema cache recognizes new RPCs, no subscription rows or class
   data changed unexpectedly, and delivery/cron failures are monitored. Existing
   unrelated advisor warnings were observed and were not changed in this task.
9. Native purchase enablement, any current-offering switch, paywall publication,
   Median production rebuild/release and Apple product review submission require a
   separate launch decision. They are not part of this backend checklist execution.

Local validation completed:

- `npm test`: **351 passed, 0 failed**.
- PostgreSQL suites: **3 passed, 0 failed** (`revenuecatDatabase.mjs`,
  `subscriptionAuthorizationDatabase.mjs`, `racingOnboardingDatabase.mjs`).
- Deno 2.5.4 `check` on both RevenueCat Edge entry points: passed.
- TypeScript app and tooling checks, focused ESLint and Vite production build:
  passed. Build retains the existing large-chunk advisory.
- No real store transaction, hosted runtime integration test or cron execution
  was performed. These are remaining acceptance requirements, not implied passes.

Reproduce SQL verification without Supabase credentials:

```powershell
$qaRoot = Join-Path $env:TEMP 'onlyfast-onboarding-qa'
# Only needed if the isolated QA dependency is absent:
npm.cmd install --prefix $qaRoot --no-save --package-lock=false @electric-sql/pglite@0.3.14
$env:PGLITE_MODULE = Join-Path $qaRoot 'node_modules/@electric-sql/pglite/dist/index.js'
node --experimental-strip-types --test tests/revenuecatDatabase.mjs tests/subscriptionAuthorizationDatabase.mjs tests/racingOnboardingDatabase.mjs
```

Ignored QA logs are in `tmp/revenuecat-deployment-{tests,db,deno,build}.log`.

## Rollback considerations

- Prefer a forward fix. Preserve the additive provider columns and event ledger;
  they hold billing state and idempotency history needed for retries and recovery.
- Stop/restrict new webhook delivery and withdraw the new sync endpoint if needed;
  keep production purchases disabled. Disabling the frontend flag alone does not
  stop RevenueCat events or cancel any store subscription.
- Keep expiration enforcement while native paid records remain. Do not disable
  cron or restore an expiry-blind tier function while relying on native access.
- Never restore the editable-metadata authorization implementation or broad client
  privileges as a rollback. Retain secure grants and trusted authorization checks.
- Preserve the existing Stripe functions, secrets, checkout and portal. Removing
  projection triggers while native rows remain can break Stripe/native fallback;
  review provider snapshots and restore effective Stripe state under an explicitly
  approved recovery plan before removing any provider machinery.
- Backups and recovery writes are operator actions, not supplied automatic down
  migrations. Avoid whole-table restores that would erase newer renewals, accounts,
  class changes or grants. Reconcile newer provider state and retry failed events.

References: [Supabase RLS and metadata guidance](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Edge Function authorization](https://supabase.com/docs/guides/functions/auth),
[RevenueCat webhook configuration and retries](https://www.revenuecat.com/docs/integrations/webhooks),
[RevenueCat subscriber model](https://www.revenuecat.com/docs/api-v1/customer-info-model).
