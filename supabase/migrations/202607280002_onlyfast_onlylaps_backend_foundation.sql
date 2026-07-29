-- Backend-only foundation for linking OnlyFast setup/session rows to OnlyLaps
-- timing sessions and retaining versioned, structured OnlyLaps analysis.
--
-- This migration is intentionally additive. It does not alter OnlyFast UI or
-- Setup Assist behavior and does not touch OnlyLaps public telemetry sharing.

create extension if not exists pgcrypto;

-- These redundant unique indexes let the foreign keys below enforce that the
-- relationship row and both of its parents always have the same owner. That
-- invariant remains in force even for writes that bypass RLS.
create unique index if not exists race_setups_id_user_id_uidx
  on public.race_setups (id, user_id);

create unique index if not exists onlylaps_timing_sessions_id_user_id_uidx
  on public.onlylaps_timing_sessions (id, user_id);

create or replace function public.onlyfast_onlylaps_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.onlyfast_onlylaps_session_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  onlyfast_session_id uuid not null,
  onlylaps_session_id uuid not null,
  link_method text not null default 'manual',
  match_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint onlyfast_onlylaps_links_onlyfast_owner_fk
    foreign key (onlyfast_session_id, user_id)
    references public.race_setups (id, user_id)
    on delete cascade,

  constraint onlyfast_onlylaps_links_onlylaps_owner_fk
    foreign key (onlylaps_session_id, user_id)
    references public.onlylaps_timing_sessions (id, user_id)
    on delete cascade,

  constraint onlyfast_onlylaps_links_pair_unique
    unique (onlyfast_session_id, onlylaps_session_id),

  constraint onlyfast_onlylaps_links_method_nonempty
    check (length(btrim(link_method)) > 0),

  constraint onlyfast_onlylaps_links_confidence_range
    check (
      match_confidence is null
      or (match_confidence >= 0 and match_confidence <= 1)
    )
);

comment on table public.onlyfast_onlylaps_session_links is
  'Private owner-scoped links from OnlyFast race_setups session rows to OnlyLaps timing sessions.';
comment on column public.onlyfast_onlylaps_session_links.onlyfast_session_id is
  'The individual OnlyFast race session, represented by a public.race_setups row.';
comment on column public.onlyfast_onlylaps_session_links.onlylaps_session_id is
  'The authoritative OnlyLaps timing/telemetry session. Raw telemetry remains in OnlyLaps tables.';

create index if not exists onlyfast_onlylaps_links_user_idx
  on public.onlyfast_onlylaps_session_links (user_id, created_at desc);

create index if not exists onlyfast_onlylaps_links_onlylaps_session_idx
  on public.onlyfast_onlylaps_session_links (onlylaps_session_id);

drop trigger if exists onlyfast_onlylaps_links_touch_updated_at
  on public.onlyfast_onlylaps_session_links;
create trigger onlyfast_onlylaps_links_touch_updated_at
before update on public.onlyfast_onlylaps_session_links
for each row execute function public.onlyfast_onlylaps_touch_updated_at();

alter table public.onlyfast_onlylaps_session_links enable row level security;

drop policy if exists onlyfast_onlylaps_links_select_own
  on public.onlyfast_onlylaps_session_links;
create policy onlyfast_onlylaps_links_select_own
  on public.onlyfast_onlylaps_session_links
  for select
  to authenticated
  using (
    auth.uid() = onlyfast_onlylaps_session_links.user_id
    and exists (
      select 1
      from public.race_setups as onlyfast_session
      where onlyfast_session.id =
        onlyfast_onlylaps_session_links.onlyfast_session_id
        and onlyfast_session.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.onlylaps_timing_sessions as onlylaps_session
      where onlylaps_session.id =
        onlyfast_onlylaps_session_links.onlylaps_session_id
        and onlylaps_session.user_id = auth.uid()
    )
  );

drop policy if exists onlyfast_onlylaps_links_insert_own
  on public.onlyfast_onlylaps_session_links;
create policy onlyfast_onlylaps_links_insert_own
  on public.onlyfast_onlylaps_session_links
  for insert
  to authenticated
  with check (
    auth.uid() = onlyfast_onlylaps_session_links.user_id
    and exists (
      select 1
      from public.race_setups as onlyfast_session
      where onlyfast_session.id =
        onlyfast_onlylaps_session_links.onlyfast_session_id
        and onlyfast_session.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.onlylaps_timing_sessions as onlylaps_session
      where onlylaps_session.id =
        onlyfast_onlylaps_session_links.onlylaps_session_id
        and onlylaps_session.user_id = auth.uid()
    )
  );

drop policy if exists onlyfast_onlylaps_links_update_own
  on public.onlyfast_onlylaps_session_links;
create policy onlyfast_onlylaps_links_update_own
  on public.onlyfast_onlylaps_session_links
  for update
  to authenticated
  using (
    auth.uid() = onlyfast_onlylaps_session_links.user_id
    and exists (
      select 1
      from public.race_setups as onlyfast_session
      where onlyfast_session.id =
        onlyfast_onlylaps_session_links.onlyfast_session_id
        and onlyfast_session.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.onlylaps_timing_sessions as onlylaps_session
      where onlylaps_session.id =
        onlyfast_onlylaps_session_links.onlylaps_session_id
        and onlylaps_session.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = onlyfast_onlylaps_session_links.user_id
    and exists (
      select 1
      from public.race_setups as onlyfast_session
      where onlyfast_session.id =
        onlyfast_onlylaps_session_links.onlyfast_session_id
        and onlyfast_session.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.onlylaps_timing_sessions as onlylaps_session
      where onlylaps_session.id =
        onlyfast_onlylaps_session_links.onlylaps_session_id
        and onlylaps_session.user_id = auth.uid()
    )
  );

drop policy if exists onlyfast_onlylaps_links_delete_own
  on public.onlyfast_onlylaps_session_links;
create policy onlyfast_onlylaps_links_delete_own
  on public.onlyfast_onlylaps_session_links
  for delete
  to authenticated
  using (
    auth.uid() = onlyfast_onlylaps_session_links.user_id
    and exists (
      select 1
      from public.race_setups as onlyfast_session
      where onlyfast_session.id =
        onlyfast_onlylaps_session_links.onlyfast_session_id
        and onlyfast_session.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.onlylaps_timing_sessions as onlylaps_session
      where onlylaps_session.id =
        onlyfast_onlylaps_session_links.onlylaps_session_id
        and onlylaps_session.user_id = auth.uid()
    )
  );

revoke all on table public.onlyfast_onlylaps_session_links from anon;
grant select, insert, update, delete
  on table public.onlyfast_onlylaps_session_links
  to authenticated;
grant all on table public.onlyfast_onlylaps_session_links to service_role;

-- The deployed OnlyLaps schema has durable deterministic lap statistics, and
-- newer OnlyLaps migrations define durable corner metrics, but the OpenAI lap
-- summary is currently returned at runtime and is not stored. Keep generated
-- narrative/structured analysis separate from authoritative raw telemetry and
-- deterministic corner data.
create table if not exists public.onlylaps_session_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_text text,
  summary_json jsonb not null default '{}'::jsonb,
  driving_observations jsonb not null default '[]'::jsonb,
  corner_observations jsonb not null default '[]'::jsonb,
  sector_observations jsonb not null default '[]'::jsonb,
  consistency_observations jsonb not null default '[]'::jsonb,
  braking_observations jsonb not null default '[]'::jsonb,
  acceleration_observations jsonb not null default '[]'::jsonb,
  lateral_grip_observations jsonb not null default '[]'::jsonb,
  line_trajectory_observations jsonb not null default '[]'::jsonb,
  setup_relevant_observations jsonb not null default '[]'::jsonb,
  optimum_lap_time_ms bigint,
  optimum_lap jsonb,
  analysis_version text not null,
  model_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint onlylaps_session_analysis_session_owner_fk
    foreign key (session_id, user_id)
    references public.onlylaps_timing_sessions (id, user_id)
    on delete cascade,

  constraint onlylaps_session_analysis_version_unique
    unique (session_id, analysis_version),

  constraint onlylaps_session_analysis_version_nonempty
    check (length(btrim(analysis_version)) > 0),

  constraint onlylaps_session_analysis_optimum_time_nonnegative
    check (optimum_lap_time_ms is null or optimum_lap_time_ms >= 0),

  constraint onlylaps_session_analysis_summary_json_shape
    check (jsonb_typeof(summary_json) = 'object'),

  constraint onlylaps_session_analysis_driving_shape
    check (jsonb_typeof(driving_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_corner_shape
    check (jsonb_typeof(corner_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_sector_shape
    check (jsonb_typeof(sector_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_consistency_shape
    check (jsonb_typeof(consistency_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_braking_shape
    check (jsonb_typeof(braking_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_acceleration_shape
    check (jsonb_typeof(acceleration_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_lateral_grip_shape
    check (jsonb_typeof(lateral_grip_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_line_shape
    check (jsonb_typeof(line_trajectory_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_setup_relevant_shape
    check (jsonb_typeof(setup_relevant_observations) in ('array', 'object')),

  constraint onlylaps_session_analysis_optimum_lap_shape
    check (optimum_lap is null or jsonb_typeof(optimum_lap) = 'object')
);

comment on table public.onlylaps_session_analysis is
  'Versioned permanent structured analysis for an OnlyLaps timing session; raw telemetry remains authoritative.';
comment on column public.onlylaps_session_analysis.optimum_lap_time_ms is
  'Optimum lap duration in milliseconds, matching OnlyLaps duration_ms conventions.';
comment on column public.onlylaps_session_analysis.analysis_version is
  'Writer-controlled analysis/prompt/schema version used as the stable upsert key for a session.';

create index if not exists onlylaps_session_analysis_user_idx
  on public.onlylaps_session_analysis (user_id, updated_at desc);

drop trigger if exists onlylaps_session_analysis_touch_updated_at
  on public.onlylaps_session_analysis;
create trigger onlylaps_session_analysis_touch_updated_at
before update on public.onlylaps_session_analysis
for each row execute function public.onlyfast_onlylaps_touch_updated_at();

alter table public.onlylaps_session_analysis enable row level security;

drop policy if exists onlylaps_session_analysis_select_own
  on public.onlylaps_session_analysis;
create policy onlylaps_session_analysis_select_own
  on public.onlylaps_session_analysis
  for select
  to authenticated
  using (
    auth.uid() = onlylaps_session_analysis.user_id
    and exists (
      select 1
      from public.onlylaps_timing_sessions as analysis_session
      where analysis_session.id = onlylaps_session_analysis.session_id
        and analysis_session.user_id = auth.uid()
    )
  );

drop policy if exists onlylaps_session_analysis_insert_own
  on public.onlylaps_session_analysis;
create policy onlylaps_session_analysis_insert_own
  on public.onlylaps_session_analysis
  for insert
  to authenticated
  with check (
    auth.uid() = onlylaps_session_analysis.user_id
    and exists (
      select 1
      from public.onlylaps_timing_sessions as analysis_session
      where analysis_session.id = onlylaps_session_analysis.session_id
        and analysis_session.user_id = auth.uid()
    )
  );

drop policy if exists onlylaps_session_analysis_update_own
  on public.onlylaps_session_analysis;
create policy onlylaps_session_analysis_update_own
  on public.onlylaps_session_analysis
  for update
  to authenticated
  using (
    auth.uid() = onlylaps_session_analysis.user_id
    and exists (
      select 1
      from public.onlylaps_timing_sessions as analysis_session
      where analysis_session.id = onlylaps_session_analysis.session_id
        and analysis_session.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = onlylaps_session_analysis.user_id
    and exists (
      select 1
      from public.onlylaps_timing_sessions as analysis_session
      where analysis_session.id = onlylaps_session_analysis.session_id
        and analysis_session.user_id = auth.uid()
    )
  );

drop policy if exists onlylaps_session_analysis_delete_own
  on public.onlylaps_session_analysis;
create policy onlylaps_session_analysis_delete_own
  on public.onlylaps_session_analysis
  for delete
  to authenticated
  using (
    auth.uid() = onlylaps_session_analysis.user_id
    and exists (
      select 1
      from public.onlylaps_timing_sessions as analysis_session
      where analysis_session.id = onlylaps_session_analysis.session_id
        and analysis_session.user_id = auth.uid()
    )
  );

revoke all on table public.onlylaps_session_analysis from anon;
grant select, insert, update, delete
  on table public.onlylaps_session_analysis
  to authenticated;
grant all on table public.onlylaps_session_analysis to service_role;
