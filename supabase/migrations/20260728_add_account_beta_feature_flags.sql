-- Account-specific beta feature flags for the existing OnlyFast Supabase project.
--
-- This migration is additive and fail-closed:
--   * production tables and policies are not changed;
--   * users can read only their own beta account/flag rows;
--   * browser clients have no INSERT/UPDATE/DELETE grants;
--   * all assignments are explicit and default to disabled.

create table if not exists public.beta_feature_definitions (
  feature_key text primary key,
  description text not null,
  maturity_stage text not null default 'experimental'
    check (maturity_stage in ('experimental', 'personal_beta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_feature_definitions_key_format
    check (
      char_length(feature_key) between 3 and 100
      and feature_key ~ '^[a-z][a-z0-9_]*$'
    )
);

create table if not exists public.beta_tester_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_test_account boolean not null default false,
  beta_features_enabled boolean not null default false,
  tester_kind text not null default 'personal'
    check (tester_kind in ('experimental', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feature_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null
    references public.beta_feature_definitions(feature_key) on update cascade on delete restrict,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_feature_flags_user_feature_unique unique (user_id, feature_key)
);

create index if not exists user_feature_flags_user_enabled_idx
  on public.user_feature_flags (user_id, enabled);

create or replace function public.touch_beta_feature_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beta_feature_definitions_touch_updated_at
  on public.beta_feature_definitions;
create trigger beta_feature_definitions_touch_updated_at
before update on public.beta_feature_definitions
for each row execute function public.touch_beta_feature_updated_at();

drop trigger if exists beta_tester_accounts_touch_updated_at
  on public.beta_tester_accounts;
create trigger beta_tester_accounts_touch_updated_at
before update on public.beta_tester_accounts
for each row execute function public.touch_beta_feature_updated_at();

drop trigger if exists user_feature_flags_touch_updated_at
  on public.user_feature_flags;
create trigger user_feature_flags_touch_updated_at
before update on public.user_feature_flags
for each row execute function public.touch_beta_feature_updated_at();

alter table public.beta_feature_definitions enable row level security;
alter table public.beta_tester_accounts enable row level security;
alter table public.user_feature_flags enable row level security;

drop policy if exists beta_tester_accounts_select_own
  on public.beta_tester_accounts;
create policy beta_tester_accounts_select_own
  on public.beta_tester_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_feature_flags_select_own
  on public.user_feature_flags;
create policy user_feature_flags_select_own
  on public.user_feature_flags
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- There is intentionally no client policy for beta_feature_definitions and no
-- INSERT/UPDATE/DELETE policy on either user-facing table.
revoke all on public.beta_feature_definitions from anon, authenticated;
revoke all on public.beta_tester_accounts from anon, authenticated;
revoke all on public.user_feature_flags from anon, authenticated;

grant select on public.beta_tester_accounts to authenticated;
grant select on public.user_feature_flags to authenticated;
grant select on public.beta_feature_definitions to service_role;
grant select, insert, update, delete on public.beta_tester_accounts to service_role;
grant select, insert, update, delete on public.user_feature_flags to service_role;

-- A caller can check only their own authenticated user ID. There is no user ID
-- parameter to manipulate, and every lookup fails closed.
create or replace function public.has_beta_feature(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.beta_tester_accounts bta
      join public.user_feature_flags uff
        on uff.user_id = bta.user_id
      where bta.user_id = auth.uid()
        and bta.is_test_account = true
        and bta.beta_features_enabled = true
        and uff.feature_key = p_feature_key
        and uff.enabled = true
    ),
    false
  );
$$;

revoke all on function public.has_beta_feature(text) from public, anon;
grant execute on function public.has_beta_feature(text) to authenticated, service_role;

-- Admin authority stays separate from beta authority. A beta tester is not an
-- administrator. SQL Editor/postgres, service_role, or a JWT whose immutable
-- app_metadata has has_admin_full_access=true may use the management RPCs.
create or replace function public.beta_management_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'has_admin_full_access', 'false') = 'true';
$$;

revoke all on function public.beta_management_allowed() from public, anon, authenticated;
grant execute on function public.beta_management_allowed() to service_role;

create or replace function public.admin_set_beta_tester_account(
  p_user_id uuid,
  p_is_test_account boolean,
  p_beta_features_enabled boolean,
  p_tester_kind text
)
returns public.beta_tester_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.beta_tester_accounts;
begin
  if not public.beta_management_allowed() then
    raise exception 'Only an OnlyFast administrator may manage beta testers'
      using errcode = '42501';
  end if;

  if p_tester_kind not in ('experimental', 'personal') then
    raise exception 'tester_kind must be experimental or personal'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Supabase Auth user does not exist'
      using errcode = '22023';
  end if;

  insert into public.beta_tester_accounts (
    user_id,
    is_test_account,
    beta_features_enabled,
    tester_kind
  )
  values (
    p_user_id,
    p_is_test_account,
    p_beta_features_enabled,
    p_tester_kind
  )
  on conflict (user_id) do update
    set is_test_account = excluded.is_test_account,
        beta_features_enabled = excluded.beta_features_enabled,
        tester_kind = excluded.tester_kind
  returning * into result;

  return result;
end;
$$;

create or replace function public.admin_set_beta_feature(
  p_user_id uuid,
  p_feature_key text,
  p_enabled boolean
)
returns public.user_feature_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.user_feature_flags;
begin
  if not public.beta_management_allowed() then
    raise exception 'Only an OnlyFast administrator may manage beta features'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.beta_tester_accounts
    where user_id = p_user_id
      and is_test_account = true
  ) then
    raise exception 'User is not an authorized beta tester'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.beta_feature_definitions
    where feature_key = p_feature_key
  ) then
    raise exception 'Unknown beta feature key: %', p_feature_key
      using errcode = '22023';
  end if;

  insert into public.user_feature_flags (user_id, feature_key, enabled)
  values (p_user_id, p_feature_key, p_enabled)
  on conflict (user_id, feature_key) do update
    set enabled = excluded.enabled
  returning * into result;

  return result;
end;
$$;

revoke all on function public.admin_set_beta_tester_account(uuid, boolean, boolean, text)
  from public, anon;
revoke all on function public.admin_set_beta_feature(uuid, text, boolean)
  from public, anon;
grant execute on function public.admin_set_beta_tester_account(uuid, boolean, boolean, text)
  to authenticated, service_role;
grant execute on function public.admin_set_beta_feature(uuid, text, boolean)
  to authenticated, service_role;

-- Central registry of the experimental surfaces that already exist today.
insert into public.beta_feature_definitions (feature_key, description, maturity_stage)
values
  (
    'test_account_full_access',
    'Preserves the existing full-access testing override without frontend email checks.',
    'experimental'
  ),
  (
    'test_account_reset',
    'Allows the primary experimental account to reset its disposable app data.',
    'experimental'
  ),
  (
    'onboarding_preview_route',
    'Protects the onboarding preview route.',
    'experimental'
  ),
  (
    'rookie_ad_slot_preview_route',
    'Protects the Rookie advertising placement preview route.',
    'experimental'
  )
on conflict (feature_key) do update
  set description = excluded.description,
      maturity_stage = excluded.maturity_stage;

-- Resolve the two existing accounts by email only inside this admin migration,
-- then persist authorization against their immutable Supabase Auth user IDs.
insert into public.beta_tester_accounts (
  user_id,
  is_test_account,
  beta_features_enabled,
  tester_kind
)
select
  id,
  true,
  true,
  case
    when lower(email) = 'test@test.com' then 'experimental'
    else 'personal'
  end
from auth.users
where lower(email) in ('test@test.com', 'c_marin88@yahoo.com')
on conflict (user_id) do update
  set is_test_account = excluded.is_test_account,
      beta_features_enabled = excluded.beta_features_enabled,
      tester_kind = excluded.tester_kind;

-- Stage 1: only the disposable development account receives the current
-- experimental surfaces. The personal beta account starts authorized but with
-- zero enabled features; future assignments remain deliberate and per-user.
insert into public.user_feature_flags (user_id, feature_key, enabled)
select
  u.id,
  feature_key,
  true
from auth.users u
cross join (
  values
    ('test_account_full_access'),
    ('test_account_reset'),
    ('onboarding_preview_route'),
    ('rookie_ad_slot_preview_route')
) as initial_flags(feature_key)
where lower(u.email) = 'test@test.com'
on conflict (user_id, feature_key) do update
  set enabled = excluded.enabled;

-- Replace the existing database-side test email bypass used by class-lock RLS.
-- All other subscription/admin/promo behavior remains unchanged.
create or replace function public.onlyfast_subscription_tier(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when coalesce(lower(u.raw_app_meta_data ->> 'has_admin_full_access') = 'true', false)
        or coalesce(lower(u.raw_user_meta_data ->> 'has_admin_full_access') = 'true', false)
        then 'admin'
      when exists (
        select 1
        from public.beta_tester_accounts bta
        join public.user_feature_flags uff
          on uff.user_id = bta.user_id
        where bta.user_id = u.id
          and bta.is_test_account = true
          and bta.beta_features_enabled = true
          and bta.tester_kind = 'experimental'
          and uff.feature_key = 'test_account_full_access'
          and uff.enabled = true
      ) then 'team'
      when lower(coalesce(s.status, '')) in ('active', 'trialing')
        and lower(coalesce(s.plan, '')) in ('team', 'teams') then 'team'
      when lower(coalesce(s.status, '')) in ('active', 'trialing')
        and lower(coalesce(s.plan, '')) = 'pro' then 'pro'
      when lower(coalesce(u.raw_user_meta_data ->> 'promo_access_level', '')) in ('team', 'teams', 'admin', 'admin_full_access')
        and (
          nullif(u.raw_user_meta_data ->> 'promo_access_expires_at', '') is null
          or (u.raw_user_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
        ) then case
          when lower(coalesce(u.raw_user_meta_data ->> 'promo_access_level', '')) in ('admin', 'admin_full_access') then 'admin'
          else 'team'
        end
      when lower(coalesce(u.raw_user_meta_data ->> 'promo_access_level', '')) = 'pro'
        and (
          nullif(u.raw_user_meta_data ->> 'promo_access_expires_at', '') is null
          or (u.raw_user_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
        ) then 'pro'
      else 'rookie'
    end
    from auth.users u
    left join public.user_subscriptions s on s.user_id = u.id
    where u.id = p_user_id
  ), 'rookie');
$$;

do $$
begin
  if not exists (select 1 from auth.users where lower(email) = 'test@test.com') then
    raise warning 'OnlyFast beta setup: auth user test@test.com was not found';
  end if;
  if not exists (select 1 from auth.users where lower(email) = 'c_marin88@yahoo.com') then
    raise warning 'OnlyFast beta setup: auth user c_marin88@yahoo.com was not found';
  end if;
end;
$$;

-- Realtime keeps a signed-in account synchronized when an administrator turns
-- a flag off or on. RLS still limits events to the owning user.
alter table public.beta_tester_accounts replica identity full;
alter table public.user_feature_flags replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'beta_tester_accounts'
    ) then
      execute 'alter publication supabase_realtime add table public.beta_tester_accounts';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_feature_flags'
    ) then
      execute 'alter publication supabase_realtime add table public.user_feature_flags';
    end if;
  end if;
exception
  when insufficient_privilege then
    raise notice 'Could not add beta tables to supabase_realtime; refresh/focus revalidation remains available';
end;
$$;
