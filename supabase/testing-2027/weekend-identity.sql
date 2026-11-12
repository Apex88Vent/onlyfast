-- Testing-only supplement. Applied by the isolated bootstrap, never root migrations.
create table onlyfast_private.setup_weekend_aliases (
  user_id uuid not null references auth.users(id) on delete cascade,
  alias text not null,
  weekend_id uuid not null references onlyfast_private.setup_weekends(id),
  primary key(user_id,alias)
);
alter table onlyfast_private.setup_weekend_aliases enable row level security;
revoke all on onlyfast_private.setup_weekend_aliases from public,anon,authenticated;

create function onlyfast_private.setup_2027_alias_keys(p_row jsonb)
returns text[] language sql immutable set search_path='' as $$
  select array_remove(array[
    case when nullif(p_row->>'race_schedule_id','') is not null
      then 'schedule|'||(p_row->>'race_schedule_id') end,
    case when nullif(trim(p_row->>'track_name'),'') is not null and nullif(p_row->>'race_date','') is not null
      then 'event|'||lower(trim(p_row->>'race_class'))||'|'||lower(trim(p_row->>'track_name'))||'|'||(p_row->>'race_date')
      else 'name|'||lower(trim(p_row->>'race_class'))||'|'||lower(trim(p_row->>'setup_name')) end
  ],null);
$$;
revoke all on function onlyfast_private.setup_2027_alias_keys(jsonb) from public,anon,authenticated;

create table onlyfast_private.timing_weekend_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekend_id uuid not null references onlyfast_private.setup_weekends(id),
  used_count integer not null default 0 check(used_count>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,weekend_id)
);
alter table onlyfast_private.timing_weekend_usage enable row level security;
revoke all on onlyfast_private.timing_weekend_usage from public,anon,authenticated;
