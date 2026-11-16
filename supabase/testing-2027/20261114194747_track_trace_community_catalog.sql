-- Phase 2C: one canonical OnlyLaps map catalog. TESTING ONLY.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end $$;

-- OnlyLaps' verified normal circuit writer uses this legacy type. Preserve all
-- owner/archive/map predicates and add only that explicit circuit alias.
do $$ declare d text; p record; begin
  d:=pg_get_functiondef('onlyfast_private.track_trace_session(uuid)'::regprocedure);
  d:=regexp_replace(d,'''practice''\s*,\s*''qualifying''\s*,\s*''race''\s*,\s*''circuit''',
    '''practice'',''qualifying'',''race'',''circuit'',''timed_laps''','g');
  if position('''timed_laps''' in d)=0 then raise exception 'CIRCUIT_TYPE_SOURCE_DRIFT'; end if;
  execute d;
  select qual,with_check into p from pg_policies where schemaname='public' and tablename='onlylaps_timing_sessions' and policyname='track_trace_circuit';
  if position('''circuit''::text' in p.qual)=0 then raise exception 'CIRCUIT_POLICY_SOURCE_DRIFT'; end if;
  execute 'alter policy track_trace_circuit on public.onlylaps_timing_sessions using ('||replace(p.qual,'''circuit''::text','''circuit''::text,''timed_laps''::text')||') with check ('||replace(p.with_check,'''circuit''::text','''circuit''::text,''timed_laps''::text')||')';
end $$;

-- Match OnlyLaps field names and values. Existing rows are NOT auto-published.
alter table public.onlylaps_track_maps
  add column publication_status text not null default 'private' check(publication_status in('private','published')),
  add column map_source text not null default 'track_scan',
  add column scan_status text not null default 'scanned' check(scan_status in('scanned','unscanned')),
  add column community_layout_key text,
  add column community_layout_name text,
  add column community_location text,
  add column community_geometry_hash text;
-- No scan, version or geometry is rewritten in this schema migration.

create table onlyfast_private.community_track_submissions (
  track_id uuid primary key references public.onlylaps_track_maps(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  status text not null check(status in('pending','published','rejected')),
  fingerprint text not null,
  layout_key text not null,
  layout_name text not null,
  location_name text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  reviewed_by text,
  replaces_track_id uuid references public.onlylaps_track_maps(id)
);
alter table onlyfast_private.community_track_submissions enable row level security;
revoke all on onlyfast_private.community_track_submissions from public,anon,authenticated;
grant select on onlyfast_private.community_track_submissions to authenticated;
grant all on onlyfast_private.community_track_submissions to service_role;
create policy own_submission_status on onlyfast_private.community_track_submissions for select to authenticated
using(submitted_by=(select auth.uid()));
create index community_submission_queue on onlyfast_private.community_track_submissions(status,submitted_at);
create unique index community_active_layout on public.onlylaps_track_maps(facility_key,community_layout_key)
where publication_status='published' and is_active and facility_key is not null and community_layout_key is not null;
create unique index community_active_geometry on public.onlylaps_track_maps(community_geometry_hash)
where publication_status='published' and is_active and community_geometry_hash is not null;
create index community_catalog_browse on public.onlylaps_track_maps(track_name,id)
where publication_status='published' and is_active;

create function onlyfast_private.community_operator()
returns boolean language sql stable security invoker set search_path='' as $$
  select current_setting('role',true) in('service_role','postgres','supabase_admin')
    or (coalesce(current_setting('role',true),'none')='none' and session_user in('postgres','supabase_admin'));
$$;
create function onlyfast_private.community_point_valid(p jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(p->'lat')='number' and jsonb_typeof(p->'lng')='number'
    and (p->>'lat')::numeric between -90 and 90 and (p->>'lng')::numeric between -180 and 180,false);
$$;
create function onlyfast_private.community_distance(a jsonb,b jsonb)
returns double precision language sql immutable set search_path='' as $$
  select 6371000*2*asin(sqrt(least(1.0,
    power(sin(radians((b->>'lat')::double precision-(a->>'lat')::double precision)/2),2)
    +cos(radians((a->>'lat')::double precision))*cos(radians((b->>'lat')::double precision))
    *power(sin(radians((b->>'lng')::double precision-(a->>'lng')::double precision)/2),2))));
$$;
create function onlyfast_private.community_scan_errors(m jsonb,sectors jsonb default '[]')
returns jsonb language plpgsql immutable set search_path='' as $$
declare errors jsonb:='[]'; path jsonb; label text; p jsonb; s jsonb; line jsonb; unique_points integer;
begin
  if coalesce(btrim(m->>'track_name'),'')='' then errors:=errors||'"Track name is required"'::jsonb; end if;
  if coalesce(m->>'track_type','') not in('dirt_oval','pavement_oval','road_course')
    or coalesce((m->>'is_open_route')::boolean,true)
    or coalesce(m->>'source','')<>'track_scan' or coalesce(m->>'map_source','track_scan')<>'track_scan'
    or coalesce(m->>'scan_status','scanned')<>'scanned' then errors:=errors||'"A scanned circuit is required; routes and generated maps are excluded"'::jsonb; end if;
  if not onlyfast_private.community_point_valid(jsonb_build_object('lat',m->'center_lat','lng',m->'center_lng'))
    or coalesce(btrim(m->>'area_key'),'')='' then errors:=errors||'"Valid circuit location metadata is required"'::jsonb; end if;
  foreach label in array array['outside_path','inside_path','start_finish_path'] loop
    path:=m->label;
    if jsonb_typeof(path) is distinct from 'array' then errors:=errors||to_jsonb(label||' must be an array'); continue; end if;
    if jsonb_array_length(path)>10000 then errors:=errors||to_jsonb(label||' exceeds the review size limit'); continue; end if;
    if exists(select 1 from jsonb_array_elements(path) x where not onlyfast_private.community_point_valid(x)) then
      errors:=errors||to_jsonb(label||' contains invalid GPS coordinates'); continue;
    end if;
    select count(distinct jsonb_build_array(x->'lat',x->'lng')) into unique_points from jsonb_array_elements(path) x;
    if unique_points<(case when label='start_finish_path' then 2 else 3 end) then errors:=errors||to_jsonb(label||' has too few distinct points'); continue; end if;
    if label<>'start_finish_path' and onlyfast_private.community_distance(path->0,path->(jsonb_array_length(path)-1))>50 then
      errors:=errors||to_jsonb(label||' is not a closed circuit boundary (ends more than 50 m apart)');
    end if;
    if label<>'start_finish_path' and (select abs(sum((x.p->>'lng')::numeric*(path->((x.n::integer)%jsonb_array_length(path))->>'lat')::numeric
      -(path->((x.n::integer)%jsonb_array_length(path))->>'lng')::numeric*(x.p->>'lat')::numeric))/2 from jsonb_array_elements(path) with ordinality x(p,n))<0.0000000001 then
      errors:=errors||to_jsonb(label||' has no usable enclosed circuit area');
    end if;
    if exists(select 1 from jsonb_array_elements(path) x where onlyfast_private.community_distance(x,jsonb_build_object('lat',m->'center_lat','lng',m->'center_lng'))>25000) then
      errors:=errors||to_jsonb(label||' is inconsistent with the circuit location');
    end if;
  end loop;
  if jsonb_typeof(sectors) is distinct from 'array' then errors:=errors||'"Invalid sector definitions"'::jsonb;
  else for s in select * from jsonb_array_elements(sectors) loop
    if coalesce((s->>'sector_count')::integer,0) not between 1 and 5 or jsonb_typeof(s->'lines') is distinct from 'array' then
      errors:=errors||'"Invalid sector count or lines"'::jsonb; continue;
    end if;
    if jsonb_array_length(s->'lines')<>(s->>'sector_count')::integer-1 then errors:=errors||'"Sector lines do not match the sector count"'::jsonb; end if;
    for line in select * from jsonb_array_elements(s->'lines') loop
      -- OnlyLaps sector lines use start/end; retain compatible a/b legacy lines.
      if not onlyfast_private.community_point_valid(coalesce(line->'start',line->'a')) or not onlyfast_private.community_point_valid(coalesce(line->'end',line->'b')) then errors:=errors||'"Invalid sector line coordinates"'::jsonb; end if;
    end loop;
  end loop; end if;
  return errors;
exception when invalid_text_representation or numeric_value_out_of_range then return '["Invalid coordinate or sector metadata"]'::jsonb;
end $$;

create function onlyfast_private.community_shared_map_read(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.onlylaps_track_maps m
    where m.id=p_id and m.publication_status='published' and not m.is_open_route
      and m.track_type in('dirt_oval','pavement_oval','road_course') and m.source='track_scan' and m.map_source='track_scan' and m.scan_status='scanned'
      and (onlyfast_private.track_trace_enabled() or exists(select 1 from public.onlylaps_timing_sessions s where s.user_id=auth.uid() and s.track_map_id=m.id)));
$$;
create function onlyfast_private.community_map_selectable(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and onlyfast_private.track_trace_enabled() and exists(select 1 from public.onlylaps_track_maps m where m.id=p_id
    and not m.is_open_route and coalesce(lower(m.track_type),'') not in('gumball','public_road','open_route')
    and coalesce(m.source,'')<>'gumball' and m.map_source<>'gumball'
    and (m.user_id=auth.uid() or (m.is_active and m.publication_status='published' and m.map_source='track_scan' and m.source='track_scan' and m.scan_status='scanned')));
$$;

drop policy "OnlyLaps track maps are readable when active or owned" on public.onlylaps_track_maps;
create policy "OnlyLaps track maps are readable when published or owned" on public.onlylaps_track_maps for select to authenticated
using (user_id=(select auth.uid()) or created_by=(select auth.uid()) or onlyfast_private.community_shared_map_read(id));
-- The installed history layer adds restrictive owner SELECT policies. Retain
-- every write restriction and widen ONLY map/default-sector reads for sharing.
do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='onlylaps_track_maps' and policyname='track_trace_history') then
    alter policy track_trace_history on public.onlylaps_track_maps using(user_id=(select auth.uid()) or onlyfast_private.community_shared_map_read(id));
    alter policy track_trace_history on public.onlylaps_track_sector_defaults using(owner_id=(select auth.uid()) or onlyfast_private.community_shared_map_read(track_id));
  end if;
end $$;
alter policy "Users can create their OnlyLaps timing sessions" on public.onlylaps_timing_sessions
with check(user_id=(select auth.uid()) and (track_map_id is null or onlyfast_private.community_map_selectable(track_map_id)));
alter policy "Users can update their OnlyLaps timing sessions" on public.onlylaps_timing_sessions
with check(user_id=(select auth.uid()) and (track_map_id is null or exists(select 1 from public.onlylaps_track_maps m where m.id=track_map_id and m.user_id=(select auth.uid())) or onlyfast_private.community_shared_map_read(track_map_id)));
do $$ declare d text; begin
  if to_regprocedure('onlyfast_private.track_trace_circuit_map(uuid)') is not null then
    d:=pg_get_functiondef('onlyfast_private.track_trace_circuit_map(uuid)'::regprocedure);
    if position('t.user_id=auth.uid() or exists' in d)=0 then raise exception 'CIRCUIT_MAP_SOURCE_DRIFT'; end if;
    execute replace(d,'t.user_id=auth.uid() or exists','t.user_id=auth.uid() or onlyfast_private.community_shared_map_read(t.id) or exists');
  end if;
end $$;

create function onlyfast_private.community_map_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not onlyfast_private.community_operator() then
    if TG_OP<>'INSERT' and old.publication_status='published' then raise exception 'PUBLISHED_TRACK_READ_ONLY' using errcode='42501'; end if;
    if TG_OP<>'DELETE' then
      if new.publication_status<>'private' or new.community_layout_key is not null or new.community_layout_name is not null or new.community_location is not null or new.community_geometry_hash is not null then
        raise exception 'CONTROLLED_PUBLICATION_REQUIRED' using errcode='42501';
      end if;
      if TG_OP='UPDATE' and (new.user_id is distinct from old.user_id or new.created_by is distinct from old.created_by) then raise exception 'TRACK_OWNER_IMMUTABLE' using errcode='42501'; end if;
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger aa_community_map_guard before insert or update or delete on public.onlylaps_track_maps for each row execute function onlyfast_private.community_map_guard();
create function onlyfast_private.community_default_sector_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not onlyfast_private.community_operator() and exists(select 1 from public.onlylaps_track_maps m where m.publication_status='published'
    and (m.id=case when TG_OP='INSERT' then null else old.track_id end or m.id=case when TG_OP='DELETE' then null else new.track_id end)) then
    raise exception 'PUBLISHED_TRACK_READ_ONLY' using errcode='42501';
  end if;
  if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger aa_community_default_guard before insert or update or delete on public.onlylaps_track_sector_defaults for each row execute function onlyfast_private.community_default_sector_guard();
create function onlyfast_private.community_session_map_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.session_type='timed_laps' and coalesce(to_jsonb(new)->>'session_mode','normal')<>'normal' then raise exception 'CIRCUIT_MODE_REQUIRED' using errcode='42501'; end if;
  if TG_OP='UPDATE' and new.track_map_id is distinct from old.track_map_id and new.track_map_id is not null and not onlyfast_private.community_operator()
    and not onlyfast_private.community_map_selectable(new.track_map_id) then raise exception 'TRACK_NOT_SELECTABLE' using errcode='42501'; end if;
  return new;
end $$;
create trigger ac_community_session_map_guard before insert or update on public.onlylaps_timing_sessions for each row execute function onlyfast_private.community_session_map_guard();

-- Publication is catalog metadata, not a geometry edit. Preserve scan versions
-- when publishing/retiring; keep the existing revision protection for edits.
create or replace function public.onlylaps_track_revision_on_update()
returns trigger language plpgsql set search_path='' as $$
begin
  if onlyfast_private.community_operator() and (to_jsonb(new)-array['updated_at','publication_status','community_layout_key','community_layout_name','community_location','community_geometry_hash','is_active'])
    = (to_jsonb(old)-array['updated_at','publication_status','community_layout_key','community_layout_name','community_location','community_geometry_hash','is_active']) then return new; end if;
  if (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
    new.version:=case when onlyfast_private.community_operator() then greatest(coalesce(old.version,1)+1,new.version) else coalesce(old.version,1)+1 end;
  end if;
  return new;
end $$;
-- Personal sector choices must never mutate the canonical published scan.
do $$ declare d text; begin
  d:=pg_get_functiondef('public.onlylaps_sector_track_revision()'::regprocedure);
  if position('begin' in d)=0 then raise exception 'SECTOR_REVISION_SOURCE_DRIFT'; end if;
  d:=replace(d,'begin',E'begin\n  if TG_TABLE_NAME = ''onlylaps_user_track_sectors'' and exists(select 1 from public.onlylaps_track_maps m where m.publication_status=''published'' and m.id=case when TG_OP=''DELETE'' then old.track_id else new.track_id end) then return null; end if;');
  execute d;
end $$;

create function onlyfast_private.community_fingerprint(p_track_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare m public.onlylaps_track_maps%rowtype; sectors jsonb;
begin
  select * into m from public.onlylaps_track_maps where id=p_track_id;
  if not found or (not onlyfast_private.community_operator() and (auth.uid() is null or m.user_id<>auth.uid())) then raise exception 'TRACK_NOT_FOUND' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(s)-'updated_at' order by s.id),'[]') into sectors from public.onlylaps_track_sector_defaults s where s.track_id=m.id;
  return encode(sha256(convert_to(jsonb_build_object('map',to_jsonb(m)-'updated_at','sectors',sectors)::text,'UTF8')),'hex');
end $$;
-- Ignore capture timestamps/accuracy and generated line IDs when checking
-- exact geometry duplicates. Stored source geometry itself is never normalized.
create function onlyfast_private.community_geometry_fingerprint(m jsonb,sectors jsonb)
returns text language sql immutable set search_path='' as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'outside',(select jsonb_agg(jsonb_build_array(p->'lat',p->'lng') order by n) from jsonb_array_elements(m->'outside_path') with ordinality x(p,n)),
    'inside',(select jsonb_agg(jsonb_build_array(p->'lat',p->'lng') order by n) from jsonb_array_elements(m->'inside_path') with ordinality x(p,n)),
    'start_finish',(select jsonb_agg(jsonb_build_array(p->'lat',p->'lng') order by n) from jsonb_array_elements(m->'start_finish_path') with ordinality x(p,n)),
    'direction',m->'direction',
    'sectors',(select coalesce(jsonb_agg(jsonb_build_object('sector_count',s->'sector_count','lines',
      (select jsonb_agg(jsonb_build_object('start',jsonb_build_array(coalesce(l->'start',l->'a')->'lat',coalesce(l->'start',l->'a')->'lng'),
        'end',jsonb_build_array(coalesce(l->'end',l->'b')->'lat',coalesce(l->'end',l->'b')->'lng'),
        'progress',l->'progress','sectorIndex',l->'sectorIndex','expectedDirection',l->'expectedDirection') order by n)
        from jsonb_array_elements(s->'lines') with ordinality x(l,n))) order by s->>'sector_count'),'[]'::jsonb) from jsonb_array_elements(sectors) s)
    )::text,'UTF8')),'hex');
$$;
create function onlyfast_private.community_duplicates(p_track_id uuid,p_layout_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.onlylaps_track_maps%rowtype; result jsonb;
begin
  if not onlyfast_private.community_operator() then perform onlyfast_private.require_track_trace(); end if;
  select * into m from public.onlylaps_track_maps where id=p_track_id;
  if not found or (not onlyfast_private.community_operator() and m.user_id<>auth.uid()) then raise exception 'TRACK_NOT_FOUND' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into result from (
    select x.id,x.track_name,x.community_layout_key,x.community_layout_name,x.community_location,x.version,
      round(onlyfast_private.community_distance(jsonb_build_object('lat',m.center_lat,'lng',m.center_lng),jsonb_build_object('lat',x.center_lat,'lng',x.center_lng))) distance_m,
      (x.facility_key=m.facility_key and x.community_layout_key=p_layout_key) same_layout
    from public.onlylaps_track_maps x where x.id<>m.id and x.publication_status='published' and x.is_active and not x.is_open_route and x.map_source='track_scan'
      and (x.facility_key=m.facility_key or lower(x.track_name)=lower(m.track_name)
        or onlyfast_private.community_distance(jsonb_build_object('lat',m.center_lat,'lng',m.center_lng),jsonb_build_object('lat',x.center_lat,'lng',x.center_lng))<=750)
  ) c;
  return result;
end $$;
create function public.find_track_trace_duplicates(p_track_id uuid,p_layout_key text)
returns jsonb language sql stable security invoker set search_path='' as $$ select onlyfast_private.community_duplicates(p_track_id,p_layout_key); $$;

create function onlyfast_private.community_submit(p_track_id uuid,p_layout_key text,p_layout_name text,p_location text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.onlylaps_track_maps%rowtype; errors jsonb; sectors jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  perform onlyfast_private.require_track_trace();
  if p_layout_key is null or p_layout_key !~ '^[a-z0-9][a-z0-9-]{0,63}$' or length(btrim(coalesce(p_layout_name,''))) not between 2 and 80
    or length(btrim(coalesce(p_location,''))) not between 3 and 120 or (p_layout_name||p_location) ~ '[[:cntrl:]<>]' then raise exception 'LAYOUT_AND_LOCATION_REQUIRED'; end if;
  select * into m from public.onlylaps_track_maps where id=p_track_id and user_id=auth.uid() for update;
  if not found then raise exception 'TRACK_NOT_FOUND' using errcode='42501'; end if;
  if m.publication_status='published' then raise exception 'ALREADY_PUBLISHED'; end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into sectors from public.onlylaps_track_sector_defaults s where s.track_id=m.id;
  errors:=onlyfast_private.community_scan_errors(to_jsonb(m),sectors);
  if errors<>'[]' then return jsonb_build_object('status','invalid','errors',errors); end if;
  if coalesce(btrim(m.facility_key),'')='' then return jsonb_build_object('status','invalid','errors','["Saved scan facility identity is required before submission"]'::jsonb); end if;
  insert into onlyfast_private.community_track_submissions(track_id,submitted_by,status,fingerprint,layout_key,layout_name,location_name)
    values(m.id,auth.uid(),'pending',onlyfast_private.community_fingerprint(m.id),p_layout_key,btrim(p_layout_name),btrim(p_location))
    on conflict(track_id) do update set status='pending',fingerprint=excluded.fingerprint,layout_key=excluded.layout_key,layout_name=excluded.layout_name,
      location_name=excluded.location_name,submitted_at=now(),reviewed_at=null,review_note=null,reviewed_by=null,replaces_track_id=null;
  return jsonb_build_object('status','pending','duplicates',onlyfast_private.community_duplicates(m.id,p_layout_key));
end $$;
create function public.submit_track_trace_scan(p_track_id uuid,p_layout_key text,p_layout_name text,p_location text)
returns jsonb language sql security invoker set search_path='' as $$ select onlyfast_private.community_submit(p_track_id,p_layout_key,p_layout_name,p_location); $$;

-- Server/operator-only moderation. No browser role can call this function or
-- write the review queue. Existing maps are published in place, never cloned.
create function public.review_track_trace_scan(p_track_id uuid,p_fingerprint text,p_approve boolean,p_note text default '',p_replace_id uuid default null,p_acknowledged_duplicates uuid[] default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q onlyfast_private.community_track_submissions%rowtype; m public.onlylaps_track_maps%rowtype; previous public.onlylaps_track_maps%rowtype;
  errors jsonb; sectors jsonb; duplicates jsonb; expected_ids uuid[]; supplied_ids uuid[]; geometry_hash text;
begin
  if not onlyfast_private.community_operator() then raise exception 'REVIEWER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('onlylaps:community-publication',0));
  select * into m from public.onlylaps_track_maps where id=p_track_id for update;
  select * into q from onlyfast_private.community_track_submissions where track_id=p_track_id for update;
  if not found or q.fingerprint is distinct from p_fingerprint then raise exception 'SUBMISSION_CHANGED'; end if;
  if q.status='published' and p_approve and m.publication_status='published' then return jsonb_build_object('status','published','track_id',m.id); end if;
  if q.status<>'pending' or m.publication_status<>'private' then raise exception 'SUBMISSION_NOT_PENDING'; end if;
  if not coalesce(p_approve,false) then
    if length(btrim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'REVIEW_REASON_REQUIRED'; end if;
    update onlyfast_private.community_track_submissions set status='rejected',review_note=p_note,reviewed_at=now(),reviewed_by=current_user where track_id=m.id;
    return jsonb_build_object('status','rejected');
  end if;
  if onlyfast_private.community_fingerprint(m.id) is distinct from q.fingerprint then raise exception 'SCAN_CHANGED_RESUBMIT_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into sectors from public.onlylaps_track_sector_defaults s where s.track_id=m.id;
  errors:=onlyfast_private.community_scan_errors(to_jsonb(m),sectors);
  if errors<>'[]' then raise exception 'INVALID_CIRCUIT_GEOMETRY: %',errors; end if;
  duplicates:=onlyfast_private.community_duplicates(m.id,q.layout_key);
  select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}') into expected_ids from jsonb_array_elements(duplicates) x;
  select coalesce(array_agg(distinct x order by x),'{}') into supplied_ids from unnest(p_acknowledged_duplicates) x;
  if expected_ids is distinct from supplied_ids then raise exception 'DUPLICATE_REVIEW_REQUIRED'; end if;
  if p_replace_id is not null then
    select * into previous from public.onlylaps_track_maps where id=p_replace_id and publication_status='published' and is_active for update;
    if not found or previous.facility_key is distinct from m.facility_key or previous.community_layout_key is distinct from q.layout_key then raise exception 'INVALID_REPLACEMENT_LAYOUT'; end if;
  end if;
  if exists(select 1 from public.onlylaps_track_maps x where x.id<>m.id and x.is_active and x.publication_status='published'
      and x.facility_key=m.facility_key and x.community_layout_key=q.layout_key and x.id is distinct from p_replace_id) then raise exception 'DUPLICATE_PUBLISHED_LAYOUT'; end if;
  geometry_hash:=onlyfast_private.community_geometry_fingerprint(to_jsonb(m),sectors);
  if exists(select 1 from public.onlylaps_track_maps x where x.id<>m.id and x.is_active and x.publication_status='published' and x.community_geometry_hash=geometry_hash and x.id is distinct from p_replace_id) then raise exception 'DUPLICATE_PUBLISHED_GEOMETRY'; end if;
  if p_replace_id is not null then update public.onlylaps_track_maps set is_active=false where id=p_replace_id; end if;
  update public.onlylaps_track_maps set publication_status='published',community_layout_key=q.layout_key,community_layout_name=q.layout_name,
    community_location=q.location_name,community_geometry_hash=geometry_hash,is_active=true,
    supersedes_track_map_id=coalesce(p_replace_id,supersedes_track_map_id),version=case when p_replace_id is null then version else greatest(version,previous.version+1) end where id=m.id;
  update onlyfast_private.community_track_submissions set status='published',review_note=left(p_note,1000),reviewed_at=now(),reviewed_by=current_user,replaces_track_id=p_replace_id where track_id=m.id;
  return jsonb_build_object('status','published','track_id',m.id,'replaces_track_id',p_replace_id);
end $$;

create function public.search_track_trace_tracks(p_search text default '',p_offset integer default 0,p_scope text default 'available')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  perform onlyfast_private.require_track_trace();
  if p_offset is null or p_offset<0 or p_offset>100000 or length(coalesce(p_search,''))>100 or p_scope not in('available','community','mine') then raise exception 'INVALID_CATALOG_QUERY'; end if;
  return coalesce((select jsonb_agg(t.data order by t.track_name,t.id) from (
    select m.id,m.track_name,to_jsonb(m)||jsonb_build_object('can_select',onlyfast_private.community_map_selectable(m.id),'is_owner',m.user_id=auth.uid(),
      'sector_defaults',coalesce((select jsonb_agg(jsonb_build_object('version',s.version,'sector_count',s.sector_count,'lines',s.lines)) from public.onlylaps_track_sector_defaults s where s.track_id=m.id),'[]'::jsonb),
      'user_sectors',coalesce((select jsonb_agg(jsonb_build_object('version',s.version,'sector_count',s.sector_count,'lines',s.lines)) from public.onlylaps_user_track_sectors s where s.track_id=m.id and s.user_id=auth.uid()),'[]'::jsonb),
      'submission',(select jsonb_build_object('status',q.status,'review_note',q.review_note) from onlyfast_private.community_track_submissions q where q.track_id=m.id and q.submitted_by=auth.uid())) data
    from public.onlylaps_track_maps m where m.is_active and not m.is_open_route and coalesce(lower(m.track_type),'') not in('gumball','public_road','open_route')
      and coalesce(m.source,'')<>'gumball' and m.map_source<>'gumball'
      and (m.user_id=auth.uid() or m.publication_status='published')
      and (p_scope='available' or (p_scope='mine' and m.user_id=auth.uid()) or (p_scope='community' and m.publication_status='published'))
      and position(lower(btrim(coalesce(p_search,''))) in lower(concat_ws(' ',m.track_name,m.facility_name,m.area_key,m.community_location,m.community_layout_name)))>0
    order by m.track_name,m.id limit 50 offset p_offset
  ) t),'[]'::jsonb);
end $$;
create or replace function public.list_track_trace_tracks(p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$ select public.search_track_trace_tracks('',p_offset,'available'); $$;

-- Explicit ACLs: no PUBLIC/anonymous execution, no browser moderation.
do $$ declare r record; begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='onlyfast_private' and p.proname like 'community_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
end $$;
grant execute on function onlyfast_private.community_operator(),onlyfast_private.community_point_valid(jsonb),onlyfast_private.community_distance(jsonb,jsonb),onlyfast_private.community_scan_errors(jsonb,jsonb),onlyfast_private.community_shared_map_read(uuid),onlyfast_private.community_map_selectable(uuid),onlyfast_private.community_duplicates(uuid,text),onlyfast_private.community_submit(uuid,text,text,text) to authenticated;
revoke all on function public.search_track_trace_tracks(text,integer,text),public.find_track_trace_duplicates(uuid,text),public.submit_track_trace_scan(uuid,text,text,text),public.review_track_trace_scan(uuid,text,boolean,text,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.search_track_trace_tracks(text,integer,text),public.find_track_trace_duplicates(uuid,text),public.submit_track_trace_scan(uuid,text,text,text) to authenticated;
grant execute on function public.review_track_trace_scan(uuid,text,boolean,text,uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
commit;
