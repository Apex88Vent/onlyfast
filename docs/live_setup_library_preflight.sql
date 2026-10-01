-- Read-only. Run as project administrator in the verified production project.
select jsonb_build_object(
  'migration_history', (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version)
    from supabase_migrations.schema_migrations),
  'prerequisites', jsonb_build_object(
    'active_class_getter', to_regprocedure('public.get_active_race_class_state()') is not null,
    'initialize_class', to_regprocedure('public.initialize_active_race_class(text)') is not null,
    'change_class', to_regprocedure('public.change_active_race_class(text)') is not null,
    'beta_accounts', to_regclass('public.beta_tester_accounts') is not null,
    'feature_flags', to_regclass('public.user_feature_flags') is not null,
    'race_setups', to_regclass('public.race_setups') is not null,
    'user_subscriptions', to_regclass('public.user_subscriptions') is not null),
  'canonical_definition', pg_get_functiondef(to_regprocedure('public.onlyfast_canonical_race_class(text)')),
  'development_gate_present', to_regprocedure('public.onlyfast_can_use_setup_library()') is not null,
  'test_account', (select jsonb_build_object(
    'id',u.id, 'email',u.email,
    'onboarding_completed',u.raw_user_meta_data->'onboarding_completed',
    'auth_metadata_fingerprint',md5(u.raw_user_meta_data::text || u.raw_app_meta_data::text),
    'is_test_account',b.is_test_account, 'beta_features_enabled',b.beta_features_enabled, 'tester_kind',b.tester_kind,
    'flags',(select jsonb_agg(jsonb_build_object('feature_key',f.feature_key,'enabled',f.enabled) order by f.feature_key) from public.user_feature_flags f where f.user_id=u.id),
    'setup_count',(select count(*) from public.race_setups r where r.user_id=u.id),
    'active_class',(select s.active_race_class from public.user_subscriptions s where s.user_id=u.id))
    from auth.users u left join public.beta_tester_accounts b on b.user_id=u.id where lower(u.email)='test@test.com'),
  'normal_account_id',(select u.id from auth.users u
    where lower(coalesce(u.email,'')) <> 'test@test.com'
      and public.onlyfast_subscription_tier(u.id) in ('rookie','pro')
      and not exists (select 1 from public.beta_tester_accounts b join public.user_feature_flags f using(user_id)
        where b.user_id=u.id and b.is_test_account and b.beta_features_enabled and b.tester_kind='experimental'
          and f.feature_key='test_account_full_access' and f.enabled)
    order by u.created_at limit 1),
  'rls', (select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('race_setups','user_subscriptions','beta_tester_accounts','user_feature_flags'))
) as preflight;
