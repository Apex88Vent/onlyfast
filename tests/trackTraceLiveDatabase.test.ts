import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {phase2bDatabase,phase2bSql} from './helpers/trackTracePhase2b.mjs';
import {asRole,seedArchiveUser} from './helpers/archive2027.mjs';
import {CircuitRecorder} from '../src/features/track-trace/circuit/recorder.ts';
import {circuitTrack,syntheticCircuit} from './helpers/trackTraceGps.ts';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const file=(name:string)=>readFile(new URL('../supabase/testing-2027/'+name,import.meta.url),'utf8');
test('live circuit contracts preserve lifecycle, catalog and owned telemetry',async t=>{
  const db=await phase2bDatabase(true);
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args.map(a=>a!==null&&typeof a==='object'?JSON.stringify(a):a))).rows[0].r;
  const points=syntheticCircuit();const start=points[0].timestamp,end=points[points.length-1].timestamp;
  let map:string,session:string,free:string;
  try {
    await db.exec(await phase2bSql());
    for(const name of ['20261114152935_track_trace_independent_preparation.sql','20261114194747_track_trace_community_catalog.sql','20261114234029_community_catalog_server_review_access.sql','20261115000806_track_trace_live_circuit.sql'])await db.exec(await file(name));
    // The lightweight bootstrap fixture uses generic owner policies. Install the
    // actual legacy hosted lap policies too, so shared completion cannot pass
    // locally while failing its map-ownership check in the hosted database.
    const permissive=(await db.query<any>("select policyname from pg_policies where schemaname='public' and tablename='onlylaps_lap_times' and permissive='PERMISSIVE'")).rows;
    for(const p of permissive)await db.exec('drop policy "'+p.policyname.replaceAll('"','""')+'" on public.onlylaps_lap_times');
    const baseline=await readFile(new URL('../supabase/staging/20261016230333_staging_baseline.sql',import.meta.url),'utf8');
    for(const policy of baseline.match(/create policy "Users can (?:create|delete|read|update) their OnlyLaps lap times"[\s\S]*?;/g)??[])await db.exec(policy);
    await db.exec(await file('20261115002952_track_trace_shared_lap_writes.sql'));
    await seedArchiveUser(db,owner,'pro');await seedArchiveUser(db,other,'factory');await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    await asRole(db,'authenticated',owner);
    const p=(lat:number,lng:number)=>({lat,lng,accuracy:4,timestamp:start});
    const boundary=(delta=0)=>[p(35+delta,-118),p(35.002+delta,-118),p(35.002+delta,-117.998),p(35+delta,-117.998),p(35+delta,-118)];
    const scan={track_name:'Synthetic scanned oval',community_location:'Synthetic test location',track_type:'dirt_oval',track_shape:'custom_unknown',direction:'counterclockwise',source:'track_scan',map_source:'track_scan',scan_status:'scanned',is_open_route:false,center_lat:35,center_lng:-118,area_key:'35_-118',facility_key:'synthetic-test',bbox:{},outside_path:boundary(),inside_path:boundary(.0001),start_finish_path:circuitTrack().map.start_finish_path,corner_definitions:{corners:[]}};
    const id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await t.test('real scan contract saves private geometry once; malformed and open routes fail',async()=>{
      assert.equal((await rpc('save_track_trace_scan',[id,scan,{sector_count:2,lines:circuitTrack().sectors!.lines}])).saved,true);
      assert.equal((await rpc('save_track_trace_scan',[id,scan,{sector_count:2,lines:circuitTrack().sectors!.lines}])).id,id);map=id;
      const saved=(await rpc('search_track_trace_tracks',['',0,'mine'])).find((m:any)=>m.id===map);assert.deepEqual(saved.outside_path,scan.outside_path);assert.equal(saved.publication_status,'private');
      assert.equal((await rpc('save_track_trace_scan',['dddddddd-dddd-4ddd-8ddd-dddddddddddd',{...scan,is_open_route:true},{sector_count:1,lines:[]}])).saved,false);
      assert.equal((await rpc('save_track_trace_scan',['dddddddd-dddd-4ddd-8ddd-dddddddddddd',{...scan,outside_path:[]},{sector_count:1,lines:[]}])).saved,false);
    });
    await t.test('prepared independent and linked sessions start; track snapshot is immutable',async()=>{
      session=await rpc('create_track_trace_session',[null,'Standalone GPS',map]);free=await rpc('create_track_trace_session',[null,'Free GPS',null]);
      const recording=await rpc('begin_track_trace_recording',[session,token,start]);assert.equal(recording.track.map.id,map);assert.equal(recording.track.sectors.sectorCount,2);
      assert.deepEqual(await rpc('begin_track_trace_recording',[session,token,start]),recording);
      await assert.rejects(rpc('begin_track_trace_recording',[session,'ffffffff-ffff-4fff-8fff-ffffffffffff',start]),/SESSION_ALREADY_STARTED/);
      const setup=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'GPS exact setup','heat','Dwarf Cars') returning id",[owner])).rows[0].id;
      const linked=await rpc('create_track_trace_session',[setup,'Linked GPS',map]);assert.equal((await rpc('begin_track_trace_recording',[linked,token,start])).status,'recording');
      assert.equal((await rpc('get_track_trace_setup_context',[setup])).context.session.id,linked);
    });
    const engine=new CircuitRecorder(circuitTrack(id));for(const point of points)engine.add(point);
    await t.test('idempotent sample retry retains motion and GPS once, detects conflicting payloads',async()=>{
      const first=await rpc('append_track_trace_samples',[session,token,engine.samples]);assert.equal(first.written,64);
      assert.equal((await rpc('append_track_trace_samples',[session,token,engine.samples])).written,0);
      await assert.rejects(rpc('append_track_trace_samples',[session,token,[{...engine.samples[0],speed:999}]]),/SAMPLE_RETRY_CONFLICT/);
      assert.deepEqual(await rpc('get_track_trace_samples',[session,-1]),engine.samples);
    });
    await t.test('completion is atomic and retry safe; review retains laps, sectors and smoothing',async()=>{
      const laps=engine.finish(session,owner);
      await assert.rejects(rpc('complete_track_trace_recording',[session,token,end,65,laps,[]]),/SAMPLES_NOT_FULLY_SAVED/);
      const result=await rpc('complete_track_trace_recording',[session,token,end,64,laps,[]]);assert(result.saved);
      assert.deepEqual(await rpc('complete_track_trace_recording',[session,token,end,64,laps,[]]),result);
      assert.equal((await rpc('append_track_trace_samples',[session,token,engine.samples])).written,0);
      const detail=await rpc('get_track_trace_session',[session]);assert.equal(detail.laps.length,3);assert.equal(detail.sectors.length,6);assert(detail.laps.every((l:any)=>l.smoothing_summary.algorithm==='onlylaps_deterministic_telemetry_v1'));
      await assert.rejects(rpc('complete_track_trace_recording',[session,token,end,64,[],[]]),/COMPLETION_RETRY_CONFLICT/);
      const setup=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Later exact setup','main','Dwarf Cars') returning id",[owner])).rows[0].id;
      await rpc('set_track_trace_session_link',[setup,session,null]);assert.equal((await rpc('get_track_trace_setup_context',[setup])).context.session.id,session);
    });
    await t.test('Free Record captures private samples with no invented maps or automatic laps',async()=>{
      assert.equal((await rpc('begin_track_trace_recording',[free,token,start])).track,null);
      const raw=new CircuitRecorder(null);for(const point of points)raw.add(point);
      await rpc('append_track_trace_samples',[free,token,raw.samples]);await rpc('complete_track_trace_recording',[free,token,end,64,[],[]]);
      const detail=await rpc('get_track_trace_session',[free]);assert.equal(detail.session.track_map_id,null);assert.deepEqual(detail.laps,[]);
    });
    await t.test('cross-user recording and reads denied; Factory selects canonical community ID',async()=>{
      await rpc('submit_track_trace_scan',[map,'main-oval','Main oval','Synthetic location']);
      await asRole(db,'postgres');const fingerprint=(await db.query<any>('select fingerprint from onlyfast_private.community_track_submissions where track_id=$1',[map])).rows[0].fingerprint;
      await rpc('review_track_trace_scan',[map,fingerprint,true,'Synthetic geometry test']);
      await asRole(db,'authenticated',other);
      await assert.rejects(rpc('append_track_trace_samples',[session,token,[]]),/RECORDING_UNAVAILABLE/);await assert.rejects(rpc('get_track_trace_samples',[session]),/SESSION_UNAVAILABLE/);
      const shared=await rpc('create_track_trace_session',[null,'Community GPS',map]);assert.equal((await rpc('begin_track_trace_recording',[shared,token,start])).track.map.id,map);
      await rpc('append_track_trace_samples',[shared,token,engine.samples]);
      assert((await rpc('complete_track_trace_recording',[shared,token,end,64,engine.finish(shared,other),[]])).saved);
      assert.equal((await rpc('get_track_trace_session',[shared])).laps.length,3);
      assert.equal((await db.query('select id from public.onlylaps_track_maps')).rows.length,1,'no per-user clone');
    });
    await t.test('Sportsman cannot start, append, complete or scan; historical ownership rules remain',async()=>{
      await asRole(db,'authenticated',owner);await rpc('set_onlyfast_test_tier',['sportsman']);
      for(const [name,args] of [['begin_track_trace_recording',[free,token,start]],['append_track_trace_samples',[free,token,[]]],['complete_track_trace_recording',[free,token,end,64,[],[]]],['save_track_trace_scan',[id,scan,{sector_count:1,lines:[]}]]] as [string,unknown[]][])
        await assert.rejects(rpc(name,args),/TRACK_TRACE_PRO_REQUIRED/);
      assert.equal((await rpc('get_track_trace_samples',[session])).length,64);
      await asRole(db,'anon');await assert.rejects(rpc('begin_track_trace_recording',[free,token,start]),/permission denied/);
    });
  }finally{await db.close();}
});
