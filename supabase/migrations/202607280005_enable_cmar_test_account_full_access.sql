-- Promote the existing c_marin88@yahoo.com beta account through the canonical
-- OnlyFast beta tables so it receives the same test_account_full_access gate
-- used by the existing experimental test@test.com account.
--
-- Email is used only inside this administrator-run migration to resolve the
-- immutable auth.users.id. Runtime frontend and Edge Function authorization
-- continue to use owner IDs, beta_tester_accounts, and user_feature_flags.

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = 'c_marin88@yahoo.com'
  limit 1;

  if target_user_id is null then
    raise exception
      'Cannot enable test_account_full_access: auth user c_marin88@yahoo.com was not found'
      using errcode = '22023';
  end if;

  insert into public.beta_tester_accounts (
    user_id,
    is_test_account,
    beta_features_enabled,
    tester_kind
  )
  values (
    target_user_id,
    true,
    true,
    'experimental'
  )
  on conflict (user_id) do update
    set is_test_account = true,
        beta_features_enabled = true,
        tester_kind = 'experimental';

  insert into public.user_feature_flags (
    user_id,
    feature_key,
    enabled
  )
  values (
    target_user_id,
    'test_account_full_access',
    true
  )
  on conflict (user_id, feature_key) do update
    set enabled = true;
end;
$$;
