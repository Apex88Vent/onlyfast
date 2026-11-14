-- Forward correction after Phase 2 archives and the already-applied Track Trace
-- foundation. Testing only; leave the original applied migration unchanged.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if to_regprocedure('onlyfast_private.can_read_timing_2027(uuid,uuid)') is null
    or to_regprocedure('onlyfast_private.track_trace_enabled()') is null then
    raise exception 'PHASE2_ARCHIVE_AND_TRACK_TRACE_REQUIRED';
  end if;
end $$;

-- This returns only circuit eligibility, never another owner's map contents.
-- A previously shared map can remain the reference for an owned session even
-- when the map itself is outside the caller's owner-scoped historical reads.
create function onlyfast_private.track_trace_circuit_map(p_map uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (p_map is null or exists(
    select 1 from public.onlylaps_track_maps t where t.id=p_map and not t.is_open_route
      and coalesce(lower(t.track_type),'') not in ('gumball','public_road','open_route')
      and (t.user_id=auth.uid() or exists(select 1 from public.onlylaps_timing_sessions s
        where s.track_map_id=t.id and s.user_id=auth.uid()))));
$$;
revoke all on function onlyfast_private.track_trace_circuit_map(uuid) from public,anon;
grant execute on function onlyfast_private.track_trace_circuit_map(uuid) to authenticated;

create or replace function onlyfast_private.track_trace_session(p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.onlylaps_timing_sessions s where s.id=p_session and s.user_id=auth.uid()
      and s.session_type in ('practice','qualifying','race','circuit')
      and onlyfast_private.track_trace_circuit_map(s.track_map_id)
      and onlyfast_private.can_read_timing_2027(s.user_id,s.id));
$$;

-- All retained owner/circuit/parent policies still AND with these restrictive
-- policies. SELECT never grants recording, editing, deletion or share creation.
do $$ declare t text; owner_col text; owner_check text; begin
  foreach t in array array['onlylaps_timing_sessions','onlylaps_track_maps','onlylaps_lap_times',
    'onlylaps_telemetry_samples','onlylaps_lap_sector_times','onlylaps_session_analysis',
    'onlyfast_onlylaps_session_links','onlylaps_my_tracks','onlylaps_sensor_calibrations',
    'onlylaps_telemetry_shares','onlylaps_track_sector_defaults','onlylaps_user_track_sectors'] loop
    owner_col:=case when t in ('onlylaps_telemetry_shares','onlylaps_track_sector_defaults') then 'owner_id' else 'user_id' end;
    owner_check:=format('%I=(select auth.uid())',owner_col);
    execute format('drop policy track_trace_entitlement on public.%I',t);
    execute format('create policy track_trace_history on public.%I as restrictive for select to authenticated using (%s)',t,owner_check);
    execute format('create policy track_trace_record on public.%I as restrictive for insert to authenticated with check (%s and (select onlyfast_private.track_trace_enabled()))',t,owner_check);
    execute format('create policy track_trace_modify on public.%I as restrictive for update to authenticated using (%s and (select onlyfast_private.track_trace_enabled())) with check (%s and (select onlyfast_private.track_trace_enabled()))',t,owner_check,owner_check);
    execute format('create policy track_trace_delete on public.%I as restrictive for delete to authenticated using (%s and (select onlyfast_private.track_trace_enabled()))',t,owner_check);
  end loop;
end $$;

drop policy track_trace_circuit on public.onlylaps_timing_sessions;
create policy track_trace_circuit on public.onlylaps_timing_sessions as restrictive for all to authenticated
using (user_id=(select auth.uid()) and session_type in ('practice','qualifying','race','circuit')
  and onlyfast_private.track_trace_circuit_map(track_map_id))
with check (user_id=(select auth.uid()) and session_type in ('practice','qualifying','race','circuit')
  and onlyfast_private.track_trace_circuit_map(track_map_id));

-- Recheck membership after the shared user lock. A request waiting on a tier
-- transition cannot use a pre-wait RLS snapshot to write after a downgrade.
create function onlyfast_private.assert_track_trace_write_2027(p_uid uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_uid is null then raise exception 'TRACK_TRACE_AUTH_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
  if onlyfast_private.membership_tier(p_uid) not in ('pro','factory') then
    raise exception 'TRACK_TRACE_PRO_REQUIRED' using errcode='42501';
  end if;
end $$;
revoke all on function onlyfast_private.assert_track_trace_write_2027(uuid) from public,anon,authenticated;

create function onlyfast_private.guard_track_trace_write_2027()
returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb; check_rows jsonb[]; uid uuid:=auth.uid();
begin
  -- Required server-only writers retain their existing privileges. Public
  -- service-role link RPCs additionally validate their verified user argument.
  if uid is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  perform onlyfast_private.assert_track_trace_write_2027(uid);
  check_rows:=case when tg_op='UPDATE' then array[to_jsonb(old),to_jsonb(new)]
    when tg_op='DELETE' then array[to_jsonb(old)] else array[to_jsonb(new)] end;
  foreach j in array check_rows loop
    if coalesce(j->>'user_id',j->>'owner_id')::uuid is distinct from uid then
      raise exception 'TRACK_TRACE_OWNER_REQUIRED' using errcode='42501';
    end if;
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function onlyfast_private.guard_track_trace_write_2027() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['onlylaps_timing_sessions','onlylaps_track_maps','onlylaps_lap_times',
    'onlylaps_telemetry_samples','onlylaps_lap_sector_times','onlylaps_session_analysis',
    'onlyfast_onlylaps_session_links','onlylaps_my_tracks','onlylaps_sensor_calibrations',
    'onlylaps_telemetry_shares','onlylaps_track_sector_defaults','onlylaps_user_track_sectors'] loop
    execute format('create trigger ab_track_trace_write before insert or update or delete on public.%I for each row execute function onlyfast_private.guard_track_trace_write_2027()',t);
  end loop;
end $$;

create function onlyfast_private.require_track_trace_history()
returns void language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'TRACK_TRACE_AUTH_REQUIRED' using errcode='42501'; end if;
end $$;
revoke all on function onlyfast_private.require_track_trace_history() from public,anon;
grant execute on function onlyfast_private.require_track_trace_history() to authenticated;

create function onlyfast_private.require_track_trace_write_2027()
returns void language plpgsql security definer set search_path='' as $$
begin perform onlyfast_private.assert_track_trace_write_2027(auth.uid()); end $$;
revoke all on function onlyfast_private.require_track_trace_write_2027() from public,anon;
grant execute on function onlyfast_private.require_track_trace_write_2027() to authenticated;

do $$ declare d text; signature text; begin
  foreach signature in array array['public.list_track_trace_sessions(uuid,integer)',
    'public.get_track_trace_session(uuid)','public.get_track_trace_setup_context(uuid)'] loop
    d:=pg_get_functiondef(signature::regprocedure);
    if position('perform onlyfast_private.require_track_trace();' in d)=0 then raise exception 'TRACE_HISTORY_SOURCE_DRIFT'; end if;
    execute replace(d,'perform onlyfast_private.require_track_trace();','perform onlyfast_private.require_track_trace_history();');
  end loop;
  d:=pg_get_functiondef('public.create_track_trace_session(uuid,text,uuid)'::regprocedure);
  if position('perform onlyfast_private.require_track_trace();' in d)=0 then raise exception 'TRACE_CREATE_SOURCE_DRIFT'; end if;
  execute replace(d,'perform onlyfast_private.require_track_trace();',
    'perform onlyfast_private.require_track_trace_write_2027();');
  foreach signature in array array['public.onlyfast_set_onlylaps_session_link(uuid,uuid,uuid,text,numeric)',
    'public.onlyfast_unlink_onlylaps_session(uuid,uuid)'] loop
    d:=pg_get_functiondef(signature::regprocedure);
    if position('perform onlyfast_private.assert_2027_setup_write(p_user_id,p_onlyfast_session_id);' in d)=0 then raise exception 'TRACE_LINK_SOURCE_DRIFT'; end if;
    execute replace(d,'perform onlyfast_private.assert_2027_setup_write(p_user_id,p_onlyfast_session_id);',
      'perform onlyfast_private.assert_track_trace_write_2027(p_user_id); perform onlyfast_private.assert_2027_setup_write(p_user_id,p_onlyfast_session_id);');
  end loop;
end $$;

create or replace function public.get_track_trace_permission()
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('feature','track_trace','allowed',auth.uid() is not null,
    'can_read_history',auth.uid() is not null,'can_record',onlyfast_private.track_trace_enabled(),
    'can_modify',onlyfast_private.track_trace_enabled(),
    'can_read_archived',onlyfast_private.track_trace_enabled(),
    'read_only',not onlyfast_private.track_trace_enabled(),
    'tier',public.onlyfast_subscription_tier(auth.uid()),'session_limit',null,
    'capabilities',case when onlyfast_private.track_trace_enabled() then
      '["circuit_timing","free_track","scanned_track","session_recording","session_review","laps","sectors","gps_trace","lap_comparison","optimum_lap","telemetry_analysis","setup_assist"]'::jsonb
      else '["session_review","laps","sectors","gps_trace","optimum_lap"]'::jsonb end);
$$;
notify pgrst,'reload schema';
commit;
