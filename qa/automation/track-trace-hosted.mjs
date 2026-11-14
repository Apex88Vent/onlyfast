// Explicitly testing-only. No service key, provider calls or production fallback.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ref='mfzajhnfonrfuiwxgvhe', url='https://'+ref+'.supabase.co';
const key=process.env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY;
assert(/^sb_publishable_/.test(key || ''),'Testing publishable key required');
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));
assert.equal(credentials.projectRef,ref);
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const marker=await client().rpc('get_onlyfast_2027_environment');
assert.equal(marker.data?.project_ref,ref);
const rpc=async(c,name,args={})=>{const r=await c.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
const accounts=[];const checks=[];let setupId,sid,weekendId;
const phase2bSetups=[],phase2bSessions=[],phase2bWeekendIds=[],standaloneSessions=[];let mapId,mapCleanupPending=false;
const output='tmp/track-trace-refinements/hosted';await mkdir(output,{recursive:true});
try {
  for(const account of credentials.accounts) {
    const c=client();const login=await c.auth.signInWithPassword({email:account.email,password:account.password});
    assert(!login.error,'Synthetic testing login failed');
    const tier=await rpc(c,'get_onlyfast_test_tier');
    accounts.push({client:c,account,session:login.data.session,originalTier:tier});
    if(['sportsman','pro','factory'].includes(account.tier))await rpc(c,'set_onlyfast_test_tier',{p_tier:account.tier});
    const permission=await rpc(c,'get_track_trace_permission');
    assert.equal(permission.can_record??permission.allowed,['pro','factory'].includes(account.tier));
    checks.push({check:'permission',tier:account.tier,allowed:permission.allowed,canRecord:permission.can_record??permission.allowed});
  }
  const pro=accounts.find(a=>a.account.tier==='pro'), factory=accounts.find(a=>a.account.tier==='factory'), sports=accounts.find(a=>a.account.tier==='sportsman');
  const p=await rpc(pro.client,'get_track_trace_permission'), f=await rpc(factory.client,'get_track_trace_permission');
  assert.deepEqual({...p,tier:null},{...f,tier:null});
  const setup=await pro.client.from('race_setups').insert({user_id:pro.account.id,setup_name:'Track Trace QA '+randomUUID(),setup_type:'heat',race_class:'Dwarf Cars',notes:'Disposable Track Trace verification'}).select('id,race_weekend_id').single();
  assert(!setup.error,setup.error?.message);setupId=setup.data.id;weekendId=setup.data.race_weekend_id;
  sid=await rpc(pro.client,'create_track_trace_session',{p_setup_id:setupId,p_name:'Track Trace verification'});
  const lap=await pro.client.from('onlylaps_lap_times').insert({user_id:pro.account.id,timing_session_id:sid,lap_number:1,duration_ms:12345});assert(!lap.error,lap.error?.message);
  const sample=await pro.client.from('onlylaps_telemetry_samples').insert({user_id:pro.account.id,timing_session_id:sid,recorded_at:new Date().toISOString(),latitude:35,longitude:-118});assert(!sample.error,sample.error?.message);
  assert.equal((await rpc(pro.client,'get_track_trace_session',{p_session_id:sid})).laps[0].duration_ms,12345);
  assert.equal((await rpc(pro.client,'get_track_trace_setup_context',{p_setup_id:setupId})).context.session.id,sid);
  const edge=await pro.client.functions.invoke('track-trace-setup-context',{body:{onlyfast_session_id:setupId,status_only:true}});
  assert(!edge.error,edge.error?.message);assert.equal(edge.data.linked,true);assert.equal(edge.data.usable_measured_facts,true);
  checks.push({check:'durable session/lap/GPS and reused Setup Assist contract',passed:true});
  for(const c of [factory.client,sports.client]) {
    const denied=await c.rpc('get_track_trace_session',{p_session_id:sid});assert(denied.error);
    const rows=await c.from('onlylaps_telemetry_samples').select('id').eq('timing_session_id',sid);assert(!rows.error);assert.equal(rows.data.length,0);
    const context=await c.functions.invoke('track-trace-setup-context',{body:{onlyfast_session_id:setupId,status_only:true}});assert(context.error);
  }
  await rpc(pro.client,'set_onlyfast_test_tier',{p_tier:'sportsman'});
  const historyAccess=(await rpc(pro.client,'get_track_trace_permission')).can_read_history===true;
  const history=await pro.client.rpc('get_track_trace_session',{p_session_id:sid});assert.equal(!history.error,historyAccess);
  assert.equal((await pro.client.from('onlylaps_timing_sessions').select('id').eq('id',sid)).data.length,historyAccess?1:0);
  assert((await pro.client.rpc('create_track_trace_session',{p_setup_id:null,p_name:'Downgraded write denied'})).error);
  await rpc(pro.client,'set_onlyfast_test_tier',{p_tier:'pro'});
  assert.equal((await rpc(pro.client,'get_track_trace_session',{p_session_id:sid})).laps.length,1);
  checks.push({check:'foreign owner / Sportsman / downgrade write restrictions and preserved historical read contract',passed:true});
  const map=await pro.client.from('onlylaps_track_maps').insert({user_id:pro.account.id,name:'Phase2B QA '+randomUUID(),track_name:'Phase2B saved circuit',area_key:'phase2b-qa',center_lat:35,center_lng:-118,bbox:{},is_active:true,is_open_route:false,version:2,start_finish_path:[{lat:35,lng:-118},{lat:35.1,lng:-118}]}).select('id').single();
  assert(!map.error,map.error?.message);mapId=map.data.id;
  const tracks=await rpc(pro.client,'list_track_trace_tracks');assert(tracks.some(t=>t.id===mapId&&t.can_select));
  assert(!(await rpc(factory.client,'list_track_trace_tracks')).some(t=>t.id===mapId&&t.can_select));
  assert((await sports.client.rpc('list_track_trace_tracks')).error);
  checks.push({check:'owned saved circuit library / foreign selection / Sportsman denial',passed:true});
  for(const type of ['base','heat','main','extra1']){
    const setup=await pro.client.from('race_setups').insert({user_id:pro.account.id,setup_name:'Phase2B QA '+randomUUID(),setup_type:type,race_class:'Dwarf Cars',notes:'Preserve these setup values'}).select('id,notes,race_weekend_id').single();assert(!setup.error,setup.error?.message);phase2bSetups.push(setup.data.id);phase2bWeekendIds.push(setup.data.race_weekend_id);
    const timing=await pro.client.from('onlylaps_timing_sessions').insert({user_id:pro.account.id,name:'Phase2B '+type,track_map_id:mapId}).select('id').single();assert(!timing.error,timing.error?.message);phase2bSessions.push(timing.data.id);
    await rpc(pro.client,'set_track_trace_session_link',{p_setup_id:setup.data.id,p_session_id:timing.data.id,p_expected_session_id:null});
  }
  for(let i=0;i<4;i++)assert.equal((await rpc(pro.client,'list_track_trace_link_candidates',{p_setup_id:phase2bSetups[i]})).current_session_id,phase2bSessions[i]);
  assert((await pro.client.rpc('set_track_trace_session_link',{p_setup_id:phase2bSetups[1],p_session_id:phase2bSessions[0],p_expected_session_id:phase2bSessions[1]})).error);
  assert((await factory.client.rpc('list_track_trace_link_candidates',{p_setup_id:phase2bSetups[0]})).error);
  assert((await sports.client.rpc('set_track_trace_session_link',{p_setup_id:phase2bSetups[0],p_session_id:null,p_expected_session_id:phase2bSessions[0]})).error);
  await rpc(pro.client,'set_track_trace_session_link',{p_setup_id:phase2bSetups[1],p_session_id:null,p_expected_session_id:phase2bSessions[1]});
  await rpc(pro.client,'set_track_trace_session_link',{p_setup_id:phase2bSetups[1],p_session_id:phase2bSessions[1],p_expected_session_id:null});
  assert((await pro.client.rpc('set_track_trace_session_link',{p_setup_id:phase2bSetups[1],p_session_id:null,p_expected_session_id:null})).error);
  assert.equal((await pro.client.from('race_setups').select('notes').in('id',phase2bSetups)).data.filter(s=>s.notes==='Preserve these setup values').length,4);
  checks.push({check:'independent Hot Laps / Heat / Main / custom links, one-to-one, stale write, unlink and setup preservation',passed:true});
  for(const identity of [pro,factory]){
    const before=await identity.client.from('race_setups').select('id');assert(!before.error);
    const id=await rpc(identity.client,'create_track_trace_session',{p_setup_id:null,p_name:'Independent QA '+randomUUID(),p_track_map_id:identity===pro?mapId:null});standaloneSessions.push({identity,id});
    const detail=await rpc(identity.client,'get_track_trace_session',{p_session_id:id});assert.equal(detail.session.user_id,identity.account.id);assert.equal(detail.session.session_type,'practice');assert.equal(detail.session.started_at,null);assert.equal(detail.session.track_map_id,identity===pro?mapId:null);assert.equal(detail.laps.length,0);
    assert((await rpc(identity.client,'list_track_trace_sessions')).some(s=>s.id===id));assert.deepEqual((await identity.client.from('race_setups').select('id')).data,before.data);
  }
  const standalone=standaloneSessions.find(s=>s.identity===pro).id;
  await rpc(pro.client,'set_track_trace_session_link',{p_setup_id:phase2bSetups[1],p_session_id:standalone,p_expected_session_id:phase2bSessions[1]});assert.equal((await rpc(pro.client,'get_track_trace_setup_context',{p_setup_id:phase2bSetups[1]})).context.session.id,standalone);
  assert((await sports.client.rpc('create_track_trace_session',{p_setup_id:null,p_name:'Denied standalone'})).error);
  checks.push({check:'durable owned standalone preparation, mapped/Free Record, no setup created and exact later linking',passed:true});
  if(process.env.ONLYFAST_PLAYWRIGHT_MODULE) {
    const origin=process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:4187';
    assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
    const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE).href);
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try {
      for(const width of [320,390,768,1280]) for(const identity of [pro,sports,factory]) {
        const context=await browser.newContext({viewport:{width,height:900}});const errors=[],external=[];
        await context.route('**/*',route=>{
          const target=new URL(route.request().url());
          if([new URL(origin).origin,url].includes(target.origin))return route.continue();
          if(['fonts.googleapis.com','fonts.gstatic.com'].includes(target.hostname))return route.abort();
          external.push(target.origin);return route.abort();
        });
        await context.addInitScript(({session,ref})=>localStorage.setItem('onlyfast-2027-'+ref+'-auth',JSON.stringify(session)),{session:identity.session,ref});
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin+'/track-trace'+(identity===pro?'?view=menu&setup='+setupId:''),{waitUntil:'domcontentloaded'});
        await page.getByRole('heading',{name:'OnlyFast Track Trace',exact:true}).waitFor();
        if(identity===sports) {
          await page.getByRole('heading',{name:'Unlock OnlyFast Track Trace',exact:true}).waitFor();
          assert.equal(await page.getByLabel('Session name',{exact:true}).count(),0);
        } else {
          const menu=page.getByRole('region',{name:'Track Trace menu'});
          await menu.waitFor();assert.equal(await menu.getByRole('button').count(),4);
          if(identity===pro){
            await menu.getByRole('button',{name:/Start Session/}).click();
            await page.getByRole('heading',{name:'Prepare a circuit session',exact:true}).waitFor();
            await page.getByRole('button',{name:'Back to Track Trace menu',exact:true}).click();
          }
          await menu.getByRole('button',{name:/Start Session/}).click();await page.getByRole('button',{name:'Link to Existing Setup',exact:true}).waitFor();await page.getByRole('button',{name:'Record Without Setup',exact:true}).click();
          const standaloneName='Independent browser '+identity.account.tier+' '+width+' '+randomUUID();await page.getByLabel('Session name',{exact:true}).fill(standaloneName);await page.getByRole('radio',{name:/^Free Record/}).check();
          const creation=page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/create_track_trace_session'&&r.request().method()==='POST');await page.getByRole('button',{name:'Save circuit session',exact:true}).click();const created=await creation;assert(created.ok());const id=await created.json();assert.equal(typeof id,'string');standaloneSessions.push({identity,id});
          await page.getByRole('heading',{name:standaloneName,exact:true}).waitFor();await page.getByText('0 laps · 0 sector results',{exact:true}).waitFor();
          await page.getByRole('button',{name:'Back to Track Trace menu',exact:true}).click();
          if(identity===pro)await page.goto(origin+'/track-trace?view=menu&setup='+setupId,{waitUntil:'domcontentloaded'});
          await menu.getByRole('button',{name:/Review Session/}).click();
          await page.getByRole('heading',{name:'Saved circuit sessions',exact:true}).waitFor();
          if(identity===pro) {
            await page.getByRole('button',{name:/Track Trace verification/}).click();
            await page.getByText('Lap 1: 12.345 s',{exact:true}).waitFor();
            await page.getByText('Saved telemetry is linked for Setup Assist. Recommendations will become available with the testing AI integration.',{exact:true}).waitFor();
          }
        }
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        await page.screenshot({path:output+'/'+identity.account.tier+'-'+width+'.png',fullPage:true});
        checks.push({check:'browser direct route and mobile layout',tier:identity.account.tier,width,passed:true});
        await context.close();
      }
    }finally{await browser.close();}
  }
} finally {
  // Delete only records created by this run; existing setups/sessions are untouched.
  for(const {identity,id} of standaloneSessions){const r=await identity.client.from('onlylaps_timing_sessions').delete().eq('id',id).eq('user_id',identity.account.id).select('id');assert(!r.error,r.error?.message);assert(r.data.some(s=>s.id===id),'Standalone fixture cleanup required');}
  const pro=accounts.find(a=>a.account.tier==='pro');
  if(pro) {
    await rpc(pro.client,'set_onlyfast_test_tier',{p_tier:'pro'});
    if(sid){const r=await pro.client.from('onlylaps_timing_sessions').delete().eq('id',sid).eq('user_id',pro.account.id);assert(!r.error);}
    if(setupId){const r=await pro.client.from('race_setups').delete().eq('id',setupId).eq('user_id',pro.account.id);assert(!r.error);}
    for(const id of phase2bSessions){const r=await pro.client.from('onlylaps_timing_sessions').delete().eq('id',id).eq('user_id',pro.account.id);assert(!r.error,r.error?.message);}
    for(const id of phase2bSetups){const r=await pro.client.from('race_setups').delete().eq('id',id).eq('user_id',pro.account.id);assert(!r.error,r.error?.message);}
    if(mapId){const r=await pro.client.from('onlylaps_track_maps').delete().eq('id',mapId).eq('user_id',pro.account.id).select('id');assert(!r.error,r.error?.message);mapCleanupPending=!r.data.some(row=>row.id===mapId);}
  }
  for(const a of accounts) {if(a.originalTier)await rpc(a.client,'set_onlyfast_test_tier',{p_tier:a.originalTier});await a.client.auth.signOut({scope:'local'});}
  await writeFile(output+'/hosted.json',JSON.stringify({projectRef:ref,checks,cleanup:{setupId,sid,weekendId,phase2bSetups,phase2bSessions,phase2bWeekendIds,standaloneSessionIds:standaloneSessions.map(s=>s.id),mapId,rowsDeleted:!mapCleanupPending,mapCleanupPending,weekendMetadataRequiresOperatorCleanup:true}},null,2));
}
console.log(JSON.stringify({passed:checks.length,projectRef:ref,mapCleanupPending,weekendMetadataRequiresOperatorCleanup:true,report:output+'/hosted.json'}));
