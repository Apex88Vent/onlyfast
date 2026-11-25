// Read-only browser verification against an operator-created SYNTHETIC legacy
// testing fixture. Never reads production or claims physical GPS validation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const ref='mfzajhnfonrfuiwxgvhe',url='https://'+ref+'.supabase.co',out='tmp/track-trace-parity/legacy';await mkdir(out,{recursive:true});
const fixture=process.env.ONLYFAST_TRACE_LEGACY_SESSION;assert(/^[0-9a-f-]{36}$/.test(fixture||''),'Exact synthetic fixture UUID required');
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));assert.equal(credentials.projectRef,ref);
const account=credentials.accounts.find(a=>a.tier==='pro');
const client=createClient(url,process.env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(name,args={})=>{const r=await client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
assert.equal((await rpc('get_onlyfast_2027_environment')).project_ref,ref);
const login=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!login.error);
const original=await rpc('get_onlyfast_test_tier');const checks=[];
try{
  await rpc('set_onlyfast_test_tier',{p_tier:'pro'});
  const bundle=await rpc('get_track_trace_review_bundle',{p_session_id:fixture});
  assert(bundle.session.name.startsWith('QA legacy OnlyLaps parity '),'Synthetic fixture only');assert.equal(bundle.sample_count,502);assert.equal(bundle.laps.length,2);assert.equal(bundle.sectors.length,4);
  assert.deepEqual(await rpc('get_track_trace_samples',{p_session_id:fixture}),[]);
  const first=await rpc('get_track_trace_telemetry_page',{p_session_id:fixture});assert.equal(first.length,500);assert(first.every(s=>s.recorder_id===null));
  const second=await rpc('get_track_trace_telemetry_page',{p_session_id:fixture,p_after_time:first[499].recorded_at,p_after_id:first[499].id});assert.equal(second.length,2);
  assert.equal(first[0].speed_mps,20);assert.equal(first[0].g_force_lateral,.4);assert.equal(first[0].raw.accelX,1.2);assert.equal(first[0].raw.verticalG,.3);
  checks.push('502 legacy GPS rows, speed, G, raw acceleration, 2 laps, 4 sectors, map and analysis preserved through authenticated RPCs; old Phase 2D reader demonstrably empty');
  const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE));const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:920}});
    await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));window.historyGpsCalls=0;navigator.geolocation.watchPosition=()=>{window.historyGpsCalls++;throw Error('History review must not request live GPS');};},{key:'onlyfast-2027-'+ref+'-auth',session:login.data.session});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4196/track-trace?view=review&session='+fixture);
    await page.getByRole('heading',{name:bundle.session.name,exact:true}).waitFor();
    await page.getByRole('img',{name:'Selected lap track replay',exact:true}).waitFor();
    await page.getByText('44.7 mph',{exact:true}).first().waitFor();
    await page.getByText('Synthetic legacy analysis retained verbatim.',{exact:true}).waitFor();
    await page.getByRole('columnheader',{name:'Sector 1',exact:true}).waitFor();await page.getByRole('columnheader',{name:'Sector 2',exact:true}).waitFor();
    assert.equal(await page.getByRole('columnheader',{name:'Sector 3',exact:true}).count(),0,'Historical layout stays two sectors despite newer personal definitions');
    await page.getByRole('button',{name:'Show optimum details',exact:true}).click();
    await page.getByText('Sector 1:',{exact:false}).first().waitFor();
    await page.getByRole('button',{name:'Play replay',exact:true}).click();await page.getByRole('button',{name:'Pause replay',exact:true}).click();
    await page.getByRole('switch',{name:'Compare Laps',exact:true}).click();await page.getByLabel('Comparison lap',{exact:true}).selectOption(bundle.laps[1].id);
    await page.getByRole('slider',{name:'Normalized track-position timeline',exact:true}).press('End');
    assert.equal(await page.getByRole('slider',{name:'Normalized track-position timeline',exact:true}).inputValue(),'1000');
    await page.locator('[aria-label="Replay telemetry"]').waitFor();
    await page.locator('[aria-label*="G-force: lateral +0.40g"]').first().waitFor();
    await page.getByRole('img',{name:'G-force indicator',exact:true}).first().getByText('0.4',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.historyGpsCalls),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    await page.screenshot({path:out+'/legacy-'+width+'.png',fullPage:true});checks.push(width+' px: original review layout, track/replay map, speed/G, lap/sector table, optimum/comparison controls and stored analysis render without live GPS');
    await context.close();
  }}finally{await browser.close();}
}finally{
  await rpc('set_onlyfast_test_tier',{p_tier:original});await client.auth.signOut({scope:'local'});await writeFile(out+'/report.json',JSON.stringify({projectRef:ref,syntheticFixture:true,fixture,physicalDeviceValidated:false,checks},null,2));
}
console.log(JSON.stringify({checks:checks.length,projectRef:ref,syntheticFixture:true}));
