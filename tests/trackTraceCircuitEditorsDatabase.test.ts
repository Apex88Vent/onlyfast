import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { phase2bDatabase,phase2bSql } from './helpers/trackTracePhase2b.mjs';
import { asRole,seedArchiveUser } from './helpers/archive2027.mjs';
import { circuitTrack } from './helpers/trackTraceGps.ts';
import { buildManualCornerDefinitions } from '../src/features/track-trace/circuit/trackEditorGeometry.ts';

test('original circuit editors preserve private ownership, published geometry and versioned history',async t=>{
  const db=await phase2bDatabase(true),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args.map(a=>a!==null&&typeof a==='object'?JSON.stringify(a):a))).rows[0].r;
  try{
    await db.exec(await phase2bSql());
    for(const file of ['20261114152935_track_trace_independent_preparation.sql','20261114194747_track_trace_community_catalog.sql','20261115000806_track_trace_live_circuit.sql','20261125024733_track_trace_circuit_editors.sql','20261125030225_track_trace_scan_metadata.sql'])await db.exec(await readFile(new URL('../supabase/testing-2027/'+file,import.meta.url),'utf8'));
    await seedArchiveUser(db,owner,'pro');await seedArchiveUser(db,other,'factory');await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    const p=(lat:number,lng:number)=>({lat,lng,accuracy:4,timestamp:'2026-11-24T12:00:00Z'}),boundary=(d=0)=>[p(35+d,-118),p(35.002+d,-118),p(35.002+d,-117.998),p(35+d,-117.998),p(35+d,-118)];
    const scan={track_name:'Editor synthetic circuit',community_location:'Synthetic test location',track_type:'dirt_oval',track_shape:'custom_unknown',direction:'counterclockwise',source:'track_scan',map_source:'track_scan',scan_status:'scanned',is_open_route:false,center_lat:35,center_lng:-118,area_key:'35_-118',facility_key:'synthetic-editor',bbox:{},outside_path:boundary(),inside_path:boundary(.0001),start_finish_path:circuitTrack().map.start_finish_path,corner_definitions:{corners:[]}};
    await asRole(db,'authenticated',owner);assert((await rpc('save_track_trace_scan_details',[id,{...scan,notes:'Measured circuit scan',track_length:'1/4 mile'},{sector_count:1,lines:[]}])).saved);
    let map=await rpc('get_track_trace_edit_map',[id]);const originalPath=map.outside_path;
    await t.test('source scan metadata is atomic; retry cannot replace the first saved scan',async()=>{
      assert.equal(map.notes,'Measured circuit scan');assert.equal(map.track_length,'1/4 mile');
      await rpc('save_track_trace_scan_details',[id,{...scan,notes:'Retry overwrite',outside_path:[]},{sector_count:1,lines:[]}]);
      assert.deepEqual(await rpc('get_track_trace_edit_map',[id]),map);
    });
    await t.test('private corners and sectors save through owner/version checks; stale and invalid patches fail',async()=>{
      const definitions=buildManualCornerDefinitions(map,[{start:.1,end:.3}]);
      const changed=await rpc('update_track_trace_private_map',[id,map.version,{corner_definitions:definitions,corner_detection_version:definitions.version}]);
      assert(changed.version>map.version);assert.deepEqual(changed.corner_definitions,definitions);assert.deepEqual(changed.outside_path,originalPath);
      await assert.rejects(rpc('update_track_trace_private_map',[id,map.version,{corner_definitions:definitions}]),/TRACK_VERSION_CHANGED/);map=changed;
      await assert.rejects(rpc('update_track_trace_private_map',[id,map.version,{outside_path:[]}]),/INVALID_PRIVATE_TRACK_PATCH/);
      await assert.rejects(rpc('update_track_trace_private_map',[id,map.version,{corner_definitions:{corners:[{startProgress:.7,apexProgress:.1,endProgress:.4,apex:{lat:35,lng:-118}}]}}]),/INVALID_CORNER_DEFINITION/);
      const current=map.sector_defaults[0].version;
      const saved=await rpc('save_track_trace_sector_layout',[id,current,2,circuitTrack().sectors!.lines]);assert.equal(saved.sector_defaults[0].sector_count,2);
      await assert.rejects(rpc('save_track_trace_sector_layout',[id,current,1,[]]),/SECTOR_VERSION_CHANGED/);map=saved;
      await assert.rejects(rpc('save_track_trace_sector_layout',[id,map.sector_defaults[0].version,2,[{...circuitTrack().sectors!.lines[0],progress:.99}]]),/INVALID_SECTOR_ORDER/);
    });
    await t.test('other users cannot load or change a private circuit',async()=>{
      await asRole(db,'authenticated',other);await assert.rejects(rpc('get_track_trace_edit_map',[id]),/CIRCUIT_UNAVAILABLE/);
      await assert.rejects(rpc('update_track_trace_private_map',[id,map.version,{corner_definitions:{corners:[]}}]),/PRIVATE_TRACK_OWNER_REQUIRED/);
    });
    await asRole(db,'postgres');await db.query("update public.onlylaps_track_maps set publication_status='published',is_active=true,community_layout_key='editor-main',community_layout_name='Main',community_location='Synthetic' where id=$1",[id]);
    await asRole(db,'authenticated',owner);const canonical=await rpc('get_track_trace_edit_map',[id]);
    await t.test('published maps remain immutable even to owner; cross-user sectors are personal overrides',async()=>{
      await assert.rejects(rpc('update_track_trace_private_map',[id,canonical.version,{corner_definitions:{corners:[]}}]),/PRIVATE_TRACK_OWNER_REQUIRED/);
      await asRole(db,'authenticated',other);let result=await rpc('save_track_trace_sector_layout',[id,0,1,[]]);assert.equal(result.user_sectors[0].user_id,other);assert.deepEqual(result.sector_defaults,canonical.sector_defaults);assert.equal(result.version,canonical.version);assert.deepEqual(result.outside_path,originalPath);
      await assert.rejects(rpc('save_track_trace_sector_layout',[id,0,1,[]]),/SECTOR_VERSION_CHANGED/);
      await asRole(db,'authenticated',owner);result=await rpc('save_track_trace_sector_layout',[id,0,1,[]]);assert.equal(result.user_sectors[0].user_id,owner);assert.deepEqual(result.sector_defaults,canonical.sector_defaults);assert.equal(result.version,canonical.version);
    });
    await t.test('Sportsman and anonymous users cannot use the editor contracts',async()=>{
      await rpc('set_onlyfast_test_tier',['sportsman']);await assert.rejects(rpc('get_track_trace_edit_map',[id]),/TRACK_TRACE_PRO_REQUIRED/);await assert.rejects(rpc('save_track_trace_sector_layout',[id,1,1,[]]),/TRACK_TRACE_PRO_REQUIRED/);
      await asRole(db,'anon');await assert.rejects(rpc('get_track_trace_edit_map',[id]),/permission denied/);
    });
  }finally{await db.close();}
});
