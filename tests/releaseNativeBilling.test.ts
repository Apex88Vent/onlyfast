// Synthetic contract tests. No store SDK, production Auth, purchase or restore call.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ReleaseNativePurchaseController, validateStoreCatalog, ONLYFAST_OFFERING, type BillingRequest, type BillingReply, type StoreCatalog } from '../src/lib/releaseNativeBilling.ts';
import { createAndroidBillingTransport } from '../src/lib/releaseNativeTransport.ts';
import { NativePurchaseError, NATIVE_PURCHASES_READY } from '../src/lib/nativePurchaseController.ts';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function catalog(platform: 'android'|'ios'='android'): StoreCatalog {
  return {offeringIdentifier:ONLYFAST_OFFERING,catalogToken:'synthetic-catalog',expiresAt:Date.now()+60000,packages:(['pro','teams'] as const).map(plan=>({
    plan,packageIdentifier:plan==='pro'?'$rc_monthly':'$rc_custom_teams_monthly',productIdentifier:platform==='android'?`${plan}:${plan}`:`app.onlyfast.${plan}.monthly`,
    formattedPrice:plan==='pro'?'€4.99':'€7.99',currencyCode:'EUR',billingPeriod:'P1M',optionIdentifier:plan+':synthetic-trial',
    pricingPhases:[{billingPeriod:'P1W',billingCycleCount:1,recurrenceMode:'FINITE_RECURRING',price:{formatted:'€0.00',amountMicros:0,currencyCode:'EUR'}}],
    trialEligibility:'unknown',eligibilityNote:'Synthetic fixture; eligibility is confirmed by the store.'}))};
}
function harness(enabled=true){
 const f={session:{userId:a,accessToken:'synthetic-token'} as {userId:string;accessToken:string}|null,calls:[] as BillingRequest[],nativeUser:null as string|null,
  catalog:catalog(),transactions:true,platform:'android' as 'android'|'ios',reply:'purchased' as BillingReply['status'],identityError:false,wrongIdentity:false,
  custom:null as ((r:BillingRequest)=>Promise<BillingReply>)|null};
 const bridge={request:async(r:BillingRequest):Promise<BillingReply>=>{
  f.calls.push(r);
  if(r.operation==='invalidate'){f.nativeUser=null;return{protocolVersion:1,status:'ok'}}
  if(f.custom&&r.operation==='purchase')return f.custom(r);
  if(r.operation==='capabilities')return{protocolVersion:1,status:'ok',platform:f.platform,transactionsEnabled:f.transactions};
  if(r.operation==='identify'){
   if(f.identityError)return{protocolVersion:1,status:'error',code:'AUTH',message:'Session rejected'};
   f.nativeUser=r.expectedUserId!;
  }
  if(r.operation==='clear')f.nativeUser=null;
  return{protocolVersion:1,status:r.operation==='purchase'?f.reply:r.operation==='restore'?'restored':'ok',appUserId:f.wrongIdentity?b:f.nativeUser||undefined,
   catalog:r.operation==='catalog'?f.catalog:undefined};
 }};
 const controller=new ReleaseNativePurchaseController(async()=>bridge,async()=>f.session,()=>enabled);
 return{f,controller};
}
test('public hold blocks identity, catalog, purchases and restore without touching a bridge',async()=>{
 assert.equal(NATIVE_PURCHASES_READY,false);
 const{f,controller}=harness(false);await controller.setUser(a);
 await assert.rejects(controller.getCatalog(a),/coming soon/);
 await assert.rejects(controller.run(a,'purchase','pro',catalog()),/coming soon/);
 await assert.rejects(controller.run(a,'restore'),/coming soon/);assert.deepEqual(f.calls,[]);
});
for(const platform of ['android','ios'] as const){
 test(`${platform} catalog validates both exact named packages and preserves actual returned terms`,()=>{
  const value=catalog(platform);assert.equal(validateStoreCatalog(value,platform),value);
  assert.equal(value.packages[0].trialEligibility,'unknown');assert.equal(value.packages[0].formattedPrice,'€4.99');
 });
}
test('Pro and Teams purchase exact explicit package/product from the displayed catalog',async()=>{
 for(const plan of ['pro','teams'] as const){const{f,controller}=harness();await controller.setUser(a);const shown=await controller.getCatalog(a);
  await controller.run(a,'purchase',plan,shown);const request=f.calls.find(r=>r.operation==='purchase')!;
  assert.equal(request.offeringIdentifier,ONLYFAST_OFFERING);assert.equal(request.productIdentifier,`${plan}:${plan}`);
  assert.equal(request.packageIdentifier,plan==='pro'?'$rc_monthly':'$rc_custom_teams_monthly');assert.equal(request.catalogToken,shown.catalogToken);
  assert.equal(request.expectedUserId,a);assert.equal(request.accessToken,'synthetic-token');
 }
});
test('missing selection cannot invoke generic paywall or default offering',async()=>{
 const{f,controller}=harness();await controller.setUser(a);const count=f.calls.length;
 await assert.rejects(controller.run(a,'purchase'),/Select a store-priced/);assert.equal(f.calls.length,count);
});
test('native binary hold blocks transactions even with an enabled frontend fixture',async()=>{
 const{f,controller}=harness();f.transactions=false;await controller.setUser(a);
 await assert.rejects(controller.run(a,'purchase','pro',await controller.getCatalog(a)),/not enabled/);
 await assert.rejects(controller.run(a,'restore'),/not enabled/);assert.equal(f.calls.some(r=>['purchase','restore'].includes(r.operation)),false);
});
test('missing/duplicate/wrong offering, mismatched products and expired catalogs fail closed',()=>{
 for(const mutate of [(c:StoreCatalog)=>{c.offeringIdentifier='default'},(c:StoreCatalog)=>{c.packages.pop()},
  (c:StoreCatalog)=>{c.packages[1]=c.packages[0]},(c:StoreCatalog)=>{c.packages[0].productIdentifier='teams:teams'},
  (c:StoreCatalog)=>{c.expiresAt=0},(c:StoreCatalog)=>{c.packages[0].pricingPhases[0].price.amountMicros=-1}]){
  const value=catalog();mutate(value);assert.throws(()=>validateStoreCatalog(value,'android'));
 }
});
test('auth denial and mismatched native identity prevent transactions',async()=>{
 for(const failure of ['identityError','wrongIdentity'] as const){const{f,controller}=harness();f[failure]=true;
  await assert.rejects(controller.setUser(a));await assert.rejects(controller.run(a,'restore'));
  assert.equal(f.calls.some(r=>r.operation==='restore'),false);
 }
});
test('anonymous/missing/different auth sessions cannot initialize billing',async()=>{
 const{f,controller}=harness();f.session=null;await assert.rejects(controller.setUser(a),/account changed/);assert.deepEqual(f.calls,[]);
 f.session={userId:b,accessToken:'other'};await assert.rejects(controller.setUser(a),/account changed/);assert.deepEqual(f.calls,[]);
});
test('account switching invalidates native work immediately and discards the old purchase result',async()=>{
 const{f,controller}=harness();await controller.setUser(a);const shown=await controller.getCatalog(a);
 let finish!:(value:BillingReply)=>void,started!:()=>void;const opened=new Promise<void>(r=>{started=r});
 f.custom=async()=>{started();return new Promise(r=>{finish=r})};const purchasing=controller.run(a,'purchase','pro',shown);await opened;
 f.session={userId:b,accessToken:'b-token'};const switched=controller.setUser(b);
 assert.equal(f.calls.at(-1)?.operation,'invalidate');finish({protocolVersion:1,status:'purchased',appUserId:a});
 await assert.rejects(purchasing,/account changed/);await switched;assert.equal(f.nativeUser,b);
});
test('cancelled/pending/error states never report successful purchases',async()=>{
 for(const status of ['cancelled','pending','error'] as const){const{f,controller}=harness();f.reply=status;await controller.setUser(a);
  await assert.rejects(controller.run(a,'purchase','pro',await controller.getCatalog(a)),error=>error instanceof NativePurchaseError&&
   error.cancelled===(status==='cancelled')&&error.pending===(status==='pending'));
 }
});
test('restore is explicit, identified, and clears identity on logout',async()=>{
 const{f,controller}=harness();await controller.setUser(a);assert.equal(f.calls.some(r=>r.operation==='restore'),false);
 await controller.run(a,'restore');assert.equal(f.calls.find(r=>r.operation==='restore')?.expectedUserId,a);
 f.session=null;await controller.setUser(null);assert.equal(f.nativeUser,null);
});
test('message transport correlates replies and ignores malformed/unmatched messages',async()=>{
 const channel={onmessage:null as ((e:{data:string})=>void)|null,postMessage(value:string){const r=JSON.parse(value);
  channel.onmessage?.({data:'bad json'});channel.onmessage?.({data:JSON.stringify({requestId:'wrong',result:{}})});
  channel.onmessage?.({data:'null'});channel.onmessage?.({data:'{}'});
  channel.onmessage?.({data:JSON.stringify({requestId:r.requestId,result:{protocolVersion:1,status:'ok',platform:'android'}})});
 }};
 const reply=await createAndroidBillingTransport(channel).request({operation:'capabilities',protocolVersion:1});assert.equal(reply.platform,'android');
});
test('transport timeout poisons future calls rather than retrying an uncancellable operation',async()=>{
 let calls=0;const channel={onmessage:null as ((e:{data:string})=>void)|null,postMessage(){calls++}};
 const bridge=createAndroidBillingTransport(channel,5);await assert.rejects(bridge.request({operation:'capabilities',protocolVersion:1}),/timed out/);
 await assert.rejects(bridge.request({operation:'identify',protocolVersion:1}),/Close and reopen/);assert.equal(calls,1);
});
test('Android source uses release main frame/origin/Auth restrictions and preserves vendor hooks',()=>{
 const source=readFileSync(new URL('../native/android/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt',import.meta.url),'utf8');
 assert.match(source,/TRANSACTIONS_ENABLED = false/);assert.match(source,/!mainFrame/);assert.match(source,/instanceFollowRedirects = false/);
 assert.match(source,/response.getString\("id"\) == expected/);assert.match(source,/getOffering\(OFFERING\)/);
 assert.doesNotMatch(source,/onlyFastCatalog|127\.0\.0\.1|__onlyfast_one_pro|updatedCustomerInfoListener\s*=/);
 assert.match(source,/if \(!ownsSdk\)/);assert.match(source,/sdk.logOut/);assert.match(source,/catalog\.token == request/);
});
