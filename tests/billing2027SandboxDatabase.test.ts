import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { billingDatabase,billingClock,billingRpc } from './helpers/billing2027.mjs';
import { asRole } from './helpers/archive2027.mjs';
import { mapRevenueCat2027 } from '../supabase/functions/_shared/subscription-catalog-2027.ts';
import { sandboxProducts2027 as products,sandboxTrialFixture2027,sandboxUser2027 as uid } from './helpers/revenuecatSandbox2027.ts';
const sql=await readFile(new URL('../supabase/testing-2027/20261117235314_onlyfast_2027_phase3e_sandbox_billing_testing.sql',import.meta.url),'utf8');
test('Phase3E additive registry: eight exact mappings, legacy/racing retention, service-only evidence, atomic apply and callback dedup',async()=>{
  const db=await billingDatabase();
  const now=Date.parse('2027-02-01T08:00:00Z'),p=products.find(p=>p.tier==='pro')!,fixture=sandboxTrialFixture2027(p,now);
  const rpc=(name:string,args:any[]=[])=>billingRpc(db,name,args);
  try {
    await db.exec(`insert into auth.users(id) values('${uid}'); insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values('${uid}','preserved racing record','base_template','Dwarf Cars','original');`);
    const baseline=(await db.query('select to_jsonb(p) v from onlyfast_private.billing2027_products p order by id')).rows;
    const racing=(await db.query('select to_jsonb(p) v from public.race_setups p order by id')).rows;
    await db.exec(sql);
    const verification=await db.exec(await readFile(new URL('../supabase/testing-2027/phase3e-sandbox-verify.sql',import.meta.url),'utf8'));
    const checks=verification.flatMap(r=>r.rows).filter((r:any)=>r.check_name);
    assert.equal(checks.length,4);assert(checks.every((r:any)=>r.passed));
    const registered=(await db.query('select * from onlyfast_private.billing2027_products where not legacy order by id')).rows;
    assert.equal(registered.length,8);
    for(const expected of products)assert.deepEqual(registered.find((p:any)=>p.id===expected.id),expected);
    assert.deepEqual((await db.query('select to_jsonb(p) v from onlyfast_private.billing2027_products p where legacy order by id')).rows,baseline);
    assert.deepEqual((await db.query('select to_jsonb(p) v from public.race_setups p order by id')).rows,racing);
    await billingClock(db,new Date(now).toISOString());await asRole(db,'authenticated',uid);
    await assert.rejects(rpc('billing2027_trial_evidence',[uid]),/permission denied/);
    await assert.rejects(rpc('billing2027_apply_native_snapshot',[uid,{},'forged','INITIAL_PURCHASE',[]]),/permission denied/);
    await asRole(db,'service_role');
    const snapshot=mapRevenueCat2027(fixture.body,products,now,fixture.context);
    const args=[uid,snapshot,fixture.event.id,'INITIAL_PURCHASE',[fixture.evidence]];
    assert.equal(await rpc('billing2027_apply_native_snapshot',args),'applied');
    assert.equal(await rpc('billing2027_apply_native_snapshot',args),'duplicate');
    assert.deepEqual(await rpc('billing2027_trial_evidence',[uid]),[fixture.evidence]);
    assert.deepEqual(await rpc('billing2027_trial_evidence',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']),[]);
    assert.equal(mapRevenueCat2027(fixture.body,products,now,{user_id:uid,evidence:await rpc('billing2027_trial_evidence',[uid])}).subscriptions[0].status,'trialing');
    await assert.rejects(rpc('billing2027_apply_native_snapshot',[uid,snapshot,'mismatch','INITIAL_PURCHASE',[{...fixture.evidence,user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}]]),/EVIDENCE/);
    await asRole(db,'authenticated',uid);assert.equal((await rpc('get_onlyfast_2027_billing_status')).tier,'pro');
    await asRole(db,'postgres');await billingClock(db,new Date(now+300000).toISOString());await asRole(db,'authenticated',uid);
    assert.equal((await rpc('get_onlyfast_2027_billing_status')).tier,'unsubscribed');
    await asRole(db,'postgres');
    assert.equal((await db.query('select count(*)::int n from onlyfast_private.billing2027_events')).rows[0].n,1);
    assert.deepEqual((await db.query('select to_jsonb(p) v from public.race_setups p order by id')).rows,racing);
    await assert.rejects(db.exec(sql),/PHASE3E_ALREADY_INSTALLED/);await db.exec('rollback');
  }finally{await db.close();}
});
test('Phase3E migration refuses a production/mismatched identity before registry changes',async()=>{
  const db=await billingDatabase();
  try{
    await db.exec(`create or replace function public.get_onlyfast_2027_environment() returns jsonb language sql as $$ select '{"project_ref":"thpyjvwtfvfxiufchrxn"}'::jsonb $$`);
    await assert.rejects(db.exec(sql),/ISOLATED_2027_TEST_DATABASE_REQUIRED/);await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int n from onlyfast_private.billing2027_products')).rows[0].n,12);
  }finally{await db.close();}
});
