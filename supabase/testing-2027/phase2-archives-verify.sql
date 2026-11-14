-- Read-only post-install checks. Every boolean must be true before deployment.
-- These catalog checks supplement real synthetic-account hosted acceptance.
select
  public.get_onlyfast_2027_environment()->>'project_ref' = 'mfzajhnfonrfuiwxgvhe' as testing_project,
  to_regclass('onlyfast_private.setup_archives') is not null
    and to_regclass('onlyfast_private.setup_archive_events') is not null
    and to_regclass('onlyfast_private.class_selection_2027') is not null as archive_metadata_installed,
  to_regprocedure('public.set_onlyfast_setup_archive(uuid,boolean)') is not null
    and to_regprocedure('onlyfast_private.require_track_trace_history()') is not null as both_layers_installed,
  not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','onlyfast_private') and c.relkind='r' and not c.relrowsecurity) as all_application_tables_rls,
  not exists(select 1 from information_schema.role_table_grants
    where table_schema='onlyfast_private' and grantee in ('PUBLIC','anon','authenticated')) as private_tables_not_browser_granted,
  not exists(select 1 from pg_policies where schemaname='public' and policyname='track_trace_entitlement') as combined_entitlement_removed,
  (select count(*)=48 from pg_policies where schemaname='public'
    and policyname in ('track_trace_history','track_trace_record','track_trace_modify','track_trace_delete')
    and permissive='RESTRICTIVE' and roles::text='{authenticated}') as twelve_tables_read_write_separated,
  (select count(*)=3 from pg_policies where schemaname='public'
    and tablename='onlyfast_onlylaps_session_links' and policyname like 'track_trace_link_setup_%'
    and permissive='RESTRICTIVE') as phase2b_link_policies_retained,
  (select count(*)=9 from pg_policies where schemaname='public' and policyname in
    ('phase2_archive_contents','phase2_link_parent_read','phase2_shared_parent_read','phase2_timing_read',
     'phase2_analysis_read','phase2_laps_read','phase2_sectors_read','phase2_samples_read','phase2_telemetry_share')
    and permissive='RESTRICTIVE') as archive_policies_installed,
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='onlyfast_private' and p.proname in
      ('setup_archived_at','active_setup_counts','setup_access_for_owner','assert_2027_setup_write','assert_track_trace_write_2027')
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) as internal_owner_helpers_denied,
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('onlyfast_set_onlylaps_session_link','onlyfast_unlink_onlylaps_session')
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) as service_link_rpcs_not_browser_executable;
