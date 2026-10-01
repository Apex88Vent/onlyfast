// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite index.js:
// node --experimental-strip-types --test tests/setupLibraryDatabase.mjs
// Actual PostgreSQL, actual application serializers; no live data/credentials.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { EXPANDED_CAR_CLASSES } from '../src/lib/setupLibrary.ts';
import { buildBetaAccessSnapshot, setCachedBetaAccess, clearCachedBetaAccess } from '../src/lib/betaFeatures.ts';
import { SETUP_LIBRARY_KEY } from '../src/lib/setupLibraryStorage.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
test('PostgreSQL: every new sheet saves/reopens/copies; gating, sharing, cooldowns and legacy rows stay correct', async () => {
  const db = new PGlite();
  const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'ffffffff-ffff-4fff-8fff-ffffffffffff'];
  const runMigration = async path => db.exec(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const signIn = async (id, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
    await db.exec(`set role ${role}`);
  };
  const insert = async payload => {
    const keys = Object.keys(payload);
    return (await db.query(`insert into public.race_setups (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
      keys.map(k => typeof payload[k] === 'object' && payload[k] !== null ? JSON.stringify(payload[k]) : payload[k]))).rows[0];
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
      grant usage on schema public, auth to anon, authenticated;`);
    // PGlite has core gen_random_uuid; the Supabase extension isn't needed.
    const setup = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
    await db.exec(setup.replace('create extension if not exists pgcrypto;', ''));
    await runMigration('SUBSCRIPTIONS_RLS.sql');
    await runMigration('supabase/migrations/20260720_enforce_active_race_class.sql');
    await runMigration('supabase/migrations/20260728_add_account_beta_feature_flags.sql');
    await runMigration('supabase/migrations/20260929_add_custom_car_class.sql');
    // The designated account is created AFTER the original beta migration,
    // reproducing a missed/recreated-account designation without live data.
    for (const [i, id] of ids.entries()) await db.query('insert into auth.users(id,email,raw_app_meta_data) values ($1,$2,$3)', [id, i === 0 ? 'test@test.com' : `qa${i}@example.invalid`, i === 4 ? '{"has_admin_full_access":true}' : '{}']);
    for (const [i, id] of ids.entries()) await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values ($1,$2,'active','Dwarf Cars')", [id, i === 2 ? 'pro' : i === 3 ? 'teams' : 'free']);
    for (const [i, kind] of [[5, 'personal']]) {
      await db.query("insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values ($1,true,true,$2)", [ids[i], kind]);
      await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values ($1,'test_account_full_access',true)", [ids[i]]);
    }
    const legacy = await insert({ user_id: ids[1], race_class: 'Dwarf Cars', setup_type: 'base', setup_name: 'Legacy', lf_pressure: 12.5, notes: 'keep', custom_fields: { 'Old field': 'keep too' } });
    await runMigration('supabase/migrations/20260930_add_development_setup_library.sql');
    await runMigration('supabase/migrations/20260930_add_development_setup_library.sql'); // idempotency
    const accountsBefore = (await db.query('select * from auth.users order by id')).rows;
    const personalBefore = (await db.query('select * from public.beta_tester_accounts where user_id=$1', [ids[5]])).rows;
    await signIn(ids[0]);
    assert.equal((await db.query('select public.onlyfast_can_use_setup_library() as allowed')).rows[0].allowed, false);
    await db.exec('reset role');
    await runMigration('supabase/migrations/20261001_verify_designated_test_account.sql');
    await runMigration('supabase/migrations/20261001_verify_designated_test_account.sql');
    assert.deepEqual((await db.query('select * from auth.users order by id')).rows, accountsBefore, 'no authentication/onboarding data changes');
    assert.deepEqual((await db.query('select * from public.beta_tester_accounts where user_id=$1', [ids[5]])).rows, personalBefore, 'personal beta designation unchanged');
    assert.deepEqual((await db.query('select feature_key from public.user_feature_flags where user_id=$1', [ids[0]])).rows, [{ feature_key: 'test_account_full_access' }], 'no reset/unrelated flags enabled');
    await db.exec('grant select, insert, update, delete on public.race_setups, public.shared_setups to authenticated; grant select on public.race_setups, public.shared_setups to anon;');
    const access = buildBetaAccessSnapshot({ user_id: ids[0], is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
    setCachedBetaAccess(access);
    const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload');
    const loadBase = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
    const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload');
    const loadRace = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');
    await signIn(ids[0]);
    assert.equal((await db.query('select public.get_active_race_class_state() as state')).rows[0].state.unlimited, true);
    let sharedId;
    for (const name of EXPANDED_CAR_CLASSES) {
      await db.query('select public.change_active_race_class($1)', [name]);
      const state = populatedLibraryState(name);
      const base = await insert(saveBase(state));
      const reopened = (await db.query('select * from public.race_setups where id=$1', [base.id])).rows[0];
      for (const [key, value] of Object.entries(base.custom_fields[SETUP_LIBRARY_KEY].values)) assert.equal(loadBase(reopened)[key], value, `${name} ${key}`);
      const copy = await insert(saveBase({ ...loadBase(reopened), setup_name: `Copy ${name}` }));
      assert.deepEqual(copy.custom_fields, base.custom_fields);
      await db.query('update public.race_setups set setup_name=$1 where id=$2', ['Renamed baseline', copy.id]);
      const race = await insert(saveRace(loadBase(copy), 'base', `Race ${name}`));
      const loaded = loadRace((await db.query('select * from public.race_setups where id=$1', [race.id])).rows[0]);
      const heat = await insert(saveRace({ ...loaded }, 'heat', `Race ${name}`));
      assert.deepEqual(heat.custom_fields, base.custom_fields);
      const key = Object.keys(base.custom_fields[SETUP_LIBRARY_KEY].values)[0];
      const edited = saveRace({ ...loaded, [key]: 'edited value' }, 'base', `Race ${name}`);
      await db.query('update public.race_setups set custom_fields=$1 where id=$2', [JSON.stringify(edited.custom_fields), race.id]);
      assert.equal(loadRace((await db.query('select * from public.race_setups where id=$1', [race.id])).rows[0])[key], 'edited value');
      if (name === 'GT3') sharedId = race.id;
    }
    await assert.rejects(insert({ user_id: ids[0], race_class: 'GT3', setup_type: 'base' }), /SETUP_LIBRARY_SNAPSHOT_REQUIRED/);
    await db.query("insert into public.shared_setups(setup_id,shared_by,share_code,is_public) values ($1,$2,'LIBRARY-QA',true)", [sharedId, ids[0]]);
    for (const id of ids.slice(1)) {
      await signIn(id);
      assert.equal((await db.query("select public.onlyfast_canonical_race_class('GT3') as name")).rows[0].name, null);
      await assert.rejects(db.query("select public.initialize_active_race_class('GT3')"), /CLASS_INVALID/);
      await assert.rejects(db.query("select public.change_active_race_class('GT3')"), /CLASS_INVALID/);
      await assert.rejects(insert({ user_id: id, race_class: 'GT3', setup_type: 'base', custom_fields: { [SETUP_LIBRARY_KEY]: { version: 1, race_class: 'GT3', values: {} } } }), /TEST_ACCOUNT_REQUIRED|row-level security/);
      // Renaming the class cannot smuggle the library snapshot into a normal row.
      await assert.rejects(insert({ user_id: id, race_class: 'Dwarf Cars', setup_type: 'base', custom_fields: { [SETUP_LIBRARY_KEY]: {} } }), /TEST_ACCOUNT_REQUIRED|row-level security/);
      assert.equal((await db.query('select * from public.race_setups where id=$1', [sharedId])).rows.length, 0);
    }
    await signIn(null, 'anon');
    // The old owner policy calls a helper granted only to authenticated;
    // either zero rows or that existing permission denial blocks anon reads.
    try {
      assert.equal((await db.query('select * from public.race_setups where id=$1', [sharedId])).rows.length, 0, 'public share cannot leak a development sheet');
    } catch (error) { assert.match(error.message, /permission denied/); }
    await signIn(ids[1]);
    assert.deepEqual((await db.query('select * from public.race_setups where id=$1', [legacy.id])).rows[0], legacy, 'migration never changes legacy setup rows');
    await db.query("select public.change_active_race_class('Modified')");
    await assert.rejects(db.query("select public.change_active_race_class('Pure Stock')"), /CLASS_CHANGE_COOLDOWN/);
    await signIn(ids[3]);
    await db.query("select public.change_active_race_class('Modified')");
    await db.query("select public.change_active_race_class('Pure Stock')");
    await db.exec('reset role');
    await db.query("update public.user_feature_flags set enabled=false where user_id=$1 and feature_key='test_account_full_access'", [ids[0]]);
    await signIn(ids[0]);
    assert.equal((await db.query('select count(*)::int as n from public.race_setups')).rows[0].n, 0);
    assert.deepEqual((await db.query('select public.list_user_setup_summaries() as rows')).rows[0].rows, []);
    await assert.rejects(db.query("select public.change_active_race_class('GT3')"), /CLASS_INVALID/);
    // Test the direct subscription trigger as owner of the isolated fixture DB.
    await db.exec('reset role');
    await assert.rejects(db.query("update public.user_subscriptions set active_race_class='GT3' where user_id=$1", [ids[1]]), /TEST_ACCOUNT_REQUIRED/);
    await db.query('update public.beta_tester_accounts set beta_features_enabled=false where user_id=$1', [ids[0]]);
    await db.query("update public.user_feature_flags set enabled=true where user_id=$1 and feature_key='test_account_full_access'", [ids[0]]);
    await signIn(ids[0]);
    assert.equal((await db.query('select public.onlyfast_can_use_setup_library() as allowed')).rows[0].allowed, false);
  } finally { clearCachedBetaAccess(); await db.close(); }
});
