import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import * as sessions from '../src/lib/raceWeekendSessions.ts';
import * as performance from '../src/lib/performanceSummary.ts';

const require=createRequire(import.meta.url);
const {create,act}=require('react-test-renderer');
const user={id:'archive-ui-user'};
const url='https://mfzajhnfonrfuiwxgvhe.supabase.co';
const text=(node:any):string=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children||[]).map(text).join('');
function compile(file:string,modules:Record<string,unknown>) {
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText;
  const output={exports:{} as any};
  new Function('require','module','exports',js)((name:string)=>{
    if(name==='react'||name.startsWith('react/'))return require(name);
    if(name in modules)return modules[name];
    throw Error('Unstubbed archive UI dependency '+name);
  },output,output.exports);
  return output.exports;
}
function harness(tier='sportsman',archived=true) {
  let rows:any[]=[{id:'saved-id',setup_type:'base_template',setup_name:'Archive UI baseline',race_class:'Dwarf Cars',created_at:'2026-11-01',
    archived_at:archived?'2026-11-02':null,access:{tier,editable:!archived&&tier!=='unsubscribed',readable:!archived||['pro','factory'].includes(tier),reason:archived?'archived':null,counts:{base:1,regular:0}}}];
  let loaded=0,reads=0;
  const supabase={auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic-ui-token'}}})},
    rpc:async()=>({data:rows,error:null}),from:()=>{reads++;return{select:()=>({eq:()=>({in:async()=>({data:[{...rows[0],notes:'Saved notes'}],error:null})})})};}};
  const passthrough=({children}:any)=>children;
  const dialog:any={AlertDialog:({open,children}:any)=>open?React.createElement('div',{role:'alertdialog'},children):null,
    AlertDialogAction:(props:any)=>React.createElement('button',props),AlertDialogCancel:(props:any)=>React.createElement('button',props)};
  for(const name of ['AlertDialogContent','AlertDialogHeader','AlertDialogTitle','AlertDialogDescription','AlertDialogFooter'])dialog[name]=passthrough;
  const Saved=compile('components/SavedSetups.tsx',{
    '@/lib/supabase':{supabase,supabaseUrl:url,supabaseKey:'synthetic-public-key'},
    '@/lib/setupLibrary':{setupClassLabel:(s:string)=>s},'@/lib/setupLibraryAccess':{canAccessSetupClass:()=>true},
    '@/lib/paymentVisibility':{isMedianIOSApp:false},'@/lib/raceWeekendSessions':sessions,
    '@/hooks/useMembershipRevision':{useMembershipRevision:()=>0},'@/components/ui/alert-dialog':dialog,
  }).default;
  const props={user,onLoad:()=>loaded++,onLoadBaseSetup:()=>loaded++,onUpgrade:()=>{},onDataChanged:()=>{},refreshTrigger:0,activeClass:'Dwarf Cars',classLocksEnabled:true};
  return {Saved,props,rows,get loaded(){return loaded;},get reads(){return reads;},restore(){rows=rows.map(r=>({...r,archived_at:null,access:{...r.access,editable:true,reason:null}}));}};
}

test('archive cards: Sportsman gray card, lock, explanation and no content fetch',async()=>{
  const h=harness();let view:any;
  await act(async()=>{view=create(React.createElement(h.Saved,h.props));});
  const card=view.root.findByType('li');
  assert(card.props.className.includes('bg-[#E5E7EB]'));
  assert.match(card.props['aria-label'],/archived and locked/);
  assert(view.root.findAllByProps({'aria-label':'Locked setup'}).length);
  await act(async()=>card.props.onClick());
  assert.match(text(view.toJSON()),/cannot be opened, edited, or restored on Sportsman/);
  assert.equal(h.reads,0);assert.equal(h.loaded,0);
  assert.equal(view.root.findAllByType('button').filter((n:any)=>/Restore Setup|Archive Setup|Delete base/.test(text(n))).length,0);
  await act(async()=>view.unmount());
});

test('archive cards: Pro can view saved contents and restore only after confirmation; duplicate clicks make one request',async()=>{
  const h=harness('pro');let view:any;let requests=0;let finish:any;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{requests++;await new Promise(resolve=>{finish=resolve;});h.restore();return{ok:true,json:async()=>({archived_at:null,changed:true})} as Response;};
  try {
    await act(async()=>{view=create(React.createElement(h.Saved,h.props));});
    await act(async()=>view.root.findByType('li').props.onClick());assert.equal(h.loaded,1);
    const restore=view.root.findAllByType('button').find((n:any)=>text(n)==='Restore Setup');
    await act(async()=>restore.props.onClick({stopPropagation(){}}));
    assert.equal(requests,0,'opening confirmation never mutates');
    const confirm=view.root.findByProps({role:'alertdialog'}).findAllByType('button').find((n:any)=>text(n)==='Restore Setup');
    await act(async()=>{confirm.props.onClick({preventDefault(){}});confirm.props.onClick({preventDefault(){}});await Promise.resolve();});
    assert.equal(requests,1);assert.equal(confirm.props.disabled,true);
    await act(async()=>{finish();await new Promise(resolve=>setTimeout(resolve,0));});
    assert.match(text(view.toJSON()),/Setup restored/);
  } finally {globalThis.fetch=originalFetch;if(view)await act(async()=>view.unmount());}
});

test('archive confirmation: server rejection stays visible and never reports success',async()=>{
  const h=harness('sportsman',false);let view:any;const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false,json:async()=>({message:'Archive permission changed'})} as Response);
  try {
    await act(async()=>{view=create(React.createElement(h.Saved,h.props));});
    const archive=view.root.findAllByType('button').find((n:any)=>text(n)==='Archive Setup');
    await act(async()=>archive.props.onClick({stopPropagation(){}}));
    assert.match(text(view.toJSON()),/free one of your active setup slots/);
    const confirm=view.root.findByProps({role:'alertdialog'}).findAllByType('button').find((n:any)=>text(n)==='Permanently Archive');
    await act(async()=>{confirm.props.onClick({preventDefault(){}});await new Promise(resolve=>setTimeout(resolve,0));});
    assert.match(text(view.toJSON()),/Archive permission changed/);assert(!text(view.toJSON()).includes('Setup archived.'));
    assert(view.root.findByProps({role:'alertdialog'}));
  } finally {globalThis.fetch=originalFetch;if(view)await act(async()=>view.unmount());}
});

test('unsubscribed active cards retain viewing while archive, delete and add actions are unavailable',async()=>{
  const h=harness('unsubscribed',false);let view:any;
  await act(async()=>{view=create(React.createElement(h.Saved,h.props));});
  await act(async()=>view.root.findByType('li').props.onClick());assert.equal(h.loaded,1);
  assert.equal(view.root.findAllByType('button').filter((n:any)=>/Archive Setup|Restore Setup/.test(text(n))||/Delete|Add session/.test(n.props['aria-label']||'')).length,0);
  await act(async()=>view.unmount());
});

test('locked active setup results: lap dropdown remains usable outside disabled editing fields',async()=>{
  const exports=compile('components/TimingDataDisplay.tsx',{'@/lib/performanceSummary':performance});let view:any;
  await act(async()=>{view=create(React.createElement(exports.default,{timingData:{lap_times:[{lap:1,time:'15.123'}]},setupType:'heat'}));});
  const dropdown=view.root.findAllByType('button').find((n:any)=>'aria-expanded' in n.props);
  assert(dropdown);assert.equal(dropdown.props.disabled,undefined);
  await act(async()=>dropdown.props.onClick());assert.equal(dropdown.props['aria-expanded'],true);
  assert.match(text(view.toJSON()),/15.123/);
  await act(async()=>view.unmount());
  const source=ts.createSourceFile('SetupDashboard.tsx',readFileSync(new URL('../src/components/SetupDashboard.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let checked=false;
  const visit=(node:ts.Node)=>{
    if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='TimingDataDisplay'){
      for(let p=node.parent;p;p=p.parent)if(ts.isJsxElement(p))assert.notEqual(p.openingElement.tagName.getText(source),'fieldset','saved results must remain interactive in read-only mode');
      checked=true;
    }
    ts.forEachChild(node,visit);
  };visit(source);assert(checked);
});
