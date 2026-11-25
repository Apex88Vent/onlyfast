// Explicit synthetic QA data. Never imported by the shipped application.
import {reviewFixture} from '../../../tests/helpers/trackTraceReviewFixture';
// Resolved by the QA bundler only; never a runtime database or production client.
import historical from 'qa:historical-fixture';
export const fixture=reviewFixture(),calls:{name:string;args:Record<string,unknown>}[]=[];
export const TRACK_TRACE_NAME='OnlyFast Track Trace',TRACK_TRACE_FEATURE='track_trace',trackTraceEnabled=true;
const session={id:'10000000-0000-4000-8000-000000000001',user_id:'owner',name:'Measured practice',session_name:'Measured practice',track_map_id:fixture.trackId,session_type:'circuit',started_at:fixture.startedAt,ended_at:fixture.endedAt,device_info:{gForceConvention:'vehicle_braking_positive_v2',phoneMountOrientation:'top_forward',trackVersion:3,cornerDefinitions:fixture.cornerDefinitions}};
const laps=fixture.laps!.map(l=>({id:l.id,lap_number:l.lapNumber,duration_ms:l.lapTimeMs,started_at:l.startedAt,ended_at:l.endedAt,is_valid:true,average_speed:l.averageSpeed,max_speed:l.maxSpeed,sector_times_ms:l.sectorTimesMs}));
const context={session,laps,sectors:[],analysis:[{id:'stored',summary_text:'Synthetic recorded session. Driving analysis is separate from mechanical Setup Assist.',optimum_lap_time_ms:null}]};
const rows=fixture.telemetrySamples!.map((s,i)=>({id:String(i),recorded_at:s.timestamp,latitude:s.latitude,longitude:s.longitude,speed_mps:s.speed,accuracy_meters:s.gpsAccuracy,raw:{gForceConvention:'vehicle_braking_positive_v2',sample:s}}));
export async function traceRpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
 if(name==='get_track_trace_review_summary')return traceRpc<T>('get_track_trace_session',args);
 calls.push({name,args});let result:unknown;
 if((window as unknown as {__traceFailTelemetry?:boolean}).__traceFailTelemetry&&name==='get_track_trace_telemetry_page')throw Error('Synthetic telemetry outage');
 if(new URLSearchParams(location.search).get('scenario')==='free'){
  const free={...context,session:{...session,track_map_id:null},laps:[],sectors:[]};
  if(name==='get_track_trace_session')return structuredClone(free) as T;
  if(name==='get_track_trace_review_bundle')return structuredClone({...free,map:null,sample_count:rows.length}) as T;
  if(name==='get_track_trace_telemetry_page')return structuredClone(rows.filter(r=>Number(r.id)>Number(args.p_after_id??-1)).slice(0,500).map(r=>({...r,raw:{...r.raw,sample:{...r.raw.sample,lapId:null,lapNumber:null,trackId:null}}}))) as T;
 }
 if(new URLSearchParams(location.search).get('legacy')==='1'&&historical){
  if(name==='get_track_trace_session')return structuredClone(historical.bundle) as T;
  if(name==='get_track_trace_review_bundle')return structuredClone(historical.bundle) as T;
  if(name==='get_track_trace_telemetry_page')return structuredClone(historical.rows.filter(r=>Number(r.id)>Number(args.p_after_id??-1)).slice(0,500)) as T;
  if(name==='list_track_trace_sessions')return [structuredClone(historical.bundle.session)] as T;
 }
 if(name==='get_track_trace_session')result=context;
 else if(name==='get_track_trace_review_bundle')result={...context,map:fixture.trackMap,sample_count:rows.length,layout:{sectorCount:2,version:2}};
 else if(name==='get_track_trace_telemetry_page')result=rows.filter(r=>Number(r.id)>Number(args.p_after_id??-1)).slice(0,500);
 else if(name==='list_track_trace_session_cards')result=[{...session,lap_count:3,valid_lap_count:3,sample_count:rows.length,fastest_lap_ms:fixture.fastestLapTimeMs,average_lap_ms:fixture.averageLapTimeMs}];
 else if(name==='list_track_trace_sessions')result=[session];
 else if(name==='list_user_setup_summaries')result=[];
 else if(name==='get_track_trace_setup_context')result={linked:true,context};
 else if(name==='list_track_trace_tracks'||name==='search_track_trace_tracks')result=[{...fixture.trackMap,name:fixture.trackName,can_select:true,is_owner:false,publication_status:'published',community_location:'Synthetic circuit',community_layout_name:'Main layout',user_sectors:[],sector_defaults:[{sector_count:2,version:2}]}];
 else if(name==='rename_track_trace_session'){session.session_name=String(args.p_name);result={saved:true};}
 else if(name==='get_onlyfast_2027_setup_edit_state')result={editable:true};
 else throw Error('This isolated visual preview cannot save GPS or track data. Use the authenticated testing application at http://127.0.0.1:4201 for recording and scanning.');
 return structuredClone(result) as T;
}
export const getTraceAssistStatus=async()=>({linked:true,usable_measured_facts:true});
export const supabaseUrl='synthetic-preview://track-trace';
export const supabase={functions:{invoke:async()=>({data:{mode:'deterministic'},error:null})},auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>({data:null,error:null})};
