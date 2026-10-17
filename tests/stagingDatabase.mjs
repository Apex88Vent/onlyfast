// Complete data-free rebuild in disposable PostgreSQL/WASM; never connects to Supabase.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { prepareStagingDatabase, stagingSequence, repoRoot } from '../scripts/prepare-staging-database.mjs';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const read = relative => readFile(path.join(repoRoot, relative), 'utf8');

async function platform(db) {
  // Supabase-managed platform objects only. Every application table comes from the prepared SQL.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
    grant usage on schema auth to anon,authenticated,service_role;
    create schema cron;
    create table cron.test_jobs(id bigint generated always as identity,jobname text,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$
      insert into cron.test_jobs(jobname,schedule,command) values($1,$2,$3) returning id $$;`);
}

function portable(sql) {
  // PGlite has core gen_random_uuid, but cannot load Supabase server extensions.
  // Only extension installation is adapted; application SQL is executed unchanged.
  return sql.replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi, '')
    .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi, '');
}

test('unmodified repository history reproduces missing baseline and OnlyLaps dependency failures', async () => {
  const db = new PGlite();
  try {
    await platform(db);
    await assert.rejects(db.exec(await read('supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql')),
      /relation "public.user_subscriptions" does not exist/);
    await db.exec('rollback');
    assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public'")).rows[0].n, 0);
    await db.exec(portable(await read('supabase/setup.sql')));
    await db.exec(await read('SUBSCRIPTIONS_RLS.sql'));
    await assert.rejects(db.exec(portable(await read('supabase/migrations/202607280002_onlyfast_onlylaps_backend_foundation.sql'))),
      /relation "public.onlylaps_timing_sessions" does not exist/);
  } finally { await db.close(); }
});

test('offline staging workspace is deterministic, complete, immutable and refuses existing targets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'onlyfast-staging-'));
  try {
    const output = path.join(root, 'fresh');
    const manifest = await prepareStagingDatabase(output);
    assert.equal(manifest.entries.length, 16);
    assert.equal(Object.keys(manifest.excluded).length, 2);
    const files = await readdir(path.join(output, 'supabase', 'migrations'));
    assert.deepEqual(files.sort(), manifest.entries.map(e => e.file).sort());
    for (const e of manifest.entries) {
      const sql = await readFile(path.join(output, 'supabase', 'migrations', e.file));
      assert.equal(createHash('sha256').update(sql).digest('hex'), e.sha256);
      assert.deepEqual(sql, await readFile(path.join(repoRoot, e.source)), 'original migration bytes retained');
    }
    assert.equal((await readFile(path.join(output, 'supabase', 'config.toml'), 'utf8')).includes('enabled = false'), true);
    assert.equal((await readdir(path.join(output, 'supabase'))).includes('.temp'), false);
    assert.equal((await readdir(path.join(output, 'supabase'))).includes('functions'), false);
    await assert.rejects(prepareStagingDatabase(output), /EEXIST/);
    assert.deepEqual(manifest.entries, (await stagingSequence()).entries.map(({ sql, ...e }) => e));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('staging baseline refuses existing Auth accounts even when public schema is empty', async () => {
  const db = new PGlite();
  try {
    await platform(db);
    await db.query('insert into auth.users(id,email) values($1,$2)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'guard@example.invalid']);
    const { entries } = await stagingSequence();
    await assert.rejects(db.exec(portable(entries[0].sql.toString('utf8'))), /STAGING_BASELINE_REQUIRES_EMPTY_DATABASE_AND_AUTH/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 1, 'existing Auth data is preserved');
    assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('all staged migrations rebuild 23 application tables from empty Auth and preserve billing boundaries', async () => {
  const db = new PGlite();
  try {
    await platform(db);
    const sequence = await stagingSequence();
    for (const entry of sequence.entries) {
      try { await db.exec(portable(entry.sql.toString('utf8'))); }
      catch (error) { throw new Error(`Failed staging migration ${entry.file} (${entry.source}): ${error.message}`, { cause: error }); }
    }
    assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 0);
    const tables = (await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows;
    assert.equal(tables.length, 23);
    assert.ok(tables.every(t => t.relrowsecurity));
    const expected = JSON.parse(await read('supabase/staging/schema-expectations.json'));
    for (const table of expected.tables) {
      const actual = (await db.query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null
        from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped`, ['public.' + table.name])).rows;
      for (const col of table.columns) assert.deepEqual(actual.find(a => a.name === col.name), col, `${table.name}.${col.name}`);
      const constraints = (await db.query('select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=$1::regclass', ['public.' + table.name])).rows;
      for (const c of table.constraints || []) assert.equal(constraints.find(a => a.conname === c.name)?.definition, c.definition,
        `${table.name}.${c.name} must retain the audited constraint`);
    }
    assert.equal((await db.query("select attidentity from pg_attribute where attrelid='public.onlylaps_telemetry_samples'::regclass and attname='id'")).rows[0].attidentity, 'd');
    assert.deepEqual((await db.query('select jobname,schedule,command from cron.test_jobs')).rows, [{ jobname: 'onlyfast-expire-revenuecat', schedule: '* * * * *', command: 'select public.onlyfast_expire_revenuecat()' }]);
    for (const name of ['user_subscriptions','beta_tester_accounts','user_feature_flags','onlylaps_telemetry_samples','revenuecat_webhook_events']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${name}`)).rows[0].n, 0, 'no customer/account data seeded');
    }
    // Verify account-specific migrations really are unsuitable for an empty Auth database.
    for (const name of Object.keys(sequence.excluded)) {
      await assert.rejects(db.exec(await read('supabase/migrations/' + name)), /was not found|does not exist/);
      await db.exec('rollback');
    }
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb),($4,$5,\'{}\')',
      [a, 'rookie@example.invalid', JSON.stringify({ has_admin_full_access: true, promo_access_level: 'teams' }), b, 'other@example.invalid']);
    const asUser = async sql => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
      await db.exec('set role authenticated');
      try { return (await db.query(sql)).rows; } finally { await db.exec('reset role'); }
    };
    assert.equal((await asUser('select public.get_onlyfast_membership() as m'))[0].m.tier, 'rookie');
    await asUser("select public.save_racing_onboarding_progress('discipline')");
    await asUser("select public.save_racing_onboarding_progress('vehicle','road_course')");
    await asUser("select public.save_racing_onboarding_progress('plan','road_course','GT3')");
    await asUser('select public.complete_racing_onboarding()');
    assert.equal((await asUser('select public.get_active_race_class_state() as s'))[0].s.active_class, 'GT3');
    assert.equal((await asUser('select public.get_onlyfast_membership() as m'))[0].m.tier, 'rookie', 'free onboarding needs no billing');
    await assert.rejects(asUser("update public.user_subscriptions set plan='teams'"), /permission denied/);
    await assert.rejects(asUser('truncate public.user_subscriptions'), /permission denied/);
    await db.exec('set role service_role');
    await db.query(`insert into public.user_subscriptions(user_id,plan,status,stripe_customer_id,current_period_end)
      values($1,'pro','trialing','cus_synthetic','2035-01-01') on conflict(user_id) do update set
      plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id,current_period_end=excluded.current_period_end`, [a]);
    await db.exec('reset role');
    await db.query('select public.onlyfast_apply_revenuecat($1,$2::jsonb)', [a, JSON.stringify({ plan: 'teams', status: 'active',
      observed_at: new Date().toISOString(), expires_at: '2035-01-01', entitlement_ids: ['OnlyFast Teams'] })]);
    const paid = (await db.query('select * from public.user_subscriptions where user_id=$1', [a])).rows[0];
    assert.equal(paid.subscription_source, 'stripe');
    assert.equal(paid.plan, 'pro');
    assert.equal(paid.revenuecat_plan, 'teams');
    assert.equal(paid.current_period_end.toISOString(), '2035-01-01T00:00:00.000Z');
    assert.equal(paid.active_race_class, 'GT3');
    assert.equal((await asUser('select public.get_onlyfast_membership() as m'))[0].m.tier, 'pro');
    await db.query("insert into public.user_subscriptions(user_id,plan,status) values($1,'free','inactive')", [b]);
    assert.equal((await asUser('select user_id from public.user_subscriptions')).length, 1, 'RLS own-account reads retained');
    await assert.rejects(db.exec(portable(sequence.entries[0].sql.toString('utf8'))), /STAGING_BASELINE_REQUIRES_EMPTY_DATABASE_AND_AUTH/);
    await db.exec('rollback');
  } finally { await db.close(); }
});
