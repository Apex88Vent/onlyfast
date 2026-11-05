// PREPARED ONLY: explicit fixture reset; never a login/logout hook.
// Keep TEST_ACCOUNT_RESET_ENABLED=false until separately reviewed deployment.
// Supabase Auth/feature checks are reused; no customer subscription/metadata reset.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasBetaFeatureForUser } from '../_shared/beta-features.ts';
import { QA_EMAIL, QA_PRODUCTION_REF, QA_PRODUCTION_USER, QA_RESET_CONFIRMATION, QA_CLEANUP_CONFIRMATION, QA_MARKER,
  QA_TABLE_OWNERS, isUUID, qaFixtureId, assertQARecordOwnership, validateQARecords, validateQARunRecords } from '../_shared/qa-fixtures.ts';

const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),{status,headers});

Deno.serve(async (req: Request) => {
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(Deno.env.get('TEST_ACCOUNT_RESET_ENABLED')!=='true')return json({error:'QA_RESET_DISABLED'},403);
  try {
    const body=await req.json();
    const cleanup=body?.action==='cleanup_qa_run', probe=body?.action==='verify_qa_cleanup';
    if(!probe && !(cleanup?body.confirmation===QA_CLEANUP_CONFIRMATION:body?.action==='reset_qa_fixtures' && body.confirmation===QA_RESET_CONFIRMATION))return json({error:'QA_EXPLICIT_RESET_REQUIRED'},400);
    const url=Deno.env.get('SUPABASE_URL') || '', key=Deno.env.get('SUPABASE_ANON_KEY') || '';
    const project=new URL(url).hostname.split('.')[0];
    const expected=project===QA_PRODUCTION_REF?QA_PRODUCTION_USER:Deno.env.get('ONLYFAST_QA_USER_ID');
    if(!isUUID(expected) || !key)return json({error:'QA_SERVER_CONFIGURATION_REQUIRED'},503);
    // A production reset is a separately authorized operator action.
    if(project===QA_PRODUCTION_REF && Deno.env.get('ONLYFAST_QA_PRODUCTION_RESET_APPROVED')!=='true')return json({error:'QA_PRODUCTION_RESET_NOT_APPROVED'},403);
    const token=(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'').trim();
    if(!token)return json({error:'AUTHENTICATION_REQUIRED'},401);
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
    const {data,error}=await client.auth.getUser(token);
    if(error || data?.user?.id!==expected || data.user.email?.toLowerCase()!==QA_EMAIL)return json({error:'QA_IDENTITY_REQUIRED'},403);
    if(!await hasBetaFeatureForUser(client,expected,'test_account_reset','experimental'))return json({error:'QA_RESET_PERMISSION_REQUIRED'},403);
    const records=probe?[]:cleanup?validateQARunRecords(body.records,body.runId):await validateQARecords(body.records,project=== 'localhost'||project==='127'?'local':project,expected);
    // The original reset already required this server-only credential. Here it
    // is used solely to detect cross-owner/cascade dependencies hidden by RLS.
    // Ordinary QA reads/writes never use it; all reset deletes below use the JWT.
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!service)return json({error:'QA_DEPENDENCY_CHECK_UNAVAILABLE'},503);
    const observer=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    if(probe) {
      for(const table of ['shared_setups','onlyfast_onlylaps_session_links']) {
        const result=await observer.from(table).select('id').eq('id','00000000-0000-0000-0000-000000000000').limit(1);
        if(result.error)throw Error('QA_DEPENDENCY_CHECK_UNAVAILABLE');
      }
      return json({ok:true,protocol:'onlyfast-qa-v1',cleanupReady:true});
    }
    const allowedShares=new Set(records.filter(r=>r.table==='shared_setups').map(r=>r.id));
    const allowedSetups=new Set(records.filter(r=>r.table==='race_setups').map(r=>r.id));
    for(const record of records) {
      const owner=QA_TABLE_OWNERS[record.table];
      const found=await client.from(record.table).select('*').eq('id',record.id).eq(owner,expected).maybeSingle();
      if(found.error)throw Error('QA_RECORD_READ_FAILED');
      if(!found.data)continue;
      assertQARecordOwnership(found.data,record,expected);
      if(cleanup) {
        const marker=found.data.custom_fields?.[QA_MARKER];
        if(marker?.persistent!==false || marker.runId!==body.runId)throw Error('QA_RUN_MARKER_REQUIRED');
      }
      if(record.table==='shared_setups') {
        const parentId=await qaFixtureId(project==='localhost'||project==='127'?'local':project,expected,'setup:dirt:hotlaps');
        if(found.data.setup_id!==parentId)throw Error('QA_PARENT_REQUIRED');
        const parent=await client.from('race_setups').select('*').eq('id',parentId).eq('user_id',expected).single();
        if(parent.error)throw Error('QA_PARENT_REQUIRED');
        assertQARecordOwnership(parent.data,{table:'race_setups',id:parentId,key:'setup:dirt:hotlaps'},expected);
      }
      if(record.table==='race_setups') {
        const shares=await observer.from('shared_setups').select('id,shared_by').eq('setup_id',record.id);
        const links=await observer.from('onlyfast_onlylaps_session_links').select('id').eq('onlyfast_session_id',record.id).limit(1);
        if(shares.error || links.error || links.data?.length || shares.data?.some((s: {id:string;shared_by:string})=>!allowedShares.has(s.id)||s.shared_by!==expected))throw Error('QA_EXTERNAL_REFERENCE');
      }
      if(record.table==='race_schedule') {
        const children=await observer.from('race_setups').select('id,user_id').eq('race_schedule_id',record.id);
        if(children.error || children.data?.some((s: {id:string;user_id:string})=>!allowedSetups.has(s.id)||s.user_id!==expected))throw Error('QA_EXTERNAL_REFERENCE');
      }
    }
    let deleted=0;
    // Explicit child-first order, bounded exact IDs. No subscription/Auth/usage
    // deletes, no broad owner deletes, no OnlyLaps telemetry deletion.
    for(const table of ['shared_setups','race_setups','race_schedule'] as const)for(const record of records.filter(r=>r.table===table)) {
      const fresh=await client.auth.getUser(token);
      if(fresh.error || fresh.data?.user?.id!==expected)throw Error('QA_IDENTITY_CHANGED');
      const removed=await client.from(table).delete().eq('id',record.id).eq(QA_TABLE_OWNERS[table],expected).select('id');
      if(removed.error)throw Error('QA_RESET_INCOMPLETE');
      deleted+=removed.data?.length || 0;
    }
    return json({ok:true,deleted});
  } catch {
    // Never serialize SDK errors, tokens, private records or subscription data.
    return json({error:'QA_RESET_REFUSED_OR_INCOMPLETE'},400);
  }
});
