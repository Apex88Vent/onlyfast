-- ════════════════════════════════════════════════════════════════════════════
--  OnlyFast — Supabase project setup
-- ════════════════════════════════════════════════════════════════════════════
--  Run this whole file ONCE in the new project's SQL editor:
--    Supabase dashboard → SQL Editor → New query → paste → Run
--
--  It is idempotent (safe to re-run): everything uses IF NOT EXISTS / OR REPLACE.
--
--  After running this, the app will work for any signed-in user — they can
--  save / load / share setups, and create base templates.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Extensions ────────────────────────────────────────────────────────────
-- gen_random_uuid() lives in pgcrypto.
create extension if not exists pgcrypto;


-- ════════════════════════════════════════════════════════════════════════════
--  TABLE: race_setups
--  One row per (setup_file × tab). The app groups rows by setup_name to form
--  a "setup file" with up to 3 tabs (base/heat/main) plus base_template rows.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.race_setups (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Identity & grouping
  setup_type   text not null default 'base',   -- 'base' | 'heat' | 'main' | 'base_template'
  setup_name   text,
  session_label text,
  session_order integer,
  track_name   text,
  race_date    date,
  race_class   text,
  track_shape  text,
  track_length text,

  -- Track / weather context
  track_condition text,
  latitude        double precision,
  longitude       double precision,
  temperature     double precision,
  humidity        double precision,
  wind_speed      double precision,
  wind_direction  text,

  -- Cross-chassis
  cross_weight       double precision,
  toe                text,
  toe_direction      text,
  front_ride_height  text,
  rear_ride_height   text,
  stagger            double precision,

  -- Right Front
  rf_caster        double precision,
  rf_camber        double precision,
  rf_pressure      double precision,
  rf_shock         text,
  rf_spring        text,
  rf_wheel_offset  text,
  rf_cw_turns      text,

  -- Left Front
  lf_caster        double precision,
  lf_camber        double precision,
  lf_pressure      double precision,
  lf_shock         text,
  lf_spring        text,
  lf_wheel_offset  text,
  lf_cw_turns      text,

  -- Left Rear
  lr_tire_size     text,
  lr_pressure      double precision,
  lr_shock         text,
  lr_spring        text,
  lr_wheel_offset  text,
  lr_cw_turns      text,

  -- Right Rear
  rr_tire_size     text,
  rr_pressure      double precision,
  rr_shock         text,
  rr_spring        text,
  rr_wheel_offset  text,
  rr_cw_turns      text,

  -- Trailing arms / link / panhard / drive
  lr_trailing_arm  double precision,
  rr_trailing_arm  double precision,
  third_link       text,
  panhard_bar      text,
  gear_ratio       text,

  -- Driver feedback
  entry_handling   text,
  mid_handling     text,
  exit_handling    text,

  -- Notes / lap times
  notes                 text,
  session_fastest_lap   text,
  session_slowest_lap   text,

  -- User-defined fields (key/value JSON: { "Field name": "value", ... })
  custom_fields         jsonb,
  timing_data           jsonb
);

alter table public.race_setups add column if not exists session_label text;
alter table public.race_setups add column if not exists session_order integer;
alter table public.race_setups add column if not exists track_shape text;
alter table public.race_setups add column if not exists track_length text;
alter table public.race_setups add column if not exists timing_data jsonb;

-- Helpful indexes
create index if not exists race_setups_user_id_idx     on public.race_setups (user_id);
create index if not exists race_setups_user_created_idx on public.race_setups (user_id, created_at desc);
create index if not exists race_setups_user_name_idx   on public.race_setups (user_id, setup_name);
create index if not exists race_setups_user_type_idx   on public.race_setups (user_id, setup_type);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists race_setups_touch_updated_at on public.race_setups;
create trigger race_setups_touch_updated_at
before update on public.race_setups
for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
--  TABLE: shared_setups
--  Lookup table for the "Share Setup" feature. Anyone with the share_code
--  (or the URL ?share=CODE) can read the linked race_setups row.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.shared_setups (
  id              uuid primary key default gen_random_uuid(),
  setup_id        uuid not null references public.race_setups(id) on delete cascade,
  shared_by       uuid not null references auth.users(id) on delete cascade,
  shared_by_email text,
  share_code      text not null unique,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists shared_setups_setup_id_idx  on public.shared_setups (setup_id);
create index if not exists shared_setups_shared_by_idx on public.shared_setups (shared_by);

create table if not exists public.race_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_date date not null,
  track text not null,
  organization text,
  finishing_position text default 'TBD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists race_schedule_user_date_idx on public.race_schedule (user_id, race_date);

drop trigger if exists race_schedule_touch_updated_at on public.race_schedule;
create trigger race_schedule_touch_updated_at
before update on public.race_schedule
for each row execute function public.touch_updated_at();

create table if not exists public.parts_reference (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  part_type text,
  part_number text,
  ordered_from text,
  cost numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parts_reference_user_created_idx on public.parts_reference (user_id, created_at desc);

drop trigger if exists parts_reference_touch_updated_at on public.parts_reference;
create trigger parts_reference_touch_updated_at
before update on public.parts_reference
for each row execute function public.touch_updated_at();

create table if not exists public.setup_assist_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  race_weekend_key text not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, race_weekend_key)
);

create index if not exists setup_assist_usage_user_idx on public.setup_assist_usage (user_id);

drop trigger if exists setup_assist_usage_touch_updated_at on public.setup_assist_usage;
create trigger setup_assist_usage_touch_updated_at
before update on public.setup_assist_usage
for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════
alter table public.race_setups   enable row level security;
alter table public.shared_setups enable row level security;
alter table public.race_schedule enable row level security;
alter table public.parts_reference enable row level security;
alter table public.setup_assist_usage enable row level security;

-- ── race_setups: each user sees + manages only their own rows ──────────────
drop policy if exists race_setups_select_own on public.race_setups;
create policy race_setups_select_own
  on public.race_setups for select
  using (auth.uid() = user_id);

drop policy if exists race_setups_insert_own on public.race_setups;
create policy race_setups_insert_own
  on public.race_setups for insert
  with check (auth.uid() = user_id);

drop policy if exists race_setups_update_own on public.race_setups;
create policy race_setups_update_own
  on public.race_setups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists race_setups_delete_own on public.race_setups;
create policy race_setups_delete_own
  on public.race_setups for delete
  using (auth.uid() = user_id);

-- ── race_setups: ALSO allow public read of any row referenced by a public
--    share_code. This is what lets "?share=ABCD1234" links work for anyone. ─
drop policy if exists race_setups_select_via_share on public.race_setups;
create policy race_setups_select_via_share
  on public.race_setups for select
  using (
    exists (
      select 1 from public.shared_setups s
      where s.setup_id = race_setups.id
        and s.is_public = true
    )
  );

-- ── shared_setups: owners manage their own shares; anyone can read public ──
drop policy if exists shared_setups_select_public on public.shared_setups;
create policy shared_setups_select_public
  on public.shared_setups for select
  using (is_public = true or auth.uid() = shared_by);

drop policy if exists shared_setups_insert_own on public.shared_setups;
create policy shared_setups_insert_own
  on public.shared_setups for insert
  with check (auth.uid() = shared_by);

drop policy if exists shared_setups_update_own on public.shared_setups;
create policy shared_setups_update_own
  on public.shared_setups for update
  using (auth.uid() = shared_by)
  with check (auth.uid() = shared_by);

drop policy if exists shared_setups_delete_own on public.shared_setups;
create policy shared_setups_delete_own
  on public.shared_setups for delete
  using (auth.uid() = shared_by);

drop policy if exists race_schedule_select_own on public.race_schedule;
create policy race_schedule_select_own
  on public.race_schedule for select
  using (auth.uid() = user_id);

drop policy if exists race_schedule_insert_own on public.race_schedule;
create policy race_schedule_insert_own
  on public.race_schedule for insert
  with check (auth.uid() = user_id);

drop policy if exists race_schedule_update_own on public.race_schedule;
create policy race_schedule_update_own
  on public.race_schedule for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists race_schedule_delete_own on public.race_schedule;
create policy race_schedule_delete_own
  on public.race_schedule for delete
  using (auth.uid() = user_id);

drop policy if exists parts_reference_select_own on public.parts_reference;
create policy parts_reference_select_own
  on public.parts_reference for select
  using (auth.uid() = user_id);

drop policy if exists parts_reference_insert_own on public.parts_reference;
create policy parts_reference_insert_own
  on public.parts_reference for insert
  with check (auth.uid() = user_id);

drop policy if exists parts_reference_update_own on public.parts_reference;
create policy parts_reference_update_own
  on public.parts_reference for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists parts_reference_delete_own on public.parts_reference;
create policy parts_reference_delete_own
  on public.parts_reference for delete
  using (auth.uid() = user_id);

drop policy if exists setup_assist_usage_select_own on public.setup_assist_usage;
create policy setup_assist_usage_select_own
  on public.setup_assist_usage for select
  using (auth.uid() = user_id);

drop policy if exists setup_assist_usage_insert_own on public.setup_assist_usage;
create policy setup_assist_usage_insert_own
  on public.setup_assist_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists setup_assist_usage_update_own on public.setup_assist_usage;
create policy setup_assist_usage_update_own
  on public.setup_assist_usage for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists setup_assist_usage_delete_own on public.setup_assist_usage;
create policy setup_assist_usage_delete_own
  on public.setup_assist_usage for delete
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
--  Done.
-- ════════════════════════════════════════════════════════════════════════════
