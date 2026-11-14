// Testing-only adapter: reuse the existing compact telemetry/Setup Assist contract.
// The caller's JWT client preserves RLS; no service-role bypass is constructed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOnlyLapsSetupContext, OnlyLapsSetupContextError } from '../_shared/onlylaps-setup-context.ts';
import { createOnlyLapsSetupContextStore } from '../_shared/onlylaps-setup-context-store.ts';
import { inspectOnlyLapsMeasuredEvidence } from '../_shared/setup-assist-onlylaps-context.ts';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});

Deno.serve(async req => {
  if (Deno.env.get('SUPABASE_URL') !== 'https://mfzajhnfonrfuiwxgvhe.supabase.co') return json({error:'Testing environment required.'},503);
  if (req.method === 'OPTIONS') return new Response('ok',{headers});
  if (req.method !== 'POST') return json({error:'Method not allowed.'},405);
  const token=(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'').trim();
  if (!token) return json({error:'Authentication required.'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
    auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}},
  });
  const {data:auth,error:authError}=await client.auth.getUser(token);
  if(authError || !auth.user) return json({error:'Invalid session.'},401);
  const {data:permission,error}=await client.rpc('get_track_trace_permission');
  if(error || permission?.feature!=='track_trace' || permission?.can_read_history!==true) return json({error:'Historical telemetry access could not be verified.'},403);
  const body=await req.json().catch(()=>null);
  try {
    const context=await getOnlyLapsSetupContext({
      onlyfastSessionId:String(body?.onlyfast_session_id || ''),userId:auth.user.id,
      store:createOnlyLapsSetupContextStore(client),
    });
    if(body?.status_only===true) {
      const evidence=inspectOnlyLapsMeasuredEvidence(context);
      return json({linked:evidence.linked,context_loaded:evidence.contextLoaded,
        usable_measured_facts:evidence.usableMeasuredFacts,analysis_available:evidence.analysisAvailable,
        display_name:context.linked ? context.session.display_name : null});
    }
    return json(context);
  } catch(cause) {
    if(cause instanceof OnlyLapsSetupContextError) return json({error:'Session unavailable.'},cause.code==='invalid_session_id'?400:404);
    return json({error:'Telemetry context unavailable.'},503);
  }
});
