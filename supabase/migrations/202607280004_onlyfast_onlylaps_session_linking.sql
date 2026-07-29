-- Session-linking enforcement for the beta OnlyFast <-> OnlyLaps picker.
--
-- This migration is intentionally non-destructive. It aborts with the
-- conflicting session IDs if duplicate links exist; it never chooses or
-- deletes a winner.

begin;

-- Prevent link writes between the conflict audit and index creation.
lock table public.onlyfast_onlylaps_session_links
  in share row exclusive mode;

do $$
declare
  conflicts jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'onlyfast_session_id', duplicate.onlyfast_session_id,
      'link_count', duplicate.link_count,
      'link_ids', duplicate.link_ids
    )
  )
  into conflicts
  from (
    select
      onlyfast_session_id,
      count(*) as link_count,
      jsonb_agg(id order by created_at, id) as link_ids
    from public.onlyfast_onlylaps_session_links
    group by onlyfast_session_id
    having count(*) > 1
  ) as duplicate;

  if conflicts is not null then
    raise exception using
      errcode = '23505',
      message =
        'Cannot enforce one OnlyLaps session per OnlyFast session: duplicate OnlyFast links exist.',
      detail = conflicts::text,
      hint =
        'Review the reported link IDs manually. This migration did not delete or change any row.';
  end if;
end;
$$;

do $$
declare
  conflicts jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'onlylaps_session_id', duplicate.onlylaps_session_id,
      'link_count', duplicate.link_count,
      'link_ids', duplicate.link_ids
    )
  )
  into conflicts
  from (
    select
      onlylaps_session_id,
      count(*) as link_count,
      jsonb_agg(id order by created_at, id) as link_ids
    from public.onlyfast_onlylaps_session_links
    group by onlylaps_session_id
    having count(*) > 1
  ) as duplicate;

  if conflicts is not null then
    raise exception using
      errcode = '23505',
      message =
        'Cannot enforce one OnlyFast session per OnlyLaps session: duplicate OnlyLaps links exist.',
      detail = conflicts::text,
      hint =
        'Review the reported link IDs manually. This migration did not delete or change any row.';
  end if;
end;
$$;

-- Preserve the existing duplicate-pair constraint while strengthening the
-- relationship to one-to-one.
create unique index if not exists
  onlyfast_onlylaps_links_onlyfast_session_uidx
  on public.onlyfast_onlylaps_session_links (onlyfast_session_id);

create unique index if not exists
  onlyfast_onlylaps_links_onlylaps_session_uidx
  on public.onlyfast_onlylaps_session_links (onlylaps_session_id);

comment on index public.onlyfast_onlylaps_links_onlyfast_session_uidx is
  'At most one OnlyLaps timing session may be linked to an individual OnlyFast race_setups row.';

comment on index public.onlyfast_onlylaps_links_onlylaps_session_uidx is
  'An OnlyLaps timing session may be linked to at most one individual OnlyFast race_setups row.';

-- Browser clients may read their owner-scoped link through RLS, but all
-- mutations must pass through the beta-gated Edge Function below.
revoke insert, update, delete
  on table public.onlyfast_onlylaps_session_links
  from authenticated;
grant select
  on table public.onlyfast_onlylaps_session_links
  to authenticated;

-- Atomic LINK / CHANGE operation. The Edge Function is the only caller and
-- passes the user ID obtained from a verified JWT. Composite foreign keys and
-- the new unique indexes remain the final database-level safety net.
create or replace function public.onlyfast_set_onlylaps_session_link(
  p_user_id uuid,
  p_onlyfast_session_id uuid,
  p_onlylaps_session_id uuid,
  p_link_method text default 'manual',
  p_match_confidence numeric default null
)
returns public.onlyfast_onlylaps_session_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.onlyfast_onlylaps_session_links;
begin
  if not exists (
    select 1
    from public.race_setups
    where id = p_onlyfast_session_id
      and user_id = p_user_id
  ) then
    raise exception 'OnlyFast session not found'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.onlylaps_timing_sessions
    where id = p_onlylaps_session_id
      and user_id = p_user_id
  ) then
    raise exception 'OnlyLaps session not found'
      using errcode = '42501';
  end if;

  insert into public.onlyfast_onlylaps_session_links (
    user_id,
    onlyfast_session_id,
    onlylaps_session_id,
    link_method,
    match_confidence
  )
  values (
    p_user_id,
    p_onlyfast_session_id,
    p_onlylaps_session_id,
    coalesce(nullif(btrim(p_link_method), ''), 'manual'),
    p_match_confidence
  )
  on conflict (onlyfast_session_id) do update
    set onlylaps_session_id = excluded.onlylaps_session_id,
        link_method = excluded.link_method,
        match_confidence = excluded.match_confidence,
        updated_at = now()
    where public.onlyfast_onlylaps_session_links.user_id = excluded.user_id
  returning * into result;

  if result.id is null then
    raise exception 'OnlyFast session link ownership mismatch'
      using errcode = '42501';
  end if;

  return result;
end;
$$;

-- UNLINK removes only the association. Cascades are not involved because
-- neither parent row is deleted.
create or replace function public.onlyfast_unlink_onlylaps_session(
  p_user_id uuid,
  p_onlyfast_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if not exists (
    select 1
    from public.race_setups
    where id = p_onlyfast_session_id
      and user_id = p_user_id
  ) then
    raise exception 'OnlyFast session not found'
      using errcode = '42501';
  end if;

  delete from public.onlyfast_onlylaps_session_links
  where user_id = p_user_id
    and onlyfast_session_id = p_onlyfast_session_id;

  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

-- Picker-only aggregate. It returns one compact row per timing session and
-- never reads or returns raw telemetry samples.
create or replace function public.onlyfast_onlylaps_candidate_lap_summaries(
  p_user_id uuid,
  p_session_ids uuid[]
)
returns table (
  timing_session_id uuid,
  lap_count bigint,
  valid_lap_count bigint,
  fastest_valid_lap_ms integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    laps.timing_session_id,
    count(*) as lap_count,
    count(*) filter (where laps.is_valid = true) as valid_lap_count,
    min(laps.duration_ms) filter (
      where laps.is_valid = true
    ) as fastest_valid_lap_ms
  from public.onlylaps_lap_times as laps
  where laps.user_id = p_user_id
    and laps.timing_session_id = any(
      coalesce(p_session_ids, array[]::uuid[])
    )
  group by laps.timing_session_id;
$$;

revoke all
  on function public.onlyfast_set_onlylaps_session_link(
    uuid, uuid, uuid, text, numeric
  )
  from public, anon, authenticated;
revoke all
  on function public.onlyfast_unlink_onlylaps_session(uuid, uuid)
  from public, anon, authenticated;
revoke all
  on function public.onlyfast_onlylaps_candidate_lap_summaries(
    uuid, uuid[]
  )
  from public, anon, authenticated;

grant execute
  on function public.onlyfast_set_onlylaps_session_link(
    uuid, uuid, uuid, text, numeric
  )
  to service_role;
grant execute
  on function public.onlyfast_unlink_onlylaps_session(uuid, uuid)
  to service_role;
grant execute
  on function public.onlyfast_onlylaps_candidate_lap_summaries(
    uuid, uuid[]
  )
  to service_role;

commit;
