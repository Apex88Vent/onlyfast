// Loopback-only developer server. Never imported by the production app/build.
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
assert.equal(process.argv.length, 3, 'Provide the prepared QA directory.');
const qaRoot = path.resolve(process.argv[2]);
assert.ok(qaRoot.startsWith(path.join(root, 'tmp') + path.sep));
const state = JSON.parse(await readFile(path.join(qaRoot, 'ONLYFAST_QA_PREPARATION.json'), 'utf8'));
assert.equal(state.localOnly, true); assert.equal(state.transactionsEnabled, false);
const config = await readFile(path.join(state.workspace, 'supabase/config.toml'), 'utf8');
assert.match(config, /^project_id = "onlyfast-disposable-staging"$/m); assert.doesNotMatch(config, /\[remotes/);
await assert.rejects(access(path.join(state.workspace, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
const settings = JSON.parse(await readFile(path.join(state.workspace, 'local-status.json'), 'utf8'));
assert.equal(settings.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(settings.DB_URL).hostname, '127.0.0.1');
const first = JSON.parse(await readFile(state.tester, 'utf8'));
assert.equal(first.localOnly, true); assert.ok(first.email.endsWith('@example.invalid'));

async function admin(route, method, body) {
  const response = await fetch(settings.API_URL + route, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: settings.ANON_KEY, Authorization: 'Bearer ' + settings.SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(body) });
  assert.ok(response.ok, `Local synthetic test preparation failed: ${response.status}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
const secondPath = path.join(qaRoot, 'switch-tester.local.json');
let second;
try { second = JSON.parse(await readFile(secondPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const email = `release-bridge-switch-${randomBytes(5).toString('hex')}@example.invalid`;
  const password = randomBytes(18).toString('hex');
  const user = await admin('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
  await admin('/rest/v1/beta_tester_accounts', 'POST', { user_id: user.id, is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' });
  await admin('/rest/v1/user_feature_flags', 'POST', { user_id: user.id, feature_key: 'native_subscription_testing', enabled: true });
  second = { localOnly: true, email, password, userId: user.id };
  await writeFile(secondPath, JSON.stringify(second, null, 2), { flag: 'wx' });
}
assert.equal(second.localOnly, true); assert.ok(second.email.endsWith('@example.invalid'));

// Set explicit local public configuration before Vite loads any project env.
Object.assign(process.env, { VITE_SUPABASE_URL: settings.API_URL, VITE_SUPABASE_ANON_KEY: settings.ANON_KEY,
  VITE_HIDE_EXTERNAL_PAYMENTS: 'true', VITE_REVENUECAT_ENABLED: 'false' });
const nonce = randomBytes(24).toString('hex');
const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), mode: 'native-sandbox',
  server: { host: '127.0.0.1', port: 8086, strictPort: true,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/tmp/**', '**/*.local.json'] } }, plugins: [{
    name: 'onlyfast-release-bridge-internal-qa', apply: 'serve',
    transformIndexHtml() { return [{ tag: 'script', attrs: { type: 'module' }, children:
      `window.__onlyFastQaNonce=${JSON.stringify(nonce)};import('/native/android/qa/client.ts');`, injectTo: 'body' }]; },
    configureServer(vite) {
      vite.middlewares.use('/__release_bridge_qa', async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        if (request.method !== 'POST' || request.headers.host !== '127.0.0.1:8086' ||
            request.headers.origin !== 'http://127.0.0.1:8086' || request.headers['x-onlyfast-qa'] !== nonce) {
          response.statusCode = 403; response.end(); return;
        }
        try {
          let data = ''; for await (const chunk of request) { data += chunk; assert.ok(data.length < 200000); }
          const body = JSON.parse(data);
          if (body.operation === 'login') {
            assert.ok(['a', 'b'].includes(body.account));
            const login = body.account === 'a' ? first : second;
            // Only synthetic local passwords, only in this loopback/nonce path.
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ email: login.email, password: login.password, userId: login.userId }));
          } else if (body.operation === 'report') {
            const text = JSON.stringify(body.report, null, 2);
            assert.doesNotMatch(text, /access_token|refresh_token|"password"|"accessToken"|"receipt"/i);
            await writeFile(path.join(qaRoot, 'runtime-report.json'), text);
            console.log('Archived release bridge QA report: ' + (body.report.passed ? 'PASS' : 'INCOMPLETE/FAIL'));
            response.statusCode = 204; response.end();
          } else { response.statusCode = 400; response.end(); }
        } catch { response.statusCode = 400; response.end(); }
      });
    },
  }] });
await server.listen(); server.printUrls();
console.log('LOCAL ONLY; public purchases false; no transaction endpoints.');
