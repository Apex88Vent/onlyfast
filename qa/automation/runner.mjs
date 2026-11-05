// Node-only operator entry. Never imported by src or shipped as a public route.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { QA_EMAIL, QA_PRODUCTION_REF, QA_PRODUCTION_USER, QA_RESET_CONFIRMATION, QA_MARKER } from '../../supabase/functions/_shared/qa-fixtures.ts';
import { configuredEnvironment, qaConfig, QAError, safeError } from './config.mjs';
import { QAAuthentication } from './auth.mjs';
import { QAFixtures, fixtureCatalog } from './fixtures.mjs';
import { smokeTests, mountedTests, databaseTests } from './coverage.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
export async function runNodeTests(files, output, label, env=process.env) {
  const clean={...env};
  for(const key of Object.keys(clean))if(/^(ONLYFAST_QA_|SUPABASE_|DATABASE_URL|PGPASSWORD|OPENAI_API_KEY|STRIPE_|VERCEL_TOKEN|NODE_OPTIONS)/.test(key))delete clean[key];
  clean.REACT_TEST_RENDERER_MODULE=require.resolve('react-test-renderer');
  clean.PGLITE_MODULE=fileURLToPath(import.meta.resolve('@electric-sql/pglite'));
  const child=spawnSync(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap',...files],
    {cwd:root,env:clean,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
  const text=(child.stdout||'')+'\n'+(child.stderr||'');
  await writeFile(path.join(output,label+'.tap'),text,{mode:0o600});
  const count=key=>Number(text.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]||0);
  return {name:label,passed:count('pass'),failed:count('fail') || (child.status!==0?1:0),skipped:count('skipped'),total:count('tests'),exitCode:child.status??1};
}
async function smoke(auth, report, mutate) {
  const check=async(name,callback)=>{
    await auth.verify();
    try { await callback(); report.checks.push({name,status:'passed'}); }
    catch(error) { report.checks.push({name,status:'failed',code:safeError(error)}); throw error; }
  };
  let rows=[];
  await check('normal Auth and verified dedicated tester',async()=>{});
  await check('own setup read and historical fixture preservation',async()=>{
    const r=await auth.client.from('race_setups').select('id,user_id,setup_type,race_class,created_at').eq('user_id',auth.config.userId).limit(1000);
    if(r.error || !Array.isArray(r.data) || r.data.some(row=>row.user_id!==auth.config.userId))throw new QAError('QA_OWNER_READ_FAILED');
    rows=r.data; report.inventory={ownedSetups:rows.length,olderThan48Hours:rows.filter(r=>Date.parse(r.created_at)<=Date.now()-172800000).length};
  });
  await check('authoritative membership',async()=>{
    const r=await auth.client.rpc('get_onlyfast_membership');
    if(r.error || !['rookie','pro','team','admin'].includes(r.data?.tier))throw new QAError('QA_MEMBERSHIP_READ_FAILED');
    report.inventory.effectiveTier=r.data.tier;
  });
  await check('schedule and sharing owner isolation',async()=>{
    for(const [table,owner] of [['race_schedule','user_id'],['shared_setups','shared_by']]) {
      const r=await auth.client.from(table).select('id,'+owner).eq(owner,auth.config.userId).limit(1000);
      if(r.error || r.data.some(row=>row[owner]!==auth.config.userId))throw new QAError('QA_OWNER_READ_FAILED');
      report.inventory[table]=r.data.length;
    }
  });
  await check('invalid secure sharing code',async()=>{
    const r=await auth.client.rpc('redeem_setup_share',{p_code:'invalid!'});
    if(r.error || r.data!==null)throw new QAError('QA_REDEMPTION_UNAVAILABLE_OR_INVALID');
  });
  if(auth.config.edgeReadsApproved && rows.length) {
    await check('OnlyLaps status-only request, no provider',async()=>{
      const r=await auth.client.functions.invoke('get-onlylaps-setup-context',{body:{onlyfast_session_id:rows[0].id,status_only:true}});
      if(r.error)throw new QAError('QA_ONLYLAPS_STATUS_FAILED');
    });
  } else report.checks.push({name:'OnlyLaps live status-only request',status:'skipped',reason:'Requires explicit edge-read approval and an owned session'});
  await check('normal token refresh retains identity',async()=>{await auth.refresh();});
  if(mutate) {
    const fixtures=new QAFixtures(auth);
    try {
      const record=await fixtures.createDisposable();
      const original=await fixtures.find(record);
      await fixtures.updateDisposable(record,{notes:'OnlyFast QA disposable edit'});
      const reopened=await fixtures.find(record);
      if(!original || reopened?.notes!=='OnlyFast QA disposable edit' || reopened.custom_fields?.[QA_MARKER]?.persistent!==false)throw new QAError('QA_DISPOSABLE_READBACK_FAILED');
      report.checks.push({name:'disposable create/edit/reopen',status:'passed'});
    } finally {
      try { await fixtures.cleanup(); report.cleanup={status:'complete',remaining:0}; }
      catch(error) { report.cleanup={status:'failed',remaining:fixtures.created.size}; throw error; }
    }
  } else report.cleanup={status:'not_needed_read_only'};
  report.limitations.push('HTTP/Auth/owner checks are not browser, Median device, live ad, purchase, AI/OCR-provider or full release acceptance.');
}

export async function main(args=process.argv.slice(2), runtime=process.env) {
  const [command='smoke',subcommand]=args;
  const option=name=>{const at=args.indexOf(name);return at>=0?args[at+1]:undefined;};
  const mode=option('--env')||'local';
  const directory=path.join(root,'tmp','qa-automation',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
  await mkdir(directory,{recursive:true,mode:0o700});
  const report={startedAt:new Date().toISOString(),localDateTime:new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',dateStyle:'full',timeStyle:'long'}).format(new Date()),
    environment:mode,account:QA_EMAIL,suite:command,checks:[],suites:[],authentication:{status:'not_attempted'},cleanup:{status:'not_needed'},limitations:[]};
  let auth;
  try {
    if(!['local','staging','production'].includes(mode))throw new QAError('QA_ENVIRONMENT_REQUIRED');
    if(['regression','database'].includes(command) && mode!=='local')throw new QAError('QA_REGRESSION_IS_LOCAL_ONLY');
    if(command==='regression' || command==='database' || (command==='smoke' && mode==='local')) {
      const groups=command==='database'?[['database',databaseTests]]:command==='smoke'?[['smoke',smokeTests]]:
        [['unit',(await readdir(path.join(root,'tests'))).filter(f=>f.endsWith('.test.ts')).map(f=>'tests/'+f)],['mounted',mountedTests],['database',databaseTests]];
      for(const [label,files] of groups)report.suites.push(await runNodeTests(files,directory,label,runtime));
      report.authentication.status='mocked_or_isolated_database';
      report.cleanup.status='disposable_local_engines_closed_by_existing_suites';
      report.limitations.push('No real authentication, provider, device, purchase or ad validation is claimed. The historical iOS billing assertion remains an actual failure if encountered.');
    } else {
      const env=await configuredEnvironment(runtime);
      if(command==='fixtures' && subcommand==='plan') {
        const plan={mode,ref:mode==='production'?QA_PRODUCTION_REF:mode==='local'?'local':env.ONLYFAST_QA_STAGING_REF,
          userId:mode==='production'?QA_PRODUCTION_USER:env.ONLYFAST_QA_USER_ID||'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
        if(!plan.ref || (mode==='staging'&&plan.ref===QA_PRODUCTION_REF))throw new QAError('QA_STAGING_PROJECT_REQUIRED');
        const catalog=await fixtureCatalog(plan,env.ONLYFAST_QA_FIXTURE_DATE);
        await writeFile(path.join(directory,'fixture-plan.json'),JSON.stringify(catalog,null,2),{mode:0o600});
        report.checks.push({name:'offline fixture plan; no records written',status:'passed',records:catalog.length});
        report.limitations.push('An offline plan proves no account identity or existing permissions; seed/reset require normal verified Auth.');
      } else {
        const config=qaConfig(env,mode);
        report.projectRef=config.ref;
        if(command==='check') report.checks.push({name:'configuration validation only',status:'passed'});
        else {
          if(!['smoke','fixtures'].includes(command) || (command==='fixtures'&&!['seed','reset'].includes(subcommand)))throw new QAError('QA_COMMAND_INVALID');
          auth=new QAAuthentication(config);await auth.login();report.authentication.status='authenticated_and_verified';
          if(command==='smoke')await smoke(auth,report,args.includes('--mutations'));
          else {
            const fixtures=new QAFixtures(auth),catalog=await fixtureCatalog(config,env.ONLYFAST_QA_FIXTURE_DATE);
            const result=subcommand==='seed'?await fixtures.seed(catalog):await fixtures.reset(catalog,option('--confirm'));
            report.checks.push({name:'explicit fixture '+subcommand,status:'passed',...result});
            report.cleanup={status:'persistent_fixtures_preserved_except_explicit_reset'};
          }
        }
      }
    }
  } catch(error) { report.checks.push({name:'run',status:'failed',code:safeError(error)}); }
  finally {
    if(auth)try { await auth.dispose();report.authentication.logout='local_session_disposed'; }
    catch { report.authentication.logout='failed_revocation_not_confirmed';report.checks.push({name:'local-session logout',status:'failed',code:'QA_LOGOUT_FAILED'}); }
  }
  report.finishedAt=new Date().toISOString();
  report.tests={passed:report.suites.reduce((n,s)=>n+s.passed,0)+report.checks.filter(c=>c.status==='passed').length,
    failed:report.suites.reduce((n,s)=>n+s.failed,0)+report.checks.filter(c=>c.status==='failed').length,
    skipped:report.suites.reduce((n,s)=>n+s.skipped,0)+report.checks.filter(c=>c.status==='skipped').length};
  report.status=report.tests.failed?'failed':'passed';
  const destination=path.join(directory,'report.json');
  await writeFile(destination,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:report.status,tests:report.tests,report:destination}));
  return report.tests.failed?1:0;
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
