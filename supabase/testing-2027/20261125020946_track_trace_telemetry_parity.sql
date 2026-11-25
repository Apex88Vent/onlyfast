-- Read-only telemetry parity contracts. Isolated 2027 testing project only.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then raise exception 'TESTING_PROJECT_REQUIRED'; end if;
end $$;
create function public.get_track_trace_review_bundle(p_session_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare context jsonb; m jsonb; layout jsonb;
begin
  -- Reuse history/ownership/circuit authorization, including archive restrictions.
  context:=public.get_track_trace_session(p_session_id);
  select to_jsonb(t) into m from public.onlylaps_track_maps t where t.id=(context->'session'->>'track_map_id')::uuid;
  select jsonb_build_object('sectorCount',s.sector_count,'version',s.version,'source',s.kind,'lines',s.lines) into layout from (
    select u.sector_count,u.version,u.lines,'user_override' kind,0 priority from public.onlylaps_user_track_sectors u where u.track_id=(context->'session'->>'track_map_id')::uuid and u.user_id=auth.uid()
    union all select d.sector_count,d.version,d.lines,'track_default',1 from public.onlylaps_track_sector_defaults d where d.track_id=(context->'session'->>'track_map_id')::uuid
  ) s order by priority limit 1;
  return context||jsonb_build_object('map',m,'layout',layout,'sample_count',(select count(*) from public.onlylaps_telemetry_samples where timing_session_id=p_session_id and user_id=auth.uid()));
end $$;
create function public.get_track_trace_telemetry_page(p_session_id uuid,p_after_time timestamptz default null,p_after_id bigint default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not onlyfast_private.track_trace_session(p_session_id) then raise exception 'SESSION_UNAVAILABLE' using errcode='42501'; end if;
  if (p_after_time is null)<>(p_after_id is null) then raise exception 'INVALID_TELEMETRY_CURSOR'; end if;
  -- Legacy rows have no recorder_id/sample_index or nested raw.sample. Include
  -- them unchanged. Tie-break by immutable database ID, not client sampleIndex.
  return coalesce((select jsonb_agg(r.data order by r.recorded_at,r.id) from (
    select t.id,t.recorded_at,to_jsonb(t)||jsonb_build_object('id',t.id::text) data from public.onlylaps_telemetry_samples t
    where t.timing_session_id=p_session_id and t.user_id=auth.uid()
      and (p_after_time is null or (t.recorded_at,t.id)>(p_after_time,p_after_id))
    order by t.recorded_at,t.id limit 500
  ) r),'[]');
end $$;
revoke all on function public.get_track_trace_review_bundle(uuid),public.get_track_trace_telemetry_page(uuid,timestamptz,bigint) from public,anon;
grant execute on function public.get_track_trace_review_bundle(uuid),public.get_track_trace_telemetry_page(uuid,timestamptz,bigint) to authenticated;
create function public.rename_track_trace_session(p_session_id uuid,p_name text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform onlyfast_private.require_track_trace(); perform onlyfast_private.require_track_trace_write_2027();
  if not onlyfast_private.track_trace_session(p_session_id) then raise exception 'SESSION_UNAVAILABLE'; end if;
  if length(btrim(p_name))>80 or p_name is null or p_name~'[<>\n\r]' then raise exception 'INVALID_SESSION_NAME'; end if;
  update public.onlylaps_timing_sessions set session_name=nullif(btrim(p_name),'') where id=p_session_id and user_id=auth.uid();
end $$;
revoke all on function public.rename_track_trace_session(uuid,text) from public,anon;
grant execute on function public.rename_track_trace_session(uuid,text) to authenticated;
create function public.list_track_trace_session_cards(p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  return coalesce((select jsonb_agg(j||jsonb_build_object(
    'lap_count',(select count(*) from public.onlylaps_lap_times l where l.timing_session_id=(j->>'id')::uuid),
    'valid_lap_count',(select count(*) from public.onlylaps_lap_times l where l.timing_session_id=(j->>'id')::uuid and l.is_valid),
    'fastest_lap_ms',(select min(duration_ms) from public.onlylaps_lap_times l where l.timing_session_id=(j->>'id')::uuid and l.is_valid),
    'average_lap_ms',(select avg(duration_ms)::integer from public.onlylaps_lap_times l where l.timing_session_id=(j->>'id')::uuid and l.is_valid),
    'sample_count',(select count(*) from public.onlylaps_telemetry_samples t where t.timing_session_id=(j->>'id')::uuid),
    'track_name',(select m.track_name from public.onlylaps_track_maps m where m.id=(j->>'track_map_id')::uuid)))
    from jsonb_array_elements(public.list_track_trace_sessions(null,p_offset)) j),'[]');
end $$;
revoke all on function public.list_track_trace_session_cards(integer) from public,anon;
grant execute on function public.list_track_trace_session_cards(integer) to authenticated;
commit;
