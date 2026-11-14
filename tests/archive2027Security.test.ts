import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { archiveDatabase, asRole, seedArchiveUser } from './helpers/archive2027.mjs';

const uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const foreign='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const rpc=async(db:any,name:string,args:unknown[]=[]) => (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
const setup=async(db:any,name:string,raceClass='Dwarf Cars') => (await db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes,timing_data) values($1,$2,'base',$3,'permanent notes','{\"finishing_position\":3}') returning *",[uid,name,raceClass])).rows[0];

test('2027 child security: archived sessions, notes, timing, laps, sectors, samples, analysis and shares; independent history remains readable',async()=>{
  const db=await archiveDatabase({trackTrace:true});
  try {
    await seedArchiveUser(db,uid); await seedArchiveUser(db,foreign);
    await asRole(db,'authenticated',uid);
    const parent=await setup(db,'Security weekend');
    const schedule=(await db.query("insert into public.race_schedule(user_id,race_date,track,finishing_position) values($1,'2026-11-15','Historical Speedway','3rd') returning id",[uid])).rows[0].id;
    await db.query('update public.race_setups set race_schedule_id=$1 where id=$2',[schedule,parent.id]);
    await db.query("insert into public.shared_setups(setup_id,shared_by,share_code,is_public) values($1,$2,'CHILD8AA',true)",[parent.id,uid]);
    await asRole(db,'postgres');
    const track=(await db.query("insert into public.onlylaps_track_maps(user_id,name,track_name,area_key,center_lat,center_lng,bbox) values($1,'Synthetic','Synthetic','qa',0,0,'{}') returning id",[uid])).rows[0].id;
    const timings=[];
    for(const name of ['Linked','Independent']) timings.push((await db.query("insert into public.onlylaps_timing_sessions(user_id,name) values($1,$2) returning id",[uid,name])).rows[0].id);
    await db.query('insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)',[uid,parent.id,timings[0]]);
    for(let i=0;i<timings.length;i++) {
      const lap=(await db.query('insert into public.onlylaps_lap_times(user_id,timing_session_id,lap_number,duration_ms) values($1,$2,1,15000) returning id',[uid,timings[i]])).rows[0].id;
      await db.query('insert into public.onlylaps_lap_sector_times(user_id,timing_session_id,lap_id,track_id,sector_index,duration_ms) values($1,$2,$3,$4,1,7500)',[uid,timings[i],lap,track]);
      await db.query('insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at,elapsed_ms) values($1,$2,now(),100)',[uid,timings[i]]);
      await db.query("insert into public.onlylaps_session_analysis(user_id,session_id,analysis_version,summary_text) values($1,$2,'qa-v1','Historical analysis')",[uid,timings[i]]);
      await db.query('insert into public.onlylaps_telemetry_shares(owner_id,session_id,share_code) values($1,$2,$3)',[uid,timings[i],i===0?'ABCDEFGH':'JKMNPQRS']);
    }
    const protectedTables=['race_setups','onlyfast_onlylaps_session_links','shared_setups','onlylaps_timing_sessions','onlylaps_lap_times','onlylaps_lap_sector_times','onlylaps_telemetry_samples','onlylaps_session_analysis','onlylaps_telemetry_shares','race_schedule'];
    await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '49 hours' where id=$1",[parent.race_weekend_id]);
    const snapshot=async()=>Promise.all(protectedTables.map(async table=>(await db.query('select * from public.'+table+' order by id')).rows));
    const before=await snapshot();
    await asRole(db,'authenticated',uid);
    assert.equal((await rpc(db,'get_onlyfast_2027_setup_edit_state',[parent.id])).reason,'48_hour_lock');
    assert.equal((await rpc(db,'get_track_trace_session',[timings[0]])).laps.length,1,'48-hour active setup telemetry remains viewable');
    await rpc(db,'set_onlyfast_setup_archive',[parent.id,true]);
    for(const table of protectedTables) {
      const rows=(await db.query('select * from public.'+table)).rows;
      assert.equal(rows.length,['race_setups','onlyfast_onlylaps_session_links','shared_setups'].includes(table)?0:1,table);
    }
    assert.equal(await rpc(db,'redeem_setup_share',['CHILD8AA']),null);
    assert.equal((await rpc(db,'get_onlyfast_2027_setup_edit_state',[parent.id])).readable,false);
    for (const tier of ['sportsman','unsubscribed']) {
      await rpc(db,'set_onlyfast_test_tier',[tier]);
      assert.equal((await rpc(db,'list_track_trace_sessions')).length,1,'independent history remains listed');
      const history=await rpc(db,'get_track_trace_session',[timings[1]]);
      assert.equal(history.laps.length,1); assert.equal(history.sectors.length,1); assert.equal(history.analysis.length,1);
      for (const [name,args] of [['get_track_trace_session',[timings[0]]],['get_track_trace_setup_context',[parent.id]],['list_track_trace_sessions',[parent.id]]]) {
        await assert.rejects(rpc(db,name as string,args as unknown[]),/SESSION_NOT_FOUND/,'archive restrictions survive historical RPCs');
      }
      for (const table of ['onlylaps_timing_sessions','onlylaps_lap_times','onlylaps_lap_sector_times','onlylaps_telemetry_samples','onlylaps_telemetry_shares']) {
        assert.equal((await db.query('delete from public.'+table+' returning id')).rows.length,0,tier+' cannot delete '+table);
      }
      assert.equal((await db.query('update public.onlylaps_lap_times set duration_ms=1 returning id')).rows.length,0);
      assert.equal((await db.query('update public.onlylaps_telemetry_shares set revoked_at=now() returning id')).rows.length,0);
      await assert.rejects(db.query("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Recording bypass')",[uid]),/READ_ONLY|PRO_REQUIRED|row-level security/);
      await assert.rejects(db.query('insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at) values($1,$2,now())',[uid,timings[1]]),/READ_ONLY|PRO_REQUIRED|row-level security/);
      assert.equal((await db.query("update public.onlylaps_session_analysis set summary_text='forged' returning id")).rows.length,0);
      assert.equal((await db.query('select * from public.onlylaps_track_maps')).rows.length,1,'owned map history is retained');
    }
    await rpc(db,'set_onlyfast_test_tier',['sportsman']);
    await asRole(db,'authenticated',foreign);
    for(const table of protectedTables) assert.equal((await db.query('select * from public.'+table)).rows.length,0,'foreign '+table);
    assert.equal((await db.query('select * from public.onlylaps_track_maps')).rows.length,0,'foreign map history stays private');
    await asRole(db,'service_role');
    assert.equal((await db.query('select * from public.onlyfast_onlylaps_candidate_lap_summaries($1,$2)',[uid,timings])).rows.length,1,'service aggregate hides archived child');
    await assert.rejects(rpc(db,'onlyfast_unlink_onlylaps_session',[uid,parent.id]),/READ_ONLY|TRACK_TRACE_PRO_REQUIRED/);
    await assert.rejects(rpc(db,'onlyfast_set_onlylaps_session_link',[uid,parent.id,timings[1]]),/READ_ONLY|TRACK_TRACE_PRO_REQUIRED/);
    await asRole(db,'authenticated',uid); await rpc(db,'set_onlyfast_test_tier',['pro']);
    assert.equal((await rpc(db,'get_track_trace_session',[timings[0]])).analysis.length,1,'Pro can read archived telemetry');
    assert.equal((await db.query('select notes from public.race_setups where id=$1',[parent.id])).rows[0].notes,'permanent notes');
    // Paid archival access is still read-only, including attempted child detachment.
    await assert.rejects(db.query('update public.onlylaps_lap_times set timing_session_id=$1 where timing_session_id=$2',[timings[1],timings[0]]),/READ_ONLY/);
    await assert.rejects(db.query('delete from public.onlylaps_timing_sessions where id=$1',[timings[0]]),/READ_ONLY/);
    await assert.rejects(db.query('update public.race_setups set notes=$1 where id=$2',['changed',parent.id]),/READ_ONLY/);
    await rpc(db,'set_onlyfast_test_tier',['unsubscribed']);
    assert.equal((await db.query('select * from public.onlylaps_lap_times')).rows.length,1,'unsubscribed independent laps remain visible');
    assert.equal((await db.query('select * from public.race_schedule')).rows.length,1,'unsubscribed schedules remain visible');
    await assert.rejects(db.query('update public.race_schedule set track=$1 where id=$2',['changed',schedule]),/READ_ONLY/);
    await asRole(db,'anon'); assert.equal(await rpc(db,'redeem_setup_share',['CHILD8AA']),null);
    await asRole(db,'postgres'); assert.deepEqual(await snapshot(),before,'all racing data and timestamps unchanged');
  } finally {await db.close();}
});

test('2027 downgrade: explicit class selection, historical viewing, restoration, upgrade and 48-hour viewing',async()=>{
  const db=await archiveDatabase({trackTrace:true});
  try {
    await seedArchiveUser(db,uid,'factory'); await asRole(db,'authenticated',uid);
    const dwarf=await setup(db,'Dwarf history'); const modified=await setup(db,'Modified history','Modified');
    await rpc(db,'set_onlyfast_test_tier',['pro']);
    assert.equal((await rpc(db,'get_onlyfast_2027_account_access')).selection_required,true);
    assert.equal((await db.query('select notes from public.race_setups')).rows.length,2);
    assert.equal(await rpc(db,'onlyfast_can_save_setup_class',[uid,'Dwarf Cars']),false);
    await assert.rejects(db.query('update public.race_setups set notes=$1 where id=$2',['pending',dwarf.id]),/READ_ONLY/);
    await assert.rejects(rpc(db,'choose_onlyfast_2027_class',['not-a-class']),/CLASS_INVALID/);
    assert.equal(await rpc(db,'choose_onlyfast_2027_class',['Modified']),'Modified');
    assert.equal(await rpc(db,'onlyfast_can_save_setup_class',[uid,'Modified']),true);
    assert.equal(await rpc(db,'onlyfast_can_save_setup_class',[uid,'Dwarf Cars']),false);
    await db.query('update public.race_setups set notes=$1 where id=$2',['selected class',modified.id]);
    await assert.rejects(db.query('update public.race_setups set notes=$1 where id=$2',['other class',dwarf.id]),/READ_ONLY/);
    await rpc(db,'set_onlyfast_setup_archive',[dwarf.id,true]);
    await assert.rejects(rpc(db,'set_onlyfast_setup_archive',[dwarf.id,false]),/ACTIVE_CLASS/);
    await rpc(db,'set_onlyfast_test_tier',['factory']); await rpc(db,'set_onlyfast_test_tier',['sportsman']);
    assert.equal((await rpc(db,'get_onlyfast_2027_account_access')).selection_required,true);
    await rpc(db,'set_onlyfast_test_tier',['factory']);
    assert.equal((await rpc(db,'get_onlyfast_2027_account_access')).selection_required,false,'upgrade clears pending choice');
    await rpc(db,'set_onlyfast_setup_archive',[dwarf.id,false]);
    await rpc(db,'set_onlyfast_test_tier',['sportsman']); await rpc(db,'choose_onlyfast_2027_class',['Dwarf Cars']);
    await asRole(db,'postgres');
    await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '49 hours' where id=$1",[dwarf.race_weekend_id]);
    await asRole(db,'authenticated',uid);
    const access=await rpc(db,'get_onlyfast_2027_setup_edit_state',[dwarf.id]);
    assert.equal(access.reason,'48_hour_lock'); assert.equal(access.readable,true); assert.equal(access.editable,false);
    assert.equal((await db.query('select notes from public.race_setups where id=$1',[dwarf.id])).rows[0].notes,'permanent notes');
    await rpc(db,'set_onlyfast_setup_archive',[dwarf.id,true]);
    assert.equal((await rpc(db,'set_onlyfast_setup_archive',[dwarf.id,true])).changed,false);
    await rpc(db,'set_onlyfast_test_tier',['factory']);
    await rpc(db,'set_onlyfast_test_tier',['unsubscribed']);
    await rpc(db,'set_onlyfast_test_tier',['pro']);
    assert.equal((await rpc(db,'get_onlyfast_2027_account_access')).selection_required,true,'a subscription gap cannot silently choose the class after Factory');
  } finally {await db.close();}
});

test('2027 usage: cached responses, pending operations and service RPCs recheck archive/tier/class permissions',async()=>{
  const db=await archiveDatabase({trackTrace:true});
  try {
    await seedArchiveUser(db,uid); await asRole(db,'authenticated',uid); const parent=await setup(db,'Usage weekend');
    const request='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const reserve=()=>rpc(db,'onlyfast_reserve_usage',[uid,'assist',request,'f'.repeat(64),parent.id]);
    await asRole(db,'service_role'); const lease=await reserve(); assert.equal(lease.status,'reserved');
    await asRole(db,'authenticated',uid); await rpc(db,'set_onlyfast_setup_archive',[parent.id,true]);
    await asRole(db,'service_role');
    assert.equal(await rpc(db,'onlyfast_finish_usage',[uid,'assist',request,lease.token,{content:'must not finish'}]),false);
    await assert.rejects(reserve(),/READ_ONLY/);
    await asRole(db,'authenticated',uid); await rpc(db,'set_onlyfast_test_tier',['pro']); await rpc(db,'set_onlyfast_setup_archive',[parent.id,false]);
    await asRole(db,'service_role'); assert.equal(await rpc(db,'onlyfast_finish_usage',[uid,'assist',request,lease.token,{content:'changed tier'}]),false);
    assert.equal(await rpc(db,'onlyfast_finish_usage',[uid,'assist',request,lease.token,null]),true,'can release invalidated lease');
    const renewed=await reserve(); assert.equal(renewed.status,'reserved');
    assert.equal(await rpc(db,'onlyfast_finish_usage',[uid,'assist',request,renewed.token,{content:'complete'}]),true);
    assert.equal((await reserve()).status,'complete');
    await asRole(db,'authenticated',uid); await rpc(db,'set_onlyfast_test_tier',['unsubscribed']);
    await asRole(db,'service_role'); await assert.rejects(reserve(),/READ_ONLY/,'cannot recover cached protected content after losing access');
  } finally {await db.close();}
});

test('2027 migration review: parent dependencies, RLS, function grants, pinned search paths and target guard',async()=>{
  const db=await archiveDatabase({trackTrace:true});
  try {
    const unprotected=(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','onlyfast_private') and c.relkind='r' and not c.relrowsecurity")).rows;
    assert.deepEqual(unprotected,[],'all application tables require RLS');
    const children=(await db.query("select distinct c.conrelid::regclass::text name from pg_constraint c where c.contype='f' and c.confrelid='public.race_setups'::regclass order by name")).rows.map((r:any)=>r.name.replace(/^public\./,''));
    assert.deepEqual(children,['onlyfast_onlylaps_session_links','shared_setups'],'new direct child relationships require archive review');
    const internal=['onlyfast_private.setup_access_for_owner(uuid,uuid)','onlyfast_private.active_setup_counts(uuid)',
      'onlyfast_private.can_write_class_2027(uuid,text)','onlyfast_private.assert_2027_setup_write(uuid,uuid)',
      'onlyfast_private.assert_track_trace_write_2027(uuid)'];
    for(const signature of internal) {
      const row=(await db.query("select has_function_privilege('authenticated',$1,'execute') allowed",[signature])).rows[0];
      assert.equal(row.allowed,false,signature);
    }
    for(const signature of ['public.set_onlyfast_setup_archive(uuid,boolean)','public.choose_onlyfast_2027_class(text)',
      'public.get_onlyfast_2027_account_access()','public.get_onlyfast_2027_setup_edit_state(uuid)','public.list_user_setup_summaries()']) {
      assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') allowed",[signature])).rows[0].allowed,false,signature);
    }
    const definers=(await db.query("select p.oid::regprocedure::text name,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','onlyfast_private') and p.prosecdef")).rows;
    assert(definers.every((r:any)=>r.proconfig?.some((setting:string)=>setting.startsWith('search_path='))),'all privileged functions pin their search path');
    const tracePolicies=(await db.query("select policyname,cmd,permissive from pg_policies where schemaname='public' and policyname in ('track_trace_history','track_trace_record','track_trace_modify','track_trace_delete','track_trace_entitlement')")).rows;
    assert.equal(tracePolicies.length,48); assert(tracePolicies.every((p:any)=>p.permissive==='RESTRICTIVE'));
    for(const [name,command] of [['track_trace_history','SELECT'],['track_trace_record','INSERT'],['track_trace_modify','UPDATE'],['track_trace_delete','DELETE']]) {
      assert.equal(tracePolicies.filter((p:any)=>p.policyname===name&&p.cmd===command).length,12);
    }
    const migration=await readFile(new URL('../supabase/testing-2027/phase2-archives.sql',import.meta.url),'utf8');
    await db.exec("begin; create or replace function public.get_onlyfast_2027_environment() returns jsonb language sql as $$ select '{\"project_ref\":\"wrong-target\"}'::jsonb $$;");
    await assert.rejects(db.exec(migration),/ISOLATED_2027_TEST_DATABASE_REQUIRED/);
    await db.exec('rollback');
  } finally {await db.close();}
});
