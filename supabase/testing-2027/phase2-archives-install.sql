-- OnlyFast 2027 testing installation artifact. Never production/root migrations.
-- Existing order: Phase 1C + API hardening -> Track Trace foundation -> Phase 2B.
-- One transaction installs archives, then historical-read/write separation.
-- Do not install the two component files again after applying this artifact.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if to_regprocedure('onlyfast_private.track_trace_enabled()') is null
    or to_regprocedure('onlyfast_private.track_trace_setup_writable(uuid)') is null
    or to_regprocedure('public.list_track_trace_link_candidates(uuid,integer)') is null
    or to_regprocedure('public.set_track_trace_session_link(uuid,uuid,uuid)') is null
    or to_regprocedure('public.list_track_trace_tracks(integer)') is null then
    raise exception 'INSTALLED_TRACK_TRACE_FOUNDATION_AND_PHASE2B_REQUIRED';
  end if;
  if to_regclass('onlyfast_private.setup_archives') is not null
    or to_regprocedure('onlyfast_private.require_track_trace_history()') is not null then
    raise exception 'PHASE2_ARCHIVES_OR_HISTORY_ALREADY_INSTALLED';
  end if;
end $$;

-- Source: phase2-archives.sql
-- SHA-256: F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598
-- Isolated 2027 testing only. Apply after Phase 1C; never root migrations.
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end; $$;

-- Archive metadata lives apart from racing rows: archiving never touches their
-- values, relationships, created_at, updated_at, or the weekend's original clock.
create table onlyfast_private.setup_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('base','weekend')),
  entity_id uuid not null,
  archived_at timestamptz,
  primary key(user_id,entity_kind,entity_id)
);
create index setup_archives_active_lookup on onlyfast_private.setup_archives(user_id,entity_id) where archived_at is not null;
alter table onlyfast_private.setup_archives enable row level security;
revoke all on onlyfast_private.setup_archives from public,anon,authenticated;

create table onlyfast_private.setup_archive_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('base','weekend')),
  entity_id uuid not null,
  action text not null check(action in ('archive','restore')),
  occurred_at timestamptz not null default now()
);
alter table onlyfast_private.setup_archive_events enable row level security;
revoke all on onlyfast_private.setup_archive_events from public,anon,authenticated;

create function onlyfast_private.setup_archived_at(p_user_id uuid,p_setup_id uuid)
returns timestamptz language sql stable security definer set search_path='' as $$
  select a.archived_at from public.race_setups r
  join onlyfast_private.setup_archives a on a.user_id=r.user_id
    and a.entity_kind=case when r.race_weekend_id is null then 'base' else 'weekend' end
    and a.entity_id=coalesce(r.race_weekend_id,r.id)
  where r.user_id=p_user_id and r.id=p_setup_id;
$$;
revoke all on function onlyfast_private.setup_archived_at(uuid,uuid) from public,anon,authenticated;

create function onlyfast_private.set_setup_archive(p_setup_id uuid,p_archive boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid(); v_row public.race_setups%rowtype;
  v_kind text; v_id uuid; v_previous timestamptz; v_next timestamptz; v_tier text;
begin
  if v_uid is null then raise exception 'ARCHIVE_AUTH_REQUIRED' using errcode='42501'; end if;
  if p_archive is null then raise exception 'ARCHIVE_ACTION_REQUIRED' using errcode='22023'; end if;
  -- Identical to setup creation's lock. Quota counts and archive transitions
  -- serialize even when no subscription or archive metadata row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  select * into v_row from public.race_setups where id=p_setup_id and user_id=v_uid;
  if not found then raise exception 'ARCHIVE_SETUP_OWNER_REQUIRED' using errcode='42501'; end if;
  v_tier:=onlyfast_private.membership_tier(v_uid);
  if v_tier not in ('sportsman','pro','factory','team','admin') then
    raise exception 'ARCHIVE_PAID_SUBSCRIPTION_REQUIRED' using errcode='42501';
  end if;
  if not p_archive and v_tier not in ('pro','factory','team','admin') then
    raise exception 'ARCHIVE_RESTORE_REQUIRES_PRO_OR_FACTORY' using errcode='42501';
  end if;
  if not p_archive and not public.onlyfast_can_save_setup_class(v_uid,v_row.race_class) then
    raise exception 'ARCHIVE_RESTORE_REQUIRES_ACTIVE_CLASS' using errcode='42501';
  end if;
  v_kind:=case when v_row.race_weekend_id is null then 'base' else 'weekend' end;
  v_id:=coalesce(v_row.race_weekend_id,v_row.id);
  select archived_at into v_previous from onlyfast_private.setup_archives
    where user_id=v_uid and entity_kind=v_kind and entity_id=v_id;
  -- Repeated submission returns the confirmed state without another audit event.
  if p_archive and v_previous is not null or not p_archive and v_previous is null then
    return jsonb_build_object('archived_at',v_previous,'entity_id',v_id,'entity_kind',v_kind,'changed',false);
  end if;
  v_next:=case when p_archive then now() else null end;
  insert into onlyfast_private.setup_archives(user_id,entity_kind,entity_id,archived_at)
    values(v_uid,v_kind,v_id,v_next)
    on conflict(user_id,entity_kind,entity_id) do update set archived_at=excluded.archived_at;
  insert into onlyfast_private.setup_archive_events(user_id,entity_kind,entity_id,action)
    values(v_uid,v_kind,v_id,case when p_archive then 'archive' else 'restore' end);
  return jsonb_build_object('archived_at',v_next,'entity_id',v_id,'entity_kind',v_kind,'changed',true);
end;
$$;
revoke all on function onlyfast_private.set_setup_archive(uuid,boolean) from public,anon;
grant execute on function onlyfast_private.set_setup_archive(uuid,boolean) to authenticated;

create function public.set_onlyfast_setup_archive(p_setup_id uuid,p_archive boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select onlyfast_private.set_setup_archive(p_setup_id,p_archive);
$$;
revoke all on function public.set_onlyfast_setup_archive(uuid,boolean) from public,anon;
grant execute on function public.set_onlyfast_setup_archive(uuid,boolean) to authenticated;

-- Keep the legacy resolver intact for explicit legacy tests and authorization
-- grants. Only this isolated schema introduces the no-subscription state.
alter function onlyfast_private.membership_tier(uuid) rename to phase1_membership_tier;
create function onlyfast_private.membership_tier(p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case when onlyfast_private.phase1_membership_tier(p_user_id)='rookie'
    and onlyfast_private.test_subscription_tier(p_user_id) is distinct from 'rookie'
    then 'unsubscribed' else onlyfast_private.phase1_membership_tier(p_user_id) end;
$$;
revoke all on function onlyfast_private.membership_tier(uuid) from public,anon,authenticated;
grant execute on function onlyfast_private.membership_tier(uuid) to service_role;

create function onlyfast_private.can_read_setup(p_uid uuid,p_setup_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_uid=auth.uid()
    and (onlyfast_private.setup_archived_at(p_uid,p_setup_id) is null
      or onlyfast_private.membership_tier(p_uid) in ('pro','factory','team','admin'));
$$;
revoke all on function onlyfast_private.can_read_setup(uuid,uuid) from public,anon;
grant execute on function onlyfast_private.can_read_setup(uuid,uuid) to authenticated;
create policy phase2_archive_contents on public.race_setups as restrictive
  for select to authenticated using (onlyfast_private.can_read_setup(user_id,id));

-- Historical classes remain readable after downgrade; the separate write guard
-- still requires the explicitly selected active class.
create or replace function public.onlyfast_can_access_setup_class(p_user_id uuid,p_race_class text)
returns boolean language sql stable security invoker set search_path='' as $$
  select p_user_id=auth.uid();
$$;

create function onlyfast_private.active_setup_counts(p_uid uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'base',count(*) filter(where race_weekend_id is null),
    'regular',count(distinct race_weekend_id) filter(where race_weekend_id is not null))
  from public.race_setups r where r.user_id=p_uid
    and onlyfast_private.setup_archived_at(p_uid,r.id) is null;
$$;
revoke all on function onlyfast_private.active_setup_counts(uuid) from public,anon,authenticated;

create function onlyfast_private.setup_access_for_owner(p_uid uuid,p_setup_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.race_setups%rowtype; t text; a timestamptz; clock timestamptz;
  counts jsonb; reason text;
begin
  select * into r from public.race_setups where id=p_setup_id and user_id=p_uid;
  if not found then return null; end if;
  t:=onlyfast_private.membership_tier(r.user_id);
  a:=onlyfast_private.setup_archived_at(r.user_id,r.id);
  select created_at into clock from onlyfast_private.setup_weekends where id=r.race_weekend_id and user_id=r.user_id;
  clock:=coalesce(clock,r.created_at);
  counts:=onlyfast_private.active_setup_counts(r.user_id);
  reason:=case
    when a is not null and t not in ('pro','factory','team','admin') then 'archived'
    when a is not null then 'archived_restore_required'
    when t='unsubscribed' then 'unsubscribed'
    when not onlyfast_private.can_write_class_2027(r.user_id,r.race_class) then 'class_read_only'
    when t='sportsman' and ((r.race_weekend_id is null and (counts->>'base')::int>2)
      or (r.race_weekend_id is not null and (counts->>'regular')::int>5)) then 'over_quota'
    when t='sportsman' and r.race_weekend_id is not null and clock<=now()-interval '48 hours' then '48_hour_lock'
    else null end;
  return jsonb_build_object('created_at',clock,'archived_at',a,'readable',reason is distinct from 'archived',
    'editable',reason is null,'reason',reason,'tier',t,'counts',counts);
end;
$$;
revoke all on function onlyfast_private.setup_access_for_owner(uuid,uuid) from public,anon,authenticated;
create function onlyfast_private.setup_access_state(p_setup_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select onlyfast_private.setup_access_for_owner(auth.uid(),p_setup_id);
$$;
revoke all on function onlyfast_private.setup_access_state(uuid) from public,anon;
grant execute on function onlyfast_private.setup_access_state(uuid) to authenticated;
create or replace function public.get_onlyfast_2027_setup_edit_state(p_setup_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select onlyfast_private.setup_access_state(p_setup_id);
$$;

create or replace function public.list_user_setup_summaries()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'created_at',r.created_at,'updated_at',r.updated_at,
    'setup_type',r.setup_type,'setup_name',r.setup_name,'race_class',r.race_class,
    'track_name',r.track_name,'race_date',r.race_date,'race_schedule_id',r.race_schedule_id,
    'race_weekend_id',r.race_weekend_id,'session_label',r.session_label,'session_order',r.session_order,
    'archived_at',onlyfast_private.setup_archived_at(r.user_id,r.id),
    'access',onlyfast_private.setup_access_state(r.id)) order by r.created_at desc),'[]'::jsonb)
  from public.race_setups r where r.user_id=auth.uid();
$$;

-- Existing child rows remain stored. Their public read path follows the parent.
create policy phase2_link_parent_read on public.onlyfast_onlylaps_session_links as restrictive
  for select to authenticated using (onlyfast_private.can_read_setup(user_id,onlyfast_session_id));
create policy phase2_shared_parent_read on public.shared_setups as restrictive
  for select to authenticated using (onlyfast_private.can_read_setup(shared_by,setup_id));

-- SECURITY DEFINER link RPCs also reach these triggers. RLS alone would not
-- stop a privileged wrapper writing for an authenticated, read-only caller.
create function onlyfast_private.guard_phase2_racing_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb; sid uuid; timing_id uuid; state jsonb; rows_to_check jsonb[];
begin
  if auth.uid() is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if onlyfast_private.membership_tier(auth.uid())='unsubscribed' then
    raise exception 'SUBSCRIPTION_READ_ONLY' using errcode='42501';
  end if;
  -- Check both ends of an UPDATE. Relinking cannot detach an archived child
  -- and turn it into an independently readable historical record.
  rows_to_check:=case when tg_op='UPDATE' then array[to_jsonb(old),to_jsonb(new)]
    when tg_op='DELETE' then array[to_jsonb(old)] else array[to_jsonb(new)] end;
  foreach j in array rows_to_check loop
  sid:=coalesce(j->>'onlyfast_session_id',j->>'setup_id')::uuid;
  if sid is not null then
    state:=onlyfast_private.setup_access_state(sid);
    if state is null or not (state->>'editable')::boolean then
      raise exception 'SETUP_CHILD_READ_ONLY' using errcode='42501';
    end if;
  end if;
  timing_id:=case when tg_table_name='onlylaps_timing_sessions' then (j->>'id')::uuid
    else coalesce(j->>'timing_session_id',j->>'session_id',j->>'onlylaps_session_id')::uuid end;
  if timing_id is not null and exists(select 1 from public.onlyfast_onlylaps_session_links l
    where l.onlylaps_session_id=timing_id and l.user_id=auth.uid()
      and not coalesce((onlyfast_private.setup_access_state(l.onlyfast_session_id)->>'editable')::boolean,false)) then
    raise exception 'TIMING_PARENT_READ_ONLY' using errcode='42501';
  end if;
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function onlyfast_private.guard_phase2_racing_write() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['race_schedule','parts_reference','shared_setups','onlyfast_onlylaps_session_links','onlylaps_timing_sessions',
    'onlylaps_lap_times','onlylaps_lap_sector_times','onlylaps_telemetry_samples','onlylaps_session_analysis','onlylaps_telemetry_shares'] loop
    execute format('create trigger aa_phase2_racing_write before insert or update or delete on public.%I for each row execute function onlyfast_private.guard_phase2_racing_write()',t);
  end loop;
end; $$;

create function onlyfast_private.guard_phase2_setup()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.race_setups%rowtype; state jsonb;
begin
  if auth.uid() is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='INSERT' then return new; end if;
  r:=old;
  perform pg_advisory_xact_lock(hashtextextended(r.user_id::text,0));
  state:=onlyfast_private.setup_access_state(r.id);
  if r.user_id is distinct from auth.uid() or state is null then raise exception 'SETUP_OWNER_REQUIRED' using errcode='42501'; end if;
  if not (state->>'editable')::boolean then raise exception 'SETUP_READ_ONLY:%',state->>'reason' using errcode='42501'; end if;
  if tg_op='DELETE' and onlyfast_private.setup_archived_at(r.user_id,r.id) is not null then
    raise exception 'ARCHIVED_SETUP_DELETE_FORBIDDEN' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function onlyfast_private.guard_phase2_setup() from public,anon,authenticated;
create trigger aa_phase2_setup_write before update or delete on public.race_setups
  for each row execute function onlyfast_private.guard_phase2_setup();

-- Patch only audited definitions and abort on source drift. The reviewed Phase
-- 1 clock/alias/session logic remains byte-for-byte outside these quota changes.
alter table onlyfast_private.usage_requests add column setup_id uuid;
alter table onlyfast_private.usage_requests add column reserved_tier text;
do $$ declare d text; begin
  d:=pg_get_functiondef('onlyfast_private.guard_setup_limits()'::regprocedure);
  if position('if v_tier=''sportsman'' then' in d)=0
    or position('if v_count>=v_limits.max_base' in d)=0
    or position('if v_count>=v_limits.max_regular' in d)=0 then raise exception 'PHASE2_GUARD_SOURCE_DRIFT'; end if;
  d:=replace(d,'if v_tier=''sportsman'' then',
    'if v_tier=''unsubscribed'' then raise exception ''SUBSCRIPTION_READ_ONLY'' using errcode=''42501''; end if;
     if exists(select 1 from onlyfast_private.setup_archives a where a.user_id=new.user_id and a.entity_id=coalesce(new.race_weekend_id,new.id) and a.archived_at is not null) then
       raise exception ''ARCHIVED_SETUP_REQUIRES_RESTORE'' using errcode=''42501''; end if;
     if v_tier=''sportsman'' then');
  d:=replace(d,'if v_count>=v_limits.max_base',
    'v_count:=(onlyfast_private.active_setup_counts(new.user_id)->>''base'')::int; if v_count>=v_limits.max_base');
  d:=replace(d,'if v_count>=v_limits.max_regular',
    'v_count:=(onlyfast_private.active_setup_counts(new.user_id)->>''regular'')::int; if v_count>=v_limits.max_regular');
  if position('select * into strict v_limits from onlyfast_private.subscription_2027_limits where tier=v_tier;' in d)=0 then
    raise exception 'PHASE2_LIMITS_SOURCE_DRIFT'; end if;
  d:=replace(d,'select * into strict v_limits from onlyfast_private.subscription_2027_limits where tier=v_tier;',
    'select * into strict v_limits from onlyfast_private.subscription_2027_limits where tier=v_tier;
     if not v_base and (onlyfast_private.active_setup_counts(new.user_id)->>''regular'')::int>v_limits.max_regular then
       raise exception ''SETUP_READ_ONLY:over_quota'' using errcode=''42501''; end if;');
  execute d;
  -- All write paths acquire the same lock before subscription-row locks.
  d:=pg_get_functiondef('onlyfast_private.guard_setup_vehicle()'::regprocedure);
  if position('perform 1 from public.user_subscriptions where user_id = auth.uid() for update;' in d)=0 then
    raise exception 'PHASE2_VEHICLE_GUARD_SOURCE_DRIFT'; end if;
  d:=replace(d,'perform 1 from public.user_subscriptions where user_id = auth.uid() for update;',
    'perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));');
  execute d;
  -- Share redemption never exposes archived contents, including to anonymous
  -- callers. Paid owners open archived records through the owner API instead.
  d:=pg_get_functiondef('onlyfast_private.redeem_setup_share(text)'::regprocedure);
  if position('and s.is_public' in d)=0 then raise exception 'PHASE2_SHARE_SOURCE_DRIFT'; end if;
  d:=replace(d,'and s.is_public','and s.is_public and onlyfast_private.setup_archived_at(r.user_id,r.id) is null');
  execute d;
  d:=pg_get_functiondef('public.onlyfast_reserve_usage(uuid,text,uuid,text,uuid,boolean)'::regprocedure);
  if position('v_tier := onlyfast_private.membership_tier(p_user_id);' in d)=0 then raise exception 'PHASE2_USAGE_SOURCE_DRIFT'; end if;
  d:=replace(d,'v_tier := onlyfast_private.membership_tier(p_user_id);',
    'v_tier := onlyfast_private.membership_tier(p_user_id);
     if v_tier=''unsubscribed'' then raise exception ''SUBSCRIPTION_READ_ONLY'' using errcode=''42501''; end if;
     if p_setup_id is not null and not coalesce((onlyfast_private.setup_access_for_owner(p_user_id,p_setup_id)->>''editable'')::boolean,false) then
       raise exception ''USAGE_SETUP_READ_ONLY'' using errcode=''42501''; end if;');
  d:=replace(d,'return jsonb_build_object(''status'',''reserved''',
    'update onlyfast_private.usage_requests set setup_id=p_setup_id,reserved_tier=v_tier
       where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
     return jsonb_build_object(''status'',''reserved''');
  execute d;
  d:=pg_get_functiondef('public.onlyfast_finish_usage(uuid,text,uuid,uuid,jsonb)'::regprocedure);
  if position('if v_request.expires_at<=now()' in d)=0 then raise exception 'PHASE2_FINISH_SOURCE_DRIFT'; end if;
  d:=replace(d,'if v_request.expires_at<=now()',
    'if v_request.reserved_tier is distinct from onlyfast_private.membership_tier(p_user_id)
      or onlyfast_private.membership_tier(p_user_id)=''unsubscribed''
      or (v_request.setup_id is not null and not coalesce((onlyfast_private.setup_access_for_owner(p_user_id,v_request.setup_id)->>''editable'')::boolean,false))
      or exists(select 1 from onlyfast_private.setup_archives a where a.user_id=p_user_id and a.entity_kind=''weekend''
        and ''weekend:''||a.entity_id::text=v_request.scope and a.archived_at is not null) then return false; end if;
     if v_request.expires_at<=now()');
  execute d;
end; $$;

-- Service-role RPCs have no user JWT and bypass RLS. Validate their verified
-- user argument explicitly, under the same per-user lock as archive/create.
create function onlyfast_private.assert_2027_setup_write(p_uid uuid,p_setup uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
  if not coalesce((onlyfast_private.setup_access_for_owner(p_uid,p_setup)->>'editable')::boolean,false) then
    raise exception 'SETUP_CHILD_READ_ONLY' using errcode='42501';
  end if;
end;
$$;
revoke all on function onlyfast_private.assert_2027_setup_write(uuid,uuid) from public,anon,authenticated;
do $$ declare d text; signature text; begin
  foreach signature in array array[
    'public.onlyfast_set_onlylaps_session_link(uuid,uuid,uuid,text,numeric)',
    'public.onlyfast_unlink_onlylaps_session(uuid,uuid)'] loop
    d:=pg_get_functiondef(signature::regprocedure);
    if position('begin' in d)=0 then raise exception 'PHASE2_LINK_SOURCE_DRIFT'; end if;
    d:=replace(d,'begin','begin perform onlyfast_private.assert_2027_setup_write(p_user_id,p_onlyfast_session_id);');
    execute d;
  end loop;
end; $$;

-- Linked telemetry is protected through each direct table endpoint as well as
-- through its OnlyFast parent. Independent, unlinked results stay readable.
create function onlyfast_private.can_read_timing_for_owner_2027(p_uid uuid,p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (onlyfast_private.membership_tier(p_uid) in ('pro','factory','team','admin')
    or not exists(select 1 from public.onlyfast_onlylaps_session_links l where l.user_id=p_uid and l.onlylaps_session_id=p_session
      and onlyfast_private.setup_archived_at(p_uid,l.onlyfast_session_id) is not null));
$$;
revoke all on function onlyfast_private.can_read_timing_for_owner_2027(uuid,uuid) from public,anon,authenticated;
create function onlyfast_private.can_read_timing_2027(p_uid uuid,p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_uid=auth.uid() and onlyfast_private.can_read_timing_for_owner_2027(p_uid,p_session);
$$;
revoke all on function onlyfast_private.can_read_timing_2027(uuid,uuid) from public,anon;
grant execute on function onlyfast_private.can_read_timing_2027(uuid,uuid) to authenticated;
create policy phase2_timing_read on public.onlylaps_timing_sessions as restrictive for select to authenticated
  using(onlyfast_private.can_read_timing_2027(user_id,id));
create policy phase2_analysis_read on public.onlylaps_session_analysis as restrictive for select to authenticated
  using(onlyfast_private.can_read_timing_2027(user_id,session_id));
create policy phase2_laps_read on public.onlylaps_lap_times as restrictive for select to authenticated
  using(onlyfast_private.can_read_timing_2027(user_id,timing_session_id));
create policy phase2_sectors_read on public.onlylaps_lap_sector_times as restrictive for select to authenticated
  using(onlyfast_private.can_read_timing_2027(user_id,timing_session_id));
create policy phase2_samples_read on public.onlylaps_telemetry_samples as restrictive for select to authenticated
  using(onlyfast_private.can_read_timing_2027(user_id,timing_session_id));
do $$ declare d text; begin
  d:=pg_get_functiondef('public.onlyfast_onlylaps_candidate_lap_summaries(uuid,uuid[])'::regprocedure);
  if position('where laps.user_id = p_user_id' in d)=0 then raise exception 'PHASE2_CANDIDATE_SOURCE_DRIFT'; end if;
  d:=replace(d,'where laps.user_id = p_user_id',
    'where laps.user_id = p_user_id and onlyfast_private.can_read_timing_for_owner_2027(p_user_id,laps.timing_session_id)');
  execute d;
end; $$;
-- Anonymous telemetry-share surfaces must not reveal a linked archived parent.
create function onlyfast_private.can_share_timing_2027(p_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.onlyfast_onlylaps_session_links l where l.onlylaps_session_id=p_session
    and onlyfast_private.setup_archived_at(l.user_id,l.onlyfast_session_id) is not null);
$$;
revoke all on function onlyfast_private.can_share_timing_2027(uuid) from public;
grant execute on function onlyfast_private.can_share_timing_2027(uuid) to anon,authenticated;
create policy phase2_telemetry_share on public.onlylaps_telemetry_shares as restrictive for select
  using(onlyfast_private.can_share_timing_2027(session_id));

-- Factory downgrades never infer the user's chosen class from old history.
create table onlyfast_private.class_selection_2027 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selection_required boolean not null default false
);
alter table onlyfast_private.class_selection_2027 enable row level security;
revoke all on onlyfast_private.class_selection_2027 from public,anon,authenticated;
create function onlyfast_private.can_write_class_2027(p_uid uuid,p_class text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(onlyfast_private.membership_tier(p_uid) in ('factory','team','admin')
    or (onlyfast_private.membership_tier(p_uid)<>'unsubscribed'
      and not exists(select 1 from onlyfast_private.class_selection_2027 c where c.user_id=p_uid and c.selection_required)
      and nullif(trim(p_class),'') is not null
      and lower(trim(p_class))=lower(trim((select active_race_class from public.user_subscriptions where user_id=p_uid)))),false);
$$;
revoke all on function onlyfast_private.can_write_class_2027(uuid,text) from public,anon,authenticated;
create or replace function public.onlyfast_can_save_setup_class(p_user_id uuid,p_race_class text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_user_id=auth.uid() and onlyfast_private.can_write_class_2027(p_user_id,p_race_class);
$$;
revoke all on function public.onlyfast_can_save_setup_class(uuid,text) from public,anon;
grant execute on function public.onlyfast_can_save_setup_class(uuid,text) to authenticated;

create function onlyfast_private.guard_2027_tier_transition()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if (tg_table_name='beta_tester_accounts' and to_jsonb(new)->>'test_subscription_tier' in ('factory','team'))
    or (tg_table_name='user_subscriptions' and to_jsonb(new)->>'plan' in ('factory','team','teams')) then
    update onlyfast_private.class_selection_2027 set selection_required=false where user_id=new.user_id;
  end if;
  if (tg_table_name='beta_tester_accounts' and to_jsonb(old)->>'test_subscription_tier' in ('factory','team')
      and to_jsonb(new)->>'test_subscription_tier' not in ('factory','team'))
    or (tg_table_name='user_subscriptions' and to_jsonb(old)->>'plan' in ('factory','team','teams')
      and to_jsonb(new)->>'plan' not in ('factory','team','teams')) then
    insert into onlyfast_private.class_selection_2027(user_id,selection_required) values(new.user_id,true)
      on conflict(user_id) do update set selection_required=true;
  end if;
  return new;
end;
$$;
revoke all on function onlyfast_private.guard_2027_tier_transition() from public,anon,authenticated;
create trigger aa_phase2_test_tier before update of test_subscription_tier on public.beta_tester_accounts
  for each row execute function onlyfast_private.guard_2027_tier_transition();
create trigger aa_phase2_subscription_tier before update of plan,status on public.user_subscriptions
  for each row execute function onlyfast_private.guard_2027_tier_transition();

create function onlyfast_private.choose_2027_class(p_class text)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); chosen text;
begin
  if uid is null or onlyfast_private.membership_tier(uid)='unsubscribed' then
    raise exception 'CLASS_PAID_ACCOUNT_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if not exists(select 1 from onlyfast_private.class_selection_2027 where user_id=uid and selection_required) then
    raise exception 'DOWNGRADE_SELECTION_NOT_REQUIRED' using errcode='42501'; end if;
  chosen:=public.onlyfast_canonical_race_class(p_class);
  if chosen is null then raise exception 'CLASS_INVALID'; end if;
  update onlyfast_private.class_selection_2027 set selection_required=false where user_id=uid;
  update public.user_subscriptions set active_race_class=chosen,active_racing_discipline=public.onlyfast_race_discipline(chosen)
    where user_id=uid;
  return chosen;
end;
$$;
revoke all on function onlyfast_private.choose_2027_class(text) from public,anon;
grant execute on function onlyfast_private.choose_2027_class(text) to authenticated;
create function public.choose_onlyfast_2027_class(p_class text)
returns text language sql security invoker set search_path='' as $$ select onlyfast_private.choose_2027_class(p_class); $$;
revoke all on function public.choose_onlyfast_2027_class(text) from public,anon;
grant execute on function public.choose_onlyfast_2027_class(text) to authenticated;

create function onlyfast_private.account_access_2027()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tier',onlyfast_private.membership_tier(auth.uid()),
    'selection_required',coalesce((select selection_required from onlyfast_private.class_selection_2027 where user_id=auth.uid()),false),
    'active_class',public.onlyfast_active_race_class(auth.uid()),'counts',onlyfast_private.active_setup_counts(auth.uid()))
  where auth.uid() is not null;
$$;
revoke all on function onlyfast_private.account_access_2027() from public,anon;
grant execute on function onlyfast_private.account_access_2027() to authenticated;
create function public.get_onlyfast_2027_account_access()
returns jsonb language sql stable security invoker set search_path='' as $$ select onlyfast_private.account_access_2027(); $$;
revoke all on function public.get_onlyfast_2027_account_access() from public,anon;
grant execute on function public.get_onlyfast_2027_account_access() to authenticated;

-- No-subscription simulation is available only through existing server grants.
alter table public.beta_tester_accounts drop constraint beta_tester_accounts_test_subscription_tier_check;
alter table public.beta_tester_accounts add constraint beta_tester_accounts_test_subscription_tier_check
  check(test_subscription_tier in ('rookie','pro','team','sportsman','factory','unsubscribed'));
do $$ declare d text; begin
  d:=pg_get_functiondef('onlyfast_private.set_test_tier(text)'::regprocedure);
  if position('(''rookie'',''pro'',''team'',''sportsman'',''factory'')' in d)=0
    or position('begin' in d)=0 then raise exception 'PHASE2_TEST_TIER_SOURCE_DRIFT'; end if;
  d:=replace(d,'(''rookie'',''pro'',''team'',''sportsman'',''factory'')','(''rookie'',''pro'',''team'',''sportsman'',''factory'',''unsubscribed'')');
  d:=replace(d,'begin','begin perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));');
  execute d;
end; $$;

notify pgrst,'reload schema';

-- Source: track-trace-history-access.sql
-- SHA-256: 6751213223C5AF524BE57D1DA578AE77C405E7152517FB9F7E8CBE197692386A
-- Forward correction after Phase 2 archives and the already-applied Track Trace
-- foundation. Testing only; leave the original applied migration unchanged.
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
