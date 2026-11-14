import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { archiveDatabase, asRole, seedArchiveUser } from './helpers/archive2027.mjs';

test('Track Trace: database permissions, durable sessions and legacy isolation', async t => {
  const db = await archiveDatabase();
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rpc = async (name: string, args: unknown[]=[]) => (await db.query<any>('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
  const sql = await readFile(new URL('../supabase/testing-2027/track-trace.sql',import.meta.url),'utf8');
  let setup: any, sid: string, legacy: string, other: string;
  try {
    await seedArchiveUser(db,a,'pro'); await seedArchiveUser(db,b,'pro');
    await db.exec("update public.user_subscriptions set active_racing_discipline='dirt_oval'");
    const billing = (await db.query('select * from public.user_subscriptions order by user_id')).rows;
    await asRole(db,'authenticated',a);
    setup=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values($1,'Trace weekend','heat','Dwarf Cars','preserved chassis and notes') returning *",[a])).rows[0];
    // Seed a pre-foundation association; installing the module must retain it.
    legacy=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Historic circuit') returning id",[a])).rows[0].id;
    await asRole(db,'postgres');
    await db.query("insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)",[a,setup.id,legacy]);
    await asRole(db,'postgres');
    await db.exec(sql);
    await db.exec(await readFile(new URL('../supabase/testing-2027/track-trace-history-access.sql',import.meta.url),'utf8'));

    await t.test('Pro and Factory receive identical full permissions and unlimited sessions',async()=>{
      await asRole(db,'authenticated',a);
      const pro=await rpc('get_track_trace_permission');
      assert.equal(pro.allowed,true); assert.equal(pro.feature,'track_trace'); assert.equal(pro.session_limit,null);
      await rpc('set_onlyfast_test_tier',['factory']);
      const factory=await rpc('get_track_trace_permission');
      assert.deepEqual({...factory,tier:null},{...pro,tier:null});
      await rpc('set_onlyfast_test_tier',['pro']);
      await rpc('choose_onlyfast_2027_class',['Dwarf Cars']);
    });
    await t.test('existing setup values and immutable session links survive installation',async()=>{
      const row=(await db.query<any>('select * from public.race_setups where id=$1',[setup.id])).rows[0];
      assert.deepEqual(row,setup);
      assert.equal((await rpc('list_track_trace_sessions',[setup.id]))[0].id,legacy);
      assert.equal((await rpc('get_track_trace_setup_context',[setup.id])).context.session.id,legacy);
      await assert.rejects(rpc('create_track_trace_session',[setup.id,'Do not replace history']),/SESSION_ALREADY_LINKED/);
    });
    await t.test('creation persists into existing tables and links the exact setup row',async()=>{
      const heat=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Trace weekend','main','Dwarf Cars') returning id",[a])).rows[0].id;
      sid=await rpc('create_track_trace_session',[heat,'Prepared circuit']);
      const detail=await rpc('get_track_trace_session',[sid]);
      assert.equal(detail.session.name,'Prepared circuit'); assert.equal(detail.session.started_at,null);
      assert.equal((await rpc('get_track_trace_setup_context',[heat])).context.session.id,sid);
      await db.query("insert into public.onlylaps_lap_times(user_id,timing_session_id,lap_number,duration_ms) values($1,$2,1,12345)",[a,sid]);
      await db.query("insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at,latitude,longitude) values($1,$2,now(),35,-118)",[a,sid]);
      assert.equal((await rpc('get_track_trace_session',[sid])).laps[0].duration_ms,12345);
      const base=(await db.query<any>("insert into public.race_setups(user_id,setup_name,setup_type,race_class) values($1,'Template','base_template','Dwarf Cars') returning id",[a])).rows[0].id;
      await assert.rejects(rpc('create_track_trace_session',[base,'Invalid base session']),/SAVED_RACE_SESSION_REQUIRED/);
    });
    await t.test('foreign session reads, writes, links and setup context fail',async()=>{
      await asRole(db,'authenticated',b);
      other=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Other owner') returning id",[b])).rows[0].id;
      await assert.rejects(rpc('get_track_trace_session',[sid]),/SESSION_NOT_FOUND/);
      await assert.rejects(rpc('get_track_trace_setup_context',[setup.id]),/SESSION_NOT_FOUND/);
      await assert.rejects(rpc('create_track_trace_session',[setup.id,'Foreign setup']),/SAVED_RACE_SESSION_REQUIRED/);
      assert.equal((await db.query('select * from public.onlylaps_telemetry_samples where timing_session_id=$1',[sid])).rows.length,0);
      assert.equal((await db.query("update public.onlylaps_timing_sessions set name='forged' where id=$1 returning id",[sid])).rows.length,0);
      await assert.rejects(db.query("insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at) values($1,$2,now())",[b,sid]),/row-level security/);
      await assert.rejects(db.query("insert into public.onlyfast_onlylaps_session_links(user_id,onlyfast_session_id,onlylaps_session_id) values($1,$2,$3)",[b,setup.id,other]),/row-level security|SETUP_CHILD_READ_ONLY/);
    });
    await t.test('Sportsman and unsubscribed owners retain history but cannot record or modify it',async()=>{
      await asRole(db,'authenticated',a);
      for (const tier of ['sportsman','unsubscribed']) {
        await rpc('set_onlyfast_test_tier',[tier]);
        const permission=await rpc('get_track_trace_permission');
        assert.equal(permission.allowed,true); assert.equal(permission.can_read_history,true);
        assert.equal(permission.can_record,false); assert.equal(permission.can_modify,false); assert.equal(permission.can_read_archived,false);
        assert((await rpc('list_track_trace_sessions')).some((s:any)=>s.id===sid));
        assert.equal((await rpc('get_track_trace_session',[sid])).laps[0].duration_ms,12345);
        assert.equal((await rpc('get_track_trace_setup_context',[setup.id])).context.session.id,legacy);
        await assert.rejects(rpc('create_track_trace_session',[setup.id,'Bypass']),/TRACK_TRACE_PRO_REQUIRED/);
        for (const table of ['onlylaps_timing_sessions','onlylaps_telemetry_samples','onlylaps_lap_times','onlylaps_lap_sector_times','onlylaps_session_analysis','onlyfast_onlylaps_session_links','onlylaps_track_maps']) {
          const rows=(await db.query('select * from public.'+table)).rows;
          assert(rows.every((r:any)=>r.user_id===a),'owner-scoped '+table);
        }
        await assert.rejects(db.query("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Bypass')",[a]),/row-level security|TRACK_TRACE_PRO_REQUIRED|READ_ONLY/);
        assert.equal((await db.query("update public.onlylaps_lap_times set duration_ms=1 where timing_session_id=$1 returning id",[sid])).rows.length,0);
        assert.equal((await db.query("delete from public.onlylaps_timing_sessions where id=$1 returning id",[sid])).rows.length,0);
      }
    });
    await t.test('tier switching rechecks current permissions without deleting history',async()=>{
      await rpc('set_onlyfast_test_tier',['factory']);
      assert.equal((await rpc('get_track_trace_session',[sid])).laps.length,1);
      assert.equal((await rpc('get_track_trace_setup_context',[setup.id])).context.session.id,legacy);
      await rpc('set_onlyfast_test_tier',['pro']);
      await rpc('choose_onlyfast_2027_class',['Dwarf Cars']);
      assert.equal((await rpc('get_track_trace_session',[sid])).laps.length,1);
    });
    await t.test('Gumball and open routes are inaccessible even by direct API',async()=>{
      await assert.rejects(db.query("insert into public.onlylaps_timing_sessions(user_id,name,session_type) values($1,'Road','gumball')",[a]),/row-level security/);
      await asRole(db,'postgres');
      const g=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name,session_type) values($1,'Historic road','gumball') returning id",[a])).rows[0].id;
      await asRole(db,'authenticated',a);
      await assert.rejects(rpc('get_track_trace_session',[g]),/SESSION_NOT_FOUND/);
      assert(!(await rpc('list_track_trace_sessions')).some((s:any)=>s.id===g));
      await assert.rejects(db.query("update public.onlylaps_timing_sessions set session_type='gumball' where id=$1",[sid]),/row-level security/);
      await asRole(db,'postgres');
      const map=(await db.query<any>("insert into public.onlylaps_track_maps(user_id,name,track_name,area_key,center_lat,center_lng,bbox,is_open_route) values($1,'Road route','Road route','qa',0,0,'{}',true) returning id",[a])).rows[0].id;
      const road=(await db.query<any>("insert into public.onlylaps_timing_sessions(user_id,name,track_map_id) values($1,'Road practice',$2) returning id",[a,map])).rows[0].id;
      await asRole(db,'authenticated',a);
      assert.equal((await db.query('select * from public.onlylaps_track_maps where id=$1',[map])).rows.length,0);
      await assert.rejects(rpc('get_track_trace_session',[road]),/SESSION_NOT_FOUND/);
    });
    await t.test('anonymous API calls are denied and billing rows are unchanged',async()=>{
      await asRole(db,'anon'); await assert.rejects(rpc('get_track_trace_permission'),/permission denied/);
      await assert.rejects(db.query('select * from public.onlylaps_timing_sessions'),/permission denied/);
      await asRole(db,'postgres');
      assert.deepEqual((await db.query('select * from public.user_subscriptions order by user_id')).rows,billing);
      assert.match(sql,/ISOLATED_2027_TEST_DATABASE_REQUIRED/);
    });
    await t.test('migration refuses an environment marker for another database',async()=>{
      await db.exec("begin; create or replace function public.get_onlyfast_2027_environment() returns jsonb language sql as $$ select '{\"project_ref\":\"production-invalid\"}'::jsonb $$;");
      await assert.rejects(db.exec(sql),/ISOLATED_2027_TEST_DATABASE_REQUIRED/);
      await db.exec('rollback');
    });
  } finally { await db.close(); }
});
