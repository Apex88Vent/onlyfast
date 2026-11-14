import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { phase2bDatabase, phase2bSql } from './helpers/trackTracePhase2b.mjs';
import { asRole, seedArchiveUser } from './helpers/archive2027.mjs';

const extension=()=>readFile(new URL('../supabase/testing-2027/20261114152935_track_trace_independent_preparation.sql',import.meta.url),'utf8');
for(const order of ['installed','history first','history later'])test('independent preparation preserves authorization: '+order,async t=>{
  const db=await phase2bDatabase(order==='history first');
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  try{
    await db.exec(await phase2bSql());await db.exec(await extension());
    if(order==='history later')await db.exec(await readFile(new URL('../supabase/testing-2027/phase2-archives-install.sql',import.meta.url),'utf8'));
    await seedArchiveUser(db,owner,'pro');await seedArchiveUser(db,other,'pro');
    await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    const map=async(user:string,open=false)=>(await db.query<any>("insert into public.onlylaps_track_maps(user_id,name,track_name,area_key,center_lat,center_lng,bbox,is_open_route) values($1,'QA circuit','QA circuit','qa',35,-118,'{}',$2) returning id",[user,open])).rows[0].id;
    const ownMap=await map(owner),foreignMap=await map(other),roadMap=await map(owner,true);
    await asRole(db,'authenticated',owner);let free:string,saved:string;
    await t.test('Free Record and mapped sessions are owned and durable without creating setups or links',async()=>{
      free=await rpc('create_track_trace_session',[null,'Free Record']);saved=await rpc('create_track_trace_session',[null,'Saved track',ownMap]);
      const detail=await rpc('get_track_trace_session',[free]);assert.equal(detail.session.user_id,owner);assert.equal(detail.session.session_type,'practice');assert.equal(detail.session.track_map_id,null);assert.equal(detail.session.started_at,null);assert.equal(detail.session.ended_at,null);assert.deepEqual(detail.laps,[]);assert.deepEqual(detail.sectors,[]);assert.deepEqual(detail.analysis,[]);
      assert.equal((await rpc('get_track_trace_session',[saved])).session.track_map_id,ownMap);
      assert.equal((await db.query('select id from public.race_setups')).rows.length,0);assert.equal((await db.query('select id from public.onlyfast_onlylaps_session_links')).rows.length,0);
      assert.equal((await db.query('select id from public.onlylaps_telemetry_samples')).rows.length,0);
      const library=await rpc('list_track_trace_sessions');assert(library.some((s:any)=>s.id===free));assert(library.some((s:any)=>s.id===saved));
    });
    await t.test('existing RLS and validation reject other owners, open routes, invalid names and invalid setup IDs',async()=>{
      for(const track of [foreignMap,roadMap])await assert.rejects(rpc('create_track_trace_session',[null,'Restricted map',track]),/row-level security/);
      for(const name of ['', '<fake>', 'Bad\nName'])await assert.rejects(rpc('create_track_trace_session',[null,name]),/INVALID_SESSION_NAME/);
      await assert.rejects(rpc('create_track_trace_session',[other,'Invalid setup']),/SAVED_RACE_SESSION_REQUIRED/);
      await asRole(db,'authenticated',other);await assert.rejects(rpc('get_track_trace_session',[free]),/SESSION_NOT_FOUND/);assert.equal((await db.query('select id from public.onlylaps_timing_sessions where id=$1',[free])).rows.length,0);await asRole(db,'authenticated',owner);
    });
    await t.test('standalone history links later to the exact setup row and retains one-to-one rules',async()=>{
      const ids=[];for(const type of ['base','heat','main','extra1'])ids.push((await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Same weekend',$2,'Dwarf Cars') returning id",[owner,type])).rows[0].id);
      assert((await rpc('list_track_trace_link_candidates',[ids[1]])).candidates.some((s:any)=>s.id===free&&!s.linked_elsewhere));
      await rpc('set_track_trace_session_link',[ids[1],free,null]);
      for(const index of [0,2,3])assert.equal((await rpc('list_track_trace_link_candidates',[ids[index]])).current_session_id,null);
      await assert.rejects(rpc('set_track_trace_session_link',[ids[0],free,null]),/TELEMETRY_ALREADY_LINKED/);
      const original=await rpc('create_track_trace_session',[ids[2],'Original linked path',ownMap]);assert.equal((await rpc('get_track_trace_setup_context',[ids[2]])).context.session.id,original);
      await assert.rejects(rpc('create_track_trace_session',[ids[2],'Keep original']),/SESSION_ALREADY_LINKED/);
      await rpc('set_track_trace_session_link',[ids[1],null,free]);assert((await rpc('list_track_trace_sessions')).some((s:any)=>s.id===free));
    });
    await t.test('Factory can prepare; Sportsman and anonymous callers cannot prepare',async()=>{
      await rpc('set_onlyfast_test_tier',['factory']);assert(await rpc('create_track_trace_session',[null,'Factory standalone']));
      await rpc('set_onlyfast_test_tier',['sportsman']);await assert.rejects(rpc('create_track_trace_session',[null,'Locked']),/TRACK_TRACE_PRO_REQUIRED/);
      await asRole(db,'anon');await assert.rejects(rpc('create_track_trace_session',[null,'Anonymous']),/permission denied/);
    });
  }finally{await db.close();}
});
