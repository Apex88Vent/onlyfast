// Local-only copies of the real handlers, with an outbound fixture interceptor.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, stagingSequence } from './prepare-staging-database.mjs';

export async function prepareLocalRevenueCatFunctions(workspace) {
  const root = path.resolve(workspace);
  const configPath = path.join(root, 'supabase', 'config.toml');
  const config = await readFile(configPath, 'utf8');
  assert.match(config, /project_id = "onlyfast-disposable-staging"/);
  assert.doesNotMatch(config, /\[remotes/);
  await assert.rejects(access(path.join(root, 'supabase', '.temp', 'project-ref')),
    { code: 'ENOENT' }, 'workspace must not be linked to a remote project');
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.entries, (await stagingSequence()).entries.map(({ sql, ...e }) => e));
  const functions = path.join(root, 'supabase', 'functions');
  await mkdir(functions); // Refuse existing copies instead of overwriting them.
  await mkdir(path.join(functions, '_shared'));
  await writeFile(path.join(functions, '_shared', 'revenuecat.ts'), await readFile(path.join(repoRoot, 'supabase/functions/_shared/revenuecat.ts')));
  await writeFile(path.join(functions, '_shared', 'onlyfast-local-fetch.ts'), `// GENERATED LOCAL TEST WRAPPER. Never deploy outside this disposable workspace.
const realFetch = globalThis.fetch.bind(globalThis);
const supabase = new URL(Deno.env.get('SUPABASE_URL') || '');
if (supabase.protocol !== 'http:' || !/^(kong|localhost|127\\.0\\.0\\.1|supabase_kong_onlyfast-disposable-staging)$/.test(supabase.hostname)) {
  throw new Error('LOCAL TEST REFUSED: nonlocal Supabase endpoint');
}
const fixture = new URL(Deno.env.get('ONLYFAST_LOCAL_REVENUECAT_URL') || '');
if (fixture.origin !== 'http://host.docker.internal:55439') throw new Error('LOCAL TEST REFUSED: invalid fixture endpoint');
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === 'https://api.revenuecat.com' && url.pathname.startsWith('/v1/subscribers/')) {
    return realFetch(fixture.origin + url.pathname, { ...init, redirect: 'error' });
  }
  if (url.origin !== supabase.origin) throw new Error('LOCAL TEST REFUSED: external API request');
  return realFetch(input, { ...init, redirect: 'error' });
};
`);
  for (const name of ['revenuecat-webhook', 'sync-revenuecat-subscription']) {
    await mkdir(path.join(functions, name));
    await writeFile(path.join(functions, name, 'handler.ts'), await readFile(path.join(repoRoot, 'supabase/functions', name, 'index.ts')));
    await writeFile(path.join(functions, name, 'index.ts'), "import '../_shared/onlyfast-local-fetch.ts';\nawait import('./handler.ts');\n");
  }
  await writeFile(path.join(root, 'local-functions.env'), `# Synthetic fixture configuration only. No actual RevenueCat or Stripe credentials.
REVENUECAT_SECRET_API_KEY=onlyfast-local-fixture-key
REVENUECAT_WEBHOOK_AUTHORIZATION=Bearer onlyfast-local-webhook-secret
REVENUECAT_APP_IDS=app_ios,app_android
REVENUECAT_ALLOW_SANDBOX=true
ONLYFAST_LOCAL_REVENUECAT_URL=http://host.docker.internal:55439
`);
  await writeFile(configPath, config + '\n[functions.revenuecat-webhook]\nverify_jwt = false\n[functions.sync-revenuecat-subscription]\nverify_jwt = false\n');
  return root;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = await prepareLocalRevenueCatFunctions(process.argv[2] || path.join(repoRoot, 'tmp', 'staging-database'));
  console.log(`Prepared local-only RevenueCat handler copies in ${root}. Production source is unchanged.`);
}
