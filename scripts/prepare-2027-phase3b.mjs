// Local artifact preparation only. No provider API, credentials, DB connection or deployment.
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath,pathToFileURL } from 'node:url';
const directory=new URL('../supabase/testing-2027/',import.meta.url);
export async function preparePhase3bArtifacts() {
  const baseline=await readFile(new URL('phase2-archives-retention.sql',directory),'utf8');
  const tables=['user_subscriptions'];
  const extra=tables.map(name=>`  union all\n  select '${name}' as table_name, count(*) as row_count,\n    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5\n  from public.${name} t`).join('\n');
  const retention='-- Phase 3B: compare BEFORE/AFTER installation, before fixture mutations. Includes original billing rows.\n'+baseline.replace(') r order by table_name;',extra+'\n) r order by table_name;');
  if(!retention.includes("select 'user_subscriptions'"))throw new Error('Retention source drift');
  await writeFile(new URL('phase3b-subscriptions-retention.sql',directory),retention.replaceAll('\r\n','\n'));
  const files={};
  for(const file of ['phase3b-subscriptions-install.sql','phase3b-subscriptions-retention.sql','phase3b-subscriptions-verify.sql','phase3b-products.plan.json']) {
    const bytes=await readFile(new URL(file,directory));
    files[file]={sha256:createHash('sha256').update(bytes).digest('hex').toUpperCase(),bytes:bytes.length};
  }
  const manifest={project_ref:'mfzajhnfonrfuiwxgvhe',organization_id:'wxswxtsewczfijycqnwi',migration_name:'onlyfast_2027_phase3b_subscriptions_testing',
    installation_authorized:false,deployment_authorized:false,files};
  await writeFile(new URL('phase3b-subscriptions.manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await preparePhase3bArtifacts(),null,2));
