// Executes SQL only inside disposable, in-memory PostgreSQL. No Supabase access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);

test('trusted subscription authorization preserves grants and rejects editable privileges in PostgreSQL', async () => {
  const db = new PGlite();
  const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.beta_tester_accounts(user_id uuid, is_test_account boolean, beta_features_enabled boolean, tester_kind text);
      create table public.user_feature_flags(user_id uuid, feature_key text, enabled boolean);`);
    for (const path of ['SUBSCRIPTIONS_RLS.sql',
      'supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql',
      'supabase/migrations/202609240001_revenuecat_subscription_sync.sql',
      'supabase/migrations/20261015235847_secure_membership_authorization.sql']) {
      await db.exec(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
    }
    await db.query('insert into auth.users(id) values ($1),($2)', [uid, other]);
    const asUser = async sql => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
      await db.exec('set role authenticated');
      try { return (await db.query(sql)).rows; } finally { await db.exec('reset role'); }
    };
    const membership = async () => (await asUser('select public.get_onlyfast_membership() as m'))[0].m;
    const unlimited = async id => (await asUser(`select onlyfast_private.has_unlimited_vehicles('${id}') as v`))[0].v;
    const grant = async data => db.query('update auth.users set raw_app_meta_data=$1::jsonb where id=$2', [JSON.stringify(data), uid]);
    await db.query(`update auth.users set raw_user_meta_data=$1::jsonb where id=$2`, [JSON.stringify({
      has_admin_full_access: true, membership_tier: 'teams', promo_access_level: 'admin_full_access', onlyfast_vehicle_unlimited: true,
    }), uid]);
    assert.equal((await membership()).tier, 'rookie');
    assert.equal(await unlimited(uid), false);
    await db.query("insert into public.user_subscriptions(user_id,plan,status,subscription_source,stripe_customer_id) values($1,'pro','trialing','stripe','cus_keep')", [uid]);
    assert.equal((await membership()).tier, 'pro');
    await grant({ promo_access_level: 'teams' });
    assert.equal((await membership()).tier, 'team', 'nonexpiring server promotion retained');
    await grant({ promo_access_level: 'teams', promo_access_expires_at: '2000-01-01' });
    assert.equal((await membership()).tier, 'pro', 'expired promotion preserves valid Stripe');
    await grant({ promo_access_level: 'teams', promo_access_expires_at: 'bad-date' });
    assert.equal((await membership()).tier, 'pro', 'malformed grant fails closed without breaking paid accounts');
    await grant({ has_admin_full_access: true });
    assert.equal((await membership()).tier, 'admin');
    await grant({});
    await db.query("update public.user_subscriptions set plan='pro',status='canceled',subscription_source='stripe' where user_id=$1", [uid]);
    await db.query(`select public.onlyfast_apply_revenuecat($1,$2::jsonb)`, [uid, JSON.stringify({
      plan: 'teams', status: 'active', observed_at: new Date().toISOString(), expires_at: '2035-01-01', entitlement_ids: ['OnlyFast Teams'],
    })]);
    assert.equal((await membership()).tier, 'team');
    await db.query("update public.user_subscriptions set revenuecat_expires_at=now()-interval '1 second' where user_id=$1", [uid]);
    assert.equal((await membership()).tier, 'rookie', 'expiry enforced before cron sweep');
    await grant({ promo_access_level: 'pro', promo_access_expires_at: '2035-01-01' });
    assert.equal((await membership()).tier, 'pro', 'native expiration cannot revoke a valid server grant');
    await grant({ onlyfast_vehicle_unlimited: true, onlyfast_vehicle_grant_expires_at: '2035-01-01' });
    assert.equal((await membership()).tier, 'rookie', 'vehicle grant does not grant paid membership');
    assert.equal(await unlimited(uid), true, 'existing scoped vehicle grant retained');
    assert.equal(await unlimited(other), false, 'cannot inspect/use another account vehicle grant');
    for (const expiration of ['2000-01-01', 'bad-date']) {
      await grant({ onlyfast_vehicle_unlimited: true, onlyfast_vehicle_grant_expires_at: expiration });
      assert.equal(await unlimited(uid), false);
    }
    await grant({});
    await db.query("insert into public.beta_tester_accounts values($1,true,true,'experimental');", [uid]);
    await db.query("insert into public.user_feature_flags values($1,'test_account_full_access',true)", [uid]);
    assert.equal((await membership()).tier, 'team', 'explicit experimental account retained');
    await db.exec('set role anon');
    await assert.rejects(db.exec('select public.get_onlyfast_membership()'), /permission denied/);
    await assert.rejects(db.exec(`select public.onlyfast_subscription_tier('${uid}')`), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(asUser('truncate public.user_subscriptions'), /permission denied/);
    await assert.rejects(asUser("update public.user_subscriptions set plan='teams'"), /permission denied/);
    assert.equal((await asUser('select user_id from public.user_subscriptions')).length, 1);
  } finally { await db.close(); }
});
