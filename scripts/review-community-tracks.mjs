// Server/operator use only. Default is a dry run; production is refused.
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {pathToFileURL} from 'node:url';

export const TEST_PROJECT='mfzajhnfonrfuiwxgvhe';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function validateReviewPlan(plan){
  if(plan?.projectRef!==TEST_PROJECT||!Array.isArray(plan.entries)||!plan.entries.length)throw Error('Testing project and a nonempty reviewed plan are required.');
  const seen=new Set();
  return plan.entries.map(entry=>{
    if(!uuid.test(entry.trackId)||!/^[a-f0-9]{64}$/i.test(entry.fingerprint)||typeof entry.approve!=='boolean'||seen.has(entry.trackId))throw Error('Invalid or duplicate review entry.');
    if(entry.replaceId!=null&&!uuid.test(entry.replaceId))throw Error('Invalid replacement ID.');
    const acknowledged=entry.acknowledgedDuplicates??[];
    if(!Array.isArray(acknowledged)||acknowledged.some(id=>!uuid.test(id)))throw Error('Invalid duplicate acknowledgements.');
    if(typeof entry.note!=='string'||entry.note.length>1000||(!entry.approve&&entry.note.trim().length<3))throw Error('A valid review note is required.');
    seen.add(entry.trackId);
    return{p_track_id:entry.trackId,p_fingerprint:entry.fingerprint,p_approve:entry.approve,p_note:entry.note,p_replace_id:entry.replaceId??null,p_acknowledged_duplicates:acknowledged};
  });
}
export async function reviewPlan(plan,{apply=false,url='https://'+TEST_PROJECT+'.supabase.co',key,clientFactory=createClient}={}){
  if(url!=='https://'+TEST_PROJECT+'.supabase.co')throw Error('Only the exact isolated testing backend is allowed.');
  const entries=validateReviewPlan(plan);
  if(!apply)return{mode:'dry-run',projectRef:TEST_PROJECT,entries};
  if(!key)throw Error('A server-only testing service key is required; never use a browser credential.');
  const client=clientFactory(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const marker=await client.rpc('get_onlyfast_2027_environment');
  if(marker.error||marker.data?.project_ref!==TEST_PROJECT)throw Error('Testing environment verification failed.');
  const results=[];
  // Each review is atomic. Stop on the first stale/duplicate/access rejection.
  for(const entry of entries){const result=await client.rpc('review_track_trace_scan',entry);if(result.error)throw Error('Review rejected for '+entry.p_track_id+': '+result.error.message);results.push(result.data);}
  return{mode:'applied-to-testing',projectRef:TEST_PROJECT,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=process.argv.slice(2),at=args.indexOf('--plan');if(at<0||!args[at+1])throw Error('Usage: node scripts/review-community-tracks.mjs --plan reviewed.json [--apply-testing]');
    const plan=JSON.parse(await readFile(args[at+1],'utf8'));
    console.log(JSON.stringify(await reviewPlan(plan,{apply:args.includes('--apply-testing'),key:process.env.ONLYFAST_2027_REVIEW_SERVICE_KEY}),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
