import test from 'node:test';
import assert from 'node:assert/strict';
import {createOverallAssistHandler} from '../supabase/functions/track-trace-overall-assist/handler.ts';
import {reviewFixture} from './helpers/trackTraceReviewFixture.ts';
const sid='10000000-0000-4000-8000-000000000001',requestId='20000000-0000-4000-8000-000000000001';
function setup(options:{production?:boolean;tier?:string;foreign?:boolean;invalidJwt?:boolean;providerFailure?:boolean;provider?:boolean}={}){
 let reads=0,reservations=0,providerCalls=0,releases=0,finishes=0;
 const fixture=reviewFixture();
 const laps=fixture.laps!.map(l=>({id:l.id,lap_number:l.lapNumber,duration_ms:l.lapTimeMs,started_at:l.startedAt,ended_at:l.endedAt,is_valid:l.isValid,sector_times_ms:l.sectorTimesMs}));
 const bundle={session:{id:sid,user_id:options.foreign?'foreign':'owner',name:'Fixture',started_at:fixture.startedAt,ended_at:fixture.endedAt,track_map_id:fixture.trackId,device_info:{phoneMountOrientation:'top_forward',trackVersion:3,gForceConvention:'vehicle_braking_positive_v2',cornerDefinitions:fixture.cornerDefinitions}},map:fixture.trackMap,laps,sectors:[]};
 const handler=createOverallAssistHandler({environment:options.production?'https://production.invalid':'https://mfzajhnfonrfuiwxgvhe.supabase.co',reader:token=>{assert.equal(token,'valid-jwt');return {auth:{getUser:async()=>({data:{user:options.invalidJwt?null:{id:'owner'}},error:null})},rpc:async(name,args)=>{
  if(name==='get_track_trace_permission')return {data:{feature:'track_trace',tier:options.tier??'pro',can_record:['pro','factory'].includes(options.tier??'pro')},error:null};
  reads++;if(name==='get_track_trace_review_bundle'){assert.equal(args!.p_session_id,sid);return {data:bundle,error:null};}
  const after=args!.p_after_id===null?-1:Number(args!.p_after_id);return {data:fixture.telemetrySamples!.filter(s=>s.sampleIndex>after).slice(0,500).map(s=>({id:String(s.sampleIndex),recorded_at:s.timestamp,latitude:s.latitude,longitude:s.longitude,speed_mps:s.speed,accuracy_meters:s.gpsAccuracy,raw:{gForceConvention:'vehicle_braking_positive_v2',sample:s}})),error:null};
 }};},reserve:async()=>{reservations++;return {finish:async()=>{finishes++;},release:async()=>{releases++;}};},provider:options.provider?async evidence=>{providerCalls++;if(options.providerFailure)throw Error('offline');return {plan:evidence.plan.map(p=>({cornerNumber:p.cornerNumber,referenceLapId:p.referenceLapId,evidenceIds:p.evidenceIds,focus:p.focus}))};}:undefined});
 return {call:(body:unknown={session_id:sid,request_id:requestId},auth=true)=>handler(new Request('https://testing.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer valid-jwt'}:{})},body:JSON.stringify(body)})),get stats(){return {reads,reservations,providerCalls,releases,finishes};}};
}
test('Lap Blueprint rejects production, missing/invalid authentication and Sportsman before telemetry/provider access',async()=>{
 for(const [options,expected]of [[{production:true},503],[{invalidJwt:true},401],[{tier:'sportsman'},403]] as const){const h=setup({...options,provider:true});assert.equal((await h.call()).status,expected);assert.deepEqual(h.stats,{reads:0,reservations:0,providerCalls:0,releases:0,finishes:0});}
 const h=setup();assert.equal((await h.call(undefined,false)).status,401);
});
test('foreign ownership and client-injected evidence are rejected without provider calls',async()=>{
 const foreign=setup({foreign:true,provider:true});assert.equal((await foreign.call()).status,404);assert.equal(foreign.stats.providerCalls,0);assert.equal(foreign.stats.reservations,0);
 const forged=setup({provider:true});assert.equal((await forged.call({session_id:sid,request_id:requestId,evidence:{fakeTime:1}})).status,400);assert.equal(forged.stats.reads,0);
});
test('provider-disabled and outage paths preserve deterministic review; paid leases finalize or release',async()=>{
 const disabled=setup();assert.equal((await (await disabled.call()).json()).mode,'deterministic');assert.equal(disabled.stats.reservations,0);
 const outage=setup({provider:true,providerFailure:true});assert.equal((await (await outage.call()).json()).mode,'deterministic');assert.equal(outage.stats.releases,1);assert.equal(outage.stats.finishes,0);
 const success=setup({provider:true,tier:'factory'});const result=await (await success.call()).json();assert.equal(result.mode,'ai');assert.equal(result.plan.length,4);assert.equal(success.stats.finishes,1);assert.equal(success.stats.releases,0);
});
