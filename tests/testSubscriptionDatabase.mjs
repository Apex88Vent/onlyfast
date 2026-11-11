// Real PostgreSQL roles/RLS in disposable WASM only. Never contacts Supabase.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { stagingSequence } from '../scripts/prepare-staging-database.mjs';
import { verifyDatabaseSubscriptionUI } from './testSubscriptionDatabaseUI.mjs';

test('authorized test tiers persist, enforce real quotas/classes, and never write billing', async () => {
  const db = new PGlite();
  const a = randomUUID(), b = randomUUID(), otherTester = randomUUID();
  const role = async (name, uid = '') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [uid, name]);
    await db.exec('set role ' + name);
  };
  const rpc = async (name, args = []) => (await db.query('select public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') result', args)).rows[0].result;
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
    for (const name of ['20261105090932_phase1_membership_and_sharing.sql', '20261105090937_phase1_setup_and_usage_authorization.sql',
      '20261105091108_phase1_restrict_legacy_access.sql', '20261110233145_restore_test_subscription_switching.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    for (const [id, email] of [[a, 'test@test.com'], [b, 'normal@test.com'], [otherTester, 'explicit@example.invalid']]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, email]);
      await db.query("insert into public.user_subscriptions(user_id,plan,status,subscription_source,active_race_class) values($1,'pro','trialing','stripe','Dwarf Cars')", [id]);
    }
    for (const id of [a, otherTester]) {
      await db.query("insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values($1,true,true,'experimental')", [id]);
      await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values($1,'test_account_full_access',true)", [id]);
    }
    const billing = (await db.query('select * from public.user_subscriptions order by user_id')).rows;
    const saved = (await db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,'Keep me','base_template','Dwarf Cars','original') returning *", [a])).rows[0];
    await role('authenticated', a);
    assert.equal(await rpc('get_onlyfast_test_tier'), 'team', 'preserve legacy access until first selection');
    await role('postgres');
    await verifyDatabaseSubscriptionUI(db, role, a, b);
    await role('authenticated', a);
    for (const tier of ['rookie', 'pro', 'team', 'rookie', 'pro', 'rookie', 'team', 'rookie']) {
      assert.equal(await rpc('set_onlyfast_test_tier', [tier]), tier);
      assert.equal(await rpc('onlyfast_subscription_tier', [a]), tier);
      assert.equal((await rpc('get_onlyfast_membership')).tier, tier);
      assert.equal(await rpc('onlyfast_has_unlimited_classes', [a]), tier === 'team');
      assert.equal(await rpc('onlyfast_can_save_setup_class', [a, 'Modified']), tier === 'team', 'real setup class gate follows the selection');
      // A new authenticated session/reload reads persisted state, without metadata.
      await role('anon');
      await assert.rejects(rpc('get_onlyfast_test_tier'), /permission denied/);
      await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /permission denied/);
      await role('authenticated', a);
      assert.equal(await rpc('get_onlyfast_test_tier'), tier);
      await role('service_role');
      assert.equal(await rpc('onlyfast_membership_for_user', [a]), tier, 'Edge entitlement resolver agrees');
      await role('authenticated', a);
    }
    for (const tier of [null, '', 'teams', 'admin']) await assert.rejects(rpc('set_onlyfast_test_tier', [tier]), /TEST_TIER_INVALID/);
    await assert.rejects(db.exec("update public.beta_tester_accounts set test_subscription_tier='team'"), /permission denied/);
    await assert.rejects(db.query('select onlyfast_private.test_subscription_tier($1)', [otherTester]), /permission denied/);
    await assert.rejects(db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Too many','base_template','Dwarf Cars')", [a]), /LIMIT|limit/);
    await role('service_role');
    for (let i = 0; i < 3; i++) {
      const req = randomUUID();
      const result = await rpc('onlyfast_reserve_usage', [a, 'timing', req, 'a'.repeat(64), null, false]);
      assert.equal(result.status, i < 2 ? 'reserved' : 'limit', 'Rookie monthly quota applies');
      if (result.token) await rpc('onlyfast_finish_usage', [a, 'timing', req, result.token, { ok: true }]);
    }
    await role('authenticated', a);
    await rpc('set_onlyfast_test_tier', ['pro']);
    await role('service_role');
    assert.equal((await rpc('onlyfast_reserve_usage', [a, 'timing', randomUUID(), 'a'.repeat(64), null, false])).status, 'reserved');
    await role('authenticated', b);
    assert.equal(await rpc('get_onlyfast_test_tier'), null);
    await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /TEST_ACCOUNT_REQUIRED/);
    await role('postgres');
    await db.query("update auth.users set email='test@test.com',raw_user_meta_data=$1 where id=$2", [JSON.stringify({ test_subscription_tier: 'team', is_test_account: true, membership_tier: 'team' }), b]);
    await role('authenticated', b);
    await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /TEST_ACCOUNT_REQUIRED/);
    assert.equal(await rpc('onlyfast_subscription_tier', [b]), 'pro');
    await role('authenticated', otherTester);
    assert.equal(await rpc('get_onlyfast_test_tier'), 'team');
    await rpc('set_onlyfast_test_tier', ['rookie']);
    await role('postgres');
    // Revocation ignores the stored override and returns legitimate paid access.
    await db.query("update public.user_feature_flags set enabled=false where user_id=$1", [a]);
    await role('authenticated', a);
    assert.equal(await rpc('get_onlyfast_test_tier'), null);
    assert.equal(await rpc('onlyfast_subscription_tier', [a]), 'pro');
    await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /TEST_ACCOUNT_REQUIRED/);
    await role('postgres');
    assert.deepEqual((await db.query('select * from public.user_subscriptions order by user_id')).rows, billing);
    assert.deepEqual((await db.query('select * from public.race_setups where id=$1', [saved.id])).rows[0], saved);
    for (const [deny, restore] of [
      ["update public.beta_tester_accounts set is_test_account=false", "update public.beta_tester_accounts set is_test_account=true"],
      ["update public.beta_tester_accounts set beta_features_enabled=false", "update public.beta_tester_accounts set beta_features_enabled=true"],
      ["update public.beta_tester_accounts set tester_kind='personal'", "update public.beta_tester_accounts set tester_kind='experimental'"],
    ]) {
      await db.query(deny + ' where user_id=$1', [otherTester]);
      await role('authenticated', otherTester);
      assert.equal(await rpc('get_onlyfast_test_tier'), null);
      await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /TEST_ACCOUNT_REQUIRED/);
      await role('postgres');
      await db.query(restore + ' where user_id=$1', [otherTester]);
    }
    // Genuine RevenueCat sync remains independent of the test selection.
    await db.query("update public.user_feature_flags set enabled=true where user_id=$1", [a]);
    await db.query("update public.user_subscriptions set subscription_source='stripe',status='canceled' where user_id in ($1,$2)", [a, b]);
    await role('authenticated', a);
    await rpc('set_onlyfast_test_tier', ['rookie']);
    const snapshot = { plan: 'teams', status: 'active', observed_at: new Date().toISOString(),
      expires_at: '2035-01-01', entitlement_ids: ['OnlyFast Teams'], store: 'app_store' };
    await role('service_role');
    for (const id of [a, b]) await rpc('onlyfast_apply_revenuecat', [id, snapshot]);
    assert.equal(await rpc('onlyfast_membership_for_user', [a]), 'rookie', 'test tier survives a real sync');
    assert.equal(await rpc('onlyfast_membership_for_user', [b]), 'team', 'normal RevenueCat entitlement is retained');
    await role('postgres');
    await db.query("update public.beta_tester_accounts set beta_features_enabled=false where user_id=$1", [a]);
    await role('authenticated', a);
    assert.equal(await rpc('get_onlyfast_test_tier'), null);
    assert.equal(await rpc('onlyfast_subscription_tier', [a]), 'team', 'revocation restores genuine store access');
    await assert.rejects(rpc('set_onlyfast_test_tier', ['team']), /TEST_ACCOUNT_REQUIRED/);
  } finally { await db.close(); }
});
