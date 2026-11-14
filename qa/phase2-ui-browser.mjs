// Local browser UI fixture, explicitly NOT hosted/Supabase acceptance. No real
// credentials or service keys. All remote requests are blocked by Playwright.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
if(!process.env.ONLYFAST_PLAYWRIGHT_MODULE)throw Error('Set ONLYFAST_PLAYWRIGHT_MODULE to an installed Playwright 1.56.1 module.');
const {chromium}=require(process.env.ONLYFAST_PLAYWRIGHT_MODULE);
const out=path.join(root,'tmp','phase2-ui-browser');await mkdir(out,{recursive:true});
const modules={
  '@/lib/supabase':`export const supabaseUrl='https://mfzajhnfonrfuiwxgvhe.supabase.co',supabaseKey='synthetic-ui-key'; export const supabase=window.fixture.supabase;`,
  '@/lib/setupLibraryAccess':`export const canAccessSetupClass=()=>true; export const getSelectableSetupClasses=()=>['Dwarf Cars','Modified'];`,
  '@/hooks/useMembershipRevision':`import {useSyncExternalStore} from 'react';export const useMembershipRevision=()=>useSyncExternalStore(cb=>{window.addEventListener('membership-updated',cb);return()=>window.removeEventListener('membership-updated',cb)},()=>window.fixture.revision);`,
};
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';
import SavedSetups from './src/components/SavedSetups';import TestingAccountAccess from './src/components/TestingAccountAccess';
import TimingDataDisplay from './src/components/TimingDataDisplay';
import TrackTracePage from './src/features/track-trace/TrackTracePage';
import {MemoryRouter,Link} from 'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
function App(){const[selected,setSelected]=React.useState(null);return <main className="mx-auto max-w-3xl p-4 space-y-4">
<h1 className="text-xl font-bold">Local synthetic archive UI fixture</h1><p>No Supabase connection or real accounts. Hosted acceptance remains required.</p>
<nav className="flex flex-wrap gap-2">{['sportsman','pro','factory','unsubscribed'].map(t=><button className="border rounded p-2" key={t} onClick={()=>window.fixture.tier(t)}>{t}</button>)}</nav>
<TestingAccountAccess/><SavedSetups user={{id:'ui-user'}} onLoad={setSelected} onLoadBaseSetup={setSelected} onUpgrade={()=>{}} refreshTrigger={0} activeClass="Dwarf Cars" classLocksEnabled onDataChanged={()=>{}}/>
{selected&&<section aria-label="Loaded saved contents"><p>Saved notes: {selected.notes}</p><TimingDataDisplay timingData={{lap_times:[{lap:1,time:'15.123'}]}} setupType="heat"/></section>}
<section aria-label="Historical telemetry fixture"><MemoryRouter initialEntries={['/track-trace?view=review']}><Link to="/track-trace?view=start&setup=active">Attempt session preparation</Link><Link to="/track-trace?view=review">Return to history</Link><TrackTracePage/></MemoryRouter></section></main>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><App/></QueryClientProvider>);`,loader:'tsx',resolveDir:root},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'import.meta.env.ONLYFAST_2027_PREVIEW':'true','import.meta.env.ONLYFAST_2027_APP':'true'},alias:{'@':path.join(root,'src')},plugins:[{name:'local-synthetic-backend',setup(b){b.onResolve({filter:/^@\//},args=>args.path in modules?{path:args.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js',resolveDir:root}));}}],logLevel:'silent'}).then(result=>writeFile(path.join(out,'fixture.js'),result.outputFiles[0].contents));
const cssFile=(await readdir(path.join(root,'tmp/phase2-build/assets'))).find(f=>/^(index|main)-.*\.css$/.test(f));
assert(cssFile,'Build the isolated app into tmp/phase2-build first.');
const css=(await readFile(path.join(root,'tmp/phase2-build/assets',cssFile),'utf8'))
  .replace(/@import\s*(?:url\()?["'][^"']*["']\)?[^;]*;/g,'');
const fixture=`(()=>{const initial={tier:'sportsman',archived:true,pending:false,activeClass:'Dwarf Cars'};const state=JSON.parse(sessionStorage.getItem('localArchiveFixture')||'null')||initial;
const persist=()=>sessionStorage.setItem('localArchiveFixture',JSON.stringify(state));const fire=()=>{persist();window.fixture.revision++;window.dispatchEvent(new Event('membership-updated'))};
const rows=()=>['active','archived'].map((id,index)=>({id,setup_type:'base_template',setup_name:index?'Archived baseline':'Active baseline',race_class:'Dwarf Cars',created_at:'2026-11-01',notes:'Permanent racing notes',archived_at:index&&state.archived?'2026-11-02':null,access:{tier:state.tier,readable:!index||!state.archived||['pro','factory'].includes(state.tier),editable:(!index||!state.archived)&&state.tier!=='unsubscribed'&&!state.pending,counts:{base:state.archived?1:2,regular:0}}}));
const paid=()=>['pro','factory'].includes(state.tier);const historical=()=>[{id:'independent-history',name:'Independent historical circuit',session_type:'practice'},...(state.archived&&!paid()?[]:[{id:'linked-history',name:state.archived?'Archived linked circuit':'Restored linked circuit',session_type:'practice'}])];
const backend=async(name,args={})=>{let data=null;if(name==='list_user_setup_summaries')data=rows();else if(name==='get_track_trace_permission')data={feature:'track_trace',allowed:true,can_read_history:true,can_record:paid(),can_modify:paid(),can_read_archived:paid(),read_only:!paid(),tier:state.tier};else if(name==='list_track_trace_sessions')data=historical();else if(name==='get_track_trace_session'){const s=historical().find(s=>s.id===args.p_session_id);if(!s)return{error:{message:'SESSION_NOT_FOUND'},data:null};data={session:s,laps:[{id:'history-lap',lap_number:1,duration_ms:15555,is_valid:true}],sectors:[{lap_id:'history-lap',sector_index:1,duration_ms:7000}],analysis:[{id:'history-analysis',summary_text:'Retained historical analysis'}]};}else if(name==='get_onlyfast_2027_setup_edit_state')data={editable:paid()&&!state.pending&&args.p_setup_id==='active'};else data={tier:state.tier,selection_required:state.pending,active_class:state.activeClass};return{error:null,data}};
const session=()=>({user:{id:'ui-user'},access_token:'synthetic-token'});window.fixture={revision:0,rows,tier(t){state.pending=state.tier==='factory'&&['sportsman','pro'].includes(t);state.tier=t;fire()},supabase:{auth:{getSession:async()=>({data:{session:session()}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:backend,functions:{invoke:async()=>({data:{linked:false},error:null})},from:()=>{const q={select(){return q},eq(){return q},in:async(_,ids)=>({data:rows().filter(r=>ids.includes(r.id)&&r.access.readable),error:null})};return q}}};
const fetchOriginal=window.fetch;window.fetch=async(input,opts)=>{if(String(input).startsWith('https://mfzajhnfonrfuiwxgvhe.supabase.co/rest/v1/rpc/')){const body=JSON.parse(opts.body);if(String(input).endsWith('choose_onlyfast_2027_class')){state.activeClass=body.p_class;state.pending=false;persist();return new Response(JSON.stringify(body.p_class),{status:200})}state.archived=body.p_archive;persist();return new Response(JSON.stringify({archived_at:state.archived?'2026-11-02':null,changed:true}),{status:200})}return fetchOriginal(input,opts)};})();`;
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>${fixture}</script><script src="/fixture.js"></script></body></html>`;
const server=createServer(async(req,res)=>{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(out,'fixture.js')));}
  else if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else{res.setHeader('Content-Type','text/html');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.ONLYFAST_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={kind:'local synthetic browser fixture; not hosted acceptance',viewports:[],remoteRequests:[],consoleErrors:[]};
try{
  for(const viewport of [{width:1280,height:900},{width:375,height:812}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();page.setDefaultTimeout(8000);
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();report.remoteRequests.push(route.request().url());return route.abort();});
    page.on('pageerror',e=>{report.consoleErrors.push(e.message);console.error('Fixture page error: '+e.message)});
    await page.goto(origin);await page.getByLabel('Saved setups list').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    const archived=page.getByRole('button',{name:'Archived baseline is archived and locked',exact:true});await archived.click();
    await page.getByText(/Archived setups cannot be opened/).waitFor();
    assert.equal(await page.getByLabel('Loaded saved contents').count(),0);
    const trace=page.getByLabel('Historical telemetry fixture');
    await trace.getByRole('button',{name:/Independent historical circuit/}).click();
    await trace.getByText('Lap 1: 15.555 s',{exact:true}).waitFor();
    await trace.getByText('Retained historical analysis',{exact:true}).waitFor();
    assert.equal(await trace.getByRole('button',{name:/Archived linked circuit/}).count(),0);
    await trace.getByRole('link',{name:'Attempt session preparation'}).click();
    await trace.getByRole('link',{name:'View saved telemetry'}).waitFor();
    assert.equal(await trace.getByRole('button',{name:'Save circuit session',exact:true}).count(),0);
    await trace.getByRole('link',{name:'Return to history'}).click();
    await page.screenshot({path:path.join(out,viewport.width+'-sportsman.png'),fullPage:true});
    await page.getByRole('button',{name:'pro',exact:true}).click();
    await trace.getByRole('button',{name:/Archived linked circuit/}).waitFor();
    await trace.getByRole('button',{name:/Archived linked circuit/}).click();
    await trace.getByRole('heading',{name:'Archived linked circuit',exact:true}).waitFor();
    await page.getByRole('button',{name:'sportsman',exact:true}).click();
    await trace.getByText(/^Your saved telemetry is read-only/).waitFor();
    assert.equal(await trace.getByRole('button',{name:/Archived linked circuit/}).count(),0);
    assert.equal(await trace.getByLabel('Session review').count(),0,'downgrade clears previously loaded archived details');
    await page.getByRole('button',{name:'pro',exact:true}).click();
    await trace.getByRole('button',{name:/Archived linked circuit/}).waitFor();
    await page.getByRole('button',{name:'Open Archived baseline',exact:true}).click();
    await page.getByText('Saved notes: Permanent racing notes').waitFor();
    const laps=page.getByRole('button',{name:/Lap-by-lap times/});await laps.click();await page.getByText('15.123',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Restore Setup',exact:true}).click();await page.getByRole('alertdialog').waitFor();
    await page.getByRole('alertdialog').getByRole('button',{name:'Restore Setup',exact:true}).click();await page.getByText('Setup restored.',{exact:true}).waitFor();
    const activeCard=page.getByRole('button',{name:'Open Active baseline',exact:true});await activeCard.getByRole('button',{name:'Archive Setup',exact:true}).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('alertdialog').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
    await page.screenshot({path:path.join(out,viewport.width+'-confirmation.png'),fullPage:false});
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'factory',exact:true}).click();await page.getByRole('button',{name:'sportsman',exact:true}).click();
    await page.getByRole('heading',{name:'Choose your active racing class'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Confirm active class'}).isDisabled(),true);
    await page.getByLabel('Active racing class',{exact:true}).selectOption('Modified');
    await page.getByRole('button',{name:'Confirm active class'}).click();
    await page.getByLabel('Saved setups list').waitFor();await page.getByRole('heading',{name:'Choose your active racing class'}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'unsubscribed',exact:true}).click();await page.getByText(/Your account is read-only/).waitFor();
    await trace.getByRole('button',{name:/Independent historical circuit/}).click();
    await trace.getByText('Lap 1: 15.555 s',{exact:true}).waitFor();
    await trace.screenshot({path:path.join(out,viewport.width+'-history.png')});
    assert.equal(await page.getByRole('button',{name:'Archive Setup',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    report.viewports.push({viewport,status:'passed',checks:16});await context.close();
  }
  assert.deepEqual(report.remoteRequests,[]);assert.deepEqual(report.consoleErrors,[]);
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
