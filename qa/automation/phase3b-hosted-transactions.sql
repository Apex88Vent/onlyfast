-- Hosted TESTING acceptance only. Existing synthetic identities, no provider IO.
-- Every clock, role, registry and fixture mutation is inside a rolled-back
-- subtransaction. No changed clock or grant is committed/visible to other sessions.
create temporary table phase3b_acceptance_namespace(x integer);
create function pg_temp.phase3b_acceptance() returns jsonb language plpgsql as $acceptance$
declare
  uid uuid:='6109dc9b-9553-45dc-8cd6-fb1fe2e30247';
  other_uid uuid:='5ddd8687-5c01-4bd9-8281-d61065162bb2';
  checks jsonb:='[]'; snapshots jsonb:='{}'; result jsonb;
  s jsonb; c jsonb; first_claim jsonb; item jsonb; snap jsonb; answer text;
  before_clock text; i integer; rejected boolean; at_time timestamptz;
begin
  assert public.get_onlyfast_2027_environment()->>'project_ref'='mfzajhnfonrfuiwxgvhe','Wrong testing project';
  assert exists(select 1 from auth.users where id=uid and email like 'of27-unprivileged-%@onlyfast.app'),'Existing synthetic account required';
  assert exists(select 1 from auth.users where id=other_uid and email like 'of27-pro-%@onlyfast.app'),'Existing synthetic peer required';
  select prosrc into before_clock from pg_proc where oid='onlyfast_private.billing2027_now()'::regprocedure;
  begin
    -- Disable only this synthetic account's override INSIDE this subtransaction.
    update public.beta_tester_accounts set beta_features_enabled=false where user_id in (uid,other_uid);
    insert into onlyfast_private.billing2027_cohorts(user_id,cohort,eligible,captured_at,evidence)
      values(uid,'rookie',true,'2026-12-31T00:00:00Z','{"source":"synthetic_hosted_acceptance"}')
      on conflict(user_id,cohort) do update set eligible=true;
    execute $clock$create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='' as $body$ select '2027-01-01T08:00:00Z'::timestamptz $body$$clock$;
    perform set_config('request.jwt.claim.sub',uid::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='rookie' and (s->>'claim_eligible')::boolean,'Eligible Rookie transition';
    snapshots:=snapshots||jsonb_build_object('rookie',s);checks:=checks||'"Existing Rookie transition and claim eligibility"';
    perform set_config('request.jwt.claim.sub',other_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
    rejected:=false;begin perform public.claim_onlyfast_2027_sportsman();exception when insufficient_privilege then rejected:=SQLERRM like '%ROOKIE_PROMOTION_NOT_ELIGIBLE%';end;
    assert rejected,'Prelaunch cohort proof required';checks:=checks||'"Account without prelaunch eligibility evidence cannot claim"';
    perform set_config('request.jwt.claim.sub',uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    first_claim:=public.claim_onlyfast_2027_sportsman();
    assert (first_claim->>'expires_at')::timestamptz-(first_claim->>'claimed_at')::timestamptz=interval '720 hours','Exact 30 days';
    for i in 1..8 loop c:=public.claim_onlyfast_2027_sportsman();assert (c->>'repeated')::boolean and c->>'expires_at'=first_claim->>'expires_at','Duplicate extended grant';end loop;
    s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='sportsman','Sportsman grant';
    snapshots:=snapshots||jsonb_build_object('sportsman_promotion',s);checks:=checks||'"One idempotent 30-day claim across eight retries"';
    assert not onlyfast_private.track_trace_enabled(),'Sportsman recording must be denied';checks:=checks||'"Sportsman new recording denied"';
    execute 'reset role';
    assert (select count(*)=1 from onlyfast_private.billing2027_claims where user_id=uid),'Single claim row';
    assert not exists(select 1 from onlyfast_private.billing2027_provider_state where user_id=uid),'Promotion did not create provider subscription';
    checks:=checks||'"Promotion creates no billing subscription"';
    execute $clock$create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='' as $body$ select '2027-01-31T08:00:00Z'::timestamptz $body$$clock$;
    execute 'set local role authenticated';s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='unsubscribed','Promotion expiration';
    snapshots:=snapshots||jsonb_build_object('expired',s);checks:=checks||'"Promotional expiry becomes historical read-only"';
    execute 'reset role';
    -- Separate peer tests the exact last accepted claim boundary.
    insert into onlyfast_private.billing2027_cohorts(user_id,cohort,eligible,captured_at,evidence)
      values(other_uid,'rookie',true,'2026-12-31T00:00:00Z','{"source":"synthetic_hosted_acceptance"}') on conflict(user_id,cohort) do update set eligible=true;
    perform set_config('request.jwt.claim.sub',other_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    rejected:=false;begin perform public.claim_onlyfast_2027_sportsman();exception when insufficient_privilege then rejected:=SQLERRM like '%CLAIM_WINDOW_CLOSED%';end;
    assert rejected,'Claim cutoff is half-open';checks:=checks||'"New claim rejected exactly at January 31 cutoff"';execute 'reset role';
    execute $clock$create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='' as $body$ select '2027-01-31T07:59:59.999999Z'::timestamptz $body$$clock$;
    perform set_config('request.jwt.claim.sub',other_uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    c:=public.claim_onlyfast_2027_sportsman();assert (c->>'claimed_at')::timestamptz='2027-01-31T07:59:59.999999Z'::timestamptz,'Last microsecond';
    checks:=checks||'"Last microsecond before claim cutoff accepted"';
    execute 'reset role';
    -- New acquisition IDs below exist ONLY inside this rollback fixture.
    insert into onlyfast_private.billing2027_products(id,provider,environment,app_id,store,product_id,interval,tier,entitlement,legacy,enabled,intro_days,duration_verified) values
      ('hosted_pro_month','revenuecat','sandbox','app82192c9834','app_store','synthetic.pro.month','month','pro','OnlyFast Pro',false,true,14,true),
      ('hosted_pro_year','revenuecat','sandbox','app82192c9834','app_store','synthetic.pro.year','year','pro','OnlyFast Pro',false,true,14,true),
      ('hosted_legacy_cad','stripe','sandbox','acct_synthetic','stripe','price_synthetic_legacy','month','pro',null,true,true,0,true);
    perform set_config('request.jwt.claim.sub',uid::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    for i in 1..2 loop
      at_time:='2027-02-01T08:00:00Z'::timestamptz+make_interval(secs=>i);
      execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
      item:=jsonb_build_object('registry_id',case i when 1 then 'hosted_pro_month' else 'hosted_pro_year' end,'provider_key','synthetic_pro','lineage_id',null,'transaction_id','synthetic-pro-'||i,
        'status','trialing','started_at',at_time,'expires_at',at_time+interval '336 hours','trial_ends_at',at_time+interval '336 hours','will_renew',true,'price_amount',null,'price_unit','major','currency',null);
      snap:=jsonb_build_object('provider','revenuecat','environment','sandbox','observed_at',at_time,'subscriptions',jsonb_build_array(item));
      execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(uid,snap,'synthetic-trial-'||i,'SYNTHETIC_FIXTURE');assert answer='applied','Apply trial';
      execute 'reset role';execute 'set local role authenticated';s:=public.get_onlyfast_2027_billing_status();
      assert s->>'tier'='pro' and s->>'status'='trialing' and s->>'interval'=case i when 1 then 'month' else 'year' end,'Pro trial tier/interval';
      assert (s->>'trial_ends_at')::timestamptz-at_time=interval '336 hours','14-day provider trial';
      assert onlyfast_private.track_trace_enabled(),'Pro recording allowed';
      snapshots:=snapshots||jsonb_build_object(case i when 1 then 'pro_monthly_trial' else 'pro_annual_trial' end,s);
      execute 'reset role';
    end loop;
    checks:=checks||'"Monthly and annual synthetic Pro trial projections: identical Pro recording access, verified 14-day dates"';
    at_time:=at_time+interval '1 second';execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    item:=item||jsonb_build_object('will_renew',false);snap:=snap||jsonb_build_object('observed_at',at_time,'subscriptions',jsonb_build_array(item));
    execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(uid,snap,'synthetic-canceled-trial','CANCELLATION');
    answer:=public.billing2027_apply_snapshot(uid,snap,'synthetic-canceled-trial','DUPLICATE');assert answer='duplicate','Callback dedup';
    execute 'reset role';execute 'set local role authenticated';s:=public.get_onlyfast_2027_billing_status();
    assert s->>'tier'='pro' and not (s->>'will_renew')::boolean,'Canceled trial retains Pro';
    snapshots:=snapshots||jsonb_build_object('canceled_pro_trial',s);checks:=checks||'"Canceled trial retains access; duplicate callback is idempotent"';
    execute 'reset role';
    at_time:=(item->>'expires_at')::timestamptz;
    execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    execute 'set local role authenticated';s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='unsubscribed','Trial expires without callback';
    snapshots:=snapshots||jsonb_build_object('expired_pro_trial',s);checks:=checks||'"Trial expires without a callback; eligible history remains read-only"';execute 'reset role';
    -- Legacy Stripe price/region evidence: prelaunch observation then Jan 1.
    at_time:='2026-12-31T08:00:00Z';
    execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    item:=jsonb_build_object('registry_id','hosted_legacy_cad','provider_key','sub_synthetic','lineage_id','sub_synthetic','transaction_id',null,'status','active','started_at','2026-12-01T00:00:00Z','expires_at','2027-03-01T08:00:00Z','trial_ends_at',null,'will_renew',true,'price_amount',799,'price_unit','minor','currency','CAD');
    snap:=jsonb_build_object('provider','stripe','environment','sandbox','observed_at',at_time,'subscriptions',jsonb_build_array(item));
    execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(other_uid,snap,'synthetic-prelaunch','SYNTHETIC_FIXTURE');execute 'reset role';
    at_time:='2027-01-01T08:00:00Z';execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    snap:=snap||jsonb_build_object('observed_at',at_time);execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(other_uid,snap,'synthetic-launch','SYNTHETIC_FIXTURE');execute 'reset role';
    perform set_config('request.jwt.claim.sub',other_uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
    execute 'set local role authenticated';s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='pro' and (s->>'grandfathered')::boolean,'Legacy Pro protected';
    snapshots:=snapshots||jsonb_build_object('grandfathered_pro',s);execute 'reset role';
    assert exists(select 1 from onlyfast_private.billing2027_protection where user_id=other_uid and price_amount=799 and currency='CAD'),'Actual regional rate retained';
    checks:=checks||'"Legacy Pro maps to Pro at protected provider-specific CAD price"';
    at_time:='2027-01-02T08:00:00Z';execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    item:=item||jsonb_build_object('registry_id','apple_teams_sandbox','provider_key','synthetic-teams','lineage_id',null,'transaction_id','synthetic-teams-transaction','price_amount',7.99,'price_unit','major','currency','USD');
    snap:=jsonb_build_object('provider','revenuecat','environment','sandbox','observed_at',at_time,'subscriptions',jsonb_build_array(item));
    execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(other_uid,snap,'synthetic-teams','SYNTHETIC_FIXTURE');execute 'reset role';execute 'set local role authenticated';
    s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='factory' and onlyfast_private.track_trace_enabled(),'Legacy Teams Factory wins over web Pro';
    snapshots:=snapshots||jsonb_build_object('legacy_teams_factory',s);checks:=checks||'"Legacy Teams maps to Factory; higher native tier wins provider overlap"';execute 'reset role';
    at_time:=at_time+interval '1 second';execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    snap:=snap||jsonb_build_object('observed_at',at_time,'subscriptions','[]'::jsonb);
    execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(other_uid,snap,'synthetic-downgrade','EXPIRATION');execute 'reset role';execute 'set local role authenticated';
    s:=public.get_onlyfast_2027_account_access();assert s->>'tier'='pro' and (s->>'selection_required')::boolean and s->>'selection_required'=s->>'class_selection_required','Downgrade contract';
    checks:=checks||'"Effective Factory downgrade requires explicit class; old and new RPC fields agree"';execute 'reset role';
    at_time:='2028-01-01T08:00:00Z';execute format('create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='''' as $body$ select %L::timestamptz $body$',at_time);
    item:=item||jsonb_build_object('registry_id','hosted_legacy_cad','provider_key','sub_synthetic','lineage_id','sub_synthetic','transaction_id',null,'expires_at','2028-02-01T08:00:00Z','price_amount',799,'price_unit','minor','currency','CAD');
    snap:=jsonb_build_object('provider','stripe','environment','sandbox','observed_at',at_time,'subscriptions',jsonb_build_array(item));
    execute 'set local role service_role';answer:=public.billing2027_apply_snapshot(other_uid,snap,'synthetic-2028','SYNTHETIC_FIXTURE');execute 'reset role';execute 'set local role authenticated';
    s:=public.get_onlyfast_2027_billing_status();assert s->>'tier'='pro' and not(s->>'grandfathered')::boolean,'Protection end preserves paid access';
    snapshots:=snapshots||jsonb_build_object('paid_after_protection',s);checks:=checks||'"January 2028 protection end does not terminate paid Pro or change price"';
    rejected:=false;begin perform public.billing2027_registry();exception when insufficient_privilege then rejected:=true;end;assert rejected,'Browser registry denied';
    rejected:=false;begin perform public.onlyfast_subscription_tier(uid);exception when insufficient_privilege then rejected:=true;end;assert rejected,'Cross-account tier denied';
    checks:=checks||'"Authenticated role cannot manufacture registry/grants or query another account tier"';execute 'reset role';
    result:=jsonb_build_object('checks',checks,'snapshots',snapshots,'fixtures_rolled_back',true);
    raise exception using errcode='PZ001',message='ROLLBACK_ACCEPTANCE_FIXTURES';
  exception when sqlstate 'PZ001' then null;
  end;
  assert (select prosrc=before_clock from pg_proc where oid='onlyfast_private.billing2027_now()'::regprocedure),'Clock override survived rollback';
  return result;
end $acceptance$;
select pg_temp.phase3b_acceptance() as acceptance;
