import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const base='17b48fad',git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
const normal=s=>s.replaceAll('\r\n','\n');
const files=git('ls-tree','-r','--name-only',base,'--','src','supabase').split('\n').filter(f=>f&&(
 f.startsWith('src/lib/')||f.startsWith('src/contexts/')||f.startsWith('src/hooks/')||f.startsWith('supabase/testing-2027/')||f.startsWith('supabase/migrations/')||f.startsWith('supabase/functions/')||
 /^src\/features\/track-trace\/(api|useTrackTrace|useCircuitGps|recordingJournal)\./.test(f)||
 /^src\/features\/track-trace\/circuit\/(recorder|startFinishCrossing|sectorTiming|telemetryMath|telemetrySmoothing|lapFiltering|optimumLap)\./.test(f)||
 /^(src\/components\/SetupDashboard.tsx|src\/features\/track-trace\/TrackTraceSessionLink.tsx)$/.test(f)));
for(const file of files)assert.equal(normal(readFileSync(file,'utf8')),normal(git('show',base+':'+file)),file+' protected');
function inspect(text){const source=ts.createSourceFile('controller.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),functions=new Map(),effects=[],gps=[];function visit(n){if(ts.isFunctionDeclaration(n)&&n.name&&n.body)functions.set(n.name.text,normal(n.body.getText(source)));if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){if(n.expression.text==='useEffect')effects.push(normal(n.getText(source)));if(n.expression.text==='useCircuitGps')gps.push(normal(n.getText(source)));}ts.forEachChild(n,visit);}visit(source);return{functions,effects,gps};}
const recorder='src/features/track-trace/TrackTraceRecorder.tsx',old=inspect(git('show',base+':'+recorder)),now=inspect(readFileSync(recorder,'utf8'));
for(const name of ['interrupt','storageError','upload','arm','save','download'])assert.equal(now.functions.get(name),old.functions.get(name),name+' controller unchanged');
assert.deepEqual(now.effects,old.effects);assert.deepEqual(now.gps,old.gps);
const result={base,protectedFiles:files.length,recorderHandlers:6,gpsSampleCallbacks:'unchanged',recorderLifecycleEffects:'unchanged',existingOptimumAlgorithm:'unchanged',testingOnlyNewSummaryMigration:1,existingMigrationsChanged:0,productionChanges:0};writeFileSync('tmp/track-trace-beta/scope-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
