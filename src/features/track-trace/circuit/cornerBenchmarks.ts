import type {CornerDefinition,LapTelemetrySample,SavedLapRecord,SavedLapSession} from './types.ts';
import type {GpsPoint} from './onlylapsTrackScanUtils.ts';
import {calculateDistanceMeters} from './onlylapsTrackScanUtils.ts';
import {getTrackEditorPath} from './trackEditorGeometry.ts';

type Point={lat:number;lng:number};
type Compatibility={trackId?:string;trackVersion?:number;direction?:string;sectorVersion?:number;cornerVersion?:string};
export type CompatibleLap=SavedLapRecord&{traceCompatibility?:Compatibility};
export type CornerTraversal={
  cornerNumber:number;lapId:string;lapNumber:number;timeMs:number;entryAt:number;exitAt:number;
  entry:Point;apex:Point;exit:Point;path:Point[];distanceM:number;
  entrySpeed:number|null;minimumSpeed:number|null;exitSpeed:number|null;
  lateralG:number|null;longitudinalG:number|null;accuracyM:number|null;maximumGapMs:number;
  turnInM:number|null;brakeStartM:number|null;brakeDurationMs:number|null;accelerationM:number|null;
  insideAtApexM:number|null;positionReliable:boolean;uncertaintyMs:number;warnings:string[];
  positionUncertaintyM:number|null;
};
export type CornerBenchmark={corner:CornerDefinition;best:CornerTraversal|null;traversals:CornerTraversal[]};
export type CornerBenchmarkSet={frameKey:string;reference:Point[];lengthM:number;eligibleLapIds:string[];excluded:{lapId:string;reason:string}[];corners:CornerBenchmark[];warnings:string[]};
type Projected=Point&{progress:number;at:number;sample:LapTelemetrySample};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const maxNullable=(values:(number|null)[])=>{const found=values.filter(finite);return found.length?Math.max(...found):null;};
const distance=(a:Point,b:Point)=>calculateDistanceMeters(a,b);
const validPoint=(p:Point)=>finite(p?.lat)&&finite(p?.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
const xy=(p:Point,origin:Point)=>({x:(p.lng-origin.lng)*111320*Math.cos(origin.lat*Math.PI/180),y:(p.lat-origin.lat)*111320});
function projection(p:Point,reference:Point[],cumulative:number[]){
  const origin=reference[0],q=xy(p,origin);let best={distance:Infinity,progress:0,point:reference[0]};
  for(let i=0;i<reference.length-1;i++){
    const a=xy(reference[i],origin),b=xy(reference[i+1],origin),dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    if(!den)continue;const f=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/den));
    const d=Math.hypot(q.x-a.x-f*dx,q.y-a.y-f*dy);
    if(d<best.distance)best={distance:d,progress:(cumulative[i]+f*(cumulative[i+1]-cumulative[i]))/cumulative.at(-1)!,point:{lat:reference[i].lat+(reference[i+1].lat-reference[i].lat)*f,lng:reference[i].lng+(reference[i+1].lng-reference[i].lng)*f}};
  }return best;
}
function cumulative(path:Point[]){const out=[0];for(let i=1;i<path.length;i++)out.push(out[i-1]+distance(path[i-1],path[i]));return out;}
function frame(session:SavedLapSession){
  const map=session.trackMap;
  let source=(map?.representative_path_raw?.length?map.representative_path_raw:map?.representative_path_smoothed??[]).filter(validPoint);
  let path=source.map(p=>({lat:p.lat,lng:p.lng}));
  // One fixed recorded reference for all laps. Never normalize each lap's own distance.
  if(path.length<8){const lap=session.laps?.find(l=>l.isValid&&(l.rawTrace?.length??0)>=8);source=(lap?.rawTrace??[]).filter(validPoint) as GpsPoint[];path=source.map(p=>({lat:p.lat,lng:p.lng}));}
  if(path.length<8)return null;
  if(distance(path[0],path.at(-1)!)<2)path.pop();
  let area=0;for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];area+=a.lng*b.lat-b.lng*a.lat;}
  if((map?.direction==='clockwise'&&area>0)||(map?.direction==='counterclockwise'&&area<0))path.reverse();
  const finish=map?.start_finish_path;
  if(finish?.length){const mid={lat:finish.reduce((n,p)=>n+p.lat,0)/finish.length,lng:finish.reduce((n,p)=>n+p.lng,0)/finish.length};
    let start=0;for(let i=1;i<path.length;i++)if(distance(mid,path[i])<distance(mid,path[start]))start=i;
    path=[...path.slice(start),...path.slice(0,start)];
  }
  path.push({...path[0]});const lengths=cumulative(path);if(lengths.at(-1)!<30)return null;
  // Use the original editor's oriented reference when a saved scan exists.
  if(map){const editor=getTrackEditorPath({...map,representative_path_raw:map.representative_path_raw??[],representative_path_smoothed:map.representative_path_smoothed??[],outside_path:map.outside_path??[],inside_path:map.inside_path??[],start_finish_path:map.start_finish_path??[]},Math.max(180,Math.min(1000,source.length)));if(editor.length>=8){path=editor.map(p=>({lat:p.lat,lng:p.lng}));}}
  const frameLengths=cumulative(path);
  const accuracyPoints=[...source,...(map?.start_finish_path??[])];
  const accuracy=(finish?.length??0)>=2&&accuracyPoints.length&&accuracyPoints.every(p=>finite(p.accuracy))?Math.max(...accuracyPoints.map(p=>p.accuracy!)):null;
  return {path,lengths:frameLengths,accuracy};
}
export function lapCompatibility(session:SavedLapSession,lap:CompatibleLap):string|null{
  if(!lap.isValid||!finite(lap.lapTimeMs)||lap.lapTimeMs<=0)return 'Invalid lap';
  if(lap.trackId&&session.trackId&&lap.trackId!==session.trackId)return 'Different track layout';
  const c=lap.traceCompatibility;if(!c)return null;
  if(c.trackId&&c.trackId!==session.trackId)return 'Different track layout';
  if(c.trackVersion!==undefined&&c.trackVersion!==session.trackMap?.version)return 'Different track version';
  if(c.direction&&c.direction!==session.trackMap?.direction)return 'Different direction';
  if(c.sectorVersion!==undefined&&c.sectorVersion!==session.sectorDefinitionVersion)return 'Different sector definitions';
  if(c.cornerVersion&&c.cornerVersion!==session.cornerDefinitions?.version)return 'Different corner boundaries';
  return null;
}
function interpolate(points:Projected[],progress:number):Projected|null{
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(a.progress>progress||b.progress<progress||b.progress<=a.progress)continue;
    const f=(progress-a.progress)/(b.progress-a.progress),sample={...a.sample};
    for(const key of ['speed','lateralG','longitudinalG','gpsAccuracy'] as const){const x=a.sample[key],y=b.sample[key];sample[key]=finite(x)&&finite(y)?x+(y-x)*f:null;}
    return {lat:a.lat+(b.lat-a.lat)*f,lng:a.lng+(b.lng-a.lng)*f,progress,at:a.at+(b.at-a.at)*f,sample};
  }return null;
}
function traversal(lap:SavedLapRecord,points:Projected[],corner:CornerDefinition,length:number,session:SavedLapSession,referenceAccuracy:number|null):CornerTraversal|null{
  if(!(corner.startProgress>=0&&corner.startProgress<corner.apexProgress&&corner.apexProgress<corner.endProgress&&corner.endProgress<=1))return null;
  const entry=interpolate(points,corner.startProgress),apex=interpolate(points,corner.apexProgress),exit=interpolate(points,corner.endProgress);
  if(!entry||!apex||!exit||exit.at<=entry.at)return null;
  const samples=[entry,...points.filter(p=>p.progress>corner.startProgress&&p.progress<corner.endProgress),exit];
  if(samples.length<4)return null;
  const boundaryPoints=points.filter((p,i)=>p.at>=entry.at&&p.at<=exit.at||i>0&&points[i-1].at<=exit.at&&p.at>=entry.at||i<points.length-1&&p.at<=exit.at&&points[i+1].at>=entry.at);
  const gaps=boundaryPoints.slice(1).map((p,i)=>p.at-boundaryPoints[i].at),maxGap=Math.max(0,...gaps);
  const accuracies=boundaryPoints.map(p=>p.sample.gpsAccuracy);
  const accuracy=accuracies.every(finite)?Math.max(...accuracies as number[]):null;
  // Missing spans/very poor fixes cannot establish a complete traversal.
  if(maxGap>2000||accuracy!==null&&accuracy>10||boundaryPoints.some(p=>(p.sample as LapTelemetrySample&{interruptionBefore?:boolean}).interruptionBefore))return null;
  const positionUncertainty=accuracy!==null&&referenceAccuracy!==null?accuracy+referenceAccuracy:null;
  const reliable=accuracy!==null&&accuracy<=4&&referenceAccuracy!==null&&referenceAccuracy<=4&&maxGap<=600&&samples.length>=8&&lap.smoothingConfidence!=='low';
  const motion=!!session.phoneMountOrientation;
  const eventWindow=points.filter(p=>p.progress>=Math.max(0,corner.startProgress-.06)&&p.progress<=corner.endProgress);
  const onset=(read:(p:Projected)=>number|null,threshold:number,minimum=corner.startProgress-.06)=>{
   for(let i=1;i<eventWindow.length-1;i++){
    const a=eventWindow[i-1],b=eventWindow[i],next=eventWindow[i+1],x=read(a),y=read(b),z=read(next);
    if(x===null||y===null||z===null||x>=threshold||y<threshold||z<threshold||next.at-a.at<50||b.at-a.at>600||next.at-b.at>600||[a,b,next].some(p=>!finite(p.sample.gpsAccuracy)||p.sample.gpsAccuracy>4))continue;
    const fraction=(threshold-x)/(y-x),progress=a.progress+(b.progress-a.progress)*fraction;
    if(progress>=Math.max(0,minimum))return {progress};
   }return null;
  };
  // An already-present load does not establish where turning/braking began.
  const turn=motion?onset(p=>finite(p.sample.lateralG)?Math.abs(p.sample.lateralG):null,.12):null;
  const brake=motion?onset(p=>p.sample.longitudinalG,.05):null;
  const acceleration=motion?onset(p=>finite(p.sample.longitudinalG)?-p.sample.longitudinalG:null,.05,corner.startProgress):null;
  let brakeMs=0,brakeKnown=motion&&samples.every(p=>finite(p.sample.longitudinalG));
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],x=a.sample.longitudinalG,y=b.sample.longitudinalG;
    if(!finite(x)||!finite(y)){brakeKnown=false;continue;}
    const dt=b.at-a.at;if(x>.05&&y>.05)brakeMs+=dt;
    else if((x>.05)!==(y>.05)){const f=(.05-x)/(y-x);brakeMs+=dt*(x>.05?f:1-f);}
  }
  let inside:number|null=null;
  const boundary=session.trackMap?.inside_path??[];
  if(reliable&&boundary.length>=8&&boundary.every(p=>validPoint(p)&&finite(p.accuracy)&&p.accuracy<=4))inside=projection(apex,boundary,cumulative(boundary)).distance;
  const speeds=samples.map(p=>p.sample.speed).filter(finite);
  const warnings=[...(reliable?[]:['GPS/sampling quality limits precise position and braking-location guidance.']),...(motion?[]:['Phone calibration is unavailable; motion-based driving guidance is omitted.'])];
  return {cornerNumber:corner.cornerNumber,lapId:lap.id,lapNumber:lap.lapNumber,timeMs:exit.at-entry.at,entryAt:entry.at,exitAt:exit.at,entry,apex,exit,path:samples.map(p=>({lat:p.lat,lng:p.lng})),distanceM:cumulative(samples).at(-1)!,entrySpeed:entry.sample.speed,minimumSpeed:speeds.length?Math.min(...speeds):null,exitSpeed:exit.sample.speed,
    lateralG:maxNullable(samples.map(p=>finite(p.sample.lateralG)?Math.abs(p.sample.lateralG):null)),longitudinalG:maxNullable(samples.map(p=>p.sample.longitudinalG)),
    accuracyM:accuracy,maximumGapMs:maxGap,turnInM:reliable&&turn?turn.progress*length:null,brakeStartM:reliable&&brake?brake.progress*length:null,brakeDurationMs:brakeKnown?brakeMs:null,accelerationM:reliable&&acceleration?acceleration.progress*length:null,
    insideAtApexM:inside,positionReliable:reliable,positionUncertaintyM:positionUncertainty,uncertaintyMs:Math.max(maxGap/2,positionUncertainty===null?1000:1000*positionUncertainty/Math.max(1,entry.sample.speed??0)),warnings};
}
export function buildCornerBenchmarks(session:SavedLapSession):CornerBenchmarkSet{
  const definitions=session.cornerDefinitions;
  const map=session.trackMap,frameKey=JSON.stringify([session.trackId,map?.version,map?.direction,session.sectorDefinitionVersion,definitions?.version,definitions?.corners]);
  const result:CornerBenchmarkSet={frameKey,reference:[],lengthM:0,eligibleLapIds:[],excluded:[],corners:[],warnings:[]};
  const eligible=(session.laps??[]).filter(l=>{const reason=lapCompatibility(session,l);if(reason)result.excluded.push({lapId:l.id,reason});return !reason;});
  result.eligibleLapIds=eligible.map(l=>l.id);
  if(eligible.some(l=>{const c=(l as CompatibleLap).traceCompatibility;return !c||c.trackVersion===undefined||!c.direction||c.sectorVersion===undefined;}))result.warnings.push('Comparisons use the saved session track/layout snapshot. Per-lap geometry provenance was not recorded for every historical lap.');
  if(session.hasStoredCornerDefinitions===false||!definitions?.corners.length){result.warnings.push('No saved corner boundaries. Only full-lap and sector observations are available.');return result;}
  if(session.geometryCompatibility==='unverified'){result.warnings.push('The recorded track version cannot be verified against this historical map. Corner benchmarks and precise position guidance are unavailable.');return result;}
  if(definitions.travelDirection&&session.trackMap?.direction&&definitions.travelDirection!=='unknown'&&session.trackMap.direction!=='unknown'&&definitions.travelDirection!==session.trackMap.direction){result.warnings.push('Corner definitions and the recorded track use different directions. Corner benchmarks are unavailable.');return result;}
  const reference=frame(session);if(!reference){result.warnings.push('A stable recorded track reference is unavailable. Corner positions and benchmarks cannot be established.');return result;}
  result.reference=reference.path;result.lengthM=reference.lengths.at(-1)!;
  const projected=new Map<string,Projected[]>();
  for(const lap of eligible){
    const rows=(session.telemetrySamples??[]).filter(p=>(p.lapId===lap.id||p.lapNumber===lap.lapNumber)&&(!p.trackId||p.trackId===session.trackId));
    const points:Projected[]=[];let prior=-1,priorTime=-Infinity,bad=false;
    for(const sample of rows){const at=Date.parse(sample.timestamp),point={lat:sample.latitude,lng:sample.longitude};if(!validPoint(point)||!finite(at)||at<=priorTime){bad=true;break;}
      const projected=projection(point,reference.path,reference.lengths);let progress=projected.progress;
      // Final crossing is 1.0, not a second lap beginning at 0.0.
      if(prior>.9&&progress<.03)progress+=1;
      if(progress<prior-.025||progress>1.04||projected.distance>Math.max(25,(sample.gpsAccuracy??10)*3)){bad=true;break;}
      if(progress>=prior){points.push({...point,progress,at,sample});prior=progress;}priorTime=at;
    }
    if(!bad&&points.length>=4)projected.set(lap.id,points);else result.excluded.push({lapId:lap.id,reason:'Incomplete, interrupted or non-monotonic GPS traversal'});
  }
  result.corners=definitions.corners.map(corner=>{
    const apexProgress=projection(corner.apex,reference.path,reference.lengths).progress,delta=Math.abs(apexProgress-corner.apexProgress);
    if(Math.min(delta,1-delta)>.03){result.warnings.push(`Turn ${corner.cornerNumber} boundaries do not align with the saved editor reference. No benchmark was generated.`);return {corner,best:null,traversals:[]};}
    const traversals=eligible.flatMap(lap=>{const points=projected.get(lap.id);const t=points?traversal(lap,points,corner,result.lengthM,session,reference.accuracy):null;return t?[t]:[];}).sort((a,b)=>a.timeMs-b.timeMs||a.lapNumber-b.lapNumber);
    return {corner,best:traversals[0]??null,traversals};
  });return result;
}
export function compareCornerTraversal(selected:CornerTraversal,best:CornerTraversal){
  const uncertainty=selected.uncertaintyMs+best.uncertaintyMs;
  const precise=selected.positionReliable&&best.positionReliable;
  const error=2*Math.hypot(selected.positionUncertaintyM??Infinity,best.positionUncertaintyM??Infinity);
  const entryDistance=distance(selected.entry,best.entry);
  const insideDelta=selected.insideAtApexM!==null&&best.insideAtApexM!==null?selected.insideAtApexM-best.insideAtApexM:null;
  return {deltaMs:selected.timeMs-best.timeMs,uncertaintyMs:uncertainty,
    distinguishable:Math.abs(selected.timeMs-best.timeMs)>uncertainty,
    entryPositionDeltaM:precise&&entryDistance>error?entryDistance:null,
    insideDeltaM:precise&&insideDelta!==null&&Math.abs(insideDelta)>error?insideDelta:null,
    entrySpeedDelta:selected.entrySpeed!==null&&best.entrySpeed!==null?selected.entrySpeed-best.entrySpeed:null,
    exitSpeedDelta:selected.exitSpeed!==null&&best.exitSpeed!==null?selected.exitSpeed-best.exitSpeed:null,
    brakingEarlierM:precise&&selected.brakeStartM!==null&&best.brakeStartM!==null&&Math.abs(selected.brakeStartM-best.brakeStartM)>error?selected.brakeStartM-best.brakeStartM:null};
}
