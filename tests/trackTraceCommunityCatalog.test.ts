import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {phase2bDatabase,phase2bSql} from './helpers/trackTracePhase2b.mjs';
import {asRole,seedArchiveUser} from './helpers/archive2027.mjs';

const sql=()=>readFile(new URL('../supabase/testing-2027/20261114194747_track_trace_community_catalog.sql',import.meta.url),'utf8');
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const point=(lat:number,lng:number)=>({lat,lng,timestamp:'2026-11-14T00:00:00Z',accuracy:5});
const boundary=(d=0)=>[point(35+d,-118),point(35.001+d,-118),point(35.001+d,-117.999),point(35+d,-117.999),point(35+d,-118)];
for(const history of [false,true])test('shared canonical catalog '+(history?'with installed history policies':'with foundation policies'),async t=>{
  const db=await phase2bDatabase(history);
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  let map:string,draft:string,open:string,publishedVersion:number,sectorId:string,firstSession:string;
  const insert=async(owner:string,name:string,options:Record<string,unknown>={})=>{
    const values={user_id:owner,name,track_name:name,source:'track_scan',center_lat:35,center_lng:-118,bbox:{minLat:35,maxLat:35.002,minLng:-118,maxLng:-117.999},area_key:'35_-118',facility_key:'facility-35',track_type:'dirt_oval',outside_path:boundary(),inside_path:boundary(.0001),start_finish_path:[point(35,-118),point(35.0001,-118)],...options};
    const keys=Object.keys(values);return (await db.query<any>('insert into public.onlylaps_track_maps('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning id',Object.values(values).map(v=>typeof v==='object'?JSON.stringify(v):v))).rows[0].id;
  };
  const submit=async(id:string,key='main-oval',name='Main oval')=>rpc('submit_track_trace_scan',[id,key,name,'Ramona, California']);
  const approve=async(id:string,ack:string[]=[],replace:string|null=null,role='postgres')=>{
    await asRole(db,'postgres');const q=(await db.query<any>('select fingerprint from onlyfast_private.community_track_submissions where track_id=$1',[id])).rows[0];
    await asRole(db,role);return rpc('review_track_trace_scan',[id,q.fingerprint,true,'Reviewed circuit',replace,ack]);
  };
  try{
    await db.exec(await phase2bSql());
    await db.exec(await readFile(new URL('../supabase/testing-2027/20261114152935_track_trace_independent_preparation.sql',import.meta.url),'utf8'));
    await seedArchiveUser(db,a,'pro');await seedArchiveUser(db,b,'pro');await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    map=await insert(a,'Saved original');draft=await insert(a,'Private scan');open=await insert(a,'Open route',{is_open_route:true});
    sectorId=(await db.query<any>("insert into public.onlylaps_track_sector_defaults(track_id,owner_id,sector_count,version,lines) values($1,$2,2,3,$3) returning id",[map,a,JSON.stringify([{start:point(35,-118),end:point(35.0001,-118),sectorIndex:1,progress:.5,expectedDirection:1}])])).rows[0].id;
    const original=(await db.query<any>('select to_jsonb(m) as data from public.onlylaps_track_maps m where id=$1',[map])).rows[0].data;
    await db.exec(await sql());
    await db.exec(await readFile(new URL('../supabase/testing-2027/20261114234029_community_catalog_server_review_access.sql',import.meta.url),'utf8'));
    await t.test('installation does not publish, clone, rewrite geometry or bump scan versions',async()=>{
      const installed=(await db.query<any>('select to_jsonb(m) as data from public.onlylaps_track_maps m where id=$1',[map])).rows[0].data;
      for(const key of Object.keys(original))assert.deepEqual(installed[key],original[key],key);
      assert.equal(installed.publication_status,'private');assert.equal((await db.query('select id from public.onlylaps_track_maps')).rows.length,3);
    });
    await asRole(db,'authenticated',a);
    await t.test('submit validates full scan; publishing requires server role and leaves geometry/versions intact',async()=>{
      assert.equal((await submit(map)).status,'pending');
      await assert.rejects(rpc('review_track_trace_scan',[map,'forged',true]),/permission denied/);
      await assert.rejects(db.query("update public.onlylaps_track_maps set publication_status='published' where id=$1",[map]),/CONTROLLED_PUBLICATION_REQUIRED/);
      await approve(map,[],null,'service_role');const row=(await db.query<any>('select * from public.onlylaps_track_maps where id=$1',[map])).rows[0];publishedVersion=row.version;
      assert.equal(row.version,original.version);assert.deepEqual(row.outside_path,original.outside_path);assert.deepEqual(row.start_finish_path,original.start_finish_path);assert.equal(row.publication_status,'published');
      assert.equal((await db.query<any>('select version from public.onlylaps_track_sector_defaults where id=$1',[sectorId])).rows[0].version,3);
    });
    await asRole(db,'authenticated',b);
    await t.test('eligible cross-user discovery by track/location and direct OnlyLaps publication query reuse one row',async()=>{
      assert.equal((await rpc('search_track_trace_tracks',['Ramona',0,'community']))[0].id,map);
      assert.equal((await rpc('search_track_trace_tracks',['Saved original']))[0].can_select,true);
      const raw=(await db.query<any>("select * from public.onlylaps_track_maps where publication_status='published' and is_active order by track_name limit 500")).rows;
      assert.equal(raw.length,1);assert.equal(raw[0].id,map);
      assert.equal((await db.query('select id from public.onlylaps_track_maps where id=$1',[draft])).rows.length,0);
      assert.equal((await rpc('list_track_trace_tracks'))[0].sector_defaults[0].version,3);
    });
    await t.test('cross-user selection references the canonical scan while all session telemetry stays private',async()=>{
      firstSession=await rpc('create_track_trace_session',[null,'Shared map circuit',map]);
      assert.equal((await rpc('get_track_trace_session',[firstSession])).session.track_map_id,map);
      const onlylaps=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,track_map_id,name,session_type) values($1,$2,'OnlyLaps normal contract','timed_laps') returning id",[b,map])).rows[0].id;
      assert.equal((await rpc('get_track_trace_session',[onlylaps])).session.track_map_id,map);
      await asRole(db,'authenticated',a);await assert.rejects(rpc('get_track_trace_session',[firstSession]),/SESSION_NOT_FOUND/);
      assert.equal((await db.query('select id from public.onlylaps_timing_sessions where id=$1',[firstSession])).rows.length,0);
    });
    await t.test('owners and other users cannot mutate published maps/defaults or their ownership',async()=>{
      await asRole(db,'authenticated',a);await assert.rejects(db.query("update public.onlylaps_track_maps set track_name='Overwrite' where id=$1",[map]),/PUBLISHED_TRACK_READ_ONLY/);
      await assert.rejects(db.query('delete from public.onlylaps_track_sector_defaults where id=$1',[sectorId]),/PUBLISHED_TRACK_READ_ONLY/);
      await assert.rejects(db.query('update public.onlylaps_track_maps set user_id=$1 where id=$2',[b,draft]),/TRACK_OWNER_IMMUTABLE|row-level security/);
      await asRole(db,'authenticated',b);assert.equal((await db.query("update public.onlylaps_track_maps set track_name='Other user overwrite' where id=$1 returning id",[map])).rows.length,0);
      assert.equal((await db.query('delete from public.onlylaps_track_maps where id=$1 returning id',[map])).rows.length,0);
      await db.query("insert into public.onlylaps_user_track_sectors(track_id,user_id,sector_count,version,lines) values($1,$2,1,1,'[]')",[map,b]);
      assert.equal((await db.query<any>('select version from public.onlylaps_track_maps where id=$1',[map])).rows[0].version,publishedVersion,'personal sectors cannot revise the shared scan');
      await assert.rejects(db.query("update onlyfast_private.community_track_submissions set status='published' where track_id=$1",[map]),/permission denied/);
    });
    await t.test('duplicate scans require explicit review; exact duplicate layouts cannot silently replace a scan',async()=>{
      await asRole(db,'postgres');const duplicate=await insert(b,'Another scan');
      await asRole(db,'authenticated',b);const result=await submit(duplicate);assert.equal(result.duplicates[0].id,map);
      await assert.rejects(approve(duplicate),/DUPLICATE_REVIEW_REQUIRED/);
      await assert.rejects(approve(duplicate,[map]),/DUPLICATE_PUBLISHED_LAYOUT/);
      assert.equal((await db.query<any>('select is_active from public.onlylaps_track_maps where id=$1',[map])).rows[0].is_active,true);
      const identical=await insert(b,'Same geometry, new capture',{outside_path:boundary().map(p=>({...p,timestamp:'2027-01-01',accuracy:10}))});
      await db.query("insert into public.onlylaps_track_sector_defaults(track_id,owner_id,sector_count,version,lines) select $1,$2,sector_count,version,lines from public.onlylaps_track_sector_defaults where track_id=$3",[identical,b,map]);
      await asRole(db,'authenticated',b);await submit(identical,'renamed-duplicate','Renamed duplicate');
      await assert.rejects(approve(identical,[map]),/DUPLICATE_PUBLISHED_GEOMETRY/);
    });
    await t.test('nearby distinct layouts coexist; only explicit server replacement retires a version',async()=>{
      await asRole(db,'postgres');const short=await insert(b,'Short oval',{outside_path:boundary(.0003),inside_path:boundary(.0004)});
      await asRole(db,'authenticated',b);await submit(short,'short-oval','Short oval');await approve(short,[map]);
      const next=await insert(b,'New main scan',{outside_path:boundary(.0002),inside_path:boundary(.0003)});
      await asRole(db,'authenticated',b);await submit(next);await approve(next,[map,short],map);
      const retired=(await db.query<any>('select * from public.onlylaps_track_maps where id=$1',[map])).rows[0];assert.equal(retired.is_active,false);assert.equal(retired.version,publishedVersion);assert.deepEqual(retired.outside_path,original.outside_path);
      const replacement=(await db.query<any>('select * from public.onlylaps_track_maps where id=$1',[next])).rows[0];assert.equal(replacement.supersedes_track_map_id,map);assert(replacement.version>publishedVersion);
      await asRole(db,'authenticated',a);assert.equal((await rpc('search_track_trace_tracks',['',0,'community'])).length,2);
      await asRole(db,'authenticated',b);assert.equal((await rpc('get_track_trace_session',[firstSession])).session.track_map_id,map);
      await assert.rejects(rpc('create_track_trace_session',[null,'Retired map',map]),/row-level security/);
    });
    await t.test('malformed/open/Gumball geometry and stale review fingerprints fail closed',async()=>{
      await asRole(db,'authenticated',a);assert.equal((await submit(open)).status,'invalid');
      await assert.rejects(submit(draft,'invalid key'),/LAYOUT_AND_LOCATION_REQUIRED/);
      await asRole(db,'postgres');
      for(const options of [
        {outside_path:[point(35,-118),point(35,-118)]},
        {inside_path:[point(35,-118),point(35.001,-118),point(35.002,-118),point(35,-118)]},
        {outside_path:[point(999,-118),...boundary()]},
        {start_finish_path:[]},
        {source:'gumball'},
      ]){
        const bad=await insert(a,'Invalid scan',options);await asRole(db,'authenticated',a);assert.equal((await submit(bad,'invalid-layout')).status,'invalid');await asRole(db,'postgres');
      }
      const stale=await insert(a,'Changed after submission');await asRole(db,'authenticated',a);await submit(stale,'stale-layout');
      await db.query("update public.onlylaps_track_maps set notes='New geometry review evidence' where id=$1",[stale]);
      await assert.rejects(approve(stale),/SCAN_CHANGED_RESUBMIT_REQUIRED/);
      await asRole(db,'authenticated',b);await assert.rejects(submit(stale),/TRACK_NOT_FOUND/);
    });
    await t.test('anonymous and Sportsman users cannot use the shared catalog or submit; history remains owned',async()=>{
      await asRole(db,'authenticated',a);await rpc('set_onlyfast_test_tier',['sportsman']);
      await assert.rejects(rpc('search_track_trace_tracks'),/TRACK_TRACE_PRO_REQUIRED/);
      await assert.rejects(submit(draft),/TRACK_TRACE_PRO_REQUIRED/);
      await asRole(db,'authenticated',b);await rpc('set_onlyfast_test_tier',['factory']);assert((await rpc('search_track_trace_tracks',['',0,'community'])).length>0);
      await asRole(db,'anon');await assert.rejects(rpc('search_track_trace_tracks'),/permission denied/);await assert.rejects(rpc('review_track_trace_scan',[map,'forged',true]),/permission denied/);
    });
  }finally{await db.close();}
});
