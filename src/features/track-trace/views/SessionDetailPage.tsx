import {useMemo,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {fetchLapSessionDetail,regenerateSessionCornerAnalysis,renameLapSession} from '../reviewService';
import {mapReviewBundle} from '../telemetryModel';
import {buildCompatibleOptimum} from '../circuit/overallAssist';
import {lapCompatibility} from '../circuit/cornerBenchmarks';
import {formatLapTime} from '../circuit/lapFiltering';
import type {TraceContext} from '../api';
import {ReviewSection} from './ReviewSection';
import {LapSectorTable} from './LapSectorTable';
import {LapComparison} from './LapComparison';
import {ReplayMap} from './ReplayMap';
import {ReplayTelemetryPanel} from './ReplayTelemetryPanel';
import {OptimumLapSummary} from './OptimumLapSummary';
import {CornerBenchmarkReview} from './CornerBenchmarkReview';
import {OverallAssistPanel} from './OverallAssistPanel';
import {ShareTelemetryPanel} from './ShareTelemetryPanel';
import {RecordedTelemetryChart} from './RecordedTelemetryChart';
import {getLapReplayPath} from './LapTraceView';

const sections=[['timing','Lap timing details'],['sectors','Sector comparison'],['trace','GPS track trace'],['speed','Speed analysis'],['gforce','G-force analysis'],['comparison','Lap comparisons'],['corners','Corner analysis'],['optimum','Optimum lap analysis'],['overall','Lap Blueprint'],['observations','Session observations']] as const;
const sampleSections=new Set(['trace','speed','gforce','comparison','corners','optimum','overall']);
export function SessionDetailPage({sessionId,userId,revision,summary,readOnly=true}:{sessionId:string;userId:string;revision:string;summary:TraceContext;readOnly?:boolean}){
 const metadata=useMemo(()=>mapReviewBundle({...summary},[],{derive:false}),[summary]);
 const [ids,setIds]=useState<string[]>([]),[activeId,setActiveId]=useState(''),[open,setOpen]=useState<Set<string>>(()=>new Set());
 const [units,setUnits]=useState<'imperial'|'metric'>('imperial'),[progress,setProgress]=useState(0),[mapMode,setMapMode]=useState<'full'|'follow'>('full'),[replayOptimum,setReplayOptimum]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const cache=useQueryClient(),key=['track_trace','detail',userId,revision,sessionId];
 const sessionLevel=!metadata.laps?.length;
 const needsDetail=[...open].some(id=>sampleSections.has(id)&&(id==='overall'||id==='optimum'||ids.length>0||sessionLevel&&['trace','speed','gforce'].includes(id)));
 const detail=useQuery({queryKey:key,queryFn:async({signal})=>{const response=await fetchLapSessionDetail(sessionId,signal);if(!response.data)throw Error(response.error??'Telemetry unavailable');return response.data;},enabled:needsDetail,staleTime:300000,gcTime:0,retry:false,refetchOnWindowFocus:false});
 const session=detail.data??metadata,selected=(session.laps??[]).filter(l=>ids.includes(l.id)),active=selected.find(l=>l.id===activeId)??selected[0];
 const visualSession=useMemo(()=>session.hasStoredCornerDefinitions===false||session.geometryCompatibility==='unverified'?{...session,cornerDefinitions:null,cornerAnalysis:null}:session,[session]);
 const optimum=useMemo(()=>detail.data?buildCompatibleOptimum(session):null,[detail.data,session]);
 const samples=(session.telemetrySamples??[]).filter(p=>sessionLevel||selected.some(l=>l.lapNumber===p.lapNumber)),valid=(session.laps??[]).filter(l=>l.isValid);
 function toggleLap(id:string){setIds(old=>old.includes(id)?old.filter(i=>i!==id):[...old,id]);setActiveId(id);setReplayOptimum(false);}
 function toggle(id:string){setOpen(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}
 async function action(kind:'rename'|'corners'){
  const name=kind==='rename'?window.prompt('Session name (leave blank to use the default)',session.sessionName??''):'';if(name===null)return;
  setBusy(true);try{const result=kind==='rename'?await renameLapSession(sessionId,name):await regenerateSessionCornerAnalysis(sessionId);if(result.data){cache.setQueryData(key,result.data);setMessage(kind==='rename'?'Session renamed.':'Corner preview regenerated; stored telemetry and definitions are unchanged.');}else setMessage(result.error??'Action unavailable.');}finally{setBusy(false);}
 }
 function content(id:string):ReactNode{
  if(!selected.length&&!['overall','optimum','observations'].includes(id)&&!(sessionLevel&&['trace','speed','gforce'].includes(id)))return <p className="text-sm text-muted-foreground">Select at least one lap above to review this section.</p>;
  if(sampleSections.has(id)&&detail.isPending)return <div role="status" className="space-y-2"><p className="text-sm">Loading recorded telemetry…</p><Skeleton className="h-24 rounded-xl"/></div>;
  if(sampleSections.has(id)&&detail.isError)return <p role="alert" className="text-sm text-red-800">Recorded telemetry could not be loaded. Lap totals and selections are retained. <Button variant="link" onClick={()=>void detail.refetch()}>Retry</Button></p>;
  if(id==='timing')return <ul className="space-y-3 text-sm">{selected.map(l=><li key={l.id}><strong>Lap {l.lapNumber}: {formatLapTime(l.lapTimeMs)}</strong><p>{l.startedAt||'Start timestamp unavailable'} → {l.endedAt||'End timestamp unavailable'}</p>{l.excludedReason&&<p>{l.excludedReason}</p>}</li>)}</ul>;
  if(id==='sectors')return <LapSectorTable session={session} validLaps={selected.filter(l=>l.isValid)} optimum={null} onReplayLap={lap=>setActiveId(lap.id)} onReplayOptimum={()=>undefined} selectedLapId={active?.id} showOptimumDetails={false} readOnly/>;
  if(id==='trace'){
   if(selected.length===1&&active&&(samples.length||active.rawTrace?.length||active.smoothedTrace?.length))return <LapComparison session={visualSession} validLaps={selected.filter(l=>l.isValid)} selectedLap={active} optimum={null} showCornerAnalysis={false} showTelemetry={false}/>;
   const traces=sessionLevel?[{id:'session',label:'Session trace · no completed laps',path:samples.map(p=>({lat:p.latitude,lng:p.longitude,timestamp:p.timestamp,accuracy:p.gpsAccuracy,altitude:p.altitude,heading:p.heading,speed:p.speed})),progress:1,color:'#007DAE'}]:selected.map((lap,i)=>({id:lap.id,label:'Lap '+lap.lapNumber,path:getLapReplayPath({lap,samples:samples.filter(p=>p.lapNumber===lap.lapNumber),traceMode:'raw'}),progress:1,color:i%2?'#7E22CE':'#007DAE'}));
   return traces.some(t=>t.path.length)?<ReplayMap track={session.trackMap} traces={traces} title="Recorded GPS traces" viewMode={mapMode} onViewModeChange={setMapMode}/>:<p>No GPS trace is stored for this selection.</p>;
  }
  if(id==='speed'||id==='gforce')return <div className="space-y-3">
   {id==='gforce'?<p className="text-sm text-muted-foreground">0.75 G yellow · 1.50 G red/outer limit. Numeric measurements remain unchanged above the limit.</p>:selected.map(lap=>{const speeds=samples.filter(s=>s.lapNumber===lap.lapNumber).map(s=>s.speed).filter((n):n is number=>n!==null&&Number.isFinite(n));const speed=(n:number|null)=>n===null?'Unavailable':`${(n*(units==='metric'?3.6:2.2369362921)).toFixed(1)} ${units==='metric'?'km/h':'mph'}`;return <p className="rounded-xl bg-muted/50 p-3 text-sm" key={lap.id}>Lap {lap.lapNumber}: stored average {speed(lap.averageSpeed)} · maximum {speed(speeds.length?Math.max(...speeds):lap.maxSpeed)}</p>;})}
   <RecordedTelemetryChart samples={samples.filter(p=>sessionLevel||p.lapNumber===active?.lapNumber)} series={id==='speed'?[{key:'speed',label:'Speed',color:'#007DAE',factor:units==='metric'?3.6:2.2369362921}]:[{key:'lateralG',label:'Lateral G',color:'#007DAE'},{key:'longitudinalG',label:'Longitudinal G (+ braking / − acceleration)',color:'#475569'}]} unit={id==='speed'?(units==='metric'?'km/h':'mph'):'G'} title={id==='speed'?'Recorded speed trace':'Recorded G-force trace'}/>
   {(active||sessionLevel)&&<><label className="block text-sm">Recorded position<input aria-label={id==='gforce'?'G-force trace position':'Speed trace position'} type="range" min={0} max={1000} value={progress*1000} onChange={e=>setProgress(Number(e.target.value)/1000)} className="min-h-11 w-full"/></label><ReplayTelemetryPanel title={active?'Lap '+active.lapNumber+' recorded telemetry':'Session recorded telemetry'} samples={samples.filter(p=>sessionLevel||p.lapNumber===active?.lapNumber)} progress={progress} lap={active}/></>}
   {id==='gforce'&&!samples.some(s=>s.longitudinalG!==null||s.lateralG!==null)&&<p>No stored motion/G-force samples. Missing readings are not estimated.</p>}
  </div>;
  if(id==='comparison'){
   const comparable=selected.filter(l=>!lapCompatibility(session,l));
   if(comparable.length<2)return <p>Select two or more compatible valid laps above, then enable Compare Laps. Invalid or incompatible laps cannot be compared. Selections remain when this section is collapsed.</p>;
   return <LapComparison session={visualSession} selectedLap={comparable.find(l=>l.id===active?.id)??comparable[0]} validLaps={comparable} optimum={null} showCornerAnalysis={false} showTelemetry={false}/>;
  }
  if(id==='corners')return active?<CornerBenchmarkReview session={session} lapId={active.id} units={units}/>:null;
  if(id==='optimum')return optimum?<><p className="text-sm">Theoretical sector sum across all compatible valid laps; not necessarily an achievable connected lap.</p><OptimumLapSummary optimum={optimum} session={session} onReplay={()=>setReplayOptimum(true)}/>{replayOptimum&&<LapComparison session={session} selectedLap={optimum.lap} selectedSamplesOverride={optimum.samples} selectedLabel="Theoretical optimum sector composite" validLaps={valid} optimum={optimum} showCornerAnalysis={false}/>}</>:<p>Complete compatible sector timings and lap timestamps are required for an optimum lap.</p>;
  if(id==='overall')return <OverallAssistPanel session={session} units={units} allowAi={!readOnly}/>;
  return <div className="space-y-3 text-sm"><p>{session.notes||'No session notes stored.'}</p>{summary.analysis.map(a=><article key={a.id}>{a.summary_text&&<p className="whitespace-pre-wrap">{a.summary_text}</p>}{a.optimum_lap_time_ms!==null&&<p>Stored optimum: {formatLapTime(a.optimum_lap_time_ms)}</p>}</article>)}{session.gpsErrorMessage&&<p role="alert">{session.gpsErrorMessage}</p>}<ShareTelemetryPanel session={session}/>{!readOnly&&<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action('rename')}>Rename session</Button><Button variant="outline" disabled={busy} onClick={()=>void action('corners')}>Regenerate corner preview</Button></div>}{message&&<p role="status">{message}</p>}<details><summary className="min-h-11 cursor-pointer py-3">Stored statistics, exclusions and diagnostics</summary><p className="mb-2">Stored measurements are retained in their original units (speed: m/s; loads: G).</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({laps:session.laps?.map(({rawTrace,smoothedTrace,...lap})=>lap),diagnostics:session.recordingDiagnostics},null,2)}</pre></details></div>;
 }
 const duration=Date.parse(session.endedAt)-Date.parse(session.startedAt);
 return <div className="min-w-0 space-y-3" aria-label="Collapsible session review"><header><h2 className="break-words text-xl font-bold">{session.sessionName||session.trackName}</h2><p className="mt-1 text-sm text-muted-foreground">{session.endedAt?'Saved circuit session':'Unfinished session'} · {Number.isFinite(Date.parse(session.startedAt))?new Date(session.startedAt).toLocaleString():'Date unavailable'}</p></header>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Fastest lap',formatLapTime(metadata.fastestLapTimeMs)],['Average lap',formatLapTime(metadata.averageLapTimeMs)],['Valid laps',String(valid.length)],['Duration',Number.isFinite(duration)?`${Math.max(0,duration)/1000} s`:'Unavailable']].map(([label,value])=><Card key={label} className="min-w-0 rounded-2xl p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-lg font-bold tabular-nums">{value}</p></Card>)}</div>
  <Card className="space-y-3 rounded-2xl p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Select laps</h3><label className="text-sm">Units <select aria-label="Review units" value={units} onChange={e=>setUnits(e.target.value as typeof units)} className="min-h-11 rounded-lg border border-input bg-card px-2"><option value="imperial">Yards / mph</option><option value="metric">Meters / km/h</option></select></label></div><p className="text-xs text-muted-foreground">Select one lap for individual review or multiple laps to compare. Detailed sections start collapsed.</p>{session.laps?.length?<ul className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{session.laps.map(l=><li key={l.id}><label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={ids.includes(l.id)} onChange={()=>toggleLap(l.id)} aria-label={'Select Lap '+l.lapNumber} className="h-5 w-5 shrink-0 accent-[#007DAE]"/><span>Lap {l.lapNumber} · {formatLapTime(l.lapTimeMs)}{!l.isValid?' · Excluded':''}</span></label></li>)}</ul>:<p className="text-sm">No completed laps. Session observations remain accessible.</p>}{selected.length>1&&<label className="block text-sm">Individual review lap<select aria-label="Individual review lap" value={active?.id} onChange={e=>setActiveId(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-card px-3">{selected.map(l=><option key={l.id} value={l.id}>Lap {l.lapNumber}</option>)}</select></label>}</Card>
  {sections.map(([id,title])=><ReviewSection key={id} id={id} title={title} open={open.has(id)} onToggle={()=>toggle(id)}>{open.has(id)?content(id):null}</ReviewSection>)}
 </div>;
}
