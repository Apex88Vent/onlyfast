-- One active class for Rookie/Pro accounts, with server-enforced class changes.
-- Existing setup rows are never updated by this migration.

alter table public.user_subscriptions
  add column if not exists active_race_class text,
  add column if not exists last_class_change_at timestamptz;

create or replace function public.onlyfast_has_unlimited_classes(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      (lower(coalesce(s.plan, '')) in ('team', 'teams') and lower(coalesce(s.status, '')) in ('active', 'trialing'))
      or coalesce((u.raw_user_meta_data ->> 'has_admin_full_access')::boolean, false)
      or lower(coalesce(u.email, '')) = 'test@test.com'
      or (
        lower(coalesce(u.raw_user_meta_data ->> 'promo_access_level', '')) in ('team', 'teams', 'admin', 'admin_full_access')
        and (
          nullif(u.raw_user_meta_data ->> 'promo_access_expires_at', '') is null
          or (u.raw_user_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
        )
      )
    from auth.users u
    left join public.user_subscriptions s on s.user_id = u.id
    where u.id = p_user_id
  ), false);
$$;

create or replace function public.onlyfast_active_race_class(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim((select s.active_race_class from public.user_subscriptions s where s.user_id = p_user_id)), ''),
    (
      select nullif(trim(r.race_class), '')
      from public.race_setups r
      where r.user_id = p_user_id and nullif(trim(r.race_class), '') is not null
      order by r.updated_at desc nulls last, r.created_at desc
      limit 1
    )
  );
$$;

create or replace function public.onlyfast_can_access_setup_class(p_user_id uuid, p_race_class text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.onlyfast_has_unlimited_classes(p_user_id)
    or nullif(trim(p_race_class), '') is null
    or lower(trim(p_race_class)) = lower(trim(coalesce(public.onlyfast_active_race_class(p_user_id), '')));
$$;

create or replace function public.onlyfast_can_save_setup_class(p_user_id uuid, p_race_class text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.onlyfast_has_unlimited_classes(p_user_id)
    or (
      nullif(trim(p_race_class), '') is not null
      and lower(trim(p_race_class)) = lower(trim(coalesce(public.onlyfast_active_race_class(p_user_id), '')))
    );
$$;

create or replace function public.get_active_race_class_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_active text;
  v_last timestamptz;
  v_unlimited boolean;
  v_next timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  v_active := public.onlyfast_active_race_class(v_user_id);
  select s.last_class_change_at into v_last
  from public.user_subscriptions s where s.user_id = v_user_id;
  v_unlimited := public.onlyfast_has_unlimited_classes(v_user_id);
  v_next := case when v_last is null then null else v_last + interval '7 days' end;

  return jsonb_build_object(
    'active_class', v_active,
    'last_class_change_at', v_last,
    'next_eligible_at', v_next,
    'can_change', v_unlimited or v_next is null or now() >= v_next,
    'unlimited', v_unlimited
  );
end;
$$;

create or replace function public.initialize_active_race_class(p_class text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing text;
  v_initial text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_class), '') is null then raise exception 'A vehicle class is required'; end if;

  insert into public.user_subscriptions (user_id, active_race_class)
  values (v_user_id, null)
  on conflict (user_id) do nothing;

  select s.active_race_class into v_existing
  from public.user_subscriptions s where s.user_id = v_user_id for update;

  if nullif(trim(v_existing), '') is null then
    select nullif(trim(r.race_class), '') into v_initial
    from public.race_setups r
    where r.user_id = v_user_id and nullif(trim(r.race_class), '') is not null
    order by r.updated_at desc nulls last, r.created_at desc
    limit 1;
    v_initial := coalesce(v_initial, trim(p_class));
    update public.user_subscriptions
      set active_race_class = v_initial
      where user_id = v_user_id and nullif(trim(active_race_class), '') is null;
  end if;

  return public.get_active_race_class_state();
end;
$$;

create or replace function public.change_active_race_class(p_new_class text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current text;
  v_last timestamptz;
  v_next timestamptz;
  v_unlimited boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_new_class), '') is null then raise exception 'A vehicle class is required'; end if;

  insert into public.user_subscriptions (user_id, active_race_class)
  values (v_user_id, public.onlyfast_active_race_class(v_user_id))
  on conflict (user_id) do nothing;

  select coalesce(nullif(trim(s.active_race_class), ''), public.onlyfast_active_race_class(v_user_id)),
         s.last_class_change_at
    into v_current, v_last
  from public.user_subscriptions s
  where s.user_id = v_user_id
  for update;

  if lower(trim(coalesce(v_current, ''))) = lower(trim(p_new_class)) then
    raise exception 'Select a different vehicle class';
  end if;

  v_unlimited := public.onlyfast_has_unlimited_classes(v_user_id);
  v_next := case when v_last is null then null else v_last + interval '7 days' end;
  if not v_unlimited and v_next is not null and now() < v_next then
    raise exception 'CLASS_CHANGE_COOLDOWN:%', to_char(v_next at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  update public.user_subscriptions
  set active_race_class = trim(p_new_class),
      last_class_change_at = case when v_unlimited then last_class_change_at else now() end
  where user_id = v_user_id;

  return public.get_active_race_class_state();
end;
$$;

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
    'race_class', r.race_class
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r
  where r.user_id = auth.uid();
$$;

create or replace function public.get_setup_class_lock_state(p_setup_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'locked', not public.onlyfast_can_access_setup_class(r.user_id, r.race_class),
      'race_class', r.race_class
    )
    from public.race_setups r
    where r.id = p_setup_id and r.user_id = auth.uid()
  ), jsonb_build_object('locked', false));
$$;

revoke all on function public.onlyfast_has_unlimited_classes(uuid) from public;
revoke all on function public.onlyfast_active_race_class(uuid) from public;
revoke all on function public.onlyfast_can_access_setup_class(uuid, text) from public;
revoke all on function public.onlyfast_can_save_setup_class(uuid, text) from public;
revoke all on function public.get_active_race_class_state() from public;
revoke all on function public.initialize_active_race_class(text) from public;
revoke all on function public.change_active_race_class(text) from public;
revoke all on function public.list_user_setup_summaries() from public;
revoke all on function public.get_setup_class_lock_state(uuid) from public;

grant execute on function public.get_active_race_class_state() to authenticated;
grant execute on function public.initialize_active_race_class(text) to authenticated;
grant execute on function public.change_active_race_class(text) to authenticated;
grant execute on function public.list_user_setup_summaries() to authenticated;
grant execute on function public.get_setup_class_lock_state(uuid) to authenticated;
grant execute on function public.onlyfast_has_unlimited_classes(uuid) to authenticated;
grant execute on function public.onlyfast_active_race_class(uuid) to authenticated;
grant execute on function public.onlyfast_can_access_setup_class(uuid, text) to authenticated;
grant execute on function public.onlyfast_can_save_setup_class(uuid, text) to authenticated;

drop policy if exists race_setups_select_own on public.race_setups;
create policy race_setups_select_own
  on public.race_setups for select
  using (
    auth.uid() = user_id
    and public.onlyfast_can_access_setup_class(user_id, race_class)
  );

drop policy if exists race_setups_insert_own on public.race_setups;
create policy race_setups_insert_own
  on public.race_setups for insert
  with check (
    auth.uid() = user_id
    and public.onlyfast_can_save_setup_class(user_id, race_class)
  );

drop policy if exists race_setups_update_own on public.race_setups;
create policy race_setups_update_own
  on public.race_setups for update
  using (
    auth.uid() = user_id
    and public.onlyfast_can_access_setup_class(user_id, race_class)
  )
  with check (
    auth.uid() = user_id
    and public.onlyfast_can_save_setup_class(user_id, race_class)
  );

drop policy if exists race_setups_delete_own on public.race_setups;
create policy race_setups_delete_own
  on public.race_setups for delete
  using (
    auth.uid() = user_id
    and public.onlyfast_can_access_setup_class(user_id, race_class)
  );

drop policy if exists race_setups_select_via_share on public.race_setups;
create policy race_setups_select_via_share
  on public.race_setups for select
  using (
    (auth.uid() is null or auth.uid() <> user_id)
    and exists (
      select 1 from public.shared_setups s
      where s.setup_id = race_setups.id and s.is_public = true
    )
  );

drop policy if exists shared_setups_insert_own on public.shared_setups;
create policy shared_setups_insert_own
  on public.shared_setups for insert
  with check (
    auth.uid() = shared_by
    and exists (
      select 1 from public.race_setups r
      where r.id = setup_id and r.user_id = auth.uid()
    )
  );
