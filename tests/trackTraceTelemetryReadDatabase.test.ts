import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { phase2bDatabase,phase2bSql } from './helpers/trackTracePhase2b.mjs';
import { asRole,seedArchiveUser } from './helpers/archive2027.mjs';
const read=(file:string)=>readFile(new URL('../supabase/testing-2027/'+file,import.meta.url),'utf8');
test('telemetry parity reads legacy rows without weakening history, entitlement or ownership',async t=>{
  const db=await phase2bDatabase(true),a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rpc=async(name:string,args:unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  try{
    await db.exec(await phase2bSql());
    for(const file of ['20261114152935_track_trace_independent_preparation.sql','20261114194747_track_trace_community_catalog.sql','20261115000806_track_trace_live_circuit.sql','20261125020946_track_trace_telemetry_parity.sql'])await db.exec(await read(file));
    await seedArchiveUser(db,a,'pro');await seedArchiveUser(db,b,'factory');await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    await asRole(db,'authenticated',a);const id=await rpc('create_track_trace_session',[null,'Legacy timing']);
    await db.query("update public.onlylaps_timing_sessions set started_at='2026-11-24T12:00:00Z',ended_at='2026-11-24T12:01:00Z' where id=$1",[id]);
    await db.query("insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at,latitude,longitude,speed_mps,g_force_lateral,raw) select $1,$2,'2026-11-24T12:00:10Z',35,-118,20,.4,'{\"lapNumber\":1,\"verticalG\":0.2}'::jsonb from generate_series(1,501)",[a,id]);
    await t.test('legacy samples excluded by the old reader are present in the new cursor contract',async()=>{
      assert.deepEqual(await rpc('get_track_trace_samples',[id]),[],'reproduces Phase 2D historical omission');
      const first=await rpc('get_track_trace_telemetry_page',[id]);assert.equal(first.length,500);assert.equal(first[0].recorder_id,null);assert.equal(typeof first[0].id,'string');
      const second=await rpc('get_track_trace_telemetry_page',[id,first[499].recorded_at,first[499].id]);assert.equal(second.length,1);assert(!first.some((r:any)=>r.id===second[0].id));
      assert.equal(first[0].speed_mps,20);assert.equal(first[0].g_force_lateral,.4);assert.equal(first[0].raw.verticalG,.2);
      const bundle=await rpc('get_track_trace_review_bundle',[id]);assert.equal(bundle.sample_count,501);assert.equal(bundle.session.id,id);
      const cards=await rpc('list_track_trace_session_cards');assert.equal(cards[0].sample_count,501);
      await assert.rejects(rpc('get_track_trace_telemetry_page',[id,null,'1']),/INVALID_TELEMETRY_CURSOR/);
    });
    await t.test('another eligible user cannot read, enumerate or rename this private history',async()=>{
      await asRole(db,'authenticated',b);
      for(const name of ['get_track_trace_review_bundle','get_track_trace_telemetry_page'])await assert.rejects(rpc(name,[id]),/SESSION_UNAVAILABLE|SESSION_NOT_FOUND/);
      assert.deepEqual(await rpc('list_track_trace_session_cards'),[]);await assert.rejects(rpc('rename_track_trace_session',[id,'Forged']),/SESSION_UNAVAILABLE/);
    });
    await t.test('Pro rename uses the existing write guards; Sportsman reads owned history and cannot mutate it',async()=>{
      await asRole(db,'authenticated',a);await rpc('rename_track_trace_session',[id,'Renamed legacy']);assert.equal((await rpc('get_track_trace_review_bundle',[id])).session.session_name,'Renamed legacy');
      await rpc('set_onlyfast_test_tier',['sportsman']);assert.equal((await rpc('get_track_trace_telemetry_page',[id])).length,500);await assert.rejects(rpc('rename_track_trace_session',[id,'Denied']),/TRACK_TRACE_PRO_REQUIRED/);
      await asRole(db,'anon');await assert.rejects(rpc('get_track_trace_telemetry_page',[id]),/permission denied/);
    });
  }finally{await db.close();}
});
