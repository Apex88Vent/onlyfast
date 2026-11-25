-- Initial review payload only. All existing recording/full-review contracts remain unchanged.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'TESTING_PROJECT_REQUIRED';
  end if;
end $$;
create function public.get_track_trace_review_summary(p_session_id uuid default null,p_setup_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare context jsonb; linked jsonb; session jsonb; device jsonb;
begin
  if (p_session_id is null)=(p_setup_id is null) then raise exception 'ONE_REVIEW_SCOPE_REQUIRED'; end if;
  if p_setup_id is not null then
    -- Reuse exact setup ownership/class/archive and linked-session authorization.
    linked:=public.get_track_trace_setup_context(p_setup_id);
    if linked->>'linked' is distinct from 'true' then return null; end if;
    context:=linked->'context';
  else
    context:=public.get_track_trace_session(p_session_id);
  end if;
  session:=(context->'session')-'corner_analysis'-'corner_definitions'-'automatic_start_finish_data'-'manual_start_finish_data'-'recording_diagnostics';
  device:=coalesce(session->'device_info','{}'::jsonb);
  -- Never transmit track snapshots, sample journals or derived analysis on initial review.
  session:=session||jsonb_build_object('device_info',jsonb_build_object(
    'sessionStatus',device->'sessionStatus','gpsErrorMessage',device->'gpsErrorMessage',
    'gForceConvention',device->'gForceConvention','phoneMountOrientation',device->'phoneMountOrientation'));
  return context||jsonb_build_object('session',session,
    'laps',coalesce((select jsonb_agg(l.value-'raw_trace'-'smoothed_trace'-'smoothing_summary'-'corner_analysis' order by (l.value->>'lap_number')::integer)
      from jsonb_array_elements(coalesce(context->'laps','[]'::jsonb)) l),'[]'::jsonb),
    'analysis',coalesce((select jsonb_agg(jsonb_build_object('id',a.value->'id','summary_text',a.value->'summary_text','optimum_lap_time_ms',a.value->'optimum_lap_time_ms'))
      from jsonb_array_elements(coalesce(context->'analysis','[]'::jsonb)) a),'[]'::jsonb));
end $$;
revoke all on function public.get_track_trace_review_summary(uuid,uuid) from public,anon;
grant execute on function public.get_track_trace_review_summary(uuid,uuid) to authenticated;
commit;
