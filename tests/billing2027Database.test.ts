import assert from 'node:assert/strict';
import test from 'node:test';
import { billingDatabase, billingClock, billingRpc } from './helpers/billing2027.mjs';
import { asRole } from './helpers/archive2027.mjs';

test('Phase3B PostgreSQL: installed Track Trace/archives compatibility, private grants, atomic Rookie claims and exact expiry', async()=>{
  const db=await billingDatabase();
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rpc=(name:string,args:unknown[]=[])=>billingRpc(db,name,args);
  try {
    await db.exec(`insert into auth.users(id) values('${a}'); insert into auth.users(id,created_at) values('${b}','2027-01-02T00:00:00Z');`);
    await billingClock(db,'2026-12-31T08:00:00Z');
    assert.equal(await rpc('billing2027_capture_rookie_cohort'),0,'prelaunch signup trigger already captured the eligible account');
    await asRole(db,'authenticated',a);
    await assert.rejects(rpc('billing2027_capture_rookie_cohort'),/permission denied/);
    await assert.rejects(rpc('billing2027_registry'),/permission denied/);
    await assert.rejects(db.exec('select * from onlyfast_private.billing2027_claims'),/permission denied/);
    await assert.rejects(rpc('claim_onlyfast_2027_sportsman'),/CLAIM_WINDOW_CLOSED/);
    await asRole(db,'postgres'); await billingClock(db,'2027-01-01T08:00:00Z');
    await asRole(db,'authenticated',a);
    assert.equal(await rpc('onlyfast_subscription_tier',[a]),'rookie');
    await asRole(db,'authenticated',b);
    await assert.rejects(rpc('claim_onlyfast_2027_sportsman'),/NOT_ELIGIBLE/);
    await asRole(db,'authenticated',a);
    const claims=await Promise.all(Array.from({length:8},()=>rpc('claim_onlyfast_2027_sportsman')));
    assert.equal(claims.filter(c=>!c.repeated).length,1);
    assert(claims.every(c=>c.expires_at===claims[0].expires_at));
    assert.equal(Date.parse(claims[0].expires_at)-Date.parse(claims[0].claimed_at),30*86400000);
    assert.equal(await rpc('onlyfast_subscription_tier',[a]),'sportsman');
    assert.equal((await db.query<any>('select onlyfast_private.track_trace_enabled() r')).rows[0].r,false);
    await asRole(db,'postgres');
    assert.equal((await db.query<any>('select count(*) n from onlyfast_private.billing2027_claims')).rows[0].n,1);
    assert.equal((await db.query<any>('select count(*) n from public.user_subscriptions')).rows[0].n,0,'claim never creates billing');
    await billingClock(db,'2027-01-31T08:00:00Z');
    await asRole(db,'authenticated',a);
    assert.equal(await rpc('onlyfast_subscription_tier',[a]),'unsubscribed');
    assert.equal((await rpc('claim_onlyfast_2027_sportsman')).repeated,true,'retry does not extend even after expiry');
    await asRole(db,'authenticated',b);
    await assert.rejects(rpc('claim_onlyfast_2027_sportsman'),/CLAIM_WINDOW_CLOSED/);
  } finally {await db.close();}
});

test('Phase3B PostgreSQL: source overlap, grandfather evidence, stale/dedup events, trial expiry, class selection and racing retention',async()=>{
  const uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc',other='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  let before:any;
  const racing=async(db:any)=>(await db.query('select to_jsonb(t) v from public.race_setups t order by id')).rows;
  const db=await billingDatabase({beforeInstall:async(db:any)=>{
    await db.query('insert into auth.users(id) values($1),($2)',[uid,other]);
    await db.query("insert into public.user_subscriptions(user_id,plan,status,subscription_source,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_end,active_race_class) values($1,'pro','active','stripe','cus_keep','sub_keep','price_keep','2027-02-01T00:00:00Z','Dwarf Cars')",[uid]);
    await db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes,session_fastest_lap) values($1,'original racing record','base_template','Dwarf Cars','preserve original notes',15.482)",[uid]);
    before={racing:await racing(db),billing:(await db.query('select to_jsonb(s) v from public.user_subscriptions s')).rows};
  }});
  const rpc=(n:string,args:unknown[]=[])=>billingRpc(db,n,args);
  let n=0;
  const subscription=(registry_id:string,provider_key:string,extras:any={})=>({registry_id,provider_key,lineage_id:provider_key,transaction_id:provider_key+'-tx',status:'active',
    started_at:'2026-12-01T00:00:00Z',expires_at:'2027-02-01T00:00:00Z',trial_ends_at:null,will_renew:true,price_amount:799,price_unit:'minor',currency:'CAD',...extras});
  const apply=async(provider:string,items:any[],time:string,id='evt_'+(++n),account=uid)=>{
    await asRole(db,'postgres');await billingClock(db,time);await asRole(db,'service_role');
    return rpc('billing2027_apply_snapshot',[account,{provider,environment:'sandbox',observed_at:time,subscriptions:items},id,'TEST_VERIFIED_PROVIDER']);
  };
  try {
    assert.deepEqual(await racing(db),before.racing,'installation preserves racing bytes');
    assert.deepEqual((await db.query('select to_jsonb(s) v from public.user_subscriptions s')).rows,before.billing,'installation preserves billing source columns');
    await db.exec("insert into onlyfast_private.billing2027_products(id,provider,environment,app_id,store,product_id,interval,tier,legacy,enabled,duration_verified) values('stripe_fixture','stripe','sandbox','acct_fixture','stripe','price_fixture','month','pro',true,true,true)");
    const stripe=subscription('stripe_fixture','sub_fixture');
    await apply('stripe',[stripe],'2026-12-31T08:00:00Z');
    await apply('stripe',[stripe],'2027-01-01T08:00:00Z','evt_same');
    assert.equal(await rpc('billing2027_apply_snapshot',[uid,{provider:'stripe',environment:'sandbox',observed_at:'2027-01-01T08:00:00Z',subscriptions:[stripe]},'evt_same','RETRY']),'duplicate');
    assert.equal(await rpc('billing2027_apply_snapshot',[uid,{provider:'stripe',environment:'sandbox',observed_at:'2027-01-01T07:59:59Z',subscriptions:[{...stripe,status:'expired'}]},'evt_stale','STALE']),'stale');
    await asRole(db,'authenticated',uid);
    let state=await rpc('get_onlyfast_2027_billing_status');
    assert.equal(state.tier,'pro');assert.equal(state.grandfathered,true);
    assert.equal(state.protection_ends_at,'2028-01-01T08:00:00+00:00');
    assert(!JSON.stringify(state).includes('sub_fixture'));assert(!JSON.stringify(state).includes('price_fixture'));
    await assert.rejects(rpc('billing2027_apply_snapshot',[uid,{},'forged','FORGED']),/permission denied/);
    await apply('revenuecat',[subscription('apple_teams_sandbox','app_store:teams',{expires_at:'2027-01-03T08:00:00Z'})],'2027-01-02T08:00:00Z');
    await asRole(db,'authenticated',uid);
    assert.equal(await rpc('onlyfast_subscription_tier',[uid]),'factory','higher mobile tier wins over Stripe Pro');
    assert.equal((await db.query<any>('select onlyfast_private.track_trace_enabled() r')).rows[0].r,true);
    await asRole(db,'postgres');await billingClock(db,'2027-01-03T08:00:00Z');await asRole(db,'authenticated',uid);
    assert.equal((await rpc('get_onlyfast_2027_account_access')).class_selection_required,true,'clock expiry enforces downgrade without a callback');
    await apply('revenuecat',[],'2027-01-03T08:00:00Z');
    await asRole(db,'authenticated',uid);
    state=await rpc('get_onlyfast_2027_account_access');assert.equal(state.tier,'pro');assert.equal(state.class_selection_required,true);
    assert.equal(await rpc('onlyfast_can_save_setup_class',[uid,'Dwarf Cars']),false);
    assert.equal(await rpc('choose_onlyfast_2027_class',['Dwarf Cars']),'Dwarf Cars');
    assert.equal(await rpc('onlyfast_can_save_setup_class',[uid,'Dwarf Cars']),true);
    assert.deepEqual(await racing(db),before.racing);
    // A provider ownership conflict cannot copy the same subscription to another UUID.
    await assert.rejects(apply('stripe',[stripe],'2027-01-03T09:00:00Z',undefined,other),/RECEIPT_ALREADY_LINKED/);
    await asRole(db,'postgres');
    const raw=(await db.query<any>('select stripe_customer_id,stripe_subscription_id,stripe_price_id from public.user_subscriptions where user_id=$1',[uid])).rows[0];
    assert.deepEqual(raw,{stripe_customer_id:'cus_keep',stripe_subscription_id:'sub_keep',stripe_price_id:'price_keep'});
    await billingClock(db,'2028-01-01T08:00:00Z');
    await apply('stripe',[{...stripe,expires_at:'2028-02-01T08:00:00Z'}],'2028-01-01T08:00:00Z');
    await asRole(db,'authenticated',uid);state=await rpc('get_onlyfast_2027_billing_status');
    assert.equal(state.tier,'pro');assert.equal(state.grandfathered,false,'protection ending does not end paid access');
    assert.equal(state.expires_at,'2028-02-01T08:00:00+00:00');
    await apply('stripe',[{...stripe,status:'expired',expires_at:'2028-02-01T08:00:00Z'}],'2028-02-01T08:00:00Z');
    await asRole(db,'authenticated',uid);assert.equal(await rpc('onlyfast_subscription_tier',[uid]),'unsubscribed');
    assert.deepEqual(await racing(db),before.racing,'expired users retain eligible historical records');
  }finally{await db.close();}
});

test('Phase3B PostgreSQL: Jan25 promotion ends Feb24, final millisecond accepted, no-claim Rookie transition ends exactly at cutoff',async()=>{
  const db=await billingDatabase();
  const ids=['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111'];
  const rpc=(n:string,args:unknown[]=[])=>billingRpc(db,n,args);
  try {
    await db.query('insert into auth.users(id) select unnest($1::uuid[])',[ids]);
    await billingClock(db,'2026-12-31T00:00:00Z');await rpc('billing2027_capture_rookie_cohort');
    await billingClock(db,'2027-01-25T20:00:00Z');await asRole(db,'authenticated',ids[0]);
    const claim=await rpc('claim_onlyfast_2027_sportsman');assert.equal(Date.parse(claim.expires_at),Date.parse('2027-02-24T20:00:00Z'));
    await asRole(db,'postgres');await billingClock(db,'2027-01-31T07:59:59.999Z');await asRole(db,'authenticated',ids[1]);
    assert.equal((await rpc('get_onlyfast_2027_billing_status')).claim_eligible,true);
    await rpc('claim_onlyfast_2027_sportsman');
    await asRole(db,'authenticated',ids[2]);assert.equal(await rpc('onlyfast_subscription_tier',[ids[2]]),'rookie');
    await asRole(db,'postgres');await billingClock(db,'2027-01-31T08:00:00Z');await asRole(db,'authenticated',ids[2]);
    assert.equal(await rpc('onlyfast_subscription_tier',[ids[2]]),'unsubscribed');await assert.rejects(rpc('claim_onlyfast_2027_sportsman'),/WINDOW_CLOSED/);
    await asRole(db,'authenticated',ids[0]);assert.equal(await rpc('onlyfast_subscription_tier',[ids[0]]),'sportsman');
  }finally{await db.close();}
});
