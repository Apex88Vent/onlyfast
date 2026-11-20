import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as homeActionStyles from '../src/components/homeActionStyles.ts';

const require=createRequire(import.meta.url);
function component(file: string, modules: Record<string,unknown>={}, exportName='default') {
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const result: any={};
  new Function('require','exports',js)((name:string)=>{
    if(name in modules)return modules[name];
    if(name.endsWith('/homeActionStyles')||name==='./homeActionStyles')return homeActionStyles;
    if(name==='./TrackTraceBeta')return {TrackTraceBetaBadge:component('features/track-trace/TrackTraceBeta.tsx',{'@/components/ui/badge':{badgeVariants:()=> 'existing-badge'},'./config':{TRACK_TRACE_CONFIG:{beta:true,betaMessage:'Track Trace is currently in beta.'}}},'TrackTraceBetaBadge'),TrackTraceBetaNotice:()=>null};
    if(['react','react/jsx-runtime','lucide-react'].includes(name))return require(name);
    throw Error('Unexpected UI dependency '+name);
  },result);
  return result[exportName];
}
const html=(Component:React.ComponentType<any>,props={})=>renderToStaticMarkup(React.createElement(Component,props));
function entry(allowed:boolean|undefined,enabled=true,readOnly=false) {
  return component('features/track-trace/TrackTraceEntry.tsx',{
    './api':{trackTraceEnabled:enabled,TRACK_TRACE_NAME:'OnlyFast Track Trace'},
    './useTrackTrace':{useTrackTracePermission:()=>({allowed:allowed===true,fullAccess:allowed===true&&!readOnly,navigationLocked:allowed===false||readOnly,data:allowed===undefined?undefined:{allowed,can_read_history:allowed,read_only:readOnly}})},
    'react-router-dom':{Link:({to,children,...props}:any)=>React.createElement('a',{href:to,...props},children)},
  });
}

test('landing preserves all six original actions and places telemetry last across both columns',()=>{
  const Home=component('components/HomeLanding.tsx',{
    './ClassArtwork':{__esModule:true,default:()=>null},'@/lib/setupLibrary':{setupClassLabel:(s:string)=>s,EXPANDED_CLASS_CONFIGS:{},SETUP_CATEGORY_LABELS:{}},
  });
  const output=html(Home,{selectedCar:'',onChangeClass(){},onAction(){},actionGridSlot:React.createElement(entry(true),{userId:'owner',variant:'landing'})});
  const labels=['New Setup','Continue Saved Setup','Schedule','To-Do List','Parts Reference','Setup Library','Track Trace Telemetry'];
  let previous=-1;for(const label of labels){const at=output.indexOf('>'+label+'<');assert(at>previous,label+' retains its position');previous=at;}
  assert.match(output,/aria-label="Home actions"/);assert.match(output,/class="col-span-2 /);
  assert.equal((output.match(/Track Trace Telemetry/g)||[]).length,1);
});
for(const tier of ['pro','factory'])test(tier+' landing entry opens the existing route',()=>{
  const output=html(entry(true),{userId:'owner',variant:'landing'});
  assert.match(output,/href="\/track-trace"/);assert.doesNotMatch(output,/Upgrade to Pro to Unlock/);
});
test('Sportsman landing entry is visibly locked and opens upgrade; unresolved permission cannot open telemetry',()=>{
  const locked=html(entry(false),{userId:'owner',variant:'landing'});
  assert.match(locked,/href="\/upgrade"/);assert.match(locked,/Upgrade to Pro to Unlock/);assert.match(locked,/lucide-lock-keyhole/);
  const pending=html(entry(undefined),{userId:'owner',variant:'landing'});
  assert.match(pending,/disabled=""/);assert.doesNotMatch(pending,/href=/);
  assert.equal(html(entry(true,false),{userId:'owner',variant:'landing'}),'');
});
test('Track Trace menu contains exactly four actions in a 2x2 grid with circuit scanning',()=>{
  const Menu=component('features/track-trace/TrackTraceMenu.tsx');const output=html(Menu,{onSelect(){}});
  assert.equal((output.match(/<button /g)||[]).length,4);
  assert.match(output,/grid grid-cols-2/);
  for(const label of ['Start Session','Review Session','Track Library','Scan Track'])assert.match(output,new RegExp('>'+label+'<'));
  assert.match(output,/Capture a private circuit scan with GPS/);
});

test('read-only users have a historical viewing path while recording actions stay locked',()=>{
  const output=html(entry(true,true,true),{userId:'owner',variant:'landing'});
  assert.match(output,/href="\/track-trace\?view=review"/);assert.match(output,/View saved telemetry/);
  const Menu=component('features/track-trace/TrackTraceMenu.tsx');
  const menu=html(Menu,{onSelect(){},canRecord:false});
  assert.equal((menu.match(/disabled=""/g)||[]).length,2);assert.match(menu,/Review Session/);
});
test('Home menu inserts shared telemetry immediately after shared setup and keeps the existing subtitle/action',()=>{
  const Menu=component('components/AppMenu.tsx');
  for(const telemetryAccess of ['allowed','locked','pending']) {
    const output=html(Menu,{isOpen:true,onClose(){},onSelect(){},telemetryAccess});
    assert(output.indexOf('View Shared Setup')<output.indexOf('View Shared Telemetry'));
    assert(output.indexOf('View Shared Telemetry')<output.indexOf('How OnlyFast Works'));
    assert.match(output,/Enter a share code to view a setup/);assert.match(output,/Enter a share code to view telemetry/);
    assert.equal(output.includes('Upgrade to Pro to Unlock'),telemetryAccess==='locked');
  }
  assert.doesNotMatch(html(Menu,{isOpen:true,onClose(){},onSelect(){}}),/View Shared Telemetry/);
});

test('navigation uses the server full-access decision with both installed permission contracts',()=>{
  for(const [data,allowed,fullAccess] of [
    [{feature:'track_trace',allowed:true},true,true],
    [{feature:'track_trace',allowed:false},false,false],
    [{feature:'track_trace',allowed:true,can_read_history:true,can_record:false},true,false],
    [{feature:'track_trace',allowed:true,can_read_history:true,can_record:true},true,true],
  ] as [any,boolean,boolean][]) {
    const file=readFileSync(new URL('../src/features/track-trace/useTrackTrace.ts',import.meta.url),'utf8');
    const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const result:any={};const modules={react:React,'@tanstack/react-query':{useQuery:()=>({data,isError:false})},'@/lib/supabase':{},'@/hooks/useMembershipRevision':{useMembershipRevision:()=>1},'./api':{trackTraceEnabled:true}};
    new Function('require','exports',js)((name:string)=>modules[name],result);
    const access=result.useTrackTracePermission('owner');
    assert.equal(access.allowed,allowed);assert.equal(access.fullAccess,fullAccess);assert.equal(access.navigationLocked,!fullAccess);
  }
});
