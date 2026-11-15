import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { billingDatabase } from './helpers/billing2027.mjs';
test('Phase3B installation stops on concurrent shared-function source drift',async()=>{
  await assert.rejects(billingDatabase({beforeInstall:async(db:any)=>{
    await db.exec("create or replace function onlyfast_private.account_access_2027() returns jsonb language sql stable security definer set search_path='' as $$ select '{}'::jsonb $$");
  }}),/SHARED_MEMBERSHIP_SOURCE_DRIFT_REVIEW_REQUIRED/);
});
test('Phase3B artifacts: reviewed fingerprints, testing-only guard, read-only catalog verification and retention SQL',async()=>{
  const root=new URL('../supabase/testing-2027/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('phase3b-subscriptions.manifest.json',root),'utf8'));
  assert.equal(manifest.installation_authorized,false);assert.equal(manifest.deployment_authorized,false);
  for(const [name,entry] of Object.entries<any>(manifest.files)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex').toUpperCase(),entry.sha256);
  }
  const sql=await readFile(new URL('phase3b-subscriptions-install.sql',root),'utf8');
  assert(sql.indexOf('ISOLATED_2027_TEST_DATABASE_REQUIRED')<sql.indexOf('create table'));
  assert(!/cron\.schedule|stripe\.com|revenuecat\.com|delete from public\./i.test(sql));
  const db=await billingDatabase();
  try {
    await db.exec('create table cron.job(jobname text,schedule text,active boolean)');
    const results=await db.exec(await readFile(new URL('phase3b-subscriptions-verify.sql',root),'utf8'));
    const checks=results.flatMap(r=>r.rows).filter((r:any)=>r.check_name);
    assert.equal(checks.length,11);assert(checks.every((r:any)=>r.passed),JSON.stringify(checks));
    const retention=await db.exec(await readFile(new URL('phase3b-subscriptions-retention.sql',root),'utf8'));
    const rows=retention.flatMap(r=>r.rows);
    assert.equal(rows.length,16);assert(rows.every((r:any)=>r.project_ref===manifest.project_ref&&/^[a-f0-9]{32}$/.test(r.rows_md5)));
    await db.exec("create or replace function public.get_onlyfast_2027_environment() returns jsonb language sql as $$ select '{\"project_ref\":\"production-denied\"}'::jsonb $$");
    await assert.rejects(db.exec(sql),/ISOLATED_2027_TEST_DATABASE_REQUIRED/);await db.exec('rollback');
  } finally {await db.close();}
});
