import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as usage from '../supabase/functions/_shared/usage-authorization.ts';
import * as format from '../supabase/functions/_shared/setup-assist-response.ts';

const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
Object.defineProperty(globalThis,'Deno',{configurable:true,value:{env:{get:()=>''}}});
const answer=JSON.stringify({summary:'Balance',recommended_changes:['Try one change.'],why_reasoning:['Mechanical balance.'],expected_effect:['Improve entry.'],notes_cautions:[]});

function edge(feature: 'assist' | 'timing') {
  let handler:(request:Request)=>Promise<Response>;
  let mode:'success'|'error'|'timeout'|'invalid'='success';
  let providerCalls=0, releases=0, finishes=0;
  const records=new Map<string,{fingerprint:string;token:string;result?:unknown;active:boolean}>();
  const admin={rpc:async(name:string,args:Record<string,unknown>)=>{
    assert.equal(args.p_user_id,uid,'request body cannot supply authorization identity');
    if(name==='onlyfast_membership_for_user')return {data:'rookie',error:null};
    if(name==='onlyfast_resolve_assist_session')return {data:args.p_saved_name==='Owned saved name'?session:null,error:null};
    const key=String(args.p_request_id);
    if(name==='onlyfast_reserve_usage'){
      if(feature==='assist'&&args.p_setup_id!==session)return {data:null,error:{message:'foreign or missing setup'}};
      const prior=records.get(key);
      if(prior?.fingerprint!==undefined&&prior.fingerprint!==args.p_fingerprint)return {data:{status:'conflict'},error:null};
      if(prior?.result)return {data:{status:'complete',response:prior.result},error:null};
      if(prior?.active)return {data:{status:'pending'},error:null};
      const token=crypto.randomUUID();records.set(key,{token,fingerprint:String(args.p_fingerprint),active:true});
      return {data:{status:'reserved',token},error:null};
    }
    const prior=records.get(key)!;assert.equal(prior.token,args.p_token);
    prior.active=false;
    if(args.p_response===null)releases++;else {finishes++;prior.result=args.p_response;}
    return {data:true,error:null};
  }};
  const modules={
    '../_shared/usage-authorization.ts':usage,
    '../_shared/setup-assist-response.ts':format,
    'https://esm.sh/@supabase/supabase-js@2':{createClient:()=>({
      ...admin,auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
    })},
    'https://deno.land/std@0.177.0/http/server.ts':{serve:(fn:typeof handler)=>{handler=fn;}},
    '../_shared/beta-features.ts':{hasBetaFeatureForUser:async()=>false},
    '../_shared/onlylaps-setup-context-store.ts':{createOnlyLapsSetupContextStore:()=>({})},
    '../_shared/setup-assist-onlylaps-context.ts':{
      loadSetupAssistOnlyLapsPromptContext:async()=>({promptContext:null,debug:{}}),
      appendOnlyLapsTelemetryToSetupAssistPrompt:(prompt:string)=>prompt,toBetaSetupAssistTelemetryDebug:()=>null,
    },
  };
  const name=feature==='assist'?'get-suggestions':'scan-timing-screen';
  const source=readFileSync(new URL('../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports','Deno','fetch','console',compiled)(
    (name:string)=>modules[name],{},
    {env:{get:()=> 'fixture'},serve:(fn:typeof handler)=>{handler=fn;}},
    async()=>{
      providerCalls++;
      if(mode==='timeout')throw Object.assign(new Error('provider timeout'),{name:'AbortError'});
      if(mode==='error')return new Response('provider failure',{status:502});
      const content=mode==='invalid'?'invalid json':feature==='assist'?answer:JSON.stringify({lap_times:[{lap_number:1,lap_time:12.3}]});
      return new Response(JSON.stringify({choices:[{message:{content}}]}));
    },
    {log(){},error(){}},
  );
  const requestId=crypto.randomUUID();
  const body={request_id:requestId,user_id:'forged',race_weekend_key:'forged-label',onlyfast_session_id:session,imageBase64:'a'.repeat(200),mimeType:'image/jpeg'};
  return {
    body,requestId,mode:(next:typeof mode)=>{mode=next;},
    call:(overrides:Record<string,unknown>={},auth=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer verified'}:{})},body:JSON.stringify({...body,...overrides})})),
    stats:()=>({providerCalls,releases,finishes}),
  };
}

for(const feature of ['assist','timing'] as const) {
  test(`${feature}: actual handler finalizes once and returns cached retry without another provider request`,async()=>{
    const api=edge(feature);
    assert.equal((await api.call()).status,200);
    api.mode('error');
    assert.equal((await api.call()).status,200);
    assert.deepEqual(api.stats(),{providerCalls:1,releases:0,finishes:1});
    assert.equal((await api.call({mimeType:'changed'})).status,409);
    assert.equal((await api.call({},false)).status,401);
  });
  test(`${feature}: failed/timeout/malformed provider responses release without consumption and same-ID retry works`,async()=>{
    for(const failure of ['error','timeout','invalid'] as const){
      const api=edge(feature);api.mode(failure);
      assert.ok((await api.call()).status>=500);
      assert.deepEqual(api.stats(),{providerCalls:1,releases:1,finishes:0});
      api.mode('success');assert.equal((await api.call()).status,200);
      assert.deepEqual(api.stats(),{providerCalls:2,releases:1,finishes:1});
    }
  });
}
test('Assist rejects foreign session IDs and label-only requests before spending provider resources',async()=>{
  const api=edge('assist');
  assert.ok((await api.call({onlyfast_session_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'})).status>=400);
  assert.equal((await api.call({onlyfast_session_id:undefined})).status,400);
  assert.deepEqual(api.stats(),{providerCalls:0,releases:0,finishes:0});
});
test('legacy name hints resolve only an existing owned unambiguous session',async()=>{
  const api=edge('assist');
  assert.equal((await api.call({onlyfast_session_id:undefined,race_weekend_key:'Owned saved name'})).status,200);
  assert.deepEqual(api.stats(),{providerCalls:1,releases:0,finishes:1});
});

