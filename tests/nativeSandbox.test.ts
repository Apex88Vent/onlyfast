import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { assertLocalSandboxConfiguration, authorizeSandboxTester, inspectMedianBridge, diagnosticValue, NATIVE_PURCHASES_READY, NATIVE_TEST_FEATURE, type SandboxAuthorizationSource } from '../src/lib/nativeSandboxPolicy.ts';
import { NativePurchaseController } from '../src/lib/nativePurchaseController.ts';
import { prepareStagingDatabase } from '../scripts/prepare-staging-database.mjs';
import { prepareNativeSandbox } from '../scripts/prepare-native-sandbox.mjs';
import { writeFile } from 'node:fs/promises';

const anon = 'header.' + btoa(JSON.stringify({ role: 'anon' })) + '.signature';
const production = 'https://thpyjvwtfvfxiufchrxn.supabase.co';
test('sandbox client refuses production, missing config, tunnels, URL tricks and secret keys', () => {
  for (const url of [production, undefined, 'https://example.ngrok.app:54321',
    'http://127.0.0.1:54321@evil.com', 'http://localhost.evil.com:54321',
    'http://192.168.1.999:54321', 'ftp://localhost:54321', 'http://127.0.0.1:54321/rest/v1',
    'http://127.0.0.1:54321?url=' + production, 'http://localhost:54321#production',
    'http://user:pass@localhost:54321', 'http://localhost:443']) {
    assert.throws(() => assertLocalSandboxConfiguration('native-sandbox', url, anon));
  }
  assert.throws(() => assertLocalSandboxConfiguration('production', 'http://localhost:54321', anon));
  for (const key of [undefined, 'secret', 'sb_secret_example',
    'a.' + btoa(JSON.stringify({ role: 'service_role' })) + '.z']) {
    assert.throws(() => assertLocalSandboxConfiguration('native-sandbox', 'http://localhost:54321', key));
  }
  for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.1.50', '10.0.0.5', '172.16.4.8']) {
    assert.doesNotThrow(() => assertLocalSandboxConfiguration('native-sandbox', `http://${host}:54321`, anon));
  }
});

const account = { is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' };
const flag = { feature_key: NATIVE_TEST_FEATURE, enabled: true };
const source = (overrides: Partial<SandboxAuthorizationSource> = {}): SandboxAuthorizationSource => ({
  user: async () => 'local-user-a', account: async () => account, flags: async () => [flag], ...overrides,
});
test('only explicitly assigned experimental testers are authorized; errors and full-access grants fail closed', async () => {
  assert.equal(await authorizeSandboxTester(source()), 'local-user-a');
  for (const row of [null, { ...account, is_test_account: false }, { ...account, beta_features_enabled: false },
    { ...account, tester_kind: 'personal' }]) {
    await assert.rejects(authorizeSandboxTester(source({ account: async () => row })));
  }
  for (const flags of [[], [{ ...flag, enabled: false }], [{ feature_key: 'onboarding_preview_route', enabled: true }],
    [flag, { feature_key: 'test_account_full_access', enabled: true }]]) {
    await assert.rejects(authorizeSandboxTester(source({ flags: async () => flags })));
  }
  await assert.rejects(authorizeSandboxTester(source({ user: async () => null })));
  await assert.rejects(authorizeSandboxTester(source({ flags: async () => { throw new Error('offline'); } })), /offline/);
  let calls = 0;
  await assert.rejects(authorizeSandboxTester(source({ user: async () => ++calls === 1 ? 'a' : 'b' })), /account changed/);
});

test('bridge diagnostics call only documented read methods with zero arguments and preserve their actual shapes', async () => {
  const calls: string[] = [];
  const bridge: Record<string, unknown> = Object.fromEntries(['configure', 'login', 'logout', 'getOfferings', 'purchase', 'restorePurchases', 'presentPaywall']
    .map(method => [method, async () => { calls.push(method); throw new Error('Unexpected store operation'); }]));
  let authorizations = 0;
  const authorize = async () => { authorizations++; };
  bridge.isInitialized = async function (...args: unknown[]) {
    assert.equal(this, bridge); assert.deepEqual(args, []);
    calls.push('isInitialized'); return { initialized: true, apiKey: 'goog_public-example' };
  };
  // Match the documented prose example, which omits success. Identifier kind is
  // deliberately unclassified; $rc_monthly is not an offering identifier.
  bridge.getOfferings = async function (...args: unknown[]) {
    assert.equal(this, bridge); assert.deepEqual(args, []);
    calls.push('getOfferings'); return { identifiers: ['$rc_monthly', '$rc_custom_teams_monthly'] };
  };
  const result = await inspectMedianBridge(bridge, authorize);
  assert.equal(result.initialized, true);
  assert.deepEqual(calls, ['isInitialized', 'getOfferings']);
  assert.equal(authorizations, 2);
  assert.equal(result.calls[0].status, 'returned');
  assert.deepEqual(result.calls[0].response, { initialized: true, apiKey: '[redacted]' });
  assert.deepEqual(result.calls[1].response, { identifiers: ['$rc_monthly', '$rc_custom_teams_monthly'] });
  assert.deepEqual(result.catalog.requestedIdentifierLocations, []);
  assert.deepEqual(result.catalog.pricesAndTerms, []);
  assert.equal(result.selectionSupport, 'not_exposed_by_documented_interface');
  await assert.rejects(inspectMedianBridge(undefined, authorize), /absent/);
  // A missing purchase API must not prevent inspecting an available read API.
  assert.equal((await inspectMedianBridge({ ...bridge, purchase: undefined, isInitialized: async () => ({ initialized: false }), getOfferings: async () => ({ identifiers: [] }) }, authorize)).initialized, false);
});

test('rich or unexpected catalogs retain products/prices without inventing selection support', async () => {
  const report = await inspectMedianBridge({
    isInitialized: async () => ({ initialized: true }),
    getOfferings: async () => ({ all: { onlyfast_monthly_v1: {
      identifier: 'onlyfast_monthly_v1', availablePackages: [{ identifier: '$rc_monthly',
        product: { identifier: 'pro:pro', priceString: '4,99 €', currencyCode: 'EUR', trial: { period: 'P7D' } } }],
      unexpectedField: { nested: ['preserved'] },
    } } }),
    getOffering: () => { throw new Error('Undocumented method must never be called'); },
  }, async () => {});
  assert.ok(report.methods.includes('getOffering'));
  assert.ok(report.catalog.requestedIdentifierLocations.some(p => p.includes('onlyfast_monthly_v1')));
  assert.ok(report.catalog.packages.length);
  assert.ok(report.catalog.products.length);
  assert.ok(report.catalog.pricesAndTerms.some(row => row.value === '4,99 €'));
  assert.match(JSON.stringify(report.calls[1].response), /unexpectedField/);
  assert.equal(report.selectionSupport, 'not_exposed_by_documented_interface');
  const nested: Record<string, unknown> = { access_token: 'private-token', ordinary: '<script>not HTML</script>' };
  nested.self = nested;
  assert.deepEqual(diagnosticValue(nested), { access_token: '[redacted]', ordinary: '<script>not HTML</script>', self: '[circular/shared reference]' });
});

test('uninitialized, rejected, missing and malformed read responses remain diagnostic evidence', async () => {
  const result = await inspectMedianBridge({
    isInitialized: async () => ({ initialized: false }),
    getOfferings: async () => { throw { error: { code: 'NOT_CONFIGURED', message: 'SDK not initialized' } }; },
  }, async () => {});
  assert.equal(result.initialized, false);
  assert.equal(result.calls[1].status, 'rejected');
  assert.deepEqual(result.calls[1].error, { error: { code: 'NOT_CONFIGURED', message: 'SDK not initialized' } });
  const missing = await inspectMedianBridge({ isInitialized: async () => ({ unexpected: true }) }, async () => {});
  assert.equal(missing.initialized, null);
  assert.equal(missing.calls[1].status, 'missing');
  const failed = await inspectMedianBridge({ isInitialized: () => { throw new Error('native unavailable'); } }, async () => {});
  assert.deepEqual(failed.calls[0].error, { name: 'Error', message: 'native unavailable' });
});

test('authorization revocation between read calls prevents the next native call', async () => {
  const calls: string[] = [];
  let checks = 0;
  await assert.rejects(inspectMedianBridge({
    isInitialized: async () => { calls.push('isInitialized'); return { initialized: true }; },
    getOfferings: async () => { calls.push('getOfferings'); return {}; },
  }, async () => { if (++checks > 1) throw new Error('Tester revoked'); }), /Tester revoked/);
  assert.deepEqual(calls, ['isInitialized']);
});

test('a nonresponding native read is bounded and reported without initializing or purchasing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const result = inspectMedianBridge({
    isInitialized: () => { entered(); return new Promise(() => {}); },
    getOfferings: async () => ({ success: false, error: { message: 'offline' } }),
  }, async () => {});
  await started;
  t.mock.timers.tick(8000);
  const report = await result;
  assert.equal(report.calls[0].status, 'timed_out');
  assert.equal(report.calls[1].status, 'returned');
  assert.match(JSON.stringify(report.calls[1].response), /offline/);
});

// Execute the real client modules with injected environment and client adapters.
// This verifies the guard runs before any production fallback client is created.
function evaluate<T = Record<string, unknown>>(file: string, env: Record<string, string>, modules: Record<string, unknown>): T {
  const input = readFileSync(new URL('../src/lib/' + file, import.meta.url), 'utf8').replaceAll('import.meta.env', '__env');
  const { outputText } = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} as T };
  new Function('require', 'module', 'exports', '__env', outputText)((id: string) => {
    assert.ok(id in modules, 'Unexpected dependency: ' + id);
    return modules[id];
  }, module, module.exports, env);
  return module.exports;
}
test('real Supabase client fails before fallback creation and isolates local Auth storage', () => {
  const calls: unknown[][] = [];
  const modules = {
    '@supabase/supabase-js': { createClient: (...args: unknown[]) => { calls.push(args); return {}; } },
    './nativeSandboxPolicy': { assertLocalSandboxConfiguration },
  };
  for (const env of [{ MODE: 'native-sandbox' }, { MODE: 'native-sandbox', VITE_SUPABASE_URL: production, VITE_SUPABASE_ANON_KEY: anon }]) {
    assert.throws(() => evaluate('supabase.ts', env, modules));
  }
  assert.equal(calls.length, 0);
  evaluate('supabase.ts', { MODE: 'native-sandbox', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: anon }, modules);
  assert.deepEqual(calls[0], ['http://127.0.0.1:54321', anon, { auth: { storageKey: 'onlyfast-native-sandbox-auth' } }]);
  evaluate('supabase.ts', { MODE: 'production' }, modules);
  assert.equal(calls[1][0], production); // Existing web configuration is preserved.
});

test('public native flag cannot enable a purchase; synchronization pins the original account token', async () => {
  const invocations: unknown[] = [];
  let identity = 'user-a';
  const module = evaluate<{
    nativePurchasesEnabled: boolean; nativePurchases: NativePurchaseController;
    syncNativeSubscription(userId: string): Promise<void>;
  }>('nativePurchases.ts', { VITE_REVENUECAT_ENABLED: 'true' }, {
    './supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: identity }, access_token: 'token-' + identity } } }) },
      functions: { invoke: async (...args: unknown[]) => { invocations.push(args); identity = 'user-b'; return {}; } },
    } },
    './paymentVisibility': { hideExternalPayments: true },
    './nativeEnvironment': { nativePlatform: () => 'android' },
    './nativePurchaseController': { NativePurchaseController, NATIVE_PURCHASES_READY },
    './nativeSandboxPolicy': { NATIVE_PURCHASES_READY },
    './membershipLifecycle': {},
    './trustedMembership': {},
    './subscription': {},
  });
  assert.equal(module.nativePurchasesEnabled, false);
  await assert.rejects(module.nativePurchases.run('user-a', 'purchase'), /coming soon/);
  await assert.rejects(module.nativePurchases.run('user-a', 'restore'), /coming soon/);
  await assert.rejects(module.syncNativeSubscription('user-a'), /account changed/);
  assert.deepEqual(invocations, [['sync-revenuecat-subscription', { body: {}, headers: { Authorization: 'Bearer token-user-a' } }]]);
});

test('sandbox build preparation validates the existing staging workspace, refuses links and never overwrites', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'onlyfast-native-'));
  try {
    const root = path.join(temp, 'staging');
    await prepareStagingDatabase(root);
    const output = path.join(temp, '.env.native-sandbox.local');
    await writeFile(path.join(root, 'local-status.json'), JSON.stringify({ API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', ANON_KEY: anon }));
    await prepareNativeSandbox(root, 'http://192.168.1.50:54321', output);
    const env = await readFile(output, 'utf8');
    assert.match(env, /VITE_REVENUECAT_ENABLED=false/);
    assert.doesNotMatch(env, /thpyjvwtfvfxiufchrxn|SERVICE_ROLE|sk_/);
    await assert.rejects(prepareNativeSandbox(root, undefined, output), { code: 'EEXIST' });
    await assert.rejects(prepareNativeSandbox(root, production, path.join(temp, 'bad-env')));
    await mkdir(path.join(root, 'supabase/.temp'));
    await writeFile(path.join(root, 'supabase/.temp/project-ref'), 'forbidden-remote');
    await assert.rejects(prepareNativeSandbox(root, undefined, path.join(temp, 'linked-env')));
    await rm(path.join(root, 'supabase/.temp/project-ref'));
    await writeFile(path.join(root, 'supabase/migrations', JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')).entries[0].file), '-- drift');
    await assert.rejects(prepareNativeSandbox(root, undefined, path.join(temp, 'drift-env')), /drift/);
  } finally {
    assert.equal(path.dirname(temp), path.resolve(tmpdir()));
    assert.ok(path.basename(temp).startsWith('onlyfast-native-'));
    await rm(temp, { recursive: true, force: true });
  }
});
