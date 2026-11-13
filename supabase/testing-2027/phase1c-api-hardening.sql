-- Testing-only follow-up to the hash-verified 23-file bootstrap.
begin;
do $$
begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end;
$$;

-- Canonicalization calls the server-owned setup-library resolver. Anonymous
-- callers do not need that RPC. Trigger functions are never client RPCs.
revoke execute on function public.onlyfast_canonical_race_class(text) from public, anon;
revoke execute on function public.onlyfast_guard_development_setup_class() from public, anon, authenticated;

-- Quota counters are server-written; signed-in users can inspect only their own.
create policy timing_scan_usage_owner_read on public.timing_scan_usage
  for select to authenticated using ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
commit;
