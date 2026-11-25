// Original graphical controls, authenticated isolated test backend, synthetic maps only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const ref='mfzajhnfonrfuiwxgvhe',url='https://'+ref+'.supabase.co',out='tmp/track-trace-parity/editors';await mkdir(out,{recursive:true});
const state=JSON.parse(await readFile('tmp/track-trace-parity/hosted/state.json','utf8'));
const privateId=process.env.ONLYFAST_TRACE_PRIVATE_MAP;assert(/^[0-9a-f-]{36}$/.test(privateId||''));
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));assert.equal(credentials.projectRef,ref);
const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE));const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try{for(const [tier,width] of [['pro',390],['factory',1280]]){
  const account=credentials.accounts.find(a=>a.tier===tier),client=createClient(url,process.env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=async(name,args={})=>{const r=await client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
  assert.equal((await rpc('get_onlyfast_2027_environment')).project_ref,ref);
  const login=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!login.error);const original=await rpc('get_onlyfast_test_tier');
  try{
    await rpc('set_onlyfast_test_tier',{p_tier:tier});
    const context=await browser.newContext({viewport:{width,height:920}});
    await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:'onlyfast-2027-'+ref+'-auth',session:login.data.session});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    if(tier==='pro'){
      const before=await rpc('get_track_trace_edit_map',{p_track_id:privateId});assert(before.track_name.startsWith('QA browser scan '));assert.equal(before.publication_status,'private');
      await page.goto('http://127.0.0.1:4196/track-trace?view=track-edit&track='+privateId);
      await page.getByRole('link',{name:/Define Corners/}).click();await page.getByLabel('Number of Corners').waitFor();
      await page.getByRole('button',{name:'Reset Corners',exact:true}).click();
      await page.getByRole('slider',{name:/Corner point/}).fill('200');await page.getByRole('button',{name:'Define Corner 1 Start',exact:true}).click();
      await page.getByRole('slider',{name:/Corner point/}).fill('400');await page.getByRole('button',{name:'Define Corner 1 End',exact:true}).click();
      await page.getByRole('button',{name:'Finalize Corners',exact:true}).click();
      await page.getByRole('dialog',{name:'Save corners?'}).getByRole('button',{name:'Save',exact:true}).click();await page.getByText('1 corners saved',{exact:true}).waitFor();
      const after=await rpc('get_track_trace_edit_map',{p_track_id:privateId});assert.equal(after.corner_definitions.corners[0].startProgress,.2);assert.equal(after.corner_definitions.corners[0].endProgress,.4);assert.deepEqual(after.outside_path,before.outside_path);
      await page.getByRole('button',{name:'Clean Up Scan',exact:true}).click();assert(await page.getByRole('button',{name:'Save Cleaned Track',exact:true}).isDisabled());
      await page.screenshot({path:out+'/private-'+width+'.png',fullPage:true});checks.push('Private original corner sliders, map, finalize/confirmation and CAS persist actual ranges; cleanup is explicitly preview-only');
    }
    const before=await rpc('get_track_trace_edit_map',{p_track_id:state.map});assert.equal(before.publication_status,'published');
    await page.goto('http://127.0.0.1:4196/track-trace?view=track-edit&track='+state.map);
    await page.getByText('Shared track geometry and corners are read-only. Sector edits save your own personal settings.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:/Define Corners/}).getAttribute('aria-disabled'),'true');
    await page.getByRole('link',{name:/Define Sectors/}).click();await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Reset Sectors',exact:true}).click();await page.getByRole('group',{name:'Number of sectors'}).getByRole('button',{name:'3',exact:true}).click();
    await page.getByRole('slider',{name:/Sector boundary/}).fill('333');await page.getByRole('button',{name:'Define Sector 1 End',exact:true}).click();
    await page.getByRole('slider',{name:/Sector boundary/}).fill('666');await page.getByRole('button',{name:'Finalize Sectors',exact:true}).click();
    await page.getByRole('dialog',{name:'Save sectors?'}).getByRole('button',{name:'Save',exact:true}).click();await page.getByText('3 sectors saved',{exact:true}).waitFor();
    const after=await rpc('get_track_trace_edit_map',{p_track_id:state.map});assert.equal(after.user_sectors[0].sector_count,3);assert.equal(after.user_sectors[0].user_id,account.id);assert.equal(after.version,before.version);assert.deepEqual(after.sector_defaults,before.sector_defaults);assert.deepEqual(after.outside_path,before.outside_path);
    assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:out+'/shared-'+width+'.png',fullPage:true});checks.push(tier+' '+width+' px: original shared circuit sector map/sliders/save persist only personal definitions; canonical geometry, sectors and version unchanged');
    await context.close();
  }finally{await rpc('set_onlyfast_test_tier',{p_tier:original});await client.auth.signOut({scope:'local'});}
}}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({projectRef:ref,syntheticMapsOnly:true,checks},null,2));}
console.log(JSON.stringify({checks:checks.length,projectRef:ref}));
