-- Give every scheduled race setup a durable association to its race_schedule row.
-- Legacy rows are backfilled only when one schedule entry and one coherent
-- setup group match, with at most one row for each stable session slot.

begin;

alter table public.race_setups
  add column if not exists race_schedule_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'race_setups_race_schedule_id_fkey'
      and conrelid = 'public.race_setups'::regclass
  ) then
    alter table public.race_setups
      add constraint race_setups_race_schedule_id_fkey
      foreign key (race_schedule_id)
      references public.race_schedule(id)
      on delete set null;
  end if;
end $$;

with unique_schedule_rows as (
  select
    min(id::text)::uuid as id,
    user_id,
    race_date,
    lower(trim(coalesce(track, ''))) as track_key
  from public.race_schedule
  group by user_id, race_date, lower(trim(coalesce(track, '')))
  having count(*) = 1
), candidates as (
  select
    s.id as race_schedule_id,
    r.id as race_setup_id,
    r.setup_type,
    coalesce(nullif(lower(trim(r.setup_name)), ''), '__unnamed__') as setup_group
  from unique_schedule_rows s
  join public.race_setups r
    on r.user_id = s.user_id
   and r.race_date = s.race_date
   and lower(trim(coalesce(r.track_name, ''))) = s.track_key
  where r.race_schedule_id is null
    and r.setup_type in ('base', 'heat', 'main', 'extra1', 'extra2', 'extra3')
    and upper(trim(coalesce(r.setup_name, ''))) not like '[BASE TEMPLATE]%'
), eligible_schedule_rows as (
  select race_schedule_id
  from candidates
  group by race_schedule_id
  having count(distinct setup_group) = 1
     and count(*) = count(distinct setup_type)
)
update public.race_setups r
set race_schedule_id = c.race_schedule_id
from candidates c
join eligible_schedule_rows eligible
  on eligible.race_schedule_id = c.race_schedule_id
where r.id = c.race_setup_id;

create index if not exists race_setups_user_schedule_idx
  on public.race_setups (user_id, race_schedule_id)
  where race_schedule_id is not null;

create unique index if not exists race_setups_schedule_session_uidx
  on public.race_setups (user_id, race_schedule_id, setup_type)
  where race_schedule_id is not null;

comment on column public.race_setups.race_schedule_id is
  'Immutable association from an OnlyFast race-session row to its scheduled race weekend.';

create or replace function public.list_user_setup_summaries()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'setup_type', r.setup_type,
    'setup_name', r.setup_name,
    'session_label', r.session_label,
    'session_order', r.session_order,
    'track_name', r.track_name,
    'race_date', r.race_date,
    'race_class', r.race_class,
    'race_schedule_id', r.race_schedule_id
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r
  where r.user_id = auth.uid();
$$;

revoke all on function public.list_user_setup_summaries() from public;
grant execute on function public.list_user_setup_summaries() to authenticated;

notify pgrst, 'reload schema';

commit;
