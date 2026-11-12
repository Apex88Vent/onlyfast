import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { bootstrap2027Sequence, TESTING_PROJECT_REF } from '../scripts/prepare-2027-bootstrap.mjs';

test('2027 schema-only bootstrap rejects other projects and rebuilds the whole reviewed testing schema', async () => {
  await assert.rejects(bootstrap2027Sequence('thpyjvwtfvfxiufchrxn'), /EXACT_TESTING_PROJECT_REQUIRED/);
  await assert.rejects(bootstrap2027Sequence('another-project'), /EXACT_TESTING_PROJECT_REQUIRED/);
  const sequence = await bootstrap2027Sequence(TESTING_PROJECT_REF);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
    for (const entry of sequence.entries) await db.exec(entry.sql
      .replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi, '')
      .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi, ''));
    assert.equal((await db.query<any>('select count(*) n from auth.users')).rows[0].n, 0, 'no customer records or synthetic credentials are seeded');
    assert.equal((await db.query<any>('select count(*) n from public.race_setups')).rows[0].n, 0);
    assert.equal((await db.query<any>('select count(*) n from public.user_subscriptions')).rows[0].n, 0);
    const unsafe = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','onlyfast_private') and c.relkind='r' and not c.relrowsecurity`);
    assert.deepEqual(unsafe.rows, [], 'all application tables have RLS');
    await db.exec('set role anon');
    const environment = (await db.query<any>('select public.get_onlyfast_2027_environment() e')).rows[0].e;
    assert.equal(environment.project_ref, TESTING_PROJECT_REF);
    assert.equal(environment.schema_version, 'phase1b-v1');
    await assert.rejects(db.exec('select * from public.race_setups'), /permission denied/);
    await assert.rejects(db.exec('select * from onlyfast_private.testing_2027_environment'), /permission denied/);
    await db.exec('reset role');
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await db.query('insert into auth.users(id) values($1),($2)', [a, b]);
    await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,'free','active','Dwarf Cars')", [a]);
    const row = (await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,'Private example','base','Dwarf Cars','private notes') returning id", [a])).rows[0];
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select * from public.race_setups')).rows, [], 'foreign setup values are not visible and sharing policies do not recurse');
    assert.equal((await db.query('update public.race_setups set notes=$1 where id=$2 returning id', ['forged', row.id])).rows.length, 0);
    await assert.rejects(db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Forged','base','Dwarf Cars')", [a]), /OWNER|policy|VEHICLE_LOCKED/);
    await assert.rejects(db.exec("update public.user_subscriptions set plan='teams'"), /permission denied/);
    await assert.rejects(db.exec('update public.timing_scan_usage set used_count=0'), /permission denied/);
    await assert.rejects(db.exec('select public.set_onlyfast_test_tier(\'factory\')'), /TEST_ACCOUNT_REQUIRED/);
    await db.exec('reset role');
    assert.equal((await db.query<any>('select notes from public.race_setups where id=$1', [row.id])).rows[0].notes, 'private notes');
    // A repeat application refuses a nonempty schema; it cannot reset data.
    await assert.rejects(db.exec(sequence.entries[0].sql.replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi, '')), /STAGING_BASELINE_REQUIRES_EMPTY_DATABASE_AND_AUTH/);
    await db.exec('rollback');
  } finally { await db.close(); }
});
