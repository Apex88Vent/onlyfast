-- Forward-only M3 correction. Remove obsolete permissive read paths, never
-- restore direct public reads or alter owner checks, functions, quotas or data.
begin;
set local lock_timeout = '10s';
set local search_path = public, pg_catalog;
do $$
begin
  if (select count(*) from pg_policy
      where polrelid='public.race_setups'::regclass and polcmd='r'
        and polpermissive and polroles=array[0::oid] and polwithcheck is null
        and ((polname='race_setups_select_via_share'
          and md5(pg_get_expr(polqual,polrelid))='c32be996bd25ef30a16ff0c5a205ac7b')
          or (polname='race_setups_select_via_unexpired_public_share'
          and md5(pg_get_expr(polqual,polrelid))='ce9b15562396ba3f8e3079ea1a5437f8'))) <> 2
    or (select count(*) from pg_policy where not polpermissive
      and polroles=array['authenticated'::regrole::oid]
      and ((polrelid='public.race_setups'::regclass
        and ((polname='phase1_setup_owner_read' and polcmd='r')
          or (polname='phase1_setup_owner_write' and polcmd='*'))
        and md5(pg_get_expr(polqual,polrelid))='6a6b7c2a3a520c44377894171204e8d2')
        or (polrelid='public.shared_setups'::regclass
        and ((polname='phase1_share_owner_read' and polcmd='r')
          or (polname='phase1_share_owner_write' and polcmd='*'))
        and md5(pg_get_expr(polqual,polrelid))='b103839d3d367422fef2fa7303322daf'))) <> 4
    or not exists(select 1 from pg_policy where polrelid='public.race_setups'::regclass
      and polname='race_setups_select_own' and polcmd='r' and polpermissive)
    or not exists(select 1 from pg_policy where polrelid='public.shared_setups'::regclass
      and polname='shared_setups_select_own' and polcmd='r' and polpermissive)
    or to_regprocedure('public.redeem_setup_share(text)') is null
    or to_regprocedure('onlyfast_private.redeem_setup_share(text)') is null
    or has_table_privilege('anon','public.race_setups','SELECT')
    or has_table_privilege('anon','public.shared_setups','SELECT') then
    raise exception 'PHASE1_SHARING_POLICY_PREFLIGHT_REQUIRED';
  end if;
end;
$$;
drop policy race_setups_select_via_share on public.race_setups;
drop policy race_setups_select_via_unexpired_public_share on public.race_setups;
commit;
