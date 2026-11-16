// Synthetic GPS/browser clock, real isolated testing Auth/RPC/database.
// This is NOT physical GPS/device validation. Never target production.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const ref='mfzajhnfonrfuiwxgvhe',url='https://'+ref+'.supabase.co',out='tmp/track-trace-phase2d/hosted';
await mkdir(out,{recursive:true});
const key=process.env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY;assert(/^sb_publishable_/.test(key||''));
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));assert.equal(credentials.projectRef,ref);
const rpc=async(c,name,args={})=>{const r=await c.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
const settle=page=>page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>undefined);
const actors=[],checks=[],createdSessions=[],createdMaps=[],operatorCleanup=[];let state;
for(const tier of ['pro','factory','sportsman']){
  const account=credentials.accounts.find(a=>a.tier===tier);assert(account);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.equal((await rpc(client,'get_onlyfast_2027_environment')).project_ref,ref);
  const login=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!login.error,'Synthetic login failed');
  const originalTier=await rpc(client,'get_onlyfast_test_tier');await rpc(client,'set_onlyfast_test_tier',{p_tier:tier});
  actors.push({tier,account,client,originalTier,session:login.data.session});
}
const [pro,factory,sports]=actors;
const point=(lat,lng,time=Date.now())=>({lat,lng,timestamp:new Date(time).toISOString(),accuracy:4,speed:25,heading:null,altitude:100});
const ring=(d=0)=>[point(35+d,-118),point(35.002+d,-118),point(35.002+d,-117.998),point(35+d,-117.998),point(35+d,-118)];
const scan=name=>({track_name:name,community_location:'Synthetic QA circuit',track_type:'dirt_oval',track_shape:'custom_unknown',direction:'counterclockwise',source:'track_scan',map_source:'track_scan',scan_status:'scanned',is_open_route:false,center_lat:35,center_lng:-118,area_key:'35_-118',facility_key:'phase2d-synthetic-'+state.tag,bbox:{minLat:35,maxLat:35.002,minLng:-118,maxLng:-117.998},outside_path:ring(),inside_path:ring(.0001),start_finish_path:[point(35,-117.9994),point(35,-117.9986)],corner_definitions:{corners:[]}});
try{
  if(process.argv[2]==='seed'){
    state={projectRef:ref,tag:randomUUID().slice(0,8),map:randomUUID()};
    state.name='QA Phase2D synthetic circuit '+state.tag;
    const sectors={sector_count:2,lines:[{id:'sector-1',sectorIndex:1,progress:.5,start:{lat:35,lng:-118.0014},end:{lat:35,lng:-118.0006},expectedDirection:null}]};
    assert((await rpc(pro.client,'save_track_trace_scan',{p_scan_id:state.map,p_scan:scan(state.name),p_sectors:sectors})).saved);
    assert.equal((await rpc(pro.client,'submit_track_trace_scan',{p_track_id:state.map,p_layout_key:'synthetic-main',p_layout_name:'Synthetic main',p_location:'Synthetic QA circuit '+state.tag})).status,'pending');
    await writeFile(out+'/state.json',JSON.stringify(state,null,2));checks.push('Private synthetic scan saved and submitted through real RPC');
  }else if(process.argv[2]==='verify'){
    state=JSON.parse(await readFile(out+'/state.json','utf8'));assert.equal(state.projectRef,ref);
    const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE));
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try{
      for(const [actor,width,free] of [[pro,390,false],[factory,1280,false],[pro,390,true]]){
        await rpc(actor.client,'set_onlyfast_test_tier',{p_tier:actor.tier});
        const context=await browser.newContext({viewport:{width,height:920}});
        await context.addInitScript(({storageKey,session})=>{
          localStorage.setItem(storageKey,JSON.stringify(session));
          let watches=new Map(),next=1;const RealDate=Date;window.__gpsTime=0;
          window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[Math.max(RealDate.now(),window.__gpsTime)]));}static now(){return Math.max(RealDate.now(),window.__gpsTime);}};
          const fix=p=>({coords:{latitude:p.lat,longitude:p.lng,accuracy:p.accuracy,altitude:p.altitude,speed:p.speed,heading:p.heading},timestamp:RealDate.parse(p.timestamp)});
          Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){success(fix({lat:35,lng:-118,accuracy:4,altitude:null,speed:null,heading:null,timestamp:new RealDate().toISOString()}));},watchPosition(success,error){const id=next++;watches.set(id,{success,error});return id;},clearWatch(id){watches.delete(id);}}});
          window.syntheticGpsEmit=p=>{window.__gpsTime=RealDate.parse(p.timestamp);for(const w of watches.values())w.success(fix(p));};
          window.syntheticGpsError=code=>{for(const w of watches.values())w.error({code,message:'Synthetic permission/timeout test'});};
          window.syntheticWatchCount=()=>watches.size;
        },{storageKey:'onlyfast-2027-'+ref+'-auth',session:actor.session});
        const page=await context.newPage(),errors=[],external=[];
        page.on('response',async response=>{if(response.url()===url+'/rest/v1/rpc/complete_track_trace_recording'&&!response.ok())await writeFile(out+'/completion-error.json',await response.text());});
        page.on('pageerror',e=>errors.push(e.message));
        page.on('request',r=>{const address=r.url(),host=new URL(address).hostname;if(host.includes('thpyjvwtfvfxiufchrxn')||/revenuecat|googlesyndication|doubleclick/.test(host))external.push(address);});
        await page.goto('http://127.0.0.1:4194/track-trace?view=start&prepare=unlinked'+(free?'':'&track='+state.map));await settle(page);
        const name='QA synthetic GPS '+actor.tier+' '+(free?'Free Record':'shared circuit')+' '+state.tag;
        await page.getByLabel('Session name',{exact:true}).fill(name);
        const [response]=await Promise.all([page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/create_track_trace_session'),page.getByRole('button',{name:'Save circuit session',exact:true}).click()]);
        const id=await response.json();assert.equal(typeof id,'string');createdSessions.push({actor,id});
        await page.getByRole('button',{name:'Arm and start GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
        let offline=true,loseResponse=true;
        await page.route(url+'/rest/v1/rpc/append_track_trace_samples',async route=>{
          if(offline)return route.abort('internetdisconnected');
          if(loseResponse){loseResponse=false;await route.fetch();return route.abort('connectionreset');}
          return route.continue();
        });
        const started=Date.now();
        for(let i=0;i<64;i++){const theta=(i-.5)*Math.PI/10;await page.evaluate(p=>window.syntheticGpsEmit(p),point(35+Math.sin(theta)*.001,-118+Math.cos(theta)*.001,started+i*1000));}
        await page.getByText(/64 GPS samples/).waitFor();
        await page.getByText(/Upload pending/).waitFor();
        assert.equal((await rpc(actor.client,'get_track_trace_samples',{p_session_id:id})).length,0);
        offline=false;await page.getByRole('button',{name:'Retry upload',exact:true}).click();await page.getByText('64 samples saved on server.',{exact:false}).waitFor();
        assert.equal((await rpc(actor.client,'get_track_trace_samples',{p_session_id:id})).length,64);
        checks.push(actor.tier+' '+width+': browser GPS → durable local queue → offline retry and lost-response replay → exactly 64 database samples (synthetic input)');
        if(free){
          await page.reload();await settle(page);await page.getByText(/64 GPS samples/).waitFor();assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);
          await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('onlyfast-track-trace-recording-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);}));
          await page.reload();await settle(page);await page.getByText(/64 GPS samples/).waitFor();assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);
          checks.push('Server recovery restores original recording after the local journal is removed (synthetic browser context only)');
          await page.getByRole('button',{name:'Resume GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
          await page.evaluate(time=>{window.__gpsTime=time;},started+64000);checks.push('Free Record recovery after reload retains all GPS samples, resumes only by user action, no automatic laps');
        }
        await page.getByRole('button',{name:'End and save session',exact:true}).click();
        const form=page.getByRole('form',{name:'Confirm end session'}),code=await form.locator('strong').innerText();
        assert(await form.getByRole('button',{name:'Confirm end and save',exact:true}).isDisabled());
        await form.getByLabel('Four-digit confirmation').fill(code);
        await form.getByRole('button',{name:'Confirm end and save',exact:true}).click();
        try{await page.getByRole('region',{name:'Session review'}).waitFor();}catch(cause){await page.screenshot({path:out+'/failure.png',fullPage:true});await writeFile(out+'/failure.txt',await page.locator('body').innerText());throw cause;}
        await page.getByRole('img',{name:'Recorded GPS geometry preview'}).waitFor();
        const detail=await rpc(actor.client,'get_track_trace_session',{p_session_id:id});
        assert(detail.session.ended_at);assert.equal(detail.session.track_map_id,free?null:state.map);assert.equal(detail.laps.length,free?0:3);assert.equal(detail.sectors.length,free?0:6);
        assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);
        assert((await factory.client.rpc('get_track_trace_samples',{p_session_id:pro===actor?id:createdSessions[0].id})).error);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        await page.screenshot({path:out+'/'+actor.tier+'-'+width+'-'+(free?'free':'circuit')+'.png',fullPage:true});
        checks.push(actor.tier+': deliberate confirmation → atomic completion → saved GPS/lap/sector review with watcher cleanup');
        if(free){
          await page.goto('http://127.0.0.1:4194/track-trace?view=scan');await settle(page);
          const scanner=page.getByRole('region',{name:'Circuit scanner'});
          await scanner.getByLabel('Track name',{exact:true}).fill('QA browser scan '+state.tag);
          await scanner.getByLabel('Location',{exact:true}).fill('Synthetic browser circuit');
          await scanner.getByRole('button',{name:'Enable scan GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
          let scanTime=Date.now();
          for(const [kind,path] of [['outside',ring()],['inside',ring(.0001)],['start/finish',[point(35,-117.9994),point(35,-117.9986)]]]){
            await scanner.getByRole('button',{name:new RegExp('^Capture '+kind+' \\(0\\)')}).click();
            for(const p of path){scanTime+=1000;await page.evaluate(p=>window.syntheticGpsEmit(p),{...p,timestamp:new Date(scanTime).toISOString()});}
            await scanner.getByRole('button',{name:'Pause boundary capture',exact:true}).click();
          }
          await scanner.getByLabel('start %',{exact:true}).fill('10');await scanner.getByLabel('apex %',{exact:true}).fill('25');await scanner.getByLabel('end %',{exact:true}).fill('40');await scanner.getByRole('button',{name:'Add corner',exact:true}).click();
          const [saveResponse]=await Promise.all([page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/save_track_trace_scan'),scanner.getByRole('button',{name:'Save private circuit scan',exact:true}).click()]);
          const saveResult=await saveResponse.json();assert(saveResult.saved,JSON.stringify(saveResult));createdMaps.push({actor,id:saveResult.id});
          await scanner.getByText(/Private scan saved/).waitFor();
          const saved=(await rpc(actor.client,'search_track_trace_tracks',{p_search:'QA browser scan '+state.tag,p_scope:'mine'})).find(t=>t.id===saveResult.id);
          assert(saved);assert.equal(saved.publication_status,'private');assert.equal(saved.corner_definitions.corners.length,1);assert.equal(saved.outside_path.length,5);assert.equal(saved.inside_path.length,5);assert.equal(saved.start_finish_path.length,2);
          await scanner.locator('summary').filter({hasText:'Submit'}).click();await scanner.getByLabel('Layout name',{exact:true}).fill('Synthetic browser layout');await scanner.getByRole('button',{name:'Submit for review',exact:true}).click();await scanner.getByText(/Submitted for review/).waitFor();
          await page.screenshot({path:out+'/private-scan-390.png',fullPage:true});checks.push('390 px browser scanner captures real GPS callbacks, closed boundaries, finish line, manual corner, private save and moderation submission (synthetic input)');
          await scanner.getByRole('button',{name:'Start another scan',exact:true}).click();await scanner.getByRole('button',{name:'Enable scan GPS',exact:true}).click();await page.evaluate(()=>window.syntheticGpsError(1));await scanner.getByRole('alert').filter({hasText:'permission denied'}).waitFor();assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);checks.push('Permission denial stops GPS and leaves retained scan data available');
        }
        await context.close();
      }
    }finally{await browser.close();}
    for(const name of ['begin_track_trace_recording','append_track_trace_samples']){
      const args=name==='begin_track_trace_recording'?{p_session_id:createdSessions[0].id,p_recorder_id:randomUUID(),p_started_at:new Date().toISOString()}:{p_session_id:createdSessions[0].id,p_recorder_id:randomUUID(),p_samples:[]};
      assert((await sports.client.rpc(name,args)).error);
    }
    checks.push('Sportsman server recording denied; cross-user GPS reads denied');
  }else throw Error('Use seed or verify');
}finally{
  for(const {actor,id} of createdSessions){const r=await actor.client.from('onlylaps_timing_sessions').delete().eq('id',id).eq('user_id',actor.account.id);assert(!r.error,r.error?.message);}
  for(const {actor,id} of createdMaps){const r=await actor.client.from('onlylaps_track_maps').delete().eq('id',id).eq('user_id',actor.account.id).select('id');assert(!r.error,r.error?.message);if(!r.data.some(row=>row.id===id))operatorCleanup.push(id);}
  for(const actor of actors){await rpc(actor.client,'set_onlyfast_test_tier',{p_tier:actor.originalTier});await actor.client.auth.signOut({scope:'local'});}
  await writeFile(out+'/'+process.argv[2]+'.json',JSON.stringify({projectRef:ref,syntheticGps:true,physicalDeviceValidated:false,checks,deletedSessions:createdSessions.map(s=>s.id),operatorMapCleanupRequired:[state?.map,...operatorCleanup].filter(Boolean)},null,2));
}
console.log(JSON.stringify({mode:process.argv[2],checks:checks.length,projectRef:ref}));
