-- OnlyFast Track Trace foundation. ISOLATED TESTING ONLY; never root migrations.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end $$;

-- Fresh database membership, no client tier, editable metadata or beta exemption.
create function onlyfast_private.track_trace_enabled()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and public.onlyfast_subscription_tier(auth.uid()) in ('pro','factory');
$$;
revoke all on function onlyfast_private.track_trace_enabled() from public,anon;
grant execute on function onlyfast_private.track_trace_enabled() to authenticated;

-- Private lookup avoids recursive policies. Unknown session modes fail closed.
create function onlyfast_private.track_trace_session(p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select onlyfast_private.track_trace_enabled() and exists (
    select 1 from public.onlylaps_timing_sessions s
    where s.id=p_session and s.user_id=auth.uid()
      and s.session_type in ('practice','qualifying','race','circuit')
      and (s.track_map_id is null or exists (select 1 from public.onlylaps_track_maps t
        where t.id=s.track_map_id and not t.is_open_route
          and coalesce(lower(t.track_type),'') not in ('gumball','public_road','open_route')))
  );
$$;
revoke all on function onlyfast_private.track_trace_session(uuid) from public,anon;
grant execute on function onlyfast_private.track_trace_session(uuid) to authenticated;

-- Restrictive policies AND with all retained owner policies; no permissive bypass.
do $$ declare t text; begin
  foreach t in array array['onlylaps_timing_sessions','onlylaps_track_maps','onlylaps_lap_times',
    'onlylaps_telemetry_samples','onlylaps_lap_sector_times','onlylaps_session_analysis',
    'onlyfast_onlylaps_session_links','onlylaps_my_tracks','onlylaps_sensor_calibrations',
    'onlylaps_telemetry_shares','onlylaps_track_sector_defaults','onlylaps_user_track_sectors'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('create policy track_trace_entitlement on public.%I as restrictive for all to authenticated using ((select onlyfast_private.track_trace_enabled())) with check ((select onlyfast_private.track_trace_enabled()))',t);
  end loop;
end $$;

create policy track_trace_circuit on public.onlylaps_timing_sessions as restrictive for all to authenticated
using (user_id=(select auth.uid()) and session_type in ('practice','qualifying','race','circuit')
  and (track_map_id is null or exists (select 1 from public.onlylaps_track_maps t where t.id=track_map_id and not t.is_open_route)))
with check (user_id=(select auth.uid()) and session_type in ('practice','qualifying','race','circuit')
  and (track_map_id is null or exists (select 1 from public.onlylaps_track_maps t where t.id=track_map_id and not t.is_open_route)));
create policy track_trace_circuit on public.onlylaps_track_maps as restrictive for all to authenticated
using (not is_open_route and coalesce(lower(track_type),'') not in ('gumball','public_road','open_route'))
with check (not is_open_route and coalesce(lower(track_type),'') not in ('gumball','public_road','open_route'));
do $$ declare t text; begin
  foreach t in array array['onlylaps_lap_times','onlylaps_telemetry_samples','onlylaps_lap_sector_times'] loop
    execute format('create policy track_trace_session_owner on public.%I as restrictive for all to authenticated using (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(timing_session_id)) with check (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(timing_session_id))',t);
  end loop;
end $$;
create policy track_trace_session_owner on public.onlylaps_session_analysis as restrictive for all to authenticated
using (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(session_id))
with check (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(session_id));
create policy track_trace_session_owner on public.onlyfast_onlylaps_session_links as restrictive for all to authenticated
using (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(onlylaps_session_id))
with check (user_id=(select auth.uid()) and onlyfast_private.track_trace_session(onlylaps_session_id));
create policy track_trace_sector_lap_owner on public.onlylaps_lap_sector_times as restrictive for all to authenticated
using (exists(select 1 from public.onlylaps_lap_times l where l.id=lap_id and l.timing_session_id=onlylaps_lap_sector_times.timing_session_id and l.user_id=(select auth.uid())))
with check (exists(select 1 from public.onlylaps_lap_times l where l.id=lap_id and l.timing_session_id=onlylaps_lap_sector_times.timing_session_id and l.user_id=(select auth.uid())));
create policy track_trace_share_owner on public.onlylaps_telemetry_shares as restrictive for all to authenticated
using (owner_id=(select auth.uid()) and onlyfast_private.track_trace_session(session_id))
with check (owner_id=(select auth.uid()) and onlyfast_private.track_trace_session(session_id));

create function public.get_track_trace_permission()
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('feature','track_trace','allowed',onlyfast_private.track_trace_enabled(),
    'tier',public.onlyfast_subscription_tier(auth.uid()),'session_limit',null,
    'capabilities',case when onlyfast_private.track_trace_enabled() then
      '["circuit_timing","free_track","scanned_track","session_recording","session_review","laps","sectors","gps_trace","lap_comparison","optimum_lap","telemetry_analysis","setup_assist"]'::jsonb else '[]'::jsonb end);
$$;
create function onlyfast_private.require_track_trace()
returns void language plpgsql stable security invoker set search_path='' as $$
begin
  if not onlyfast_private.track_trace_enabled() then
    raise exception 'TRACK_TRACE_PRO_REQUIRED' using errcode='42501';
  end if;
end $$;
revoke all on function onlyfast_private.require_track_trace() from public,anon;
grant execute on function onlyfast_private.require_track_trace() to authenticated;

create function public.list_track_trace_sessions(p_setup_id uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  perform onlyfast_private.require_track_trace();
  if p_offset is null or p_offset<0 then raise exception 'INVALID_PAGE'; end if;
  if p_setup_id is not null and not exists(select 1 from public.race_setups where id=p_setup_id and user_id=auth.uid()) then
    raise exception 'SESSION_NOT_FOUND' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(s)) from (
    select s.id,s.name,s.session_name,s.started_at,s.ended_at,s.track_map_id,s.session_type
    from public.onlylaps_timing_sessions s where s.user_id=auth.uid()
      and (p_setup_id is null or exists(select 1 from public.onlyfast_onlylaps_session_links l
        where l.onlylaps_session_id=s.id and l.onlyfast_session_id=p_setup_id and l.user_id=auth.uid()))
    order by s.created_at desc,s.id limit 100 offset p_offset
  ) s),'[]'::jsonb);
end $$;

create function public.create_track_trace_session(p_setup_id uuid,p_name text,p_track_map_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid; setup public.race_setups%rowtype; access_state jsonb;
begin
  perform onlyfast_private.require_track_trace();
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_name ~ '[[:cntrl:]<>]' then raise exception 'INVALID_SESSION_NAME'; end if;
  select * into setup from public.race_setups where id=p_setup_id and user_id=auth.uid() for update;
  if not found or setup.race_weekend_id is null then raise exception 'SAVED_RACE_SESSION_REQUIRED' using errcode='42501'; end if;
  access_state:=public.get_onlyfast_2027_setup_edit_state(p_setup_id);
  -- Phase 1C reports the original clock; Phase 2 additionally reports editability.
  -- Respect either installed version without activating the separate archive work.
  if access_state is null or not public.onlyfast_can_save_setup_class(auth.uid(),setup.race_class)
    or (access_state ? 'editable' and not coalesce((access_state->>'editable')::boolean,false)) then
    raise exception 'SETUP_READ_ONLY' using errcode='42501';
  end if;
  if exists(select 1 from public.onlyfast_onlylaps_session_links where onlyfast_session_id=p_setup_id and user_id=auth.uid()) then
    raise exception 'SESSION_ALREADY_LINKED';
  end if;
  insert into public.onlylaps_timing_sessions(user_id,name,session_name,session_type,track_map_id)
    values(auth.uid(),btrim(p_name),btrim(p_name),'practice',p_track_map_id) returning id into sid;
  insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id,link_method)
    values(auth.uid(),p_setup_id,sid,'track_trace');
  return sid;
end $$;

create function public.get_track_trace_session(p_session_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  perform onlyfast_private.require_track_trace();
  select jsonb_build_object('session',to_jsonb(s),
    'laps',coalesce((select jsonb_agg(to_jsonb(l) order by l.lap_number) from public.onlylaps_lap_times l where l.timing_session_id=s.id and l.user_id=auth.uid()),'[]'::jsonb),
    'sectors',coalesce((select jsonb_agg(to_jsonb(x) order by x.lap_id,x.sector_index) from public.onlylaps_lap_sector_times x where x.timing_session_id=s.id and x.user_id=auth.uid()),'[]'::jsonb),
    'analysis',coalesce((select jsonb_agg(to_jsonb(a)) from public.onlylaps_session_analysis a where a.session_id=s.id and a.user_id=auth.uid()),'[]'::jsonb))
    into result from public.onlylaps_timing_sessions s where s.id=p_session_id and s.user_id=auth.uid();
  if result is null then raise exception 'SESSION_NOT_FOUND' using errcode='42501'; end if;
  return result;
end $$;

-- Reusable exact-setup entry for Setup Assist. No browser telemetry or AI calls.
create function public.get_track_trace_setup_context(p_setup_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare sid uuid; n integer;
begin
  perform onlyfast_private.require_track_trace();
  if not exists(select 1 from public.race_setups where id=p_setup_id and user_id=auth.uid()) then
    raise exception 'SESSION_NOT_FOUND' using errcode='42501';
  end if;
  select count(*),(array_agg(onlylaps_session_id))[1] into n,sid from public.onlyfast_onlylaps_session_links
    where onlyfast_session_id=p_setup_id and user_id=auth.uid();
  if n>1 then raise exception 'AMBIGUOUS_SESSION_LINK'; end if;
  if n=0 then return jsonb_build_object('linked',false); end if;
  return jsonb_build_object('linked',true,'onlyfast_session_id',p_setup_id,'context',public.get_track_trace_session(sid));
end $$;

-- Explicit grants are independent of RLS. Functions remain invokers of owner policies.
revoke all on function public.get_track_trace_permission(),public.list_track_trace_sessions(uuid,integer),
  public.create_track_trace_session(uuid,text,uuid),public.get_track_trace_session(uuid),public.get_track_trace_setup_context(uuid) from public,anon;
grant execute on function public.get_track_trace_permission(),public.list_track_trace_sessions(uuid,integer),
  public.create_track_trace_session(uuid,text,uuid),public.get_track_trace_session(uuid),public.get_track_trace_setup_context(uuid) to authenticated;
grant select,insert,update,delete on public.onlylaps_timing_sessions,public.onlylaps_lap_times,
  public.onlylaps_lap_sector_times,public.onlylaps_telemetry_samples,public.onlyfast_onlylaps_session_links to authenticated;
grant select on public.onlylaps_track_maps,public.onlylaps_session_analysis to authenticated;
grant usage,select on sequence public.onlylaps_telemetry_samples_id_seq to authenticated;
revoke execute on function public.onlyfast_onlylaps_touch_updated_at() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
