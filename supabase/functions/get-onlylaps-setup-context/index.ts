// Authenticated beta-only reader for the compact OnlyLaps context linked to
// one exact OnlyFast race_setups row. The UI uses status_only for the small
// Setup Assist availability line; full context remains server-generated.

import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getOnlyLapsSetupContext,
  OnlyLapsSetupContextError,
} from '../_shared/onlylaps-setup-context.ts';
import { createOnlyLapsSetupContextStore } from '../_shared/onlylaps-setup-context-store.ts';
import { hasBetaFeatureForUser } from '../_shared/beta-features.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

type ServerAuthResult =
  | { response: Response }
  | {
      user: { id: string };
      admin: ReturnType<typeof createClient>;
    };

async function requireUser(req: Request): Promise<ServerAuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { response: json({ error: 'Server configuration is missing.' }, 500) };
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { response: json({ error: 'Authentication is required.' }, 401) };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    return { response: json({ error: 'Your session is invalid.' }, 401) };
  }

  return {
    user: data.user,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  const hasTelemetryBetaAccess = await hasBetaFeatureForUser(
    auth.admin,
    auth.user.id,
    'test_account_full_access',
    'experimental',
  );
  if (!hasTelemetryBetaAccess) {
    return json({ error: 'Telemetry context is not available.' }, 403);
  }

  const body = await req.json().catch(() => null);
  const onlyfastSessionId =
    body && typeof body === 'object' && !Array.isArray(body)
      ? String((body as Record<string, unknown>).onlyfast_session_id || '').trim()
      : '';
  const statusOnly =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).status_only === true;

  try {
    const context = await getOnlyLapsSetupContext({
      onlyfastSessionId,
      userId: auth.user.id,
      store: createOnlyLapsSetupContextStore(auth.admin),
    });
    if (statusOnly) {
      return json({
        linked: context.linked,
        display_name: context.linked
          ? context.session.display_name
          : null,
        schema_version: context.schema_version,
      });
    }
    return json(context);
  } catch (error) {
    if (error instanceof OnlyLapsSetupContextError) {
      if (error.code === 'invalid_session_id') {
        return json({ error: error.message, code: error.code }, 400);
      }
      if (
        error.code === 'onlyfast_session_not_found' ||
        error.code === 'linked_session_not_found' ||
        error.code === 'ownership_mismatch'
      ) {
        return json({ error: 'Session not found.', code: 'session_not_found' }, 404);
      }
      if (error.code === 'integrity_error') {
        return json({ error: error.message, code: error.code }, 409);
      }
    }
    console.error('get-onlylaps-setup-context failed', error);
    return json({ error: 'Telemetry context is unavailable.' }, 503);
  }
});
