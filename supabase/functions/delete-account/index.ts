// Required secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Recommended Supabase setting:
// - Verify JWT: ON. This function also verifies the caller's bearer token
//   server-side and derives the user id only from that verified token.
//
// Supabase Edge Function: delete-account
//
// Permanently deletes the authenticated user's OnlyFast app data and then
// deletes the Supabase Auth user. This function does not cancel Stripe, Apple,
// or Google subscriptions; users should cancel billing first.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

type DeleteResult = {
  table: string;
  status: 'cleared' | 'skipped';
  note?: string;
};

const isMissingSchemaError = (error: { code?: string; message?: string } | null | undefined) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    (message.includes('column') && message.includes('not found'))
  );
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const results: DeleteResult[] = [];

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL');
    const SERVICE_ROLE_KEY =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        { error: 'Server is missing required configuration. Please contact support.' },
        500,
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'You must be signed in to delete your account.' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'Your session is invalid. Please sign in again.' }, 401);
    }

    const userId = userData.user.id;
    const setupIds: string[] = [];

    const recordResult = (table: string, status: DeleteResult['status'], note?: string) => {
      results.push(note ? { table, status, note } : { table, status });
    };

    const handleDeleteError = (table: string, error: any) => {
      if (isMissingSchemaError(error)) {
        recordResult(table, 'skipped', 'Table or column was not present in this project.');
        return;
      }
      throw new Error(`Could not clear ${table}.`);
    };

    const deleteByColumn = async (table: string, column: string, value: string) => {
      const { error } = await admin.from(table).delete().eq(column, value);
      if (error) {
        handleDeleteError(table, error);
        return;
      }
      recordResult(table, 'cleared');
    };

    const deleteInChunks = async (table: string, column: string, values: string[]) => {
      if (!values.length) return;
      for (let i = 0; i < values.length; i += 100) {
        const chunk = values.slice(i, i + 100);
        const { error } = await admin.from(table).delete().in(column, chunk);
        if (error) {
          handleDeleteError(table, error);
          return;
        }
      }
      recordResult(table, 'cleared', `Cleared rows where ${column} matched owned setup ids.`);
    };

    const { data: setupRows, error: setupLookupError } = await admin
      .from('race_setups')
      .select('id')
      .eq('user_id', userId);

    if (setupLookupError) {
      handleDeleteError('race_setups', setupLookupError);
    } else {
      for (const row of setupRows || []) {
        if (row?.id) setupIds.push(String(row.id));
      }
    }

    // Remove public share links before deleting the setup rows they point at.
    await deleteInChunks('shared_setups', 'setup_id', setupIds);
    await deleteByColumn('shared_setups', 'shared_by', userId);

    await deleteByColumn('race_schedule', 'user_id', userId);
    await deleteByColumn('parts_reference', 'user_id', userId);
    await deleteByColumn('setup_assist_usage', 'user_id', userId);
    await deleteByColumn('timing_scan_usage', 'user_id', userId);
    await deleteByColumn('user_subscriptions', 'user_id', userId);
    await deleteByColumn('race_sessions', 'user_id', userId);
    await deleteByColumn('race_setups', 'user_id', userId);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw new Error('App data was cleared, but the auth user could not be deleted.');
    }

    return json({ ok: true, results });
  } catch (error) {
    console.error('delete-account failed', error);
    return json(
      {
        error:
          'Could not delete your account. Please try again or contact admin@onlyfast.app.',
        results,
      },
      500,
    );
  }
});
