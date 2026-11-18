-- Read-only verification AFTER the prepared migration is separately installed.
set time zone 'UTC';
select public.get_onlyfast_2027_environment()->>'project_ref' as project_ref;
select 'eight_acquisition_products' as check_name,count(*)=8 and bool_and(environment='sandbox' and provider='revenuecat' and enabled and duration_verified) as passed
from onlyfast_private.billing2027_products where id in ('prod94524e0912','prod01fa8df53f','prod6cb1efb920','prodb72565e303','prodc0b7d866be','prod2e5726de34','prod97071559b6','prod883c88a2f5');
select 'legacy_registry_preserved' as check_name,count(*)=12 as passed from onlyfast_private.billing2027_products where legacy;
select 'native_application_service_only' as check_name,
  has_function_privilege('service_role','public.billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb)','EXECUTE') as passed;
select 'evidence_service_only' as check_name,
  has_function_privilege('service_role','public.billing2027_trial_evidence(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.billing2027_trial_evidence(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.billing2027_trial_evidence(uuid)','EXECUTE') as passed;
-- Also rerun phase3b-subscriptions-verify.sql and compare all 16 UTC aggregates
-- from phase3b-subscriptions-retention.sql before any hosted fixture mutation.
