import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeLocalCatalog, DIAGNOSTIC_ANDROID_KEY } from '../src/lib/nativeCatalogDiagnostic.ts';

const uuid = '35807a58-6dfb-4a42-bf43-c736a8389e74';
const anonKey = 'a.' + btoa(JSON.stringify({ role: 'anon' })) + '.b';
function fixture() {
  const calls: string[] = [];
  let configured = false;
  const input = {
    mode: 'native-sandbox', url: 'http://127.0.0.1:54321', anonKey,
    pageUrl: 'http://127.0.0.1:8086/native-subscription-test', assertCurrent() {},
    source: { user: async () => uuid,
      account: async () => ({ is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }),
      flags: async () => [{ feature_key: 'native_subscription_testing', enabled: true }],
    },
    bridge: {
      configure: async (params: unknown) => { assert.deepEqual(params, { apiKey: DIAGNOSTIC_ANDROID_KEY, appUserID: uuid }); calls.push('configure'); configured = true; return { success: true }; },
      isInitialized: async () => { calls.push('isInitialized'); return { initialized: configured }; },
      getOfferings: async () => { calls.push('getOfferings'); throw { message: 'Actual-shaped store error fixture' }; },
      purchase: () => { throw new Error('Forbidden purchase'); },
      restorePurchases: () => { throw new Error('Forbidden restore'); },
    },
    read: async (operation: string): Promise<Record<string, unknown>> => {
      calls.push(operation);
      return operation === 'status' ? { sdkConfigured: configured, identityMatchesAuthenticatedUser: configured, anonymous: configured ? false : null }
        : { error: { code: 'ConfigurationError', underlyingErrorMessage: 'Store fixture' } };
    },
  };
  return { input, calls };
}

test('explicit initialization uses verified UUID, verifies native identity and preserves both catalog errors', async () => {
  const { input, calls } = fixture();
  const report = await initializeLocalCatalog(input);
  assert.deepEqual(calls, ['status', 'configure', 'status', 'isInitialized', 'getOfferings', 'readCatalog']);
  assert.equal(report.initialized, true);
  assert.equal(report.calls[1].status, 'rejected');
  assert.deepEqual(report.namedCatalog, { error: { code: 'ConfigurationError', underlyingErrorMessage: 'Store fixture' } });
  assert.ok(!JSON.stringify(report).includes(uuid));
});

test('production, other origins/routes and unauthorized accounts cannot initialize or call native reader', async () => {
  for (const override of [{ mode: 'production' }, { url: 'https://production.supabase.co' },
    { pageUrl: 'http://localhost:8086/native-subscription-test' }, { pageUrl: 'http://127.0.0.1:8086/' }]) {
    const { input, calls } = fixture();
    await assert.rejects(initializeLocalCatalog({ ...input, ...override }));
    assert.deepEqual(calls, []);
  }
  const { input, calls } = fixture();
  input.source.flags = async () => [];
  await assert.rejects(initializeLocalCatalog(input));
  assert.deepEqual(calls, []);
});

test('anonymous or malformed local identity never reaches configuration', async () => {
  const { input, calls } = fixture();
  input.source.user = async () => '$RCAnonymousID:test';
  await assert.rejects(initializeLocalCatalog(input), /UUID/);
  assert.deepEqual(calls, []);
});

test('existing wrong native identity and denied native authorization fail closed', async () => {
  for (const status of [{ sdkConfigured: true, identityMatchesAuthenticatedUser: false }, { error: 'Experimental tester required' }]) {
    const { input, calls } = fixture();
    input.read = async () => status;
    await assert.rejects(initializeLocalCatalog(input));
    assert.deepEqual(calls, []);
  }
});

test('existing correct identity does not configure twice or switch/log out', async () => {
  const { input, calls } = fixture();
  input.read = async operation => operation === 'status' ? { sdkConfigured: true, identityMatchesAuthenticatedUser: true, anonymous: false } : { offering: null };
  await initializeLocalCatalog(input);
  assert.deepEqual(calls, ['isInitialized', 'getOfferings']);
});

test('revoked session after native status prevents configuration', async () => {
  const { input, calls } = fixture();
  input.read = async () => { input.source.flags = async () => []; return { sdkConfigured: false }; };
  await assert.rejects(initializeLocalCatalog(input));
  assert.deepEqual(calls, []);
});
