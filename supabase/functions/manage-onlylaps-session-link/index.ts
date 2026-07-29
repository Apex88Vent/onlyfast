import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { hasBetaFeatureForUser } from '../_shared/beta-features.ts';
import {
  linkOnlyLapsSession,
  listOnlyLapsSessionCandidates,
  ONLYLAPS_SESSION_LINK_BETA_FEATURE,
  OnlyLapsSessionLinkError,
  type OnlyLapsSessionLinkStore,
  unlinkOnlyLapsSession,
} from '../_shared/onlylaps-session-linking.ts';

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

async function requireBetaUser(req: Request): Promise<ServerAuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      response: json({ error: 'Server configuration is missing.' }, 500),
    };
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const allowed = await hasBetaFeatureForUser(
    admin,
    data.user.id,
    ONLYLAPS_SESSION_LINK_BETA_FEATURE,
    'experimental',
  );
  if (!allowed) {
    return { response: json({ error: 'This feature is unavailable.' }, 403) };
  }

  return { user: data.user, admin };
}

function errorText(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  return `${error.code || 'unknown'}:${error.message || 'Database request failed.'}`;
}

function createStore(admin: SupabaseClient): OnlyLapsSessionLinkStore {
  const onlylapsSessionColumns =
    'id,user_id,track_map_id,name,session_name,session_type,started_at,ended_at';
  const linkColumns =
    'id,user_id,onlyfast_session_id,onlylaps_session_id,link_method,match_confidence,created_at,updated_at';

  return {
    async findOwnedOnlyFastSession(sessionId, userId) {
      const { data, error } = await admin
        .from('race_setups')
        .select('id,user_id,track_name,race_date,session_label,setup_type')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: errorText(error) };
    },

    async listOwnedLinksForOnlyFast(onlyfastSessionId, userId) {
      const { data, error } = await admin
        .from('onlyfast_onlylaps_session_links')
        .select(linkColumns)
        .eq('onlyfast_session_id', onlyfastSessionId)
        .eq('user_id', userId)
        .limit(2);
      return { data: data ?? [], error: errorText(error) };
    },

    async findOwnedOnlyLapsSession(sessionId, userId) {
      const { data, error } = await admin
        .from('onlylaps_timing_sessions')
        .select(onlylapsSessionColumns)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: errorText(error) };
    },

    async listOwnedOnlyLapsSessions(userId, queryOptions) {
      let query = admin
        .from('onlylaps_timing_sessions')
        .select(onlylapsSessionColumns)
        .eq('user_id', userId)
        .order('started_at', { ascending: false, nullsFirst: false });
      if (queryOptions.startedAfter) {
        query = query.gte('started_at', queryOptions.startedAfter);
      }
      if (queryOptions.startedBefore) {
        query = query.lt('started_at', queryOptions.startedBefore);
      }
      const { data, error } = await query.range(
        queryOptions.offset,
        queryOptions.offset + queryOptions.limit,
      );
      const rows = data ?? [];
      return {
        data: {
          rows: rows.slice(0, queryOptions.limit),
          hasMore: rows.length > queryOptions.limit,
        },
        error: errorText(error),
      };
    },

    async listOwnedLapSummaries(sessionIds, userId) {
      if (sessionIds.length === 0) return { data: [], error: null };
      const { data, error } = await admin.rpc(
        'onlyfast_onlylaps_candidate_lap_summaries',
        {
          p_user_id: userId,
          p_session_ids: sessionIds,
        },
      );
      return { data: data ?? [], error: errorText(error) };
    },

    async listOwnedLinksForOnlyLaps(sessionIds, userId) {
      if (sessionIds.length === 0) return { data: [], error: null };
      const { data, error } = await admin
        .from('onlyfast_onlylaps_session_links')
        .select(linkColumns)
        .eq('user_id', userId)
        .in('onlylaps_session_id', sessionIds);
      return { data: data ?? [], error: errorText(error) };
    },

    async setOwnedLink(
      userId,
      onlyfastSessionId,
      onlylapsSessionId,
      linkMethod,
      matchConfidence,
    ) {
      const { data, error } = await admin.rpc(
        'onlyfast_set_onlylaps_session_link',
        {
          p_user_id: userId,
          p_onlyfast_session_id: onlyfastSessionId,
          p_onlylaps_session_id: onlylapsSessionId,
          p_link_method: linkMethod,
          p_match_confidence: matchConfidence,
        },
      );
      const row = Array.isArray(data) ? data[0] ?? null : data;
      return { data: row, error: errorText(error) };
    },

    async unlinkOwnedSession(userId, onlyfastSessionId) {
      const { data, error } = await admin.rpc(
        'onlyfast_unlink_onlylaps_session',
        {
          p_user_id: userId,
          p_onlyfast_session_id: onlyfastSessionId,
        },
      );
      return { data: data === true, error: errorText(error) };
    },
  };
}

function mapLinkError(error: OnlyLapsSessionLinkError): Response {
  if (error.code === 'invalid_session_id') {
    return json({ error: error.message, code: error.code }, 400);
  }
  if (
    error.code === 'onlyfast_session_not_found' ||
    error.code === 'onlylaps_session_not_found' ||
    error.code === 'ownership_mismatch'
  ) {
    return json({ error: 'Session not found.', code: 'session_not_found' }, 404);
  }
  if (
    error.code === 'integrity_error' ||
    error.code === 'already_linked_elsewhere'
  ) {
    return json({ error: error.message, code: error.code }, 409);
  }
  return json({ error: 'OnlyLaps session linking is unavailable.' }, 503);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const auth = await requireBetaUser(req);
  if ('response' in auth) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'A JSON request body is required.' }, 400);
  }
  const input = body as Record<string, unknown>;
  const action = String(input.action || '').trim();
  const onlyfastSessionId = String(
    input.onlyfast_session_id || '',
  ).trim();
  const store = createStore(auth.admin);

  try {
    if (action === 'list') {
      const scope = input.scope === 'all' ? 'all' : 'suggested';
      const offsetValue = Number(input.offset);
      return json(
        await listOnlyLapsSessionCandidates({
          onlyfastSessionId,
          userId: auth.user.id,
          store,
          scope,
          offset: Number.isInteger(offsetValue) ? offsetValue : 0,
        }),
      );
    }

    if (action === 'link') {
      const onlylapsSessionId = String(
        input.onlylaps_session_id || '',
      ).trim();
      const selectionSource =
        input.selection_source === 'suggestion' ? 'suggestion' : 'picker';
      const confidenceValue = Number(input.match_confidence);
      return json(
        await linkOnlyLapsSession({
          onlyfastSessionId,
          onlylapsSessionId,
          userId: auth.user.id,
          store,
          selectionSource,
          matchConfidence: Number.isFinite(confidenceValue)
            ? confidenceValue
            : null,
        }),
      );
    }

    if (action === 'unlink') {
      return json(
        await unlinkOnlyLapsSession({
          onlyfastSessionId,
          userId: auth.user.id,
          store,
        }),
      );
    }

    return json({ error: 'Unknown session-link action.' }, 400);
  } catch (error) {
    if (error instanceof OnlyLapsSessionLinkError) {
      return mapLinkError(error);
    }
    console.error('manage-onlylaps-session-link failed', error);
    return json({ error: 'OnlyLaps session linking is unavailable.' }, 503);
  }
});
