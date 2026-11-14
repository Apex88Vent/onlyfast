import { supabase, supabaseUrl } from '@/lib/supabase';

export const TRACK_TRACE_FEATURE = 'track_trace';
export const TRACK_TRACE_NAME = 'OnlyFast Track Trace';
export const trackTraceEnabled = import.meta.env.ONLYFAST_2027_PREVIEW === true &&
  import.meta.env.ONLYFAST_2027_APP === true && supabaseUrl === 'https://mfzajhnfonrfuiwxgvhe.supabase.co';

export interface TrackTracePermission {
  feature: 'track_trace'; allowed: boolean; tier: string;
  can_read_history?: boolean; can_record?: boolean; can_modify?: boolean;
  can_read_archived?: boolean; read_only?: boolean;
  session_limit: null; capabilities: string[];
}
export interface TraceSession {
  id: string; name: string; session_name: string | null; started_at: string | null;
  ended_at: string | null; track_map_id: string | null; session_type: string;
}
export interface TraceLap { id: string; lap_number: number; duration_ms: number; is_valid: boolean; }
export interface TraceContext {
  session: TraceSession; laps: TraceLap[];
  sectors: { lap_id: string; sector_index: number; duration_ms: number }[];
  analysis: { id: string; summary_text: string | null; optimum_lap_time_ms: number | null }[];
}

export interface TraceLinkCandidate {
  id: string; name: string; started_at: string | null; created_at: string;
  track_name: string | null; lap_count: number; fastest_lap_ms: number | null; linked_elsewhere?: boolean;
}
export interface TraceLinkPicker {
  setup_id: string; current_session_id: string | null; current_session: TraceLinkCandidate | null;
  missing_session: boolean; editable: boolean; candidates: TraceLinkCandidate[]; offset: number;
}
export interface TraceTrack {
  id: string; name: string; track_name: string; track_shape: string | null; track_length: string | null;
  track_length_meters: number | null; version: number; can_select: boolean;
  start_finish_path: unknown; outside_path: unknown;
  automatic_start_finish_data: unknown; manual_start_finish_data: unknown;
  sector_defaults: { version: number; sector_count: number; lines: unknown }[];
  user_sectors: { version: number; sector_count: number; lines: unknown }[];
}

export async function getTraceAssistStatus(setupId: string) {
  if (!trackTraceEnabled) throw new Error('OnlyFast Track Trace is unavailable.');
  const { data, error } = await supabase.functions.invoke('track-trace-setup-context', {
    body: { onlyfast_session_id: setupId, status_only: true },
  });
  if (error) throw new Error('Telemetry access could not be verified.');
  return data as { linked: boolean; usable_measured_facts: boolean };
}

// Every operation is authenticated by Supabase and authorized again in SQL/RLS.
export async function traceRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!trackTraceEnabled) throw new Error('OnlyFast Track Trace is unavailable.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error('Could not verify access or load this session. Refresh and try again.');
  return data as T;
}
