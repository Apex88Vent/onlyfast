import { traceRpc } from './api';
import { mapReviewBundle } from './telemetryModel';
import type { SavedLapSession } from './circuit/types';
import {buildSessionCornerAnalysis} from './circuit/cornerAnalysis';
type Row=Record<string,unknown>;
async function load(id:string):Promise<SavedLapSession>{
  const bundle=await traceRpc<Row>('get_track_trace_review_bundle',{p_session_id:id});
  const rows:Row[]=[];let time:string|null=null,cursor:string|null=null;
  while(true){
    const page=await traceRpc<Row[]>('get_track_trace_telemetry_page',{p_session_id:id,p_after_time:time,p_after_id:cursor});
    rows.push(...page);if(page.length<500)break;
    const last=page[page.length-1];const nextTime=String(last.recorded_at),nextId=String(last.id);
    if(nextTime===time&&nextId===cursor)throw new Error('Telemetry cursor did not advance.');
    time=nextTime;cursor=nextId;
  }
  return mapReviewBundle(bundle,rows);
}
export async function fetchLapSessionDetail(id:string){
  try{return {data:await load(id),error:null};}catch{return {data:null,error:'Telemetry could not be loaded or access changed. Retry before interpreting missing data as an empty recording.'};}
}
export async function fetchCompletedLapSessions(){
  try{
    const rows:Row[]=[];
    for(let offset=0;;offset+=100){const page=await traceRpc<Row[]>('list_track_trace_session_cards',{p_offset:offset});rows.push(...page);if(page.length<100)break;}
    // Real aggregate counts avoid fetching every session's complete GPS history.
    const data=rows.map(row=>({...mapReviewBundle({session:row,sample_count:row.sample_count},[]),trackName:String(row.name),
      totalLapsRecorded:Number(row.lap_count),totalLapsSaved:Number(row.valid_lap_count),fastestLapTimeMs:row.fastest_lap_ms as number|null,averageLapTimeMs:row.average_lap_ms as number|null}));
    return {data,error:null};
  }catch{return {data:[],error:'Saved sessions could not be loaded. Check access and try again.'};}
}
export async function renameLapSession(id:string,name:string){
  try{await traceRpc('rename_track_trace_session',{p_session_id:id,p_name:name});return {data:await load(id),error:null};}
  catch{return {data:null,error:'Session could not be renamed. Check recording/edit permissions and try again.'};}
}
// Source calculations are deterministic and run on the already authorized
// measured data. Refreshing this view never rewrites historical telemetry.
export async function regenerateSessionCornerAnalysis(id:string){
  const result=await fetchLapSessionDetail(id);
  if(result.data){
    const analysis=buildSessionCornerAnalysis(result.data,{forceDetection:true});
    result.data={...result.data,cornerAnalysis:analysis,cornerDefinitions:analysis?.definitions??result.data.cornerDefinitions};
  }
  return result;
}
