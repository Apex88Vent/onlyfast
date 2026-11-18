import { readFileSync } from 'node:fs';
import type { RegistryProduct } from '../../supabase/functions/_shared/subscription-catalog-2027.ts';
import { sandboxTrialEvidence2027 } from '../../supabase/functions/_shared/revenuecat-sandbox-2027.ts';
export const sandboxUser2027='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const plan=JSON.parse(readFileSync(new URL('../../supabase/testing-2027/phase3d-revenuecat-products.plan.json',import.meta.url),'utf8'));
export const sandboxProducts2027:RegistryProduct[]=plan.plans.flatMap((p:any)=>p.products.map((s:any)=>({
  id:s.revenuecat_id,provider:'revenuecat',environment:'sandbox',app_id:s.app_id,store:s.store,product_id:s.product_id,
  base_plan:s.base_plan,interval:p.interval,tier:p.tier,entitlement:p.entitlement,legacy:false,enabled:true,intro_days:p.intro_days,duration_verified:true,
})));
export function sandboxTrialFixture2027(p:RegistryProduct,now=Date.parse('2027-01-02T08:00:00Z'),duration=300000){
  const end=new Date(now+duration).toISOString();
  const raw={store:p.store,is_sandbox:true,ownership_type:'PURCHASED',period_type:'trial',store_transaction_id:'fixture-'+p.id,
    purchase_date:new Date(now).toISOString(),original_purchase_date:new Date(now).toISOString(),expires_date:end};
  const body={request_date_ms:now,subscriber:{entitlements:{[p.entitlement!]:{product_identifier:p.product_id,expires_date:end}},subscriptions:{[p.product_id]:raw}}};
  const event={id:'trial-'+p.id,type:'INITIAL_PURCHASE',app_id:p.app_id,app_user_id:sandboxUser2027,original_app_user_id:sandboxUser2027,
    product_id:p.product_id,store:p.store==='app_store'?'APP_STORE':'PLAY_STORE',environment:'SANDBOX',transaction_id:raw.store_transaction_id,
    event_timestamp_ms:now,purchased_at_ms:now,expiration_at_ms:now+duration,period_type:'TRIAL',entitlement_ids:['OnlyFast Pro'],
    price:0,is_family_share:false,offer_code:p.store==='play_store'?'pro14day2027':null,presented_offering_id:'onlyfast_2027_v1'};
  const evidence=sandboxTrialEvidence2027(event,sandboxUser2027);
  return {body,raw,event,evidence,context:{user_id:sandboxUser2027,evidence:[evidence]}};
}
