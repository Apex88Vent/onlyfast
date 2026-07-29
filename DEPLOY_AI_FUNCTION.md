# Deploy OnlyFast Setup Assist

Setup Assist runs in the Supabase Edge Function named exactly:

```text
get-suggestions
```

The canonical source is:

```text
supabase/functions/get-suggestions/index.ts
```

It imports required modules from `supabase/functions/_shared`. Do not paste
`index.ts` into the dashboard by itself; Supabase will fail to bundle the
missing shared modules.

## Recommended deployment

Deploy from the repository through the existing GitHub/Supabase deployment
workflow. A repository deployment includes the function and its `_shared`
dependencies automatically.

For a Supabase CLI deployment:

```bash
supabase link --project-ref thpyjvwtfvfxiufchrxn
supabase functions deploy get-suggestions
supabase functions deploy get-onlylaps-setup-context
```

Both functions must have **Verify JWT enabled**. This is also recorded in
`supabase/config.toml`.

## Required secrets

`get-suggestions` requires:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase-provided values are normally available automatically. Add or
update `OPENAI_API_KEY` under **Project Settings → Edge Functions → Secrets**.

## Telemetry-enhanced Setup Assist

The function retrieves linked OnlyLaps telemetry server-side. The browser sends
only the exact active `race_setups.id`; it never sends telemetry JSON.

Telemetry enhancement remains limited to experimental testing accounts with
the existing `test_account_full_access` feature. Normal accounts continue to
receive the original non-telemetry Setup Assist behavior.

The small beta-only status line uses `get-onlylaps-setup-context`, so deploy
that function alongside `get-suggestions`.

No SQL migration is required for this connection step.
