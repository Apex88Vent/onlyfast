-- Repair the existing designation if test@test.com was created/recreated after
-- the beta feature migration ran. Does not enable reset or any unrelated flag.
-- Run after 20260930_add_development_setup_library.sql.
begin;

do $$
begin
  if not exists (select 1 from auth.users where lower(email) = 'test@test.com') then
    raise exception 'Designated OnlyFast test account test@test.com does not exist; no permissions changed';
  end if;
end;
$$;

insert into public.beta_tester_accounts (user_id, is_test_account, beta_features_enabled, tester_kind)
select id, true, true, 'experimental' from auth.users where lower(email) = 'test@test.com'
on conflict (user_id) do update set
  is_test_account = excluded.is_test_account,
  beta_features_enabled = excluded.beta_features_enabled,
  tester_kind = excluded.tester_kind;

insert into public.user_feature_flags (user_id, feature_key, enabled)
select id, 'test_account_full_access', true from auth.users where lower(email) = 'test@test.com'
on conflict (user_id, feature_key) do update set enabled = excluded.enabled;

notify pgrst, 'reload schema';
commit;
