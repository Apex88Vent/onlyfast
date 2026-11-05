// Executes the prepared SQL against disposable PostgreSQL/WASM, with real roles/RLS.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { stagingSequence } from '../scripts/prepare-staging-database.mjs';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pro = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', team = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const portable = sql => sql.replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi, '')
  .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi, '');

test('Phase 1 PostgreSQL roles, immutable weekends, sharing, quotas and retained data', async t => {
  const db = new PGlite();
  const role = async (name, uid = '') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [uid,name]);
    await db.exec('set role ' + name);
  };
  const rpc = async (name, params) => (await db.query('select public.' + name + '(' +
    params.map((_,i) => '$' + (i+1)).join(',') + ') as result', params)).rows[0].result;
  const insert = async (uid, name, type = 'base', extra = {}) => {
    const row = { user_id: uid, setup_name: name, setup_type: type, race_class: 'Dwarf Cars', track_name: name, race_date: '2026-11-05', ...extra };
    const keys = Object.keys(row);
    return (await db.query('insert into public.race_setups(' + keys.join(',') + ') values(' +
      keys.map((_,i) => '$' + (i+1)).join(',') + ') returning *', Object.values(row))).rows[0];
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create schema cron;
      create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
    const sequence = await stagingSequence();
    for (const entry of sequence.entries) await db.exec(portable(entry.sql.toString('utf8')));
    for (const uid of [a,b,pro,team]) await db.query('insert into auth.users(id,email) values($1,$2)', [uid,uid.slice(0,1)+'@example.invalid']);
    for (const [uid,plan] of [[a,'free'],[b,'free'],[pro,'pro'],[team,'teams']]) {
      await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class,onboarding_step) values($1,$2,'active','Dwarf Cars','complete')", [uid,plan]);
    }
    const legacy = await insert(a,'Legacy', 'base', { created_at: '2026-10-01', updated_at: '2026-10-02', notes: 'keep', custom_fields: { legacy: 'keep' } });
    await db.query("insert into public.setup_assist_usage(user_id,race_weekend_key,used_count) values($1,'Legacy',1)",[a]);
    await db.query("insert into public.shared_setups(setup_id,shared_by,shared_by_email,share_code) values($1,$2,'private@example.invalid','Abcd2345')",[legacy.id,a]);
    const phase = (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.includes('_phase1_')).sort();
    for (const name of phase) await db.exec(await read('supabase/migrations/'+name));
    const migrated = (await db.query('select * from public.race_setups where id=$1',[legacy.id])).rows[0];

    await t.test('backfill preserves original data and timestamps and establishes stable identity', async () => {
      assert.ok(migrated.race_weekend_id);
      const { race_weekend_id, ...original } = migrated;
      assert.deepEqual(original, legacy);
      assert.equal((await db.query("select used_count from public.setup_assist_usage where user_id=$1 and race_weekend_key=$2",[a,'weekend:'+race_weekend_id])).rows[0].used_count,1);
    });
    await t.test('public code redemption is projected, existing links work and table enumeration is denied', async () => {
      await role('anon');
      await assert.rejects(db.query('select * from public.shared_setups'),/permission denied/);
      await assert.rejects(db.query('select * from public.race_setups where id=$1',[legacy.id]),/permission denied/);
      const shared = await rpc('redeem_setup_share',['Abcd2345']);
      assert.equal(shared.notes,'keep'); assert.deepEqual(shared.custom_fields,{legacy:'keep'});
      for (const key of ['id','user_id','shared_by_email','latitude','longitude','timing_data','race_schedule_id']) assert.equal(shared[key],undefined);
      assert.equal(await rpc('redeem_setup_share',['wrong']),null);
      await role('authenticated',b);
      assert.equal((await db.query('select * from public.shared_setups')).rows.length,0);
      assert.equal((await db.query('select * from public.race_setups where id=$1',[legacy.id])).rows.length,0);
      await assert.rejects(db.query("insert into public.shared_setups(setup_id,shared_by,share_code) values($1,$2,'Foreign1')",[legacy.id,b]),/policy/);
      await role('postgres');
      for (const [field,value] of [['is_public',false],['revoked_at','2026-01-01'],['expires_at','2026-01-01']]) {
        await db.query('update public.shared_setups set '+field+'=$1 where share_code=$2',[value,'Abcd2345']);
        await role('anon'); assert.equal(await rpc('redeem_setup_share',['Abcd2345']),null);
        await role('postgres');
        await db.exec("update public.shared_setups set is_public=true,revoked_at=null,expires_at=now()+interval '1 day'");
      }
    });
    await t.test('membership cannot be probed, forged metadata is ignored, grants and expiration retain precedence', async () => {
      await role('authenticated',a);
      assert.equal(await rpc('onlyfast_subscription_tier',[a]),'rookie');
      await assert.rejects(rpc('onlyfast_subscription_tier',[pro]),/OWNER_REQUIRED/);
      assert.equal(await rpc('onlyfast_active_race_class',[pro]),null);
      await assert.rejects(rpc('onlyfast_membership_for_user',[a]),/permission denied/);
      await role('postgres');
      await db.query("update auth.users set raw_user_meta_data='{\"has_admin_full_access\":true,\"promo_access_level\":\"team\"}' where id=$1",[a]);
      await role('authenticated',a); assert.equal(await rpc('onlyfast_subscription_tier',[a]),'rookie');
      await role('postgres');
      await db.query("update auth.users set raw_app_meta_data='{\"promo_access_level\":\"teams\"}' where id=$1",[pro]);
      await role('authenticated',pro); assert.equal(await rpc('onlyfast_subscription_tier',[pro]),'team');
      await role('postgres');
      await db.query("update auth.users set raw_app_meta_data='{\"promo_access_level\":\"teams\",\"promo_access_expires_at\":\"2000-01-01\"}' where id=$1",[pro]);
      await role('authenticated',pro); assert.equal(await rpc('onlyfast_subscription_tier',[pro]),'pro');
      await role('postgres');
      await db.query("update public.user_subscriptions set subscription_source='revenuecat',revenuecat_expires_at=now()-interval '1 second' where user_id=$1",[pro]);
      await role('authenticated',pro); assert.equal(await rpc('onlyfast_subscription_tier',[pro]),'rookie');
      await role('postgres');
      await db.query("update public.user_subscriptions set subscription_source='stripe',plan='pro',status='active' where user_id=$1",[pro]);
    });
    let fresh;
    await t.test('reused names on separate dates resolve distinct owned weekends and cannot bypass Rookie count', async () => {
      await role('authenticated',b);
      const first=await insert(b,'Same name','base',{race_date:'2026-11-06'});
      const second=await insert(b,'Same name','base',{race_date:'2026-11-07'});
      assert.notEqual(first.race_weekend_id,second.race_weekend_id);
      await assert.rejects(insert(b,'Same name','base',{race_date:'2026-11-08'}),/WEEKEND_LIMIT/);
      await role('service_role');
      assert.equal(await rpc('onlyfast_resolve_assist_session',[b,'Same name']),null,'legacy hints reject ambiguous weekends');
      const one=await rpc('onlyfast_reserve_usage',[b,'assist',randomUUID(),'d'.repeat(64),first.id,false]);
      const two=await rpc('onlyfast_reserve_usage',[b,'assist',randomUUID(),'d'.repeat(64),second.id,false]);
      assert.equal(one.status,'reserved');assert.equal(two.status,'reserved');assert.notEqual(one.scope,two.scope);
    });
    await t.test('Rookie count, direct write, 48-hour mechanical boundary and allowed annotations', async () => {
      await role('authenticated',a);
      fresh=await insert(a,'Fresh');
      await insert(a,'Fresh','heat',{race_weekend_id:fresh.race_weekend_id});
      await assert.rejects(insert(a,'Third'),/WEEKEND_LIMIT/);
      await assert.rejects(db.query('update public.race_setups set lf_pressure=12 where id=$1',[legacy.id]),/EDIT_LOCKED/);
      await db.query("update public.race_setups set session_label='Renamed session', timing_data='{}' where id=$1",[legacy.id]);
      await assert.rejects(db.query('update public.race_setups set created_at=now() where id=$1',[legacy.id]),/IMMUTABLE/);
      await assert.rejects(insert(a,'Legacy','main',{race_weekend_id:migrated.race_weekend_id}),/EDIT_LOCKED/);
      await assert.rejects(insert(a,'Another date','main',{race_weekend_id:fresh.race_weekend_id}),/WEEKEND_MISMATCH/);
      await insert(a,'Base','base_template');
      await assert.rejects(insert(a,'Base 2','base_template'),/BASE_SETUP_LIMIT/);
      const before=(await db.query('select count(*)::int n from public.race_setups')).rows[0].n;
      await db.query('delete from public.race_setups where id=$1',[legacy.id]);
      assert.equal((await db.query('select count(*)::int n from public.race_setups')).rows[0].n,before-1);
      await assert.rejects(insert(a,'Foreign class','base',{race_class:'Modified'}),/VEHICLE_LOCKED/);
    });
    await t.test('Pro remains single-class, Team remains multi-class, existing rows over count survive', async () => {
      await role('authenticated',pro);
      for (let i=0;i<3;i++) await insert(pro,'Pro '+i,'base_template');
      await assert.rejects(insert(pro,'Wrong class','base',{race_class:'Modified'}),/VEHICLE_LOCKED/);
      await role('authenticated',team);
      await insert(team,'Other car','base',{race_class:'Modified'});
      await role('postgres');
      await db.query("update public.user_subscriptions set plan='free' where user_id=$1",[pro]);
      await role('authenticated',pro);
      await db.query("update public.race_setups set notes='retain grandfathered data' where user_id=$1",[pro]);
      assert.equal((await db.query('select count(*)::int n from public.race_setups')).rows[0].n,3);
      await role('postgres');
      await db.query("update public.user_subscriptions set plan='pro' where user_id=$1",[pro]);
    });
    await t.test('48-hour boundary is exact and another user cannot change the lock clock', async () => {
      await role('postgres');
      await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '48 hours'+interval '10 seconds' where id=$1",[fresh.race_weekend_id]);
      await role('authenticated',a);
      await db.query('update public.race_setups set lf_pressure=11 where id=$1',[fresh.id]);
      await role('postgres');
      await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '48 hours' where id=$1",[fresh.race_weekend_id]);
      await role('authenticated',a);
      await assert.rejects(db.query('update public.race_setups set lf_pressure=12 where id=$1',[fresh.id]),/EDIT_LOCKED/);
      await assert.rejects(db.query('update onlyfast_private.setup_weekends set created_at=now()'),/permission denied/);
      await role('postgres');
      await db.query('update onlyfast_private.setup_weekends set created_at=now() where id=$1',[fresh.race_weekend_id]);
    });
    await t.test('schedule linking and later sessions retain identity and reject foreign schedules', async () => {
      await role('postgres');
      const schedule=(await db.query("insert into public.race_schedule(user_id,race_date,track) values($1,'2026-11-05','Fresh') returning id",[a])).rows[0].id;
      const foreign=(await db.query("insert into public.race_schedule(user_id,race_date,track) values($1,'2026-11-05','Other') returning id",[b])).rows[0].id;
      await role('authenticated',a);
      await assert.rejects(db.query('update public.race_setups set race_schedule_id=$1 where id=$2',[foreign,fresh.id]),/SCHEDULE_OWNER_REQUIRED/);
      await db.query('update public.race_setups set race_schedule_id=$1 where id=$2',[schedule,fresh.id]);
      const main=await insert(a,'Fresh','main',{race_schedule_id:schedule});
      assert.equal(main.race_weekend_id,fresh.race_weekend_id);
    });
    await t.test('usage tables and RPCs reject browser writes and foreign sessions', async () => {
      await role('authenticated',a);
      await assert.rejects(db.exec('truncate public.setup_assist_usage'),/permission denied/);
      await assert.rejects(db.exec('update public.setup_assist_usage set used_count=0'),/permission denied/);
      await assert.rejects(rpc('onlyfast_reserve_usage',[a,'assist',randomUUID(),'a'.repeat(64),fresh.id,false]),/permission denied/);
      await role('service_role');
      await assert.rejects(rpc('onlyfast_reserve_usage',[b,'assist',randomUUID(),'a'.repeat(64),fresh.id,false]),/OWNER_REQUIRED/);
      assert.equal(await rpc('onlyfast_resolve_assist_session',[b,'Fresh']),null);
      const resolved=await rpc('onlyfast_resolve_assist_session',[a,'Fresh']);
      assert.equal((await db.query('select race_weekend_id from public.race_setups where id=$1',[resolved])).rows[0].race_weekend_id,fresh.race_weekend_id);
    });
    await t.test('atomic reservation, failed provider release, duplicate result and rename safety', async () => {
      await role('service_role');
      const id=randomUUID(), fp='a'.repeat(64);
      const reservations=await Promise.all([rpc('onlyfast_reserve_usage',[a,'assist',id,fp,fresh.id,false]),
        rpc('onlyfast_reserve_usage',[a,'assist',randomUUID(),fp,fresh.id,false])]);
      assert.deepEqual(reservations.map(x=>x.status),['reserved','limit']);
      assert.equal((await rpc('onlyfast_reserve_usage',[a,'assist',id,fp,fresh.id,false])).status,'pending');
      assert.equal(await rpc('onlyfast_finish_usage',[a,'assist',id,reservations[0].token,null]),true);
      const retry=await rpc('onlyfast_reserve_usage',[a,'assist',id,fp,fresh.id,false]);
      assert.equal(retry.status,'reserved');
      assert.notEqual(retry.token,reservations[0].token);
      assert.equal(await rpc('onlyfast_finish_usage',[a,'assist',id,reservations[0].token,{suggestion:'late'}]),false);
      const result={suggestion:'preserved response'};
      assert.equal(await rpc('onlyfast_finish_usage',[a,'assist',id,retry.token,result]),true);
      assert.deepEqual((await rpc('onlyfast_reserve_usage',[a,'assist',id,fp,fresh.id,false])).response,result);
      assert.equal((await rpc('onlyfast_reserve_usage',[a,'assist',id,'b'.repeat(64),fresh.id,false])).status,'conflict');
      await role('authenticated',a); await db.query("update public.race_setups set setup_name='Renamed' where id=$1",[fresh.id]);
      await role('service_role');
      assert.equal((await rpc('onlyfast_reserve_usage',[a,'assist',randomUUID(),fp,fresh.id,false])).status,'limit');
    });
    await t.test('timing keeps two monthly slots, interrupted lease expires and paid bypass survives', async () => {
      await role('service_role');
      const fp='c'.repeat(64), first=randomUUID(), second=randomUUID(), third=randomUUID();
      const one=await rpc('onlyfast_reserve_usage',[b,'timing',first,fp,null,false]);
      const two=await rpc('onlyfast_reserve_usage',[b,'timing',second,fp,null,false]);
      assert.equal((await rpc('onlyfast_reserve_usage',[b,'timing',third,fp,null,false])).status,'limit');
      await role('postgres');
      await db.query("update onlyfast_private.usage_requests set expires_at=now()-interval '1 second' where request_id=$1",[first]);
      await role('service_role');
      const three=await rpc('onlyfast_reserve_usage',[b,'timing',third,fp,null,false]);
      assert.equal(three.status,'reserved');
      assert.equal(await rpc('onlyfast_finish_usage',[b,'timing',first,one.token,{old:true}]),false);
      assert.equal(await rpc('onlyfast_finish_usage',[b,'timing',second,two.token,{ok:true}]),true);
      assert.equal(await rpc('onlyfast_finish_usage',[b,'timing',third,three.token,{ok:true}]),true);
      assert.equal((await rpc('onlyfast_reserve_usage',[b,'timing',randomUUID(),fp,null,false])).status,'limit');
      for (let i=0;i<3;i++) {
        const request=randomUUID(), paid=await rpc('onlyfast_reserve_usage',[pro,'timing',request,fp,null,false]);
        assert.equal(paid.status,'reserved');
        await rpc('onlyfast_finish_usage',[pro,'timing',request,paid.token,{ok:true}]);
      }
    });
    await t.test('a base template cannot invent or borrow an Assist weekend identity', async () => {
      await role('authenticated',b);
      await assert.rejects(insert(b,'Forged quota template','base_template',{race_weekend_id:randomUUID()}),/BASE_SETUP_WEEKEND_FORBIDDEN/);
    });
  } finally { await db.close(); }
});

test('Phase 1 applies to the recorded production migration shape without releasing onboarding or development classes', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid()) $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
    const sequence=await stagingSequence();
    for(const entry of sequence.entries.filter(entry=>!entry.source.includes('202610130001_restore_racing_onboarding')&&!entry.source.includes('20261013183621_enable_road_racing'))) {
      await db.exec(portable(entry.sql.toString('utf8')));
    }
    await db.query('insert into auth.users(id,email) values($1,$2)',[a,'fixture@example.invalid']);
    await db.query("insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values($1,true,true,'experimental')",[a]);
    await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values($1,'test_account_full_access',true)",[a]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
    await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,'free','active','GT3')",[a]);
    await db.exec('set role authenticated');
    const original=(await db.query("insert into public.race_setups(user_id,setup_name,setup_type,race_class,custom_fields) values($1,'Preserved development sheet','base','GT3',$2::jsonb) returning *",
      [a,JSON.stringify({onlyfast_setup_library_v1:{version:1,race_class:'GT3',values:{}}})])).rows[0];
    await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");
    for(const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name.includes('_phase1_')).sort()) {
      await db.exec(await read('supabase/migrations/'+name));
    }
    const result=(await db.query('select * from public.race_setups where id=$1',[original.id])).rows[0];
    const {race_weekend_id,...retained}=result;
    assert.ok(race_weekend_id);assert.deepEqual(retained,original);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select public.onlyfast_subscription_tier($1) result',[a])).rows[0].result,'team');
    assert.equal((await db.query('select public.onlyfast_can_use_setup_library() result')).rows[0].result,true);
    await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from public.shared_setups'),/permission denied/);
  } finally { await db.close(); }
});


