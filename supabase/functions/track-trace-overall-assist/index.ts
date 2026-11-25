// Isolated testing only. Uses the existing OpenAI provider and usage ledger.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {reserveUsage,finishUsage,releaseUsage} from '../_shared/usage-authorization.ts';
import {createOverallAssistHandler} from './handler.ts';
import type {OverallEvidence} from '../../../src/features/track-trace/circuit/overallAssist.ts';
const environment=Deno.env.get('SUPABASE_URL')??'';
const provider=Deno.env.get('TRACK_TRACE_OVERALL_AI_ENABLED')==='true'&&Deno.env.get('OPENAI_API_KEY')?async(evidence:OverallEvidence)=>{
 const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+Deno.env.get('OPENAI_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify({
  model:'gpt-4o-mini',temperature:.1,max_tokens:1600,response_format:{type:'json_schema',json_schema:{name:'grounded_driving_focus',strict:true,schema:{type:'object',additionalProperties:false,required:['plan'],properties:{plan:{type:'array',items:{type:'object',additionalProperties:false,required:['cornerNumber','referenceLapId','evidenceIds','focus'],properties:{cornerNumber:{type:'integer'},referenceLapId:{type:'string'},evidenceIds:{type:'array',items:{type:'string'}},focus:{type:'string',enum:['record_more','reference_line','entry_speed','exit_speed','braking_consistency']}}}}}}}},
  messages:[{role:'system',content:'Select a useful driving comparison focus for each corner using only its listed evidence IDs and reference lap. Return JSON matching the schema. No measurements, free-form claims, new references or landmarks. Use record_more for one lap or insufficient evidence. Braking focus requires its braking-start evidence; speed focus requires its speed evidence. Keep all corners in track order. The renderer supplies validated measurements and cautious explanations; isolated fastest segments are theoretical.'},{role:'user',content:JSON.stringify({eligibleLapCount:evidence.eligibleLapIds.length,facts:evidence.facts,plan:evidence.plan.map(p=>({cornerNumber:p.cornerNumber,referenceLapId:p.referenceLapId,evidenceIds:p.evidenceIds,focus:p.focus}))})}]
 })});if(!response.ok)throw Error('Provider unavailable');const value=await response.json();return JSON.parse(value.choices?.[0]?.message?.content??'null');
}:undefined;
Deno.serve(createOverallAssistHandler({environment,reader:token=>createClient(environment,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}}),provider,
 reserve:async(user,body)=>{
  const admin=createClient(environment,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await reserveUsage(admin,user,'timing',body);if(result.status==='complete')return {cached:result.response,finish:async()=>undefined,release:async()=>undefined};
  if(!result.reservation)throw Error('Existing usage limit or pending request');const lease=result.reservation;
  return {finish:response=>finishUsage(lease,response),release:()=>releaseUsage(lease)};
 }
}));
