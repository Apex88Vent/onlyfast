# OnlyFast account beta features

OnlyFast uses the existing Supabase project and deployment. Beta permissions
are stored against immutable Supabase Auth user IDs, not frontend email checks.

## Current feature keys and assignments

| Feature key | Purpose | `test@test.com` | `c_marin88@yahoo.com` |
| --- | --- | --- | --- |
| `test_account_full_access` | Preserves the disposable account's existing full-access testing behavior | Enabled | Disabled |
| `test_account_reset` | Allows the disposable account to clear its test data | Enabled | Disabled |
| `onboarding_preview_route` | Protects `/onboarding-preview` | Enabled | Disabled |
| `rookie_ad_slot_preview_route` | Protects `/rookie-ad-slot-preview` | Enabled | Disabled |

Both accounts are authorized in `beta_tester_accounts`. The personal account
starts with no enabled features, so it keeps the normal production experience
and does not show a beta badge until a feature is deliberately assigned.

The existing schedule class field and schedule export are already production
features. They were not moved behind beta flags.

## Activation in the existing project

Apply `supabase/migrations/20260728_add_account_beta_feature_flags.sql` to the
existing Supabase project, then deploy these updated functions from their
canonical `supabase/functions` folders:

- `get-suggestions`
- `scan-timing-screen`
- `reset-test-account`

The migration itself resolves both existing Auth user IDs and creates the
initial assignments. Do not create a second project or deployment. If using the
Supabase CLI, authenticate and link this repository to the existing project
before running the normal database-push and function-deploy workflow.

## Safe administration from the Supabase SQL Editor

First resolve the existing Auth IDs:

```sql
select id, email
from auth.users
where lower(email) in ('test@test.com', 'c_marin88@yahoo.com');
```

The management functions accept Auth user IDs. They allow the Supabase SQL
Editor, the service role, or an authenticated user whose immutable
`app_metadata.has_admin_full_access` is `true`. Merely being a beta tester does
not grant management permission.

Enable a feature for the experimental account only:

```sql
select public.admin_set_beta_feature(
  (select id from auth.users where lower(email) = 'test@test.com'),
  'onboarding_preview_route',
  true
);
```

Enable the same feature for both beta accounts:

```sql
select public.admin_set_beta_feature(
  (select id from auth.users where lower(email) = 'test@test.com'),
  'onboarding_preview_route',
  true
);

select public.admin_set_beta_feature(
  (select id from auth.users where lower(email) = 'c_marin88@yahoo.com'),
  'onboarding_preview_route',
  true
);
```

Disable a feature for one account:

```sql
select public.admin_set_beta_feature(
  (select id from auth.users where lower(email) = 'c_marin88@yahoo.com'),
  'onboarding_preview_route',
  false
);
```

Disable every beta feature without deleting assignments:

```sql
select public.admin_set_beta_tester_account(
  (select id from auth.users where lower(email) = 'c_marin88@yahoo.com'),
  true,
  false,
  'personal'
);
```

Re-enable the account master switch:

```sql
select public.admin_set_beta_tester_account(
  (select id from auth.users where lower(email) = 'c_marin88@yahoo.com'),
  true,
  true,
  'personal'
);
```

## Adding a new beta feature

Register a descriptive feature key:

```sql
insert into public.beta_feature_definitions (
  feature_key,
  description,
  maturity_stage
)
values (
  'new_schedule_page',
  'Replacement schedule experience.',
  'experimental'
);
```

Add the key once in `src/lib/betaFeatures.ts`, then use
`hasBetaFeature(BETA_FEATURES.newSchedulePage)` for small UI branches or
`BetaRoute` for a page. Any write, AI call, export, privileged operation, or
other security-relevant backend action must repeat the check with the verified
JWT user ID and `supabase/functions/_shared/beta-features.ts`.

## Maturity workflow

1. **Experimental:** set `maturity_stage='experimental'` and enable only for the
   disposable experimental account.
2. **Personal beta:** change the catalog stage deliberately and enable the same
   key for the personal account.
3. **Production:** make the production implementation the default, remove the
   flag branch and backend flag requirement where appropriate, then remove
   obsolete assignments and the catalog key in a later cleanup migration.

No feature is promoted automatically.

## Security and failure behavior

- RLS lets authenticated users select only their own account and flag rows.
- Browser roles have no insert, update, or delete grants or policies.
- Admin authority is checked independently from beta-tester status.
- The frontend clears stale beta state before every lookup and falls back to
  production if either query fails.
- Realtime changes, window focus, and visibility changes revalidate flags so a
  disabled feature returns to production behavior promptly.
- The reset function, Setup Assist, and timing scan resolve the legacy
  experimental full-access behavior from the verified Auth user ID on the
  server. Browser booleans are not trusted.

## Test checklist

- [ ] `test@test.com` receives only its four enabled experimental flags.
- [ ] `c_marin88@yahoo.com` receives only explicitly assigned flags and starts
      with none.
- [ ] A normal account sees no beta badge, buttons, navigation, fields, or
      preview pages.
- [ ] The personal account retains its existing cars, setups, weekends, timing,
      schedules, settings, subscription, and other data.
- [ ] A normal account that enters a preview URL is redirected to `/`.
- [ ] The personal account is also redirected from any preview route that has
      not been assigned to it.
- [ ] Direct browser attempts to insert, update, or delete flag rows are denied.
- [ ] Calling either admin management RPC as a non-admin is denied.
- [ ] A beta lookup/network failure logs an error and shows the production
      experience without blocking stable functionality.
- [ ] Disabling a flag while the account is signed in removes access after the
      Realtime event or the next focus/visibility refresh.
- [ ] `reset-test-account` rejects every user except the stored experimental
      account with `test_account_reset=true`.
