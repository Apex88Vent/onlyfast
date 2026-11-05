-- REVIEW ONLY. Prepared locally for Phase 1. Never apply automatically.
-- Prerequisite: the deployed secure_membership_authorization schema.
-- Reconcile migration versions/definitions before applying. No onboarding rollout.
-- Deploy the RPC-aware share viewer before restricting table reads.
begin;
create or replace function onlyfast_private.membership_tier(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case
    when u.raw_app_meta_data ->> 'has_admin_full_access' = 'true' then 'admin'
    when exists(select 1 from public.beta_tester_accounts b
      join public.user_feature_flags f on f.user_id = b.user_id
      where b.user_id=u.id and b.is_test_account and b.beta_features_enabled
        and b.tester_kind='experimental' and f.feature_key='test_account_full_access' and f.enabled) then 'team'
    when (lower(s.plan) in ('team','teams') and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level') in ('team','teams','admin','admin_full_access')
        and case when nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null then true
          when pg_input_is_valid(u.raw_app_meta_data ->> 'promo_access_expires_at','timestamptz')
            then (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
          else false end) then 'team'
    when (lower(s.plan)='pro' and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level')='pro'
        and case when nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null then true
          when pg_input_is_valid(u.raw_app_meta_data ->> 'promo_access_expires_at','timestamptz')
            then (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
          else false end) then 'pro'
    else 'rookie' end
    from auth.users u left join public.user_subscriptions s on s.user_id=u.id
    where u.id=p_user_id), 'rookie');
$$;

revoke all on function onlyfast_private.membership_tier(uuid) from public, anon, authenticated;
grant execute on function onlyfast_private.membership_tier(uuid) to service_role;

-- The public legacy signature remains callable only for the authenticated owner.
create or replace function public.onlyfast_subscription_tier(p_user_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id is distinct from auth.uid()
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'MEMBERSHIP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return onlyfast_private.membership_tier(p_user_id);
end;
$$;
revoke all on function public.onlyfast_subscription_tier(uuid) from public, anon;
grant execute on function public.onlyfast_subscription_tier(uuid) to authenticated, service_role;

-- Edge callers supply the identity verified by auth.getUser, never a body user ID.
create or replace function public.onlyfast_membership_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select onlyfast_private.membership_tier(p_user_id);
$$;
revoke all on function public.onlyfast_membership_for_user(uuid) from public, anon, authenticated;
grant execute on function public.onlyfast_membership_for_user(uuid) to service_role;

create or replace function public.onlyfast_has_unlimited_classes(p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select onlyfast_private.has_unlimited_vehicles(p_user_id);
$$;
revoke all on function public.onlyfast_has_unlimited_classes(uuid) from public,anon;
grant execute on function public.onlyfast_has_unlimited_classes(uuid) to authenticated;
create or replace function public.onlyfast_active_race_class(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(trim((select s.active_race_class from public.user_subscriptions s where s.user_id = p_user_id)), ''),
    (select nullif(trim(r.race_class), '') from public.race_setups r where r.user_id = p_user_id
      and nullif(trim(r.race_class), '') is not null order by r.updated_at desc nulls last, r.created_at desc limit 1))
  where p_user_id = auth.uid();
$$;
revoke all on function public.onlyfast_active_race_class(uuid) from public, anon;
grant execute on function public.onlyfast_active_race_class(uuid) to authenticated;

create or replace function public.onlyfast_can_access_setup_class(p_user_id uuid, p_race_class text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_user_id = auth.uid() and (
    public.onlyfast_has_unlimited_classes(p_user_id) or nullif(trim(p_race_class), '') is null
    or lower(trim(p_race_class)) = lower(trim(coalesce(public.onlyfast_active_race_class(p_user_id), '')))), false);
$$;
create or replace function public.onlyfast_can_save_setup_class(p_user_id uuid, p_race_class text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_user_id = auth.uid() and (
    public.onlyfast_has_unlimited_classes(p_user_id) or (nullif(trim(p_race_class), '') is not null
      and lower(trim(p_race_class)) = lower(trim(coalesce(public.onlyfast_active_race_class(p_user_id), ''))))), false);
$$;
revoke all on function public.onlyfast_can_access_setup_class(uuid,text) from public, anon;
revoke all on function public.onlyfast_can_save_setup_class(uuid,text) from public, anon;
grant execute on function public.onlyfast_can_access_setup_class(uuid,text) to authenticated;
grant execute on function public.onlyfast_can_save_setup_class(uuid,text) to authenticated;

-- Add columns before the RPC-aware client is released.
alter table public.shared_setups add column if not exists expires_at timestamptz;
alter table public.shared_setups add column if not exists revoked_at timestamptz;

create or replace function onlyfast_private.redeem_setup_share(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (select jsonb_object_agg(e.key, e.value) from jsonb_each(to_jsonb(r)) e
    where e.key = any(array['setup_type','setup_name','session_label','session_order','race_class','race_date','track_name','track_shape','track_length','track_condition','temperature','humidity','wind_speed','wind_direction','cross_weight','toe','toe_direction','front_ride_height','rear_ride_height','stagger','front_stagger','rear_stagger','rf_pressure','rf_shock','rf_spring','rf_caster','rf_camber','rf_wheel_offset','rf_cw_turns','lf_pressure','lf_shock','lf_spring','lf_caster','lf_camber','lf_wheel_offset','lf_cw_turns','lr_tire_size','lr_pressure','lr_shock','lr_spring','lr_wheel_offset','lr_cw_turns','rr_tire_size','rr_pressure','rr_shock','rr_spring','rr_wheel_offset','rr_cw_turns','lr_trailing_arm','rr_trailing_arm','third_link','panhard_bar','gear_ratio','entry_handling','mid_handling','exit_handling','custom_fields','notes','session_fastest_lap','session_slowest_lap','pressure','shock','spring','caster','camber','tire_size','wheel_offset','fuel','total_weight','left_side_pct','rear_weight_pct','lead_location','lead_weight','sc_track','sc_car','sc_date','nose_height','front_weight','left_weight','rear_weight','toe_out','ackerman','shock_brand','compression','rebound','piston','weight','spring_rate','air_pressure','tire_temps','ride_height','a_arm_length','bump','spindle','trailing_arm_angle','track_bar','rear_mount_hole','lead','quarter_height','top_link_front_height','top_link_rear_height','top_link_angle','pinion_angle','spoiler_angle','wheelbase','front_panhard','torsion_coil_size','block_size','turns_off_block','shock_setting','shock_pressure','tire_pressure','wheel','jacobs_ladder','rear_bearing_carrier_timing','rr_control_arm_location','lr_control_arm_location','center_line_tire_offset','lf_offset_ref','lr_offset_ref','rr_offset_ref','front_sprocket','rear_sprocket','rear_notes','front_wing_angle','rear_wing_starting_angle','bite','shock_comp','shock_reb','panhard_angle','sway_bar','weight_jacker','spoiler_height','front_axle','nerf_bar_height','bumper_height','torsion_bar','top_gear','bottom_gear','fuel_mixture','drive_type','tire_brand']))
  from public.shared_setups s join public.race_setups r on r.id = s.setup_id and r.user_id = s.shared_by
  where p_code ~ '^[A-Za-z0-9]{8}$' and s.share_code = p_code and s.is_public
    and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;
revoke all on function onlyfast_private.redeem_setup_share(text) from public;
grant usage on schema onlyfast_private to anon;
grant execute on function onlyfast_private.redeem_setup_share(text) to anon, authenticated;
create or replace function public.redeem_setup_share(p_code text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select onlyfast_private.redeem_setup_share(p_code);
$$;
revoke all on function public.redeem_setup_share(text) from public;
grant execute on function public.redeem_setup_share(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
