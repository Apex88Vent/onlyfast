// Local review artifacts only: no provider, database or deployment operations.
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../supabase/testing-2027/',import.meta.url);
const names=['20261117235314_onlyfast_2027_phase3e_sandbox_billing_testing.sql','phase3e-sandbox-verify.sql','phase3e-functions.plan.json','phase3d-revenuecat-products.plan.json'];
const files={};
for(const name of names){
  const bytes=await readFile(new URL(name,root));
  files[name]={sha256:createHash('sha256').update(bytes).digest('hex').toUpperCase(),bytes:bytes.length};
}
const manifest={project_ref:'mfzajhnfonrfuiwxgvhe',organization_id:'wxswxtsewczfijycqnwi',
  migration_name:'onlyfast_2027_phase3e_sandbox_billing_testing',version:'20261117235314',
  migration_status:'prepared_not_installed',deployment_status:'blocked_pending_credentials_and_isolation',
  sandbox_transactions_authorized:false,files};
await writeFile(new URL('phase3e-sandbox.manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
