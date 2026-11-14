import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bootstrap2027Sequence, TESTING_PROJECT_REF } from '../../scripts/prepare-2027-bootstrap.mjs';

export const archiveAuthFixture = `
create schema auth; create schema extensions;
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
grant usage on schema auth,public to anon,authenticated,service_role;
create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`;

export async function trackTraceSchemaSql() {
  return await readFile(new URL('../../supabase/testing-2027/track-trace.sql',import.meta.url),'utf8') + '\n' +
    await readFile(new URL('../../supabase/testing-2027/track-trace-history-access.sql',import.meta.url),'utf8');
}

export async function archiveSchemaSql({ trackTrace = false } = {}) {
  const entries = (await bootstrap2027Sequence(TESTING_PROJECT_REF)).entries;
  const sql = entries.map(e => e.sql).join('\n')
    .replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi,'')
    .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi,'');
  return sql + '\n' + await readFile(new URL('../../supabase/testing-2027/phase1c-api-hardening.sql',import.meta.url),'utf8') +
    (trackTrace ? '\n' + await readFile(new URL('../../supabase/testing-2027/track-trace.sql',import.meta.url),'utf8') : '') +
    '\n' + await readFile(new URL('../../supabase/testing-2027/phase2-archives.sql',import.meta.url),'utf8') +
    (trackTrace ? '\n' + await readFile(new URL('../../supabase/testing-2027/track-trace-history-access.sql',import.meta.url),'utf8') : '');
}

export async function archiveDatabase(options) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(archiveAuthFixture);
  await db.exec(await archiveSchemaSql(options));
  return db;
}

export async function asRole(db, name, uid='') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,name]);
  await db.exec('set role '+name);
}

export async function seedArchiveUser(db, uid, tier='sportsman') {
  await db.query('insert into auth.users(id) values($1)',[uid]);
  await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,'free','active','Dwarf Cars')",[uid]);
  await db.query("insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind,test_subscription_tier) values($1,true,true,'experimental',$2)",[uid,tier]);
  await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values($1,'test_account_full_access',true)",[uid]);
}
