import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { NATIVE_PURCHASES_READY, NativePurchaseController } from '../src/lib/nativePurchaseController.ts';

function client(env: Record<string, string> = {}, platform: 'android' | 'ios' | null = 'android', native = true) {
  let calls = 0;
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/nativePurchases.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env', '__env'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as { nativePurchasesEnabled: boolean; nativePurchases: NativePurchaseController; syncNativeSubscription(id: string): Promise<void> } };
  const modules = {
    './nativePurchaseController': { NATIVE_PURCHASES_READY, NativePurchaseController },
    './paymentVisibility': { hideExternalPayments: native },
    './nativeEnvironment': { nativePlatform: () => platform },
    './membershipLifecycle': {}, './trustedMembership': {}, './subscription': {},
    './supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'local-test-uuid' }, access_token: 'synthetic-token' } } }) },
      functions: { invoke: async () => { calls++; return { data: { error: 'Not authorized' }, error: null }; } },
    } },
  };
  new Function('require', 'module', 'exports', '__env', code)((name: string) => {
    assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name];
  }, mod, mod.exports, { VITE_REVENUECAT_ENABLED: 'true', VITE_REVENUECAT_ANDROID_API_KEY: 'public-test-key', ...env });
  return { ...mod.exports, calls: () => calls };
}

test('platform hold blocks purchases and restoration even when the master flag is true', async () => {
  const module = client();
  assert.equal(module.nativePurchasesEnabled, false);
  await assert.rejects(module.nativePurchases.run('local-test-uuid', 'purchase'), /coming soon/);
  await assert.rejects(module.nativePurchases.run('local-test-uuid', 'restore'), /coming soon/);
  assert.equal(module.calls(), 0);
});

test('authorized Android activation leaves iOS, unknown platforms and ordinary web billing gated independently', () => {
  assert.equal(NATIVE_PURCHASES_READY, true);
  const android = { VITE_REVENUECAT_ANDROID_ENABLED: 'true' };
  assert.equal(client(android, 'android').nativePurchasesEnabled, true);
  assert.equal(client(android, 'ios').nativePurchasesEnabled, false);
  assert.equal(client(android, null).nativePurchasesEnabled, false);
  assert.equal(client(android, 'android', false).nativePurchasesEnabled, false);
  assert.equal(client({ ...android, VITE_REVENUECAT_ENABLED: 'false' }).nativePurchasesEnabled, false);
  assert.equal(client({ VITE_REVENUECAT_IOS_ENABLED: 'true' }, 'ios').nativePurchasesEnabled, true);
  assert.equal(client({ VITE_REVENUECAT_IOS_ENABLED: 'true' }, 'android').nativePurchasesEnabled, false);
});

test('a server denial in a successful HTTP response cannot be reported as synchronized access', async () => {
  const module = client();
  await assert.rejects(module.syncNativeSubscription('local-test-uuid'), /could not confirm/);
  assert.equal(module.calls(), 1);
});
