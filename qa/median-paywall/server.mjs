// Serve-only QA entry. Does not launch native billing, create accounts or expose secrets.
import { readFile, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createServer, loadEnv } from 'vite';
import { qaSettings, allowedOrigin, allowedProxy, assertTester } from './policy.ts';

const qaRoot = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
assert.equal(process.argv.length, 3, 'Provide the existing isolated staging workspace.');
const workspace = await realpath(process.argv[2]);
const config = await readFile(path.join(workspace, 'supabase/config.toml'), 'utf8');
assert.match(config, /^project_id = "onlyfast-disposable-staging"$/m);
assert.doesNotMatch(config, /\[remotes/);
await assert.rejects(access(path.join(workspace, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
const local = JSON.parse(await readFile(path.join(workspace, 'local-status.json'), 'utf8'));
assert.equal(local.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(local.DB_URL).hostname, '127.0.0.1');
assert.equal(new URL(local.DB_URL).port, '54322');
const settings = qaSettings({ ...loadEnv('qa', qaRoot, 'ONLYFAST_QA_'), ONLYFAST_QA_ANON_KEY: local.ANON_KEY });
const target = 'http://127.0.0.1:54321'; // Never configurable to a remote project.
async function localRead(route, token) {
  const response = await fetch(target + route, { headers: { apikey: settings.anonKey, Authorization: token },
    redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Local authorization failed.');
  return response.json();
}
async function authorize(token) {
  assert.ok(token?.startsWith('Bearer '), 'Local sign-in required.');
  const user = await localRead('/auth/v1/user', token);
  assert.equal(user.id, settings.testerId);
  const [accounts, flags] = await Promise.all([
    localRead('/rest/v1/beta_tester_accounts?select=is_test_account,beta_features_enabled,tester_kind&user_id=eq.' + settings.testerId, token),
    localRead('/rest/v1/user_feature_flags?select=feature_key,enabled&user_id=eq.' + settings.testerId, token),
  ]);
  assertTester(settings.testerId, user, accounts[0] || null, flags);
  return user.id;
}
const server = await createServer({ configFile: false, envDir: false, root: qaRoot,
  cacheDir: path.join(root, 'node_modules/.vite-median-paywall-qa'),
  server: { host: '127.0.0.1', port: 8086, strictPort: true, cors: false, hmr: false,
    allowedHosts: settings.httpsOrigin ? [new URL(settings.httpsOrigin).hostname] : [],
    fs: { strict: true, allow: [qaRoot, path.join(root, 'src/lib/nativePurchaseController.ts'), path.join(root, 'src/lib/nativeEnvironment.ts'), await realpath(path.join(root, 'node_modules'))],
      deny: ['**/.env*', '**/.git/**', '**/tmp/**', '**/*.local.*', '**/*.{pem,p8,p12,key}'] },
    proxy: { '/local-supabase': { target, changeOrigin: true, rewrite: value => value.replace(/^\/local-supabase/, ''),
      configure(proxy) { proxy.on('proxyReq', request => { request.setHeader('apikey', settings.anonKey); }); } } },
  }, plugins: [{ name: 'onlyfast-stock-paywall-qa', transformIndexHtml() {
    return [{ tag: 'script', attrs: { type: 'application/json', id: 'qa-settings' },
      children: JSON.stringify(settings).replace(/</g, '\\u003c'), injectTo: 'head' }];
  }, configureServer(vite) {
    vite.middlewares.use(async (request, response, next) => {
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('Referrer-Policy', 'no-referrer');
      const url = new URL(request.url || '/', 'http://127.0.0.1:8086');
      const isAuth = url.pathname === '/__qa/authorize';
      if (!isAuth && !url.pathname.startsWith('/local-supabase')) return next();
      if (!allowedOrigin(request.headers.origin || '', settings)) { response.statusCode = 403; response.end('Origin refused'); return; }
      const route = url.pathname.replace(/^\/local-supabase/, '');
      if (!(isAuth && request.method === 'POST') && !allowedProxy(request.method || '', route)) {
        response.statusCode = 403; response.end('Route refused'); return;
      }
      try {
        // Auth login/logout/user requests go only to local Auth. Membership RPC
        // and sync require the designated tester and server-managed flags again.
        if (isAuth || !route.startsWith('/auth/v1/')) {
          const id = await authorize(request.headers.authorization);
          if (isAuth) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ userId: id })); return; }
        }
        next();
      } catch { response.statusCode = 403; response.end('Authorized local tester required'); }
    });
  } }] });
await server.listen(); server.printUrls();
console.log('LOCAL stock paywall QA only. Store actions ' + (settings.storeActionsApproved ? 'OPERATOR APPROVED' : 'DISABLED') + '. No cloud project or tunnel created.');
