-- Source circuit editors: testing only; preserve published map immutability and
-- historical telemetry. Version compare-and-swap prevents lost owner edits.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then raise exception 'TESTING_PROJECT_REQUIRED'; end if;
end $$;
create function public.get_track_trace_edit_map(p_track_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m jsonb;
begin
  perform onlyfast_private.require_track_trace();
  if not onlyfast_private.community_map_selectable(p_track_id) then raise exception 'CIRCUIT_UNAVAILABLE'; end if;
  select to_jsonb(t)||jsonb_build_object('is_owner',t.user_id=auth.uid(),
    'sector_defaults',coalesce((select jsonb_agg(to_jsonb(d)) from public.onlylaps_track_sector_defaults d where d.track_id=t.id),'[]'),
    'user_sectors',coalesce((select jsonb_agg(to_jsonb(u)) from public.onlylaps_user_track_sectors u where u.track_id=t.id and u.user_id=auth.uid()),'[]')) into m
    from public.onlylaps_track_maps t where t.id=p_track_id;
  if m is null then raise exception 'CIRCUIT_UNAVAILABLE'; end if; return m;
end $$;
create function public.update_track_trace_private_map(p_track_id uuid,p_expected_version integer,p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.onlylaps_track_maps; merged jsonb; errors jsonb; x jsonb;
begin
  perform onlyfast_private.require_track_trace();perform onlyfast_private.require_track_trace_write_2027();
  select * into m from public.onlylaps_track_maps where id=p_track_id and user_id=auth.uid() for update;
  if not found or m.publication_status<>'private' then raise exception 'PRIVATE_TRACK_OWNER_REQUIRED'; end if;
  if m.version is distinct from p_expected_version then raise exception 'TRACK_VERSION_CHANGED'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' or pg_column_size(p_changes)>2000000 or exists(select 1 from jsonb_object_keys(p_changes) k where k not in
    ('corner_definitions','corner_detection_version')) then raise exception 'INVALID_PRIVATE_TRACK_PATCH'; end if;
  merged:=to_jsonb(m)||p_changes;
  errors:=onlyfast_private.community_scan_errors(merged,coalesce((select jsonb_agg(to_jsonb(d)) from public.onlylaps_track_sector_defaults d where d.track_id=m.id),'[]'));
  if jsonb_array_length(errors)>0 then raise exception 'INVALID_CIRCUIT_GEOMETRY: %',errors; end if;
  if p_changes ? 'corner_definitions' and p_changes->'corner_definitions'<>'null'::jsonb then
    if jsonb_typeof(p_changes->'corner_definitions'->'corners') is distinct from 'array' or jsonb_array_length(p_changes->'corner_definitions'->'corners')>40 then raise exception 'INVALID_CORNER_DEFINITIONS'; end if;
    for x in select * from jsonb_array_elements(p_changes->'corner_definitions'->'corners') loop
      if not onlyfast_private.community_point_valid(x->'apex') or ((x->>'startProgress')::numeric>=0 and (x->>'endProgress')::numeric<=1 and (x->>'startProgress')::numeric<(x->>'apexProgress')::numeric and (x->>'apexProgress')::numeric<(x->>'endProgress')::numeric) is not true then raise exception 'INVALID_CORNER_DEFINITION'; end if;
    end loop;
  end if;
  update public.onlylaps_track_maps set
    corner_definitions=case when p_changes?'corner_definitions' then p_changes->'corner_definitions' else corner_definitions end,
    corner_detection_version=case when p_changes?'corner_detection_version' then p_changes->>'corner_detection_version' else corner_detection_version end
    where id=m.id;
  return public.get_track_trace_edit_map(m.id);
end $$;
create function public.save_track_trace_sector_layout(p_track_id uuid,p_expected_version integer,p_sector_count integer,p_lines jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.onlylaps_track_maps; canonical boolean; current_version integer; errors jsonb; line jsonb; last_progress numeric:=0;
begin
  perform onlyfast_private.require_track_trace();perform onlyfast_private.require_track_trace_write_2027();
  if not onlyfast_private.community_map_selectable(p_track_id) then raise exception 'CIRCUIT_UNAVAILABLE'; end if;
  select * into m from public.onlylaps_track_maps where id=p_track_id;
  if m.user_id=auth.uid() and m.publication_status='private' then select * into m from public.onlylaps_track_maps where id=p_track_id for update; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_track_id::text||auth.uid()::text,0));
  canonical:=m.user_id=auth.uid() and m.publication_status='private';
  -- Published maps always use a personal override, including their owner.
  if canonical then select version into current_version from public.onlylaps_track_sector_defaults where track_id=m.id;
  else select version into current_version from public.onlylaps_user_track_sectors where track_id=m.id and user_id=auth.uid(); end if;
  if coalesce(current_version,0) is distinct from p_expected_version then raise exception 'SECTOR_VERSION_CHANGED'; end if;
  errors:=onlyfast_private.community_scan_errors(to_jsonb(m),jsonb_build_array(jsonb_build_object('sector_count',p_sector_count,'lines',p_lines)));
  if jsonb_array_length(errors)>0 then raise exception 'INVALID_SECTOR_LAYOUT: %',errors; end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(line->'progress') is distinct from 'number' or (line->>'progress')::numeric<=last_progress or (line->>'progress')::numeric>0.96 or ((line->>'progress')::numeric-last_progress)<0.04 then raise exception 'INVALID_SECTOR_ORDER'; end if;
    last_progress:=(line->>'progress')::numeric;
  end loop;
  if canonical then
    insert into public.onlylaps_track_sector_defaults(track_id,owner_id,sector_count,version,lines) values(m.id,auth.uid(),p_sector_count,coalesce(current_version,0)+1,p_lines)
      on conflict(track_id) do update set sector_count=excluded.sector_count,version=excluded.version,lines=excluded.lines;
  else
    insert into public.onlylaps_user_track_sectors(track_id,user_id,sector_count,version,lines) values(m.id,auth.uid(),p_sector_count,coalesce(current_version,0)+1,p_lines)
      on conflict(track_id,user_id) do update set sector_count=excluded.sector_count,version=excluded.version,lines=excluded.lines;
  end if;
  return public.get_track_trace_edit_map(m.id);
end $$;
revoke all on function public.get_track_trace_edit_map(uuid),public.update_track_trace_private_map(uuid,integer,jsonb),public.save_track_trace_sector_layout(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.get_track_trace_edit_map(uuid),public.update_track_trace_private_map(uuid,integer,jsonb),public.save_track_trace_sector_layout(uuid,integer,integer,jsonb) to authenticated;
commit;
