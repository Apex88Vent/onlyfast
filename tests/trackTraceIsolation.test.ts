import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(file: string, modules: Record<string, unknown>, bindings: Record<string, unknown>={}) {
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('import.meta.env','environment');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const result: any={};
  new Function('require','exports',...Object.keys(bindings),js)((name:string)=>{
    assert(name in modules,'Unexpected dependency '+name);return modules[name];
  },result,...Object.values(bindings));
  return result;
}

test('Track Trace API stays disabled outside the exact activated testing build',async()=>{
  for(const [preview,app,url,enabled] of [
    [false,false,'https://mfzajhnfonrfuiwxgvhe.supabase.co',false],
    [true,false,'https://mfzajhnfonrfuiwxgvhe.supabase.co',false],
    [true,true,'https://production.invalid',false],
    [true,true,'https://mfzajhnfonrfuiwxgvhe.supabase.co',true],
  ]) {
    let requests=0;
    const api=compile('src/features/track-trace/api.ts',{'@/lib/supabase':{
      supabaseUrl:url,supabase:{rpc:async()=>{requests++;return {data:[],error:null};}},
    }},{environment:{ONLYFAST_2027_PREVIEW:preview,ONLYFAST_2027_APP:app}});
    assert.equal(api.trackTraceEnabled,enabled);
    if(enabled)await api.traceRpc('list_track_trace_sessions');
    else await assert.rejects(api.traceRpc('list_track_trace_sessions'),/unavailable/);
    assert.equal(requests,enabled?1:0);
  }
});

function edge(options: { tier?: string; unavailable?: boolean; invalidJwt?: boolean; production?: boolean }={}) {
  let handler: (r:Request)=>Promise<Response>;let storeReads=0;let clients=0;
  const reader={auth:{getUser:async()=>({data:{user:options.invalidJwt?null:{id:'verified-owner'}},error:null})},
    rpc:async(name:string)=>{assert.equal(name,'get_track_trace_permission');return {data:{feature:'track_trace',can_read_history:['sportsman','unsubscribed','pro','factory'].includes(options.tier || '' )},error:options.unavailable?{message:'offline'}:null};}};
  compile('supabase/functions/track-trace-setup-context/index.ts',{
    'https://esm.sh/@supabase/supabase-js@2':{createClient:(_url:string,key:string,config:any)=>{clients++;assert.equal(key,'public-anon-key');assert.equal(config.global.headers.Authorization,'Bearer user-jwt');return reader;}},
    '../_shared/onlylaps-setup-context.ts':{getOnlyLapsSetupContext:async(args:any)=>{storeReads++;assert.equal(args.userId,'verified-owner');assert.equal(args.onlyfastSessionId,'exact-setup');assert.equal(args.store,reader);return {linked:false};},OnlyLapsSetupContextError:class extends Error{}},
    '../_shared/onlylaps-setup-context-store.ts':{createOnlyLapsSetupContextStore:(client:unknown)=>client},
    '../_shared/setup-assist-onlylaps-context.ts':{inspectOnlyLapsMeasuredEvidence:()=>({linked:false,contextLoaded:false,usableMeasuredFacts:false,analysisAvailable:false})},
  },{Deno:{env:{get:(name:string)=>{
    assert.notEqual(name,'SUPABASE_SERVICE_ROLE_KEY');
    return name==='SUPABASE_URL'?(options.production?'https://production.invalid':'https://mfzajhnfonrfuiwxgvhe.supabase.co'):'public-anon-key';
  }},serve:(fn:any)=>{handler=fn;}}});
  return {call:(auth=true)=>handler(new Request('https://testing.invalid',{method:'POST',headers:{...(auth?{Authorization:'Bearer user-jwt'}:{}),'Content-Type':'application/json'},body:JSON.stringify({onlyfast_session_id:'exact-setup',status_only:true})})),get reads(){return storeReads;},get clients(){return clients;}};
}

test('testing telemetry adapter rejects production, missing/invalid JWT and permission lookup failures before reading data',async()=>{
  for(const [options,auth,status] of [
    [{production:true},true,503],[{},false,401],[{invalidJwt:true},true,401],
    [{tier:'pro',unavailable:true},true,403],
  ] as [any,boolean,number][]) {
    const e=edge(options);assert.equal((await e.call(auth)).status,status);assert.equal(e.reads,0);
  }
});

for(const tier of ['sportsman','unsubscribed','pro','factory'])test(tier+' historical adapter reuses the existing contract through the verified owner JWT client',async()=>{
  const e=edge({tier});assert.equal((await e.call()).status,200);assert.equal(e.reads,1);assert.equal(e.clients,1);
});
