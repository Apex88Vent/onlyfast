import {supabase} from '@/lib/supabase';
import {trackTraceEnabled} from './api';
export async function getTraceOverallExplanation(sessionId:string,requestId:string):Promise<unknown>{
 if(!trackTraceEnabled)throw Error('Testing environment required');
 const {data,error}=await supabase.functions.invoke('track-trace-overall-assist',{body:{session_id:sessionId,request_id:requestId}});
 if(error||data?.mode!=='ai')throw Error('AI explanation unavailable');return data;
}
