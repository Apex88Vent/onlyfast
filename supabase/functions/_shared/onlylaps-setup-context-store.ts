import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { OnlyLapsSetupContextStore } from './onlylaps-setup-context.ts';

function errorText(error: { message?: string } | null): string | null {
  return error?.message ?? null;
}

export function createOnlyLapsSetupContextStore(
  admin: SupabaseClient,
): OnlyLapsSetupContextStore {
  return {
    async findOwnedOnlyFastSession(sessionId, userId) {
      const { data, error } = await admin
        .from('race_setups')
        .select('id,user_id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: errorText(error) };
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
      return { data: data ?? [], error: errorText(error) };
    },

    async findOwnedOnlyLapsSession(sessionId, userId) {
      const { data, error } = await admin
        .from('onlylaps_timing_sessions')
        .select(
          'id,user_id,track_map_id,name,session_name,vehicle_name,session_type,started_at,ended_at,weather,device_info',
        )
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error: errorText(error) };
    },

    async findTrackMap(trackMapId) {
      const { data, error } = await admin
        .from('onlylaps_track_maps')
        .select(
          'id,user_id,created_by,is_active,name,track_name,track_type,track_shape,track_length',
        )
        .eq('id', trackMapId)
        .maybeSingle();
      return { data, error: errorText(error) };
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
      return { data: data ?? [], error: errorText(error) };
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
      return { data: data ?? [], error: errorText(error) };
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
      return { data, error: errorText(error) };
    },
  };
}
