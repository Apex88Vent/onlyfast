import assert from 'node:assert/strict';
import test from 'node:test';
import { billing2027Handler } from '../supabase/functions/_shared/billing2027-handlers.ts';
import { sandboxProducts2027 as products,sandboxTrialFixture2027,sandboxUser2027 as uid } from './helpers/revenuecatSandbox2027.ts';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const env:Record<string,string>={SUPABASE_URL:'https://mfzajhnfonrfuiwxgvhe.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',
  ONLYFAST_2027_BILLING_ENABLED:'true',BILLING_2027_ENVIRONMENT:'sandbox',BILLING2027_SANDBOX_ISOLATION_CONFIRMED:'true',
  BILLING2027_TEST_USER_IDS:uid,BILLING2027_REVENUECAT_SECRET_API_KEY:'fixture-only',BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION:'Bearer fixture-callback'};
const post=(body:any,auth='Bearer fixture-callback')=>new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)});
test('authenticated Apple/Google callbacks corroborate fresh snapshots, persist evidence, reject client evidence and quarantine aliases',async()=>{
  for(const p of products.filter(p=>p.tier==='pro')){
    const f=sandboxTrialFixture2027(p,Date.now()),calls:any[]=[],events=new Set<string>();let evidence:any[]=[];let alias=false;
    const factory=()=>({auth:{getUser:async(token:string)=>({data:{user:token==='fixture-user'?{id:uid}:null}})},rpc:async(name:string,args:any)=>{
      calls.push({name,args});if(name==='billing2027_registry')return {data:products};
      if(name==='billing2027_trial_evidence')return {data:evidence};
      if(name==='billing2027_apply_native_snapshot'){
        if(events.has(args.p_event_id))return {data:'duplicate'};
        events.add(args.p_event_id);evidence.push(...args.p_trials);return {data:'applied'};
      }
      return {data:{user_id:uid}};
    }});
    let fetches=0;
    const fetcher:typeof fetch=async(input)=>{fetches++;assert(String(input).endsWith('/'+uid));return Response.json({...f.body,request_date_ms:Date.now(),subscriber:{...f.body.subscriber,original_app_user_id:alias?other:uid}});};
    const handler=(action:Parameters<typeof billing2027Handler>[0],overrides={})=>billing2027Handler(action,k=>({...env,...overrides}[k]),factory,fetcher);
    const envelope={api_version:'1.0',event:f.event};
    assert.equal((await handler('revenuecat-webhook',{BILLING2027_SANDBOX_ISOLATION_CONFIRMED:'false'})(post(envelope))).status,503);assert.equal(calls.length,0);assert.equal(fetches,0);
    assert.equal((await handler('revenuecat-webhook')(post(envelope,'forged'))).status,401);assert.equal(fetches,0);
    assert.equal((await handler('sync')(post({evidence:f.context.evidence},'Bearer fixture-user'))).status,502,'Client evidence is not accepted');assert.equal(events.size,0);
    for(const patch of [{offer_code:'invalid'},{transaction_id:'forged'},{expiration_at_ms:0}]){
      assert.equal((await handler('revenuecat-webhook')(post({...envelope,event:{...f.event,...patch}}))).status,502);assert.equal(events.size,0);
    }
    assert.equal((await handler('revenuecat-webhook')(post(envelope))).status,200);assert.equal(evidence.length,1);
    assert.equal((await handler('revenuecat-webhook')(post(envelope))).status,200);assert.equal(evidence.length,1,'Duplicate callback does not mint another grant/evidence record');
    assert.equal((await handler('sync')(post({user_id:other},'Bearer fixture-user'))).status,200);
    const before=fetches;assert.equal((await handler('revenuecat-webhook')(post({...envelope,event:{...f.event,environment:'PRODUCTION'}}))).status,422);assert.equal(fetches,before);
    assert.equal((await handler('revenuecat-webhook')(post({...envelope,event:{...f.event,product_id:'wrong'}}))).status,422);assert.equal(fetches,before);
    assert.equal((await handler('sync',{BILLING2027_TEST_USER_IDS:other})(post({},'Bearer fixture-user'))).status,502);assert.equal(fetches,before);
    alias=true;assert.equal((await handler('sync')(post({},'Bearer fixture-user'))).status,502);
  }
});
