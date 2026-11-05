import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { qaConfig, configuredEnvironment, safeError } from '../qa/automation/config.mjs';
import { QAFixtures, fixtureCatalog } from '../qa/automation/fixtures.mjs';
import { QAAuthentication } from '../qa/automation/auth.mjs';
import { qaHarness as baseHarness, qaUser } from './qaAutomationHarness.mjs';
import * as provenance from '../supabase/functions/_shared/qa-fixtures.ts';
import { hasBetaFeatureForUser } from '../supabase/functions/_shared/beta-features.ts';

function qaHarness(mode='local') {
  const h=baseHarness(mode);
  h.state.edgeInvoke=async(_name,options)=>{
    const response=await resetHandler(h)(options.body);
    return {data:await response.json(),error:response.ok?null:{code:'fixture_endpoint_refused'}};
  };
  return h;
}

test('QA environment classification rejects production masquerading as staging/local and private credentials',()=>{
  const h=qaHarness();assert.equal(qaConfig(h.env,'local').userId,qaUser);
  for(const key of ['sb_secret_private','a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.b'])assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_PUBLIC_KEY:key},'local'),/PUBLIC_KEY/);
  const prod='https://thpyjvwtfvfxiufchrxn.supabase.co';
  assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_URL:prod},'local'),/LOCAL_ORIGIN/);
  assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_URL:prod,ONLYFAST_QA_STAGING_REF:provenance.QA_PRODUCTION_REF},'staging'),/STAGING_PROJECT/);
  assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_URL:prod,ONLYFAST_QA_PRODUCTION_READS_APPROVED:'false'},'production'),/APPROVAL/);
  assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_URL:prod},'production'),/IDENTITY/);
  for(const url of ['https://a:b@example.com','https://example.com?key=x','http://remote.example:54321'])assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_URL:url},'local'));
  assert.throws(()=>qaConfig({...h.env,ONLYFAST_QA_PASSWORD:''},'local'),/AUTH_CONFIGURATION/);
});
test('QA secret files are external and cannot carry production mutation approvals',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'onlyfast-qa-secret-test-'));
  try {
    const file=path.join(dir,'private.env');await writeFile(file,'ONLYFAST_QA_PASSWORD=synthetic\nONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED=true\n');
    const values=await configuredEnvironment({ONLYFAST_QA_SECRET_FILE:file});
    assert.equal(values.ONLYFAST_QA_PASSWORD,'synthetic');assert.equal(values.ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED,undefined);
    await assert.rejects(configuredEnvironment({ONLYFAST_QA_SECRET_FILE:path.resolve('package.json')}),/OUTSIDE_REPOSITORY/);
  } finally { assert.ok(dir.startsWith(path.join(os.tmpdir(),'onlyfast-qa-secret-test-'))); await rm(dir,{recursive:true,force:true}); }
});
test('normal QA login verifies the dedicated identity and local logout disposes only this session',async()=>{
  const h=qaHarness();await h.auth.login();assert.equal(h.auth.verified,true);assert.ok(h.state.authReads);
  h.auth.storage.set('temporary','not-a-real-token');await h.auth.dispose();
  assert.deepEqual(h.state.logouts,[{scope:'local'}]);assert.equal(h.auth.storage.size,0);
  await assert.rejects(h.auth.verify(),/DISPOSED/);
});
test('incorrect credentials, wrong Auth identity, wrong email and revoked tester designation fail closed',async()=>{
  const wrong=qaHarness();const auth=new QAAuthentication({...wrong.config,password:'incorrect'},wrong.factory);
  await assert.rejects(auth.login(),/LOGIN_FAILED/);assert.equal(safeError(new Error('secret payload')),'QA_OPERATION_FAILED');
  for(const mutate of [h=>{h.state.user.id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';},h=>{h.state.user.email='customer@example.invalid';},h=>{h.state.tables.get('beta_tester_accounts')[0].beta_features_enabled=false;}]) {
    const h=qaHarness();mutate(h);await assert.rejects(h.auth.login());assert.equal(h.state.writes.length,0);
  }
});
test('expired QA sessions refresh through normal Auth; failed refresh requires reauthentication',async()=>{
  const h=qaHarness();await h.auth.login();h.state.expires=0;await h.auth.verify();assert.equal(h.state.refreshes,1);
  h.state.expires=0;h.state.refreshFails=true;await assert.rejects(h.auth.verify(),/REAUTHENTICATION/);
});
test('account switching is caught before fixture writes and production writes require the runtime flag',async()=>{
  const h=qaHarness();await h.auth.login();const fixtures=new QAFixtures(h.auth);
  h.state.user={...h.state.user,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
  await assert.rejects(fixtures.createDisposable(),/IDENTITY_MISMATCH/);assert.equal(h.state.writes.length,0);
  const p=qaHarness('production');await p.auth.login();await assert.rejects(new QAFixtures(p.auth).createDisposable(),/MUTATIONS_NOT_APPROVED/);
});
test('persistent catalog has stable environment/owner IDs, all disciplines, timing, schedules and sharing',async()=>{
  const h=qaHarness();const a=await fixtureCatalog(h.config,'2026-11-05'),b=await fixtureCatalog(h.config,'2026-11-05');
  assert.equal(a.length,24);assert.deepEqual(a.map(r=>r.id),b.map(r=>r.id));
  assert.equal(new Set(a.map(r=>r.id)).size,a.length);
  assert.deepEqual([...new Set(a.filter(r=>r.table==='race_setups').map(r=>r.row.race_class))],['Dwarf Cars','Legends','GT3','Shifter Kart','Clutch Kart']);
  assert.equal(a.filter(r=>r.row.timing_data).length,5);
  assert.ok(a.find(r=>r.key==='setup:road:main').row.custom_fields.onlyfast_setup_library_v1);
  assert.notEqual(await provenance.qaFixtureId('other',qaUser,a[0].key),a[0].id);
  await assert.rejects(fixtureCatalog(h.config,'2026-02-31'));
});
test('idempotent seeding and ordinary Auth cycles preserve permanent and preexisting QA records',async()=>{
  const h=qaHarness();await h.auth.login();const catalog=await fixtureCatalog(h.config,'2026-11-05'),fixtures=new QAFixtures(h.auth);
  const legacy={id:crypto.randomUUID(),user_id:qaUser,setup_name:'Existing QA setup',custom_fields:{private:'keep'}};
  h.state.tables.set('race_setups',[legacy]);
  assert.equal((await fixtures.seed(catalog)).inserted,24);
  const before=structuredClone([...h.state.tables]);assert.equal((await fixtures.seed(catalog)).inserted,0);
  await fixtures.cleanup();await h.auth.dispose();await new QAAuthentication(h.config,h.factory).login();
  assert.deepEqual([...h.state.tables],before);assert.deepEqual(h.state.tables.get('race_setups')[0],legacy);
});
test('fixture collisions, forged ownership and arbitrary reset IDs are refused without mutation',async()=>{
  const h=qaHarness();await h.auth.login();const fixtures=new QAFixtures(h.auth),catalog=await fixtureCatalog(h.config,'2026-11-05');
  h.state.tables.set('race_schedule',[{...catalog[0].row,organization:'Existing real record'}]);
  await assert.rejects(fixtures.seed(catalog),/FIXTURE_CONFLICT/);assert.equal(h.state.writes.length,0);
  await assert.rejects(provenance.validateQARecords([{...catalog[0],id:crypto.randomUUID()}],h.config.ref,qaUser),/RECORD_INVALID/);
  await assert.rejects(fixtures.seed([{...catalog[1],row:{...catalog[1].row,user_id:'foreign'}}]),/FIXTURE_CONFLICT/);
});
test('catalog seeding never grants tiers and refuses old fixture identities requiring reconciliation',async()=>{
  const h=qaHarness();await h.auth.login();const f=new QAFixtures(h.auth),catalog=await fixtureCatalog(h.config);
  h.state.tier='rookie';await assert.rejects(f.seed(catalog),/EXISTING_ACCESS/);assert.equal(h.state.writes.length,0);
  h.state.tier='team';h.state.tables.set('race_setups',[{id:crypto.randomUUID(),user_id:qaUser,setup_name:'Legacy QA fixture',custom_fields:{[provenance.QA_MARKER]:{catalog:provenance.QA_CATALOG,key:'setup:dirt:heat'}}}]);
  await assert.rejects(f.seed(catalog),/RECONCILIATION/);assert.equal(h.state.writes.length,0);
});
test('disposable cleanup uses only current-run receipts and leaves persistent/historical fixtures',async()=>{
  const h=qaHarness();await h.auth.login();const f=new QAFixtures(h.auth),catalog=await fixtureCatalog(h.config,'2026-11-05');await f.seed(catalog);
  const record=await f.createDisposable();await f.updateDisposable(record,{notes:'edited'});
  await assert.rejects(f.updateDisposable({...record},{notes:'forged receipt'}),/ALLOWLIST/);
  await f.cleanup();assert.equal(f.created.size,0);assert.equal(h.state.tables.get('race_setups').length,20);
  const deletion=h.state.writes.find(r=>r.action==='delete');assert.deepEqual(deletion.filters,[['id',record.id],['user_id',qaUser]]);
});
test('lost insert response is recoverable; ownership or marker changes retain the record',async()=>{
  const h=qaHarness();await h.auth.login();const f=new QAFixtures(h.auth);h.state.loseInsertResponse=true;
  await assert.rejects(f.createDisposable(),/INSERT_FAILED/);assert.equal(f.created.size,1);await f.cleanup();assert.equal(f.created.size,0);
  const record=await f.createDisposable();h.state.tables.get('race_setups')[0].custom_fields[provenance.QA_MARKER].persistent=true;
  await assert.rejects(f.cleanup(),/CLEANUP_INCOMPLETE/);assert.ok(f.created.has(record.id));
});
test('cleanup refuses linked records and reset requires its own explicit approval',async()=>{
  const h=qaHarness();await h.auth.login();const f=new QAFixtures(h.auth),record=await f.createDisposable();
  h.state.tables.set('onlyfast_onlylaps_session_links',[{id:crypto.randomUUID(),user_id:qaUser,onlyfast_session_id:record.id}]);
  await assert.rejects(f.cleanup(),/CLEANUP_INCOMPLETE/);assert.equal(h.state.writes.filter(r=>r.action==='delete').length,0);
  await assert.rejects(f.reset(await fixtureCatalog(h.config),provenance.QA_RESET_CONFIRMATION),/RESET_APPROVAL/);
});
test('actual application reset facade makes all legacy no-argument Auth calls inert',async()=>{
  const source=readFileSync(new URL('../src/lib/testAccount.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let requests=0;
  const exports={};new Function('require','exports',code)(name=>name==='@/lib/supabase'?{supabase:{auth:{getSession:async()=>{requests++;return {data:{session:null}};}}}}:{BETA_FEATURES:{testAccountReset:'reset'},hasCachedExperimentalBetaFeature:()=>true},exports);
  const api=exports as {resetTestAccountData(request?:unknown):Promise<boolean>};
  assert.equal(await api.resetTestAccountData(),false);assert.equal(await api.resetTestAccountData({action:'login'}),false);assert.equal(requests,0);
});

function resetHandler(h: ReturnType<typeof baseHarness>, extra:Record<string,string>={}) {
  let handler:(request:Request)=>Promise<Response>;
  const source=readFileSync(new URL('../supabase/functions/reset-test-account/index.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const env={TEST_ACCOUNT_RESET_ENABLED:'true',SUPABASE_URL:h.config.url,SUPABASE_ANON_KEY:h.config.publicKey,SUPABASE_SERVICE_ROLE_KEY:'service-fixture',ONLYFAST_QA_USER_ID:h.config.userId,...extra};
  const modules={'https://esm.sh/@supabase/supabase-js@2':{createClient:h.factory},'../_shared/beta-features.ts':{hasBetaFeatureForUser},'../_shared/qa-fixtures.ts':provenance};
  new Function('require','exports','Deno',code)(name=>modules[name],{},{env:{get:name=>env[name]},serve:fn=>{handler=fn;}});
  return (body:unknown,method='POST')=>handler(new Request('https://qa.invalid',{method,headers:{Authorization:'Bearer synthetic'},body:method==='POST'?JSON.stringify(body):undefined}));
}
test('prepared reset handler rejects legacy calls, foreign IDs, missing flags and disabled server',async()=>{
  const h=qaHarness();await h.auth.login();
  assert.equal((await resetHandler(h)({})).status,400);
  assert.equal((await resetHandler(h,{TEST_ACCOUNT_RESET_ENABLED:'false'})({})).status,403);
  assert.equal((await resetHandler(h)({},'GET')).status,405);
  const bad={action:'reset_qa_fixtures',confirmation:provenance.QA_RESET_CONFIRMATION,records:[{table:'race_setups',id:crypto.randomUUID(),key:'setup:dirt:hotlaps'}]};
  assert.equal((await resetHandler(h)(bad)).status,400);
  h.state.tables.get('user_feature_flags')[0].enabled=false;
  assert.equal((await resetHandler(h)(bad)).status,403);assert.equal(h.state.writes.length,0);
});
test('prepared reset deletes only the explicit marked catalog and never subscription/Auth state',async()=>{
  const h=qaHarness();await h.auth.login();const catalog=await fixtureCatalog(h.config,'2026-11-05');await new QAFixtures(h.auth).seed(catalog);
  h.state.tables.set('user_subscriptions',[{id:crypto.randomUUID(),user_id:qaUser,plan:'pro',status:'active'}]);
  const legacy={id:crypto.randomUUID(),user_id:qaUser,setup_name:'Historical QA record'};h.state.tables.get('race_setups').push(legacy);
  const response=await resetHandler(h)({action:'reset_qa_fixtures',confirmation:provenance.QA_RESET_CONFIRMATION,records:catalog.map(({table,id,key})=>({table,id,key}))});
  assert.equal(response.status,200);assert.equal((await response.json()).deleted,24);
  assert.deepEqual(h.state.tables.get('race_setups'),[legacy]);assert.equal(h.state.tables.get('user_subscriptions')[0].plan,'pro');assert.equal(h.state.user.email,'test@test.com');
});
test('prepared reset blocks cascading changes to other records even when RLS would hide them',async()=>{
  const h=qaHarness();await h.auth.login();const catalog=await fixtureCatalog(h.config,'2026-11-05');await new QAFixtures(h.auth).seed(catalog);
  const target=catalog.find(r=>r.key==='setup:dirt:hotlaps');
  h.state.tables.get('shared_setups').push({id:crypto.randomUUID(),shared_by:'foreign',setup_id:target.id});
  const before=h.state.writes.length;
  const response=await resetHandler(h)({action:'reset_qa_fixtures',confirmation:provenance.QA_RESET_CONFIRMATION,records:catalog.map(({table,id,key})=>({table,id,key}))});
  assert.equal(response.status,400);assert.equal(h.state.writes.length,before);
});
test('reset allowlists distinguish tables even when record UUIDs coincide across tables',async()=>{
  const h=qaHarness();await h.auth.login();const catalog=await fixtureCatalog(h.config,'2026-11-05');await new QAFixtures(h.auth).seed(catalog);
  const schedule=catalog.find(r=>r.key==='schedule:current'),share=catalog.find(r=>r.key==='share:valid');
  h.state.tables.get('race_setups').push({id:share.id,user_id:qaUser,race_schedule_id:schedule.id,setup_name:'Unrelated historical row'});
  const before=h.state.writes.length;
  const response=await resetHandler(h)({action:'reset_qa_fixtures',confirmation:provenance.QA_RESET_CONFIRMATION,records:catalog.map(({table,id,key})=>({table,id,key}))});
  assert.equal(response.status,400);assert.equal(h.state.writes.length,before);
});

test('disposable mutations require the prepared auditor, and cleanup detects RLS-hidden dependencies',async()=>{
  const h=qaHarness();await h.auth.login();const fixtures=new QAFixtures(h.auth);
  const endpoint=h.state.edgeInvoke;h.state.edgeInvoke=undefined;
  await assert.rejects(fixtures.createDisposable(),/SAFE_CLEANUP_NOT_CONFIGURED/);
  assert.equal(h.state.writes.length,0);
  h.state.edgeInvoke=endpoint;const receipt=await fixtures.createDisposable();
  h.state.tables.set('shared_setups',[{id:crypto.randomUUID(),shared_by:'foreign',setup_id:receipt.id}]);
  const before=h.state.writes.length;
  await assert.rejects(fixtures.cleanup(),/CLEANUP_INCOMPLETE/);
  assert.equal(h.state.writes.length,before);assert.equal(fixtures.created.size,1);
  h.state.tables.set('shared_setups',[]);await fixtures.cleanup();assert.equal(fixtures.created.size,0);
});
