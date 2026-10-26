// Actual local Supabase/PostgreSQL/Auth/Edge tests. No production or RevenueCat API calls.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repoRoot, stagingSequence } from '../scripts/prepare-staging-database.mjs';
import { authorizeSandboxTester, NATIVE_TEST_FEATURE } from '../src/lib/nativeSandboxPolicy.ts';

const workspace = process.env.ONLYFAST_LOCAL_WORKSPACE;
test('real local Supabase: migrations, RLS, cron, RevenueCat HTTP synchronization and Stripe compatibility',
  { skip: !workspace, timeout: 240_000 }, async t => {
    const root = path.resolve(workspace);
    const inventory = JSON.parse(await readFile(path.join(repoRoot, 'supabase/staging/schema-expectations.json'), 'utf8'));
    const config = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
    assert.match(config, /project_id = "onlyfast-disposable-staging"/);
    assert.doesNotMatch(config, /\[remotes/);
    await assert.rejects(readFile(path.join(root, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.entries, (await stagingSequence()).entries.map(({ sql, ...e }) => e));
    const settings = JSON.parse(await readFile(path.join(root, 'local-status.json'), 'utf8'));
    assert.equal(new URL(settings.API_URL).origin, 'http://127.0.0.1:54321');
    assert.equal(new URL(settings.DB_URL).hostname, '127.0.0.1');
    const base = settings.API_URL;
    const service = settings.SERVICE_ROLE_KEY;
    const anon = settings.ANON_KEY;
    assert.ok(service && anon, 'local development API keys are required');
    const docker = process.env.ONLYFAST_DOCKER || path.join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
    const container = 'supabase_db_onlyfast-disposable-staging';
    const dockerRun = args => spawnSync(docker, ['--context', 'desktop-linux', ...args], { encoding: 'utf8', windowsHide: true });
    const context = dockerRun(['context', 'inspect', 'desktop-linux', '--format', '{{json .Endpoints.docker.Host}}']);
    assert.equal(context.status, 0);
    assert.match(context.stdout, /npipe:.*dockerDesktopLinuxEngine/);
    const sql = statement => {
      const result = dockerRun(['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-A', '-t', '-c', statement]);
      if (result.status !== 0) throw new Error(result.stderr.trim());
      return result.stdout.trim();
    };
    const query = statement => JSON.parse(sql(`select coalesce(jsonb_agg(q),'[]'::jsonb) from (${statement}) q`));
    const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
    async function request(route, token = service, options = {}) {
      const url = new URL(route, base);
      assert.equal(url.origin, 'http://127.0.0.1:54321');
      const result = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(25_000),
        headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
      const text = await result.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: result.status, data };
    }
    const rpc = (name, body, token = service) => request('/rest/v1/rpc/' + name, token, { method: 'POST', body: JSON.stringify(body) });
    const row = uid => query(`select * from public.user_subscriptions where user_id=${literal(uid)}::uuid`)[0];
    const fixtures = new Map();
    let observed = Date.now();
    let fixtureCalls = 0;
    const mock = createServer((req, res) => {
      if (req.headers.authorization !== 'Bearer onlyfast-local-fixture-key') { res.writeHead(401); res.end('{}'); return; }
      const match = req.url.match(/^\/v1\/subscribers\/([0-9a-f-]+)$/i);
      if (!match || req.method !== 'GET') { res.writeHead(404); res.end('{}'); return; }
      fixtureCalls++;
      const fixture = fixtures.get(match[1]) || { entitlements: {}, subscriptions: {} };
      if (fixture.error) { res.writeHead(fixture.error); res.end('{}'); return; }
      observed = Math.max(Date.now(), observed + 1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ request_date_ms: observed, subscriber: fixture }));
    });
    await new Promise((resolve, reject) => { mock.once('error', reject); mock.listen(55439, '0.0.0.0', resolve); });
    const future = () => new Date(Date.now() + 7 * 86400000).toISOString();
    const past = () => new Date(Date.now() - 86400000).toISOString();
    const active = (plan, changes = {}) => {
      const product = plan === 'pro' ? 'app.onlyfast.pro.monthly' : 'teams:teams';
      const entitlement = plan === 'pro' ? 'OnlyFast Pro' : 'OnlyFast Teams';
      const end = future();
      return { entitlements: { [entitlement]: { product_identifier: product, expires_date: end } },
        subscriptions: { [product]: { store: plan === 'pro' ? 'app_store' : 'play_store', is_sandbox: true, expires_date: end, ...changes } } };
    };
    const free = () => ({ entitlements: {}, subscriptions: {} });
    const sync = user => request('/functions/v1/sync-revenuecat-subscription', user.token, { method: 'POST', body: '{}' });
    const webhook = (uid, id, type = 'RENEWAL', changes = {}, authorization = 'Bearer onlyfast-local-webhook-secret') =>
      request('/functions/v1/revenuecat-webhook', anon, { method: 'POST', headers: { Authorization: authorization },
        body: JSON.stringify({ api_version: '1.0', event: { id, type, app_user_id: uid, app_id: 'app_ios', environment: 'SANDBOX', event_timestamp_ms: Date.now(), ...changes } }) });
    const tier = async user => { const r = await rpc('get_onlyfast_membership', {}, user.token); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.tier; };
    const users = [];
    async function account(label) {
      const email = `local-${label}-${randomBytes(5).toString('hex')}@example.invalid`;
      const password = randomBytes(20).toString('hex');
      const created = await request('/auth/v1/admin/users', service, { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const signed = await request('/auth/v1/token?grant_type=password', anon, { method: 'POST', body: JSON.stringify({ email, password }) });
      assert.equal(signed.status, 200, JSON.stringify(signed.data));
      const user = { id: created.data.id, token: signed.data.access_token };
      users.push(user);
      return user;
    }
    try {
      await t.test('all 16 migrations and 23 RLS tables exist; production column/constraint inventory matches', () => {
        const versions = query('select version from supabase_migrations.schema_migrations order by version').map(r => r.version);
        assert.deepEqual(versions, manifest.entries.map(e => e.file.split('_')[0]));
        const tables = query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
        assert.equal(tables.length, 23);
        assert.ok(tables.every(r => r.relrowsecurity));
        for (const table of inventory.tables) {
          const cols = query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null from pg_attribute a where a.attrelid=${literal('public.' + table.name)}::regclass and a.attnum>0 and not a.attisdropped`);
          for (const col of table.columns) assert.deepEqual(cols.find(c => c.name === col.name), col, table.name + '.' + col.name);
          const constraints = query(`select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=${literal('public.' + table.name)}::regclass`);
          for (const c of table.constraints || []) assert.equal(constraints.find(a => a.conname === c.name)?.definition, c.definition, table.name + '.' + c.name);
        }
      });
      const rookie = await account('rookie');
      const pro = await account('pro');
      const teams = await account('teams');
      const stripe = await account('stripe');
      await t.test('native test gate uses server assignments: RLS rejects self-enrollment and hides other testers', async () => {
        const readAs = user => ({
          user: async () => {
            const r = await request('/auth/v1/user', user.token);
            assert.equal(r.status, 200);
            return r.data.id;
          },
          account: async id => {
            const r = await request('/rest/v1/beta_tester_accounts?select=is_test_account,beta_features_enabled,tester_kind&user_id=eq.' + id, user.token);
            assert.equal(r.status, 200);
            return r.data[0] ?? null;
          },
          flags: async id => {
            const r = await request('/rest/v1/user_feature_flags?select=feature_key,enabled&user_id=eq.' + id, user.token);
            assert.equal(r.status, 200);
            return r.data;
          },
        });
        await assert.rejects(authorizeSandboxTester(readAs(rookie)));
        const forged = await request('/auth/v1/user', rookie.token, { method: 'PUT', body: JSON.stringify({ data: {
          is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental', native_subscription_testing: true,
        } }) });
        assert.equal(forged.status, 200);
        await assert.rejects(authorizeSandboxTester(readAs(rookie)));
        for (const table of ['beta_tester_accounts', 'user_feature_flags']) {
          const r = await request('/rest/v1/' + table, rookie.token, { method: 'POST', body: JSON.stringify({ user_id: rookie.id }) });
          assert.ok([401, 403].includes(r.status), `${table}: ${r.status}`);
        }
        sql(`insert into public.beta_feature_definitions(feature_key,description) values('${NATIVE_TEST_FEATURE}','Local native bridge diagnostics only') on conflict do nothing;
          insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values(${literal(rookie.id)}::uuid,true,true,'experimental');
          insert into public.user_feature_flags(user_id,feature_key,enabled) values(${literal(rookie.id)}::uuid,'${NATIVE_TEST_FEATURE}',true);`);
        assert.equal(await authorizeSandboxTester(readAs(rookie)), rookie.id);
        const hidden = await request('/rest/v1/beta_tester_accounts?user_id=eq.' + rookie.id, pro.token);
        assert.deepEqual(hidden.data, []);
        sql(`insert into public.user_feature_flags(user_id,feature_key,enabled) values(${literal(rookie.id)}::uuid,'test_account_full_access',true);`);
        await assert.rejects(authorizeSandboxTester(readAs(rookie)));
        sql(`delete from public.beta_tester_accounts where user_id=${literal(rookie.id)}::uuid;
          delete from public.user_feature_flags where user_id=${literal(rookie.id)}::uuid;`);
      });
      await t.test('local endpoints reject missing/invalid authentication and malformed webhooks', async () => {
        assert.equal((await webhook(pro.id, 'bad-auth', 'RENEWAL', {}, 'wrong')).status, 401);
        assert.equal((await request('/functions/v1/sync-revenuecat-subscription', 'invalid', { method: 'POST', body: '{}' })).status, 401);
        assert.equal((await request('/functions/v1/revenuecat-webhook', anon, { method: 'GET' })).status, 405);
        assert.equal((await request('/functions/v1/sync-revenuecat-subscription', anon, { method: 'GET' })).status, 405);
        assert.equal((await webhook(pro.id, '', 'RENEWAL')).status, 400);
        assert.equal((await webhook(pro.id, 'connectivity', 'TEST')).status, 200);
      });
      await t.test('Rookie remains free and cannot forge metadata, subscription writes or a service RPC', async () => {
        fixtures.set(rookie.id, free());
        assert.equal((await sync(rookie)).status, 200);
        assert.equal(await tier(rookie), 'rookie');
        const forged = await request('/auth/v1/user', rookie.token, { method: 'PUT', body: JSON.stringify({ data: { has_admin_full_access: true, membership_tier: 'teams', promo_access_level: 'teams' } }) });
        assert.equal(forged.status, 200);
        assert.equal(await tier(rookie), 'rookie');
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          const result = await request('/rest/v1/user_subscriptions?user_id=eq.' + rookie.id, rookie.token,
            { method, body: method === 'DELETE' ? undefined : JSON.stringify({ user_id: rookie.id, plan: 'teams', status: 'active' }) });
          assert.ok([401, 403].includes(result.status), `${method}: ${result.status}`);
        }
        assert.ok([401, 403].includes((await rpc('onlyfast_apply_revenuecat', { p_user_id: rookie.id, p_snapshot: {} }, rookie.token)).status));
        assert.throws(() => sql('set role authenticated; truncate public.user_subscriptions;'), /permission denied/);
      });
      await t.test('Pro and Teams sync through real Auth, Edge Runtime and PostgREST', async () => {
        fixtures.set(pro.id, active('pro', { period_type: 'trial' }));
        fixtures.set(teams.id, active('teams'));
        assert.equal((await sync(pro)).status, 200);
        assert.equal((await sync(teams)).status, 200);
        assert.equal(await tier(pro), 'pro');
        assert.equal(await tier(teams), 'team');
        assert.equal(row(pro.id).subscription_source, 'revenuecat');
        assert.ok(Date.parse(row(pro.id).revenuecat_expires_at) > Date.now(), 'trial has a finite future expiration');
      });
      await t.test('RLS exposes only the signed-in account; forged sync body cannot target another account', async () => {
        const own = await request('/rest/v1/user_subscriptions?select=user_id', rookie.token);
        assert.deepEqual(own.data.map(r => r.user_id), [rookie.id]);
        const forged = await request('/functions/v1/sync-revenuecat-subscription', rookie.token, { method: 'POST', body: JSON.stringify({ user_id: teams.id, plan: 'teams', status: 'active' }) });
        assert.equal(forged.status, 200);
        assert.equal(await tier(rookie), 'rookie');
        assert.equal(await tier(teams), 'team');
      });
      await t.test('cancellation retains access through expiration; duplicate event cannot apply a different state', async () => {
        fixtures.set(pro.id, active('pro', { unsubscribe_detected_at: new Date().toISOString() }));
        assert.equal((await webhook(pro.id, 'local-cancel', 'CANCELLATION')).status, 200);
        assert.equal(await tier(pro), 'pro');
        const before = row(pro.id);
        const calls = fixtureCalls;
        fixtures.set(pro.id, free());
        assert.equal((await webhook(pro.id, 'local-cancel', 'CANCELLATION')).status, 200);
        assert.equal(fixtureCalls, calls, 'duplicate is acknowledged without another provider fetch');
        assert.equal(row(pro.id).revenuecat_observed_at, before.revenuecat_observed_at);
        assert.equal(query("select count(*)::int as n from public.revenuecat_webhook_events where event_id='local-cancel'")[0].n, 1);
      });
      await t.test('expired subscription loses access and valid grace retains temporary access', async () => {
        fixtures.set(pro.id, free());
        assert.equal((await webhook(pro.id, 'local-expiration', 'EXPIRATION')).status, 200);
        assert.equal(await tier(pro), 'rookie');
        const grace = active('pro');
        grace.entitlements['OnlyFast Pro'].expires_date = past();
        grace.subscriptions['app.onlyfast.pro.monthly'].expires_date = past();
        grace.subscriptions['app.onlyfast.pro.monthly'].grace_period_expires_date = future();
        fixtures.set(pro.id, grace);
        assert.equal((await sync(pro)).status, 200);
        assert.equal(await tier(pro), 'pro');
      });
      await t.test('Stripe trial retains precedence, cancellation falls back to native Teams, renewal reclaims Stripe', async () => {
        sql(`insert into public.user_subscriptions(user_id,plan,status,stripe_customer_id,current_period_end)
          values(${literal(stripe.id)}::uuid,'pro','trialing','cus_local_synthetic','2035-01-01')
          on conflict(user_id) do update set plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id,current_period_end=excluded.current_period_end`);
        fixtures.set(stripe.id, active('teams'));
        assert.equal((await sync(stripe)).status, 200);
        assert.equal(row(stripe.id).plan, 'pro');
        assert.equal(row(stripe.id).subscription_source, 'stripe');
        assert.equal(row(stripe.id).revenuecat_plan, 'teams');
        sql(`update public.user_subscriptions set plan='pro',status='canceled',stripe_customer_id='cus_local_synthetic' where user_id=${literal(stripe.id)}::uuid`);
        assert.equal(await tier(stripe), 'team');
        fixtures.set(stripe.id, free());
        assert.equal((await sync(stripe)).status, 200);
        assert.equal(await tier(stripe), 'rookie');
        sql(`update public.user_subscriptions set plan='pro',status='active',stripe_customer_id='cus_local_synthetic' where user_id=${literal(stripe.id)}::uuid`);
        assert.equal(await tier(stripe), 'pro');
        assert.equal(row(stripe.id).stripe_customer_id, 'cus_local_synthetic');
        assert.ok(row(stripe.id).current_period_end.startsWith('2035-01-01'));
      });
      await t.test('provider failures retry without recording a lost event or downgrading paid access', async () => {
        fixtures.set(teams.id, { error: 503 });
        assert.equal((await webhook(teams.id, 'local-retry')).status, 500);
        assert.equal((await sync(teams)).status, 502);
        assert.equal(await tier(teams), 'team');
        assert.equal(query("select count(*)::int as n from public.revenuecat_webhook_events where event_id='local-retry'")[0].n, 0);
        fixtures.set(teams.id, active('teams'));
        assert.equal((await webhook(teams.id, 'local-retry')).status, 200);
        assert.equal(query("select count(*)::int as n from public.revenuecat_webhook_events where event_id='local-retry'")[0].n, 1);
      });
      await t.test('stale snapshots do not overwrite newer state; malformed writes roll back deduplication', async () => {
        const snapshot = { plan: 'free', status: 'expired', observed_at: past(), expires_at: null, entitlement_ids: [] };
        const stale = await rpc('onlyfast_apply_revenuecat', { p_user_id: teams.id, p_snapshot: snapshot });
        assert.equal(stale.status, 200);
        assert.equal(stale.data, 'stale');
        assert.equal(await tier(teams), 'team');
        const malformed = await rpc('onlyfast_apply_revenuecat', { p_user_id: teams.id, p_event_id: 'local-malformed', p_event_at: new Date().toISOString(), p_snapshot: { ...snapshot, observed_at: new Date(Date.now() + 10000).toISOString(), entitlement_ids: 'bad-array' } });
        assert.equal(malformed.status, 400);
        assert.equal(query("select count(*)::int as n from public.revenuecat_webhook_events where event_id='local-malformed'")[0].n, 0);
      });
      await t.test('transfer reconciles each synthetic account separately and rejects conflicting UUID aliases', async () => {
        fixtures.set(pro.id, free());
        fixtures.set(teams.id, active('teams'));
        assert.equal((await webhook(pro.id, 'local-transfer', 'TRANSFER', { app_id: undefined, environment: undefined, transferred_from: [pro.id], transferred_to: [teams.id] })).status, 200);
        assert.equal(await tier(pro), 'rookie');
        assert.equal(await tier(teams), 'team');
        assert.equal(query("select count(*)::int as n from public.revenuecat_webhook_events where event_id='local-transfer'")[0].n, 2);
        assert.equal((await webhook(pro.id, 'local-aliased', 'RENEWAL', { aliases: [teams.id] })).status, 500);
        assert.equal((await webhook(pro.id, 'local-wrong-app', 'RENEWAL', { app_id: 'unconfigured_app' })).data.ignored, 'app');
      });
      await t.test('native pg_cron worker expires a subscription without manually invoking the sweep', async () => {
        assert.equal(query("select extname from pg_extension where extname='pg_cron'").length, 1);
        assert.match(sql('show shared_preload_libraries'), /pg_cron/);
        const jobs = query("select jobid,schedule,command,active from cron.job where jobname='onlyfast-expire-revenuecat'");
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0].schedule, '* * * * *');
        assert.equal(jobs[0].active, true);
        fixtures.set(teams.id, active('teams'));
        assert.equal((await sync(teams)).status, 200);
        sql(`update public.user_subscriptions set revenuecat_expires_at=now()-interval '1 second' where user_id=${literal(teams.id)}::uuid`);
        assert.equal(await tier(teams), 'rookie', 'authorization enforces expiry before cron runs');
        const deadline = Date.now() + 75_000;
        while (Date.now() < deadline && row(teams.id).status !== 'expired') await new Promise(r => setTimeout(r, 2000));
        assert.equal(row(teams.id).plan, 'free');
        assert.equal(row(teams.id).status, 'expired');
        assert.ok(query(`select status from cron.job_run_details where jobid=${jobs[0].jobid} and status='succeeded'`).length > 0);
        assert.equal(await tier(stripe), 'pro', 'cron does not expire valid Stripe');
      });
    } finally {
      // Delete only identities generated by this run, exclusively through local Auth.
      for (const user of users) await request('/auth/v1/admin/users/' + user.id, service, { method: 'DELETE' });
      sql(`delete from public.beta_feature_definitions where feature_key='${NATIVE_TEST_FEATURE}';`);
      await new Promise(resolve => mock.close(resolve));
    }
  });
