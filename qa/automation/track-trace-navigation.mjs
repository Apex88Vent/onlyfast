// Local UI verification with synthetic data. No hosted account, database or provider calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root=process.cwd(), output=path.resolve('tmp/track-trace-refinements/browser');
await mkdir(output,{recursive:true});
assert(process.env.ONLYFAST_PLAYWRIGHT_MODULE,'Installed Playwright module required');
const {chromium}=await import(pathToFileURL(process.env.ONLYFAST_PLAYWRIGHT_MODULE).href);
const api=`export const trackTraceEnabled=true,TRACK_TRACE_NAME='OnlyFast Track Trace';export const traceRpc=(name,args={})=>window.fixture.rpc(name,args);export const getTraceAssistStatus=async()=>({linked:true,usable_measured_facts:true});`;
const permission=`import{useSyncExternalStore}from'react';const subscribe=fn=>{window.addEventListener('fixture-tier',fn);return()=>window.removeEventListener('fixture-tier',fn)};export const useTrackTraceIdentity=()=> 'ui-user';export function useTrackTracePermission(){const tier=useSyncExternalStore(subscribe,()=>window.fixture.tier),fullAccess=['pro','factory'].includes(tier);return{allowed:true,fullAccess,navigationLocked:!fullAccess,data:{allowed:true,can_read_history:true,can_record:fullAccess,tier},revision:tier,isError:false}}`;
const modules={
  '@/features/track-trace/api':api,'./api':api,
  '@/features/track-trace/useTrackTrace':permission,'./useTrackTrace':permission,
  './SettingsModal':'export default()=>null;',
  '@/lib/trustedMembership':`export const getTrustedMembership=()=>({membership_tier:window.fixture.tier});`,
  '@/hooks/useBetaFeatures':`export const useBetaFeatures=()=>({hasBetaFeature:()=>false,loading:false});`,
  '@/hooks/useMembershipRevision':`export const useMembershipRevision=()=>0;`,
  '@/lib/testAccount':`export const resetTestAccountData=async()=>false;`,
  '@/lib/supabase':`export const supabase={rpc:async()=>({data:null,error:null}),auth:{signOut:async()=>{}}};`,
  '@/lib/membership':`export const hasFeatureAccess=()=>false,readMembership=()=>({membership_tier:'pro'});`,
};
await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useNavigate}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import HomeLanding from'./src/components/HomeLanding';import Header from'./src/components/Header';import ViewSharedSetupModal from'./src/components/ViewSharedSetupModal';import TrackTraceEntry from'./src/features/track-trace/TrackTraceEntry';import TrackTracePage from'./src/features/track-trace/TrackTracePage';import TrackTraceSessionLink from'./src/features/track-trace/TrackTraceSessionLink';
function SetupFixture(){const[session,setSession]=React.useState('Hot Laps');const[draft,setDraft]=React.useState('');return <section aria-label="Setup fixture" className="mx-auto max-w-3xl"><label>Unsaved setup note<input value={draft} onChange={e=>setDraft(e.target.value)}/></label><div>{['Hot Laps','Heat','Main','Custom'].map(s=><button className="p-2 border" key={s} onClick={()=>setSession(s)}>{s}</button>)}</div><p>Current setup: {session}</p><TrackTraceSessionLink key={session} userId="ui-user" setupId={session}/></section>}
const user={id:'ui-user',email:'racer@example.invalid',user_metadata:{nickname:'racer'}};
function App(){const navigate=useNavigate();const[shared,setShared]=React.useState(false);const[tier,setTier]=React.useState('sportsman');React.useEffect(()=>{const listener=e=>{if(e.detail?.action==='view-shared')setShared(true)};window.addEventListener('onlyfast-menu',listener);return()=>window.removeEventListener('onlyfast-menu',listener)},[]);
return <><aside className="bg-amber-100 p-2 text-sm" aria-label="Synthetic UI fixture">Local synthetic UI preview — no backend connection <div className="flex gap-2">{['sportsman','pro','factory'].map(t=><button className="rounded border p-1" key={t} onClick={()=>{window.fixture.tier=t;setTier(t);window.dispatchEvent(new Event('fixture-tier'))}}>{t}</button>)}</div></aside>
<Header user={user} selectedCar="Dwarf Cars" onSignInClick={()=>{}}/><Routes><Route path="/track-trace" element={<TrackTracePage/>}/><Route path="/upgrade" element={<main><h1>Existing upgrade pathway</h1><button onClick={()=>navigate('/app')}>Return home</button></main>}/><Route path="*" element={<main className="bg-[#F5F5F7] p-4"><HomeLanding selectedCar="Dwarf Cars" onChangeClass={()=>{}} onAction={()=>{}} actionGridSlot={<TrackTraceEntry userId={user.id} variant="landing"/>}/><SetupFixture/></main>}/></Routes>
<ViewSharedSetupModal isOpen={shared} user={user} onClose={()=>setShared(false)}/></>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><App/></BrowserRouter></QueryClientProvider>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},plugins:[{name:'synthetic-only',setup(b){b.onResolve({filter:/.*/},args=>args.path in modules?{path:args.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js',resolveDir:root}));}}],logLevel:'silent'}).then(r=>writeFile(path.join(output,'fixture.js'),r.outputFiles[0].contents));
const assets=path.resolve('tmp/track-trace-refinements/build/assets');
const styles=(await readdir(assets)).filter(f=>f.endsWith('.css'));
const css=(await Promise.all(styles.map(f=>readFile(path.join(assets,f),'utf8')))).join('\n').replace(/@import\s*(?:url\()?["'][^"']*["']\)?[^;]*;/g,'');
const fixture=`window.fixture={tier:'sportsman',prepared:false,links:{},standalone:[],calls:[],async rpc(name,args){
const saved={id:'saved-session',name:'Saved circuit session',session_name:'Saved circuit session',track_map_id:'circuit',track_name:'Saved oval',created_at:'2026-11-14T00:00:00Z',started_at:null,lap_count:1,fastest_lap_ms:12345};
const second={...saved,id:'second-session',name:'Second circuit recording',session_name:'Second circuit recording'};
const prepared={...saved,id:'prepared-session',name:'Prepared from menu',session_name:'Prepared from menu'};
const context=session=>({session,laps:session.id!=='saved-session'?[]:[{id:'lap1',lap_number:1,duration_ms:12345,is_valid:true}],sectors:[],analysis:[]});
if(name==='get_onlyfast_2027_setup_edit_state')return{editable:true};
if(name==='list_user_setup_summaries')return[{id:'setup-heat',setup_name:'Race weekend',setup_type:'heat',session_label:'Heat',race_weekend_id:'weekend',race_class:'Dwarf Cars'},{id:'base',setup_name:'Base template',setup_type:'base_template',race_weekend_id:null}];
if(name==='list_track_trace_sessions')return args.p_setup_id?(this.prepared?[prepared]:[]):[saved,...this.standalone,...(this.prepared?[prepared]:[])];
if(name==='create_track_trace_session'){this.calls.push(args);if(!args.p_setup_id){const session={...prepared,id:'standalone-'+this.standalone.length,name:args.p_name,session_name:args.p_name,track_map_id:args.p_track_map_id};this.standalone.push(session);return session.id}this.prepared=true;return prepared.id}
if(name==='get_track_trace_session')return context(this.standalone.find(x=>x.id===args.p_session_id)||(args.p_session_id===prepared.id?prepared:saved));
if(name==='get_track_trace_setup_context')return{linked:!!this.links[args.p_setup_id],context:context(this.links[args.p_setup_id]===second.id?second:saved)};
if(name==='list_track_trace_tracks')return[{id:'circuit',name:'Saved oval',track_name:'Saved oval',version:3,track_shape:'oval',track_length_meters:400,start_finish_path:[{lat:35,lng:-118},{lat:35.1,lng:-118}],outside_path:[],can_select:true,user_sectors:[],sector_defaults:[{sector_count:3,version:2}]}];
if(name==='list_track_trace_link_candidates'){const current=this.links[args.p_setup_id]||null;return{setup_id:args.p_setup_id,editable:true,current_session_id:current,current_session:current===saved.id?saved:current===second.id?second:null,missing_session:false,candidates:[saved,second].map(x=>({...x,linked_elsewhere:Object.entries(this.links).some(([setup,id])=>id===x.id&&setup!==args.p_setup_id)}))}}
if(name==='set_track_trace_session_link'){if((this.links[args.p_setup_id]||null)!==args.p_expected_session_id)throw Error('Stale link');this.links[args.p_setup_id]=args.p_session_id;return{action:args.p_session_id?'linked':'unlinked'}}
throw Error('Unexpected fixture API '+name)}};`;

const server=createServer(async(req,res)=>{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(output,'fixture.js')));}
  else if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else if(req.url?.startsWith('/onlyfast-logo.png')){res.setHeader('Content-Type','image/png');res.end(await readFile('public/onlyfast-logo.png'));}
  else if(req.url?.endsWith('.png')||req.url?.endsWith('.svg')){
    const publicRoot=path.resolve('public'),target=path.resolve(publicRoot,'.'+new URL(req.url,'http://localhost').pathname);
    if(!target.startsWith(publicRoot+path.sep)){res.statusCode=404;res.end();return;}
    try{res.setHeader('Content-Type',target.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(target));}catch{res.statusCode=404;res.end();}
  }
  else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>'+fixture+'</script><script src="/fixture.js"></script></body></html>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={kind:'synthetic UI browser checks; hosted acceptance reported separately',viewports:[],errors:[],external:[]};
try{
  for(const width of [320,360,390,640,768,1024,1280]){
    const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();page.setDefaultTimeout(12000);await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(success,failure)=>failure({code:1})});page.on('dialog',d=>d.accept());
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();report.external.push(u.origin);return route.abort()});page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(origin+'/app');
    const actions=page.getByRole('region',{name:'Home actions'});const original=['New Setup','Continue Saved Setup','Schedule','To-Do List','Parts Reference','Setup Library'];
    assert.deepEqual(await actions.getByRole('button').allTextContents(),original);
    const telemetry=actions.getByRole('link',{name:/Track Trace Telemetry/});await telemetry.waitFor();assert.equal(await telemetry.getAttribute('href'),'/upgrade');
    const bounds=await actions.boundingBox(),button=await telemetry.boundingBox(),sixth=await actions.getByRole('button',{name:'Setup Library',exact:true}).boundingBox();
    assert(Math.abs(bounds.width-button.width)<2,'Telemetry spans the grid');assert(button.y>=sixth.y+sixth.height,'Telemetry is below all six');assert.equal(button.height,sixth.height,'Height matches the standard Setup Library card');const standardIcon=actions.getByRole('button',{name:'Setup Library',exact:true}).locator('svg'),traceIcon=telemetry.locator('svg').first();assert.equal((await standardIcon.boundingBox()).width,(await traceIcon.boundingBox()).width);assert.equal(await standardIcon.getAttribute('stroke-width'),await traceIcon.getAttribute('stroke-width'));const padding=locator=>locator.evaluate(el=>{const c=getComputedStyle(el);return[c.paddingTop,c.paddingBottom,c.paddingLeft,c.paddingRight]});assert.deepEqual(await padding(telemetry),await padding(actions.getByRole('button',{name:'Setup Library',exact:true})));
    await page.screenshot({path:path.join(output,'sportsman-'+width+'.png'),fullPage:true});
    await telemetry.click();await page.getByRole('heading',{name:'Existing upgrade pathway'}).waitFor();await page.getByRole('button',{name:'Return home'}).click();
    for(const tier of ['pro','factory']){
      await page.getByRole('button',{name:tier,exact:true}).click();await actions.getByRole('link',{name:/^Track Trace Telemetry/}).click();
      const menu=page.getByRole('region',{name:'Track Trace menu'});await menu.waitFor();assert.equal(await menu.getByRole('button').count(),4);
      const cards=await menu.getByRole('button').all();const boxes=await Promise.all(cards.map(c=>c.boundingBox()));assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[2].y,boxes[3].y);assert(boxes[2].y>boxes[0].y);
      await page.screenshot({path:path.join(output,tier+'-menu-'+width+'.png'),fullPage:true});
      await menu.getByRole('button',{name:/Start Session/}).click();await page.getByRole('button',{name:'Link to Existing Setup',exact:true}).waitFor();await page.getByRole('button',{name:'Record Without Setup',exact:true}).click();await page.getByLabel('Session name',{exact:true}).fill(tier+' Free Record');await page.getByRole('radio',{name:/^Free Record/}).check();await page.getByRole('button',{name:'Save circuit session',exact:true}).click();await page.getByRole('heading',{name:tier+' Free Record',exact:true}).waitFor();await page.getByText('0 laps · 0 sector results',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Back to Track Trace menu',exact:true}).click();await menu.getByRole('button',{name:/Review Session/}).click();await page.getByRole('button',{name:new RegExp(tier+' Free Record')}).click();await page.getByRole('heading',{name:tier+' Free Record',exact:true}).waitFor();
      await page.getByRole('button',{name:'Back to Track Trace menu',exact:true}).click();await menu.getByRole('button',{name:/Start Session/}).click();await page.getByRole('button',{name:'Record Without Setup',exact:true}).click();await page.getByLabel('Session name',{exact:true}).fill(tier+' Mapped session');await page.getByRole('radio',{name:'Saved circuit track',exact:true}).check();await page.getByRole('button',{name:'Use this track',exact:true}).click();assert.equal(await page.getByLabel('Session name',{exact:true}).inputValue(),tier+' Mapped session');await page.getByText('Saved oval · Version 3 · 400 m',{exact:true}).waitFor();await page.getByRole('button',{name:'Save circuit session',exact:true}).click();await page.getByRole('heading',{name:tier+' Mapped session',exact:true}).waitFor();
      await page.screenshot({path:path.join(output,tier+'-standalone-'+width+'.png'),fullPage:true});
      assert(await page.evaluate(()=>window.fixture.calls.some(a=>a.p_setup_id===null&&a.p_track_map_id===null)&&window.fixture.calls.some(a=>a.p_setup_id===null&&a.p_track_map_id==='circuit')));
      await page.getByRole('button',{name:'Back to Track Trace menu',exact:true}).click();await menu.getByRole('button',{name:/Review Session/}).click();await page.getByRole('button',{name:/Saved circuit session/}).click();await page.getByText('Lap 1: 12.345 s',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Back to Track Trace menu'}).click();await menu.getByRole('button',{name:/Track Library/}).click();await page.getByRole('heading',{name:'Saved oval',exact:true}).waitFor();await page.getByText('3 sectors · definition version 2').waitFor();await page.getByText('Start/finish: Saved line',{exact:true}).waitFor();await page.getByRole('button',{name:'Use this track',exact:true}).click();assert(new URL(page.url()).searchParams.get('track')==='circuit');
      await page.getByRole('button',{name:'Back to Track Trace menu'}).click();await menu.getByRole('button',{name:/Scan Track/}).click();await page.getByText('Track scanning has not been integrated into OnlyFast Track Trace yet.').waitFor();await page.getByRole('button',{name:'Check GPS availability',exact:true}).click();await page.getByText(/GPS permission denied/).waitFor();
      await page.getByRole('link',{name:'Back to OnlyFast'}).click();
    }
    await page.getByRole('link',{name:/^Track Trace Telemetry/}).click();await page.getByRole('button',{name:/Start Session/}).click();
    await page.getByRole('button',{name:'Link to Existing Setup',exact:true}).click();await page.getByRole('button',{name:/Race weekend Heat/}).click();await page.getByRole('heading',{name:'Prepare a circuit session'}).waitFor();
    await page.getByLabel('Session name',{exact:true}).fill('Prepared from menu');await page.getByRole('button',{name:'Save circuit session',exact:true}).click();await page.getByRole('heading',{name:'Prepared from menu',exact:true}).waitFor();
    await page.getByRole('link',{name:'Back to OnlyFast'}).click();
    const setup=page.getByRole('region',{name:'Setup fixture'});await setup.getByLabel('Unsaved setup note').fill('Keep these setup edits');
    await setup.getByRole('button',{name:'Link Track Trace Telemetry',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Saved circuit session/}).click();await setup.getByRole('button',{name:'View telemetry',exact:true}).click();await page.getByRole('dialog').getByText('Lap 1: 12.345 s',{exact:true}).waitFor();await page.keyboard.press('Escape');
    assert.equal(await setup.getByLabel('Unsaved setup note').inputValue(),'Keep these setup edits');
    await setup.getByRole('button',{name:'Heat',exact:true}).click();await setup.getByRole('button',{name:'Link Track Trace Telemetry',exact:true}).click();assert(await page.getByRole('dialog').getByRole('button',{name:/Saved circuit session/}).isDisabled());await page.getByRole('dialog').getByRole('button',{name:/Second circuit recording/}).click();
    await setup.getByRole('button',{name:'Main',exact:true}).click();await setup.getByText('No telemetry linked to this individual setup session.').waitFor();await setup.getByRole('button',{name:'Hot Laps',exact:true}).click();await setup.getByRole('button',{name:'Unlink telemetry',exact:true}).click();await setup.getByText('No telemetry linked to this individual setup session.').waitFor();assert.equal(await setup.getByLabel('Unsaved setup note').inputValue(),'Keep these setup edits');
    await page.screenshot({path:path.join(output,'setup-linking-'+width+'.png'),fullPage:true});
    await page.getByRole('button',{name:'Open menu',exact:true}).click();let nav=page.getByRole('navigation',{name:'App sections'});
    const navText=await nav.getByRole('button').allTextContents();const i=navText.findIndex(s=>s.startsWith('View Shared Setup'));assert(navText[i+1].startsWith('View Shared Telemetry'));assert(navText[i+2].startsWith('How OnlyFast Works'));
    await nav.getByRole('button',{name:/View Shared Telemetry/}).click();await page.getByRole('dialog',{name:'View Shared Telemetry'}).waitFor();await page.getByText('Telemetry sharing is not available yet').waitFor();
    assert.equal(await page.getByRole('dialog').getByRole('textbox').count(),0);await page.screenshot({path:path.join(output,'shared-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Open menu',exact:true}).click();await nav.getByRole('button',{name:/View Shared Setup/}).click();await page.getByRole('dialog',{name:'View Shared Setup'}).waitFor();await page.getByLabel('Share Code',{exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'sportsman',exact:true}).click();await page.getByRole('button',{name:'Open menu',exact:true}).click();await nav.getByRole('button',{name:/View Shared Telemetry/}).click();await page.getByRole('heading',{name:'Existing upgrade pathway'}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
    report.viewports.push({width,passed:true,gridWidth:bounds.width,telemetryWidth:button.width,standardHeight:sixth.height,telemetryHeight:button.height});await context.close();
  }
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
