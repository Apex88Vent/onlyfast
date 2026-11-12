// Offline preparation only. Never connects to Supabase or deploys a migration.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

export async function loadMembershipPolicy() {
  const source = await readFile(new URL('../src/lib/membership.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(() => ({}), exports);
  return exports;
}

export async function testing2027Sql() {
  const policy = await loadMembershipPolicy();
  const legacy = await readFile(new URL('../supabase/migrations/20261110233145_restore_test_subscription_switching.sql', import.meta.url), 'utf8');
  const setup = await readFile(new URL('../supabase/migrations/20261105090937_phase1_setup_and_usage_authorization.sql', import.meta.url), 'utf8');
  const definition = (text, name) => {
    const start = text.indexOf('create or replace function ' + name + '(');
    const end = text.indexOf('\n$$;', start);
    if (start < 0 || end < 0) throw new Error('Required reviewed function missing: ' + name);
    return text.slice(start, end + 4);
  };
  const rows = Object.entries(policy.tierLimits).map(([tier, limits]) => {
    const nullable = value => typeof value === 'number' ? String(value) : 'null';
    return `('${tier}',${nullable(limits.maxCars)},${nullable(limits.maxBaseSetups)},${nullable(limits.maxRaceWeekendSetups)},${nullable(limits.raceWeekendSetupLockHours)},${nullable(limits.timingUploadsPerMonth)},${nullable(limits.setupAssistsPerRaceWeekend)},${limits.adsEnabled},${limits.onlyLapsEnabled})`;
  }).join(',\n');
  let testTier = definition(legacy, 'onlyfast_private.test_subscription_tier');
  testTier = testTier.replace("where b.user_id=p_uid", "where exists(select 1 from onlyfast_private.testing_2027_environment) and b.user_id=p_uid");
  let setter = definition(legacy, 'onlyfast_private.set_test_tier').replace("('rookie','pro','team')", "('rookie','pro','team','sportsman','factory')");
  const vehicles = definition(legacy, 'onlyfast_private.has_unlimited_vehicles')
    .replace("onlyfast_private.test_subscription_tier(p_uid) = 'team'", "onlyfast_private.test_subscription_tier(p_uid) in ('team','factory')");
  let guard = definition(setup, 'onlyfast_private.guard_setup_limits');
  guard = guard.replace('  v_count integer;', '  v_count integer;\n  v_limits onlyfast_private.subscription_2027_limits%rowtype;');
  guard = guard.replace("  if v_tier='rookie' then", `  if v_tier='sportsman' then
    select * into strict v_limits from onlyfast_private.subscription_2027_limits where tier=v_tier;
    -- Count all retained classes, including historical/locked setups. Clock and
    -- quota identity are the existing immutable weekend, never a client date.
    if tg_op='INSERT' then
      if v_base then
        select count(*) into v_count from public.race_setups r where r.user_id=new.user_id
          and (r.setup_type='base_template' or coalesce(r.setup_name,'') ilike '[BASE TEMPLATE]%' or coalesce(to_jsonb(r)->>'is_template','false')='true');
        if v_count>=v_limits.max_base then raise exception 'SPORTSMAN_BASE_SETUP_LIMIT' using errcode='42501'; end if;
      elsif not exists(select 1 from public.race_setups r where r.user_id=new.user_id and r.race_weekend_id=new.race_weekend_id) then
        select count(distinct r.race_weekend_id) into v_count from public.race_setups r where r.user_id=new.user_id and r.race_weekend_id is not null;
        if v_count>=v_limits.max_regular then raise exception 'SPORTSMAN_RACE_WEEKEND_LIMIT' using errcode='42501'; end if;
      end if;
    end if;
    -- All annotations, mechanical values, results and new sessions lock together.
    if not v_base and v_weekend.created_at<=now()-make_interval(hours=>v_limits.edit_hours) then
      if tg_op='INSERT' or (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
        raise exception 'SPORTSMAN_SETUP_EDIT_LOCKED' using errcode='42501';
      end if;
    end if;
  end if;
  if v_tier='rookie' then`);
  const reserve = definition(setup, 'public.onlyfast_reserve_usage').replaceAll("v_tier='rookie'", "v_tier in ('rookie','sportsman')");
  return `-- TESTING DATABASE ONLY. Not part of production migration history.
-- Requires the existing reviewed staging + Phase 1 schema and test-tier RPCs.
-- Operator must set onlyfast.testing_project_ref to an independently verified
-- non-production project reference. Never run on the production database.
begin;
do $$ begin
  if coalesce(current_setting('onlyfast.testing_project_ref',true),'') !~ '^[a-z0-9]{20}$'
    or current_setting('onlyfast.testing_project_ref',true)='thpyjvwtfvfxiufchrxn' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
end; $$;
create table onlyfast_private.testing_2027_environment (
  project_ref text primary key check(project_ref<>'thpyjvwtfvfxiufchrxn')
);
insert into onlyfast_private.testing_2027_environment values(current_setting('onlyfast.testing_project_ref'));
revoke all on onlyfast_private.testing_2027_environment from public,anon,authenticated;
alter table onlyfast_private.testing_2027_environment enable row level security;
create table onlyfast_private.subscription_2027_limits (
  tier text primary key,max_classes integer,max_base integer,max_regular integer,
  edit_hours integer,timing_per_month integer,assist_per_weekend integer,ads boolean,onlylaps boolean
);
insert into onlyfast_private.subscription_2027_limits values ${rows};
revoke all on onlyfast_private.subscription_2027_limits from public,anon,authenticated;
alter table onlyfast_private.subscription_2027_limits enable row level security;
alter table public.beta_tester_accounts drop constraint beta_tester_accounts_test_subscription_tier_check;
alter table public.beta_tester_accounts add constraint beta_tester_accounts_test_subscription_tier_check
  check(test_subscription_tier in ('rookie','pro','team','sportsman','factory'));
${testTier}
${setter}
${vehicles}
${guard}
${reserve}
create function onlyfast_private.setup_2027_edit_state(p_setup_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('created_at',coalesce(w.created_at,r.created_at))
  from public.race_setups r left join onlyfast_private.setup_weekends w on w.id=r.race_weekend_id and w.user_id=r.user_id
  where r.id=p_setup_id and r.user_id=auth.uid();
$$;
revoke all on function onlyfast_private.setup_2027_edit_state(uuid) from public,anon;
grant execute on function onlyfast_private.setup_2027_edit_state(uuid) to authenticated;
create function public.get_onlyfast_2027_setup_edit_state(p_setup_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select onlyfast_private.setup_2027_edit_state(p_setup_id);
$$;
revoke all on function public.get_onlyfast_2027_setup_edit_state(uuid) from public,anon;
grant execute on function public.get_onlyfast_2027_setup_edit_state(uuid) to authenticated;
-- CREATE OR REPLACE preserves the existing revoked privileges and grants.
-- No user_subscriptions, entitlements, existing setup or billing rows are updated.
commit;
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error('Provide a NEW output SQL file. No database is contacted.');
  await writeFile(process.argv[2], await testing2027Sql(), { flag: 'wx' });
  console.log('Prepared testing-only SQL. Nothing was applied.');
}
