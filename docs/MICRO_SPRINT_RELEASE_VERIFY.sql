-- Explicitly authorized current-version release verification. Run as the
-- database operator only. All synthetic users, subscriptions and setups roll
-- back; no Auth login/logout, test-account reset, email or store call occurs.
begin;
set local lock_timeout = '5s';
create temporary table micro_release_results(result jsonb);
do $verification$
declare
  v_normal uuid := gen_random_uuid();
  v_tester uuid;
  v_base uuid;
  v_copy uuid;
  v_race uuid;
  v_fields jsonb;
  v_state jsonb;
  v_class text;
  v_denied boolean;
begin
  -- Existing designated QA identity; authorization still requires the existing
  -- experimental designation AND full-access flag, never the identity alone.
  select b.user_id into v_tester from public.beta_tester_accounts b
    join public.user_feature_flags f on f.user_id=b.user_id
    where b.user_id='4b9864ff-2195-4be0-83a4-39308446577e'::uuid
      and b.is_test_account and b.beta_features_enabled and b.tester_kind='experimental'
      and f.feature_key='test_account_full_access' and f.enabled;
  if v_tester is null then raise exception 'DESIGNATED_EXPERIMENTAL_FIXTURE_REQUIRED'; end if;

  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(v_normal,'micro-release-'||v_normal::text||'@example.invalid','{}','{}');
  -- Synthetic ordinary Pro eligibility, entirely rolled back. No real billing
  -- customer, subscription provider, entitlement override or beta grant.
  insert into public.user_subscriptions(user_id,plan,status,subscription_source)
    values(v_normal,'pro','active','stripe');
  perform set_config('request.jwt.claim.sub',v_normal::text,true);
  set local role authenticated;
  if public.onlyfast_can_use_setup_library() then raise exception 'NORMAL_FIXTURE_MUST_NOT_BE_BETA'; end if;
  if public.onlyfast_canonical_race_class('micro_sprint') is distinct from 'micro_sprint' then raise exception 'NORMAL_MICRO_DENIED'; end if;
  if public.onlyfast_canonical_race_class('GT3') is not null then raise exception 'OLDER_LIBRARY_GATE_CHANGED'; end if;
  perform public.save_racing_onboarding_progress('discipline');
  perform public.save_racing_onboarding_progress('vehicle','dirt_oval');
  perform public.save_racing_onboarding_progress('plan','dirt_oval','micro_sprint');
  v_state := public.complete_racing_onboarding();
  if v_state->>'active_class' is distinct from 'micro_sprint'
    or v_state->>'onboarding_step' is distinct from 'complete'
    or (v_state->>'unlimited')::boolean then raise exception 'NORMAL_INITIALIZATION_FAILED'; end if;

  v_fields := jsonb_build_object('onlyfast_setup_library_v1',jsonb_build_object(
    'version',1,'race_class','micro_sprint','values',jsonb_build_object(
      'micro_configuration','winged','wing_angle','24','lf_cold_pressure','9.5')));
  insert into public.race_setups(user_id,setup_type,setup_name,race_class,custom_fields)
    values(v_normal,'base_template','Micro release QA base','micro_sprint',v_fields) returning id into v_base;
  update public.race_setups set custom_fields=jsonb_set(custom_fields,
    '{onlyfast_setup_library_v1,values,micro_configuration}','"non_winged"') where id=v_base;
  select custom_fields into v_fields from public.race_setups where id=v_base;
  if v_fields#>>'{onlyfast_setup_library_v1,values,micro_configuration}' is distinct from 'non_winged'
    or v_fields#>>'{onlyfast_setup_library_v1,values,wing_angle}' is distinct from '24' then raise exception 'WING_DATA_LOST'; end if;
  insert into public.race_setups(user_id,setup_type,setup_name,race_class,custom_fields)
    values(v_normal,'base_template','Micro release QA copy','micro_sprint',v_fields) returning id into v_copy;
  update public.race_setups set setup_name='Micro release QA renamed copy' where id=v_copy;
  select custom_fields into v_fields from public.race_setups where id=v_copy;
  if v_fields#>>'{onlyfast_setup_library_v1,values,wing_angle}' is distinct from '24' then raise exception 'COPY_WING_DATA_LOST'; end if;
  insert into public.race_setups(user_id,setup_type,setup_name,race_class,custom_fields,track_name,race_date)
    values(v_normal,'heat','Micro release QA race','micro_sprint',v_fields,'Micro release QA track',current_date) returning id into v_race;
  if not exists(select 1 from public.race_setups where id=v_race
    and custom_fields#>>'{onlyfast_setup_library_v1,values,micro_configuration}'='non_winged') then raise exception 'RACE_FROM_BASE_FAILED'; end if;
  update public.race_setups set custom_fields=jsonb_set(custom_fields,
    '{onlyfast_setup_library_v1,values,micro_configuration}','"winged"') where id=v_copy;
  if not exists(select 1 from public.race_setups where id=v_copy
    and custom_fields#>>'{onlyfast_setup_library_v1,values,wing_angle}'='24') then raise exception 'REACTIVATION_DATA_LOST'; end if;

  foreach v_class in array array['quarter_midget','junior_sprint','mini_dwarf'] loop
    if public.onlyfast_canonical_race_class(v_class) is not null
      or public.onlyfast_small_oval_class_allowed(v_class) then raise exception 'NORMAL_TEST_CLASS_EXPOSED:%',v_class; end if;
    v_denied := false;
    begin
      perform public.initialize_active_race_class(v_class);
    exception when others then
      if sqlerrm <> 'CLASS_INVALID' then raise; end if;
      v_denied := true;
    end;
    if not v_denied then raise exception 'NORMAL_RPC_BYPASS:%',v_class; end if;
    v_denied := false;
    begin
      insert into public.race_setups(user_id,setup_type,setup_name,race_class,custom_fields)
        values(v_normal,'base_template','Micro release forbidden fixture',v_class,
          jsonb_build_object('onlyfast_setup_library_v1',jsonb_build_object('version',1,'race_class',v_class,'values','{}'::jsonb)));
    exception when insufficient_privilege then v_denied := true;
    end;
    if not v_denied then raise exception 'NORMAL_DATABASE_BYPASS:%',v_class; end if;
  end loop;
  -- Existing class changes and cooldowns still apply to Micro Sprint users.
  perform public.change_active_race_class('Modified');
  v_denied := false;
  begin
    perform public.change_active_race_class('micro_sprint');
  exception when others then
    if sqlerrm not like 'CLASS_CHANGE_COOLDOWN:%' then raise; end if;
    v_denied := true;
  end;
  if not v_denied then raise exception 'MICRO_COOLDOWN_BYPASS'; end if;

  reset role;
  perform set_config('request.jwt.claim.sub',v_tester::text,true);
  set local role authenticated;
  foreach v_class in array array['micro_sprint','quarter_midget','junior_sprint','mini_dwarf'] loop
    if public.onlyfast_canonical_race_class(v_class) is distinct from v_class
      or not public.onlyfast_small_oval_class_allowed(v_class) then raise exception 'EXPERIMENTAL_CLASS_DENIED:%',v_class; end if;
  end loop;
  reset role;
  insert into micro_release_results values(jsonb_build_object(
    'normal_non_beta_micro',true,'normal_onboarding_complete',true,
    'base_save_reopen_copy_rename',true,'race_from_base',true,
    'wing_configuration_and_values_preserved',true,'normal_other_three_rpc_and_database_denied',true,
    'designated_experimental_all_four_allowed',true,'older_library_gate_preserved',true,
    'normal_class_cooldown_preserved',true,'fixture_writes','ROLLBACK'));
end;
$verification$;
select result from micro_release_results;
rollback;
