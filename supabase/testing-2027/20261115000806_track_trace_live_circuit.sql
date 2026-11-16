-- Phase 2D. Testing project mfzajhnfonrfuiwxgvhe only. No production deployment.
-- Reuse the canonical OnlyLaps tables and ALL installed RLS/lifecycle guards.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'TESTING_PROJECT_REQUIRED';
  end if;
end $$;

alter table public.onlylaps_telemetry_samples add column recorder_id uuid, add column sample_index integer check(sample_index>=0);
create unique index onlylaps_telemetry_recorder_sample on public.onlylaps_telemetry_samples(timing_session_id,recorder_id,sample_index) where recorder_id is not null;
alter table public.onlylaps_lap_times add column smoothing_summary jsonb;

create function public.begin_track_trace_recording(p_session_id uuid,p_recorder_id uuid,p_started_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.onlylaps_timing_sessions; m jsonb; sectors jsonb; snapshot jsonb;
begin
  perform onlyfast_private.require_track_trace();
  perform onlyfast_private.require_track_trace_write_2027();
  if p_recorder_id is null or p_started_at is null or p_started_at>now()+interval '5 minutes' then raise exception 'INVALID_RECORDING'; end if;
  select * into s from public.onlylaps_timing_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found or not onlyfast_private.track_trace_session(s.id) then raise exception 'SESSION_UNAVAILABLE'; end if;
  if s.device_info->'track_trace_recording'->>'recorder'=p_recorder_id::text then return s.device_info->'track_trace_recording'; end if;
  if s.started_at is not null or s.ended_at is not null or exists(select 1 from public.onlylaps_telemetry_samples where timing_session_id=s.id) then raise exception 'SESSION_ALREADY_STARTED'; end if;
  if s.track_map_id is not null then
    if not onlyfast_private.community_map_selectable(s.track_map_id) then raise exception 'CIRCUIT_UNAVAILABLE'; end if;
    select to_jsonb(t) into m from public.onlylaps_track_maps t where t.id=s.track_map_id;
    if jsonb_array_length(m->'start_finish_path')<2 then raise exception 'START_FINISH_REQUIRED'; end if;
    select jsonb_build_object('sectorCount',x.sector_count,'version',x.version,'source',x.kind,'lines',x.lines,'trackId',s.track_map_id)
    into sectors from (
      select u.sector_count,u.version,u.lines,'user_override' kind,0 priority from public.onlylaps_user_track_sectors u where u.track_id=s.track_map_id and u.user_id=auth.uid()
      union all select d.sector_count,d.version,d.lines,'track_default',1 from public.onlylaps_track_sector_defaults d where d.track_id=s.track_map_id
    ) x order by priority limit 1;
    snapshot:=jsonb_build_object('map',m,'sectors',sectors);
  end if;
  snapshot:=jsonb_build_object('recorder',p_recorder_id,'started',p_started_at,'status','recording','track',snapshot);
  update public.onlylaps_timing_sessions set started_at=p_started_at,device_info=coalesce(device_info,'{}')||jsonb_build_object('track_trace_recording',snapshot) where id=s.id;
  return snapshot;
end $$;

create function public.append_track_trace_samples(p_session_id uuid,p_recorder_id uuid,p_samples jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.onlylaps_timing_sessions; x jsonb; existing jsonb; idx integer; written integer:=0;
begin
  perform onlyfast_private.require_track_trace(); perform onlyfast_private.require_track_trace_write_2027();
  select * into s from public.onlylaps_timing_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found or not onlyfast_private.track_trace_session(s.id) or (s.device_info->'track_trace_recording'->>'recorder') is distinct from p_recorder_id::text then raise exception 'RECORDING_UNAVAILABLE'; end if;
  if jsonb_typeof(p_samples) is distinct from 'array' or jsonb_array_length(p_samples)>100 then raise exception 'INVALID_SAMPLE_BATCH'; end if;
  for x in select * from jsonb_array_elements(p_samples) loop
    idx:=(x->>'sampleIndex')::integer;
    if idx is null or idx<0 or idx>10000000 or not onlyfast_private.community_point_valid(jsonb_build_object('lat',x->'latitude','lng',x->'longitude'))
      or (x->>'timestamp') is null or (x->>'timestamp')::timestamptz<s.started_at-interval '10 seconds'
      or (x->>'timestamp')::timestamptz>now()+interval '5 minutes' then raise exception 'INVALID_GPS_SAMPLE'; end if;
    select raw->'sample' into existing from public.onlylaps_telemetry_samples where timing_session_id=s.id and recorder_id=p_recorder_id and sample_index=idx;
    if found then
      if existing is distinct from x then raise exception 'SAMPLE_RETRY_CONFLICT'; end if;
      continue;
    end if;
    if s.ended_at is not null then raise exception 'RECORDING_COMPLETED'; end if;
    insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorder_id,sample_index,recorded_at,elapsed_ms,latitude,longitude,
      altitude_meters,accuracy_meters,speed_mps,heading_degrees,g_force_lateral,g_force_longitudinal,raw)
    values(auth.uid(),s.id,p_recorder_id,idx,(x->>'timestamp')::timestamptz,greatest(0,(extract(epoch from ((x->>'timestamp')::timestamptz-s.started_at))*1000)::integer),
      (x->>'latitude')::double precision,(x->>'longitude')::double precision,(x->>'altitude')::double precision,(x->>'gpsAccuracy')::double precision,
      (x->>'speed')::double precision,(x->>'heading')::double precision,(x->>'lateralG')::double precision,(x->>'longitudinalG')::double precision,
      jsonb_build_object('source','gps_lap_session','gForceConvention','vehicle_braking_positive_v2','sampleIndex',idx,'lapNumber',x->'lapNumber','sample',x));
    written:=written+1;
  end loop;
  return jsonb_build_object('written',written);
end $$;

create function public.complete_track_trace_recording(p_session_id uuid,p_recorder_id uuid,p_ended_at timestamptz,p_sample_count integer,p_laps jsonb,p_interruptions jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.onlylaps_timing_sessions; x jsonb; sector jsonb; lap_id uuid; n integer; last_index integer; previous_end timestamptz; lap_no integer:=0; receipt jsonb;
begin
  perform onlyfast_private.require_track_trace(); perform onlyfast_private.require_track_trace_write_2027();
  select * into s from public.onlylaps_timing_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found or not onlyfast_private.track_trace_session(s.id) or (s.device_info->'track_trace_recording'->>'recorder') is distinct from p_recorder_id::text then raise exception 'RECORDING_UNAVAILABLE'; end if;
  select count(*),max(sample_index) into n,last_index from public.onlylaps_telemetry_samples where timing_session_id=s.id and recorder_id=p_recorder_id;
  if p_sample_count is null or n<>p_sample_count or (n>0 and last_index<>n-1) then raise exception 'SAMPLES_NOT_FULLY_SAVED'; end if;
  receipt:=jsonb_build_object('ended',p_ended_at,'samples',p_sample_count,'laps',p_laps,'interruptions',p_interruptions);
  if s.ended_at is not null then
    if s.device_info->'track_trace_completion' is distinct from receipt then raise exception 'COMPLETION_RETRY_CONFLICT'; end if;
    return jsonb_build_object('id',s.id,'saved',true,'samples',n);
  end if;
  if p_ended_at is null or p_ended_at<s.started_at or p_ended_at>now()+interval '5 minutes' or jsonb_typeof(p_laps) is distinct from 'array' or jsonb_array_length(p_laps)>10000
    or (s.track_map_id is null and jsonb_array_length(p_laps)>0) then raise exception 'INVALID_CIRCUIT_COMPLETION'; end if;
  previous_end:=s.started_at;
  for x in select * from jsonb_array_elements(p_laps) loop
    lap_no:=lap_no+1;
    if (x->>'lapNumber')::integer is distinct from lap_no or (x->>'startedAt')::timestamptz<previous_end or (x->>'endedAt')::timestamptz>p_ended_at
      or coalesce((x->>'lapTimeMs')::integer,0)<5000 or abs(extract(epoch from ((x->>'endedAt')::timestamptz-(x->>'startedAt')::timestamptz))*1000-(x->>'lapTimeMs')::integer)>1 then raise exception 'INVALID_LAP'; end if;
    insert into public.onlylaps_lap_times(user_id,timing_session_id,track_map_id,lap_number,started_at,ended_at,duration_ms,is_valid,excluded_reason,
      average_speed,max_speed,max_lateral_g,max_longitudinal_g,max_vertical_g,max_accel_g,max_braking_g,smoothing_summary,sector_times_ms)
    values(auth.uid(),s.id,s.track_map_id,lap_no,(x->>'startedAt')::timestamptz,(x->>'endedAt')::timestamptz,(x->>'lapTimeMs')::integer,
      coalesce((x->>'isValid')::boolean,false),x->>'excludedReason',(x->>'averageSpeed')::double precision,(x->>'maxSpeed')::double precision,
      (x->>'maxLateralG')::double precision,(x->>'maxLongitudinalG')::double precision,(x->>'maxVerticalG')::double precision,(x->>'maxAccelG')::double precision,(x->>'maxBrakingG')::double precision,x->'smoothingSummary',
      (select jsonb_agg(y->'durationMs') from jsonb_array_elements(coalesce(x->'sectors','[]')) y)) returning id into lap_id;
    for sector in select * from jsonb_array_elements(coalesce(x->'sectors','[]')) loop
      insert into public.onlylaps_lap_sector_times(user_id,timing_session_id,track_id,lap_id,sector_index,duration_ms,crossing_timestamp,is_valid,source_definition_version,source_kind)
      values(auth.uid(),s.id,s.track_map_id,lap_id,(sector->>'sectorIndex')::integer,(sector->>'durationMs')::integer,(sector->>'crossingTimestamp')::timestamptz,
        coalesce((sector->>'isValid')::boolean,false) and coalesce((x->>'isValid')::boolean,false),(sector->>'sourceDefinitionVersion')::integer,coalesce(s.device_info->'track_trace_recording'->'track'->'sectors'->>'source','track_default'));
    end loop;
    previous_end:=(x->>'endedAt')::timestamptz;
  end loop;
  update public.onlylaps_lap_times set is_best=true where id=(select id from public.onlylaps_lap_times where timing_session_id=s.id and is_valid order by duration_ms,lap_number limit 1);
  update public.onlylaps_timing_sessions set ended_at=p_ended_at,device_info=jsonb_set(device_info,'{track_trace_recording,status}','"completed"')||jsonb_build_object('track_trace_completion',receipt) where id=s.id;
  return jsonb_build_object('id',s.id,'saved',true,'samples',n);
end $$;

create function public.get_track_trace_samples(p_session_id uuid,p_after integer default -1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not onlyfast_private.track_trace_session(p_session_id) then raise exception 'SESSION_UNAVAILABLE'; end if;
  return coalesce((select jsonb_agg(x.data order by x.sample_index) from (select sample_index,raw->'sample' data from public.onlylaps_telemetry_samples
    where timing_session_id=p_session_id and user_id=auth.uid() and recorder_id is not null and sample_index>p_after order by sample_index limit 500) x),'[]');
end $$;

create function public.save_track_trace_scan(p_scan_id uuid,p_scan jsonb,p_sectors jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare errors jsonb; m public.onlylaps_track_maps; corners jsonb; item jsonb;
begin
  perform onlyfast_private.require_track_trace(); perform onlyfast_private.require_track_trace_write_2027();
  if p_scan_id is null or length(coalesce(p_scan->>'track_name','')) not between 1 and 80 or length(coalesce(p_scan->>'community_location','')) not between 1 and 160 then raise exception 'NAME_AND_LOCATION_REQUIRED'; end if;
  -- Idempotent retry after a lost response never inserts a second map or replaces geometry.
  select * into m from public.onlylaps_track_maps where id=p_scan_id and user_id=auth.uid();
  if found then return jsonb_build_object('id',m.id,'version',m.version,'saved',true); end if;
  errors:=onlyfast_private.community_scan_errors(p_scan,jsonb_build_array(p_sectors));
  if jsonb_array_length(errors)>0 then return jsonb_build_object('saved',false,'errors',errors); end if;
  corners:=p_scan->'corner_definitions';
  if jsonb_typeof(corners->'corners') is distinct from 'array' or jsonb_array_length(corners->'corners')>40 then raise exception 'CORNER_DEFINITIONS_REQUIRED'; end if;
  for item in select * from jsonb_array_elements(corners->'corners') loop
    if not onlyfast_private.community_point_valid(item->'apex') or not ((item->>'startProgress')::numeric>=0 and (item->>'endProgress')::numeric<=1
      and (item->>'startProgress')::numeric<(item->>'apexProgress')::numeric and (item->>'apexProgress')::numeric<(item->>'endProgress')::numeric)
      then raise exception 'INVALID_CORNER'; end if;
  end loop;
  insert into public.onlylaps_track_maps(id,user_id,created_by,name,track_name,source,map_source,scan_status,publication_status,is_open_route,
    track_type,track_shape,center_lat,center_lng,center_latitude,center_longitude,bbox,area_key,facility_key,facility_name,description,
    outside_path,inside_path,start_finish_path,gps_summary,corner_definitions,corner_detection_version,direction,track_length_meters)
  values(p_scan_id,auth.uid(),auth.uid(),p_scan->>'track_name',p_scan->>'track_name','track_scan','track_scan','scanned','private',false,
    p_scan->>'track_type',p_scan->>'track_shape',(p_scan->>'center_lat')::float8,(p_scan->>'center_lng')::float8,(p_scan->>'center_lat')::float8,(p_scan->>'center_lng')::float8,
    p_scan->'bbox',p_scan->>'area_key',p_scan->>'facility_key',p_scan->>'track_name',p_scan->>'community_location',p_scan->'outside_path',p_scan->'inside_path',p_scan->'start_finish_path',p_scan->'gps_summary',corners,'manual_track_editor_v1',p_scan->>'direction',(p_scan->>'track_length_meters')::numeric);
  insert into public.onlylaps_track_sector_defaults(track_id,owner_id,sector_count,version,lines) values(p_scan_id,auth.uid(),(p_sectors->>'sector_count')::integer,1,p_sectors->'lines');
  return jsonb_build_object('id',p_scan_id,'saved',true);
end $$;

revoke all on function public.begin_track_trace_recording(uuid,uuid,timestamptz),public.append_track_trace_samples(uuid,uuid,jsonb),public.complete_track_trace_recording(uuid,uuid,timestamptz,integer,jsonb,jsonb),public.get_track_trace_samples(uuid,integer),public.save_track_trace_scan(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.begin_track_trace_recording(uuid,uuid,timestamptz),public.append_track_trace_samples(uuid,uuid,jsonb),public.complete_track_trace_recording(uuid,uuid,timestamptz,integer,jsonb,jsonb),public.get_track_trace_samples(uuid,integer),public.save_track_trace_scan(uuid,jsonb,jsonb) to authenticated;
commit;
