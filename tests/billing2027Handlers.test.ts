import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { billing2027Handler } from '../supabase/functions/_shared/billing2027-handlers.ts';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const env:Record<string,string>={SUPABASE_URL:'https://mfzajhnfonrfuiwxgvhe.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',
  ONLYFAST_2027_BILLING_ENABLED:'true',BILLING_2027_ENVIRONMENT:'sandbox',BILLING2027_SANDBOX_ISOLATION_CONFIRMED:'true',BILLING2027_TEST_USER_IDS:uid,BILLING2027_REVENUECAT_SECRET_API_KEY:'fixture-rc',
  BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION:'Bearer fixture-webhook',BILLING2027_RECONCILE_AUTHORIZATION:'Bearer fixture-worker',
  BILLING2027_STRIPE_WEBHOOK_SECRET:'fixture-stripe-signature',BILLING2027_STRIPE_SECRET_KEY:'sk_test_fixture',BILLING2027_STRIPE_ACCOUNT_ID:'acct_fixture'};
const products=[{id:'apple_pro_sandbox',provider:'revenuecat',environment:'sandbox',app_id:'app82192c9834',store:'app_store',product_id:'app.onlyfast.pro.monthly',base_plan:'',interval:'month',tier:'pro',entitlement:'OnlyFast Pro',legacy:true,enabled:true,intro_days:0,duration_verified:true},
  {id:'stripe_fixture',provider:'stripe',environment:'sandbox',app_id:'acct_fixture',store:'stripe',product_id:'price_fixture',base_plan:'',interval:'year',tier:'pro',entitlement:null,legacy:false,enabled:true,intro_days:14,duration_verified:true}];
const post=(data:unknown,auth='Bearer user-fixture')=>new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(data)});
test('HTTP: testing guard before IO, authenticated claim, wrong-account body ignored, forged purchase ignored and transfer quarantine',async()=>{
  const calls:any[]=[],requests:string[]=[];let failure=false;let wrongProduct=false;
  const factory=(_url:string,_key:string,options:any)=>({auth:{getUser:async(t:string)=>({data:{user:t==='user-fixture'?{id:uid}:null},error:t!=='user-fixture'})},
    rpc:async(name:string,args:any)=>{calls.push({name,args,bearer:options.global?.headers.Authorization});return {data:name==='billing2027_registry'?products:name==='billing2027_trial_evidence'?[]:name==='get_onlyfast_2027_billing_status'?{user_id:uid}:name==='claim_onlyfast_2027_sportsman'?{expires_at:'2027-02-01T00:00:00Z'}:'applied',error:failure?{}:null};}});
  const fetcher:typeof fetch=async(input)=>{requests.push(String(input));const now=Date.now(),sku=wrongProduct?'unknown':'app.onlyfast.pro.monthly',end=new Date(now+14*86400000).toISOString();
    return Response.json({request_date_ms:now,subscriber:{entitlements:{'OnlyFast Pro':{product_identifier:sku,expires_date:end}},subscriptions:{[sku]:{store:'app_store',is_sandbox:true,expires_date:end,original_purchase_date:new Date(now).toISOString(),purchase_date:new Date(now).toISOString(),period_type:'trial',store_transaction_id:'fixture-only-tx'}}}});};
  const handler=(action:Parameters<typeof billing2027Handler>[0],overrides={})=>billing2027Handler(action,k=>({...env,...overrides}[k]),factory,fetcher);
  assert.equal((await handler('claim',{SUPABASE_URL:'https://thpyjvwtfvfxiufchrxn.supabase.co'})(post({}))).status,503);assert.equal(calls.length,0);
  assert.equal((await handler('claim')(post({},'Bearer wrong'))).status,401);assert.equal(calls.length,0);
  assert.equal((await handler('claim')(post({user_id:other,eligible:true,expires_at:'2099-01-01'}))).status,200);
  assert.equal(calls[0].name,'claim_onlyfast_2027_sportsman');assert.equal(calls[0].args,undefined);assert.equal(calls[0].bearer,'Bearer user-fixture');
  calls.length=0;
  assert.equal((await handler('sync')(post({user_id:other,success:true,entitlements:{factory:true}}))).status,200);
  assert(requests.every(url=>url.endsWith('/'+uid)));
  const apply=calls.find(c=>c.name==='billing2027_apply_native_snapshot');assert.equal(apply.args.p_uid,uid);assert.equal(apply.args.p_snapshot.subscriptions[0].registry_id,'apple_pro_sandbox');
  wrongProduct=true;calls.length=0;
  assert.equal((await handler('sync')(post({success:true}))).status,502);assert(!calls.some(c=>c.name==='billing2027_apply_native_snapshot'));
  wrongProduct=false;
  const e={api_version:'1.0',event:{id:'rc_fixture',type:'INITIAL_PURCHASE',app_user_id:uid,app_id:'app82192c9834',store:'APP_STORE',product_id:'app.onlyfast.pro.monthly',environment:'SANDBOX',event_timestamp_ms:Date.now()}};
  assert.equal((await handler('revenuecat-webhook')(post(e,'wrong'))).status,401);
  assert.equal((await handler('revenuecat-webhook')(post({...e,event:{...e.event,environment:'PRODUCTION'}},'Bearer fixture-webhook'))).status,422);
  assert.equal((await handler('revenuecat-webhook')(post({...e,event:{...e.event,type:'TRANSFER',transferred_from:[uid],transferred_to:[other]}},'Bearer fixture-webhook'))).status,409);
  assert.equal((await handler('revenuecat-webhook')(post(e,'Bearer fixture-webhook'))).status,200);
  failure=true;assert.equal((await handler('claim')(post({}))).status,409);
});
test('HTTP: signed modern Stripe invoice refetches provider state, ignores stale event status and rejects live-mode IO',async()=>{
  const calls:any[]=[],requests:string[]=[];
  const now=Math.floor(Date.now()/1000);
  const factory=()=>({rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:name==='billing2027_registry'?products:name==='billing2027_stripe_owner'?uid:'applied',error:null};}});
  const fetcher:typeof fetch=async(input,init)=>{requests.push(String(input));assert.equal(new Headers(init?.headers).get('Stripe-Version'),'2026-10-28.endive');
    if(String(input).endsWith('/account'))return Response.json({id:'acct_fixture'});
    return Response.json({id:'sub_fixture',livemode:false,status:'trialing',start_date:now,trial_start:now,trial_end:now+14*86400,metadata:{user_id:uid},cancel_at_period_end:true,
      items:{data:[{current_period_end:now+365*86400,price:{id:'price_fixture',unit_amount:6000,currency:'usd',recurring:{interval:'year',interval_count:1}}}]}});};
  const handler=billing2027Handler('stripe-webhook',k=>env[k],factory,fetcher);
  const invoke=(event:any,age=0)=>{const body=JSON.stringify(event),t=now-age,signature=createHmac('sha256',env.BILLING2027_STRIPE_WEBHOOK_SECRET).update(t+'.'+body).digest('hex');return handler(new Request('https://fixture.invalid',{method:'POST',body,headers:{'stripe-signature':`t=${t},v1=${signature}`}}));};
  const event={id:'evt_fixture',livemode:false,type:'invoice.payment_failed',data:{object:{metadata:{user_id:other},parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}}}}};
  assert.equal((await invoke(event,301)).status,401);assert.equal(requests.length,0);
  assert.equal((await invoke({...event,livemode:true})).status,422);assert.equal(requests.length,0);
  assert.equal((await invoke(event)).status,200);
  const s=calls.find(c=>c.name==='billing2027_apply_snapshot');assert.equal(s.args.p_uid,uid);assert.equal(s.args.p_snapshot.subscriptions[0].status,'trialing');assert.equal(s.args.p_snapshot.subscriptions[0].will_renew,false);
  assert.equal(requests.length,2);assert(requests[0].endsWith('/account'));assert(requests[1].endsWith('/subscriptions/sub_fixture'));
});
