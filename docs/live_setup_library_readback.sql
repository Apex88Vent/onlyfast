-- Read-only verification of the committed QA rows. Run in production project
-- thpyjvwtfvfxiufchrxn. The role and JWT claims last only until ROLLBACK.
select version,name from supabase_migrations.schema_migrations
where version in ('20260929','20260930','20261001') order by version;

select u.id,b.is_test_account,b.beta_features_enabled,b.tester_kind,
  f.enabled as test_account_full_access,
  md5(u.raw_user_meta_data::text || u.raw_app_meta_data::text) as auth_metadata_fingerprint
from auth.users u
join public.beta_tester_accounts b on b.user_id=u.id
join public.user_feature_flags f on f.user_id=u.id and f.feature_key='test_account_full_access'
where u.id='4b9864ff-2195-4be0-83a4-39308446577e';

begin;
select set_config('request.jwt.claim.sub','4b9864ff-2195-4be0-83a4-39308446577e',true);
select set_config('request.jwt.claims','{"sub":"4b9864ff-2195-4be0-83a4-39308446577e","role":"authenticated"}',true);
set local role authenticated;
select jsonb_build_object(
  'user_id',auth.uid(),
  'development_access',public.onlyfast_can_use_setup_library(),
  'class_state',public.get_active_race_class_state(),
  'designation',(select to_jsonb(b) - 'created_at' - 'updated_at'
    from public.beta_tester_accounts b where b.user_id=auth.uid()),
  'full_access_flag',(select f.enabled from public.user_feature_flags f
    where f.user_id=auth.uid() and f.feature_key='test_account_full_access'),
  'total_setups',(select count(*) from public.race_setups where user_id=auth.uid()),
  'qa_rows',(select jsonb_agg(jsonb_build_object(
    'id',r.id,'setup_name',r.setup_name,'race_class',r.race_class,
    'populated_values',(select jsonb_object_agg(key,value)
      from jsonb_each(r.custom_fields#>'{onlyfast_setup_library_v1,values}')
      where value<>'""'::jsonb)) order by r.setup_name)
    from public.race_setups r
    where r.user_id=auth.uid() and r.setup_name like 'LIVE QA - % - 20261001')
) as persisted_qa;
rollback;
