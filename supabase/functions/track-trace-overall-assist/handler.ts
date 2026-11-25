import {mapReviewBundle,type TelemetryRow} from '../../../src/features/track-trace/telemetryModel.ts';
import {buildOverallAssist,validateDrivingExplanation,type OverallEvidence} from '../../../src/features/track-trace/circuit/overallAssist.ts';
type Result={data:unknown;error:unknown};
type Reader={auth:{getUser:(token:string)=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<Result>};
export type OverallHandlerDependencies={environment:string;reader:(token:string)=>Reader;provider?:(evidence:OverallEvidence)=>Promise<unknown>;
 reserve?:(user:{id:string},body:Record<string,unknown>)=>Promise<{cached?:unknown;finish:(response:unknown)=>Promise<void>;release:()=>Promise<void>}>};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
export function createOverallAssistHandler(deps:OverallHandlerDependencies){return async(req:Request)=>{
 if(deps.environment!=='https://mfzajhnfonrfuiwxgvhe.supabase.co')return json({error:'Testing environment required'},503);
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'').trim();if(!token)return json({error:'Authentication required'},401);
 const reader=deps.reader(token),auth=await reader.auth.getUser(token);if(auth.error||!auth.data.user)return json({error:'Invalid session'},401);
 const user=auth.data.user,body=await req.json().catch(()=>null);
 if(!body||!uuid.test(body.session_id??'')||!uuid.test(body.request_id??'')||Object.keys(body).some(k=>!['session_id','request_id'].includes(k)))return json({error:'Session and request IDs required'},400);
 const permission=await reader.rpc('get_track_trace_permission');const access=permission.data as {feature?:string;can_record?:boolean;tier?:string}|null;
 if(permission.error||access?.feature!=='track_trace'||access.can_record!==true||!['pro','factory'].includes(access.tier??''))return json({error:'Track Trace permission required'},403);
 let lease:Awaited<ReturnType<NonNullable<OverallHandlerDependencies['reserve']>>>|undefined;
 try{
  const bundle=await reader.rpc('get_track_trace_review_bundle',{p_session_id:body.session_id});if(bundle.error)return json({error:'Session unavailable'},404);
  const data=bundle.data as TelemetryRow,session=data?.session as TelemetryRow|undefined;if(session?.id!==body.session_id||session.user_id!==user.id)return json({error:'Session unavailable'},404);
  const rows:TelemetryRow[]=[];let time:string|null=null,cursor:string|null=null;
  for(let page=0;;page++){
   if(page>=100)return json({error:'This session exceeds the analysis window; no partial benchmark was generated'},413);
   const result=await reader.rpc('get_track_trace_telemetry_page',{p_session_id:body.session_id,p_after_time:time,p_after_id:cursor});
   if(result.error||!Array.isArray(result.data))throw Error('Telemetry unavailable');const items=result.data as TelemetryRow[];rows.push(...items);if(items.length<500)break;
   const last=items.at(-1)!,nextTime=String(last.recorded_at),nextId=String(last.id);if(nextTime===time&&nextId===cursor)throw Error('Non-advancing telemetry');time=nextTime;cursor=nextId;
  }
  const evidence=buildOverallAssist(mapReviewBundle(data,rows));
  const fallback=(reason:string)=>json({mode:'deterministic',reason,analysis_version:evidence.version,eligible_lap_ids:evidence.eligibleLapIds,plan:evidence.plan});
  if(!deps.provider||!evidence.plan.length)return fallback('Measured summary available; AI explanation unavailable or insufficient corner data');
  if(!deps.reserve)return fallback('Existing AI usage authorization is unavailable');
  lease=await deps.reserve(user,{request_id:body.request_id,track_trace_session_id:body.session_id,analysis_version:evidence.version,frame_key:evidence.frameKey,sample_count:rows.length,ended_at:session.ended_at});
  const result=lease.cached??await deps.provider(evidence),plan=validateDrivingExplanation(result,evidence);if(!plan)throw Error('Unsupported provider claims');
  const response={mode:'ai',analysis_version:evidence.version,plan:plan.map(p=>({cornerNumber:p.cornerNumber,referenceLapId:p.referenceLapId,evidenceIds:p.evidenceIds,focus:p.focus}))};
  if(!lease.cached)await lease.finish(response);return json(response);
 }catch{if(lease)await lease.release();return json({mode:'deterministic',reason:'AI or telemetry analysis unavailable. Use the measured findings already shown in session review.'});}
};}
