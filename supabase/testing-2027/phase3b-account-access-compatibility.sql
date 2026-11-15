-- Forward-only testing compatibility repair; never reapply Phase 3B installation.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if (select md5(regexp_replace(replace(prosrc,E'\r\n',E'\n'),'[[:space:]]+',' ','g')) from pg_proc
    where oid=to_regprocedure('onlyfast_private.account_access_2027()')) is distinct from '9cf6ed4a3003589cc23409ef15829b83' then
    raise exception 'PHASE3B_ACCOUNT_ACCESS_SOURCE_DRIFT';
  end if;
end $$;
create or replace function onlyfast_private.account_access_2027()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tier',onlyfast_private.membership_tier(auth.uid()),
    'selection_required',s.required,'class_selection_required',s.required,
    'active_class',public.onlyfast_active_race_class(auth.uid()),
    'counts',s.counts,'active_counts',s.counts)
  from (select onlyfast_private.billing2027_needs_class(auth.uid()) or exists(
    select 1 from onlyfast_private.class_selection_2027 where user_id=auth.uid() and selection_required) as required,
    onlyfast_private.active_setup_counts(auth.uid()) as counts) s
  where auth.uid() is not null;
$$;
notify pgrst,'reload schema';
commit;
