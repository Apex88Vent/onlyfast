// Explicitly isolated testing accounts/data. No production, billing or GPS calls.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const ref='mfzajhnfonrfuiwxgvhe',url='https://'+ref+'.supabase.co',out='tmp/track-trace-phase2c/hosted';
await mkdir(out,{recursive:true});
const key=process.env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY;
assert(/^sb_publishable_/.test(key||''),'Testing publishable key required');
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));assert.equal(credentials.projectRef,ref);
const rpc=async(c,name,args={})=>{const r=await c.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
const actors=[];
for(const tier of ['pro','factory','sportsman']){
 const account=credentials.accounts.find(a=>a.tier===tier);assert(account);
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await rpc(client,'get_onlyfast_2027_environment')).project_ref,ref);
 const login=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!login.error,'Synthetic login failed');
 const originalTier=await rpc(client,'get_onlyfast_test_tier');await rpc(client,'set_onlyfast_test_tier',{p_tier:tier});
 actors.push({tier,client,account,originalTier,session:login.data.session});
}
const pro=actors.find(a=>a.tier==='pro'),factory=actors.find(a=>a.tier==='factory'),sports=actors.find(a=>a.tier==='sportsman');
const statePath=out+'/state.json',mode=process.argv[2],checks=[],sessions=[];let state;
try{
 if(mode==='seed'){
  const tag=randomUUID().slice(0,8),p=(lat,lng)=>({lat,lng,timestamp:'2026-11-14T00:00:00Z',accuracy:5});
  const ring=(min,max)=>[p(min,10),p(max,10),p(max,10.001),p(min,10.001),p(min,10)];
  state={projectRef:ref,tag,tracks:{},names:{},originalTiers:Object.fromEntries(actors.map(a=>[a.tier,a.originalTier]))};
  const add=async(actor,kind,offset=0,invalid=false)=>{
   const name='QA synthetic '+kind+' '+tag;
   const row={user_id:actor.account.id,name,track_name:name,source:'track_scan',track_type:'dirt_oval',center_lat:10.0005,center_lng:10.0005,area_key:'10_10',facility_key:'qa-'+tag,bbox:{minLat:10,maxLat:10.002,minLng:10,maxLng:10.001},outside_path:invalid?[p(10,10)]:ring(10+offset,10.001+offset),inside_path:ring(10.0002+offset,10.0008+offset),start_finish_path:[p(10,10),p(10.0002,10)]};
   const r=await actor.client.from('onlylaps_track_maps').insert(row).select('id,version').single();assert(!r.error,r.error?.message);
   state.tracks[kind]=r.data.id;state.names[kind]=name;await writeFile(statePath,JSON.stringify(state,null,2));
   if(!invalid){const s=await actor.client.from('onlylaps_track_sector_defaults').insert({track_id:r.data.id,owner_id:actor.account.id,sector_count:1,version:1,lines:[]});assert(!s.error,s.error?.message);}
   return r.data.id;
  };
  const main=await add(pro,'main'),short=await add(pro,'short',.0001),duplicate=await add(pro,'duplicate'),invalid=await add(pro,'invalid',0,true);await add(factory,'private');
  for(const [id,layout] of [[main,'main-oval'],[short,'short-oval'],[duplicate,'main-oval']])assert.equal((await rpc(pro.client,'submit_track_trace_scan',{p_track_id:id,p_layout_key:layout,p_layout_name:layout,p_location:'Synthetic QA location '+tag})).status,'pending');
  assert.equal((await rpc(pro.client,'submit_track_trace_scan',{p_track_id:invalid,p_layout_key:'invalid',p_layout_name:'Invalid scan',p_location:'Synthetic QA location'})).status,'invalid');
  checks.push('Owned drafts and review submissions created; no publication by browser');
  await writeFile(statePath,JSON.stringify(state,null,2));
 }else if(mode==='verify'){
  state=JSON.parse(await readFile(statePath,'utf8'));assert.equal(state.projectRef,ref);const {main,short,duplicate,invalid}=state.tracks;
  for(const actor of [pro,factory]){
   const rows=await rpc(actor.client,'search_track_trace_tracks',{p_search:'Synthetic QA location '+state.tag,p_scope:'community'});
   assert(rows.some(t=>t.id===main&&t.can_select));assert(rows.some(t=>t.id===short));
   const direct=await actor.client.from('onlylaps_track_maps').select('*').eq('publication_status','published').eq('is_active',true).in('id',[main,short]);assert(!direct.error);assert.equal(direct.data.length,2);
   const id=await rpc(actor.client,'create_track_trace_session',{p_setup_id:null,p_name:'QA community '+state.tag,p_track_map_id:main});sessions.push({actor,id});
   const detail=await rpc(actor.client,'get_track_trace_session',{p_session_id:id});assert.equal(detail.session.track_map_id,main);assert.equal(detail.laps.length,0);
   assert((await (actor===pro?factory:pro).client.rpc('get_track_trace_session',{p_session_id:id})).error);
  }
  checks.push('Both paid tiers discover, select and review the same canonical shared IDs; sessions stay private');
  assert.equal((await factory.client.from('onlylaps_track_maps').select('id').eq('id',invalid)).data.length,0);
  const other=await factory.client.from('onlylaps_track_maps').update({track_name:'Not permitted'}).eq('id',main).select('id');assert(!other.error);assert.equal(other.data.length,0);
  assert((await pro.client.from('onlylaps_track_maps').update({track_name:'Owner overwrite forbidden'}).eq('id',main)).error);
  assert((await pro.client.rpc('review_track_trace_scan',{p_track_id:duplicate,p_fingerprint:'a'.repeat(64),p_approve:true})).error);
  const matches=await rpc(pro.client,'find_track_trace_duplicates',{p_track_id:duplicate,p_layout_key:'main-oval'});assert(matches.some(m=>m.id===main&&m.same_layout));assert(matches.some(m=>m.id===short&&!m.same_layout));
  assert((await sports.client.rpc('search_track_trace_tracks',{p_search:state.tag,p_scope:'community'})).error);
  assert((await sports.client.rpc('create_track_trace_session',{p_setup_id:null,p_name:'Denied shared map',p_track_map_id:main})).error);
  checks.push('Private maps, immutable published maps, duplicate layouts, controlled moderation and Sportsman restrictions enforced');
  if(process.env.ONLYFAST_PLAYWRIGHT_MODULE){
   const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE));const origin=process.env.ONLYFAST_LAYOUT_URL||'http://127.0.0.1:4193';assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
   const browser=await chromium.launch({channel:'chrome',headless:true});
   try{for(const width of [390,1280])for(const actor of [pro,factory]){
    await rpc(actor.client,'set_onlyfast_test_tier',{p_tier:actor.tier});
    const context=await browser.newContext({viewport:{width,height:900}}),errors=[],external=[];
    await context.route('**/*',route=>{const u=new URL(route.request().url());if([origin,url].includes(u.origin))return route.continue();if(!['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))external.push(u.origin);return route.abort();});
    await context.addInitScript(({ref,session})=>localStorage.setItem('onlyfast-2027-'+ref+'-auth',JSON.stringify(session)),{ref,session:actor.session});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/track-trace?view=library',{waitUntil:'domcontentloaded'});await page.waitForLoadState('networkidle');
    try{await page.getByRole('heading',{name:'Track Library',exact:true}).waitFor();}catch(error){await page.screenshot({path:out+'/failed-library-'+actor.tier+'-'+width+'.png',fullPage:true});throw error;}
    await page.getByLabel('Browse',{exact:true}).selectOption('community');await page.getByLabel('Search by track name or location',{exact:true}).fill('Synthetic QA location '+state.tag);await page.getByRole('button',{name:'Search tracks',exact:true}).click();
    const card=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:state.names.main,exact:true})});await card.getByText('Shared community track',{exact:true}).waitFor();await card.getByRole('button',{name:'Use this track',exact:true}).click();
    await page.getByRole('button',{name:'Record Without Setup',exact:true}).click();await page.waitForLoadState('networkidle');
    const name='QA browser '+actor.tier+' '+width+' '+state.tag;await page.getByLabel('Session name',{exact:true}).fill(name);
    if(actor===pro&&width===390){
      let accidentalSessions=0;const observe=r=>{if(r.url()===url+'/rest/v1/rpc/create_track_trace_session'&&r.method()==='POST')accidentalSessions++;};page.on('request',observe);
      await page.getByRole('button',{name:'Change selected track',exact:true}).click();
      const invalidCard=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:state.names.invalid,exact:true})});await invalidCard.locator('summary').click();
      await invalidCard.getByLabel('Layout name',{exact:true}).fill('Invalid check');await invalidCard.getByLabel('Location',{exact:true}).fill('Synthetic QA location');await invalidCard.getByRole('button',{name:'Submit for review',exact:true}).click();await invalidCard.getByRole('alert').getByText(/too few distinct points/).waitFor();
      assert.equal(await page.getByLabel('Session name',{exact:true}).inputValue(),name);assert.equal(await page.locator('form form').count(),0);assert.equal(accidentalSessions,0);page.off('request',observe);
      await page.getByLabel('Browse',{exact:true}).selectOption('community');await page.getByRole('listitem').filter({has:page.getByRole('heading',{name:state.names.main,exact:true})}).getByRole('button',{name:'Use this track',exact:true}).click();
      checks.push('Real submission validation in the preparation library preserves the draft and cannot submit the session form');
    }
    const [r]=await Promise.all([page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/create_track_trace_session'&&r.request().method()==='POST'),page.getByRole('button',{name:'Save circuit session',exact:true}).click()]);assert(r.ok());const id=await r.json();assert.equal(typeof id,'string');sessions.push({actor,id});
    await page.getByRole('heading',{name,exact:true}).waitFor();assert.equal((await rpc(actor.client,'get_track_trace_session',{p_session_id:id})).session.track_map_id,main);
    assert.equal(await page.locator('form form').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await page.screenshot({path:out+'/'+actor.tier+'-'+width+'.png',fullPage:true});checks.push('Browser shared search → select → durable preparation: '+actor.tier+' '+width);await context.close();
   }}finally{await browser.close();}
  }
 }else throw Error('Use seed or verify.');
}finally{
 for(const {actor,id} of sessions){await rpc(actor.client,'set_onlyfast_test_tier',{p_tier:actor.tier});const r=await actor.client.from('onlylaps_timing_sessions').delete().eq('id',id).eq('user_id',actor.account.id).select('id');assert(!r.error);assert(r.data.some(x=>x.id===id));}
 for(const actor of actors){await rpc(actor.client,'set_onlyfast_test_tier',{p_tier:actor.originalTier});await actor.client.auth.signOut({scope:'local'});}
 await writeFile(out+'/'+mode+'.json',JSON.stringify({projectRef:ref,checks,sessionsDeleted:sessions.map(s=>s.id),mapCleanupRequired:state?.tracks},null,2));
}
console.log(JSON.stringify({mode,checks:checks.length,projectRef:ref,state:statePath}));
