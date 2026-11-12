// Disposable PostgreSQL/WASM only. No network, hosted project or real accounts.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { stagingSequence } from '../scripts/prepare-staging-database.mjs';
import { testing2027Sql, loadMembershipPolicy } from '../scripts/prepare-2027-testing-policy.mjs';

test('2027 PostgreSQL: trusted overrides, Sportsman quotas/locks/read access, class and usage enforcement, legacy billing preservation', async () => {
  const db = new PGlite();
  const tester = randomUUID(), normal = randomUUID();
  const role = async (name: string, uid = '') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [uid, name]);
    await db.exec('set role ' + name);
  };
  const rpc = async (name: string, args: unknown[] = []) => (await db.query<any>('select public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') result', args)).rows[0].result;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
    for (const entry of (await stagingSequence()).entries) await db.exec(entry.sql.toString('utf8')
      .replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi, '')
      .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi, ''));
    for (const file of ['20261105090932_phase1_membership_and_sharing.sql', '20261105090937_phase1_setup_and_usage_authorization.sql',
      '20261105091108_phase1_restrict_legacy_access.sql', '20261110233145_restore_test_subscription_switching.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    const sql = await testing2027Sql();
    await assert.rejects(db.exec(sql), /ISOLATED_2027_TEST_DATABASE_REQUIRED/); await db.exec('rollback');
    await db.query("select set_config('onlyfast.testing_project_ref','thpyjvwtfvfxiufchrxn',false)");
    await assert.rejects(db.exec(sql), /ISOLATED_2027_TEST_DATABASE_REQUIRED/); await db.exec('rollback');
    await db.query("select set_config('onlyfast.testing_project_ref','abcdefghijklmnopqrst',false)");
    await db.exec(sql);
    const policy = await loadMembershipPolicy();
    for (const [tier, limits] of Object.entries<any>(policy.tierLimits)) {
      const row = (await db.query<any>('select * from onlyfast_private.subscription_2027_limits where tier=$1', [tier])).rows[0];
      assert.equal(row.max_base, limits.maxBaseSetups === 'unlimited' ? null : limits.maxBaseSetups);
      assert.equal(row.max_regular, limits.maxRaceWeekendSetups === 'unlimited' ? null : limits.maxRaceWeekendSetups);
      assert.equal(row.onlylaps, limits.onlyLapsEnabled); assert.equal(row.ads, limits.adsEnabled);
    }
    for (const id of [tester, normal]) {
      await db.query('insert into auth.users(id) values($1)', [id]);
      await db.query("insert into public.user_subscriptions(user_id,plan,status,subscription_source,active_race_class) values($1,'pro','active','stripe','Dwarf Cars')", [id]);
    }
    await db.query("insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values($1,true,true,'experimental')", [tester]);
    await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values($1,'test_account_full_access',true)", [tester]);
    const billing = (await db.query('select * from public.user_subscriptions order by user_id')).rows;
    await role('authenticated', normal);
    await assert.rejects(rpc('set_onlyfast_test_tier', ['factory']), /TEST_ACCOUNT_REQUIRED/);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ user_metadata: { membership_tier: 'factory' } })]);
    assert.equal(await rpc('onlyfast_subscription_tier', [normal]), 'pro');
    await role('authenticated', tester);
    for (const tier of ['rookie', 'pro', 'team', 'sportsman', 'factory']) {
      assert.equal(await rpc('set_onlyfast_test_tier', [tier]), tier);
      assert.equal(await rpc('onlyfast_subscription_tier', [tester]), tier);
      assert.equal(await rpc('onlyfast_has_unlimited_classes', [tester]), ['team', 'factory'].includes(tier));
      assert.equal(await rpc('onlyfast_can_save_setup_class', [tester, 'Modified']), ['team', 'factory'].includes(tier));
    }
    await rpc('set_onlyfast_test_tier', ['sportsman']);
    const insert = async (name: string, kind = 'base') => (await db.query<any>(
      "insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes,session_fastest_lap) values($1,$2,$3,'Dwarf Cars','keep all notes',15.482) returning *", [tester, name, kind])).rows[0];
    await insert('Base 1', 'base_template'); await insert('Base 2', 'base_template');
    await assert.rejects(insert('Base 3', 'base_template'), /SPORTSMAN_BASE_SETUP_LIMIT/);
    const saved: any[] = [];
    for (let i = 0; i < 5; i++) saved.push(await insert('Weekend ' + i));
    await assert.rejects(insert('Weekend 6'), /SPORTSMAN_RACE_WEEKEND_LIMIT/);
    await role('postgres');
    await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '49 hours' where user_id=$1", [tester]);
    await role('authenticated', tester);
    const clock = await rpc('get_onlyfast_2027_setup_edit_state', [saved[0].id]);
    assert(Date.now() - Date.parse(clock.created_at) >= 48 * 3600000);
    for (const column of ['notes', 'session_label']) {
      await assert.rejects(db.query('update public.race_setups set ' + column + "='changed' where id=$1", [saved[0].id]), /SPORTSMAN_SETUP_EDIT_LOCKED/);
    }
    await assert.rejects(db.query('update public.race_setups set session_fastest_lap=1 where id=$1', [saved[0].id]), /SPORTSMAN_SETUP_EDIT_LOCKED/);
    const visible = (await db.query<any>('select * from public.race_setups where id=$1', [saved[0].id])).rows[0];
    assert.equal(visible.notes, 'keep all notes'); assert.equal(Number(visible.session_fastest_lap), 15.482);
    assert.equal((await db.query('select * from public.race_setups')).rows.length, 7);
    await assert.rejects(insert('Weekend 6 after lock'), /SPORTSMAN_RACE_WEEKEND_LIMIT/);
    await assert.rejects(db.exec("update public.race_setups set created_at=now()"), /SETUP_IDENTITY_IMMUTABLE/);
    // Factory removes the age lock; Pro preserves the existing single-class rule.
    await rpc('set_onlyfast_test_tier', ['factory']);
    await db.query("update public.race_setups set notes='factory edit' where id=$1", [saved[0].id]);
    await rpc('set_onlyfast_test_tier', ['pro']);
    await db.query("update public.race_setups set notes='pro edit' where id=$1", [saved[0].id]);
    await assert.rejects(db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Wrong class','base','Modified')", [tester]), /VEHICLE|policy/);
    await rpc('set_onlyfast_test_tier', ['sportsman']);
    await role('service_role');
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      const result = await rpc('onlyfast_reserve_usage', [tester, 'timing', id, 'a'.repeat(64), null, false]);
      assert.equal(result.status, i < 2 ? 'reserved' : 'limit');
      if (result.token) await rpc('onlyfast_finish_usage', [tester, 'timing', id, result.token, { ok: true }]);
    }
    for (let i = 0; i < 2; i++) {
      const id = randomUUID();
      const result = await rpc('onlyfast_reserve_usage', [tester, 'assist', id, 'b'.repeat(64), saved[0].id, false]);
      assert.equal(result.status, i === 0 ? 'reserved' : 'limit');
      if (result.token) await rpc('onlyfast_finish_usage', [tester, 'assist', id, result.token, { ok: true }]);
    }
    await role('anon'); await assert.rejects(rpc('set_onlyfast_test_tier', ['factory']), /permission denied/);
    await role('authenticated', tester);
    await assert.rejects(db.exec("update public.user_subscriptions set plan='teams'"), /permission denied/);
    await assert.rejects(db.exec('select * from onlyfast_private.subscription_2027_limits'), /permission denied/);
    await role('postgres');
    assert.deepEqual((await db.query('select * from public.user_subscriptions order by user_id')).rows, billing);
    await db.query('update public.user_feature_flags set enabled=false where user_id=$1', [tester]);
    await role('authenticated', tester);
    assert.equal(await rpc('get_onlyfast_test_tier'), null);
    assert.equal(await rpc('onlyfast_subscription_tier', [tester]), 'pro');
  } finally { await db.close(); }
});
