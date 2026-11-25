import {buildOptimumLap} from './optimumLap.ts';
import {buildCornerBenchmarks,compareCornerTraversal,lapCompatibility,type CornerBenchmarkSet,type CornerTraversal} from './cornerBenchmarks.ts';
import type {SavedLapSession} from './types.ts';
export type DrivingFact={id:string;kind:'measured'|'calculated';label:string;value:number;unit:'ms'|'m'|'m/s'|'g'|'count';lapIds:string[];cornerNumber?:number;uncertainty?:number};
export type DrivingFocus='record_more'|'reference_line'|'entry_speed'|'exit_speed'|'braking_consistency';
export type DrivingPlan={cornerNumber:number;referenceLapId:string;referenceLapNumber:number;evidenceIds:string[];focus:DrivingFocus;recommendation:string;observations:string[]};
export type OverallEvidence={version:'track_trace_overall_v1';sessionId:string;frameKey:string;eligibleLapIds:string[];fastestLap:{id:string;number:number;timeMs:number}|null;optimumSectorSumMs:number|null;theoreticalDifferenceMs:number|null;sectorSources:{sector:number;timeMs:number;lapId:string;lapNumber:number}[];benchmarks:CornerBenchmarkSet;facts:DrivingFact[];plan:DrivingPlan[];transitions:{from:number;to:number;lapId:string|null;lapNumber:number|null;sourceLapIds:string[];sourceLapNumbers:number[];message:string}[];limitations:string[];narrative:string;units:'imperial'|'metric'};
export const formatDrivingDistance=(m:number,units:'imperial'|'metric')=>units==='metric'?`${m.toFixed(1)} m`:`${(m/0.9144).toFixed(1)} yd (${(m/0.3048).toFixed(0)} ft)`;
const seconds=(ms:number)=>(ms/1000).toFixed(3)+' s';
export function buildCompatibleOptimum(session:SavedLapSession){
 const eligible=(session.laps??[]).filter(l=>!lapCompatibility(session,l));
 const trustworthyCorners=session.hasStoredCornerDefinitions!==false&&session.geometryCompatibility!=='unverified';
 const compatible={...session,cornerDefinitions:trustworthyCorners?session.cornerDefinitions:null,cornerAnalysis:trustworthyCorners?session.cornerAnalysis:null,laps:eligible.map(l=>({...l,sectorTimesMs:l.sectorTimesMs?.map((n,i)=>{
  const stored=session.sectorResults?.filter(s=>s.lapId===l.id&&s.sectorIndex===i+1)??[];
  return stored.some(s=>!s.isValid||session.sectorDefinitionVersion!=null&&s.sourceDefinitionVersion!==session.sectorDefinitionVersion)?null:n;
 })}))};
 return Number.isFinite(Date.parse(session.startedAt))&&eligible.every(l=>Number.isFinite(Date.parse(l.startedAt))&&Number.isFinite(Date.parse(l.endedAt)))?buildOptimumLap(compatible):null;
}
export function buildOverallAssist(session:SavedLapSession,units:'imperial'|'metric'='imperial'):OverallEvidence{
 const eligible=(session.laps??[]).filter(l=>!lapCompatibility(session,l)).sort((a,b)=>a.lapTimeMs-b.lapTimeMs||a.lapNumber-b.lapNumber);
 const benchmarks=buildCornerBenchmarks(session),facts:DrivingFact[]=[];
 const add=(fact:DrivingFact)=>{facts.push(fact);return fact.id;};
 const fastest=eligible[0]??null;
 // The review and Overall Assist share one compatibility guard around the original algorithm.
 const optimum=buildCompatibleOptimum(session);
 if(fastest)add({id:'fastest-lap',kind:'measured',label:'Fastest valid full lap',value:fastest.lapTimeMs,unit:'ms',lapIds:[fastest.id]});
 if(optimum)add({id:'sector-sum',kind:'calculated',label:'Theoretical optimum sector sum',value:optimum.lap.lapTimeMs,unit:'ms',lapIds:[...new Set(optimum.sectors.map(s=>s.sourceLapId))]});
 const plan:DrivingPlan[]=benchmarks.corners.flatMap(({corner,best,traversals})=>{
   if(!best)return[];
   const prefix='corner-'+corner.cornerNumber,evidenceIds=[add({id:prefix+'-time',kind:'calculated',label:'Best valid traversal of this corner',value:best.timeMs,unit:'ms',lapIds:[best.lapId],cornerNumber:corner.cornerNumber,uncertainty:best.uncertaintyMs})];
   const observations=[`Lap ${best.lapNumber} recorded the fastest eligible Turn ${corner.cornerNumber}: ${seconds(best.timeMs)}. Interpolated timing uncertainty is approximately ±${seconds(best.uncertaintyMs)}.`,...(best.positionUncertaintyM!==null?[`Track-relative locations have an estimated GPS/reference uncertainty of ±${formatDrivingDistance(best.positionUncertaintyM,units)}; they are approximate comparisons.`]:[])];
   const include=(name:string,label:string,value:number|null,unit:DrivingFact['unit'])=>{if(value!==null){evidenceIds.push(add({id:prefix+'-'+name,kind:'calculated',label,value,unit,lapIds:[best.lapId],cornerNumber:corner.cornerNumber}));return true;}return false;};
   include('entry-speed','Reference entry speed',best.entrySpeed,'m/s');include('exit-speed','Reference exit speed',best.exitSpeed,'m/s');include('minimum-speed','Reference minimum corner speed',best.minimumSpeed,'m/s');include('distance','Recorded corner path length',best.distanceM,'m');
   if(include('turn-in','Observed lateral-load onset after start/finish',best.turnInM,'m'))observations.push(`On that traversal, sustained lateral load began approximately ${formatDrivingDistance(best.turnInM!,units)} after start/finish.`);
   if(include('braking-start','Observed braking onset after start/finish',best.brakeStartM,'m'))observations.push(`Recorded braking began approximately ${formatDrivingDistance(best.brakeStartM!,units)} after start/finish.`);
   include('braking-duration','Recorded braking duration within this corner',best.brakeDurationMs,'ms');
   if(include('acceleration','Observed acceleration pickup after start/finish',best.accelerationM,'m'))observations.push(`Recorded acceleration pickup occurred around ${formatDrivingDistance(best.accelerationM!,units)} after start/finish.`);
   if(include('inside-apex','Distance to recorded inside boundary at the defined apex',best.insideAtApexM,'m'))observations.push(`At the defined apex, that trace was approximately ${formatDrivingDistance(best.insideAtApexM!,units)} from the scanned inside boundary; GPS uncertainty still applies.`);
   const focus:DrivingFocus=traversals.length<2?'record_more':best.brakeStartM!==null?'braking_consistency':best.exitSpeed!==null?'exit_speed':'reference_line';
   const baseline=fastest?traversals.find(t=>t.lapId===fastest.id):null;
   if(baseline&&baseline.lapId!==best.lapId){const difference=compareCornerTraversal(baseline,best);if(difference.distinguishable){evidenceIds.push(add({id:prefix+'-delta-vs-fastest',kind:'calculated',label:'Recorded corner difference versus the fastest complete lap',value:difference.deltaMs,unit:'ms',lapIds:[best.lapId,baseline.lapId],cornerNumber:corner.cornerNumber,uncertainty:difference.uncertaintyMs}));observations.push(`This corner was ${seconds(difference.deltaMs)} quicker than the same corner on fastest full Lap ${baseline.lapNumber}. That isolated difference is not an expected connected-lap gain.`);}}
   const location=best.turnInM!==null?`Use the recorded lateral-load onset near ${formatDrivingDistance(best.turnInM,units)} after start/finish as a turn-in comparison, rather than a precise steering command. `:'';
   const recommendation=traversals.length<2?`Use Lap ${best.lapNumber}'s recorded Turn ${corner.cornerNumber} as a baseline. More compatible laps are needed to identify an improvement.`:
    `Review Lap ${best.lapNumber}'s Turn ${corner.cornerNumber} alongside your selected lap. ${location}${best.positionReliable?'Use its recorded line and available load-onset locations as references, allowing for GPS uncertainty.':'Compare the recorded timing and available speeds; precise steering and braking positions are not supported.'} Test changes progressively while preserving a continuous entry and exit.`;
   return [{cornerNumber:corner.cornerNumber,referenceLapId:best.lapId,referenceLapNumber:best.lapNumber,evidenceIds,focus,recommendation,observations}];
 });
 const transitions:OverallEvidence['transitions']=[];
 const continuous=(start:number,end:number)=>{
  if(end<=start)return false;
  const rows=(session.telemetrySamples??[]).filter(s=>{const t=Date.parse(s.timestamp);return t>=start&&t<=end;});
  if(rows.length<2||rows.some(s=>s.interruptionBefore))return false;
  const times=[start,...rows.map(s=>Date.parse(s.timestamp)).sort((a,b)=>a-b),end];return times.slice(1).every((t,i)=>t-times[i]<=2000);
 };
 for(let i=0;i<benchmarks.corners.length;i++){
  const a=benchmarks.corners[i],b=benchmarks.corners[(i+1)%benchmarks.corners.length];if(!a.best||!b.best||a===b)continue;
  const wrap=i===benchmarks.corners.length-1;
  const common=a.traversals.flatMap(x=>b.traversals.filter(y=>(wrap?y.lapNumber===x.lapNumber+1:y.lapId===x.lapId)&&continuous(x.exitAt,y.entryAt)).map(y=>({x,y,time:x.timeMs+y.timeMs}))).sort((x,y)=>x.time-y.time);
  const connected=common[0],lapIds=connected?[...new Set([connected.x.lapId,connected.y.lapId])]:[],lapNumbers=connected?[...new Set([connected.x.lapNumber,connected.y.lapNumber])]:[];
  transitions.push({from:a.corner.cornerNumber,to:b.corner.cornerNumber,lapId:connected?.x.lapId??null,lapNumber:connected?.x.lapNumber??null,sourceLapIds:lapIds,sourceLapNumbers:lapNumbers,
    message:connected?`${lapNumbers.length===1?'Lap':'Laps'} ${lapNumbers.join('–')} ${lapNumbers.length===1?'is a':'provide a'} continuous recorded reference for Turns ${a.corner.cornerNumber}–${b.corner.cornerNumber}. It has the lowest combined corner time among complete compatible recorded connections; the connecting straight is not optimized by this comparison.`:'No compatible continuous recorded connection covers both traversals. A connected transition recommendation is unavailable.'});
 }
 const limitations=[...benchmarks.warnings,...(!eligible.length?['No valid compatible completed laps. Record a circuit session before using Lap Blueprint.']:eligible.length===1?['Only one eligible lap. Lap-to-lap improvement cannot be established.']:[]),
  ...(!optimum?['A theoretical sector sum is unavailable: complete compatible sector timings and lap timestamps are required.']:[]),
  ...(!session.trackMap?.inside_path?.length?['Inside/outside distances are unavailable because scanned boundary geometry is missing.']:[]),
  ...(benchmarks.corners.some(c=>c.best&&!c.best.positionReliable)?['Poor or sparse GPS suppresses precise position and braking-distance recommendations.']:[]),
  ...(!session.phoneMountOrientation?['Phone calibration is unavailable; motion-based turn-in, braking-location and acceleration-pickup guidance is omitted.']:[]),
  ...(!session.telemetrySamples?.some(s=>s.longitudinalG!==null)?['Motion telemetry is missing. No G-force, braking or acceleration measurements are invented.']:[]),
  'Fastest individual sectors and corners form theoretical benchmarks. Their entry/exit conditions may be incompatible; combining them does not guarantee an achievable lap.',
  'Observed differences do not establish causation. A GPS trace does not measure steering angle or pedal position.'];
 const narrative=fastest?`Use your actual fastest complete Lap ${fastest.lapNumber} (${seconds(fastest.lapTimeMs)}) as the continuous-lap baseline. ${optimum?`The recorded sector sum is ${seconds(optimum.lap.lapTimeMs)}; its ${seconds(Math.max(0,fastest.lapTimeMs-optimum.lap.lapTimeMs))} difference is theoretical, not a promised gain. `:''}${plan.length?'From start/finish, review the corners in track order using the references below. Keep the connected transitions from a recorded complete lap rather than stitching isolated fastest segments.':'Corner-specific driving guidance is unavailable. Review the recorded laps and sectors that are present.'}`:'There is insufficient valid lap data for a complete-lap driving strategy.';
 return {version:'track_trace_overall_v1',sessionId:session.id,frameKey:benchmarks.frameKey,eligibleLapIds:eligible.map(l=>l.id),fastestLap:fastest?{id:fastest.id,number:fastest.lapNumber,timeMs:fastest.lapTimeMs}:null,optimumSectorSumMs:optimum?.lap.lapTimeMs??null,theoreticalDifferenceMs:fastest&&optimum?Math.max(0,fastest.lapTimeMs-optimum.lap.lapTimeMs):null,sectorSources:optimum?.sectors.map(s=>({sector:s.sectorIndex,timeMs:s.durationMs,lapId:s.sourceLapId,lapNumber:s.sourceLapNumber}))??[],benchmarks,facts,plan,transitions,limitations,narrative,units};
}
// AI can select grounded explanatory focuses, never supply measurements or free-form claims.
export function validateDrivingExplanation(value:unknown,evidence:OverallEvidence):DrivingPlan[]|null{
 if(!value||typeof value!=='object'||!Array.isArray((value as {plan?:unknown}).plan))return null;
 const rows=(value as {plan:unknown[]}).plan;if(rows.length!==evidence.plan.length)return null;
 const seen=new Set<number>(),plans:DrivingPlan[]=[];
 for(const row of rows){
  if(!row||typeof row!=='object'||Object.keys(row).some(k=>!['cornerNumber','referenceLapId','evidenceIds','focus'].includes(k)))return null;
  const r=row as {cornerNumber:number;referenceLapId:string;evidenceIds:string[];focus:DrivingFocus};
  const original=evidence.plan.find(p=>p.cornerNumber===r.cornerNumber&&p.referenceLapId===r.referenceLapId);if(!original||seen.has(r.cornerNumber)||!Array.isArray(r.evidenceIds)||!r.evidenceIds.length||r.evidenceIds.some(id=>!original.evidenceIds.includes(id)))return null;
  const required:Record<DrivingFocus,string|null>={record_more:null,reference_line:null,entry_speed:'entry-speed',exit_speed:'exit-speed',braking_consistency:'braking-start'};
  if(!Object.prototype.hasOwnProperty.call(required,r.focus)||required[r.focus]&&!r.evidenceIds.some(id=>id.endsWith(required[r.focus]!)))return null;
  if(original.focus==='record_more'&&r.focus!=='record_more')return null;
  if(r.focus!=='record_more'&&evidence.eligibleLapIds.length<2)return null;
  seen.add(r.cornerNumber);plans.push({...original,focus:r.focus,evidenceIds:r.evidenceIds});
 }return plans.sort((a,b)=>a.cornerNumber-b.cornerNumber);
}
export function cornerComparisonNarrative(selected:CornerTraversal,best:CornerTraversal,units:'imperial'|'metric'){
 const delta=compareCornerTraversal(selected,best),out=[`Turn ${selected.cornerNumber}: selected Lap ${selected.lapNumber} ${seconds(selected.timeMs)}; best recorded Lap ${best.lapNumber} ${seconds(best.timeMs)}. Calculated difference: ${seconds(delta.deltaMs)}.`];
 if(!delta.distinguishable)out.push('This difference is within the estimated GPS/interpolation uncertainty; a performance gain is not established.');
 if(delta.insideDeltaM!==null)out.push(`At the defined apex, the selected trace was approximately ${formatDrivingDistance(Math.abs(delta.insideDeltaM),units)} ${delta.insideDeltaM>0?'farther from':'closer to'} the recorded inside boundary.`);
 if(delta.brakingEarlierM!==null)out.push(`On the reference traversal, braking began approximately ${formatDrivingDistance(Math.abs(delta.brakingEarlierM),units)} ${delta.brakingEarlierM>0?'earlier':'later'} along the same track reference.`);
 if(delta.entrySpeedDelta!==null)out.push(`Selected entry speed differed by ${(delta.entrySpeedDelta*2.2369362921).toFixed(1)} mph${units==='metric'?` (${(delta.entrySpeedDelta*3.6).toFixed(1)} km/h)`:''}.`);
 out.push('These are recorded comparisons, not proof that one action caused the time difference.');return out;
}
