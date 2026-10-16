// Isolated PostgreSQL integration; never uses production credentials or data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { EXPANDED_CLASS_CONFIGS } from '../src/lib/setupLibrary.ts';
import { ROAD_RACING_CLASSES } from '../src/lib/roadRacingSetupSchemas.ts';
import { SETUP_LIBRARY_KEY } from '../src/lib/setupLibraryStorage.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);

test('onboarding, 30-day changes, RLS locks, historical associations and paid entitlements in PostgreSQL', async () => {
  const db = new PGlite();
  const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
  const migrate = async path => db.exec(await readFile(new URL('../' + path, import.meta.url),'utf8'));
  const signIn = async id => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
    await db.exec('set role authenticated');
  };
  const rpc = async sql => (await db.query('select ' + sql + ' as result')).rows[0].result;
  const state = () => rpc('public.get_active_race_class_state()');
  const admin = async sql => { await db.exec('reset role'); return db.query(sql); };
  const insert = async payload => {
    const keys = Object.keys(payload);
    return (await db.query('insert into public.race_setups (' + keys.join(',') + ') values (' +
      keys.map((_,i) => '$' + (i+1)).join(',') + ') returning *',
      keys.map(k => typeof payload[k] === 'object' && payload[k] !== null ? JSON.stringify(payload[k]) : payload[k]))).rows[0];
  };
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; " +
      "create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); " +
      "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; " +
      "create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$; grant usage on schema public,auth to anon,authenticated;");
    const setup = await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
    await db.exec(setup.replace('create extension if not exists pgcrypto;',''));
    for (const path of ['SUBSCRIPTIONS_RLS.sql','supabase/migrations/20260720_enforce_active_race_class.sql',
      'supabase/migrations/20260728_add_account_beta_feature_flags.sql','supabase/migrations/20260929_add_custom_car_class.sql',
      'supabase/migrations/20260930_add_development_setup_library.sql','supabase/migrations/20261002030004_add_development_kart_classes.sql']) await migrate(path);
    await migrate('supabase/migrations/20260817_link_race_setups_to_schedule.sql');
    for (const [i,id] of ids.entries()) await db.query('insert into auth.users(id,email) values ($1,$2)',[id,'qa'+i+'@example.invalid']);
    for (const [i,plan] of [[1,'pro'],[2,'teams'],[3,'free'],[4,'free']]) await db.query(
      "insert into public.user_subscriptions(user_id,plan,status,stripe_customer_id,active_race_class,last_class_change_at) values($1,$2,'active',$3,'Dwarf Cars',null)",
      [ids[i],plan,'cus_keep_'+i]);
    await db.query("update auth.users set raw_app_meta_data = '{\"promo_access_level\":\"teams\"}' where id=$1",[ids[4]]);
    await db.exec('alter table public.shared_setups add column expires_at timestamptz;');
    // Reproduce the live permissive share policy that formerly bypassed locks.
    await db.exec('create policy race_setups_select_via_unexpired_public_share on public.race_setups for select using ' +
      '(exists(select 1 from public.shared_setups s where s.setup_id=race_setups.id and s.is_public and s.expires_at>now()));');
    const schedule = (await db.query("insert into public.race_schedule(user_id,race_date,track,finishing_position) values($1,'2026-09-01','Original track','3') returning *",[ids[1]])).rows[0];
    const legacy = await insert({user_id:ids[1],race_class:'Dwarf Cars',race_schedule_id:schedule.id,setup_name:'Original race',setup_type:'heat',lf_pressure:12.5,notes:'keep',timing_data:{laps:[1,2]},custom_fields:{Original:'keep'}});
    const billingBefore = (await db.query('select user_id,plan,status,stripe_customer_id,last_class_change_at from public.user_subscriptions order by user_id')).rows;
    await migrate('supabase/migrations/202610130001_restore_racing_onboarding.sql');
    await migrate('supabase/migrations/202610130001_restore_racing_onboarding.sql');
    await migrate('supabase/migrations/20261013183621_enable_road_racing.sql');
    await migrate('supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql');
    await migrate('supabase/migrations/202609240001_revenuecat_subscription_sync.sql');
    await migrate('supabase/migrations/20261015235847_secure_membership_authorization.sql');
    await migrate('supabase/migrations/20261013183621_enable_road_racing.sql');
    assert.deepEqual((await db.query('select user_id,plan,status,stripe_customer_id,last_class_change_at from public.user_subscriptions order by user_id')).rows,billingBefore);
    assert.deepEqual((await db.query('select * from public.race_setups where id=$1',[legacy.id])).rows[0],legacy);
    await db.exec('grant select,insert,update,delete on public.race_setups,public.shared_setups,public.user_subscriptions to authenticated;');
    // Test RLS as a real client even with accidentally broad table privileges.
    await signIn(ids[0]);
    assert.equal((await state()).onboarding_step,'tutorial');
    await assert.rejects(rpc('public.complete_racing_onboarding()'),/ONBOARDING_INCOMPLETE/);
    await rpc("public.save_racing_onboarding_progress('discipline')");
    assert.equal((await state()).onboarding_step,'discipline');
    await rpc("public.save_racing_onboarding_progress('vehicle','road_course')");
    assert.equal((await state()).onboarding_step,'vehicle');
    await assert.rejects(rpc("public.save_racing_onboarding_progress('plan','road_course','Dwarf Cars')"),/CLASS_INVALID/);
    assert.equal((await state()).onboarding_step,'vehicle');
    await rpc("public.save_racing_onboarding_progress('plan','road_course','GT3')");
    await signIn(ids[0]); // New client/session resumes exactly at plan.
    assert.equal((await state()).onboarding_step,'plan');
    assert.equal((await state()).active_class,null);
    assert.equal((await state()).onboarding_race_class,'GT3');
    await rpc('public.complete_racing_onboarding()');
    assert.equal((await state()).active_class,'GT3');
    assert.equal((await state()).active_discipline,'road_course');
    assert.equal((await state()).last_class_change_at,null);
    assert.equal((await state()).onboarding_step,'complete');
    await rpc('public.complete_racing_onboarding()'); // Idempotent submission.
    await rpc("public.save_racing_onboarding_progress('vehicle','dirt_oval')");
    assert.equal((await state()).active_class,'GT3');
    const payload = componentFunction('CreateBaseSetupView.tsx','buildPayload')(populatedLibraryState('GT3'));
    const road = await insert({...payload,user_id:ids[0]});
    await rpc("public.change_active_race_class('Dwarf Cars')");
    const changed = await state();
    assert.ok(changed.last_class_change_at);
    assert.equal(new Date(changed.next_eligible_at)-new Date(changed.last_class_change_at),30*86400000);
    assert.equal(changed.active_discipline,'dirt_oval');
    await assert.rejects(rpc("public.change_active_race_class('GT3')"),/CLASS_CHANGE_COOLDOWN/);
    await assert.rejects(rpc("public.change_active_race_class('unknown')"),/CLASS_INVALID/);
    await rpc("public.change_active_race_class(' dwarf cars ')");
    assert.equal((await state()).last_class_change_at,changed.last_class_change_at);
    assert.equal((await db.query('select id from public.race_setups where id=$1',[road.id])).rows.length,0);
    assert.equal((await db.query('update public.race_setups set notes=$1 where id=$2 returning id',['changed',road.id])).rows.length,0);
    await assert.rejects(db.query("insert into public.race_setups(user_id,race_class) values($1,'GT3')",[ids[0]]));
    assert.equal((await db.query("update public.user_subscriptions set last_class_change_at=null where user_id=$1 returning user_id",[ids[0]])).rows.length,0);
    assert.equal((await state()).last_class_change_at,changed.last_class_change_at);
    assert.ok((await rpc('public.list_user_setup_summaries()')).some(r => r.id === road.id));
    // Even user-editable admin metadata cannot bypass the vehicle cooldown.
    await admin("update auth.users set raw_user_meta_data='{\"has_admin_full_access\":true}' where id='"+ids[0]+"'");
    await signIn(ids[0]);
    assert.equal((await state()).unlimited,false);
    await assert.rejects(rpc("public.change_active_race_class('GT3')"),/CLASS_CHANGE_COOLDOWN/);
    await admin("update public.user_subscriptions set last_class_change_at=now()-interval '720 hours' where user_id='"+ids[0]+"'");
    await signIn(ids[0]);
    await rpc("public.change_active_race_class('GT3')");
    assert.equal((await db.query('select * from public.race_setups where id=$1',[road.id])).rows[0].custom_fields[ 'onlyfast_setup_library_v1' ].values.front_arb,payload.custom_fields.onlyfast_setup_library_v1.values.front_arb);
    await signIn(ids[1]);
    assert.equal((await state()).onboarding_step,'complete');
    assert.equal((await state()).tier,'pro');
    await rpc("public.change_active_race_class('Modified')");
    await assert.rejects(rpc("public.change_active_race_class('Dwarf Cars')"),/CLASS_CHANGE_COOLDOWN/);
    // An owner's old public share must not unlock their old setup.
    await admin("insert into public.shared_setups(setup_id,shared_by,share_code,is_public,expires_at) values('"+legacy.id+"','"+ids[1]+"','OLD-OWNER-SHARE',true,now()+interval '1 day')");
    await signIn(ids[1]);
    assert.equal((await db.query('select id from public.race_setups where id=$1',[legacy.id])).rows.length,0);
    const active = await insert({user_id:ids[1],race_class:'Modified',setup_name:'New vehicle',setup_type:'base'});
    await assert.rejects(db.query("update public.race_setups set race_class='Sport Mod' where id=$1",[active.id]),/ASSOCIATION_IMMUTABLE|row-level security/);
    await signIn(ids[2]);
    assert.equal((await state()).unlimited,true);
    await rpc("public.change_active_race_class('GT3')");
    await rpc("public.change_active_race_class('Dwarf Cars')");
    assert.equal((await state()).last_class_change_at,null);
    await insert({user_id:ids[2],race_class:'Modified',setup_name:'Teams second vehicle',setup_type:'base'});
    await signIn(ids[4]);
    assert.equal((await state()).unlimited,true,'existing Teams promo preserved');
    assert.equal((await rpc('public.get_onlyfast_membership()')).tier,'team');
    await admin("update auth.users set raw_user_meta_data = '{\"membership_tier\":\"team\",\"has_admin_full_access\":true,\"promo_access_level\":\"teams\"}' where id='"+ids[3]+"'");
    await signIn(ids[3]);
    assert.equal((await rpc('public.get_onlyfast_membership()')).tier,'rookie','editable claims cannot grant paid authorization');
    assert.equal((await state()).unlimited,false,'editable claims cannot bypass class RLS');
    await db.query("update public.user_subscriptions set plan='teams' where user_id=$1",[ids[3]]);
    assert.equal((await db.query("select plan from public.user_subscriptions where user_id=$1",[ids[3]])).rows[0].plan,'free','RLS rejects direct plan edits');
    await admin("update public.user_subscriptions set last_class_change_at=now()-interval '8 days' where user_id='"+ids[3]+"'");
    await signIn(ids[3]);
    assert.equal((await state()).can_change,false,'reliable legacy timestamp reused with 30 days');
    // Real authenticated JSONB round trips for every new sheet, including the
    // first-run Rookie onboarding path and existing Teams class changes.
    for (const [index, car] of ROAD_RACING_CLASSES.entries()) {
      const owner = `ffffffff-ffff-4fff-8fff-${String(index + 1).padStart(12, '0')}`;
      await db.exec('reset role');
      await db.query('insert into auth.users(id,email) values($1,$2)', [owner, `road${index}@example.invalid`]);
      await signIn(owner);
      await rpc("public.save_racing_onboarding_progress('discipline')");
      await rpc("public.save_racing_onboarding_progress('vehicle','road_course')");
      await db.query("select public.save_racing_onboarding_progress('plan','road_course',$1)", [car]);
      await rpc('public.complete_racing_onboarding()');
      assert.equal((await state()).active_class, car);
      assert.equal((await state()).active_discipline, 'road_course');
      const stateValues = populatedLibraryState(car);
      const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { user: { id: owner }, selectedCar: car, classLocksEnabled: true });
      const loadBase = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
      const row = await insert(saveBase(stateValues));
      const reopen = (await db.query('select * from public.race_setups where id=$1', [row.id])).rows[0];
      const loaded = loadBase(reopen);
      for (const field of EXPANDED_CLASS_CONFIGS[car].extraSections.flatMap(section => section.fields)) assert.equal(loaded[field.key], stateValues[field.key]);
      const copied = await insert(saveBase({ ...loaded, setup_name: 'Copied Road base' }));
      assert.deepEqual(copied.custom_fields, row.custom_fields);
      const fieldKey = EXPANDED_CLASS_CONFIGS[car].extraSections[0].fields[0].key;
      const edited = saveBase({ ...loaded, [fieldKey]: 'Edited Road value' });
      await db.query('update public.race_setups set custom_fields=$1,setup_name=$2 where id=$3', [JSON.stringify(edited.custom_fields), 'Renamed Road base', row.id]);
      const renamed = (await db.query('select * from public.race_setups where id=$1', [row.id])).rows[0];
      assert.equal(loadBase(renamed)[fieldKey], 'Edited Road value');
      assert.equal(renamed.setup_name, 'Renamed Road base');
      const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload', { user: { id: owner }, selectedCar: car, classLocksEnabled: true });
      const loadRace = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');
      for (const slot of ['base', 'heat', 'main']) {
        const session = await insert(saveRace({ ...loaded, raceClass: car }, slot, 'Road weekend'));
        assert.equal(loadRace(session)[fieldKey], loaded[fieldKey]);
        assert.equal(session.custom_fields[SETUP_LIBRARY_KEY].race_class, car);
      }
      await signIn(ids[2]);
      assert.equal((await db.query('select * from public.race_setups where id=$1', [row.id])).rows.length, 0, 'different users cannot open the setup');
      await db.query('select public.change_active_race_class($1)', [car]);
      assert.equal((await state()).active_class, car);
      assert.equal((await state()).unlimited, true);
      await signIn(owner);
      await db.query('delete from public.race_setups where id=$1', [copied.id]);
      assert.equal((await db.query('select * from public.race_setups where id=$1', [copied.id])).rows.length, 0);
    }
    // Canonical class/discipline mapping includes all existing sheets.
    for (const [name,config] of Object.entries(EXPANDED_CLASS_CONFIGS)) {
      const result = (await db.query('select public.onlyfast_canonical_race_class($1) as name,public.onlyfast_race_discipline($1) as discipline',[name])).rows[0];
      assert.equal(result.name,name); assert.equal(result.discipline,config.category);
    }
    await db.exec('reset role');
    const old = (await db.query('select * from public.race_setups where id=$1',[legacy.id])).rows[0];
    assert.deepEqual(old,legacy,'history never relabeled, deleted or overwritten');
    assert.deepEqual((await db.query('select * from public.race_schedule where id=$1',[schedule.id])).rows[0],schedule,'schedule and historical finishing position preserved');
    await signIn(ids[1]);
    assert.equal((await rpc('public.list_user_setup_summaries()')).find(row => row.id === legacy.id).race_schedule_id,schedule.id,'locked summary retains the setup/schedule association');
    await db.exec('reset role');
    const billingAfter = (await db.query('select user_id,plan,status,stripe_customer_id from public.user_subscriptions where user_id = any($1::uuid[]) order by user_id',[ids.slice(1)])).rows;
    assert.deepEqual(billingAfter.filter(row => ids.includes(row.user_id)),billingBefore.map(({last_class_change_at,...row}) => row));
    await signIn(null);
    await assert.rejects(rpc('public.get_active_race_class_state()'),/CLASS_AUTH_REQUIRED/);
    await assert.rejects(rpc("public.save_racing_onboarding_progress('discipline')"),/CLASS_AUTH_REQUIRED/);
  } finally { await db.close(); }
});
