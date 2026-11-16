import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { TRACK_TRACE_CONFIG } from '../src/features/track-trace/config.ts';
import { getTrackTraceGpsFix } from '../src/features/track-trace/gpsAvailability.ts';

const require=createRequire(import.meta.url);
const {create,act}=require('react-test-renderer');
const {QueryClient,QueryClientProvider}=require('@tanstack/react-query');
function module(file:string,modules:Record<string,unknown>) {
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const out:any={};new Function('require','exports',js)((name:string)=>{
    if(name in modules)return modules[name];
    if(['react','react/jsx-runtime','@tanstack/react-query','lucide-react'].includes(name))return require(name);
    throw Error('Unstubbed Phase2B UI dependency '+name);
  },out);return out;
}
const text=(node:any):string=>node==null?'':typeof node==='string'?node:(Array.isArray(node)?node:node.children||[]).map(text).join('');

test('central beta configuration controls badges and exact beta information without tier differences',()=>{
  for(const beta of [true,false]){
    const view=module('features/track-trace/TrackTraceBeta.tsx',{'@/components/ui/badge':{badgeVariants:()=> 'existing-onlyfast-badge'},'./config':{TRACK_TRACE_CONFIG:{...TRACK_TRACE_CONFIG,beta}}});
    const badge=renderToStaticMarkup(React.createElement(view.TrackTraceBetaBadge));
    const notice=renderToStaticMarkup(React.createElement(view.TrackTraceBetaNotice));
    assert.equal(badge.includes('BETA'),beta);assert.equal(notice.includes(TRACK_TRACE_CONFIG.betaMessage),beta);
    if(beta){
      const discipline=readFileSync(new URL('../src/components/OnboardingFlow.tsx',import.meta.url),'utf8').match(/className="([^"]+)"\>BETA<\/span>/)![1];
      const change=readFileSync(new URL('../src/components/ClassChangeModal.tsx',import.meta.url),'utf8').match(/className="([^"]+)"\>BETA<\/span>/)![1];
      const styles=(s:string)=>s.split(' ').filter(x=>!['ml-2','shrink-0'].includes(x)).sort();
      assert.deepEqual(styles(discipline),styles(change));
      assert.deepEqual(styles(badge.match(/class="([^"]+)"/)![1]),styles(discipline));
    }
  }
  assert.equal(TRACK_TRACE_CONFIG.liveRecordingValidated,false);assert.equal(TRACK_TRACE_CONFIG.scanningIntegrated,true);
});

test('reused GPS fix adapter handles unsupported, denied and timeout errors without starting a watch or recording',async()=>{
  await assert.rejects(getTrackTraceGpsFix(undefined),/GPS is not available/);
  for(const [code,message] of [[1,/permission denied/],[3,/precise GPS fix/]] as const){
    let options:any;
    await assert.rejects(getTrackTraceGpsFix({getCurrentPosition:(_success,error,opts)=>{options=opts;error!({code} as GeolocationPositionError);}}),message);
    assert.deepEqual(options,{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  }
  const fix=await getTrackTraceGpsFix({getCurrentPosition:success=>success({coords:{latitude:35,longitude:-118,accuracy:7},timestamp:0} as GeolocationPosition)});
  assert.deepEqual(fix,{lat:35,lng:-118,accuracy:7,timestamp:'1970-01-01T00:00:00.000Z'});
});

function linkHarness(tier='pro') {
  let current:string|null=null,fail=false,missing=false,calls:any[]=[],saves=0;
  const candidate=(id:string)=>({id,name:'Recording '+id,created_at:'2026-11-14',started_at:'2026-11-14',track_name:'Circuit',lap_count:4,fastest_lap_ms:12345});
  const Dialog=({open,children}:any)=>open?React.createElement('div',{role:'dialog'},children):null;
  const pass=({children}:any)=>React.createElement('div',{},children);
  const link=module('features/track-trace/TrackTraceSessionLink.tsx',{
    'react-router-dom':{Link:({to,children,...props}:any)=>React.createElement('a',{href:to,...props},children)},
    '@/components/ui/dialog':{Dialog,DialogContent:pass,DialogHeader:pass,DialogTitle:pass,DialogDescription:pass},
    '@/lib/onlylapsSessionScope':{notifyOnlyLapsSessionLinkChanged:(id:string)=>calls.push({event:id})},
    './api':{traceRpc:async(name:string,args:any)=>{
      if(fail)throw Error('offline');
      if(name==='set_track_trace_session_link'){calls.push({name,args});current=args.p_session_id;return{action:current?'linked':'unlinked'};}
      return{setup_id:args.p_setup_id,current_session_id:current,current_session:current&&!missing?candidate(current):null,missing_session:missing,editable:true,candidates:[candidate('a'),candidate('b')],offset:0};
    }},
    './useTrackTrace':{useTrackTracePermission:()=>({allowed:true,fullAccess:['pro','factory'].includes(tier),navigationLocked:!['pro','factory'].includes(tier),revision:0})},
    './TrackTraceBeta':{TrackTraceBetaBadge:()=>React.createElement('span',{},'BETA')},
    './TrackTraceSessionReview':{__esModule:true,default:()=>React.createElement('p',{},'In-place review')},
  }).default;
  function Parent(){const[draft,setDraft]=React.useState('unsaved chassis');return React.createElement('main',{},
    React.createElement('input',{value:draft,onChange:(e:any)=>setDraft(e.target.value),'aria-label':'Core setup draft'}),
    React.createElement('button',{onClick:()=>saves++},'Save setup'),React.createElement(link,{userId:'owner',setupId:'setup-heat'}));}
  const query=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});let tree:any;
  const settle=async(fn?:()=>unknown)=>act(async()=>{if(fn)await fn();await new Promise(resolve=>setTimeout(resolve,10));});
  const button=(label:string)=>tree.root.findAllByType('button').find((node:any)=>text(node)===label);
  return {get tree(){return tree;},get calls(){return calls;},get saves(){return saves;},button,settle,
    async mount(){await settle(()=>{tree=create(React.createElement(QueryClientProvider,{client:query},React.createElement(Parent)));});},
    async close(){await settle(()=>tree.unmount());query.clear();},
    async fail(){fail=true;await settle(()=>query.invalidateQueries({queryKey:['track_trace']}));},
    missing(){current='gone';missing=true;},
  };
}
for(const tier of ['pro','factory'])test(tier+' can link, review, replace and unlink while unsaved setup edits stay mounted',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{confirm:()=>true}});
  const f=linkHarness(tier);
  try{
    await f.mount();await f.settle(()=>f.tree.root.findByType('input').props.onChange({target:{value:'unedited draft survives'}}));
    await f.settle(()=>f.button('Link Track Trace Telemetry').props.onClick());
    // Choose by candidate name so locale formatting is not a test dependency.
    await f.settle(()=>f.tree.root.findAllByType('button').find((n:any)=>text(n).startsWith('Recording a')).props.onClick());
    assert.equal(f.calls.find(c=>c.name).args.p_setup_id,'setup-heat');
    assert.equal(f.tree.root.findByType('input').props.value,'unedited draft survives');
    await f.settle(()=>f.button('View telemetry').props.onClick());assert.match(text(f.tree.toJSON()),/In-place review/);
    await f.settle(()=>f.button('Change linked session').props.onClick());await f.settle(()=>f.tree.root.findAllByType('button').find((n:any)=>text(n).startsWith('Recording b')).props.onClick());
    assert.equal(f.calls.filter(c=>c.name).at(-1).args.p_expected_session_id,'a');
    await f.settle(()=>f.button('Unlink telemetry').props.onClick());assert.equal(f.calls.filter(c=>c.name).at(-1).args.p_session_id,null);
    assert.equal(f.tree.root.findByType('input').props.value,'unedited draft survives');
    await f.settle(()=>f.button('Save setup').props.onClick());assert.equal(f.saves,1);
    await f.fail();assert.match(text(f.tree.toJSON()),/setup edits and saves are unaffected/);
    await f.settle(()=>f.button('Save setup').props.onClick());assert.equal(f.saves,2);
  }finally{await f.close();if(previous)Object.defineProperty(globalThis,'window',previous);else delete (globalThis as any).window;}
});
test('Sportsman sees a locked linking control; missing linked telemetry is isolated from the setup editor',async()=>{
  const f=linkHarness('sportsman');try{await f.mount();assert.match(text(f.tree.toJSON()),/Upgrade to Pro to Unlock/);assert.equal(f.calls.length,0);}finally{await f.close();}
  const missing=linkHarness();missing.missing();try{await missing.mount();assert.match(text(missing.tree.toJSON()),/recording is missing or no longer available/);assert.equal(missing.tree.root.findByType('input').props.value,'unsaved chassis');}finally{await missing.close();}
});
