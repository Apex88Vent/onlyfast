-- REVIEW ONLY. Requires Phase 1 membership/RPC expansion. Local fixtures only.
begin;
-- PL/pgSQL bodies can otherwise install successfully with missing callees.
do $$
begin
  if to_regprocedure('onlyfast_private.membership_tier(uuid)') is null
    or to_regprocedure('public.onlyfast_membership_for_user(uuid)') is null
    or to_regprocedure('public.redeem_setup_share(text)') is null then
    raise exception 'PHASE1_MEMBERSHIP_PREREQUISITE_REQUIRED';
  end if;
end;
$$;
create table if not exists onlyfast_private.setup_weekends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);
revoke all on onlyfast_private.setup_weekends from public,anon,authenticated;
alter table onlyfast_private.setup_weekends enable row level security;
alter table public.race_setups add column if not exists race_weekend_id uuid;

create or replace function onlyfast_private.setup_event_key(p_row jsonb)
returns text language sql immutable set search_path = '' as $$
  select lower(trim(coalesce(p_row->>'race_class',''))) || '|' || case
    when nullif(p_row->>'race_schedule_id','') is not null then 'schedule|' || (p_row->>'race_schedule_id')
    when nullif(trim(p_row->>'track_name'),'') is not null and nullif(p_row->>'race_date','') is not null
      then 'race|' || lower(trim(p_row->>'track_name')) || '|' || (p_row->>'race_date')
    when nullif(trim(p_row->>'setup_name'),'') is not null then 'name|' || lower(trim(p_row->>'setup_name'))
    else 'row|' || (p_row->>'id') end;
$$;
revoke all on function onlyfast_private.setup_event_key(jsonb) from public,anon,authenticated;

insert into onlyfast_private.setup_weekends(user_id,event_key,created_at)
select user_id,onlyfast_private.setup_event_key(to_jsonb(r)),min(created_at)
from public.race_setups r where setup_type is distinct from 'base_template'
  and coalesce(setup_name,'') not ilike '[BASE TEMPLATE]%' and coalesce(to_jsonb(r)->>'is_template','false')<>'true'
group by user_id,onlyfast_private.setup_event_key(to_jsonb(r))
on conflict(user_id,event_key) do nothing;
-- A transactional backfill must preserve the original recency and lock clocks.
-- This exact trigger was verified in both the staging baseline and production.
do $$
begin
  if (select count(*) from pg_trigger where tgrelid='public.race_setups'::regclass
    and tgname in ('race_setups_touch_updated_at','guard_development_setup_library') and tgenabled='O')<>2 then
    raise exception 'PHASE1_TRIGGER_PREFLIGHT_REQUIRED';
  end if;
end;
$$;
alter table public.race_setups disable trigger race_setups_touch_updated_at;
alter table public.race_setups disable trigger guard_development_setup_library;
update public.race_setups r set race_weekend_id=w.id
from onlyfast_private.setup_weekends w
where r.race_weekend_id is null and r.user_id=w.user_id
  and onlyfast_private.setup_event_key(to_jsonb(r))=w.event_key
  and r.setup_type is distinct from 'base_template' and coalesce(r.setup_name,'') not ilike '[BASE TEMPLATE]%' and coalesce(to_jsonb(r)->>'is_template','false')<>'true';
alter table public.race_setups enable trigger race_setups_touch_updated_at;
alter table public.race_setups enable trigger guard_development_setup_library;

-- Snapshot consumed legacy name buckets onto the immutable identity before a
-- future rename. Old usage rows are retained for operator reconciliation.
insert into public.setup_assist_usage(user_id,race_weekend_key,used_count)
select r.user_id,'weekend:'||r.race_weekend_id::text,max(u.used_count)
from public.race_setups r join public.setup_assist_usage u
  on u.user_id=r.user_id and u.race_weekend_key=trim(r.setup_name)
where r.race_weekend_id is not null
group by r.user_id,r.race_weekend_id
on conflict(user_id,race_weekend_key) do update
  set used_count=greatest(public.setup_assist_usage.used_count,excluded.used_count);


create or replace function onlyfast_private.guard_setup_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tier text;
  v_weekend onlyfast_private.setup_weekends%rowtype;
  v_base boolean;
  v_count integer;
begin
  -- Operator/service maintenance remains outside browser restrictions.
  if auth.uid() is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.user_id is distinct from auth.uid() then raise exception 'SETUP_OWNER_REQUIRED' using errcode='42501'; end if;
  -- Serialize count checks even for users who have no subscription row yet.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  v_tier := onlyfast_private.membership_tier(new.user_id);
  v_base := coalesce(new.setup_type='base_template',false) or coalesce(new.setup_name,'') ilike '[BASE TEMPLATE]%' or coalesce(to_jsonb(new)->>'is_template','false')='true';
  if v_base and new.race_weekend_id is not null then
    raise exception 'BASE_SETUP_WEEKEND_FORBIDDEN' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id or new.race_class is distinct from old.race_class
      or new.race_weekend_id is distinct from old.race_weekend_id or new.created_at is distinct from old.created_at
      or (coalesce(old.setup_type='base_template',false) or coalesce(old.setup_name,'') ilike '[BASE TEMPLATE]%' or coalesce(to_jsonb(old)->>'is_template','false')='true') is distinct from v_base then
      raise exception 'SETUP_IDENTITY_IMMUTABLE' using errcode='42501';
    end if;
  else
    if nullif(trim(new.setup_name),'') is null then raise exception 'SETUP_NAME_REQUIRED' using errcode='42501'; end if;
    new.created_at := now();
  end if;
  if not public.onlyfast_can_save_setup_class(new.user_id,new.race_class) then
    raise exception 'SETUP_VEHICLE_LOCKED' using errcode='42501';
  end if;
  if new.race_schedule_id is not null and not exists(select 1 from public.race_schedule s
    where s.id=new.race_schedule_id and s.user_id=new.user_id) then
    raise exception 'SETUP_SCHEDULE_OWNER_REQUIRED' using errcode='42501';
  end if;

  if not v_base then
    if new.race_weekend_id is not null then
      select * into v_weekend from onlyfast_private.setup_weekends
        where id=new.race_weekend_id and user_id=new.user_id;
      if not found or split_part(v_weekend.event_key,'|',1)<>lower(trim(coalesce(new.race_class,''))) then raise exception 'SETUP_WEEKEND_OWNER_REQUIRED' using errcode='42501'; end if;
      if tg_op='INSERT' and v_weekend.event_key<>onlyfast_private.setup_event_key(to_jsonb(new))
        and not exists(select 1 from public.race_setups r where r.user_id=new.user_id
          and r.race_weekend_id=v_weekend.id and onlyfast_private.setup_event_key(to_jsonb(r))=onlyfast_private.setup_event_key(to_jsonb(new))) then
        raise exception 'SETUP_WEEKEND_MISMATCH' using errcode='42501';
      end if;
    else
      -- A linked/renamed row may now have another lookup key. Reuse its
      -- immutable container instead of minting fresh quota through an alias.
      select w.* into v_weekend from onlyfast_private.setup_weekends w
        where w.user_id=new.user_id and exists(select 1 from public.race_setups r
          where r.user_id=new.user_id and r.race_weekend_id=w.id
            and onlyfast_private.setup_event_key(to_jsonb(r))=onlyfast_private.setup_event_key(to_jsonb(new)))
        order by w.created_at,w.id limit 1;
      if not found then
      insert into onlyfast_private.setup_weekends(user_id,event_key)
        values(new.user_id,onlyfast_private.setup_event_key(to_jsonb(new)))
        on conflict(user_id,event_key) do nothing;
      select * into v_weekend from onlyfast_private.setup_weekends
        where user_id=new.user_id and event_key=onlyfast_private.setup_event_key(to_jsonb(new));
      end if;
      new.race_weekend_id := v_weekend.id;
    end if;
  end if;

  if v_tier='rookie' then
    if tg_op='INSERT' and not exists(select 1 from public.race_setups r where r.id=new.id and r.user_id=new.user_id) then
      if v_base then
        select count(*) into v_count from public.race_setups r where r.user_id=new.user_id
          and lower(trim(r.race_class))=lower(trim(new.race_class))
          and (r.setup_type='base_template' or coalesce(r.setup_name,'') ilike '[BASE TEMPLATE]%' or coalesce(to_jsonb(r)->>'is_template','false')='true');
        if v_count >= 1 then raise exception 'ROOKIE_BASE_SETUP_LIMIT' using errcode='42501'; end if;
      elsif not exists(select 1 from public.race_setups r where r.user_id=new.user_id
          and lower(trim(r.race_class))=lower(trim(new.race_class)) and trim(r.setup_name)=trim(new.setup_name)) then
        -- Preserve the current UI's two distinct saved-file names per active
        -- class. Immutable calendar/session identity is used for AI quotas.
        select count(distinct trim(r.setup_name)) into v_count from public.race_setups r where r.user_id=new.user_id
          and lower(trim(r.race_class))=lower(trim(new.race_class)) and r.race_weekend_id is not null;
        if v_count >= 2 then raise exception 'ROOKIE_RACE_WEEKEND_LIMIT' using errcode='42501'; end if;
      end if;
      -- Reusing a display name on another race date cannot collapse the
      -- authoritative two-weekend limit into a single client label.
      if not v_base and not exists(select 1 from public.race_setups r
        where r.user_id=new.user_id and r.race_weekend_id=new.race_weekend_id) then
        select count(distinct r.race_weekend_id) into v_count from public.race_setups r
          where r.user_id=new.user_id and lower(trim(r.race_class))=lower(trim(new.race_class))
            and r.race_weekend_id is not null;
        if v_count>=2 then raise exception 'ROOKIE_RACE_WEEKEND_LIMIT' using errcode='42501'; end if;
      end if;
    end if;
    if not v_base and v_weekend.created_at <= now()-interval '48 hours' then
      -- Existing direct annotation paths remain allowed. Mechanical setup
      -- edits and adding sessions are blocked. Deletion stays available.
      if tg_op='INSERT' or
        (to_jsonb(new)-array['updated_at','session_label','session_order','timing_data','race_schedule_id'])
        is distinct from
        (to_jsonb(old)-array['updated_at','session_label','session_order','timing_data','race_schedule_id']) then
        raise exception 'ROOKIE_SETUP_EDIT_LOCKED' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function onlyfast_private.guard_setup_limits() from public,anon,authenticated;
drop trigger if exists phase1_guard_setup_limits on public.race_setups;
create trigger phase1_guard_setup_limits before insert or update on public.race_setups
for each row execute function onlyfast_private.guard_setup_limits();

create or replace function public.list_user_setup_summaries()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'created_at', r.created_at, 'updated_at', r.updated_at,
    'setup_type', r.setup_type, 'setup_name', r.setup_name,
    'session_label', r.session_label, 'session_order', r.session_order,
    'track_name', r.track_name, 'race_date', r.race_date, 'race_class', r.race_class,
    'race_schedule_id', to_jsonb(r) -> 'race_schedule_id',
    'race_weekend_id', r.race_weekend_id
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r where r.user_id = auth.uid();
$$;


-- Requests are owned by the verified caller. Only Edge service clients can
-- reserve/finalize. A two-minute lease bounds interrupted provider calls.
-- Compatibility for old clients that send only a saved name. The label is a
-- lookup hint, never a quota key. Ambiguous names cannot select a weekend.
create or replace function public.onlyfast_resolve_assist_session(p_user_id uuid,p_saved_name text)
returns uuid language sql stable security definer set search_path='' as $$
  select case when count(distinct r.race_weekend_id)=1 then min(r.id::text)::uuid else null end
  from public.race_setups r where r.user_id=p_user_id and trim(r.setup_name)=trim(p_saved_name)
    and r.race_weekend_id is not null;
$$;
revoke all on function public.onlyfast_resolve_assist_session(uuid,text) from public,anon,authenticated;
grant execute on function public.onlyfast_resolve_assist_session(uuid,text) to service_role;

create table if not exists onlyfast_private.usage_requests(
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check(feature in ('assist','timing')),
  request_id uuid not null,
  fingerprint text not null,
  scope text not null,
  status text not null check(status in ('reserved','complete','failed')),
  token uuid not null,
  expires_at timestamptz not null,
  charged boolean not null,
  response jsonb,
  primary key(user_id,feature,request_id)
);
revoke all on onlyfast_private.usage_requests from public,anon,authenticated;
alter table onlyfast_private.usage_requests enable row level security;

create or replace function public.onlyfast_reserve_usage(
  p_user_id uuid,p_feature text,p_request_id uuid,p_fingerprint text,p_setup_id uuid default null,
  p_admin_override boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_prior onlyfast_private.usage_requests%rowtype;
  v_scope text;
  v_limit integer;
  v_used integer := 0;
  v_pending integer;
  v_token uuid := gen_random_uuid();
  v_tier text;
  v_weekend uuid;
  v_existing public.race_setups%rowtype;
begin
  if p_feature not in ('assist','timing') or p_feature is null or p_user_id is null
    or p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'USAGE_REQUEST_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_feature='assist' then
    select * into v_existing from public.race_setups where id=p_setup_id and user_id=p_user_id;
    if not found or v_existing.race_weekend_id is null
      or coalesce(v_existing.setup_type='base_template',false)
      or coalesce(v_existing.setup_name,'') ilike '[BASE TEMPLATE]%'
      or coalesce(to_jsonb(v_existing)->>'is_template','false')='true'
      or not exists(select 1 from onlyfast_private.setup_weekends w
        where w.id=v_existing.race_weekend_id and w.user_id=p_user_id) then
      raise exception 'USAGE_SETUP_OWNER_REQUIRED' using errcode='42501';
    end if;
    v_weekend := v_existing.race_weekend_id;
    v_scope := 'weekend:'||v_weekend::text;
    v_limit := 1;
    -- Retain legacy name-based consumption for every session in this weekend.
    select coalesce(max(u.used_count),0) into v_used from public.setup_assist_usage u
      where u.user_id=p_user_id and (u.race_weekend_key=v_scope or exists(
        select 1 from public.race_setups r where r.user_id=p_user_id and r.race_weekend_id=v_weekend
          and trim(r.setup_name)=u.race_weekend_key));
  else
    v_scope := to_char(now() at time zone 'UTC','YYYY-MM');
    v_limit := 2;
    select coalesce(max(used_count),0) into v_used from public.timing_scan_usage
      where user_id=p_user_id and usage_month=v_scope;
  end if;

  select * into v_prior from onlyfast_private.usage_requests
    where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
  if found then
    if v_prior.fingerprint<>p_fingerprint then return jsonb_build_object('status','conflict'); end if;
    -- A successful retry uses the stored result even after UTC month rollover.
    if v_prior.status='complete' then return jsonb_build_object('status','complete','response',v_prior.response); end if;
    if v_prior.status='reserved' and v_prior.expires_at>now() then return jsonb_build_object('status','pending'); end if;
  end if;

  v_tier := onlyfast_private.membership_tier(p_user_id);
  select count(*) into v_pending from onlyfast_private.usage_requests where user_id=p_user_id and feature=p_feature
    and scope=v_scope and status='reserved' and charged and expires_at>now();
  if v_tier='rookie' and not p_admin_override and v_used+v_pending>=v_limit then
    return jsonb_build_object('status','limit');
  end if;
  insert into onlyfast_private.usage_requests(user_id,feature,request_id,fingerprint,scope,status,token,expires_at,charged)
  values(p_user_id,p_feature,p_request_id,p_fingerprint,v_scope,'reserved',v_token,now()+interval '2 minutes',
    v_tier='rookie' and not p_admin_override)
  on conflict(user_id,feature,request_id) do update set scope=excluded.scope,status='reserved',token=excluded.token,
    expires_at=excluded.expires_at,charged=excluded.charged,response=null;
  return jsonb_build_object('status','reserved','token',v_token,'scope',v_scope);
end;
$$;

create or replace function public.onlyfast_finish_usage(
  p_user_id uuid,p_feature text,p_request_id uuid,p_token uuid,p_response jsonb default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_request onlyfast_private.usage_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_request from onlyfast_private.usage_requests where user_id=p_user_id and feature=p_feature
    and request_id=p_request_id for update;
  if not found or v_request.token<>p_token or v_request.status<>'reserved' then return false; end if;
  if p_response is null then
    update onlyfast_private.usage_requests set status='failed' where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
    return true;
  end if;
  if v_request.expires_at<=now() then return false; end if;
  if v_request.charged then
    if p_feature='assist' then
      insert into public.setup_assist_usage(user_id,race_weekend_key,used_count)
        values(p_user_id,v_request.scope,1)
        on conflict(user_id,race_weekend_key) do update set used_count=public.setup_assist_usage.used_count+1,updated_at=now();
    else
      insert into public.timing_scan_usage(user_id,usage_month,used_count)
        values(p_user_id,v_request.scope,1)
        on conflict(user_id,usage_month) do update set used_count=public.timing_scan_usage.used_count+1,updated_at=now();
    end if;
  end if;
  update onlyfast_private.usage_requests set status='complete',response=p_response
    where user_id=p_user_id and feature=p_feature and request_id=p_request_id;
  return true;
end;
$$;
revoke all on function public.onlyfast_reserve_usage(uuid,text,uuid,text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.onlyfast_finish_usage(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.onlyfast_reserve_usage(uuid,text,uuid,text,uuid,boolean) to service_role;
grant execute on function public.onlyfast_finish_usage(uuid,text,uuid,uuid,jsonb) to service_role;
-- Revoke all browser mutations, including TRUNCATE which bypasses RLS.
revoke all on public.setup_assist_usage,public.timing_scan_usage from public,anon,authenticated;
grant select on public.setup_assist_usage,public.timing_scan_usage to authenticated;
grant select,insert,update,delete on public.setup_assist_usage,public.timing_scan_usage to service_role;
alter table public.setup_assist_usage enable row level security;
alter table public.timing_scan_usage enable row level security;
notify pgrst,'reload schema';
commit;

