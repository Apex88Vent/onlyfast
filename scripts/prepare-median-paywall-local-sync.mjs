// Offline preparation only. Creates a NEW ignored local function workspace.
// No network calls, database writes, CLI execution or production deployment.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareLocalPaywallSync(workspace, output, testerFile, secretFile) {
  const source = await realpath(workspace);
  const target = path.resolve(output);
  assert.ok(target.startsWith(path.join(root, 'tmp') + path.sep), 'Output must be a new ignored workspace.');
  assert.notEqual(target, source);
  await assert.rejects(access(target), { code: 'ENOENT' });
  const config = await readFile(path.join(source, 'supabase/config.toml'), 'utf8');
  assert.match(config, /^project_id = "onlyfast-disposable-staging"$/m);
  assert.doesNotMatch(config, /\[remotes/);
  await assert.rejects(access(path.join(source, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
  const status = JSON.parse(await readFile(path.join(source, 'local-status.json'), 'utf8'));
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  assert.equal(new URL(status.DB_URL).hostname, '127.0.0.1');
  assert.equal(new URL(status.DB_URL).port, '54322');
  const tester = JSON.parse(await readFile(testerFile, 'utf8'));
  assert.equal(tester.localOnly, true); assert.ok(tester.email.endsWith('@example.invalid'));
  assert.match(tester.userId, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  const env = await readFile(secretFile, 'utf8');
  const key = env.split(/\r?\n/).find(line => line.startsWith('REVENUECAT_SECRET_API_KEY='))?.slice(26).trim().replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '');
  assert.ok(key && key.length <= 4096 && !/[\r\n]/.test(key) && !/^(goog_|appl_|test_)/.test(key), 'Existing server REST key required; value withheld.');
  const functions = path.join(target, 'supabase/functions');
  await mkdir(path.join(functions, '_shared'), { recursive: true });
  await mkdir(path.join(functions, 'sync-revenuecat-subscription'));
  // This isolated source tree contains only the sync handler. Do not retain
  // unrelated function registrations from the existing development workspace.
  const qaConfig = config.split(/(?=^\[)/m).filter(block => !/^\[functions\./.test(block)).join('') +
    '\n[functions.sync-revenuecat-subscription]\nverify_jwt = false\n';
  await writeFile(path.join(target, 'supabase/config.toml'), qaConfig);
  await writeFile(path.join(target, 'local-status.json'), JSON.stringify({ API_URL: status.API_URL, DB_URL: 'postgresql://127.0.0.1:54322/postgres', ANON_KEY: status.ANON_KEY }));
  await writeFile(path.join(functions, '_shared/revenuecat.ts'), await readFile(path.join(root, 'supabase/functions/_shared/revenuecat.ts')));
  await writeFile(path.join(functions, 'sync-revenuecat-subscription/handler.ts'), await readFile(path.join(root, 'supabase/functions/sync-revenuecat-subscription/index.ts')));
  await writeFile(path.join(functions, 'sync-revenuecat-subscription/index.ts'), `// LOCAL ONLY; never deploy this generated entry.
const backend = new URL(Deno.env.get('SUPABASE_URL') || '');
if (backend.protocol !== 'http:' || !['kong','127.0.0.1','localhost','supabase_kong_onlyfast-disposable-staging'].includes(backend.hostname)) throw Error('Nonlocal backend refused');
if (Deno.env.get('REVENUECAT_ALLOW_SANDBOX') !== 'true') throw Error('Local sandbox configuration required');
const original = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === 'https://api.revenuecat.com' && url.pathname === '/v1/subscribers/' + ${JSON.stringify(tester.userId)} && !url.search) {
    if ((init?.method || (input instanceof Request ? input.method : 'GET')) !== 'GET') throw Error('RevenueCat reads only');
    const response = await original(input, { ...init, redirect: 'error' });
    if (response.ok) {
      const body = await response.clone().json();
      for (const item of Object.values(body.subscriber?.subscriptions || {}) as Record<string, unknown>[]) {
        if (!['play_store','app_store'].includes(String(item.store)) || item.is_sandbox !== true) throw Error('Only native sandbox receipts are accepted locally');
      }
    }
    return response;
  }
  if (url.origin !== backend.origin) throw Error('Other customer or external API refused');
  return original(input, { ...init, redirect: 'error' });
};
await import('./handler.ts');
`);
  await writeFile(path.join(target, 'server.env.local'), 'REVENUECAT_SECRET_API_KEY=' + key + '\nREVENUECAT_ALLOW_SANDBOX=true\n', { mode: 0o600 });
  await writeFile(path.join(target, 'LOCAL_ONLY.json'), JSON.stringify({ source, localOnly: true, fixture: false, stores: ['app_store', 'play_store'], testerId: tester.userId, productionDeployable: false }, null, 2));
  return target;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 6, 'Usage: <existing-local-workspace> <NEW-tmp-output> <synthetic-tester-json> <server-env-file>');
  console.log('Prepared scoped local function workspace: ' + await prepareLocalPaywallSync(...process.argv.slice(2)));
}
