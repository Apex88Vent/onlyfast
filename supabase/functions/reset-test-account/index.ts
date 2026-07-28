// Required secrets:
// - TEST_ACCOUNT_RESET_ENABLED=true to enable
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Recommended Supabase setting:
// - Verify JWT: ON. This function also verifies the bearer token server-side
//   and checks the caller's account-level reset feature.
//
// =============================================================================
// reset-test-account  (Supabase Edge Function)  — DEV/DEMO ONLY
// -----------------------------------------------------------------------------
// Securely resets APP DATA for the authorized experimental account. It NEVER
// deletes the Supabase Auth user, so the account remains reusable.
//
// SAFETY MODEL (all enforced server-side — the frontend flag is NOT a boundary):
//   1) SERVER-SIDE ENABLE FLAG
//      Refuses to run unless the env secret TEST_ACCOUNT_RESET_ENABLED === "true".
//      Set this to anything else (or unset it) before production to hard-disable.
//   2) JWT VERIFICATION
//      Manually verifies the caller's bearer token via auth.getUser(token).
//      (Also deploy with "Verify JWT" = ON for defense-in-depth.)
//   3) ACCOUNT-SPECIFIC FEATURE CHECK
//      Only proceeds when the verified Auth user ID belongs to an experimental
//      beta tester with test_account_reset explicitly enabled.
//   4) NO CLIENT-SUPPLIED IDS
//      user_id is derived from the verified token, never from the request body.
//   5) NO BILLING SIDE-EFFECTS
//      Only the LOCAL public.user_subscriptions row is cleared. No Stripe / Apple
//      / Google APIs are ever called, so no real billing record can be affected.
//      (the disposable experimental account should never hold real billing.)
//
// DEPLOY (dashboard):
//   - Function name: reset-test-account
//   - Verify JWT: ON
//   - Secrets (Project Settings → Edge Functions → Secrets):
//       TEST_ACCOUNT_RESET_ENABLED = true        ← set to "false" to disable
//       SUPABASE_URL               = (auto-provided)
//       SUPABASE_SERVICE_ROLE_KEY  = (auto-provided)  ← stays server-side only
//
// DEPLOY (CLI):
//   mkdir -p supabase/functions/reset-test-account
//   cp docs/edge-functions/reset-test-account.ts supabase/functions/reset-test-account/index.ts
//   supabase secrets set TEST_ACCOUNT_RESET_ENABLED=true
//   supabase functions deploy reset-test-account
//
// To disable, turn off test_account_reset for the experimental account or set
// TEST_ACCOUNT_RESET_ENABLED=false on the server.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasBetaFeatureForUser } from '../_shared/beta-features.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // (1) SERVER-SIDE ENABLE FLAG -------------------------------------------
    const enabled = (Deno.env.get('TEST_ACCOUNT_RESET_ENABLED') ?? '').toLowerCase() === 'true';
    if (!enabled) {
      return json({ error: 'Test account reset is disabled on the server.' }, 403);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // (2) JWT VERIFICATION ---------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Missing bearer token.' }, 401);

    // Admin client (service role) — never exposed to the browser.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid or expired token.' }, 401);
    }
    const verifiedUser = userData.user;

    // (3) ACCOUNT FLAG — derived from the verified Auth user ID --------------
    const canReset = await hasBetaFeatureForUser(
      admin,
      verifiedUser.id,
      'test_account_reset',
      'experimental',
    );
    if (!canReset) {
      return json({ error: 'Forbidden: this endpoint only resets the test account.' }, 403);
    }

    // (4) user_id comes ONLY from the verified token, never from the body ----
    const userId = verifiedUser.id;

    // ----------------------------------------------------------------------
    // Targeted deletes of this user's app data. Adjust the table list here if
    // your schema differs — use the ACTUAL current table names, by user_id.
    // NOTE: No Stripe/Apple/Google API calls are made anywhere below, so no
    // real billing record can be affected (point 6).
    // ----------------------------------------------------------------------
    const byUserId = [
      'race_setups',
      'race_sessions',
      'race_schedule',
      'parts_reference',      // user-specific (has user_id) — safe to clear by user_id
    ];

    const results: Record<string, string> = {};

    for (const table of byUserId) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      results[table] = error ? `skip/err: ${error.message}` : 'cleared';
    }

    // Shared/owned setups created by this user (column may differ in your schema).
    {
      const { error } = await admin.from('shared_setups').delete().eq('shared_by', userId);
      results['shared_setups'] = error ? `skip/err: ${error.message}` : 'cleared';
    }

    // Subscription/promo state — LOCAL row only, NO Stripe API call.
    {
      const { error } = await admin.from('user_subscriptions').delete().eq('user_id', userId);
      results['user_subscriptions'] = error ? `skip/err: ${error.message}` : 'cleared';
    }

    // Reset onboarding/profile/demo metadata back to a brand-new state.
    // (Does NOT delete the auth user — point 6/requirement 6.)
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {},
    });

    return json({ ok: true, userId, results });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
