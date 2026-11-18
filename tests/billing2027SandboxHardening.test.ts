import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRevenueCat2027 } from '../supabase/functions/_shared/subscription-catalog-2027.ts';
import { sandboxProducts2027 as rows,sandboxTrialFixture2027,sandboxUser2027 } from './helpers/revenuecatSandbox2027.ts';
const now=Date.parse('2027-01-02T08:00:00Z');
for(const p of rows.filter(p=>p.tier==='pro'))test(`${p.product_id}: verified accelerated trial, cancellation, restore, renewal and expiry`,()=>{
  const {body,raw,context}=sandboxTrialFixture2027(p,now);
  const mapped=mapRevenueCat2027(body,rows,now,context).subscriptions[0];
  assert.equal(mapped.status,'trialing');assert.equal(Date.parse(mapped.trial_ends_at!)-now,300000);
  assert.deepEqual(mapRevenueCat2027(body,rows,now,context).subscriptions[0],mapped);
  const canceled=structuredClone(body);Object.assign(canceled.subscriber.subscriptions[p.product_id],{unsubscribe_detected_at:new Date(now).toISOString()});
  const c=mapRevenueCat2027(canceled,rows,now,context).subscriptions[0];assert.equal(c.status,'trialing');assert.equal(c.will_renew,false);assert.equal(c.expires_at,mapped.expires_at);
  const end=Date.parse(raw.expires_date);assert.equal(mapRevenueCat2027({...body,request_date_ms:end},rows,end,context).subscriptions[0].status,'expired');
  const renewed=structuredClone(body);Object.assign(renewed.subscriber.subscriptions[p.product_id],{period_type:'normal',purchase_date:raw.expires_date,expires_date:new Date(end+300000).toISOString(),store_transaction_id:'renewal-'+p.id});
  renewed.request_date_ms=end;assert.equal(mapRevenueCat2027(renewed,rows,end).subscriptions[0].status,'active');
});
test('trial evidence fails closed for missing, forged or mismatched identity/app/offer/transaction/purchase state',()=>{
  for(const p of rows.filter(p=>p.tier==='pro')){
    const f=sandboxTrialFixture2027(p,now);
    assert.throws(()=>mapRevenueCat2027(f.body,rows,now),/SANDBOX_TRIAL/);
    for(const patch of [{user_id:'other'},{app_id:'wrong'},{product_id:'wrong'},{transaction_id:'wrong'},{environment:'PRODUCTION'},
      {offer_code:'wrong-offer'},{period_type:'NORMAL'},{type:'TEST'},{price:1},{is_family_share:true},{expiration_at_ms:now+1},
      {purchased_at_ms:now-1},{store:'PROMOTIONAL'},{entitlement_ids:['OnlyFast Teams']},{presented_offering_id:'onlyfast_monthly_v1'}])
      assert.throws(()=>mapRevenueCat2027(f.body,rows,now,{user_id:sandboxUser2027,evidence:[{...f.evidence,...patch}]}),/EVIDENCE/);
    for(const patch of [{is_sandbox:false},{ownership_type:'FAMILY_SHARED'},{period_type:'pending'},{store_transaction_id:null},
      {expires_date:new Date(now-1).toISOString()},{expires_date:new Date(now+15*86400000).toISOString()}]){
      const body=structuredClone(f.body);Object.assign(body.subscriber.subscriptions[p.product_id],patch);
      assert.throws(()=>mapRevenueCat2027(body,rows,now,f.context));
    }
  }
});
test('Google bare product keys require the matching explicit base plan; conflicting plans are denied',()=>{
  const p=rows.find(p=>p.store==='play_store'&&p.tier==='pro')!,f=sandboxTrialFixture2027(p,now),bare=p.product_id.split(':')[0];
  const body={...f.body,subscriber:{subscriptions:{[bare]:{...f.raw,product_plan_identifier:p.base_plan}},entitlements:{'OnlyFast Pro':{product_identifier:bare,expires_date:f.raw.expires_date}}}};
  assert.equal(mapRevenueCat2027(body,rows,now,f.context).subscriptions[0].registry_id,p.id);
  assert.throws(()=>mapRevenueCat2027({...f.body,subscriber:{...f.body.subscriber,subscriptions:{[p.product_id]:{...f.raw,product_plan_identifier:'wrong'}}}},rows,now,f.context),/PLAN/);
});
