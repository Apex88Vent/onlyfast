import assert from 'node:assert/strict';
import test from 'node:test';
import { qaSettings, allowedOrigin, allowedProxy, allowedQaAsset, assertTester, QA_FEATURE } from '../qa/median-paywall/policy.ts';
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env = { ONLYFAST_QA_TESTER_UUID: uid, ONLYFAST_QA_ANON_KEY: 'sb_publishable_local_fixture' };
test('isolated QA defaults to a store hold and refuses production origins and private keys', () => {
  const config = qaSettings(env);
  assert.equal(config.storeActionsApproved, false);
  assert.equal(allowedOrigin('http://127.0.0.1:8086', config), true);
  assert.equal(allowedOrigin('https://onlyfast.app', config), false);
  assert.equal(allowedOrigin('https://unapproved.example', config), false);
  for (const value of ['https://onlyfast.app', 'https://preview.onlyfast.app', 'https://x.supabase.co', 'http://qa.example', 'https://qa.example/path', 'https://qa.example?enable=true']) {
    assert.throws(() => qaSettings({ ...env, ONLYFAST_QA_HTTPS_ORIGIN: value }));
  }
  assert.throws(() => qaSettings({ ...env, ONLYFAST_QA_ANON_KEY: 'sb_secret_never_client' }));
  assert.throws(() => qaSettings({ ...env, ONLYFAST_QA_ANDROID_KEY: 'sk_private' }));
  assert.throws(() => qaSettings({ ...env, ONLYFAST_QA_IOS_KEY: 'goog_wrong_platform' }));
  const privateOrigin = qaSettings({ ...env, ONLYFAST_QA_HTTPS_ORIGIN: 'https://approved-qa.example' });
  assert.equal(allowedOrigin('https://approved-qa.example', privateOrigin), true);
});
test('tunneled QA serves only explicit runtime assets, never editor, server or private files', () => {
  const files = ['/@fs/C:/qa/src/lib/nativePurchaseController.ts', '/@fs/C:/deps/vite/dist/client/env.mjs'];
  const deps = ['/@fs/C:/qa/node_modules/.vite-median-paywall-qa/deps/'];
  for (const file of ['/', '/client.ts', '/@vite/client', ...files, deps[0] + '@supabase_supabase-js.js', deps[0] + 'chunk-ABC.js']) {
    assert.equal(allowedQaAsset(file, files, deps), true, file);
  }
  for (const file of ['/server.mjs', '/README.md', '/paywall-change-plan.json', '/.env.qa.local', '/__open-in-editor',
    '/__vite_ping', '/@fs/C:/qa/tmp/ios-tester.local.json', deps[0] + '../secret.js', deps[0] + 'private.json', deps[0] + 'vite.js',
    '/%252e%252e/server.mjs', '/%00', '/@fs/C:%5Csecret.js']) assert.equal(allowedQaAsset(file, files, deps), false, file);
});
test('presentation-only QA disables subscription writes while retaining authorized membership reads', () => {
  const settings = qaSettings({ ...env, ONLYFAST_QA_PRESENTATION_ONLY: 'true' });
  assert.equal(settings.presentationOnly, true);
  assert.equal(settings.storeActionsApproved, false);
  assert.equal(allowedProxy('POST', '/functions/v1/sync-revenuecat-subscription', true), false);
  assert.equal(allowedProxy('POST', '/rest/v1/rpc/get_onlyfast_membership', true), true);
  assert.equal(allowedProxy('POST', '/auth/v1/token', true), true);
});
test('QA requires exact synthetic authenticated UUID and trusted flags, without full access', () => {
  const user = { id: uid, email: 'synthetic@example.invalid' };
  const account = { is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' };
  const flags = [{ feature_key: QA_FEATURE, enabled: true }];
  assert.doesNotThrow(() => assertTester(uid, user, account, flags));
  for (const [u, a, f] of [
    [{ ...user, id: 'another-uuid' }, account, flags],
    [{ ...user, email: 'real@example.com' }, account, flags],
    [user, null, flags], [user, { ...account, tester_kind: 'standard' }, flags],
    [user, account, []], [user, account, [...flags, { feature_key: 'test_account_full_access', enabled: true }]],
  ] as const) assert.throws(() => assertTester(uid, u, a, [...f]));
});
test('local proxy exposes only Auth, own membership RPC and existing sync, never admin/database writes', () => {
  assert.equal(allowedProxy('POST', '/functions/v1/sync-revenuecat-subscription'), true);
  assert.equal(allowedProxy('POST', '/rest/v1/rpc/get_onlyfast_membership'), true);
  assert.equal(allowedProxy('POST', '/auth/v1/token'), true);
  for (const path of ['/auth/v1/admin/users', '/auth/v1/signup', '/rest/v1/user_subscriptions',
    '/functions/v1/stripe-webhook', '/rest/v1/rpc/onlyfast_apply_revenuecat', '/auth/v1/../admin/users']) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal(allowedProxy(method, path), false);
  }
});
