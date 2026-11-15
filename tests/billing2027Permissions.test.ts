import assert from 'node:assert/strict';
import test from 'node:test';
import {billingDatabase,billingClock,billingRpc} from './helpers/billing2027.mjs';
import {asRole} from './helpers/archive2027.mjs';
test('provider-driven permissions: Sportsman quota/archive denial, Pro restoration, Factory downgrade and expired history preservation',async()=>{
  const db=await billingDatabase(),uid='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
  const rpc=(n:string,args:unknown[]=[])=>billingRpc(db,n,args);let sequence=0;
  const apply=async(id:string|null)=>{
    await asRole(db,'postgres');const time=new Date(Date.parse('2027-01-02T08:00:00Z')+sequence++*1000).toISOString();await billingClock(db,time);await asRole(db,'service_role');
    await rpc('billing2027_apply_snapshot',[uid,{provider:'revenuecat',environment:'sandbox',observed_at:time,subscriptions:id?[{
      registry_id:id,provider_key:id,lineage_id:null,transaction_id:'tx-'+id,status:'active',started_at:time,expires_at:'2027-02-02T08:00:00Z',trial_ends_at:null,will_renew:true,price_amount:null,price_unit:'major',currency:null}]:[]},'event-'+sequence,'TEST_PROVIDER']);
    await asRole(db,'authenticated',uid);
  };
  try {
    await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
    await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,'free','inactive','Dwarf Cars')",[uid]);
    await db.exec("insert into onlyfast_private.billing2027_products(id,provider,environment,app_id,store,product_id,interval,tier,entitlement,legacy,enabled,intro_days,duration_verified) values('sports_fixture','revenuecat','sandbox','app82192c9834','app_store','fixture.sportsman.monthly','month','sportsman','fixture_sportsman',false,true,0,true)");
    await apply('sports_fixture');
    assert.equal(await rpc('onlyfast_subscription_tier',[uid]),'sportsman');
    assert.equal((await db.query<any>('select onlyfast_private.track_trace_enabled() r')).rows[0].r,false);
    const save=async(name:string,type:string,car='Dwarf Cars')=>(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,$2,$3,$4,'original notes') returning id",[uid,name,type,car])).rows[0].id;
    const a=await save('Base one','base_template');await save('Base two','base_template');
    await assert.rejects(save('Base three','base_template'),/SPORTSMAN_BASE_SETUP_LIMIT/);
    for(let i=0;i<5;i++)await save('Weekend '+i,'base');
    await assert.rejects(save('Weekend six','base'),/SPORTSMAN_RACE_WEEKEND_LIMIT/);
    await rpc('set_onlyfast_setup_archive',[a,true]);
    assert.equal((await db.query('select id from public.race_setups where id=$1',[a])).rows.length,0,'archived contents denied');
    await save('Replacement base','base_template');
    await assert.rejects(rpc('set_onlyfast_setup_archive',[a,false]),/RESTORE_REQUIRES/);
    await apply('apple_pro_sandbox');
    assert.equal((await db.query<any>('select onlyfast_private.track_trace_enabled() r')).rows[0].r,true);
    assert.equal((await db.query('select id from public.race_setups where id=$1',[a])).rows.length,1);
    await rpc('set_onlyfast_setup_archive',[a,false]);
    await apply('apple_teams_sandbox');
    await save('Factory extra class','base_template','Modified');
    const retained=(await db.query<any>('select id,notes from public.race_setups order by id')).rows;
    await apply('sports_fixture');
    assert.equal((await rpc('get_onlyfast_2027_account_access')).class_selection_required,true);
    await rpc('choose_onlyfast_2027_class',['Dwarf Cars']);
    await assert.rejects(save('Excess after downgrade','base_template'),/SPORTSMAN_BASE_SETUP_LIMIT/);
    assert.deepEqual((await db.query('select id,notes from public.race_setups order by id')).rows,retained);
    await apply(null);assert.equal(await rpc('onlyfast_subscription_tier',[uid]),'unsubscribed');
    assert.deepEqual((await db.query('select id,notes from public.race_setups order by id')).rows,retained,'unsubscribed historical records remain');
    await assert.rejects(save('Unsubscribed write','base'),/UNSUBSCRIBED|VEHICLE_LOCKED/);
    await asRole(db,'authenticated',other);assert.equal((await db.query('select * from public.race_setups')).rows.length,0);
  }finally{await db.close();}
});
