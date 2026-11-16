-- Server-only moderation access; no browser/anonymous grants. TESTING ONLY.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end $$;
grant usage on schema onlyfast_private to service_role;
commit;
