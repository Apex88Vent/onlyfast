// Run separately with PGLITE_MODULE pointing to @electric-sql/pglite's index.js.
// No live database, credentials, or production data are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);

test('real PostgreSQL migrations preserve both providers, deduplicate, order and enforce permissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
    for (const path of ['../SUBSCRIPTIONS_RLS.sql',
      '../supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql']) {
      await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
    }
    // Reproduce Supabase's legacy broad defaults, including PUBLIC inheritance.
    await db.exec(`grant all on public.user_subscriptions to public, anon, authenticated;
      -- Match the deployed table, which has an id PK and a separate unique user_id.
      alter table public.user_subscriptions drop constraint user_subscriptions_pkey,
        add unique(user_id), add column id uuid primary key default gen_random_uuid(),
        add column current_period_end timestamptz, add column active_race_class text;`);
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await db.query('insert into auth.users values ($1), ($2)', [a, b]);
    await db.query(`insert into public.user_subscriptions(user_id, plan, status, subscription_source, stripe_customer_id, current_period_end)
      values ($1, 'pro', 'active', 'stripe', 'cus_original', '2035-01-01T00:00:00Z')`, [a]);
    await db.exec(await readFile(new URL('../supabase/migrations/202609240001_revenuecat_subscription_sync.sql', import.meta.url), 'utf8'));
    const snapshot = (plan, offset = 0) => ({ plan, status: plan === 'free' ? 'expired' : 'active',
      observed_at: new Date(Date.now() + offset).toISOString(),
      expires_at: plan === 'free' ? null : new Date(Date.now() + 86400000).toISOString(),
      product_id: plan + '_monthly', entitlement_ids: plan === 'free' ? [] : [plan], store: 'app_store' });
    const apply = async (uid, data, id) => (await db.query(
      `select public.onlyfast_apply_revenuecat($1, $2::jsonb, $3, 'RENEWAL', now()) as result`,
      [uid, JSON.stringify(data), id])).rows[0].result;
    const row = async uid => (await db.query('select * from public.user_subscriptions where user_id=$1', [uid])).rows[0];
    assert.equal((await row(a)).stripe_plan, 'pro', 'migration backfills Stripe without changing access');
    await apply(a, snapshot('teams'), 'evt_1');
    assert.equal((await row(a)).plan, 'pro', 'active Stripe retains precedence');
    assert.equal((await row(a)).stripe_customer_id, 'cus_original');
    assert.equal((await row(a)).current_period_end.toISOString(), '2035-01-01T00:00:00.000Z');
    assert.equal((await row(a)).revenuecat_plan, 'teams');
    assert.equal(await apply(a, snapshot('free', 1000), 'evt_1'), 'duplicate');
    assert.equal((await row(a)).revenuecat_plan, 'teams');
    assert.equal(await apply(a, snapshot('free', -86400000), 'old_event'), 'stale');
    await db.query(`insert into public.user_subscriptions(user_id, plan, status, subscription_source, stripe_customer_id)
      values ($1, 'pro', 'canceled', 'stripe', 'cus_original') on conflict(user_id) do update
      set plan=excluded.plan, status=excluded.status, subscription_source=excluded.subscription_source`, [a]);
    assert.equal((await row(a)).plan, 'teams', 'Stripe cancellation preserves active native entitlement');
    assert.equal((await row(a)).stripe_status, 'canceled');
    await apply(a, snapshot('free', 2000), 'expiration');
    assert.equal((await row(a)).plan, 'free');
    await db.query(`update public.user_subscriptions set plan='teams', status='trialing', subscription_source='stripe' where user_id=$1`, [a]);
    await apply(a, snapshot('free', 3000), 'another_expiration');
    assert.equal((await row(a)).plan, 'teams', 'native expiration never revokes valid Stripe');
    assert.equal((await row(a)).status, 'trialing');
    // The live Stripe webhook includes identifiers but omits subscription_source.
    // Exercise its exact upsert shape, including a Stripe event after native took over.
    await db.query(`insert into public.user_subscriptions(user_id, plan, status, stripe_customer_id)
      values ($1, 'pro', 'canceled', 'cus_original') on conflict(user_id) do update
      set plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id`, [a]);
    await apply(a, snapshot('teams', 4000), 'native_after_stripe');
    assert.equal((await row(a)).plan, 'teams');
    await db.query(`insert into public.user_subscriptions(user_id, plan, status, stripe_customer_id)
      values ($1, 'pro', 'trialing', 'cus_original') on conflict(user_id) do update
      set plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id`, [a]);
    assert.equal((await row(a)).subscription_source, 'stripe', 'legacy Stripe renewal reclaims provider ownership');
    assert.equal((await row(a)).stripe_status, 'trialing');
    assert.equal((await row(a)).revenuecat_plan, 'teams', 'legacy Stripe writes retain native snapshot');
    const beforeClassWrite = await row(a);
    await db.query(`update public.user_subscriptions set active_race_class='Dwarf Cars' where user_id=$1`, [a]);
    const afterClassWrite = await row(a);
    assert.equal(afterClassWrite.stripe_status, beforeClassWrite.stripe_status);
    assert.deepEqual(afterClassWrite.revenuecat_observed_at, beforeClassWrite.revenuecat_observed_at);
    await db.exec('set role service_role');
    await db.query(`update public.user_subscriptions set plan='teams',status='active',stripe_customer_id='cus_original' where user_id=$1`, [a]);
    await db.exec('reset role');
    assert.equal((await row(a)).stripe_plan, 'teams', 'real service role retains Stripe write privileges');
    await apply(b, snapshot('pro'), 'native_only');
    assert.equal((await row(b)).plan, 'pro');
    assert.equal((await row(b)).subscription_source, 'revenuecat');
    await db.query(`update public.user_subscriptions set revenuecat_expires_at=now()-interval '1 second' where user_id=$1`, [b]);
    await db.exec('select public.onlyfast_expire_revenuecat()');
    assert.equal((await row(b)).status, 'expired', 'safety sweep revokes expired native access');
    assert.equal((await row(a)).status, 'active', 'native sweep preserves the current Stripe status');
    await assert.rejects(apply(b, { ...snapshot('pro', 5000), entitlement_ids: 'not-an-array' }, 'invalid_event'));
    assert.equal((await db.query(`select count(*)::int as count from public.revenuecat_webhook_events where event_id='invalid_event'`)).rows[0].count, 0, 'failed updates roll back event deduplication');
    await db.exec('grant select on public.user_subscriptions to authenticated; set role authenticated;');
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [a]);
    assert.equal((await db.query('select user_id from public.user_subscriptions')).rows.length, 1, 'RLS only exposes the current account');
    await assert.rejects(db.query(`update public.user_subscriptions set plan='teams' where user_id=$1`, [a]));
    await assert.rejects(apply(a, snapshot('teams'), 'forged'));
    await assert.rejects(db.exec('select * from public.revenuecat_webhook_events'));
    await assert.rejects(db.exec('truncate public.user_subscriptions'), /permission denied/);
    const privileges = await db.query(`select
      has_table_privilege('authenticated','public.user_subscriptions','TRIGGER') as trigger,
      has_table_privilege('anon','public.user_subscriptions','TRUNCATE') as truncate,
      has_table_privilege('service_role','public.user_subscriptions','UPDATE') as service_write`);
    assert.deepEqual(privileges.rows[0], { trigger: false, truncate: false, service_write: true });
  } finally { await db.close(); }
});
