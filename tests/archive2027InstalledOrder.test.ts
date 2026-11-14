import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { preparePhase2ArchiveInstall } from '../scripts/prepare-2027-phase2-archives.mjs';
import { phase2bDatabase, phase2bSql } from './helpers/trackTracePhase2b.mjs';
import { asRole, seedArchiveUser } from './helpers/archive2027.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const installSql = () => readFile(new URL('../supabase/testing-2027/phase2-archives-install.sql', import.meta.url), 'utf8');
const rpc = async (db: any, name: string, args: unknown[] = []) =>
  (await db.query('select public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') r', args)).rows[0].r;

test('reviewed archive artifact installs after BOTH live Track Trace migrations without rewriting history', async () => {
  const db = await phase2bDatabase();
  try {
    await db.exec(await phase2bSql());
    await seedArchiveUser(db, owner, 'pro');
    await seedArchiveUser(db, foreign, 'pro');
    await asRole(db, 'authenticated', owner);
    const setup = (await db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes,timing_data) values($1,'Existing weekend','base','Dwarf Cars','Retained notes','{\"finishing_position\":3}') returning id", [owner])).rows[0].id;
    const linked = await rpc(db, 'create_track_trace_session', [setup, 'Existing linked recording']);
    const history = (await db.query("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Existing independent recording') returning id", [owner])).rows[0].id;
    for (const sid of [linked, history]) {
      await db.query('insert into public.onlylaps_lap_times(user_id,timing_session_id,lap_number,duration_ms) values($1,$2,1,15000)', [owner, sid]);
      await db.query("insert into public.onlylaps_session_analysis(user_id,session_id,analysis_version,summary_text) values($1,$2,'qa-v1','Existing analysis')", [owner, sid]);
    }
    await asRole(db, 'postgres');
    const tables = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map((r: any) => r.tablename);
    const snapshot = async (names: string[]) => Promise.all(names.map(async name =>
      (await db.query('select to_jsonb(t) as row from public.' + name + ' t order by to_jsonb(t)::text')).rows));
    const beforeInstall = await snapshot(tables);
    const privateBefore = (await db.query('select to_jsonb(w) as row from onlyfast_private.setup_weekends w order by id')).rows;
    const phase2bDefinitions = async () => (await db.query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('list_track_trace_link_candidates','set_track_trace_session_link','list_track_trace_tracks')) or (n.nspname='onlyfast_private' and p.proname in ('track_trace_setup_writable','track_trace_current_link','set_track_trace_link')) order by n.nspname,p.proname")).rows;
    const phase2bBefore = await phase2bDefinitions();
    const sql = await installSql();
    assert.equal(sql, (await preparePhase2ArchiveInstall()).sql, 'artifact contains exactly the hash-pinned reviewed source bodies');
    await db.exec(sql);
    assert.deepEqual(await snapshot(tables), beforeInstall, 'installation preserves every existing public row and timestamp');
    assert.deepEqual((await db.query('select to_jsonb(w) as row from onlyfast_private.setup_weekends w order by id')).rows, privateBefore);
    assert.deepEqual(await phase2bDefinitions(), phase2bBefore, 'Phase 2B RPC definitions remain intact');
    const protectedTables = ['race_setups', 'onlyfast_onlylaps_session_links', 'onlylaps_timing_sessions', 'onlylaps_lap_times', 'onlylaps_session_analysis'];
    const retained = await snapshot(protectedTables);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='track_trace_entitlement'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname in ('track_trace_history','track_trace_record','track_trace_modify','track_trace_delete')")).rows[0].n, 48);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname like 'track_trace_link_setup_%'")).rows[0].n, 3);
    await asRole(db, 'authenticated', owner);
    assert.equal((await rpc(db, 'list_track_trace_link_candidates', [setup])).editable, true);
    await rpc(db, 'set_onlyfast_test_tier', ['sportsman']);
    assert.equal((await rpc(db, 'get_track_trace_session', [linked])).laps.length, 1);
    assert.equal((await rpc(db, 'get_track_trace_permission')).can_record, false);
    await assert.rejects(rpc(db, 'create_track_trace_session', [null, 'Forbidden recording']), /TRACK_TRACE_PRO_REQUIRED/);
    await assert.rejects(rpc(db, 'set_track_trace_session_link', [setup, null, linked]), /TRACK_TRACE_PRO_REQUIRED/);
    await rpc(db, 'set_onlyfast_setup_archive', [setup, true]);
    await assert.rejects(rpc(db, 'get_track_trace_session', [linked]), /SESSION_NOT_FOUND/);
    assert.equal((await db.query('select * from public.race_setups where id=$1', [setup])).rows.length, 0);
    await assert.rejects(rpc(db, 'set_onlyfast_setup_archive', [setup, false]), /RESTORE_REQUIRES/);
    for (const tier of ['sportsman', 'unsubscribed']) {
      await rpc(db, 'set_onlyfast_test_tier', [tier]);
      assert.equal((await rpc(db, 'get_track_trace_session', [history])).analysis.length, 1);
      assert.equal((await db.query('update public.onlylaps_lap_times set duration_ms=1 returning id')).rows.length, 0);
      assert.equal((await db.query('delete from public.onlylaps_timing_sessions returning id')).rows.length, 0);
      await assert.rejects(db.query("insert into public.onlylaps_timing_sessions(user_id,name) values($1,'Forbidden')", [owner]), /READ_ONLY|PRO_REQUIRED|row-level security/);
    }
    await asRole(db, 'authenticated', foreign);
    for (const sid of [linked, history]) await assert.rejects(rpc(db, 'get_track_trace_session', [sid]), /SESSION_NOT_FOUND/);
    await assert.rejects(rpc(db, 'list_track_trace_link_candidates', [setup]), /SESSION_NOT_FOUND/);
    await asRole(db, 'authenticated', owner);
    for (const tier of ['pro', 'factory']) {
      await rpc(db, 'set_onlyfast_test_tier', [tier]);
      assert.equal((await rpc(db, 'get_track_trace_session', [linked])).laps.length, 1);
      assert.equal((await rpc(db, 'list_track_trace_link_candidates', [setup])).editable, false);
      await assert.rejects(rpc(db, 'set_track_trace_session_link', [setup, null, linked]), /SETUP_READ_ONLY_OR_NOT_FOUND/);
      await rpc(db, 'set_onlyfast_setup_archive', [setup, false]);
      assert.equal((await rpc(db, 'set_track_trace_session_link', [setup, linked, linked])).action, 'unchanged');
      await rpc(db, 'set_onlyfast_setup_archive', [setup, true]);
    }
    await asRole(db, 'postgres');
    assert.deepEqual(await snapshot(protectedTables), retained, 'all racing values, IDs, links, analysis and timestamps survive the workflows');
  } finally { await db.close(); }
});

test('atomic archive artifact refuses wrong targets, requires Phase 2B, and rolls back both layers on failure', async () => {
  const db = await phase2bDatabase();
  try {
    const sql = await installSql();
    await assert.rejects(db.exec(sql), /INSTALLED_TRACK_TRACE_FOUNDATION_AND_PHASE2B_REQUIRED/);
    await db.exec('rollback');
    await db.exec(await phase2bSql());
    await db.exec("begin; create or replace function public.get_onlyfast_2027_environment() returns jsonb language sql as $$ select '{\"project_ref\":\"production-invalid\"}'::jsonb $$;");
    await assert.rejects(db.exec(sql), /ISOLATED_2027_TEST_DATABASE_REQUIRED/);
    await db.exec('rollback');
    const failBeforeCommit = sql.replace(/\ncommit;\s*$/, () => "\ndo $$ begin raise exception 'SIMULATED_INSTALL_FAILURE'; end $$;\ncommit;\n");
    await assert.rejects(db.exec(failBeforeCommit), /SIMULATED_INSTALL_FAILURE/);
    await db.exec('rollback');
    const state = (await db.query("select to_regclass('onlyfast_private.setup_archives') as archives,to_regprocedure('onlyfast_private.require_track_trace_history()') as history,(select count(*)::int from pg_policies where policyname='track_trace_entitlement') as old_policy_count")).rows[0];
    assert.deepEqual(state, { archives: null, history: null, old_policy_count: 12 });
    await db.exec(sql);
    await assert.rejects(db.exec(sql), /PHASE2_ARCHIVES_OR_HISTORY_ALREADY_INSTALLED/);
    await db.exec('rollback');
    assert.notEqual((await db.query("select to_regclass('onlyfast_private.setup_archives') as archives")).rows[0].archives, null);
  } finally { await db.close(); }
});
