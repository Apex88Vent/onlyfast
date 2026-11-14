import assert from 'node:assert/strict';
import test from 'node:test';
import { phase2bDatabase,phase2bSql } from './helpers/trackTracePhase2b.mjs';
import { asRole,seedArchiveUser } from './helpers/archive2027.mjs';

for(const archives of [false,true])test('Phase 2B links and circuit library with '+(archives?'pending archive/history schema':'installed Phase 1C schema'),async t=>{
  const db=await phase2bDatabase(archives);
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  let setups:string[]=[],sessions:string[]=[],map:string,road:string,foreign:string,mapVersion:number;
  try{
    await seedArchiveUser(db,a,'pro');await seedArchiveUser(db,b,'pro');
    await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    const billing=(await db.query('select * from public.user_subscriptions order by user_id')).rows;
    const mapRow=async(owner:string,name:string,open=false,active=true)=>(await db.query<any>("insert into public.onlylaps_track_maps(user_id,name,track_name,area_key,center_lat,center_lng,bbox,is_open_route,is_active,version,start_finish_path) values($1,$2,$2,'qa',35,-118,'{}',$3,$4,3,'[{\"lat\":35,\"lng\":-118},{\"lat\":35.1,\"lng\":-118}]') returning id",[owner,name,open,active])).rows[0].id;
    map=await mapRow(a,'Saved circuit');road=await mapRow(a,'Excluded route',true);await mapRow(b,'Private circuit',false,false);
    for(let i=0;i<6;i++)sessions.push((await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name,session_name,track_map_id) values($1,$2,$2,$3) returning id",[a,'Circuit '+i,map])).rows[0].id);
    foreign=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Private other recording') returning id",[b])).rows[0].id;
    const gumball=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name,session_type) values($1,'Excluded mode','gumball') returning id",[a])).rows[0].id;
    const openSession=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name,track_map_id) values($1,'Excluded road',$2) returning id",[a,road])).rows[0].id;
    await db.query('insert into public.onlylaps_lap_times(user_id,timing_session_id,lap_number,duration_ms) values($1,$2,1,12345)',[a,sessions[0]]);
    await db.query("insert into public.onlylaps_track_sector_defaults(track_id,owner_id,sector_count,version,lines) values($1,$2,1,4,'[]')",[map,a]);
    mapVersion=(await db.query<any>('select version from public.onlylaps_track_maps where id=$1',[map])).rows[0].version;
    await asRole(db,'authenticated',a);
    for(const type of ['base','heat','main','extra1'])setups.push((await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,'Phase2B weekend',$2,'Dwarf Cars',$3) returning id",[a,type,'Unsaved edits are client-owned; durable notes '+type])).rows[0].id);
    await asRole(db,'postgres');
    await db.query("insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)",[a,setups[0],sessions[0]]);
    const existing=(await db.query('select * from public.onlyfast_onlylaps_session_links')).rows;
    const originalSetups=(await db.query('select * from public.race_setups order by id')).rows;
    await db.exec(await phase2bSql());
    assert.deepEqual((await db.query('select * from public.onlyfast_onlylaps_session_links')).rows,existing,'installation retains associations');
    await asRole(db,'authenticated',a);
    await t.test('picker returns exact setup, owned circuit sessions, track/date and valid-lap summary',async()=>{
      const p=await rpc('list_track_trace_link_candidates',[setups[0]]);
      assert.equal(p.setup_id,setups[0]);assert.equal(p.current_session_id,sessions[0]);assert.equal(p.current_session.track_name,'Saved circuit');
      assert.equal(p.current_session.lap_count,1);assert.equal(p.current_session.fastest_lap_ms,12345);assert.equal(p.editable,true);
      assert(!p.candidates.some((c:any)=>[foreign,gumball,openSession].includes(c.id)));
    });
    await t.test('Hot Laps, Heat, Main and custom sessions have independent immutable-ID associations',async()=>{
      for(let i=1;i<4;i++)assert.equal((await rpc('set_track_trace_session_link',[setups[i],sessions[i],null])).action,'linked');
      for(let i=0;i<4;i++)assert.equal((await rpc('list_track_trace_link_candidates',[setups[i]])).current_session_id,sessions[i]);
      await assert.rejects(rpc('set_track_trace_session_link',[setups[1],sessions[0],sessions[1]]),/TELEMETRY_ALREADY_LINKED/);
      assert.equal((await rpc('list_track_trace_link_candidates',[setups[1]])).current_session_id,sessions[1]);
    });
    await t.test('replacement reuses the original atomic link RPC; stale writes and unlink preserve parent data',async()=>{
      const old=(await db.query<any>('select id from public.onlyfast_onlylaps_session_links where onlyfast_session_id=$1',[setups[1]])).rows[0].id;
      assert.equal((await rpc('set_track_trace_session_link',[setups[1],sessions[4],sessions[1]])).action,'changed');
      assert.equal((await db.query<any>('select id from public.onlyfast_onlylaps_session_links where onlyfast_session_id=$1',[setups[1]])).rows[0].id,old);
      await assert.rejects(rpc('set_track_trace_session_link',[setups[1],sessions[5],sessions[1]]),/TRACK_TRACE_LINK_CHANGED/);
      assert.equal((await rpc('set_track_trace_session_link',[setups[1],null,sessions[4]])).action,'unlinked');
      assert.equal((await db.query('select id from public.onlylaps_timing_sessions where id=$1',[sessions[4]])).rows.length,1);
      assert.deepEqual((await db.query('select * from public.race_setups order by id')).rows,originalSetups,'link mutations never rewrite setups');
    });
    await t.test('ownership, circuit restrictions and wrong class cannot be bypassed through RPC or direct links',async()=>{
      for(const sid of [foreign,gumball,openSession])await assert.rejects(rpc('set_track_trace_session_link',[setups[1],sid,null]),/TELEMETRY_NOT_FOUND/);
      await asRole(db,'authenticated',b);await assert.rejects(rpc('list_track_trace_link_candidates',[setups[0]]),/SESSION_NOT_FOUND/);
      await assert.rejects(rpc('set_track_trace_session_link',[setups[0],foreign,sessions[0]]),/SETUP_READ_ONLY_OR_NOT_FOUND/);
      await asRole(db,'postgres');
      const wrong=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Wrong class','heat','Modified') returning id",[a])).rows[0].id;
      await asRole(db,'authenticated',a);await assert.rejects(rpc('set_track_trace_session_link',[wrong,sessions[5],null]),/SETUP_READ_ONLY_OR_NOT_FOUND/);
      await assert.rejects(db.query('insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)',[a,wrong,sessions[5]]),/row-level security|READ_ONLY/);
    });
    await t.test('Pro and Factory have identical library/link access; Sportsman cannot link or use library RPC',async()=>{
      const tracks=await rpc('list_track_trace_tracks');assert(tracks.some((x:any)=>x.id===map&&x.can_select&&x.version===mapVersion&&x.sector_defaults[0].version===4));assert(!tracks.some((x:any)=>x.id===road));
      await rpc('set_onlyfast_test_tier',['factory']);assert.deepEqual(await rpc('list_track_trace_tracks'),tracks);
      await rpc('set_onlyfast_test_tier',['sportsman']);
      await assert.rejects(rpc('list_track_trace_tracks'),/TRACK_TRACE_PRO_REQUIRED/);
      await assert.rejects(rpc('list_track_trace_link_candidates',[setups[0]]),/TRACK_TRACE_PRO_REQUIRED/);
      await assert.rejects(rpc('set_track_trace_session_link',[setups[0],null,sessions[0]]),/TRACK_TRACE_PRO_REQUIRED/);
      await rpc('set_onlyfast_test_tier',['pro']);if(archives)await rpc('choose_onlyfast_2027_class',['Dwarf Cars']);
    });
    await t.test('unavailable linked recordings have a safe missing state and can be unlinked without deleting telemetry',async()=>{
      await asRole(db,'postgres');await db.query("update public.onlylaps_timing_sessions set session_type='gumball' where id=$1",[sessions[3]]);
      await asRole(db,'authenticated',a);const state=await rpc('list_track_trace_link_candidates',[setups[3]]);
      assert.equal(state.current_session_id,sessions[3]);assert.equal(state.current_session,null);assert.equal(state.missing_session,true);
      await rpc('set_track_trace_session_link',[setups[3],null,sessions[3]]);
      if(archives){await rpc('set_onlyfast_setup_archive',[setups[0],true]);await assert.rejects(rpc('set_track_trace_session_link',[setups[0],null,sessions[0]]),/SETUP_READ_ONLY_OR_NOT_FOUND/);await rpc('set_onlyfast_setup_archive',[setups[0],false]);}
    });
    await t.test('anonymous RPCs denied, original service RPC remains private and billing unchanged',async()=>{
      await asRole(db,'anon');await assert.rejects(rpc('list_track_trace_tracks'),/permission denied/);
      await asRole(db,'authenticated',a);await assert.rejects(rpc('onlyfast_unlink_onlylaps_session',[a,setups[0]]),/permission denied/);
      await asRole(db,'postgres');assert.deepEqual((await db.query('select * from public.user_subscriptions order by user_id')).rows,billing);
      const src=(await db.query<any>("select pg_get_functiondef('onlyfast_private.set_track_trace_link(uuid,uuid,uuid)'::regprocedure) d")).rows[0].d;
      assert.match(src,/onlyfast_set_onlylaps_session_link/);assert.match(src,/onlyfast_unlink_onlylaps_session/);
    });
  }finally{await db.close();}
});
