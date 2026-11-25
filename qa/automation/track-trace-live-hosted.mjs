// Synthetic GPS/browser clock, real isolated testing Auth/RPC/database.
// This is NOT physical GPS/device validation. Never target production.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const ref='mfzajhnfonrfuiwxgvhe',url='https://'+ref+'.supabase.co',out=process.env.ONLYFAST_TRACE_QA_OUTPUT||'tmp/track-trace-phase2d/hosted';
const preview=process.env.ONLYFAST_TRACE_PREVIEW||'http://127.0.0.1:4196';assert(new URL(preview).hostname==='127.0.0.1');
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
          window.syntheticMotion=()=>window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:1,y:2,z:3},rotationRate:{alpha:.1,beta:.2,gamma:.3},interval:16}));
          window.syntheticWatchCount=()=>watches.size;
        },{storageKey:'onlyfast-2027-'+ref+'-auth',session:actor.session});
        const page=await context.newPage(),errors=[],external=[];
        page.on('response',async response=>{if(response.url()===url+'/rest/v1/rpc/complete_track_trace_recording'&&!response.ok())await writeFile(out+'/completion-error.json',await response.text());});
        page.on('pageerror',e=>errors.push(e.message));
        page.on('request',r=>{const address=r.url(),host=new URL(address).hostname;if(host.includes('thpyjvwtfvfxiufchrxn')||/revenuecat|googlesyndication|doubleclick/.test(host))external.push(address);});
        await page.goto(preview+'/track-trace?view=start&prepare=unlinked'+(free?'':'&track='+state.map));await settle(page);
        const name='QA synthetic GPS '+actor.tier+' '+(free?'Free Record':'shared circuit')+' '+state.tag;
        await page.getByLabel('Session name',{exact:true}).fill(name);
        const [response]=await Promise.all([page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/create_track_trace_session'),page.getByRole('button',{name:'Save circuit session',exact:true}).click()]);
        const id=await response.json();assert.equal(typeof id,'string');createdSessions.push({actor,id});
        if(free)await page.getByRole('button',{name:'Left side of phone points toward front of car',exact:true}).click();
        await page.getByRole('button',{name:'Arm and start GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
        await page.evaluate(()=>window.syntheticGpsError(3));await page.getByRole('heading',{name:'Session Armed',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Session Live',exact:true}).count(),0);
        checks.push(actor.tier+': a failed GPS watch never produces Session Live before any fix');
        await page.getByRole('button',{name:'End Session',exact:true}).click();
        const emptyForm=page.getByRole('form',{name:'Confirm end session'});
        await emptyForm.getByLabel('Four-digit confirmation').fill(await emptyForm.locator('strong').innerText());
        await emptyForm.getByRole('button',{name:'Confirm end and save',exact:true}).click();
        await page.getByRole('alert').filter({hasText:'No GPS recording was captured'}).waitFor();
        assert.equal((await rpc(actor.client,'get_track_trace_session',{p_session_id:id})).session.ended_at,null);
        assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);
        await page.getByRole('button',{name:'Resume GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
        checks.push(actor.tier+': zero-fix completion blocked; session remains resumable without a false saved recording');
        await page.getByRole('button',{name:'Enable motion sensors',exact:true}).click();
        let offline=true,loseResponse=true;
        await page.route(url+'/rest/v1/rpc/append_track_trace_samples',async route=>{
          if(offline)return route.abort('internetdisconnected');
          if(loseResponse){loseResponse=false;await route.fetch();return route.abort('connectionreset');}
          return route.continue();
        });
        const started=Date.now();
        for(let i=0;i<64;i++){const theta=(i-.5)*Math.PI/10;await page.evaluate(p=>{window.syntheticMotion();window.syntheticGpsEmit(p);},point(35+Math.sin(theta)*.001,-118+Math.cos(theta)*.001,started+i*1000));}
        await page.getByRole('heading',{name:'Session Live',exact:true}).waitFor();await page.getByRole('img',{name:'Live track trace',exact:true}).waitFor();
        await page.getByText('55.9',{exact:true}).first().waitFor();
        await page.waitForFunction(()=>[...document.querySelectorAll('p')].some(p=>p.textContent?.startsWith('Session Time: ')&&!p.textContent.endsWith('00:00')));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live recording fits this viewport');
        await page.screenshot({path:out+'/live-'+actor.tier+'-'+width+'-'+(free?'free':'circuit')+'.png',fullPage:true});
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
          await page.getByRole('button',{name:'Enable motion sensors',exact:true}).click();await page.getByText('Motion enabled · phone orientation: left forward.',{exact:true}).waitFor();
          assert.equal((await rpc(actor.client,'get_track_trace_samples',{p_session_id:id}))[0].phoneMountOrientation,'left_forward');
          await page.evaluate(time=>{window.__gpsTime=time;},started+64000);checks.push('Free Record recovery after reload retains all GPS samples, resumes only by user action, no automatic laps');
        }
        await page.getByRole('button',{name:/^End (Session|and save session)$/}).click();
        const form=page.getByRole('form',{name:'Confirm end session'}),code=await form.locator('strong').innerText();
        assert(await form.getByRole('button',{name:'Confirm end and save',exact:true}).isDisabled());
        await form.getByLabel('Four-digit confirmation').fill(code);
        await form.getByRole('button',{name:'Confirm end and save',exact:true}).click();
        try{await page.getByRole('region',{name:'Session review'}).waitFor();}catch(cause){await page.screenshot({path:out+'/failure.png',fullPage:true});await writeFile(out+'/failure.txt',await page.locator('body').innerText());throw cause;}
        await page.getByRole('img',{name:free?'Session GPS Trace':'Selected lap track replay',exact:true}).waitFor();
        const detail=await rpc(actor.client,'get_track_trace_session',{p_session_id:id});
        if(!free){await page.getByRole('button',{name:'Play replay',exact:true}).click();await page.getByRole('button',{name:'Pause replay',exact:true}).click();await page.getByRole('switch',{name:'Compare Laps',exact:true}).click();await page.getByLabel('Comparison lap',{exact:true}).selectOption(detail.laps[1].id);}
        assert(detail.session.ended_at);assert.equal(detail.session.track_map_id,free?null:state.map);assert.equal(detail.laps.length,free?0:3);assert.equal(detail.sectors.length,free?0:3*detail.session.device_info.track_trace_recording.track.sectors.sectorCount);
        if(!free&&detail.session.device_info.track_trace_recording.track.sectors.sectorCount===2)assert(detail.sectors.every(s=>s.is_valid&&s.duration_ms===10000),'Original synthetic circuit has six valid measured 10-second sectors');
        assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);
        assert((await factory.client.rpc('get_track_trace_samples',{p_session_id:pro===actor?id:createdSessions[0].id})).error);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
        await page.screenshot({path:out+'/'+actor.tier+'-'+width+'-'+(free?'free':'circuit')+'.png',fullPage:true});
        checks.push(actor.tier+': deliberate confirmation → atomic completion → saved GPS/lap/sector review with watcher cleanup');
        if(free){
          await page.goto(preview+'/track-trace?view=scan');await settle(page);
          const scanner=page.getByRole('region',{name:'Circuit scanner'});
          await scanner.getByLabel('Track name',{exact:true}).fill('QA browser scan '+state.tag);
          await scanner.getByLabel('Location',{exact:true}).fill('Synthetic browser circuit');
          await scanner.getByLabel('Track Shape',{exact:true}).selectOption('paperclip_oval');await scanner.getByLabel('Track Length',{exact:true}).selectOption('1/4 mile');await scanner.getByRole('button',{name:'Continue to GPS Scan',exact:true}).click();
          await scanner.getByRole('button',{name:'Enable scan GPS',exact:true}).click();await page.waitForFunction(()=>window.syntheticWatchCount()===1);
          let scanTime=Date.now();
          await scanner.getByRole('button',{name:'Start Outside Trace',exact:true}).click();
          for(const [kind,path,end] of [['outside',ring(),'End Outside Lap'],['start/finish',[point(35,-117.9994),point(35,-117.9986)],'End Start/Finish Line'],['inside',ring(.0001),'End Inside Lap']]){
            for(const p of path){scanTime+=1000;await page.evaluate(p=>window.syntheticGpsEmit(p),{...p,timestamp:new Date(scanTime).toISOString()});}
            await scanner.getByRole('button',{name:end,exact:true}).click();
          }
          await scanner.getByLabel('Notes',{exact:true}).fill('Synthetic scan notes retained');
          const [saveResponse]=await Promise.all([page.waitForResponse(r=>r.url()===url+'/rest/v1/rpc/save_track_trace_scan_details'),scanner.getByRole('button',{name:'Save Track',exact:true}).click()]);
          const saveResult=await saveResponse.json();assert(saveResult.saved,JSON.stringify(saveResult));createdMaps.push({actor,id:saveResult.id});
          await scanner.getByText(/Private scan saved/).waitFor();
          const saved=(await rpc(actor.client,'search_track_trace_tracks',{p_search:'QA browser scan '+state.tag,p_scope:'mine'})).find(t=>t.id===saveResult.id);
          assert(saved);assert.equal(saved.publication_status,'private');assert.equal(saved.corner_definitions.corners.length,0);const full=await rpc(actor.client,'get_track_trace_edit_map',{p_track_id:saveResult.id});assert.equal(full.track_shape,'paperclip_oval');assert.equal(full.track_length,'1/4 mile');assert.equal(full.notes,'Synthetic scan notes retained');assert.equal(saved.outside_path.length,5);assert.equal(saved.inside_path.length,5);assert.equal(saved.start_finish_path.length,2);
          await scanner.locator('summary').filter({hasText:'Submit'}).click();await scanner.getByLabel('Layout name',{exact:true}).fill('Synthetic browser layout');await scanner.getByRole('button',{name:'Submit for review',exact:true}).click();await scanner.getByText(/Submitted for review/).waitFor();
          await page.screenshot({path:out+'/private-scan-390.png',fullPage:true});checks.push('390 px browser scanner captures real GPS callbacks, closed boundaries, finish line, original metadata/review, private save and moderation submission (synthetic input)');
          await scanner.getByRole('button',{name:'Start another scan',exact:true}).click();await scanner.getByLabel('Track name',{exact:true}).fill('QA denied scan');await scanner.getByLabel('Location',{exact:true}).fill('Synthetic');await scanner.getByRole('button',{name:'Continue to GPS Scan',exact:true}).click();await scanner.getByRole('button',{name:'Enable scan GPS',exact:true}).click();await page.evaluate(()=>window.syntheticGpsError(1));await scanner.getByRole('alert').filter({hasText:'permission denied'}).waitFor();assert.equal(await page.evaluate(()=>window.syntheticWatchCount()),0);checks.push('Permission denial stops GPS and leaves retained scan data available');
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
