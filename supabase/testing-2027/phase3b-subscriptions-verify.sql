-- Read-only post-install catalog verification. Expected project and every check=true.
set time zone 'UTC';
select public.get_onlyfast_2027_environment()->>'project_ref' as project_ref,
  public.get_onlyfast_2027_environment()->>'project_ref'='mfzajhnfonrfuiwxgvhe' as exact_testing_project;
select 'private_tables_rls_and_browser_denial' as check_name,count(*)=9 and bool_and(c.relrowsecurity
  and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) as passed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='onlyfast_private' and c.relkind='r' and c.relname like 'billing2027_%';
select 'service_only_provider_application' as check_name,
  has_function_privilege('service_role','public.billing2027_apply_snapshot(uuid,jsonb,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.billing2027_apply_snapshot(uuid,jsonb,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.billing2027_apply_snapshot(uuid,jsonb,text,text)','EXECUTE') as passed;
select 'authenticated_claim_and_own_status_only' as check_name,
  has_function_privilege('authenticated','public.claim_onlyfast_2027_sportsman()','EXECUTE')
  and has_function_privilege('authenticated','public.get_onlyfast_2027_billing_status()','EXECUTE')
  and not has_function_privilege('anon','public.claim_onlyfast_2027_sportsman()','EXECUTE')
  and not has_function_privilege('anon','public.get_onlyfast_2027_billing_status()','EXECUTE') as passed;
select 'all_legacy_mobile_ids_retained' as check_name,count(*)=8 as passed
from onlyfast_private.billing2027_products where legacy and provider='revenuecat';
select 'stripe_history_kept_and_unresolved_prices_disabled' as check_name,
  count(*)=4 and count(*) filter(where enabled)=2 as passed
from onlyfast_private.billing2027_products where provider='stripe' and environment='production';
select 'no_unverified_new_acquisition_products' as check_name,not exists(
  select 1 from onlyfast_private.billing2027_products where not legacy and (not duration_verified or product_id='')) as passed;
select 'no_factory_or_sportsman_annual' as check_name,not exists(
  select 1 from onlyfast_private.billing2027_products where interval='year' and tier<>'pro') as passed;
select 'shared_membership_and_class_contracts_present' as check_name,
  to_regprocedure('public.get_onlyfast_membership()') is not null
  and to_regprocedure('onlyfast_private.billing2027_needs_class(uuid)') is not null
  and to_regprocedure('public.choose_onlyfast_2027_class(text)') is not null as passed;
select 'archive_and_historical_contracts_retained' as check_name,
  to_regclass('onlyfast_private.setup_archives') is not null
  and to_regprocedure('public.set_onlyfast_setup_archive(uuid,boolean)') is not null
  and to_regprocedure('onlyfast_private.require_track_trace_history()') is not null
  and to_regprocedure('onlyfast_private.track_trace_enabled()') is not null as passed;
select 'claim_advisory_lock_precedes_row_read' as check_name,
  strpos(pg_get_functiondef('onlyfast_private.billing2027_claim(uuid)'::regprocedure),'pg_advisory_xact_lock')
  < strpos(pg_get_functiondef('onlyfast_private.billing2027_claim(uuid)'::regprocedure),'select * into c') as passed;
select 'no_price_increase_cron' as check_name,not exists(
  select 1 from cron.job where jobname ilike '%billing2027%' or jobname ilike '%phase3b%' or jobname ilike '%price%increase%') as passed;
-- Operational next checks: rerun retention and compare every UTC count/hash;
-- authenticate synthetic accounts for status/claim and permission acceptance only AFTER separate deployment approval.
