import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { ACQUISITION_2027,assertTestingBilling,mapRevenueCat2027,mapStripe2027,registryProduct,stripeInvoiceSubscription,verifyStripe2027Signature,type RegistryProduct } from '../supabase/functions/_shared/subscription-catalog-2027.ts';
const now=Date.parse('2027-01-02T08:00:00Z');
const products:RegistryProduct[]=ACQUISITION_2027.flatMap(plan=>(['app_store','play_store'] as const).map(store=>({
  id:plan.key+'_'+store,provider:'revenuecat',environment:'sandbox',app_id:store==='app_store'?'app82192c9834':'appd348665a60',store,
  product_id:'fixture.'+plan.key,base_plan:'',interval:plan.interval,tier:plan.tier,entitlement:plan.tier,legacy:false,enabled:true,intro_days:plan.intro_days,duration_verified:true,
})));
export const fixtureRegistry=products;
export function nativeFixture(p:RegistryProduct,options:any={}) {
  const start=new Date(now).toISOString(),end=new Date(now+14*86400000).toISOString();
  return {request_date_ms:now,subscriber:{entitlements:{[p.entitlement!]:{product_identifier:p.product_id,expires_date:end}},subscriptions:{[p.product_id]:{
    store:p.store,is_sandbox:true,expires_date:end,original_purchase_date:start,purchase_date:start,store_transaction_id:'fixture-transaction',period_type:'trial',...options}}}};
}
for(const interval of ['month','year'])for(const store of ['app_store','play_store'])test(`verified ${store} Pro ${interval}: 14-day trial, restore, cancellation, conversion, grace, refund and expiry`,()=>{
  const p=products.find(p=>p.interval===interval&&p.tier==='pro'&&p.store===store)!;
  const body=nativeFixture(p);
  const first=mapRevenueCat2027(body,products,now).subscriptions[0];
  assert.equal(first.status,'trialing');assert.equal(Date.parse(first.trial_ends_at!)-Date.parse(first.started_at),14*86400000);
  assert.deepEqual(mapRevenueCat2027(body,products,now),mapRevenueCat2027(body,products,now),'restore does not extend');
  const canceled=nativeFixture(p,{unsubscribe_detected_at:new Date(now).toISOString()});
  const stillActive=mapRevenueCat2027(canceled,products,now).subscriptions[0];
  assert.equal(stillActive.status,'trialing');assert.equal(stillActive.will_renew,false);assert.equal(stillActive.expires_at,first.expires_at);
  assert.equal(mapRevenueCat2027({...body,request_date_ms:now+14*86400000},products,now+14*86400000).subscriptions[0].status,'expired');
  const paid=nativeFixture(p,{period_type:'normal'});assert.equal(mapRevenueCat2027(paid,products,now).subscriptions[0].status,'active');
  assert.equal(mapRevenueCat2027(nativeFixture(p,{refunded_at:new Date(now).toISOString()}),products,now).subscriptions[0].status,'refunded');
  const grace=nativeFixture(p,{period_type:'normal',purchase_date:new Date(now-30*86400000).toISOString(),original_purchase_date:new Date(now-30*86400000).toISOString(),expires_date:new Date(now-1000).toISOString(),grace_period_expires_date:new Date(now+86400000).toISOString()});
  assert.equal(mapRevenueCat2027(grace,products,now).subscriptions[0].status,'grace');
  const bad=nativeFixture(p,{expires_date:new Date(now+7*86400000).toISOString()});
  assert.throws(()=>mapRevenueCat2027(bad,products,now),/TRIAL_TERMS/);
});
test('registry rejects unknown IDs, wrong environments, unverified annual, Factory annual and accidental legacy Pro→Sportsman',()=>{
  const p=products.find(p=>p.interval==='year')!;
  assert.throws(()=>registryProduct([{...p,duration_verified:false}],p),/UNVERIFIED/);
  assert.throws(()=>registryProduct([{...p,tier:'factory'}],p),/UNVERIFIED/);
  const sportsman=products.find(p=>p.tier==='sportsman')!;
  assert.throws(()=>registryProduct([{...sportsman,entitlement:'OnlyFast Pro'}],sportsman),/UNVERIFIED/);
  assert.throws(()=>mapRevenueCat2027(nativeFixture({...p,product_id:'unknown'}),products,now),/UNKNOWN/);
  assert.throws(()=>mapRevenueCat2027(nativeFixture(p,{is_sandbox:false}),products,now),/ENVIRONMENT/);
  assert.throws(()=>mapRevenueCat2027({...nativeFixture(p),request_date_ms:now-300001},products,now),/INVALID/);
  const legacy={...p,id:'legacy_pro',interval:'month' as const,product_id:'app.onlyfast.pro.monthly',tier:'pro' as const,legacy:true,intro_days:0};
  assert.equal(mapRevenueCat2027(nativeFixture(legacy,{period_type:'normal'}),[legacy],now).subscriptions[0].registry_id,'legacy_pro');
  for(const url of ['https://thpyjvwtfvfxiufchrxn.supabase.co','',undefined])assert.throws(()=>assertTestingBilling(k=>({SUPABASE_URL:url,ONLYFAST_2027_BILLING_ENABLED:'true',BILLING_2027_ENVIRONMENT:'sandbox'}[k])),/NOT_ENABLED/);
});
test('Stripe signatures reject replay, future skew, duplicate timestamps, forged body and unknown Price; modern/legacy invoices supported',async()=>{
  const body='{"id":"fixture"}',key='fixture-signature-key',t=now/1000;
  const sig=(time:number,text=body)=>`t=${time},v1=${createHmac('sha256',key).update(time+'.'+text).digest('hex')}`;
  assert.equal(await verifyStripe2027Signature(body,sig(t),key,now),true);
  for(const header of [sig(t-301),sig(t+301),sig(t)+',t='+t,sig(t,'forged')])assert.equal(await verifyStripe2027Signature(body,header,key,now),false);
  assert.equal(stripeInvoiceSubscription({parent:{type:'subscription_details',subscription_details:{subscription:'sub_a'}}}),'sub_a');
  assert.equal(stripeInvoiceSubscription({subscription:{id:'sub_old'}}),'sub_old');
  assert.equal(stripeInvoiceSubscription({parent:{type:'quote_details'}}),null);
  const p:RegistryProduct={...products[2],provider:'stripe',store:'stripe',app_id:'acct_fixture',product_id:'price_fixture',base_plan:'',entitlement:null};
  const s={id:'sub_fixture',livemode:false,status:'trialing',start_date:t,trial_start:t,trial_end:t+14*86400,cancel_at_period_end:true,items:{data:[{price:{id:p.product_id,unit_amount:6000,currency:'usd',recurring:{interval:p.interval,interval_count:1}},current_period_end:t+365*86400}]}};
  assert.equal(mapStripe2027(s,[p],p.app_id,now).status,'trialing');
  assert.equal(mapStripe2027(s,[p],p.app_id,now).will_renew,false);
  assert.throws(()=>mapStripe2027({...s,livemode:true},[p],p.app_id,now),/WRONG/);
  assert.throws(()=>mapStripe2027(s,[],p.app_id,now),/UNKNOWN/);
});
