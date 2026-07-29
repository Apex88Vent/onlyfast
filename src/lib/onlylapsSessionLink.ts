import { supabase } from '@/lib/supabase';

export interface OnlyLapsSessionCandidate {
  onlylaps_session_id: string;
  custom_name: string | null;
  fallback_name: string;
  display_name: string;
  track_name: string | null;
  session_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  lap_count: number;
  valid_lap_count: number;
  fastest_valid_lap_ms: number | null;
  linked_onlyfast_session_id: string | null;
  linked_to_current_session: boolean;
  linked_elsewhere: boolean;
  rank_score: number;
  match_reasons: string[];
}

export interface OnlyLapsSessionPickerResult {
  onlyfast_session_id: string;
  current_link: {
    onlylaps_session_id: string;
  } | null;
  current_session: OnlyLapsSessionCandidate | null;
  candidates: OnlyLapsSessionCandidate[];
  suggested_candidate_id: string | null;
  ambiguous: boolean;
  scope: 'suggested' | 'all';
  offset: number;
  has_more: boolean;
}

async function invokeLinkFunction<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Please sign in again.');

  const { data, error } = await supabase.functions.invoke(
    'manage-onlylaps-session-link',
    {
      body,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (error) {
    throw new Error(error.message || 'OnlyLaps session linking is unavailable.');
  }
  return data as T;
}

export function loadOnlyLapsSessionCandidates(
  onlyfastSessionId: string,
  scope: 'suggested' | 'all' = 'suggested',
  offset = 0,
): Promise<OnlyLapsSessionPickerResult> {
  return invokeLinkFunction<OnlyLapsSessionPickerResult>({
    action: 'list',
    onlyfast_session_id: onlyfastSessionId,
    scope,
    offset,
  });
}

export function linkOnlyLapsSession(
  onlyfastSessionId: string,
  candidate: OnlyLapsSessionCandidate,
  source: 'picker' | 'suggestion',
): Promise<{ action: 'linked' | 'changed' | 'unchanged' }> {
  return invokeLinkFunction({
    action: 'link',
    onlyfast_session_id: onlyfastSessionId,
    onlylaps_session_id: candidate.onlylaps_session_id,
    selection_source: source,
    match_confidence:
      source === 'suggestion'
        ? Math.min(Math.max(candidate.rank_score / 110, 0), 1)
        : null,
  });
}

export function unlinkOnlyLapsSession(
  onlyfastSessionId: string,
): Promise<{ unlinked: boolean }> {
  return invokeLinkFunction({
    action: 'unlink',
    onlyfast_session_id: onlyfastSessionId,
  });
}
