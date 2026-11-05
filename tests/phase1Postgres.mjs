// Opt-in only. A dedicated loopback cluster and an external pg install are required.
// Never reads application env files or accepts a production connection string.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { stagingSequence } from '../scripts/prepare-staging-database.mjs';

const config = JSON.parse(await readFile(process.env.ONLYFAST_TEST_PG_CONFIG, 'utf8'));
assert.equal(config.host, '127.0.0.1');
assert.equal(config.user, 'onlyfast_readiness');
assert.equal(config.database, 'postgres');
assert.match(config.clusterName, /^onlyfast_readiness_[a-f0-9]+$/);
const { default: pg } = await import(pathToFileURL(process.env.ONLYFAST_TEST_PG_MODULE).href);
const admin = new pg.Client(config);
await admin.connect();
assert.equal((await admin.query('show cluster_name')).rows[0].cluster_name, config.clusterName);
const database = 'onlyfast_readiness_' + randomUUID().replaceAll('-', '');
await admin.query('create database ' + database);
for (const [role, extra] of [['anon',''], ['authenticated',''], ['service_role','bypassrls']]) {
  if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) {
    await admin.query('create role ' + role + ' ' + extra);
  }
}
const connections = [];
async function connect() {
  const client = new pg.Client({ ...config, database, application_name: database });
  await client.connect();
  connections.push(client);
  await client.query("set statement_timeout='10s'");
  return client;
}
async function role(client, name, uid='') {
  await client.query('reset role');
  await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,name]);
  if (name !== 'owner') await client.query('set role '+name);
}
const rpc = async (client,name,params) => (await client.query('select public.'+name+'('+params.map((_,i)=>'$'+(i+1)).join(',')+') result',params)).rows[0].result;
const reserve = (client,uid,feature,id,setup=null,fp='a'.repeat(64)) => rpc(client,'onlyfast_reserve_usage',[uid,feature,id,fp,setup,false]);
const finish = (client,uid,feature,id,token,response) => rpc(client,'onlyfast_finish_usage',[uid,feature,id,token,response]);
const insert = async (client,uid,name,extra={}) => {
  const row={user_id:uid,setup_name:name,setup_type:'base',race_class:'Dwarf Cars',track_name:name,race_date:'2026-11-05',...extra};
  const keys=Object.keys(row);
  return (await client.query('insert into public.race_setups('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row))).rows[0];
};
const source = name => readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const names=['20261105090932_phase1_membership_and_sharing.sql','20261105090937_phase1_setup_and_usage_authorization.sql','20261105091108_phase1_restrict_legacy_access.sql'];
const migrations=await Promise.all(names.map(source));
const db=await connect(), c1=await connect(), c2=await connect(), c3=await connect();
const users=Array.from({length:9},()=>randomUUID());
async function blocked(client,pending) {
  // Observe the actual waiting backend, rather than infer contention from Promise timing.
  for (let i=0;i<50;i++) {
    const row=(await db.query('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[client.processID])).rows[0];
    if (row?.wait_event_type==='Lock') { assert.equal(row.wait_event,'advisory'); return; }
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('Expected advisory lock wait; contender did not block: '+String(await Promise.race([pending,Promise.resolve('pending')])));
}
async function migrationFailure(sql, pattern) {
  await assert.rejects(db.query(sql),pattern);
  await db.query('rollback');
}

test('Phase 1 native PostgreSQL 17 multi-connection and migration verification', async t => {
  try {
    await db.query(`create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true)) $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
    for(const entry of (await stagingSequence()).entries.filter(entry=>!entry.source.includes('restore_racing_onboarding')&&!entry.source.includes('enable_road_racing'))) {
      await db.query(entry.sql.toString('utf8').replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi,''));
    }
    for(const uid of users) {
      await db.query('insert into auth.users(id,email) values($1,$2)',[uid,uid+'@example.invalid']);
      await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,'free','active','Dwarf Cars')",[uid]);
    }
    const old=await insert(db,users[0],'Historical',{created_at:'2026-01-01',updated_at:'2026-01-02',custom_fields:{preserved:true}});
    const base=await insert(db,users[0],'[BASE TEMPLATE] old',{setup_type:'base_template'});
    await db.query("insert into public.setup_assist_usage(user_id,race_weekend_key,used_count) values($1,'Historical',1),($1,'unmatched history',1)",[users[0]]);
    await db.query("insert into public.shared_setups(setup_id,shared_by,shared_by_email,share_code) values($1,$2,'private@example.invalid','Oldc2345')",[old.id,users[0]]);

    await t.test('usage expansion refuses missing membership expansion', async()=>{
      await migrationFailure(migrations[1],/PHASE1_MEMBERSHIP_PREREQUISITE_REQUIRED/);
      assert.equal((await db.query("select to_regclass('onlyfast_private.setup_weekends') result")).rows[0].result,null);
    });
    await t.test('access restriction refuses missing expansion prerequisites', async()=>{
      await migrationFailure(migrations[2],/PHASE1_EXPANSION_PREREQUISITE_REQUIRED/);
      assert.equal((await db.query("select has_table_privilege('anon','public.shared_setups','select') result")).rows[0].result,true);
    });
    await t.test('membership transaction failure restores functions and columns',async()=>{
      await migrationFailure(migrations[0].replace(/commit;\s*$/i,'select 1/0; commit;'),/division by zero/);
      assert.equal((await db.query("select to_regprocedure('public.redeem_setup_share(text)') result")).rows[0].result,null);
      await db.query(migrations[0]);
      await role(c1,'anon');
      assert.equal((await rpc(c1,'redeem_setup_share',['Oldc2345'])).custom_fields.preserved,true);
    });
    await t.test('usage backfill missing-trigger and mid-transaction failures are atomic',async()=>{
      await db.query('alter table public.race_setups disable trigger race_setups_touch_updated_at');
      await migrationFailure(migrations[1],/PHASE1_TRIGGER_PREFLIGHT_REQUIRED/);
      assert.equal((await db.query("select to_regclass('onlyfast_private.setup_weekends') result")).rows[0].result,null);
      await db.query('alter table public.race_setups enable trigger race_setups_touch_updated_at');
      await migrationFailure(migrations[1].replace(/commit;\s*$/i,'select 1/0; commit;'),/division by zero/);
      assert.deepEqual((await db.query('select * from public.race_setups where id=$1',[old.id])).rows[0],old);
      assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='public.race_setups'::regclass and tgname in ('race_setups_touch_updated_at','guard_development_setup_library') and tgenabled='O'")).rows[0].n,2);
      await db.query(migrations[1]);
    });
    await t.test('separate expansion commits retain all legacy rows, clocks, base and usage',async()=>{
      const {race_weekend_id,...retained}=(await db.query('select * from public.race_setups where id=$1',[old.id])).rows[0];
      assert.deepEqual(retained,old);assert.ok(race_weekend_id);
      assert.equal((await db.query('select race_weekend_id from public.race_setups where id=$1',[base.id])).rows[0].race_weekend_id,null);
      assert.equal((await db.query('select count(*)::int n from public.setup_assist_usage where user_id=$1',[users[0]])).rows[0].n,3);
      await role(c1,'service_role');
      assert.equal((await reserve(c1,users[0],'assist',randomUUID(),old.id)).status,'limit');
    });
    let setup;
    await t.test('simultaneous Assist requests block on owner lock and admit exactly one',async()=>{
      await role(c1,'authenticated',users[1]);setup=await insert(c1,users[1],'Assist race');
      await role(c1,'service_role');await role(c2,'service_role');
      await c1.query('begin');const id=randomUUID();const one=await reserve(c1,users[1],'assist',id,setup.id);
      const pending=reserve(c2,users[1],'assist',randomUUID(),setup.id);await blocked(c2,pending);await c1.query('commit');
      assert.equal(one.status,'reserved');assert.equal((await pending).status,'limit');
      assert.equal(await finish(c1,users[1],'assist',id,one.token,{ok:true}),true);
      assert.equal((await db.query('select used_count from public.setup_assist_usage where user_id=$1',[users[1]])).rows[0].used_count,1);
    });
    await t.test('simultaneous timing uploads admit two and charge without lost updates',async()=>{
      for(const c of [c1,c2,c3])await role(c,'service_role');
      const ids=[randomUUID(),randomUUID(),randomUUID()];
      await c1.query('begin');const one=await reserve(c1,users[2],'timing',ids[0]);
      const twoPending=reserve(c2,users[2],'timing',ids[1]),threePending=reserve(c3,users[2],'timing',ids[2]);
      await blocked(c2,twoPending);await blocked(c3,threePending);await c1.query('commit');
      const results=[one,...await Promise.all([twoPending,threePending])];
      assert.deepEqual(results.map(x=>x.status).sort(),['limit','reserved','reserved']);
      await Promise.all(results.map((r,i)=>r.status==='reserved'?finish([c1,c2,c3][i],users[2],'timing',ids[i],r.token,{scan:i}):null));
      assert.equal((await db.query('select used_count from public.timing_scan_usage where user_id=$1',[users[2]])).rows[0].used_count,2);
    });
    await t.test('duplicate IDs contend, cache exactly once and reject conflicting payload',async()=>{
      const uid=users[3],id=randomUUID();await c1.query('begin');const one=await reserve(c1,uid,'timing',id);
      const pending=reserve(c2,uid,'timing',id);await blocked(c2,pending);await c1.query('commit');
      assert.equal((await pending).status,'pending');
      assert.equal(await finish(c1,uid,'timing',id,one.token,{cached:true}),true);
      assert.equal(await finish(c2,uid,'timing',id,one.token,{cached:false}),false);
      assert.deepEqual((await reserve(c2,uid,'timing',id)).response,{cached:true});
      assert.equal((await reserve(c2,uid,'timing',id,null,'b'.repeat(64))).status,'conflict');
      assert.equal((await db.query('select used_count from public.timing_scan_usage where user_id=$1',[uid])).rows[0].used_count,1);
    });
    await t.test('disconnected transaction rolls back; committed interrupted lease expires safely',async()=>{
      const transient=await connect();await role(transient,'service_role');await transient.query('begin');
      const uid=users[4],id=randomUUID();await reserve(transient,uid,'timing',id);
      await transient.end();
      assert.equal((await db.query('select count(*)::int n from onlyfast_private.usage_requests where user_id=$1',[uid])).rows[0].n,0);
      const first=await reserve(c1,uid,'timing',id);const secondId=randomUUID(),second=await reserve(c2,uid,'timing',secondId);
      assert.equal((await reserve(c3,uid,'timing',randomUUID())).status,'limit');
      await db.query("update onlyfast_private.usage_requests set expires_at=now()-interval '1 second' where user_id=$1 and request_id=$2",[uid,id]);
      const retry=await reserve(c2,uid,'timing',id);assert.equal(retry.status,'reserved');assert.notEqual(retry.token,first.token);
      assert.equal(await finish(c1,uid,'timing',id,first.token,{stale:true}),false);
      assert.equal(await finish(c2,uid,'timing',id,retry.token,null),true);
      assert.equal(await finish(c2,uid,'timing',secondId,second.token,null),true);
      assert.equal((await db.query('select count(*)::int n from public.timing_scan_usage where user_id=$1',[uid])).rows[0].n,0);
    });
    await t.test('concurrent saves preserve the two-weekend limit at READ COMMITTED',async()=>{
      const uid=users[5];await role(c1,'authenticated',uid);await role(c2,'authenticated',uid);
      await insert(c1,uid,'First');await c1.query('begin');await insert(c1,uid,'Second');
      // Attach a rejection handler immediately while the second transaction waits.
      const pending=insert(c2,uid,'Third').then(value=>({value}),error=>({error}));
      await blocked(c2,pending);await c1.query('commit');
      assert.match((await pending).error.message,/WEEKEND_LIMIT/);
      assert.equal((await db.query('select count(distinct race_weekend_id)::int n from public.race_setups where user_id=$1',[uid])).rows[0].n,2);
    });
    await t.test('base/foreign/phantom Assist identities are rejected even after maintenance bypass',async()=>{
      const uid=users[6];await role(c1,'authenticated',uid);
      await assert.rejects(insert(c1,uid,'Forged base',{setup_type:'base_template',race_weekend_id:randomUUID()}),/BASE_SETUP_WEEKEND_FORBIDDEN/);
      const ownBase=await insert(db,uid,'Malformed maintenance base',{setup_type:'base_template',race_weekend_id:setup.race_weekend_id});
      const phantom=await insert(db,uid,'Malformed maintenance race',{race_weekend_id:randomUUID()});
      const foreign=await insert(db,uid,'Foreign maintenance identity',{race_weekend_id:setup.race_weekend_id});
      await role(c1,'service_role');
      for(const row of [ownBase,phantom,foreign])await assert.rejects(reserve(c1,uid,'assist',randomUUID(),row.id),/OWNER_REQUIRED/);
    });
    await t.test('late duplicate save can recover identical data but guarded mechanical update fails',async()=>{
      const uid=users[7];await role(c1,'authenticated',uid);const row=await insert(c1,uid,'Lost response',{lf_pressure:10});
      await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '48 hours' where id=$1",[row.race_weekend_id]);
      await assert.rejects(insert(c1,uid,'Lost response',{id:row.id,race_weekend_id:row.race_weekend_id,lf_pressure:10}),/EDIT_LOCKED/);
      await c1.query('update public.race_setups set lf_pressure=10 where id=$1',[row.id]);
      await assert.rejects(c1.query('update public.race_setups set lf_pressure=11 where id=$1',[row.id]),/EDIT_LOCKED/);
    });
    await t.test('restriction failure restores grants; final commit preserves code redemption',async()=>{
      await migrationFailure(migrations[2].replace(/commit;\s*$/i,'select 1/0; commit;'),/division by zero/);
      assert.equal((await db.query("select has_table_privilege('anon','public.shared_setups','select') result")).rows[0].result,true);
      await db.query(migrations[2]);await role(c1,'anon');
      await assert.rejects(c1.query('select * from public.shared_setups'),/permission denied/);
      await assert.rejects(c1.query('select * from public.race_setups'),/permission denied/);
      const result=await rpc(c1,'redeem_setup_share',['Oldc2345']);assert.equal(result.custom_fields.preserved,true);
      for(const key of ['id','user_id','shared_by_email','race_schedule_id','race_weekend_id','timing_data'])assert.equal(result[key],undefined);
    });
    await t.test('account switch changes visibility; foreign writes/usage and revoked shares fail',async()=>{
      await role(c1,'authenticated',users[1]);assert.equal((await c1.query('select id from public.race_setups where id=$1',[setup.id])).rowCount,1);
      await role(c1,'authenticated',users[8]);assert.equal((await c1.query('select id from public.race_setups where id=$1',[setup.id])).rowCount,0);
      assert.equal((await c1.query("update public.race_setups set notes='foreign' where id=$1 returning id",[setup.id])).rowCount,0);
      await assert.rejects(c1.query('truncate public.setup_assist_usage'),/permission denied/);
      await role(c2,'service_role');await assert.rejects(reserve(c2,users[8],'assist',randomUUID(),setup.id),/OWNER_REQUIRED/);
      await db.query("update public.shared_setups set revoked_at=now() where share_code='Oldc2345'");
      await role(c1,'anon');assert.equal(await rpc(c1,'redeem_setup_share',['Oldc2345']),null);
    });
    console.log('Synthetic PostgreSQL evidence database retained: '+database+'; cluster '+config.clusterName);
  } finally {
    await Promise.allSettled(connections.map(c=>c.end()));
    await admin.end();
  }
});
