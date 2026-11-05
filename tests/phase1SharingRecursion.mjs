// Opt-in native PostgreSQL regression; uses the existing dedicated loopback cluster.
// Loads schema and policy metadata only. Never loads application/production secrets.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {stagingSequence} from '../scripts/prepare-staging-database.mjs';

const config=JSON.parse(await readFile(process.env.ONLYFAST_TEST_PG_CONFIG,'utf8'));
assert.equal(config.host,'127.0.0.1');assert.equal(config.user,'onlyfast_readiness');
assert.equal(config.database,'postgres');assert.match(config.clusterName,/^onlyfast_readiness_[a-f0-9]+$/);
const {default:pg}=await import(pathToFileURL(process.env.ONLYFAST_TEST_PG_MODULE).href);
const control=new pg.Client(config);await control.connect();
assert.equal((await control.query('show cluster_name')).rows[0].cluster_name,config.clusterName);
const database='onlyfast_readiness_recursion_'+randomUUID().replaceAll('-','');
await control.query('create database '+database);
const db=new pg.Client({...config,database});await db.connect();
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const correction=await read('supabase/migrations/20261105202924_phase1_fix_sharing_policy_recursion.sql');
const productionPolicies=JSON.parse(await read('tests/fixtures/phase1-production-sharing-policies.json'));
const legacy=['race_setups_select_via_share','race_setups_select_via_unexpired_public_share'];
const a=randomUUID(),b=randomUUID();let existing,oldShare,fresh,base,share;
const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function role(name,uid=''){
 await db.query('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,name]);
 if(name!=='owner')await db.query('set role '+name);
}
async function setup(owner,name,extra={}){
 const row={user_id:owner,setup_name:name,setup_type:'base',race_class:'Dwarf Cars',track_name:name,race_date:'2026-11-05',...extra};
 const keys=Object.keys(row);return (await db.query('insert into public.race_setups('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row))).rows[0];
}
const redeem=async code=>(await db.query('select public.redeem_setup_share($1) result',[code])).rows[0].result;
const createShare=async(setupId,owner,code)=>(await db.query('insert into public.shared_setups(setup_id,shared_by,share_code,is_public) values($1,$2,$3,true) returning *',[setupId,owner,code])).rows[0];
const policies=async()=>(await db.query("select tablename,policyname,permissive,roles::text,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('race_setups','shared_setups') order by tablename,policyname")).rows;
const definitions=async()=>(await db.query("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,p.proacl::text,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','onlyfast_private') and p.prokind='f' order by 1,2,3")).rows;

test('exact production M3 policy recursion and minimal forward correction on native PostgreSQL',async t=>{
 try {
  await db.query("set statement_timeout='10s'");
  for(const [name,extra]of [['anon',''],['authenticated',''],['service_role','bypassrls']]){
   if(!(await control.query('select 1 from pg_roles where rolname=$1',[name])).rowCount)await control.query('create role '+name+' '+extra);
  }
  await db.query(`create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('sub',auth.uid(),'role',current_setting('request.jwt.claim.role',true))$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
  for(const entry of (await stagingSequence()).entries.filter(e=>!e.source.includes('restore_racing_onboarding')&&!e.source.includes('enable_road_racing'))){
   await db.query(entry.sql.toString('utf8').replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi,''));
  }
  for(const [uid,plan]of [[a,'teams'],[b,'free']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[uid,uid+'@example.invalid']);
   await db.query("insert into public.user_subscriptions(user_id,plan,status,active_race_class) values($1,$2,'active','Dwarf Cars')",[uid,plan]);
  }
  existing=await setup(a,'Existing historical setup',{created_at:'2026-01-01',updated_at:'2026-01-02',notes:'Preserve original',custom_fields:{preserved:true}});
  oldShare=await createShare(existing.id,a,'Olde2345');
  for(const file of ['20261105090932_phase1_membership_and_sharing.sql','20261105090937_phase1_setup_and_usage_authorization.sql','20261105091108_phase1_restrict_legacy_access.sql'])await db.query(await read('supabase/migrations/'+file));
  for(const policy of await policies())await db.query('drop policy '+quote(policy.policyname)+' on public.'+quote(policy.tablename));
  for(const policy of productionPolicies){
   assert.ok(['race_setups','shared_setups'].includes(policy.tablename));
   const roles=policy.roles.slice(1,-1).split(',').map(r=>r==='public'?'PUBLIC':quote(r)).join(',');
   await db.query('create policy '+quote(policy.policyname)+' on public.'+quote(policy.tablename)+' as '+policy.permissive+' for '+policy.cmd+' to '+roles+(policy.qual?' using ('+policy.qual+')':'')+(policy.with_check?' with check ('+policy.with_check+')':''));
  }
  const beforePolicies=await policies();assert.deepEqual(beforePolicies,productionPolicies);
  const beforeFunctions=await definitions();
  const beforeTriggers=(await db.query("select tgname,pg_get_triggerdef(oid) definition,tgenabled from pg_trigger where tgrelid='public.race_setups'::regclass and not tgisinternal order by tgname")).rows;
  const originalSetup=(await db.query('select * from public.race_setups where id=$1',[existing.id])).rows[0];
  const originalShare=(await db.query('select * from public.shared_setups where id=$1',[oldShare.id])).rows[0];
  const subscriptions=(await db.query('select * from public.user_subscriptions order by user_id')).rows;

  await t.test('reproduces SQLSTATE 42P17 for an owner share insert with all production policies',async()=>{
   await role('authenticated',a);await assert.rejects(createShare(existing.id,a,'Fail1234'),e=>e.code==='42P17');
  });
  await t.test('either remaining legacy read path still causes recursion, proving both removals necessary',async()=>{
   for(const name of legacy){
    await role('owner');await db.query('begin');await db.query('drop policy '+quote(name)+' on public.race_setups');
    await role('authenticated',a);await assert.rejects(createShare(existing.id,a,'Only1234'),e=>e.code==='42P17');
    await db.query('rollback');
   }
  });
  await t.test('guard rejects changed policy definitions without applying correction',async()=>{
   await role('owner');await db.query('begin');await db.query('alter policy race_setups_select_via_share on public.race_setups using (false)');
   await assert.rejects(db.query(correction),/PHASE1_SHARING_POLICY_PREFLIGHT_REQUIRED/);await db.query('rollback');
   assert.deepEqual(await policies(),beforePolicies);
  });
  await t.test('correction removes exactly two permissive policies and changes no functions or triggers',async()=>{
   await role('owner');await db.query(correction);
   assert.deepEqual(await policies(),beforePolicies.filter(p=>!legacy.includes(p.policyname)));
   assert.deepEqual(await definitions(),beforeFunctions);
   assert.deepEqual((await db.query("select tgname,pg_get_triggerdef(oid) definition,tgenabled from pg_trigger where tgrelid='public.race_setups'::regclass and not tgisinternal order by tgname")).rows,beforeTriggers);
  });
  await t.test('owner base and weekend create, read and update retain owned immutable identities',async()=>{
   await role('authenticated',a);base=await setup(a,'[BASE TEMPLATE] New base',{setup_type:'base_template'});assert.equal(base.race_weekend_id,null);
   fresh=await setup(a,'New race');assert.ok(fresh.race_weekend_id);
   assert.equal((await db.query("update public.race_setups set notes='Owner edit' where id=$1 returning *",[fresh.id])).rows[0].notes,'Owner edit');
   assert.equal((await db.query('select * from public.race_setups where id=$1',[fresh.id])).rowCount,1);
   await assert.rejects(db.query('update public.race_setups set user_id=$1 where id=$2',[b,fresh.id]),e=>e.code==='42501');
  });
  await t.test('owner creates a share and sees both existing and newly created shares without recursion',async()=>{
   await role('authenticated',a);share=await createShare(fresh.id,a,'Valid123');
   const rows=(await db.query('select * from public.shared_setups order by id')).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.shared_by===a));
  });
  await t.test('valid and existing codes redeem, invalid code fails and private fields stay excluded',async()=>{
   await role('anon');for(const code of ['Valid123','Olde2345']){
    const value=await redeem(code);assert.ok(value);
    for(const key of ['id','user_id','shared_by_email','race_weekend_id','race_schedule_id','timing_data','latitude','longitude','created_at'])assert.equal(value[key],undefined);
   }
   assert.equal(await redeem('invalid!'),null);
  });
  await t.test('anonymous listing/direct setup access and usage mutations remain denied',async()=>{
   await role('anon');for(const table of ['shared_setups','race_setups'])await assert.rejects(db.query('select * from public.'+table),e=>e.code==='42501');
   await role('authenticated',a);await assert.rejects(db.query('truncate public.setup_assist_usage'),e=>e.code==='42501');
   assert.equal((await db.query("select has_function_privilege('authenticated','public.onlyfast_reserve_usage(uuid,text,uuid,text,uuid,boolean)','EXECUTE') allowed")).rows[0].allowed,false);
  });
  await t.test('foreign read/update/share insertion and forged share ownership remain denied',async()=>{
   await role('authenticated',b);assert.equal((await db.query('select * from public.race_setups where id=$1',[fresh.id])).rowCount,0);
   assert.equal((await db.query("update public.race_setups set notes='Foreign' where id=$1 returning id",[fresh.id])).rowCount,0);
   assert.equal((await db.query('select * from public.shared_setups')).rowCount,0);
   await assert.rejects(createShare(fresh.id,b,'Forg1234'),e=>e.code==='42501');
   await assert.rejects(createShare(fresh.id,a,'Forg5678'),e=>e.code==='42501');
  });
  await t.test('owner revocation, expiry and disposable share deletion work without recursion',async()=>{
   await role('authenticated',a);await db.query('update public.shared_setups set revoked_at=now() where id=$1',[share.id]);assert.equal(await redeem('Valid123'),null);
   await db.query("update public.shared_setups set revoked_at=null,expires_at=now()-interval '1 second' where id=$1",[share.id]);assert.equal(await redeem('Valid123'),null);
   assert.equal((await db.query('delete from public.shared_setups where id=$1 returning id',[share.id])).rowCount,1);
  });
  await t.test('Rookie base/weekend limits, 48-hour mechanical lock and annotation exception remain intact',async()=>{
   await role('authenticated',b);await setup(b,'[BASE TEMPLATE] Rookie',{setup_type:'base_template'});
   await assert.rejects(setup(b,'[BASE TEMPLATE] Extra',{setup_type:'base_template'}),/ROOKIE_BASE_SETUP_LIMIT/);
   const first=await setup(b,'Rookie one');await setup(b,'Rookie two');await assert.rejects(setup(b,'Rookie third'),/ROOKIE_RACE_WEEKEND_LIMIT/);
   await role('owner');await db.query("update onlyfast_private.setup_weekends set created_at=now()-interval '49 hours' where id=$1",[first.race_weekend_id]);
   await role('authenticated',b);await assert.rejects(db.query("update public.race_setups set notes='Locked edit' where id=$1",[first.id]),/ROOKIE_SETUP_EDIT_LOCKED/);
   assert.equal((await db.query("update public.race_setups set session_label='Allowed annotation' where id=$1 returning id",[first.id])).rowCount,1);
  });
  await t.test('original synthetic customer rows and subscription entitlements remain unchanged',async()=>{
   await role('owner');assert.deepEqual((await db.query('select * from public.race_setups where id=$1',[existing.id])).rows[0],originalSetup);
   assert.deepEqual((await db.query('select * from public.shared_setups where id=$1',[oldShare.id])).rows[0],originalShare);
   assert.deepEqual((await db.query('select * from public.user_subscriptions order by user_id')).rows,subscriptions);
  });
  console.log(JSON.stringify({database,cluster:config.clusterName,server:(await db.query('show server_version')).rows[0].server_version,productionPolicyCount:productionPolicies.length,remainingPolicies:(await policies()).length}));
 }finally{await db.end();await control.end();}
});
