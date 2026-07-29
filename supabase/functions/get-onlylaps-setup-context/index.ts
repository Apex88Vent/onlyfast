// Authenticated backend-only reader for the compact OnlyLaps context linked to
// one OnlyFast race_setups row. Nothing in the current OnlyFast UI or Setup
// Assist flow calls this function yet.

import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getOnlyLapsSetupContext,
  OnlyLapsSetupContextError,
  type OnlyLapsSetupContextStore,
} from '../_shared/onlylaps-setup-context.ts';

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
      admin: SupabaseClient;
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

function createStore(admin: SupabaseClient): OnlyLapsSetupContextStore {
  return {
    async findOwnedOnlyFastSession(sessionId, userId) {
      const { data, error } = await admin
        .from('race_setups')
        .select('id,user_id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: error?.message ?? null };
    },

    async listOwnedLinks(onlyfastSessionId, userId) {
      const { data, error } = await admin
        .from('onlyfast_onlylaps_session_links')
        .select(
          'id,user_id,onlyfast_session_id,onlylaps_session_id,link_method,match_confidence,created_at,updated_at',
        )
        .eq('onlyfast_session_id', onlyfastSessionId)
        .eq('user_id', userId)
        .limit(2);
      return { data: data ?? [], error: error?.message ?? null };
    },

    async findOwnedOnlyLapsSession(sessionId, userId) {
      const { data, error } = await admin
        .from('onlylaps_timing_sessions')
        .select(
          'id,user_id,track_map_id,name,vehicle_name,session_type,started_at,ended_at,weather,device_info',
        )
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: error?.message ?? null };
    },

    async findTrackMap(trackMapId) {
      const { data, error } = await admin
        .from('onlylaps_track_maps')
        .select(
          'id,user_id,created_by,is_active,name,track_name,track_type,track_shape,track_length',
        )
        .eq('id', trackMapId)
        .maybeSingle();
      return { data, error: error?.message ?? null };
    },

    async listOwnedLaps(sessionId, userId) {
      const { data, error } = await admin
        .from('onlylaps_lap_times')
        .select(
          'id,user_id,timing_session_id,lap_number,duration_ms,sector_times_ms,is_valid,excluded_reason,average_speed,max_speed,max_lateral_g,max_longitudinal_g,max_accel_g,max_braking_g',
        )
        .eq('timing_session_id', sessionId)
        .eq('user_id', userId)
        .order('lap_number', { ascending: true });
      return { data: data ?? [], error: error?.message ?? null };
    },

    async listOwnedSectorRows(sessionId, userId) {
      const { data, error } = await admin
        .from('onlylaps_lap_sector_times')
        .select(
          'lap_id,timing_session_id,user_id,sector_index,duration_ms,is_valid,source_definition_version,source_kind',
        )
        .eq('timing_session_id', sessionId)
        .eq('user_id', userId)
        .order('sector_index', { ascending: true });
      return { data: data ?? [], error: error?.message ?? null };
    },

    async findOwnedAnalysis(sessionId, userId, analysisVersion) {
      const { data, error } = await admin
        .from('onlylaps_session_analysis')
        .select(
          'id,session_id,user_id,summary_text,summary_json,driving_observations,corner_observations,sector_observations,consistency_observations,braking_observations,acceleration_observations,lateral_grip_observations,line_trajectory_observations,setup_relevant_observations,optimum_lap_time_ms,optimum_lap,analysis_version,model_used,created_at,updated_at',
        )
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('analysis_version', analysisVersion)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { data, error: error?.message ?? null };
    },
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

  const body = await req.json().catch(() => null);
  const onlyfastSessionId =
    body && typeof body === 'object' && !Array.isArray(body)
      ? String((body as Record<string, unknown>).onlyfast_session_id || '').trim()
      : '';

  try {
    const context = await getOnlyLapsSetupContext({
      onlyfastSessionId,
      userId: auth.user.id,
      store: createStore(auth.admin),
    });
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
