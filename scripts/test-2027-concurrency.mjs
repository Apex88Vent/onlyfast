// Explicit local-only integration test. Creates a NEW disposable database inside
// the named local Docker container. No remote URLs, Supabase keys or user data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { archiveAuthFixture, archiveSchemaSql } from '../tests/helpers/archive2027.mjs';

if (process.env.ONLYFAST_PHASE2_LOCAL_POSTGRES !== '1') throw new Error('Set ONLYFAST_PHASE2_LOCAL_POSTGRES=1 to run local PostgreSQL concurrency tests.');
const container='supabase_db_onlyfast-disposable-staging';
const database='onlyfast_phase2_'+randomUUID().replaceAll('-','');
const uid='abababab-abab-4bab-8bab-abababababab';
let assertions=0;
const run=(args,input='')=>new Promise(resolve=>{
  const child=spawn('docker',['exec','-i',container,...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr=''; child.stdout.on('data',s=>stdout+=s); child.stderr.on('data',s=>stderr+=s);
  child.on('error',e=>resolve({code:-1,stdout,stderr:e.message}));
  child.on('close',code=>resolve({code,stdout:stdout.trim(),stderr:stderr.trim()})); child.stdin.end(input);
});
const sql=(text)=>run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],text);
const success=async(text)=>{const r=await sql(text);assert.equal(r.code,0,r.stderr);return r.stdout;};
const authenticated=`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false);`;
const action=(text)=>sql(`set statement_timeout='15s'; set lock_timeout='10s'; ${authenticated} ${text}`);
const checked=async(text)=>{const r=await action(text);assert.equal(r.code,0,r.stderr);return r.stdout.split('\n').at(-1);};
const insert=(name,base=false)=>`insert into public.race_setups(user_id,setup_name,setup_type,race_class,notes) values('${uid}','${name}','${base?'base_template':'base'}','Dwarf Cars','concurrency history') returning id;`;
const tier=t=>`select public.set_onlyfast_test_tier('${t}');`;
const archive=(id,value)=>`select public.set_onlyfast_setup_archive('${id}',${value});`;
async function concurrentAfterLeader(leaderSql,contenders){
  const label='phase2_leader_'+randomUUID();
  const leader=action(`set application_name='${label}'; begin; ${leaderSql} select pg_sleep(1); commit;`);
  // Observe the transaction after its mutation and while it still owns its lock.
  const deadline=Date.now()+10000; let sleeping=false;
  while(Date.now()<deadline){
    sleeping=(await success(`select exists(select 1 from pg_stat_activity where application_name='${label}' and wait_event='PgSleep');`))==='t';
    if(sleeping)break;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert(sleeping,'leader must hold the transaction lock before contenders start');
  const results=await Promise.all(contenders.map(text=>action(text)));
  const lead=await leader; assert.equal(lead.code,0,lead.stderr);
  return results;
}
const created=await run(['createdb','-U','postgres',database]); assert.equal(created.code,0,created.stderr);
console.log('Local disposable database: '+database);
try {
  await success(archiveAuthFixture+'\n'+await archiveSchemaSql({trackTrace:true}));
  await success(`insert into auth.users(id) values('${uid}');
    insert into public.user_subscriptions(user_id,plan,status,active_race_class) values('${uid}','free','active','Dwarf Cars');
    insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind,test_subscription_tier) values('${uid}',true,true,'experimental','sportsman');
    insert into public.user_feature_flags(user_id,feature_key,enabled) values('${uid}','test_account_full_access',true);`);
  const weekends=[]; for(let i=0;i<5;i++)weekends.push(await checked(insert('Concurrent weekend '+i)));
  const results=await concurrentAfterLeader(archive(weekends[0],true),Array.from({length:5},(_,i)=>insert('Competing weekend '+i)));
  assert.equal(results.filter(r=>r.code===0).length,1,'one freed weekend slot admits exactly one competing create');
  assert(results.filter(r=>r.code!==0).every(r=>r.stderr.includes('SPORTSMAN_RACE_WEEKEND_LIMIT'))); assertions++;
  const counts=JSON.parse(await checked('select public.get_onlyfast_2027_account_access();')).counts;
  assert.equal(counts.regular,5); assertions++;
  const beforeEvents=Number(await success('select count(*) from onlyfast_private.setup_archive_events;'));
  const repeats=await Promise.all(Array.from({length:8},()=>action(archive(weekends[0],true))));
  assert(repeats.every(r=>r.code===0&&r.stdout.includes('"changed": false')));
  assert.equal(Number(await success('select count(*) from onlyfast_private.setup_archive_events;')),beforeEvents); assertions++;
  const bases=[await checked(insert('Concurrent base 0',true)),await checked(insert('Concurrent base 1',true))];
  const baseCreates=await concurrentAfterLeader(archive(bases[0],true),Array.from({length:5},(_,i)=>insert('Competing base '+i,true)));
  assert.equal(baseCreates.filter(r=>r.code===0).length,1);
  assert(baseCreates.filter(r=>r.code!==0).every(r=>r.stderr.includes('SPORTSMAN_BASE_SETUP_LIMIT'))); assertions++;
  await checked(tier('pro'));
  const restoreResults=await Promise.all(Array.from({length:8},()=>action(archive(weekends[0],false))));
  assert(restoreResults.every(r=>r.code===0));
  assert.equal(restoreResults.filter(r=>r.stdout.includes('"changed": true')).length,1); assertions++;
  await checked(tier('factory'));
  const downgradeRestore=await concurrentAfterLeader(tier('sportsman'),[archive(bases[0],false)]);
  assert(downgradeRestore[0].code!==0&&downgradeRestore[0].stderr.includes('RESTORE_REQUIRES')); assertions++;
  await checked("select public.choose_onlyfast_2027_class('Dwarf Cars');");
  const afterDowngrade=JSON.parse(await checked(`select public.get_onlyfast_2027_setup_edit_state('${weekends[0]}');`));
  assert.equal(afterDowngrade.reason,'over_quota'); assertions++;
  const unsubscribed=await concurrentAfterLeader(tier('unsubscribed'),[insert('Must reject after subscription loss',true)]);
  assert(unsubscribed[0].code!==0&&/READ_ONLY|VEHICLE_LOCKED/.test(unsubscribed[0].stderr)); assertions++;
  assert.equal(await success("select count(*) from public.race_setups where notes<>'concurrency history';"),'0'); assertions++;
  await checked(tier('factory'));
  const timing=await checked(`insert into public.onlylaps_timing_sessions(user_id,name) values('${uid}','Retained independent history') returning id;`);
  const telemetryInsert=await concurrentAfterLeader(tier('sportsman'),[
    `insert into public.onlylaps_timing_sessions(user_id,name) values('${uid}','Recording after downgrade');`,
    `insert into public.onlylaps_telemetry_samples(user_id,timing_session_id,recorded_at) values('${uid}','${timing}',now());`,
  ]);
  assert(telemetryInsert.every(r=>r.code!==0&&/PRO_REQUIRED|row-level security/.test(r.stderr)),'waiting inserts must recheck tier'); assertions++;
  assert.equal(JSON.parse(await checked(`select public.get_track_trace_session('${timing}');`)).session.name,'Retained independent history'); assertions++;
  await checked(tier('factory'));
  const telemetryEdit=await concurrentAfterLeader(tier('unsubscribed'),[
    `update public.onlylaps_timing_sessions set name='forged' where id='${timing}';`,
  ]);
  assert(telemetryEdit.every(r=>r.code!==0&&/READ_ONLY|PRO_REQUIRED/.test(r.stderr)),'waiting edits must recheck subscription loss'); assertions++;
  assert.equal(await success(`select name from public.onlylaps_timing_sessions where id='${timing}';`),'Retained independent history'); assertions++;
  console.log('PASS: '+assertions+' concurrency assertions; weekend/base quota races, idempotency, tier changes, data retention.');
} finally {
  // Retain this synthetic database as evidence; never touch an existing database.
  console.log('Retained local evidence database: '+database);
}
