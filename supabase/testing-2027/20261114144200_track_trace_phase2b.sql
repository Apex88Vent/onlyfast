-- Forward-only OnlyFast Track Trace Phase 2B. Isolated testing database only.
-- Reuses the existing one-to-one link relation and service-only link functions.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end $$;

create function onlyfast_private.track_trace_setup_writable(p_setup_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r public.race_setups%rowtype; state jsonb;
begin
  if auth.uid() is null or not onlyfast_private.track_trace_enabled() then return false; end if;
  select * into r from public.race_setups where id=p_setup_id and user_id=auth.uid();
  if not found or r.race_weekend_id is null or r.setup_type='base_template' then return false; end if;
  if not public.onlyfast_can_save_setup_class(auth.uid(),r.race_class) then return false; end if;
  state:=public.get_onlyfast_2027_setup_edit_state(p_setup_id);
  -- Phase 1C supplies a clock; installed archive policies supply editability.
  return state is not null and (not (state ? 'editable') or coalesce((state->>'editable')::boolean,false));
end $$;
revoke all on function onlyfast_private.track_trace_setup_writable(uuid) from public,anon;
grant execute on function onlyfast_private.track_trace_setup_writable(uuid) to authenticated;

-- Harden direct table mutations too. Retain every existing owner/circuit policy.
create policy track_trace_link_setup_insert on public.onlyfast_onlylaps_session_links as restrictive for insert to authenticated
with check (onlyfast_private.track_trace_setup_writable(onlyfast_session_id));
create policy track_trace_link_setup_update on public.onlyfast_onlylaps_session_links as restrictive for update to authenticated
using (onlyfast_private.track_trace_setup_writable(onlyfast_session_id))
with check (onlyfast_private.track_trace_setup_writable(onlyfast_session_id));
create policy track_trace_link_setup_delete on public.onlyfast_onlylaps_session_links as restrictive for delete to authenticated
using (onlyfast_private.track_trace_setup_writable(onlyfast_session_id));

-- Return only an existing association owned by this caller. A hidden/deleted
-- timing parent can be represented safely without exposing its contents.
create function onlyfast_private.track_trace_current_link(p_setup_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
  perform onlyfast_private.require_track_trace();
  if not exists(select 1 from public.race_setups where id=p_setup_id and user_id=auth.uid()) then
    raise exception 'SESSION_NOT_FOUND' using errcode='42501';
  end if;
  select onlylaps_session_id into result from public.onlyfast_onlylaps_session_links
    where onlyfast_session_id=p_setup_id and user_id=auth.uid();
  return result;
end $$;
revoke all on function onlyfast_private.track_trace_current_link(uuid) from public,anon;
grant execute on function onlyfast_private.track_trace_current_link(uuid) to authenticated;

create function public.list_track_trace_link_candidates(p_setup_id uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare current_id uuid; current_session jsonb; candidates jsonb;
begin
  perform onlyfast_private.require_track_trace();
  if p_offset is null or p_offset<0 then raise exception 'INVALID_PAGE'; end if;
  current_id:=onlyfast_private.track_trace_current_link(p_setup_id);
  select jsonb_build_object('id',s.id,'name',coalesce(s.session_name,s.name),
    'started_at',s.started_at,'created_at',s.created_at,'track_name',coalesce(t.track_name,t.name),
    'lap_count',(select count(*) from public.onlylaps_lap_times l where l.timing_session_id=s.id and l.user_id=auth.uid()),
    'fastest_lap_ms',(select min(l.duration_ms) from public.onlylaps_lap_times l where l.timing_session_id=s.id and l.user_id=auth.uid() and l.is_valid))
    into current_session from public.onlylaps_timing_sessions s left join public.onlylaps_track_maps t on t.id=s.track_map_id
    where s.id=current_id and s.user_id=auth.uid() and onlyfast_private.track_trace_session(s.id);
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into candidates from (
    select s.id,coalesce(s.session_name,s.name) name,s.started_at,s.created_at,
      coalesce(t.track_name,t.name) track_name,
      (select count(*) from public.onlylaps_lap_times l where l.timing_session_id=s.id and l.user_id=auth.uid()) lap_count,
      (select min(l.duration_ms) from public.onlylaps_lap_times l where l.timing_session_id=s.id and l.user_id=auth.uid() and l.is_valid) fastest_lap_ms,
      exists(select 1 from public.onlyfast_onlylaps_session_links x where x.onlylaps_session_id=s.id and x.user_id=auth.uid() and x.onlyfast_session_id<>p_setup_id) linked_elsewhere
    from public.onlylaps_timing_sessions s left join public.onlylaps_track_maps t on t.id=s.track_map_id
    where s.user_id=auth.uid() and onlyfast_private.track_trace_session(s.id)
    order by s.created_at desc,s.id limit 25 offset p_offset
  ) c;
  return jsonb_build_object('setup_id',p_setup_id,'current_session_id',current_id,'current_session',current_session,
    'missing_session',current_id is not null and current_session is null,
    'editable',onlyfast_private.track_trace_setup_writable(p_setup_id),'candidates',candidates,'offset',p_offset);
end $$;

create function onlyfast_private.set_track_trace_link(p_setup_id uuid,p_session_id uuid,p_expected_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_id uuid; action text;
begin
  if uid is null then raise exception 'TRACK_TRACE_AUTH_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  -- Separate statements after waiting: recheck current membership and setup.
  perform onlyfast_private.require_track_trace();
  perform 1 from public.race_setups where id=p_setup_id and user_id=uid for update;
  if not found or not onlyfast_private.track_trace_setup_writable(p_setup_id) then
    raise exception 'SETUP_READ_ONLY_OR_NOT_FOUND' using errcode='42501';
  end if;
  current_id:=onlyfast_private.track_trace_current_link(p_setup_id);
  if current_id is distinct from p_expected_session_id then raise exception 'TRACK_TRACE_LINK_CHANGED' using errcode='40001'; end if;
  if p_session_id is null then
    perform public.onlyfast_unlink_onlylaps_session(uid,p_setup_id);
    return jsonb_build_object('action','unlinked');
  end if;
  if not onlyfast_private.track_trace_session(p_session_id) then raise exception 'TELEMETRY_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from public.onlyfast_onlylaps_session_links where onlylaps_session_id=p_session_id and onlyfast_session_id<>p_setup_id) then
    raise exception 'TELEMETRY_ALREADY_LINKED' using errcode='23505';
  end if;
  if current_id=p_session_id then return jsonb_build_object('action','unchanged'); end if;
  action:=case when current_id is null then 'linked' else 'changed' end;
  -- Original atomic service RPC and its composite owner FKs/unique indexes.
  perform public.onlyfast_set_onlylaps_session_link(uid,p_setup_id,p_session_id,'manual',null);
  return jsonb_build_object('action',action);
end $$;
revoke all on function onlyfast_private.set_track_trace_link(uuid,uuid,uuid) from public,anon;
grant execute on function onlyfast_private.set_track_trace_link(uuid,uuid,uuid) to authenticated;

create function public.set_track_trace_session_link(p_setup_id uuid,p_session_id uuid default null,p_expected_session_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select onlyfast_private.set_track_trace_link(p_setup_id,p_session_id,p_expected_session_id);
$$;

create function public.list_track_trace_tracks(p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  perform onlyfast_private.require_track_trace();
  if p_offset is null or p_offset<0 then raise exception 'INVALID_PAGE'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t)) from (
    select m.id,m.name,m.track_name,m.track_type,m.track_shape,m.track_length,m.track_length_meters,(m.user_id=auth.uid()) can_select,
      m.version,m.supersedes_track_map_id,m.start_finish_path,m.outside_path,m.corner_definitions,
      m.automatic_start_finish_data,m.manual_start_finish_data,
      coalesce((select jsonb_agg(jsonb_build_object('version',s.version,'sector_count',s.sector_count,'lines',s.lines))
        from public.onlylaps_track_sector_defaults s where s.track_id=m.id),'[]'::jsonb) sector_defaults,
      coalesce((select jsonb_agg(jsonb_build_object('version',s.version,'sector_count',s.sector_count,'lines',s.lines))
        from public.onlylaps_user_track_sectors s where s.track_id=m.id and s.user_id=auth.uid()),'[]'::jsonb) user_sectors
    from public.onlylaps_track_maps m where m.is_active and not m.is_open_route
      and coalesce(lower(m.track_type),'') not in ('gumball','public_road','open_route')
    order by m.track_name,m.id limit 50 offset p_offset
  ) t),'[]'::jsonb);
end $$;

revoke all on function public.list_track_trace_link_candidates(uuid,integer),public.set_track_trace_session_link(uuid,uuid,uuid),public.list_track_trace_tracks(integer) from public,anon;
grant execute on function public.list_track_trace_link_candidates(uuid,integer),public.set_track_trace_session_link(uuid,uuid,uuid),public.list_track_trace_tracks(integer) to authenticated;
notify pgrst,'reload schema';
commit;
