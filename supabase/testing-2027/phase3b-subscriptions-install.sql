-- REVIEW ARTIFACT ONLY. Do not run against production or auto-install/deploy.
-- Apply once AFTER Phase 1C/API hardening, Track Trace foundation/2B and Phase 2 archives/history.
begin;
set local time zone 'UTC';
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe'
    or not exists(select 1 from onlyfast_private.testing_2027_environment where project_ref='mfzajhnfonrfuiwxgvhe') then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if to_regclass('onlyfast_private.setup_archives') is null
    or to_regprocedure('onlyfast_private.require_track_trace_history()') is null
    or to_regprocedure('onlyfast_private.can_write_class_2027(uuid,text)') is null then
    raise exception 'PHASE2_ARCHIVES_HISTORY_REQUIRED';
  end if;
  if to_regclass('onlyfast_private.billing2027_products') is not null then raise exception 'PHASE3B_ALREADY_INSTALLED'; end if;
  -- Whitespace-normalized source fingerprints read from the explicit testing
  -- catalog. Stop rather than overwrite any later Track Trace/membership work.
  if exists(select 1 from (values
    ('onlyfast_private.membership_tier(uuid)','3c38be05d114ef5fe56322179cd58422'),
    ('onlyfast_private.can_write_class_2027(uuid,text)','0597be18eaac74712bd3bfcb2060c0d5'),
    ('onlyfast_private.choose_2027_class(text)','0e8ca0980c240ab2c8666b3302f9c76e'),
    ('onlyfast_private.account_access_2027()','b4fd75e7fe63ef4ffd153fbbb2798d4d')
  ) expected(signature,fingerprint) where (select md5(regexp_replace(replace(p.prosrc,E'\r\n',E'\n'),'[[:space:]]+',' ','g'))
    from pg_proc p where p.oid=to_regprocedure(expected.signature)) is distinct from expected.fingerprint) then
    raise exception 'SHARED_MEMBERSHIP_SOURCE_DRIFT_REVIEW_REQUIRED';
  end if;
end $$;

create table onlyfast_private.billing2027_products (
  id text primary key, provider text not null check(provider in ('revenuecat','stripe')),
  environment text not null check(environment in ('sandbox','production')),
  app_id text not null, store text not null check(store in ('app_store','play_store','stripe')),
  product_id text not null, base_plan text not null default '',
  interval text not null check(interval in ('month','year')),
  tier text not null check(tier in ('sportsman','pro','factory')),
  entitlement text, legacy boolean not null, enabled boolean not null default false,
  intro_days integer not null default 0, duration_verified boolean not null default false,
  unique(provider,environment,app_id,store,product_id,base_plan),
  check(interval<>'year' or tier='pro'),
  check(intro_days=case when not legacy and tier='pro' then 14 else 0 end),
  check(provider<>'revenuecat' or nullif(entitlement,'') is not null),
  check(provider<>'revenuecat' or tier<>'sportsman' or entitlement not in ('OnlyFast Pro','OnlyFast Teams'))
);
-- Verified legacy IDs only. New acquisition IDs remain unconfigured, not invented.
insert into onlyfast_private.billing2027_products
  (id,provider,environment,app_id,store,product_id,base_plan,interval,tier,entitlement,legacy,enabled,duration_verified)
select k||'_'||e,'revenuecat',e,app,store,sku,base,'month',tier,ent,true,true,true
from (values
  ('apple_pro','app82192c9834','app_store','app.onlyfast.pro.monthly','','pro','OnlyFast Pro'),
  ('apple_teams','app82192c9834','app_store','app.onlyfast.teams.monthly','','factory','OnlyFast Teams'),
  ('play_pro','appd348665a60','play_store','pro:pro','pro','pro','OnlyFast Pro'),
  ('play_teams','appd348665a60','play_store','teams:teams','teams','factory','OnlyFast Teams')
) v(k,app,store,sku,base,tier,ent) cross join (values('sandbox'),('production')) env(e);
-- Apple legacy duration is the established legacy compatibility contract, not ASC certification.
-- Stripe live IDs are history references ONLY; sandbox endpoints cannot ingest production records.
insert into onlyfast_private.billing2027_products
  (id,provider,environment,app_id,store,product_id,interval,tier,legacy,enabled,duration_verified)
values
 ('stripe_legacy_pro','stripe','production','acct_1TZK26GEWZrPYXmK','stripe','price_1TdLgNGEWZrPYXmKdkpNb1EQ','month','pro',true,true,true),
 ('stripe_legacy_teams','stripe','production','acct_1TZK26GEWZrPYXmK','stripe','price_1TjNQBGEWZrPYXmKH5vSvdJB','month','factory',true,true,true),
 ('stripe_historical_teams_8','stripe','production','acct_1TZK26GEWZrPYXmK','stripe','price_1Tj1FXGEWZrPYXmKiyLHivYW','month','factory',true,false,true),
 ('stripe_historical_teams_10','stripe','production','acct_1TZK26GEWZrPYXmK','stripe','price_1TdLgjGEWZrPYXmKXwFYPTPd','month','factory',true,false,true);

create table onlyfast_private.billing2027_cohorts (
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort text not null check(cohort in ('rookie','legacy_pro','legacy_team')),
  eligible boolean not null, captured_at timestamptz not null default now(),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  primary key(user_id,cohort)
);
create table onlyfast_private.billing2027_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null, expires_at timestamptz not null,
  check(expires_at=claimed_at+interval '720 hours'),
  check(claimed_at>='2027-01-01T08:00:00Z' and claimed_at<'2027-01-31T08:00:00Z')
);
create table onlyfast_private.billing2027_provider_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('revenuecat','stripe')), provider_key text not null,
  registry_id text not null references onlyfast_private.billing2027_products(id),
  lineage_id text, transaction_id text,
  status text not null check(status in ('active','trialing','grace','expired','refunded')),
  started_at timestamptz not null, expires_at timestamptz not null, trial_ends_at timestamptz,
  will_renew boolean, price_amount numeric check(price_amount>=0), price_unit text not null check(price_unit in ('major','minor')),
  currency text check(currency ~ '^[A-Z]{3}$'), observed_at timestamptz not null,
  primary key(user_id,provider,provider_key)
);
create index billing2027_provider_user_expiry on onlyfast_private.billing2027_provider_state(user_id,expires_at);
create table onlyfast_private.billing2027_receipt_owners (
  provider text not null, store text not null, receipt_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(provider,store,receipt_id)
);
create table onlyfast_private.billing2027_protection (
  user_id uuid not null references auth.users(id) on delete cascade, provider text not null, provider_key text not null,
  legacy_plan text not null, product_id text not null, lineage_id text,
  price_amount numeric, price_unit text not null, currency text,
  starts_at timestamptz not null default '2027-01-01T08:00:00Z',
  ends_at timestamptz not null default '2028-01-01T08:00:00Z',
  status text not null check(status in ('candidate','protected','lapsed','review_required')),
  notice_state text not null default 'not_scheduled', consent_state text not null default 'not_requested',
  evidence jsonb not null, updated_at timestamptz not null default now(),
  primary key(user_id,provider,provider_key),
  check(starts_at='2027-01-01T08:00:00Z' and ends_at='2028-01-01T08:00:00Z')
);
create table onlyfast_private.billing2027_events (
  provider text not null, event_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, observed_at timestamptz not null, processed_at timestamptz not null default now(),
  outcome text not null, evidence jsonb not null default '{}', primary key(provider,event_id,user_id)
);
create table onlyfast_private.billing2027_streams (
  user_id uuid not null references auth.users(id) on delete cascade, provider text not null,
  observed_at timestamptz not null, primary key(user_id,provider)
);
create table onlyfast_private.billing2027_projection (
  user_id uuid primary key references auth.users(id) on delete cascade,
  factory_seen_at timestamptz, class_selected_at timestamptz, updated_at timestamptz not null default now()
);
insert into onlyfast_private.billing2027_projection(user_id,factory_seen_at)
select user_id,now() from public.user_subscriptions where plan in ('team','teams') and status in ('active','trialing');

-- Every new table is private, RLS protected, and unavailable to browser roles.
do $$ declare n text; begin
  foreach n in array array['products','cohorts','claims','provider_state','receipt_owners','protection','events','streams','projection'] loop
    execute format('alter table onlyfast_private.billing2027_%I enable row level security',n);
    execute format('revoke all on onlyfast_private.billing2027_%I from public,anon,authenticated,service_role',n);
  end loop;
end $$;

create function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='' as $$ select now(); $$;
-- Preserve server-observed eligibility for accounts registered between review
-- installation and launch. Never infer eligibility from client metadata/clock.
create function onlyfast_private.billing2027_enroll_rookie() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if onlyfast_private.billing2027_now()<'2027-01-01T08:00:00Z' and new.created_at<'2027-01-01T08:00:00Z' then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
    insert into onlyfast_private.billing2027_cohorts(user_id,cohort,eligible,captured_at,evidence)
      values(new.id,'rookie',true,onlyfast_private.billing2027_now(),
        jsonb_build_object('account_created_at',new.created_at,'observed_free_at',onlyfast_private.billing2027_now(),'source','prelaunch_auth_insert'))
      on conflict do nothing;
  end if;
  return new;
end $$;
create trigger phase3b_prelaunch_rookie after insert on auth.users
  for each row execute function onlyfast_private.billing2027_enroll_rookie();
create function onlyfast_private.billing2027_tier(p_uid uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare t text; m jsonb; legacy_row public.user_subscriptions%rowtype; at_time timestamptz:=onlyfast_private.billing2027_now();
begin
  t:=onlyfast_private.test_subscription_tier(p_uid);
  if t is not null then return t; end if;
  if at_time<'2027-01-01T08:00:00Z' then
    t:=onlyfast_private.phase1_membership_tier(p_uid);
    return case when t='rookie' then 'unsubscribed' else t end;
  end if;
  select raw_app_meta_data into m from auth.users where id=p_uid;
  if m->>'has_admin_full_access'='true' then return 'admin'; end if;
  if nullif(m->>'promo_access_expires_at','') is null or
    (pg_input_is_valid(m->>'promo_access_expires_at','timestamptz') and (m->>'promo_access_expires_at')::timestamptz>at_time) then
    if m->>'promo_access_level' in ('team','teams','admin','admin_full_access') then return 'factory'; end if;
    if m->>'promo_access_level'='pro' then t:='pro'; end if;
  end if;
  select p.tier into t from onlyfast_private.billing2027_provider_state s
    join onlyfast_private.billing2027_products p on p.id=s.registry_id
    where s.user_id=p_uid and s.status in ('active','trialing','grace') and s.expires_at>at_time
      and p.enabled and p.environment='sandbox'
    order by case p.tier when 'factory' then 3 when 'pro' then 2 else 1 end desc,s.expires_at desc limit 1;
  -- Highest verified access wins. Never cancel a provider because another wins.
  if t='factory' then return t; end if;
  if (m->>'promo_access_level'='pro') and (nullif(m->>'promo_access_expires_at','') is null or
    (pg_input_is_valid(m->>'promo_access_expires_at','timestamptz') and (m->>'promo_access_expires_at')::timestamptz>at_time)) then return 'pro'; end if;
  -- Legacy server-owned facts remain compatible until that source is reconciled.
  select * into legacy_row from public.user_subscriptions where user_id=p_uid;
  if legacy_row.plan in ('pro','team','teams') and legacy_row.status in ('active','trialing') and
    not exists(select 1 from onlyfast_private.billing2027_streams st where st.user_id=p_uid and st.provider=case when legacy_row.subscription_source='revenuecat' then 'revenuecat' else 'stripe' end)
    and (case when legacy_row.subscription_source='revenuecat' then legacy_row.revenuecat_expires_at>at_time
      else legacy_row.current_period_end>at_time end) then
    if legacy_row.plan in ('team','teams') then return 'factory'; end if;
    if t is distinct from 'factory' then return 'pro'; end if;
  end if;
  if t in ('pro','sportsman') then return t; end if;
  if exists(select 1 from onlyfast_private.billing2027_claims c where c.user_id=p_uid and c.expires_at>at_time) then return 'sportsman'; end if;
  if at_time<'2027-01-31T08:00:00Z' and exists(select 1 from onlyfast_private.billing2027_cohorts c where c.user_id=p_uid and c.cohort='rookie' and c.eligible)
    and not exists(select 1 from onlyfast_private.billing2027_claims c where c.user_id=p_uid) then return 'rookie'; end if;
  return 'unsubscribed';
end $$;
create or replace function onlyfast_private.membership_tier(p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$ select onlyfast_private.billing2027_tier(p_user_id); $$;

create function onlyfast_private.billing2027_needs_class(p_uid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select onlyfast_private.membership_tier(p_uid) not in ('factory','team','admin') and
    exists(select 1 from onlyfast_private.billing2027_projection where user_id=p_uid
      and factory_seen_at is not null and (class_selected_at is null or class_selected_at<factory_seen_at));
$$;
create or replace function onlyfast_private.can_write_class_2027(p_uid uuid,p_class text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(onlyfast_private.membership_tier(p_uid) in ('factory','team','admin') or
    (onlyfast_private.membership_tier(p_uid)<>'unsubscribed' and not onlyfast_private.billing2027_needs_class(p_uid)
      and not exists(select 1 from onlyfast_private.class_selection_2027 where user_id=p_uid and selection_required)
      and nullif(trim(p_class),'') is not null
      and lower(trim(p_class))=lower(trim((select active_race_class from public.user_subscriptions where user_id=p_uid)))),false);
$$;
create or replace function onlyfast_private.choose_2027_class(p_class text)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); chosen text;
begin
  if uid is null then raise exception 'CLASS_AUTH_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if onlyfast_private.membership_tier(uid) in ('unsubscribed','factory','team','admin') then raise exception 'CLASS_SINGLE_TIER_REQUIRED' using errcode='42501'; end if;
  if not onlyfast_private.billing2027_needs_class(uid) and not exists(select 1 from onlyfast_private.class_selection_2027 where user_id=uid and selection_required) then
    raise exception 'DOWNGRADE_SELECTION_NOT_REQUIRED' using errcode='42501'; end if;
  chosen:=public.onlyfast_canonical_race_class(p_class);
  if chosen is null then raise exception 'CLASS_INVALID'; end if;
  insert into onlyfast_private.billing2027_projection(user_id,class_selected_at) values(uid,onlyfast_private.billing2027_now())
    on conflict(user_id) do update set class_selected_at=excluded.class_selected_at;
  update onlyfast_private.class_selection_2027 set selection_required=false where user_id=uid;
  update public.user_subscriptions set active_race_class=chosen,active_racing_discipline=public.onlyfast_race_discipline(chosen) where user_id=uid;
  return chosen;
end $$;
create or replace function onlyfast_private.account_access_2027()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tier',onlyfast_private.membership_tier(auth.uid()),
    'class_selection_required',onlyfast_private.billing2027_needs_class(auth.uid()) or exists(select 1 from onlyfast_private.class_selection_2027 where user_id=auth.uid() and selection_required),
    'active_counts',onlyfast_private.active_setup_counts(auth.uid())) where auth.uid() is not null;
$$;

-- Enrollment requires a PRELAUNCH server observation, not just a claimed creation date.
create function public.billing2027_capture_rookie_cohort() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if onlyfast_private.billing2027_now()>='2027-01-01T08:00:00Z' then raise exception 'PRELAUNCH_EVIDENCE_WINDOW_CLOSED'; end if;
  insert into onlyfast_private.billing2027_cohorts(user_id,cohort,eligible,evidence)
  select u.id,'rookie',true,jsonb_build_object('account_created_at',u.created_at,'observed_free_at',onlyfast_private.billing2027_now(),'source','auth_and_subscription_catalog')
    from auth.users u left join public.user_subscriptions s on s.user_id=u.id
    where u.created_at<'2027-01-01T08:00:00Z' and onlyfast_private.phase1_membership_tier(u.id)='rookie'
      and s.stripe_subscription_id is null and s.revenuecat_product_id is null
      and coalesce(s.plan,'free') in ('free','rookie')
    on conflict(user_id,cohort) do nothing;
  get diagnostics n=row_count; return n;
end $$;

create function public.billing2027_registry() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from onlyfast_private.billing2027_products p where environment='sandbox';
$$;
create function public.billing2027_stripe_owner(p_subscription_id text) returns uuid
language sql stable security definer set search_path='' as $$
  select user_id from public.user_subscriptions where stripe_subscription_id=p_subscription_id;
$$;

-- Service-only verified snapshot application. Advisory lock precedes EVERY row lock.
create function public.billing2027_apply_snapshot(p_uid uuid,p_snapshot jsonb,p_event_id text,p_event_type text)
returns text language plpgsql security definer set search_path='' as $$
declare at_time timestamptz:=onlyfast_private.billing2027_now(); obs timestamptz; prov text;
  item jsonb; p onlyfast_private.billing2027_products%rowtype; old_tier text; new_tier text; owner_id uuid;
begin
  if not exists(select 1 from auth.users where id=p_uid) then raise exception 'BILLING_USER_REQUIRED'; end if;
  prov:=p_snapshot->>'provider'; obs:=(p_snapshot->>'observed_at')::timestamptz;
  if prov not in ('stripe','revenuecat') or prov is null or p_snapshot->>'environment' is distinct from 'sandbox'
    or obs is null or obs>at_time+interval '5 minutes' or obs<at_time-interval '5 minutes'
    or jsonb_typeof(p_snapshot->'subscriptions') is distinct from 'array'
    or nullif(p_event_id,'') is null or nullif(p_event_type,'') is null then raise exception 'INVALID_BILLING_SNAPSHOT'; end if;
  if prov='stripe' and jsonb_array_length(p_snapshot->'subscriptions')<>1 then raise exception 'ONE_STRIPE_SUBSCRIPTION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
  if exists(select 1 from onlyfast_private.billing2027_events where provider=prov and event_id=p_event_id and user_id=p_uid) then return 'duplicate'; end if;
  if exists(select 1 from onlyfast_private.billing2027_streams where user_id=p_uid and provider=prov and observed_at>=obs) then
    insert into onlyfast_private.billing2027_events(provider,event_id,user_id,event_type,observed_at,processed_at,outcome)
      values(prov,p_event_id,p_uid,p_event_type,obs,at_time,'stale'); return 'stale'; end if;
  old_tier:=onlyfast_private.membership_tier(p_uid);
  -- Native snapshots are complete; Stripe events refresh one subscription only.
  if prov='revenuecat' then update onlyfast_private.billing2027_provider_state set status='expired',observed_at=obs where user_id=p_uid and provider=prov; end if;
  for item in select value from jsonb_array_elements(p_snapshot->'subscriptions') loop
    select * into p from onlyfast_private.billing2027_products where id=item->>'registry_id' and enabled and duration_verified and environment='sandbox' and provider=prov;
    if not found or item->>'status' not in ('active','trialing','grace','expired','refunded')
      or nullif(item->>'provider_key','') is null or nullif(item->>'expires_at','') is null
      or nullif(item->>'started_at','') is null then raise exception 'UNVERIFIED_BILLING_PRODUCT'; end if;
    if item->>'status'='trialing' and not p.legacy and (p.tier<>'pro' or p.intro_days<>14 or
      (item->>'trial_ends_at')::timestamptz is distinct from (item->>'expires_at')::timestamptz) then raise exception 'INVALID_PRO_TRIAL'; end if;
    if nullif(item->>'transaction_id','') is not null then
      insert into onlyfast_private.billing2027_receipt_owners values(prov,p.store,item->>'transaction_id',p_uid) on conflict do nothing;
      select user_id into owner_id from onlyfast_private.billing2027_receipt_owners where provider=prov and store=p.store and receipt_id=item->>'transaction_id';
      if owner_id<>p_uid then raise exception 'RECEIPT_ALREADY_LINKED_REVIEW_TRANSFER' using errcode='42501'; end if;
    end if;
    if nullif(item->>'lineage_id','') is not null then
      insert into onlyfast_private.billing2027_receipt_owners values(prov,p.store,'lineage:'||(item->>'lineage_id'),p_uid) on conflict do nothing;
      select user_id into owner_id from onlyfast_private.billing2027_receipt_owners where provider=prov and store=p.store and receipt_id='lineage:'||(item->>'lineage_id');
      if owner_id<>p_uid then raise exception 'RECEIPT_ALREADY_LINKED_REVIEW_TRANSFER' using errcode='42501'; end if;
    end if;
    -- No client request can write this record; only provider-verifying handlers call the RPC.
    insert into onlyfast_private.billing2027_provider_state values(p_uid,prov,item->>'provider_key',p.id,
      nullif(item->>'lineage_id',''),nullif(item->>'transaction_id',''),item->>'status',
      (item->>'started_at')::timestamptz,(item->>'expires_at')::timestamptz,(item->>'trial_ends_at')::timestamptz,
      (item->>'will_renew')::boolean,(item->>'price_amount')::numeric,item->>'price_unit',item->>'currency',obs)
    on conflict(user_id,provider,provider_key) do update set registry_id=excluded.registry_id,lineage_id=coalesce(excluded.lineage_id,billing2027_provider_state.lineage_id),
      transaction_id=excluded.transaction_id,status=excluded.status,started_at=excluded.started_at,expires_at=excluded.expires_at,
      trial_ends_at=excluded.trial_ends_at,will_renew=excluded.will_renew,price_amount=coalesce(excluded.price_amount,billing2027_provider_state.price_amount),
      price_unit=case when excluded.price_amount is null then billing2027_provider_state.price_unit else excluded.price_unit end,
      currency=coalesce(excluded.currency,billing2027_provider_state.currency),observed_at=excluded.observed_at;
    update onlyfast_private.billing2027_cohorts set eligible=false where user_id=p_uid and cohort='rookie';
    if p.legacy and (item->>'started_at')::timestamptz<'2027-01-01T08:00:00Z' then
      if obs<'2027-01-01T08:00:00Z' and (item->>'expires_at')::timestamptz>'2027-01-01T08:00:00Z'
        and item->>'status' in ('active','trialing','grace') then
        insert into onlyfast_private.billing2027_cohorts(user_id,cohort,eligible,captured_at,evidence)
          values(p_uid,case when p.tier='factory' then 'legacy_team' else 'legacy_pro' end,true,obs,
            jsonb_build_object('observed_at',obs,'valid_through',item->>'expires_at','registry_id',p.id)) on conflict do nothing;
      end if;
      insert into onlyfast_private.billing2027_protection(user_id,provider,provider_key,legacy_plan,product_id,lineage_id,price_amount,price_unit,currency,status,evidence)
      values(p_uid,prov,item->>'provider_key',case when p.tier='factory' then 'teams' else 'pro' end,p.product_id,item->>'lineage_id',
        (item->>'price_amount')::numeric,item->>'price_unit',item->>'currency','candidate',jsonb_build_object('observed_at',obs,'registry_id',p.id,'lineage_verified',item->>'lineage_id' is not null))
      on conflict(user_id,provider,provider_key) do update set
        lineage_id=coalesce(billing2027_protection.lineage_id,excluded.lineage_id),
        price_amount=coalesce(billing2027_protection.price_amount,excluded.price_amount),currency=coalesce(billing2027_protection.currency,excluded.currency),
        status=case when item->>'status' in ('expired','refunded') then 'lapsed'
          when billing2027_protection.price_amount is not null and excluded.price_amount is not null and
            (billing2027_protection.price_amount<>excluded.price_amount or billing2027_protection.currency is distinct from excluded.currency)
            then 'review_required' else billing2027_protection.status end,
        updated_at=at_time;
      update onlyfast_private.billing2027_protection g set status='protected'
        where g.user_id=p_uid and g.provider=prov and g.provider_key=item->>'provider_key' and g.status='candidate'
          and at_time>='2027-01-01T08:00:00Z' and at_time<'2028-01-01T08:00:00Z'
          and g.lineage_id is not null and g.price_amount is not null and g.currency is not null
          and item->>'status' in ('active','trialing','grace')
          and exists(select 1 from onlyfast_private.billing2027_cohorts c where c.user_id=p_uid and c.eligible
            and c.cohort=case when p.tier='factory' then 'legacy_team' else 'legacy_pro' end and c.captured_at<'2027-01-01T08:00:00Z');
      -- Missing price/lineage/cutoff proof stays a candidate. No schedule or price writes exist.
    end if;
  end loop;
  update onlyfast_private.billing2027_protection g set status='lapsed',updated_at=at_time
    where g.user_id=p_uid and g.provider=prov and not exists(
      select 1 from onlyfast_private.billing2027_provider_state s where s.user_id=p_uid and s.provider=prov
        and s.provider_key=g.provider_key and s.status in ('active','trialing','grace') and s.expires_at>at_time);
  insert into onlyfast_private.billing2027_streams values(p_uid,prov,obs) on conflict(user_id,provider) do update set observed_at=excluded.observed_at;
  new_tier:=onlyfast_private.membership_tier(p_uid);
  if new_tier in ('factory','team','admin') then
    insert into onlyfast_private.billing2027_projection(user_id,factory_seen_at) values(p_uid,at_time)
      on conflict(user_id) do update set factory_seen_at=excluded.factory_seen_at,updated_at=at_time;
    update onlyfast_private.class_selection_2027 set selection_required=false where user_id=p_uid;
  elsif old_tier in ('factory','team','admin') then
    insert into onlyfast_private.class_selection_2027 values(p_uid,true) on conflict(user_id) do update set selection_required=true;
  end if;
  insert into onlyfast_private.billing2027_events(provider,event_id,user_id,event_type,observed_at,processed_at,outcome,evidence)
    values(prov,p_event_id,p_uid,p_event_type,obs,at_time,'applied',jsonb_build_object('verified_subscriptions',p_snapshot->'subscriptions'));
  return 'applied';
end $$;

create function onlyfast_private.billing2027_claim(p_uid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare at_time timestamptz:=onlyfast_private.billing2027_now(); c onlyfast_private.billing2027_claims%rowtype;
begin
  if p_uid is null or p_uid is distinct from auth.uid() then raise exception 'CLAIM_ACCOUNT_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
  select * into c from onlyfast_private.billing2027_claims where user_id=p_uid;
  if found then return jsonb_build_object('claimed_at',c.claimed_at,'expires_at',c.expires_at,'repeated',true); end if;
  if at_time<'2027-01-01T08:00:00Z' or at_time>='2027-01-31T08:00:00Z' then raise exception 'CLAIM_WINDOW_CLOSED' using errcode='42501'; end if;
  if not exists(select 1 from onlyfast_private.billing2027_cohorts where user_id=p_uid and cohort='rookie' and eligible and captured_at<'2027-01-01T08:00:00Z')
    or onlyfast_private.membership_tier(p_uid)<>'rookie'
    or exists(select 1 from onlyfast_private.billing2027_provider_state where user_id=p_uid)
    or exists(select 1 from public.user_subscriptions where user_id=p_uid and (stripe_subscription_id is not null or revenuecat_product_id is not null)) then
    raise exception 'ROOKIE_PROMOTION_NOT_ELIGIBLE' using errcode='42501'; end if;
  insert into onlyfast_private.billing2027_claims values(p_uid,at_time,at_time+interval '720 hours') returning * into c;
  insert into onlyfast_private.billing2027_events(provider,event_id,user_id,event_type,observed_at,processed_at,outcome)
    values('promotion','rookie-30-days',p_uid,'CLAIM',at_time,at_time,'applied');
  return jsonb_build_object('claimed_at',c.claimed_at,'expires_at',c.expires_at,'repeated',false);
end $$;
create function public.claim_onlyfast_2027_sportsman() returns jsonb
language sql security invoker set search_path='' as $$ select onlyfast_private.billing2027_claim(auth.uid()); $$;

create function onlyfast_private.billing2027_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t text; at_time timestamptz:=onlyfast_private.billing2027_now(); sub record; c record; pr record; boundary timestamptz;
  legacy_row public.user_subscriptions%rowtype; legacy_exp timestamptz;
begin
  if uid is null then raise exception 'BILLING_AUTH_REQUIRED' using errcode='42501'; end if;
  t:=onlyfast_private.membership_tier(uid);
  select s.*,p.interval,p.store,p.tier into sub from onlyfast_private.billing2027_provider_state s
    join onlyfast_private.billing2027_products p on p.id=s.registry_id where s.user_id=uid
      and s.status in ('active','trialing','grace') and s.expires_at>at_time and p.enabled
    order by case p.tier when 'factory' then 3 when 'pro' then 2 else 1 end desc,s.expires_at desc limit 1;
  select * into c from onlyfast_private.billing2027_claims where user_id=uid;
  select * into pr from onlyfast_private.billing2027_protection where user_id=uid order by updated_at desc limit 1;
  select * into legacy_row from public.user_subscriptions where user_id=uid;
  legacy_exp:=case when legacy_row.subscription_source='revenuecat' then legacy_row.revenuecat_expires_at else legacy_row.current_period_end end;
  if sub.user_id is not null or legacy_row.plan not in ('pro','team','teams') or legacy_row.status not in ('active','trialing') or legacy_exp<=at_time then legacy_exp:=null; end if;
  boundary:=case when sub.expires_at>at_time then sub.expires_at when c.expires_at>at_time then c.expires_at
    when legacy_exp>at_time then legacy_exp when t='rookie' then '2027-01-31T08:00:00Z'::timestamptz else null end;
  return jsonb_build_object('version',1,'user_id',uid,'server_now',at_time,'tier',t,'valid_until',boundary,
    'provider',coalesce(sub.provider,case when legacy_exp>at_time then legacy_row.subscription_source end),
    'store',coalesce(sub.store,case when legacy_exp>at_time then coalesce(legacy_row.revenuecat_store,'stripe') end),
    'interval',sub.interval,'status',coalesce(sub.status,case when legacy_exp>at_time then legacy_row.status end),
    'expires_at',coalesce(sub.expires_at,legacy_exp),'trial_ends_at',sub.trial_ends_at,'will_renew',sub.will_renew,
    'promo_claimed_at',c.claimed_at,'promo_expires_at',c.expires_at,
    'claim_window_start','2027-01-01T08:00:00Z','claim_window_end','2027-01-31T08:00:00Z',
    'claim_eligible',t='rookie' and at_time>='2027-01-01T08:00:00Z' and at_time<'2027-01-31T08:00:00Z'
      and c.user_id is null and not exists(select 1 from onlyfast_private.billing2027_provider_state where user_id=uid)
      and not exists(select 1 from public.user_subscriptions where user_id=uid and (stripe_subscription_id is not null or revenuecat_product_id is not null))
      and exists(select 1 from onlyfast_private.billing2027_cohorts where user_id=uid and cohort='rookie' and eligible),
    'grandfathered',coalesce(pr.status='protected' and at_time>=pr.starts_at and at_time<pr.ends_at
      and exists(select 1 from onlyfast_private.billing2027_provider_state s where s.user_id=uid and s.provider=pr.provider
        and s.provider_key=pr.provider_key and s.status in ('active','trialing','grace') and s.expires_at>at_time),false),
    'protection_status',pr.status,'protection_ends_at',pr.ends_at);
end $$;
create function public.get_onlyfast_2027_billing_status() returns jsonb
language sql stable security invoker set search_path='' as $$ select onlyfast_private.billing2027_status(); $$;

-- Default EXECUTE is revoked explicitly for ALL newly created private helpers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='onlyfast_private' and p.proname like 'billing2027_%' loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';
  end loop;
end $$;
revoke all on function public.billing2027_registry(),public.billing2027_stripe_owner(text),public.billing2027_apply_snapshot(uuid,jsonb,text,text),public.billing2027_capture_rookie_cohort() from public,anon,authenticated;
grant execute on function public.billing2027_registry(),public.billing2027_stripe_owner(text),public.billing2027_apply_snapshot(uuid,jsonb,text,text),public.billing2027_capture_rookie_cohort() to service_role;
revoke all on function public.claim_onlyfast_2027_sportsman(),public.get_onlyfast_2027_billing_status() from public,anon;
grant execute on function onlyfast_private.billing2027_claim(uuid),onlyfast_private.billing2027_status(),public.claim_onlyfast_2027_sportsman(),public.get_onlyfast_2027_billing_status() to authenticated;
-- Service-only prelaunch capture, invoked by owner here without changing any racing/subscription row.
select public.billing2027_capture_rookie_cohort();
notify pgrst,'reload schema';
commit;
