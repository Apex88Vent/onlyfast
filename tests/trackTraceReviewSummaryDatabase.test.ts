import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {phase2bDatabase,phase2bSql} from './helpers/trackTracePhase2b.mjs';
import {asRole,seedArchiveUser} from './helpers/archive2027.mjs';
test('lean review keeps the original session/setup authorization and removes initial telemetry payloads',async t=>{
 const db=await phase2bDatabase(true),a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const rpc=async(name:string,args:unknown[]=[]) =>(await db.query<{r:any}>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
 try{
  await db.exec(await phase2bSql());
  for(const file of ['20261114152935_track_trace_independent_preparation.sql','20261114194747_track_trace_community_catalog.sql','20261115000806_track_trace_live_circuit.sql','20261125020946_track_trace_telemetry_parity.sql','20261125175146_track_trace_review_summary.sql'])await db.exec(await readFile(new URL('../supabase/testing-2027/'+file,import.meta.url),'utf8'));
  await seedArchiveUser(db,a,'pro');await seedArchiveUser(db,b,'factory');await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
  const sid=(await db.query<{id:string}>("insert into public.onlylaps_timing_sessions(user_id,name,session_type,device_info) values($1,'Synthetic metadata review','circuit',$2::jsonb) returning id",[a,JSON.stringify({gForceConvention:'vehicle_braking_positive_v2',track_trace_recording:{track:{outside_path:[{lat:35,lng:-118}]}},cornerAnalysis:{private:'details'}})])).rows[0].id;
  await db.query("insert into public.onlylaps_lap_times(user_id,timing_session_id,lap_number,duration_ms,smoothing_summary) values($1,$2,1,20000,'{\"raw_trace\":[{\"lat\":35,\"lng\":-118}],\"keptSampleCount\":2}')",[a,sid]);
  const setup=(await db.query<{id:string}>("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,'Exact owned Heat','heat','Dwarf Cars','Retain setup notes') returning id",[a])).rows[0].id;
  await db.query('insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)',[a,setup,sid]);
  await asRole(db,'authenticated',a);const original=await rpc('get_track_trace_session',[sid]);
  await t.test('initial response retains statistics and convention while omitting track snapshots/trace arrays',async()=>{
   const lean=await rpc('get_track_trace_review_summary',[sid,null]);assert.equal(lean.session.id,sid);assert.equal(lean.laps[0].duration_ms,20000);assert.equal(lean.session.device_info.gForceConvention,'vehicle_braking_positive_v2');assert.equal(lean.session.device_info.track_trace_recording,undefined);assert.equal(lean.session.device_info.cornerAnalysis,undefined);assert.equal(lean.laps[0].smoothing_summary,undefined);assert.equal(lean.laps[0].raw_trace,undefined);
  });
  await t.test('exact setup scope reuses its existing association; ambiguous or absent scope is rejected',async()=>{
   assert.equal((await rpc('get_track_trace_review_summary',[null,setup])).session.id,sid);
   await assert.rejects(rpc('get_track_trace_review_summary',[null,null]),/ONE_REVIEW_SCOPE_REQUIRED/);await assert.rejects(rpc('get_track_trace_review_summary',[sid,setup]),/ONE_REVIEW_SCOPE_REQUIRED/);
  });
  await t.test('Factory cannot read another owner; Sportsman retains only existing history access; anonymous denied',async()=>{
   await asRole(db,'authenticated',b);await assert.rejects(rpc('get_track_trace_review_summary',[sid,null]),/SESSION_UNAVAILABLE|SESSION_NOT_FOUND/);await assert.rejects(rpc('get_track_trace_review_summary',[null,setup]),/SETUP|SESSION/);
   await asRole(db,'authenticated',a);await rpc('set_onlyfast_test_tier',['sportsman']);assert.equal((await rpc('get_track_trace_review_summary',[sid,null])).session.id,sid);
   await asRole(db,'anon');await assert.rejects(rpc('get_track_trace_review_summary',[sid,null]),/permission denied/);
  });
  await t.test('full historical payload remains unchanged and the new reader is an invoker',async()=>{
   await asRole(db,'authenticated',a);await rpc('set_onlyfast_test_tier',['pro']);assert.deepEqual(await rpc('get_track_trace_session',[sid]),original);
   const p=(await db.query<{prosecdef:boolean;proconfig:string[]}>('select prosecdef,proconfig from pg_proc where oid=\'public.get_track_trace_review_summary(uuid,uuid)\'::regprocedure')).rows[0];assert.equal(p.prosecdef,false);assert(p.proconfig.some(c=>c.startsWith('search_path=')));
  });
 }finally{await db.close();}
});
