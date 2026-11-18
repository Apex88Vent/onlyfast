-- PREPARED ONLY: additive testing migration. Never run db push for this artifact.
-- Order: installed Phase 3B subscriptions, then account-access compatibility.
begin;
set local time zone 'UTC';
do $guard$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe'
    or not exists(select 1 from onlyfast_private.testing_2027_environment where project_ref='mfzajhnfonrfuiwxgvhe') then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if to_regprocedure('public.billing2027_apply_snapshot(uuid,jsonb,text,text)') is null
    or to_regprocedure('onlyfast_private.billing2027_needs_class(uuid)') is null then
    raise exception 'PHASE3B_REQUIRED';
  end if;
  if to_regprocedure('public.billing2027_trial_evidence(uuid)') is not null then
    raise exception 'PHASE3E_ALREADY_INSTALLED';
  end if;
end $guard$;

-- New acquisition registry IDs are the audited RevenueCat catalog IDs. No
-- existing row is updated/deleted; any identity conflict aborts the transaction.
insert into onlyfast_private.billing2027_products
  (id,provider,environment,app_id,store,product_id,base_plan,interval,tier,entitlement,legacy,enabled,intro_days,duration_verified)
values
 ('prod94524e0912','revenuecat','sandbox','app82192c9834','app_store','app.onlyfast.2027.sportsman','','month','sportsman','OnlyFast Sportsman',false,true,0,true),
 ('prod01fa8df53f','revenuecat','sandbox','appd348665a60','play_store','onlyfast2027sportsman:monthly','monthly','month','sportsman','OnlyFast Sportsman',false,true,0,true),
 ('prod6cb1efb920','revenuecat','sandbox','app82192c9834','app_store','app.onlyfast.2027.pro_monthly','','month','pro','OnlyFast Pro',false,true,14,true),
 ('prodb72565e303','revenuecat','sandbox','appd348665a60','play_store','onlyfast2027promonthly:monthly','monthly','month','pro','OnlyFast Pro',false,true,14,true),
 ('prodc0b7d866be','revenuecat','sandbox','app82192c9834','app_store','app.onlyfast.2027.pro_annual','','year','pro','OnlyFast Pro',false,true,14,true),
 ('prod2e5726de34','revenuecat','sandbox','appd348665a60','play_store','onlyfast2027proannual:annual','annual','year','pro','OnlyFast Pro',false,true,14,true),
 ('prod97071559b6','revenuecat','sandbox','app82192c9834','app_store','app.onlyfast.2027.factory','','month','factory','OnlyFast Teams',false,true,0,true),
 ('prod883c88a2f5','revenuecat','sandbox','appd348665a60','play_store','onlyfast2027factory:monthly','monthly','month','factory','OnlyFast Teams',false,true,0,true);

-- Evidence is stored atomically with successful native snapshot application in
-- the existing private event ledger. No new table or shared policy is needed.
create function public.billing2027_trial_evidence(p_uid uuid) returns jsonb
language sql stable security definer set search_path='' as $body$
  select coalesce(jsonb_agg(e.evidence->'sandbox_trial'),'[]'::jsonb)
  from onlyfast_private.billing2027_events e
  where e.provider='revenuecat' and e.user_id=p_uid and e.outcome='applied'
    and e.evidence ? 'sandbox_trial';
$body$;

create function public.billing2027_apply_native_snapshot(p_uid uuid,p_snapshot jsonb,p_event_id text,p_event_type text,p_trials jsonb)
returns text language plpgsql security definer set search_path='' as $body$
declare outcome text; trial jsonb;
begin
  if p_snapshot->>'provider' is distinct from 'revenuecat' or p_snapshot->>'environment' is distinct from 'sandbox'
    or jsonb_typeof(p_trials) is distinct from 'array' or jsonb_array_length(p_trials)>1 then
    raise exception 'INVALID_NATIVE_EVIDENCE';
  end if;
  if jsonb_array_length(p_trials)=1 then
    trial:=p_trials->0;
    if trial->>'user_id' is distinct from p_uid::text or trial->>'event_id' is distinct from p_event_id
      or p_event_type is distinct from 'INITIAL_PURCHASE' or trial->>'type' is distinct from 'INITIAL_PURCHASE'
      or trial->>'environment' is distinct from 'SANDBOX' or trial->>'period_type' is distinct from 'TRIAL'
      or not exists(select 1 from jsonb_array_elements(p_snapshot->'subscriptions') s
        join onlyfast_private.billing2027_products p on p.id=s->>'registry_id'
        where p.environment='sandbox' and p.tier='pro' and not p.legacy
          and p.product_id=trial->>'product_id' and p.app_id=trial->>'app_id'
          and s->>'transaction_id'=trial->>'transaction_id'
          and (s->>'trial_ends_at')::timestamptz=to_timestamp((trial->>'expiration_at_ms')::numeric/1000)) then
      raise exception 'MISMATCHED_NATIVE_EVIDENCE';
    end if;
  end if;
  outcome:=public.billing2027_apply_snapshot(p_uid,p_snapshot,p_event_id,p_event_type);
  if outcome='applied' and trial is not null then
    update onlyfast_private.billing2027_events set evidence=jsonb_build_object('sandbox_trial',trial)
    where provider='revenuecat' and event_id=p_event_id and user_id=p_uid;
  end if;
  return outcome;
end $body$;
revoke all on function public.billing2027_trial_evidence(uuid),public.billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.billing2027_trial_evidence(uuid),public.billing2027_apply_native_snapshot(uuid,jsonb,text,text,jsonb) to service_role;
commit;
